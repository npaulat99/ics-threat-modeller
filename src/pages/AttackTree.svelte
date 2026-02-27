<script lang="ts">
  import type {
    TreeNodeData,
    Goal,
    Step,
    Category,
    Substep,
    Countermeasure,
    Weakness,
    Tag,
    TagCatalogEntry,
    CreateGoal,
    CreateStep,
    CreateCategory,
    CreateSubstep,
  } from "$lib/types";
  import {
    currentProject,
    goals,
    treeData,
    selectedNodeId,
    selectedNodeType,
    dragDropEnabled,
    tagCatalog,
    tagCatalogByCategory,
    setError,
    setSuccess,
  } from "$lib/stores";
  import { ACCESS_LABELS, SKILL_LABELS, IMPACT_LABELS } from "$lib/types";
  import * as api from "$lib/api";
  import TreeView from "$components/TreeView.svelte";
  import AttackTreeDiagram from "$components/AttackTreeDiagram.svelte";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  import { onMount } from "svelte";

  let selectedNode: TreeNodeData | null = null;
  let selectedDetail: Goal | Step | Category | Substep | null = null;
  let showAddDialog = false;
  let addParent: TreeNodeData | null = null;
  let addType: "goal" | "category" | "step" | "substep" | "path" = "step";
  let addName = "";
  let addDesc = "";
  let deleteTarget: TreeNodeData | null = null;
  let editing = false;
  let editName = "";
  let editDesc = "";
  let editConjunction = "OR";
  let editAccessLevel = 1;
  let editSkillLevel = 1;
  let editImpactCategory = "";
  let editStepType = "step";

  // Impact scores for goal editing
  let editImpactScores: Record<string, number> = {
    financial: 1,
    reputation: 1,
    compliance: 1,
    safety: 1,
    operational: 1,
  };

  // Countermeasures & Weaknesses
  let nodeCountermeasures: Countermeasure[] = [];
  let nodeWeaknesses: Weakness[] = [];
  let showAddCM = false;
  let showAddWK = false;
  let newCMName = "";
  let newCMDesc = "";
  let newWKName = "";
  let newWKDesc = "";
  let newWKCve = "";

  // Entity tags (asset / interface / third_party_software)
  let entityTags: Tag[] = [];
  let showAddTag = false;
  let newTagCategory: "asset" | "interface" | "third_party_software" = "asset";
  let newTagValue = "";
  let showTagSuggestions = false;

  $: tagSuggestions = (() => {
    const catEntries = $tagCatalogByCategory[newTagCategory] || [];
    const existing = entityTags
      .filter((t) => t.key === newTagCategory)
      .map((t) => t.value);
    return catEntries
      .map((e) => e.name)
      .filter(
        (n) =>
          !existing.includes(n) &&
          (!newTagValue.trim() ||
            n.toLowerCase().includes(newTagValue.toLowerCase())),
      );
  })();

  // Group entity tags by category for display
  $: tagsByCategory = (() => {
    const grouped: Record<string, Tag[]> = {
      asset: [],
      interface: [],
      third_party_software: [],
    };
    for (const t of entityTags) {
      if (!grouped[t.key]) grouped[t.key] = [];
      grouped[t.key].push(t);
    }
    return grouped;
  })();

  const tagCategoryLabels: Record<string, string> = {
    asset: "🏭 Assets",
    interface: "🔌 Interfaces",
    third_party_software: "💾 3rd Party Software",
  };

  const skillLabels = SKILL_LABELS;
  const accessLabels = ACCESS_LABELS;

  onMount(() => {
    loadTree();
    // Load tag catalog for suggestions
    api
      .listTagCatalog()
      .then((entries) => tagCatalog.set(entries))
      .catch(() => {});
  });

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
    } catch (e) {
      setError(`Load tree failed: ${e}`);
    }
  }

  async function buildGoalNode(g: Goal): Promise<TreeNodeData> {
    const children: TreeNodeData[] = [];
    // Load steps under goal.
    const steps = await api.listSteps(g.id, "goal");
    for (const s of steps) {
      children.push(await buildStepNode(s));
    }
    // Load categories under goal.
    const cats = await api.listCategories(g.id, "goal");
    for (const c of cats) {
      children.push(await buildCategoryNode(c));
    }
    return {
      id: g.id,
      name: g.name,
      type: "goal",
      children,
      expanded: true,
      data: g,
    };
  }

  async function buildCategoryNode(c: Category): Promise<TreeNodeData> {
    const children: TreeNodeData[] = [];
    const steps = await api.listSteps(c.id, "category");
    for (const s of steps) {
      children.push(await buildStepNode(s));
    }
    return {
      id: c.id,
      name: c.name,
      type: "category",
      children,
      expanded: true,
      data: c,
    };
  }

  async function buildStepNode(s: Step): Promise<TreeNodeData> {
    const children: TreeNodeData[] = [];
    // Load child steps.
    const childSteps = await api.listSteps(s.id, "step");
    for (const cs of childSteps) {
      children.push(await buildStepNode(cs));
    }
    // Load categories under this step.
    const cats = await api.listCategories(s.id, "step");
    for (const c of cats) {
      children.push(await buildCategoryNode(c));
    }
    // Load substeps.
    const subs = await api.listSubsteps(s.id);
    for (const sub of subs) {
      const subCmChildren: TreeNodeData[] = [];
      try {
        const subCms = await api.listCountermeasures(sub.id, "substep");
        for (const cm of subCms) {
          // Attack-Defense Tree: load child steps under substep CMs too
          const cmChildren: TreeNodeData[] = [];
          try {
            const cmSteps = await api.listSteps(cm.id, "countermeasure");
            for (const cs of cmSteps) {
              cmChildren.push(await buildStepNode(cs));
            }
          } catch (_) {
            /* ignore */
          }
          subCmChildren.push({
            id: cm.id,
            name: cm.name,
            type: "countermeasure",
            children: cmChildren,
            expanded: true,
            data: cm,
          });
        }
      } catch (_) {
        /* ignore */
      }
      children.push({
        id: sub.id,
        name: sub.name,
        type: "substep",
        children: subCmChildren,
        data: sub,
      });
    }
    // Load countermeasures as defense child nodes
    try {
      const cms = await api.listCountermeasures(s.id, "step");
      for (const cm of cms) {
        // Attack-Defense Tree: load child steps under this countermeasure
        const cmChildren: TreeNodeData[] = [];
        try {
          const cmSteps = await api.listSteps(cm.id, "countermeasure");
          for (const cs of cmSteps) {
            cmChildren.push(await buildStepNode(cs));
          }
        } catch (_) {
          /* ignore */
        }
        children.push({
          id: cm.id,
          name: cm.name,
          type: "countermeasure",
          children: cmChildren,
          expanded: true,
          data: cm,
        });
      }
    } catch (_) {
      /* ignore */
    }
    const nodeType = (
      s.step_type === "path" ? "path" : "step"
    ) as TreeNodeData["type"];
    return {
      id: s.id,
      name: s.name,
      type: nodeType,
      children,
      expanded: true,
      data: s,
    };
  }

  async function handleSelect(node: TreeNodeData) {
    selectedNode = node;
    selectedDetail = node.data ?? null;
    editing = false;
    showAddCM = false;
    showAddWK = false;
    showAddTag = false;

    // Load countermeasures and weaknesses for steps/substeps
    if (node.type === "step" || node.type === "substep") {
      try {
        nodeCountermeasures = await api.listCountermeasures(node.id, node.type);
      } catch {
        nodeCountermeasures = [];
      }
      try {
        nodeWeaknesses = await api.listWeaknesses(node.id, node.type);
      } catch {
        nodeWeaknesses = [];
      }
    } else {
      nodeCountermeasures = [];
      nodeWeaknesses = [];
    }

    // Load entity tags for all node types
    try {
      entityTags = await api.listTags(node.id, node.type);
    } catch {
      entityTags = [];
    }
  }

  function startEditing() {
    if (!selectedNode || !selectedDetail) return;
    editing = true;
    editName = selectedDetail.name ?? "";
    editDesc =
      "description" in selectedDetail
        ? ((selectedDetail as any).description ?? "")
        : "";
    editConjunction =
      "conjunction" in selectedDetail
        ? ((selectedDetail as any).conjunction ?? "OR")
        : "OR";
    editAccessLevel =
      "access_level" in selectedDetail
        ? ((selectedDetail as any).access_level ?? 1)
        : 1;
    editSkillLevel =
      "skill_level" in selectedDetail
        ? ((selectedDetail as any).skill_level ?? 1)
        : 1;
    editImpactCategory =
      "impact_category" in selectedDetail
        ? ((selectedDetail as any).impact_category ?? "")
        : "";
    editStepType =
      "step_type" in selectedDetail
        ? ((selectedDetail as any).step_type ?? "step")
        : "step";
    // Load impact scores for goals
    if (selectedNode.type === "goal") {
      try {
        const scores = JSON.parse(
          (selectedDetail as any).impact_scores || "{}",
        );
        editImpactScores = {
          financial: scores.financial ?? 1,
          reputation: scores.reputation ?? 1,
          compliance: scores.compliance ?? 1,
          safety: scores.safety ?? 1,
          operational: scores.operational ?? 1,
        };
      } catch {
        editImpactScores = {
          financial: 1,
          reputation: 1,
          compliance: 1,
          safety: 1,
          operational: 1,
        };
      }
    }
  }

  async function saveEdit() {
    if (!selectedNode || !selectedDetail) return;
    try {
      if (selectedNode.type === "goal") {
        await api.updateGoal({
          id: selectedNode.id,
          name: editName,
          description: editDesc,
          impact_category: editImpactCategory,
          impact_scores: JSON.stringify(editImpactScores),
        });
      } else if (selectedNode.type === "step" || selectedNode.type === "path") {
        await api.updateStep({
          id: selectedNode.id,
          name: editName,
          description: editDesc,
          conjunction: editConjunction,
          step_type: editStepType,
          access_level: editStepType === "path" ? undefined : editAccessLevel,
          skill_level: editStepType === "path" ? undefined : editSkillLevel,
        });
      } else if (selectedNode.type === "category") {
        await api.updateCategory({
          id: selectedNode.id,
          name: editName,
          description: editDesc,
        });
      } else if (selectedNode.type === "substep") {
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
    } catch (e) {
      setError(`Update failed: ${e}`);
    }
  }

  function handleAddChild(parentNode: TreeNodeData) {
    addParent = parentNode;
    addName = "";
    addDesc = "";
    // Determine valid child type.
    if (parentNode.type === "goal") addType = "step";
    else if (parentNode.type === "category") addType = "step";
    else if (parentNode.type === "step" || parentNode.type === "path")
      addType = "step";
    else if (parentNode.type === "countermeasure") addType = "step";
    showAddDialog = true;
  }

  async function createChild() {
    if (!addParent || !addName.trim()) return;
    try {
      if (addType === "step" || addType === "path") {
        const data: CreateStep = {
          parent_id: addParent.id,
          parent_type: addParent.type === "path" ? "step" : addParent.type,
          name: addName,
          description: addDesc || undefined,
          step_type: addType === "path" ? "path" : "step",
        };
        await api.createStep(data);
      } else if (addType === "category") {
        const data: CreateCategory = {
          parent_id: addParent.id,
          parent_type: addParent.type === "path" ? "step" : addParent.type,
          name: addName,
          description: addDesc || undefined,
        };
        await api.createCategory(data);
      } else if (addType === "substep") {
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
    } catch (e) {
      setError(`Create failed: ${e}`);
    }
  }

  async function createGoal() {
    if (!$currentProject) return;
    const name = prompt("Goal name:");
    if (!name?.trim()) return;
    try {
      const data: CreateGoal = { project_id: $currentProject.id, name };
      await api.createGoal(data);
      setSuccess(`Goal "${name}" created.`);
      await loadTree();
    } catch (e) {
      setError(`Create goal failed: ${e}`);
    }
  }

  async function addCountermeasure() {
    if (!selectedNode || !newCMName.trim()) return;
    try {
      await api.createCountermeasure({
        parent_id: selectedNode.id,
        parent_type: selectedNode.type,
        name: newCMName,
        description: newCMDesc || undefined,
      });
      nodeCountermeasures = await api.listCountermeasures(
        selectedNode.id,
        selectedNode.type,
      );
      showAddCM = false;
      newCMName = "";
      newCMDesc = "";
      setSuccess("Countermeasure added");
    } catch (e) {
      setError(`Add countermeasure failed: ${e}`);
    }
  }

  async function deleteCountermeasure(id: string) {
    if (!selectedNode) return;
    try {
      await api.deleteCountermeasure(id);
      nodeCountermeasures = await api.listCountermeasures(
        selectedNode.id,
        selectedNode.type,
      );
      setSuccess("Countermeasure deleted");
    } catch (e) {
      setError(`Delete countermeasure failed: ${e}`);
    }
  }

  async function addWeakness() {
    if (!selectedNode || !newWKName.trim()) return;
    try {
      await api.createWeakness({
        parent_id: selectedNode.id,
        parent_type: selectedNode.type,
        name: newWKName,
        description: newWKDesc || undefined,
        cve_id: newWKCve || undefined,
      });
      nodeWeaknesses = await api.listWeaknesses(
        selectedNode.id,
        selectedNode.type,
      );
      showAddWK = false;
      newWKName = "";
      newWKDesc = "";
      newWKCve = "";
      setSuccess("Weakness added");
    } catch (e) {
      setError(`Add weakness failed: ${e}`);
    }
  }

  async function deleteWeakness(id: string) {
    if (!selectedNode) return;
    try {
      await api.deleteWeakness(id);
      nodeWeaknesses = await api.listWeaknesses(
        selectedNode.id,
        selectedNode.type,
      );
      setSuccess("Weakness deleted");
    } catch (e) {
      setError(`Delete weakness failed: ${e}`);
    }
  }

  // ─── Entity Tag Management ────────────────────────────────────
  async function addEntityTag() {
    if (!selectedNode || !newTagValue.trim()) return;
    try {
      await api.createTag({
        entity_id: selectedNode.id,
        entity_type: selectedNode.type,
        key: newTagCategory,
        value: newTagValue.trim(),
      });
      entityTags = await api.listTags(selectedNode.id, selectedNode.type);
      newTagValue = "";
      showTagSuggestions = false;
      setSuccess("Tag added");
    } catch (e) {
      setError(`Add tag failed: ${e}`);
    }
  }

  async function removeEntityTag(tagId: string) {
    if (!selectedNode) return;
    try {
      await api.deleteTag(tagId);
      entityTags = await api.listTags(selectedNode.id, selectedNode.type);
      setSuccess("Tag removed");
    } catch (e) {
      setError(`Remove tag failed: ${e}`);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "goal") await api.deleteGoal(deleteTarget.id);
      else if (deleteTarget.type === "step")
        await api.deleteStep(deleteTarget.id);
      else if (deleteTarget.type === "category")
        await api.deleteCategory(deleteTarget.id);
      else if (deleteTarget.type === "substep")
        await api.deleteSubstep(deleteTarget.id);
      else if (deleteTarget.type === "countermeasure")
        await api.deleteCountermeasure(deleteTarget.id);
      setSuccess(`Deleted ${deleteTarget.type}: ${deleteTarget.name}`);
      deleteTarget = null;
      selectedNode = null;
      selectedDetail = null;
      await loadTree();
    } catch (e) {
      setError(`Delete failed: ${e}`);
    }
  }

  async function handleDuplicate(node: TreeNodeData) {
    try {
      if (node.type === "goal") {
        const src = node.data as Goal;
        await api.createGoal({
          project_id: src.project_id,
          name: `${src.name} (copy)`,
          description: src.description || undefined,
          impact_category: src.impact_category || undefined,
        });
      } else if (node.type === "step") {
        const src = node.data as Step;
        await api.createStep({
          parent_id: src.parent_id,
          parent_type: src.parent_type,
          name: `${src.name} (copy)`,
          description: src.description || undefined,
          conjunction: src.conjunction || undefined,
          access_level: src.access_level,
          skill_level: src.skill_level,
        });
      } else if (node.type === "category") {
        const src = node.data as Category;
        await api.createCategory({
          parent_id: src.parent_id,
          parent_type: src.parent_type,
          name: `${src.name} (copy)`,
          description: src.description || undefined,
        });
      } else if (node.type === "substep") {
        const src = node.data as Substep;
        await api.createSubstep({
          parent_step_id: src.parent_step_id,
          name: `${src.name} (copy)`,
          description: src.description || undefined,
          conjunction: src.conjunction || undefined,
          access_level: src.access_level,
          skill_level: src.skill_level,
        });
      }
      setSuccess(`Duplicated ${node.type}: ${node.name}`);
      await loadTree();
    } catch (e) {
      setError(`Duplicate failed: ${e}`);
    }
  }

  // Find siblings of a node in the tree
  function findSiblings(
    nodes: TreeNodeData[],
    targetId: string,
  ): TreeNodeData[] | null {
    for (const n of nodes) {
      const idx = n.children.findIndex((c) => c.id === targetId);
      if (idx >= 0) return n.children;
      const found = findSiblings(n.children, targetId);
      if (found) return found;
    }
    // Check top-level
    if (nodes.find((n) => n.id === targetId)) return nodes;
    return null;
  }

  async function handleReorder(detail: {
    draggedId: string;
    draggedType: string;
    targetId: string;
    targetType: string;
    position: "before" | "after";
  }) {
    // Only reorder same-type siblings
    if (detail.draggedType !== detail.targetType) return;

    const siblings = findSiblings($treeData, detail.targetId);
    if (!siblings) return;

    const dragIdx = siblings.findIndex((s) => s.id === detail.draggedId);
    if (dragIdx < 0) return; // not a sibling

    // Remove dragged and insert at target position
    const [dragged] = siblings.splice(dragIdx, 1);
    const targetIdx = siblings.findIndex((s) => s.id === detail.targetId);
    const insertIdx = detail.position === "before" ? targetIdx : targetIdx + 1;
    siblings.splice(insertIdx, 0, dragged);

    // Update sort_order for all siblings
    try {
      for (let i = 0; i < siblings.length; i++) {
        const s = siblings[i];
        if (s.type === "goal") {
          await api.updateGoal({ id: s.id, sort_order: i });
        } else if (s.type === "step") {
          await api.updateStep({ id: s.id, sort_order: i });
        } else if (s.type === "category") {
          await api.updateCategory({ id: s.id, sort_order: i });
        } else if (s.type === "substep") {
          await api.updateSubstep({ id: s.id, sort_order: i });
        }
      }
      await loadTree();
    } catch (e) {
      setError(`Reorder failed: ${e}`);
    }
  }
</script>

<div class="attack-tree-page">
  <div class="tree-panel">
    <div class="panel-header">
      <h3>Attack Tree</h3>
      <button class="btn btn-sm btn-primary" on:click={createGoal}
        >+ Goal</button
      >
    </div>
    <div class="tree-container">
      <TreeView
        nodes={$treeData}
        onSelect={handleSelect}
        onAddChild={handleAddChild}
        onDelete={(n) => (deleteTarget = n)}
        onDuplicate={handleDuplicate}
        onReorder={handleReorder}
        dragEnabled={$dragDropEnabled}
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
            <button class="btn btn-sm btn-secondary" on:click={startEditing}
              >✏️ Edit</button
            >
          {/if}
        </div>

        {#if editing}
          <div class="edit-form">
            <div class="form-group">
              <label>Description</label>
              <textarea class="input" rows="3" bind:value={editDesc}></textarea>
            </div>
            {#if selectedNode.type === "goal"}
              <div class="form-group">
                <label>Aggregation Type</label>
                <select class="input" bind:value={editImpactCategory}>
                  <option value="">Default (OR)</option>
                  <option value="or">OR</option>
                  <option value="and">AND</option>
                </select>
              </div>
              <!-- Impact Assessment for Goal -->
              <div class="impact-edit-section">
                <h4>Impact Assessment</h4>
                <div class="impact-edit-grid">
                  {#each Object.entries(IMPACT_LABELS) as [factor, labels]}
                    <div class="impact-edit-row">
                      <span class="impact-factor-name">{factor}</span>
                      <div class="impact-btns">
                        {#each [1, 2, 3, 4, 5] as v}
                          <button
                            class="impact-btn"
                            class:active={editImpactScores[factor] === v}
                            class:low={v <= 2}
                            class:mid={v === 3}
                            class:high={v >= 4}
                            on:click={() => {
                              editImpactScores[factor] = v;
                              editImpactScores = editImpactScores;
                            }}
                            title={labels[v - 1]}>{v}</button
                          >
                        {/each}
                      </div>
                      <span class="impact-lbl"
                        >{labels[editImpactScores[factor] - 1] ?? ""}</span
                      >
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
            {#if selectedNode.type === "step" || selectedNode.type === "path"}
              <div class="form-group">
                <label>Entity Type</label>
                <select class="input" bind:value={editStepType}>
                  <option value="step">Step (assessable)</option>
                  <option value="path"
                    >Path (grouping only, no assessment)</option
                  >
                </select>
              </div>
            {/if}
            {#if (selectedNode.type === "step" || selectedNode.type === "substep" || selectedNode.type === "path") && selectedNode.children.length > 0}
              <div class="form-group">
                <label>Conjunction (how children combine)</label>
                <select class="input" bind:value={editConjunction}>
                  <option value="OR">OR — any child path succeeds</option>
                  <option value="AND">AND — all child paths required</option>
                </select>
              </div>
            {/if}
            {#if (selectedNode.type === "step" || selectedNode.type === "substep") && editStepType !== "path"}
              <div class="form-group">
                <label
                  >Access Level: {editAccessLevel} ({accessLabels[
                    editAccessLevel - 1
                  ] ?? ""})</label
                >
                <div class="level-btns">
                  {#each [1, 2, 3, 4, 5] as v}
                    <button
                      class="lvl-btn"
                      class:active={editAccessLevel === v}
                      class:low={v <= 2}
                      class:mid={v === 3}
                      class:high={v >= 4}
                      on:click={() => {
                        editAccessLevel = v;
                      }}
                      title={accessLabels[v - 1]}>{v}</button
                    >
                  {/each}
                </div>
              </div>
              <div class="form-group">
                <label
                  >Skill Level: {editSkillLevel} ({skillLabels[
                    editSkillLevel - 1
                  ] ?? ""})</label
                >
                <div class="level-btns">
                  {#each [1, 2, 3, 4, 5] as v}
                    <button
                      class="lvl-btn"
                      class:active={editSkillLevel === v}
                      class:low={v <= 2}
                      class:mid={v === 3}
                      class:high={v >= 4}
                      on:click={() => {
                        editSkillLevel = v;
                      }}
                      title={skillLabels[v - 1]}>{v}</button
                    >
                  {/each}
                </div>
              </div>
            {/if}
            <div class="form-actions">
              <button
                class="btn btn-secondary"
                on:click={() => (editing = false)}>Cancel</button
              >
              <button class="btn btn-primary" on:click={saveEdit}>Save</button>
            </div>
          </div>
        {:else}
          <dl class="detail-fields">
            {#if "description" in selectedDetail}
              <dt>Description</dt>
              <dd>{selectedDetail.description || "—"}</dd>
            {/if}
            {#if selectedNode.type === "step" || selectedNode.type === "path"}
              <dt>Entity Type</dt>
              <dd>
                {selectedNode.type === "path"
                  ? "Path (grouping)"
                  : "Step (assessable)"}
              </dd>
            {/if}
            {#if "impact_category" in selectedDetail}
              <dt>Aggregation</dt>
              <dd>{selectedDetail.impact_category || "OR (default)"}</dd>
            {/if}
            {#if "conjunction" in selectedDetail && selectedNode.children.length > 0}
              <dt>Conjunction</dt>
              <dd>{selectedDetail.conjunction}</dd>
            {/if}
            {#if "access_level" in selectedDetail && selectedDetail.access_level !== undefined}
              <dt>Access Level</dt>
              <dd>
                {selectedDetail.access_level} ({accessLabels[
                  Number(selectedDetail.access_level) - 1
                ] ?? ""})
              </dd>
            {/if}
            {#if "skill_level" in selectedDetail && selectedDetail.skill_level !== undefined}
              <dt>Skill Level</dt>
              <dd>
                {selectedDetail.skill_level} ({skillLabels[
                  Number(selectedDetail.skill_level) - 1
                ] ?? ""})
              </dd>
            {/if}
          </dl>

          {#if selectedNode.type === "step" || selectedNode.type === "substep" || selectedNode.type === "path"}
            <!-- Countermeasures -->
            <div class="cm-section">
              <div class="cm-header">
                <h4>🛡️ Countermeasures ({nodeCountermeasures.length})</h4>
                <button
                  class="btn btn-xs btn-primary"
                  on:click={() => (showAddCM = !showAddCM)}
                >
                  {showAddCM ? "✕" : "+ Add"}
                </button>
              </div>
              {#if showAddCM}
                <div class="cm-form">
                  <input
                    class="input"
                    bind:value={newCMName}
                    placeholder="Name"
                  />
                  <input
                    class="input"
                    bind:value={newCMDesc}
                    placeholder="Description"
                  />
                  <button
                    class="btn btn-sm btn-primary"
                    on:click={addCountermeasure}>Save</button
                  >
                </div>
              {/if}
              <div class="cm-list">
                {#each nodeCountermeasures as cm (cm.id)}
                  <div class="cm-item">
                    <div class="cm-info">
                      <strong>{cm.name}</strong>
                      {#if cm.description}<span class="cm-desc"
                          >{cm.description}</span
                        >{/if}
                    </div>
                    <button
                      class="btn-del"
                      on:click={() => deleteCountermeasure(cm.id)}
                      title="Delete">🗑</button
                    >
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
                <button
                  class="btn btn-xs btn-primary"
                  on:click={() => (showAddWK = !showAddWK)}
                >
                  {showAddWK ? "✕" : "+ Add"}
                </button>
              </div>
              {#if showAddWK}
                <div class="cm-form">
                  <input
                    class="input"
                    bind:value={newWKName}
                    placeholder="Name"
                  />
                  <input
                    class="input"
                    bind:value={newWKDesc}
                    placeholder="Description"
                  />
                  <input
                    class="input"
                    bind:value={newWKCve}
                    placeholder="CVE ID (optional)"
                  />
                  <button class="btn btn-sm btn-primary" on:click={addWeakness}
                    >Save</button
                  >
                </div>
              {/if}
              <div class="cm-list">
                {#each nodeWeaknesses as wk (wk.id)}
                  <div class="cm-item">
                    <div class="cm-info">
                      <strong>{wk.name}</strong>
                      {#if wk.description}<span class="cm-desc"
                          >{wk.description}</span
                        >{/if}
                      {#if wk.cve_id}<span class="cm-meta">{wk.cve_id}</span
                        >{/if}
                    </div>
                    <button
                      class="btn-del"
                      on:click={() => deleteWeakness(wk.id)}
                      title="Delete">🗑</button
                    >
                  </div>
                {:else}
                  <p class="muted">No weaknesses</p>
                {/each}
              </div>
            </div>
          {/if}

          <!-- Entity Tags (Assets / Interfaces / 3rd Party Software) -->
          <div class="cm-section">
            <div class="cm-header">
              <h4>🏷️ Tags ({entityTags.length})</h4>
              <button
                class="btn btn-xs btn-primary"
                on:click={() => (showAddTag = !showAddTag)}
              >
                {showAddTag ? "✕" : "+ Add"}
              </button>
            </div>
            {#if showAddTag}
              <div class="tag-assign-form">
                <select
                  class="input tag-cat-select"
                  bind:value={newTagCategory}
                  on:change={() => {
                    newTagValue = "";
                    showTagSuggestions = false;
                  }}
                >
                  <option value="asset">🏭 Asset</option>
                  <option value="interface">🔌 Interface</option>
                  <option value="third_party_software"
                    >💾 3rd Party Software</option
                  >
                </select>
                <div class="tag-autocomplete-wrapper">
                  <input
                    class="input"
                    bind:value={newTagValue}
                    placeholder="Select or type tag…"
                    on:focus={() => (showTagSuggestions = true)}
                    on:blur={() =>
                      setTimeout(() => (showTagSuggestions = false), 200)}
                    on:input={() => (showTagSuggestions = true)}
                    on:keydown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addEntityTag();
                      }
                    }}
                  />
                  {#if showTagSuggestions && tagSuggestions.length > 0}
                    <div class="tag-suggestions-dropdown">
                      {#each tagSuggestions.slice(0, 8) as suggestion}
                        <button
                          class="tag-suggestion-item"
                          on:mousedown|preventDefault={() => {
                            newTagValue = suggestion;
                            addEntityTag();
                          }}>{suggestion}</button
                        >
                      {/each}
                    </div>
                  {/if}
                </div>
                <button class="btn btn-sm btn-primary" on:click={addEntityTag}
                  >Add</button
                >
              </div>
            {/if}
            {#each Object.entries(tagsByCategory) as [cat, tags]}
              {#if tags.length > 0}
                <div class="tag-cat-group">
                  <span class="tag-cat-label"
                    >{tagCategoryLabels[cat] || cat}</span
                  >
                  <div class="tag-pills-row">
                    {#each tags as tag (tag.id)}
                      <span class="entity-tag-pill {cat}">
                        {tag.value}
                        <button
                          class="tag-pill-remove"
                          on:click={() => removeEntityTag(tag.id)}
                          title="Remove">✕</button
                        >
                      </span>
                    {/each}
                  </div>
                </div>
              {/if}
            {/each}
            {#if entityTags.length === 0 && !showAddTag}
              <p class="muted">No tags assigned</p>
            {/if}
          </div>
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
    <AttackTreeDiagram
      nodes={$treeData}
      onSelect={handleSelect}
      selectedId={selectedNode?.id ?? null}
    />
  </div>
{/if}

{#if showAddDialog}
  <div class="overlay" on:click={() => (showAddDialog = false)} role="dialog">
    <div class="dialog" on:click|stopPropagation role="document">
      <h3>Add child to "{addParent?.name}"</h3>
      <div class="form-group">
        <label>Type</label>
        <select class="input" bind:value={addType}>
          <option value="step">Step (assessable)</option>
          <option value="path">Path (grouping only)</option>
          {#if addParent?.type === "goal" || addParent?.type === "step" || addParent?.type === "path"}
            <option value="category">Category</option>
          {/if}
          {#if addParent?.type === "step" || addParent?.type === "path"}
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
        <button
          class="btn btn-secondary"
          on:click={() => (showAddDialog = false)}>Cancel</button
        >
        <button
          class="btn btn-primary"
          on:click={createChild}
          disabled={!addName.trim()}>Create</button
        >
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
  /* Impact edit UI */
  .impact-edit-section {
    margin-top: 12px;
  }
  .impact-edit-section h4 {
    margin: 0 0 8px;
    font-size: 14px;
  }
  .impact-edit-grid {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .impact-edit-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .impact-factor-name {
    width: 180px;
    font-size: 13px;
    text-transform: capitalize;
  }
  .impact-btns {
    display: flex;
    gap: 3px;
  }
  .impact-btn {
    width: 28px;
    height: 28px;
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    background: var(--surface);
    color: var(--text);
  }
  .impact-btn.active.low {
    background: #22c55e;
    border-color: #16a34a;
    color: #fff;
  }
  .impact-btn.active.mid {
    background: #eab308;
    border-color: #ca8a04;
    color: #fff;
  }
  .impact-btn.active.high {
    background: #ef4444;
    border-color: #dc2626;
    color: #fff;
  }
  .impact-lbl {
    font-size: 11px;
    color: var(--text-secondary);
    min-width: 60px;
  }

  .attack-tree-page {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
    min-height: 400px;
    max-height: calc(100vh - 220px);
  }

  .tree-panel,
  .detail-panel {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
    max-height: calc(100vh - 240px);
  }

  .detail-panel {
    overflow-y: auto;
  }

  .diagram-panel {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    margin-top: 20px;
    overflow: hidden;
    position: relative;
    z-index: 0;
    height: 520px;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #e2e8f0;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 0.95rem;
  }

  .tree-container {
    flex: 1;
    overflow-y: scroll;
    padding: 8px;
  }

  /* Custom scrollbar styling for tree panel */
  .tree-container::-webkit-scrollbar {
    width: 10px;
  }
  .tree-container::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 5px;
  }
  .tree-container::-webkit-scrollbar-thumb {
    background: #94a3b8;
    border-radius: 5px;
    border: 2px solid #f1f5f9;
  }
  .tree-container::-webkit-scrollbar-thumb:hover {
    background: #64748b;
  }

  .detail-panel::-webkit-scrollbar {
    width: 10px;
  }
  .detail-panel::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 5px;
  }
  .detail-panel::-webkit-scrollbar-thumb {
    background: #94a3b8;
    border-radius: 5px;
    border: 2px solid #f1f5f9;
  }
  .detail-panel::-webkit-scrollbar-thumb:hover {
    background: #64748b;
  }

  .detail-card {
    padding: 20px;
  }
  .detail-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .detail-header h3 {
    margin: 0;
    flex: 1;
  }
  .type-badge {
    font-size: 0.65rem;
    text-transform: uppercase;
    background: #edf2f7;
    padding: 2px 8px;
    border-radius: 8px;
    font-weight: 600;
  }

  .edit-name {
    flex: 1;
    font-size: 1rem;
    font-weight: 600;
  }
  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .level-btns {
    display: flex;
    gap: 3px;
    margin-top: 4px;
  }
  .lvl-btn {
    width: 32px;
    height: 32px;
    border: 2px solid #cbd5e0;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-weight: 700;
    font-size: 0.85rem;
    color: #4a5568;
    transition: all 0.12s;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .lvl-btn:hover {
    border-color: #a0aec0;
    background: #edf2f7;
  }
  .lvl-btn.active.low {
    background: #c6f6d5;
    border-color: #38a169;
    color: #22543d;
  }
  .lvl-btn.active.mid {
    background: #fefcbf;
    border-color: #d69e2e;
    color: #744210;
  }
  .lvl-btn.active.high {
    background: #fed7d7;
    border-color: #e53e3e;
    color: #742a2a;
  }
  .form-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .detail-fields dt {
    font-size: 0.75rem;
    font-weight: 600;
    color: #4a5568;
    margin-top: 10px;
  }
  .detail-fields dd {
    margin: 2px 0 0;
    font-size: 0.88rem;
  }

  .no-selection {
    padding: 40px;
    text-align: center;
    color: #718096;
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .dialog {
    background: white;
    border-radius: 10px;
    padding: 24px;
    max-width: 440px;
    width: 90%;
  }
  .dialog h3 {
    margin: 0 0 16px;
    font-size: 1rem;
  }
  .dialog-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 16px;
  }

  .form-group {
    margin-bottom: 12px;
  }
  .form-group label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .input {
    width: 100%;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 0.85rem;
    font-family: inherit;
  }
  .btn {
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
  }
  .btn-primary {
    background: #1a365d;
    color: white;
  }
  .btn-secondary {
    background: #edf2f7;
    color: #2d3748;
    border: 1px solid #e2e8f0;
  }
  .btn-sm {
    padding: 4px 10px;
    font-size: 0.75rem;
  }
  .btn-xs {
    padding: 2px 8px;
    font-size: 0.7rem;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

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

  .cm-header h4 {
    margin: 0;
    font-size: 0.85rem;
  }

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

  .cm-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .cm-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 6px 8px;
    background: #f7fafc;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
  }

  .cm-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    font-size: 0.8rem;
  }
  .cm-desc {
    color: #718096;
    font-size: 0.75rem;
  }
  .cm-meta {
    color: #a0aec0;
    font-size: 0.7rem;
  }

  .btn-del {
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 2px;
    opacity: 0.5;
  }
  .btn-del:hover {
    opacity: 1;
  }

  .muted {
    color: #718096;
    font-size: 0.8rem;
    font-style: italic;
  }

  /* Entity Tag Assignment */
  .tag-assign-form {
    display: flex;
    gap: 6px;
    align-items: flex-start;
    margin-bottom: 8px;
  }
  .tag-cat-select {
    width: auto;
    min-width: 100px;
    font-size: 0.78rem;
    padding: 6px 8px;
  }
  .tag-autocomplete-wrapper {
    position: relative;
    flex: 1;
  }
  .tag-suggestions-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 0 0 6px 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    max-height: 180px;
    overflow-y: auto;
    z-index: 100;
  }
  .tag-suggestion-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 6px 10px;
    border: none;
    background: none;
    font-size: 0.78rem;
    cursor: pointer;
    color: #2d3748;
  }
  .tag-suggestion-item:hover {
    background: #edf2f7;
  }
  .tag-cat-group {
    margin-bottom: 6px;
  }
  .tag-cat-label {
    display: block;
    font-size: 0.7rem;
    font-weight: 600;
    color: #718096;
    margin-bottom: 3px;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .tag-pills-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .entity-tag-pill {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.72rem;
    font-weight: 500;
    border: 1px solid;
  }
  .entity-tag-pill.asset {
    background: #ebf8ff;
    border-color: #90cdf4;
    color: #2b6cb0;
  }
  .entity-tag-pill.interface {
    background: #f0fff4;
    border-color: #9ae6b4;
    color: #276749;
  }
  .entity-tag-pill.third_party_software {
    background: #faf5ff;
    border-color: #d6bcfa;
    color: #6b46c1;
  }
  .tag-pill-remove {
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.6rem;
    color: inherit;
    opacity: 0.6;
    padding: 0 1px;
    line-height: 1;
  }
  .tag-pill-remove:hover {
    opacity: 1;
  }
</style>
