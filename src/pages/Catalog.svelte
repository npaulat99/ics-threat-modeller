<script lang="ts">
  import CatalogBrowser from '$components/CatalogBrowser.svelte';

  function handleImport(_catalogId: string) {
    // Tree will be refreshed when user navigates to the tree view.
  }
</script>

<div class="catalog-page">
  <div class="page-header">
    <h2>Attack Tree Catalog</h2>
    <p class="subtitle">Pre-built attack tree templates with MITRE ATT&CK for ICS mappings.</p>
  </div>

  <CatalogBrowser onImport={handleImport} />
</div>

<style>
  .catalog-page { max-width: 1000px; margin: 0 auto; }
  .page-header { margin-bottom: 20px; }
  .page-header h2 { margin: 0 0 4px; font-size: 1.2rem; }
  .subtitle { margin: 0; font-size: 0.85rem; color: #718096; }
</style>
