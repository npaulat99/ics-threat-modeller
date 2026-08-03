// Client-side mirror of the deterministic risk engine so risk badges update instantly
// as the user edits, without a server round-trip. Bands fall back to the canonical
// scheme until the live scheme is fetched.
import type { Component, Countermeasure, Objectives, RiskBand, RiskScheme, Threat } from '../types';

/**
 * A component and all of its descendants (transitive children via `parent`). Selecting a
 * parent component in the DFD therefore rolls up the risk of every sub-component it contains
 * (e.g. the RL-100 Sensor aggregates the MCU, BT stack, HART modem and config store).
 */
export function descendantComponentIds(components: Component[], rootId: string): Set<string> {
    const childrenByParent = new Map<string | null, string[]>();
    for (const c of components) {
        const p = c.parent ?? null;
        (childrenByParent.get(p) || childrenByParent.set(p, []).get(p)!).push(c.id);
    }
    const ids = new Set<string>([rootId]);
    const stack = [rootId];
    while (stack.length) {
        const cur = stack.pop()!;
        for (const child of childrenByParent.get(cur) || []) {
            if (!ids.has(child)) {
                ids.add(child);
                stack.push(child);
            }
        }
    }
    return ids;
}

export const DEFAULT_BANDS: RiskBand[] = [
    { name: 'Low', min: 1, max: 5, color: '#2e7d32' },
    { name: 'Medium', min: 6, max: 11, color: '#f9a825' },
    { name: 'High', min: 12, max: 19, color: '#ef6c00' },
    { name: 'Critical', min: 20, max: 25, color: '#c62828' },
];

/** A zero likelihood or impact means the threat is not possible — risk 0, its own band. */
export const NONE_BAND: RiskBand = { name: 'None', min: 0, max: 0, color: '#6b7280' };

export function bandsOf(scheme: RiskScheme | null): RiskBand[] {
    return scheme?.matrix?.bands?.length ? scheme.matrix.bands : DEFAULT_BANDS;
}

export function band(score: number, scheme: RiskScheme | null): RiskBand {
    if (score <= 0) return NONE_BAND;
    const bands = bandsOf(scheme);
    return bands.find((b) => score >= b.min && score <= b.max) || bands[0];
}

/** Residual [likelihood, impact] for a threat across all selected countermeasure links. */
export function residual(threat: Threat, cms: Countermeasure[]): [number, number] {
    const links = cms.filter((c) => c.selected !== false).flatMap((c) => (c.addresses || []).filter((a) => a.threat === threat.id));
    if (!links.length) return [threat.likelihood, threat.impact];
    // All applied controls are in effect simultaneously, so an attacker must overcome the strongest
    // one on each axis. The residual likelihood is therefore the LOWEST residual likelihood any
    // single control achieves (the most protective control dominates), and likewise for impact.
    let rl = threat.likelihood;
    let ri = threat.impact;
    for (const a of links) {
        rl = Math.min(rl, a.residualLikelihood ?? threat.likelihood);
        ri = Math.min(ri, a.residualImpact ?? threat.impact);
    }
    return [rl, ri];
}

export interface ThreatRisk {
    initial: number;
    initialBand: RiskBand;
    residual: number;
    residualBand: RiskBand;
    residualLikelihood: number;
    residualImpact: number;
}

export function riskOf(threat: Threat, cms: Countermeasure[], scheme: RiskScheme | null): ThreatRisk {
    const initial = (threat.likelihood || 0) * (threat.impact || 0);
    const [rl, ri] = residual(threat, cms);
    const res = (rl || 0) * (ri || 0);
    return {
        initial,
        initialBand: band(initial, scheme),
        residual: res,
        residualBand: band(res, scheme),
        residualLikelihood: rl,
        residualImpact: ri,
    };
}

/** Bug Bar: impact is the worst plausible dimension (max of C/I/A/Safety). */
export function deriveImpact(d?: Objectives): number | null {
    if (!d) return null;
    const vals = [d.confidentiality, d.integrity, d.availability, d.safety].filter((x) => typeof x === 'number') as number[];
    return vals.length ? Math.max(...vals) : null;
}

/**
 * Likelihood as a decomposition of the (too coarse) single likelihood into **Exposure ×
 * Exploitability**, keeping the familiar 5×5 matrix (likelihood is remapped to 1-5, then
 * Risk = Likelihood × Impact). Both factors are 1-5 with higher = more likely; they are combined
 * with a **geometric mean** (√(exposure·exploitability)) and mapped onto the 1-5 likelihood axis.
 * The geometric mean keeps the diagonal linear (3×3 → 3, 5×5 → 5) and spreads the levels, unlike
 * dividing the raw product by 5 which is bottom-heavy (12/25 cells collapse to 1). The likelihood
 * stays objectively decomposable (better inter-rater reliability). Control maturity is deliberately
 * excluded here — controls act on the *residual*, not the inherent likelihood (avoids double-counting).
 */
export function deriveLikelihood(f?: { exposure?: number; exploitability?: number }): number | null {
    if (!f) return null;
    const has = typeof f.exposure === 'number' || typeof f.exploitability === 'number';
    if (!has) return null;
    const e = typeof f.exposure === 'number' ? f.exposure : 3;
    const x = typeof f.exploitability === 'number' ? f.exploitability : 3;
    return Math.min(5, Math.max(1, Math.round(Math.sqrt(e * x))));
}

/**
 * Attack-surface exposure (1-5, higher = more reachable) implied by an interface's exposure class.
 * Aligned with the RiskCalculator's Exposure scale: 1 Physical · 2 Local · 3 Adjacent/fieldbus ·
 * 4 Remote (authenticated) · 5 Remote (unauthenticated). An interface flagged only "remote" maps
 * to 4 (authenticated); raise it to 5 manually if it is reachable unauthenticated.
 */
export function exposureFromInterface(exposure?: string): number | undefined {
    switch (exposure) {
        case 'remote':
            return 4;
        case 'adjacent':
            return 3;
        case 'local':
            return 2;
        case 'physical':
            return 1;
        default:
            return undefined;
    }
}
