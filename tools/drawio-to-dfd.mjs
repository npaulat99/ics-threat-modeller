#!/usr/bin/env node
// draw.io mxGraph XML -> dfd.json (reverse of dfd-to-drawio). Preserves a node's layer/parent if known.
const TYPE = (style = "") => style.includes("partialRectangle") ? "store" : style.includes("ellipse") ? "process" : style.includes("dashed") ? "trust-boundary" : "external-entity";
export function drawioToDfd(xml, prev = { nodes: [], flows: [] }, layer = 1, parentFilter = undefined) {
  const meta = new Map(prev.nodes.map((n) => [n.id, n]));
  const cells = [...xml.matchAll(/<mxCell\s+([^>]*?)\/?>(?:.*?<\/mxCell>)?/gs)].map((m) => m[1]);
  const attr = (s, k) => (s.match(new RegExp(`${k}="([^"]*)"`)) || [, ""])[1];
  const nodes = [], flows = [];
  for (const s of cells) {
    const id = attr(s, "id"); if (!id || id === "0" || id === "1") continue;
    if (/edge="1"/.test(s)) flows.push({ id, label: attr(s, "value"), from: attr(s, "source"), to: attr(s, "target") });
    else if (/vertex="1"/.test(s)) { const p = meta.get(id) || {}; nodes.push({ id, label: attr(s, "value"), type: TYPE(attr(s, "style")), layer: p.layer ?? layer, parent: p.parent ?? (parentFilter !== undefined ? parentFilter : null) }); }
  }
  // keep nodes that are NOT part of the current view (other parent context or other layer)
  const inView = (n) => parentFilter !== undefined ? (n.parent ?? null) === parentFilter : n.layer === layer;
  const others = prev.nodes.filter((n) => !inView(n));
  return { nodes: [...others, ...nodes], flows: [...prev.flows.filter((f) => !nodes.find((n) => n.id === f.from)), ...flows] };
}
