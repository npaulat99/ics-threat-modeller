import { useRef, useState } from 'react';
import { uid, useStore } from '../../state/store';
import type { Dfd, DfdNode, DfdNodeType, Flow, UseCaseDiagram } from '../../types';
import { routeAround, roundedPath } from '@shared/dfdEngine.js';

const NODE_DIMS: Record<Exclude<DfdNodeType, 'trust-boundary'>, { w: number; h: number }> = {
    process: { w: 150, h: 90 },
    multiprocess: { w: 150, h: 90 },
    store: { w: 160, h: 72 },
    'external-entity': { w: 160, h: 72 },
};

const NODE_TYPES: Exclude<DfdNodeType, 'trust-boundary'>[] = ['process', 'multiprocess', 'store', 'external-entity'];

function nodeTypeLabel(type: DfdNodeType) {
    return type === 'external-entity' ? 'External entity' : type === 'multiprocess' ? 'Multi-process' : type[0].toUpperCase() + type.slice(1);
}

function nodeTypeForComponent(component: { kind?: string } | undefined, fallback: DfdNodeType): Exclude<DfdNodeType, 'trust-boundary'> {
    if (component?.kind === 'store') return 'store';
    if (component?.kind === 'external-entity') return 'external-entity';
    if (component?.kind === 'multiprocess') return 'multiprocess';
    return fallback === 'trust-boundary' ? 'process' : fallback;
}

function curvedPath(from: { x: number; y: number }, to: { x: number; y: number }, obstacles: { x: number; y: number; w: number; h: number }[], offset: number) {
    const route = routeAround(from.x, from.y, to.x, to.y, obstacles, 16);
    const directDistance = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    const routeDistance = route.slice(1).reduce((total, point, index) => total + Math.hypot(point[0] - route[index][0], point[1] - route[index][1]), 0);
    if (route.length > 2 && routeDistance <= 2.4 * directDistance) return roundedPath(route, 14);
    const controlX = (from.x + to.x) / 2 + (-(to.y - from.y) / directDistance) * offset;
    const controlY = (from.y + to.y) / 2 + ((to.x - from.x) / directDistance) * offset;
    return `M ${from.x},${from.y} Q ${controlX},${controlY} ${to.x},${to.y}`;
}

function outlinePoint(position: { x?: number; y?: number }, type: Exclude<DfdNodeType, 'trust-boundary'>, toward: { x: number; y: number }) {
    const size = NODE_DIMS[type];
    const center = { x: (position.x || 0) + size.w / 2, y: (position.y || 0) + size.h / 2 };
    const dx = toward.x - center.x;
    const dy = toward.y - center.y;
    if (!dx && !dy) return center;
    if (type === 'process' || type === 'multiprocess') {
        const scale = 1 / Math.sqrt((dx * dx) / ((size.w / 2) ** 2) + (dy * dy) / ((size.h / 2) ** 2));
        return { x: center.x + dx * scale, y: center.y + dy * scale };
    }
    const scale = 1 / Math.max(Math.abs(dx) / (size.w / 2), Math.abs(dy) / (size.h / 2));
    return { x: center.x + dx * scale, y: center.y + dy * scale };
}

