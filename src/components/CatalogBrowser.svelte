<script lang="ts">
  import type { CatalogEntry } from "$lib/types";
  import {
    catalogEntries,
    catalogSearchQuery,
    setError,
    setSuccess,
    currentProject,
  } from "$lib/stores";
  import * as api from "$lib/api";

  export let onImport: ((catalogId: string) => void) | null = null;

  let searchTimeout: ReturnType<typeof setTimeout>;
  let showCreateForm = false;
  let newName = "";
  let newDesc = "";
  let newFramework = "Custom";
  let newVersion = "1.0";
  let newTags = "";

  async function loadCatalog() {
    try {
      const entries = await api.listCatalogEntries();
      catalogEntries.set(entries);
    } catch (e) {
      setError(`Failed to load catalog: ${e}`);
    }
  }

  async function handleSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      try {
        if ($catalogSearchQuery.trim()) {
          const results = await api.searchCatalog($catalogSearchQuery);
          catalogEntries.set(results);
        } else {
          await loadCatalog();
        }
      } catch (e) {
        setError(`Search failed: ${e}`);
      }
    }, 300);
  }

  async function importEntry(entry: CatalogEntry) {
    if (!$currentProject) {
      setError("Open a project first.");
      return;
    }
    try {
      await api.importCatalogEntry(entry.id, $currentProject.id);
      setSuccess(`Imported "${entry.name}" into project.`);
      onImport?.(entry.id);
    } catch (e) {
      setError(`Import failed: ${e}`);
    }
  }

  // Load on mount.
  loadCatalog();

  async function createEntry() {
    if (!newName.trim()) return;
    try {
      await api.createCatalogEntry({
        name: newName,
        description: newDesc || undefined,
        tree_data: JSON.stringify({
          goal: { name: newName, description: newDesc },
          steps: [],
        }),
        source_framework: newFramework || undefined,
        version: newVersion || undefined,
        tags: newTags
          ? JSON.stringify(newTags.split(",").map((t) => t.trim()))
          : undefined,
      });
      setSuccess(`Catalog entry "${newName}" created.`);
      showCreateForm = false;
      newName = "";
      newDesc = "";
      newFramework = "Custom";
      newVersion = "1.0";
      newTags = "";
      await loadCatalog();
    } catch (e) {
      setError(`Create catalog entry failed: ${e}`);
    }
  }

  async function deleteEntry(entry: CatalogEntry) {
    if (
      !confirm(`Delete catalog entry "${entry.name}"? This cannot be undone.`)
    )
      return;
    try {
      await api.deleteCatalogEntry(entry.id);
      setSuccess(`Deleted "${entry.name}"`);
      await loadCatalog();
    } catch (e) {
      setError(`Delete failed: ${e}`);
    }
  }

  const entryTypeColors: Record<string, string> = {
    attack_pattern: "#e53e3e",
    technique: "#dd6b20",
    weakness: "#d69e2e",
    countermeasure: "#38a169",
    threat: "#805ad5",
  };

  // Tag filtering
  let selectedTags: string[] = [];
  let allTags: string[] = [];

  $: {
    // Extract all unique tags from catalog entries.
    const tagSet = new Set<string>();
    for (const entry of $catalogEntries) {
      try {
        const parsed = JSON.parse(entry.tags || "[]");
        if (Array.isArray(parsed)) {
          for (const t of parsed) {
            if (typeof t === "string" && t.trim())
              tagSet.add(t.trim().toLowerCase());
          }
        }
      } catch {
        /* not JSON */
        if (entry.tags && entry.tags.trim())
          tagSet.add(entry.tags.trim().toLowerCase());
      }
    }
    allTags = [...tagSet].sort();
  }

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      selectedTags = selectedTags.filter((t) => t !== tag);
    } else {
      selectedTags = [...selectedTags, tag];
    }
  }

  function entryMatchesTags(entry: CatalogEntry): boolean {
    if (selectedTags.length === 0) return true;
    try {
      const parsed = JSON.parse(entry.tags || "[]");
      if (Array.isArray(parsed)) {
        const entryTags = parsed.map((t: string) => t.trim().toLowerCase());
        return selectedTags.some((st) => entryTags.includes(st));
      }
    } catch {
      const entryTag = (entry.tags || "").trim().toLowerCase();
      return selectedTags.some((st) => entryTag.includes(st));
    }
    return false;
  }

  $: filteredEntries = $catalogEntries.filter((e) => entryMatchesTags(e));
</script>

