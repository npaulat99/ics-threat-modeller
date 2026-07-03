import { useState } from 'react';
import { useStore } from '../../state/store';
import { Field, HelpButton, confirmDelete } from '../common';

const DEPTH_HELP: Record<string, string> = {
    blackbox:
        'Black-box: model the device as a single unit and analyse only its external interfaces. Fastest; suited to integrators and asset owners.',
    graybox:
        'Gray-box: also model the security-relevant internal components (MCU, bootloader, communication stacks). Recommended default for component suppliers.',
    whitebox:
        'White-box: model the full internals, including firmware and debug interfaces. Most thorough; mind the state-space explosion on complex devices.',
};

/** Add/remove list of short free-text items shown as removable chips (type + Enter to add). */
function ScopeList({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
    const [draft, setDraft] = useState('');
    const add = () => {
        const v = draft.trim();
        setDraft('');
        if (v && !items.includes(v)) onChange([...items, v]);
    };
    return (
        <div>
            <div className="chips" style={{ minHeight: 26 }}>
                {items.length ? (
                    items.map((it, i) => (
                        <span className="chip on" key={i}>
                            {it}
                            <button className="chipx" aria-label={`Remove ${it}`} onClick={() => onChange(items.filter((_, j) => j !== i))}>
                                ✕
                            </button>
                        </span>
                    ))
                ) : (
                    <span className="hint">Nothing yet.</span>
                )}
            </div>
            <div className="inline" style={{ marginTop: 6 }}>
                <input
                    className="inp grow"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            add();
                        }
                    }}
                    placeholder={placeholder}
                />
                <button className="btn sm" disabled={!draft.trim()} onClick={add}>
                    + Add
                </button>
            </div>
        </div>
    );
}

