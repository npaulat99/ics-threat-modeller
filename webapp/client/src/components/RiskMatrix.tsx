import { Fragment } from 'react';
import { useStore } from '../state/store';
import { riskOf, band, bandsOf, descendantComponentIds } from '../lib/risk';

/**
 * 5×5 residual-risk heat map. Optionally filtered to a single component (when a DFD node
 * is selected) — including all of that component's sub-components, so a parent node rolls
 * up the risk of everything it contains. Clicking a cell that holds threats jumps to the
 * first of those threats.
 */
export default function RiskMatrix({ componentRef }: { componentRef?: string }) {
    const data = useStore((s) => s.data)!;
    const scheme = useStore((s) => s.scheme);
    const goto = useStore((s) => s.goto);
    let threats = data.threats.threats || [];
    const cms = data.countermeasures.countermeasures || [];
    let rolledUp = false;
    if (componentRef) {
        const ids = descendantComponentIds(data.system.components || [], componentRef);
        rolledUp = ids.size > 1;
        threats = threats.filter((t) => (t.components || []).some((c) => ids.has(c)));
    }

    const cellThreats: Record<string, string[]> = {};
    for (const t of threats) {
        const r = riskOf(t, cms, scheme);
        const k = `${r.residualLikelihood}-${r.residualImpact}`;
        (cellThreats[k] = cellThreats[k] || []).push(t.id);
    }

    const impacts = [5, 4, 3, 2, 1];
    const likes = [1, 2, 3, 4, 5];

    return (
        <div>
            <div className="matrix">
                {impacts.map((I) => (
                    <Fragment key={`r-${I}`}>
                        <div className="cell axis" style={{ writingMode: 'vertical-rl' as any }}>
                            {I}
                        </div>
                        {likes.map((L) => {
                            const score = L * I;
                            const b = band(score, scheme);
                            const ids = cellThreats[`${L}-${I}`] || [];
                            const n = ids.length;
                            return (
                                <div
                                    className={'cell' + (n ? ' hit' : '')}
                                    key={`${L}-${I}`}
                                    role={n ? 'button' : undefined}
                                    tabIndex={n ? 0 : undefined}
                                    aria-label={n ? `Likelihood ${L} by impact ${I}, ${b.name}, ${n} threat(s): ${ids.join(', ')}. Activate to open.` : undefined}
                                    style={{ background: b.color, opacity: n ? 1 : 0.42, cursor: n ? 'pointer' : 'default' }}
                                    title={n ? `L${L} × I${I} = ${score} (${b.name}) — ${ids.join(', ')} · click to open` : `L${L} × I${I} = ${score} (${b.name})`}
                                    onClick={() => n && goto('threats', ids[0])}
                                    onKeyDown={(e) => {
                                        if (n && (e.key === 'Enter' || e.key === ' ')) {
                                            e.preventDefault();
                                            goto('threats', ids[0]);
                                        }
                                    }}
                                >
                                    {score}
                                    <span className="bandmark" aria-hidden="true">{b.name[0]}</span>
                                    {n > 0 && <span className="n">{n}</span>}
                                </div>
                            );
                        })}
                    </Fragment>
                ))}
                <div className="cell axis" />
                {likes.map((L) => (
                    <div className="cell axis" key={`l-${L}`}>
                        {L}
                    </div>
                ))}
            </div>
            <div className="axislabel">
                Likelihood → · Impact ↑ ·{' '}
                {componentRef
                    ? `${threats.length} threat(s) on this component${rolledUp ? ' + sub-components' : ''}`
                    : `residual risk of ${threats.length} threat(s)`}
            </div>
            <div className="inline" style={{ marginTop: 6 }}>
                {bandsOf(scheme).map((b) => (
                    <span key={b.name} className="inline" style={{ gap: 4 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: b.color, display: 'inline-block' }} />
                        <span className="hint">{b.name}</span>
                    </span>
                ))}
            </div>
        </div>
    );
}
