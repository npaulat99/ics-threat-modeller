import { useState } from 'react';
import { useStore, uid } from '../../state/store';
import { Field, HelpButton, confirmDelete, IdInput, ScaleSelect, CAPABILITY_LEVELS } from '../common';
import type { Assumption, AttackerProfile } from '../../types';

const CATS: { key: 'device' | 'system' | 'environment' | 'operational'; label: string; help: string }[] = [
    { key: 'device', label: 'Device', help: 'Secure boot, debug ports, hardware roots of trust…' },
    { key: 'system', label: 'System', help: 'How the device sits in the wider system / safety chain.' },
    { key: 'environment', label: 'Environment', help: 'Physical access, wireless range, network exposure.' },
    { key: 'operational', label: 'Operational', help: 'Default passwords, update cadence, lifetime.' },
];

const ASSUMPTION_PREFIX: Record<typeof CATS[number]['key'], string> = {
    device: 'AD-',
    system: 'SYSA-',
    environment: 'AE-',
    operational: 'AO-',
};

type TabKey = 'overview' | 'attacker' | 'device' | 'system' | 'environment' | 'operational';

export default function AssumptionsPanel() {
    const data = useStore((s) => s.data)!;
    const save = useStore((s) => s.save);
    const a = data.assumptions;
    const [tab, setTab] = useState<TabKey>('overview');
    const set = (patch: any) => save('assumptions', { ...a, ...patch });

    const setList = (key: typeof CATS[number]['key'], list: Assumption[]) => set({ [key]: list });
    const addAssumption = (key: typeof CATS[number]['key']) => {
        const list = a[key] || [];
        setList(key, [...list, { id: uid(ASSUMPTION_PREFIX[key], list.map((x) => x.id)), text: '' }]);
    };
    const setAttacker = (list: AttackerProfile[]) => set({ attacker: list });
    const addAttacker = () =>
        setAttacker([
            ...(a.attacker || []),
            { id: uid('ATK-', (a.attacker || []).map((x) => x.id)), name: 'New attacker', capability: 2, access: 'local', motivation: '', text: '' },
        ]);

    const attackerCard = (
        <div className="card" key="attacker">
            <div className="toolbar">
                <h3 style={{ margin: 0 }}>Attacker profiles</h3>
                <div className="right">
                    <button className="btn sm primary" onClick={addAttacker}>
                        + Attacker
                    </button>
                </div>
            </div>
            {!(a.attacker || []).length && <p className="hint">At least one attacker profile is required.</p>}
            <div className="list">
                {(a.attacker || []).map((p, i) => {
                    const upd = (patch: any) => setAttacker(a.attacker.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                        <div className="itemcard" key={i}>
                            <div className="head">
                                <IdInput id={p.id} />
                                <input className="inp grow" value={p.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Profile name" />
                                <button className="btn sm danger" aria-label="Delete attacker profile" onClick={() => confirmDelete('this attacker profile') && setAttacker(a.attacker.filter((_, j) => j !== i))}>
                                    ✕
                                </button>
                            </div>
                            <div className="grid4">
                                <Field label="Capability">
                                    <ScaleSelect value={p.capability} onChange={(n) => upd({ capability: n })} levels={CAPABILITY_LEVELS} />
                                </Field>
                                <Field label="Access">
                                    <select value={p.access} onChange={(e) => upd({ access: e.target.value })}>
                                        {['remote', 'adjacent', 'local', 'physical'].map((o) => (
                                            <option key={o}>{o}</option>
                                        ))}
                                    </select>
                                </Field>
                                <Field label="Motivation">
                                    <input value={p.motivation || ''} onChange={(e) => upd({ motivation: e.target.value })} />
                                </Field>
                                <Field label="Resources">
                                    <input value={p.resources || ''} onChange={(e) => upd({ resources: e.target.value })} />
                                </Field>
                            </div>
                            <Field label="Description">
                                <textarea value={p.text || ''} onChange={(e) => upd({ text: e.target.value })} />
                            </Field>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const catCard = (cat: typeof CATS[number]) => (
        <div className="card" key={cat.key}>
            <div className="toolbar">
                <h3 style={{ margin: 0 }}>{cat.label} assumptions</h3>
                <div className="right">
                    <button className="btn sm" onClick={() => addAssumption(cat.key)}>
                        + Add
                    </button>
                </div>
            </div>
            <p className="hint" style={{ marginTop: 0 }}>
                {cat.help}
            </p>
            <div className="list">
                {(a[cat.key] || []).map((item, i) => {
                    const list = a[cat.key];
                    const upd = (patch: any) => setList(cat.key, list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                    return (
                        <div className="itemcard" key={i}>
                            <div className="head" style={{ alignItems: 'flex-start' }}>
                                <IdInput id={item.id} />
                                <textarea className="inp grow" rows={2} value={item.text} onChange={(e) => upd({ text: e.target.value })} placeholder="Assumption text (wraps to fit)" />
                                <button className="btn sm danger" aria-label="Delete assumption" onClick={() => confirmDelete('this assumption') && setList(cat.key, list.filter((_, j) => j !== i))}>
                                    ✕
                                </button>
                            </div>
                        </div>
                    );
                })}
                {!(a[cat.key] || []).length && <p className="hint">No assumptions yet.</p>}
            </div>
        </div>
    );

    const total = (a.attacker?.length || 0) + CATS.reduce((s, c) => s + (a[c.key]?.length || 0), 0);
    const tabs: { key: TabKey; label: string; count: number }[] = [
        { key: 'overview', label: 'Overview', count: total },
        { key: 'attacker', label: 'Attacker', count: a.attacker?.length || 0 },
        ...CATS.map((c) => ({ key: c.key as TabKey, label: c.label, count: a[c.key]?.length || 0 })),
    ];

    return (
        <div className="panel">
            <div className="panelhead">
                <h1>Assumptions</h1>
                <HelpButton title="Assumptions (tips)">
                    <ul>
                        <li><b>Attacker profiles are mandatory</b> — capability and access feed the likelihood rubric.</li>
                        <li>Be explicit about the awkward truths: default passwords left in place, 15–20 year lifetime, rare firmware updates.</li>
                        <li>Separate <b>device</b> (what the product guarantees), <b>system</b> (its role in the plant/safety chain), <b>environment</b> (physical/network exposure) and <b>operational</b> (how it is run).</li>
                    </ul>
                </HelpButton>
            </div>
            <p className="lead">
                Record the assumptions behind the assessment.
            </p>

            <div className="tabs">
                {tabs.map((t) => (
                    <button key={t.key} className={'tab' + (tab === t.key ? ' active' : '')} onClick={() => setTab(t.key)}>
                        {t.label}
                        <span className="badge">{t.count}</span>
                    </button>
                ))}
            </div>

            {(tab === 'overview' || tab === 'attacker') && attackerCard}
            {CATS.filter((c) => tab === 'overview' || tab === c.key).map(catCard)}
        </div>
    );
}
