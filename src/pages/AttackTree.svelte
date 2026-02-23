<script lang="ts">
  import type { TreeNodeData, Goal, Step, Category, Substep, Countermeasure, Weakness, CreateGoal, CreateStep, CreateCategory, CreateSubstep } from '$lib/types';
  import { currentProject, goals, treeData, selectedNodeId, selectedNodeType, setError, setSuccess } from '$lib/stores';
  import * as api from '$lib/api';
  import TreeView from '$components/TreeView.svelte';
  import AttackTreeDiagram from '$components/AttackTreeDiagram.svelte';
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
  let editing = false;
  let editName = '';
  let editDesc = '';
  let editConjunction = 'OR';
  let editAccessLevel = 1;
  let editSkillLevel = 1;
  let editImpactCategory = '';

  // Countermeasures & Weaknesses
  let nodeCountermeasures: Countermeasure[] = [];
  let nodeWeaknesses: Weakness[] = [];
  let showAddCM = false;
  let showAddWK = false;
  let newCMName = '';
  let newCMDesc = '';
  let newCMEffectiveness = 3;
  let newCMCost = 3;
  let newWKName = '';
  let newWKDesc = '';
  let newWKSeverity = 3;
  let newWKCve = '';

  const skillLabels = ['Novice', 'Beginner', 'Competent', 'Professional', 'Expert'];
  const accessLabels = ['Public', 'Limited', 'Moderate', 'Privileged', 'Unrestricted'];

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
    editing = false;
    showAddCM = false;
    showAddWK = false;

    // Load countermeasures and weaknesses for steps/substeps
    if (node.type === 'step' || node.type === 'substep') {
      try {
        nodeCountermeasures = await api.listCountermeasures(node.id, node.type);
      } catch { nodeCountermeasures = []; }
      try {
        nodeWeaknesses = await api.listWeaknesses(node.id, node.type);
      } catch { nodeWeaknesses = []; }
    } else {
      nodeCountermeasures = [];
      nodeWeaknesses = [];
    }
  }

  function startEditing() {
    if (!selectedNode || !selectedDetail) return;
    editing = true;
    editName = selectedDetail.name ?? '';
    editDesc = ('description' in selectedDetail) ? (selectedDetail as any).description ?? '' : '';
    editConjunction = ('conjunction' in selectedDetail) ? (selectedDetail as any).conjunction ?? 'OR' : 'OR';
    editAccessLevel = ('access_level' in selectedDetail) ? (selectedDetail as any).access_level ?? 1 : 1;
    editSkillLevel = ('skill_level' in selectedDetail) ? (selectedDetail as any).skill_level ?? 1 : 1;
    editImpactCategory = ('impact_category' in selectedDetail) ? (selectedDetail as any).impact_category ?? '' : '';
  }

  async function saveEdit() {
    if (!selectedNode || !selectedDetail) return;
    try {
      if (selectedNode.type === 'goal') {
        await api.updateGoal({
          id: selectedNode.id,
          name: editName,
          description: editDesc,
          impact_category: editImpactCategory,
        });
      } else if (selectedNode.type === 'step') {
        await api.updateStep({
          id: selectedNode.id,
          name: editName,
          description: editDesc,
          conjunction: editConjunction,
          access_level: editAccessLevel,
          skill_level: editSkillLevel,
        });
      } else if (selectedNode.type === 'category') {
        await api.updateCategory({
          id: selectedNode.id,
          name: editName,
          description: editDesc,
        });
      } else if (selectedNode.type === 'substep') {
        await api.updateSubstep({
          id: selectedNode.id,
          name: editName,
          description: editDesc,
          conjunction: editConjunction,
          access_level: editAccessLevel,
          skill_level: editSkillLevel,
        });
      }
      setSuccess(`Updated ${selectedNode.type}: ${editName}`);
      editing = false;
      await loadTree();
    } catch (e) { setError(`Update failed: ${e}`); }
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

  async function addCountermeasure() {
    if (!selectedNode || !newCMName.trim()) return;
    try {
      await api.createCountermeasure({
        parent_id: selectedNode.id,
        parent_type: selectedNode.type,
        name: newCMName,
        description: newCMDesc || undefined,
        effectiveness: newCMEffectiveness,
        implementation_cost: newCMCost,
      });
      nodeCountermeasures = await api.listCountermeasures(selectedNode.id, selectedNode.type);
      showAddCM = false;
      newCMName = ''; newCMDesc = ''; newCMEffectiveness = 3; newCMCost = 3;
      setSuccess('Countermeasure added');
    } catch (e) { setError(`Add countermeasure failed: ${e}`); }
  }

  async function deleteCountermeasure(id: string) {
    if (!selectedNode) return;
    try {
      await api.deleteCountermeasure(id);
      nodeCountermeasures = await api.listCountermeasures(selectedNode.id, selectedNode.type);
      setSuccess('Countermeasure deleted');
    } catch (e) { setError(`Delete countermeasure failed: ${e}`); }
  }

  async function addWeakness() {
    if (!selectedNode || !newWKName.trim()) return;
    try {
      await api.createWeakness({
        parent_id: selectedNode.id,
        parent_type: selectedNode.type,
        name: newWKName,
        description: newWKDesc || undefined,
        severity: newWKSeverity,
        cve_id: newWKCve || undefined,
      });
      nodeWeaknesses = await api.listWeaknesses(selectedNode.id, selectedNode.type);
      showAddWK = false;
      newWKName = ''; newWKDesc = ''; newWKSeverity = 3; newWKCve = '';
      setSuccess('Weakness added');
    } catch (e) { setError(`Add weakness failed: ${e}`); }
  }

  async function deleteWeakness(id: string) {
    if (!selectedNode) return;
    try {
      await api.deleteWeakness(id);
      nodeWeaknesses = await api.listWeaknesses(selectedNode.id, selectedNode.type);
      setSuccess('Weakness deleted');
    } catch (e) { setError(`Delete weakness failed: ${e}`); }
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

  // Find siblings of a node in the tree
  function findSiblings(nodes: TreeNodeData[], targetId: string): TreeNodeData[] | null {
    for (const n of nodes) {
      const idx = n.children.findIndex(c => c.id === targetId);
      if (idx >= 0) return n.children;
      const found = findSiblings(n.children, targetId);
      if (found) return found;
    }
    // Check top-level
    if (nodes.find(n => n.id === targetId)) return nodes;
    return null;
  }

  async function handleReorder(detail: { draggedId: string; draggedType: string; targetId: string; targetType: string; position: 'before' | 'after' }) {
    // Only reorder same-type siblings
    if (detail.draggedType !== detail.targetType) return;

    const siblings = findSiblings($treeData, detail.targetId);
    if (!siblings) return;

    const dragIdx = siblings.findIndex(s => s.id === detail.draggedId);
    if (dragIdx < 0) return; // not a sibling

    // Remove dragged and insert at target position
    const [dragged] = siblings.splice(dragIdx, 1);
    const targetIdx = siblings.findIndex(s => s.id === detail.targetId);
    const insertIdx = detail.position === 'before' ? targetIdx : targetIdx + 1;
    siblings.splice(insertIdx, 0, dragged);

    // Update sort_order for all siblings
    try {
      for (let i = 0; i < siblings.length; i++) {
        const s = siblings[i];
        if (s.type === 'goal') {
          await api.updateGoal({ id: s.id, sort_order: i });
        } else if (s.type === 'step') {
          await api.updateStep({ id: s.id, sort_order: i });
        } else if (s.type === 'category') {
          await api.updateCategory({ id: s.id, sort_order: i });
        } else if (s.type === 'substep') {
          await api.updateSubstep({ id: s.id, sort_order: i });
        }
      }
      await loadTree();
    } catch (e) { setError(`Reorder failed: ${e}`); }
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
        onReorder={handleReorder}
      />
    </div>
  </div>

  <div class="detail-panel">
    {#if selectedNode && selectedDetail}
      <div class="detail-card">
        <div class="detail-header">
          <span class="type-badge">{selectedNode.type}</span>
          {#if editing}
            <input class="input edit-name" bind:value={editName} />
          {:else}
            <h3>{selectedNode.name}</h3>
          {/if}
          {#if !editing}
            <button class="btn btn-sm btn-secondary" on:click={startEditing}>✏️ Edit</button>
          {/if}
        </div>

        {#if editing}
          <div class="edit-form">
            <div class="form-group">
              <label>Description</label>
              <textarea class="input" rows="3" bind:value={editDesc}></textarea>
            </div>
            {#if selectedNode.type === 'goal'}
              <div class="form-group">
                <label>Aggregation Type</label>
                <select class="input" bind:value={editImpactCategory}>
                  <option value="">Default (OR)</option>
                  <option value="or">OR</option>
                  <option value="and">AND</option>
                </select>
              </div>
            {/if}
            {#if selectedNode.type === 'step' || selectedNode.type === 'substep'}
              <div class="form-group">
                <label>Conjunction</label>
                <select class="input" bind:value={editConjunction}>
                  <option value="OR">OR</option>
                  <option value="AND">AND</option>
                </select>
              </div>
              <div class="form-group">
                <label>Access Level: {editAccessLevel} ({accessLabels[editAccessLevel - 1] ?? ''})</label>
                <input type="range" min="1" max="5" bind:value={editAccessLevel} class="slider" />
              </div>
              <div class="form-group">
                <label>Skill Level: {editSkillLevel} ({skillLabels[editSkillLevel - 1] ?? ''})</label>
                <input type="range" min="1" max="5" bind:value={editSkillLevel} class="slider" />
              </div>
            {/if}
            <div class="form-actions">
              <button class="btn btn-secondary" on:click={() => (editing = false)}>Cancel</button>
              <button class="btn btn-primary" on:click={saveEdit}>Save</button>
            </div>
          </div>
        {:else}
          <dl class="detail-fields">
            {#if 'description' in selectedDetail}
              <dt>Description</dt>
              <dd>{selectedDetail.description || '—'}</dd>
            {/if}
            {#if 'impact_category' in selectedDetail}
              <dt>Aggregation</dt>
              <dd>{selectedDetail.impact_category || 'OR (default)'}</dd>
            {/if}
            {#if 'conjunction' in selectedDetail}
              <dt>Conjunction</dt>
              <dd>{selectedDetail.conjunction}</dd>
            {/if}
            {#if 'access_level' in selectedDetail && selectedDetail.access_level !== undefined}
              <dt>Access Level</dt>
              <dd>{selectedDetail.access_level} ({accessLabels[Number(selectedDetail.access_level) - 1] ?? ''})</dd>
            {/if}
            {#if 'skill_level' in selectedDetail && selectedDetail.skill_level !== undefined}
              <dt>Skill Level</dt>
              <dd>{selectedDetail.skill_level} ({skillLabels[Number(selectedDetail.skill_level) - 1] ?? ''})</dd>
            {/if}
          </dl>

          {#if selectedNode.type === 'step' || selectedNode.type === 'substep'}
            <!-- Countermeasures -->
            <div class="cm-section">
              <div class="cm-header">
                <h4>🛡️ Countermeasures ({nodeCountermeasures.length})</h4>
                <button class="btn btn-xs btn-primary" on:click={() => (showAddCM = !showAddCM)}>
                  {showAddCM ? '✕' : '+ Add'}
                </button>
              </div>
              {#if showAddCM}
                <div class="cm-form">
                  <input class="input" bind:value={newCMName} placeholder="Name" />
                  <input class="input" bind:value={newCMDesc} placeholder="Description" />
                  <div class="cm-fields">
                    <label>Effectiveness: {newCMEffectiveness}</label>
                    <input type="range" min="1" max="5" bind:value={newCMEffectiveness} />
                    <label>Cost: {newCMCost}</label>
                    <input type="range" min="1" max="5" bind:value={newCMCost} />
                  </div>
                  <button class="btn btn-sm btn-primary" on:click={addCountermeasure}>Save</button>
                </div>
              {/if}
              <div class="cm-list">
                {#each nodeCountermeasures as cm (cm.id)}
                  <div class="cm-item">
                    <div class="cm-info">
                      <strong>{cm.name}</strong>
                      {#if cm.description}<span class="cm-desc">{cm.description}</span>{/if}
                      <span class="cm-meta">Eff: {cm.effectiveness} | Cost: {cm.implementation_cost}</span>
                    </div>
                    <button class="btn-del" on:click={() => deleteCountermeasure(cm.id)} title="Delete">🗑</button>
                  </div>
                {:else}
                  <p class="muted">No countermeasures</p>
                {/each}
              </div>
            </div>

            <!-- Weaknesses -->
            <div class="cm-section">
              <div class="cm-header">
                <h4>⚠️ Weaknesses ({nodeWeaknesses.length})</h4>
                <button class="btn btn-xs btn-primary" on:click={() => (showAddWK = !showAddWK)}>
                  {showAddWK ? '✕' : '+ Add'}
                </button>
              </div>
              {#if showAddWK}
                <div class="cm-form">
                  <input class="input" bind:value={newWKName} placeholder="Name" />
                  <input class="input" bind:value={newWKDesc} placeholder="Description" />
                  <div class="cm-fields">
                    <label>Severity: {newWKSeverity}</label>
                    <input type="range" min="1" max="5" bind:value={newWKSeverity} />
                  </div>
                  <input class="input" bind:value={newWKCve} placeholder="CVE ID (optional)" />
                  <button class="btn btn-sm btn-primary" on:click={addWeakness}>Save</button>
                </div>
              {/if}
              <div class="cm-list">
                {#each nodeWeaknesses as wk (wk.id)}
                  <div class="cm-item">
                    <div class="cm-info">
                      <strong>{wk.name}</strong>
                      {#if wk.description}<span class="cm-desc">{wk.description}</span>{/if}
                      <span class="cm-meta">Severity: {wk.severity}{wk.cve_id ? ` | ${wk.cve_id}` : ''}</span>
                    </div>
                    <button class="btn-del" on:click={() => deleteWeakness(wk.id)} title="Delete">🗑</button>
                  </div>
                {:else}
                  <p class="muted">No weaknesses</p>
                {/each}
              </div>
            </div>
          {/if}
        {/if}
      </div>
    {:else}
      <div class="no-selection">
        <p>Select a node from the tree to view details.</p>
      </div>
    {/if}
  </div>
</div>

{#if $treeData.length > 0}
  <div class="diagram-panel">
    <div class="panel-header">
      <h3>Tree Visualization</h3>
    </div>
    <div class="diagram-scroll">
      <AttackTreeDiagram
        nodes={$treeData}
        onSelect={handleSelect}
        selectedId={selectedNode?.id ?? null}
      />
    </div>
  </div>
{/if}

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
    min-height: 400px;
    max-height: calc(100vh - 220px);
  }

  .tree-panel, .detail-panel {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .diagram-panel {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-top: 20px;
    overflow: hidden;
  }

  .diagram-scroll {
    overflow: auto;
    max-height: 400px;
    padding: 8px;
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
  .detail-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
  .detail-header h3 { margin: 0; flex: 1; }
  .type-badge { font-size: 0.65rem; text-transform: uppercase; background: #edf2f7; padding: 2px 8px; border-radius: 8px; font-weight: 600; }

  .edit-name { flex: 1; font-size: 1rem; font-weight: 600; }
  .edit-form { display: flex; flex-direction: column; gap: 12px; }
  .slider { width: 100%; }
  .form-actions { display: flex; gap: 8px; justify-content: flex-end; }

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
  .btn-xs { padding: 2px 8px; font-size: 0.7rem; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .cm-section {
    margin-top: 16px;
    border-top: 1px solid #e2e8f0;
    padding-top: 12px;
  }

  .cm-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .cm-header h4 { margin: 0; font-size: 0.85rem; }

  .cm-form {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;
    padding: 8px;
    background: #f7fafc;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
  }

  .cm-fields {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 8px;
    align-items: center;
    font-size: 0.8rem;
  }

  .cm-list { display: flex; flex-direction: column; gap: 4px; }

  .cm-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 6px 8px;
    background: #f7fafc;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
  }

  .cm-info { display: flex; flex-direction: column; gap: 1px; font-size: 0.8rem; }
  .cm-desc { color: #718096; font-size: 0.75rem; }
  .cm-meta { color: #a0aec0; font-size: 0.7rem; }

  .btn-del {
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 2px;
    opacity: 0.5;
  }
  .btn-del:hover { opacity: 1; }

  .muted { color: #718096; font-size: 0.8rem; font-style: italic; }
</style>
