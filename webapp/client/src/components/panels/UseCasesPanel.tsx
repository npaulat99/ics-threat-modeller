// (Mis-)use case diagram editor (step 04b, optional). Native SVG canvas — the webapp client has no
// draw.io dependency (that only lives in vscode-extension/media/drawio), so entities/connections/
// groups are modelled and rendered directly, mirroring the free-form layout of the isomorphic
// UseCaseDiagram model in ../../types. Multiple diagrams are supported; each is its own artifact
// entry under useCases.diagrams.
import { useEffect, useRef, useState } from 'react';
import { useStore, uid } from '../../state/store';
import { cx, confirmDelete } from '../common';
import type { UseCaseArrow, UseCaseConnection, UseCaseDiagram, UseCaseEntity, UseCaseEntityKind, UseCaseGroup } from '../../types';

const ENTITY_LABEL: Record<UseCaseEntityKind, string> = {
    actor: 'Actor',
    'misuse-actor': 'Misuse actor',
    action: 'Action',
    'misuse-action': 'Misuse action',
};
const ENTITY_PREFIX: Record<UseCaseEntityKind, string> = { actor: 'A', 'misuse-actor': 'MA', action: 'U', 'misuse-action': 'MU' };
const ARROW_OPTS: { value: UseCaseArrow; label: string }[] = [
    { value: 'none', label: 'No arrow' },
    { value: 'forward', label: '→ forward' },
    { value: 'backward', label: '← backward' },
    { value: 'both', label: '↔ both' },
];
const KIND_DIMS: Record<UseCaseEntityKind, { w: number; h: number }> = {
    actor: { w: 74, h: 96 },
    'misuse-actor': { w: 74, h: 96 },
    action: { w: 156, h: 70 },
    'misuse-action': { w: 156, h: 70 },
};
const isActorKind = (k: UseCaseEntityKind) => k === 'actor' || k === 'misuse-actor';
const isMisuseKind = (k: UseCaseEntityKind) => k === 'misuse-actor' || k === 'misuse-action';
const center = (e: UseCaseEntity) => {
    const { w, h } = KIND_DIMS[e.kind];
    return { x: (e.x || 0) + w / 2, y: (e.y || 0) + h / 2 };
};
const radiusOf = (e: UseCaseEntity) => (isActorKind(e.kind) ? 46 : 62);

function EntityShape({
    ent,
    selected,
    dimmed,
    onMouseDown,
    onClick,
}: {
    ent: UseCaseEntity;
    selected: boolean;
    dimmed: boolean;
    onMouseDown: (e: React.MouseEvent) => void;
    onClick: () => void;
}) {
    const { w, h } = KIND_DIMS[ent.kind];
    const misuse = isMisuseKind(ent.kind);
    return (
        <g
            className={cx('uc-entity', misuse && 'misuse', selected && 'sel', dimmed && 'dim')}
            transform={`translate(${ent.x || 0},${ent.y || 0})`}
            onMouseDown={onMouseDown}
            onClick={onClick}
        >
            <title>{ent.name || ENTITY_LABEL[ent.kind]}</title>
            {isActorKind(ent.kind) ? (
                <>
                    <circle className="uc-shape" cx={w / 2} cy={16} r={10} />
                    <line className="uc-shape" x1={w / 2} y1={26} x2={w / 2} y2={52} />
                    <line className="uc-shape" x1={w / 2 - 16} y1={34} x2={w / 2 + 16} y2={34} />
                    <line className="uc-shape" x1={w / 2} y1={52} x2={w / 2 - 14} y2={76} />
                    <line className="uc-shape" x1={w / 2} y1={52} x2={w / 2 + 14} y2={76} />
                </>
            ) : (
                <ellipse className="uc-shape" cx={w / 2} cy={h / 2} rx={w / 2 - 4} ry={h / 2 - 4} />
            )}
            <text className="uc-label" x={w / 2} y={isActorKind(ent.kind) ? h - 4 : h / 2 + 4} textAnchor="middle">
                {(ent.name || '(unnamed)').slice(0, 22)}
            </text>
        </g>
    );
}

