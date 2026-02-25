<script lang="ts">
    import type {
        Goal,
        Step,
        Countermeasure,
        Weakness,
        AttackPath,
        PathStep,
    } from "$lib/types";
    import { ACCESS_LABELS, SKILL_LABELS } from "$lib/types";
    import { currentProject, setError, setSuccess } from "$lib/stores";
    import { formatProbability, getSeverityLabel } from "$lib/calculations";
    import * as api from "$lib/api";
    import ConfirmDialog from "$components/ConfirmDialog.svelte";
    import { onMount } from "svelte";

    // ── Enriched step node (adds WK/CM to each path-step) ──
    interface EnrichedStep extends PathStep {
        weaknesses: Weakness[];
        countermeasures: Countermeasure[];
    }

    interface EnrichedPath {
        path_id: string;
        goal_id: string;
        goal_name: string;
        steps: EnrichedStep[];
        cost_probability: number;
        overall_probability: number;
        is_realistic: boolean;
        max_access_level: number;
        max_skill_level: number;
        access_probability: number;
    }

    // ── State ──
    let goalList: Goal[] = [];
    let selectedGoalId = "";
    let selectedGoal: Goal | null = null;
    let paths: EnrichedPath[] = [];
    let loading = false;

    // Selection
    let selectedStepId = "";

    // Drag & drop (per-path, sibling reorder)
    let dragPathIdx: number | null = null;
    let dragStepIdx: number | null = null;
    let dragOverStepIdx: number | null = null;

    // Dialogs
    let showAddGoalDialog = false;
    let newGoalName = "";
    let showAddVectorDialog = false;
    let newVecStepName = "";
    let newVecStepDesc = "";
    // Extend path – add a step as AND child of a path's deepest node
    let extendPathId = "";
    let extendStepName = "";
    let extendStepDesc = "";

    // Insert before a step in a path chain
    let insertBeforeStepId = "";
    let insertBeforePathIdx = -1;
    let insertStepName = "";
    let insertStepDesc = "";

    // Weakness / countermeasure add
    let addingWKForId = "";
    let addingWKForType = "";
    let newWKName = "";
    let newWKDesc = "";
    let newWKSeverity = 3;
    let addingCMForId = "";
    let addingCMForType = "";
    let newCMName = "";
    let newCMDesc = "";
    let newCMEffectiveness = 3;
    let newCMCost = 3;

    // Delete
    let deleteTarget: { id: string; name: string; type: string } | null = null;

    // Import from other path
    let showImportDialog = false;
    let importableSteps: { pathId: string; step: EnrichedStep }[] = [];

    // Edit
    let editingId = "";
    let editName = "";
    let editDesc = "";
    let editAccess = 1;
    let editSkill = 1;

    const skillLabels = SKILL_LABELS;
    const accessLabels = ACCESS_LABELS;

    onMount(loadGoals);

    // ── Goal CRUD ──
    async function loadGoals() {
        if (!$currentProject) return;
        try {
            goalList = await api.listGoals($currentProject.id);
        } catch (e) {
            setError(`Load goals failed: ${e}`);
        }
    }

    async function createNewGoal() {
        if (!$currentProject || !newGoalName.trim()) return;
        try {
            const g = await api.createGoal({
                project_id: $currentProject.id,
                name: newGoalName,
            });
            setSuccess(`Goal "${newGoalName}" created.`);
            showAddGoalDialog = false;
            newGoalName = "";
            await loadGoals();
            await selectGoal(g);
        } catch (e) {
            setError(`Create goal failed: ${e}`);
        }
    }

    async function selectGoal(g: Goal) {
        selectedGoalId = g.id;
        selectedGoal = g;
        selectedStepId = "";
        editingId = "";
        await loadPaths();
    }

    // ── Load attack paths from backend ──
    async function loadPaths() {
        if (!selectedGoalId || !$currentProject) return;
        loading = true;
        try {
            const raw: AttackPath[] = await api.calculateAttackPaths(
                $currentProject.id,
                selectedGoalId,
            );
            // Enrich each step with weaknesses / countermeasures
            const enriched: EnrichedPath[] = [];
            for (const p of raw) {
                const eSteps: EnrichedStep[] = [];
                for (const s of p.steps) {
                    const wk = await safe(
                        () => api.listWeaknesses(s.entity_id, s.entity_type),
                        [],
                    );
                    const cm = await safe(
                        () =>
                            api.listCountermeasures(s.entity_id, s.entity_type),
                        [],
                    );
                    eSteps.push({ ...s, weaknesses: wk, countermeasures: cm });
                }
                enriched.push({ ...p, steps: eSteps });
            }
            paths = enriched;
        } catch (e) {
            setError(`Load attack paths failed: ${e}`);
        }
        loading = false;
    }

    async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
        try {
            return await fn();
        } catch {
            return fallback;
        }
    }

    // ── Add new vector ──
    // Creates a new step directly under the goal (becomes a new standalone path).
    async function addNewVector() {
        if (!selectedGoalId || !newVecStepName.trim()) return;
        try {
            await api.createStep({
                parent_id: selectedGoalId,
                parent_type: "goal",
                name: newVecStepName,
                description: newVecStepDesc || undefined,
                conjunction: "AND", // this step's children combine with AND (sequential required steps)
            });
            setSuccess(`Vector "${newVecStepName}" created.`);
            showAddVectorDialog = false;
            newVecStepName = "";
            newVecStepDesc = "";
            await loadPaths();
        } catch (e) {
            setError(`Add vector failed: ${e}`);
        }
    }

    // ── Extend a path ──
    // Appends a new AND step as child of the last step in the path.
    async function extendPath() {
        if (!extendPathId || !extendStepName.trim()) return;
        const path = paths.find((p) => p.path_id === extendPathId);
        if (!path || path.steps.length === 0) return;
        const lastStep = path.steps[path.steps.length - 1];
        try {
            await api.createStep({
                parent_id: lastStep.entity_id,
                parent_type:
                    lastStep.entity_type === "substep" ? "step" : "step",
                name: extendStepName,
                description: extendStepDesc || undefined,
                conjunction: "AND",
            });
            setSuccess(`Step "${extendStepName}" added to path.`);
            extendPathId = "";
            extendStepName = "";
            extendStepDesc = "";
            await loadPaths();
        } catch (e) {
            setError(`Extend path failed: ${e}`);
        }
    }

    // ── Insert before step ──
    // Insert a new step between a step's parent and the step itself.
    async function insertBeforeStep() {
        if (!insertBeforeStepId || !insertStepName.trim()) return;
        try {
            // Get the target step's parent info
            const targetStep = await api.getStep(insertBeforeStepId);
            // Create a new step under the same parent
            const newStep = await api.createStep({
                parent_id: targetStep.parent_id,
                parent_type: targetStep.parent_type,
                name: insertStepName,
                description: insertStepDesc || undefined,
                conjunction: "AND",
            });
            // Reparent the target step to be child of the new step
            await api.updateStep({
                id: insertBeforeStepId,
                parent_id: newStep.id,
                parent_type: "step",
            });
            setSuccess(
                `Inserted "${insertStepName}" before "${targetStep.name}".`,
            );
            insertBeforeStepId = "";
            insertStepName = "";
            insertStepDesc = "";
            insertBeforePathIdx = -1;
            await loadPaths();
        } catch (e) {
            setError(`Insert step failed: ${e}`);
        }
    }

    // ── Delete ──
    async function confirmDelete() {
        if (!deleteTarget) return;
        try {
            if (deleteTarget.type === "goal") {
                await api.deleteGoal(deleteTarget.id);
                selectedGoalId = "";
                selectedGoal = null;
                paths = [];
                await loadGoals();
            } else if (deleteTarget.type === "step") {
                await api.deleteStep(deleteTarget.id);
                await loadPaths();
            } else if (deleteTarget.type === "substep") {
                await api.deleteSubstep(deleteTarget.id);
                await loadPaths();
            } else if (deleteTarget.type === "weakness") {
                await api.deleteWeakness(deleteTarget.id);
                await loadPaths();
            } else if (deleteTarget.type === "countermeasure") {
                await api.deleteCountermeasure(deleteTarget.id);
                await loadPaths();
            }
            setSuccess(`Deleted ${deleteTarget.type}: ${deleteTarget.name}`);
        } catch (e) {
            setError(`Delete failed: ${e}`);
        }
        deleteTarget = null;
        selectedStepId = "";
    }

    // ── Weakness / Countermeasure ──
    async function addWeakness() {
        if (!addingWKForId || !newWKName.trim()) return;
        try {
            await api.createWeakness({
                parent_id: addingWKForId,
                parent_type: addingWKForType,
                name: newWKName,
                description: newWKDesc || undefined,
                severity: newWKSeverity,
            });
            setSuccess("Weakness added");
            addingWKForId = "";
            newWKName = "";
            newWKDesc = "";
            newWKSeverity = 3;
            await loadPaths();
        } catch (e) {
            setError(`Add weakness failed: ${e}`);
        }
    }

    async function addCountermeasure() {
        if (!addingCMForId || !newCMName.trim()) return;
        try {
            await api.createCountermeasure({
                parent_id: addingCMForId,
                parent_type: addingCMForType,
                name: newCMName,
                description: newCMDesc || undefined,
                effectiveness: newCMEffectiveness,
                implementation_cost: newCMCost,
            });
            setSuccess("Countermeasure added");
            addingCMForId = "";
            newCMName = "";
            newCMDesc = "";
            newCMEffectiveness = 3;
            newCMCost = 3;
            await loadPaths();
        } catch (e) {
            setError(`Add countermeasure failed: ${e}`);
        }
    }

    // ── Import from other path ──
    function openImportDialog() {
        importableSteps = [];
        for (const p of paths) {
            for (const s of p.steps) {
                importableSteps.push({ pathId: p.path_id, step: s });
            }
        }
        showImportDialog = true;
    }

    async function importStep(entry: { pathId: string; step: EnrichedStep }) {
        if (!selectedGoalId) return;
        try {
            await api.createStep({
                parent_id: selectedGoalId,
                parent_type: "goal",
                name: entry.step.name,
                conjunction: "AND",
                access_level: entry.step.access_level,
                skill_level: entry.step.skill_level,
            });
            setSuccess(
                `Imported "${entry.step.name}" as new vector (OR connection).`,
            );
            showImportDialog = false;
            await loadPaths();
        } catch (e) {
            setError(`Import failed: ${e}`);
        }
    }

    // ── Edit step ──
    function startEdit(s: EnrichedStep) {
        editingId = s.entity_id;
        editName = s.name;
        editDesc = "";
        editAccess = s.access_level || 1;
        editSkill = s.skill_level || 1;
    }

    async function saveEdit() {
        if (!editingId) return;
        try {
            await api.updateStep({
                id: editingId,
                name: editName,
                description: editDesc,
                access_level: editAccess,
                skill_level: editSkill,
            });
            setSuccess("Updated");
            editingId = "";
            await loadPaths();
        } catch (e) {
            setError(`Update failed: ${e}`);
        }
    }

    // ── Drag & Drop (reorder sibling steps sharing the same parent) ──
    function onDragStart(pathIdx: number, stepIdx: number) {
        dragPathIdx = pathIdx;
        dragStepIdx = stepIdx;
    }

    function onDragOver(e: DragEvent, stepIdx: number) {
        e.preventDefault();
        e.dataTransfer!.dropEffect = "move";
        dragOverStepIdx = stepIdx;
    }

    async function onDrop(e: DragEvent, pathIdx: number, stepIdx: number) {
        e.preventDefault();
        if (
            dragPathIdx !== pathIdx ||
            dragStepIdx === null ||
            dragStepIdx === stepIdx
        ) {
            resetDrag();
            return;
        }

        const path = paths[pathIdx];
        if (!path) {
            resetDrag();
            return;
        }

        // Collect siblings that share the same parent
        const draggedStep = path.steps[dragStepIdx];
        const targetStep = path.steps[stepIdx];
        if (!draggedStep || !targetStep) {
            resetDrag();
            return;
        }

        // Find all steps in this path that are siblings (share a parent).
        // We use the backend listSteps to get actual sibling info.
        try {
            // Determine the parent of the dragged step
            const fullStep = await api.getStep(draggedStep.entity_id);
            const siblings = await api.listSteps(
                fullStep.parent_id,
                fullStep.parent_type,
            );

            // Check target is a sibling
            const siblingIds = new Set(siblings.map((s) => s.id));
            if (!siblingIds.has(targetStep.entity_id)) {
                setError("Can only reorder sibling steps (same parent).");
                resetDrag();
                return;
            }

            // Build new order
            const ordered = [...siblings];
            const fromIdx = ordered.findIndex(
                (s) => s.id === draggedStep.entity_id,
            );
            const toIdx = ordered.findIndex(
                (s) => s.id === targetStep.entity_id,
            );
            if (fromIdx < 0 || toIdx < 0) {
                resetDrag();
                return;
            }
            const [moved] = ordered.splice(fromIdx, 1);
            ordered.splice(toIdx, 0, moved);

            for (let i = 0; i < ordered.length; i++) {
                await api.updateStep({ id: ordered[i].id, sort_order: i });
            }
            await loadPaths();
        } catch (e) {
            setError(`Reorder failed: ${e}`);
        }
        resetDrag();
    }

    function resetDrag() {
        dragPathIdx = null;
        dragStepIdx = null;
        dragOverStepIdx = null;
    }

    // ── Helpers ──
    function findStep(id: string): EnrichedStep | undefined {
        for (const p of paths)
            for (const s of p.steps) if (s.entity_id === id) return s;
        return undefined;
    }
