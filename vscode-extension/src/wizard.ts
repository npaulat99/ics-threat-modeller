import * as vscode from "vscode";

interface PF { proj: vscode.Uri; }

const rdRaw = async (proj: vscode.Uri, rel: string, def: any) => {
  try { return JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(proj, rel))).toString()); } catch { return def; }
};
const write = (proj: vscode.Uri, rel: string, obj: any) => vscode.workspace.fs.writeFile(vscode.Uri.joinPath(proj, rel), Buffer.from(JSON.stringify(obj, null, 2)));

async function locate(): Promise<PF | undefined> {
  const p = await vscode.workspace.findFiles("**/01-project-description/project.json", "**/node_modules/**", 1);
  if (!p[0]) return undefined;
  return { proj: vscode.Uri.joinPath(p[0], "..", "..") };
}

async function countTrees(proj: vscode.Uri): Promise<number> {
  try {
    const doc = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(proj, "07-attack-trees/attack-trees.json"))).toString());
    return (doc.trees || []).length;
  } catch { return 0; }
}

async function buildData(proj: vscode.Uri) {
  const project = await rdRaw(proj, "01-project-description/project.json", {});
  const threats = (await rdRaw(proj, "06-threats/threats.json", { threats: [] })).threats || [];
  const cms = (await rdRaw(proj, "08-countermeasures/countermeasures.json", { countermeasures: [] })).countermeasures || [];
  const system = await rdRaw(proj, "03-system-assets/system.json", { components: [], assets: [] });
  const assumptions = await rdRaw(proj, "02-assumptions/assumptions.json", {});
  const dfd = await rdRaw(proj, "04-dfd/dfd.json", { nodes: [] });
  const reqs = (await rdRaw(proj, "05-requirements/requirements.json", { requirements: [] })).requirements || [];
  const comps = (system.components || []).map((c: any) => ({ id: c.id, name: c.name }));
  return {
    project: {
      name: project.device?.name || "",
      sl: project.slTarget || "SL2",
      mode: project.scope?.mode || "graybox",
      boundary: project.scope?.boundary || "",
    },
    threats, cms, comps,
    requirements: reqs,
    assumptions: {
      attacker: assumptions.attacker || [],
      device: assumptions.device || [],
      system: assumptions.system || [],
      environment: assumptions.environment || [],
      operational: assumptions.operational || [],
    },
    system: {
      components: system.components || [],
      interfaces: system.interfaces || [],
      trustBoundaries: system.trustBoundaries || [],
      assets: system.assets || [],
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
      countermeasures: cms.length,
    },
  };
}

