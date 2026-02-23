<script lang="ts">
  import type { AttackPath } from '$lib/types';
  import { formatProbability, getSeverityColor, getSeverityLabel } from '$lib/calculations';

  export let paths: AttackPath[] = [];
  export let goalName = '';
  export let aggregatedProbability = 0;
  export let aggregationType: 'and' | 'or' = 'or';
</script>

<div class="path-table">
  <div class="table-header">
    <h3>Attack Paths — {goalName}</h3>
    <div class="aggregated {getSeverityColor(aggregatedProbability)}">
      <span class="agg-label">{aggregationType.toUpperCase()} Aggregation:</span>
      <span class="agg-value">{formatProbability(aggregatedProbability)}</span>
      <span class="agg-severity">({getSeverityLabel(aggregatedProbability)})</span>
    </div>
  </div>

  {#if paths.length === 0}
    <p class="no-paths">No attack paths calculated. Add leaf steps with assessments to generate paths.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Path Steps</th>
          <th>P(access)</th>
          <th>P(cost)</th>
          <th>Realistic</th>
          <th>P(overall)</th>
          <th>Severity</th>
        </tr>
      </thead>
      <tbody>
        {#each paths as path, i}
          <tr>
            <td class="path-num">{i + 1}</td>
            <td class="path-steps">
              {#each path.steps as step, j}
                <span class="step-chip" title="P={formatProbability(step.cost_probability)}">
                  {step.name}
                  {#if j < path.steps.length - 1}
                    <span class="arrow">→</span>
                  {/if}
                </span>
              {/each}
            </td>
            <td>{formatProbability(path.access_probability)}</td>
            <td>{formatProbability(path.cost_probability)}</td>
            <td>{path.is_realistic ? '✓' : '✗'}</td>
            <td class="path-prob {getSeverityColor(path.overall_probability)}">
              {formatProbability(path.overall_probability)}
            </td>
            <td>
              <span class="severity-badge {getSeverityColor(path.overall_probability)}">
                {getSeverityLabel(path.overall_probability)}
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .path-table {
    background: white;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    padding: 20px;
    overflow-x: auto;
  }

  .table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    flex-wrap: wrap;
    gap: 12px;
  }

  .table-header h3 {
    margin: 0;
    font-size: 1rem;
  }

  .aggregated {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .agg-label {
    font-size: 0.75rem;
    opacity: 0.8;
  }

  .agg-severity {
    font-size: 0.75rem;
  }

  .no-paths {
    color: var(--color-text-muted, #718096);
    font-size: 0.85rem;
    text-align: center;
    padding: 20px;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.82rem;
  }

  th, td {
    padding: 8px 12px;
    text-align: left;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
  }

  th {
    font-weight: 600;
    color: var(--color-text-muted, #718096);
    font-size: 0.75rem;
    text-transform: uppercase;
  }

  .path-num {
    font-weight: 600;
    color: var(--color-text-muted, #718096);
  }

  .path-steps {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }

  .step-chip {
    font-size: 0.78rem;
  }

  .arrow {
    color: var(--color-text-muted, #718096);
    margin: 0 2px;
  }

  .path-prob {
    font-weight: 700;
  }

  .severity-badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  :global(.severity-critical) { background: #fed7d7; color: #c53030; }
  :global(.severity-high) { background: #feebc8; color: #c05621; }
  :global(.severity-medium) { background: #fefcbf; color: #975a16; }
  :global(.severity-low) { background: #c6f6d5; color: #276749; }
</style>
