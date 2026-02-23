<script lang="ts">
  import { push } from 'svelte-spa-router';
  import { projects, currentProject, setError } from '$lib/stores';
  import * as api from '$lib/api';
  import { onMount } from 'svelte';

  onMount(loadProjects);

  async function loadProjects() {
    try {
      const list = await api.listProjects();
      projects.set(list);
    } catch (e) {
      setError(`Failed to load projects: ${e}`);
    }
  }

  function openProject(p: typeof $projects[0]) {
    currentProject.set(p);
    push('/project/tree');
  }
</script>

<div class="home-page">
  <div class="hero">
    <h1>ICS Threat Modeller</h1>
    <p class="subtitle">
      Attack-tree based threat assessment for Industrial Control Systems and embedded devices.
    </p>
    <div class="hero-actions">
      <button class="btn btn-primary btn-lg" on:click={() => push('/projects')}>
        Open Projects
      </button>
    </div>
  </div>

  <div class="features">
    <div class="feature-card">
      <div class="feature-icon">🌳</div>
      <h3>Attack Trees</h3>
      <p>Build hierarchical attack trees with goals, steps, and sub-steps. Organize with AND/OR conjunctions.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">📊</div>
      <h3>Probability Assessment</h3>
      <p>Quantitative assessment using cost factors: elapsed time, expertise, knowledge, opportunity, and equipment.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">🛡️</div>
      <h3>Countermeasures</h3>
      <p>Document countermeasures and weaknesses for each attack step. Track effectiveness ratings.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">📚</div>
      <h3>Catalog</h3>
      <p>Pre-built attack tree templates with MITRE ATT&CK for ICS mappings. Import into any project.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">📦</div>
      <h3>Export / Import</h3>
      <p>Export projects as JSON or YAML. Import data to share between teams and tools.</p>
    </div>
    <div class="feature-card">
      <div class="feature-icon">📋</div>
      <h3>Versioning</h3>
      <p>Create snapshots, compare versions, and track changes over time with semantic diffing.</p>
    </div>
  </div>

  {#if $projects.length > 0}
    <div class="recent-projects">
      <h2>Recent Projects</h2>
      <div class="project-cards">
        {#each $projects.slice(0, 4) as project}
          <button class="project-card" on:click={() => openProject(project)}>
            <h4>{project.name}</h4>
            <p>{project.description || 'No description'}</p>
            <span class="card-date">{project.updated_at}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <div class="db-info">
    <p>💾 Database: <code>ics_threat_modeller.db</code> in the application's working directory. Use any SQLite client (e.g. <code>sqlite3</code>, DB Browser) to access it directly.</p>
  </div>
</div>

<style>
  .home-page {
    max-width: 1000px;
    margin: 0 auto;
  }

  .hero {
    text-align: center;
    padding: 40px 0;
  }

  .hero h1 {
    font-size: 2rem;
    color: var(--color-primary, #1a365d);
    margin: 0 0 8px;
  }

  .subtitle {
    color: var(--color-text-muted, #718096);
    font-size: 1rem;
    margin: 0 0 24px;
  }

  .hero-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
  }

  .features {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
    margin-bottom: 40px;
  }

  .feature-card {
    background: white;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    padding: 20px;
    text-align: center;
  }

  .feature-icon {
    font-size: 2rem;
    margin-bottom: 8px;
  }

  .feature-card h3 {
    margin: 0 0 6px;
    font-size: 0.95rem;
  }

  .feature-card p {
    margin: 0;
    font-size: 0.82rem;
    color: var(--color-text-muted, #718096);
    line-height: 1.5;
  }

  .recent-projects h2 {
    font-size: 1.1rem;
    margin: 0 0 12px;
  }

  .project-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .project-card {
    background: white;
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 8px;
    padding: 16px;
    cursor: pointer;
    text-align: left;
    transition: box-shadow 0.15s;
    width: 100%;
  }

  .project-card:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  }

  .project-card h4 {
    margin: 0 0 4px;
    font-size: 0.9rem;
  }

  .project-card p {
    margin: 0;
    font-size: 0.78rem;
    color: var(--color-text-muted, #718096);
  }

  .card-date {
    font-size: 0.7rem;
    color: var(--color-text-muted, #a0aec0);
  }

  .btn {
    border: none;
    border-radius: 6px;
    padding: 10px 24px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .btn-primary { background: var(--color-primary, #1a365d); color: white; }
  .btn-lg { padding: 12px 32px; font-size: 1rem; }

  .db-info {
    margin-top: 40px;
    padding: 12px 16px;
    background: #f7fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    text-align: center;
  }

  .db-info p {
    margin: 0;
    font-size: 0.78rem;
    color: #718096;
  }

  .db-info code {
    background: #edf2f7;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 0.78rem;
  }
</style>
