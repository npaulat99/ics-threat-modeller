<script lang="ts">
    import type { Goal, AttackPath, AttackerProfile } from "$lib/types";
    import { currentProject, setError } from "$lib/stores";
    import { formatProbability, getSeverityLabel } from "$lib/calculations";
    import * as api from "$lib/api";
    import { onMount } from "svelte";

    const accessLabels = [
        "Public",
        "Limited",
        "Moderate",
        "Privileged",
        "Unrestricted",
    ];
    const skillLabels = ["Novice", "Beginner", "Competent", "Expert", "Master"];

    let goalList: Goal[] = [];
    let profiles: AttackerProfile[] = [];
    let selectedProfileId = "";
    $: selectedProfile =
        profiles.find((p) => p.id === selectedProfileId) ?? null;

    // All vectors grouped by goal
    let vectorsByGoal: { goal: Goal; paths: AttackPath[] }[] = [];
    let loading = false;

    // Sorting
    let sortBy: "probability" | "steps" | "access" | "skill" = "probability";
    let sortAsc = false;

    // Filter
    let showOnlyRealistic = false;

    onMount(async () => {
        if (!$currentProject) return;
        loading = true;
        try {
            goalList = await api.listGoals($currentProject.id);
            profiles = await api.listAttackerProfiles($currentProject.id);
        } catch (e) {
            setError(`Load failed: ${e}`);
        }
        await loadAllVectors();
        loading = false;
    });

    async function loadAllVectors() {
        if (!$currentProject) return;
        const skill = selectedProfile?.skill_level;
        const access = selectedProfile?.access_level;
        const results: typeof vectorsByGoal = [];

        for (const g of goalList) {
            try {
                const paths = await api.calculateAttackPaths(
                    $currentProject.id,
                    g.id,
                    skill,
                    access,
                );
                if (paths.length > 0) {
                    results.push({ goal: g, paths });
                }
            } catch {
                /* skip */
            }
        }
        vectorsByGoal = results;
    }

    async function onSelectProfile(id: string) {
        selectedProfileId = id;
        loading = true;
        await loadAllVectors();
        loading = false;
    }

    function sortedPaths(paths: AttackPath[]): AttackPath[] {
        let filtered = showOnlyRealistic
            ? paths.filter((p) => p.is_realistic)
            : paths;
        const sorted = [...filtered].sort((a, b) => {
            let cmp = 0;
            switch (sortBy) {
                case "probability":
                    cmp = a.overall_probability - b.overall_probability;
                    break;
                case "steps":
                    cmp = a.steps.length - b.steps.length;
                    break;
                case "access":
                    cmp = a.max_access_level - b.max_access_level;
                    break;
                case "skill":
                    cmp = a.max_skill_level - b.max_skill_level;
                    break;
            }
            return sortAsc ? cmp : -cmp;
        });
        return sorted;
    }

    function toggleSort(col: typeof sortBy) {
        if (sortBy === col) {
            sortAsc = !sortAsc;
        } else {
            sortBy = col;
            sortAsc = false;
        }
    }

    $: totalVectors = vectorsByGoal.reduce((sum, g) => sum + g.paths.length, 0);
    $: realisticVectors = vectorsByGoal.reduce(
        (sum, g) => sum + g.paths.filter((p) => p.is_realistic).length,
        0,
    );
    $: highRiskVectors = vectorsByGoal.reduce(
        (sum, g) =>
            sum + g.paths.filter((p) => p.overall_probability > 0.3).length,
        0,
    );
</script>

