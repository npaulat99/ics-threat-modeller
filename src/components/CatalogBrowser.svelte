<script lang="ts">
  import type { CatalogEntry, TagCatalogEntry } from "$lib/types";
  import {
    catalogEntries,
    catalogSearchQuery,
    setError,
    setSuccess,
    currentProject,
    tagCatalog,
    tagCatalogByCategory,
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
  let filterCategory: string = "all"; // "all" | "asset" | "interface" | "third_party_software" | "other"
  let showProjectMatch = false;

  // Load tag catalog on mount
  async function loadTagCatalog() {
    try {
      const entries = await api.listTagCatalog();
      tagCatalog.set(entries);
    } catch { /* ignore */ }
  }
  loadTagCatalog();

  // Build tag-to-category mapping from tag catalog + project data
  $: tagCategoryMap = (() => {
    const map: Record<string, string> = {};
    for (const tc of $tagCatalog) {
      map[tc.name.toLowerCase()] = tc.category;
    }
    return map;
  })();

  // Project configured tags: assets, interfaces, 3rd party software
  $: projectTags = (() => {
    if (!$currentProject) return { asset: [] as string[], interface: [] as string[], third_party_software: [] as string[] };
    const parse = (json: string): string[] => { try { const a = JSON.parse(json || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
    return {
      asset: parse($currentProject.assets),
      interface: parse($currentProject.interfaces),
      third_party_software: parse($currentProject.third_party_software),
    };
  })();

  $: allProjectTagsLower = [
    ...projectTags.asset,
    ...projectTags.interface,
    ...projectTags.third_party_software,
  ].map(t => t.toLowerCase());

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

  // Categorize tags from catalog entries
  $: categorizedTags = (() => {
    const cats: Record<string, string[]> = { asset: [], interface: [], third_party_software: [], other: [] };
    for (const t of allTags) {
      const cat = tagCategoryMap[t] || 'other';
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(t);
    }
    return cats;
  })();

  $: visibleTags = filterCategory === 'all' ? allTags : (categorizedTags[filterCategory] || []);

  const categoryLabels: Record<string, string> = {
    all: 'All',
    asset: '🏭 Assets',
    interface: '🔌 Interfaces',
    third_party_software: '💾 3rd Party Software',
    other: '📌 Other',
  };

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      selectedTags = selectedTags.filter((t) => t !== tag);
    } else {
      selectedTags = [...selectedTags, tag];
    }
  }

  function entryMatchesTags(entry: CatalogEntry): boolean {
    const hasTagFilter = selectedTags.length > 0;
    const hasProjectMatch = showProjectMatch && allProjectTagsLower.length > 0;
    if (!hasTagFilter && !hasProjectMatch) return true;

    let entryTags: string[] = [];
    try {
      const parsed = JSON.parse(entry.tags || "[]");
      if (Array.isArray(parsed)) {
        entryTags = parsed.map((t: string) => t.trim().toLowerCase());
      }
    } catch {
      const entryTag = (entry.tags || "").trim().toLowerCase();
      if (entryTag) entryTags = [entryTag];
    }

    // Also search in tree_data for asset/interface references
    const treeStr = (entry.tree_data || "").toLowerCase();

    const matchesTags = !hasTagFilter || selectedTags.some((st) => entryTags.includes(st));
    const matchesProject = !hasProjectMatch || allProjectTagsLower.some((pt) =>
      entryTags.includes(pt) || treeStr.includes(pt)
    );

    return matchesTags && matchesProject;
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
      <div class="tag-filter-top">
        <span class="tag-filter-label">Filter by tag:</span>
        <div class="cat-tabs">
          {#each Object.entries(categoryLabels) as [cat, label]}
            {#if cat === 'all' || (categorizedTags[cat] && categorizedTags[cat].length > 0)}
              <button
                class="cat-tab"
                class:active={filterCategory === cat}
                on:click={() => filterCategory = cat}
              >{label}</button>
            {/if}
          {/each}
        </div>
        {#if $currentProject}
          <label class="project-match-toggle">
            <input type="checkbox" bind:checked={showProjectMatch} />
            <span>Match project tags</span>
          </label>
        {/if}
      </div>
      <div class="tag-chips-row">
        {#each visibleTags as tag}
          <button
            class="tag-chip"
            class:active={selectedTags.includes(tag)}
            class:project-tag={allProjectTagsLower.includes(tag)}
            on:click={() => toggleTag(tag)}
            title={allProjectTagsLower.includes(tag) ? "Used in project" : ""}
          >
            {#if allProjectTagsLower.includes(tag)}★{/if}
            {tag}
          </button>
        {/each}
        {#if selectedTags.length > 0}
          <button class="tag-clear" on:click={() => (selectedTags = [])}
            >Clear</button
          >
        {/if}
      </div>
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
    flex-direction: column;
    gap: 8px;
    padding: 10px 12px;
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  }

  .tag-filter-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .tag-filter-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: #4a5568;
  }

  .cat-tabs {
    display: flex;
    gap: 2px;
  }
  .cat-tab {
    border: 1px solid #cbd5e0;
    background: white;
    padding: 2px 8px;
    font-size: 0.68rem;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.12s;
  }
  .cat-tab:hover {
    background: #edf2f7;
  }
  .cat-tab.active {
    background: #2d3748;
    color: white;
    border-color: #2d3748;
  }

  .project-match-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.7rem;
    color: #4a5568;
    cursor: pointer;
    margin-left: auto;
  }
  .project-match-toggle input {
    width: 14px;
    height: 14px;
    cursor: pointer;
  }

  .tag-chips-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
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
  .tag-chip.project-tag {
    border-color: #38a169;
    box-shadow: inset 0 0 0 1px #38a16940;
  }
  .tag-chip.project-tag.active {
    background: #276749;
    border-color: #276749;
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
