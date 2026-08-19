// Renders a git-pulled catalogue file (see webapp/.assets/knowledge-base/imported/<name>/*.json)
// as browsable threat/countermeasure tables instead of a raw JSON dump.
import React, { useState } from 'react';
import { sortStride } from './common';

type CatalogueDoc = {
    name?: string;
    version?: string;
    maintainer?: string;
    description?: string;
    notice?: string;
    sources?: string[];
    threats?: any[];
    countermeasures?: any[];
};

function ExpandButton({ open, onClick }: { open: boolean; onClick: () => void }) {
    return (
        <button type="button" className="linkbtn" onClick={onClick} aria-expanded={open}>
            {open ? 'Hide' : 'Details'}
        </button>
    );
}

function ThreatsTable({ threats, docKey }: { threats: any[]; docKey: string }) {
    const [open, setOpen] = useState<Set<string>>(new Set());
    const toggle = (key: string) =>
        setOpen((s) => {
            const next = new Set(s);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    return (
        <table className="tbl">
            <thead>
                <tr>
                    <th>Key</th>
                    <th>Title</th>
                    <th>STRIDE</th>
                    <th>Applies to</th>
                    <th>Typ. impact</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                {threats.map((t) => {
                    const rowKey = `${docKey}:${t.key}`;
                    const isOpen = open.has(rowKey);
                    return (
                        <React.Fragment key={rowKey}>
                            <tr>
                                <td className="mono">{t.key}</td>
                                <td>{t.title}</td>
                                <td className="mono stride">{sortStride(t.stride || []).join('')}</td>
                                <td className="mono">{(t.appliesTo || []).join(', ')}</td>
                                <td>{t.typicalImpact ?? '—'}</td>
                                <td>
                                    <ExpandButton open={isOpen} onClick={() => toggle(rowKey)} />
                                </td>
                            </tr>
                            {isOpen && (
                                <tr className="rowdetail">
                                    <td colSpan={6}>
                                        {t.description && <p>{t.description}</p>}
                                        <div className="inline" style={{ flexWrap: 'wrap', gap: 6 }}>
                                            {t.emb3dId && <span className="tag">EMB3D {t.emb3dId}</span>}
                                            {t.category && <span className="tag">{t.category}</span>}
                                            {t.tier && <span className="tag">{t.tier}</span>}
                                            {(t.cwe || []).map((c: string) => (
                                                <span className="tag" key={c}>
                                                    {c}
                                                </span>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    );
                })}
            </tbody>
        </table>
    );
}

function CountermeasuresTable({ countermeasures, docKey }: { countermeasures: any[]; docKey: string }) {
    const [open, setOpen] = useState<Set<string>>(new Set());
    const toggle = (key: string) =>
        setOpen((s) => {
            const next = new Set(s);
            next.has(key) ? next.delete(key) : next.add(key);
            return next;
        });
    return (
        <table className="tbl">
            <thead>
                <tr>
                    <th>Key</th>
                    <th>Title</th>
                    <th>For</th>
                    <th>Maturity</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>
                {countermeasures.map((c) => {
                    const rowKey = `${docKey}:${c.key}`;
                    const isOpen = open.has(rowKey);
                    return (
                        <React.Fragment key={rowKey}>
                            <tr>
                                <td className="mono">{c.key}</td>
                                <td>{c.title}</td>
                                <td className="mono">{(c.for || []).join(', ')}</td>
                                <td>{c.maturity ?? '—'}</td>
                                <td>
                                    <ExpandButton open={isOpen} onClick={() => toggle(rowKey)} />
                                </td>
                            </tr>
                            {isOpen && (
                                <tr className="rowdetail">
                                    <td colSpan={5}>
                                        <div className="inline" style={{ flexWrap: 'wrap', gap: 6 }}>
                                            {c.emb3dId && <span className="tag">EMB3D {c.emb3dId}</span>}
                                            {c.iec62443 && <span className="tag">{c.iec62443}</span>}
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </React.Fragment>
                    );
                })}
            </tbody>
        </table>
    );
}

export default function ImportedCatalogue({
    name,
    files,
    onDelete,
    busy,
}: {
    name: string;
    files: Record<string, CatalogueDoc>;
    onDelete?: (name: string) => void;
    busy?: boolean;
}) {
    return (
        <>
            <div className="inline" style={{ justifyContent: 'space-between', alignItems: 'center', margin: '10px 0 -4px' }}>
                <h3 className="mono" style={{ margin: 0 }}>
                    {name}
                </h3>
                {onDelete && (
                    <button type="button" className="btn sm danger" onClick={() => onDelete(name)} disabled={busy}>
                        ✕ De-import
                    </button>
                )}
            </div>
            {Object.entries(files).map(([fileName, doc]) => {
                const docKey = `${name}/${fileName}`;
                const threats = doc?.threats || [];
                const countermeasures = doc?.countermeasures || [];
                return (
                    <div className="card" key={docKey}>
                        <h3>{doc?.name || fileName}</h3>
                        <p className="hint">
                            {doc?.version && <span className="tag">v{doc.version}</span>} {doc?.maintainer}
                        </p>
                        {doc?.description && <p>{doc.description}</p>}

                        {threats.length > 0 && (
                            <>
                                <h4>
                                    Threats <span className="badge">{threats.length}</span>
                                </h4>
                                <ThreatsTable threats={threats} docKey={docKey} />
                            </>
                        )}

                        {countermeasures.length > 0 && (
                            <>
                                <h4>
                                    Countermeasures <span className="badge">{countermeasures.length}</span>
                                </h4>
                                <CountermeasuresTable countermeasures={countermeasures} docKey={docKey} />
                            </>
                        )}

                        {!threats.length && !countermeasures.length && <p className="hint">No threats or countermeasures in this file.</p>}

                        {doc?.notice && (
                            <details>
                                <summary>License / attribution notice</summary>
                                <p className="hint">{doc.notice}</p>
                                {(doc.sources || []).length > 0 && (
                                    <ul className="hint">
                                        {doc.sources!.map((s) => (
                                            <li key={s}>{s}</li>
                                        ))}
                                    </ul>
                                )}
                            </details>
                        )}
                    </div>
                );
            })}
        </>
    );
}
