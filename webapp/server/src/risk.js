// Deterministic risk engine: Risk = Likelihood x Impact (5x5), banded, with residual
// risk derived from the minimum residual L/I across all countermeasure links for a threat.
import { promises as fs } from 'node:fs';
import { riskSchemePath } from './paths.js';

let scheme = null;
export async function loadScheme() {
    if (!scheme) scheme = JSON.parse(await fs.readFile(riskSchemePath, 'utf8'));
    return scheme;
}

export function band(s, r) {
    return s.matrix.bands.find((b) => r >= b.min && r <= b.max) || s.matrix.bands[0];
}

/** Residual [likelihood, impact] for a threat given all countermeasures. */
export function residual(threat, cms) {
    const links = cms.flatMap((c) => (c.addresses || []).filter((a) => a.threat === threat.id));
    if (!links.length) return [threat.likelihood, threat.impact];
    // All applied controls are in effect simultaneously, so an attacker must overcome the strongest
    // one on each axis: the residual likelihood is the lowest residual likelihood any single control
    // achieves (the most protective dominates), and likewise the residual impact.
    let rl = threat.likelihood;
    let ri = threat.impact;
    for (const a of links) {
        rl = Math.min(rl, a.residualLikelihood ?? threat.likelihood);
        ri = Math.min(ri, a.residualImpact ?? threat.impact);
    }
    return [rl, ri];
}

export function computeRisk(s, threats, cms) {
    return threats.map((t) => {
        const initial = (t.likelihood || 0) * (t.impact || 0);
        const [rl, ri] = residual(t, cms);
        const res = (rl || 0) * (ri || 0);
        return {
            id: t.id,
            likelihood: t.likelihood,
            impact: t.impact,
            initial,
            initialBand: band(s, initial),
            residualLikelihood: rl,
            residualImpact: ri,
            residual: res,
            residualBand: band(s, res),
        };
    });
}