export default function UseCasesPanel() {
    const data = useStore((s) => s.data)!;
    const save = useStore((s) => s.save);
    const setView = useStore((s) => s.setView);
    const activeId = useStore((s) => s.activeId);
    const doc = data.useCases || { diagrams: [] };
    const diagrams = doc.diagrams || [];
    const [diagramId, setDiagramId] = useState<string | null>(diagrams[0]?.id || null);
    const [selEntity, setSelEntity] = useState<string | null>(null);
    const [linking, setLinking] = useState(false);
    const [connectFrom, setConnectFrom] = useState<string | null>(null);
    const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
    const dragOffset = useRef({ x: 0, y: 0 });
    const svgRef = useRef<SVGSVGElement>(null);

    // Reset local UI selection when switching TRA projects so stale ids from a previous project
    // are never referenced.
    useEffect(() => {
        setDiagramId(diagrams[0]?.id || null);
        setSelEntity(null);
        setLinking(false);
        setConnectFrom(null);
    }, [activeId]);

    const activeDiagram = diagrams.find((d) => d.id === diagramId) || diagrams[0] || null;

    const setDiagrams = (next: UseCaseDiagram[]) => save('useCases', { diagrams: next });
    const updateDiagram = (id: string, patch: Partial<UseCaseDiagram>) => setDiagrams(diagrams.map((d) => (d.id === id ? { ...d, ...patch } : d)));

    const addDiagram = () => {
        const id = uid('UC', diagrams.map((d) => d.id));
        const next: UseCaseDiagram = { id, name: `Use cases ${diagrams.length + 1}`, entities: [], connections: [], groups: [] };
        setDiagrams([...diagrams, next]);
        setDiagramId(id);
    };
    const deleteDiagram = (id: string) => {
        if (!confirmDelete('this use-case diagram')) return;
        const next = diagrams.filter((d) => d.id !== id);
        setDiagrams(next);
        setDiagramId(next[0]?.id || null);
    };

    if (!activeDiagram) {
        return (
            <div className="panel">
                <div className="panelhead">
                    <h1>(Mis-)use cases</h1>
                </div>
                <p className="lead">Model actors, actions and misuse-case variants for the device. Optional and excluded from the report by default.</p>
                <div className="inline">
                    <button className="btn primary" onClick={addDiagram}>
                        + New diagram
                    </button>
                    <button className="btn sm" onClick={() => setView('project')}>
                        ← Exit to project
                    </button>
                </div>
            </div>
        );
    }

    const entities = activeDiagram.entities || [];
    const connections = activeDiagram.connections || [];
    const groups = activeDiagram.groups || [];
    const entityById = new Map(entities.map((e) => [e.id, e]));

    const setEntities = (next: UseCaseEntity[]) => updateDiagram(activeDiagram.id, { entities: next });
    const setConnections = (next: UseCaseConnection[]) => updateDiagram(activeDiagram.id, { connections: next });
    const setGroups = (next: UseCaseGroup[]) => updateDiagram(activeDiagram.id, { groups: next });

    const addEntity = (kind: UseCaseEntityKind) => {
        const id = uid(ENTITY_PREFIX[kind], entities.map((e) => e.id));
        const idx = entities.length;
        setEntities([...entities, { id, kind, name: ENTITY_LABEL[kind], x: 40 + (idx % 5) * 170, y: 40 + Math.floor(idx / 5) * 130 }]);
        setSelEntity(id);
    };
    const updateEntity = (id: string, patch: Partial<UseCaseEntity>) => setEntities(entities.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    const deleteEntity = (id: string) => {
        if (!confirmDelete('this entity')) return;
        setEntities(entities.filter((e) => e.id !== id));
        setConnections(connections.filter((c) => c.from !== id && c.to !== id));
        setGroups(groups.map((g) => ({ ...g, members: (g.members || []).filter((m) => m !== id) })));
        if (selEntity === id) setSelEntity(null);
        if (connectFrom === id) setConnectFrom(null);
    };

    const onEntityClick = (id: string) => {
        if (linking) {
            if (!connectFrom) {
                setConnectFrom(id);
            } else if (connectFrom !== id) {
                const cid = uid('CN', connections.map((c) => c.id));
                setConnections([...connections, { id: cid, from: connectFrom, to: id, arrow: 'forward' }]);
                setConnectFrom(null);
            }
            return;
        }
        setSelEntity(id);
    };

    const onEntityMouseDown = (e: React.MouseEvent, ent: UseCaseEntity) => {
        if (linking) {
            onEntityClick(ent.id);
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        setSelEntity(ent.id);
        const rect = svgRef.current!.getBoundingClientRect();
        dragOffset.current = { x: e.clientX - rect.left - (ent.x || 0), y: e.clientY - rect.top - (ent.y || 0) };
        setDrag({ id: ent.id, x: ent.x || 0, y: ent.y || 0 });
    };

    useEffect(() => {
        if (!drag) return;
        const onMove = (e: MouseEvent) => {
            const rect = svgRef.current!.getBoundingClientRect();
            const x = Math.max(0, Math.round(e.clientX - rect.left - dragOffset.current.x));
            const y = Math.max(0, Math.round(e.clientY - rect.top - dragOffset.current.y));
            setDrag((d) => (d ? { ...d, x, y } : d));
        };
        const onUp = () => setDrag((d) => (d ? (updateEntity(d.id, { x: d.x, y: d.y }), null) : null));
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [drag?.id]);

    const posOf = (ent: UseCaseEntity) => (drag && drag.id === ent.id ? { x: drag.x, y: drag.y } : { x: ent.x || 0, y: ent.y || 0 });

    const updateConnection = (id: string, patch: Partial<UseCaseConnection>) => setConnections(connections.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const deleteConnection = (id: string) => setConnections(connections.filter((c) => c.id !== id));

    const addGroup = () => {
        const id = uid('G', groups.map((g) => g.id));
        setGroups([...groups, { id, name: `Group ${groups.length + 1}`, members: [] }]);
    };
    const updateGroup = (id: string, patch: Partial<UseCaseGroup>) => setGroups(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    const deleteGroup = (id: string) => {
        if (!confirmDelete('this grouping box')) return;
        setGroups(groups.filter((g) => g.id !== id));
    };
    const toggleGroupMember = (group: UseCaseGroup, entId: string) => {
        const members = group.members || [];
        updateGroup(group.id, { members: members.includes(entId) ? members.filter((m) => m !== entId) : [...members, entId] });
    };

    // Canvas + group bounding boxes are derived from live (dragged) entity positions.
    const bbox = (ent: UseCaseEntity) => {
        const { x, y } = posOf(ent);
        const { w, h } = KIND_DIMS[ent.kind];
        return { x1: x, y1: y, x2: x + w, y2: y + h };
    };
    const canvasW = Math.max(760, ...entities.map((e) => bbox(e).x2 + 60), 60);
    const canvasH = Math.max(460, ...entities.map((e) => bbox(e).y2 + 60), 60);

    const groupRects = groups.map((g) => {
        const members = (g.members || []).map((id) => entityById.get(id)).filter((e): e is UseCaseEntity => !!e);
        if (!members.length) return null;
        const boxes = members.map(bbox);
        const pad = 22;
        return {
            group: g,
            x: Math.min(...boxes.map((b) => b.x1)) - pad,
            y: Math.min(...boxes.map((b) => b.y1)) - pad - 18,
            w: Math.max(...boxes.map((b) => b.x2)) - Math.min(...boxes.map((b) => b.x1)) + pad * 2,
            h: Math.max(...boxes.map((b) => b.y2)) - Math.min(...boxes.map((b) => b.y1)) + pad * 2 + 18,
        };
    });

    return (
        <div className="panel">
            <div className="panelhead">
                <h1>(Mis-)use cases</h1>
            </div>
            <p className="lead">Optional supporting diagrams — actors, actions, misuse-case variants and grouping boxes. Excluded from the report by default (toggle in step 01).</p>

            <div className="card">
                <div className="row" style={{ alignItems: 'flex-end' }}>
                    <div className="field" style={{ flex: 2 }}>
                        <label>Diagram</label>
                        <select className="inp" value={activeDiagram.id} onChange={(e) => setDiagramId(e.target.value)}>
                            {diagrams.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name || d.id}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="field" style={{ flex: 2 }}>
                        <label>Name</label>
                        <input className="inp" value={activeDiagram.name || ''} onChange={(e) => updateDiagram(activeDiagram.id, { name: e.target.value })} />
                    </div>
                    <button className="btn sm" onClick={addDiagram}>
                        + Diagram
                    </button>
                    <button className="btn sm danger" onClick={() => deleteDiagram(activeDiagram.id)}>
                        Delete diagram
                    </button>
                    <button className="btn sm" onClick={() => setView('project')}>
                        ← Exit to project
                    </button>
                </div>
            </div>

            <div className="card">
                <div className="uc-toolbar">
                    <button className="btn sm" onClick={() => addEntity('actor')}>
                        + Actor
                    </button>
                    <button className="btn sm" onClick={() => addEntity('misuse-actor')}>
                        + Misuse actor
                    </button>
                    <button className="btn sm" onClick={() => addEntity('action')}>
                        + Action
                    </button>
                    <button className="btn sm" onClick={() => addEntity('misuse-action')}>
                        + Misuse action
                    </button>
                    <button
                        className={cx('btn sm', linking && 'primary')}
                        onClick={() => {
                            setLinking((v) => !v);
                            setConnectFrom(null);
                        }}
                    >
                        🔗 {linking ? 'Linking… (click two entities)' : 'Link entities'}
                    </button>
                    <button className="btn sm" onClick={addGroup}>
                        + Grouping box
                    </button>
                </div>

                <div className="uc-canvas">
                    <svg ref={svgRef} width={canvasW} height={canvasH} onMouseDown={() => setSelEntity(null)}>
                        <defs>
                            <marker id="uc-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                                <path d="M0,0 L10,5 L0,10 z" />
                            </marker>
                        </defs>

                        {groupRects.map((r) => r && (
                            <g key={r.group.id}>
                                <rect className="uc-group-rect" x={r.x} y={r.y} width={r.w} height={r.h} rx={8} />
                                <text className="uc-group-label" x={r.x + 10} y={r.y + 16}>
                                    {r.group.name}
                                </text>
                            </g>
                        ))}

                        {connections.map((c) => {
                            const from = entityById.get(c.from);
                            const to = entityById.get(c.to);
                            if (!from || !to) return null;
                            const fromPos = { ...center(from), ...(drag && drag.id === from.id ? { x: drag.x + KIND_DIMS[from.kind].w / 2, y: drag.y + KIND_DIMS[from.kind].h / 2 } : {}) };
                            const toPos = { ...center(to), ...(drag && drag.id === to.id ? { x: drag.x + KIND_DIMS[to.kind].w / 2, y: drag.y + KIND_DIMS[to.kind].h / 2 } : {}) };
                            const dx = toPos.x - fromPos.x;
                            const dy = toPos.y - fromPos.y;
                            const dist = Math.hypot(dx, dy) || 1;
                            const ux = dx / dist;
                            const uy = dy / dist;
                            const x1 = fromPos.x + ux * radiusOf(from);
                            const y1 = fromPos.y + uy * radiusOf(from);
                            const x2 = toPos.x - ux * radiusOf(to);
                            const y2 = toPos.y - uy * radiusOf(to);
                            const arrow = c.arrow || 'none';
                            return (
                                <g key={c.id}>
                                    <line
                                        className="uc-conn"
                                        x1={x1}
                                        y1={y1}
                                        x2={x2}
                                        y2={y2}
                                        strokeDasharray={c.dashed ? '6 4' : undefined}
                                        markerEnd={arrow === 'forward' || arrow === 'both' ? 'url(#uc-arrow)' : undefined}
                                        markerStart={arrow === 'backward' || arrow === 'both' ? 'url(#uc-arrow)' : undefined}
                                    />
                                    {c.label && (
                                        <text className="uc-conn-label" x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle">
                                            {c.label}
                                        </text>
                                    )}
                                </g>
                            );
                        })}

                        {entities.map((ent) => (
                            <EntityShape
                                key={ent.id}
                                ent={{ ...ent, ...posOf(ent) }}
                                selected={selEntity === ent.id || connectFrom === ent.id}
                                dimmed={linking && !!connectFrom && connectFrom !== ent.id}
                                onMouseDown={(e) => onEntityMouseDown(e, ent)}
                                onClick={() => onEntityClick(ent.id)}
                            />
                        ))}
                    </svg>
                </div>
                <p className="hint">Drag entities to reposition. Use “Link entities”, then click a source and a target to connect them.</p>
            </div>

            <div className="card">
                <h3>Entities</h3>
                <div className="list">
                    {entities.map((ent) => (
                        <div className="item" key={ent.id}>
                            <div className="row" style={{ alignItems: 'center' }}>
                                <select className="inp" style={{ width: 140 }} value={ent.kind} onChange={(e) => updateEntity(ent.id, { kind: e.target.value as UseCaseEntityKind })}>
                                    {(Object.keys(ENTITY_LABEL) as UseCaseEntityKind[]).map((k) => (
                                        <option key={k} value={k}>
                                            {ENTITY_LABEL[k]}
                                        </option>
                                    ))}
                                </select>
                                <input className="inp grow" value={ent.name} onChange={(e) => updateEntity(ent.id, { name: e.target.value })} />
                                <button className="btn sm danger" onClick={() => deleteEntity(ent.id)}>
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                    {!entities.length && <p className="hint">No entities yet — add an actor or action above.</p>}
                </div>
            </div>

            <div className="card">
                <h3>Connections</h3>
                <div className="list">
                    {connections.map((c) => (
                        <div className="item" key={c.id}>
                            <div className="row" style={{ alignItems: 'center' }}>
                                <span className="hint" style={{ width: 190 }}>
                                    {entityById.get(c.from)?.name || c.from} → {entityById.get(c.to)?.name || c.to}
                                </span>
                                <select className="inp" style={{ width: 130 }} value={c.arrow || 'none'} onChange={(e) => updateConnection(c.id, { arrow: e.target.value as UseCaseArrow })}>
                                    {ARROW_OPTS.map((o) => (
                                        <option key={o.value} value={o.value}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                                <label className="check">
                                    <input type="checkbox" checked={!!c.dashed} onChange={(e) => updateConnection(c.id, { dashed: e.target.checked })} /> dashed
                                </label>
                                <input className="inp grow" placeholder="label" value={c.label || ''} onChange={(e) => updateConnection(c.id, { label: e.target.value })} />
                                <button className="btn sm danger" onClick={() => deleteConnection(c.id)}>
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                    {!connections.length && <p className="hint">No connections yet.</p>}
                </div>
            </div>

            <div className="card">
                <h3>Grouping boxes</h3>
                <div className="list">
                    {groups.map((g) => (
                        <div className="item" key={g.id}>
                            <div className="row" style={{ alignItems: 'center' }}>
                                <input className="inp grow" value={g.name} onChange={(e) => updateGroup(g.id, { name: e.target.value })} />
                                <button className="btn sm danger" onClick={() => deleteGroup(g.id)}>
                                    ✕
                                </button>
                            </div>
                            <div className="chips" style={{ marginTop: 6 }}>
                                {entities.map((ent) => (
                                    <label key={ent.id} className={cx('chip', (g.members || []).includes(ent.id) && 'on')} onClick={() => toggleGroupMember(g, ent.id)}>
                                        {ent.name || ent.id}
                                    </label>
                                ))}
                                {!entities.length && <span className="hint">Add entities first.</span>}
                            </div>
                        </div>
                    ))}
                    {!groups.length && <p className="hint">No grouping boxes yet.</p>}
                </div>
            </div>
        </div>
    );
}
