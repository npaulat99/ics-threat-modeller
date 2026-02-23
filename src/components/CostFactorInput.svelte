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

  function emitChange() {
    dispatch('change', { value: localValue, rationale: localRationale });
  }

  function handleSlider(e: Event) {
    localValue = parseInt((e.target as HTMLInputElement).value);
    emitChange();
  }

  function handleRationale() {
    emitChange();
  }
</script>

<div class="cost-factor">
  <div class="factor-header">
    <span class="factor-name">{name}</span>
    <span class="factor-weight">w={weight.toFixed(2)}</span>
  </div>

  <div class="slider-row">
    <input
      type="range"
      min="1"
      max="5"
      step="1"
      bind:value={localValue}
      on:change={handleSlider}
      disabled={readonly}
      class="slider"
    />
    <span class="value-display" class:low={localValue <= 2} class:mid={localValue > 2 && localValue <= 3} class:high={localValue > 3}>
      {localValue}
    </span>
  </div>

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
  }

  .factor-weight {
    font-size: 0.7rem;
    color: var(--color-text-muted, #718096);
  }

  .slider-row {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 8px;
  }

  .slider {
    flex: 1;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    border-radius: 3px;
    background: #cbd5e0;
    outline: none;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-primary, #1a365d);
    cursor: pointer;
  }

  .value-display {
    font-weight: 700;
    font-size: 1.1rem;
    width: 30px;
    text-align: center;
  }

  .value-display.low { color: #38a169; }
  .value-display.mid { color: #d69e2e; }
  .value-display.high { color: #e53e3e; }

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