<div class="catalog-browser">
  <div class="search-bar">
    <div class="search-row">
      <input
        type="text"
        placeholder="Search catalog..."
        bind:value={$catalogSearchQuery}
        on:input={handleSearch}
        class="search-input"
      />
      <button
        class="btn btn-primary btn-sm"
        on:click={() => (showCreateForm = !showCreateForm)}
      >
        {showCreateForm ? "✕ Cancel" : "+ New Entry"}
      </button>
    </div>
  </div>

  {#if showCreateForm}
    <div class="create-form">
      <h4>Create Catalog Entry</h4>
      <div class="form-grid">
        <div class="form-group">
          <label>Name *</label><input
            class="input"
            bind:value={newName}
            placeholder="Entry name"
          />
        </div>
        <div class="form-group">
          <label>Framework</label><input
            class="input"
            bind:value={newFramework}
            placeholder="e.g. MITRE ATT&CK"
          />
        </div>
        <div class="form-group">
          <label>Version</label><input
            class="input"
            bind:value={newVersion}
            placeholder="1.0"
          />
        </div>
        <div class="form-group">
          <label>Tags (comma-separated)</label><input
            class="input"
            bind:value={newTags}
            placeholder="ics, scada, jtag, hart"
          />
        </div>
      </div>
      <div class="form-group">
        <label>Description</label><textarea
          class="input"
          rows="2"
          bind:value={newDesc}
          placeholder="Description"
        ></textarea>
      </div>
      <button
        class="btn btn-primary"
        on:click={createEntry}
        disabled={!newName.trim()}>Create</button
      >
    </div>
  {/if}

  {#if allTags.length > 0}
    <div class="tag-filter">
      <span class="tag-filter-label">Filter by tag:</span>
      {#each allTags as tag}
        <button
          class="tag-chip"
          class:active={selectedTags.includes(tag)}
          on:click={() => toggleTag(tag)}
        >
          {tag}
        </button>
      {/each}
      {#if selectedTags.length > 0}
        <button class="tag-clear" on:click={() => (selectedTags = [])}
          >Clear</button
        >
      {/if}
    </div>
  {/if}

  <div class="catalog-list">
    {#each filteredEntries as entry (entry.id)}
      <div class="catalog-card">
        <div class="card-header">
          <h4 class="card-title">{entry.name}</h4>
          <span
            class="severity-tag"
            style="background: {entryTypeColors[entry.entry_type] ??
              '#718096'}20; color: {entryTypeColors[entry.entry_type] ??
              '#718096'}"
          >
            {entry.entry_type}
          </span>
        </div>
        <p class="card-desc">{entry.description}</p>
        <div class="card-meta">
          <span class="meta-item">📂 {entry.source_framework}</span>
          {#if entry.version}
            <span class="meta-item">📖 v{entry.version}</span>
          {/if}
          {#if entry.tags}
            <span class="meta-item"
              >🏷️
              {#each (() => {
                try {
                  const p = JSON.parse(entry.tags);
                  return Array.isArray(p) ? p : [entry.tags];
                } catch {
                  return [entry.tags];
                }
              })() as tag}
                <span class="tag-inline">{tag}</span>
              {/each}
            </span>
          {/if}
        </div>
        <div class="card-actions">
          {#if $currentProject}
            <button
              class="btn btn-primary btn-sm"
              on:click={() => importEntry(entry)}
            >
              Import into Project
            </button>
          {/if}
          <button
            class="btn btn-danger btn-sm"
            on:click={() => deleteEntry(entry)}
          >
            🗑 Delete
          </button>
        </div>
      </div>
    {:else}
      <p class="no-results">No catalog entries found.</p>
    {/each}
  </div>
</div>

<style>
  .catalog-browser {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .search-bar {
    position: sticky;
    top: 0;
    background: white;
    padding: 4px 0;
    z-index: 1;
  }

  .search-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 6px;
    font-size: 0.9rem;
    outline: none;
  }

  .search-input:focus {
    border-color: var(--color-primary, #1a365d);
    box-shadow: 0 0 0 2px rgba(26, 54, 93, 0.15);
  }

  .catalog-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 16px;
  }

  .catalog-card {
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    padding: 16px;
    background: white;
    transition: box-shadow 0.15s;
  }

  .catalog-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 8px;
  }

  .card-title {
    margin: 0;
    font-size: 0.95rem;
  }

  .severity-tag {
    font-size: 0.65rem;
    text-transform: uppercase;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 10px;
    white-space: nowrap;
  }

  .card-desc {
    font-size: 0.82rem;
    color: var(--color-text-muted, #718096);
    margin: 0 0 10px;
    line-height: 1.4;
  }

  .card-meta {
    display: flex;
    gap: 16px;
    font-size: 0.72rem;
    color: var(--color-text-muted, #718096);
    margin-bottom: 12px;
  }

  .card-actions {
    display: flex;
    gap: 8px;
  }

  .no-results {
    grid-column: 1 / -1;
    text-align: center;
    color: var(--color-text-muted, #718096);
    padding: 40px;
  }

  .btn {
    border: none;
    border-radius: 4px;
    padding: 6px 14px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .btn-primary {
    background: var(--color-primary, #1a365d);
    color: white;
  }

  .btn-primary:hover {
    opacity: 0.9;
  }

  .btn-sm {
    padding: 4px 10px;
    font-size: 0.75rem;
  }

  .btn-danger {
    background: #e53e3e;
    color: white;
  }
  .btn-danger:hover {
    opacity: 0.9;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .search-row {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .create-form {
    background: white;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    padding: 16px;
  }

  .create-form h4 {
    margin: 0 0 12px;
    font-size: 0.9rem;
  }

  .form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 10px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .form-group label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #4a5568;
  }
  .input {
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 0.85rem;
    font-family: inherit;
  }

  .tag-filter {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    padding: 8px 12px;
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  }

  .tag-filter-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #4a5568;
  }

  .tag-chip {
    border: 1px solid #cbd5e0;
    background: white;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 0.72rem;
    cursor: pointer;
    transition: all 0.12s;
  }

  .tag-chip:hover {
    background: #edf2f7;
  }
  .tag-chip.active {
    background: #1a365d;
    color: white;
    border-color: #1a365d;
  }

  .tag-clear {
    border: none;
    background: none;
    color: #e53e3e;
    font-size: 0.72rem;
    cursor: pointer;
    font-weight: 600;
  }

  .tag-inline {
    display: inline-block;
    background: #edf2f7;
    padding: 1px 6px;
    border-radius: 8px;
    font-size: 0.65rem;
    margin: 0 2px;
  }
</style>
