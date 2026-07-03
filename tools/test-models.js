// Unit tests for the isomorphic webview models (no VS Code needed). Run: node tools/test-models.js
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const DfdModel = require(path.join(root, "vscode-extension/media/dfd-model.js"));
const AtModel = require(path.join(root, "vscode-extension/media/attacktree-model.js"));

let passed = 0;
function ok(name, cond) { assert.ok(cond, "FAIL: " + name); passed++; }

/* ---------- DFD model ---------- */
const dfd = JSON.parse(fs.readFileSync(path.join(root, "projects/example-radar-level-sensor/04-dfd/dfd.json"), "utf8"));

const rootSibs = DfdModel.siblings(dfd, null).map((n) => n.id);
ok("root siblings exclude trust boundary", JSON.stringify(rootSibs) === JSON.stringify(["N-DCS", "N-PHONE", "N-DEV"]));

const devKids = DfdModel.children(dfd, "N-DEV").map((n) => n.id).sort();
ok("N-DEV has 5 children", devKids.length === 5 && devKids.includes("N-MCU") && devKids.includes("TB-CORE"));

ok("layerOf root is 1", DfdModel.layerOf(dfd, null) === 1);
ok("layerOf into N-DEV is 2", DfdModel.layerOf(dfd, "N-DEV") === 2);

const laidOut = DfdModel.layout(dfd, null).filter((n) => n.type !== "trust-boundary");
ok("layout assigns numeric x/y", laidOut.every((n) => typeof n.x === "number" && typeof n.y === "number"));

const svgRoot = DfdModel.render(dfd, null, "N-DEV");
ok("render emits process ellipse", svgRoot.includes("<ellipse"));
ok("render emits external rect", svgRoot.includes("<rect"));
ok("render tags nodes with data-id", svgRoot.includes("data-id='N-DEV'"));
ok("render highlights focus", svgRoot.includes("#1565c0"));
ok("render draws boundary dashes", svgRoot.includes("stroke-dasharray"));

// multiprocess must be a DOUBLE concentric ellipse (per DataFlowDiagram.xml), not an ellipse+line
const mpDfd = { nodes: [{ id: "MP", label: "x", type: "multiprocess", layer: 1, parent: null }], flows: [] };
const mpSvg = DfdModel.render(mpDfd, null, null);
ok("multiprocess renders two concentric ellipses", (mpSvg.match(/<ellipse/g) || []).length === 2);
ok("multiprocess has no stray vertical line", !mpSvg.includes("<line"));

// mutation tests on a deep copy
const d2 = JSON.parse(JSON.stringify(dfd));
const before = d2.nodes.length;
const added = DfdModel.addNode(d2, null, "process", "Test node");
ok("addNode adds a node with parent null/layer1", added.parent === null && added.layer === 1 && d2.nodes.length === before + 1);
const fl = DfdModel.addFlow(d2, "N-DCS", added.id, "x");
ok("addFlow adds a flow", d2.flows.some((f) => f.id === fl.id && f.from === "N-DCS"));

const d3 = JSON.parse(JSON.stringify(dfd));
DfdModel.deleteNode(d3, "N-DEV");
ok("delete removes node + descendants", !d3.nodes.some((n) => ["N-DEV", "N-MCU", "N-BT", "N-HART", "N-CFG", "TB-CORE"].includes(n.id)));
ok("delete removes flows touching removed nodes", !d3.flows.some((f) => ["N-DEV", "N-MCU", "N-CFG"].includes(f.from) || ["N-DEV", "N-MCU"].includes(f.to)));
ok("delete cleans trust-boundary members", d3.nodes.filter((n) => n.id === "TB-ENC").every((tb) => !(tb.members || []).includes("N-DEV")));

/* ---------- Attack-defense tree model (schema-identical to the webapp) ---------- */
const atreeDoc = JSON.parse(fs.readFileSync(path.join(root, "projects/example-radar-level-sensor/07-attack-trees/attack-trees.json"), "utf8"));
const tree = atreeDoc.trees[0];

