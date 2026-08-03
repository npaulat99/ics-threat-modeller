// Modal editor for the per-trust-boundary STRIDE strengths/weaknesses analysis (a structured
// brainstorming aid). Opened from the DFD (a selected trust boundary) or the System step, via the
// store's `strideBoundaryId`. Shows one table per pair of entities that communicate across the
// boundary (each crossing data flow), since different protocols (e.g. HART vs. Bluetooth) give
// different security properties. Auto-fills the entity name on each side; the analyst then fills
// strengths and weaknesses (one per line) per STRIDE category, per side.
import { useEffect } from 'react';
import { useStore } from '../state/store';
import { boundaryPairs, STRIDE_KEYS, STRIDE_LABEL } from '../lib/stride';
import type { StridePair } from '../lib/stride';
import type { StridePairAnalysis, StrideSideAnalysis, Stride } from '../types';

type SideKey = 'sideA' | 'sideB';

export default function StrideBoundaryEditor() {
    const data = useStore((s) => s.data);
    const save = useStore((s) => s.save);
    const tbId = useStore((s) => s.strideBoundaryId);
    const close = useStore((s) => s.openStrideBoundary);

    useEffect(() => {
        if (!tbId) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close(null);
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [tbId, close]);

    if (!data || !tbId) return null;
    const system = data.system;
    const tb = (system.trustBoundaries || []).find((b) => b.id === tbId);
    const nodeName = (data.dfd.nodes || []).find((n) => n.id === tbId && n.type === 'trust-boundary')?.label;
    const name = tb?.name || nodeName || tbId;
    const pairs = boundaryPairs(system, data.dfd, tbId);
    const analysesForTb: Record<string, StridePairAnalysis> = system.strideAnalyses?.[tbId] || {};

    const writePair = (pairKey: string, next: StridePairAnalysis) => {
        const all = { ...(system.strideAnalyses || {}) };
        const forTb = { ...(all[tbId] || {}) };
        forTb[pairKey] = next;
        all[tbId] = forTb;
        save('system', { ...system, strideAnalyses: all });
    };

    const renderPairTable = (pair: StridePair) => {
        const analysis: StridePairAnalysis = analysesForTb[pair.key] || {};
        const setLabel = (side: SideKey, v: string) => {
            const sideObj: StrideSideAnalysis = { ...(analysis[side] || {}), label: v.trim() || undefined };
            writePair(pair.key, { ...analysis, [side]: sideObj });
        };
        const setCell = (side: SideKey, k: Stride, field: 'strengths' | 'weaknesses', text: string) => {
            const sideObj: StrideSideAnalysis = { ...(analysis[side] || {}) };
            const cells = { ...(sideObj.cells || {}) };
            const cell = { ...(cells[k] || {}) };
            const lines = text.split('\n');
            cell[field] = lines.length === 1 && lines[0] === '' ? [] : lines;
            cells[k] = cell;
            writePair(pair.key, { ...analysis, [side]: { ...sideObj, cells } });
        };
        const cellText = (side: SideKey, k: Stride, field: 'strengths' | 'weaknesses') => (analysis[side]?.cells?.[k]?.[field] || []).join('\n');
        const cell = (side: SideKey, k: Stride, field: 'strengths' | 'weaknesses') => (
            <td style={{ verticalAlign: 'top', padding: 4 }}>
                <textarea
                    className="inp"
                    style={{ width: '100%', minHeight: 54, resize: 'vertical', fontSize: 12 }}
                    value={cellText(side, k, field)}
                    placeholder="one per line"
                    aria-label={`${side === 'sideA' ? 'Side A' : 'Side B'} ${STRIDE_LABEL[k]} ${field}`}
                    onChange={(e) => setCell(side, k, field, e.target.value)}
                />
            </td>
        );
        const aLabel = analysis.sideA?.label ?? pair.inside.label;
        const bLabel = analysis.sideB?.label ?? pair.outside.label;
        return (
            <div className="card" key={pair.key} style={{ marginBottom: 14 }}>
                <div className="grid2" style={{ marginBottom: 8 }}>
                    <div className="field">
                        <label>Side A — {pair.inside.label} (inside the boundary)</label>
                        <input className="inp" value={aLabel} onChange={(e) => setLabel('sideA', e.target.value)} />
                    </div>
                    <div className="field">
                        <label>Side B — {pair.outside.label} (across the boundary)</label>
                        <input className="inp" value={bLabel} onChange={(e) => setLabel('sideB', e.target.value)} />
                    </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                        <tr>
                            <th rowSpan={2} style={{ padding: 6, textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                STRIDE
                            </th>
                            <th colSpan={2} style={{ padding: 6, borderBottom: '1px solid var(--border)', borderLeft: '2px solid var(--border)' }}>
                                {aLabel}
                            </th>
                            <th colSpan={2} style={{ padding: 6, borderBottom: '1px solid var(--border)', borderLeft: '2px solid var(--border)' }}>
                                {bLabel}
                            </th>
                        </tr>
                        <tr style={{ color: 'var(--text-dim)' }}>
                            <th style={{ padding: 4, borderLeft: '2px solid var(--border)' }}>Strengths</th>
                            <th style={{ padding: 4 }}>Weaknesses</th>
                            <th style={{ padding: 4, borderLeft: '2px solid var(--border)' }}>Strengths</th>
                            <th style={{ padding: 4 }}>Weaknesses</th>
                        </tr>
                    </thead>
                    <tbody>
                        {STRIDE_KEYS.map((k) => (
                            <tr key={k} style={{ borderTop: '1px solid var(--border)' }}>
                                <th style={{ padding: 6, textAlign: 'left', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                                    <span className="mono">{k}</span> · {STRIDE_LABEL[k]}
                                </th>
                                {cell('sideA', k, 'strengths')}
                                {cell('sideA', k, 'weaknesses')}
                                {cell('sideB', k, 'strengths')}
                                {cell('sideB', k, 'weaknesses')}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    return (
        <div className="modal-overlay" onClick={() => close(null)}>
            <div className="modal" role="dialog" aria-modal="true" aria-label="STRIDE analysis per trust boundary" style={{ maxWidth: 1120, width: '100%' }} onClick={(e) => e.stopPropagation()}>
                <div className="modalhead">
                    <h3 style={{ margin: 0 }}>
                        STRIDE analysis · <span className="mono">{tbId}</span> {name}
                    </h3>
                    <button className="btn sm" aria-label="Close" onClick={() => close(null)}>
                        ✕ Close
                    </button>
                </div>
                <p className="hint" style={{ marginTop: 0 }}>
                    One table per pair of entities that communicate across this boundary (each crossing data flow). For each STRIDE
                    category, note the <b>strengths and weaknesses from each side</b> (one point per line). The side labels are
                    auto-filled from the model; edit them if needed.
                </p>
                {pairs.length ? (
                    pairs.map((pair) => (
                        <div key={pair.key}>
                            <h4 style={{ margin: '4px 0 6px' }}>
                                {pair.inside.label} <span className="muted">⇄</span> {pair.outside.label}
                            </h4>
                            {renderPairTable(pair)}
                        </div>
                    ))
                ) : (
                    <p className="hint">
                        No data flows cross this boundary yet. Add flows in the DFD that cross <span className="mono">{tbId}</span> to
                        analyse each communicating pair (e.g. HART ⇄ Plant DCS, Bluetooth ⇄ maintenance app).
                    </p>
                )}
            </div>
        </div>
    );
}
