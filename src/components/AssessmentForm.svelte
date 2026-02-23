<script lang="ts">
  import type { Assessment, CreateAssessment } from '$lib/types';
  import { DEFAULT_FACTORS } from '$lib/types';
  import { calculateCostValue, costToProbability, formatProbability, getSeverityColor } from '$lib/calculations';
  import CostFactorInput from './CostFactorInput.svelte';

  export let entityId: string;
  export let entityType: string;
  export let assessments: Assessment[] = [];
  export let factorWeights: Record<string, number> = {};
  export let onSave: (data: CreateAssessment) => Promise<void> = async () => {};
  export let readonly = false;

  // The new model stores one Assessment row per entity with 7 named factor columns.
  $: currentAssessment = assessments.length > 0 ? assessments[0] : null;

  // Extract factor values from the assessment row into a map for the UI.
  $: factorValues = {
    time_effort: currentAssessment?.time_effort ?? null,
    prior_knowledge: currentAssessment?.prior_knowledge ?? null,
    exploitability: currentAssessment?.exploitability ?? null,
    window_of_opportunity: currentAssessment?.window_of_opportunity ?? null,
    detection_probability: currentAssessment?.detection_probability ?? null,
    preparation_effort: currentAssessment?.preparation_effort ?? null,
    abort_risk: currentAssessment?.abort_risk ?? null,
  } as Record<string, number | null>;

  $: rationaleMap = (() => {
    try {
      return currentAssessment?.rationale_json ? JSON.parse(currentAssessment.rationale_json) : {};
    } catch { return {}; }
  })();

  $: result = calculateCostValue(factorValues, factorWeights);
  $: probability = costToProbability(result.costValue);
  $: severityClass = getSeverityColor(probability);

  async function handleFactorChange(factorName: string, value: number, rationale: string) {
    // Build updated rationale JSON.
    const newRationale = { ...rationaleMap, [factorName]: rationale };
    // Build CreateAssessment with all current factor values + the changed one.
    const data: CreateAssessment = {
      entity_id: entityId,
      entity_type: entityType,
      time_effort: factorValues.time_effort ?? undefined,
      prior_knowledge: factorValues.prior_knowledge ?? undefined,
      exploitability: factorValues.exploitability ?? undefined,
      window_of_opportunity: factorValues.window_of_opportunity ?? undefined,
      detection_probability: factorValues.detection_probability ?? undefined,
      preparation_effort: factorValues.preparation_effort ?? undefined,
      abort_risk: factorValues.abort_risk ?? undefined,
      rationale_json: JSON.stringify(newRationale),
      [factorName]: value,
    };
    await onSave(data);
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
    <span class="cost-value">{result.costValue.toFixed(2)} / 5</span>
  </div>

  <div class="factors-grid">
    {#each DEFAULT_FACTORS as factor}
      <CostFactorInput
        name={factor}
        value={factorValues[factor] ?? 0}
        rationale={rationaleMap[factor] ?? ''}
        weight={factorWeights[factor] ?? (1 / 7)}
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
            <th>Value</th>
            <th>Weight</th>
            <th>Contribution</th>
          </tr>
        </thead>
        <tbody>
          {#each result.contributions as c}
            <tr>
              <td>{c.factor_name}</td>
              <td>{c.value}</td>
              <td>{(c.weight * 100).toFixed(0)}%</td>
              <td>{c.contribution.toFixed(2)}</td>
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
