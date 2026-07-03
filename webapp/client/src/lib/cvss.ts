// Exact CVSS base-score computation, used to display the calculated Base Score derived from a
// vector so the user never has to type it in (and cannot enter a value that disagrees with the
// vector).
//   - CVSS v3.0 / v3.1: the standard base-score formula (FIRST.org specification).
//   - CVSS v4.0: the official FIRST.org reference algorithm (macrovector lookup + interpolation),
//     using the reference data tables in ./cvss-data.
import { cvssLookup, maxComposed, maxSeverity } from './cvss-data';

/** Parse a "CVSS:x.y/AV:N/AC:L/…" vector into a {metric: value} map (the prefix segment is ignored). */
function parseVector(vector: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const part of vector.trim().split('/')) {
        const [k, v] = part.split(':');
        if (k && v && k !== 'CVSS') out[k] = v;
    }
    return out;
}

/** Detect the CVSS version from a vector prefix (e.g. "CVSS:4.0/…"). */
export function cvssVersionOf(vector?: string): string | null {
    const m = vector ? /^CVSS:(\d+\.\d+)\//.exec(vector.trim()) : null;
    return m ? m[1] : null;
}

// ---------------------------------------------------------------- CVSS v3.0 / v3.1
const V3_AV: Record<string, number> = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 };
const V3_AC: Record<string, number> = { L: 0.77, H: 0.44 };
const V3_PR_U: Record<string, number> = { N: 0.85, L: 0.62, H: 0.27 }; // Scope unchanged
const V3_PR_C: Record<string, number> = { N: 0.85, L: 0.68, H: 0.5 }; // Scope changed
const V3_UI: Record<string, number> = { N: 0.85, R: 0.62 };
const V3_CIA: Record<string, number> = { H: 0.56, L: 0.22, N: 0 };

/** CVSS v3.1 round-up: smallest one-decimal number >= input (integer arithmetic to avoid FP drift). */
function roundup31(x: number): number {
    const i = Math.round(x * 100000);
    return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10;
}
/** CVSS v3.0 round-up: ceil to one decimal place. */
function roundup30(x: number): number {
    return Math.ceil(x * 10) / 10;
}

function cvss3Base(vector: string, version: '3.0' | '3.1'): number | null {
    const m = parseVector(vector);
    if (!['AV', 'AC', 'PR', 'UI', 'S', 'C', 'I', 'A'].every((k) => k in m)) return null;
    const scopeChanged = m.S === 'C';
    const av = V3_AV[m.AV];
    const ac = V3_AC[m.AC];
    const ui = V3_UI[m.UI];
    const pr = (scopeChanged ? V3_PR_C : V3_PR_U)[m.PR];
    const c = V3_CIA[m.C];
    const i = V3_CIA[m.I];
    const a = V3_CIA[m.A];
    if ([av, ac, ui, pr, c, i, a].some((x) => typeof x !== 'number')) return null;
    const iss = 1 - (1 - c) * (1 - i) * (1 - a);
    const impact = scopeChanged
        ? version === '3.0'
            ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15)
            : 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss * 0.9731 - 0.02, 13)
        : 6.42 * iss;
    const exploitability = 8.22 * av * ac * pr * ui;
    if (impact <= 0) return 0;
    const raw = scopeChanged ? Math.min(1.08 * (impact + exploitability), 10) : Math.min(impact + exploitability, 10);
    return version === '3.0' ? roundup30(raw) : roundup31(raw);
}

// ---------------------------------------------------------------- CVSS v4.0 (FIRST.org reference)
// Per-metric ordering used to measure the "severity distance" from a MacroVector's highest vector.
const LEVELS: Record<string, Record<string, number>> = {
    AV: { N: 0.0, A: 0.1, L: 0.2, P: 0.3 },
    PR: { N: 0.0, L: 0.1, H: 0.2 },
    UI: { N: 0.0, P: 0.1, A: 0.2 },
    AC: { L: 0.0, H: 0.1 },
    AT: { N: 0.0, P: 0.1 },
    VC: { H: 0.0, L: 0.1, N: 0.2 },
    VI: { H: 0.0, L: 0.1, N: 0.2 },
    VA: { H: 0.0, L: 0.1, N: 0.2 },
    SC: { H: 0.1, L: 0.2, N: 0.3 },
    SI: { S: 0.0, H: 0.1, L: 0.2, N: 0.3 },
    SA: { S: 0.0, H: 0.1, L: 0.2, N: 0.3 },
    CR: { H: 0.0, M: 0.1, L: 0.2 },
    IR: { H: 0.0, M: 0.1, L: 0.2 },
    AR: { H: 0.0, M: 0.1, L: 0.2 },
};

