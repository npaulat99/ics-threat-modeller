import { useStore, uid } from '../../state/store';
import { Field, Chips, STRIDE, sortStride, RiskPill, useFocus, useEditMode, EditBackBar, ScaleSelect, LIKELIHOOD_LEVELS, IMPACT_LEVELS, Jump, HelpButton, confirmDelete, IdInput } from '../common';
import { ID_PATTERN } from '../../lib/ids';
import { riskOf } from '../../lib/risk';
import { adId } from '../../lib/attackTree';
import RiskCalculator from './RiskCalculator';
import type { Threat } from '../../types';

export default function ThreatsPanel() {
    const data = useStore((s) => s.data)!;
    const scheme = useStore((s) => s.scheme);
    const kb = useStore((s) => s.kb);
    const save = useStore((s) => s.save);
    const setView = useStore((s) => s.setView);

    const threats = data.threats.threats || [];
    const cms = data.countermeasures.countermeasures || [];
    const focusId = useFocus('threats');
    const { editingId, setEditingId } = useEditMode(focusId);
    const cmsFor = (tid: string) => cms.filter((c) => (c.addresses || []).some((a) => a.threat === tid));
    const compOpts = (data.system.components || []).map((c) => ({ value: c.id, label: `${c.name}` }));
    const assetOpts = (data.system.assets || []).map((a) => ({ value: a.id, label: a.name }));
    const attackers = data.assumptions.attacker || [];
    const assumptionRows = [
        ...(data.assumptions.device || []).map((x) => ({ id: x.id, text: x.text || '', source: 'Device' })),
        ...(data.assumptions.system || []).map((x) => ({ id: x.id, text: x.text || '', source: 'System' })),
        ...(data.assumptions.environment || []).map((x) => ({ id: x.id, text: x.text || '', source: 'Environment' })),
        ...(data.assumptions.operational || []).map((x) => ({ id: x.id, text: x.text || '', source: 'Operational' })),
        ...(attackers || []).map((x) => ({ id: x.id, text: x.text || x.name || '', source: 'Attacker' })),
    ];
    const assumptionById = new Map(assumptionRows.map((x) => [x.id, x]));
    const assumptionOpts = assumptionRows.map((x) => ({ value: x.id, label: `${x.id} · ${x.source}${x.text ? ` · ${x.text.slice(0, 64)}` : ''}` }));

    const trees = data.attackTrees?.trees || [];
    const treeFor = (tid: string) => trees.find((x) => x.threatRef === tid);
    const makeTree = (t: Threat) => {
        if (!treeFor(t.id)) {
            const root = { id: adId(), kind: 'goal' as const, label: t.title, gate: 'OR' as const, children: [] };
            save('attackTrees', { trees: [...trees, { id: uid('AT', trees.map((x) => x.id)), title: t.title, threatRef: t.id, root }] });
        }
        setView('attackTrees');
    };

    const setThreats = (list: Threat[]) => save('threats', { threats: list });
    const add = () => {
        const id = uid('T', threats.map((t) => t.id));
        setThreats([...threats, { id, title: 'New threat', stride: ['T'], components: [], likelihood: 3, impact: 3, status: 'open' }]);
        setEditingId(id);
    };
    const importKb = (key: string) => {
        const k = (kb?.threats || []).find((x: any) => x.key === key);
        if (!k) return;
        const id = uid('T', threats.map((t) => t.id));
        setThreats([
            ...threats,
            {
                id,
                title: k.title,
                stride: sortStride(k.stride || ['T']),
                components: [],
                likelihood: 3,
                impact: k.typicalImpact || 3,
                status: 'open',
                description: `Imported from knowledge base (${k.key}). Assign affected components.`,
            },
        ]);
        setEditingId(id);
    };
    const editing = threats.find((t) => t.id === editingId) || null;

    const renderEditor = (t: Threat) => {
        const upd = (patch: any) => setThreats(threats.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
        const orphan = !(t.components || []).length;
        const ifaceOpts = (data.system.interfaces || []).map((itf) => ({ value: itf.id, label: `${itf.name}${itf.protocol ? ` (${itf.protocol})` : ''}` }));
        const interfaceRefs = t.interfaceRefs?.length ? t.interfaceRefs : t.interfaceRef && t.interfaceRef !== 'custom' ? [t.interfaceRef] : [];
        const setInterfaces = (next: string[]) => upd({ interfaceRefs: next, interfaceRef: next[0] || undefined });
        const splitByInterface = () => {
            if (interfaceRefs.length < 2 || t.interfaceLabel) return;
            const suffix = new Map((data.system.interfaces || []).map((itf) => [itf.id, itf.name]));
            const usedIds = [...threats.filter((x) => x.id !== t.id).map((x) => x.id)];
            const clones = interfaceRefs.map((ifaceId) => {
                const nextId = uid('T', usedIds);
                usedIds.push(nextId);
                return {
                    ...t,
                    id: nextId,
                    title: `${t.title} - ${suffix.get(ifaceId) || ifaceId}`,
                    interfaceRef: ifaceId,
                    interfaceRefs: [ifaceId],
                };
            });
            setThreats([...threats.filter((x) => x.id !== t.id), ...clones]);
            setEditingId(clones[0]?.id || null);
        };
        return (
            <div id={`f-threats-${t.id}`} className="itemcard" key={t.id} style={orphan ? { borderColor: '#f0c9a8' } : undefined}>
                <div className="head">
                    <IdInput id={t.id} onRename={setEditingId} />
                    <input className="inp grow" value={t.title} onChange={(e) => upd({ title: e.target.value })} />
                    <button className="btn sm danger" aria-label={`Delete threat ${t.id}`} onClick={() => confirmDelete(`threat ${t.id}`) && (setThreats(threats.filter((x) => x.id !== t.id)), setEditingId(null))}>
                        ✕
                    </button>
                </div>

                <div className="grid2">
                    <Field label="STRIDE">
                        <Chips options={STRIDE.map((s) => ({ value: s.k, label: `${s.k} · ${s.label}` }))} value={t.stride || []} onChange={(v) => upd({ stride: sortStride(v) })} />
                    </Field>
                    <div className="grid3">
                        <Field label="Likelihood">
                            <ScaleSelect value={t.likelihood} onChange={(n) => upd({ likelihood: n })} levels={LIKELIHOOD_LEVELS} />
                        </Field>
                        <Field label="Impact">
                            <ScaleSelect value={t.impact} onChange={(n) => upd({ impact: n })} levels={IMPACT_LEVELS} />
                        </Field>
                        <Field label="Status">
                            <select value={t.status || 'open'} onChange={(e) => upd({ status: e.target.value })}>
                                {['open', 'mitigated', 'accepted', 'transferred'].map((o) => (
                                    <option key={o}>{o}</option>
                                ))}
                            </select>
                        </Field>
                    </div>
                </div>

                <Field label="Affected components" hint={orphan ? 'A threat must affect at least one component.' : undefined}>
                    <Chips options={compOpts} value={t.components || []} onChange={(v) => upd({ components: v })} empty="Define components in step 03 first." />
                </Field>
                <details className="calc">
                    <summary>More details — assets, attacker, interface, rationale</summary>
                    <div className="grid3">
                        <Field label="Affected assets">
                            <Chips options={assetOpts} value={t.assets || []} onChange={(v) => upd({ assets: v })} empty="No assets yet." />
                        </Field>
                        <Field label="Attacker profile" hint="Used to ground likelihood.">
                            <select value={t.attackerRef || ''} onChange={(e) => upd({ attackerRef: e.target.value })}>
                                <option value="">— none —</option>
                                {attackers.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.name} (cap {a.capability}, {a.access})
                                    </option>
                                ))}
                            </select>
                        </Field>
                        <Field label="Affected interfaces / vectors" hint="Split by interface if the risk differs.">
                            <Chips options={ifaceOpts} value={interfaceRefs} onChange={setInterfaces} empty="No interfaces defined in step 03 yet." />
                            <input
                                className="inp"
                                style={{ marginTop: 6 }}
                                placeholder="Optional custom vector, e.g. over USB service port"
                                value={t.interfaceLabel || ''}
                                onChange={(e) => upd({ interfaceLabel: e.target.value || undefined })}
                            />
                            {interfaceRefs.length > 1 && !t.interfaceLabel && (
                                <button type="button" className="btn sm" style={{ marginTop: 6 }} onClick={splitByInterface}>
                                    Split into one threat per interface
                                </button>
                            )}
                        </Field>
                    </div>
                    <div className="grid2">
                        <Field label="Likelihood rationale">
                            <textarea value={t.likelihoodRationale || ''} onChange={(e) => upd({ likelihoodRationale: e.target.value })} />
                        </Field>
                        <Field label="Impact rationale">
                            <textarea value={t.impactRationale || ''} onChange={(e) => upd({ impactRationale: e.target.value })} />
                        </Field>
                    </div>
                    <Field label="Supporting assumptions" hint="Cite assumptions that justify feasibility or the chosen risk rating.">
                        <Chips options={assumptionOpts} value={t.assumptionRefs || []} onChange={(v) => upd({ assumptionRefs: v })} empty="No assumptions defined in step 02 yet." />
                        {(t.assumptionRefs || []).length ? (
                            <ul style={{ margin: '8px 0 0 18px' }}>
                                {(t.assumptionRefs || []).map((aid) => {
                                    const ref = assumptionById.get(aid);
                                    const validId = ID_PATTERN.test(aid);
                                    if (!validId) return <li key={aid}><b>{aid}</b> · invalid ID format</li>;
                                    if (!ref) return <li key={aid}><b>{aid}</b> · assumption not found</li>;
                                    return <li key={aid}><b>{aid}</b> ({ref.source}) · {ref.text || 'No detail text'}</li>;
                                })}
                            </ul>
                        ) : null}
                    </Field>
                </details>
                <RiskCalculator t={t} upd={upd} />
                {t.status === 'accepted' && (
                    <div className="grid3" style={{ marginTop: 8 }}>
                        <Field label="Accepted by" hint="Residual-risk sign-off owner.">
                            <input value={t.acceptedBy || ''} onChange={(e) => upd({ acceptedBy: e.target.value })} placeholder="name / role" />
                        </Field>
                        <Field label="Acceptance rationale" hint="Why the residual risk is acceptable.">
                            <input value={t.acceptanceRationale || ''} onChange={(e) => upd({ acceptanceRationale: e.target.value })} placeholder="e.g. compensating controls in the plant" />
                        </Field>
                        <Field label="Next review date" hint="Next reassessment date.">
                            <input type="date" value={t.reviewDate || ''} onChange={(e) => upd({ reviewDate: e.target.value })} />
                        </Field>
                    </div>
                )}
                <div className="inline" style={{ marginTop: 8, flexWrap: 'wrap', gap: 6 }}>
                    <button className="btn sm" onClick={() => makeTree(t)}>
                        {treeFor(t.id) ? 'Open attack tree →' : '+ Attack tree for this threat'}
                    </button>
                    <span className="hint" style={{ marginLeft: 8 }}>Mitigated by:</span>
                    {cmsFor(t.id).length ? (
                        cmsFor(t.id).map((c) => <Jump key={c.id} view="countermeasures" id={c.id} label={`${c.id} · ${c.title}`.slice(0, 26)} />)
                    ) : (
                        <span className="hint">none</span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="panel">
            <div className="panelhead">
                <h1>Threats &amp; risk</h1>
                <HelpButton title="Threat identification (tips)">
                    <ul>
                        <li>Walk each <b>interface and trust-boundary crossing</b> with STRIDE; flows that cross a boundary are the hot-spots.</li>
                        <li>Keep it proportionate: around <b>~5 substantive threats per interface</b> is usually enough.</li>
                        <li>Prefer the <b>knowledge base</b> for common OT threats; write attack trees only for the few complex multi-step paths.</li>
                        <li>Attach every threat to at least one component, set the <b>primary interface</b>, and ground likelihood in an attacker profile.</li>
                    </ul>
                </HelpButton>
            </div>
            <p className="lead">
                Enumerate STRIDE threats and link each one to the affected components and assets.
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
                            + Threat
                        </button>
                        {kb?.threats?.length ? (
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
                                {kb.threats.map((k: any) => (
                                    <option key={k.key} value={k.key}>
                                        {k.title}
                                    </option>
                                ))}
                            </select>
                        ) : null}
                    </div>

                    <div className="list">
                        {threats.map((t) => {
                            const r = riskOf(t, cms, scheme);
                            const orphan = !(t.components || []).length;
                            return (
                                <div id={`f-threats-${t.id}`} className={'itemcard collapsed' + (focusId === t.id ? ' focused' : '')} key={t.id} style={orphan ? { borderColor: '#f0c9a8' } : undefined}>
                                    <div className="head">
                                        <span className="summary-id">{t.id}</span>
                                        <span className="summary-title">{t.title}</span>
                                        <RiskPill score={r.initial} band={r.initialBand} title="Initial risk" />
                                        <span className="muted">→</span>
                                        <RiskPill score={r.residual} band={r.residualBand} title="Residual risk" />
                                        <button className="btn sm" onClick={() => setEditingId(t.id)}>
                                            Edit
                                        </button>
                                        <button className="btn sm danger" aria-label={`Delete threat ${t.id}`} onClick={() => confirmDelete(`threat ${t.id}`) && setThreats(threats.filter((x) => x.id !== t.id))}>
                                            ✕
                                        </button>
                                    </div>
                                    <div className="summary-links">
                                        {(t.stride || []).length ? <span className="tag stride">{sortStride(t.stride).join(' ')}</span> : null}
                                        {(t.assumptionRefs || []).length ? <span className="tag">Assumptions: {t.assumptionRefs.join(', ')}</span> : null}
                                        <span className="lbl">Mitigated by:</span>
                                        {cmsFor(t.id).length ? cmsFor(t.id).map((c) => <Jump key={c.id} view="countermeasures" id={c.id} />) : <span className="hint">none</span>}
                                        {(t.assets || []).length ? (
                                            <>
                                                <span className="lbl">Assets:</span>
                                                {(t.assets || []).map((aid) => (
                                                    <Jump key={aid} view="system" id={aid} />
                                                ))}
                                            </>
                                        ) : null}
                                    </div>
                                </div>
                            );
                        })}
                        {!threats.length && <p className="hint">No threats yet.</p>}
                    </div>
                </>
            )}
        </div>
    );
}