export default function IndependentDfdEditor({ diagram, updateDiagram }: { diagram: UseCaseDiagram; updateDiagram: (patch: Partial<UseCaseDiagram>) => void }) {
    const data = useStore((s) => s.data)!;
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
    const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const dragOffset = useRef({ x: 0, y: 0 });
    const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
    const dfd: Dfd = diagram.dfd || { nodes: [], flows: [] };
    const nodes = dfd.nodes || [];
    const flows = dfd.flows || [];
    const componentById = new Map((data.system.components || []).map((component) => [component.id, component]));
    const displayTypeFor = (node: DfdNode) => nodeTypeForComponent(node.componentRef ? componentById.get(node.componentRef) : undefined, node.type === 'trust-boundary' ? 'process' : node.type);
    const availableComponents = (data.dfd.nodes || [])
        .filter((node) => node.type !== 'trust-boundary' && node.componentRef)
        .filter((node, index, all) => all.findIndex((candidate) => candidate.componentRef === node.componentRef) === index)
        .map((node) => ({ node, component: componentById.get(node.componentRef!), type: nodeTypeForComponent(componentById.get(node.componentRef!), node.type) }))
        .sort((left, right) => (left.component?.name || left.node.label).localeCompare(right.component?.name || right.node.label));

    const updateDfd = (patch: Partial<Dfd>) => updateDiagram({ dfd: { ...dfd, ...patch } });
    const updateNode = (id: string, patch: Partial<DfdNode>) => updateDfd({ nodes: nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)) });
    const updateFlow = (id: string, patch: Partial<Flow>) => updateDfd({ flows: flows.map((flow) => (flow.id === id ? { ...flow, ...patch } : flow)) });

    const addNode = (type: Exclude<DfdNodeType, 'trust-boundary'>, label = nodeTypeLabel(type), componentRef?: string) => {
        const index = nodes.length;
        const id = uid('SCN-DFD', nodes.map((node) => node.id));
        updateDfd({
            nodes: [...nodes, {
                id,
                label,
                type,
                layer: 1,
                componentRef,
                x: 40 + (index % 4) * 210,
                y: 42 + Math.floor(index / 4) * 150,
            }],
        });
        setSelectedNodeId(id);
        setSelectedFlowId(null);
    };

    const addComponent = (sourceNodeId: string) => {
        const source = availableComponents.find(({ node }) => node.id === sourceNodeId)?.node;
        if (!source || source.type === 'trust-boundary') return;
        const component = source.componentRef ? componentById.get(source.componentRef) : undefined;
        addNode(nodeTypeForComponent(component, source.type), component?.name || source.label, source.componentRef);
    };

    const autoLayout = () => updateDfd({ nodes: nodes.map((node, index) => ({ ...node, x: 48 + (index % 4) * 210, y: 48 + Math.floor(index / 4) * 150 })) });

    const clickNode = (id: string) => {
        if (connectingFrom && connectingFrom !== id) {
            const flowId = uid('SCN-FLOW', flows.map((flow) => flow.id));
            updateDfd({ flows: [...flows, { id: flowId, from: connectingFrom, to: id, label: 'Data flow' }] });
            setSelectedFlowId(flowId);
            setSelectedNodeId(null);
            setConnectingFrom(null);
            return;
        }
        setSelectedNodeId(id);
        setSelectedFlowId(null);
        if (connectingFrom === id) setConnectingFrom(null);
    };

    const startDrag = (event: React.MouseEvent, node: DfdNode) => {
        if (connectingFrom) {
            clickNode(node.id);
            return;
        }
        const rect = svgRef.current!.getBoundingClientRect();
        dragOffset.current = { x: event.clientX - rect.left - (node.x || 0), y: event.clientY - rect.top - (node.y || 0) };
        setDrag({ id: node.id, x: node.x || 0, y: node.y || 0 });
        clickNode(node.id);
    };

    const selectedNode = nodes.find((node) => node.id === selectedNodeId);
    const selectedFlow = flows.find((flow) => flow.id === selectedFlowId);
    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const maxX = Math.max(760, ...nodes.map((node) => (node.x || 0) + NODE_DIMS[displayTypeFor(node)].w + 60));
    const maxY = Math.max(460, ...nodes.map((node) => (node.y || 0) + NODE_DIMS[displayTypeFor(node)].h + 60));

    return (
        <>
            <div className="dfd-bar">
                <label className="hint" htmlFor="scenario-component">Add a Step 04 component</label>
                <select id="scenario-component" className="inp navsel" defaultValue="" onChange={(event) => { if (event.target.value) addComponent(event.target.value); event.currentTarget.value = ''; }}>
                    <option value="">Select component...</option>
                    {availableComponents.map(({ node, component, type }) => <option key={node.id} value={node.id}>{component?.name || node.label} ({nodeTypeLabel(type)})</option>)}
                </select>
                <span className="hint">or add</span>
                {NODE_TYPES.map((type) => <button key={type} className="btn sm" onClick={() => addNode(type)}>+ {nodeTypeLabel(type)}</button>)}
                <button className={'btn sm' + (connectingFrom ? ' primary' : '')} onClick={() => { setConnectingFrom(selectedNodeId); setSelectedFlowId(null); }} disabled={!selectedNodeId}>
                    {connectingFrom ? 'Select target' : 'Connect'}
                </button>
                <button className="btn sm" onClick={autoLayout} disabled={!nodes.length}>Auto layout</button>
                <button className="btn sm danger" disabled={!selectedNodeId && !selectedFlowId} onClick={() => {
                    if (selectedNodeId) updateDfd({ nodes: nodes.filter((node) => node.id !== selectedNodeId), flows: flows.filter((flow) => flow.from !== selectedNodeId && flow.to !== selectedNodeId) });
                    if (selectedFlowId) updateDfd({ flows: flows.filter((flow) => flow.id !== selectedFlowId) });
                    setSelectedNodeId(null); setSelectedFlowId(null);
                }}>Delete selected</button>
            </div>
            <div className="uc-canvas scenario-dfd-canvas">
                <svg ref={svgRef} width={maxX} height={maxY} onMouseDown={(event) => { if (event.target === event.currentTarget) { setSelectedNodeId(null); setSelectedFlowId(null); } }} onMouseMove={(event) => {
                    if (!drag) return;
                    const rect = svgRef.current!.getBoundingClientRect();
                    setDrag({ ...drag, x: Math.max(0, Math.round(event.clientX - rect.left - dragOffset.current.x)), y: Math.max(0, Math.round(event.clientY - rect.top - dragOffset.current.y)) });
                }} onMouseUp={() => { if (drag) updateNode(drag.id, { x: drag.x, y: drag.y }); setDrag(null); }} onMouseLeave={() => { if (drag) updateNode(drag.id, { x: drag.x, y: drag.y }); setDrag(null); }}>
                    <defs><marker id="scenario-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="currentColor" /></marker></defs>
                    {flows.map((flow) => {
                        const from = nodeById.get(flow.from); const to = nodeById.get(flow.to);
                        if (!from || !to) return null;
                        const fromPosition = drag?.id === from.id ? drag : from;
                        const toPosition = drag?.id === to.id ? drag : to;
                        const fromType = displayTypeFor(from);
                        const toType = displayTypeFor(to);
                        const fromCenter = { x: (fromPosition.x || 0) + NODE_DIMS[fromType].w / 2, y: (fromPosition.y || 0) + NODE_DIMS[fromType].h / 2 };
                        const toCenter = { x: (toPosition.x || 0) + NODE_DIMS[toType].w / 2, y: (toPosition.y || 0) + NODE_DIMS[toType].h / 2 };
                        const start = outlinePoint(fromPosition, fromType, toCenter);
                        const end = outlinePoint(toPosition, toType, fromCenter);
                        const obstacles = nodes.filter((node) => node.id !== from.id && node.id !== to.id).map((node) => {
                            const position = drag?.id === node.id ? drag : node;
                            const size = NODE_DIMS[displayTypeFor(node)];
                            return { x: position.x || 0, y: position.y || 0, w: size.w, h: size.h };
                        });
                        const path = curvedPath(start, end, obstacles, 28);
                        return <g key={flow.id} className={selectedFlowId === flow.id ? 'scenario-flow selected' : 'scenario-flow'} onMouseDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); setSelectedFlowId(flow.id); setSelectedNodeId(null); }}><path d={path} markerEnd="url(#scenario-arrow)" /><text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 8} textAnchor="middle">{flow.label}</text></g>;
                    })}
                    {nodes.filter((node) => node.type !== 'trust-boundary').map((node) => {
                        const position = drag?.id === node.id ? drag : node;
                        const displayType = displayTypeFor(node);
                        const size = NODE_DIMS[displayType];
                        return <g key={node.id} className={'scenario-node ' + displayType + (selectedNodeId === node.id ? ' selected' : '')} transform={`translate(${position.x || 0},${position.y || 0})`} onMouseDown={(event) => { event.preventDefault(); event.stopPropagation(); startDrag(event, node); }}>{displayType === 'store' ? <><line x1="0" y1="10" x2={size.w} y2="10" /><line x1="0" y1={size.h - 10} x2={size.w} y2={size.h - 10} /></> : <rect width={size.w} height={size.h} rx={displayType === 'process' || displayType === 'multiprocess' ? 45 : 3} />}<text x={size.w / 2} y={size.h / 2 + 4} textAnchor="middle">{node.label}</text></g>;
                    })}
                </svg>
            </div>
            {selectedNode && <div className="scenario-editor"><div className="field"><label>Node label</label><input className="inp" value={selectedNode.label} onChange={(event) => updateNode(selectedNode.id, { label: event.target.value })} /></div><div className="field"><label>DFD shape</label><select className="inp" value={displayTypeFor(selectedNode)} onChange={(event) => updateNode(selectedNode.id, { type: event.target.value as DfdNodeType })}>{NODE_TYPES.map((type) => <option key={type} value={type}>{nodeTypeLabel(type)}</option>)}</select></div><div className="field"><label>System component</label><select className="inp" value={selectedNode.componentRef || ''} onChange={(event) => { const componentRef = event.target.value || undefined; updateNode(selectedNode.id, { componentRef, type: nodeTypeForComponent(componentRef ? componentById.get(componentRef) : undefined, selectedNode.type) }); }}><option value="">Independent node</option>{availableComponents.map(({ node, component }) => <option key={node.id} value={node.componentRef}>{component?.name || node.label}</option>)}</select></div></div>}
            {selectedFlow && <div className="scenario-editor"><div className="field"><label>Flow label</label><input className="inp" value={selectedFlow.label || ''} onChange={(event) => updateFlow(selectedFlow.id, { label: event.target.value })} /></div><div className="field"><label>From</label><select className="inp" value={selectedFlow.from} onChange={(event) => updateFlow(selectedFlow.id, { from: event.target.value })}>{nodes.map((node) => <option key={node.id} value={node.id}>{node.label || node.id}</option>)}</select></div><div className="field"><label>To</label><select className="inp" value={selectedFlow.to} onChange={(event) => updateFlow(selectedFlow.id, { to: event.target.value })}>{nodes.map((node) => <option key={node.id} value={node.id}>{node.label || node.id}</option>)}</select></div></div>}
            <p className="hint">This diagram is independent from Step 04. Add modelled components or local nodes, drag them into place, then select a source and choose Connect.</p>
        </>
    );
}