export default function ProjectPanel() {
    const data = useStore((s) => s.data)!;
    const save = useStore((s) => s.save);
    const activeId = useStore((s) => s.activeId);
    const refreshKb = useStore((s) => s.refreshKb);
    const p = data.project;
    const set = (patch: any) => save('project', { ...p, ...patch });
    const setDevice = (patch: any) => set({ device: { ...(p.device || {}), ...patch } });
    const setScope = (patch: any) => set({ scope: { ...(p.scope || {}), ...patch } });
    const setRepo = (patch: any) => set({ repo: { ...(p.repo || {}), ...patch } });
    const setSbom = (patch: any) => set({ sbom: { ...(p.sbom || {}), ...patch } });
    const [git, setGit] = useState('');

    const pullKb = async () => {
        setGit('Pulling knowledge base…');
        const r = await fetch('/api/kb/git/pull', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: p.repo?.kbUrl }) })
            .then((x) => x.json())
            .catch(() => ({ ok: false, stderr: 'request failed' }));
        if (r.ok) await refreshKb();
        setGit(r.ok ? `Knowledge base ${r.action === 'clone' ? 'cloned' : 'pulled'} → ${r.dest}. Reusable threats/countermeasures are now importable.` : `Pull failed: ${r.stderr || 'error'}`);
    };
    const commit = async () => {
        if (!activeId) return;
        const msg = window.prompt('Commit message:', `TRA ${p.title || ''}`.trim());
        if (msg === null) return;
        setGit('Committing project…');
        const r = await fetch(`/api/projects/${activeId}/git/commit`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: msg }) })
            .then((x) => x.json())
            .catch(() => ({ ok: false, stderr: 'request failed' }));
        setGit(r.ok ? (r.committed ? 'Committed.' : r.note || 'Nothing to commit.') : `Commit failed: ${r.stderr || 'error'}`);
    };

    return (
        <div className="panel">
            <div className="panelhead">
                <h1>Project</h1>
                <HelpButton title="Project &amp; scope (tips)">
                    <ul>
                        <li>State the <b>boundary in one sentence</b>. Everything outside it is an external entity.</li>
                        <li>Pick the <b>smallest modelling depth</b> that answers your question — black-box first, refine only where it adds value. Deep white-box trees of every signal cause state-space explosion.</li>
                        <li><b>Group assets</b> sensibly (one “measurement integrity” asset, not one per value) and reuse template TRAs for similar devices.</li>
                        <li>CRA requires the <b>intended purpose</b> and the <b>reasonably foreseeable use</b> to be documented — fill them in below.</li>
                    </ul>
                </HelpButton>
            </div>
            <p className="lead">
                Define <em>what</em> you are assessing and <em>how deeply</em>. A precise boundary and an appropriate
                modelling depth keep the assessment focused, reproducible and proportionate to the device.
            </p>

            <div className="card">
                <h3>Device under assessment</h3>
                <Field label="Project title">
                    <input value={p.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder="TRA: …" />
                </Field>
                <div className="row">
                    <Field label="Device name">
                        <input value={p.device?.name || ''} onChange={(e) => setDevice({ name: e.target.value })} placeholder="RadarLevel RL-100" />
                    </Field>
                    <Field label="Device type">
                        <input value={p.device?.type || ''} onChange={(e) => setDevice({ type: e.target.value })} placeholder="radar level sensor" />
                    </Field>
                    <Field label="Version under assessment" hint="Hardware / firmware revision.">
                        <input value={p.device?.version || ''} onChange={(e) => setDevice({ version: e.target.value })} placeholder="FW 2.4 / HW B" />
                    </Field>
                </div>
            </div>

            <div className="card">
                <h3>Scope &amp; modelling depth</h3>
                <div className="row">
                    <Field
                        label="Modelling depth"
                        hint="Sets how far inside the device you model. It guides the DFD drill-down and is recorded in the report."
                    >
                        <select value={p.scope?.mode || 'graybox'} onChange={(e) => setScope({ mode: e.target.value })}>
                            <option value="blackbox">Black-box — external interfaces only</option>
                            <option value="graybox">Gray-box — key internal components</option>
                            <option value="whitebox">White-box — full internals</option>
                        </select>
                    </Field>
                    <Field label="Target Security Level" hint="IEC 62443-4-2 target (SL-T), e.g. SL2.">
                        <input value={p.slTarget || ''} onChange={(e) => set({ slTarget: e.target.value })} placeholder="SL2" />
                    </Field>
                    <Field label="Status">
                        <select value={p.status || 'draft'} onChange={(e) => set({ status: e.target.value })}>
                            {['draft', 'in-progress', 'review', 'released'].map((o) => (
                                <option key={o}>{o}</option>
                            ))}
                        </select>
                    </Field>
                </div>
                <p className="depthnote">{DEPTH_HELP[p.scope?.mode || 'graybox']}</p>
                <label className="inline" style={{ gap: 7, margin: '2px 0 8px', alignItems: 'flex-start' }}>
                    <input type="checkbox" checked={!!p.rigorousMode} onChange={(e) => set({ rigorousMode: e.target.checked })} style={{ marginTop: 3 }} />
                    <span className="hint">
                        <b>Rigorous mode</b> — require the Bug Bar impact dimensions, the exposure / exploitability factors and a
                        named rater on every threat (improves reproducibility &amp; inter-rater reliability).
                    </span>
                </label>
                <Field
                    label="System boundary"
                    hint="One sentence: what is the device under assessment and where does it end? Surfaced in the report."
                >
                    <textarea
                        value={p.scope?.boundary || ''}
                        onChange={(e) => setScope({ boundary: e.target.value })}
                        placeholder="The sensor enclosure and all its interfaces; the plant DCS and engineering laptop are external entities."
                    />
                </Field>
                <div className="grid2">
                    <Field label="In scope" hint="Listed in the report. Type an item and press Enter.">
                        <ScopeList items={p.scope?.inScope || []} onChange={(v) => setScope({ inScope: v })} placeholder="e.g. sensor firmware" />
                    </Field>
                    <Field label="Out of scope" hint="Listed in the report. Type an item and press Enter.">
                        <ScopeList items={p.scope?.outOfScope || []} onChange={(v) => setScope({ outOfScope: v })} placeholder="e.g. plant DCS" />
                    </Field>
                </div>
            </div>

            <div className="card">
                <h3>Software Bill of Materials (SBOM)</h3>
                <p className="hint" style={{ marginTop: 0 }}>
                    Choose how the SBOM is provided. In-tool generation builds it from the component metadata (version,
                    supplier, license, CPE) recorded on the System page.
                </p>
                <div className="row">
                    <Field label="SBOM source">
                        <select value={p.sbom?.mode || 'in-tool'} onChange={(e) => setSbom({ mode: e.target.value })}>
                            <option value="in-tool">Generate in-tool from component metadata</option>
                            <option value="external">External — link to an existing SBOM</option>
                        </select>
                    </Field>
                    {(p.sbom?.mode || 'in-tool') === 'in-tool' ? (
                        <Field label="Format" hint="Included in the report and available as an export.">
                            <select value={p.sbom?.format || 'cyclonedx'} onChange={(e) => setSbom({ format: e.target.value })}>
                                <option value="cyclonedx">CycloneDX 1.5 (JSON)</option>
                                <option value="spdx">SPDX 2.3 (JSON)</option>
                            </select>
                        </Field>
                    ) : (
                        <Field label="External SBOM URL" hint="The report links here; in-tool generation is disabled.">
                            <input value={p.sbom?.url || ''} onChange={(e) => setSbom({ url: e.target.value })} placeholder="https://…/device-sbom.cdx.json" />
                        </Field>
                    )}
                </div>
            </div>

            <div className="card">
                <h3>Intended purpose &amp; reasonably foreseeable use <span className="hint">(CRA)</span></h3>
                <Field label="Intended purpose" hint="The manufacturer's intended purpose and operating conditions of the product.">
                    <textarea
                        value={p.intendedUse || ''}
                        onChange={(e) => set({ intendedUse: e.target.value })}
                        placeholder="Continuous, non-contact level measurement of liquids in fixed process tanks; may drive an overfill-protection function."
                    />
                </Field>
                <div className="field">
                    <label>
                        Reasonably foreseeable use <span className="hint">— one box per scenario; required by the CRA risk assessment</span>
                    </label>
                    <div className="list">
                        {(p.foreseeableUse || []).map((m, i) => (
                            <div className="inline" key={i} style={{ gap: 6, alignItems: 'flex-start' }}>
                                <textarea
                                    className="inp grow"
                                    value={m}
                                    onChange={(e) => {
                                        const next = [...(p.foreseeableUse || [])];
                                        next[i] = e.target.value;
                                        set({ foreseeableUse: next });
                                    }}
                                    placeholder="e.g. Bluetooth commissioning left enabled with the default passcode in production"
                                />
                                <button
                                    className="btn sm danger"
                                    title="Remove scenario"
                                    aria-label="Remove use scenario"
                                    onClick={() => confirmDelete('this use scenario') && set({ foreseeableUse: (p.foreseeableUse || []).filter((_, j) => j !== i) })}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                        {!(p.foreseeableUse || []).length && <p className="hint">No use scenarios yet — add the first one.</p>}
                    </div>
                    <button className="btn sm" style={{ marginTop: 6 }} onClick={() => set({ foreseeableUse: [...(p.foreseeableUse || []), ''] })}>
                        + Add scenario
                    </button>
                </div>
            </div>

            <div className="card">
                <h3>Repository &amp; traceability</h3>
                <Field label="Project branch / PR link" hint="Link to this TRA's branch or pull request in DevOps/GitHub.">
                    <input value={p.repo?.projectBranchUrl || ''} onChange={(e) => setRepo({ projectBranchUrl: e.target.value })} placeholder="https://dev.azure.com/org/proj/_git/repo?version=GBtra/rl-100" />
                </Field>
                <div className="grid2">
                    <Field label="Knowledge base git URL (pull-only)" hint="Shared, security-unit-owned KB. The app only pulls it — it never pushes. A local path or file:// URL also works (e.g. the bundled tra-demo-library).">
                        <input value={p.repo?.kbUrl || ''} onChange={(e) => setRepo({ kbUrl: e.target.value })} placeholder="https://github.com/org/tra-knowledge-base.git" />
                    </Field>
                    <div className="field">
                        <label>Actions</label>
                        <div className="inline">
                            <button className="btn sm" onClick={pullKb} disabled={!p.repo?.kbUrl}>
                                ↓ Pull knowledge base
                            </button>
                            <button className="btn sm" onClick={commit}>
                                Commit project
                            </button>
                        </div>
                    </div>
                </div>
                {git && <p className="hint" style={{ marginTop: 4 }}>{git}</p>}
            </div>
        </div>
    );
}