/** Resolve a metric's effective value: environmental (M…) overrides base; E/CR/IR/AR default to worst. */
function m4(sel: Record<string, string>, metric: string): string | undefined {
    const selected = sel[metric];
    if (metric === 'E' && (selected === undefined || selected === 'X')) return 'A';
    if ((metric === 'CR' || metric === 'IR' || metric === 'AR') && (selected === undefined || selected === 'X')) return 'H';
    const mod = sel['M' + metric];
    if (mod !== undefined && mod !== 'X') return mod;
    return selected;
}

function extractValueMetric(metric: string, str: string): string {
    const extracted = str.slice(str.indexOf(metric) + metric.length + 1);
    const slash = extracted.indexOf('/');
    return slash > 0 ? extracted.substring(0, slash) : extracted;
}

function eqMaxes(macro: string, eq: number): any {
    return maxComposed['eq' + eq][macro[eq - 1]];
}

function macroVector(sel: Record<string, string>): string {
    const eq = (k: string) => m4(sel, k);
    let eq1: string;
    if (eq('AV') === 'N' && eq('PR') === 'N' && eq('UI') === 'N') eq1 = '0';
    else if ((eq('AV') === 'N' || eq('PR') === 'N' || eq('UI') === 'N') && !(eq('AV') === 'N' && eq('PR') === 'N' && eq('UI') === 'N') && eq('AV') !== 'P') eq1 = '1';
    else eq1 = '2';

    const eq2 = eq('AC') === 'L' && eq('AT') === 'N' ? '0' : '1';

    let eq3: string;
    if (eq('VC') === 'H' && eq('VI') === 'H') eq3 = '0';
    else if (eq('VC') === 'H' || eq('VI') === 'H' || eq('VA') === 'H') eq3 = '1';
    else eq3 = '2';

    let eq4: string;
    if (eq('MSI') === 'S' || eq('MSA') === 'S') eq4 = '0';
    else if (eq('SC') === 'H' || eq('SI') === 'H' || eq('SA') === 'H') eq4 = '1';
    else eq4 = '2';

    const eq5 = eq('E') === 'A' ? '0' : eq('E') === 'P' ? '1' : '2';

    const eq6 =
        (eq('CR') === 'H' && eq('VC') === 'H') || (eq('IR') === 'H' && eq('VI') === 'H') || (eq('AR') === 'H' && eq('VA') === 'H') ? '0' : '1';

    return eq1 + eq2 + eq3 + eq4 + eq5 + eq6;
}

const V4_METRICS = ['AV', 'PR', 'UI', 'AC', 'AT', 'VC', 'VI', 'VA', 'SC', 'SI', 'SA', 'CR', 'IR', 'AR'];

