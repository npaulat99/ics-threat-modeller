// Assistive workflow (rule-based, human-reviewed). Lists project documents dropped into
// projects/<id>/documents/ and proposes threats from the shared knowledge base that match the
// project model + document text. Nothing is applied automatically — the engineer accepts each.
import { useEffect, useState } from 'react';
import { useStore, uid } from '../../state/store';
import { HelpButton } from '../common';

interface Suggestion {
    key: string;
    title: string;
    stride: string[];
    typicalImpact?: number;
    appliesTo: string[];
    score: number;
}

export default function AssistantPanel() {
    const data = useStore((s) => s.data)!;
    const activeId = useStore((s) => s.activeId);
    const save = useStore((s) => s.save);
    const setView = useStore((s) => s.setView);
    const [docs, setDocs] = useState<{ name: string; size: number }[]>([]);
    const [sugg, setSugg] = useState<Suggestion[]>([]);
    const [loading, setLoading] = useState(false);

    const refresh = async () => {
        if (!activeId) return;
        setLoading(true);
        const [d, s] = await Promise.all([
            fetch(`/api/projects/${activeId}/documents`).then((r) => r.json()).catch(() => []),
            fetch(`/api/projects/${activeId}/suggest`, { method: 'POST' }).then((r) => r.json()).catch(() => ({ threats: [] })),
        ]);
        setDocs(d);
        setSugg(s.threats || []);
        setLoading(false);
    };
    useEffect(() => {
        refresh();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeId]);

    const add = (s: Suggestion) => {
        const threats = data.threats.threats || [];
        const t = {
            id: uid('T', threats.map((x) => x.id)),
            title: s.title,
            stride: s.stride || [],
            components: [],
            assets: [],
            likelihood: 3,
            impact: s.typicalImpact || 3,
            status: 'open',
        };
        save('threats', { threats: [...threats, t] });
        setSugg((prev) => prev.filter((x) => x.key !== s.key));
    };

    return (
        <div className="panel">
            <div className="panelhead">
                <h1>Assistant</h1>
                <HelpButton title="Assistive workflow (tips)">
                    <ul>
                        <li>Drop specifications, manuals or requirements into <code>projects/&lt;id&gt;/documents/</code>.</li>
                        <li>Suggestions come from your model, documents, and the shared knowledge base.</li>
                        <li>Nothing is added automatically.</li>
                    </ul>
                </HelpButton>
            </div>
            <p className="lead">
                Review suggested threats from project documents and the knowledge base.
            </p>

            <div className="card">
                <div className="toolbar">
                    <h3 style={{ margin: 0 }}>Project documents</h3>
                    <div className="right">
                        <button className="btn sm" onClick={refresh} disabled={loading}>
                            {loading ? 'Scanning…' : '↻ Rescan'}
                        </button>
                    </div>
                </div>
                {docs.length ? (
                    <ul>
                        {docs.map((d) => (
                            <li key={d.name}>
                                <a href={`/api/projects/${activeId}/documents/${encodeURIComponent(d.name)}`} target="_blank" rel="noreferrer">
                                    {d.name}
                                </a>{' '}
                                <span className="hint">({Math.round(d.size / 102.4) / 10} kB)</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="hint">
                        No documents found. Add files to <code>projects/{activeId}/documents/</code> and rescan.
                    </p>
                )}
            </div>

            <div className="card">
                <h3>Suggested threats from the knowledge base</h3>
                {sugg.length ? (
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>Suggested threat</th>
                                <th>STRIDE</th>
                                <th>Match</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sugg.map((s) => (
                                <tr key={s.key}>
                                    <td>{s.title}</td>
                                    <td className="mono">{(s.stride || []).join('')}</td>
                                    <td>{s.score}</td>
                                    <td>
                                        <button className="btn sm" onClick={() => add(s)}>
                                            + Add to threats
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="hint">No new suggestions.</p>
                )}
                <p className="hint" style={{ marginTop: 8 }}>
                    Added threats start unrated. Open{' '}
                    <button className="btn sm ghost" onClick={() => setView('threats')}>
                        Threats
                    </button>{' '}
                    to rate and link them.
                </p>
            </div>
        </div>
    );
}
