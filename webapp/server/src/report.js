// Report + export generator (zero extra dependencies). Produces the assessor-facing HTML
// report AND machine-readable exports (traceability CSV/JSON, CycloneDX SBOM) so the full
// asset -> threat -> risk -> requirement -> control -> residual -> evidence chain can leave
// the tool. Extend buildReport().files to add further formats (OSCAL, SARIF, …).
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { projectsDir } from './paths.js';
import { readProject } from './artifacts.js';
import { loadScheme, band, residual } from './risk.js';
import { validate } from './validate.js';
import { kbVersion } from './git.js';
import { routeAround, roundedPath, labelPtOnPolyline, borderPoint } from '../../shared/dfdEngine.js';

const esc = (s) =>
    String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Canonical STRIDE order (S,T,R,I,D,E) so the report always lists categories consistently. */
const STRIDE_ORDER = ['S', 'T', 'R', 'I', 'D', 'E'];
const sortStride = (letters) => [...(letters || [])].sort((a, b) => {
    const ra = STRIDE_ORDER.indexOf(a);
    const rb = STRIDE_ORDER.indexOf(b);
    return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
});
const SZ = { 'external-entity': [150, 60], process: [120, 80], multiprocess: [120, 80], store: [140, 60] };

// --- DFD geometry helpers (mirror the client's edge routing so the report matches the editor) ---
function bboxOfBoxes(items) {
    return {
        minX: Math.min(...items.map((b) => b.x)),
        minY: Math.min(...items.map((b) => b.y)),
        maxX: Math.max(...items.map((b) => b.x + b.w)),
        maxY: Math.max(...items.map((b) => b.y + b.h)),
    };
}

/** Render one DFD layer to SVG so it matches the interactive editor: trust boundaries as dashed
 *  frames that host the external-interface chips in their header, and curved data flows that route
 *  around the shapes (never behind them) with their labels drawn on top. */
