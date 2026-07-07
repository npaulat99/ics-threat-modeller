// Consolidated IEC 62443-4-1 / CRA overview: assets, interfaces, third-party software,
// threats and countermeasure status with the traceability links required for an audit.
import type React from 'react';
import { useStore } from '../../state/store';
import { riskOf } from '../../lib/risk';
import { Jump, HelpButton, RiskPill, sortStride } from '../common';

function Stat({ label, value, warn, onClick }: { label: string; value: number | string; warn?: boolean; onClick?: () => void }) {
    return (
        <div
            className={'stat' + (onClick ? ' clickable' : '')}
            {...(onClick ? { role: 'button', tabIndex: 0, onClick, onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) } : {})}
        >
            <div className={'statval' + (warn ? ' warn' : '')}>{value}</div>
            <div className="statlabel">{label}</div>
        </div>
    );
}

export default function DashboardPanel() {
    const data = useStore((s) => s.data)!;
    const scheme = useStore((s) => s.scheme);
    const setView = useStore((s) => s.setView);
    const sys = data.system;
    const project = data.project;
    const threats = data.threats.threats || [];
    const cms = data.countermeasures.countermeasures || [];
    const components = sys.components || [];
    const interfaces = sys.interfaces || [];
    const assets = sys.assets || [];
    const thirdParty = components.filter((c) => c.provenance && !/^own\b/i.test(c.provenance));
    const ticketsOf = (c: any) => (c.ticketUrls?.length ? c.ticketUrls : c.ticketUrl ? [c.ticketUrl] : []);
    const missingTicket = cms.filter((c) => (c.status === 'implemented' || c.status === 'verified') && !ticketsOf(c).length);
    const openThreats = threats.filter((t) => t.status === 'open');
    const reqs = data.requirements?.requirements || [];
    const defects = data.defects?.defects || [];
    const openDefects = defects.filter((d) => d.status !== 'fixed' && d.status !== 'wont-fix');
    const highNoReq = threats.filter((t) => (t.likelihood || 0) * (t.impact || 0) >= 12 && t.status !== 'accepted' && !reqs.some((r) => (r.derivedFromThreat || []).includes(t.id)));

    return (
        <div className="panel" style={{ maxWidth: 1140 }}>
            <div className="panelhead">
                <h1>Compliance dashboard</h1>
                <HelpButton title="IEC 62443-4-1 / CRA overview">
                    <ul>
                        <li>One traceable view of the secure-development evidence: assets, interfaces, third-party software, threats and control status.</li>
                        <li>Every <b>implemented / verified</b> countermeasure must carry a ticket link (proof) — missing ones are flagged red.</li>
                        <li>Click any ID to jump to its full record.</li>
                    </ul>
                </HelpButton>
            </div>
            <p className="lead">
                {project.device?.name || 'Device'} · SL-T {project.slTarget || '—'} · {project.scope?.mode || 'graybox'} · status {project.status || 'draft'}
            </p>

            <div className="dashgrid">
                <Stat label="Components" value={components.length} onClick={() => setView('system')} />
                <Stat label="3rd-party SW/HW" value={thirdParty.length} onClick={() => setView('system')} />
                <Stat label="Interfaces" value={interfaces.length} onClick={() => setView('system')} />
                <Stat label="Assets" value={assets.length} onClick={() => setView('system')} />
                <Stat label="Threats" value={threats.length} onClick={() => setView('threats')} />
                <Stat label="Open threats" value={openThreats.length} warn={openThreats.length > 0} onClick={() => setView('threats')} />
                <Stat label="Requirements" value={reqs.length} onClick={() => setView('requirements')} />
                <Stat label="High threats w/o req." value={highNoReq.length} warn={highNoReq.length > 0} onClick={() => setView('threats')} />
                <Stat label="Countermeasures" value={cms.length} onClick={() => setView('countermeasures')} />
                <Stat label="Missing ticket links" value={missingTicket.length} warn={missingTicket.length > 0} onClick={() => setView('countermeasures')} />
                <Stat label="Open defects" value={openDefects.length} warn={openDefects.length > 0} onClick={() => setView('defects')} />
            </div>

            <div className="card">
                <h3>Components &amp; third-party software</h3>
                <table className="tbl">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Kind</th>
                            <th>Version</th>
                            <th>Supplier</th>
                            <th>Provenance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {components.map((c) => (
                            <tr key={c.id}>
                                <td className="mono">{c.id}</td>
                                <td>{c.name}</td>
                                <td>{c.kind}</td>
                                <td>{c.version || '—'}</td>
                                <td>{c.supplier || '—'}</td>
                                <td>{c.provenance && !/^own/i.test(c.provenance) ? <span className="tag" style={{ color: 'var(--warn)' }}>{c.provenance}</span> : c.provenance || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="card">
                <h3>Interfaces</h3>
                <table className="tbl">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Exposure</th>
                            <th>Protocol</th>
                        </tr>
                    </thead>
                    <tbody>
                        {interfaces.map((c) => (
                            <tr key={c.id}>
                                <td className="mono">{c.id}</td>
                                <td>{c.name}</td>
                                <td>{c.category || '—'}</td>
                                <td>{c.exposure}</td>
                                <td>{c.protocol || '—'}</td>
                            </tr>
                        ))}
                        {!interfaces.length && (
                            <tr>
                                <td colSpan={5} className="hint">No interfaces.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="card">
                <h3>Assets</h3>
                <table className="tbl">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Stored in</th>
                            <th>C/I/A/S</th>
                        </tr>
                    </thead>
                    <tbody>
                        {assets.map((a) => (
                            <tr key={a.id}>
                                <td className="mono">
                                    <Jump view="system" id={a.id} />
                                </td>
                                <td>{a.name}</td>
                                <td>{a.storage || '—'}</td>
                                <td className="mono">
                                    {a.objectives?.confidentiality ?? 0}/{a.objectives?.integrity ?? 0}/{a.objectives?.availability ?? 0}/{a.objectives?.safety ?? 0}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="card">
                <h3>Threats</h3>
                <table className="tbl">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Threat</th>
                            <th>STRIDE</th>
                            <th>Initial</th>
                            <th>Residual</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {threats.map((t) => {
                            const r = riskOf(t, cms, scheme);
                            return (
                                <tr key={t.id}>
                                    <td className="mono">
                                        <Jump view="threats" id={t.id} />
                                    </td>
                                    <td>{t.title}</td>
                                    <td className="mono">{sortStride(t.stride).join('')}</td>
                                    <td>
                                        <RiskPill score={r.initial} band={r.initialBand} />
                                    </td>
                                    <td>
                                        <RiskPill score={r.residual} band={r.residualBand} />
                                    </td>
                                    <td style={{ textTransform: 'capitalize' }}>{t.status}</td>
                                </tr>
                            );
                        })}
                        {!threats.length && (
                            <tr>
                                <td colSpan={6} className="hint">No threats.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="card">
                <h3>Countermeasures &amp; implementation evidence</h3>
                <table className="tbl">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Countermeasure</th>
                            <th>Addresses</th>
                            <th>Status</th>
                            <th>Ticket</th>
                            <th>Verification</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cms.map((c) => {
                            const tickets = ticketsOf(c);
                            const needsTicket = (c.status === 'implemented' || c.status === 'verified') && !tickets.length;
                            return (
                                <tr key={c.id} style={needsTicket ? { background: 'rgba(239,108,0,0.08)' } : undefined}>
                                    <td className="mono">
                                        <Jump view="countermeasures" id={c.id} />
                                    </td>
                                    <td>{c.title}</td>
                                    <td className="mono">
                                        {(c.addresses || []).map((a) => (
                                            <Jump key={a.threat} view="threats" id={a.threat} />
                                        ))}
                                    </td>
                                    <td style={{ textTransform: 'capitalize' }}>{c.status}</td>
                                    <td>
                                        {tickets.length ? (
                                            tickets.map((ticket: string, idx: number) => (
                                                <a key={ticket + idx} className="linkbtn" href={ticket} target="_blank" rel="noreferrer" style={{ marginRight: 6 }}>
                                                    ticket {idx + 1} ↗
                                                </a>
                                            ))
                                        ) : needsTicket ? (
                                            <span style={{ color: 'var(--warn)' }}>required</span>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                    <td>
                                        {c.verificationUrl ? (
                                            <a className="linkbtn" href={c.verificationUrl} target="_blank" rel="noreferrer">
                                                evidence ↗
                                            </a>
                                        ) : (
                                            '—'
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {!cms.length && (
                            <tr>
                                <td colSpan={6} className="hint">No countermeasures.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="card">
                <h3>Security requirements (threat &rarr; requirement &rarr; control)</h3>
                <table className="tbl">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Requirement</th>
                            <th>Standard / SL·FR</th>
                            <th>From threats</th>
                            <th>Satisfied by</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reqs.map((r) => (
                            <tr key={r.id}>
                                <td className="mono">{r.id}</td>
                                <td>{r.text}</td>
                                <td>
                                    {r.standardRef || '—'}
                                    {r.slFr ? ` · ${r.slFr}` : ''}
                                </td>
                                <td className="mono">
                                    {(r.derivedFromThreat || []).map((th) => (
                                        <Jump key={th} view="threats" id={th} />
                                    ))}
                                </td>
                                <td className="mono">
                                    {(r.satisfiedByCM || []).map((cm) => (
                                        <Jump key={cm} view="countermeasures" id={cm} />
                                    ))}
                                </td>
                            </tr>
                        ))}
                        {!reqs.length && (
                            <tr>
                                <td colSpan={5} className="hint">No requirements yet.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
