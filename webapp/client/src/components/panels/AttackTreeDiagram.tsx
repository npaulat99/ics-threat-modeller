// Visual Attack-Defense Tree: a graphical, editable rendering of the same AdNode tree the list
// view edits. Notation (Kordy et al. + Jhawar et al. SAND): root on top, children branch downward;
// a gate is drawn below a parent that has more than one child — OR = plain fan-out, AND = fan-out
// with a connecting arc, SAND = AND arc carrying a left→right arrow (child order = execution order).
// Attack, defence and vulnerability nodes are drawn the same way and may alternate recursively.
import { useMemo, useState } from 'react';
import { useStore } from '../../state/store';
import {
    evaluate,
    COST_FACTORS,
    KIND_LABEL,
    GATES,
    ADD_KINDS,
    ACCESS_OPTS,
    SKILL_OPTS,
    accessLabel,
    skillLabel,
} from '../../lib/attackTree';
import type { AdGate, AdKind, AdNode, AttackTree } from '../../types';

const NW = 182; // node width
const NH = 58; // node height
const HGAP = 30; // gap between sibling subtrees
const VGAP = 98; // vertical gap between a node's top and its children's top is NH + VGAP
const PAD = 28; // canvas padding
const GATE_DY = 30; // gate distance below the parent's bottom edge

interface Ops {
    upd: (id: string, patch: Partial<AdNode>) => void;
    add: (parentId: string, kind: AdKind) => void;
    del: (id: string) => void;
    move: (id: string, dir: -1 | 1) => void;
}

type Placed = { node: AdNode; x: number; y: number };

/** Width (px) needed by a node's whole subtree. */
function measure(node: AdNode): number {
    const kids = node.children || [];
    if (!kids.length) return NW;
    const w = kids.map(measure).reduce((a, b) => a + b, 0) + HGAP * (kids.length - 1);
    return Math.max(NW, w);
}

/** Assign an (x = centre, y = top) to every node, laying children out horizontally under the parent. */
function place(node: AdNode, cx: number, top: number, out: Placed[]) {
    out.push({ node, x: cx, y: top });
    const kids = node.children || [];
    if (!kids.length) return;
    const widths = kids.map(measure);
    const total = widths.reduce((a, b) => a + b, 0) + HGAP * (kids.length - 1);
    let x = cx - total / 2;
    const childTop = top + NH + VGAP;
    for (let i = 0; i < kids.length; i++) {
        place(kids[i], x + widths[i] / 2, childTop, out);
        x += widths[i] + HGAP;
    }
}

const nextGate = (g?: AdGate): AdGate => GATES[(GATES.indexOf(g || 'AND') + 1) % GATES.length];

