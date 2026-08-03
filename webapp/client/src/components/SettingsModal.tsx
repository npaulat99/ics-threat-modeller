// Project settings dialog (opened from the gear button). Groups project-level configuration that
// is not TRA content: the acceptable residual-risk threshold (used by the plausibility checker),
// the rigorous-assessment mode, and report-content toggles.
import { useEffect } from 'react';
import { useStore } from '../state/store';
import { DEFAULT_ACCEPTABLE_RISK } from '../types';
import { Field } from './common';

export default function SettingsModal() {
    const data = useStore((s) => s.data);
    const save = useStore((s) => s.save);
    const open = useStore((s) => s.settingsOpen);
    const setOpen = useStore((s) => s.openSettings);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, setOpen]);

    if (!open || !data) return null;
    const p = data.project;
    const set = (patch: any) => save('project', { ...p, ...patch });
    const setReport = (patch: any) => set({ reportOptions: { ...(p.reportOptions || {}), ...patch } });
    const acceptable = typeof p.acceptableRisk === 'number' ? p.acceptableRisk : DEFAULT_ACCEPTABLE_RISK;

    return (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
            <div className="modal" role="dialog" aria-modal="true" aria-label="Project settings" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
                <div className="modalhead">
                    <h3 style={{ margin: 0 }}>⚙ Project settings</h3>
                    <button className="btn sm" aria-label="Close" onClick={() => setOpen(false)}>
                        ✕ Close
                    </button>
                </div>

                <div className="card" style={{ marginBottom: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Risk acceptance</h3>
                    <Field
                        label="Acceptable residual risk"
                        hint="Warnings appear above this residual-risk threshold. Default: 12."
                    >
                        <input
                            className="inp"
                            type="number"
                            min={0}
                            max={25}
                            style={{ width: 100 }}
                            value={acceptable}
                            onChange={(e) => {
                                const v = Number(e.target.value);
                                set({ acceptableRisk: Number.isFinite(v) ? Math.max(0, Math.min(25, v)) : DEFAULT_ACCEPTABLE_RISK });
                            }}
                        />
                    </Field>
                </div>

                <div className="card" style={{ marginBottom: 12 }}>
                    <h3 style={{ marginTop: 0 }}>Assessment rigor</h3>
                    <label className="inline" style={{ gap: 7, margin: 0, alignItems: 'flex-start' }}>
                        <input type="checkbox" checked={!!p.rigorousMode} onChange={(e) => set({ rigorousMode: e.target.checked })} style={{ marginTop: 3 }} />
                        <span className="hint">
                            <b>Rigorous mode</b> requires Bug Bar dimensions, exposure/exploitability, and a named rater on every threat.
                        </span>
                    </label>
                </div>

                <div className="card">
                    <h3 style={{ marginTop: 0 }}>Report content</h3>
                    <label className="inline" style={{ gap: 7, margin: 0, alignItems: 'flex-start' }}>
                        <input
                            type="checkbox"
                            checked={!!p.reportOptions?.includeStrideBoundaryAnalysis}
                            onChange={(e) => setReport({ includeStrideBoundaryAnalysis: e.target.checked })}
                            style={{ marginTop: 3 }}
                        />
                        <span className="hint">
                            Include <b>STRIDE-per-trust-boundary</b> tables.
                        </span>
                    </label>
                </div>
            </div>
        </div>
    );
}