function cvss4Base(vector: string): number | null {
    const sel = parseVector(vector);
    if (!['AV', 'AC', 'AT', 'PR', 'UI', 'VC', 'VI', 'VA', 'SC', 'SI', 'SA'].every((k) => k in sel)) return null;
    // Exception: no impact on the vulnerable or subsequent system → score 0.
    if (['VC', 'VI', 'VA', 'SC', 'SI', 'SA'].every((k) => m4(sel, k) === 'N')) return 0;

    const macro = macroVector(sel);
    let value = cvssLookup[macro];
    if (value === undefined) return null;

    const [eq1, eq2, eq3, eq4, eq5, eq6] = macro.split('').map((c) => parseInt(c, 10));

    // Next-lower MacroVector on each equivalence class (may not exist → score is undefined → NaN).
    const eq1Next = `${eq1 + 1}${eq2}${eq3}${eq4}${eq5}${eq6}`;
    const eq2Next = `${eq1}${eq2 + 1}${eq3}${eq4}${eq5}${eq6}`;
    const eq4Next = `${eq1}${eq2}${eq3}${eq4 + 1}${eq5}${eq6}`;
    const eq5Next = `${eq1}${eq2}${eq3}${eq4}${eq5 + 1}${eq6}`;

    let scoreEq3Eq6Next: number | undefined;
    if (eq3 === 1 && eq6 === 1) scoreEq3Eq6Next = cvssLookup[`${eq1}${eq2}${eq3 + 1}${eq4}${eq5}${eq6}`];
    else if (eq3 === 0 && eq6 === 1) scoreEq3Eq6Next = cvssLookup[`${eq1}${eq2}${eq3 + 1}${eq4}${eq5}${eq6}`];
    else if (eq3 === 1 && eq6 === 0) scoreEq3Eq6Next = cvssLookup[`${eq1}${eq2}${eq3}${eq4}${eq5}${eq6 + 1}`];
    else if (eq3 === 0 && eq6 === 0) {
        const left = cvssLookup[`${eq1}${eq2}${eq3}${eq4}${eq5}${eq6 + 1}`];
        const right = cvssLookup[`${eq1}${eq2}${eq3 + 1}${eq4}${eq5}${eq6}`];
        scoreEq3Eq6Next = left === undefined && right === undefined ? undefined : Math.max(left ?? -Infinity, right ?? -Infinity);
    } else scoreEq3Eq6Next = cvssLookup[`${eq1}${eq2}${eq3 + 1}${eq4}${eq5}${eq6 + 1}`];

    const scoreEq1Next = cvssLookup[eq1Next];
    const scoreEq2Next = cvssLookup[eq2Next];
    const scoreEq4Next = cvssLookup[eq4Next];
    const scoreEq5Next = cvssLookup[eq5Next];

    // Compose the candidate "highest severity" vectors and pick the first the input dominates.
    const eq1m = eqMaxes(macro, 1) as string[];
    const eq2m = eqMaxes(macro, 2) as string[];
    const eq3eq6m = eqMaxes(macro, 3)[macro[5]] as string[];
    const eq4m = eqMaxes(macro, 4) as string[];
    const eq5m = eqMaxes(macro, 5) as string[];
    const maxVectors: string[] = [];
    for (const a of eq1m) for (const b of eq2m) for (const c of eq3eq6m) for (const d of eq4m) for (const e of eq5m) maxVectors.push(a + b + c + d + e);

    let dist: Record<string, number> = {};
    for (const mv of maxVectors) {
        const d: Record<string, number> = {};
        for (const metric of V4_METRICS) {
            d[metric] = (LEVELS[metric][m4(sel, metric) as string] ?? 0) - (LEVELS[metric][extractValueMetric(metric, mv)] ?? 0);
        }
        dist = d;
        if (!V4_METRICS.some((metric) => d[metric] < 0)) break;
    }

    const csdEq1 = dist.AV + dist.PR + dist.UI;
    const csdEq2 = dist.AC + dist.AT;
    const csdEq3Eq6 = dist.VC + dist.VI + dist.VA + dist.CR + dist.IR + dist.AR;
    const csdEq4 = dist.SC + dist.SI + dist.SA;

    const step = 0.1;
    const availEq1 = value - (scoreEq1Next as number);
    const availEq2 = value - (scoreEq2Next as number);
    const availEq3Eq6 = value - (scoreEq3Eq6Next as number);
    const availEq4 = value - (scoreEq4Next as number);
    const availEq5 = value - (scoreEq5Next as number);

    const maxSevEq1 = maxSeverity['eq1'][eq1] * step;
    const maxSevEq2 = maxSeverity['eq2'][eq2] * step;
    const maxSevEq3Eq6 = maxSeverity['eq3eq6'][eq3][eq6] * step;
    const maxSevEq4 = maxSeverity['eq4'][eq4] * step;

    let n = 0;
    let ns1 = 0;
    let ns2 = 0;
    let ns36 = 0;
    let ns4 = 0;
    let ns5 = 0;
    if (!isNaN(availEq1)) {
        n++;
        ns1 = availEq1 * (csdEq1 / maxSevEq1);
    }
    if (!isNaN(availEq2)) {
        n++;
        ns2 = availEq2 * (csdEq2 / maxSevEq2);
    }
    if (!isNaN(availEq3Eq6)) {
        n++;
        ns36 = availEq3Eq6 * (csdEq3Eq6 / maxSevEq3Eq6);
    }
    if (!isNaN(availEq4)) {
        n++;
        ns4 = availEq4 * (csdEq4 / maxSevEq4);
    }
    if (!isNaN(availEq5)) {
        n++;
        ns5 = 0;
    }
    const mean = n === 0 ? 0 : (ns1 + ns2 + ns36 + ns4 + ns5) / n;
    value -= mean;
    if (value < 0) value = 0;
    if (value > 10) value = 10;
    return Math.round(value * 10) / 10;
}

/**
 * The CVSS Base Score computed from a vector string, or `null` if the vector is absent, its
 * version is unsupported, or it is incomplete. Supports CVSS v3.0, v3.1 and v4.0.
 */
export function cvssBaseScore(vector?: string, version?: string): number | null {
    if (!vector || !vector.trim()) return null;
    const ver = cvssVersionOf(vector) || version || null;
    if (ver === '4.0') return cvss4Base(vector);
    if (ver === '3.0') return cvss3Base(vector, '3.0');
    if (ver === '3.1') return cvss3Base(vector, '3.1');
    return null;
}