export async function openWizard(ctx: vscode.ExtensionContext) {
  const f = await locate();
  if (!f) { vscode.window.showWarningMessage("No EmbedRisk project found. Use 'EmbedRisk: New Project' to create one."); return; }
  const media = vscode.Uri.joinPath(ctx.extensionUri, "media");
  const panel = vscode.window.createWebviewPanel("embedriskWizard", "EmbedRisk Wizard", vscode.ViewColumn.One, { enableScripts: true, localResourceRoots: [media] });
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
      project.device = project.device || {}; project.device.name = m.name; project.slTarget = m.sl;
      project.scope = project.scope || {}; project.scope.mode = m.mode; project.scope.boundary = m.bnd;
      await write(f.proj, "01-project-description/project.json", project);
      return panel.webview.postMessage({ cmd: "msg", text: "Project saved.", counts: await counts() });
    }

    if (m.cmd === "threats") {
      const rows = m.threats as any[];
      const compIds = new Set((m.compIds as string[]) || []);
      const problems: string[] = []; const seen = new Set<string>();
      rows.forEach((t, i) => {
        const id = (t.id || "").trim();
        if (!id) problems.push(`Row ${i + 1}: missing ID.`);
        else if (seen.has(id)) problems.push(`Duplicate threat ID '${id}'.`); else seen.add(id);
        if (!(t.components || []).length) problems.push(`Threat '${id || i + 1}': at least one affected component is required.`);
        (t.components || []).forEach((c: string) => { if (!compIds.has(c)) problems.push(`Threat '${id}': unknown component '${c}'.`); });
        if (!(t.stride || []).length) problems.push(`Threat '${id}': assign at least one STRIDE category.`);
      });
      if (problems.length) return panel.webview.postMessage({ cmd: "err", text: "Cannot save:\n" + problems.join("\n") });
      const prev = new Map(((await rdRaw(f.proj, "06-threats/threats.json", { threats: [] })).threats || []).map((t: any) => [t.id, t]));
      const norm = rows.map((t) => ({
        ...(prev.get(t.id) || { assets: [], status: "open" }),
        id: t.id, title: t.title,
        stride: (t.stride || []).map((s: string) => s.toUpperCase()),
        components: t.components || [], likelihood: +t.likelihood || 3, impact: +t.impact || 3,
        status: t.status || (prev.get(t.id) as any)?.status || "open",
      }));
      await write(f.proj, "06-threats/threats.json", { threats: norm });
      return panel.webview.postMessage({ cmd: "threats", threats: norm, counts: await counts(), text: "Threats saved." });
    }

    if (m.cmd === "cms") {
      const rows = m.cms as any[];
      const threats = (await rdRaw(f.proj, "06-threats/threats.json", { threats: [] })).threats || [];
      const tById = new Map(threats.map((t: any) => [t.id, t]));
      const problems: string[] = []; const seen = new Set<string>();
      rows.forEach((c, i) => {
        const id = (c.id || "").trim();
        if (!id) problems.push(`CM row ${i + 1}: missing ID.`);
        else if (seen.has(id)) problems.push(`Duplicate countermeasure ID '${id}'.`); else seen.add(id);
        if (!(c.addresses || []).length) problems.push(`Countermeasure '${id || i + 1}': must address at least one threat.`);
        (c.addresses || []).forEach((a: any) => {
          const th: any = tById.get(a.threat);
          if (!th) { problems.push(`Countermeasure '${id}': unknown threat '${a.threat}'.`); return; }
          if (a.residualImpact > th.impact) problems.push(`${id}: residual impact for ${a.threat} (${a.residualImpact}) exceeds initial (${th.impact}).`);
          if (a.residualLikelihood > th.likelihood) problems.push(`${id}: residual likelihood for ${a.threat} (${a.residualLikelihood}) exceeds initial (${th.likelihood}).`);
          if (c.type === "preventive" && a.residualImpact < th.impact) problems.push(`${id}: a preventive control should reduce likelihood, not impact (${a.threat}).`);
        });
      });
      if (problems.length) return panel.webview.postMessage({ cmd: "err", text: "Cannot save:\n" + problems.join("\n") });
      const prev = new Map(((await rdRaw(f.proj, "08-countermeasures/countermeasures.json", { countermeasures: [] })).countermeasures || []).map((c: any) => [c.id, c]));
      const norm = rows.map((c) => ({
        ...(prev.get(c.id) || { components: [] }),
        id: c.id, title: c.title, type: c.type || "preventive", status: c.status || "proposed",
        addresses: (c.addresses || []).map((a: any) => ({ threat: a.threat, residualLikelihood: +a.residualLikelihood || 2, residualImpact: +a.residualImpact || 2 })),
      }));
      await write(f.proj, "08-countermeasures/countermeasures.json", { countermeasures: norm });
      return panel.webview.postMessage({ cmd: "cms", cms: norm, counts: await counts(), text: "Countermeasures saved." });
    }

    if (m.cmd === "assumptions") {
      const a = m.assumptions || {};
      const attacker = a.attacker || [];
      const problems: string[] = []; const seen = new Set<string>();
      if (!attacker.length) problems.push("At least one attacker profile is required (it grounds the likelihood).");
      attacker.forEach((p: any, i: number) => {
        const id = (p.id || "").trim();
        if (!id) problems.push(`Attacker row ${i + 1}: missing ID.`);
        else if (seen.has(id)) problems.push(`Duplicate attacker ID '${id}'.`); else seen.add(id);
        if (!(p.name || "").trim()) problems.push(`Attacker '${id || i + 1}': name is required.`);
      });
      if (problems.length) return panel.webview.postMessage({ cmd: "err", text: "Cannot save assumptions:\n" + problems.join("\n") });
      const prev = await rdRaw(f.proj, "02-assumptions/assumptions.json", {});
      const doc = {
        ...prev,
        attacker: attacker.map((p: any) => ({ ...p, capability: Math.max(1, Math.min(5, +p.capability || 2)) })),
        device: a.device || [], system: a.system || [], environment: a.environment || [], operational: a.operational || [],
      };
      await write(f.proj, "02-assumptions/assumptions.json", doc);
      return panel.webview.postMessage({ cmd: "assumptions", assumptions: doc, counts: await counts(), text: "Assumptions saved." });
    }

    if (m.cmd === "system") {
      const s = m.system || {};
      const components = s.components || [];
      const problems: string[] = []; const seen = new Set<string>();
      components.forEach((c: any, i: number) => {
        const id = (c.id || "").trim();
        if (!id) problems.push(`Component row ${i + 1}: missing ID.`);
        else if (seen.has(id)) problems.push(`Duplicate component ID '${id}'.`); else seen.add(id);
        if (!(c.name || "").trim()) problems.push(`Component '${id || i + 1}': name is required.`);
      });
      const aseen = new Set<string>();
      (s.assets || []).forEach((a: any, i: number) => {
        const id = (a.id || "").trim();
        if (!id) problems.push(`Asset row ${i + 1}: missing ID.`);
        else if (aseen.has(id)) problems.push(`Duplicate asset ID '${id}'.`); else aseen.add(id);
      });
      if (problems.length) return panel.webview.postMessage({ cmd: "err", text: "Cannot save system:\n" + problems.join("\n") });
      const clampO = (o: any) => ({
        confidentiality: Math.max(0, Math.min(5, +(o?.confidentiality ?? 0))),
        integrity: Math.max(0, Math.min(5, +(o?.integrity ?? 0))),
        availability: Math.max(0, Math.min(5, +(o?.availability ?? 0))),
        safety: Math.max(0, Math.min(5, +(o?.safety ?? 0))),
      });
      const prev = await rdRaw(f.proj, "03-system-assets/system.json", {});
      const doc = {
        ...prev,
        components: components.map((c: any) => ({ ...c, layer: +c.layer || 1, parent: c.parent || null })),
        interfaces: s.interfaces || [],
        trustBoundaries: s.trustBoundaries || [],
        assets: (s.assets || []).map((a: any) => ({ ...a, objectives: clampO(a.objectives) })),
      };
      await write(f.proj, "03-system-assets/system.json", doc);
      const comps = doc.components.map((c: any) => ({ id: c.id, name: c.name }));
      return panel.webview.postMessage({ cmd: "system", system: doc, comps, counts: await counts(), text: "System & assets saved." });
    }

    if (m.cmd === "requirements") {
      const rows = (m.requirements as any[]) || [];
      const problems: string[] = []; const seen = new Set<string>();
      rows.forEach((r: any, i: number) => {
        const id = (r.id || "").trim();
        if (!id) problems.push(`Requirement row ${i + 1}: missing ID.`);
        else if (seen.has(id)) problems.push(`Duplicate requirement ID '${id}'.`); else seen.add(id);
      });
      if (problems.length) return panel.webview.postMessage({ cmd: "err", text: "Cannot save requirements:\n" + problems.join("\n") });
      const norm = rows.map((r: any) => ({
        ...r, id: r.id, text: r.text || "",
        standardRef: r.standardRef || "", slFr: r.slFr || "",
        derivedFromThreat: r.derivedFromThreat || [], satisfiedByCM: r.satisfiedByCM || [],
      }));
      await write(f.proj, "05-requirements/requirements.json", { requirements: norm });
      return panel.webview.postMessage({ cmd: "requirements", requirements: norm, counts: await counts(), text: "Requirements saved." });
    }

    if (m.cmd === "openFile") {
      try { const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(f.proj, m.rel)); await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside); }
      catch { vscode.window.showInformationMessage(`${m.rel} does not exist yet.`); }
      return;
    }
    if (m.cmd === "dfd") return void vscode.commands.executeCommand("vscode.openWith", vscode.Uri.joinPath(f.proj, "04-dfd/dfd.json"), "embedrisk.dfdNative");
    if (m.cmd === "report") return void vscode.commands.executeCommand("embedrisk.report");
    if (m.cmd === "kb") return void vscode.commands.executeCommand("embedrisk.kbBrowse");
    if (m.cmd === "atree") return void vscode.commands.executeCommand("embedrisk.newAttackTree");
  }, undefined, ctx.subscriptions);
}