function layerSvg(dfd, parentId, system = {}) {
    const compById = new Map((system.components || []).map((c) => [c.id, c]));
    const nodes = (dfd.nodes || []).filter((n) => (n.parent ?? null) === parentId && n.type !== 'trust-boundary');
    if (!nodes.length) return '';
    const tbs = (dfd.nodes || []).filter((n) => (n.parent ?? null) === parentId && n.type === 'trust-boundary');
    const box = (n) => {
        const [w, h] = SZ[n.type] || [130, 70];
        return { x: n.x || 0, y: n.y || 0, w, h };
    };
    const bxs = new Map(nodes.map((n) => [n.id, box(n)]));

    const targetForComponent = (compId) => {
        let c = compId;
        const seen = new Set();
        while (c && !seen.has(c)) {
            seen.add(c);
            const node = nodes.find((n) => n.componentRef === c);
            if (node) return node.id;
            c = compById.get(c)?.parent;
        }
        return null;
    };
    const ifaces = (system.interfaces || []).filter((itf) => !itf.hidden);
    const CHIP_W = 150;
    const CHIP_H = 34;
    const GAP = 20;
    const CHIP_MEMBER_GAP = 74; // vertical breathing room between the chip row and the members
    const TB_PAD = 26;
    const TB_LABEL_H = 20;
    const TB_GAP = 8;

    // Group the visible interfaces by the trust boundary (or bare node) their target sits in.
    const targetOf = new Map();
    ifaces.forEach((itf) => {
        const t = targetForComponent(itf.component);
        if (t) targetOf.set(itf.id, t);
    });
    const memberTb = (tid) => tbs.find((tb) => (tb.members || []).includes(tid) && nodes.some((n) => (tb.members || []).includes(n.id)));
    const groups = {};
    ifaces.forEach((itf) => {
        if (!targetOf.has(itf.id)) return;
        const t = targetOf.get(itf.id);
        const tb = memberTb(t);
        const key = tb ? `tb:${tb.id}` : `node:${t}`;
        (groups[key] = groups[key] || []).push(itf.id);
    });

    // Size trust-boundary frames to enclose members + a header (name) + a row of interface chips.
    const frames = [];
    const chipBox = new Map();
    for (const tb of tbs) {
        const members = nodes.filter((n) => (tb.members || []).includes(n.id)).map((n) => bxs.get(n.id));
        if (!members.length) continue;
        const b = bboxOfBoxes(members);
        const chips = groups[`tb:${tb.id}`] || [];
        const chipRowW = chips.length ? chips.length * CHIP_W + (chips.length - 1) * GAP : 0;
        const innerW = Math.max(b.maxX - b.minX, chipRowW);
        const w = innerW + TB_PAD * 2;
        const topOffset = TB_LABEL_H + TB_GAP + (chips.length ? CHIP_H + CHIP_MEMBER_GAP : 0);
        const cx = (b.minX + b.maxX) / 2;
        const bx = Math.round(cx - w / 2);
        const by = Math.round(b.minY - topOffset);
        frames.push({ tb, bx, by, bw: Math.round(w), bh: Math.round(b.maxY - b.minY + topOffset + TB_PAD) });
        const startX = bx + w / 2 - chipRowW / 2;
        const chipY = by + TB_LABEL_H + TB_GAP;
        chips.forEach((id, i) => chipBox.set(id, { x: Math.round(startX + i * (CHIP_W + GAP)), y: chipY, w: CHIP_W, h: CHIP_H }));
    }
    // Interfaces whose target is not inside a boundary -> chip just above the target node.
    Object.entries(groups).forEach(([key, ids]) => {
        if (key.startsWith('tb:')) return;
        const nb = bxs.get(key.slice(5));
        const rowW = ids.length * CHIP_W + (ids.length - 1) * GAP;
        const startX = (nb ? nb.x + nb.w / 2 : 0) - rowW / 2;
        const y = (nb ? nb.y : 0) - CHIP_H - CHIP_MEMBER_GAP;
        ids.forEach((id, i) => chipBox.set(id, { x: Math.round(startX + i * (CHIP_W + GAP)), y: Math.round(y), w: CHIP_W, h: CHIP_H }));
    });

    const boxOf = (id) => bxs.get(id) || chipBox.get(id) || null;

    const allB = [...bxs.values(), ...chipBox.values(), ...frames.map((f) => ({ x: f.bx, y: f.by, w: f.bw, h: f.bh }))];
    const minX = Math.min(...allB.map((b) => b.x)) - 40;
    const minY = Math.min(...allB.map((b) => b.y)) - 30;
    const maxX = Math.max(...allB.map((b) => b.x + b.w)) + 40;
    const maxY = Math.max(...allB.map((b) => b.y + b.h)) + 30;
    const W = Math.max(160, maxX - minX);
    const H = Math.max(120, maxY - minY);
    const tx = (x) => x - minX;
    const ty = (y) => y - minY;
    const out = [];

    // Obstacles for routing = node + chip boxes (NOT trust boundaries).
    const obstacles = [...bxs.entries(), ...chipBox.entries()].map(([id, b]) => ({ id, x: b.x, y: b.y, w: b.w, h: b.h }));
    const labels = [];
    const drawLink = (fromId, toId, opts) => {
        const sB = boxOf(fromId);
        const tB = boxOf(toId);
        if (!sB || !tB) return;
        const sc = [sB.x + sB.w / 2, sB.y + sB.h / 2];
        const tc = [tB.x + tB.w / 2, tB.y + tB.h / 2];
        const s = borderPoint(sB, tc[0], tc[1]);
        const t = borderPoint(tB, sc[0], sc[1]);
        const obs = opts.noRoute ? [] : obstacles.filter((o) => o.id !== fromId && o.id !== toId);
        const route = routeAround(s[0], s[1], t[0], t[1], obs, 14);
        const directDist = Math.hypot(t[0] - s[0], t[1] - s[1]) || 1;
        let polyLen = 0;
        for (let i = 1; i < route.length; i++) polyLen += Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
        let d;
        let mid;
        if (route.length > 2 && polyLen <= 2.4 * directDist) {
            d = roundedPath(route.map(([x, y]) => [tx(x), ty(y)]), 12);
            const m = labelPtOnPolyline(route);
            mid = [tx(m[0]), ty(m[1])];
        } else {
            const off = opts.offset || 0;
            const dx = t[0] - s[0];
            const dy = t[1] - s[1];
            const len = Math.hypot(dx, dy) || 1;
            const mx = (s[0] + t[0]) / 2 + (-dy / len) * off;
            const my = (s[1] + t[1]) / 2 + (dx / len) * off;
            d = `M ${tx(s[0])},${ty(s[1])} Q ${tx(mx)},${ty(my)} ${tx(t[0])},${ty(t[1])}`;
            mid = [tx(mx), ty(my)];
        }
        out.push(`<path d='${d}' fill='none' stroke='${opts.stroke}' stroke-width='${opts.width}'${opts.dash ? ` stroke-dasharray='${opts.dash}'` : ''} marker-end='url(#a)'/>`);
        if (opts.label) labels.push({ x: mid[0], y: mid[1], text: String(opts.label) });
    };

    // Trust-boundary frames (drawn first, behind everything).
    for (const { tb, bx, by, bw, bh } of frames) {
        out.push(
            `<rect x='${tx(bx)}' y='${ty(by)}' width='${bw}' height='${bh}' fill='rgba(15,157,143,0.05)' stroke='#0f9d8f' stroke-width='1.5' stroke-dasharray='6 4' rx='10'/>` +
            `<text x='${tx(bx) + 8}' y='${ty(by) + 14}' font-size='10' fill='#0f9d8f'>${esc(tb.label)}</text>`,
        );
    }
    // Data flows + derived interface connectors (behind the shapes), with lane offsets.
    const flows = (dfd.flows || []).filter((f) => boxOf(f.from) && boxOf(f.to));
    const pairKey = (a, b) => (a < b ? `${a}\u0001${b}` : `${b}\u0001${a}`);
    const lanes = {};
    flows.forEach((f) => (lanes[pairKey(f.from, f.to)] = lanes[pairKey(f.from, f.to)] || []).push(f.id));
    Object.values(lanes).forEach((ids) => ids.sort());
    for (const f of flows) {
        const ids = lanes[pairKey(f.from, f.to)];
        const i = ids.indexOf(f.id);
        const visualLane = (i - (ids.length - 1) / 2) * 30;
        const offset = visualLane * (f.from < f.to ? 1 : -1);
        drawLink(f.from, f.to, { stroke: '#6b7688', width: 1.5, offset, label: f.label });
    }
    // Shapes (front) — occlude any flow that passes underneath.
    for (const n of nodes) {
        const b = bxs.get(n.id);
        const x = tx(b.x);
        const y = ty(b.y);
        let shape;
        if (n.type === 'process' || n.type === 'multiprocess') shape = `<ellipse cx='${x + b.w / 2}' cy='${y + b.h / 2}' rx='${b.w / 2}' ry='${b.h / 2}' fill='#fff' stroke='#333'/>`;
        else if (n.type === 'store')
            shape =
                `<rect x='${x}' y='${y}' width='${b.w}' height='${b.h}' fill='#fff' stroke='none'/>` +
                `<line x1='${x}' y1='${y}' x2='${x + b.w}' y2='${y}' stroke='#333'/><line x1='${x}' y1='${y + b.h}' x2='${x + b.w}' y2='${y + b.h}' stroke='#333'/>`;
        else shape = `<rect x='${x}' y='${y}' width='${b.w}' height='${b.h}' fill='#fff' stroke='#333'/>`;
        out.push(shape + `<text x='${x + b.w / 2}' y='${y + b.h / 2 + 4}' text-anchor='middle' font-size='10'>${esc((n.label || '').slice(0, 22))}</text>`);
    }
    for (const itf of ifaces) {
        const b = chipBox.get(itf.id);
        if (!b) continue;
        const x = tx(b.x);
        const y = ty(b.y);
        out.push(
            `<rect x='${x}' y='${y}' width='${b.w}' height='${b.h}' rx='7' fill='#fff' stroke='#0f9d8f' stroke-width='1.3'/>` +
            `<text x='${x + 8}' y='${y + 14}' font-size='9' font-weight='700' fill='#0f9d8f'>${esc(itf.tag || itf.protocol || 'interface')}</text>` +
            `<text x='${x + 8}' y='${y + 26}' font-size='9.5'>${esc((itf.name || '').slice(0, 22))}</text>`,
        );
    }
    // Flow labels on top so a shape never hides them.
    for (const l of labels) {
        const w = Math.min(150, 6.2 * l.text.length + 10);
        out.push(
            `<rect x='${l.x - w / 2}' y='${l.y - 8}' width='${w}' height='14' rx='3' fill='#ffffff' fill-opacity='0.9' stroke='#e2e5ea'/>` +
            `<text x='${l.x}' y='${l.y + 2}' text-anchor='middle' font-size='9' fill='#1d2430'>${esc(l.text.slice(0, 24))}</text>`,
        );
    }
    return `<svg width='${Math.min(W, 900)}' height='${Math.min(H, 620)}' viewBox='0 0 ${W} ${H}' xmlns='http://www.w3.org/2000/svg'><defs><marker id='a' markerWidth='8' markerHeight='8' refX='7' refY='3' orient='auto'><path d='M0,0L7,3L0,6' fill='#6b7688'/></marker></defs>${out.join('')}</svg>`;
}

