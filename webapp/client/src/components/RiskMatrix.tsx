import { Fragment, useState } from 'react';
import { useStore } from '../state/store';
import { riskOf, band, bandsOf, descendantComponentIds } from '../lib/risk';
import { DEFAULT_ACCEPTABLE_RISK } from '../types';

/**
 * 5×5 residual-risk heat map. Optionally filtered to a single component (when a DFD node
 * is selected) — including all of that component's sub-components, so a parent node rolls
 * up the risk of everything it contains. Clicking a cell that holds threats jumps to the
 * matching threat directly, or opens a chooser when several threats share the cell.
 */
export default function RiskMatrix({ componentRef }: { componentRef?: string }) {
    const data = useStore((s) => s.data)!;
    const scheme = useStore((s) => s.scheme);
    const goto = useStore((s) => s.goto);
    const [previewIds, setPreviewIds] = useState<string[]>([]);
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
    const acceptableRisk = typeof data.project.acceptableRisk === 'number' ? data.project.acceptableRisk : DEFAULT_ACCEPTABLE_RISK;
    const isAcceptable = (likelihood: number, impact: number) => likelihood * impact <= acceptableRisk;
    const boundaryClass = (likelihood: number, impact: number) => {
        const acceptable = isAcceptable(likelihood, impact);
        const classes: string[] = [];
        if (impact < 5 && acceptable !== isAcceptable(likelihood, impact + 1)) classes.push('boundary-top');
        if (likelihood < 5 && acceptable !== isAcceptable(likelihood + 1, impact)) classes.push('boundary-right');
        return classes.join(' ');
    };
    const openCell = (ids: string[]) => {
        if (ids.length === 1) goto('threats', ids[0]);
        else if (ids.length > 1) setPreviewIds(ids);
    };

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
                                    className={'cell ' + boundaryClass(L, I) + (n ? ' hit' : '')}
                                    key={`${L}-${I}`}
                                    role={n ? 'button' : undefined}
                                    tabIndex={n ? 0 : undefined}
                                    aria-label={n ? `Likelihood ${L} by impact ${I}, ${b.name}, ${n} threat(s): ${ids.join(', ')}. Activate to open.` : undefined}
                                    style={{ background: b.color, opacity: n ? 1 : 0.42, cursor: n ? 'pointer' : 'default' }}
                                    title={n ? `L${L} × I${I} = ${score} (${b.name}) — ${ids.join(', ')} · click to open` : `L${L} × I${I} = ${score} (${b.name})`}
                                    onClick={() => openCell(ids)}
                                    onKeyDown={(e) => {
                                        if (n && (e.key === 'Enter' || e.key === ' ')) {
                                            e.preventDefault();
                                            openCell(ids);
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
                <div className="matrix-boundaries" aria-hidden="true">
                    {impacts.map((I, rowIndex) =>
                        likes.map((L) => {
                            const boundary = boundaryClass(L, I);
                            if (!boundary) return null;
                            return (
                                <span
                                    key={`${L}-${I}`}
                                    className={boundary}
                                    style={{ gridColumn: L + 1, gridRow: rowIndex + 1 }}
                                />
                            );
                        }),
                    )}
                </div>
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
                <span className="inline" style={{ gap: 4 }}>
                    <span className="matrix-threshold-key" aria-hidden="true" />
                    <span className="hint">acceptable risk: {acceptableRisk}</span>
                </span>
            </div>
            {previewIds.length > 1 ? (
                <div className="modal-overlay" onClick={() => setPreviewIds([])}>
                    <div className="modal matrix-preview" role="dialog" aria-modal="true" aria-label="Threats at selected residual risk" onClick={(event) => event.stopPropagation()}>
                        <div className="modalhead">
                            <strong>Threats at this residual risk</strong>
                            <button className="btn sm" type="button" aria-label="Close threat preview" onClick={() => setPreviewIds([])}>✕</button>
                        </div>
                        {previewIds.map((id) => {
                            const threat = threats.find((item) => item.id === id);
                            return (
                                <button key={id} className="matrix-preview-item" type="button" onClick={() => goto('threats', id)}>
                                    <span className="summary-id">{id}</span>
                                    <span>{threat?.title || 'Unknown threat'}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
