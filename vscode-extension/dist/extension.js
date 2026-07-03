"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode6 = __toESM(require("vscode"));
var import_node_child_process = require("node:child_process");
var os = __toESM(require("node:os"));
var path2 = __toESM(require("node:path"));
var import_node_util = require("node:util");

// ../tools/dfd-to-drawio.mjs
var import_node_fs = require("node:fs");
var STYLE = {
  "external-entity": "rounded=0;whiteSpace=wrap;html=1;strokeWidth=2;",
  process: "ellipse;whiteSpace=wrap;html=1;strokeWidth=2;",
  multiprocess: "ellipse;whiteSpace=wrap;html=1;strokeWidth=2;",
  store: "shape=partialRectangle;whiteSpace=wrap;html=1;left=0;right=0;fillColor=none;strokeWidth=2;",
  "trust-boundary": "rounded=1;dashed=1;fillColor=none;strokeWidth=2;"
};
var esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var ROW = { "external-entity": 0, process: 1, multiprocess: 1, store: 2 };
function dfdToDrawio(dfd, layer2 = 1, focus = null, parentFilter = void 0) {
  const nodes = parentFilter !== void 0 ? dfd.nodes.filter((n) => (n.parent ?? null) === parentFilter) : dfd.nodes.filter((n) => n.layer === layer2);
  const col = { 0: 0, 1: 0, 2: 0 };
  const pos = {};
  const cells = nodes.filter((n) => n.type !== "trust-boundary").map((n) => {
    const r = ROW[n.type] ?? 1, x = n.x ?? 60 + col[r]++ * 220, y = n.y ?? 80 + r * 180;
    pos[n.id] = { x, y, w: 120, h: 60 };
    const hl = n.id === focus ? "strokeColor=#1565c0;strokeWidth=4;" : "";
    return `<mxCell id="${esc(n.id)}" value="${esc(n.label)}" style="${STYLE[n.type] || STYLE.process}${hl}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="120" height="60" as="geometry"/></mxCell>`;
  });
  const tb = nodes.filter((n) => n.type === "trust-boundary").map((n) => {
    let x = n.x ?? 40, y = n.y ?? 200, w = n.w ?? 360, h = n.h ?? 160;
    const mem = (n.members || []).map((id) => pos[id]).filter(Boolean);
    if (n.x === void 0 && mem.length) {
      const pad = 24;
      x = Math.min(...mem.map((b) => b.x)) - pad;
      y = Math.min(...mem.map((b) => b.y)) - pad;
      w = Math.max(...mem.map((b) => b.x + b.w)) - x + pad;
      h = Math.max(...mem.map((b) => b.y + b.h)) - y + pad;
    }
    return `<mxCell id="${esc(n.id)}" value="${esc(n.label)}" style="${STYLE["trust-boundary"]};verticalAlign=top;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
  });
  const ids = new Set(nodes.map((n) => n.id));
  const edges = dfd.flows.filter((f) => ids.has(f.from) && ids.has(f.to)).map((f) => `<mxCell id="${esc(f.id)}" value="${esc(f.label || "")}" style="endArrow=classic;html=1;strokeWidth=2;edgeStyle=orthogonalEdgeStyle;rounded=0;" edge="1" parent="1" source="${esc(f.from)}" target="${esc(f.to)}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  const model = `<mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" connect="1" arrows="1" page="1" pageWidth="850" pageHeight="1100"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${tb.join("")}${cells.join("")}${edges.join("")}</root></mxGraphModel>`;
  return `<mxfile host="vscode"><diagram name="Layer ${layer2}">${model}</diagram></mxfile>`;
}
if (process.argv[1]?.endsWith("dfd-to-drawio.mjs")) {
  const f = process.argv[2];
  const layer2 = +(process.argv[3] || 1);
  (0, import_node_fs.writeFileSync)(f.replace(/\.json$/, ".drawio"), dfdToDrawio(JSON.parse((0, import_node_fs.readFileSync)(f, "utf8")), layer2));
  console.log("wrote", f.replace(/\.json$/, ".drawio"));
}

// src/wizard.ts
var vscode = __toESM(require("vscode"));
var rdRaw = async (proj, rel, def) => {
  try {
    return JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(proj, rel))).toString());
  } catch {
    return def;
  }
};
var write = (proj, rel, obj) => vscode.workspace.fs.writeFile(vscode.Uri.joinPath(proj, rel), Buffer.from(JSON.stringify(obj, null, 2)));
async function locate() {
  const p = await vscode.workspace.findFiles("**/01-project-description/project.json", "**/node_modules/**", 1);
  if (!p[0]) return void 0;
  return { proj: vscode.Uri.joinPath(p[0], "..", "..") };
}
async function countTrees(proj) {
  try {
    const doc = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(proj, "07-attack-trees/attack-trees.json"))).toString());
    return (doc.trees || []).length;
  } catch {
    return 0;
  }
}
async function buildData(proj) {
  const project = await rdRaw(proj, "01-project-description/project.json", {});
  const threats = (await rdRaw(proj, "06-threats/threats.json", { threats: [] })).threats || [];
  const cms = (await rdRaw(proj, "08-countermeasures/countermeasures.json", { countermeasures: [] })).countermeasures || [];
  const system = await rdRaw(proj, "03-system-assets/system.json", { components: [], assets: [] });
  const assumptions = await rdRaw(proj, "02-assumptions/assumptions.json", {});
  const dfd = await rdRaw(proj, "04-dfd/dfd.json", { nodes: [] });
  const reqs = (await rdRaw(proj, "05-requirements/requirements.json", { requirements: [] })).requirements || [];
  const comps = (system.components || []).map((c) => ({ id: c.id, name: c.name }));
  return {
    project: {
      name: project.device?.name || "",
      sl: project.slTarget || "SL2",
      mode: project.scope?.mode || "graybox",
      boundary: project.scope?.boundary || ""
    },
    threats,
    cms,
    comps,
    requirements: reqs,
    assumptions: {
      attacker: assumptions.attacker || [],
      device: assumptions.device || [],
      system: assumptions.system || [],
      environment: assumptions.environment || [],
      operational: assumptions.operational || []
    },
    system: {
      components: system.components || [],
      interfaces: system.interfaces || [],
      trustBoundaries: system.trustBoundaries || [],
      assets: system.assets || []
    },
    counts: {
      project: !!(project.device?.name && project.scope?.boundary),
      assumptions: (assumptions.attacker || []).length,
      system: (system.components || []).length,
      systemAssets: (system.assets || []).length,
      dfd: (dfd.nodes || []).length,
      requirements: reqs.length,
      threats: threats.length,
      attackTrees: await countTrees(proj),
      countermeasures: cms.length
    }
  };
}
async function openWizard(ctx) {
  const f = await locate();
  if (!f) {
    vscode.window.showWarningMessage("No TRA project found. Use 'EmbedRisk: New project from example' or copy the example.");
    return;
  }
  const media = vscode.Uri.joinPath(ctx.extensionUri, "media");
  const panel = vscode.window.createWebviewPanel("traWizard", "EmbedRisk Wizard", vscode.ViewColumn.One, { enableScripts: true, localResourceRoots: [media] });
  const cssUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(media, "tra-ui.css"));
  const riskUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(media, "risk-model.js"));
  const logoUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(media, "embedrisk-logo.svg"));
  const nonce = String(Math.random()).slice(2);
  const csp = `default-src 'none'; img-src ${panel.webview.cspSource}; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${panel.webview.cspSource};`;
  panel.webview.html = shell(cssUri, riskUri, logoUri, csp, nonce);
  const sendInit = async () => panel.webview.postMessage({ cmd: "init", data: await buildData(f.proj) });
  const counts = async () => (await buildData(f.proj)).counts;
  panel.webview.onDidReceiveMessage(async (m) => {
    if (m.cmd === "ready") return sendInit();
    if (m.cmd === "project") {
      const project = await rdRaw(f.proj, "01-project-description/project.json", {});
      project.device = project.device || {};
      project.device.name = m.name;
      project.slTarget = m.sl;
      project.scope = project.scope || {};
      project.scope.mode = m.mode;
      project.scope.boundary = m.bnd;
      await write(f.proj, "01-project-description/project.json", project);
      return panel.webview.postMessage({ cmd: "msg", text: "Project saved.", counts: await counts() });
    }
    if (m.cmd === "threats") {
      const rows = m.threats;
      const compIds = new Set(m.compIds || []);
      const problems = [];
      const seen = /* @__PURE__ */ new Set();
      rows.forEach((t, i) => {
        const id = (t.id || "").trim();
        if (!id) problems.push(`Row ${i + 1}: missing ID.`);
        else if (seen.has(id)) problems.push(`Duplicate threat ID '${id}'.`);
        else seen.add(id);
        if (!(t.components || []).length) problems.push(`Threat '${id || i + 1}': at least one affected component is required.`);
        (t.components || []).forEach((c) => {
          if (!compIds.has(c)) problems.push(`Threat '${id}': unknown component '${c}'.`);
        });
        if (!(t.stride || []).length) problems.push(`Threat '${id}': assign at least one STRIDE category.`);
      });
      if (problems.length) return panel.webview.postMessage({ cmd: "err", text: "Cannot save:\n" + problems.join("\n") });
      const prev = new Map(((await rdRaw(f.proj, "06-threats/threats.json", { threats: [] })).threats || []).map((t) => [t.id, t]));
      const norm = rows.map((t) => ({
        ...prev.get(t.id) || { assets: [], status: "open" },
        id: t.id,
        title: t.title,
        stride: (t.stride || []).map((s) => s.toUpperCase()),
        components: t.components || [],
        likelihood: +t.likelihood || 3,
        impact: +t.impact || 3,
        status: t.status || prev.get(t.id)?.status || "open"
      }));
      await write(f.proj, "06-threats/threats.json", { threats: norm });
      return panel.webview.postMessage({ cmd: "threats", threats: norm, counts: await counts(), text: "Threats saved." });
    }
    if (m.cmd === "cms") {
      const rows = m.cms;
      const threats = (await rdRaw(f.proj, "06-threats/threats.json", { threats: [] })).threats || [];
      const tById = new Map(threats.map((t) => [t.id, t]));
      const problems = [];
      const seen = /* @__PURE__ */ new Set();
      rows.forEach((c, i) => {
        const id = (c.id || "").trim();
        if (!id) problems.push(`CM row ${i + 1}: missing ID.`);
        else if (seen.has(id)) problems.push(`Duplicate countermeasure ID '${id}'.`);
        else seen.add(id);
        if (!(c.addresses || []).length) problems.push(`Countermeasure '${id || i + 1}': must address at least one threat.`);
        (c.addresses || []).forEach((a) => {
          const th = tById.get(a.threat);
          if (!th) {
            problems.push(`Countermeasure '${id}': unknown threat '${a.threat}'.`);
            return;
          }
          if (a.residualImpact > th.impact) problems.push(`${id}: residual impact for ${a.threat} (${a.residualImpact}) exceeds initial (${th.impact}).`);
          if (a.residualLikelihood > th.likelihood) problems.push(`${id}: residual likelihood for ${a.threat} (${a.residualLikelihood}) exceeds initial (${th.likelihood}).`);
          if (c.type === "preventive" && a.residualImpact < th.impact) problems.push(`${id}: a preventive control should reduce likelihood, not impact (${a.threat}).`);
        });
      });
      if (problems.length) return panel.webview.postMessage({ cmd: "err", text: "Cannot save:\n" + problems.join("\n") });
      const prev = new Map(((await rdRaw(f.proj, "08-countermeasures/countermeasures.json", { countermeasures: [] })).countermeasures || []).map((c) => [c.id, c]));
      const norm = rows.map((c) => ({
        ...prev.get(c.id) || { components: [] },
        id: c.id,
        title: c.title,
        type: c.type || "preventive",
        status: c.status || "proposed",
        addresses: (c.addresses || []).map((a) => ({ threat: a.threat, residualLikelihood: +a.residualLikelihood || 2, residualImpact: +a.residualImpact || 2 }))
      }));
      await write(f.proj, "08-countermeasures/countermeasures.json", { countermeasures: norm });
      return panel.webview.postMessage({ cmd: "cms", cms: norm, counts: await counts(), text: "Countermeasures saved." });
    }
    if (m.cmd === "assumptions") {
      const a = m.assumptions || {};
      const attacker = a.attacker || [];
      const problems = [];
      const seen = /* @__PURE__ */ new Set();
      if (!attacker.length) problems.push("At least one attacker profile is required (it grounds the likelihood).");
      attacker.forEach((p, i) => {
        const id = (p.id || "").trim();
        if (!id) problems.push(`Attacker row ${i + 1}: missing ID.`);
        else if (seen.has(id)) problems.push(`Duplicate attacker ID '${id}'.`);
        else seen.add(id);
        if (!(p.name || "").trim()) problems.push(`Attacker '${id || i + 1}': name is required.`);
      });
      if (problems.length) return panel.webview.postMessage({ cmd: "err", text: "Cannot save assumptions:\n" + problems.join("\n") });
      const prev = await rdRaw(f.proj, "02-assumptions/assumptions.json", {});
      const doc = {
        ...prev,
        attacker: attacker.map((p) => ({ ...p, capability: Math.max(1, Math.min(5, +p.capability || 2)) })),
        device: a.device || [],
        system: a.system || [],
        environment: a.environment || [],
        operational: a.operational || []
      };
      await write(f.proj, "02-assumptions/assumptions.json", doc);
      return panel.webview.postMessage({ cmd: "assumptions", assumptions: doc, counts: await counts(), text: "Assumptions saved." });
    }
    if (m.cmd === "system") {
      const s = m.system || {};
      const components = s.components || [];
      const problems = [];
      const seen = /* @__PURE__ */ new Set();
      components.forEach((c, i) => {
        const id = (c.id || "").trim();
        if (!id) problems.push(`Component row ${i + 1}: missing ID.`);
        else if (seen.has(id)) problems.push(`Duplicate component ID '${id}'.`);
        else seen.add(id);
        if (!(c.name || "").trim()) problems.push(`Component '${id || i + 1}': name is required.`);
      });
      const aseen = /* @__PURE__ */ new Set();
      (s.assets || []).forEach((a, i) => {
        const id = (a.id || "").trim();
        if (!id) problems.push(`Asset row ${i + 1}: missing ID.`);
        else if (aseen.has(id)) problems.push(`Duplicate asset ID '${id}'.`);
        else aseen.add(id);
      });
      if (problems.length) return panel.webview.postMessage({ cmd: "err", text: "Cannot save system:\n" + problems.join("\n") });
      const clampO = (o) => ({
        confidentiality: Math.max(0, Math.min(5, +(o?.confidentiality ?? 0))),
        integrity: Math.max(0, Math.min(5, +(o?.integrity ?? 0))),
        availability: Math.max(0, Math.min(5, +(o?.availability ?? 0))),
        safety: Math.max(0, Math.min(5, +(o?.safety ?? 0)))
      });
      const prev = await rdRaw(f.proj, "03-system-assets/system.json", {});
      const doc = {
        ...prev,
        components: components.map((c) => ({ ...c, layer: +c.layer || 1, parent: c.parent || null })),
        interfaces: s.interfaces || [],
        trustBoundaries: s.trustBoundaries || [],
        assets: (s.assets || []).map((a) => ({ ...a, objectives: clampO(a.objectives) }))
      };
      await write(f.proj, "03-system-assets/system.json", doc);
      const comps = doc.components.map((c) => ({ id: c.id, name: c.name }));
      return panel.webview.postMessage({ cmd: "system", system: doc, comps, counts: await counts(), text: "System & assets saved." });
    }
    if (m.cmd === "requirements") {
      const rows = m.requirements || [];
      const problems = [];
      const seen = /* @__PURE__ */ new Set();
      rows.forEach((r, i) => {
        const id = (r.id || "").trim();
        if (!id) problems.push(`Requirement row ${i + 1}: missing ID.`);
        else if (seen.has(id)) problems.push(`Duplicate requirement ID '${id}'.`);
        else seen.add(id);
      });
      if (problems.length) return panel.webview.postMessage({ cmd: "err", text: "Cannot save requirements:\n" + problems.join("\n") });
      const norm = rows.map((r) => ({
        ...r,
        id: r.id,
        text: r.text || "",
        standardRef: r.standardRef || "",
        slFr: r.slFr || "",
        derivedFromThreat: r.derivedFromThreat || [],
        satisfiedByCM: r.satisfiedByCM || []
      }));
      await write(f.proj, "05-requirements/requirements.json", { requirements: norm });
      return panel.webview.postMessage({ cmd: "requirements", requirements: norm, counts: await counts(), text: "Requirements saved." });
    }
    if (m.cmd === "openFile") {
      try {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(f.proj, m.rel));
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
      } catch {
        vscode.window.showInformationMessage(`${m.rel} does not exist yet.`);
      }
      return;
    }
    if (m.cmd === "dfd") return void vscode.commands.executeCommand("vscode.openWith", vscode.Uri.joinPath(f.proj, "04-dfd/dfd.json"), "tra.dfdNative");
    if (m.cmd === "report") return void vscode.commands.executeCommand("tra.report");
    if (m.cmd === "kb") return void vscode.commands.executeCommand("tra.kbBrowse");
    if (m.cmd === "atree") return void vscode.commands.executeCommand("tra.newAttackTree");
  }, void 0, ctx.subscriptions);
}
function shell(cssUri, riskUri, logoUri, csp, nonce) {
  return `<!doctype html><html><head><meta charset="utf8"><meta http-equiv="Content-Security-Policy" content="${csp}">
<link rel="stylesheet" href="${cssUri}">
</head><body>
<div class="app">
  <div class="topbar">
    <div class="brand"><img class="logo" src="${logoUri}" alt="" width="22" height="22"><span>EmbedRisk <small id="devname"></small></span></div>
    <span class="spacer"></span>
    <button class="btn" id="undoBtn" data-act="undo" title="Undo (Ctrl+Z)" disabled>&#8630; Undo</button>
    <button class="btn" id="redoBtn" data-act="redo" title="Redo (Ctrl+Y / Ctrl+Shift+Z)" disabled>&#8631; Redo</button>
    <button class="btn" data-cmd="kb">Knowledge base</button>
    <button class="btn primary" data-cmd="report">Generate report</button>
  </div>
  <div class="layout">
    <nav class="stepnav" id="rail"></nav>
    <div class="main" id="main">
      <div id="err" class="errbox" style="display:none"></div>
      <div id="ok" class="okbox" style="display:none"></div>

      <div class="card" id="card-project">
        <h2>01 \xB7 Project</h2>
        <div class="desc">Device, scope and target security level.</div>
        <div class="row">
          <div class="field" style="flex:2"><label>Device name</label><input class="inp" id="p-name"></div>
          <div class="field"><label>SL target</label>
            <select class="inp" id="p-sl"><option>SL1</option><option>SL2</option><option>SL3</option><option>SL4</option></select></div>
          <div class="field"><label>Scope mode</label>
            <select class="inp" id="p-mode"><option>blackbox</option><option>graybox</option><option>whitebox</option></select></div>
        </div>
        <div class="field"><label>Boundary</label><input class="inp" id="p-bnd"></div>
        <button class="btn primary" data-act="saveP">Save project</button>
      </div>

      <div class="card" id="card-assumptions">
        <h2>02 \xB7 Assumptions</h2>
        <div class="desc">Ground the analysis: at least one <b>attacker profile</b> is required (it grounds the likelihood), plus device / system / environment / operational assumptions.</div>
        <div class="tabs" id="asm-tabs"></div>
        <div id="asm-body"></div>
        <div style="margin-top:10px"><button class="btn primary" data-act="saveA">Save assumptions</button></div>
      </div>

      <div class="card" id="card-system">
        <h2>03 \xB7 System &amp; assets</h2>
        <div class="desc">Decompose the device into components, interfaces and trust boundaries, then list the protected assets and their Confidentiality / Integrity / Availability / Safety objectives (0\u20135). Components defined here feed the threats in step 06.</div>
        <div class="tabs" id="sys-tabs"></div>
        <div id="sys-body"></div>
        <div style="margin-top:10px"><button class="btn primary" data-act="saveS">Save system &amp; assets</button></div>
      </div>

      <div class="card" id="card-requirements">
        <h2>05 \xB7 Security requirements</h2>
        <div class="desc">Derive testable requirements from the threats and link them to the controls that satisfy them \u2014 the traceable core (threat &rarr; requirement &rarr; control) that IEC 62443-4-1 / CRA expect.</div>
        <div id="req-body"></div>
        <div style="margin-top:10px"><button class="btn" data-act="addReq">+ Requirement</button> <button class="btn primary" data-act="saveR">Save requirements</button></div>
      </div>

      <div class="card" id="card-threats">
        <h2>06 \xB7 Threats &amp; risk</h2>
        <div class="desc">Each threat needs a unique ID, at least one STRIDE category and one affected component. Risk = Likelihood \xD7 Impact; the residual reflects the single most-protective countermeasure. The <b>status</b> shows how each threat is being handled.</div>
        <table class="grid"><thead><tr><th class="narrow">ID</th><th>Title</th><th>STRIDE</th><th>Components</th><th class="num">L</th><th class="num">I</th><th>Risk &rarr; residual</th><th class="stat">Status</th><th></th></tr></thead><tbody id="threats-body"></tbody></table>
        <div style="margin-top:10px"><button class="btn" data-act="addT">+ Threat</button> <button class="btn primary" data-act="saveT">Save threats</button></div>
      </div>

      <div class="card" id="card-cms">
        <h2>08 \xB7 Countermeasures</h2>
        <div class="desc">A countermeasure addresses one or more threats and sets the residual L/I per threat. Preventive controls should lower likelihood, not impact.</div>
        <div id="cms-list"></div>
        <div style="margin-top:10px"><button class="btn" data-act="addC">+ Countermeasure</button> <button class="btn primary" data-act="saveC">Save countermeasures</button></div>
      </div>
    </div>
  </div>
</div>
<script nonce="${nonce}" src="${riskUri}"></script>
<script nonce="${nonce}">
(function(){
const vs=acquireVsCodeApi(), R=window.RiskModel;
const STRIDE=[['S','Spoofing'],['T','Tampering'],['R','Repudiation'],['I','Info disclosure'],['D','Denial of service'],['E','Elevation']];
const T_STATUS=[['open','Open'],['mitigated','Mitigated'],['accepted','Accepted'],['transferred','Transferred']];
const ACCESS=[['remote','Remote'],['adjacent','Adjacent'],['local','Local'],['physical','Physical']];
const ASM_CATS=[['device','Device'],['system','System'],['environment','Environment'],['operational','Operational']];
const COMP_KINDS=['device','hardware','software','interface','external-entity','store'];
const PROVENANCE=['own','third-party (OSS)','third-party (commercial)','subcontracted'];
const IF_CATS=['network','external','user'];
const EXPOSURE=['physical','local','adjacent','remote'];
const ASSET_TYPES=['data','function','credential','firmware','config','physical-process'];
const OBJS=[['confidentiality','C'],['integrity','I'],['availability','A'],['safety','S']];
let threats=[], cms=[], comps=[], counts={};
let assumptions={attacker:[],device:[],system:[],environment:[],operational:[]};
let system={components:[],interfaces:[],trustBoundaries:[],assets:[]};
let requirements=[];
let project={name:'',sl:'SL2',mode:'graybox',boundary:''};
let undoStack=[], redoStack=[], histKey='', histTime=0;
let asmTab='attacker', sysTab='components';
const $=function(s){return document.querySelector(s);};
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function uid(prefix,ids){var i=1,id;do{id=prefix+i++;}while((ids||[]).indexOf(id)>=0);return id;}
function optTags(list,val){return list.map(function(o){var v=o&&o.length&&typeof o!=='string'?o[0]:o;var l=o&&o.length&&typeof o!=='string'?o[1]:o;return '<option value="'+esc(v)+'"'+(String(val)===String(v)?' selected':'')+'>'+esc(l)+'</option>';}).join('');}
function statusLabel(s){var m={open:'Open',mitigated:'Mitigated',accepted:'Accepted',transferred:'Transferred'};return m[s||'open']||'Open';}
// ---- undo / redo history: snapshots of the editable project state (toolbar buttons + Ctrl+Z / Ctrl+Y) ----
function snapshot(){return JSON.stringify({project:project,threats:threats,cms:cms,assumptions:assumptions,system:system,requirements:requirements});}
function updUndoBtns(){var u=$('#undoBtn'),r=$('#redoBtn');if(u)u.disabled=!undoStack.length;if(r)r.disabled=!redoStack.length;}
function pushUndo(state){undoStack.push(state);if(undoStack.length>150)undoStack.shift();redoStack=[];updUndoBtns();}
function recordBefore(key){var now=Date.now();if(undoStack.length&&key===histKey&&(now-histTime<800)){histTime=now;return;}pushUndo(snapshot());histKey=key;histTime=now;}
function recordChanged(before){if(before===snapshot())return;pushUndo(before);histKey='';histTime=Date.now();}
function keyOf(t){var d=t.dataset,k=(t.id||t.tagName);for(var p in d)k+='|'+p+'='+d[p];return k;}
function applyState(s){var d=JSON.parse(s);project=d.project||project;threats=d.threats||[];cms=d.cms||[];assumptions=d.assumptions||assumptions;system=d.system||system;requirements=d.requirements||[];comps=(system.components||[]).map(function(c){return {id:c.id,name:c.name};});renderProject(project);renderThreats();renderCms();renderAssumptions();renderSystem();renderRequirements();renderRail();}
function undo(){if(!undoStack.length)return;redoStack.push(snapshot());applyState(undoStack.pop());histKey='';updUndoBtns();}
function redo(){if(!redoStack.length)return;undoStack.push(snapshot());applyState(redoStack.pop());histKey='';updUndoBtns();}
function clearHistory(){undoStack=[];redoStack=[];histKey='';histTime=0;updUndoBtns();}
function pill(score,band){return '<span class="pill '+R.bandClass(band.name)+'">'+score+' \xB7 '+band.name+'</span>';}
function riskCell(t){var r=R.riskOf(t,cms);return pill(r.initial,r.initialBand)+'<span class="arrow">&rarr;</span>'+pill(r.residual,r.residualBand);}
function chip(text,on,attrs,title){return '<span class="chip'+(on?' on':'')+'" role="button" tabindex="0" '+attrs+(title?' title="'+esc(title)+'"':'')+'>'+esc(text)+'</span>';}

const STEPS=[
  ['01','Project','Scope, device, SL-T','scroll','#card-project','project'],
  ['02','Assumptions','Incl. attacker profiles','scroll','#card-assumptions','assumptions'],
  ['03','System & Assets','Components, C/I/A/S','scroll','#card-system','system'],
  ['04','Data Flow Diagram','Layered DeMarco model','cmd','dfd','dfd'],
  ['05','Requirements','Security requirements','scroll','#card-requirements','requirements'],
  ['06','Threats','STRIDE + risk rating','scroll','#card-threats','threats'],
  ['07','Attack trees','Optional \xB7 AND/OR','cmd','atree','attackTrees'],
  ['08','Countermeasures','Residual risk','scroll','#card-cms','countermeasures'],
  ['09','Review & Report','Plausibility check','cmd','report','review']
];
function clientIssues(){
  var out=[],seen={};
  threats.forEach(function(t){if(!t.id)out.push('threat missing id');else if(seen[t.id])out.push('dup '+t.id);else seen[t.id]=1;
    if(!(t.components||[]).length)out.push(t.id+' no component');if(!(t.stride||[]).length)out.push(t.id+' no STRIDE');});
  var tid={};threats.forEach(function(t){tid[t.id]=t;});var sc={};
  cms.forEach(function(c){if(!c.id)out.push('cm missing id');else if(sc[c.id])out.push('dup '+c.id);else sc[c.id]=1;
    if(!(c.addresses||[]).length)out.push(c.id+' addresses nothing');
    (c.addresses||[]).forEach(function(a){var th=tid[a.threat];if(!th){out.push(c.id+' unknown '+a.threat);return;}
      if(a.residualImpact>th.impact||a.residualLikelihood>th.likelihood)out.push(c.id+' residual>initial');});});
  return out;
}
function renderRail(){
  var issues=clientIssues();
  var html='<div class="grouplabel">Methodology</div>'+STEPS.map(function(s){
    var key=s[5],badge='';
    if(key==='review'){badge=issues.length?'<span class="warnmark">'+issues.length+' &#9888;</span>':'<span class="check">&#10003;</span>';}
    else if(key==='project'){badge=counts.project?'<span class="check">&#10003;</span>':'';}
    else if(counts[key]!==undefined){badge='<span class="count">'+counts[key]+'</span>';}
    return '<button class="stepitem" data-kind="'+s[3]+'" data-target="'+esc(s[4])+'"><span class="num">'+s[0]+'</span><span class="txt"><b>'+esc(s[1])+'</b><span>'+esc(s[2])+'</span></span>'+badge+'</button>';
  }).join('');
  html+='<div class="grouplabel">Views</div><button class="stepitem" data-kind="cmd" data-target="kb"><span class="num">&#128218;</span><span class="txt"><b>Knowledge base</b><span>Reusable library</span></span></button>';
  $('#rail').innerHTML=html;
}
function renderProject(p){p=p||{};project={name:p.name||'',sl:p.sl||'SL2',mode:p.mode||'graybox',boundary:p.boundary||''};$('#devname').textContent=project.name?('\xB7 '+project.name):'';$('#p-name').value=project.name;$('#p-sl').value=project.sl;$('#p-mode').value=project.mode;$('#p-bnd').value=project.boundary;}
function renderThreats(){
  $('#threats-body').innerHTML=threats.length?threats.map(function(t,i){
    var st=STRIDE.map(function(s){return chip(s[0],(t.stride||[]).indexOf(s[0])>=0,'data-i='+i+' data-role="stride" data-val="'+s[0]+'"',s[1]);}).join('');
    var cc=comps.length?comps.map(function(c){return chip(c.id,(t.components||[]).indexOf(c.id)>=0,'data-i='+i+' data-role="comp" data-val="'+esc(c.id)+'"',c.name);}).join(''):'<span class="hint">Add components in step 03</span>';
    return '<tr>'+
      '<td class="narrow"><input class="inp" data-i='+i+' data-k="id" value="'+esc(t.id)+'"></td>'+
      '<td><input class="inp" data-i='+i+' data-k="title" value="'+esc(t.title)+'"></td>'+
      '<td><div class="chips">'+st+'</div></td>'+
      '<td><div class="chips">'+cc+'</div></td>'+
      '<td class="num"><input class="inp" type="number" min=1 max=5 data-i='+i+' data-k="likelihood" value="'+(t.likelihood||3)+'"></td>'+
      '<td class="num"><input class="inp" type="number" min=1 max=5 data-i='+i+' data-k="impact" value="'+(t.impact||3)+'"></td>'+
      '<td id="tp-'+i+'">'+riskCell(t)+'</td>'+
      '<td class="stat"><div class="statwrap"><span class="badge st-'+esc(t.status||'open')+'">'+esc(statusLabel(t.status))+'</span>'+
        '<select class="inp" data-i='+i+' data-k="status">'+T_STATUS.map(function(s){return '<option value="'+s[0]+'"'+((t.status||'open')===s[0]?' selected':'')+'>'+s[1]+'</option>';}).join('')+'</select></div></td>'+
      '<td><button class="btn sm danger" data-act="delT" data-i='+i+'>&#10005;</button></td></tr>';
  }).join(''):'<tr><td colspan=9 class="hint">No threats yet \u2014 add one below.</td></tr>';
}
function updatePills(){threats.forEach(function(t,i){var el=document.getElementById('tp-'+i);if(el)el.innerHTML=riskCell(t);});}
function renderCms(){
  $('#cms-list').innerHTML=cms.length?cms.map(function(c,i){
    var addressed=(c.addresses||[]).map(function(a){return a.threat;});
    var addrRows=(c.addresses||[]).map(function(a,j){
      return '<div class="row" style="gap:8px;align-items:center;margin:2px 0"><span class="chip static">'+esc(a.threat)+'</span>'+
        '<span class="hint">res L</span><input class="inp" type="number" min=1 max=5 style="width:56px" data-c='+i+' data-j='+j+' data-k="residualLikelihood" value="'+(a.residualLikelihood||2)+'">'+
        '<span class="hint">res I</span><input class="inp" type="number" min=1 max=5 style="width:56px" data-c='+i+' data-j='+j+' data-k="residualImpact" value="'+(a.residualImpact||2)+'">'+
        '<button class="btn sm danger" data-act="delAddr" data-c='+i+' data-j='+j+'>remove</button></div>';
    }).join('');
    var avail=threats.filter(function(t){return addressed.indexOf(t.id)<0;}).map(function(t){return chip(t.id,false,'data-act="addAddr" data-c='+i+' data-val="'+esc(t.id)+'"',t.title);}).join('');
    return '<div class="card" style="margin:10px 0;background:var(--surface-2)">'+
      '<div class="row"><div class="field narrow" style="flex:0 0 90px"><label>ID</label><input class="inp" data-ci='+i+' data-k="id" value="'+esc(c.id)+'"></div>'+
      '<div class="field" style="flex:2"><label>Title</label><input class="inp" data-ci='+i+' data-k="title" value="'+esc(c.title)+'"></div>'+
      '<div class="field"><label>Type</label><select class="inp" data-ci='+i+' data-k="type">'+['preventive','detective','corrective','organizational'].map(function(o){return '<option'+(c.type===o?' selected':'')+'>'+o+'</option>';}).join('')+'</select></div>'+
      '<div class="field"><label>Status</label><select class="inp" data-ci='+i+' data-k="status">'+['proposed','implemented','verified'].map(function(o){return '<option'+(c.status===o?' selected':'')+'>'+o+'</option>';}).join('')+'</select></div>'+
      '<button class="btn sm danger" data-act="delC" data-i='+i+' style="align-self:center">&#10005;</button></div>'+
      '<div style="margin-top:6px"><div class="hint">Addresses</div>'+(addrRows||'<span class="hint">No threats addressed yet.</span>')+'</div>'+
      (avail?'<div style="margin-top:6px"><div class="hint">Add threat</div><div class="chips">'+avail+'</div></div>':'')+
      '</div>';
  }).join(''):'<span class="hint">No countermeasures yet \u2014 add one below.</span>';
}
function renderAssumptions(){
  var tabs=[['attacker','Attacker',(assumptions.attacker||[]).length]].concat(ASM_CATS.map(function(c){return [c[0],c[1],(assumptions[c[0]]||[]).length];}));
  $('#asm-tabs').innerHTML=tabs.map(function(t){return '<button class="tab'+(asmTab===t[0]?' active':'')+'" data-asmtab="'+t[0]+'">'+esc(t[1])+' <span class="badge">'+t[2]+'</span></button>';}).join('');
  var html='';
  if(asmTab==='attacker'){
    var list=assumptions.attacker||[];
    html+=list.length?list.map(function(p,i){
      return '<div class="itemcard"><div class="head"><span class="idtag">'+esc(p.id||('ATK-'+(i+1)))+'</span>'+
        '<input class="inp grow" data-atk='+i+' data-k="name" value="'+esc(p.name||'')+'" placeholder="Profile name">'+
        '<button class="btn sm danger" data-act="delAtk" data-i='+i+'>&#10005;</button></div>'+
        '<div class="grid4">'+
          '<div class="field"><label>Capability</label><select class="inp" data-atk='+i+' data-k="capability">'+[1,2,3,4,5].map(function(n){return '<option'+((+p.capability||2)===n?' selected':'')+'>'+n+'</option>';}).join('')+'</select></div>'+
          '<div class="field"><label>Access</label><select class="inp" data-atk='+i+' data-k="access">'+optTags(ACCESS,p.access||'local')+'</select></div>'+
          '<div class="field"><label>Motivation</label><input class="inp" data-atk='+i+' data-k="motivation" value="'+esc(p.motivation||'')+'"></div>'+
          '<div class="field"><label>Resources</label><input class="inp" data-atk='+i+' data-k="resources" value="'+esc(p.resources||'')+'"></div>'+
        '</div>'+
        '<div class="field"><label>Description</label><textarea class="inp" rows=2 data-atk='+i+' data-k="text">'+esc(p.text||'')+'</textarea></div></div>';
    }).join(''):'<p class="hint">No attacker profiles yet \u2014 at least one is required.</p>';
    html+='<button class="btn sm primary" data-act="addAtk">+ Attacker profile</button>';
  } else {
    var key=asmTab, arr=assumptions[key]||[];
    html+=arr.length?arr.map(function(item,i){
      return '<div class="itemcard"><div class="head" style="align-items:flex-start"><span class="idtag">'+esc(item.id||('A-'+(i+1)))+'</span>'+
        '<textarea class="inp grow" rows=2 data-asm="'+key+'" data-ai='+i+' data-k="text" placeholder="Assumption text">'+esc(item.text||'')+'</textarea>'+
        '<select class="inp" style="width:120px" data-asm="'+key+'" data-ai='+i+' data-k="confidence">'+['','low','medium','high'].map(function(c){return '<option value="'+c+'"'+((item.confidence||'')===c?' selected':'')+'>'+(c||'confidence\u2026')+'</option>';}).join('')+'</select>'+
        '<button class="btn sm danger" data-act="delAsm" data-asm="'+key+'" data-i='+i+'>&#10005;</button></div></div>';
    }).join(''):'<p class="hint">None yet.</p>';
    html+='<button class="btn sm" data-act="addAsm" data-asm="'+key+'">+ Add</button>';
  }
  $('#asm-body').innerHTML=html;
}
function renderSystem(){
  var tabs=[['components','Components',(system.components||[]).length],['interfaces','Interfaces',(system.interfaces||[]).length],['boundaries','Trust boundaries',(system.trustBoundaries||[]).length],['assets','Assets',(system.assets||[]).length]];
  $('#sys-tabs').innerHTML=tabs.map(function(t){return '<button class="tab'+(sysTab===t[0]?' active':'')+'" data-systab="'+t[0]+'">'+esc(t[1])+' <span class="badge">'+t[2]+'</span></button>';}).join('');
  var cList=system.components||[], html='';
  if(sysTab==='components'){
    html+=cList.length?cList.map(function(c,i){
      var parentSel='<option value="">\u2014 none \u2014</option>'+cList.filter(function(x){return x.id!==c.id;}).map(function(x){return '<option value="'+esc(x.id)+'"'+((c.parent||'')===x.id?' selected':'')+'>'+esc(x.name)+' ('+esc(x.id)+')</option>';}).join('');
      return '<div class="itemcard"><div class="head"><span class="idtag">'+esc(c.id||('C-'+(i+1)))+'</span>'+
        '<input class="inp grow" data-comp='+i+' data-k="name" value="'+esc(c.name||'')+'">'+
        '<button class="btn sm danger" data-act="delComp" data-i='+i+'>&#10005;</button></div>'+
        '<div class="grid4">'+
          '<div class="field"><label>Kind</label><select class="inp" data-comp='+i+' data-k="kind">'+optTags(COMP_KINDS,c.kind||'software')+'</select></div>'+
          '<div class="field"><label>Provenance</label><select class="inp" data-comp='+i+' data-k="provenance">'+optTags(PROVENANCE,c.provenance||'own')+'</select></div>'+
          '<div class="field"><label>Layer</label><input class="inp" type="number" min=1 max=6 data-comp='+i+' data-k="layer" value="'+(+c.layer||1)+'"></div>'+
          '<div class="field"><label>Parent</label><select class="inp" data-comp='+i+' data-k="parent">'+parentSel+'</select></div>'+
        '</div></div>';
    }).join(''):'<p class="hint">No components yet.</p>';
    html+='<button class="btn sm" data-act="addComp">+ Component</button>';
  } else if(sysTab==='interfaces'){
    var iList=system.interfaces||[];
    html+=iList.length?iList.map(function(f,i){
      return '<div class="itemcard"><div class="head"><span class="idtag">'+esc(f.id||('I-'+(i+1)))+'</span>'+
        '<input class="inp grow" data-if='+i+' data-k="name" value="'+esc(f.name||'')+'">'+
        '<button class="btn sm danger" data-act="delIf" data-i='+i+'>&#10005;</button></div>'+
        '<div class="grid4">'+
          '<div class="field"><label>Component</label><select class="inp" data-if='+i+' data-k="component"><option value="">\u2014</option>'+cList.map(function(c){return '<option value="'+esc(c.id)+'"'+((f.component||'')===c.id?' selected':'')+'>'+esc(c.name)+'</option>';}).join('')+'</select></div>'+
          '<div class="field"><label>Category</label><select class="inp" data-if='+i+' data-k="category">'+optTags(IF_CATS,f.category||'network')+'</select></div>'+
          '<div class="field"><label>Exposure</label><select class="inp" data-if='+i+' data-k="exposure">'+optTags(EXPOSURE,f.exposure||'local')+'</select></div>'+
          '<div class="field"><label>Protocol</label><input class="inp" data-if='+i+' data-k="protocol" value="'+esc(f.protocol||'')+'"></div>'+
        '</div></div>';
    }).join(''):'<p class="hint">No interfaces yet.</p>';
    html+='<button class="btn sm" data-act="addIf">+ Interface</button>';
  } else if(sysTab==='boundaries'){
    var bList=system.trustBoundaries||[];
    html+=bList.length?bList.map(function(b,i){
      var mem=cList.length?cList.map(function(c){return chip(c.id,(b.members||[]).indexOf(c.id)>=0,'data-act="tbMem" data-tb='+i+' data-val="'+esc(c.id)+'"',c.name);}).join(''):'<span class="hint">Add components first.</span>';
      return '<div class="itemcard"><div class="head"><span class="idtag">'+esc(b.id||('TB-'+(i+1)))+'</span>'+
        '<input class="inp grow" data-tb='+i+' data-k="name" value="'+esc(b.name||'')+'">'+
        '<button class="btn sm danger" data-act="delTb" data-i='+i+'>&#10005;</button></div>'+
        '<div class="hint">Members \u2014 components enclosed by this boundary</div><div class="chips">'+mem+'</div></div>';
    }).join(''):'<p class="hint">No trust boundaries yet.</p>';
    html+='<button class="btn sm" data-act="addTb">+ Trust boundary</button>';
  } else {
    var aList=system.assets||[];
    html+=aList.length?aList.map(function(a,i){
      var o=a.objectives||{};
      var comp=cList.length?cList.map(function(c){return chip(c.id,(a.components||[]).indexOf(c.id)>=0,'data-act="asComp" data-as='+i+' data-val="'+esc(c.id)+'"',c.name);}).join(''):'<span class="hint">Add components first.</span>';
      var objs=OBJS.map(function(ob){return '<div class="field"><label>'+ob[1]+' \xB7 '+ob[0]+'</label><select class="inp" data-as='+i+' data-obj="'+ob[0]+'">'+[0,1,2,3,4,5].map(function(n){return '<option'+((+o[ob[0]]||0)===n?' selected':'')+'>'+n+'</option>';}).join('')+'</select></div>';}).join('');
      return '<div class="itemcard"><div class="head"><span class="idtag">'+esc(a.id||('AS-'+(i+1)))+'</span>'+
        '<input class="inp grow" data-as='+i+' data-k="name" value="'+esc(a.name||'')+'">'+
        '<button class="btn sm danger" data-act="delAs" data-i='+i+'>&#10005;</button></div>'+
        '<div class="grid3"><div class="field"><label>Type</label><select class="inp" data-as='+i+' data-k="type">'+optTags(ASSET_TYPES,a.type||'function')+'</select></div>'+
          '<div class="field" style="grid-column:span 2"><label>Storage</label><input class="inp" data-as='+i+' data-k="storage" value="'+esc(a.storage||'')+'"></div></div>'+
        '<div class="hint" style="margin-top:6px">Components</div><div class="chips">'+comp+'</div>'+
        '<div class="hint" style="margin-top:6px">Security objectives (0\u20135; impact later defaults to the worst dimension \u2014 Bug Bar)</div><div class="objgrid">'+objs+'</div></div>';
    }).join(''):'<p class="hint">No assets yet.</p>';
    html+='<button class="btn sm" data-act="addAs">+ Asset</button>';
  }
  $('#sys-body').innerHTML=html;
}
function renderRequirements(){
  var list=requirements||[];
  var html=list.length?list.map(function(r,i){
    var th=threats.length?threats.map(function(t){return chip(t.id,(r.derivedFromThreat||[]).indexOf(t.id)>=0,'data-act="reqThreat" data-req='+i+' data-val="'+esc(t.id)+'"',t.title);}).join(''):'<span class="hint">No threats yet (step 06).</span>';
    var cc=cms.length?cms.map(function(c){return chip(c.id,(r.satisfiedByCM||[]).indexOf(c.id)>=0,'data-act="reqCm" data-req='+i+' data-val="'+esc(c.id)+'"',c.title);}).join(''):'<span class="hint">No countermeasures yet (step 08).</span>';
    return '<div class="itemcard"><div class="head" style="align-items:flex-start"><span class="idtag">'+esc(r.id||('R'+(i+1)))+'</span>'+
      '<textarea class="inp grow" rows=2 data-req='+i+' data-k="text" placeholder="Testable security requirement">'+esc(r.text||'')+'</textarea>'+
      '<button class="btn sm danger" data-act="delReq" data-i='+i+'>&#10005;</button></div>'+
      '<div class="grid2">'+
        '<div class="field"><label>Standard reference</label><input class="inp" data-req='+i+' data-k="standardRef" value="'+esc(r.standardRef||'')+'" placeholder="IEC 62443-4-2 CR 1.2"></div>'+
        '<div class="field"><label>SL / Foundational Requirement</label><input class="inp" data-req='+i+' data-k="slFr" value="'+esc(r.slFr||'')+'" placeholder="FR1 SL2"></div>'+
      '</div>'+
      '<div class="hint" style="margin-top:6px">Derived from threats</div><div class="chips">'+th+'</div>'+
      '<div class="hint" style="margin-top:6px">Satisfied by countermeasures</div><div class="chips">'+cc+'</div></div>';
  }).join(''):'<p class="hint">No requirements yet \u2014 derive them from your rated threats.</p>';
  $('#req-body').innerHTML=html;
}
function toast(kind,text){var e=$('#'+kind);e.textContent=text;e.style.display='block';var o=$(kind==='err'?'#ok':'#err');o.style.display='none';if(kind==='ok')setTimeout(function(){e.style.display='none';},2500);}

document.addEventListener('click',function(e){
  var tabEl=e.target.closest('[data-asmtab],[data-systab]');
  if(tabEl){if(tabEl.dataset.asmtab){asmTab=tabEl.dataset.asmtab;renderAssumptions();}else{sysTab=tabEl.dataset.systab;renderSystem();}return;}
  var el=e.target.closest('[data-act],[data-kind],[data-cmd]');
  if(!el)return;
  var act=el.dataset.act, kind=el.dataset.kind, cmd=el.dataset.cmd;
  if(act==='undo'){undo();return;}
  if(act==='redo'){redo();return;}
  if(kind){
    if(kind==='scroll'){var n=document.querySelector(el.dataset.target);if(n)n.scrollIntoView({behavior:'smooth',block:'start'});}
    else if(kind==='cmd'){vs.postMessage({cmd:el.dataset.target});}
    else if(kind==='file'){vs.postMessage({cmd:'openFile',rel:el.dataset.target});}
    return;
  }
  if(cmd){vs.postMessage({cmd:cmd});return;}
  var before=snapshot();
  if(act==='saveP'){vs.postMessage({cmd:'project',name:$('#p-name').value,sl:$('#p-sl').value,mode:$('#p-mode').value,bnd:$('#p-bnd').value});}
  else if(act==='saveT'){vs.postMessage({cmd:'threats',threats:threats,compIds:comps.map(function(c){return c.id;})});}
  else if(act==='saveC'){vs.postMessage({cmd:'cms',cms:cms});}
  else if(act==='addT'){threats.push({id:'T'+(threats.length+1),title:'New threat',stride:['T'],components:[],likelihood:3,impact:3,status:'open'});renderThreats();renderRail();}
  else if(act==='delT'){threats.splice(+el.dataset.i,1);renderThreats();renderRail();}
  else if(act==='addC'){cms.push({id:'CM'+(cms.length+1),title:'New countermeasure',type:'preventive',status:'proposed',addresses:[]});renderCms();renderRail();}
  else if(act==='delC'){cms.splice(+el.dataset.i,1);renderCms();updatePills();renderRail();}
  else if(act==='delAddr'){cms[+el.dataset.c].addresses.splice(+el.dataset.j,1);renderCms();updatePills();}
  else if(act==='addAddr'){cms[+el.dataset.c].addresses.push({threat:el.dataset.val,residualLikelihood:2,residualImpact:2});renderCms();updatePills();}
  else if(act==='saveA'){vs.postMessage({cmd:'assumptions',assumptions:assumptions});}
  else if(act==='saveS'){vs.postMessage({cmd:'system',system:system});}
  else if(act==='addAtk'){assumptions.attacker=assumptions.attacker||[];assumptions.attacker.push({id:uid('ATK-',assumptions.attacker.map(function(x){return x.id;})),name:'New attacker',capability:2,access:'local',motivation:'',resources:'',text:''});asmTab='attacker';renderAssumptions();}
  else if(act==='delAtk'){assumptions.attacker.splice(+el.dataset.i,1);renderAssumptions();}
  else if(act==='addAsm'){var ak=el.dataset.asm;assumptions[ak]=assumptions[ak]||[];assumptions[ak].push({id:uid('A-'+ak.charAt(0).toUpperCase()+'-',assumptions[ak].map(function(x){return x.id;})),text:''});renderAssumptions();}
  else if(act==='delAsm'){assumptions[el.dataset.asm].splice(+el.dataset.i,1);renderAssumptions();}
  else if(act==='addComp'){system.components=system.components||[];system.components.push({id:uid('C-',system.components.map(function(x){return x.id;})),name:'New component',kind:'software',layer:2,parent:(system.components[0]||{}).id||null});sysTab='components';renderSystem();renderThreats();}
  else if(act==='delComp'){system.components.splice(+el.dataset.i,1);renderSystem();renderThreats();}
  else if(act==='addIf'){system.interfaces=system.interfaces||[];system.interfaces.push({id:uid('I-',system.interfaces.map(function(x){return x.id;})),name:'New interface',exposure:'local',category:'network'});sysTab='interfaces';renderSystem();}
  else if(act==='delIf'){system.interfaces.splice(+el.dataset.i,1);renderSystem();}
  else if(act==='addTb'){system.trustBoundaries=system.trustBoundaries||[];system.trustBoundaries.push({id:uid('TB-',system.trustBoundaries.map(function(x){return x.id;})),name:'New boundary',members:[]});sysTab='boundaries';renderSystem();}
  else if(act==='delTb'){system.trustBoundaries.splice(+el.dataset.i,1);renderSystem();}
  else if(act==='addAs'){system.assets=system.assets||[];system.assets.push({id:uid('AS-',system.assets.map(function(x){return x.id;})),name:'New asset',type:'function',components:[],objectives:{confidentiality:1,integrity:3,availability:3,safety:1}});sysTab='assets';renderSystem();}
  else if(act==='delAs'){system.assets.splice(+el.dataset.i,1);renderSystem();}
  else if(act==='tbMem'){var bb=system.trustBoundaries[+el.dataset.tb];bb.members=bb.members||[];var mk=bb.members.indexOf(el.dataset.val);if(mk>=0)bb.members.splice(mk,1);else bb.members.push(el.dataset.val);renderSystem();}
  else if(act==='asComp'){var aa=system.assets[+el.dataset.as];aa.components=aa.components||[];var ck=aa.components.indexOf(el.dataset.val);if(ck>=0)aa.components.splice(ck,1);else aa.components.push(el.dataset.val);renderSystem();}
  else if(act==='saveR'){vs.postMessage({cmd:'requirements',requirements:requirements});}
  else if(act==='addReq'){requirements=requirements||[];requirements.push({id:uid('R',requirements.map(function(x){return x.id;})),text:'',standardRef:'',slFr:'',derivedFromThreat:[],satisfiedByCM:[]});renderRequirements();}
  else if(act==='delReq'){requirements.splice(+el.dataset.i,1);renderRequirements();}
  else if(act==='reqThreat'){var rq=requirements[+el.dataset.req];rq.derivedFromThreat=rq.derivedFromThreat||[];var rk=rq.derivedFromThreat.indexOf(el.dataset.val);if(rk>=0)rq.derivedFromThreat.splice(rk,1);else rq.derivedFromThreat.push(el.dataset.val);renderRequirements();}
  else if(act==='reqCm'){var rc=requirements[+el.dataset.req];rc.satisfiedByCM=rc.satisfiedByCM||[];var rck=rc.satisfiedByCM.indexOf(el.dataset.val);if(rck>=0)rc.satisfiedByCM.splice(rck,1);else rc.satisfiedByCM.push(el.dataset.val);renderRequirements();}
  else if(el.classList.contains('chip')&&el.dataset.role){
    var i=+el.dataset.i,val=el.dataset.val,arrKey=el.dataset.role==='stride'?'stride':'components';
    var arr=threats[i][arrKey]||(threats[i][arrKey]=[]);var k=arr.indexOf(val);if(k>=0)arr.splice(k,1);else arr.push(val);
    renderThreats();
  }
  recordChanged(before);
});
document.addEventListener('input',function(e){
  var t=e.target;
  recordBefore(keyOf(t));
  if(t.id==='p-name'){project.name=t.value;$('#devname').textContent=t.value?('\xB7 '+t.value):'';return;}
  if(t.id==='p-sl'){project.sl=t.value;return;}
  if(t.id==='p-mode'){project.mode=t.value;return;}
  if(t.id==='p-bnd'){project.boundary=t.value;return;}
  if(t.dataset.i!==undefined&&t.dataset.k){var i=+t.dataset.i,k=t.dataset.k;
    if(k==='likelihood'||k==='impact'){threats[i][k]=Math.max(1,Math.min(5,+t.value||1));var el=document.getElementById('tp-'+i);if(el)el.innerHTML=riskCell(threats[i]);}
    else if(k==='status'){threats[i].status=t.value;var cell=t.closest('td');var bd=cell&&cell.querySelector('.badge');if(bd){bd.className='badge st-'+t.value;bd.textContent=statusLabel(t.value);}}
    else threats[i][k]=t.value;return;}
  if(t.dataset.ci!==undefined&&t.dataset.k){cms[+t.dataset.ci][t.dataset.k]=t.value;return;}
  if(t.dataset.c!==undefined&&t.dataset.j!==undefined&&t.dataset.k){cms[+t.dataset.c].addresses[+t.dataset.j][t.dataset.k]=Math.max(1,Math.min(5,+t.value||1));updatePills();return;}
  if(t.dataset.atk!==undefined&&t.dataset.k){var p=assumptions.attacker[+t.dataset.atk];if(p)p[t.dataset.k]=(t.dataset.k==='capability')?(+t.value||2):t.value;return;}
  if(t.dataset.asm!==undefined&&t.dataset.ai!==undefined&&t.dataset.k){var arr=assumptions[t.dataset.asm];if(arr&&arr[+t.dataset.ai])arr[+t.dataset.ai][t.dataset.k]=t.value;return;}
  if(t.dataset.comp!==undefined&&t.dataset.k){var c=system.components[+t.dataset.comp];if(c)c[t.dataset.k]=(t.dataset.k==='layer')?(+t.value||1):(t.dataset.k==='parent'?(t.value||null):t.value);return;}
  if(t.dataset.if!==undefined&&t.dataset.k){var f=system.interfaces[+t.dataset.if];if(f)f[t.dataset.k]=t.value;return;}
  if(t.dataset.tb!==undefined&&t.dataset.k){var b=system.trustBoundaries[+t.dataset.tb];if(b)b[t.dataset.k]=t.value;return;}
  if(t.dataset.as!==undefined){var a=system.assets[+t.dataset.as];if(!a)return;if(t.dataset.obj){a.objectives=a.objectives||{};a.objectives[t.dataset.obj]=Math.max(0,Math.min(5,+t.value||0));}else if(t.dataset.k){a[t.dataset.k]=t.value;}return;}
  if(t.dataset.req!==undefined&&t.dataset.k){var rr=requirements[+t.dataset.req];if(rr)rr[t.dataset.k]=t.value;return;}
});

window.addEventListener('message',function(ev){
  var m=ev.data;
  if(m.cmd==='init'){threats=m.data.threats||[];cms=m.data.cms||[];comps=m.data.comps||[];counts=m.data.counts||{};assumptions=m.data.assumptions||assumptions;system=m.data.system||system;requirements=m.data.requirements||[];renderProject(m.data.project);renderThreats();renderCms();renderAssumptions();renderSystem();renderRequirements();renderRail();clearHistory();}
  else if(m.cmd==='threats'){threats=m.threats||[];counts=m.counts||counts;renderThreats();renderCms();renderRequirements();renderRail();toast('ok',m.text);}
  else if(m.cmd==='cms'){cms=m.cms||[];counts=m.counts||counts;renderCms();updatePills();renderRequirements();renderRail();toast('ok',m.text);}
  else if(m.cmd==='assumptions'){assumptions=m.assumptions||assumptions;counts=m.counts||counts;renderAssumptions();renderRail();toast('ok',m.text);}
  else if(m.cmd==='system'){system=m.system||system;comps=m.comps||comps;counts=m.counts||counts;renderSystem();renderThreats();renderRail();toast('ok',m.text);}
  else if(m.cmd==='requirements'){requirements=m.requirements||requirements;counts=m.counts||counts;renderRequirements();renderRail();toast('ok',m.text);}
  else if(m.cmd==='msg'){counts=m.counts||counts;renderRail();toast('ok',m.text);}
  else if(m.cmd==='err'){toast('err',m.text);}
});
document.addEventListener('keydown',function(e){
  if(!(e.ctrlKey||e.metaKey)||e.altKey)return;
  var k=e.key.toLowerCase();
  if(k==='z'&&!e.shiftKey){e.preventDefault();undo();}
  else if(k==='y'||(k==='z'&&e.shiftKey)){e.preventDefault();redo();}
});
vs.postMessage({cmd:'ready'});
})();
</script></body></html>`;
}

// src/kbBrowser.ts
var vscode2 = __toESM(require("vscode"));
var path = __toESM(require("node:path"));
var import_promises = require("node:fs/promises");
var esc2 = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
var decoder = new TextDecoder();
async function readJson(u, def) {
  try {
    return JSON.parse(decoder.decode(await vscode2.workspace.fs.readFile(u)));
  } catch {
    return def;
  }
}
async function activeProject() {
  const p = await vscode2.workspace.findFiles("**/01-project-description/project.json", "**/node_modules/**", 1);
  return p[0] ? vscode2.Uri.joinPath(p[0], "..", "..") : void 0;
}
async function openKbBrowser(ctx) {
  const workspaceLibs = await vscode2.workspace.findFiles("**/knowledge-base/**/*.json", "**/node_modules/**");
  const runtimeLib = vscode2.Uri.joinPath(ctx.extensionUri, "runtime", ".assets", "knowledge-base", "field-device-library.json");
  const importedRoot = vscode2.Uri.joinPath(ctx.globalStorageUri, "knowledge-base", "imported");
  const importedLibs = [];
  try {
    const stack = [importedRoot.fsPath];
    while (stack.length) {
      const dir = stack.pop();
      for (const entry of await (0, import_promises.readdir)(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) stack.push(full);
        else if (entry.isFile() && entry.name.toLowerCase().endsWith(".json")) importedLibs.push(vscode2.Uri.file(full));
      }
    }
  } catch {
  }
  const libs = [runtimeLib, ...workspaceLibs, ...importedLibs];
  const threats = [];
  const cms = [];
  for (const u of libs) {
    const j = await readJson(u, {});
    (j.threats || []).forEach((t) => threats.push({ ...t, _src: u.path.split("/").pop() }));
    (j.countermeasures || []).forEach((c) => cms.push({ ...c, _src: u.path.split("/").pop() }));
  }
  const panel = vscode2.window.createWebviewPanel("traKb", "EmbedRisk \xB7 Knowledge Base", vscode2.ViewColumn.One, { enableScripts: true, localResourceRoots: [vscode2.Uri.joinPath(ctx.extensionUri, "media")] });
  const cssUri = panel.webview.asWebviewUri(vscode2.Uri.joinPath(ctx.extensionUri, "media", "tra-ui.css"));
  const logoUri = panel.webview.asWebviewUri(vscode2.Uri.joinPath(ctx.extensionUri, "media", "embedrisk-logo.svg"));
  const nonce = String(Math.random()).slice(2);
  const csp = `default-src 'none'; img-src ${panel.webview.cspSource}; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;
  const tRows = threats.map((t, i) => `<tr><td class=idcell>${esc2(t.key)}</td><td>${esc2(t.title)}</td><td><span class="chip static">${esc2((t.stride || []).join(""))}</span></td><td class=hint>${esc2((t.appliesTo || []).join(", "))}</td><td>${esc2(t.typicalImpact ?? "")}</td><td><button class="btn sm primary" data-act="threat" data-i="${i}">Add to project</button></td></tr>`).join("");
  const cRows = cms.map((c, i) => `<tr><td class=idcell>${esc2(c.key)}</td><td>${esc2(c.title)}</td><td class=hint>${esc2((c.for || []).join(", "))}</td><td><button class="btn sm primary" data-act="cm" data-i="${i}">Add to project</button></td></tr>`).join("");
  panel.webview.html = `<!doctype html><html><head><meta charset="utf8"><meta http-equiv="Content-Security-Policy" content="${csp}"><link rel="stylesheet" href="${cssUri}"></head><body>
  <div class="topbar"><div class="brand"><img class="logo" src="${logoUri}" alt="" width="22" height="22"><span>EmbedRisk <small>\xB7 Knowledge base</small></span></div></div>
  <div class="main">
  <p class="hint">Reusable, device-class threats and countermeasures. Imported items are added to the active project; you still assign affected components / links in the wizard, where plausibility is enforced.</p>
  <div class="card"><h2>Threats</h2><table class="grid"><thead><tr><th>Key</th><th>Title</th><th>STRIDE</th><th>Applies to</th><th>Impact</th><th></th></tr></thead><tbody>${tRows || "<tr><td colspan=6 class=hint>No catalogue found.</td></tr>"}</tbody></table></div>
  <div class="card"><h2>Countermeasures</h2><table class="grid"><thead><tr><th>Key</th><th>Title</th><th>For</th><th></th></tr></thead><tbody>${cRows || "<tr><td colspan=4 class=hint>No catalogue found.</td></tr>"}</tbody></table></div>
  </div>
  <script nonce="${nonce}">const v=acquireVsCodeApi();document.addEventListener('click',function(e){var b=e.target.closest('button[data-act]');if(!b)return;v.postMessage({cmd:'import',kind:b.dataset.act,i:+b.dataset.i});});</script>
  </body></html>`;
  panel.webview.onDidReceiveMessage(async (m) => {
    if (m.cmd !== "import") return;
    const proj = await activeProject();
    if (!proj) {
      vscode2.window.showWarningMessage("No active TRA project found.");
      return;
    }
    if (m.kind === "threat") {
      const src = threats[m.i];
      const u = vscode2.Uri.joinPath(proj, "06-threats/threats.json");
      const doc = await readJson(u, { threats: [] });
      const ids = new Set((doc.threats || []).map((t) => t.id));
      let id = "T-" + src.key;
      let n = 1;
      while (ids.has(id)) id = `T-${src.key}-${++n}`;
      doc.threats = doc.threats || [];
      doc.threats.push({ id, title: src.title, stride: src.stride || [], components: [], assets: [], likelihood: 3, impact: src.typicalImpact || 3, status: "open", source: "knowledge-base:" + src.key });
      await vscode2.workspace.fs.writeFile(u, Buffer.from(JSON.stringify(doc, null, 2)));
      vscode2.window.showInformationMessage(`Imported threat ${id}. Assign affected components in the wizard before saving.`);
    } else {
      const src = cms[m.i];
      const u = vscode2.Uri.joinPath(proj, "08-countermeasures/countermeasures.json");
      const doc = await readJson(u, { countermeasures: [] });
      const ids = new Set((doc.countermeasures || []).map((c) => c.id));
      let id = "CM-" + src.key;
      let n = 1;
      while (ids.has(id)) id = `CM-${src.key}-${++n}`;
      doc.countermeasures = doc.countermeasures || [];
      doc.countermeasures.push({ id, title: src.title, type: "preventive", status: "proposed", components: [], addresses: [], source: "knowledge-base:" + src.key });
      await vscode2.workspace.fs.writeFile(u, Buffer.from(JSON.stringify(doc, null, 2)));
      vscode2.window.showInformationMessage(`Imported countermeasure ${id}. Link it to threats in the wizard.`);
    }
  }, void 0, ctx.subscriptions);
}

// src/dfdEditor.ts
var vscode3 = __toESM(require("vscode"));

// ../tools/drawio-to-dfd.mjs
var TYPE = (style = "") => style.includes("partialRectangle") ? "store" : style.includes("ellipse") ? "process" : style.includes("dashed") ? "trust-boundary" : "external-entity";
function drawioToDfd(xml, prev = { nodes: [], flows: [] }, layer2 = 1, parentFilter = void 0) {
  const meta = new Map(prev.nodes.map((n) => [n.id, n]));
  const cells = [...xml.matchAll(/<mxCell\s+([^>]*?)\/?>(?:.*?<\/mxCell>)?/gs)].map((m) => m[1]);
  const attr = (s, k) => (s.match(new RegExp(`${k}="([^"]*)"`)) || [, ""])[1];
  const nodes = [], flows = [];
  for (const s of cells) {
    const id = attr(s, "id");
    if (!id || id === "0" || id === "1") continue;
    if (/edge="1"/.test(s)) flows.push({ id, label: attr(s, "value"), from: attr(s, "source"), to: attr(s, "target") });
    else if (/vertex="1"/.test(s)) {
      const p = meta.get(id) || {};
      nodes.push({ id, label: attr(s, "value"), type: TYPE(attr(s, "style")), layer: p.layer ?? layer2, parent: p.parent ?? (parentFilter !== void 0 ? parentFilter : null) });
    }
  }
  const inView = (n) => parentFilter !== void 0 ? (n.parent ?? null) === parentFilter : n.layer === layer2;
  const others = prev.nodes.filter((n) => !inView(n));
  return { nodes: [...others, ...nodes], flows: [...prev.flows.filter((f) => !nodes.find((n) => n.id === f.from)), ...flows] };
}

// src/dfdEditor.ts
var DfdEditor = class {
  constructor(extUri) {
    this.extUri = extUri;
  }
  layer = 1;
  async resolveCustomTextEditor(doc, panel) {
    const media = vscode3.Uri.joinPath(this.extUri, "media", "drawio");
    const q = "?embed=1&proto=json&spin=1&libraries=1&noSaveBtn=1&autosave=1";
    let base = "https://embed.diagrams.net/" + q;
    let local = "";
    try {
      await vscode3.workspace.fs.stat(vscode3.Uri.joinPath(media, "index.html"));
      base = panel.webview.asWebviewUri(vscode3.Uri.joinPath(media, "index.html")).toString() + q;
      local = media.toString();
    } catch {
    }
    panel.webview.options = { enableScripts: true, localResourceRoots: local ? [media] : [] };
    const dfd = () => JSON.parse(doc.getText() || '{"nodes":[],"flows":[]}');
    const writeDfd = async (obj) => {
      const ed = new vscode3.WorkspaceEdit();
      ed.replace(doc.uri, new vscode3.Range(0, 0, doc.lineCount, 0), JSON.stringify(obj, null, 2));
      await vscode3.workspace.applyEdit(ed);
    };
    let focus = null;
    const path3 = [];
    const parent = () => path3.length ? path3[path3.length - 1] : null;
    const lbl = (id) => dfd().nodes.find((n) => n.id === id)?.label ?? id;
    const sibs = () => dfd().nodes.filter((n) => (n.parent ?? null) === parent() && n.type !== "trust-boundary");
    const ensureFocus = () => {
      if (!focus) {
        const s = sibs();
        if (s.length) focus = s[0].id;
      }
    };
    const push = () => {
      ensureFocus();
      panel.webview.postMessage({ type: "load", xml: dfdToDrawio(dfd(), path3.length + 1, focus, parent()) });
    };
    const status = () => {
      ensureFocus();
      const crumb = ["root", ...path3.map((id) => lbl(id))].join(" / ");
      const cur = sibs().find((n) => n.id === focus);
      panel.webview.postMessage({ type: "status", layer: crumb, label: cur ? cur.label : "(none)" });
    };
    const csp = `default-src 'none'; img-src ${panel.webview.cspSource} https: data:; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src ${panel.webview.cspSource} 'unsafe-inline'; frame-src ${panel.webview.cspSource} https://embed.diagrams.net;`;
    panel.webview.html = `<!doctype html><meta charset=utf8><meta http-equiv="Content-Security-Policy" content="${csp}"><style>html,body{height:100%;margin:0}#f{position:absolute;top:30px;left:0;right:0;bottom:0;width:100%;border:0}#bar{height:30px;box-sizing:border-box;background:#222;color:#fff;padding:5px 8px;font:12px system-ui}button{font:11px system-ui;margin:0 2px}</style>
    <div id=bar><b id=l>root</b> <button title="parent" onclick="nav(-1)">&#9650;</button><button title="into component" onclick="nav(1)">&#9660;</button> &middot; component <b id=c>(none)</b> <button onclick="sib(-1)">&#9664;</button><button onclick="sib(1)">&#9654;</button> &middot; Ctrl+Alt+arrows &middot; autosaves</div>
    <iframe id=f src="${base}"></iframe>
    <script>const v=acquireVsCodeApi(),f=document.getElementById('f'),lEl=document.getElementById('l'),cEl=document.getElementById('c');let xml='';
    function nav(d){v.postMessage({type:'nav',dir:d});}function sib(d){v.postMessage({type:'sib',dir:d});}
    addEventListener('message',e=>{const d=e.data;if(d&&d.type==='load'){xml=d.xml;f.contentWindow.postMessage(JSON.stringify({action:'load',xml}),'*');return;}if(d&&d.type==='status'){lEl.textContent=d.layer;cEl.textContent=d.label;return;}let p=d;if(typeof d==='string'){try{p=JSON.parse(d);}catch{return;}}if(!p||!p.event)return;if(p.event==='init')f.contentWindow.postMessage(JSON.stringify({action:'load',xml}),'*');if(p.event==='autosave'||p.event==='save')v.postMessage({type:'save',xml:p.xml});});
    onkeydown=e=>{if(e.ctrlKey&&e.altKey){if(e.key==='ArrowDown'){nav(1);e.preventDefault();}if(e.key==='ArrowUp'){nav(-1);e.preventDefault();}if(e.key==='ArrowRight'){sib(1);e.preventDefault();}if(e.key==='ArrowLeft'){sib(-1);e.preventDefault();}}};</script>`;
    panel.webview.onDidReceiveMessage(async (m) => {
      if (m.type === "save") {
        await writeDfd(drawioToDfd(m.xml, dfd(), path3.length + 1, parent()));
      } else if (m.type === "nav" && m.dir > 0) {
        if (!focus) {
          vscode3.window.showInformationMessage("Select a component with \u25C0 \u25B6 first, then descend.");
          return;
        }
        const kids = dfd().nodes.filter((n) => (n.parent ?? null) === focus);
        if (!kids.length) {
          const c = await vscode3.window.showInformationMessage(`'${lbl(focus)}' has no sub-components. Create one?`, "Create", "Cancel");
          if (c !== "Create") return;
          const d = dfd();
          d.nodes.push({ id: `N-${focus}-1`, label: `Sub-component of ${lbl(focus)}`, type: "process", parent: focus, layer: path3.length + 2 });
          await writeDfd(d);
        }
        path3.push(focus);
        focus = null;
        push();
        status();
      } else if (m.type === "nav") {
        if (path3.length) {
          path3.pop();
          focus = null;
          push();
          status();
        }
      } else if (m.type === "sib") {
        const s = sibs();
        if (s.length) {
          let i = s.findIndex((n) => n.id === focus);
          i = (i + (m.dir > 0 ? 1 : -1) + s.length) % s.length;
          focus = s[i].id;
          push();
          status();
        }
      }
    });
    setTimeout(() => {
      push();
      status();
    }, 1200);
  }
};

// src/nativeDfdEditor.ts
var vscode4 = __toESM(require("vscode"));
var NativeDfdEditor = class {
  constructor(extUri) {
    this.extUri = extUri;
  }
  async resolveCustomTextEditor(doc, panel) {
    const media = vscode4.Uri.joinPath(this.extUri, "media");
    panel.webview.options = { enableScripts: true, localResourceRoots: [media] };
    const modelUri = panel.webview.asWebviewUri(vscode4.Uri.joinPath(media, "dfd-model.js"));
    const cssUri = panel.webview.asWebviewUri(vscode4.Uri.joinPath(media, "tra-ui.css"));
    const logoUri = panel.webview.asWebviewUri(vscode4.Uri.joinPath(media, "embedrisk-logo.svg"));
    const nonce = String(Math.random()).slice(2);
    const csp = `default-src 'none'; img-src ${panel.webview.cspSource}; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${panel.webview.cspSource};`;
    const projRoot = vscode4.Uri.joinPath(doc.uri, "..", "..");
    const readComponents = async () => {
      try {
        const sys = JSON.parse(Buffer.from(await vscode4.workspace.fs.readFile(vscode4.Uri.joinPath(projRoot, "03-system-assets/system.json"))).toString());
        return (sys.components || []).map((c) => ({ id: c.id, name: c.name }));
      } catch {
        return [];
      }
    };
    let lastText = "";
    const post = async () => panel.webview.postMessage({ type: "load", dfd: doc.getText() || '{"nodes":[],"flows":[]}', components: await readComponents() });
    const save = async (text) => {
      lastText = text;
      const ed = new vscode4.WorkspaceEdit();
      ed.replace(doc.uri, new vscode4.Range(0, 0, doc.lineCount, 0), text);
      await vscode4.workspace.applyEdit(ed);
    };
    panel.webview.html = this.html(modelUri, cssUri, logoUri, csp, nonce);
    const sub = vscode4.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === doc.uri.toString() && e.document.getText() !== lastText) post();
    });
    panel.onDidDispose(() => sub.dispose());
    panel.webview.onDidReceiveMessage(async (m) => {
      if (m.type === "ready") {
        await post();
      } else if (m.type === "save") {
        await save(m.dfd);
      }
    });
  }
  html(modelUri, cssUri, logoUri, csp, nonce) {
    return `<!doctype html><html><head><meta charset="utf8"><meta http-equiv="Content-Security-Policy" content="${csp}">
<link rel="stylesheet" href="${cssUri}">
<style>
html,body{height:100%;margin:0;font:13px system-ui;color:var(--text);background:var(--bg)}
body{display:flex;flex-direction:column}
#bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:7px 10px;background:var(--surface);color:var(--text);border-bottom:1px solid var(--border);flex:0 0 auto;z-index:2}
#bar b{margin-right:6px}
#bar button{font:12px system-ui;padding:4px 9px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);border-radius:7px;cursor:pointer}
#bar button:hover{background:var(--surface-2)}
#bar button.on{background:var(--accent);border-color:var(--accent);color:#fff}
#bar button:disabled{opacity:.4;cursor:default}
#bar button:disabled:hover{background:var(--surface)}
#bar .brand{display:flex;align-items:center;gap:6px;margin-right:2px}
#bar .brand .logo{width:18px;height:18px;display:block}
#bar select{font:12px system-ui;padding:3px 6px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);border-radius:7px;max-width:190px}
#crumb{color:var(--accent);margin-right:8px}
#status{color:var(--accent-2);font-size:11px}
#hint{margin-left:auto;color:var(--text-faint);font-size:11px}
#body{flex:1 1 auto;display:flex;min-height:0}
#wrap{flex:1 1 auto;min-height:0;overflow:auto;position:relative;color:var(--text)}
#insp{flex:0 0 300px;border-left:1px solid var(--border);background:var(--surface);overflow:auto;padding:12px}
#insp h3{font-size:13px;margin:0 0 8px}
svg{display:block}
#ov{position:fixed;inset:0;background:rgba(0,0,0,.4);display:none;align-items:center;justify-content:center;z-index:10}
#ovbox{background:var(--surface);color:var(--text);padding:14px;border-radius:8px;min-width:280px;border:1px solid var(--border)}
#ovbox input{width:100%;padding:6px;margin:8px 0;background:var(--surface);color:var(--text);border:1px solid var(--border-strong);border-radius:6px}
#ovbox .r{display:flex;gap:8px;justify-content:flex-end}
.conn{display:flex;align-items:center;gap:6px;margin:4px 0}
.conn .peer{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style></head><body>
<div id="bar">
  <span class="brand"><img class="logo" src="${logoUri}" alt=""><b>EmbedRisk</b></span>
  <span id="crumb">root</span>
  <button data-act="up" title="parent layer (Backspace)">&#9650; up</button>
  <button data-act="down" title="into component (Enter)">&#9660; in</button>
  <select id="sel" title="Select a node or trust boundary to edit"><option value="">Select&hellip;</option></select>
  <span style="width:8px"></span>
  <button data-act="add" data-type="external-entity" title="x">+ External</button>
  <button data-act="add" data-type="process" title="p">+ Process</button>
  <button data-act="add" data-type="multiprocess" title="m">+ Multiproc</button>
  <button data-act="add" data-type="store" title="s">+ Store</button>
  <button data-act="add" data-type="trust-boundary" title="b">+ Boundary</button>
  <button id="cbtn" data-act="connect" title="t">Connect</button>
  <button data-act="del" title="d / Del">Delete</button>
  <span style="width:8px"></span>
  <button id="undo" data-act="undo" title="Undo (Ctrl+Z)" disabled>&#8630; Undo</button>
  <button id="redo" data-act="redo" title="Redo (Ctrl+Shift+Z)" disabled>&#8631; Redo</button>
  <span id="status"></span>
  <span id="hint">&larr;&rarr; select &middot; Enter in &middot; Backspace up &middot; t connect &middot; drag to move &middot; Ctrl+Z undo</span>
</div>
<div id="body">
  <div id="wrap"><svg id="cv" xmlns="http://www.w3.org/2000/svg"></svg></div>
  <aside id="insp"></aside>
</div>
<div id="ov"><div id="ovbox"><div id="ovlabel"></div><input id="ovinput"><div class="r"><button class="btn" id="ovcancel">Cancel</button><button class="btn primary" id="ovok">OK</button></div></div></div>
<script nonce="${nonce}" src="${modelUri}"></script>
<script nonce="${nonce}">
const M=DfdModel, vs=acquireVsCodeApi();
const TYPES=['external-entity','process','multiprocess','store','trust-boundary'];
let dfd={nodes:[],flows:[]}, components=[], stack=[], focus=null, connect=false, connectFrom=null;
let drag=null, dragMoved=false, dragging=false;
const $=id=>document.getElementById(id);
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function cur(){return stack.length?stack[stack.length-1]:null;}
function sibs(){return M.siblings(dfd,cur());}
function node(id){return dfd.nodes.find(x=>x.id===id);}
function label(id){var n=node(id);return n?n.label:id;}
function ensureFocus(){var s=sibs();var n=focus?node(focus):null;var pv=n?(n.parent==null?null:n.parent):undefined;if(!n||pv!==cur())focus=s.length?s[0].id:null;}

/* ---- undo / redo: webview-local snapshots of dfd.json, mirroring the tra-webapp history ---- */
let undoStack=[], redoStack=[], baseState=null, histKey='', histTime=0;
function snap(){return JSON.stringify(dfd);}
function updUndo(){var u=$('undo'),r=$('redo');if(u)u.disabled=!undoStack.length;if(r)r.disabled=!redoStack.length;}
function commit(key){
  var now=Date.now();
  var coalesce=undoStack.length&&key&&key===histKey&&(now-histTime<800);
  if(baseState!=null&&!coalesce){undoStack.push(baseState);if(undoStack.length>120)undoStack.shift();redoStack=[];}
  histKey=key||('u'+now);histTime=now;baseState=snap();updUndo();
  vs.postMessage({type:'save',dfd:JSON.stringify(dfd,null,2)});
}
function persist(key){commit(key||'');}
function restore(json){try{dfd=JSON.parse(json);}catch(_){return false;}if(!dfd.nodes)dfd.nodes=[];if(!dfd.flows)dfd.flows=[];return true;}
function undo(){if(!undoStack.length)return;redoStack.push(snap());var p=undoStack.pop();if(!restore(p))return;baseState=p;histKey='';focus=null;updUndo();vs.postMessage({type:'save',dfd:JSON.stringify(dfd,null,2)});draw();}
function redo(){if(!redoStack.length)return;undoStack.push(snap());var n=redoStack.pop();if(!restore(n))return;baseState=n;histKey='';focus=null;updUndo();vs.postMessage({type:'save',dfd:JSON.stringify(dfd,null,2)});draw();}

function drawCanvas(){
  var inner=M.render(dfd,cur(),focus);
  var ns=M.viewNodes(dfd,cur());
  var maxX=600,maxY=400;
  ns.forEach(function(n){if(typeof n.x==='number')maxX=Math.max(maxX,n.x+220);if(typeof n.y==='number')maxY=Math.max(maxY,n.y+180);});
  var cv=$('cv');cv.setAttribute('width',maxX);cv.setAttribute('height',maxY);
  cv.innerHTML="<defs><marker id='arrow' markerWidth='9' markerHeight='9' refX='8' refY='3' orient='auto'><path d='M0,0L8,3L0,6' fill='#888'/></marker></defs>"+inner;
  $('crumb').textContent=['root'].concat(stack.map(label)).join(' / ');
  $('cbtn').className=connect?'on':'';
  $('status').textContent=connect?(connectFrom?('Connect: click the target for '+label(connectFrom)):'Connect: click the source node'):'';
}
function chip(text,on,attrs,title){return '<span class="chip'+(on?' on':'')+'" role="button" tabindex="0" '+attrs+(title?' title="'+esc(title)+'"':'')+'>'+esc(text)+'</span>';}
function renderInspector(){
  var n=focus?node(focus):null;
  if(!n){$('insp').innerHTML='<h3>Inspector</h3><p class="hint">Select a node (click it, or use the arrow keys). Click a boundary label to edit its members.</p>';return;}
  var isTb=n.type==='trust-boundary';
  var html='<h3>Selected '+(isTb?'trust boundary':'node')+'</h3>';
  html+='<div class="field"><label>Label</label><input class="inp" id="ins-label" value="'+esc(n.label)+'"></div>';
  html+='<div class="field"><label>Type</label><select class="inp" id="ins-type">'+TYPES.map(function(t){return '<option'+(n.type===t?' selected':'')+'>'+t+'</option>';}).join('')+'</select></div>';
  if(isTb){
    var opts=sibs();
    html+='<div class="field"><label>Members (a boundary must contain at least one node)</label><div class="chips">'+
      (opts.length?opts.map(function(s){return chip(s.label,(n.members||[]).indexOf(s.id)>=0,'data-mem="'+esc(s.id)+'"');}).join(''):'<span class="hint">No nodes on this layer yet.</span>')+'</div></div>';
  } else {
    html+='<div class="field"><label>Linked component</label><select class="inp" id="ins-comp"><option value="">&mdash; none &mdash;</option>'+
      components.map(function(c){return '<option value="'+esc(c.id)+'"'+(n.componentRef===c.id?' selected':'')+'>'+esc(c.name)+' ('+esc(c.id)+')</option>';}).join('')+'</select></div>';
    var conns=dfd.flows.filter(function(f){return f.from===n.id||f.to===n.id;});
    html+='<h3 style="margin-top:12px">Data flow</h3>';
    html+=conns.length?conns.map(function(f){var out=f.from===n.id;var other=out?f.to:f.from;
      return '<div class="conn"><span>'+(out?'&rarr;':'&larr;')+'</span><span class="peer" title="'+esc(label(other))+'">'+esc(label(other))+'</span>'+
        '<input class="inp" style="width:88px" placeholder="label" data-flow="'+esc(f.id)+'" value="'+esc(f.label||'')+'"><button class="btn sm danger" data-delflow="'+esc(f.id)+'">&#10005;</button></div>';
    }).join(''):'<p class="hint">No data flow yet.</p>';
    var others=sibs().filter(function(s){return s.id!==n.id;});
    html+='<div class="conn" style="margin-top:8px"><select class="inp" id="ins-dir" style="width:72px"><option value="out">&rarr; to</option><option value="in">&larr; from</option></select>'+
      '<select class="inp" id="ins-target" style="flex:1"><option value="">Node&hellip;</option>'+others.map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.label)+'</option>';}).join('')+'</select>'+
      '<button class="btn sm" id="ins-addflow">+ Add</button></div>';
  }
  $('insp').innerHTML=html;
}
function renderSel(){
  var sel=$('sel');if(!sel)return;
  var vn=M.viewNodes(dfd,cur());
  sel.innerHTML='<option value="">Select&hellip;</option>'+vn.map(function(n){
    var tag=n.type==='trust-boundary'?' (boundary)':'';
    return '<option value="'+esc(n.id)+'"'+(n.id===focus?' selected':'')+'>'+esc(n.label)+tag+'</option>';
  }).join('');
  sel.value=focus||'';
}
function draw(){ensureFocus();drawCanvas();renderInspector();renderSel();}

function selectNode(id){
  var n=node(id);if(!n)return;
  if(connect){
    if(n.type==='trust-boundary')return;
    if(!connectFrom){connectFrom=id;}
    else{if(connectFrom!==id){M.addFlow(dfd,connectFrom,id);persist();}connectFrom=null;connect=false;}
    focus=id;draw();return;
  }
  focus=id;draw();
}
function step(dir){var s=sibs();if(!s.length)return;var i=s.findIndex(function(n){return n.id===focus;});i=(i+dir+s.length)%s.length;focus=s[i].id;draw();}
function up(){if(stack.length){stack.pop();focus=null;draw();}}
function down(){
  var n=focus?node(focus):null;if(!n||n.type==='trust-boundary')return;
  var kids=M.children(dfd,focus);
  if(!kids.length){
    confirmBox("'"+label(focus)+"' has no sub-components. Create a child layer?",function(ok){
      if(!ok)return;var child=M.addNode(dfd,focus,'process','Sub-component');stack.push(focus);focus=child.id;persist();draw();
    });return;
  }
  stack.push(focus);focus=null;draw();
}
function add(type){
  var n=M.addNode(dfd,cur(),type,'New '+type.replace('-',' '));
  if(type==='trust-boundary'){n.members=[];delete n.x;delete n.y;}
  focus=n.id;persist('add');draw();
  promptBox('Name for new '+type,n.label,function(v){if(v!=null&&v!==''){n.label=v;persist('add');draw();}});
}
function del(){if(!focus)return;var id=focus;confirmBox("Delete '"+label(id)+"'"+(M.children(dfd,id).length?" and its sub-components":"")+"?",function(ok){if(!ok)return;M.deleteNode(dfd,id);focus=null;persist();draw();});}
function toggleConnect(){connect=!connect;connectFrom=null;draw();}

let ovCb=null,ovMode=null;
function promptBox(lbl,val,cb){ovMode='prompt';ovCb=cb;$('ovlabel').textContent=lbl;$('ovinput').style.display='';$('ovinput').value=val||'';$('ov').style.display='flex';$('ovinput').focus();}
function confirmBox(lbl,cb){ovMode='confirm';ovCb=cb;$('ovlabel').textContent=lbl;$('ovinput').style.display='none';$('ov').style.display='flex';}
function ovOk(){var cb=ovCb,mode=ovMode,v=$('ovinput').value;$('ov').style.display='none';ovCb=null;if(cb){mode==='confirm'?cb(true):cb(v);}}
function ovCancel(){var cb=ovCb,mode=ovMode;$('ov').style.display='none';ovCb=null;if(cb&&mode==='confirm')cb(false);}

/* canvas mouse: click selects, drag moves (small threshold so a click is never treated as a drag) */
const cv=$('cv');
cv.addEventListener('mousedown',function(e){var g=e.target.closest&&e.target.closest('[data-id]');if(!g)return;var id=g.getAttribute('data-id');var n=node(id);if(!n)return;dragMoved=false;dragging=true;drag={id:id,sx:e.clientX,sy:e.clientY,ox:typeof n.x==='number'?n.x:0,oy:typeof n.y==='number'?n.y:0};});
window.addEventListener('mousemove',function(e){if(!dragging||!drag)return;if(!dragMoved&&Math.abs(e.clientX-drag.sx)<4&&Math.abs(e.clientY-drag.sy)<4)return;var n=node(drag.id);if(!n||n.type==='trust-boundary')return;n.x=Math.max(0,drag.ox+(e.clientX-drag.sx));n.y=Math.max(0,drag.oy+(e.clientY-drag.sy));dragMoved=true;drawCanvas();});
window.addEventListener('mouseup',function(){if(dragging&&drag){if(dragMoved)persist('move:'+drag.id);else selectNode(drag.id);}dragging=false;drag=null;});

/* toolbar */
$('bar').addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button[data-act]');if(!b)return;var a=b.dataset.act;
  if(a==='up')up();else if(a==='down')down();else if(a==='add')add(b.dataset.type);else if(a==='connect')toggleConnect();else if(a==='del')del();else if(a==='undo')undo();else if(a==='redo')redo();});
$('sel').addEventListener('change',function(e){var id=e.target.value;if(id){connect=false;connectFrom=null;focus=id;draw();}});

/* inspector */
$('insp').addEventListener('input',function(e){var t=e.target,n=focus?node(focus):null;if(!n)return;
  if(t.id==='ins-label'){n.label=t.value;drawCanvas();}
  else if(t.dataset.flow){var f=dfd.flows.find(function(x){return x.id===t.dataset.flow;});if(f){f.label=t.value;drawCanvas();}}
});
$('insp').addEventListener('change',function(e){var t=e.target,n=focus?node(focus):null;if(!n)return;
  if(t.id==='ins-label'){persist('label:'+n.id);}
  else if(t.id==='ins-type'){n.type=t.value;if(n.type==='trust-boundary'){if(!n.members)n.members=[];}else{delete n.members;}persist();draw();}
  else if(t.id==='ins-comp'){if(t.value)n.componentRef=t.value;else delete n.componentRef;persist();}
  else if(t.dataset.flow){persist();}
});
$('insp').addEventListener('click',function(e){var b=e.target.closest('[data-mem],[data-delflow],#ins-addflow');if(!b)return;var n=focus?node(focus):null;if(!n)return;
  if(b.dataset.mem){var arr=n.members||(n.members=[]);var k=arr.indexOf(b.dataset.mem);if(k>=0)arr.splice(k,1);else arr.push(b.dataset.mem);persist();draw();}
  else if(b.dataset.delflow){dfd.flows=dfd.flows.filter(function(f){return f.id!==b.dataset.delflow;});persist();draw();}
  else if(b.id==='ins-addflow'){var dir=$('ins-dir').value,tgt=$('ins-target').value;if(!tgt)return;var from=dir==='out'?n.id:tgt,to=dir==='out'?tgt:n.id;M.addFlow(dfd,from,to);persist();draw();}
});

$('ovok').addEventListener('click',ovOk);$('ovcancel').addEventListener('click',ovCancel);
window.addEventListener('keydown',function(e){
  if($('ov').style.display==='flex'){if(e.key==='Enter'){ovOk();e.preventDefault();}if(e.key==='Escape'){ovCancel();e.preventDefault();}return;}
  var tag=(e.target&&e.target.tagName)||'';if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA')return;
  if((e.ctrlKey||e.metaKey)&&!e.altKey){var k=e.key.toLowerCase();if(k==='z'&&!e.shiftKey){undo();e.preventDefault();return;}if(k==='y'||(k==='z'&&e.shiftKey)){redo();e.preventDefault();return;}}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='ArrowLeft'){step(-1);e.preventDefault();}
  else if(e.key==='ArrowRight'){step(1);e.preventDefault();}
  else if(e.key==='ArrowDown'||e.key==='Enter'){down();e.preventDefault();}
  else if(e.key==='ArrowUp'||e.key==='Backspace'){up();e.preventDefault();}
  else if(e.key==='d'||e.key==='Delete'){del();e.preventDefault();}
  else if(e.key==='t'){toggleConnect();e.preventDefault();}
  else if(e.key==='x'){add('external-entity');e.preventDefault();}
  else if(e.key==='p'){add('process');e.preventDefault();}
  else if(e.key==='m'){add('multiprocess');e.preventDefault();}
  else if(e.key==='s'){add('store');e.preventDefault();}
  else if(e.key==='b'){add('trust-boundary');e.preventDefault();}
});

window.addEventListener('message',function(ev){var m=ev.data;
  if(m.type==='load'){try{dfd=JSON.parse(m.dfd);}catch(_){dfd={nodes:[],flows:[]};}if(!dfd.nodes)dfd.nodes=[];if(!dfd.flows)dfd.flows=[];if(m.components)components=m.components;baseState=snap();updUndo();if(dragging)return;draw();}
});
vs.postMessage({type:'ready'});
</script></body></html>`;
  }
};