/** The traceability chain, one row per threat — reused by the HTML matrix and CSV/JSON exports. */
export function buildTraceability({ system, threats, requirements, countermeasures, scheme }) {
    const assetById = new Map((system.assets || []).map((a) => [a.id, a]));
    return (threats || []).map((t) => {
        const [rl, ri] = residual(t, countermeasures);
        const rqs = (requirements || []).filter((r) => (r.derivedFromThreat || []).includes(t.id));
        const ctrls = (countermeasures || []).filter((c) => c.selected !== false && (c.addresses || []).some((a) => a.threat === t.id));
        const initial = (t.likelihood || 0) * (t.impact || 0);
        const res = (rl || 0) * (ri || 0);
        return {
            asset: (t.assets || []).map((a) => assetById.get(a)?.name || a).join('; '),
            cias: (t.assets || [])
                .map((a) => {
                    const o = assetById.get(a)?.objectives || {};
                    return `C${o.confidentiality ?? '-'}/I${o.integrity ?? '-'}/A${o.availability ?? '-'}/S${o.safety ?? '-'}`;
                })
                .join('; '),
            threat: t.id,
            title: t.title,
            stride: sortStride(t.stride).join(''),
            initial,
            initialBand: band(scheme, initial).name,
            requirement: rqs.map((r) => `${r.id}${r.standardRef ? ` [${r.standardRef}]` : ''}${(r.satisfiedByCM || []).length ? ` → ${(r.satisfiedByCM || []).join('+')}` : ''}`).join('; '),
            control: ctrls.map((c) => `${c.id} (${c.status || '?'})`).join('; '),
            residual: res,
            residualBand: band(scheme, res).name,
            evidence: ctrls
                .flatMap((c) => [...(c.ticketUrls || []), c.ticketUrl, c.verificationUrl])
                .filter(Boolean)
                .join(' '),
            status: t.status || '',
            ratedBy: t.ratedBy || '',
            signoff: t.status === 'accepted' ? [t.acceptedBy && `by ${t.acceptedBy}`, t.reviewDate && `review ${t.reviewDate}`, t.acceptanceRationale].filter(Boolean).join(' · ') : '',
        };
    });
}

