import type { ReactNode } from 'react';
import { useStore } from '../state/store';
import { validate, openIssues } from '../lib/validate';
import type { ViewKey } from '../types';

interface StepDef {
    key: ViewKey | 'dfd';
    num: string;
    label: string;
    sub: string;
}
const STEPS: StepDef[] = [
    { key: 'project', num: '01', label: 'Project', sub: 'Scope, device, SL-T' },
    { key: 'assumptions', num: '02', label: 'Assumptions', sub: 'Incl. attacker profiles' },
    { key: 'system', num: '03', label: 'System & Assets', sub: 'Components, C/I/A/S' },
    { key: 'dfd', num: '04', label: 'Data Flow Diagram', sub: 'Layered DeMarco model' },
    { key: 'useCases', num: '04b', label: '(Mis-)use cases', sub: 'Actors, actions · optional' },
    { key: 'requirements', num: '05', label: 'Requirements', sub: 'Security requirements (SR)' },
    { key: 'threats', num: '06', label: 'Threats', sub: 'STRIDE + risk rating' },
    { key: 'attackTrees', num: '07', label: 'Attack trees', sub: 'Optional · AND/OR/SAND' },
    { key: 'countermeasures', num: '08', label: 'Countermeasures', sub: 'Residual risk' },
    { key: 'review', num: '09', label: 'Review & Report', sub: 'Plausibility check' },
    { key: 'versions', num: '10', label: 'TRA Versions', sub: 'Tagging history + diffs' },
];

export default function StepNav() {
    const data = useStore((s) => s.data);
    const view = useStore((s) => s.activeView);
    const setView = useStore((s) => s.setView);
    if (!data) return <nav className="stepnav" />;

    const issues = openIssues(validate(data), data.project?.acceptedNotices);
    const counts: Record<string, number> = {
        assumptions: data.assumptions.attacker?.length || 0,
        system: data.system.components?.length || 0,
        dfd: data.dfd.nodes?.length || 0,
        useCases: data.useCases?.diagrams?.length || 0,
        threats: data.threats.threats?.length || 0,
        requirements: data.requirements?.requirements?.length || 0,
        countermeasures: (data.countermeasures.countermeasures || []).filter((c) => c.selected !== false).length,
        attackTrees: data.attackTrees?.trees?.length || 0,
        defects: data.defects?.defects?.length || 0,
    };
    const done: Record<string, boolean> = {
        project: !!data.project.device?.name && !!data.project.scope?.boundary,
        assumptions: (data.assumptions.attacker?.length || 0) > 0,
        system: (data.system.components?.length || 0) > 0 && (data.system.assets?.length || 0) > 0,
        dfd: (data.dfd.nodes?.length || 0) > 0,
        useCases: (data.useCases?.diagrams?.length || 0) > 0,
        threats: (data.threats.threats?.length || 0) > 0,
        requirements: (data.requirements?.requirements?.length || 0) > 0,
        countermeasures: (data.countermeasures.countermeasures || []).some((c) => c.selected !== false),
        review: issues.length === 0,
        versions: (data.changeTracker?.entries?.length || 0) > 0,
    };
    const stepIdx = STEPS.findIndex((s) => s.key === view);

    return (
        <nav className="stepnav" aria-label="TRA steps">
            <div className="grouplabel">Methodology</div>
            {STEPS.map((s) => (
                <NavItem key={s.key} vkey={s.key} view={view} setView={setView} num={s.num} label={s.label} sub={s.sub}>
                    {s.key === 'review' && issues.length > 0 ? (
                        <span className="count warnmark" title={`${issues.length} issue(s)`}>
                            {issues.length} ⚠
                        </span>
                    ) : counts[s.key] !== undefined ? (
                        <span className="count">{counts[s.key]}</span>
                    ) : done[s.key] ? (
                        <span className="check">✓</span>
                    ) : null}
                </NavItem>
            ))}

            <div className="grouplabel">Views</div>
            <NavItem vkey="dashboard" view={view} setView={setView} num="▦" label="Dashboard" sub="IEC 62443-4-1 overview" />
            <NavItem vkey="assistant" view={view} setView={setView} num="✨" label="Assistant" sub="Docs · KB suggestions" />
            <NavItem vkey="defects" view={view} setView={setView} num="🐞" label="Defect register" sub="Lifecycle DM / SUM">
                {(counts.defects ?? 0) > 0 ? <span className="count">{counts.defects}</span> : null}
            </NavItem>
            <NavItem vkey="kb" view={view} setView={setView} num="📚" label="Knowledge base" sub="Bug Bar · library" />

            {stepIdx >= 0 && (
                <div className="stepnav-foot">
                    <button className="btn sm" disabled={stepIdx <= 0} onClick={() => setView(STEPS[stepIdx - 1].key)} aria-label="Previous step">
                        ← Back
                    </button>
                    <span className="hint">{done[STEPS[stepIdx].key] === false ? '○ in progress' : done[STEPS[stepIdx].key] ? '✓ done' : ''}</span>
                    <button className="btn sm primary" disabled={stepIdx >= STEPS.length - 1} onClick={() => setView(STEPS[stepIdx + 1].key)} aria-label="Next step">
                        Next →
                    </button>
                </div>
            )}
        </nav>
    );
}

function NavItem({
    vkey,
    view,
    setView,
    num,
    label,
    sub,
    children,
}: {
    vkey: any;
    view: string;
    setView: (v: any) => void;
    num: string;
    label: string;
    sub: string;
    children?: ReactNode;
}) {
    return (
        <div
            className={'stepitem' + (view === vkey ? ' active' : '')}
            role="button"
            tabIndex={0}
            aria-current={view === vkey ? 'page' : undefined}
            onClick={() => setView(vkey)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setView(vkey);
                }
            }}
        >
            <span className="num">{num}</span>
            <span className="lbl">
                {label}
                <small>{sub}</small>
            </span>
            {children}
        </div>
    );
}