// src/attackTreeEditor.ts
var vscode5 = __toESM(require("vscode"));
var AttackTreeEditor = class {
  constructor(extUri) {
    this.extUri = extUri;
  }
  pendingTreeId;
  async resolveCustomTextEditor(doc, panel) {
    const media = vscode5.Uri.joinPath(this.extUri, "media");
    panel.webview.options = { enableScripts: true, localResourceRoots: [media] };
    const modelUri = panel.webview.asWebviewUri(vscode5.Uri.joinPath(media, "attacktree-model.js"));
    const cssUri = panel.webview.asWebviewUri(vscode5.Uri.joinPath(media, "tra-ui.css"));
    const logoUri = panel.webview.asWebviewUri(vscode5.Uri.joinPath(media, "embedrisk-logo.svg"));
    const nonce = String(Math.random()).slice(2);
    const csp = `default-src 'none'; img-src ${panel.webview.cspSource}; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${panel.webview.cspSource};`;
    const projRoot = vscode5.Uri.joinPath(doc.uri, "..", "..");
    const readRefs = async () => {
      const rd = async (rel, def) => {
        try {
          return JSON.parse(Buffer.from(await vscode5.workspace.fs.readFile(vscode5.Uri.joinPath(projRoot, rel))).toString());
        } catch {
          return def;
        }
      };
      const cms = ((await rd("08-countermeasures/countermeasures.json", { countermeasures: [] })).countermeasures || []).map((c) => ({ id: c.id, title: c.title, status: c.status }));
      const threats = ((await rd("06-threats/threats.json", { threats: [] })).threats || []).map((t) => ({ id: t.id, title: t.title }));
      return { cms, threats };
    };
    let lastText = "";
    const post = async () => {
      const r = await readRefs();
      const selectId = this.pendingTreeId;
      this.pendingTreeId = void 0;
      panel.webview.postMessage({ type: "load", doc: doc.getText() || '{"trees":[]}', cms: r.cms, threats: r.threats, selectId });
    };
    const save = async (text) => {
      lastText = text;
      const ed = new vscode5.WorkspaceEdit();
      ed.replace(doc.uri, new vscode5.Range(0, 0, doc.lineCount, 0), text);
      await vscode5.workspace.applyEdit(ed);
      await doc.save();
    };
    panel.webview.html = this.html(modelUri, cssUri, logoUri, csp, nonce);
    const sub = vscode5.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === doc.uri.toString() && e.document.getText() !== lastText) post();
    });
    panel.onDidDispose(() => sub.dispose());
    panel.webview.onDidReceiveMessage(async (m) => {
      if (m.type === "ready") await post();
      else if (m.type === "save") await save(m.doc);
    });
  }
  html(modelUri, cssUri, logoUri, csp, nonce) {
    return `<!doctype html><html><head><meta charset="utf8"><meta http-equiv="Content-Security-Policy" content="${csp}">
<link rel="stylesheet" href="${cssUri}">
<style>
html,body{height:100%;margin:0;font:13px system-ui;color:var(--text);background:var(--bg)}
body{display:flex;flex-direction:column}
#bar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:7px 10px;background:var(--surface);color:var(--text);border-bottom:1px solid var(--border);flex:0 0 auto;z-index:2}
#bar b{margin-right:6px}
#bar select,#bar input{padding:4px 6px;border:1px solid var(--border-strong);border-radius:6px;background:var(--surface);color:var(--text)}
#bar button{font:12px system-ui;padding:4px 9px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text);border-radius:7px;cursor:pointer}
#bar button:disabled{opacity:.4;cursor:default}
#bar button.danger{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 45%,var(--border-strong))}
#bar .brand{display:flex;align-items:center;gap:6px;margin-right:2px}
#bar .brand .logo{width:18px;height:18px;display:block}
#metrics{color:var(--accent-2);font-size:12px}
#hint{margin-left:auto;color:var(--text-faint);font-size:11px}
#body{flex:1 1 auto;display:flex;min-height:0}
#wrap{flex:1 1 auto;min-height:0;overflow:auto;padding:12px;position:relative;color:var(--text)}
#insp{flex:0 0 300px;border-left:1px solid var(--border);background:var(--surface);overflow:auto;padding:12px}
#insp h3{font-size:13px;margin:0 0 8px}
.costgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px}
#ov{position:fixed;inset:0;background:rgba(0,0,0,.4);display:none;align-items:center;justify-content:center;z-index:10}
#ovbox{background:var(--surface);color:var(--text);padding:14px;border-radius:8px;min-width:300px;border:1px solid var(--border)}
#ovbox input{width:100%;padding:6px;margin:8px 0;background:var(--surface);color:var(--text);border:1px solid var(--border-strong);border-radius:6px}
#ovbox .r{display:flex;gap:8px;justify-content:flex-end}
</style></head><body>
<div id="bar">
  <span class="brand"><img class="logo" src="${logoUri}" alt=""><b>EmbedRisk</b></span>
  <span class="hint">tree</span>
  <select id="treesel" title="Select tree"></select>
  <button data-act="addtree">+ Tree</button>
  <button data-act="deltree" class="danger" title="Delete the current attack tree (its goal and all nodes)">Delete tree</button>
  <span class="hint">threat</span><select id="threatsel" title="Threat this tree decomposes"></select>
  <span style="width:8px"></span>
  <button id="undo" data-act="undo" title="Undo (Ctrl+Z)" disabled>&#8630; Undo</button>
  <button id="redo" data-act="redo" title="Redo (Ctrl+Shift+Z)" disabled>&#8631; Redo</button>
  <span id="metrics"></span>
  <span id="hint">&larr;&rarr; siblings &middot; &uarr;&darr; parent/child &middot; Enter child &middot; Insert sibling &middot; t/click gate &middot; e edit &middot; d delete</span>
</div>
<div id="body">
  <div id="wrap"><svg id="cv" xmlns="http://www.w3.org/2000/svg"></svg></div>
  <aside id="insp"></aside>
</div>
<div id="ov"><div id="ovbox"><div id="ovlabel"></div><input id="ovinput"><div class="r"><button class="btn" id="ovcancel">Cancel</button><button class="btn primary" id="ovok">OK</button></div></div></div>
<script nonce="${nonce}" src="${modelUri}"></script>
<script nonce="${nonce}">
const M=AtModel, vs=acquireVsCodeApi();
const KINDS=['goal','step','substep','category','countermeasure','vulnerability'];
const ADD_KINDS=['step','substep','category','countermeasure','vulnerability'];
const ACCESS=[[1,'Remote (unauth.)'],[2,'Remote (auth.)'],[3,'Adjacent / fieldbus'],[4,'Local (on site)'],[5,'Physical (enclosure)']];
const SKILL=[[1,'Script kiddie'],[2,'Experienced hacker'],[3,'Security engineer'],[4,'Expert team'],[5,'Nation-state']];
let doc={trees:[]}, ti=0, focus=null, cms=[], threats=[];
const $=id=>document.getElementById(id);
function esc(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function tree(){return doc.trees[ti];}
function root(){var t=tree();return t?t.root:null;}
function cmMap(){var m={};cms.forEach(function(c){m[c.id]={status:c.status};});return m;}

/* ---- undo / redo: webview-local snapshots of the attack-tree document, mirroring tra-webapp ---- */
let undoStack=[], redoStack=[], baseState=null, histKey='', histTime=0;
function snap(){return JSON.stringify(doc);}
function updUndo(){var u=$('undo'),r=$('redo');if(u)u.disabled=!undoStack.length;if(r)r.disabled=!redoStack.length;}
function commit(key){
  var now=Date.now();
  var coalesce=undoStack.length&&key&&key===histKey&&(now-histTime<800);
  if(baseState!=null&&!coalesce){undoStack.push(baseState);if(undoStack.length>120)undoStack.shift();redoStack=[];}
  histKey=key||('u'+now);histTime=now;baseState=snap();updUndo();
  vs.postMessage({type:'save',doc:JSON.stringify(doc,null,2)});
}
function persist(key){commit(key||'');}
function restore(json){try{doc=JSON.parse(json);}catch(_){return false;}if(!doc.trees)doc.trees=[];if(ti>=doc.trees.length)ti=0;return true;}
function undo(){if(!undoStack.length)return;redoStack.push(snap());var p=undoStack.pop();if(!restore(p))return;baseState=p;histKey='';var r=root();focus=r?r.id:null;updUndo();vs.postMessage({type:'save',doc:JSON.stringify(doc,null,2)});draw();}
function redo(){if(!redoStack.length)return;undoStack.push(snap());var n=redoStack.pop();if(!restore(n))return;baseState=n;histKey='';var r=root();focus=r?r.id:null;updUndo();vs.postMessage({type:'save',doc:JSON.stringify(doc,null,2)});draw();}

function drawCanvas(){
  var t=tree(),cv=$('cv');
  if(!t){cv.innerHTML='';cv.setAttribute('width',400);cv.setAttribute('height',120);$('metrics').textContent='';return;}
  if(!M.find(t.root,focus))focus=t.root.id;
  var r=M.render(t,focus);
  cv.setAttribute('width',Math.max(r.width,400));cv.setAttribute('height',Math.max(r.height,180));cv.innerHTML=r.svg;
  var m=M.evaluate(t.root,cmMap());
  $('metrics').textContent='success \u2248 '+Math.round(m.prob*100)+'% \xB7 suggests likelihood '+M.likelihoodFromProb(m.prob)+' \xB7 access '+m.accessReq+' \xB7 skill '+m.skillReq+' \xB7 '+m.defenses+' defence(s)';
}
function renderTreeSel(){
  $('treesel').innerHTML=doc.trees.map(function(t,i){var pfx=t.threatRef?(t.threatRef+' \xB7 '):'';return '<option value="'+i+'"'+(i===ti?' selected':'')+'>'+esc(pfx+(t.title||t.id))+'</option>';}).join('')||'<option>(no trees)</option>';
  var t=tree();
  $('threatsel').innerHTML='<option value="">\u2014</option>'+threats.map(function(x){return '<option value="'+esc(x.id)+'"'+(t&&t.threatRef===x.id?' selected':'')+'>'+esc(x.id)+' \xB7 '+esc(x.title)+'</option>';}).join('');
}
function opt(list,val){return list.map(function(o){return '<option value="'+o[0]+'"'+(+val===o[0]?' selected':'')+'>'+o[0]+' \xB7 '+esc(o[1])+'</option>';}).join('');}
function renderInspector(){
  var t=tree();if(!t){$('insp').innerHTML='<p class="hint">Add a tree to begin.</p>';return;}
  var n=M.find(t.root,focus);if(!n){$('insp').innerHTML='';return;}
  var structural=M.isStructural(n),isStep=(n.kind==='step'||n.kind==='substep');
  var html='<h3>Selected node</h3>';
  html+='<div class="field"><label>Kind</label><select class="inp" id="in-kind">'+KINDS.map(function(k){return '<option'+(n.kind===k?' selected':'')+'>'+k+'</option>';}).join('')+'</select></div>';
  html+='<div class="field"><label>Label</label><input class="inp" id="in-label" value="'+esc(n.label)+'"></div>';
  if(structural)html+='<div class="field"><label>Gate (children combine)</label><select class="inp" id="in-gate">'+M.GATES.map(function(gt){return '<option'+((n.gate||'AND')===gt?' selected':'')+'>'+gt+'</option>';}).join('')+'</select></div>';
  if(isStep){
    html+='<div class="field"><label>Required access</label><select class="inp" id="in-access">'+opt(ACCESS,n.access||3)+'</select></div>';
    html+='<div class="field"><label>Required skill</label><select class="inp" id="in-skill">'+opt(SKILL,n.skill||2)+'</select></div>';
    html+='<div class="field"><label>Cost factors (1 easy \u2026 5 hard)</label><div class="costgrid">'+M.COST_FACTORS.map(function(f){var v=(n.cost||{})[f.k];return '<label class="hint">'+esc(f.label)+'<select class="inp" data-cost="'+f.k+'"><option value="">\u2013</option>'+[1,2,3,4,5].map(function(x){return '<option'+(+v===x?' selected':'')+'>'+x+'</option>';}).join('')+'</select></label>';}).join('')+'</div></div>';
  }
  if(n.kind==='countermeasure')html+='<div class="field"><label>Linked countermeasure</label><select class="inp" id="in-cmref"><option value="">(link CM\u2026)</option>'+cms.map(function(c){return '<option value="'+esc(c.id)+'"'+(n.countermeasureRef===c.id?' selected':'')+'>'+esc(c.id)+' \xB7 '+esc(c.title)+'</option>';}).join('')+'</select></div>';
  html+='<div class="field"><label>Add child</label><div class="chips">'+ADD_KINDS.map(function(k){return '<span class="chip" role="button" tabindex="0" data-addkind="'+k+'">+ '+esc(M.KIND_LABEL[k])+'</span>';}).join('')+'</div></div>';
  if(M.parentOf(t.root,n.id))html+='<button class="btn sm danger" id="in-del">Delete node</button>';
  $('insp').innerHTML=html;
}
function draw(){renderTreeSel();drawCanvas();renderInspector();}

function move(dir){var t=tree();if(!t)return;var r=t.root;
  if(dir==='up'){var p=M.parentOf(r,focus);if(p)focus=p.id;}
  else if(dir==='down'){var n=M.find(r,focus);if(n&&n.children&&n.children.length)focus=n.children[0].id;}
  else{var p2=M.parentOf(r,focus);if(!p2)return;var i=p2.children.findIndex(function(c){return c.id===focus;});var j=(i+(dir==='right'?1:-1)+p2.children.length)%p2.children.length;focus=p2.children[j].id;}
  draw();
}
function addChild(kind){var t=tree();if(!t)return;var n=M.addChild(t.root,focus,kind||'step');if(n){focus=n.id;persist();draw();promptBox('Label',n.label,function(v){if(v){n.label=v;persist();draw();}});}}
function addSib(){var t=tree();if(!t)return;var n=M.addSibling(t.root,focus,'step');if(n){focus=n.id;persist();draw();promptBox('Label',n.label,function(v){if(v){n.label=v;persist();draw();}});}}
function gate(){var t=tree();if(!t)return;if(M.cycleGate(t.root,focus)!==null){persist();draw();}}
function rename(){var t=tree();if(!t)return;var n=M.find(t.root,focus);if(!n)return;promptBox('Rename',n.label,function(v){if(v){n.label=v;persist();draw();}});}
function del(){var t=tree();if(!t)return;if(M.remove(t.root,focus)){focus=t.root.id;persist();draw();}}
function addTree(){var used={};doc.trees.forEach(function(t){used[t.id]=1;});var n=1,id;do{id='AT'+(n++);}while(used[id]);doc.trees.push({id:id,title:'New attack goal',threatRef:'',root:{id:'n1',kind:'goal',label:'Attack goal',gate:'OR',children:[]}});ti=doc.trees.length-1;focus='n1';persist('addtree');draw();}
function delTree(){var t=tree();if(!t)return;confirmBox('Delete this attack tree and all of its nodes?',function(ok){if(!ok)return;doc.trees.splice(ti,1);if(ti>=doc.trees.length)ti=Math.max(0,doc.trees.length-1);var r=root();focus=r?r.id:null;persist('deltree');draw();});}

let ovCb=null, ovMode='prompt';
function promptBox(lbl,val,cb){ovMode='prompt';ovCb=cb;$('ovlabel').textContent=lbl;$('ovinput').style.display='';$('ovinput').value=val||'';$('ov').style.display='flex';$('ovinput').focus();}
function confirmBox(lbl,cb){ovMode='confirm';ovCb=cb;$('ovlabel').textContent=lbl;$('ovinput').style.display='none';$('ov').style.display='flex';}
function ovOk(){var cb=ovCb,mode=ovMode,v=$('ovinput').value;$('ov').style.display='none';$('ovinput').style.display='';ovCb=null;if(cb){mode==='confirm'?cb(true):cb(v);}}
function ovCancel(){var cb=ovCb,mode=ovMode;$('ov').style.display='none';$('ovinput').style.display='';ovCb=null;if(cb&&mode==='confirm')cb(false);}

$('cv').addEventListener('click',function(e){
  var gg=e.target.closest&&e.target.closest('[data-gate]');
  if(gg){var t=tree();if(t){var id=gg.getAttribute('data-gate');focus=id;if(M.cycleGate(t.root,id)!==null)persist('gate:'+id);draw();}return;}
  var g=e.target.closest&&e.target.closest('[data-id]');if(g){focus=g.getAttribute('data-id');draw();}});
$('bar').addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-act]');if(!b)return;var a=b.dataset.act;if(a==='addtree')addTree();else if(a==='deltree')delTree();else if(a==='undo')undo();else if(a==='redo')redo();});
$('treesel').addEventListener('change',function(e){ti=+e.target.value;var r=root();focus=r?r.id:null;draw();});
$('threatsel').addEventListener('change',function(e){var t=tree();if(t){t.threatRef=e.target.value;persist();}});
$('insp').addEventListener('input',function(e){var t=tree();if(!t)return;var n=M.find(t.root,focus);if(!n)return;if(e.target.id==='in-label'){n.label=e.target.value;drawCanvas();}});
$('insp').addEventListener('change',function(e){var t=tree();if(!t)return;var n=M.find(t.root,focus);if(!n)return;var el=e.target;
  if(el.id==='in-label'){persist();}
  else if(el.id==='in-kind'){M.setKind(t.root,n.id,el.value);persist();draw();}
  else if(el.id==='in-gate'){n.gate=el.value;persist();drawCanvas();}
  else if(el.id==='in-access'){n.access=+el.value;persist();drawCanvas();}
  else if(el.id==='in-skill'){n.skill=+el.value;persist();drawCanvas();}
  else if(el.id==='in-cmref'){if(el.value)n.countermeasureRef=el.value;else delete n.countermeasureRef;persist();drawCanvas();}
  else if(el.dataset.cost){n.cost=n.cost||{};if(el.value==='')delete n.cost[el.dataset.cost];else n.cost[el.dataset.cost]=+el.value;persist();drawCanvas();}
});
$('insp').addEventListener('click',function(e){var b=e.target.closest('[data-addkind],#in-del');if(!b)return;if(b.id==='in-del')del();else addChild(b.dataset.addkind);});
$('ovok').addEventListener('click',ovOk);$('ovcancel').addEventListener('click',ovCancel);
window.addEventListener('keydown',function(e){
  if($('ov').style.display==='flex'){if(e.key==='Enter'){ovOk();e.preventDefault();}if(e.key==='Escape'){ovCancel();e.preventDefault();}return;}
  var tag=(e.target&&e.target.tagName)||'';if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA')return;
  if((e.ctrlKey||e.metaKey)&&!e.altKey){var k=e.key.toLowerCase();if(k==='z'&&!e.shiftKey){undo();e.preventDefault();return;}if(k==='y'||(k==='z'&&e.shiftKey)){redo();e.preventDefault();return;}}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==='ArrowLeft'){move('left');e.preventDefault();}
  else if(e.key==='ArrowRight'){move('right');e.preventDefault();}
  else if(e.key==='ArrowUp'){move('up');e.preventDefault();}
  else if(e.key==='ArrowDown'){move('down');e.preventDefault();}
  else if(e.key==='Enter'){addChild('step');e.preventDefault();}
  else if(e.key==='Insert'){addSib();e.preventDefault();}
  else if(e.key==='t'||e.key==='g'){gate();e.preventDefault();}
  else if(e.key==='e'||e.key==='F2'){rename();e.preventDefault();}
  else if(e.key==='d'||e.key==='Delete'){del();e.preventDefault();}
});
window.addEventListener('message',function(ev){var m=ev.data;if(m.type==='load'){try{doc=JSON.parse(m.doc);}catch(_){doc={trees:[]};}if(!doc.trees)doc.trees=[];if(m.cms)cms=m.cms;if(m.threats)threats=m.threats;if(m.selectId){var si=doc.trees.findIndex(function(t){return t.id===m.selectId;});if(si>=0){ti=si;focus=null;}}if(ti>=doc.trees.length)ti=0;var r=root();if(r&&!M.find(r,focus))focus=r.id;baseState=snap();updUndo();draw();}});
vs.postMessage({type:'ready'});
</script></body></html>`;
  }
};