/** CycloneDX 1.5 SBOM (+ VEX vulnerabilities from the defect register) from the component list. */
export function buildSbom({ project, system, defects = [] }) {
    const comps = (system.components || []).filter((c) => c.kind !== 'external-entity');
    return {
        bomFormat: 'CycloneDX',
        specVersion: '1.5',
        version: 1,
        metadata: {
            timestamp: new Date().toISOString(),
            component: { type: 'device', name: project.device?.name || project.title || 'device', version: project.device?.version || '' },
        },
        components: comps.map((c) => ({
            'bom-ref': c.id,
            type: c.kind === 'hardware' ? 'device' : 'application',
            name: c.name,
            version: c.version || '',
            ...(c.supplier ? { supplier: { name: c.supplier } } : {}),
            ...(c.license ? { licenses: [{ license: { id: c.license } }] } : {}),
            ...(c.cpe && c.cpe.startsWith('cpe:') ? { cpe: c.cpe } : {}),
            ...(c.cpe && c.cpe.startsWith('pkg:') ? { purl: c.cpe } : {}),
            properties: [{ name: 'tra:provenance', value: c.provenance || 'unspecified' }],
        })),
        vulnerabilities: (defects || [])
            .filter((d) => d.cve || d.id)
            .map((d) => ({
                id: d.cve || d.id,
                ...(d.component ? { affects: [{ ref: d.component }] } : {}),
                ...(d.severity ? { ratings: [{ severity: d.severity }] } : {}),
                analysis: { state: d.status === 'fixed' ? 'resolved' : d.status === 'wont-fix' ? 'not_affected' : 'exploitable' },
                description: d.title || '',
            })),
    };
}

/** SPDX 2.3 SBOM (JSON) generated from the component list — the alternative to CycloneDX. */
export function buildSpdx({ project, system }) {
    const comps = (system.components || []).filter((c) => c.kind !== 'external-entity');
    const sid = (id) => 'SPDXRef-Package-' + String(id).replace(/[^A-Za-z0-9.\-]/g, '-');
    const created = new Date().toISOString();
    const name = (project.device?.name || project.title || 'device').replace(/[^A-Za-z0-9.\-]/g, '-');
    return {
        spdxVersion: 'SPDX-2.3',
        dataLicense: 'CC0-1.0',
        SPDXID: 'SPDXRef-DOCUMENT',
        name: `${name}-sbom`,
        documentNamespace: `https://spdx.org/spdxdocs/${name}-${created}`,
        creationInfo: { created, creators: ['Tool: tra-webapp'] },
        packages: comps.map((c) => {
            const externalRefs = [];
            if (c.cpe && c.cpe.startsWith('cpe:')) externalRefs.push({ referenceCategory: 'SECURITY', referenceType: 'cpe23Type', referenceLocator: c.cpe });
            if (c.cpe && c.cpe.startsWith('pkg:')) externalRefs.push({ referenceCategory: 'PACKAGE-MANAGER', referenceType: 'purl', referenceLocator: c.cpe });
            return {
                SPDXID: sid(c.id),
                name: c.name,
                versionInfo: c.version || 'NOASSERTION',
                supplier: c.supplier ? `Organization: ${c.supplier}` : 'NOASSERTION',
                downloadLocation: 'NOASSERTION',
                licenseConcluded: c.license || 'NOASSERTION',
                licenseDeclared: c.license || 'NOASSERTION',
                copyrightText: 'NOASSERTION',
                ...(externalRefs.length ? { externalRefs } : {}),
            };
        }),
        relationships: comps.map((c) => ({ spdxElementId: 'SPDXRef-DOCUMENT', relationshipType: 'DESCRIBES', relatedSpdxElement: sid(c.id) })),
    };
}

/** STRIDE-per-element coverage: for each modellable component/interface, which STRIDE letters are
 * covered by at least one threat. Empty cells are candidate gaps (Shostack STRIDE-per-element). */
export function buildStrideCoverage(system, threats) {
    const S = ['S', 'T', 'R', 'I', 'D', 'E'];
    const elems = [
        ...(system.components || []).filter((c) => c.kind !== 'external-entity' && c.kind !== 'device').map((c) => ({ id: c.id, name: c.name, kind: 'component' })),
        ...(system.interfaces || []).map((i) => ({ id: i.id, name: i.name, kind: 'interface' })),
    ];
    return elems.map((e) => {
        const rel = (threats || []).filter((t) => (t.components || []).includes(e.id) || (t.interfaceRefs || []).includes(e.id) || t.interfaceRef === e.id);
        const covered = new Set(rel.flatMap((t) => t.stride || []));
        return { ...e, cells: S.map((s) => covered.has(s)), gaps: S.filter((s) => !covered.has(s)).length === S.length };
    });
}

