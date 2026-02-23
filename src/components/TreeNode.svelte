<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { TreeNodeData } from '$lib/types';

  export let node: TreeNodeData;
  export let depth = 0;
  export let selectedId: string | null = null;

  const dispatch = createEventDispatcher<{
    select: TreeNodeData;
    addChild: TreeNodeData;
    delete: TreeNodeData;
    reorder: { draggedId: string; draggedType: string; targetId: string; targetType: string; position: 'before' | 'after' };
  }>();

  let expanded = node.expanded ?? true;
  let dragOver: 'before' | 'after' | null = null;

  function toggle() {
    expanded = !expanded;
    node.expanded = expanded;
  }

  function select() {
    dispatch('select', node);
  }

  function addChild() {
    dispatch('addChild', node);
  }

  function deleteNode() {
    dispatch('delete', node);
  }

  function handleDragStart(e: DragEvent) {
    e.dataTransfer?.setData('text/plain', JSON.stringify({ id: node.id, type: node.type }));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (!e.dataTransfer) return;
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    dragOver = e.clientY < midY ? 'before' : 'after';
  }

  function handleDragLeave() {
    dragOver = null;
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = null;
    const raw = e.dataTransfer?.getData('text/plain');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.id === node.id) return;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const position = e.clientY < midY ? 'before' : 'after';
      dispatch('reorder', { draggedId: data.id, draggedType: data.type, targetId: node.id, targetType: node.type, position });
    } catch {}
  }

  function forwardSelect(e: CustomEvent<TreeNodeData>) {
    dispatch('select', e.detail);
  }

  function forwardAddChild(e: CustomEvent<TreeNodeData>) {
    dispatch('addChild', e.detail);
  }

  function forwardDelete(e: CustomEvent<TreeNodeData>) {
    dispatch('delete', e.detail);
  }

  function forwardReorder(e: CustomEvent) {
    dispatch('reorder', e.detail);
  }

  const typeIcons: Record<string, string> = {
    goal: '🎯',
    category: '📂',
    step: '⚡',
    substep: '🔸',
  };

  const typeLabels: Record<string, string> = {
    goal: 'Goal',
    category: 'Category',
    step: 'Step',
    substep: 'Substep',
  };
</script>

<div class="tree-node" style="--depth: {depth}">
  <div
    class="node-row"
    class:selected={selectedId === node.id}
    class:drag-before={dragOver === 'before'}
    class:drag-after={dragOver === 'after'}
    on:click={select}
    on:keypress={select}
    role="treeitem"
    tabindex="0"
    draggable="true"
    on:dragstart={handleDragStart}
    on:dragover={handleDragOver}
    on:dragleave={handleDragLeave}
    on:drop={handleDrop}
  >
    <button
      class="toggle-btn"
      class:invisible={node.children.length === 0}
      on:click|stopPropagation={toggle}
    >
      {expanded ? '▼' : '▶'}
    </button>

    <span class="node-icon">{typeIcons[node.type] || '•'}</span>
    <span class="node-label">{node.name}</span>
    <span class="node-type-badge">{typeLabels[node.type] || node.type}</span>

    <div class="node-actions">
      {#if node.type !== 'substep'}
        <button class="action-btn" title="Add child" on:click|stopPropagation={addChild}>+</button>
      {/if}
      <button class="action-btn danger" title="Delete" on:click|stopPropagation={deleteNode}>×</button>
    </div>
  </div>

  {#if expanded && node.children.length > 0}
    <div class="children">
      {#each node.children as child (child.id)}
        <svelte:self
          node={child}
          depth={depth + 1}
          {selectedId}
          on:select={forwardSelect}
          on:addChild={forwardAddChild}
          on:delete={forwardDelete}
          on:reorder={forwardReorder}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .tree-node {
    margin-left: calc(var(--depth) * 20px);
  }

  .node-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .node-row:hover {
    background: var(--color-hover, #edf2f7);
  }

  .node-row.selected {
    background: var(--color-active, #bee3f8);
    font-weight: 500;
  }

  .toggle-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.65rem;
    width: 18px;
    padding: 0;
    color: var(--color-text-muted, #718096);
  }

  .toggle-btn.invisible {
    visibility: hidden;
  }

  .node-icon {
    font-size: 0.9rem;
  }

  .node-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .node-type-badge {
    font-size: 0.6rem;
    text-transform: uppercase;
    padding: 1px 6px;
    border-radius: 8px;
    background: var(--color-badge-bg, #e2e8f0);
    color: var(--color-text-muted, #718096);
  }

  .node-actions {
    display: none;
    gap: 2px;
  }

  .node-row:hover .node-actions {
    display: flex;
  }

  .action-btn {
    background: none;
    border: 1px solid var(--color-border, #cbd5e0);
    border-radius: 3px;
    cursor: pointer;
    font-size: 0.8rem;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: var(--color-text, #2d3748);
  }

  .action-btn:hover {
    background: var(--color-hover, #edf2f7);
  }

  .action-btn.danger:hover {
    background: #fed7d7;
    color: #c53030;
    border-color: #fc8181;
  }

  .children {
    border-left: 1px dashed var(--color-border, #cbd5e0);
    margin-left: 9px;
  }

  .node-row.drag-before { border-top: 2px solid #3182ce; }
  .node-row.drag-after { border-bottom: 2px solid #3182ce; }
</style>
