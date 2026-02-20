<script lang="ts">
  import { currentProject, setError, setSuccess } from '$lib/stores';
  import * as api from '$lib/api';

  let format: 'json' | 'yaml' = 'json';
  let importText = '';
  let exportOutput = '';
  let showImport = false;

  async function handleExport() {
    if (!$currentProject) return;
    try {
      if (format === 'json') {
        exportOutput = await api.exportProjectJson($currentProject.id);
      } else {
        exportOutput = await api.exportProjectYaml($currentProject.id);
      }
      setSuccess(`Exported project as ${format.toUpperCase()}`);
    } catch (e) {
      setError(`Export failed: ${e}`);
    }
  }

  async function handleImport() {
    if (!importText.trim()) {
      setError('Paste data to import.');
      return;
    }
    try {
      let projectId: string;
      if (format === 'json') {
        projectId = await api.importProjectJson(importText);
      } else {
        projectId = await api.importProjectYaml(importText);
      }
      setSuccess(`Imported project: ${projectId}`);
      importText = '';
      showImport = false;
    } catch (e) {
      setError(`Import failed: ${e}`);
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(exportOutput);
    setSuccess('Copied to clipboard');
  }
</script>

<div class="export-import">
  <div class="controls">
    <div class="format-select">
      <label>
        <input type="radio" bind:group={format} value="json" /> JSON
      </label>
      <label>
        <input type="radio" bind:group={format} value="yaml" /> YAML
      </label>
    </div>

    <div class="action-buttons">
      <button class="btn btn-primary" on:click={handleExport} disabled={!$currentProject}>
        Export Project
      </button>
      <button class="btn btn-secondary" on:click={() => (showImport = !showImport)}>
        {showImport ? 'Cancel Import' : 'Import Project'}
      </button>
    </div>
  </div>

  {#if showImport}
    <div class="import-section">
      <h4>Import Project Data ({format.toUpperCase()})</h4>
      <textarea
        class="data-area"
        placeholder="Paste {format.toUpperCase()} data here..."
        bind:value={importText}
        rows="12"
      ></textarea>
      <button class="btn btn-primary" on:click={handleImport}>Import</button>
    </div>
  {/if}

  {#if exportOutput}
    <div class="export-section">
      <div class="export-header">
        <h4>Exported Data</h4>
        <button class="btn btn-sm btn-secondary" on:click={copyToClipboard}>Copy</button>
      </div>
      <pre class="data-output">{exportOutput}</pre>
    </div>
  {/if}
</div>

<style>
  .export-import {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 16px;
    padding: 16px;
    background: white;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
  }

  .format-select {
    display: flex;
    gap: 16px;
  }

  .format-select label {
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .action-buttons {
    display: flex;
    gap: 8px;
  }

  .import-section, .export-section {
    background: white;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    padding: 16px;
  }

  .import-section h4, .export-section h4 {
    margin: 0 0 12px;
    font-size: 0.9rem;
  }

  .export-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .export-header h4 { margin: 0; }

  .data-area {
    width: 100%;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 4px;
    padding: 10px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 0.8rem;
    resize: vertical;
    margin-bottom: 12px;
  }

  .data-output {
    background: #1a202c;
    color: #e2e8f0;
    padding: 16px;
    border-radius: 6px;
    font-size: 0.75rem;
    overflow-x: auto;
    max-height: 500px;
    white-space: pre-wrap;
    word-break: break-word;
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
    background: var(--color-secondary, #edf2f7);
    color: var(--color-text, #2d3748);
    border: 1px solid var(--color-border, #e2e8f0);
  }

  .btn-sm {
    padding: 4px 10px;
    font-size: 0.75rem;
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
