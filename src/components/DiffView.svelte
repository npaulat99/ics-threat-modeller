<script lang="ts">
  import type { DiffResult } from '$lib/types';

  export let result: DiffResult;

  const changeColors: Record<string, string> = {
    added: '#c6f6d5',
    removed: '#fed7d7',
    modified: '#fefcbf',
  };

  const changeIcons: Record<string, string> = {
    added: '+',
    removed: '−',
    modified: '~',
  };
</script>

<div class="diff-view">
  <h3>Diff Results ({result.changes.length} changes)</h3>

  {#if result.changes.length === 0}
    <p class="no-changes">No differences found between the snapshots.</p>
  {:else}
    {#each result.changes as change}
      <div class="diff-entry" style="border-left-color: {changeColors[change.change_type] ?? '#e2e8f0'}">
        <div class="diff-header">
          <span class="change-icon" style="background: {changeColors[change.change_type] ?? '#e2e8f0'}">
            {changeIcons[change.change_type] ?? '?'}
          </span>
          <span class="entity-type">{change.entity_type}</span>
          <span class="entity-name">{change.entity_name || change.entity_id}</span>
          <span class="change-type">{change.change_type}</span>
        </div>

        {#if change.field_changes.length > 0}
          <table class="field-changes">
            <thead>
              <tr>
                <th>Field</th>
                <th>Old</th>
                <th>New</th>
              </tr>
            </thead>
            <tbody>
              {#each change.field_changes as fc}
                <tr>
                  <td class="field-name">{fc.field}</td>
                  <td class="old-value">{fc.old_value ?? '—'}</td>
                  <td class="new-value">{fc.new_value ?? '—'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .diff-view {
    background: white;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    padding: 20px;
  }

  .diff-view h3 {
    margin: 0 0 16px;
    font-size: 1rem;
  }

  .no-changes {
    color: var(--color-text-muted, #718096);
    text-align: center;
    padding: 20px;
  }

  .diff-entry {
    border-left: 4px solid #e2e8f0;
    padding: 12px;
    margin-bottom: 12px;
    border-radius: 0 6px 6px 0;
    background: #fafafa;
  }

  .diff-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    flex-wrap: wrap;
  }

  .change-icon {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.9rem;
  }

  .entity-type {
    font-size: 0.7rem;
    text-transform: uppercase;
    background: #e2e8f0;
    padding: 1px 6px;
    border-radius: 8px;
    color: #4a5568;
    font-weight: 600;
  }

  .entity-name {
    font-weight: 600;
    font-size: 0.85rem;
  }

  .change-type {
    font-size: 0.7rem;
    text-transform: uppercase;
    color: var(--color-text-muted, #718096);
    margin-left: auto;
  }

  .field-changes {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
    margin-top: 6px;
  }

  .field-changes th,
  .field-changes td {
    padding: 4px 8px;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
  }

  .field-changes th {
    font-weight: 600;
    color: var(--color-text-muted, #718096);
    font-size: 0.7rem;
  }

  .field-name {
    font-weight: 500;
    color: #4a5568;
  }

  .old-value {
    color: #c53030;
    font-family: 'Consolas', monospace;
    font-size: 0.75rem;
    word-break: break-all;
  }

  .new-value {
    color: #276749;
    font-family: 'Consolas', monospace;
    font-size: 0.75rem;
    word-break: break-all;
  }
</style>
