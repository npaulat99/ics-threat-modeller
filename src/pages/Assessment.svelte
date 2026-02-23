<script lang="ts">
  import type { Goal, Assessment, AttackPath, CreateAssessment } from '$lib/types';
  import { currentProject, goals, setError, setSuccess } from '$lib/stores';
  import { parseFactorWeights, formatProbability, getSeverityLabel } from '$lib/calculations';
  import * as api from '$lib/api';
  import AssessmentForm from '$components/AssessmentForm.svelte';
  import PathProbabilityTable from '$components/PathProbabilityTable.svelte';
  import { onMount } from 'svelte';

  const accessLabels = ['Public', 'Limited', 'Moderate', 'Privileged', 'Unrestricted'];
  const skillLabels = ['Novice', 'Beginner', 'Competent', 'Expert', 'Master'];

  let goalList: Goal[] = [];
  let selectedGoalId = '';
  let leafEntities: { id: string; name: string; entityType: string; accessLevel?: number; skillLevel?: number }[] = [];
  let selectedEntityId = '';
  let selectedEntityType = 'step';
  let stepAssessments: Assessment[] = [];
  let attackPaths: AttackPath[] = [];
  let aggregatedProb = 0;
  let selectedGoal: Goal | null = null;
  let factorWeights: Record<string, number> = {};

  // OWASP Impact factors per goal (stored locally since DB doesn't have impact columns yet)
  let impactScores: Record<string, {
    financial: number;
    reputation: number;
    compliance: number;
    safety: number;
    operational: number;
  }> = {};

  const impactLabels: Record<string, string[]> = {
    financial:   ['Negligible', 'Minor', 'Moderate', 'Major', 'Catastrophic'],
    reputation:  ['None', 'Minor', 'Noticeable', 'Significant', 'Devastating'],
    compliance:  ['None', 'Minor violation', 'Regulatory issue', 'Major breach', 'Criminal'],
    safety:      ['None', 'Minor injury', 'Serious injury', 'Life-threatening', 'Loss of life'],
    operational: ['None', 'Minor disruption', 'Partial outage', 'Major outage', 'Total shutdown'],
  };

  $: currentImpact = selectedGoalId ? (impactScores[selectedGoalId] ?? { financial: 1, reputation: 1, compliance: 1, safety: 1, operational: 1 }) : null;
  $: averageImpact = currentImpact ? ((currentImpact.financial + currentImpact.reputation + currentImpact.compliance + currentImpact.safety + currentImpact.operational) / 5) : 0;
  $: riskLevel = aggregatedProb > 0 && averageImpact > 0 ? (aggregatedProb * averageImpact / 5) : 0;

  function setImpact(factor: string, value: number) {
    if (!selectedGoalId) return;
    const current = impactScores[selectedGoalId] ?? { financial: 1, reputation: 1, compliance: 1, safety: 1, operational: 1 };
    impactScores[selectedGoalId] = { ...current, [factor]: value };
    impactScores = impactScores;
  }

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

  async function findAssessableEntities(parentId: string, parentType: string, prefix: string = '') {
    const steps = await api.listSteps(parentId, parentType);
    for (const s of steps) {
      const childSteps = await api.listSteps(s.id, 'step');
      const substeps = await api.listSubsteps(s.id);
      const stepLabel = prefix ? `${prefix} › ${s.name}` : s.name;

      // Add substeps of this step.
      for (const sub of substeps) {
        leafEntities.push({ id: sub.id, name: `${stepLabel} › ${sub.name}`, entityType: 'substep', accessLevel: sub.access_level, skillLevel: sub.skill_level });
        leafEntities = leafEntities;
      }

      if (childSteps.length === 0 && substeps.length === 0) {
        // Leaf step with no children — assess the step itself.
        leafEntities.push({ id: s.id, name: stepLabel, entityType: 'step', accessLevel: s.access_level, skillLevel: s.skill_level });
        leafEntities = leafEntities;
      }

      if (childSteps.length > 0) {
        // Recurse into child steps (chained steps with parent_type='step').
        await findAssessableEntities(s.id, 'step', stepLabel);
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
    <a href="#/project/settings" class="weights-link" title="Edit factor weights in project settings">⚖️ Factor Weights</a>
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
              <span class="step-name">{s.entityType === 'substep' ? '🔹' : '⚡'} {s.name}</span>
              {#if s.accessLevel || s.skillLevel}
                <span class="step-tags">
                  {#if s.accessLevel}<span class="tag access">🔑{accessLabels[s.accessLevel - 1]}</span>{/if}
                  {#if s.skillLevel}<span class="tag skill">🎓{skillLabels[s.skillLevel - 1]}</span>{/if}
                </span>
              {/if}
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

    <!-- OWASP Risk Rating Impact Assessment -->
    {#if currentImpact}
      <div class="impact-section">
        <h3>Impact Assessment (OWASP Risk Rating)</h3>
        <div class="impact-grid">
          {#each Object.entries(impactLabels) as [factor, labels]}
            <div class="impact-factor">
              <div class="impact-header">
                <span class="impact-name">{factor}</span>
                <span class="impact-value">{currentImpact[factor]}/5</span>
              </div>
              <div class="impact-buttons">
                {#each [1, 2, 3, 4, 5] as v}
                  <button
                    class="impact-btn"
                    class:active={currentImpact[factor] === v}
                    class:low={v <= 2}
                    class:mid={v === 3}
                    class:high={v >= 4}
                    on:click={() => setImpact(factor, v)}
                    title={labels[v - 1]}
                  >
                    {v}
                  </button>
                {/each}
              </div>
              <div class="impact-label">{labels[currentImpact[factor] - 1]}</div>
            </div>
          {/each}
        </div>
        <div class="risk-summary">
          <div class="risk-item">
            <span>Likelihood (P)</span>
            <span class="risk-val">{formatProbability(aggregatedProb)}</span>
          </div>
          <div class="risk-item">
            <span>Average Impact</span>
            <span class="risk-val">{averageImpact.toFixed(1)} / 5</span>
          </div>
          <div class="risk-item risk-total">
            <span>Risk Score</span>
            <span class="risk-val">{(riskLevel * 100).toFixed(0)}%</span>
          </div>
          <div class="risk-item">
            <span>Risk Level</span>
            <span class="risk-badge {getSeverityLabel(riskLevel).toLowerCase()}">{getSeverityLabel(riskLevel)}</span>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .assessment-page { max-width: 1100px; margin: 0 auto; }
  .page-header { margin-bottom: 20px; }
  .page-header { display: flex; justify-content: space-between; align-items: center; }
  .page-header h2 { margin: 0; font-size: 1.2rem; }
  .weights-link { font-size: 0.8rem; color: #4a5568; text-decoration: none; }
  .weights-link:hover { color: #1a365d; text-decoration: underline; }

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
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .step-item:hover { background: #edf2f7; }
  .step-item.active { background: #bee3f8; font-weight: 600; }

  .step-name { display: block; }

  .step-tags { display: flex; gap: 4px; flex-wrap: wrap; }

  .tag {
    font-size: 0.65rem;
    padding: 1px 5px;
    border-radius: 8px;
    font-weight: 600;
  }

  .tag.access { background: #e9d8fd; color: #553c9a; }
  .tag.skill { background: #bee3f8; color: #2a4365; }

  .muted { color: #718096; font-size: 0.82rem; }

  .impact-section {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
    margin-top: 20px;
  }

  .impact-section h3 { margin: 0 0 16px; font-size: 0.95rem; }

  .impact-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }

  .impact-factor {
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 10px;
    background: #f7fafc;
  }

  .impact-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .impact-name { font-weight: 600; font-size: 0.8rem; text-transform: capitalize; }
  .impact-value { font-size: 0.75rem; color: #718096; }

  .impact-buttons { display: flex; gap: 4px; margin-bottom: 4px; }

  .impact-btn {
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
    padding: 0;
  }

  .impact-btn:hover { border-color: #a0aec0; background: #edf2f7; }
  .impact-btn.active.low { background: #c6f6d5; border-color: #38a169; color: #22543d; }
  .impact-btn.active.mid { background: #fefcbf; border-color: #d69e2e; color: #744210; }
  .impact-btn.active.high { background: #fed7d7; border-color: #e53e3e; color: #742a2a; }

  .impact-label { font-size: 0.7rem; color: #718096; font-style: italic; }

  .risk-summary {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
    padding: 12px;
    background: #edf2f7;
    border-radius: 6px;
  }

  .risk-item { display: flex; flex-direction: column; gap: 2px; font-size: 0.8rem; }
  .risk-item span:first-child { color: #718096; font-size: 0.7rem; text-transform: uppercase; }
  .risk-val { font-weight: 700; font-size: 1rem; }
  .risk-total { border-left: 2px solid #cbd5e0; padding-left: 20px; }

  .risk-badge {
    padding: 2px 10px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  .risk-badge.low { background: #c6f6d5; color: #22543d; }
  .risk-badge.medium { background: #fefcbf; color: #744210; }
  .risk-badge.high { background: #fed7d7; color: #742a2a; }
  .risk-badge.critical { background: #e53e3e; color: white; }
</style>
