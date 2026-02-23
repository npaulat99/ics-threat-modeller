<script lang="ts">
  import { push } from 'svelte-spa-router';
  import type { Project, CreateProject } from '$lib/types';
  import { DEFAULT_FACTOR_WEIGHTS } from '$lib/types';
  import { projects, currentProject, setError, setSuccess } from '$lib/stores';
  import * as api from '$lib/api';
  import ConfirmDialog from '$components/ConfirmDialog.svelte';
  import { onMount } from 'svelte';

  let showCreate = false;
  let newName = '';
  let newDesc = '';
  let newDeviceType = '';
  let newArchitecture = '';
  let newInterfaces = '';
  let newAssets = '';
  let deleteTarget: Project | null = null;

  onMount(loadProjects);

  async function loadProjects() {
    try {
      const list = await api.listProjects();
      projects.set(list);
    } catch (e) {
      setError(`Failed to load: ${e}`);
    }
  }

  async function createProject() {
    if (!newName.trim()) return;
    try {
      const data: CreateProject = {
        name: newName,
        description: newDesc || undefined,
        device_type: newDeviceType || undefined,
        architecture: newArchitecture || undefined,
        interfaces: newInterfaces || undefined,
        assets: newAssets || undefined,
        factor_weights: JSON.stringify(DEFAULT_FACTOR_WEIGHTS),
      };
      const project = await api.createProject(data);
      setSuccess(`Project "${project.name}" created.`);
      newName = '';
      newDesc = '';
      newDeviceType = '';
      newArchitecture = '';
      newInterfaces = '';
      newAssets = '';
      showCreate = false;
      await loadProjects();
    } catch (e) {
      setError(`Create failed: ${e}`);
    }
  }

  function openProject(p: Project) {
    currentProject.set(p);
    push('/project/tree');
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.deleteProject(deleteTarget.id);
      setSuccess(`Deleted "${deleteTarget.name}".`);
      deleteTarget = null;
      await loadProjects();
    } catch (e) {
      setError(`Delete failed: ${e}`);
    }
  }
</script>

<div class="projects-page">
  <div class="page-header">
    <h2>Projects</h2>
    <button class="btn btn-primary" on:click={() => (showCreate = !showCreate)}>
      {showCreate ? 'Cancel' : '+ New Project'}
    </button>
  </div>

  {#if showCreate}
    <div class="create-form card">
      <h3>Create New Project</h3>
      <div class="form-group">
        <label for="proj-name">Name *</label>
        <input id="proj-name" type="text" bind:value={newName} class="input" placeholder="e.g., PLC Security Assessment" />
      </div>
      <div class="form-group">
        <label for="proj-desc">Description</label>
        <textarea id="proj-desc" bind:value={newDesc} class="input" rows="3" placeholder="Project description..." />
      </div>
      <div class="form-group">
        <label for="proj-dev">Device Type</label>
        <input id="proj-dev" type="text" bind:value={newDeviceType} class="input" placeholder="e.g., Siemens S7-1200" />
      </div>
      <div class="form-group">
        <label for="proj-arch">Architecture</label>
        <input id="proj-arch" type="text" bind:value={newArchitecture} class="input" placeholder="e.g., ARM Cortex-M4" />
      </div>
      <div class="form-group">
        <label for="proj-intf">Interfaces (JSON)</label>
        <textarea id="proj-intf" bind:value={newInterfaces} class="input" rows="2" placeholder='e.g., ["Ethernet", "RS-485", "USB"]' />
      </div>
      <div class="form-group">
        <label for="proj-assets">Assets (JSON)</label>
        <textarea id="proj-assets" bind:value={newAssets} class="input" rows="2" placeholder='e.g., ["Firmware", "Configuration", "Process Data"]' />
      </div>
      <button class="btn btn-primary" on:click={createProject} disabled={!newName.trim()}>Create</button>
    </div>
  {/if}

  <div class="project-list">
    {#each $projects as project (project.id)}
      <div class="project-row">
        <div class="project-info" on:click={() => openProject(project)} on:keypress={() => openProject(project)} role="button" tabindex="0">
          <h4>{project.name}</h4>
          <p>{project.description || 'No description'}</p>
          <div class="project-meta">
            {#if project.device_type}
              <span class="meta-tag">🔧 {project.device_type}</span>
            {/if}
            <span class="meta-date">Updated: {project.updated_at}</span>
          </div>
        </div>
        <div class="project-actions">
          <button class="btn btn-sm btn-secondary" on:click={() => openProject(project)}>Open</button>
          <button class="btn btn-sm btn-danger" on:click={() => (deleteTarget = project)}>Delete</button>
        </div>
      </div>
    {:else}
      <p class="empty">No projects yet. Create one to get started.</p>
    {/each}
  </div>
</div>

<ConfirmDialog
  open={deleteTarget !== null}
  title="Delete Project"
  message="This will permanently delete the project and all its data. This cannot be undone."
  confirmLabel="Delete"
  danger
  on:confirm={confirmDelete}
  on:cancel={() => (deleteTarget = null)}
/>

<style>
  .projects-page { max-width: 800px; margin: 0 auto; }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .page-header h2 { margin: 0; font-size: 1.3rem; }

  .card {
    background: white;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }

  .card h3 { margin: 0 0 16px; font-size: 1rem; }

  .form-group {
    margin-bottom: 12px;
  }

  .form-group label {
    display: block;
    font-size: 0.82rem;
    font-weight: 600;
    margin-bottom: 4px;
    color: var(--color-text, #2d3748);
  }

  .input {
    width: 100%;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 0.85rem;
    font-family: inherit;
  }

  .project-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .project-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    padding: 16px;
    gap: 16px;
  }

  .project-info {
    flex: 1;
    cursor: pointer;
  }

  .project-info h4 { margin: 0 0 4px; font-size: 0.95rem; }
  .project-info p { margin: 0 0 6px; font-size: 0.82rem; color: var(--color-text-muted, #718096); }

  .project-meta {
    display: flex;
    gap: 16px;
    font-size: 0.72rem;
    color: var(--color-text-muted, #a0aec0);
  }

  .meta-tag { color: #4a5568; }

  .project-actions { display: flex; gap: 6px; flex-shrink: 0; }

  .empty { color: var(--color-text-muted, #718096); text-align: center; padding: 40px; }

  .btn { border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer; font-size: 0.85rem; font-weight: 500; }
  .btn-primary { background: var(--color-primary, #1a365d); color: white; }
  .btn-secondary { background: #edf2f7; color: #2d3748; border: 1px solid #e2e8f0; }
  .btn-danger { background: #fff5f5; color: #c53030; border: 1px solid #feb2b2; }
  .btn-sm { padding: 4px 10px; font-size: 0.75rem; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
