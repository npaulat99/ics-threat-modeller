<script lang="ts">
  import { writable } from "svelte/store";
  import {
    SvelteFlow,
    Controls,
    Background,
    MiniMap,
    type NodeTypes,
    type EdgeTypes,
  } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";

  import type { TreeNodeData } from "$lib/types";
  import { treeToFlow } from "$lib/treeLayout";
  import AttackNode from "./flow/AttackNode.svelte";
  import DefenseEdge from "./flow/DefenseEdge.svelte";

  export let nodes: TreeNodeData[] = [];
  export let onSelect: (node: TreeNodeData) => void = () => {};
  export let selectedId: string | null = null;

  /** Layout direction — TB (top-down) or LR (left-right) */
  export let direction: "TB" | "LR" = "TB";

  /* Register custom node / edge types */
  const nodeTypes: NodeTypes = {
    attackNode: AttackNode as any,
  };
  const edgeTypes: EdgeTypes = {
    defenseEdge: DefenseEdge as any,
  };

  /* SvelteFlow needs writable stores */
  const flowNodes = writable<any[]>([]);
  const flowEdges = writable<any[]>([]);

  /* Minimap color mapping */
  const minimapColors: Record<string, string> = {
    goal: "#C53030",
    category: "#2B6CB0",
    step: "#DD6B20",
    substep: "#E53E3E",
    path: "#805AD5",
    countermeasure: "#38A169",
  };

  function minimapNodeColor(node: any): string {
    return minimapColors[node?.data?.nodeType] || "#718096";
  }

  /* Re-layout whenever tree data, selection, or direction changes */
  $: {
    const result = treeToFlow(nodes, selectedId, direction);
    flowNodes.set(result.nodes);
    flowEdges.set(result.edges);
  }

  /* Handle node click → forward to parent */
  function handleNodeClick(event: CustomEvent<{ node: any }>) {
    const treeNode = event.detail?.node?.data?.treeNode as
      | TreeNodeData
      | undefined;
    if (treeNode) {
      onSelect(treeNode);
    }
  }
</script>

<div class="diagram-flow-container">
  <div class="diagram-toolbar">
    <button
      class="dir-btn"
      class:active={direction === "TB"}
      on:click={() => (direction = "TB")}
      title="Top to Bottom layout">↓ Top-Down</button
    >
    <button
      class="dir-btn"
      class:active={direction === "LR"}
      on:click={() => (direction = "LR")}
      title="Left to Right layout">→ Left-Right</button
    >
    <div class="legend">
      <span class="legend-item attack">
        <span class="legend-line solid"></span> Attack
      </span>
      <span class="legend-item defense">
        <span class="legend-line dashed"></span> Defense
      </span>
    </div>
  </div>

  <div class="flow-wrapper">
    <SvelteFlow
      nodes={flowNodes}
      edges={flowEdges}
      {nodeTypes}
      {edgeTypes}
      fitView
      minZoom={0.1}
      maxZoom={2.5}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={true}
      panOnDrag={true}
      zoomOnScroll={true}
      preventScrolling={true}
      defaultEdgeOptions={{ type: "defenseEdge" }}
      on:nodeclick={handleNodeClick}
    >
      <Controls position="bottom-right" />
      <Background gap={20} size={1} />
      <MiniMap
        nodeColor={minimapNodeColor}
        maskColor="rgba(240, 240, 240, 0.7)"
        position="bottom-left"
      />
    </SvelteFlow>
  </div>
</div>

<style>
  .diagram-flow-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 420px;
  }

  .diagram-toolbar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-bottom: 1px solid #e2e8f0;
    background: #f7fafc;
    flex-shrink: 0;
  }

  .dir-btn {
    padding: 3px 10px;
    font-size: 0.72rem;
    font-weight: 600;
    border: 1px solid #cbd5e0;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    color: #4a5568;
    transition: all 0.12s;
  }

  .dir-btn:hover {
    background: #edf2f7;
  }

  .dir-btn.active {
    background: #1a365d;
    color: white;
    border-color: #1a365d;
  }

  .legend {
    margin-left: auto;
    display: flex;
    gap: 12px;
    font-size: 0.7rem;
    color: #718096;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .legend-line {
    display: inline-block;
    width: 20px;
    height: 0;
  }

  .legend-line.solid {
    border-top: 2px solid #a0aec0;
  }

  .legend-line.dashed {
    border-top: 2px dashed #48bb78;
  }

  .flow-wrapper {
    flex: 1;
    min-height: 380px;
  }

  /* Override SvelteFlow defaults for our theme */
  :global(.svelte-flow) {
    background: #fafbfc !important;
  }

  :global(.svelte-flow__background) {
    opacity: 0.5;
  }

  :global(.svelte-flow__minimap) {
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  :global(.svelte-flow__controls) {
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  :global(.svelte-flow__controls button) {
    background: white;
    border-bottom: 1px solid #e2e8f0;
  }

  :global(.svelte-flow__controls button:hover) {
    background: #edf2f7;
  }

  :global(.svelte-flow__edge-path) {
    stroke-linecap: round;
  }
</style>
