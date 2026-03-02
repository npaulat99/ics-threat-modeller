<script lang="ts">
  import type {
    UpdateProject,
    TagCatalogEntry,
    ProjectDirectoryInfo,
  } from "$lib/types";
  import { DEFAULT_FACTOR_WEIGHTS, type FactorName } from "$lib/types";
  import {
    currentProject,
    setError,
    setSuccess,
    dragDropEnabled,
    tagCatalog,
    tagCatalogByCategory,
  } from "$lib/stores";
  import * as api from "$lib/api";
  import { parseFactorWeights } from "$lib/calculations";
  import { onMount } from "svelte";

  let editing = false;
  let name = "";
  let description = "";
  let deviceType = "";
  let architecture = "";
  let interfacesList: string[] = [];
  let assetsList: string[] = [];
  let thirdPartySoftwareList: string[] = [];
  let newInterface = "";
  let newAsset = "";
  let newThirdPartySoftware = "";
  let deploymentContext = "{}";
  let factorWeights: Record<string, number> = {};
  let accessProbabilities = "{}";
  let lastProjectId = "";

  let savingToDir = false;
  let savedDirPath = "";
  let targetDirName = "";
  let availableDirs: ProjectDirectoryInfo[] = [];
  let customDirName = "";

  // Autocomplete state
  let showInterfaceSuggestions = false;
  let showAssetSuggestions = false;
  let showThirdPartySuggestions = false;

  $: interfaceSuggestions = $tagCatalogByCategory.interface
    .map((e) => e.name)
    .filter(
      (n) =>
        !interfacesList.includes(n) &&
        (!newInterface.trim() ||
          n.toLowerCase().includes(newInterface.toLowerCase())),
    );

  $: assetSuggestions = $tagCatalogByCategory.asset
    .map((e) => e.name)
    .filter(
      (n) =>
        !assetsList.includes(n) &&
        (!newAsset.trim() || n.toLowerCase().includes(newAsset.toLowerCase())),
    );

  $: thirdPartySuggestions = $tagCatalogByCategory.third_party_software
    .map((e) => e.name)
    .filter(
      (n) =>
        !thirdPartySoftwareList.includes(n) &&
        (!newThirdPartySoftware.trim() ||
          n.toLowerCase().includes(newThirdPartySoftware.toLowerCase())),
    );

  onMount(async () => {
    try {
      const entries = await api.listTagCatalog();
      tagCatalog.set(entries);
    } catch (e) {
      // Silently ignore if tag catalog not available yet
    }
    try {
      availableDirs = await api.listProjectDirectories();
    } catch (e) {
      // Silently ignore
    }
  });

  // Only reset form fields when the project actually changes (different id)
  $: if ($currentProject && $currentProject.id !== lastProjectId) {
    lastProjectId = $currentProject.id;
    loadFromProject();
  }

  function loadFromProject() {
    if (!$currentProject) return;
    name = $currentProject.name;
    description = $currentProject.description;
    deviceType = $currentProject.device_type;
    architecture = $currentProject.architecture;
    deploymentContext = $currentProject.deployment_context;
    accessProbabilities = $currentProject.access_probabilities;
    factorWeights = parseFactorWeights($currentProject.factor_weights);
    // Parse interfaces/assets from JSON to string arrays
    try {
      interfacesList = JSON.parse($currentProject.interfaces || "[]");
    } catch {
      interfacesList = [];
    }
    try {
      assetsList = JSON.parse($currentProject.assets || "[]");
    } catch {
      assetsList = [];
    }
    try {
      thirdPartySoftwareList = JSON.parse(
        $currentProject.third_party_software || "[]",
      );
    } catch {
      thirdPartySoftwareList = [];
    }
    if (!Array.isArray(interfacesList)) interfacesList = [];
    if (!Array.isArray(assetsList)) assetsList = [];
    if (!Array.isArray(thirdPartySoftwareList)) thirdPartySoftwareList = [];
  }

  function addInterface() {
    const v = newInterface.trim();
    if (v && !interfacesList.includes(v)) {
      interfacesList = [...interfacesList, v];
    }
    newInterface = "";
  }

  function removeInterface(idx: number) {
    interfacesList = interfacesList.filter((_, i) => i !== idx);
  }

  function addAsset() {
    const v = newAsset.trim();
    if (v && !assetsList.includes(v)) {
      assetsList = [...assetsList, v];
    }
    newAsset = "";
  }

  function removeAsset(idx: number) {
    assetsList = assetsList.filter((_, i) => i !== idx);
  }

  function addThirdPartySoftware() {
    const v = newThirdPartySoftware.trim();
    if (v && !thirdPartySoftwareList.includes(v)) {
      thirdPartySoftwareList = [...thirdPartySoftwareList, v];
    }
    newThirdPartySoftware = "";
  }

  function removeThirdPartySoftware(idx: number) {
    thirdPartySoftwareList = thirdPartySoftwareList.filter((_, i) => i !== idx);
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
        interfaces: JSON.stringify(interfacesList),
        assets: JSON.stringify(assetsList),
        third_party_software: JSON.stringify(thirdPartySoftwareList),
        deployment_context: deploymentContext,
        factor_weights: JSON.stringify(factorWeights),
        access_probabilities: accessProbabilities,
      };
      const updated = await api.updateProject(data);
      lastProjectId = ""; // force reload from project
      currentProject.set(updated);
      editing = false;
      setSuccess("Project settings saved.");
    } catch (e) {
      setError(`Save failed: ${e}`);
    }
  }

  async function saveToDirectory() {
    if (!$currentProject) return;
    savingToDir = true;
    savedDirPath = "";
    try {
      // Use custom name if "__new__" is selected, otherwise the chosen dir
      const dir =
        targetDirName === "__new__"
          ? customDirName.trim() || undefined
          : targetDirName || undefined;
      const path = await api.saveProjectToDirectory($currentProject.id, dir);
      savedDirPath = path;
      setSuccess(`Project saved to directory: ${path}`);
      // Refresh available directories
      availableDirs = await api.listProjectDirectories();
    } catch (e) {
      setError(`Save to directory failed: ${e}`);
    } finally {
      savingToDir = false;
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
          <label>Interfaces</label>
          {#if editing}
            <div class="tag-input-container">
              <div class="tags-list">
                {#each interfacesList as iface, idx}
                  <span class="tag-pill"
                    >{iface}<button
                      class="tag-remove"
                      on:click={() => removeInterface(idx)}>✕</button
                    ></span
                  >
                {/each}
              </div>
              <div class="autocomplete-wrapper">
                <input
                  class="input"
                  bind:value={newInterface}
                  placeholder="Type and press Enter…"
                  on:focus={() => (showInterfaceSuggestions = true)}
                  on:blur={() =>
                    setTimeout(() => (showInterfaceSuggestions = false), 200)}
                  on:input={() => (showInterfaceSuggestions = true)}
                  on:keydown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addInterface();
                      showInterfaceSuggestions = false;
                    }
                  }}
                />
                {#if showInterfaceSuggestions && interfaceSuggestions.length > 0}
                  <div class="suggestions-dropdown">
                    {#each interfaceSuggestions.slice(0, 10) as suggestion}
                      <button
                        class="suggestion-item"
                        on:mousedown|preventDefault={() => {
                          newInterface = suggestion;
                          addInterface();
                          showInterfaceSuggestions = false;
                        }}>{suggestion}</button
                      >
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {:else}
            <div class="tags-list">
              {#each interfacesList as iface}
                <span class="tag-pill readonly">{iface}</span>
              {:else}
                <p class="field-value">—</p>
              {/each}
            </div>
          {/if}
        </div>
        <div class="form-group">
          <label>Assets</label>
          {#if editing}
            <div class="tag-input-container">
              <div class="tags-list">
                {#each assetsList as asset, idx}
                  <span class="tag-pill"
                    >{asset}<button
                      class="tag-remove"
                      on:click={() => removeAsset(idx)}>✕</button
                    ></span
                  >
                {/each}
              </div>
              <div class="autocomplete-wrapper">
                <input
                  class="input"
                  bind:value={newAsset}
                  placeholder="Type and press Enter…"
                  on:focus={() => (showAssetSuggestions = true)}
                  on:blur={() =>
                    setTimeout(() => (showAssetSuggestions = false), 200)}
                  on:input={() => (showAssetSuggestions = true)}
                  on:keydown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addAsset();
                      showAssetSuggestions = false;
                    }
                  }}
                />
                {#if showAssetSuggestions && assetSuggestions.length > 0}
                  <div class="suggestions-dropdown">
                    {#each assetSuggestions.slice(0, 10) as suggestion}
                      <button
                        class="suggestion-item"
                        on:mousedown|preventDefault={() => {
                          newAsset = suggestion;
                          addAsset();
                          showAssetSuggestions = false;
                        }}>{suggestion}</button
                      >
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {:else}
            <div class="tags-list">
              {#each assetsList as asset}
                <span class="tag-pill readonly">{asset}</span>
              {:else}
                <p class="field-value">—</p>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div class="card">
        <h3>3rd Party Software</h3>
        <div class="form-group">
          <label>3rd Party Software</label>
          {#if editing}
            <div class="tag-input-container">
              <div class="tags-list">
                {#each thirdPartySoftwareList as sw, idx}
                  <span class="tag-pill"
                    >{sw}<button
                      class="tag-remove"
                      on:click={() => removeThirdPartySoftware(idx)}>✕</button
                    ></span
                  >
                {/each}
              </div>
              <div class="autocomplete-wrapper">
                <input
                  class="input"
                  bind:value={newThirdPartySoftware}
                  placeholder="Type and press Enter…"
                  on:focus={() => (showThirdPartySuggestions = true)}
                  on:blur={() =>
                    setTimeout(() => (showThirdPartySuggestions = false), 200)}
                  on:input={() => (showThirdPartySuggestions = true)}
                  on:keydown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addThirdPartySoftware();
                      showThirdPartySuggestions = false;
                    }
                  }}
                />
                {#if showThirdPartySuggestions && thirdPartySuggestions.length > 0}
                  <div class="suggestions-dropdown">
                    {#each thirdPartySuggestions.slice(0, 10) as suggestion}
                      <button
                        class="suggestion-item"
                        on:mousedown|preventDefault={() => {
                          newThirdPartySoftware = suggestion;
                          addThirdPartySoftware();
                          showThirdPartySuggestions = false;
                        }}>{suggestion}</button
                      >
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {:else}
            <div class="tags-list">
              {#each thirdPartySoftwareList as sw}
                <span class="tag-pill readonly">{sw}</span>
              {:else}
                <p class="field-value">—</p>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div class="card">
        <h3>Behavior</h3>
        <div class="form-group">
          <label class="checkbox-row">
            <input
              type="checkbox"
              checked={$dragDropEnabled}
              on:change={(e) => dragDropEnabled.set(e.currentTarget.checked)}
            />
            <span class="checkbox-text">
              <strong>Enable Drag &amp; Drop</strong>
              <span class="checkbox-desc"
                >Allow reordering items in the Attack Tree by dragging and
                dropping nodes. Disable this if drag interactions interfere with
                your workflow.</span
              >
            </span>
          </label>
        </div>
      </div>

      <div class="card">
        <h3>📁 Project Directory</h3>
        <p class="card-desc">
          Save this project as YAML files to a directory for Git version
          control. Pick an existing directory (e.g. a cloned repo) or enter a
          new name.
        </p>
        <div class="dir-picker">
          <label class="form-label">Target directory</label>
          <select class="input" bind:value={targetDirName}>
            <option value="">Auto (from project name)</option>
            {#each availableDirs as d}
              <option value={d.dir_name}>
                {d.dir_name}/
                {#if d.has_git}
                  ⎇{/if}
                {#if d.has_export}
                  (has data){/if}
              </option>
            {/each}
            <option value="__new__">+ Custom name…</option>
          </select>
          {#if targetDirName === "__new__"}
            <input
              class="input"
              type="text"
              placeholder="e.g. my-project-data"
              bind:value={customDirName}
              style="margin-top: 0.5rem"
            />
          {/if}
        </div>
        <button
          class="btn btn-secondary"
          disabled={savingToDir}
          on:click={saveToDirectory}
          style="margin-top: 0.75rem"
        >
          {savingToDir ? "⏳ Saving…" : "💾 Save to Directory"}
        </button>
        {#if savedDirPath}
          <p class="saved-path">Saved to: <code>{savedDirPath}</code></p>
        {/if}
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
            <span class="weight-label">{factor.replace(/_/g, " ")}</span>
            {#if editing}
              <input
                class="input weight-input"
                type="number"
                min="0"
                max="1"
                step="0.05"
                value={weight.toFixed(2)}
                on:change={(e) => {
                  const val = parseFloat(e.currentTarget.value);
                  if (!isNaN(val)) {
                    factorWeights[factor] = Math.round(val * 100) / 100;
                    factorWeights = factorWeights;
                  }
                }}
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

  .tag-input-container {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tags-list {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .tag-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #edf2f7;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 3px 10px;
    font-size: 0.78rem;
    font-weight: 500;
  }
  .tag-pill.readonly {
    background: #f7fafc;
  }
  .tag-remove {
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.65rem;
    color: #a0aec0;
    padding: 0 2px;
    line-height: 1;
  }
  .tag-remove:hover {
    color: #e53e3e;
  }

  .autocomplete-wrapper {
    position: relative;
  }
  .suggestions-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 0 0 6px 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    max-height: 200px;
    overflow-y: auto;
    z-index: 50;
  }
  .suggestion-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 8px 12px;
    border: none;
    background: none;
    font-size: 0.82rem;
    cursor: pointer;
    color: #2d3748;
  }
  .suggestion-item:hover {
    background: #edf2f7;
  }

  .save-bar {
    margin-top: 20px;
    text-align: right;
  }

  .checkbox-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    cursor: pointer;
    font-weight: normal;
  }
  .checkbox-row input[type="checkbox"] {
    width: 18px;
    height: 18px;
    margin-top: 2px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .checkbox-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .checkbox-text strong {
    font-size: 0.85rem;
  }
  .checkbox-desc {
    font-size: 0.75rem;
    color: #718096;
    line-height: 1.4;
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
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .card-desc {
    font-size: 0.8rem;
    color: #718096;
    margin: 0 0 12px;
    line-height: 1.5;
  }
  .saved-path {
    margin-top: 8px;
    font-size: 0.75rem;
    color: #2f855a;
  }
  .saved-path code {
    background: #f0fff4;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 0.72rem;
  }
  .dir-picker {
    margin-top: 0.5rem;
  }
  .dir-picker .form-label {
    display: block;
    font-size: 0.78rem;
    font-weight: 600;
    margin-bottom: 4px;
    color: #4a5568;
  }
  .dir-picker select {
    width: 100%;
  }
</style>