const STRIDE_LABELS = { S: 'Spoofing', T: 'Tampering', R: 'Repudiation', I: 'Information disclosure', D: 'Denial of service', E: 'Elevation of privilege' };

/** The distinct pairs of entities that communicate across a boundary, derived from the DFD node
 *  hierarchy — NOT from flow.crossesBoundary (stale/unreliable). A flow crosses the boundary when
 *  exactly one of its endpoints is in the DFD member set (or a nested descendant). */
export function boundaryPairs(system = {}, dfd = {}, tbId) {
    const tbDfdNode = (dfd.nodes || []).find((n) => n.id === tbId && n.type === 'trust-boundary');
    if (!tbDfdNode) return [];
    const insideNodeIds = new Set(tbDfdNode.members || []);
    let changed = true;
    while (changed) {
        changed = false;
        for (const n of dfd.nodes || []) {
            if (n.parent && insideNodeIds.has(n.parent) && !insideNodeIds.has(n.id)) {
                insideNodeIds.add(n.id);
                changed = true;
            }
        }
    }
    const nodeById = new Map((dfd.nodes || []).map((n) => [n.id, n]));
    const ifaceById = new Map((system.interfaces || []).map((i) => [i.id, i]));
    const dfdNodeForComp = (compId) => (dfd.nodes || []).find((n) => n.componentRef === compId);
    const isInsideEndpoint = (ep) => {
        if (insideNodeIds.has(ep)) return true;
        const iface = ifaceById.get(ep);
        if (iface?.component) {
            const compNode = dfdNodeForComp(iface.component);
            if (compNode && insideNodeIds.has(compNode.id)) return true;
        }
        return false;
    };
    const endpointLabel = (ep) => nodeById.get(ep)?.label ?? ifaceById.get(ep)?.name ?? ep;
    const seen = new Map();
    for (const f of dfd.flows || []) {
        if (!f.from || !f.to) continue;
        const fromIn = isInsideEndpoint(f.from);
        const toIn = isInsideEndpoint(f.to);
        if (fromIn === toIn) continue;
        const key = [f.from, f.to].sort().join('~');
        if (seen.has(key)) continue;
        const [insideEp, outsideEp] = fromIn ? [f.from, f.to] : [f.to, f.from];
        seen.set(key, { key, inside: { id: insideEp, label: endpointLabel(insideEp) }, outside: { id: outsideEp, label: endpointLabel(outsideEp) } });
    }
    return [...seen.values()];
}

const cellHasContent = (cell) => !!cell && ((cell.strengths || []).some((x) => x && x.trim()) || (cell.weaknesses || []).some((x) => x && x.trim()));
// Analysis is stored flat by pair key; an entry has content when any endpoint cell has text.
const analysisHasContent = (a) => !!a?.endpoints && Object.values(a.endpoints).some((side) => side && Object.values(side.cells || {}).some(cellHasContent));

