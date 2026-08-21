import cursorIcon from '../tutorial/assets/cursor.svg';
import type { CursorState } from '../tutorial/useTutorialCursor';
import {
    tutorialAssets,
    tutorialAssumptions,
    tutorialAttackRoots,
    tutorialComponents,
    tutorialCountermeasures,
    tutorialImpacts,
    tutorialNav,
    tutorialProject,
    tutorialRequirements,
    tutorialThreats,
    tutorialWorkshops,
    type TutorialStep,
} from '../tutorial/tutorialData';

interface Props {
    step: TutorialStep;
    cursor: CursorState;
    onReplay: () => void;
}

const show = (reveal: number, at: number) => (reveal >= at ? ' tw-in' : ' tw-out');

export default function TutorialWindow({ step, cursor, onReplay }: Props) {
    const reveal = cursor.reveal;
    const isCover = step.screen === 'intro' || step.screen === 'outro';

    return (
        <div className="tw-stage" aria-live="polite">
            {isCover ? (
                <Cover step={step} reveal={reveal} />
            ) : (
                <div className="tw-window">
                    <div className="tw-titlebar">
                        <span className="tw-dots"><i /><i /><i /></span>
                        <span className="tw-brand">EmbedRisk</span>
                        <span className="tw-project">{tutorialProject.title}</span>
                        <span className="tw-slt">{tutorialProject.slTarget}</span>
                    </div>
                    <div className="tw-body">
                        <nav className="tw-nav">
                            <div className="tw-navhead">Methodology</div>
                            {tutorialNav.map((n) => (
                                <div key={n.key} className={'tw-navitem' + (step.navKey === n.key ? ' active' : '')}>
                                    <span className="tw-navlabel">{n.label}</span>
                                </div>
                            ))}
                        </nav>
                        <section className="tw-main">
                            <Screen step={step} reveal={reveal} typing={cursor.typing} />
                        </section>
                    </div>
                </div>
            )}

            <img
                src={cursorIcon}
                alt=""
                aria-hidden="true"
                className={'tw-cursor' + (cursor.clicking ? ' clicking' : '')}
                style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
            />
            {cursor.clicking && <span className="tw-clickring" style={{ left: `${cursor.x}%`, top: `${cursor.y}%` }} />}

            {cursor.done && (
                <button className="tw-replay" onClick={onReplay} title="Replay this step">
                    ↻ Replay
                </button>
            )}
        </div>
    );
}

function Screen({ step, reveal, typing }: { step: TutorialStep; reveal: number; typing: boolean }) {
    switch (step.screen) {
        case 'project':
            return <ProjectScreen reveal={reveal} typing={typing} />;
        case 'assumptions':
            return <AssumptionsScreen reveal={reveal} />;
        case 'impact':
            return <ImpactScreen reveal={reveal} />;
        case 'system':
            return <SystemScreen reveal={reveal} />;
        case 'assets':
            return <AssetsScreen reveal={reveal} />;
        case 'dfd':
            return <DfdScreen reveal={reveal} />;
        case 'threats':
            return <ThreatsScreen reveal={reveal} />;
        case 'attacktree':
            return <AttackTreeScreen reveal={reveal} />;
        case 'requirements':
            return <RequirementsScreen reveal={reveal} />;
        case 'countermeasures':
            return <CountermeasuresScreen reveal={reveal} />;
        case 'review':
            return <ReviewScreen reveal={reveal} />;
        default:
            return null;
    }
}

function PanelHead({ num, title, action }: { num: string; title: string; action?: string }) {
    return (
        <div className="tw-panelhead">
            <div><span className="tw-badge">{num}</span> <b>{title}</b></div>
            {action && <span className="tw-addbtn">{action}</span>}
        </div>
    );
}

