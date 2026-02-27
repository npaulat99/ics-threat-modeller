<script lang="ts">
  import type { TreeNodeData } from "$lib/types";
  import TreeNode from "./TreeNode.svelte";
  import { selectedNodeId, selectedNodeType } from "$lib/stores";

  export let nodes: TreeNodeData[] = [];
  export let onSelect: (node: TreeNodeData) => void = () => {};
  export let onAddChild: ((parentNode: TreeNodeData) => void) | null = null;
  export let onDelete: ((node: TreeNodeData) => void) | null = null;
  export let onDuplicate: ((node: TreeNodeData) => void) | null = null;
  export let dragEnabled = true;
  export let onReorder:
    | ((detail: {
        draggedId: string;
        draggedType: string;
        targetId: string;
        targetType: string;
        position: "before" | "after";
      }) => void)
    | null = null;

  function handleSelect(node: TreeNodeData) {
    selectedNodeId.set(node.id);
    selectedNodeType.set(node.type);
    onSelect(node);
  }
</script>

<div class="tree-view">
  {#if nodes.length === 0}
    <div class="empty-tree">
      <p>No items in the attack tree yet.</p>
      <p class="hint">Create a goal to get started.</p>
    </div>
  {:else}
    {#each nodes as node (node.id)}
      <TreeNode
        {node}
        depth={0}
        selectedId={$selectedNodeId}
        {dragEnabled}
        on:select={(e) => handleSelect(e.detail)}
        on:addChild={(e) => onAddChild?.(e.detail)}
        on:delete={(e) => onDelete?.(e.detail)}
        on:duplicate={(e) => onDuplicate?.(e.detail)}
        on:reorder={(e) => onReorder?.(e.detail)}
      />
    {/each}
  {/if}
</div>

<style>
  .tree-view {
    font-size: 0.85rem;
    user-select: none;
  }

  .empty-tree {
    padding: 24px;
    text-align: center;
    color: var(--color-text-muted, #718096);
  }

  .hint {
    font-size: 0.8rem;
    margin-top: 4px;
  }
</style>
