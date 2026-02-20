<script lang="ts">
  import { sidebarOpen } from '$lib/stores';

  export let title = 'ICS Threat Modeller';
</script>

<div class="layout" class:sidebar-collapsed={!$sidebarOpen}>
  <header class="top-bar">
    <button class="menu-toggle" on:click={() => sidebarOpen.update(v => !v)}>
      ☰
    </button>
    <h1 class="app-title">{title}</h1>
    <div class="spacer"></div>
    <slot name="header-actions" />
  </header>

  <aside class="sidebar" class:collapsed={!$sidebarOpen}>
    <slot name="sidebar" />
  </aside>

  <main class="content">
    <slot />
  </main>

  <footer class="status-bar">
    <slot name="status" />
  </footer>
</div>

<style>
  .layout {
    display: grid;
    grid-template-rows: 48px 1fr 28px;
    grid-template-columns: 280px 1fr;
    grid-template-areas:
      'header header'
      'sidebar content'
      'footer footer';
    height: 100vh;
    overflow: hidden;
  }

  .layout.sidebar-collapsed {
    grid-template-columns: 0px 1fr;
  }

  .top-bar {
    grid-area: header;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 16px;
    background: var(--color-primary, #1a365d);
    color: white;
    z-index: 10;
  }

  .menu-toggle {
    background: none;
    border: none;
    color: white;
    font-size: 1.25rem;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
  }

  .menu-toggle:hover {
    background: rgba(255,255,255,0.15);
  }

  .app-title {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0;
    white-space: nowrap;
  }

  .spacer { flex: 1; }

  .sidebar {
    grid-area: sidebar;
    background: var(--color-sidebar-bg, #f7fafc);
    border-right: 1px solid var(--color-border, #e2e8f0);
    overflow-y: auto;
    transition: width 0.2s;
  }

  .sidebar.collapsed {
    width: 0;
    overflow: hidden;
    border: none;
  }

  .content {
    grid-area: content;
    overflow-y: auto;
    padding: 24px;
    background: var(--color-bg, #ffffff);
  }

  .status-bar {
    grid-area: footer;
    display: flex;
    align-items: center;
    padding: 0 16px;
    background: var(--color-footer-bg, #edf2f7);
    border-top: 1px solid var(--color-border, #e2e8f0);
    font-size: 0.75rem;
    color: var(--color-text-muted, #718096);
  }
</style>
