import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { tutorialExampleProject, tutorialRiskData, tutorialSteps } from '../tutorial/tutorialData';
import cursorIcon from '../tutorial/assets/cursor.svg';

export default function TutorialOnboarding() {
    const promptOpen = useStore((s) => s.tutorialPromptOpen);
    const walkthroughOpen = useStore((s) => s.tutorialWalkthroughOpen);
    const startTutorial = useStore((s) => s.startTutorial);
    const skipTutorial = useStore((s) => s.skipTutorial);
    const closeTutorial = useStore((s) => s.closeTutorial);
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (!walkthroughOpen) setIndex(0);
    }, [walkthroughOpen]);

    const step = tutorialSteps[index];
    const progress = `${index + 1} / ${tutorialSteps.length}`;
    const isLast = index === tutorialSteps.length - 1;

    const cue = useMemo(() => {
        const phases = ['Observe', 'Model', 'Link', 'Review'];
        return phases[index % phases.length];
    }, [index]);

    if (!promptOpen && !walkthroughOpen) return null;

    return (
        <>
            {promptOpen && (
                <div className="modal-overlay" onClick={skipTutorial}>
                    <div className="modal tutorial-start" role="dialog" aria-modal="true" aria-label="Start tutorial" onClick={(e) => e.stopPropagation()}>
                        <div className="modalhead">
                            <h3 style={{ margin: 0 }}>Start guided tutorial?</h3>
                            <button className="btn sm" onClick={skipTutorial}>
                                Skip tutorial
                            </button>
                        </div>
                        <p className="muted" style={{ marginTop: 0 }}>
                            You just created a project. Run a short walkthrough to learn the TRA flow with a tiny
                            example before editing your own content.
                        </p>
                        <div className="tutorial-quickfacts">
                            <span><b>Length:</b> about 2 minutes</span>
                            <span><b>Format:</b> cursor-driven demo, no keyboard</span>
                            <span><b>Coverage:</b> all 9 methodology steps</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
                            <button className="btn" onClick={skipTutorial}>Skip tutorial</button>
                            <button className="btn primary" onClick={startTutorial}>Start tutorial</button>
                        </div>
                    </div>
                </div>
            )}

            {walkthroughOpen && (
                <div className="modal-overlay tutorial-overlay" onClick={closeTutorial}>
                    <div className="modal tutorial-shell" role="dialog" aria-modal="true" aria-label="Tutorial walkthrough" onClick={(e) => e.stopPropagation()}>
                        <div className="tutorial-topline">
                            <div>
                                <strong>EmbedRisk walkthrough</strong> <span className="muted">{progress}</span>
                            </div>
                            <button className="btn sm" onClick={closeTutorial}>Close</button>
                        </div>

                        <div className="tutorial-layout">
                            <aside className="tutorial-copy left">
                                <p><b>What</b></p>
                                <p>{step.what}</p>
                                <p><b>How</b></p>
                                <p>{step.how}</p>
                            </aside>

                            <section className="tutorial-stage-wrap">
                                <div className="tutorial-stage-title">{step.title}</div>
                                <div className="tutorial-stage" aria-live="polite">
                                    <div className="tutorial-sim-shell">
                                        <div className="tutorial-sim-rail">
                                            {tutorialSteps.map((s, i) => (
                                                <div key={s.key} className={'tutorial-sim-step' + (i === index ? ' active' : '')}>
                                                    {String(i + 1).padStart(2, '0')} {s.key}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="tutorial-sim-main">
                                            <div className="tutorial-sim-card">
                                                <div className="title"><b>{tutorialExampleProject.project.title}</b></div>
                                                <div className="hint">SL target: {tutorialExampleProject.project.slTarget}</div>
                                            </div>
                                            <div className="tutorial-sim-card">
                                                <div className="title"><b>{tutorialRiskData.threatTitle}</b></div>
                                                <div className="hint">Risk {tutorialRiskData.initialRisk} → {tutorialRiskData.residualRisk}</div>
                                            </div>
                                            <div className="tutorial-sim-cue">{cue}</div>
                                        </div>
                                    </div>

                                    <img
                                        src={cursorIcon}
                                        alt=""
                                        aria-hidden="true"
                                        className="tutorial-cursor"
                                        style={{ transform: `translate(${step.cursor.x}px, ${step.cursor.y}px)` }}
                                    />
                                </div>
                            </section>

                            <aside className="tutorial-copy right">
                                <p><b>Why</b></p>
                                <p>{step.why}</p>
                                <p><b>Traceability cue</b></p>
                                <p>
                                    <b>{tutorialRiskData.threatId}</b> maps to <b>{tutorialRiskData.requirementId}</b> and
                                    reduced by <b>{tutorialRiskData.countermeasureId}</b>.
                                </p>
                            </aside>
                        </div>

                        <div className="tutorial-controls">
                            <button className="btn" disabled={index === 0} onClick={() => setIndex((n) => Math.max(0, n - 1))}>
                                Back
                            </button>
                            <div className="tutorial-dots" aria-hidden="true">
                                {tutorialSteps.map((s, i) => (
                                    <span key={s.key} className={'tutorial-dot' + (i === index ? ' on' : '')} />
                                ))}
                            </div>
                            {isLast ? (
                                <button className="btn primary" onClick={closeTutorial}>Finish</button>
                            ) : (
                                <button className="btn primary" onClick={() => setIndex((n) => Math.min(tutorialSteps.length - 1, n + 1))}>
                                    Next
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
