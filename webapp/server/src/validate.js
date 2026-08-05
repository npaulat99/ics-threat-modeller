// Plausibility checker. Returns structured issues { key, message, severity } mirroring the client
// checker (reference integrity, coverage/completeness, residual sanity, control-type consistency,
// and the threat -> requirement -> control chain). Severity is 'error' | 'warning' | 'notice';
// notices (e.g. an intentionally standalone requirement) can be accepted via project.acceptedNotices.
import { residual } from './risk.js';

const arr = (x) => (Array.isArray(x) ? x : []);
const PROX = { remote: 1, adjacent: 2, local: 3, physical: 4 };
const reqProx = (e) => (e >= 4 ? 1 : e === 3 ? 2 : e === 2 ? 3 : 4);
const DEFAULT_ACCEPTABLE_RISK = 12;

export function validate({ project = {}, assumptions = {}, system = {}, threats = {}, requirements = {}, countermeasures = {}, dfd = {}, attackTrees = {}, defects = {} } = {}) {
    const issues = [];
    const add = (severity, message, key) => issues.push({ severity, message, key: key ?? message });
    const threatList = arr(threats.threats ?? threats);
    const cmList = arr(countermeasures.countermeasures ?? countermeasures);
    const reqList = arr(requirements.requirements ?? requirements);
    const components = arr(system.components);
    const interfaces = arr(system.interfaces);
    const compIds = new Set(components.map((c) => c.id));
    const assetIds = new Set(arr(system.assets).map((a) => a.id));
    const ifaceIds = new Set(interfaces.map((i) => i.id));
    const attackers = arr(assumptions.attacker);
    const attackerById = new Map(attackers.map((a) => [a.id, a]));
    const tIds = new Set(threatList.map((t) => t.id));
    const cmIds = new Set(cmList.map((c) => c.id));
    const threatById = new Map(threatList.map((t) => [t.id, t]));

    const acceptableRisk = Number.isFinite(project.acceptableRisk) ? project.acceptableRisk : DEFAULT_ACCEPTABLE_RISK;

    if (!attackers.length) add('warning', 'No attacker assumptions (required to ground the likelihood assessment).', 'no-attacker');
    const tbIds = new Set(arr(system.trustBoundaries).map((b) => b.id));
    const allIds = [
        ...components.map((c) => ({ id: c.id, kind: 'component' })),
        ...interfaces.map((i) => ({ id: i.id, kind: 'interface' })),
        ...arr(system.trustBoundaries).map((b) => ({ id: b.id, kind: 'trust boundary' })),
        ...arr(system.assets).map((a) => ({ id: a.id, kind: 'asset' })),
        ...threatList.map((t) => ({ id: t.id, kind: 'threat' })),
        ...reqList.map((r) => ({ id: r.id, kind: 'requirement' })),
        ...cmList.map((c) => ({ id: c.id, kind: 'countermeasure' })),
        ...arr(attackTrees.trees).map((t) => ({ id: t.id, kind: 'attack tree' })),
        ...arr(defects.defects ?? defects).map((d) => ({ id: d.id, kind: 'defect' })),
        ...attackers.map((a) => ({ id: a.id, kind: 'attacker profile' })),
        // DFD nodes share the id-space, except a trust-boundary node deliberately reuses the id of
        // its system trust boundary (same entity) — skip that alias.
        ...arr(dfd.nodes).filter((n) => !tbIds.has(n.id)).map((n) => ({ id: n.id, kind: 'DFD node' })),
    ].filter((x) => x.id);
    const seenId = new Map();
    for (const { id, kind } of allIds) {
        if (seenId.has(id)) add('error', `Duplicate ID '${id}' — used by ${seenId.get(id)} and ${kind}. IDs must be unique across the project.`);
        else seenId.set(id, kind);
    }
    const today = new Date().toISOString().slice(0, 10);

    for (const t of threatList) {
        if (!t.id) add('error', 'A threat is missing its ID.');
        if (typeof t.likelihood !== 'number' || typeof t.impact !== 'number') add('warning', `${t.id || 'threat'}: missing risk rating (likelihood/impact).`);
        if (!arr(t.stride).length) add('warning', `${t.id || 'threat'}: no STRIDE category assigned.`);
        if (!arr(t.components).length) add('warning', `${t.id || 'threat'}: orphaned threat (no affected component).`);
        for (const c of arr(t.components)) if (!compIds.has(c)) add('error', `${t.id}: references unknown component '${c}'.`);
        for (const a of arr(t.assets)) if (!assetIds.has(a)) add('error', `${t.id}: references unknown asset '${a}'.`);
        if (t.attackerRef && !attackerById.has(t.attackerRef)) add('error', `${t.id}: references unknown attacker profile '${t.attackerRef}'.`);
        for (const iface of arr(t.interfaceRefs)) if (!ifaceIds.has(iface)) add('error', `${t.id}: references unknown interface '${iface}'.`);
        if (t.interfaceRef && !ifaceIds.has(t.interfaceRef)) add('error', `${t.id}: references unknown interface '${t.interfaceRef}'.`);
        const atk = t.attackerRef ? attackerById.get(t.attackerRef) : null;
        const exposure = t.likelihoodFactors?.exposure;
        const exploit = t.likelihoodFactors?.exploitability;
        if (atk && typeof exposure === 'number' && (PROX[atk.access] ?? 4) < reqProx(exposure))
            add('warning', `${t.id}: attacker ${atk.id} (${atk.access}) is not proximate enough to reach an exposure-${exposure} surface.`);
        if (atk && typeof atk.capability === 'number' && typeof exploit === 'number' && atk.capability + exploit < 6)
            add('warning', `${t.id}: exploit difficulty (${6 - exploit}) exceeds attacker ${atk.id}'s capability (${atk.capability}) — likelihood may be over-stated.`);
        if (t.status === 'accepted' && (!t.acceptedBy || !t.acceptanceRationale || !t.reviewDate))
            add('warning', `${t.id}: accepted residual risk requires a sign-off owner (acceptedBy), a rationale (acceptanceRationale) and a next-review date (reviewDate).`);
        if (t.reviewDate && t.reviewDate < today)
            add('warning', `${t.id}: re-assessment overdue (review date ${t.reviewDate}).`);
        if (t.status === 'mitigated') {
            const impl = cmList.some((c) => arr(c.addresses).some((a) => a.threat === t.id) && (c.status === 'implemented' || c.status === 'verified'));
            if (!impl) add('warning', `${t.id}: status 'mitigated' but no implemented/verified countermeasure addresses it.`);
        }
        const [rl, ri] = residual(t, cmList);
        const res = (rl || 0) * (ri || 0);
        if (res > acceptableRisk && t.status !== 'accepted') {
            const threatLabel = t.id || 'threat';
            add('warning', `${threatLabel}: residual risk ${res} exceeds the acceptable risk (${acceptableRisk}) — reduce it or accept the residual.`, t.id ? `risk-over-acceptable:${t.id}` : undefined);
        }
        if (project.rigorousMode) {
            if (!t.impactDimensions) add('warning', `${t.id}: rigorous mode requires the Bug Bar impact dimensions to be set.`);
            const lf = t.likelihoodFactors;
            if (!lf || (typeof lf.exposure !== 'number' && typeof lf.exploitability !== 'number'))
                add('warning', `${t.id}: rigorous mode requires the exposure / exploitability factors to be set.`);
            if (!t.ratedBy) add('warning', `${t.id}: rigorous mode requires the rater to be recorded (ratedBy).`);
        }
    }

    for (const i of interfaces) {
        if (typeof i.hidden !== 'undefined' && typeof i.hidden !== 'boolean') {
            add('warning', `Interface '${i.id || i.name || 'unknown'}': hidden must be a boolean when set.`);
        }
    }

    const reqCms = new Set(reqList.flatMap((r) => arr(r.satisfiedByCM)));
    for (const c of cmList) {
        if (!c.id) add('error', 'A countermeasure is missing its ID.');
        if (!arr(c.addresses).length) add('warning', `${c.id || 'countermeasure'}: addresses no threat (orphaned countermeasure).`);
        for (const a of arr(c.addresses)) if (!tIds.has(a.threat)) add('error', `${c.id}: addresses unknown threat '${a.threat}'.`);
        for (const comp of arr(c.components)) if (!compIds.has(comp)) add('error', `${c.id}: references unknown component '${comp}'.`);
        if (c.id && c.selected !== false && !reqCms.has(c.id)) add('warning', `${c.id}: no security requirement is associated with this countermeasure.`);
        const ticketCount = arr(c.ticketUrls).filter(Boolean).length || (c.ticketUrl ? 1 : 0);
        if ((c.status === 'implemented' || c.status === 'verified') && !ticketCount)
            add('warning', `${c.id}: status '${c.status}' requires a ticket link as proof of implementation.`);
        if (c.status === 'verified' && !c.verificationUrl)
            add('warning', `${c.id}: status 'verified' requires a verification link as evidence the control was tested.`);
        for (const a of arr(c.addresses)) {
            const th = threatById.get(a.threat);
            if (!th) continue;
            if (typeof a.residualImpact === 'number' && a.residualImpact > th.impact)
                add('warning', `${c.id}: residual impact for ${a.threat} (${a.residualImpact}) exceeds the initial impact (${th.impact}).`);
            if (typeof a.residualLikelihood === 'number' && a.residualLikelihood > th.likelihood)
                add('warning', `${c.id}: residual likelihood for ${a.threat} (${a.residualLikelihood}) exceeds the initial likelihood (${th.likelihood}).`);
            if (c.type === 'preventive' && typeof a.residualImpact === 'number' && a.residualImpact < th.impact)
                add('warning', `${c.id}: a preventive control should reduce likelihood, not impact — it lowers the impact of ${a.threat} (${th.impact}→${a.residualImpact}).`);
        }
    }

    for (const r of reqList) {
        const hasCm = arr(r.satisfiedByCM).length > 0;
        const hasThreat = arr(r.derivedFromThreat).length > 0;
        if (!hasCm) {
            if (hasThreat) add('warning', `${r.id}: security requirement derived from a threat has no countermeasure satisfying it.`);
            else add('notice', `${r.id}: standalone security requirement — not derived from a threat and not backed by a countermeasure. Accept if this is intentional.`, `req-standalone:${r.id}`);
        }
        for (const th of arr(r.derivedFromThreat)) if (!tIds.has(th)) add('error', `${r.id}: derived from unknown threat '${th}'.`);
        for (const cm of arr(r.satisfiedByCM)) if (!cmIds.has(cm)) add('error', `${r.id}: satisfied by unknown countermeasure '${cm}'.`);
    }
    const reqThreats = new Set(reqList.flatMap((r) => arr(r.derivedFromThreat)));
    for (const t of threatList)
        if ((t.likelihood || 0) * (t.impact || 0) >= 12 && !reqThreats.has(t.id) && t.status !== 'accepted')
            add('warning', `${t.id}: high/critical threat has no security requirement derived from it.`);

    const parents = new Set(components.map((c) => c.parent).filter(Boolean));
    const threatComps = new Set(threatList.flatMap((t) => arr(t.components)));
    for (const c of components)
        if (c.kind !== 'external-entity' && c.kind !== 'device' && !parents.has(c.id) && !threatComps.has(c.id))
            add('warning', `Coverage: component '${c.id}' (${c.name}) has no threat — STRIDE-per-element coverage gap.`);
    const threatIfaces = new Set(threatList.flatMap((t) => [...arr(t.interfaceRefs), ...(t.interfaceRef ? [t.interfaceRef] : [])]).filter(Boolean));
    for (const i of interfaces)
        if (!threatIfaces.has(i.id)) add('warning', `Coverage: interface '${i.id}' (${i.name}) has no threat — every external interface should have at least one.`);

    for (const n of arr(dfd.nodes))
        if (n.type === 'trust-boundary' && !arr(n.members).length)
            add('warning', `Trust boundary '${n.id}' has no members (a trust boundary must contain at least one node).`);
    const boundaryIds = new Set([
        ...arr(system.trustBoundaries).map((b) => b.id),
        ...arr(dfd.nodes).filter((n) => n.type === 'trust-boundary').map((n) => n.id),
    ]);
    for (const f of arr(dfd.flows)) {
        if (f.crossesBoundary && !boundaryIds.has(f.crossesBoundary))
            add('error', `Flow '${f.id}' references unknown trust boundary '${f.crossesBoundary}'.`);
        if (!f.label || !f.label.trim())
            add('warning', `Data flow '${f.id}' (${f.from}→${f.to}) has no label — every flow must state what data or command it carries.`);
    }
    for (const d of arr(defects.defects ?? defects)) {
        if (d.component && !compIds.has(d.component)) add('error', `${d.id || 'defect'}: references unknown component '${d.component}'.`);
        if (d.threatRef && !tIds.has(d.threatRef)) add('error', `${d.id || 'defect'}: references unknown threat '${d.threatRef}'.`);
        if ((d.status === 'open' || d.status === 'triaged') && (d.severity === 'high' || d.severity === 'critical') && d.threatRef)
            add('warning', `${d.id}: open ${d.severity} defect — re-assess the linked threat '${d.threatRef}'.`);
    }
    for (const tr of arr(attackTrees.trees))
        if (tr.threatRef && !tIds.has(tr.threatRef)) add('error', `Attack tree '${tr.id}' references unknown threat '${tr.threatRef}'.`);

    return issues;
}