ok("attack-trees.json holds a trees array", Array.isArray(atreeDoc.trees) && !!tree.root);
ok("root is a goal node", tree.root.kind === "goal");
ok("find locates a node", AtModel.find(tree.root, "ss1").label.includes("wiring"));
ok("parentOf is correct", AtModel.parentOf(tree.root, "ss1").id === "s1");
ok("parentOf root is null", AtModel.parentOf(tree.root, "g1") === null);

const t2 = JSON.parse(JSON.stringify(tree));
const child = AtModel.addChild(t2.root, "s1", "substep");
ok("addChild appends a kinded node under parent", child.kind === "substep" && AtModel.parentOf(t2.root, child.id).id === "s1");
const sib = AtModel.addSibling(t2.root, "ss1", "step");
ok("addSibling shares parent", AtModel.parentOf(t2.root, sib.id).id === "s1");
ok("addSibling on root returns null", AtModel.addSibling(t2.root, "g1", "step") === null);

const t3 = JSON.parse(JSON.stringify(tree));
ok("cycleGate OR->SAND", AtModel.cycleGate(t3.root, "g1") === "SAND");
ok("cycleGate on a defence node is null", AtModel.cycleGate(t3.root, "cm1") === null);
ok("setKind to countermeasure drops gate", (AtModel.setKind(t3.root, "s1", "countermeasure"), !AtModel.find(t3.root, "s1").gate));
const t3b = JSON.parse(JSON.stringify(tree));
ok("remove deletes a node", AtModel.remove(t3b.root, "ss1") === true && AtModel.find(t3b.root, "ss1") === null);
ok("remove root returns false", AtModel.remove(t3b.root, "g1") === false);

// deterministic metrics
const cmMap = { CM1: { status: "implemented" } };
const met = AtModel.evaluate(tree.root, cmMap);
ok("evaluate returns a probability in [0,1]", met.prob >= 0 && met.prob <= 1);
ok("evaluate aggregates required access (AND/SAND = max of members)", AtModel.evaluate(AtModel.find(tree.root, "s1"), cmMap).accessReq === 5);
ok("likelihoodFromProb maps to 1-5", AtModel.likelihoodFromProb(1) === 5 && AtModel.likelihoodFromProb(0.01) === 1);

const html = AtModel.toHtml(tree.root);
ok("toHtml nests gates", html.includes("[OR]") && html.includes("[AND]"));
const r = AtModel.render(tree, "s1");
ok("render returns sized svg", r.width > 0 && r.height > 0 && r.svg.includes("data-id='s1'"));
ok("render shows gate label", r.svg.includes(">OR<") || r.svg.includes(">AND<"));

/* ---------- Risk model ---------- */
const RiskModel = require(path.join(root, "vscode-extension/media/risk-model.js"));
ok("band Low", RiskModel.band(3, null).name === "Low");
ok("band High", RiskModel.band(16, null).name === "High");
ok("band Critical", RiskModel.band(25, null).name === "Critical");
ok("deriveImpact is Bug Bar max(C/I/A/S)", RiskModel.deriveImpact({ confidentiality: 1, integrity: 5, availability: 3, safety: 2 }) === 5);
ok("deriveLikelihood geo-mean diagonal", RiskModel.deriveLikelihood({ exposure: 3, exploitability: 3 }) === 3);
ok("deriveLikelihood clamps to 5", RiskModel.deriveLikelihood({ exposure: 5, exploitability: 5 }) === 5);
const rTh = { id: "T1", likelihood: 4, impact: 4 };
const rCms = [
  { id: "A", addresses: [{ threat: "T1", residualLikelihood: 2, residualImpact: 4 }] },
  { id: "B", addresses: [{ threat: "T1", residualLikelihood: 1, residualImpact: 5 }] },
];
const rr = RiskModel.riskOf(rTh, rCms, null);
ok("initial risk 16 High", rr.initial === 16 && rr.initialBand.name === "High");
ok("residual is single most-protective control (5), not min×min (4)", rr.residual === 5 && rr.residualLikelihood === 1 && rr.residualImpact === 5);
ok("no countermeasure ⇒ residual = initial", RiskModel.riskOf(rTh, [], null).residual === 16);

console.log("All " + passed + " model assertions passed.");
