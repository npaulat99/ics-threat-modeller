import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { tutorialSteps } from '../tutorial/tutorialData';
import { useTutorialCursor } from '../tutorial/useTutorialCursor';
import TutorialWindow from './TutorialWindow';

function RichText({ text }: { text: string }) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return (
        <>
            {parts.map((p, i) =>
                p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>,
            )}
        </>
    );
}

function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const update = () => setReduced(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);
    return reduced;
}

export default function TutorialOnboarding() {
    const promptOpen = useStore((s) => s.tutorialPromptOpen);
    const walkthroughOpen = useStore((s) => s.tutorialWalkthroughOpen);
    const startTutorial = useStore((s) => s.startTutorial);
    const skipTutorial = useStore((s) => s.skipTutorial);
    const closeTutorial = useStore((s) => s.closeTutorial);

    const [index, setIndex] = useState(0);
    const [replayNonce, setReplayNonce] = useState(0);
    const reduceMotion = usePrefersReducedMotion();

    useEffect(() => {
        if (!walkthroughOpen) {
            setIndex(0);
            setReplayNonce(0);
        }
    }, [walkthroughOpen]);

    const step = tutorialSteps[index];
    const total = tutorialSteps.length;
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const replayKey = index * 1000 + replayNonce;

    const cursor = useTutorialCursor(step.path, step.duration, walkthroughOpen, reduceMotion, replayKey);

    const go = (next: number) => setIndex(Math.min(total - 1, Math.max(0, next)));

    // Keyboard navigation for the walkthrough.
    useEffect(() => {
        if (!walkthroughOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') go(index + 1);
            else if (e.key === 'ArrowLeft') go(index - 1);
            else if (e.key === 'Escape') closeTutorial();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [walkthroughOpen, index]);

    const progressPct = useMemo(() => Math.round(((index + 1) / total) * 100), [index, total]);

    if (!promptOpen && !walkthroughOpen) return null;

    return (
        <>
            {promptOpen && (
                <div className="modal-overlay" onClick={skipTutorial}>
                    <div className="modal tutorial-start" role="dialog" aria-modal="true" aria-label="Start tutorial" onClick={(e) => e.stopPropagation()}>
                        <div className="modalhead">
                            <h3 style={{ margin: 0 }}>Take the guided tour?</h3>
                            <button className="btn sm" onClick={skipTutorial}>Skip tutorial</button>
                        </div>
                        <p className="muted" style={{ marginTop: 0 }}>
                            EmbedRisk includes a short interactive tutorial. Watch an experienced team run a{' '}
                            <b>realistic, iterative threat &amp; risk analysis</b> on a connected field device — while
                            learning the interface.
                        </p>
                        <div className="tutorial-quickfacts">
                            <span><b>Format:</b> animated, hands-off demo</span>
                            <span><b>Example:</b> FlowGuard FC-300 controller</span>
                            <span><b>Teaches:</b> iterative TRA methodology</span>
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
                            <div className="tut-headline">
                                <strong>{step.title}</strong>
                                {step.toolNum && <span className="tut-toolnum">Tool {step.toolNum}</span>}
                            </div>
                            <div className="tut-headright">
                                <span className="muted">Step {index + 1} of {total}</span>
                                <button className="btn sm" onClick={closeTutorial}>Close</button>
                            </div>
                        </div>

                        <div className="tutorial-layout">
                            <section className="tut-stagecol">
                                <TutorialWindow step={step} cursor={cursor} onReplay={() => setReplayNonce((n) => n + 1)} />
                            </section>

                            <aside className="tut-info">
                                <div className="tut-chips">
                                    <span className="tut-phase">{step.phase}</span>
                                    {step.iteration && <span className="tut-iter">{step.iteration}</span>}
                                </div>

                                <div className="tut-copyblock">
                                    <p className="tut-lead"><RichText text={step.what} /></p>
                                    <p className="tut-why"><span className="tut-why-k">Why</span> <RichText text={step.why} /></p>
                                </div>

                                <div className="tut-participants">
                                    <span className="tut-plabel">Typical participants</span>
                                    <div className="tut-pchips">
                                        {step.participants.map((p) => (
                                            <span key={p} className="tut-pchip">{p}</span>
                                        ))}
                                    </div>
                                </div>
                            </aside>
                        </div>

                        <div className="tutorial-progressbar" aria-hidden="true">
                            <span style={{ width: `${progressPct}%` }} />
                        </div>

                        <div className="tutorial-controls">
                            <button className="btn" onClick={skipTutorial}>Skip tutorial</button>
                            <div className="tut-mid">
                                <button className="btn" disabled={isFirst} onClick={() => go(index - 1)}>Previous</button>
                                <div className="tutorial-dots" aria-hidden="true">
                                    {tutorialSteps.map((s, i) => (
                                        <span key={s.key} className={'tutorial-dot' + (i === index ? ' on' : '')} />
                                    ))}
                                </div>
                                {isLast ? (
                                    <button className="btn primary" onClick={closeTutorial}>Finish</button>
                                ) : (
                                    <button className="btn primary" onClick={() => go(index + 1)}>Next</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
