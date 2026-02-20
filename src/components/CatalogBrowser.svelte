<script lang="ts">
  import type { CatalogEntry } from '$lib/types';
  import { catalogEntries, catalogSearchQuery, setError, setSuccess, currentProject } from '$lib/stores';
  import * as api from '$lib/api';

  export let onImport: ((catalogId: string) => void) | null = null;

  let searchTimeout: ReturnType<typeof setTimeout>;

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
      setError('Open a project first.');
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

  const severityColors: Record<string, string> = {
    critical: '#e53e3e',
    high: '#dd6b20',
    medium: '#d69e2e',
    low: '#38a169',
  };
</script>

<div class="catalog-browser">
  <div class="search-bar">
    <input
      type="text"
      placeholder="Search catalog..."
      bind:value={$catalogSearchQuery}
      on:input={handleSearch}
      class="search-input"
    />
  </div>

  <div class="catalog-list">
    {#each $catalogEntries as entry (entry.id)}
      <div class="catalog-card">
        <div class="card-header">
          <h4 class="card-title">{entry.name}</h4>
          <span
            class="severity-tag"
            style="background: {severityColors[entry.severity] ?? '#718096'}20; color: {severityColors[entry.severity] ?? '#718096'}"
          >
            {entry.severity}
          </span>
        </div>
        <p class="card-desc">{entry.description}</p>
        <div class="card-meta">
          <span class="meta-item">📂 {entry.category}</span>
          <span class="meta-item">📖 {entry.source}</span>
        </div>
        <div class="card-actions">
          {#if $currentProject}
            <button class="btn btn-primary btn-sm" on:click={() => importEntry(entry)}>
              Import into Project
            </button>
          {/if}
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
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
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
</style>