export default function AttackTreeDiagram({ tree, ops }: { tree: AttackTree; ops: Ops }) {
    const cms = useStore((s) => s.data!.countermeasures.countermeasures || []);
    const cmById = useMemo(() => new Map(cms.map((c) => [c.id, c])), [cms]);
    const [selId, setSelId] = useState<string | null>(tree.root.id);

    const placed = useMemo(() => {
        const out: Placed[] = [];
        place(tree.root, PAD + measure(tree.root) / 2, PAD, out);
        return out;
    }, [tree.root]);
    const posById = useMemo(() => new Map(placed.map((p) => [p.node.id, p])), [placed]);

    const W = Math.max(...placed.map((p) => p.x + NW / 2)) + PAD;
    const H = Math.max(...placed.map((p) => p.y + NH)) + PAD;

    const selected = selId ? posById.get(selId)?.node || null : null;

    // ---- edges + gates -----------------------------------------------------
    const edges: JSX.Element[] = [];
    const gates: JSX.Element[] = [];
    for (const { node, x: px, y: py } of placed) {
        const kids = node.children || [];
        if (!kids.length) continue;
        const parentBottom = py + NH;
        const kidPos = kids.map((k) => posById.get(k.id)!).filter(Boolean);
        const childTop = kidPos[0].y;
        if (kids.length === 1) {
            const k = kidPos[0];
            edges.push(<path key={'e' + node.id} className="adt-edge" d={`M ${px},${parentBottom} L ${k.x},${childTop}`} />);
            continue;
        }
        const gateY = parentBottom + GATE_DY;
        edges.push(<path key={'stem' + node.id} className="adt-edge" d={`M ${px},${parentBottom} L ${px},${gateY}`} />);
        for (const k of kidPos) edges.push(<path key={'e' + node.id + k.node.id} className="adt-edge" d={`M ${px},${gateY} L ${k.x},${childTop}`} />);

        const gate = node.gate || 'AND';
        if (gate !== 'OR') {
            const arcY = gateY + 22;
            const t = (arcY - gateY) / (childTop - gateY);
            const lx = px + (kidPos[0].x - px) * t;
            const rx = px + (kidPos[kidPos.length - 1].x - px) * t;
            gates.push(<path key={'arc' + node.id} className="adt-arc" d={`M ${lx},${arcY} Q ${px},${arcY + 15} ${rx},${arcY}`} />);
            if (gate === 'SAND') gates.push(<path key={'arr' + node.id} className="adt-arrow" d={`M ${rx - 2},${arcY - 4.5} L ${rx + 6},${arcY} L ${rx - 2},${arcY + 4.5} Z`} />);
        }
        gates.push(
            <g key={'g' + node.id} className="adt-gate" transform={`translate(${px},${gateY})`} onClick={() => ops.upd(node.id, { gate: nextGate(node.gate) })}>
                <rect x={-22} y={-11} width={44} height={22} rx={11} />
                <text x={0} y={4} textAnchor="middle">{gate}</text>
            </g>,
        );
    }

    return (
        <div className="adt-diagram">
            <div className="adt-legend">
                <span className="adt-lg k-step">Attack</span>
                <span className="adt-lg k-countermeasure">Defence</span>
                <span className="adt-lg k-vulnerability">Vulnerability</span>
                <span className="muted">· click a node to edit · click a gate to change AND / OR / SAND · SAND arrow = sequence</span>
            </div>
            <div className="adt-canvas">
                <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
                    {edges}
                    {gates}
                    {placed.map(({ node, x, y }) => {
                        const isStep = node.kind === 'step' || node.kind === 'substep';
                        const hasStructuralKids = (node.children || []).some((c) => c.kind !== 'countermeasure' && c.kind !== 'vulnerability');
                        const cm = node.countermeasureRef ? cmById.get(node.countermeasureRef) : undefined;
                        return (
                            <foreignObject key={node.id} x={x - NW / 2} y={y} width={NW} height={NH}>
                                <div
                                    className={'adt-node k-' + node.kind + (selId === node.id ? ' sel' : '')}
                                    onClick={() => setSelId(node.id)}
                                    title={node.label}
                                >
                                    <div className="adt-node-kind">{KIND_LABEL[node.kind]}</div>
                                    <div className="adt-node-label">{node.label}</div>
                                    {isStep && !hasStructuralKids && (
                                        <div className="adt-node-sub">acc {node.access ?? '–'} · skill {node.skill ?? '–'}</div>
                                    )}
                                    {node.kind === 'countermeasure' && <div className="adt-node-sub">{cm ? `${cm.id}` : 'unlinked'}</div>}
                                </div>
                            </foreignObject>
                        );
                    })}
                </svg>
            </div>

            {selected && <NodeEditor node={selected} ops={ops} isRoot={selected.id === tree.root.id} cmById={cmById} cms={cms} />}
        </div>
    );
}

