<script lang="ts">
  import type { UpdateProject } from "$lib/types";
  import { DEFAULT_FACTOR_WEIGHTS, type FactorName } from "$lib/types";
  import { currentProject, setError, setSuccess } from "$lib/stores";
  import * as api from "$lib/api";
  import { parseFactorWeights } from "$lib/calculations";

  let editing = false;
  let name = "";
  let description = "";
  let deviceType = "";
  let architecture = "";
  let interfaces = "[]";
  let assets = "[]";
  let deploymentContext = "{}";
  let factorWeights: Record<string, number> = {};
  let accessProbabilities = "{}";

  $: if ($currentProject) {
    name = $currentProject.name;
    description = $currentProject.description;
    deviceType = $currentProject.device_type;
    architecture = $currentProject.architecture;
    interfaces = $currentProject.interfaces;
    assets = $currentProject.assets;
    deploymentContext = $currentProject.deployment_context;
    accessProbabilities = $currentProject.access_probabilities;
    factorWeights = parseFactorWeights($currentProject.factor_weights);
  }

  async function saveProject() {
    if (!$currentProject) return;
    try {
      const data: UpdateProject = {
        id: $currentProject.id,
        name,
        description,
        device_type: deviceType,
        architecture,
        interfaces,
        assets,
        deployment_context: deploymentContext,
        factor_weights: JSON.stringify(factorWeights),
        access_probabilities: accessProbabilities,
      };
      const updated = await api.updateProject(data);
      currentProject.set(updated);
      editing = false;
      setSuccess("Project settings saved.");
    } catch (e) {
      setError(`Save failed: ${e}`);
    }
  }

  const factorNames: FactorName[] = Object.keys(
    DEFAULT_FACTOR_WEIGHTS,
  ) as FactorName[];
</script>

{#if $currentProject}
  <div class="project-detail">
    <div class="detail-header">
      <h2>Project Settings</h2>
      <button class="btn btn-secondary" on:click={() => (editing = !editing)}>
        {editing ? "Cancel" : "Edit"}
      </button>
    </div>

    <div class="settings-grid">
      <div class="card">
        <h3>General</h3>
        <div class="form-group">
          <label>Name</label>
          {#if editing}
            <input class="input" bind:value={name} />
          {:else}
            <p class="field-value">{name}</p>
          {/if}
        </div>
        <div class="form-group">
          <label>Description</label>
          {#if editing}
            <textarea class="input" rows="3" bind:value={description}
            ></textarea>
          {:else}
            <p class="field-value">{description || "—"}</p>
          {/if}
        </div>
        <div class="form-group">
          <label>Device Type</label>
          {#if editing}
            <input class="input" bind:value={deviceType} />
          {:else}
            <p class="field-value">{deviceType || "—"}</p>
          {/if}
        </div>
        <div class="form-group">
          <label>Architecture</label>
          {#if editing}
            <input class="input" bind:value={architecture} />
          {:else}
            <p class="field-value">{architecture || "—"}</p>
          {/if}
        </div>
        <div class="form-group">
          <label>Interfaces (JSON)</label>
          {#if editing}
            <textarea class="input" rows="2" bind:value={interfaces}></textarea>
          {:else}
            <p class="field-value">{interfaces || "—"}</p>
          {/if}
        </div>
        <div class="form-group">
          <label>Assets (JSON)</label>
          {#if editing}
            <textarea class="input" rows="2" bind:value={assets}></textarea>
          {:else}
            <p class="field-value">{assets || "—"}</p>
          {/if}
        </div>
      </div>

      <div class="card">
        <h3>Deployment & Probabilities</h3>
        <div class="form-group">
          <label>Deployment Context (JSON)</label>
          {#if editing}
            <textarea class="input" rows="3" bind:value={deploymentContext}
            ></textarea>
          {:else}
            <p class="field-value">{deploymentContext || "—"}</p>
          {/if}
        </div>
        <div class="form-group">
          <label>Access Probabilities (JSON)</label>
          {#if editing}
            <textarea class="input" rows="2" bind:value={accessProbabilities}
            ></textarea>
          {:else}
            <p class="field-value">{accessProbabilities || "—"}</p>
          {/if}
        </div>

        <h4>Factor Weights</h4>
        {#each Object.entries(factorWeights) as [factor, weight]}
          <div class="weight-row">
            <span class="weight-label">{factor}</span>
            {#if editing}
              <input
                class="input weight-input"
                type="number"
                min="0"
                max="1"
                step="0.05"
                bind:value={factorWeights[factor]}
              />
            {:else}
              <span class="weight-value">{(weight * 100).toFixed(0)}%</span>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    {#if editing}
      <div class="save-bar">
        <button class="btn btn-primary" on:click={saveProject}
          >Save Changes</button
        >
      </div>
    {/if}
  </div>
{:else}
  <p>No project selected.</p>
{/if}

<style>
  .project-detail {
    max-width: 900px;
    margin: 0 auto;
  }

  .detail-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .detail-header h2 {
    margin: 0;
    font-size: 1.2rem;
  }

  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
    gap: 20px;
  }

  .card {
    background: white;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    padding: 20px;
  }

  .card h3 {
    margin: 0 0 16px;
    font-size: 1rem;
  }
  .card h4 {
    margin: 16px 0 10px;
    font-size: 0.85rem;
    color: var(--color-text-muted, #718096);
  }

  .form-group {
    margin-bottom: 12px;
  }
  .form-group label {
    display: block;
    font-size: 0.78rem;
    font-weight: 600;
    margin-bottom: 4px;
    color: #4a5568;
  }

  .field-value {
    margin: 0;
    font-size: 0.88rem;
    color: var(--color-text, #2d3748);
  }

  .input {
    width: 100%;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 0.85rem;
    font-family: inherit;
  }

  .weight-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
  }
  .weight-label {
    font-size: 0.82rem;
  }
  .weight-value {
    font-weight: 600;
    font-size: 0.85rem;
  }
  .weight-input {
    width: 80px;
  }

  .save-bar {
    margin-top: 20px;
    text-align: right;
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
    background: var(--color-primary, #1a365d);
    color: white;
  }
  .btn-secondary {
    background: #edf2f7;
    color: #2d3748;
    border: 1px solid #e2e8f0;
  }
</style>
