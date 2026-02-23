<script lang="ts">
  import type { TreeNodeData } from '$lib/types';

  export let nodes: TreeNodeData[] = [];
  export let onSelect: (node: TreeNodeData) => void = () => {};
  export let selectedId: string | null = null;

  const typeColors: Record<string, string> = {
    goal: '#e53e3e',
    category: '#3182ce',
    step: '#38a169',
    substep: '#d69e2e',
  };

  const typeIcons: Record<string, string> = {
    goal: '🎯',
    category: '📂',
    step: '⚡',
    substep: '🔸',
  };

  function getConjunctionLabel(node: TreeNodeData): string {
    const data = node.data as any;
    if (node.type === 'goal') {
      return data?.impact_category === 'and' ? 'AND' : 'OR';
    }
    if (data?.conjunction) return data.conjunction;
    return '';
  }
</script>

<div class="tree-diagram">
  {#each nodes as node (node.id)}
    <div class="tree-root">
      <svelte:self nodes={[]} {onSelect} {selectedId} />
      <div class="node-branch">
        <button
          class="tree-node-box"
          class:selected={selectedId === node.id}
          style="--node-color: {typeColors[node.type] || '#718096'}"
          on:click={() => onSelect(node)}
        >
          <span class="node-icon">{typeIcons[node.type] || '•'}</span>
          <span class="node-name">{node.name}</span>
          {#if getConjunctionLabel(node)}
            <span class="conjunction-tag">{getConjunctionLabel(node)}</span>
          {/if}
        </button>

        {#if node.children.length > 0}
          <div class="children-container">
            <div class="connector-line"></div>
            <div class="children-row">
              {#each node.children as child (child.id)}
                <div class="child-branch">
                  <div class="child-connector"></div>
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
    background: white;
    cursor: pointer;
    font-size: 0.8rem;
    font-family: inherit;
    white-space: nowrap;
    transition: all 0.15s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    position: relative;
  }

  .tree-node-box:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    transform: translateY(-1px);
  }

  .tree-node-box.selected {
    background: var(--node-color);
    color: white;
  }

  .node-icon { font-size: 0.9rem; }
  .node-name { font-weight: 600; max-width: 160px; overflow: hidden; text-overflow: ellipsis; }

  .conjunction-tag {
    font-size: 0.6rem;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(0,0,0,0.08);
    text-transform: uppercase;
  }

  .tree-node-box.selected .conjunction-tag {
    background: rgba(255,255,255,0.25);
  }

  .children-container {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .connector-line {
    width: 2px;
    height: 20px;
    background: #cbd5e0;
  }

  .children-row {
    display: flex;
    gap: 8px;
    position: relative;
  }

  .children-row::before {
    content: '';
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 40px);
    height: 2px;
    background: #cbd5e0;
  }

  .child-branch {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .child-connector {
    width: 2px;
    height: 16px;
    background: #cbd5e0;
  }
</style>
