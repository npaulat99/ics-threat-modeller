<script lang="ts">
  import ExportImportDialog from '$components/ExportImportDialog.svelte';
</script>

<div class="export-page">
  <div class="page-header">
    <h2>Export / Import</h2>
    <p class="subtitle">Export your project data or import from external sources.</p>
  </div>

  <ExportImportDialog />
</div>

<style>
  .export-page { max-width: 900px; margin: 0 auto; }
  .page-header { margin-bottom: 20px; }
  .page-header h2 { margin: 0 0 4px; font-size: 1.2rem; }
  .subtitle { margin: 0; font-size: 0.85rem; color: #718096; }
</style>
