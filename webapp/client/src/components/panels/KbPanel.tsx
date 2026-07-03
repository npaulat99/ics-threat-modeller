// Browse the shared knowledge base: Bug Bar, risk scheme, the OT threat/countermeasure
// library, and any catalogues pulled from git. Read-only — the security unit owns the KB.
import { useEffect, useState } from 'react';
import { HelpButton, sortStride } from '../common';
import BugBarTable from '../BugBarTable';

export default function KbPanel() {
    const [kb, setKb] = useState<any>(null);
    const [tab, setTab] = useState<'bugbar' | 'library' | 'scheme' | 'imported'>('bugbar');
    useEffect(() => {
        fetch('/api/kb/full')
            .then((r) => r.json())
            .then(setKb)
            .catch(() => setKb({}));
    }, []);

    const lib = kb?.library || {};
    const scheme = kb?.riskScheme || {};
    const imported = kb?.imported || [];

    return (
        <div className="panel" style={{ maxWidth: 1100 }}>
            <div className="panelhead">
                <h1>Knowledge base</h1>
                <HelpButton title="Knowledge base">
                    <ul>
                        <li>Shared, security-unit-owned reference data. The app <b>pulls</b> it from git but never pushes — only the security unit changes it.</li>
                        <li>Add the KB git URL and pull it from <b>Project → Repository</b>.</li>
                        <li>Reusable threats/countermeasures can be imported into a project from the Threats / Countermeasures steps.</li>
                    </ul>
                </HelpButton>
            </div>
            <p className="lead">Browse the company-shared knowledge base used to rate and enumerate consistently across the department.</p>

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

            {tab === 'imported' &&
                (imported.length ? (
                    imported.map((cat: any) => (
                        <div className="card" key={cat.name}>
                            <h3>{cat.name}</h3>
                            {Object.keys(cat.files || {}).map((f) => (
                                <details key={f}>
                                    <summary>{f}</summary>
                                    <pre className="kbjson">{JSON.stringify(cat.files[f], null, 2)}</pre>
                                </details>
                            ))}
                        </div>
                    ))
                ) : (
                    <p className="hint">No imported catalogues. Add a knowledge-base git URL on the Project page and pull it.</p>
                ))}
        </div>
    );
}
