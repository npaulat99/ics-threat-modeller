<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let name: string;
  export let value = 1;
  export let rationale = '';
  export let weight = 1 / 7;
  export let readonly = false;

  const dispatch = createEventDispatcher<{
    change: { value: number; rationale: string };
  }>();

  let localValue = value;
  let localRationale = rationale;

  $: localValue = value;
  $: localRationale = rationale;

  // Factor-specific labels for each level 1-5
  const factorLabels: Record<string, string[]> = {
    time_effort:           ['≤ 1 day', '≤ 1 week', '≤ 1 month', '≤ 6 months', '> 6 months'],
    prior_knowledge:       ['Public info', 'Basic training', 'Domain expert', 'Deep specialist', 'Rare expertise'],
    exploitability:        ['Trivial', 'Easy', 'Moderate', 'Difficult', 'Near impossible'],
    window_of_opportunity: ['Unlimited', 'Large window', 'Medium window', 'Small window', 'Tiny window'],
    detection_probability: ['Undetectable', 'Low detection', 'Moderate', 'Likely detected', 'Certain detection'],
    preparation_effort:    ['None needed', 'Minimal', 'Moderate', 'Significant', 'Extensive'],
    abort_risk:            ['No risk', 'Low risk', 'Moderate', 'High risk', 'Critical risk'],
  };

  $: labels = factorLabels[name] || ['1', '2', '3', '4', '5'];

  function emitChange() {
    dispatch('change', { value: localValue, rationale: localRationale });
  }

  function selectValue(v: number) {
    if (readonly) return;
    localValue = v;
    emitChange();
  }

  function handleRationale() {
    emitChange();
  }
</script>

<div class="cost-factor">
  <div class="factor-header">
    <span class="factor-name">{name.replace(/_/g, ' ')}</span>
    <span class="factor-weight">w={weight.toFixed(2)}</span>
  </div>

  <div class="button-row">
    {#each [1, 2, 3, 4, 5] as v}
      <button
        class="score-btn"
        class:active={localValue === v}
        class:low={v <= 2}
        class:mid={v === 3}
        class:high={v >= 4}
        disabled={readonly}
        on:click={() => selectValue(v)}
        title={labels[v - 1]}
      >
        {v}
      </button>
    {/each}
  </div>

  {#if localValue > 0}
    <div class="level-label">{labels[localValue - 1]}</div>
  {/if}

  <textarea
    class="rationale-input"
    placeholder="Rationale..."
    bind:value={localRationale}
    on:blur={handleRationale}
    disabled={readonly}
    rows="2"
  ></textarea>
</div>

<style>
  .cost-factor {
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 6px;
    padding: 12px;
    background: var(--color-card-bg, #f7fafc);
  }

  .factor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .factor-name {
    font-weight: 600;
    font-size: 0.82rem;
    text-transform: capitalize;
  }

  .factor-weight {
    font-size: 0.7rem;
    color: var(--color-text-muted, #718096);
  }

  .button-row {
    display: flex;
    gap: 4px;
    margin-bottom: 6px;
  }

  .score-btn {
    width: 36px;
    height: 36px;
    border: 2px solid #cbd5e0;
    border-radius: 4px;
    background: white;
    cursor: pointer;
    font-weight: 700;
    font-size: 0.9rem;
    color: #4a5568;
    transition: all 0.12s;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .score-btn:hover:not(:disabled) {
    border-color: #a0aec0;
    background: #edf2f7;
  }

  .score-btn.active.low {
    background: #c6f6d5;
    border-color: #38a169;
    color: #22543d;
  }

  .score-btn.active.mid {
    background: #fefcbf;
    border-color: #d69e2e;
    color: #744210;
  }

  .score-btn.active.high {
    background: #fed7d7;
    border-color: #e53e3e;
    color: #742a2a;
  }

  .score-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .level-label {
    font-size: 0.72rem;
    color: var(--color-text-muted, #718096);
    margin-bottom: 8px;
    font-style: italic;
  }

  .rationale-input {
    width: 100%;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 0.78rem;
    font-family: inherit;
    resize: vertical;
    background: white;
  }

  .rationale-input:disabled {
    background: #f7fafc;
    color: #a0aec0;
  }
</style>
