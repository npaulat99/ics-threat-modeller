<script lang="ts">
  import Router from "svelte-spa-router";
  import Layout from "$components/Layout.svelte";
  import Sidebar from "$components/Sidebar.svelte";
  import {
    errorMessage,
    successMessage,
    currentProject,
    projectName,
  } from "$lib/stores";

  import Home from "$pages/Home.svelte";
  import ProjectList from "$pages/ProjectList.svelte";
  import ProjectDetail from "$pages/ProjectDetail.svelte";
  import AttackerProfiles from "$pages/AttackerProfiles.svelte";
  import AttackTree from "$pages/AttackTree.svelte";
  import Assessment from "$pages/Assessment.svelte";
  import Catalog from "$pages/Catalog.svelte";
  import ExportImport from "$pages/ExportImport.svelte";
  import Versions from "$pages/Versions.svelte";
  import AttackVectors from "$pages/AttackVectors.svelte";
  import Dashboard from "$pages/Dashboard.svelte";

  const routes = {
    "/": Home,
    "/projects": ProjectList,
    "/project/settings": ProjectDetail,
    "/project/profiles": AttackerProfiles,
    "/project/tree": AttackTree,
    "/project/vectors": AttackVectors,
    "/project/assessment": Assessment,
    "/project/dashboard": Dashboard,
    "/project/catalog": Catalog,
    "/project/export": ExportImport,
    "/project/versions": Versions,
  };
</script>

<Layout title="ICS Threat Modeller">
  <svelte:fragment slot="sidebar">
    <Sidebar />
  </svelte:fragment>

  <svelte:fragment slot="header-actions">
    {#if $currentProject}
      <a href="#/project/settings" class="project-link">
        ⚙ {$projectName}
      </a>
    {/if}
  </svelte:fragment>

  <Router {routes} />

  <svelte:fragment slot="status">
    {#if $currentProject}
      Project: {$projectName}
    {:else}
      No project open
    {/if}
  </svelte:fragment>
</Layout>

{#if $errorMessage}
  <div class="toast toast-error" role="alert">
    <span>⚠ {$errorMessage}</span>
    <button on:click={() => errorMessage.set(null)}>×</button>
  </div>
{/if}

{#if $successMessage}
  <div class="toast toast-success" role="status">
    <span>✓ {$successMessage}</span>
    <button on:click={() => successMessage.set(null)}>×</button>
  </div>
{/if}

<style>
  .project-link {
    color: rgba(255, 255, 255, 0.85);
    text-decoration: none;
    font-size: 0.82rem;
    padding: 4px 10px;
    border-radius: 4px;
    transition: background 0.15s;
  }

  .project-link:hover {
    background: rgba(255, 255, 255, 0.15);
    color: white;
  }

  .toast {
    position: fixed;
    bottom: 40px;
    right: 20px;
    padding: 10px 18px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 0.85rem;
    z-index: 2000;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease;
  }

  .toast button {
    background: none;
    border: none;
    font-size: 1.1rem;
    cursor: pointer;
    opacity: 0.7;
    color: inherit;
  }

  .toast-error {
    background: #fed7d7;
    color: #c53030;
    border: 1px solid #fc8181;
  }

  .toast-success {
    background: #c6f6d5;
    color: #276749;
    border: 1px solid #68d391;
  }

  @keyframes slideIn {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>
