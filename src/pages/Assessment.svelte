<script lang="ts">
  import type { Goal, Assessment, AttackPath, CreateAssessment } from '$lib/types';
  import { currentProject, goals, setError, setSuccess } from '$lib/stores';
  import { parseFactorWeights, formatProbability } from '$lib/calculations';
  import * as api from '$lib/api';
  import AssessmentForm from '$components/AssessmentForm.svelte';
  import PathProbabilityTable from '$components/PathProbabilityTable.svelte';
  import { onMount } from 'svelte';

  let goalList: Goal[] = [];
  let selectedGoalId = '';
  let leafEntities: { id: string; name: string; entityType: string }[] = [];
  let selectedEntityId = '';
  let selectedEntityType = 'step';
  let stepAssessments: Assessment[] = [];
  let attackPaths: AttackPath[] = [];
  let aggregatedProb = 0;
  let selectedGoal: Goal | null = null;
  let factorWeights: Record<string, number> = {};

  $: if ($currentProject) {
    factorWeights = parseFactorWeights($currentProject.factor_weights);
  }

  onMount(loadGoals);

  async function loadGoals() {
    if (!$currentProject) return;
    try {
      goalList = await api.listGoals($currentProject.id);
      goals.set(goalList);
    } catch (e) { setError(`Load goals failed: ${e}`); }
  }

  async function selectGoal(g: Goal) {
    selectedGoalId = g.id;
    selectedGoal = g;
    selectedEntityId = '';
    stepAssessments = [];

    // Find assessable entities (leaf steps and substeps).
    leafEntities = [];
    await findAssessableEntities(g.id, 'goal');

    // Calculate paths.
    try {
      attackPaths = await api.calculateAttackPaths($currentProject!.id, g.id);
      aggregatedProb = await api.calculateAggregatedProbability($currentProject!.id, g.id, 'goal');
    } catch (e) {
      attackPaths = [];
      aggregatedProb = 0;
    }
  }

  async function findAssessableEntities(parentId: string, parentType: string) {
    const steps = await api.listSteps(parentId, parentType);
    for (const s of steps) {
      const childSteps = await api.listSteps(s.id, 'step');
      // Add substeps of this step.
      const substeps = await api.listSubsteps(s.id);
      for (const sub of substeps) {
        leafEntities.push({ id: sub.id, name: `${s.name} › ${sub.name}`, entityType: 'substep' });
        leafEntities = leafEntities;
      }
      if (childSteps.length === 0 && substeps.length === 0) {
        // Leaf step with no substeps — assess the step itself.
        leafEntities.push({ id: s.id, name: s.name, entityType: 'step' });
        leafEntities = leafEntities;
      } else if (childSteps.length > 0) {
        // Recurse into child steps.
        await findAssessableEntities(s.id, 'step');
      }
    }
  }

  async function selectEntity(entityId: string, entityType: string) {
    selectedEntityId = entityId;
    selectedEntityType = entityType;
    try {
      stepAssessments = await api.getAssessments(entityId, entityType);
    } catch (e) {
      stepAssessments = [];
      setError(`Load assessments failed: ${e}`);
    }
  }

  async function handleSaveAssessment(data: CreateAssessment) {
    try {
      await api.upsertAssessment(data);
      stepAssessments = await api.getAssessments(data.entity_id, data.entity_type);
      setSuccess('Assessment saved.');

      // Recalculate paths for the selected goal.
      if (selectedGoalId && $currentProject) {
        attackPaths = await api.calculateAttackPaths($currentProject.id, selectedGoalId);
        aggregatedProb = await api.calculateAggregatedProbability($currentProject.id, selectedGoalId, 'goal');
      }
    } catch (e) { setError(`Save failed: ${e}`); }
  }
</script>

<div class="assessment-page">
  <div class="page-header">
    <h2>Assessment</h2>
  </div>

  <div class="goal-selector">
    <h3>Select Goal</h3>
    <div class="goal-chips">
      {#each goalList as g (g.id)}
        <button
          class="chip"
          class:active={selectedGoalId === g.id}
          on:click={() => selectGoal(g)}
        >
          🎯 {g.name}
        </button>
      {:else}
        <p class="muted">No goals. Create goals in the Attack Tree view.</p>
      {/each}
    </div>
  </div>

  {#if selectedGoalId}
    <div class="two-col">
      <div class="step-selector">
        <h3>Assessable Entities ({leafEntities.length})</h3>
        <div class="step-list">
          {#each leafEntities as s (s.id)}
            <button
              class="step-item"
              class:active={selectedEntityId === s.id}
              on:click={() => selectEntity(s.id, s.entityType)}
            >
              {s.entityType === 'substep' ? '🔹' : '⚡'} {s.name}
            </button>
          {:else}
            <p class="muted">No assessable entities found under this goal.</p>
          {/each}
        </div>
      </div>

      <div class="assessment-area">
        {#if selectedEntityId}
          <AssessmentForm
            entityId={selectedEntityId}
            entityType={selectedEntityType}
            assessments={stepAssessments}
            {factorWeights}
            onSave={handleSaveAssessment}
          />
        {:else}
          <p class="muted">Select an entity to assess.</p>
        {/if}
      </div>
    </div>

    <PathProbabilityTable
      paths={attackPaths}
      goalName={selectedGoal?.name ?? ''}
      aggregatedProbability={aggregatedProb}
      aggregationType={(selectedGoal?.impact_category ?? 'or') === 'and' ? 'and' : 'or'}
    />
  {/if}
</div>

<style>
  .assessment-page { max-width: 1100px; margin: 0 auto; }
  .page-header { margin-bottom: 20px; }
  .page-header h2 { margin: 0; font-size: 1.2rem; }

  .goal-selector {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 20px;
  }

  .goal-selector h3 { margin: 0 0 10px; font-size: 0.9rem; }

  .goal-chips { display: flex; flex-wrap: wrap; gap: 8px; }

  .chip {
    border: 1px solid #e2e8f0;
    background: white;
    padding: 6px 14px;
    border-radius: 20px;
    cursor: pointer;
    font-size: 0.82rem;
    transition: all 0.15s;
  }

  .chip:hover { background: #edf2f7; }
  .chip.active { background: #1a365d; color: white; border-color: #1a365d; }

  .two-col {
    display: grid;
    grid-template-columns: 250px 1fr;
    gap: 20px;
    margin-bottom: 20px;
  }

  .step-selector {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 12px;
  }

  .step-selector h3 { margin: 0 0 10px; font-size: 0.85rem; }

  .step-list { display: flex; flex-direction: column; gap: 4px; }

  .step-item {
    border: none;
    background: none;
    padding: 6px 10px;
    text-align: left;
    cursor: pointer;
    border-radius: 4px;
    font-size: 0.82rem;
  }

  .step-item:hover { background: #edf2f7; }
  .step-item.active { background: #bee3f8; font-weight: 600; }

  .muted { color: #718096; font-size: 0.82rem; }
</style>
