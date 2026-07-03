import { useStore, uid } from '../../state/store';
import { Field, Chips, useFocus, useEditMode, EditBackBar, ScaleSelect, LIKELIHOOD_LEVELS, IMPACT_LEVELS, Jump, HelpButton, confirmDelete, IdInput } from '../common';
import type { Countermeasure } from '../../types';

export default function CountermeasuresPanel() {
    const data = useStore((s) => s.data)!;
    const kb = useStore((s) => s.kb);
    const save = useStore((s) => s.save);

    const cms = data.countermeasures.countermeasures || [];
    const threats = data.threats.threats || [];
    const focusId = useFocus('countermeasures');
    const { editingId, setEditingId } = useEditMode(focusId);
    const threatOpts = threats.map((t) => ({ value: t.id, label: `${t.id} · ${t.title}` }));
    const compOpts = (data.system.components || []).map((c) => ({ value: c.id, label: c.name }));

    const setCms = (list: Countermeasure[]) => save('countermeasures', { countermeasures: list });
    const add = () => {
        const id = uid('CM', cms.map((c) => c.id));
        setCms([...cms, { id, title: 'New countermeasure', type: 'preventive', addresses: [], components: [], status: 'proposed' }]);
        setEditingId(id);
    };
    const importKb = (key: string) => {
        const k = (kb?.countermeasures || []).find((x: any) => x.key === key);
        if (!k) return;
        const id = uid('CM', cms.map((c) => c.id));
        setCms([...cms, { id, title: k.title, type: 'preventive', addresses: [], components: [], status: 'proposed' }]);
        setEditingId(id);
    };
    const editing = cms.find((c) => c.id === editingId) || null;

    const renderEditor = (c: Countermeasure) => {
        const upd = (patch: any) => setCms(cms.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
        const addrThreatIds = (c.addresses || []).map((a) => a.threat);
        const toggleThreat = (next: string[]) => {
            const existing = new Map((c.addresses || []).map((a) => [a.threat, a]));
            const addresses = next.map((tid) => existing.get(tid) || { threat: tid, residualLikelihood: 2, residualImpact: 2 });
            upd({ addresses });
        };
        const updAddr = (tid: string, patch: any) => upd({ addresses: (c.addresses || []).map((a) => (a.threat === tid ? { ...a, ...patch } : a)) });
        return (
            <div id={`f-countermeasures-${c.id}`} className="itemcard" key={c.id} style={!addrThreatIds.length ? { borderColor: '#f0c9a8' } : undefined}>
                <div className="head">
                    <IdInput id={c.id} onRename={setEditingId} />
                    <input className="inp grow" value={c.title} onChange={(e) => upd({ title: e.target.value })} />
                    <select className="inp" style={{ width: 140 }} value={c.type || 'preventive'} onChange={(e) => upd({ type: e.target.value })}>
                        {['preventive', 'detective', 'corrective', 'organizational'].map((o) => (
                            <option key={o}>{o}</option>
                        ))}
                    </select>
                    <select className="inp" style={{ width: 130 }} value={c.status || 'proposed'} onChange={(e) => upd({ status: e.target.value })}>
                        {['proposed', 'planned', 'implemented', 'verified'].map((o) => (
                            <option key={o}>{o}</option>
                        ))}
                    </select>
                    <button className="btn sm danger" aria-label={`Delete countermeasure ${c.id}`} onClick={() => confirmDelete(`countermeasure ${c.id}`) && (setCms(cms.filter((x) => x.id !== c.id)), setEditingId(null))}>
                        ✕
                    </button>
                </div>

                <Field label="Addresses threats" hint={!addrThreatIds.length ? 'A countermeasure must address at least one threat.' : undefined}>
                    <Chips options={threatOpts} value={addrThreatIds} onChange={toggleThreat} empty="Define threats in step 05 first." />
                </Field>

                {(c.addresses || []).length > 0 && (
                    <div className="card" style={{ boxShadow: 'none', background: 'var(--surface-2)', marginBottom: 10 }}>
                        {(c.addresses || []).map((a) => {
                            const t = threats.find((x) => x.id === a.threat);
                            return (
                                <div className="inline" key={a.threat} style={{ marginBottom: 6 }}>
                                    <Jump view="threats" id={a.threat} />
                                    <span className="grow muted" style={{ flex: 1, minWidth: 120 }}>
                                        {t?.title || 'unknown threat'}
                                    </span>
                                    <label className="hint">res L</label>
                                    <ScaleSelect value={a.residualLikelihood ?? 2} onChange={(n) => updAddr(a.threat, { residualLikelihood: n })} levels={LIKELIHOOD_LEVELS} style={{ width: 150 }} />
                                    <label className="hint">res I</label>
                                    <ScaleSelect value={a.residualImpact ?? 2} onChange={(n) => updAddr(a.threat, { residualImpact: n })} levels={IMPACT_LEVELS} style={{ width: 150 }} />
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="grid2">
                    <Field label="Affected components">
                        <Chips options={compOpts} value={c.components || []} onChange={(v) => upd({ components: v })} />
                    </Field>
                    <Field label="IEC 62443 reference (optional)">
                        <input value={c.iec62443Ref || ''} onChange={(e) => upd({ iec62443Ref: e.target.value })} placeholder="CR 1.2 / FR1" />
                    </Field>
                </div>
                <Field label="Description">
                    <textarea value={c.description || ''} onChange={(e) => upd({ description: e.target.value })} />
                </Field>
                {(c.status === 'implemented' || c.status === 'verified') && (
                    <div className="grid2">
                        <Field
                            label="Implementation ticket (required)"
                            hint={!c.ticketUrl ? 'A ticketing-system link is required to prove this control was implemented.' : undefined}
                        >
                            <input
                                value={c.ticketUrl || ''}
                                onChange={(e) => upd({ ticketUrl: e.target.value })}
                                placeholder="https://dev.azure.com/org/proj/_workitems/edit/123"
                                style={!c.ticketUrl ? { borderColor: 'var(--warn)' } : undefined}
                            />
                        </Field>
                        <Field label="Verification evidence link">
                            <input
                                value={c.verificationUrl || ''}
                                onChange={(e) => upd({ verificationUrl: e.target.value })}
                                placeholder="link to test report / verification record"
                            />
                        </Field>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="panel">
            <div className="panelhead">
                <h1>Countermeasures &amp; residual risk</h1>
                <HelpButton title="Countermeasures (tips)">
                    <ul>
                        <li>Use <b>object references, not copies</b> — link one countermeasure to many threats rather than duplicating text.</li>
                        <li>Record the residual L/I each control achieves; the residual risk is the <b>lowest</b> reached across applied controls.</li>
                        <li>Once a control is <b>implemented or verified</b>, attach the <b>ticket link</b> (proof) and a verification/test link — this is the IEC 62443-4-1 traceability evidence.</li>
                    </ul>
                </HelpButton>
            </div>
            <p className="lead">
                Each countermeasure may address several threats (many-to-many). For every addressed threat, record the residual
                likelihood and impact it brings about — the residual risk is the minimum across all applied countermeasures.
            </p>

            {editing ? (
                <>
                    <EditBackBar label={`Editing ${editing.id}`} onBack={() => setEditingId(null)} />
                    {renderEditor(editing)}
                </>
            ) : (
                <>
                    <div className="toolbar">
                        <button className="btn primary sm" onClick={add}>
                            + Countermeasure
                        </button>
                        {kb?.countermeasures?.length ? (
                            <select
                                className="inp"
                                style={{ width: 280 }}
                                value=""
                                onChange={(e) => {
                                    if (e.target.value) importKb(e.target.value);
                                    e.target.value = '';
                                }}
                            >
                                <option value="">+ Add from knowledge base…</option>
                                {kb.countermeasures.map((k: any) => (
                                    <option key={k.key} value={k.key}>
                                        {k.title}
                                    </option>
                                ))}
                            </select>
                        ) : null}
                    </div>

                    <div className="list">
                        {cms.map((c) => {
                            const addr = c.addresses || [];
                            return (
                                <div id={`f-countermeasures-${c.id}`} className={'itemcard collapsed' + (focusId === c.id ? ' focused' : '')} key={c.id} style={!addr.length ? { borderColor: '#f0c9a8' } : undefined}>
                                    <div className="head">
                                        <span className="summary-id">{c.id}</span>
                                        <span className="summary-title">{c.title}</span>
                                        <span className="tag">{c.type || 'preventive'}</span>
                                        <span className="tag statuspill">{c.status || 'proposed'}</span>
                                        <button className="btn sm" onClick={() => setEditingId(c.id)}>
                                            Edit
                                        </button>
                                        <button className="btn sm danger" aria-label={`Delete countermeasure ${c.id}`} onClick={() => confirmDelete(`countermeasure ${c.id}`) && setCms(cms.filter((x) => x.id !== c.id))}>
                                            ✕
                                        </button>
                                    </div>
                                    <div className="summary-links">
                                        <span className="lbl">Addresses:</span>
                                        {addr.length ? addr.map((a) => <Jump key={a.threat} view="threats" id={a.threat} />) : <span className="hint">no threat yet</span>}
                                    </div>
                                </div>
                            );
                        })}
                        {!cms.length && <p className="hint">No countermeasures yet.</p>}
                    </div>
                </>
            )}
        </div>
    );
}
