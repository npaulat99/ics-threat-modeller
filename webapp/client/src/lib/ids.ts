// Project-wide unique-ID handling: enumeration, charset + collision validation, used by the
// editable ID inputs and the plausibility checker. IDs may contain letters, digits, space and
// the separators - _ : .  and must be unique across every artifact in the project.
import type { ProjectData, ViewKey } from '../types';

export const ID_PATTERN = /^[A-Za-z0-9 _\-:.]+$/;

/** Every user-facing unique ID in the project, tagged with the kind that owns it. */
export function allIds(data: ProjectData): { id: string; kind: string }[] {
    const out: { id: string; kind: string }[] = [];
    const push = (arr: any[] | undefined, kind: string) => (arr || []).forEach((x) => x?.id && out.push({ id: x.id, kind }));
    push(data.system?.components, 'component');
    push(data.system?.interfaces, 'interface');
    push(data.system?.trustBoundaries, 'trust boundary');
    push(data.system?.assets, 'asset');
    push(data.threats?.threats, 'threat');
    push(data.requirements?.requirements, 'requirement');
    push(data.countermeasures?.countermeasures, 'countermeasure');
    push(data.attackTrees?.trees, 'attack tree');
    push(data.defects?.defects, 'defect');
    push(data.assumptions?.device, 'assumption');
    push(data.assumptions?.system, 'assumption');
    push(data.assumptions?.environment, 'assumption');
    push(data.assumptions?.operational, 'assumption');
    push(data.assumptions?.attacker, 'attacker profile');
    // DFD nodes share their id-space, except a trust-boundary node deliberately reuses the id of
    // its system trust boundary (they are the same entity) — skip that alias.
    const tbIds = new Set((data.system?.trustBoundaries || []).map((b) => b.id));
    (data.dfd?.nodes || []).forEach((n) => n?.id && !tbIds.has(n.id) && out.push({ id: n.id, kind: 'DFD node' }));
    return out;
}

/** Duplicate-ID issues across the whole project (for the plausibility checker). */
export function idCollisions(data: ProjectData): string[] {
    const seen = new Map<string, string>();
    const issues: string[] = [];
    for (const { id, kind } of allIds(data)) {
        if (seen.has(id)) issues.push(`Duplicate ID '${id}' — used by ${seen.get(id)} and ${kind}. IDs must be unique across the project.`);
        else seen.set(id, kind);
    }
    return issues;
}

/** Validate a proposed ID: charset + uniqueness (excluding the item's own current id). Returns an error string or null. */
export function idError(data: ProjectData, proposed: string, currentId: string): string | null {
    const p = proposed.trim();
    if (!p) return 'ID cannot be empty.';
    if (!ID_PATTERN.test(p)) return 'Allowed characters: letters, digits, space and - _ : .';
    if (p !== currentId && allIds(data).some((x) => x.id === p)) return `ID '${p}' is already used elsewhere in the project.`;
    return null;
}

/** Resolve which view edits the artifact that owns an ID, or null if unknown. */
export function viewOfId(data: ProjectData, id: string): ViewKey | null {
    const has = (arr?: any[]) => (arr || []).some((x) => x?.id === id);
    if (has(data.system?.components) || has(data.system?.interfaces) || has(data.system?.trustBoundaries) || has(data.system?.assets)) return 'system';
    if (has(data.threats?.threats)) return 'threats';
    if (has(data.requirements?.requirements)) return 'requirements';
    if (has(data.countermeasures?.countermeasures)) return 'countermeasures';
    if (has(data.attackTrees?.trees)) return 'attackTrees';
    if (has(data.defects?.defects)) return 'defects';
    if (has(data.assumptions?.attacker) || has(data.assumptions?.device) || has(data.assumptions?.system) || has(data.assumptions?.environment) || has(data.assumptions?.operational)) return 'assumptions';
    if ((data.dfd?.flows || []).some((f) => f?.id === id) || has(data.dfd?.nodes)) return 'dfd';
    return null;
}

/** Parse a plausibility-issue string and resolve the best jump target (view + id), or null. */
export function issueTarget(data: ProjectData, issue: string): { view: ViewKey; id: string } | null {
    for (const m of issue.matchAll(/'([^']+)'/g)) {
        const v = viewOfId(data, m[1]);
        if (v) return { view: v, id: m[1] };
    }
    const lead = issue.match(/^([^:]+): /);
    if (lead) {
        const v = viewOfId(data, lead[1]);
        if (v) return { view: v, id: lead[1] };
    }
    if (/^No attacker assumptions/.test(issue)) return { view: 'assumptions', id: '' };
    return null;
}
