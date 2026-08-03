// Per-trust-boundary STRIDE strengths/weaknesses analysis — a structured brainstorming aid.
// One table per *pair of entities* that communicate across a boundary (a crossing data flow), since
// different protocols (e.g. HART vs. Bluetooth) provide different security properties. For each pair
// and each STRIDE category, the strengths and weaknesses seen from each side. The side labels are
// auto-derived from the two endpoints; only user-authored text is persisted, in
// `system.strideAnalyses[boundaryId][pairKey]`.
import type { Dfd, StridePairAnalysis, StrideCategoryCell, SystemDef } from '../types';

export const STRIDE_KEYS: ('S' | 'T' | 'R' | 'I' | 'D' | 'E')[] = ['S', 'T', 'R', 'I', 'D', 'E'];
export const STRIDE_LABEL: Record<string, string> = {
    S: 'Spoofing',
    T: 'Tampering',
    R: 'Repudiation',
    I: 'Information disclosure',
    D: 'Denial of service',
    E: 'Elevation of privilege',
};

export interface StridePair {
    key: string; // stable key derived from the two endpoints (independent of flow direction)
    inside: { id: string; label: string };
    outside: { id: string; label: string };
}

/** The distinct pairs of entities that communicate across a boundary, derived from the DFD node
 *  hierarchy — NOT from flow.crossesBoundary (which is stale/unreliable). A flow crosses the
 *  boundary when exactly one of its endpoints is in the DFD member set (or a nested descendant). */
export function boundaryPairs(system: SystemDef, dfd: Dfd, tbId: string): StridePair[] {
    // Build the inside DFD node set from the TB's DFD members + all their nested descendants.
    const tbDfdNode = (dfd.nodes || []).find((n) => n.id === tbId && n.type === 'trust-boundary');
    if (!tbDfdNode) return [];
    const insideNodeIds = new Set<string>(tbDfdNode.members || []);
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
    // Find the first DFD node whose componentRef matches a given component id.
    const dfdNodeForComp = (compId: string) => (dfd.nodes || []).find((n) => n.componentRef === compId);

    const isInsideEndpoint = (ep: string): boolean => {
        if (insideNodeIds.has(ep)) return true;
        // Interface endpoint: check if its component's DFD node is inside.
        const iface = ifaceById.get(ep);
        if (iface?.component) {
            const compNode = dfdNodeForComp(iface.component);
            if (compNode && insideNodeIds.has(compNode.id)) return true;
        }
        return false;
    };

    const endpointLabel = (ep: string): string =>
        nodeById.get(ep)?.label ?? ifaceById.get(ep)?.name ?? ep;

    const seen = new Map<string, StridePair>();
    for (const f of dfd.flows || []) {
        if (!f.from || !f.to) continue;
        const fromIn = isInsideEndpoint(f.from);
        const toIn = isInsideEndpoint(f.to);
        if (fromIn === toIn) continue; // both inside (internal) or both outside — not a TB crossing
        const key = [f.from, f.to].sort().join('~');
        if (seen.has(key)) continue;
        const [insideEp, outsideEp] = fromIn ? [f.from, f.to] : [f.to, f.from];
        seen.set(key, { key, inside: { id: insideEp, label: endpointLabel(insideEp) }, outside: { id: outsideEp, label: endpointLabel(outsideEp) } });
    }
    return [...seen.values()];
}

const hasText = (items?: string[]) => (items || []).some((x) => x && x.trim());
const cellHasContent = (cell?: StrideCategoryCell) => !!cell && (hasText(cell.strengths) || hasText(cell.weaknesses));

/** True when a pair analysis has any authored strength/weakness for either endpoint. */
export function analysisHasContent(a?: StridePairAnalysis): boolean {
    if (!a?.endpoints) return false;
    return Object.values(a.endpoints).some((side) => side && Object.values(side.cells || {}).some((c) => cellHasContent(c as StrideCategoryCell)));
}

/** True when any pair in the project-wide analyses map has authored content. */
export function anyPairHasContent(analyses?: Record<string, StridePairAnalysis>): boolean {
    return !!analyses && Object.values(analyses).some((a) => analysisHasContent(a));
}
