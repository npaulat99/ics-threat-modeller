#!/usr/bin/env node
// TRA report generator: zero external dependencies. Loads a TRA project folder,
// computes initial and residual risk, runs the plausibility checker, and writes report/index.html.
// Usage: node tools/generate-report.mjs projects/example-radar-level-sensor
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { isAbsolute, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const proj = process.argv[2] || "projects/example-radar-level-sensor";
const base = isAbsolute(proj) ? proj : join(root, proj);
const read = (p) => JSON.parse(readFileSync(join(base, p), "utf8"));
const scheme = JSON.parse(readFileSync(join(root, ".assets/knowledge-base/risk-scheme.json"), "utf8"));

const project = read("01-project-description/project.json");
const ass = read(project.steps["02-assumptions"]);
const sys = read(project.steps["03-system-assets"]);
const threats = read(project.steps["06-threats"]).threats;
const cms = read(project.steps["08-countermeasures"]).countermeasures;

const band = (r) => scheme.matrix.bands.find((b) => r >= b.min && r <= b.max) || scheme.matrix.bands[0];
const residual = (t) => {
  const links = cms.flatMap((c) => c.addresses.filter((a) => a.threat === t.id));
  if (!links.length) return { l: t.likelihood, i: t.impact };
  return { l: Math.min(...links.map((a) => a.residualLikelihood)), i: Math.min(...links.map((a) => a.residualImpact)) };
};

// Plausibility checker (PR/NFR review step)
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
  return `<tr><td>${t.id}</td><td>${t.title}</td><td>${t.stride.join("")}</td><td>${t.likelihood}x${t.impact}=<b style="color:${band(r).color}">${r} ${band(r).name}</b></td><td>${rr.l}x${rr.i}=<b style="color:${band(rrv).color}">${rrv} ${band(rrv).name}</b></td><td>${t.status}</td></tr>`;
}).join("");

const html = `<!doctype html><meta charset=utf8><title>TRA ${project.title}</title>
<style>body{font:14px system-ui;margin:2rem;max-width:60rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px;text-align:left}h1{font-size:1.4rem}.warn{color:#c62828}</style>
<h1>${project.title}</h1><p>Device: ${project.device.name} (${project.device.type}) | SL-T ${project.slTarget} | mode ${project.scope.mode} | status ${project.status}</p>
<h2>Attacker profiles</h2><ul>${ass.attacker.map((a) => `<li><b>${a.name}</b> cap ${a.capability}, ${a.access}: ${a.text}</li>`).join("")}</ul>
<h2>Assets</h2><ul>${sys.assets.map((a) => `<li>${a.name} (C${a.objectives.confidentiality}/I${a.objectives.integrity}/A${a.objectives.availability}/S${a.objectives.safety})</li>`).join("")}</ul>
<h2>Threats & risk</h2><table><tr><th>ID</th><th>Threat</th><th>STRIDE</th><th>Initial</th><th>Residual</th><th>Status</th></tr>${rows}</table>
<h2>Plausibility check</h2>${issues.length ? `<ul class=warn>${issues.map((i) => `<li>${i}</li>`).join("")}</ul>` : "<p>No issues found.</p>"}`;

mkdirSync(join(base, "report"), { recursive: true });
writeFileSync(join(base, "report/index.html"), html);
console.log(`Report written to ${join(proj, "report/index.html")}; ${issues.length} plausibility issue(s).`);
