<script lang="ts">
  import type {
    AttackerProfile,
    CreateAttackerProfile,
    UpdateAttackerProfile,
  } from "$lib/types";
  import { ACCESS_LABELS, SKILL_LABELS } from "$lib/types";
  import {
    currentProject,
    attackerProfiles,
    setError,
    setSuccess,
  } from "$lib/stores";
  import * as api from "$lib/api";
  import ConfirmDialog from "$components/ConfirmDialog.svelte";
  import { onMount } from "svelte";

  let showCreate = false;
  let editId: string | null = null;
  let deleteTarget: AttackerProfile | null = null;

  let formName = "";
  let formDesc = "";
  let formTag = "";
  let formSkillLevel = 3;
  let formAccessLevel = 3;

  onMount(loadProfiles);

  async function loadProfiles() {
    if (!$currentProject) return;
    try {
      const items = await api.listAttackerProfiles($currentProject.id);
      attackerProfiles.set(items);
    } catch (e) {
      setError(`Load failed: ${e}`);
    }
  }

  function resetForm() {
    formName = "";
    formDesc = "";
    formTag = "";
    formSkillLevel = 3;
    formAccessLevel = 3;
    editId = null;
    showCreate = false;
  }

  function editProfile(p: AttackerProfile) {
    editId = p.id;
    formName = p.name;
    formDesc = p.description;
    formTag = p.tag || "";
    formSkillLevel = p.skill_level;
    formAccessLevel = p.access_level;
    showCreate = true;
  }

  async function saveProfile() {
    if (!$currentProject || !formName.trim()) return;
    try {
      if (editId) {
        const data: UpdateAttackerProfile = {
          id: editId,
          name: formName,
          description: formDesc,
          tag: formTag,
          skill_level: formSkillLevel,
          access_level: formAccessLevel,
        };
        await api.updateAttackerProfile(data);
        setSuccess("Profile updated.");
      } else {
        const data: CreateAttackerProfile = {
          project_id: $currentProject.id,
          name: formName,
          description: formDesc,
          tag: formTag,
          skill_level: formSkillLevel,
          access_level: formAccessLevel,
        };
        await api.createAttackerProfile(data);
        setSuccess("Profile created.");
      }
      resetForm();
      await loadProfiles();
    } catch (e) {
      setError(`Save failed: ${e}`);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await api.deleteAttackerProfile(deleteTarget.id);
      setSuccess("Profile deleted.");
      deleteTarget = null;
      await loadProfiles();
    } catch (e) {
      setError(`Delete failed: ${e}`);
    }
  }

  const skillLabels = SKILL_LABELS;
  const accessLabels = ACCESS_LABELS;

  let filterTag = "";

  // Collect unique tags for filter dropdown
  $: uniqueTags = [
    ...new Set(
      $attackerProfiles.map((p) => p.tag).filter((t) => t && t.trim() !== ""),
    ),
  ].sort();

  $: filteredProfiles = filterTag
    ? $attackerProfiles.filter((p) => p.tag === filterTag)
    : $attackerProfiles;

  async function toggleActive(p: AttackerProfile) {
    try {
      await api.updateAttackerProfile({ id: p.id, is_active: !p.is_active });
      await loadProfiles();
    } catch (e) {
      setError(`Toggle failed: ${e}`);
    }
  }
</script>