/** Render one strengths/weaknesses list into HTML (or an em-dash placeholder when empty). */
const swList = (items) => {
    const list = (items || []).map((x) => String(x || '').trim()).filter(Boolean);
    return list.length ? `<ul style='margin:0;padding-left:16px'>${list.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<span style="color:#8a93a2">—</span>';
};

/** The per-trust-boundary STRIDE strengths/weaknesses tables — one per communicating entity pair.
 *  Analysis is stored flat by pair key (shared across boundaries), so the inside/outside role is
 *  determined by the boundary being rendered, not by how the data was authored. */
function strideBoundaryTablesHtml(system = {}, dfd = {}) {
    const analyses = system.strideAnalyses || {}; // flat: pairKey -> StridePairAnalysis
    const sections = (system.trustBoundaries || [])
        .map((b) => {
            const tables = boundaryPairs(system, dfd, b.id)
                .filter((pair) => analysisHasContent(analyses[pair.key]))
                .map((pair) => {
                    const a = analyses[pair.key] || {};
                    // inside/outside determined by this boundary's perspective, not the storage order
                    const aLabel = a.endpoints?.[pair.inside.id]?.label || pair.inside.label;
                    const bLabel = a.endpoints?.[pair.outside.id]?.label || pair.outside.label;
                    const aCells = (k) => a.endpoints?.[pair.inside.id]?.cells?.[k] || {};
                    const bCells = (k) => a.endpoints?.[pair.outside.id]?.cells?.[k] || {};
                    const rows = STRIDE_ORDER.map((s) => (
                        `<tr><th style='white-space:nowrap'>${esc(s)} · ${esc(STRIDE_LABELS[s] || '')}</th>` +
                        `<td>${swList(aCells(s).strengths)}</td><td>${swList(aCells(s).weaknesses)}</td>` +
                        `<td>${swList(bCells(s).strengths)}</td><td>${swList(bCells(s).weaknesses)}</td></tr>`
                    )).join('');
                    return (
                        `<h4>${esc(pair.inside.label)} ⇄ ${esc(pair.outside.label)}</h4>` +
                        `<table><tr><th rowspan='2'>STRIDE</th><th colspan='2'>${esc(aLabel)}</th><th colspan='2'>${esc(bLabel)}</th></tr>` +
                        `<tr><th>Strengths</th><th>Weaknesses</th><th>Strengths</th><th>Weaknesses</th></tr>${rows}</table>`
                    );
                });
            return tables.length ? `<h3>${esc(b.id)} · ${esc(b.name)}</h3>${tables.join('')}` : '';
        })
        .filter(Boolean);
    return sections.length ? `<h2>STRIDE analysis per trust boundary</h2>${sections.join('')}` : '';
}

const csvCell = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
function traceabilityCsv(rows) {
    const head = ['Asset', 'C/I/A/S', 'Threat', 'Title', 'STRIDE', 'Initial', 'InitialBand', 'Requirement', 'Control', 'Residual', 'ResidualBand', 'Evidence', 'Status', 'RatedBy', 'SignOff'];
    const body = rows.map((r) =>
        [r.asset, r.cias, r.threat, r.title, r.stride, r.initial, r.initialBand, r.requirement, r.control, r.residual, r.residualBand, r.evidence, r.status, r.ratedBy, r.signoff]
            .map(csvCell)
            .join(','),
    );
    return [head.map(csvCell).join(','), ...body].join('\r\n') + '\r\n';
}

/** Assemble every report artifact for a project (in memory). */
export async function buildReport(id) {
    const scheme = await loadScheme();
    const p = await readProject(id);
    const { project, assumptions, system, dfd, threats: td, requirements: rd, countermeasures: cd, attackTrees, defects: dd } = p;
    const threats = td.threats || [];
    const reqs = rd.requirements || [];
    const cms = cd.countermeasures || [];
    const defects = dd.defects || [];
    const issues = validate({ project, assumptions, system, threats: td, requirements: rd, countermeasures: cd, dfd, attackTrees, defects: dd });
    const trace = buildTraceability({ system, threats, requirements: reqs, countermeasures: cms, scheme });
    const sbom = buildSbom({ project, system, defects });
    const sbomMode = project.sbom?.mode || 'in-tool';
    const sbomFormat = project.sbom?.format || 'cyclonedx';
    const sbomFile = sbomMode !== 'in-tool' ? project.sbom?.url || '(external, no URL)' : sbomFormat === 'spdx' ? 'report/sbom.spdx.json' : 'report/sbom.cdx.json';
    const strideCov = buildStrideCoverage(system, threats);
    const strideTbSection = project.reportOptions?.includeStrideBoundaryAnalysis ? strideBoundaryTablesHtml(system, dfd) : '';
    const acceptedNotices = new Set(project.acceptedNotices || []);
    const openIssueList = issues.filter((i) => !(i.severity === 'notice' && acceptedNotices.has(i.key)));
    const acceptedIssueList = issues.filter((i) => i.severity === 'notice' && acceptedNotices.has(i.key));
    const kbv = await kbVersion().catch(() => null);

    const parents = [null, ...dfd.nodes.filter((n) => dfd.nodes.some((m) => m.parent === n.id)).map((n) => n.id)];
    const dfdHtml =
        parents
            .map((pid) => {
                const svg = layerSvg(dfd, pid, system);
                if (!svg) return '';
                const label = pid ? dfd.nodes.find((n) => n.id === pid)?.label || pid : 'Layer 1 — device context';
                return `<h3>${esc(label)}</h3>${svg}`;
            })
            .filter(Boolean)
            .join('') || '<p>No DFD nodes.</p>';

    const traceRows = trace
        .map(
            (r) =>
                `<tr><td>${esc(r.asset)}</td><td>${esc(r.cias)}</td><td><b>${esc(r.threat)}</b> ${esc(r.title)} <span class=mono>${esc(r.stride)}</span></td>` +
                `<td style='color:${band(scheme, r.initial).color}'>${r.initial} ${esc(r.initialBand)}</td><td>${esc(r.requirement) || '—'}</td>` +
                `<td>${esc(r.control) || '—'}</td><td style='color:${band(scheme, r.residual).color}'>${r.residual} ${esc(r.residualBand)}</td>` +
                `<td>${r.evidence ? r.evidence.split(' ').map((u) => `<a href='${esc(u)}'>link</a>`).join(' ') : '—'}</td><td>${esc(r.status)}${r.signoff ? `<br><span class=mono style='font-size:11px'>${esc(r.signoff)}</span>` : ''}${r.ratedBy ? `<br><span class=mono style='font-size:11px'>rated: ${esc(r.ratedBy)}</span>` : ''}</td></tr>`,
        )
        .join('');

    const assumptionSection = ['device', 'system', 'environment', 'operational']
        .map((k) => {
            const items = assumptions[k] || [];
            if (!items.length) return '';
            return `<h3>${k[0].toUpperCase() + k.slice(1)} assumptions</h3><ul>${items.map((a) => `<li>${esc(a.text || a)}</li>`).join('')}</ul>`;
        })
        .join('');
    const atk = (assumptions.attacker || [])
        .map((a) => `<li><b>${esc(a.name)}</b> (cap ${a.capability}, ${esc(a.access)}): ${esc(a.text || '')}</li>`)
        .join('');
    const assets = (system.assets || [])
        .map((a) => `<li>${esc(a.name)} (C${a.objectives?.confidentiality}/I${a.objectives?.integrity}/A${a.objectives?.availability}/S${a.objectives?.safety})${a.storage ? ` — <i>${esc(a.storage)}</i>` : ''}</li>`)
        .join('');
    const ifaceList = (system.interfaces || [])
        .map((i) => `<li><b>${esc(i.name)}</b> ${esc(i.protocol || '')} · ${esc(i.exposure)}${i.category ? ` · ${esc(i.category)}` : ''}</li>`)
        .join('');
    const reqRows = reqs
        .map(
            (r) =>
                `<tr><td><b>${esc(r.id)}</b></td><td>${esc(r.text)}</td><td>${esc(r.standardRef || '')}${r.slFr ? ` · ${esc(r.slFr)}` : ''}</td><td>${esc((r.derivedFromThreat || []).join(', '))}</td><td>${esc((r.satisfiedByCM || []).join(', '))}</td></tr>`,
        )
        .join('');
    const cmrows = cms
        .filter((c) => c.selected !== false)
        .map(
            (c) =>
                `<li><b>${esc(c.id)}</b> ${esc(c.title)} <i>(${esc(c.type || '')}, ${esc(c.status || '')})</i> &rarr; ${esc((c.addresses || []).map((a) => a.threat).join(', '))}${[...(c.ticketUrls || []), c.ticketUrl].filter(Boolean).map((u, i) => ` · <a href='${esc(u)}'>ticket ${i + 1}</a>`).join('')}${c.verificationUrl ? ` · <a href='${esc(c.verificationUrl)}'>verification</a>` : ''}${(c.negativeEffects || []).filter(Boolean).length ? `<br><span style='color:#8a6d3b;font-size:11px'>Trade-offs: ${esc((c.negativeEffects || []).filter(Boolean).join('; '))}</span>` : ''}</li>`,
        )
        .join('');
    const sbomRows = sbom.components
        .map(
            (c) =>
                `<tr><td>${esc(c.name)}</td><td>${esc(c.version)}</td><td>${esc(c.supplier?.name || '')}</td><td>${esc(c.licenses?.[0]?.license?.id || '')}</td><td class=mono>${esc(c.cpe || c.purl || '')}</td><td>${esc(c.properties?.[0]?.value || '')}</td></tr>`,
        )
        .join('');
    const treeList = (attackTrees?.trees || [])
        .map((t) => `<li><b>${esc(t.id)}</b> ${esc(t.title)}${t.threatRef ? ` &rarr; ${esc(t.threatRef)}` : ''}</li>`)
        .join('');
    const strideRows = strideCov
        .map((e) => `<tr${e.gaps ? " style='background:#fff7f0'" : ''}><td>${esc(e.id)} ${esc(e.name)} <span class=mono>${esc(e.kind)}</span></td>${e.cells.map((c) => `<td style='text-align:center'>${c ? '✓' : '·'}</td>`).join('')}</tr>`)
        .join('');
    const strideSection = strideCov.length
        ? `<h2>STRIDE-per-element coverage</h2><p>✓ = at least one threat of that category on the element; · = candidate gap.</p><table><tr><th>Element</th><th>S</th><th>T</th><th>R</th><th>I</th><th>D</th><th>E</th></tr>${strideRows}</table>`
        : '';
    const tbRows = (system.trustBoundaries || [])
        .map((b) => {
            const crossing = (dfd.flows || []).filter((f) => f.crossesBoundary === b.id).map((f) => f.id);
            return `<tr><td><b>${esc(b.id)}</b> ${esc(b.name)}</td><td>${esc((b.members || []).join(', '))}</td><td>${esc(crossing.join(', ')) || '—'}</td></tr>`;
        })
        .join('');
    const tbSection = (system.trustBoundaries || []).length
        ? `<h2>Trust boundaries</h2><table><tr><th>Boundary</th><th>Members</th><th>Crossing flows</th></tr>${tbRows}</table>`
        : '';
    const warn = openIssueList.length
        ? `<ul class=warn>${openIssueList.map((i) => `<li>${i.severity === 'error' ? '⛔' : i.severity === 'notice' ? 'ℹ' : '⚠'} ${esc(i.message)}</li>`).join('')}</ul>`
        : '<p>No open issues found.</p>';
    const acceptedNoticeSection = acceptedIssueList.length
        ? `<h3>Accepted notices</h3><ul>${acceptedIssueList.map((i) => `<li>${esc(i.message)}</li>`).join('')}</ul>`
        : '';
    const sbomSection =
        sbomMode !== 'in-tool'
            ? project.sbom?.url
                ? `<h2>Software bill of materials (SBOM)</h2><p>Provided externally: <a href='${esc(project.sbom.url)}'>${esc(project.sbom.url)}</a></p>`
                : `<h2>Software bill of materials (SBOM)</h2><p>Declared as externally provided; no URL was recorded.</p>`
            : sbomRows
                ? `<h2>Software bill of materials (SBOM)</h2><p>${sbomFormat === 'spdx' ? 'SPDX 2.3' : 'CycloneDX 1.5'} — <code>${esc(sbomFile)}</code></p><table><tr><th>Component</th><th>Version</th><th>Supplier</th><th>License</th><th>CPE / purl</th><th>Provenance</th></tr>${sbomRows}</table>`
                : '';

    const html =
        `<!doctype html><meta charset=utf8><title>TRA ${esc(project.title)}</title>` +
        '<style>body{font:14px system-ui;margin:2rem auto;max-width:78rem;color:#1d2430;line-height:1.45}table{border-collapse:collapse;width:100%;margin:.75rem 0 1.25rem;background:#fff}td,th{border:1px solid #d9dee7;padding:8px 10px;text-align:left;vertical-align:top;font-size:12.5px}th{background:#f4f7fb}h1{font-size:1.65rem;margin-bottom:.35rem}h2{margin-top:1.8rem;border-bottom:2px solid #e7ebf2;padding-bottom:4px}.lead{color:#4d5a6d;max-width:68rem}.warn{color:#c62828}.mono{font-family:ui-monospace,monospace}.meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.75rem;margin:1rem 0 1.5rem}.meta div{background:#f7f9fc;border:1px solid #e2e7ef;border-radius:10px;padding:.75rem .9rem}svg{max-width:100%;border:1px solid #e7ebf2;border-radius:10px;margin:.4rem 0;background:#fff}.trace-note{background:#f7f9fc;border:1px solid #e2e7ef;border-radius:10px;padding:.8rem 1rem;margin:.5rem 0 1rem}</style>' +
        `<h1>${esc(project.title)}</h1><p>Device: ${esc(project.device?.name)} | SL-T ${esc(project.slTarget)} | mode ${esc(project.scope?.mode)} | status ${esc(project.status)} | generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')}${kbv ? ` | KB/repo ${esc(kbv)}` : ''}</p>` +
        `<div class='meta'><div><b>Device</b><br>${esc(project.device?.name || '—')}</div><div><b>Security target</b><br>${esc(project.slTarget || '—')}</div><div><b>Assessment mode</b><br>${esc(project.scope?.mode || '—')}</div><div><b>Status</b><br>${esc(project.status || 'draft')}</div></div>` +
        `<p><b>Scope:</b> ${esc(project.scope?.boundary || '')}</p>` +
        (project.intendedUse ? `<p><b>Intended purpose:</b> ${esc(project.intendedUse)}</p>` : '') +
        (project.foreseeableUse?.length ? `<p><b>Reasonably foreseeable use:</b></p><ul>${project.foreseeableUse.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>` : '') +
        `<h2>Traceability matrix</h2><div class='trace-note'>This matrix shows the full chain from protected asset to assessed threat, required security response, implemented countermeasure, residual risk and linked evidence. Machine-readable exports are written alongside the report as <code>report/traceability.csv</code>, <code>report/traceability.json</code> and <code>${esc(sbomFile)}</code>.</div>` +
        `<table><tr><th>Asset</th><th>C/I/A/S</th><th>Threat</th><th>Initial</th><th>Requirement</th><th>Control</th><th>Residual</th><th>Evidence</th><th>Status</th></tr>${traceRows}</table>` +
        `<h2>Data flow diagram (all layers)</h2>${dfdHtml}` +
        tbSection +
        strideSection +
        strideTbSection +
        `<h2>Attacker profiles</h2><ul>${atk}</ul>` +
        (assumptionSection ? `<h2>Assumptions</h2>${assumptionSection}` : '') +
        `<h2>Assets</h2><ul>${assets}</ul>` +
        (ifaceList ? `<h2>External interfaces</h2><ul>${ifaceList}</ul>` : '') +
        (reqRows ? `<h2>Security requirements</h2><table><tr><th>ID</th><th>Requirement</th><th>Standard / SL·FR</th><th>From threats</th><th>Satisfied by</th></tr>${reqRows}</table>` : '') +
        `<h2>Countermeasures</h2><ul>${cmrows}</ul>` +
        sbomSection +
        (treeList ? `<h2>Attack trees</h2><ul>${treeList}</ul>` : '') +
        `<h2>Plausibility check</h2>${warn}${acceptedNoticeSection}`;

    return {
        html,
        issues,
        files: {
            'index.html': html,
            'traceability.csv': traceabilityCsv(trace),
            'traceability.json': JSON.stringify(trace, null, 2) + '\n',
            ...(sbomMode === 'in-tool'
                ? sbomFormat === 'spdx'
                    ? { 'sbom.spdx.json': JSON.stringify(buildSpdx({ project, system }), null, 2) + '\n' }
                    : { 'sbom.cdx.json': JSON.stringify(sbom, null, 2) + '\n' }
                : {}),
        },
    };
}

/** Generate the report and write the full export bundle into the project's report/ folder. */
export async function generateReport(id) {
    const { html, issues, files } = await buildReport(id);
    const dir = join(projectsDir, id, 'report');
    await fs.mkdir(dir, { recursive: true });
    for (const [name, content] of Object.entries(files)) await fs.writeFile(join(dir, name), content, 'utf8');
    return { html, issues };
}
