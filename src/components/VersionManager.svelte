<script lang="ts">
  import type { Snapshot, DiffResult } from '$lib/types';
  import { currentProject, snapshots, setError, setSuccess } from '$lib/stores';
  import * as api from '$lib/api';
  import DiffView from './DiffView.svelte';

  let snapshotName = '';
  let snapshotDesc = '';
  let snapshotAuthor = '';
  let selectedA: string = '';
  let selectedB: string = '';
  let diffResult: DiffResult | null = null;

  async function loadSnapshots() {
    if (!$currentProject) return;
    try {
      const items = await api.listSnapshots($currentProject.id);
      snapshots.set(items);
    } catch (e) {
      setError(`Failed to load snapshots: ${e}`);
    }
  }

  async function createSnapshot() {
    if (!$currentProject || !snapshotName.trim()) return;
    try {
      await api.createSnapshot({
        project_id: $currentProject.id,
        name: snapshotName,
        description: snapshotDesc || undefined,
        author: snapshotAuthor || undefined,
      });
      snapshotName = '';
      snapshotDesc = '';
      setSuccess('Snapshot created.');
      await loadSnapshots();
    } catch (e) {
      setError(`Failed to create snapshot: ${e}`);
    }
  }

  async function restoreSnapshot(snap: Snapshot) {
    if (!confirm(`Restore snapshot "${snap.name}"? Current data will be replaced.`)) return;
    try {
      await api.restoreSnapshot(snap.id);
      setSuccess(`Restored snapshot: ${snap.name}`);
    } catch (e) {
      setError(`Restore failed: ${e}`);
    }
  }

  async function deleteSnapshot(snap: Snapshot) {
    if (!confirm(`Delete snapshot "${snap.name}"?`)) return;
    try {
      await api.deleteSnapshot(snap.id);
      setSuccess('Snapshot deleted.');
      await loadSnapshots();
    } catch (e) {
      setError(`Delete failed: ${e}`);
    }
  }

  async function compareSelected() {
    if (!selectedA || !selectedB) {
      setError('Select two snapshots to compare.');
      return;
    }
    try {
      diffResult = await api.compareSnapshots(selectedA, selectedB);
    } catch (e) {
      setError(`Comparison failed: ${e}`);
    }
  }

  loadSnapshots();
</script>

<div class="version-manager">
  <div class="create-section card">
    <h3>Create Snapshot</h3>
    <div class="form-row">
      <input type="text" placeholder="Snapshot name" bind:value={snapshotName} class="input" />
      <input type="text" placeholder="Author (optional)" bind:value={snapshotAuthor} class="input" />
    </div>
    <textarea placeholder="Description (optional)" bind:value={snapshotDesc} rows="2" class="input"></textarea>
    <button class="btn btn-primary" on:click={createSnapshot} disabled={!snapshotName.trim()}>
      Save Snapshot
    </button>
  </div>

  <div class="snapshots-list card">
    <h3>Snapshots ({$snapshots.length})</h3>
    {#each $snapshots as snap (snap.id)}
      <div class="snapshot-item">
        <div class="snap-info">
          <strong>{snap.name}</strong>
          <span class="snap-date">{snap.created_at}</span>
          {#if snap.author}
            <span class="snap-author">by {snap.author}</span>
          {/if}
          {#if snap.description}
            <p class="snap-desc">{snap.description}</p>
          {/if}
        </div>
        <div class="snap-actions">
          <button class="btn btn-sm btn-secondary" on:click={() => restoreSnapshot(snap)}>Restore</button>
          <button class="btn btn-sm btn-danger" on:click={() => deleteSnapshot(snap)}>Delete</button>
        </div>
      </div>
    {:else}
      <p class="empty">No snapshots yet.</p>
    {/each}
  </div>

  <div class="compare-section card">
    <h3>Compare Snapshots</h3>
    <div class="form-row">
      <select bind:value={selectedA} class="input">
        <option value="">— Snapshot A —</option>
        {#each $snapshots as s}
          <option value={s.id}>{s.name} ({s.created_at})</option>
        {/each}
      </select>
      <span class="vs">vs</span>
      <select bind:value={selectedB} class="input">
        <option value="">— Snapshot B —</option>
        {#each $snapshots as s}
          <option value={s.id}>{s.name} ({s.created_at})</option>
        {/each}
      </select>
      <button class="btn btn-primary" on:click={compareSelected}>Compare</button>
    </div>
  </div>

  {#if diffResult}
    <DiffView result={diffResult} />
  {/if}
</div>

<style>
  .version-manager {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .card {
    background: white;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    padding: 20px;
  }

  .card h3 {
    margin: 0 0 14px;
    font-size: 1rem;
  }

  .form-row {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-bottom: 10px;
    flex-wrap: wrap;
  }

  .input {
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 0.85rem;
    flex: 1;
    min-width: 150px;
    font-family: inherit;
  }

  textarea.input {
    width: 100%;
    resize: vertical;
    margin-bottom: 10px;
  }

  .snapshot-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 12px 0;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    gap: 12px;
  }

  .snapshot-item:last-child {
    border-bottom: none;
  }

  .snap-info strong {
    display: block;
    font-size: 0.9rem;
  }

  .snap-date, .snap-author {
    font-size: 0.75rem;
    color: var(--color-text-muted, #718096);
  }

  .snap-desc {
    margin: 4px 0 0;
    font-size: 0.8rem;
    color: var(--color-text-muted, #718096);
  }

  .snap-actions {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
  }

  .vs {
    font-weight: 600;
    color: var(--color-text-muted, #718096);
  }

  .empty {
    color: var(--color-text-muted, #718096);
    font-size: 0.85rem;
  }

  .btn {
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 500;
    white-space: nowrap;
  }

  .btn-primary { background: var(--color-primary, #1a365d); color: white; }
  .btn-secondary { background: #edf2f7; color: #2d3748; border: 1px solid #e2e8f0; }
  .btn-danger { background: #fff5f5; color: #c53030; border: 1px solid #feb2b2; }
  .btn-sm { padding: 4px 10px; font-size: 0.75rem; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
