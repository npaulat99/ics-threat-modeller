export function resolveTargetNodeId(componentId, visibleRealNodes, compById) {
    let current = componentId;
    const seen = new Set();
    while (current && !seen.has(current)) {
        seen.add(current);
        const node = visibleRealNodes.find((candidate) => candidate.componentRef === current);
        if (node) return node.id;
        current = compById.get(current)?.parent ?? null;
    }
    return null;
}

function isDescendantOrSelf(componentId, ancestorId, compById) {
    let current = componentId;
    const seen = new Set();
    while (current && !seen.has(current)) {
        if (current === ancestorId) return true;
        seen.add(current);
        current = compById.get(current)?.parent ?? null;
    }
    return false;
}

export function isDeviceBoundaryInterfaceFlow({ currentParent, nodes, compById, interfaces, interfaceId, otherEndpointId }) {
    const parentNode = (nodes || []).find((node) => node.id === currentParent);
    const parentComponent = parentNode?.componentRef ? compById.get(parentNode.componentRef) : null;
    if (!parentComponent || parentComponent.kind !== 'device' || parentComponent.parent != null) return false;

    const itf = (interfaces || []).find((candidate) => candidate.id === interfaceId);
    if (!itf?.component) return false;
    if (!isDescendantOrSelf(itf.component, parentComponent.id, compById)) return false;

    const otherNode = (nodes || []).find((node) => node.id === otherEndpointId);
    if (!otherNode) return false;
    return (otherNode.parent ?? null) !== currentParent;
}

export function deriveVisibleInterfaceIds({ currentParent, interfaces, flows, nodes, visibleRealNodes, compById }) {
    const ids = new Set();
    const visibleRealNodeIds = new Set(visibleRealNodes.map((node) => node.id));
    const shownInterfaces = (interfaces || []).filter((itf) => !itf.hidden);
    if (currentParent == null) {
        for (const itf of shownInterfaces) ids.add(itf.id);
        return ids;
    }
    for (const itf of shownInterfaces) {
        if (!resolveTargetNodeId(itf.component, visibleRealNodes, compById)) continue;
        const connectedToContext = (flows || []).some((flow) => {
            if (flow.from !== itf.id && flow.to !== itf.id) return false;
            const other = flow.from === itf.id ? flow.to : flow.from;
            return other === currentParent || visibleRealNodeIds.has(other) || isDeviceBoundaryInterfaceFlow({ currentParent, nodes, compById, interfaces, interfaceId: itf.id, otherEndpointId: other });
        });
        if (connectedToContext) ids.add(itf.id);
    }
    return ids;
}

export function flowBelongsToLayerContext({ flow, currentParent, visibleRealNodeIds, visibleIfaceIds, nodes, compById, interfaces }) {
    const flowFromDeviceBoundary = isDeviceBoundaryInterfaceFlow({
        currentParent,
        nodes,
        compById,
        interfaces,
        interfaceId: flow.from,
        otherEndpointId: flow.to,
    });
    const flowToDeviceBoundary = isDeviceBoundaryInterfaceFlow({
        currentParent,
        nodes,
        compById,
        interfaces,
        interfaceId: flow.to,
        otherEndpointId: flow.from,
    });
    return (
        flow.from === currentParent ||
        flow.to === currentParent ||
        visibleRealNodeIds.has(flow.from) ||
        visibleRealNodeIds.has(flow.to) ||
        visibleIfaceIds.has(flow.from) ||
        visibleIfaceIds.has(flow.to) ||
        flowFromDeviceBoundary ||
        flowToDeviceBoundary
    );
}