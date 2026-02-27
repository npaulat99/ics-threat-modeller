<script lang="ts">
  import type { TreeNodeData } from "$lib/types";

  export let nodes: TreeNodeData[] = [];
  export let onSelect: (node: TreeNodeData) => void = () => {};
  export let selectedId: string | null = null;

  const typeColors: Record<string, string> = {
    goal: "#c53030",
    category: "#2b6cb0",
    step: "#c53030",
    substep: "#e53e3e",
    path: "#6b46c1",
    countermeasure: "#22543d",
  };

  const typeIcons: Record<string, string> = {
    goal: "🎯",
    category: "📂",
    step: "⚡",
    substep: "🔸",
    path: "🔀",
    countermeasure: "🛡️",
  };

  function getConjunctionLabel(node: TreeNodeData): string {
    // Only show conjunction on nodes that have children
    if (node.children.length === 0) return "";
    const data = node.data as any;
    if (node.type === "goal") {
      return data?.impact_category === "and" ? "AND" : "OR";
    }
    if (data?.conjunction) return data.conjunction;
    return "";
  }
</script>

<div class="tree-diagram">
  {#each nodes as node (node.id)}
    <div class="tree-root">
      <div class="node-branch">
        <button
          class="tree-node-box"
          class:selected={selectedId === node.id}
          class:countermeasure-node={node.type === "countermeasure"}
          class:path-node={node.type === "path"}
          style="--node-color: {typeColors[node.type] ||
            '#718096'}; --node-bg: {selectedId === node.id
            ? typeColors[node.type]
            : 'white'}"
          on:click={() => onSelect(node)}
        >
          <span class="node-icon">{typeIcons[node.type] || "•"}</span>
          <span class="node-name">{node.name}</span>
          {#if getConjunctionLabel(node)}
            <span
              class="conjunction-tag {getConjunctionLabel(node).toLowerCase()}"
              >{getConjunctionLabel(node)}</span
            >
          {/if}
        </button>

        {#if node.children.length > 0}
          <div class="children-container">
            <svg class="connector-svg" preserveAspectRatio="none">
              <line
                x1="50%"
                y1="0"
                x2="50%"
                y2="100%"
                stroke="#a0aec0"
                stroke-width="2"
              />
            </svg>
            <div class="children-row">
              {#each node.children as child (child.id)}
                <div class="child-branch">
                  <div
                    class="child-connector-line"
                    class:dashed-line={child.type === "countermeasure" ||
                      node.type === "countermeasure"}
                  ></div>
                  <svelte:self nodes={[child]} {onSelect} {selectedId} />
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  .tree-diagram {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 20px;
    min-width: max-content;
  }

  .tree-root {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .node-branch {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .tree-node-box {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border: 2px solid var(--node-color);
    border-radius: 6px;
    background: var(--node-bg, white);
    cursor: pointer;
    font-size: 0.8rem;
    font-family: inherit;
    white-space: nowrap;
    transition: all 0.15s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    position: relative;
  }

  .tree-node-box:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .tree-node-box.selected {
    background: var(--node-color);
    color: white;
  }

  .tree-node-box.countermeasure-node {
    border-style: solid;
    border-width: 2px;
    background: #f0fff4;
  }
  .tree-node-box.countermeasure-node.selected {
    background: #22543d;
  }

  .tree-node-box.path-node {
    border-style: dotted;
    border-width: 2px;
    background: #faf5ff;
  }
  .tree-node-box.path-node.selected {
    background: #6b46c1;
  }

  .node-icon {
    font-size: 0.9rem;
  }
  .node-name {
    font-weight: 600;
    max-width: 180px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .conjunction-tag {
    font-size: 0.6rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    text-transform: uppercase;
  }

  .conjunction-tag.or {
    background: #fed7d7;
    color: #c53030;
  }

  .conjunction-tag.and {
    background: #bee3f8;
    color: #2b6cb0;
  }

  .tree-node-box.selected .conjunction-tag {
    background: rgba(255, 255, 255, 0.25);
    color: inherit;
  }

  .children-container {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .connector-svg {
    width: 2px;
    height: 20px;
  }

  .children-row {
    display: flex;
    gap: 12px;
    position: relative;
    padding-top: 2px;
  }

  .children-row::before {
    content: "";
    position: absolute;
    top: 0;
    left: 24px;
    right: 24px;
    height: 2px;
    background: #a0aec0;
  }

  .child-branch {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .child-connector-line {
    width: 2px;
    height: 16px;
    background: #a0aec0;
  }

  .child-connector-line.dashed-line {
    background: none;
    border-left: 2px dashed #38a169;
  }
</style>
