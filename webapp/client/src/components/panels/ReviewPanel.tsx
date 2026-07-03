import { useEffect, useState } from 'react';
import { useStore } from '../../state/store';
import { validate } from '../../lib/validate';
import { issueTarget } from '../../lib/ids';
import { riskOf } from '../../lib/risk';
import { RiskPill, sortStride } from '../common';

export default function ReviewPanel() {
    const data = useStore((s) => s.data)!;
    const scheme = useStore((s) => s.scheme);
    const report = useStore((s) => s.report);
    const activeId = useStore((s) => s.activeId);
    const goto = useStore((s) => s.goto);
    const issues = validate(data);
    const sbomMode = data.project?.sbom?.mode || 'in-tool';
    const sbomFormat = data.project?.sbom?.format || 'cyclonedx';
    const sbomUrl = data.project?.sbom?.url;
    const threats = data.threats.threats || [];
    const cms = data.countermeasures.countermeasures || [];
    const [html, setHtml] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (!html) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setHtml(null);
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [html]);

    const onReport = async () => {
        setBusy(true);
        const res = await report();
        setBusy(false);
        if (res?.html) setHtml(res.html);
    };
    const download = () => {
        if (!html) return;
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeId || 'tra'}-report.html`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="panel">
            <h1>Review &amp; report</h1>
            <p className="lead">
                The plausibility check runs continuously. Resolve any issues, then generate the standalone HTML report (also
                written, together with the machine-readable exports, into the <code>report/</code> folder in the project).
            </p>

            <div className="toolbar">
                <button className="btn primary" onClick={onReport} disabled={busy}>
                    {busy ? 'Generating…' : 'Generate report'}
                </button>
                {activeId && (
                    <span className="right">
                        <a className="btn sm" href={`/api/projects/${activeId}/export/traceability.csv`} target="_blank" rel="noreferrer">
                            ↓ Traceability CSV
                        </a>
                        <a className="btn sm" href={`/api/projects/${activeId}/export/traceability.json`} target="_blank" rel="noreferrer">
                            ↓ Traceability JSON
                        </a>
                        {sbomMode === 'external' ? (
                            sbomUrl ? (
                                <a className="btn sm" href={sbomUrl} target="_blank" rel="noreferrer">
                                    ↗ SBOM (external)
                                </a>
                            ) : null
                        ) : sbomFormat === 'spdx' ? (
                            <a className="btn sm" href={`/api/projects/${activeId}/export/sbom.spdx.json`} target="_blank" rel="noreferrer">
                                ↓ SBOM (SPDX)
                            </a>
                        ) : (
                            <a className="btn sm" href={`/api/projects/${activeId}/export/sbom.cdx.json`} target="_blank" rel="noreferrer">
                                ↓ SBOM (CycloneDX)
                            </a>
                        )}
                    </span>
                )}
                <span className={'tag ' + (issues.length ? 'warnmark' : '')}>{issues.length ? `${issues.length} open issue(s)` : 'No issues'}</span>
            </div>

            {html && (
                <div className="modal-overlay" onClick={() => setHtml(null)}>
                    <div className="modal" role="dialog" aria-modal="true" aria-label="Report preview" style={{ maxWidth: 1000, width: '100%' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modalhead">
                            <h3 style={{ margin: 0 }}>Report preview</h3>
                            <span className="inline">
                                <button className="btn sm" onClick={download}>
                                    ↓ Download HTML
                                </button>
                                <button className="btn sm" aria-label="Close" onClick={() => setHtml(null)}>
                                    ✕ Close
                                </button>
                            </span>
                        </div>
                        <iframe title="TRA report" srcDoc={html} style={{ width: '100%', height: '70vh', border: '1px solid var(--border)', borderRadius: 8, background: '#fff' }} />
                    </div>
                </div>
            )}

            <div className="card">
                <h3>Plausibility check</h3>
                <ul className="issues">
                    {issues.length === 0 ? (
                        <li className="ok">✓ No issues found — assumptions, references and ratings are consistent.</li>
                    ) : (
                        issues.map((it, i) => {
                            const tgt = issueTarget(data, it);
                            return (
                                <li key={i}>
                                    ⚠{' '}
                                    {tgt ? (
                                        <button className="issuelink" title={`Jump to ${tgt.id || tgt.view} to fix this`} onClick={() => goto(tgt.view, tgt.id)}>
                                            {it}
                                        </button>
                                    ) : (
                                        it
                                    )}
                                </li>
                            );
                        })
                    )}
                </ul>
            </div>

            <div className="card">
                <h3>Threats &amp; risk</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', color: 'var(--text-dim)', fontSize: 12 }}>
                            <th style={{ padding: 6 }}>ID</th>
                            <th style={{ padding: 6 }}>Threat</th>
                            <th style={{ padding: 6 }}>STRIDE</th>
                            <th style={{ padding: 6 }}>Initial</th>
                            <th style={{ padding: 6 }}>Residual</th>
                            <th style={{ padding: 6 }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {threats.map((t) => {
                            const r = riskOf(t, cms, scheme);
                            return (
                                <tr key={t.id} style={{ borderTop: '1px solid var(--border)' }}>
                                    <td style={{ padding: 6, fontFamily: 'ui-monospace, monospace' }}>{t.id}</td>
                                    <td style={{ padding: 6 }}>{t.title}</td>
                                    <td style={{ padding: 6 }} className="stride">
                                        {sortStride(t.stride).join('')}
                                    </td>
                                    <td style={{ padding: 6 }}>
                                        <RiskPill score={r.initial} band={r.initialBand} />
                                    </td>
                                    <td style={{ padding: 6 }}>
                                        <RiskPill score={r.residual} band={r.residualBand} />
                                    </td>
                                    <td style={{ padding: 6, textTransform: 'capitalize' }}>{t.status}</td>
                                </tr>
                            );
                        })}
                        {!threats.length && (
                            <tr>
                                <td colSpan={6} className="hint" style={{ padding: 10 }}>
                                    No threats defined yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