function shell(cssUri: vscode.Uri, riskUri: vscode.Uri, logoUri: vscode.Uri, csp: string, nonce: string): string {
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
        <h2>01 · Project</h2>
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
        <h2>02 · Assumptions</h2>
        <div class="desc">Ground the analysis: at least one <b>attacker profile</b> is required (it grounds the likelihood), plus device / system / environment / operational assumptions.</div>
        <div class="tabs" id="asm-tabs"></div>
        <div id="asm-body"></div>
        <div style="margin-top:10px"><button class="btn primary" data-act="saveA">Save assumptions</button></div>
      </div>

      <div class="card" id="card-system">
        <h2>03 · System &amp; assets</h2>
        <div class="desc">Decompose the device into components, interfaces and trust boundaries, then list the protected assets and their Confidentiality / Integrity / Availability / Safety objectives (0–5). Components defined here feed the threats in step 06.</div>
        <div class="tabs" id="sys-tabs"></div>
        <div id="sys-body"></div>
        <div style="margin-top:10px"><button class="btn primary" data-act="saveS">Save system &amp; assets</button></div>
      </div>

      <div class="card" id="card-requirements">
        <h2>05 · Security requirements</h2>
        <div class="desc">Derive testable requirements from the threats and link them to the controls that satisfy them — the traceable core (threat &rarr; requirement &rarr; control) that IEC 62443-4-1 / CRA expect.</div>
        <div id="req-body"></div>
        <div style="margin-top:10px"><button class="btn" data-act="addReq">+ Requirement</button> <button class="btn primary" data-act="saveR">Save requirements</button></div>
      </div>

      <div class="card" id="card-threats">
        <h2>06 · Threats &amp; risk</h2>
        <div class="desc">Each threat needs a unique ID, at least one STRIDE category and one affected component. Risk = Likelihood × Impact; the residual reflects the single most-protective countermeasure. The <b>status</b> shows how each threat is being handled.</div>
        <table class="grid"><thead><tr><th class="narrow">ID</th><th>Title</th><th>STRIDE</th><th>Components</th><th class="num">L</th><th class="num">I</th><th>Risk &rarr; residual</th><th class="stat">Status</th><th></th></tr></thead><tbody id="threats-body"></tbody></table>
        <div style="margin-top:10px"><button class="btn" data-act="addT">+ Threat</button> <button class="btn primary" data-act="saveT">Save threats</button></div>
      </div>

      <div class="card" id="card-cms">
        <h2>08 · Countermeasures</h2>
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
function pill(score,band){return '<span class="pill '+R.bandClass(band.name)+'">'+score+' · '+band.name+'</span>';}
function riskCell(t){var r=R.riskOf(t,cms);return pill(r.initial,r.initialBand)+'<span class="arrow">&rarr;</span>'+pill(r.residual,r.residualBand);}
function chip(text,on,attrs,title){return '<span class="chip'+(on?' on':'')+'" role="button" tabindex="0" '+attrs+(title?' title="'+esc(title)+'"':'')+'>'+esc(text)+'</span>';}

const STEPS=[
  ['01','Project','Scope, device, SL-T','scroll','#card-project','project'],
  ['02','Assumptions','Incl. attacker profiles','scroll','#card-assumptions','assumptions'],
  ['03','System & Assets','Components, C/I/A/S','scroll','#card-system','system'],
  ['04','Data Flow Diagram','Layered DeMarco model','cmd','dfd','dfd'],
  ['05','Requirements','Security requirements','scroll','#card-requirements','requirements'],
  ['06','Threats','STRIDE + risk rating','scroll','#card-threats','threats'],
  ['07','Attack trees','Optional · AND/OR','cmd','atree','attackTrees'],
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
function renderProject(p){p=p||{};project={name:p.name||'',sl:p.sl||'SL2',mode:p.mode||'graybox',boundary:p.boundary||''};$('#devname').textContent=project.name?('· '+project.name):'';$('#p-name').value=project.name;$('#p-sl').value=project.sl;$('#p-mode').value=project.mode;$('#p-bnd').value=project.boundary;}
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
  }).join(''):'<tr><td colspan=9 class="hint">No threats yet — add one below.</td></tr>';
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
  }).join(''):'<span class="hint">No countermeasures yet — add one below.</span>';
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
    }).join(''):'<p class="hint">No attacker profiles yet — at least one is required.</p>';
    html+='<button class="btn sm primary" data-act="addAtk">+ Attacker profile</button>';
  } else {
    var key=asmTab, arr=assumptions[key]||[];
    html+=arr.length?arr.map(function(item,i){
      return '<div class="itemcard"><div class="head" style="align-items:flex-start"><span class="idtag">'+esc(item.id||('A-'+(i+1)))+'</span>'+
        '<textarea class="inp grow" rows=2 data-asm="'+key+'" data-ai='+i+' data-k="text" placeholder="Assumption text">'+esc(item.text||'')+'</textarea>'+
        '<select class="inp" style="width:120px" data-asm="'+key+'" data-ai='+i+' data-k="confidence">'+['','low','medium','high'].map(function(c){return '<option value="'+c+'"'+((item.confidence||'')===c?' selected':'')+'>'+(c||'confidence…')+'</option>';}).join('')+'</select>'+
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
      var parentSel='<option value="">— none —</option>'+cList.filter(function(x){return x.id!==c.id;}).map(function(x){return '<option value="'+esc(x.id)+'"'+((c.parent||'')===x.id?' selected':'')+'>'+esc(x.name)+' ('+esc(x.id)+')</option>';}).join('');
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
          '<div class="field"><label>Component</label><select class="inp" data-if='+i+' data-k="component"><option value="">—</option>'+cList.map(function(c){return '<option value="'+esc(c.id)+'"'+((f.component||'')===c.id?' selected':'')+'>'+esc(c.name)+'</option>';}).join('')+'</select></div>'+
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
        '<div class="hint">Members — components enclosed by this boundary</div><div class="chips">'+mem+'</div></div>';
    }).join(''):'<p class="hint">No trust boundaries yet.</p>';
    html+='<button class="btn sm" data-act="addTb">+ Trust boundary</button>';
  } else {
    var aList=system.assets||[];
    html+=aList.length?aList.map(function(a,i){
      var o=a.objectives||{};
      var comp=cList.length?cList.map(function(c){return chip(c.id,(a.components||[]).indexOf(c.id)>=0,'data-act="asComp" data-as='+i+' data-val="'+esc(c.id)+'"',c.name);}).join(''):'<span class="hint">Add components first.</span>';
      var objs=OBJS.map(function(ob){return '<div class="field"><label>'+ob[1]+' · '+ob[0]+'</label><select class="inp" data-as='+i+' data-obj="'+ob[0]+'">'+[0,1,2,3,4,5].map(function(n){return '<option'+((+o[ob[0]]||0)===n?' selected':'')+'>'+n+'</option>';}).join('')+'</select></div>';}).join('');
      return '<div class="itemcard"><div class="head"><span class="idtag">'+esc(a.id||('AS-'+(i+1)))+'</span>'+
        '<input class="inp grow" data-as='+i+' data-k="name" value="'+esc(a.name||'')+'">'+
        '<button class="btn sm danger" data-act="delAs" data-i='+i+'>&#10005;</button></div>'+
        '<div class="grid3"><div class="field"><label>Type</label><select class="inp" data-as='+i+' data-k="type">'+optTags(ASSET_TYPES,a.type||'function')+'</select></div>'+
          '<div class="field" style="grid-column:span 2"><label>Storage</label><input class="inp" data-as='+i+' data-k="storage" value="'+esc(a.storage||'')+'"></div></div>'+
        '<div class="hint" style="margin-top:6px">Components</div><div class="chips">'+comp+'</div>'+
        '<div class="hint" style="margin-top:6px">Security objectives (0–5; impact later defaults to the worst dimension — Bug Bar)</div><div class="objgrid">'+objs+'</div></div>';
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
  }).join(''):'<p class="hint">No requirements yet — derive them from your rated threats.</p>';
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
  if(t.id==='p-name'){project.name=t.value;$('#devname').textContent=t.value?('· '+t.value):'';return;}
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
