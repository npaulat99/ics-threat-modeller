<script lang="ts">
  import type { TreeNodeData, Goal, Step, Category, Substep, CreateGoal, CreateStep, CreateCategory, CreateSubstep } from '$lib/types';
  import { currentProject, goals, treeData, selectedNodeId, selectedNodeType, setError, setSuccess } from '$lib/stores';
  import * as api from '$lib/api';
  import TreeView from '$components/TreeView.svelte';
  import ConfirmDialog from '$components/ConfirmDialog.svelte';
  import { onMount } from 'svelte';

  let selectedNode: TreeNodeData | null = null;
  let selectedDetail: Goal | Step | Category | Substep | null = null;
  let showAddDialog = false;
  let addParent: TreeNodeData | null = null;
  let addType: 'goal' | 'category' | 'step' | 'substep' = 'step';
  let addName = '';
  let addDesc = '';
  let deleteTarget: TreeNodeData | null = null;

  onMount(loadTree);

  async function loadTree() {
    if (!$currentProject) return;
    try {
      const goalList = await api.listGoals($currentProject.id);
      goals.set(goalList);
      const tree: TreeNodeData[] = [];
      for (const g of goalList) {
        tree.push(await buildGoalNode(g));
      }
      treeData.set(tree);
    } catch (e) { setError(`Load tree failed: ${e}`); }
  }

  async function buildGoalNode(g: Goal): Promise<TreeNodeData> {
    const children: TreeNodeData[] = [];
    // Load steps under goal.
    const steps = await api.listSteps(g.id, 'goal');
    for (const s of steps) {
      children.push(await buildStepNode(s));
    }
    // Load categories under goal.
    const cats = await api.listCategories(g.id, 'goal');
    for (const c of cats) {
      children.push(await buildCategoryNode(c));
    }
    return { id: g.id, name: g.name, type: 'goal', children, expanded: true, data: g };
  }

  async function buildCategoryNode(c: Category): Promise<TreeNodeData> {
    const children: TreeNodeData[] = [];
    const steps = await api.listSteps(c.id, 'category');
    for (const s of steps) {
      children.push(await buildStepNode(s));
    }
    return { id: c.id, name: c.name, type: 'category', children, expanded: true, data: c };
  }

  async function buildStepNode(s: Step): Promise<TreeNodeData> {
    const children: TreeNodeData[] = [];
    // Load child steps.
    const childSteps = await api.listSteps(s.id, 'step');
    for (const cs of childSteps) {
      children.push(await buildStepNode(cs));
    }
    // Load substeps.
    const subs = await api.listSubsteps(s.id);
    for (const sub of subs) {
      children.push({ id: sub.id, name: sub.name, type: 'substep', children: [], data: sub });
    }
    return { id: s.id, name: s.name, type: 'step', children, expanded: true, data: s };
  }

  async function handleSelect(node: TreeNodeData) {
    selectedNode = node;
    selectedDetail = node.data ?? null;
  }

  function handleAddChild(parentNode: TreeNodeData) {
    addParent = parentNode;
    addName = '';
    addDesc = '';
    // Determine valid child type.
    if (parentNode.type === 'goal') addType = 'step';
    else if (parentNode.type === 'category') addType = 'step';
    else if (parentNode.type === 'step') addType = 'step';
    showAddDialog = true;
  }

  async function createChild() {
    if (!addParent || !addName.trim()) return;
    try {
      if (addType === 'step') {
        const data: CreateStep = {
          parent_id: addParent.id,
          parent_type: addParent.type,
          name: addName,
          description: addDesc || undefined,
        };
        await api.createStep(data);
      } else if (addType === 'category') {
        const data: CreateCategory = {
          parent_id: addParent.id,
          parent_type: addParent.type,
          name: addName,
          description: addDesc || undefined,
        };
        await api.createCategory(data);
      } else if (addType === 'substep') {
        const data: CreateSubstep = {
          parent_step_id: addParent.id,
          name: addName,
          description: addDesc || undefined,
        };
        await api.createSubstep(data);
      }
      setSuccess(`Created ${addType}: ${addName}`);
      showAddDialog = false;
      await loadTree();
    } catch (e) { setError(`Create failed: ${e}`); }
  }

  async function createGoal() {
    if (!$currentProject) return;
    const name = prompt('Goal name:');
    if (!name?.trim()) return;
    try {
      const data: CreateGoal = { project_id: $currentProject.id, name };
      await api.createGoal(data);
      setSuccess(`Goal "${name}" created.`);
      await loadTree();
    } catch (e) { setError(`Create goal failed: ${e}`); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'goal') await api.deleteGoal(deleteTarget.id);
      else if (deleteTarget.type === 'step') await api.deleteStep(deleteTarget.id);
      else if (deleteTarget.type === 'category') await api.deleteCategory(deleteTarget.id);
      else if (deleteTarget.type === 'substep') await api.deleteSubstep(deleteTarget.id);
      setSuccess(`Deleted ${deleteTarget.type}: ${deleteTarget.name}`);
      deleteTarget = null;
      selectedNode = null;
      selectedDetail = null;
      await loadTree();
    } catch (e) { setError(`Delete failed: ${e}`); }
  }