<div class="profiles-page">
  <div class="page-header">
    <h2>Attacker Profiles</h2>
    <button
      class="btn btn-primary"
      on:click={() => {
        resetForm();
        showCreate = true;
      }}
    >
      + New Profile
    </button>
  </div>

  {#if showCreate}
    <div class="card form-card">
      <h3>{editId ? "Edit" : "Create"} Profile</h3>
      <div class="form-group">
        <label>Name *</label>
        <input
          class="input"
          bind:value={formName}
          placeholder="e.g., Nation-State Actor"
        />
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea class="input" rows="2" bind:value={formDesc} />
      </div>
      <div class="form-group">
        <label>Tag</label>
        <input
          class="input"
          bind:value={formTag}
          placeholder="e.g., External, Insider, APT"
        />
      </div>
      <div class="form-group">
        <label
          >Skill Level: {formSkillLevel} ({skillLabels[formSkillLevel - 1] ??
            ""})</label
        >
        <input
          type="range"
          min="1"
          max="5"
          bind:value={formSkillLevel}
          class="slider"
        />
      </div>
      <div class="form-group">
        <label
          >Access Level: {formAccessLevel} ({accessLabels[
            formAccessLevel - 1
          ] ?? ""})</label
        >
        <input
          type="range"
          min="1"
          max="5"
          bind:value={formAccessLevel}
          class="slider"
        />
      </div>
      <div class="form-actions">
        <button class="btn btn-secondary" on:click={resetForm}>Cancel</button>
        <button
          class="btn btn-primary"
          on:click={saveProfile}
          disabled={!formName.trim()}>Save</button
        >
      </div>
    </div>
  {/if}

  {#if uniqueTags.length > 0}
    <div class="filter-bar">
      <label class="filter-label">Filter by Tag:</label>
      <select class="input filter-select" bind:value={filterTag}>
        <option value="">All Profiles</option>
        {#each uniqueTags as tag}
          <option value={tag}>{tag}</option>
        {/each}
      </select>
      {#if filterTag}
        <button
          class="btn btn-sm btn-secondary"
          on:click={() => (filterTag = "")}>Clear</button
        >
      {/if}
    </div>
  {/if}

  <div class="profiles-list">
    {#each filteredProfiles as p (p.id)}
      <div class="profile-card" class:inactive={!p.is_active}>
        <div class="profile-header">
          <div class="profile-title-row">
            <label class="toggle-label" title="Include in assessments">
              <input
                type="checkbox"
                checked={p.is_active}
                on:change={() => toggleActive(p)}
              />
            </label>
            <h4>{p.name}</h4>
          </div>
          <span class="cap-badge"
            >Skill: {p.skill_level}/5 ({skillLabels[p.skill_level - 1] ??
              ""})</span
          >
        </div>
        <p class="profile-desc">{p.description || "—"}</p>
        {#if p.tag}
          <div class="profile-tag">
            <span class="tag-badge">🏷️ {p.tag}</span>
          </div>
        {/if}
        <div class="profile-meta">
          Access Level: {p.access_level}/5 ({accessLabels[p.access_level - 1] ??
            ""})
        </div>
        <div class="profile-actions">
          <button
            class="btn btn-sm btn-secondary"
            on:click={() => editProfile(p)}>Edit</button
          >
          <button
            class="btn btn-sm btn-danger"
            on:click={() => (deleteTarget = p)}>Delete</button
          >
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
  .profiles-page {
    max-width: 800px;
    margin: 0 auto;
  }
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  .page-header h2 {
    margin: 0;
    font-size: 1.2rem;
  }
  .card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
  }
  .card h3 {
    margin: 0 0 16px;
  }
  .form-group {
    margin-bottom: 12px;
  }
  .form-group label {
    display: block;
    font-size: 0.8rem;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .input {
    width: 100%;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 0.85rem;
    font-family: inherit;
  }
  .slider {
    width: 100%;
  }
  .form-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .profiles-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 12px;
  }
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    padding: 10px 14px;
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
  }
  .filter-label {
    font-size: 0.8rem;
    font-weight: 600;
    color: #4a5568;
    white-space: nowrap;
  }
  .filter-select {
    max-width: 220px;
  }
  .profile-card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px;
  }
  .profile-card.inactive {
    opacity: 0.55;
    background: #f7fafc;
  }
  .profile-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .toggle-label {
    cursor: pointer;
    display: flex;
    align-items: center;
  }
  .toggle-label input {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
  .profile-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  .profile-header h4 {
    margin: 0;
    font-size: 0.95rem;
  }
  .cap-badge {
    font-size: 0.7rem;
    background: #edf2f7;
    padding: 2px 8px;
    border-radius: 10px;
  }
  .profile-desc {
    margin: 0 0 8px;
    font-size: 0.82rem;
    color: #718096;
  }
  .profile-meta {
    font-size: 0.75rem;
    color: #a0aec0;
    margin-bottom: 4px;
  }
  .profile-tag {
    margin-bottom: 6px;
  }
  .tag-badge {
    font-size: 0.7rem;
    background: #ebf4ff;
    color: #2b6cb0;
    padding: 2px 8px;
    border-radius: 10px;
  }
  .profile-actions {
    display: flex;
    gap: 6px;
    margin-top: 10px;
  }
  .empty {
    text-align: center;
    color: #718096;
    padding: 40px;
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
    background: #1a365d;
    color: white;
  }
  .btn-secondary {
    background: #edf2f7;
    color: #2d3748;
    border: 1px solid #e2e8f0;
  }
  .btn-danger {
    background: #fff5f5;
    color: #c53030;
    border: 1px solid #feb2b2;
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