function ProjectScreen({ reveal, typing }: { reveal: number; typing: boolean }) {
    const rows = [
        { label: 'Device / project', value: tutorialProject.title, at: 1 },
        { label: 'Intended use', value: tutorialProject.domain, at: 2 },
        { label: 'Lifecycle status', value: tutorialProject.status, at: 3 },
    ];
    return (
        <div className="tw-form">
            <PanelHead num="01" title="Project description" />
            {rows.map((r) => (
                <label key={r.label} className="tw-field">
                    <span>{r.label}</span>
                    <span className={'tw-input' + (reveal >= r.at ? ' filled' : '')}>
                        {reveal >= r.at ? r.value : ''}
                        {typing && reveal === r.at && <i className="tw-caret" />}
                    </span>
                </label>
            ))}
            <label className="tw-field">
                <span>Security level target</span>
                <span className={'tw-input pill' + (reveal >= 1 ? ' filled' : '')}>{reveal >= 1 ? tutorialProject.slTarget : ''}</span>
            </label>
            <div className="tw-formfoot">
                <span className={'tw-savebtn' + (reveal >= 4 ? ' done' : '')}>{reveal >= 4 ? '✓ Saved' : 'Save'}</span>
            </div>
        </div>
    );
}

function AssumptionsScreen({ reveal }: { reveal: number }) {
    return (
        <div>
            <PanelHead num="02" title="Assumptions" action="+ Add assumption" />
            <div className="tw-note">Living artifact — revisited throughout the analysis</div>
            <table className="tw-table">
                <thead>
                    <tr><th>ID</th><th>Type</th><th>Assumption</th></tr>
                </thead>
                <tbody>
                    {tutorialAssumptions.map((a, i) => (
                        <tr key={a.id} className={'tw-row' + show(reveal, i + 1)}>
                            <td className="mono">{a.id}</td>
                            <td><span className="tw-tag">{a.tag}</span></td>
                            <td>{a.text}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ImpactScreen({ reveal }: { reveal: number }) {
    return (
        <div>
            <PanelHead num="07" title="Impact workshop → attack-tree roots" action="+ Root node" />
            <div className="tw-note">First pass — capture worst-case impact, then seed root nodes</div>
            <div className="tw-two">
                <div>
                    <div className="tw-colhead">Worst-case impact</div>
                    {tutorialImpacts.map((im, i) => (
                        <div key={im.id} className={'tw-cardrow' + show(reveal, i + 1)}>
                            <span className={'tw-dim ' + im.dim.toLowerCase()}>{im.dim}</span>
                            <span>{im.text}</span>
                        </div>
                    ))}
                </div>
                <div>
                    <div className="tw-colhead">Attack-tree roots</div>
                    {tutorialAttackRoots.map((rt, i) => (
                        <div key={rt.id} className={'tw-cardrow root' + show(reveal, i + 4)}>
                            <span className="tw-node">{rt.id}</span>
                            <span>{rt.text}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function SystemScreen({ reveal }: { reveal: number }) {
    return (
        <div>
            <PanelHead num="03" title="System components" action="+ Add component" />
            <table className="tw-table">
                <thead>
                    <tr><th>ID</th><th>Component</th><th>Zone</th></tr>
                </thead>
                <tbody>
                    {tutorialComponents.map((c, i) => (
                        <tr key={c.id} className={'tw-row' + show(reveal, i + 1)}>
                            <td className="mono">{c.id}</td>
                            <td>{c.name}</td>
                            <td><span className="tw-tag">{c.zone}</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function AssetsScreen({ reveal }: { reveal: number }) {
    return (
        <div>
            <PanelHead num="03" title="Assets · C / I / A + Safety" action="+ Add asset" />
            <table className="tw-table">
                <thead>
                    <tr><th>Asset</th><th>C</th><th>I</th><th>A</th><th>S</th></tr>
                </thead>
                <tbody>
                    {tutorialAssets.map((a, i) => (
                        <tr key={a.id} className={'tw-row' + show(reveal, i + 1)}>
                            <td>{a.name}</td>
                            <td className="ctr">{a.c}</td>
                            <td className="ctr"><b>{a.i}</b></td>
                            <td className="ctr">{a.a}</td>
                            <td className="ctr"><b>{a.s}</b></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function DfdScreen({ reveal }: { reveal: number }) {
    // Nodes sit on one horizontal line so every wire is a straight run between two edges —
    // no line has to cross through a third node or dangle unattached.
    return (
        <div>
            <PanelHead num="04" title="Data flow diagram" />

            <div className="tw-dfd">
                {/* Trust boundary: the only zone marker, deliberately neutral (not red/blue) */}
                <div className={'tw-tb-line' + show(reveal, 2)} />
                <div className={'tw-tb-label' + show(reveal, 2)}>Trust boundary</div>

                {/* Entities, evenly spaced on the same row */}
                <div className="tw-dfdnode op" style={{ left: '14%', top: '50%' }}>
                    SCADA<br />operator
                </div>
                <div className="tw-dfdnode dev" style={{ left: '50%', top: '50%' }}>
                    FC-300<br />controller
                </div>
                <div className="tw-dfdnode cloud" style={{ left: '86%', top: '50%' }}>
                    Vendor<br />cloud
                </div>

                {/* Data flows — endpoints sit exactly on node edges */}
                <svg className="tw-dfdwires" viewBox="0 0 100 100" preserveAspectRatio="none">
                    {/* SCADA operator -> controller (Modbus) */}
                    <line className={'tw-wire' + show(reveal, 1)} x1="19.3" y1="50" x2="44.1" y2="50" />
                    {/* Controller -> vendor cloud (telemetry) */}
                    <line className={'tw-wire cross' + show(reveal, 2)} x1="55.9" y1="45" x2="81.3" y2="45" />
                    {/* Vendor cloud -> controller (signed firmware) */}
                    <line className={'tw-wire cross' + show(reveal, 3)} x1="81.3" y1="55" x2="55.9" y2="55" />
                </svg>

                <div className={'tw-flowlabel' + show(reveal, 1)} style={{ left: '32%', top: '43%' }}>
                    Modbus read/write
                </div>
                <div className={'tw-flowlabel' + show(reveal, 2)} style={{ left: '68%', top: '37%' }}>
                    Telemetry (TLS)
                </div>
                <div className={'tw-flowlabel' + show(reveal, 3)} style={{ left: '68%', top: '63%' }}>
                    Signed firmware
                </div>
            </div>
        </div>
    );
}

function ThreatsScreen({ reveal }: { reveal: number }) {
    const riskClass = (r: number) => (r >= 15 ? 'high' : r >= 9 ? 'med' : 'low');
    return (
        <div>
            <PanelHead num="06" title="Threats · STRIDE + risk" action="+ Add threat" />
            <table className="tw-table">
                <thead>
                    <tr><th>ID</th><th>Threat</th><th>STRIDE</th><th>Root</th><th>Score</th><th>Risk</th></tr>
                </thead>
                <tbody>
                    {tutorialThreats.map((t, i) => (
                        <tr key={t.id} className={'tw-row' + show(reveal, i + 1)}>
                            <td className="mono">{t.id}</td>
                            <td>{t.title}</td>
                            <td>{t.stride}</td>
                            <td className="mono">{t.root}</td>
                            <td className="ctr">{t.l}×{t.i}</td>
                            <td className="ctr"><span className={'tw-risk ' + riskClass(t.risk)}>{t.risk}</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function AttackTreeScreen({ reveal }: { reveal: number }) {
    const branches = [
        { id: 'AT-1.1', text: 'Spoof Modbus write to flow register' },
        { id: 'AT-1.2', text: 'Replay a captured maintenance session' },
        { id: 'AT-1.3', text: 'Tamper with calibration parameters' },
    ];
    return (
        <div>
            <PanelHead num="07" title="Attack tree · AT-1 (refined)" action="+ Branch" />
            <div className="tw-tree">
                <div className="tw-tree-root">AT-1 · Falsify flow measurement</div>
                <div className="tw-tree-gate">OR</div>
                <div className="tw-tree-branches">
                    {branches.map((b, i) => (
                        <div key={b.id} className={'tw-tree-node' + show(reveal, i + 2)}>
                            <span className="mono">{b.id}</span>
                            <span>{b.text}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function RequirementsScreen({ reveal }: { reveal: number }) {
    return (
        <div>
            <PanelHead num="05" title="Security requirements" action="+ Add requirement" />
            <div className="tw-note">Link requirements to threats and controls; chosen countermeasures can create an “is CM” requirement</div>
            <div className="tw-list">
                {tutorialRequirements.map((r, i) => (
                    <div key={r.id} className={'tw-reqrow' + show(reveal, i + 1)}>
                        <span className="mono">{r.id}</span>
                        <span className="tw-reqtext">{r.text}</span>
                        <span className={'tw-rationale ' + r.origin}>{r.rationale}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CountermeasuresScreen({ reveal }: { reveal: number }) {
    const riskClass = (r: number) => (r >= 15 ? 'high' : r >= 9 ? 'med' : 'low');
    return (
        <div>
            <PanelHead num="08" title="Countermeasures · evaluate value" />
            <div className="tw-note">Implement a control only if it lowers the risk of at least one threat</div>
            <div className="tw-list">
                {tutorialCountermeasures.map((c, i) => (
                    <div key={c.id} className={'tw-cmrow' + show(reveal, i + 1)}>
                        <span className="tw-cmtext">{c.text}</span>
                        <span className="mono tw-cmthreat">{c.threat}</span>
                        <span className="tw-residual">
                            <span className={'tw-risk ' + riskClass(c.from)}>{c.from}</span>
                            <span className="tw-arrow">→</span>
                            <span className={'tw-risk ' + riskClass(c.to)}>{c.to}</span>
                        </span>
                        <span className={'tw-decision ' + c.decision}>
                            {c.decision === 'implement' ? '✓ Implement' : '✕ Skip · no value'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ReviewScreen({ reveal }: { reveal: number }) {
    const checks = [
        'Assets rated with CIA + Safety',
        'Threats linked to impact scenarios',
        'Controls evaluated; only value-adding ones implemented',
        'Residual risk accepted',
    ];
    return (
        <div>
            <div className="tw-panelhead">
                <div><span className="tw-badge">09</span> <b>Review &amp; report</b></div>
                <span className={'tw-status' + (reveal >= 3 ? ' reviewed' : '')}>{reveal >= 3 ? '✓ Report ready' : 'In review'}</span>
            </div>
            <div className="tw-trace">asset → threat → countermeasure → requirement → residual risk</div>
            <div className="tw-list">
                {checks.map((c, i) => (
                    <div key={c} className={'tw-checkrow' + (reveal >= (i < 2 ? 1 : 2) ? ' on' : '')}>
                        <span className="tw-check">✓</span>
                        <span>{c}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function Cover({ step, reveal }: { step: TutorialStep; reveal: number }) {
    const isIntro = step.screen === 'intro';
    return (
        <div className={'tw-cover ' + (isIntro ? 'intro' : 'outro')}>
            <div className="tw-cover-badge">{isIntro ? 'Iterative TRA' : 'Keep it alive'}</div>
            <h2 className="tw-cover-title">{step.title}</h2>
            {isIntro ? (
                <>
                    <p className="tw-cover-lead">
                        A threat &amp; risk analysis is <b>iterative</b>. Different participants contribute during
                        different workshops — this walkthrough follows one realistic sequence.
                    </p>
                    <div className="tw-workshops">
                        {tutorialWorkshops.map((w, i) => (
                            <div key={w.phase} className={'tw-workshop' + (reveal > i ? ' tw-in' : ' tw-out')}>
                                <b>{w.phase}</b>
                                <span>{w.focus}</span>
                                <em>{w.who}</em>
                            </div>
                        ))}
                    </div>
                    <p className="tw-cover-foot">Participants shown are <b>typical</b>, not mandatory. Phases may overlap or repeat.</p>
                </>
            ) : (
                <>
                    <p className="tw-cover-lead">The analysis is never truly finished. As the product matures:</p>
                    <ul className="tw-outrolist">
                        {[
                            'Assumptions evolve and are re-validated',
                            'Attack trees are refined with new branches',
                            'Requirements change with the architecture',
                            'Revisit after new interfaces, vulnerabilities or operational changes',
                        ].map((t, i) => (
                            <li key={t} className={reveal > i ? 'tw-in' : 'tw-out'}>{t}</li>
                        ))}
                    </ul>
                    <p className="tw-cover-foot">Reopen this walkthrough anytime from <b>Help → Start tutorial</b>.</p>
                </>
            )}
        </div>
    );
}
