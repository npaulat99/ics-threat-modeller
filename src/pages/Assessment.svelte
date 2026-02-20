<script lang="ts">
  import type { Goal, Assessment, AttackPath, UpsertAssessment } from '$lib/types';
  import { currentProject, goals, setError, setSuccess } from '$lib/stores';
  import { parseFactorWeights, aggregateProbabilities, formatProbability } from '$lib/calculations';
  import * as api from '$lib/api';
  import AssessmentForm from '$components/AssessmentForm.svelte';
  import PathProbabilityTable from '$components/PathProbabilityTable.svelte';
  import { onMount } from 'svelte';

  let goalList: Goal[] = [];
  let selectedGoalId = '';
  let leafSteps: { id: string; name: string }[] = [];
  let selectedStepId = '';
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
    selectedStepId = '';
    stepAssessments = [];

    // Find leaf steps.
    leafSteps = [];
    await findLeafSteps(g.id, 'goal');

    // Calculate paths.
    try {
      attackPaths = await api.calculateAttackPaths(g.id, $currentProject!.id);
      aggregatedProb = await api.calculateAggregatedProbability(g.id, $currentProject!.id);
    } catch (e) {
      attackPaths = [];
      aggregatedProb = 0;
    }
  }

  async function findLeafSteps(parentId: string, parentType: string) {
    const steps = await api.listSteps(parentId, parentType);
    for (const s of steps) {
      if (s.is_leaf) {
        leafSteps.push({ id: s.id, name: s.name });
        leafSteps = leafSteps; // trigger reactivity
      } else {
        await findLeafSteps(s.id, 'step');
      }
    }
  }

  async function selectStep(stepId: string) {
    selectedStepId = stepId;
    try {
      stepAssessments = await api.listAssessments(stepId);
    } catch (e) {
      stepAssessments = [];
      setError(`Load assessments failed: ${e}`);
    }
  }

  async function handleSaveAssessment(data: UpsertAssessment) {
    try {
      await api.upsertAssessment(data);
      stepAssessments = await api.listAssessments(data.step_id);
      setSuccess('Assessment saved.');

      // Recalculate paths for the selected goal.
      if (selectedGoalId && $currentProject) {
        attackPaths = await api.calculateAttackPaths(selectedGoalId, $currentProject.id);
        aggregatedProb = await api.calculateAggregatedProbability(selectedGoalId, $currentProject.id);
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
        <h3>Leaf Steps ({leafSteps.length})</h3>
        <div class="step-list">
          {#each leafSteps as s (s.id)}
            <button
              class="step-item"
              class:active={selectedStepId === s.id}
              on:click={() => selectStep(s.id)}
            >
              ⚡ {s.name}
            </button>
          {:else}
            <p class="muted">No leaf steps found under this goal.</p>
          {/each}
        </div>
      </div>

      <div class="assessment-area">
        {#if selectedStepId}
          <AssessmentForm
            stepId={selectedStepId}
            assessments={stepAssessments}
            {factorWeights}
            onSave={handleSaveAssessment}
          />
        {:else}
          <p class="muted">Select a leaf step to assess.</p>
        {/if}
      </div>
    </div>

    <PathProbabilityTable
      paths={attackPaths}
      goalName={selectedGoal?.name ?? ''}
      aggregatedProbability={aggregatedProb}
      aggregationType={(selectedGoal?.aggregation_type ?? 'or') === 'and' ? 'and' : 'or'}
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