</script>

<div class="vectors-page">
    <div class="page-header"><h2>⚔️ Attack Vectors</h2></div>

    <!-- Goal selector bar -->
    <div class="goal-bar">
        <div class="goal-chips">
            {#each goalList as g (g.id)}
                <button
                    class="chip"
                    class:active={selectedGoalId === g.id}
                    on:click={() => selectGoal(g)}
                >
                    🎯 {g.name}
                </button>
            {/each}
        </div>
        <button
            class="add-circle add-circle-lg"
            on:click={() => (showAddGoalDialog = true)}
            title="Add Goal">+</button
        >
    </div>

    {#if loading}
        <div class="loading-msg">Loading attack vectors…</div>
    {:else if !selectedGoalId}
        <div class="empty-state">
            <div class="empty-icon">⚔️</div>
            <p>
                Select a goal or click <strong>+</strong> to create one, then add
                attack vectors.
            </p>
        </div>
    {:else}
        <!-- Summary -->
        <div class="summary-bar">
            <span><strong>Goal:</strong> {selectedGoal?.name ?? ""}</span>
            <span class="sep">|</span>
            <span><strong>Vectors:</strong> {paths.length}</span>
            <button
                class="btn btn-pri btn-sm"
                on:click={() => (showAddVectorDialog = true)}
                >+ Add Vector</button
            >
            <button
                class="btn btn-sec btn-sm"
                on:click={openImportDialog}
                disabled={paths.length === 0}>📥 Import Step</button
            >
            <button
                class="btn btn-sm btn-del"
                on:click={() => {
                    if (selectedGoal)
                        deleteTarget = {
                            id: selectedGoal.id,
                            name: selectedGoal.name,
                            type: "goal",
                        };
                }}>🗑 Delete Goal</button
            >
        </div>

        {#if paths.length === 0}
            <div class="empty-state">
                <p>
                    No attack vectors found for this goal. Click <strong
                        >+ Add Vector</strong
                    > to create one.
                </p>
            </div>
        {/if}

        <!-- One card per attack path -->
        {#each paths as path, pIdx (path.path_id)}
            <div class="path-card">
                <div class="path-header">
                    <span class="path-id">{path.path_id}</span>
                    <span
                        class="prob-badge {getSeverityLabel(
                            path.cost_probability,
                        ).toLowerCase()}"
                    >
                        P(cost): {formatProbability(path.cost_probability)}
                    </span>
                    <span
                        class="prob-badge {getSeverityLabel(
                            path.overall_probability,
                        ).toLowerCase()}"
                    >
                        P(overall): {formatProbability(
                            path.overall_probability,
                        )}
                    </span>
                    {#if !path.is_realistic}
                        <span class="tag tag-warn">unrealistic</span>
                    {/if}
                    <span class="path-meta">
                        🔑 max access {path.max_access_level} · 🎓 max skill {path.max_skill_level}
                    </span>
                    <button
                        class="btn btn-sm btn-sec"
                        on:click={() => {
                            extendPathId = path.path_id;
                        }}>+ Extend</button
                    >
                </div>

                <div class="path-scroll">
                    <div class="path-chain" role="list">
                        {#each path.steps as step, sIdx (step.entity_id + "-" + sIdx)}
                            <!-- Insert-before button -->
                            {#if sIdx === 0}
                                <button
                                    class="add-circle add-circle-md inline-add"
                                    on:click={() => {
                                        insertBeforeStepId = step.entity_id;
                                        insertBeforePathIdx = pIdx;
                                        insertStepName = "";
                                        insertStepDesc = "";
                                    }}
                                    title="Insert step before '{step.name}'"
                                    >+</button
                                >
                                <div class="arrow-connector">
                                    <svg
                                        width="40"
                                        height="20"
                                        viewBox="0 0 40 20"
                                        ><line
                                            x1="0"
                                            y1="10"
                                            x2="30"
                                            y2="10"
                                            stroke="#1a202c"
                                            stroke-width="2"
                                        /><polygon
                                            points="30,5 40,10 30,15"
                                            fill="#1a202c"
                                        /></svg
                                    >
                                </div>
                            {/if}
                            {#if sIdx > 0}
                                <button
                                    class="add-circle add-circle-md inline-add"
                                    on:click={() => {
                                        insertBeforeStepId = step.entity_id;
                                        insertBeforePathIdx = pIdx;
                                        insertStepName = "";
                                        insertStepDesc = "";
                                    }}
                                    title="Insert step before '{step.name}'"
                                    >+</button
                                >
                                <div class="arrow-connector">
                                    <svg
                                        width="40"
                                        height="20"
                                        viewBox="0 0 40 20"
                                        ><line
                                            x1="0"
                                            y1="10"
                                            x2="30"
                                            y2="10"
                                            stroke="#1a202c"
                                            stroke-width="2"
                                        /><polygon
                                            points="30,5 40,10 30,15"
                                            fill="#1a202c"
                                        /></svg
                                    >
                                </div>
                            {/if}

                            <div
                                class="node-column"
                                class:dragging={dragPathIdx === pIdx &&
                                    dragStepIdx === sIdx}
                                class:drag-over={dragPathIdx === pIdx &&
                                    dragOverStepIdx === sIdx &&
                                    dragStepIdx !== sIdx}
                                draggable="true"
                                on:dragstart={() => onDragStart(pIdx, sIdx)}
                                on:dragover={(e) => onDragOver(e, sIdx)}
                                on:drop={(e) => onDrop(e, pIdx, sIdx)}
                                on:dragend={resetDrag}
                                role="listitem"
                            >
                                <!-- Weaknesses ABOVE -->
                                <div class="attachments att-top">
                                    {#each step.weaknesses as wk (wk.id)}
                                        <div class="att-card att-weakness">
                                            <span class="att-name"
                                                >⚠️ {wk.name}</span
                                            >
                                            <span class="att-meta"
                                                >Sev: {wk.severity}</span
                                            >
                                            <button
                                                class="att-del"
                                                on:click|stopPropagation={() =>
                                                    (deleteTarget = {
                                                        id: wk.id,
                                                        name: wk.name,
                                                        type: "weakness",
                                                    })}
                                                title="Remove">✕</button
                                            >
                                        </div>
                                    {/each}
                                    {#if step.weaknesses.length > 0}<div
                                            class="dashed-conn"
                                        ></div>{/if}
                                    <button
                                        class="add-circle add-circle-sm"
                                        on:click|stopPropagation={() => {
                                            addingWKForId = step.entity_id;
                                            addingWKForType = step.entity_type;
                                            addingCMForId = "";
                                        }}
                                        title="Add Weakness">+</button
                                    >
                                </div>

                                <!-- Node box -->
                                <div
                                    class="node-box step-box"
                                    class:selected={selectedStepId ===
                                        step.entity_id}
                                    class:substep-box={step.entity_type ===
                                        "substep"}
                                    on:click={() => {
                                        selectedStepId = step.entity_id;
                                        editingId = "";
                                    }}
                                >
                                    <div class="nb-type">
                                        {step.entity_type.toUpperCase()}
                                    </div>
                                    <div class="nb-name">{step.name}</div>
                                    <div class="nb-meta">
                                        🔑 {accessLabels[
                                            (step.access_level || 1) - 1
                                        ] ?? "?"} · 🎓 {skillLabels[
                                            (step.skill_level || 1) - 1
                                        ] ?? "?"}
                                    </div>
                                    <div class="nb-prob">
                                        P: {formatProbability(
                                            step.cost_probability,
                                        )}
                                    </div>
                                </div>

                                <!-- Countermeasures BELOW as defense nodes -->
                                <div class="attachments att-bottom">
                                    <button
                                        class="add-circle add-circle-sm"
                                        on:click|stopPropagation={() => {
                                            addingCMForId = step.entity_id;
                                            addingCMForType = step.entity_type;
                                            addingWKForId = "";
                                        }}
                                        title="Add Countermeasure">+</button
                                    >
                                    {#each step.countermeasures as cm (cm.id)}
                                        <div class="dashed-conn-defense"></div>
                                        <div class="node-box cm-box">
                                            <div class="nb-type">DEFENSE</div>
                                            <div class="nb-name">
                                                🛡️ {cm.name}
                                            </div>
                                            <div class="nb-meta">
                                                Eff: {cm.effectiveness}
                                            </div>
                                            <button
                                                class="att-del"
                                                on:click|stopPropagation={() =>
                                                    (deleteTarget = {
                                                        id: cm.id,
                                                        name: cm.name,
                                                        type: "countermeasure",
                                                    })}
                                                title="Remove">✕</button
                                            >
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/each}

                        <!-- Inline add step button -->
                        <div class="arrow-connector">
                            <svg width="40" height="20" viewBox="0 0 40 20"
                                ><line
                                    x1="0"
                                    y1="10"
                                    x2="30"
                                    y2="10"
                                    stroke="#1a202c"
                                    stroke-width="2"
                                /><polygon
                                    points="30,5 40,10 30,15"
                                    fill="#1a202c"
                                /></svg
                            >
                        </div>
                        <button
                            class="add-circle add-circle-lg inline-add"
                            on:click={() => {
                                extendPathId = path.path_id;
                                extendStepName = "";
                                extendStepDesc = "";
                            }}
                            title="Add step to this path">+</button
                        >

                        <!-- Goal terminator -->
                        <div class="arrow-connector">
                            <svg width="40" height="20" viewBox="0 0 40 20"
                                ><line
                                    x1="0"
                                    y1="10"
                                    x2="30"
                                    y2="10"
                                    stroke="#1a202c"
                                    stroke-width="2"
                                /><polygon
                                    points="30,5 40,10 30,15"
                                    fill="#1a202c"
                                /></svg
                            >
                        </div>
                        <div class="node-box goal-box">
                            <div class="nb-type">GOAL</div>
                            <div class="nb-name">{path.goal_name}</div>
                        </div>
                    </div>
                </div>
            </div>
        {/each}

        <!-- Detail panel for selected step -->
        {#if selectedStepId}
            {@const sel = findStep(selectedStepId)}
            {#if sel}
                <div class="detail-panel">
                    {#if editingId === sel.entity_id}
                        <div class="edit-section">
                            <h4>Edit {sel.entity_type}</h4>
                            <div class="fg">
                                <label>Name</label><input
                                    class="inp"
                                    bind:value={editName}
                                />
                            </div>
                            <div class="fg">
                                <label>Description</label><textarea
                                    class="inp"
                                    rows="2"
                                    bind:value={editDesc}
                                ></textarea>
                            </div>
                            <div class="fg">
                                <label
                                    >Access: {editAccess} ({accessLabels[
                                        editAccess - 1
                                    ]})</label
                                ><input
                                    type="range"
                                    min="1"
                                    max="5"
                                    bind:value={editAccess}
                                />
                            </div>
                            <div class="fg">
                                <label
                                    >Skill: {editSkill} ({skillLabels[
                                        editSkill - 1
                                    ]})</label
                                ><input
                                    type="range"
                                    min="1"
                                    max="5"
                                    bind:value={editSkill}
                                />
                            </div>
                            <div class="fa">
                                <button
                                    class="btn btn-sec"
                                    on:click={() => (editingId = "")}
                                    >Cancel</button
                                ><button class="btn btn-pri" on:click={saveEdit}
                                    >Save</button
                                >
                            </div>
                        </div>
                    {:else}
                        <div class="detail-row">
                            <span class="type-badge">{sel.entity_type}</span>
                            <strong class="detail-name">{sel.name}</strong>
                            {#if sel.entity_type === "step"}
                                <button
                                    class="btn btn-sm btn-sec"
                                    on:click={() => startEdit(sel)}
                                    >✏️ Edit</button
                                >
                                <button
                                    class="btn btn-sm btn-del"
                                    on:click={() =>
                                        (deleteTarget = {
                                            id: sel.entity_id,
                                            name: sel.name,
                                            type: sel.entity_type,
                                        })}>🗑 Delete</button
                                >
                            {/if}
                        </div>
                        <div class="detail-tags">
                            <span
                                >🔑 Access: {sel.access_level} ({accessLabels[
                                    (sel.access_level || 1) - 1
                                ]})</span
                            >
                            <span
                                >🎓 Skill: {sel.skill_level} ({skillLabels[
                                    (sel.skill_level || 1) - 1
                                ]})</span
                            >
                            <span
                                >P(cost): {formatProbability(
                                    sel.cost_probability,
                                )}</span
                            >
                        </div>
                        <div class="detail-counts">
                            <strong>⚠️ Weaknesses:</strong>
                            {sel.weaknesses.length}
                            &nbsp;|&nbsp;
                            <strong>🛡️ Countermeasures:</strong>
                            {sel.countermeasures.length}
                        </div>
                    {/if}
                </div>
            {/if}
        {/if}
    {/if}
</div>

<!-- ═══ Dialogs ═══ -->

{#if showAddGoalDialog}
    <div
        class="overlay"
        on:click={() => (showAddGoalDialog = false)}
        role="dialog"
    >
        <div class="dlg" on:click|stopPropagation role="document">
            <h3>New Goal</h3>
            <div class="fg">
                <label>Goal Name *</label><input
                    class="inp"
                    bind:value={newGoalName}
                    placeholder="e.g. Compromise SCADA"
                />
            </div>
            <div class="da">
                <button
                    class="btn btn-sec"
                    on:click={() => (showAddGoalDialog = false)}>Cancel</button
                ><button
                    class="btn btn-pri"
                    on:click={createNewGoal}
                    disabled={!newGoalName.trim()}>Create</button
                >
            </div>
        </div>
    </div>
{/if}

{#if showAddVectorDialog}
    <div
        class="overlay"
        on:click={() => (showAddVectorDialog = false)}
        role="dialog"
    >
        <div class="dlg" on:click|stopPropagation role="document">
            <h3>New Attack Vector</h3>
            <p class="dlg-hint">
                Creates a new alternative path (OR) to reach the goal.
            </p>
            <div class="fg">
                <label>First Step Name *</label><input
                    class="inp"
                    bind:value={newVecStepName}
                    placeholder="e.g. Gain network access"
                />
            </div>
            <div class="fg">
                <label>Description</label><textarea
                    class="inp"
                    rows="2"
                    bind:value={newVecStepDesc}
                ></textarea>
            </div>
            <div class="da">
                <button
                    class="btn btn-sec"
                    on:click={() => (showAddVectorDialog = false)}
                    >Cancel</button
                ><button
                    class="btn btn-pri"
                    on:click={addNewVector}
                    disabled={!newVecStepName.trim()}>Create Vector</button
                >
            </div>
        </div>
    </div>
{/if}

{#if extendPathId}
    <div class="overlay" on:click={() => (extendPathId = "")} role="dialog">
        <div class="dlg" on:click|stopPropagation role="document">
            <h3>Extend Vector</h3>
            <p class="dlg-hint">
                Adds a sequential AND step to the end of this path.
            </p>
            <div class="fg">
                <label>Step Name *</label><input
                    class="inp"
                    bind:value={extendStepName}
                    placeholder="e.g. Escalate privileges"
                />
            </div>
            <div class="fg">
                <label>Description</label><textarea
                    class="inp"
                    rows="2"
                    bind:value={extendStepDesc}
                ></textarea>
            </div>
            <div class="da">
                <button class="btn btn-sec" on:click={() => (extendPathId = "")}
                    >Cancel</button
                ><button
                    class="btn btn-pri"
                    on:click={extendPath}
                    disabled={!extendStepName.trim()}>Add Step</button
                >
            </div>
        </div>
    </div>
{/if}

{#if insertBeforeStepId}
    <div
        class="overlay"
        on:click={() => (insertBeforeStepId = "")}
        role="dialog"
    >
        <div class="dlg" on:click|stopPropagation role="document">
            <h3>Insert Step</h3>
            <p class="dlg-hint">
                Inserts a new step before the selected step in the chain.
            </p>
            <div class="fg">
                <label>Step Name *</label><input
                    class="inp"
                    bind:value={insertStepName}
                    placeholder="e.g. Scan network"
                />
            </div>
            <div class="fg">
                <label>Description</label><textarea
                    class="inp"
                    rows="2"
                    bind:value={insertStepDesc}
                ></textarea>
            </div>
            <div class="da">
                <button
                    class="btn btn-sec"
                    on:click={() => (insertBeforeStepId = "")}>Cancel</button
                >
                <button
                    class="btn btn-pri"
                    on:click={insertBeforeStep}
                    disabled={!insertStepName.trim()}>Insert</button
                >
            </div>
        </div>
    </div>
{/if}

{#if addingWKForId}
    <div class="overlay" on:click={() => (addingWKForId = "")} role="dialog">
        <div class="dlg" on:click|stopPropagation role="document">
            <h3>Add Weakness</h3>
            <div class="fg">
                <label>Name *</label><input
                    class="inp"
                    bind:value={newWKName}
                    placeholder="Weakness name"
                />
            </div>
            <div class="fg">
                <label>Description</label><input
                    class="inp"
                    bind:value={newWKDesc}
                    placeholder="Description"
                />
            </div>
            <div class="fg">
                <label>Severity: {newWKSeverity}</label><input
                    type="range"
                    min="1"
                    max="5"
                    bind:value={newWKSeverity}
                />
            </div>
            <div class="da">
                <button
                    class="btn btn-sec"
                    on:click={() => (addingWKForId = "")}>Cancel</button
                ><button
                    class="btn btn-pri"
                    on:click={addWeakness}
                    disabled={!newWKName.trim()}>Add</button
                >
            </div>
        </div>
    </div>
{/if}

{#if addingCMForId}
    <div class="overlay" on:click={() => (addingCMForId = "")} role="dialog">
        <div class="dlg" on:click|stopPropagation role="document">
            <h3>Add Countermeasure</h3>
            <div class="fg">
                <label>Name *</label><input
                    class="inp"
                    bind:value={newCMName}
                    placeholder="Countermeasure name"
                />
            </div>
            <div class="fg">
                <label>Description</label><input
                    class="inp"
                    bind:value={newCMDesc}
                    placeholder="Description"
                />
            </div>
            <div class="fg">
                <label>Effectiveness: {newCMEffectiveness}</label><input
                    type="range"
                    min="1"
                    max="5"
                    bind:value={newCMEffectiveness}
                />
            </div>
            <div class="fg">
                <label>Cost: {newCMCost}</label><input
                    type="range"
                    min="1"
                    max="5"
                    bind:value={newCMCost}
                />
            </div>
            <div class="da">
                <button
                    class="btn btn-sec"
                    on:click={() => (addingCMForId = "")}>Cancel</button
                ><button
                    class="btn btn-pri"
                    on:click={addCountermeasure}
                    disabled={!newCMName.trim()}>Add</button
                >
            </div>
        </div>
    </div>
{/if}

{#if showImportDialog}
    <div
        class="overlay"
        on:click={() => (showImportDialog = false)}
        role="dialog"
    >
        <div class="dlg dlg-wide" on:click|stopPropagation role="document">
            <h3>📥 Import Step from Path</h3>
            <p class="dlg-hint">
                Select a step to import as a new vector (creates an OR
                connection at the goal level).
            </p>
            {#if importableSteps.length === 0}
                <p class="empty-import">No steps available to import.</p>
            {:else}
                <div class="import-list">
                    {#each importableSteps as entry (entry.step.entity_id)}
                        <button
                            class="import-row"
                            on:click={() => importStep(entry)}
                        >
                            <span class="import-path-tag">{entry.pathId}</span>
                            <span class="import-step-name"
                                >{entry.step.name}</span
                            >
                            <span class="import-meta"
                                >🔑 {accessLabels[
                                    (entry.step.access_level || 1) - 1
                                ]} · 🎓 {skillLabels[
                                    (entry.step.skill_level || 1) - 1
                                ]}</span
                            >
                        </button>
                    {/each}
                </div>
            {/if}
            <div class="da">
                <button
                    class="btn btn-sec"
                    on:click={() => (showImportDialog = false)}>Cancel</button
                >
            </div>
        </div>
    </div>
{/if}

<ConfirmDialog
    open={deleteTarget !== null}
    title="Delete {deleteTarget?.type ?? ''}"
    message="Delete '{deleteTarget?.name}'? This may affect other views."
    confirmLabel="Delete"
    danger
    on:confirm={confirmDelete}
    on:cancel={() => (deleteTarget = null)}
/>

<style>
    .vectors-page {
        max-width: 1300px;
        margin: 0 auto;
    }
    .page-header {
        margin-bottom: 12px;
    }
    .page-header h2 {
        margin: 0;
        font-size: 1.15rem;
    }

    /* ── Goal bar ── */
    .goal-bar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 14px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin-bottom: 12px;
        flex-wrap: wrap;
    }
    .goal-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        flex: 1;
    }
    .chip {
        border: 1px solid #e2e8f0;
        background: white;
        padding: 5px 12px;
        border-radius: 18px;
        cursor: pointer;
        font-size: 0.8rem;
        transition: all 0.15s;
    }
    .chip:hover {
        background: #edf2f7;
    }
    .chip.active {
        background: #1a365d;
        color: white;
        border-color: #1a365d;
    }

    .add-circle {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 2px dashed #a0aec0;
        background: rgba(160, 174, 192, 0.12);
        color: #718096;
        font-size: 1.1rem;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
        flex-shrink: 0;
        padding: 0;
        line-height: 1;
    }
    .add-circle:hover {
        background: rgba(160, 174, 192, 0.3);
        border-color: #4a5568;
        color: #2d3748;
    }
    .add-circle-lg {
        width: 36px;
        height: 36px;
        font-size: 1.3rem;
    }
    .add-circle-md {
        width: 26px;
        height: 26px;
        font-size: 0.9rem;
        border-width: 1.5px;
    }
    .add-circle-sm {
        width: 22px;
        height: 22px;
        font-size: 0.8rem;
        border-width: 1.5px;
    }

    .empty-state {
        text-align: center;
        padding: 50px 16px;
        color: #718096;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin-bottom: 12px;
    }
    .empty-icon {
        font-size: 2.2rem;
        margin-bottom: 6px;
    }
    .loading-msg {
        text-align: center;
        padding: 30px;
        color: #718096;
    }

    /* ── Summary bar ── */
    .summary-bar {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 14px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin-bottom: 12px;
        font-size: 0.82rem;
        flex-wrap: wrap;
    }
    .sep {
        color: #cbd5e0;
    }

    /* ── Path card ── */
    .path-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 12px 14px;
        margin-bottom: 12px;
    }
    .path-header {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 8px;
    }
    .path-id {
        font-weight: 700;
        font-size: 0.78rem;
        color: #4a5568;
        text-transform: uppercase;
    }
    .path-meta {
        font-size: 0.7rem;
        color: #718096;
    }
    .tag {
        font-size: 0.65rem;
        padding: 1px 6px;
        border-radius: 6px;
        font-weight: 600;
    }
    .tag-warn {
        background: #fed7d7;
        color: #742a2a;
    }

    .prob-badge {
        font-size: 0.68rem;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 8px;
        text-transform: uppercase;
    }
    .low {
        background: #c6f6d5;
        color: #22543d;
    }
    .medium {
        background: #fefcbf;
        color: #744210;
    }
    .high {
        background: #fed7d7;
        color: #742a2a;
    }
    .critical {
        background: #e53e3e;
        color: white;
    }

    .path-scroll {
        overflow-x: auto;
        padding: 6px 0;
    }
    .path-chain {
        display: flex;
        align-items: center;
        min-height: 180px;
        padding: 20px 4px;
    }

    .arrow-connector {
        flex-shrink: 0;
        display: flex;
        align-items: center;
    }

    /* ── Node column ── */
    .node-column {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        flex-shrink: 0;
        min-width: 120px;
        transition:
            opacity 0.15s,
            transform 0.15s;
        cursor: grab;
    }
    .node-column:active {
        cursor: grabbing;
    }
    .node-column.dragging {
        opacity: 0.3;
    }
    .node-column.drag-over {
        transform: scale(1.04);
        outline: 2px dashed #4299e1;
        outline-offset: 4px;
        border-radius: 6px;
    }

    .node-box {
        border: 2px solid #cbd5e0;
        border-radius: 8px;
        padding: 8px 12px;
        min-width: 110px;
        max-width: 190px;
        text-align: center;
        cursor: pointer;
        background: white;
        transition: all 0.12s;
    }
    .node-box:hover {
        border-color: #4a5568;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.07);
    }
    .node-box.selected {
        border-color: #3182ce;
        box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.22);
    }
    .step-box {
        border-color: #fc8181;
        background: #fff5f5;
    }
    .step-box:hover {
        border-color: #e53e3e;
    }
    .substep-box {
        border-color: #f6ad55;
        background: #fffaf0;
    }
    .substep-box:hover {
        border-color: #dd6b20;
    }
    .goal-box {
        border-color: #1a365d;
        background: #ebf8ff;
        border-width: 3px;
        cursor: default;
    }
    .cm-box {
        border: 2px dashed #38a169;
        background: #f0fff4;
        position: relative;
        min-width: 100px;
        max-width: 170px;
    }
    .cm-box:hover {
        border-color: #276749;
    }
    .cm-box .nb-type {
        color: #276749;
    }
    .dashed-conn-defense {
        width: 0;
        border-left: 2px dashed #38a169;
        height: 12px;
    }

    .nb-type {
        font-size: 0.5rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: #718096;
        margin-bottom: 1px;
    }
    .goal-box .nb-type {
        color: #1a365d;
    }
    .step-box .nb-type {
        color: #c53030;
    }
    .nb-name {
        font-weight: 700;
        font-size: 0.78rem;
        margin-bottom: 3px;
        word-break: break-word;
    }
    .nb-meta {
        font-size: 0.6rem;
        color: #718096;
        margin-bottom: 1px;
    }
    .nb-prob {
        font-size: 0.65rem;
        font-weight: 600;
        color: #4a5568;
    }

    /* ── Attachments ── */
    .attachments {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
        min-height: 28px;
    }
    .att-top {
        flex-direction: column-reverse;
    }
    .att-card {
        border: 1px solid #e2e8f0;
        border-radius: 5px;
        padding: 3px 6px;
        font-size: 0.65rem;
        background: white;
        text-align: center;
        position: relative;
        max-width: 150px;
        display: flex;
        flex-direction: column;
        gap: 0;
    }
    .att-weakness {
        border-color: #fbd38d;
        background: #fffff0;
    }
    .att-cm {
        border-color: #9ae6b4;
        background: #f0fff4;
    }
    .att-name {
        font-weight: 600;
        font-size: 0.63rem;
    }
    .att-meta {
        font-size: 0.55rem;
        color: #718096;
    }
    .att-del {
        position: absolute;
        top: -5px;
        right: -5px;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 1px solid #e2e8f0;
        background: white;
        font-size: 0.5rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #e53e3e;
        padding: 0;
        line-height: 1;
    }
    .att-del:hover {
        background: #fed7d7;
    }
    .dashed-conn {
        width: 0;
        border-left: 2px dashed #1a202c;
        height: 10px;
    }

    /* ── Detail panel ── */
    .detail-panel {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 14px;
        margin-bottom: 12px;
    }
    .detail-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
    }
    .type-badge {
        font-size: 0.58rem;
        text-transform: uppercase;
        background: #edf2f7;
        padding: 2px 6px;
        border-radius: 6px;
        font-weight: 600;
    }
    .detail-name {
        font-size: 0.9rem;
    }
    .detail-tags {
        display: flex;
        gap: 12px;
        font-size: 0.75rem;
        color: #4a5568;
        margin: 6px 0;
        flex-wrap: wrap;
    }
    .detail-counts {
        font-size: 0.75rem;
        color: #718096;
        margin-top: 4px;
    }

    .edit-section h4 {
        margin: 0 0 8px;
        font-size: 0.9rem;
    }
    .fg {
        margin-bottom: 8px;
    }
    .fg label {
        display: block;
        font-size: 0.78rem;
        font-weight: 600;
        margin-bottom: 3px;
    }
    .inp {
        width: 100%;
        border: 1px solid #e2e8f0;
        border-radius: 4px;
        padding: 6px 10px;
        font-size: 0.82rem;
        font-family: inherit;
        box-sizing: border-box;
    }
    .fa,
    .da {
        display: flex;
        gap: 6px;
        justify-content: flex-end;
        margin-top: 8px;
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
    .dlg {
        background: white;
        border-radius: 10px;
        padding: 20px;
        max-width: 420px;
        width: 90%;
    }
    .dlg h3 {
        margin: 0 0 10px;
        font-size: 0.95rem;
    }
    .dlg-hint {
        font-size: 0.78rem;
        color: #718096;
        margin: -6px 0 12px;
    }

    .btn {
        border: none;
        border-radius: 4px;
        padding: 6px 14px;
        cursor: pointer;
        font-size: 0.8rem;
        font-weight: 500;
    }
    .btn-pri {
        background: #1a365d;
        color: white;
    }
    .btn-sec {
        background: #edf2f7;
        color: #2d3748;
        border: 1px solid #e2e8f0;
    }
    .btn-del {
        background: #fff5f5;
        color: #c53030;
        border: 1px solid #feb2b2;
    }
    .btn-sm {
        padding: 4px 10px;
        font-size: 0.72rem;
    }
    .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* ── Import dialog ── */
    .dlg-wide {
        max-width: 520px;
    }
    .import-list {
        max-height: 300px;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 10px;
    }
    .import-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        background: white;
        cursor: pointer;
        text-align: left;
        width: 100%;
        font-family: inherit;
        font-size: 0.8rem;
        transition: all 0.12s;
    }
    .import-row:hover {
        background: #ebf8ff;
        border-color: #3182ce;
    }
    .import-path-tag {
        font-size: 0.6rem;
        font-weight: 700;
        color: #4a5568;
        text-transform: uppercase;
        background: #edf2f7;
        padding: 2px 6px;
        border-radius: 4px;
        flex-shrink: 0;
    }
    .import-step-name {
        font-weight: 600;
        flex: 1;
    }
    .import-meta {
        font-size: 0.65rem;
        color: #718096;
        flex-shrink: 0;
    }
    .empty-import {
        color: #718096;
        font-size: 0.82rem;
        text-align: center;
        padding: 20px;
    }

    /* ── Inline add ── */
    .inline-add {
        flex-shrink: 0;
    }
</style>
