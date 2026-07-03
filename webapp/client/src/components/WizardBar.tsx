// Wizard-style Back / Next navigation with a per-step "done when" hint, addressing the
// thesis requirement for guided workflow assistance for non-expert users.
import { useStore } from '../state/store';
import type { ViewKey } from '../types';

const ORDER: ViewKey[] = ['project', 'assumptions', 'system', 'dfd', 'requirements', 'threats', 'attackTrees', 'countermeasures', 'review'];
const LABEL: Record<string, string> = {
    project: 'Project',
    assumptions: 'Assumptions',
    system: 'System & assets',
    dfd: 'Data flow diagram',
    threats: 'Threats',
    requirements: 'Requirements',
    countermeasures: 'Countermeasures',
    attackTrees: 'Attack trees',
    review: 'Review & report',
};
const DONE_WHEN: Record<string, string> = {
    project: 'the device, a one-sentence scope boundary and the SL-T are set.',
    assumptions: 'at least one attacker profile is defined (it grounds the likelihood).',
    system: 'components and the protected assets (with C/I/A/S ratings) are listed.',
    dfd: 'the device, its trust boundaries and external interfaces are on the diagram.',
    requirements: 'the security requirements (from the SL-T and security context) are captured; refine them against the threats.',
    threats: 'every component and interface has at least one rated STRIDE threat, linked to the requirements it violates.',
    attackTrees: 'optional — decompose your highest-risk threats (you can skip this).',
    countermeasures: 'each requirement is satisfied by a control with a residual rating.',
    review: 'the plausibility check is clean; then export the report.',
};

export default function WizardBar() {
    const view = useStore((s) => s.activeView);
    const setView = useStore((s) => s.setView);
    const i = ORDER.indexOf(view as ViewKey);
    if (i < 0) return null;
    const prev = ORDER[i - 1];
    const next = ORDER[i + 1];
    return (
        <div className="wizardbar">
            <button className="btn sm" disabled={!prev} onClick={() => prev && setView(prev)}>
                ← {prev ? LABEL[prev] : 'Back'}
            </button>
            <span className="hint">
                <b>Done when:</b> {DONE_WHEN[view as string]}
            </span>
            <button className="btn sm primary" disabled={!next} onClick={() => next && setView(next)}>
                {next ? LABEL[next] : 'Finish'} →
            </button>
        </div>
    );
}
