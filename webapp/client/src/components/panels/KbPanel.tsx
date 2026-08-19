// Browse the shared knowledge base: Bug Bar, risk scheme, the OT threat/countermeasure
// library, and any catalogues pulled from git. Read-only — the security unit owns the KB.
import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { Field, HelpButton, confirmDelete, sortStride } from '../common';
import BugBarTable from '../BugBarTable';
import ImportedCatalogue from '../ImportedCatalogue';

export default function KbPanel() {
    const data = useStore((s) => s.data);
    const save = useStore((s) => s.save);
    const refreshKb = useStore((s) => s.refreshKb);
    const p = data?.project;
    const setRepo = (patch: any) => p && save('project', { ...p, repo: { ...(p.repo || {}), ...patch } });

    const [kb, setKb] = useState<any>(null);
    const [tab, setTab] = useState<'bugbar' | 'library' | 'scheme' | 'imported'>('bugbar');
    const [pullMsg, setPullMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const loadFull = () =>
        fetch('/api/kb/full')
            .then((r) => r.json())
            .then(setKb)
            .catch(() => setKb({}));
    useEffect(() => {
        loadFull();
    }, []);

    const pullKb = async () => {
        setBusy(true);
        setPullMsg('Pulling knowledge base…');
        const r = await fetch('/api/kb/git/pull', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: p?.repo?.kbUrl }) })
            .then((x) => x.json())
            .catch(() => ({ ok: false, stderr: 'request failed' }));
        if (r.ok) {
            await refreshKb();
            await loadFull();
        }
        setPullMsg(r.ok ? `Knowledge base ${r.action === 'clone' ? 'cloned' : 'pulled'} → ${r.dest}. Reusable threats/countermeasures are now importable.` : `Pull failed: ${r.stderr || 'error'}`);
        setBusy(false);
    };

    const deleteCatalogue = async (name: string) => {
        if (!confirmDelete(`imported catalogue "${name}"`)) return;
        setBusy(true);
        setPullMsg(`Removing ${name}…`);
        const r = await fetch(`/api/kb/imported/${encodeURIComponent(name)}`, { method: 'DELETE' })
            .then((x) => x.json())
            .catch(() => ({ ok: false, stderr: 'request failed' }));
        if (r.ok) {
            await refreshKb();
            await loadFull();
        }
        setPullMsg(r.ok ? `Removed ${name}.` : `Remove failed: ${r.stderr || 'error'}`);
        setBusy(false);
    };

    const lib = kb?.library || {};
    const scheme = kb?.riskScheme || {};
    const imported = kb?.imported || [];

    return (
        <div className="panel" style={{ maxWidth: 1100 }}>
            <div className="panelhead">
                <h1>Knowledge base</h1>
                <HelpButton title="Knowledge base">
                    <ul>
                        <li>Shared reference data owned by the security team.</li>
                        <li>Pull a catalogue by git URL, or de-import one, from the <b>Imported</b> tab.</li>
                        <li>Reusable threats/countermeasures can be imported into a project from the Threats / Countermeasures steps.</li>
                    </ul>
                </HelpButton>
            </div>
            <p className="lead">Browse the shared threat, countermeasure, and risk references.</p>

            <div className="tabs">
                <button className={'tab' + (tab === 'bugbar' ? ' active' : '')} onClick={() => setTab('bugbar')}>
                    Bug Bar
                </button>
                <button className={'tab' + (tab === 'library' ? ' active' : '')} onClick={() => setTab('library')}>
                    Threat / CM library
                    <span className="badge">{(lib.threats?.length || 0) + (lib.countermeasures?.length || 0)}</span>
                </button>
                <button className={'tab' + (tab === 'scheme' ? ' active' : '')} onClick={() => setTab('scheme')}>
                    Risk scheme
                </button>
                <button className={'tab' + (tab === 'imported' ? ' active' : '')} onClick={() => setTab('imported')}>
                    Imported
                    <span className="badge">{imported.length}</span>
                </button>
            </div>

            {tab === 'bugbar' && (
                <div className="card">
                    <BugBarTable />
                </div>
            )}

            {tab === 'library' && (
                <>
                    <div className="card">
                        <h3>Threats</h3>
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Title</th>
                                    <th>STRIDE</th>
                                    <th>Applies to</th>
                                    <th>Typ. impact</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(lib.threats || []).map((t: any) => (
                                    <tr key={t.key}>
                                        <td className="mono">{t.key}</td>
                                        <td>{t.title}</td>
                                        <td className="mono">{sortStride(t.stride).join('')}</td>
                                        <td className="mono">{(t.appliesTo || []).join(', ')}</td>
                                        <td>{t.typicalImpact ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="card">
                        <h3>Countermeasures</h3>
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th>Key</th>
                                    <th>Title</th>
                                    <th>For</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(lib.countermeasures || []).map((c: any) => (
                                    <tr key={c.key}>
                                        <td className="mono">{c.key}</td>
                                        <td>{c.title}</td>
                                        <td className="mono">{(c.for || []).join(', ')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {tab === 'scheme' && (
                <div className="card">
                    <h3>Likelihood &amp; impact bands</h3>
                    <p className="hint">{scheme.description}</p>
                    <div className="inline" style={{ flexWrap: 'wrap', gap: 8 }}>
                        {(scheme.matrix?.bands || []).map((b: any) => (
                            <span key={b.name} className="pill" style={{ background: b.color }}>
                                {b.name} ({b.min}–{b.max})
                            </span>
                        ))}
                    </div>
                    <pre className="kbjson">{JSON.stringify(scheme.likelihood?.factorScale || scheme.likelihood || {}, null, 2)}</pre>
                </div>
            )}

            {tab === 'imported' && (
                <>
                    <div className="card">
                        <h3>Pull a catalogue</h3>
                        <div className="row">
                            <Field label="Knowledge base URL">
                                <input
                                    value={p?.repo?.kbUrl || ''}
                                    onChange={(e) => setRepo({ kbUrl: e.target.value })}
                                    placeholder="https://github.com/org/tra-knowledge-base.git"
                                    disabled={!p}
                                />
                            </Field>
                            <div className="field">
                                <label>Actions</label>
                                <div className="inline">
                                    <button className="btn sm" onClick={pullKb} disabled={busy || !p?.repo?.kbUrl}>
                                        ↓ Pull knowledge base
                                    </button>
                                </div>
                            </div>
                        </div>
                        {!p && <p className="hint">Open a project to pull a catalogue (the URL is stored per project).</p>}
                        {pullMsg && <p className="hint">{pullMsg}</p>}
                    </div>
                    {imported.length ? (
                        imported.map((cat: any) => <ImportedCatalogue key={cat.name} name={cat.name} files={cat.files || {}} onDelete={deleteCatalogue} busy={busy} />)
                    ) : (
                        <p className="hint">No imported catalogues.</p>
                    )}
                </>
            )}
        </div>
    );
}
