import * as vscode from "vscode";

// Native DFD canvas: renders dfd.json directly in a webview (no iframe), so keyboard navigation works
// and only DeMarco shapes exist. Recursive layers via parent drill-down. A right-hand inspector edits
// the selected node/boundary (label, type, linked component, trust-boundary members, data flows).
// Two-way sync with the JSON file. The schema is identical to the tra-webapp so projects interchange.
export class NativeDfdEditor implements vscode.CustomTextEditorProvider {
  constructor(private extUri: vscode.Uri) {}

  async resolveCustomTextEditor(doc: vscode.TextDocument, panel: vscode.WebviewPanel) {
    const media = vscode.Uri.joinPath(this.extUri, "media");
    panel.webview.options = { enableScripts: true, localResourceRoots: [media] };
    const modelUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(media, "dfd-model.js"));
    const cssUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(media, "tra-ui.css"));
    const logoUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(media, "embedrisk-logo.svg"));
    const nonce = String(Math.random()).slice(2);
    const csp = `default-src 'none'; img-src ${panel.webview.cspSource}; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${panel.webview.cspSource};`;

    const projRoot = vscode.Uri.joinPath(doc.uri, "..", "..");
    const readComponents = async () => {
      try {
        const sys = JSON.parse(Buffer.from(await vscode.workspace.fs.readFile(vscode.Uri.joinPath(projRoot, "03-system-assets/system.json"))).toString());
        return (sys.components || []).map((c: any) => ({ id: c.id, name: c.name }));
      } catch { return []; }
    };

    let lastText = "";
    const post = async () => panel.webview.postMessage({ type: "load", dfd: doc.getText() || '{"nodes":[],"flows":[]}', components: await readComponents() });
    const save = async (text: string) => {
      lastText = text;
      const ed = new vscode.WorkspaceEdit();
      ed.replace(doc.uri, new vscode.Range(0, 0, doc.lineCount, 0), text);
      await vscode.workspace.applyEdit(ed);
    };

    panel.webview.html = this.html(modelUri, cssUri, logoUri, csp, nonce);

    const sub = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === doc.uri.toString() && e.document.getText() !== lastText) post();
    });
    panel.onDidDispose(() => sub.dispose());

    panel.webview.onDidReceiveMessage(async (m) => {
      if (m.type === "ready") { await post(); }
      else if (m.type === "save") { await save(m.dfd); }
    });
  }

  private html(modelUri: vscode.Uri, cssUri: vscode.Uri, logoUri: vscode.Uri, csp: string, nonce: string): string {
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
}