</script>

<div class="attack-tree-page">
  <div class="tree-panel">
    <div class="panel-header">
      <h3>Attack Tree</h3>
      <button class="btn btn-sm btn-primary" on:click={createGoal}>+ Goal</button>
    </div>
    <div class="tree-container">
      <TreeView
        nodes={$treeData}
        onSelect={handleSelect}
        onAddChild={handleAddChild}
        onDelete={(n) => (deleteTarget = n)}
      />
    </div>
  </div>

  <div class="detail-panel">
    {#if selectedNode && selectedDetail}
      <div class="detail-card">
        <div class="detail-header">
          <span class="type-badge">{selectedNode.type}</span>
          <h3>{selectedNode.name}</h3>
        </div>
        <dl class="detail-fields">
          {#if 'description' in selectedDetail}
            <dt>Description</dt>
            <dd>{selectedDetail.description || '—'}</dd>
          {/if}
          {#if 'impact_category' in selectedDetail}
            <dt>Impact Category</dt>
            <dd>{selectedDetail.impact_category}</dd>
          {/if}
          {#if 'conjunction' in selectedDetail}
            <dt>Conjunction</dt>
            <dd>{selectedDetail.conjunction}</dd>
          {/if}
          {#if 'access_level' in selectedDetail && selectedDetail.access_level !== undefined}
            <dt>Access Level</dt>
            <dd>{selectedDetail.access_level}</dd>
          {/if}
          {#if 'skill_level' in selectedDetail && selectedDetail.skill_level !== undefined}
            <dt>Skill Level</dt>
            <dd>{selectedDetail.skill_level}</dd>
          {/if}
        </dl>
      </div>
    {:else}
      <div class="no-selection">
        <p>Select a node from the tree to view details.</p>
      </div>
    {/if}
  </div>
</div>

{#if showAddDialog}
  <div class="overlay" on:click={() => (showAddDialog = false)} role="dialog">
    <div class="dialog" on:click|stopPropagation role="document">
      <h3>Add child to "{addParent?.name}"</h3>
      <div class="form-group">
        <label>Type</label>
        <select class="input" bind:value={addType}>
          <option value="step">Step</option>
          {#if addParent?.type === 'goal'}
            <option value="category">Category</option>
          {/if}
          {#if addParent?.type === 'step'}
            <option value="substep">Substep</option>
          {/if}
        </select>
      </div>
      <div class="form-group">
        <label>Name *</label>
        <input class="input" bind:value={addName} placeholder="Name" />
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea class="input" bind:value={addDesc} rows="2"></textarea>
      </div>
      <div class="dialog-actions">
        <button class="btn btn-secondary" on:click={() => (showAddDialog = false)}>Cancel</button>
        <button class="btn btn-primary" on:click={createChild} disabled={!addName.trim()}>Create</button>
      </div>
    </div>
  </div>
{/if}

<ConfirmDialog
  open={deleteTarget !== null}
  title="Delete Node"
  message="Delete '{deleteTarget?.name}'? All children will also be deleted."
  confirmLabel="Delete"
  danger
  on:confirm={confirmDelete}
  on:cancel={() => (deleteTarget = null)}
/>

<style>
  .attack-tree-page {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    height: calc(100vh - 120px);
  }

  .tree-panel, .detail-panel {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #e2e8f0;
  }

  .panel-header h3 { margin: 0; font-size: 0.95rem; }

  .tree-container { flex: 1; overflow-y: auto; padding: 8px; }

  .detail-card { padding: 20px; }
  .detail-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .detail-header h3 { margin: 0; }
  .type-badge { font-size: 0.65rem; text-transform: uppercase; background: #edf2f7; padding: 2px 8px; border-radius: 8px; font-weight: 600; }

  .detail-fields dt { font-size: 0.75rem; font-weight: 600; color: #4a5568; margin-top: 10px; }
  .detail-fields dd { margin: 2px 0 0; font-size: 0.88rem; }

  .no-selection { padding: 40px; text-align: center; color: #718096; }

  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
  .dialog { background: white; border-radius: 10px; padding: 24px; max-width: 440px; width: 90%; }
  .dialog h3 { margin: 0 0 16px; font-size: 1rem; }
  .dialog-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }

  .form-group { margin-bottom: 12px; }
  .form-group label { display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 4px; }
  .input { width: 100%; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 12px; font-size: 0.85rem; font-family: inherit; }
  .btn { border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer; font-size: 0.85rem; font-weight: 500; }
  .btn-primary { background: #1a365d; color: white; }
  .btn-secondary { background: #edf2f7; color: #2d3748; border: 1px solid #e2e8f0; }
  .btn-sm { padding: 4px 10px; font-size: 0.75rem; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
