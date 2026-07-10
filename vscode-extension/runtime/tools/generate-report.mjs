#!/usr/bin/env node
// TRA report generator: zero external dependencies. Loads a TRA project folder,
// computes initial and residual risk, runs the plausibility checker, and writes report/index.html.
// Usage: node tools/generate-report.mjs projects/example-radar-level-sensor
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { isAbsolute, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const proj = process.argv[2] || "projects/example-radar-level-sensor";
const base = isAbsolute(proj) ? proj : join(root, proj);
const read = (p) => JSON.parse(readFileSync(join(base, p), "utf8"));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const scheme = JSON.parse(readFileSync(join(root, ".assets/knowledge-base/risk-scheme.json"), "utf8"));

const project = read("01-project-description/project.json");
const ass = read(project.steps["02-assumptions"]);
const sys = read(project.steps["03-system-assets"]);
const threats = read(project.steps["06-threats"]).threats;
const cms = read(project.steps["08-countermeasures"]).countermeasures;
let reqs = [];
try { reqs = read(project.steps["05-requirements"]).requirements || []; } catch { }

const band = (r) => scheme.matrix.bands.find((b) => r >= b.min && r <= b.max) || scheme.matrix.bands[0];
const residual = (t) => {
  const links = cms.flatMap((c) => c.addresses.filter((a) => a.threat === t.id));
  if (!links.length) return { l: t.likelihood, i: t.impact };
  return { l: Math.min(...links.map((a) => a.residualLikelihood ?? t.likelihood)), i: Math.min(...links.map((a) => a.residualImpact ?? t.impact)) };
};

// Plausibility checker
const ids = new Set(sys.components.map((c) => c.id));
const tids = new Set(threats.map((t) => t.id));
const issues = [];
if (!ass.attacker?.length) issues.push("No attacker assumptions (required for likelihood).");
threats.forEach((t) => {
  if (!t.likelihood || !t.impact) issues.push(`${t.id}: missing risk rating.`);
  if (!t.components?.length) issues.push(`${t.id}: orphaned threat (no component).`);
  t.components?.forEach((c) => { if (!ids.has(c)) issues.push(`${t.id}: references unknown component ${c}.`); });
});
cms.forEach((c) => c.addresses.forEach((a) => { if (!tids.has(a.threat)) issues.push(`${c.id}: addresses unknown threat ${a.threat}.`); }));

const rows = threats.map((t) => {
  const r = t.likelihood * t.impact, rr = residual(t), rrv = rr.l * rr.i;
  return `<tr><td>${esc(t.id)}</td><td>${esc(t.title)}</td><td>${esc((t.stride || []).join(''))}</td>` +
    `<td>${t.likelihood}×${t.impact}=<b style="color:${band(r).color}">${r} ${esc(band(r).name)}</b></td>` +
    `<td>${rr.l}×${rr.i}=<b style="color:${band(rrv).color}">${rrv} ${esc(band(rrv).name)}</b></td>` +
    `<td>${esc(t.status || 'open')}${t.status === 'accepted' && t.acceptedBy ? ` · <i>${esc(t.acceptedBy)}</i>` : ''}</td></tr>`;
}).join('');

const cmRows = cms.map((c) => {
  const tickets = (c.ticketUrls || []).filter(Boolean);
  return `<li><b>${esc(c.id)}</b> ${esc(c.title)} <i>(${esc(c.type || '')}, ${esc(c.status || '')})</i>` +
    ` → ${esc((c.addresses || []).map(a => a.threat).join(', '))}${tickets.map((u, i) => ` · <a href="${esc(u)}">ticket ${i + 1}</a>`).join('')}</li>`;
}).join('');

const reqRows = reqs.map((r) =>
  `<tr><td><b>${esc(r.id)}</b></td><td>${esc(r.text)}</td><td>${esc(r.standardRef || '')}${r.slFr ? ` · ${esc(r.slFr)}` : ''}</td>` +
  `<td>${esc((r.derivedFromThreat || []).join(', '))}</td><td>${esc((r.satisfiedByCM || []).join(', '))}</td></tr>`
).join('');

// SBOM (CycloneDX 1.5) from component list
const sbomMode = project.sbom?.mode || 'in-tool';
const sbomFormat = project.sbom?.format || 'cyclonedx';
const sbomComps = (sys.components || []).filter(c => c.kind !== 'external-entity');

const buildCdx = () => ({
  bomFormat: 'CycloneDX', specVersion: '1.5', version: 1,
  metadata: { timestamp: new Date().toISOString(), component: { type: 'device', name: project.device?.name || project.title || 'device', version: project.device?.version || '' } },
  components: sbomComps.map(c => ({
    'bom-ref': c.id, type: c.kind === 'hardware' ? 'device' : 'application',
    name: c.name, version: c.version || '',
    ...(c.supplier ? { supplier: { name: c.supplier } } : {}),
    ...(c.license ? { licenses: [{ license: { id: c.license } }] } : {}),
    ...(c.cpe && c.cpe.startsWith('cpe:') ? { cpe: c.cpe } : {}),
    ...(c.cpe && c.cpe.startsWith('pkg:') ? { purl: c.cpe } : {}),
    properties: [{ name: 'tra:provenance', value: c.provenance || 'unspecified' }],
  })),
});

const buildSpdx = () => {
  const sid = id => 'SPDXRef-Package-' + String(id).replace(/[^A-Za-z0-9.\-]/g, '-');
  const created = new Date().toISOString();
  const name = (project.device?.name || project.title || 'device').replace(/[^A-Za-z0-9.\-]/g, '-');
  return {
    spdxVersion: 'SPDX-2.3', dataLicense: 'CC0-1.0', SPDXID: 'SPDXRef-DOCUMENT',
    name: `${name}-sbom`, documentNamespace: `https://spdx.org/spdxdocs/${name}-${created}`,
    creationInfo: { created, creators: ['Tool: embedrisk'] },
    packages: sbomComps.map(c => {
      const externalRefs = [];
      if (c.cpe && c.cpe.startsWith('cpe:')) externalRefs.push({ referenceCategory: 'SECURITY', referenceType: 'cpe23Type', referenceLocator: c.cpe });
      if (c.cpe && c.cpe.startsWith('pkg:')) externalRefs.push({ referenceCategory: 'PACKAGE-MANAGER', referenceType: 'purl', referenceLocator: c.cpe });
      return { SPDXID: sid(c.id), name: c.name, versionInfo: c.version || 'NOASSERTION', supplier: c.supplier ? `Organization: ${c.supplier}` : 'NOASSERTION', downloadLocation: 'NOASSERTION', licenseConcluded: c.license || 'NOASSERTION', licenseDeclared: c.license || 'NOASSERTION', copyrightText: 'NOASSERTION', ...(externalRefs.length ? { externalRefs } : {}) };
    }),
    relationships: sbomComps.map(c => ({ spdxElementId: 'SPDXRef-DOCUMENT', relationshipType: 'DESCRIBES', relatedSpdxElement: sid(c.id) })),
  };
};

const sbomTableRows = sbomComps.map(c =>
  `<tr><td>${esc(c.name)}</td><td>${esc(c.version || '')}</td><td>${esc(c.supplier || '')}</td><td>${esc(c.license || '')}</td><td><code>${esc(c.cpe || '')}</code></td><td>${esc(c.provenance || 'own')}</td></tr>`
).join('');

let sbomSection;
if (sbomMode !== 'in-tool') {
  sbomSection = project.sbom?.url
    ? `<h2>Software bill of materials (SBOM)</h2><p>Provided externally: <a href="${esc(project.sbom.url)}">${esc(project.sbom.url)}</a></p>`
    : `<h2>Software bill of materials (SBOM)</h2><p>Declared as externally provided; no URL recorded.</p>`;
} else {
  const fmt = sbomFormat === 'spdx' ? 'SPDX 2.3' : 'CycloneDX 1.5';
  const file = sbomFormat === 'spdx' ? 'report/sbom.spdx.json' : 'report/sbom.cdx.json';
  sbomSection = sbomTableRows
    ? `<h2>Software bill of materials (SBOM)</h2><p>${fmt} — <code>${file}</code></p><table><tr><th>Component</th><th>Version</th><th>Supplier</th><th>License</th><th>CPE / purl</th><th>Provenance</th></tr>${sbomTableRows}</table>`
    : `<h2>Software bill of materials (SBOM)</h2><p>No components defined (add in step 03).</p>`;
}

const html = `<!doctype html><meta charset=utf8><title>TRA ${esc(project.title || project.device?.name || 'Report')}</title>
<style>body{font:14px system-ui;margin:2rem;max-width:72rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f5f5f5;font-size:12px;text-transform:uppercase;letter-spacing:.04em}h1{font-size:1.4rem}h2{font-size:1.1rem;margin-top:2rem}.warn{color:#c62828}code{font-size:12px}ul{padding-left:1.4rem}</style>
<h1>${esc(project.title || project.device?.name || 'TRA Report')}</h1>
<p>Device: <b>${esc(project.device?.name || '—')}</b> | SL-T ${esc(project.slTarget || '—')} | scope ${esc(project.scope?.mode || '—')} | boundary: ${esc(project.scope?.boundary || '—')}</p>
<h2>Attacker profiles</h2><ul>${(ass.attacker || []).map(a => `<li><b>${esc(a.name)}</b> cap ${a.capability}, ${esc(a.access)}: ${esc(a.text || '')}</li>`).join('')}</ul>
<h2>Assets</h2><ul>${(sys.assets || []).map(a => `<li>${esc(a.name)} (C${a.objectives?.confidentiality}/I${a.objectives?.integrity}/A${a.objectives?.availability}/S${a.objectives?.safety})</li>`).join('')}</ul>
<h2>Threats &amp; risk</h2><table><tr><th>ID</th><th>Threat</th><th>STRIDE</th><th>Initial risk</th><th>Residual risk</th><th>Status</th></tr>${rows}</table>
<h2>Countermeasures</h2><ul>${cmRows || '<li>None defined.</li>'}</ul>
${reqRows ? `<h2>Security requirements</h2><table><tr><th>ID</th><th>Requirement</th><th>Standard ref</th><th>From threats</th><th>Satisfied by</th></tr>${reqRows}</table>` : ''}
${sbomSection}
<h2>Plausibility check</h2>${issues.length ? `<ul class=warn>${issues.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p>No issues found.</p>'}`;

mkdirSync(join(base, "report"), { recursive: true });
writeFileSync(join(base, "report/index.html"), html);
if (sbomMode === 'in-tool') {
  if (sbomFormat === 'spdx') {
    writeFileSync(join(base, "report/sbom.spdx.json"), JSON.stringify(buildSpdx(), null, 2) + '\n');
  } else {
    writeFileSync(join(base, "report/sbom.cdx.json"), JSON.stringify(buildCdx(), null, 2) + '\n');
  }
}
console.log(`Report written to ${join(proj, "report/index.html")}; ${issues.length} plausibility issue(s).`);