<div class="vectors-page">
    <div class="page-header">
        <h2>Attack Vectors</h2>
        <div class="header-stats">
            <span class="stat-chip">{totalVectors} total vectors</span>
            <span class="stat-chip realistic">{realisticVectors} realistic</span
            >
            <span class="stat-chip high-risk">{highRiskVectors} high risk</span>
        </div>
    </div>

    <!-- Attacker Profile Filter -->
    {#if profiles.length > 0}
        <div class="profile-bar">
            <span class="bar-label">Attacker:</span>
            <button
                class="chip"
                class:active={selectedProfileId === ""}
                on:click={() => onSelectProfile("")}
            >
                👤 All
            </button>
            {#each profiles as p (p.id)}
                <button
                    class="chip"
                    class:active={selectedProfileId === p.id}
                    on:click={() => onSelectProfile(p.id)}
                    title="{p.name}: Skill {p.skill_level}/5, Access {p.access_level}/5"
                >
                    🎭 {p.name}
                </button>
            {/each}
        </div>
    {/if}

    <!-- Controls -->
    <div class="controls-bar">
        <label class="toggle-realistic">
            <input type="checkbox" bind:checked={showOnlyRealistic} />
            Show only realistic paths
        </label>
        <div class="sort-controls">
            <span class="sort-label">Sort:</span>
            <button
                class="sort-btn"
                class:active={sortBy === "probability"}
                on:click={() => toggleSort("probability")}
            >
                Probability {sortBy === "probability"
                    ? sortAsc
                        ? "↑"
                        : "↓"
                    : ""}
            </button>
            <button
                class="sort-btn"
                class:active={sortBy === "steps"}
                on:click={() => toggleSort("steps")}
            >
                Steps {sortBy === "steps" ? (sortAsc ? "↑" : "↓") : ""}
            </button>
            <button
                class="sort-btn"
                class:active={sortBy === "skill"}
                on:click={() => toggleSort("skill")}
            >
                Skill {sortBy === "skill" ? (sortAsc ? "↑" : "↓") : ""}
            </button>
            <button
                class="sort-btn"
                class:active={sortBy === "access"}
                on:click={() => toggleSort("access")}
            >
                Access {sortBy === "access" ? (sortAsc ? "↑" : "↓") : ""}
            </button>
        </div>
    </div>

    {#if loading}
        <div class="loading">Loading attack vectors...</div>
    {:else if vectorsByGoal.length === 0}
        <div class="empty">
            No attack vectors found. Create goals and steps in the Attack Tree,
            then add assessments.
        </div>
    {:else}
        {#each vectorsByGoal as { goal, paths } (goal.id)}
            {@const sorted = sortedPaths(paths)}
            {#if sorted.length > 0}
                <div class="goal-section">
                    <div class="goal-header">
                        <span class="goal-icon">🎯</span>
                        <span class="goal-name">{goal.name}</span>
                        <span class="goal-count"
                            >{sorted.length} vector{sorted.length !== 1
                                ? "s"
                                : ""}</span
                        >
                    </div>

                    <div class="vector-list">
                        {#each sorted as path, idx (path.path_id)}
                            <div
                                class="vector-card"
                                class:unrealistic={!path.is_realistic}
                            >
                                <div class="vector-header-row">
                                    <span class="vector-num">#{idx + 1}</span>
                                    <span
                                        class="severity-badge {getSeverityLabel(
                                            path.overall_probability,
                                        ).toLowerCase()}"
                                    >
                                        {getSeverityLabel(
                                            path.overall_probability,
                                        )}
                                    </span>
                                    <span class="vector-prob"
                                        >{formatProbability(
                                            path.overall_probability,
                                        )}</span
                                    >
                                    {#if !path.is_realistic}
                                        <span class="unrealistic-badge"
                                            >Unrealistic</span
                                        >
                                    {/if}
                                </div>

                                <div class="vector-chain">
                                    {#each path.steps as step, j}
                                        <div class="chain-step">
                                            <div
                                                class="step-node"
                                                title="P(cost)={formatProbability(
                                                    step.cost_probability,
                                                )}"
                                            >
                                                <span class="step-icon"
                                                    >{step.entity_type ===
                                                    "substep"
                                                        ? "🔹"
                                                        : "⚡"}</span
                                                >
                                                <span class="step-label"
                                                    >{step.name}</span
                                                >
                                            </div>
                                            <div class="step-meta">
                                                <span
                                                    class="meta-tag"
                                                    title="Access Level"
                                                    >🔑 {accessLabels[
                                                        step.access_level - 1
                                                    ]}</span
                                                >
                                                <span
                                                    class="meta-tag"
                                                    title="Skill Level"
                                                    >🎓 {skillLabels[
                                                        step.skill_level - 1
                                                    ]}</span
                                                >
                                                <span
                                                    class="meta-tag prob"
                                                    title="Cost Probability"
                                                    >P: {formatProbability(
                                                        step.cost_probability,
                                                    )}</span
                                                >
                                            </div>
                                        </div>
                                        {#if j < path.steps.length - 1}
                                            <div class="chain-arrow">→</div>
                                        {/if}
                                    {/each}
                                </div>

                                <div class="vector-summary">
                                    <span
                                        >P(access): {formatProbability(
                                            path.access_probability,
                                        )}</span
                                    >
                                    <span
                                        >P(cost): {formatProbability(
                                            path.cost_probability,
                                        )}</span
                                    >
                                    <span
                                        >Max Skill: {path.max_skill_level}/5</span
                                    >
                                    <span
                                        >Max Access: {path.max_access_level}/5</span
                                    >
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        {/each}
    {/if}
</div>

<style>
    .vectors-page {
        max-width: 1100px;
        margin: 0 auto;
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }
    .page-header h2 {
        margin: 0;
        font-size: 1.2rem;
    }

    .header-stats {
        display: flex;
        gap: 8px;
    }

    .stat-chip {
        font-size: 0.72rem;
        padding: 3px 10px;
        border-radius: 12px;
        background: #edf2f7;
        color: #4a5568;
        font-weight: 600;
    }
    .stat-chip.realistic {
        background: #c6f6d5;
        color: #22543d;
    }
    .stat-chip.high-risk {
        background: #fed7d7;
        color: #742a2a;
    }

    .profile-bar {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 16px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin-bottom: 12px;
        flex-wrap: wrap;
    }

    .bar-label {
        font-size: 0.8rem;
        font-weight: 600;
        color: #4a5568;
    }

    .chip {
        border: 1px solid #e2e8f0;
        background: white;
        padding: 4px 12px;
        border-radius: 16px;
        cursor: pointer;
        font-size: 0.78rem;
        transition: all 0.15s;
    }
    .chip:hover {
        background: #edf2f7;
    }
    .chip.active {
        background: #1a365d;
        color: white;
        border-color: #1a365d;
    }

    .controls-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 14px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        margin-bottom: 16px;
        flex-wrap: wrap;
        gap: 8px;
    }

    .toggle-realistic {
        font-size: 0.8rem;
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        color: #4a5568;
    }
    .toggle-realistic input {
        cursor: pointer;
    }

    .sort-controls {
        display: flex;
        align-items: center;
        gap: 4px;
    }
    .sort-label {
        font-size: 0.75rem;
        color: #718096;
        margin-right: 4px;
    }

    .sort-btn {
        border: 1px solid #e2e8f0;
        background: white;
        padding: 3px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.72rem;
        transition: all 0.12s;
        white-space: nowrap;
    }
    .sort-btn:hover {
        background: #edf2f7;
    }
    .sort-btn.active {
        background: #1a365d;
        color: white;
        border-color: #1a365d;
    }

    .loading,
    .empty {
        text-align: center;
        padding: 40px;
        color: #718096;
        font-size: 0.9rem;
    }

    .goal-section {
        margin-bottom: 20px;
    }

    .goal-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: #1a365d;
        color: white;
        border-radius: 8px 8px 0 0;
        font-size: 0.9rem;
    }

    .goal-icon {
        font-size: 1rem;
    }
    .goal-name {
        font-weight: 700;
        flex: 1;
    }
    .goal-count {
        font-size: 0.72rem;
        opacity: 0.8;
    }

    .vector-list {
        border: 1px solid #e2e8f0;
        border-top: none;
        border-radius: 0 0 8px 8px;
        background: white;
    }

    .vector-card {
        padding: 14px 16px;
        border-bottom: 1px solid #edf2f7;
        transition: background 0.1s;
    }
    .vector-card:last-child {
        border-bottom: none;
    }
    .vector-card:hover {
        background: #f7fafc;
    }
    .vector-card.unrealistic {
        opacity: 0.55;
    }

    .vector-header-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 10px;
    }

    .vector-num {
        font-weight: 700;
        font-size: 0.8rem;
        color: #718096;
    }

    .severity-badge {
        padding: 2px 10px;
        border-radius: 10px;
        font-weight: 700;
        font-size: 0.7rem;
        text-transform: uppercase;
    }
    .severity-badge.low {
        background: #c6f6d5;
        color: #22543d;
    }
    .severity-badge.medium {
        background: #fefcbf;
        color: #744210;
    }
    .severity-badge.high {
        background: #fed7d7;
        color: #742a2a;
    }
    .severity-badge.critical {
        background: #e53e3e;
        color: white;
    }

    .vector-prob {
        font-weight: 700;
        font-size: 0.85rem;
    }

    .unrealistic-badge {
        font-size: 0.65rem;
        padding: 2px 8px;
        border-radius: 8px;
        background: #e2e8f0;
        color: #718096;
        font-weight: 600;
    }

    .vector-chain {
        display: flex;
        align-items: flex-start;
        gap: 6px;
        flex-wrap: wrap;
        margin-bottom: 8px;
    }

    .chain-step {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
    }

    .step-node {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        background: #fff5f5;
        border: 1px solid #feb2b2;
        border-radius: 6px;
        font-size: 0.8rem;
        font-weight: 600;
        color: #742a2a;
    }

    .step-icon {
        font-size: 0.9rem;
    }
    .step-label {
        white-space: nowrap;
    }

    .step-meta {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
        justify-content: center;
    }

    .meta-tag {
        font-size: 0.6rem;
        padding: 1px 5px;
        border-radius: 6px;
        background: #edf2f7;
        color: #4a5568;
        font-weight: 600;
    }
    .meta-tag.prob {
        background: #bee3f8;
        color: #2a4365;
    }

    .chain-arrow {
        font-size: 1.2rem;
        color: #a0aec0;
        align-self: center;
        padding-top: 2px;
    }

    .vector-summary {
        display: flex;
        gap: 16px;
        font-size: 0.7rem;
        color: #718096;
        padding-top: 4px;
        border-top: 1px solid #edf2f7;
        flex-wrap: wrap;
    }
</style>
