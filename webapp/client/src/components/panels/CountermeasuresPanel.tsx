import { useStore, uid } from '../../state/store';
import { Field, Chips, useFocus, useEditMode, EditBackBar, ScaleSelect, LIKELIHOOD_LEVELS, IMPACT_LEVELS, Jump, HelpButton, confirmDelete, IdInput } from '../common';
import RiskCalculator from './RiskCalculator';
import type { Countermeasure } from '../../types';

export default function CountermeasuresPanel() {
    const data = useStore((s) => s.data)!;
    const kb = useStore((s) => s.kb);
    const save = useStore((s) => s.save);

    const cms = data.countermeasures.countermeasures || [];
    const threats = data.threats.threats || [];
    const attackers = data.assumptions.attacker || [];
    const ifaceOpts = (data.system.interfaces || []).map((itf) => ({ value: itf.id, label: `${itf.name}${itf.protocol ? ` (${itf.protocol})` : ''}` }));
    const attackerOpts = attackers.map((a) => ({ value: a.id, label: `${a.name} (cap ${a.capability}, ${a.access})` }));
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
    const ticketList = (c: Countermeasure) => (c.ticketUrls?.length ? c.ticketUrls : c.ticketUrl ? [c.ticketUrl] : ['']);
    const seedResidualFromThreat = (t: any) => ({
        residualLikelihood: t?.likelihood ?? 2,
        residualImpact: t?.impact ?? 2,
        attackerRef: t?.attackerRef,
        interfaceRef: t?.interfaceRef,
        interfaceRefs: t?.interfaceRefs?.length ? [...t.interfaceRefs] : t?.interfaceRef ? [t.interfaceRef] : [],
        interfaceLabel: t?.interfaceLabel,
        likelihoodFactors: t?.likelihoodFactors ? { ...t.likelihoodFactors } : undefined,
        impactDimensions: t?.impactDimensions ? { ...t.impactDimensions } : undefined,
        cvss: t?.cvss ? { ...t.cvss } : undefined,
        ratedBy: t?.ratedBy,
        ratedAt: t?.ratedAt,
    });

    const renderEditor = (c: Countermeasure) => {
        const upd = (patch: any) => setCms(cms.map((x) => (x.id === c.id ? { ...x, ...patch } : x)));
        const setTickets = (tickets: string[]) => {
            const cleaned = tickets.map((t) => t.trim()).filter(Boolean);
            upd({ ticketUrl: cleaned[0] || '', ticketUrls: cleaned });
        };
        const addrThreatIds = (c.addresses || []).map((a) => a.threat);
        const toggleThreat = (next: string[]) => {
            const existing = new Map((c.addresses || []).map((a) => [a.threat, a]));
            const addresses = next.map((tid) => existing.get(tid) || { threat: tid, ...seedResidualFromThreat(threats.find((x) => x.id === tid)) });
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
                            const residualIfaces = a.interfaceRefs?.length ? a.interfaceRefs : t?.interfaceRefs?.length ? t.interfaceRefs : t?.interfaceRef ? [t.interfaceRef] : [];
                            const residualModel = {
                                likelihood: t?.likelihood ?? 2,
                                impact: t?.impact ?? 2,
                                residualLikelihood: a.residualLikelihood ?? t?.likelihood ?? 2,
                                residualImpact: a.residualImpact ?? t?.impact ?? 2,
                                attackerRef: a.attackerRef ?? t?.attackerRef,
                                interfaceRef: a.interfaceRef ?? residualIfaces[0],
                                interfaceRefs: residualIfaces,
                                interfaceLabel: a.interfaceLabel ?? t?.interfaceLabel,
                                likelihoodFactors: a.likelihoodFactors ?? t?.likelihoodFactors,
                                impactDimensions: a.impactDimensions ?? t?.impactDimensions,
                                cvss: a.cvss ?? t?.cvss,
                                ratedBy: a.ratedBy ?? '',
                                ratedAt: a.ratedAt,
                            };
                            return (
                                <div key={a.threat} className="itemcard residual-card" style={{ marginBottom: 8 }}>
                                    <div className="inline" style={{ marginBottom: 8, alignItems: 'center' }}>
                                        <Jump view="threats" id={a.threat} />
                                        <span className="grow muted" style={{ flex: 1, minWidth: 180 }}>
                                            {t?.title || 'unknown threat'}
                                        </span>
                                        <span className="hint">Initial {t?.likelihood ?? '—'} × {t?.impact ?? '—'}</span>
                                        <button className="btn sm" type="button" onClick={() => updAddr(a.threat, seedResidualFromThreat(t))}>
                                            Reset from threat
                                        </button>
                                    </div>
                                    <div className="grid2">
                                        <Field label="Residual attacker profile">
                                            <select className="inp" value={residualModel.attackerRef || ''} onChange={(e) => updAddr(a.threat, { attackerRef: e.target.value || undefined })}>
                                                <option value="">— none —</option>
                                                {attackerOpts.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </Field>
                                        <Field label="Residual interfaces / vectors">
                                            <Chips options={ifaceOpts} value={residualIfaces} onChange={(v) => updAddr(a.threat, { interfaceRefs: v, interfaceRef: v[0] || undefined })} empty="No interfaces defined in step 03 yet." />
                                            <input className="inp" style={{ marginTop: 6 }} value={a.interfaceLabel ?? t?.interfaceLabel ?? ''} placeholder="Optional custom vector" onChange={(e) => updAddr(a.threat, { interfaceLabel: e.target.value || undefined })} />
                                        </Field>
                                    </div>
                                    <div className="grid2">
                                        <Field label="Residual likelihood">
                                            <ScaleSelect value={a.residualLikelihood ?? t?.likelihood ?? 2} onChange={(n) => updAddr(a.threat, { residualLikelihood: Math.min(n, t?.likelihood ?? n) })} levels={LIKELIHOOD_LEVELS} style={{ width: '100%' }} />
                                        </Field>
                                        <Field label="Residual impact">
                                            <ScaleSelect value={a.residualImpact ?? t?.impact ?? 2} onChange={(n) => updAddr(a.threat, { residualImpact: Math.min(n, t?.impact ?? n) })} levels={IMPACT_LEVELS} style={{ width: '100%' }} />
                                        </Field>
                                    </div>
                                    <div style={{ marginTop: 8 }}>
                                        <h4 style={{ margin: '0 0 8px 0' }}>Guided residual assessment</h4>
                                        <RiskCalculator
                                            t={residualModel as any}
                                            upd={(patch) => updAddr(a.threat, patch)}
                                            likelihoodField="residualLikelihood"
                                            impactField="residualImpact"
                                            summary="Open Bug Bar, likelihood factors and CVSS tools for the residual assessment"
                                            defaultOpen={true}
                                        />
                                    </div>
                                    {(t?.likelihoodRationale || t?.impactRationale || t?.interfaceLabel || t?.interfaceRefs?.length || t?.interfaceRef) && (
                                        <div className="hint" style={{ marginTop: 6 }}>
                                            {(t.interfaceRefs?.length || t.interfaceRef) ? `Interfaces: ${[...(t.interfaceRefs?.length ? t.interfaceRefs : t.interfaceRef ? [t.interfaceRef] : [])].join(', ')}. ` : ''}
                                            {t.interfaceLabel ? `Vector: ${t.interfaceLabel}. ` : ''}
                                            {t.likelihoodRationale ? `Likelihood rationale: ${t.likelihoodRationale}. ` : ''}
                                            {t.impactRationale ? `Impact rationale: ${t.impactRationale}.` : ''}
                                        </div>
                                    )}
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
                            label="Implementation tickets (at least one required)"
                            hint={!ticketList(c).some((t) => t.trim()) ? 'At least one ticketing-system link is required to prove this control was implemented.' : undefined}
                        >
                            <div className="list" style={{ gap: 6 }}>
                                {ticketList(c).map((ticket, idx) => (
                                    <div className="inline" key={idx} style={{ gap: 6 }}>
                                        <input
                                            className="inp grow"
                                            value={ticket}
                                            onChange={(e) => {
                                                const next = [...ticketList(c)];
                                                next[idx] = e.target.value;
                                                setTickets(next);
                                            }}
                                            placeholder="https://dev.azure.com/org/proj/_workitems/edit/123"
                                            style={!ticket.trim() && !ticketList(c).some((t) => t.trim()) ? { borderColor: 'var(--warn)' } : undefined}
                                        />
                                        {ticketList(c).length > 1 && (
                                            <button className="btn sm danger" type="button" onClick={() => setTickets(ticketList(c).filter((_, i) => i !== idx))}>
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button className="btn sm" type="button" onClick={() => setTickets([...ticketList(c), ''])}>
                                    + Another ticket
                                </button>
                            </div>
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