// src/extension.ts
var layer = 1;
var execFileAsync = (0, import_node_util.promisify)(import_node_child_process.execFile);
var decoder2 = new TextDecoder();
var encoder = new TextEncoder();
var find = () => vscode6.workspace.findFiles("**/04-dfd/dfd.json", "**/node_modules/**", 1).then((f) => f[0]);
var load = async (u) => JSON.parse(decoder2.decode(await vscode6.workspace.fs.readFile(u)));
var encodeJson = (obj) => encoder.encode(JSON.stringify(obj, null, 2));
var writeText = (u, text) => vscode6.workspace.fs.writeFile(u, encoder.encode(text));
var pathExists = async (u) => {
  try {
    await vscode6.workspace.fs.stat(u);
    return true;
  } catch {
    return false;
  }
};
var reportsScript = (ctx) => vscode6.Uri.joinPath(ctx.extensionUri, "runtime", "tools", "generate-report.mjs");
var projectsRoot = () => vscode6.Uri.file(path2.join(os.homedir(), "Documents", "EmbedRisk", "projects"));
var importedKbRoot = (ctx) => vscode6.Uri.joinPath(ctx.globalStorageUri, "knowledge-base", "imported");
async function writeJson(u, obj) {
  await vscode6.workspace.fs.createDirectory(vscode6.Uri.file(path2.dirname(u.fsPath)));
  await vscode6.workspace.fs.writeFile(u, encodeJson(obj));
}
async function initGitRepo(dir) {
  try {
    await execFileAsync("git", ["init"], { cwd: dir.fsPath });
  } catch {
    vscode6.window.showErrorMessage("Git init failed. The project was created and can still be used without a Git repository.");
  }
}
async function generateReport(ctx, projDir) {
  const script = reportsScript(ctx);
  if (!await pathExists(script)) {
    vscode6.window.showErrorMessage("The packaged report generator is missing. Reinstall the extension.");
    return;
  }
  try {
    await execFileAsync(process.execPath, [script.fsPath, projDir.fsPath], { cwd: path2.dirname(script.fsPath) });
    const report = vscode6.Uri.joinPath(projDir, "report", "index.html");
    const act = await vscode6.window.showInformationMessage("Report generated successfully.", "Open report", "Reveal folder");
    if (act === "Open report") await vscode6.commands.executeCommand("vscode.open", report);
    else if (act === "Reveal folder") await vscode6.commands.executeCommand("revealFileInOS", report);
  } catch (err) {
    const detail = String(err?.stderr || err?.stdout || err?.message || err).trim();
    vscode6.window.showErrorMessage(detail ? `Report generation failed: ${detail}` : "Report generation failed.");
  }
}
async function scaffoldProject(dir, name, slug) {
  const project = {
    traVersion: "1.0",
    projectId: slug,
    title: `TRA: ${name}`,
    device: { name, type: "field device", modelReference: "", purdueLevel: "0-1", version: "" },
    scope: { mode: "graybox", boundary: "", inScope: [], outOfScope: [] },
    slTarget: "SL2",
    intendedUse: "",
    foreseeableUse: [],
    repo: { projectBranchUrl: "", kbUrl: "" },
    steps: {
      "01-project-description": "01-project-description/project.json",
      "02-assumptions": "02-assumptions/assumptions.json",
      "03-system-assets": "03-system-assets/system.json",
      "04-dfd": "04-dfd/dfd.json",
      "05-requirements": "05-requirements/requirements.json",
      "06-threats": "06-threats/threats.json",
      "07-attack-trees": "07-attack-trees/attack-trees.json",
      "08-countermeasures": "08-countermeasures/countermeasures.json",
      "09-defects": "09-defects/defects.json"
    },
    status: "draft",
    rigorousMode: false,
    sbom: { mode: "external", format: "spdx" }
  };
  const assumptions = {
    device: [],
    system: [],
    environment: [],
    operational: [],
    attacker: [{ id: "ATK-1", name: "Opportunistic attacker", capability: 2, access: "local", motivation: "disruption", resources: "limited", text: "" }]
  };
  const system = {
    components: [{ id: "C-DEV", name, kind: "device", layer: 1, parent: null, trustZone: "device", provenance: "own" }],
    interfaces: [],
    trustBoundaries: [],
    assets: [{ id: "AS-1", name: "Primary function", type: "function", storage: "", components: ["C-DEV"], objectives: { confidentiality: 1, integrity: 3, availability: 3, safety: 1 } }]
  };
  const dfd = { nodes: [{ id: "N-DEV", label: name, type: "process", layer: 1, parent: null, componentRef: "C-DEV" }], flows: [] };
  await vscode6.workspace.fs.createDirectory(dir);
  await writeJson(vscode6.Uri.joinPath(dir, "01-project-description", "project.json"), project);
  await writeJson(vscode6.Uri.joinPath(dir, "02-assumptions", "assumptions.json"), assumptions);
  await writeJson(vscode6.Uri.joinPath(dir, "03-system-assets", "system.json"), system);
  await writeJson(vscode6.Uri.joinPath(dir, "04-dfd", "dfd.json"), dfd);
  await writeJson(vscode6.Uri.joinPath(dir, "05-requirements", "requirements.json"), { requirements: [] });
  await writeJson(vscode6.Uri.joinPath(dir, "06-threats", "threats.json"), { threats: [] });
  await writeJson(vscode6.Uri.joinPath(dir, "07-attack-trees", "attack-trees.json"), { trees: [] });
  await writeJson(vscode6.Uri.joinPath(dir, "08-countermeasures", "countermeasures.json"), { countermeasures: [] });
  await writeJson(vscode6.Uri.joinPath(dir, "09-defects", "defects.json"), { defects: [] });
  await vscode6.workspace.fs.createDirectory(vscode6.Uri.joinPath(dir, "documents"));
  await vscode6.workspace.fs.createDirectory(vscode6.Uri.joinPath(dir, "report"));
  await writeText(vscode6.Uri.joinPath(dir, "documents", "README.md"), "# Supporting documents\n\nStore device specifications, architecture notes, and audit evidence here.\n");
  await writeText(vscode6.Uri.joinPath(dir, ".gitignore"), "report/\n");
}
async function openLayer(target) {
  const u = await find();
  if (!u) {
    vscode6.window.showWarningMessage("No 04-dfd/dfd.json in the workspace.");
    return;
  }
  const dfd = await load(u);
  const layers = [...new Set(dfd.nodes.map((n) => n.layer))].sort();
  if (!dfd.nodes.some((n) => n.layer === target)) {
    const create = await vscode6.window.showInformationMessage(`Layer ${target} has no components yet. Create it?`, "Create", "Cancel");
    if (create !== "Create") return;
    dfd.nodes.push({ id: `N-L${target}-1`, label: `New component (L${target})`, type: "process", layer: target, parent: dfd.nodes[0]?.id ?? null });
    await vscode6.workspace.fs.writeFile(u, encodeJson(dfd));
  }
  layer = target;
  const out = vscode6.Uri.joinPath(u, "..", "dfd.drawio");
  await writeText(out, dfdToDrawio(await load(u), layer));
  await vscode6.commands.executeCommand("vscode.open", out);
  vscode6.window.setStatusBarMessage(`DFD layer ${layer} (layers: ${layers.join(", ")})`, 4e3);
}
function activate(ctx) {
  const attackTreeEditor = new AttackTreeEditor(ctx.extensionUri);
  ctx.subscriptions.push(
    vscode6.commands.registerCommand("tra.dfdToDrawio", () => openLayer(layer)),
    vscode6.commands.registerCommand("tra.dfdLayerDown", () => openLayer(layer + 1)),
    vscode6.commands.registerCommand("tra.dfdLayerUp", () => openLayer(Math.max(1, layer - 1))),
    vscode6.commands.registerCommand("tra.report", async () => {
      const u = await find();
      if (!u) {
        vscode6.window.showWarningMessage("No TRA project (04-dfd/dfd.json) found.");
        return;
      }
      const projDir = vscode6.Uri.joinPath(u, "..", "..");
      await generateReport(ctx, projDir);
    }),
    vscode6.commands.registerCommand("tra.newProject", async () => {
      const name = await vscode6.window.showInputBox({ prompt: "Device / project name" });
      if (!name) return;
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const root = projectsRoot();
      await vscode6.workspace.fs.createDirectory(root);
      const dir = vscode6.Uri.joinPath(root, slug);
      if (await pathExists(dir)) {
        const act2 = await vscode6.window.showWarningMessage(`The project '${slug}' already exists at ${dir.fsPath}.`, "Open project", "Cancel");
        if (act2 === "Open project") await vscode6.commands.executeCommand("vscode.openFolder", dir, { forceNewWindow: true });
        return;
      }
      await scaffoldProject(dir, name, slug);
      await initGitRepo(dir);
      const act = await vscode6.window.showInformationMessage(`Created project at ${dir.fsPath}.`, "Open project", "Reveal in Explorer");
      if (act === "Reveal in Explorer") await vscode6.commands.executeCommand("revealFileInOS", dir);
      else await vscode6.commands.executeCommand("vscode.openFolder", dir, { forceNewWindow: true });
    }),
    vscode6.commands.registerCommand("tra.wizard", () => openWizard(ctx)),
    vscode6.commands.registerCommand("tra.kbBrowse", () => openKbBrowser(ctx)),
    vscode6.commands.registerCommand("tra.dfdNative", async () => {
      const u = await find();
      if (!u) {
        vscode6.window.showWarningMessage("No 04-dfd/dfd.json in the workspace.");
        return;
      }
      await vscode6.commands.executeCommand("vscode.openWith", u, "tra.dfdNative");
    }),
    vscode6.commands.registerCommand("tra.newAttackTree", async () => {
      const tf = await vscode6.workspace.findFiles("**/06-threats/threats.json", "**/node_modules/**", 1);
      if (!tf[0]) {
        vscode6.window.showWarningMessage("No TRA project (06-threats/threats.json) found.");
        return;
      }
      const projDir = vscode6.Uri.joinPath(tf[0], "..", "..");
      const file = vscode6.Uri.joinPath(projDir, "07-attack-trees/attack-trees.json");
      const readThreats = async () => {
        try {
          return JSON.parse(Buffer.from(await vscode6.workspace.fs.readFile(tf[0])).toString()).threats || [];
        } catch {
          return [];
        }
      };
      const readDoc = async () => {
        try {
          const d = JSON.parse(Buffer.from(await vscode6.workspace.fs.readFile(file)).toString());
          if (!Array.isArray(d.trees)) d.trees = [];
          return d;
        } catch {
          return { trees: [] };
        }
      };
      const writeDoc = (d) => vscode6.workspace.fs.writeFile(file, Buffer.from(JSON.stringify(d, null, 2)));
      const countNodes = (n) => 1 + (n.children || []).reduce((s, c) => s + countNodes(c), 0);
      const openTree = async (id) => {
        attackTreeEditor.pendingTreeId = id;
        await vscode6.commands.executeCommand("vscode.openWith", file, "tra.attackTree");
      };
      const createForThreat = async () => {
        const threats2 = await readThreats();
        const items = threats2.map((t2) => ({ label: t2.id, description: t2.title, t: t2 }));
        items.push({ label: "$(circle-slash) No specific threat", t: null });
        const pick = await vscode6.window.showQuickPick(items, { placeHolder: "Which threat does this attack tree model?" });
        if (!pick) return;
        const t = pick.t;
        const d = await readDoc();
        const ids = new Set(d.trees.map((x) => x.id));
        const base = t ? "AT-" + t.id : "AT";
        let id = base;
        let n = 1;
        while (ids.has(id)) id = `${base}-${++n}`;
        d.trees.push({ id, title: t ? t.title : "New attack goal", threatRef: t ? t.id : "", root: { id: "n1", kind: "goal", label: t ? t.title : "Attack goal", gate: "OR", children: [{ id: "n2", kind: "step", label: "Attacker step 1", access: 3, skill: 2, cost: {}, children: [] }] } });
        attackTreeEditor.pendingTreeId = id;
        await writeDoc(d);
        await vscode6.commands.executeCommand("vscode.openWith", file, "tra.attackTree");
      };
      const threats = await readThreats();
      const doc0 = await readDoc();
      const threatTitle = (ref) => (threats.find((x) => x.id === ref) || {}).title || "";
      const NEW = { label: "$(add) New attack tree\u2026", alwaysShow: true };
      const build = (d) => [NEW, ...d.trees.map((t) => ({
        label: (t.threatRef ? "$(target) " + t.threatRef + " \xB7 " : "") + (t.title || t.id),
        description: t.id,
        detail: (t.threatRef ? threatTitle(t.threatRef) + "  \xB7  " : "") + countNodes(t.root) + " node(s)",
        treeId: t.id,
        buttons: [{ iconPath: new vscode6.ThemeIcon("trash"), tooltip: "Delete this attack tree" }]
      }))];
      const qp = vscode6.window.createQuickPick();
      qp.title = "Attack trees";
      qp.ignoreFocusOut = true;
      qp.placeholder = doc0.trees.length ? "Open an attack tree \xB7 trash icon deletes \xB7 or create a new one" : "No attack trees yet \u2014 create one to model a threat";
      qp.items = build(doc0);
      qp.onDidTriggerItemButton(async (e) => {
        const id = e.item.treeId;
        if (!id) return;
        const cur = await readDoc();
        const idx = cur.trees.findIndex((t) => t.id === id);
        if (idx < 0) return;
        const conf = await vscode6.window.showWarningMessage(`Delete attack tree '${cur.trees[idx].title || id}' and all its nodes?`, { modal: true }, "Delete");
        if (conf !== "Delete") return;
        cur.trees.splice(idx, 1);
        await writeDoc(cur);
        qp.items = build(cur);
      });
      qp.onDidAccept(async () => {
        const sel = qp.selectedItems[0];
        qp.hide();
        if (!sel) return;
        if (sel.treeId) await openTree(sel.treeId);
        else await createForThreat();
      });
      qp.onDidHide(() => qp.dispose());
      qp.show();
    }),
    vscode6.commands.registerCommand("tra.kbImport", async () => {
      const url = await vscode6.window.showInputBox({ prompt: "Git URL of a TRA knowledge base to import", placeHolder: "https://github.com/org/tra-kb.git" });
      if (!url) return;
      const name = (url.split("/").pop() || "kb").replace(/\.git$/, "");
      const root = importedKbRoot(ctx);
      await vscode6.workspace.fs.createDirectory(root);
      const target = path2.join(root.fsPath, name);
      if (await pathExists(vscode6.Uri.file(target))) {
        vscode6.window.showWarningMessage(`A knowledge base named '${name}' is already imported.`);
        return;
      }
      try {
        await execFileAsync("git", ["clone", url, target], { cwd: root.fsPath });
        vscode6.window.showInformationMessage(`Imported knowledge base into ${target}.`);
      } catch (err) {
        const detail = String(err?.stderr || err?.stdout || err?.message || err).trim();
        vscode6.window.showErrorMessage(detail ? `Knowledge-base import failed: ${detail}` : "Knowledge-base import failed.");
      }
    }),
    vscode6.window.registerCustomEditorProvider("tra.dfdNative", new NativeDfdEditor(ctx.extensionUri), { webviewOptions: { retainContextWhenHidden: true } }),
    vscode6.window.registerCustomEditorProvider("tra.attackTree", attackTreeEditor, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode6.window.registerCustomEditorProvider("tra.dfdEditor", new DfdEditor(ctx.extensionUri))
  );
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
