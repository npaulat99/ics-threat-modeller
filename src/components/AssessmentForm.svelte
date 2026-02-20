<script lang="ts">
  import type { Assessment, UpsertAssessment } from '$lib/types';
  import { DEFAULT_FACTORS } from '$lib/types';
  import { calculateCostValue, costToProbability, formatProbability, getSeverityColor } from '$lib/calculations';
  import CostFactorInput from './CostFactorInput.svelte';

  export let stepId: string;
  export let assessments: Assessment[] = [];
  export let factorWeights: Record<string, number> = {};
  export let onSave: (data: UpsertAssessment) => Promise<void> = async () => {};
  export let readonly = false;

  // Build a map of current values.
  $: assessmentMap = Object.fromEntries(
    assessments.map((a) => [a.factor_name, a])
  );

  $: result = calculateCostValue(assessments, factorWeights);
  $: probability = costToProbability(result.costValue);
  $: severityClass = getSeverityColor(probability);

  async function handleFactorChange(factorName: string, value: number, rationale: string) {
    await onSave({
      step_id: stepId,
      factor_name: factorName,
      factor_value: value,
      rationale,
    });
  }
</script>

<div class="assessment-form">
  <div class="form-header">
    <h3>Cost Factor Assessment</h3>
    <div class="probability-display {severityClass}">
      <span class="prob-label">P(success)</span>
      <span class="prob-value">{formatProbability(probability)}</span>
    </div>
  </div>

  <div class="cost-display">
    <span class="cost-label">Cost Value C(s):</span>
    <span class="cost-value">{result.costValue.toFixed(2)} / 10</span>
  </div>

  <div class="factors-grid">
    {#each DEFAULT_FACTORS as factor}
      <CostFactorInput
        name={factor}
        value={assessmentMap[factor]?.factor_value ?? 0}
        rationale={assessmentMap[factor]?.rationale ?? ''}
        weight={factorWeights[factor] ?? 0.2}
        {readonly}
        on:change={(e) => handleFactorChange(factor, e.detail.value, e.detail.rationale)}
      />
    {/each}
  </div>

  {#if result.contributions.length > 0}
    <div class="contributions">
      <h4>Factor Contributions</h4>
      <table>
        <thead>
          <tr>
            <th>Factor</th>
            <th>Raw</th>
            <th>Weight</th>
            <th>Weighted</th>
          </tr>
        </thead>
        <tbody>
          {#each result.contributions as c}
            <tr>
              <td>{c.factor_name}</td>
              <td>{c.raw_value}</td>
              <td>{(c.weight * 100).toFixed(0)}%</td>
              <td>{c.weighted_value.toFixed(2)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .assessment-form {
    background: white;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    padding: 20px;
  }

  .form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .form-header h3 {
    margin: 0;
    font-size: 1rem;
  }

  .probability-display {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 20px;
    font-weight: 600;
  }

  .prob-label {
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .prob-value {
    font-size: 1.1rem;
  }

  .cost-display {
    margin-bottom: 16px;
    font-size: 0.9rem;
    color: var(--color-text-muted, #718096);
  }

  .cost-value {
    font-weight: 600;
    color: var(--color-text, #2d3748);
  }

  .factors-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 12px;
    margin-bottom: 20px;
  }

  .contributions {
    margin-top: 16px;
  }

  .contributions h4 {
    margin: 0 0 8px;
    font-size: 0.85rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }

  th, td {
    padding: 6px 10px;
    text-align: left;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
  }

  th {
    font-weight: 600;
    color: var(--color-text-muted, #718096);
  }
</style>
