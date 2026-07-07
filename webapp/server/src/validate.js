// Plausibility checker. Returns a flat list of human-readable issues. Mirrors the client
// checker (reference integrity, coverage/completeness, residual sanity, control-type
// consistency, and the threat -> requirement -> control chain).
const arr = (x) => (Array.isArray(x) ? x : []);
const PROX = { remote: 1, adjacent: 2, local: 3, physical: 4 };
const reqProx = (e) => (e >= 4 ? 1 : e === 3 ? 2 : e === 2 ? 3 : 4);

export function validate({ project = {}, assumptions = {}, system = {}, threats = {}, requirements = {}, countermeasures = {}, dfd = {}, attackTrees = {}, defects = {} } = {}) {
    const issues = [];
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

    if (!attackers.length) issues.push('No attacker assumptions (required to ground the likelihood assessment).');
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
        if (seenId.has(id)) issues.push(`Duplicate ID '${id}' — used by ${seenId.get(id)} and ${kind}. IDs must be unique across the project.`);
        else seenId.set(id, kind);
    }
    const today = new Date().toISOString().slice(0, 10);

    for (const t of threatList) {
        if (!t.id) issues.push('A threat is missing its ID.');
        if (!t.likelihood || !t.impact) issues.push(`${t.id || 'threat'}: missing risk rating (likelihood/impact).`);
        if (!arr(t.stride).length) issues.push(`${t.id || 'threat'}: no STRIDE category assigned.`);
        if (!arr(t.components).length) issues.push(`${t.id || 'threat'}: orphaned threat (no affected component).`);
        for (const c of arr(t.components)) if (!compIds.has(c)) issues.push(`${t.id}: references unknown component '${c}'.`);
        for (const a of arr(t.assets)) if (!assetIds.has(a)) issues.push(`${t.id}: references unknown asset '${a}'.`);
        if (t.attackerRef && !attackerById.has(t.attackerRef)) issues.push(`${t.id}: references unknown attacker profile '${t.attackerRef}'.`);
        for (const iface of arr(t.interfaceRefs)) if (!ifaceIds.has(iface)) issues.push(`${t.id}: references unknown interface '${iface}'.`);
        if (t.interfaceRef && !ifaceIds.has(t.interfaceRef)) issues.push(`${t.id}: references unknown interface '${t.interfaceRef}'.`);
        const atk = t.attackerRef ? attackerById.get(t.attackerRef) : null;
        const exposure = t.likelihoodFactors?.exposure;
        const exploit = t.likelihoodFactors?.exploitability;
        if (atk && typeof exposure === 'number' && (PROX[atk.access] ?? 4) < reqProx(exposure))
            issues.push(`${t.id}: attacker ${atk.id} (${atk.access}) is not proximate enough to reach an exposure-${exposure} surface.`);
        if (atk && typeof atk.capability === 'number' && typeof exploit === 'number' && atk.capability + exploit < 6)
            issues.push(`${t.id}: exploit difficulty (${6 - exploit}) exceeds attacker ${atk.id}'s capability (${atk.capability}) — likelihood may be over-stated.`);
        if (t.status === 'accepted' && (!t.acceptedBy || !t.acceptanceRationale || !t.reviewDate))
            issues.push(`${t.id}: accepted residual risk requires a sign-off owner (acceptedBy), a rationale (acceptanceRationale) and a next-review date (reviewDate).`);
        if (t.reviewDate && t.reviewDate < today)
            issues.push(`${t.id}: re-assessment overdue (review date ${t.reviewDate}).`);
        if (t.status === 'mitigated') {
            const impl = cmList.some((c) => arr(c.addresses).some((a) => a.threat === t.id) && (c.status === 'implemented' || c.status === 'verified'));
            if (!impl) issues.push(`${t.id}: status 'mitigated' but no implemented/verified countermeasure addresses it.`);
        }
        if (project.rigorousMode) {
            if (!t.impactDimensions) issues.push(`${t.id}: rigorous mode requires the Bug Bar impact dimensions to be set.`);
            const lf = t.likelihoodFactors;
            if (!lf || (typeof lf.exposure !== 'number' && typeof lf.exploitability !== 'number'))
                issues.push(`${t.id}: rigorous mode requires the exposure / exploitability factors to be set.`);
            if (!t.ratedBy) issues.push(`${t.id}: rigorous mode requires the rater to be recorded (ratedBy).`);
        }
    }

    for (const c of cmList) {
        if (!c.id) issues.push('A countermeasure is missing its ID.');
        if (!arr(c.addresses).length) issues.push(`${c.id || 'countermeasure'}: addresses no threat (orphaned countermeasure).`);
        for (const a of arr(c.addresses)) if (!tIds.has(a.threat)) issues.push(`${c.id}: addresses unknown threat '${a.threat}'.`);
        for (const comp of arr(c.components)) if (!compIds.has(comp)) issues.push(`${c.id}: references unknown component '${comp}'.`);
        const ticketCount = arr(c.ticketUrls).filter(Boolean).length || (c.ticketUrl ? 1 : 0);
        if ((c.status === 'implemented' || c.status === 'verified') && !ticketCount)
            issues.push(`${c.id}: status '${c.status}' requires a ticket link as proof of implementation.`);
        if (c.status === 'verified' && !c.verificationUrl)
            issues.push(`${c.id}: status 'verified' requires a verification link as evidence the control was tested.`);
        for (const a of arr(c.addresses)) {
            const th = threatById.get(a.threat);
            if (!th) continue;
            if (typeof a.residualImpact === 'number' && a.residualImpact > th.impact)
                issues.push(`${c.id}: residual impact for ${a.threat} (${a.residualImpact}) exceeds the initial impact (${th.impact}).`);
            if (typeof a.residualLikelihood === 'number' && a.residualLikelihood > th.likelihood)
                issues.push(`${c.id}: residual likelihood for ${a.threat} (${a.residualLikelihood}) exceeds the initial likelihood (${th.likelihood}).`);
            if (c.type === 'preventive' && typeof a.residualImpact === 'number' && a.residualImpact < th.impact)
                issues.push(`${c.id}: a preventive control should reduce likelihood, not impact — it lowers the impact of ${a.threat} (${th.impact}→${a.residualImpact}).`);
        }
    }

    for (const r of reqList) {
        if (!arr(r.satisfiedByCM).length) issues.push(`${r.id}: security requirement has no countermeasure satisfying it.`);
        for (const th of arr(r.derivedFromThreat)) if (!tIds.has(th)) issues.push(`${r.id}: derived from unknown threat '${th}'.`);
        for (const cm of arr(r.satisfiedByCM)) if (!cmIds.has(cm)) issues.push(`${r.id}: satisfied by unknown countermeasure '${cm}'.`);
    }
    const reqThreats = new Set(reqList.flatMap((r) => arr(r.derivedFromThreat)));
    for (const t of threatList)
        if ((t.likelihood || 0) * (t.impact || 0) >= 12 && !reqThreats.has(t.id) && t.status !== 'accepted')
            issues.push(`${t.id}: high/critical threat has no security requirement derived from it.`);

    const parents = new Set(components.map((c) => c.parent).filter(Boolean));
    const threatComps = new Set(threatList.flatMap((t) => arr(t.components)));
    for (const c of components)
        if (c.kind !== 'external-entity' && c.kind !== 'device' && !parents.has(c.id) && !threatComps.has(c.id))
            issues.push(`Coverage: component '${c.id}' (${c.name}) has no threat — STRIDE-per-element coverage gap.`);
    const threatIfaces = new Set(threatList.flatMap((t) => [...arr(t.interfaceRefs), ...(t.interfaceRef ? [t.interfaceRef] : [])]).filter(Boolean));
    for (const i of interfaces)
        if (!threatIfaces.has(i.id)) issues.push(`Coverage: interface '${i.id}' (${i.name}) has no threat — every external interface should have at least one.`);

    for (const n of arr(dfd.nodes))
        if (n.type === 'trust-boundary' && !arr(n.members).length)
            issues.push(`Trust boundary '${n.id}' has no members (a trust boundary must contain at least one node).`);
    const boundaryIds = new Set([
        ...arr(system.trustBoundaries).map((b) => b.id),
        ...arr(dfd.nodes).filter((n) => n.type === 'trust-boundary').map((n) => n.id),
    ]);
    for (const f of arr(dfd.flows)) {
        if (f.crossesBoundary && !boundaryIds.has(f.crossesBoundary))
            issues.push(`Flow '${f.id}' references unknown trust boundary '${f.crossesBoundary}'.`);
        if (!f.label || !f.label.trim())
            issues.push(`Data flow '${f.id}' (${f.from}→${f.to}) has no label — every flow must state what data or command it carries.`);
    }
    for (const d of arr(defects.defects ?? defects)) {
        if (d.component && !compIds.has(d.component)) issues.push(`${d.id || 'defect'}: references unknown component '${d.component}'.`);
        if (d.threatRef && !tIds.has(d.threatRef)) issues.push(`${d.id || 'defect'}: references unknown threat '${d.threatRef}'.`);
        if ((d.status === 'open' || d.status === 'triaged') && (d.severity === 'high' || d.severity === 'critical') && d.threatRef)
            issues.push(`${d.id}: open ${d.severity} defect — re-assess the linked threat '${d.threatRef}'.`);
    }
    for (const tr of arr(attackTrees.trees))
        if (tr.threatRef && !tIds.has(tr.threatRef)) issues.push(`Attack tree '${tr.id}' references unknown threat '${tr.threatRef}'.`);

    return issues;
}
