<script lang="ts">
  import VersionManager from '$components/VersionManager.svelte';
</script>

<div class="versions-page">
  <div class="page-header">
    <h2>Version Management</h2>
    <p class="subtitle">Create snapshots, compare versions, and track changes.</p>
  </div>

  <VersionManager />
</div>

<style>
  .versions-page { max-width: 900px; margin: 0 auto; }
  .page-header { margin-bottom: 20px; }
  .page-header h2 { margin: 0 0 4px; font-size: 1.2rem; }
  .subtitle { margin: 0; font-size: 0.85rem; color: #718096; }
</style>
