#!/usr/bin/env node
// dfd.json -> draw.io (.drawio) using DeMarco shapes. Used by the extension and standalone.
// Usage: node tools/dfd-to-drawio.mjs projects/<device>/04-dfd/dfd.json [layer]
import { readFileSync, writeFileSync } from "node:fs";
const STYLE = {
  "external-entity": "rounded=0;whiteSpace=wrap;html=1;strokeWidth=2;",
  process: "ellipse;whiteSpace=wrap;html=1;strokeWidth=2;",
  multiprocess: "ellipse;whiteSpace=wrap;html=1;strokeWidth=2;",
  store: "shape=partialRectangle;whiteSpace=wrap;html=1;left=0;right=0;fillColor=none;strokeWidth=2;",
  "trust-boundary": "rounded=1;dashed=1;fillColor=none;strokeWidth=2;",
};
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ROW = { "external-entity": 0, process: 1, multiprocess: 1, store: 2 };
export function dfdToDrawio(dfd, layer = 1, focus = null, parentFilter = undefined) {
  // Select by parent (recursive drill-down) when a parent filter is given; otherwise by layer number.
  const nodes = parentFilter !== undefined ? dfd.nodes.filter((n) => (n.parent ?? null) === parentFilter) : dfd.nodes.filter((n) => n.layer === layer);
  const col = { 0: 0, 1: 0, 2: 0 };
  // 1) lay out elements, remember boxes so trust boundaries can auto-size around their members.
  const pos = {};
  const cells = nodes.filter((n) => n.type !== "trust-boundary").map((n) => {
    const r = ROW[n.type] ?? 1, x = n.x ?? 60 + col[r]++ * 220, y = n.y ?? 80 + r * 180;
    pos[n.id] = { x, y, w: 120, h: 60 };
    const hl = n.id === focus ? "strokeColor=#1565c0;strokeWidth=4;" : "";
    return `<mxCell id="${esc(n.id)}" value="${esc(n.label)}" style="${STYLE[n.type] || STYLE.process}${hl}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="120" height="60" as="geometry"/></mxCell>`;
  });
  // 2) trust boundaries first (behind); size from explicit geometry or from the member bounding box.
  const tb = nodes.filter((n) => n.type === "trust-boundary").map((n) => {
    let x = n.x ?? 40, y = n.y ?? 200, w = n.w ?? 360, h = n.h ?? 160;
    const mem = (n.members || []).map((id) => pos[id]).filter(Boolean);
    if (n.x === undefined && mem.length) {
      const pad = 24;
      x = Math.min(...mem.map((b) => b.x)) - pad; y = Math.min(...mem.map((b) => b.y)) - pad;
      w = Math.max(...mem.map((b) => b.x + b.w)) - x + pad; h = Math.max(...mem.map((b) => b.y + b.h)) - y + pad;
    }
    return `<mxCell id="${esc(n.id)}" value="${esc(n.label)}" style="${STYLE["trust-boundary"]};verticalAlign=top;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`;
  });
  const ids = new Set(nodes.map((n) => n.id));
  const edges = dfd.flows.filter((f) => ids.has(f.from) && ids.has(f.to)).map((f) => `<mxCell id="${esc(f.id)}" value="${esc(f.label || "")}" style="endArrow=classic;html=1;strokeWidth=2;edgeStyle=orthogonalEdgeStyle;rounded=0;" edge="1" parent="1" source="${esc(f.from)}" target="${esc(f.to)}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  const model = `<mxGraphModel dx="800" dy="600" grid="1" gridSize="10" guides="1" connect="1" arrows="1" page="1" pageWidth="850" pageHeight="1100"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${tb.join("")}${cells.join("")}${edges.join("")}</root></mxGraphModel>`;
  return `<mxfile host="vscode"><diagram name="Layer ${layer}">${model}</diagram></mxfile>`;
}
if (process.argv[1]?.endsWith("dfd-to-drawio.mjs")) {
  const f = process.argv[2]; const layer = +(process.argv[3] || 1);
  writeFileSync(f.replace(/\.json$/, ".drawio"), dfdToDrawio(JSON.parse(readFileSync(f, "utf8")), layer));
  console.log("wrote", f.replace(/\.json$/, ".drawio"));
}