function NodeEditor({
    node,
    ops,
    isRoot,
    cmById,
    cms,
}: {
    node: AdNode;
    ops: Ops;
    isRoot: boolean;
    cmById: Map<string, any>;
    cms: { id: string; title: string; status?: string }[];
}) {
    const isStep = node.kind === 'step' || node.kind === 'substep';
    const isStructural = !['countermeasure', 'vulnerability'].includes(node.kind);
    const hasStructuralKids = (node.children || []).some((c) => c.kind !== 'countermeasure' && c.kind !== 'vulnerability');
    const m = evaluate(node, cmById);
    return (
        <div className="adt-editor">
            <div className="adt-editrow">
                <span className={'adkind k-' + node.kind}>{KIND_LABEL[node.kind]}</span>
                <input className="inp grow" value={node.label} onChange={(e) => ops.upd(node.id, { label: e.target.value })} />
                {isStructural && (
                    <select className="inp" style={{ width: 92 }} value={node.gate || 'AND'} onChange={(e) => ops.upd(node.id, { gate: e.target.value as AdGate })} title="How the children combine">
                        {GATES.map((g) => (
                            <option key={g}>{g}</option>
                        ))}
                    </select>
                )}
                {node.kind === 'countermeasure' && (
                    <select className="inp" style={{ width: 170 }} value={node.countermeasureRef || ''} onChange={(e) => ops.upd(node.id, { countermeasureRef: e.target.value || undefined })} title="Link an existing countermeasure">
                        <option value="">(link CM…)</option>
                        {cms.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.id} · {c.title}
                            </option>
                        ))}
                    </select>
                )}
                {!isRoot && (
                    <>
                        <button className="btn sm" title="Move left (earlier in sequence)" onClick={() => ops.move(node.id, -1)}>
                            ←
                        </button>
                        <button className="btn sm" title="Move right (later in sequence)" onClick={() => ops.move(node.id, 1)}>
                            →
                        </button>
                        <button className="btn sm danger" title="Delete node" onClick={() => ops.del(node.id)}>
                            ✕
                        </button>
                    </>
                )}
            </div>

            {isStep && !hasStructuralKids && (
                <div className="adattrs">
                    <label className="minifield" style={{ width: 172 }}>
                        <span>Required access</span>
                        <select className="inp" value={node.access ?? 3} onChange={(e) => ops.upd(node.id, { access: Number(e.target.value) })}>
                            {ACCESS_OPTS.map(([v, l]) => (
                                <option key={v} value={v}>
                                    {v} · {l}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="minifield" style={{ width: 172 }}>
                        <span>Required skill</span>
                        <select className="inp" value={node.skill ?? 2} onChange={(e) => ops.upd(node.id, { skill: Number(e.target.value) })}>
                            {SKILL_OPTS.map(([v, l]) => (
                                <option key={v} value={v}>
                                    {v} · {l}
                                </option>
                            ))}
                        </select>
                    </label>
                    <details className="costf">
                        <summary>cost factors</summary>
                        <div className="costgrid">
                            {COST_FACTORS.map((f) => (
                                <label key={f.k} className="minifield">
                                    <span title={`weight ${f.weight}`}>{f.label}</span>
                                    <select className="inp" value={(node.cost as any)?.[f.k] ?? ''} onChange={(e) => ops.upd(node.id, { cost: { ...(node.cost || {}), [f.k]: e.target.value === '' ? undefined : Number(e.target.value) } })}>
                                        <option value="">–</option>
                                        {[1, 2, 3, 4, 5].map((n) => (
                                            <option key={n} value={n}>{n}</option>
                                        ))}
                                    </select>
                                </label>
                            ))}
                        </div>
                    </details>
                </div>
            )}

            {hasStructuralKids && (
                <div className="adderived" title="Derived bottom-up from the sub-steps via the gate logic (AND/SAND = hardest sub-step, OR = easiest).">
                    <span className="dtag">required access <b>{Math.round(m.accessReq) || '–'} · {accessLabel(m.accessReq)}</b></span>
                    <span className="dtag">required skill <b>{Math.round(m.skillReq) || '–'} · {skillLabel(m.skillReq)}</b></span>
                    <span className="dtag">success ≈ {Math.round(m.prob * 100)}%</span>
                    <span className="muted">derived from {node.gate} of sub-steps</span>
                </div>
            )}

            <div className="adadd">
                <span className="hint" style={{ marginRight: 4 }}>Add child:</span>
                {ADD_KINDS.map((k) => (
                    <button key={k} className="btn sm ghost" onClick={() => ops.add(node.id, k)}>
                        + {KIND_LABEL[k]}
                    </button>
                ))}
            </div>
        </div>
    );
}
