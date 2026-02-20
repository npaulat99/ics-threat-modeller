<script lang="ts">
  import type { AttackerProfile, CreateAttackerProfile, UpdateAttackerProfile } from '$lib/types';
  import { currentProject, attackerProfiles, setError, setSuccess } from '$lib/stores';
  import * as api from '$lib/api';
  import ConfirmDialog from '$components/ConfirmDialog.svelte';
  import { onMount } from 'svelte';

  let showCreate = false;
  let editId: string | null = null;
  let deleteTarget: AttackerProfile | null = null;

  let formName = '';
  let formDesc = '';
  let formMotivation = '';
  let formCapability = 5;
  let formResources = '';

  onMount(loadProfiles);

  async function loadProfiles() {
    if (!$currentProject) return;
    try {
      const items = await api.listAttackerProfiles($currentProject.id);
      attackerProfiles.set(items);
    } catch (e) { setError(`Load failed: ${e}`); }
  }

  function resetForm() {
    formName = '';
    formDesc = '';
    formMotivation = '';
    formCapability = 5;
    formResources = '';
    editId = null;
    showCreate = false;
  }

  function editProfile(p: AttackerProfile) {
    editId = p.id;
    formName = p.name;
    formDesc = p.description;
    formMotivation = p.motivation;
    formCapability = p.capability_level;
    formResources = p.resources;
    showCreate = true;
  }

  async function saveProfile() {
    if (!$currentProject || !formName.trim()) return;
    try {
      if (editId) {
        const data: UpdateAttackerProfile = {
          id: editId, name: formName, description: formDesc,
          motivation: formMotivation, capability_level: formCapability, resources: formResources,
        };
        await api.updateAttackerProfile(data);
        setSuccess('Profile updated.');
      } else {
        const data: CreateAttackerProfile = {
          project_id: $currentProject.id, name: formName, description: formDesc,
          motivation: formMotivation, capability_level: formCapability, resources: formResources,
        };
        await api.createAttackerProfile(data);
        setSuccess('Profile created.');
      }
      resetForm();
      await loadProfiles();
    } catch (e) { setError(`Save failed: ${e}`); }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.deleteAttackerProfile(deleteTarget.id);
      setSuccess('Profile deleted.');
      deleteTarget = null;
      await loadProfiles();
    } catch (e) { setError(`Delete failed: ${e}`); }
  }

  const capLabels = ['Script Kiddie', 'Hobbyist', 'Competent', 'Professional', 'Expert', 'Expert', 'Nation State', 'Nation State', 'APT', 'APT', 'Elite APT'];
</script>

<div class="profiles-page">
  <div class="page-header">
    <h2>Attacker Profiles</h2>
    <button class="btn btn-primary" on:click={() => { resetForm(); showCreate = true; }}>
      + New Profile
    </button>
  </div>

  {#if showCreate}
    <div class="card form-card">
      <h3>{editId ? 'Edit' : 'Create'} Profile</h3>
      <div class="form-group">
        <label>Name *</label>
        <input class="input" bind:value={formName} placeholder="e.g., Nation-State Actor" />
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea class="input" rows="2" bind:value={formDesc} />
      </div>
      <div class="form-group">
        <label>Motivation</label>
        <input class="input" bind:value={formMotivation} placeholder="e.g., Espionage, Sabotage" />
      </div>
      <div class="form-group">
        <label>Capability Level: {formCapability} ({capLabels[formCapability] ?? ''})</label>
        <input type="range" min="0" max="10" bind:value={formCapability} class="slider" />
      </div>
      <div class="form-group">
        <label>Resources</label>
        <input class="input" bind:value={formResources} placeholder="e.g., Significant funding, zero-day exploits" />
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" on:click={resetForm}>Cancel</button>
        <button class="btn btn-primary" on:click={saveProfile} disabled={!formName.trim()}>Save</button>
      </div>
    </div>
  {/if}

  <div class="profiles-list">
    {#each $attackerProfiles as p (p.id)}
      <div class="profile-card">
        <div class="profile-header">
          <h4>{p.name}</h4>
          <span class="cap-badge">Cap: {p.capability_level}/10</span>
        </div>
        <p class="profile-desc">{p.description || '—'}</p>
        {#if p.motivation}
          <div class="profile-meta">Motivation: {p.motivation}</div>
        {/if}
        {#if p.resources}
          <div class="profile-meta">Resources: {p.resources}</div>
        {/if}
        <div class="profile-actions">
          <button class="btn btn-sm btn-secondary" on:click={() => editProfile(p)}>Edit</button>
          <button class="btn btn-sm btn-danger" on:click={() => (deleteTarget = p)}>Delete</button>
        </div>
      </div>
    {:else}
      <p class="empty">No attacker profiles defined.</p>
    {/each}
  </div>
</div>

<ConfirmDialog
  open={deleteTarget !== null}
  title="Delete Profile"
  message="Delete this attacker profile?"
  confirmLabel="Delete"
  danger
  on:confirm={confirmDelete}
  on:cancel={() => (deleteTarget = null)}
/>

<style>
  .profiles-page { max-width: 800px; margin: 0 auto; }
  .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .page-header h2 { margin: 0; font-size: 1.2rem; }
  .card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
  .card h3 { margin: 0 0 16px; }
  .form-group { margin-bottom: 12px; }
  .form-group label { display: block; font-size: 0.8rem; font-weight: 600; margin-bottom: 4px; }
  .input { width: 100%; border: 1px solid #e2e8f0; border-radius: 4px; padding: 8px 12px; font-size: 0.85rem; font-family: inherit; }
  .slider { width: 100%; }
  .form-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .profiles-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
  .profile-card { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
  .profile-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .profile-header h4 { margin: 0; font-size: 0.95rem; }
  .cap-badge { font-size: 0.7rem; background: #edf2f7; padding: 2px 8px; border-radius: 10px; }
  .profile-desc { margin: 0 0 8px; font-size: 0.82rem; color: #718096; }
  .profile-meta { font-size: 0.75rem; color: #a0aec0; margin-bottom: 4px; }
  .profile-actions { display: flex; gap: 6px; margin-top: 10px; }
  .empty { text-align: center; color: #718096; padding: 40px; }
  .btn { border: none; border-radius: 4px; padding: 8px 16px; cursor: pointer; font-size: 0.85rem; font-weight: 500; }
  .btn-primary { background: #1a365d; color: white; }
  .btn-secondary { background: #edf2f7; color: #2d3748; border: 1px solid #e2e8f0; }
  .btn-danger { background: #fff5f5; color: #c53030; border: 1px solid #feb2b2; }
  .btn-sm { padding: 4px 10px; font-size: 0.75rem; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
