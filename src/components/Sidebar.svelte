<script lang="ts">
  import { push } from "svelte-spa-router";
  import { currentProject, activeTab, projectName } from "$lib/stores";

  const navItems = [
    { id: "tree", label: "Attack Tree", icon: "🌳", path: "/project/tree" },
    {
      id: "vectors",
      label: "Attack Vectors",
      icon: "⚔️",
      path: "/project/vectors",
    },
    {
      id: "assess",
      label: "Assessment",
      icon: "📊",
      path: "/project/assessment",
    },
    {
      id: "profiles",
      label: "Attacker Profiles",
      icon: "👤",
      path: "/project/profiles",
    },
    { id: "catalog", label: "Catalog", icon: "📚", path: "/project/catalog" },
    {
      id: "export",
      label: "Export / Import",
      icon: "📦",
      path: "/project/export",
    },
    {
      id: "versions",
      label: "Versions",
      icon: "📋",
      path: "/project/versions",
    },
  ];

  function navigate(item: (typeof navItems)[0]) {
    if ($currentProject) {
      activeTab.set(item.id);
      push(item.path);
    }
  }
</script>

<nav class="sidebar-nav">
  <div class="project-info">
    {#if $currentProject}
      <div class="project-label">Project</div>
      <div class="project-name">{$projectName}</div>
    {:else}
      <div class="project-label">No project open</div>
    {/if}
  </div>

  <div class="nav-section-label">Navigation</div>

  <button class="nav-item" on:click={() => push("/")}>
    <span class="nav-icon">🏠</span>
    <span>Home</span>
  </button>

  <button class="nav-item" on:click={() => push("/projects")}>
    <span class="nav-icon">📁</span>
    <span>Projects</span>
  </button>

  {#if $currentProject}
    <div class="nav-section-label">Analysis</div>
    {#each navItems as item}
      <button
        class="nav-item"
        class:active={$activeTab === item.id}
        on:click={() => navigate(item)}
      >
        <span class="nav-icon">{item.icon}</span>
        <span>{item.label}</span>
      </button>
    {/each}
  {/if}
</nav>

<style>
  .sidebar-nav {
    display: flex;
    flex-direction: column;
    padding: 8px 0;
  }

  .project-info {
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    margin-bottom: 8px;
  }

  .project-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    color: var(--color-text-muted, #718096);
    letter-spacing: 0.05em;
  }

  .project-name {
    font-weight: 600;
    font-size: 0.9rem;
    margin-top: 2px;
    color: var(--color-text, #2d3748);
  }

  .nav-section-label {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted, #718096);
    padding: 12px 16px 4px;
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    border: none;
    background: none;
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--color-text, #2d3748);
    text-align: left;
    width: 100%;
    transition: background 0.15s;
  }

  .nav-item:hover {
    background: var(--color-hover, #edf2f7);
  }

  .nav-item.active {
    background: var(--color-active, #e2e8f0);
    font-weight: 600;
    border-left: 3px solid var(--color-primary, #1a365d);
  }

  .nav-icon {
    font-size: 1.1rem;
    width: 24px;
    text-align: center;
  }
</style>
