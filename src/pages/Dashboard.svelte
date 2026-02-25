<script lang="ts">
    import type { Goal, AttackPath, AttackerProfile } from "$lib/types";
    import { currentProject, setError } from "$lib/stores";
    import {
        formatProbability,
        getSeverityLabel,
        parseFactorWeights,
    } from "$lib/calculations";
    import * as api from "$lib/api";
    import { onMount } from "svelte";

    interface GoalRisk {
        goal: Goal;
        paths: AttackPath[];
        topPath: AttackPath | null;
        aggregatedProb: number;
        impactScores: Record<string, number>;
        averageImpact: number;
        riskScore: number;
        riskLevel: string;
    }

    let goalRisks: GoalRisk[] = [];
    let profiles: AttackerProfile[] = [];
    let loading = true;
    let overallRisk = 0;
    let criticalCount = 0;
    let highCount = 0;

    onMount(loadDashboard);

    async function loadDashboard() {
        if (!$currentProject) return;
        loading = true;
        try {
            const goals = await api.listGoals($currentProject.id);
            profiles = await api.listAttackerProfiles($currentProject.id);

            const risks: GoalRisk[] = [];
            for (const goal of goals) {
                const paths = await api.calculateAttackPaths(
                    $currentProject.id,
                    goal.id,
                );
                const aggregatedProb = await api.calculateAggregatedProbability(
                    $currentProject.id,
                    goal.id,
                    "goal",
                );

                let impactScores = {
                    financial: 1,
                    reputation: 1,
                    compliance: 1,
                    safety: 1,
                    operational: 1,
                };
                try {
                    const parsed = JSON.parse(goal.impact_scores || "{}");
                    impactScores = {
                        financial: parsed.financial ?? 1,
                        reputation: parsed.reputation ?? 1,
                        compliance: parsed.compliance ?? 1,
                        safety: parsed.safety ?? 1,
                        operational: parsed.operational ?? 1,
                    };
                } catch {
                    /* defaults */
                }

                const averageImpact =
                    (impactScores.financial +
                        impactScores.reputation +
                        impactScores.compliance +
                        impactScores.safety +
                        impactScores.operational) /
                    5;
                const riskScore =
                    aggregatedProb > 0 && averageImpact > 0
                        ? (aggregatedProb * averageImpact) / 5
                        : 0;

                const topPath =
                    paths.length > 0
                        ? paths.reduce((a, b) =>
                              a.overall_probability > b.overall_probability
                                  ? a
                                  : b,
                          )
                        : null;

                risks.push({
                    goal,
                    paths,
                    topPath,
                    aggregatedProb,
                    impactScores,
                    averageImpact,
                    riskScore,
                    riskLevel: getSeverityLabel(riskScore),
                });
            }

            // Sort by risk descending
            risks.sort((a, b) => b.riskScore - a.riskScore);
            goalRisks = risks;

            overallRisk =
                goalRisks.length > 0
                    ? Math.max(...goalRisks.map((g) => g.riskScore))
                    : 0;
            criticalCount = goalRisks.filter(
                (g) => g.riskLevel === "Critical",
            ).length;
            highCount = goalRisks.filter((g) => g.riskLevel === "High").length;
        } catch (e) {
            setError(`Dashboard load failed: ${e}`);
        }
        loading = false;
    }
</script>

<div class="dashboard">
    <div class="page-header"><h2>📊 Project Dashboard</h2></div>

    {#if loading}
        <div class="loading">Loading dashboard data…</div>
    {:else}
        <!-- Summary Cards -->
        <div class="summary-cards">
            <div class="summary-card">
                <div class="sc-label">Overall Risk</div>
                <div class="sc-value">
                    <span
                        class="risk-badge {getSeverityLabel(
                            overallRisk,
                        ).toLowerCase()}">{getSeverityLabel(overallRisk)}</span
                    >
                </div>
                <div class="sc-sub">{(overallRisk * 100).toFixed(0)}%</div>
            </div>
            <div class="summary-card">
                <div class="sc-label">Goals Analyzed</div>
                <div class="sc-value">{goalRisks.length}</div>
            </div>
            <div class="summary-card warn">
                <div class="sc-label">Critical Goals</div>
                <div class="sc-value">{criticalCount}</div>
            </div>
            <div class="summary-card caution">
                <div class="sc-label">High Risk Goals</div>
                <div class="sc-value">{highCount}</div>
            </div>
            <div class="summary-card">
                <div class="sc-label">Attacker Profiles</div>
                <div class="sc-value">{profiles.length}</div>
            </div>
        </div>

        <!-- Risk per Goal -->
        {#if goalRisks.length === 0}
            <div class="empty-state">
                <p>
                    No goals defined yet. Create goals in the <a
                        href="#/project/tree">Attack Tree</a
                    > view.
                </p>
            </div>
        {:else}
            <div class="goal-risks">
                <h3>Risk by Goal</h3>
                {#each goalRisks as gr (gr.goal.id)}
                    <div class="goal-risk-card">
                        <div class="gr-header">
                            <span class="gr-name">🎯 {gr.goal.name}</span>
                            <span
                                class="risk-badge {gr.riskLevel.toLowerCase()}"
                                >{gr.riskLevel}</span
                            >
                            <span class="gr-score"
                                >Risk: {(gr.riskScore * 100).toFixed(0)}%</span
                            >
                        </div>

                        <div class="gr-stats">
                            <div class="gr-stat">
                                <span class="gs-label">Likelihood</span>
                                <span class="gs-val"
                                    >{formatProbability(
                                        gr.aggregatedProb,
                                    )}</span
                                >
                            </div>
                            <div class="gr-stat">
                                <span class="gs-label">Impact</span>
                                <span class="gs-val"
                                    >{gr.averageImpact.toFixed(1)}/5</span
                                >
                            </div>
                            <div class="gr-stat">
                                <span class="gs-label">Paths</span>
                                <span class="gs-val">{gr.paths.length}</span>
                            </div>
                            <div class="gr-stat">
                                <span class="gs-label">Realistic</span>
                                <span class="gs-val"
                                    >{gr.paths.filter((p) => p.is_realistic)
                                        .length}</span
                                >
                            </div>
                        </div>

                        <!-- Top 3 Critical Paths -->
                        {#if gr.paths.length > 0}
                            <div class="gr-paths">
                                <div class="gp-label">Most Critical Paths:</div>
                                {#each gr.paths.slice(0, 3) as path, i (path.path_id)}
                                    <div class="gp-row">
                                        <span class="gp-rank">#{i + 1}</span>
                                        <span class="gp-steps">
                                            {#each path.steps as step, j}
                                                {step.name}{#if j < path.steps.length - 1}
                                                    →
                                                {/if}
                                            {/each}
                                        </span>
                                        <span
                                            class="gp-prob {getSeverityLabel(
                                                path.overall_probability,
                                            ).toLowerCase()}"
                                        >
                                            {formatProbability(
                                                path.overall_probability,
                                            )}
                                        </span>
                                        {#if !path.is_realistic}
                                            <span class="gp-tag"
                                                >unrealistic</span
                                            >
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <div class="gp-empty">
                                No attack paths found for this goal.
                            </div>
                        {/if}

                        <!-- Impact Breakdown -->
                        <div class="gr-impact">
                            <span class="gi-item" title="Financial"
                                >💰 {gr.impactScores.financial}</span
                            >
                            <span class="gi-item" title="Reputation"
                                >📰 {gr.impactScores.reputation}</span
                            >
                            <span class="gi-item" title="Compliance"
                                >⚖️ {gr.impactScores.compliance}</span
                            >
                            <span class="gi-item" title="Safety"
                                >🏥 {gr.impactScores.safety}</span
                            >
                            <span class="gi-item" title="Operational"
                                >⚙️ {gr.impactScores.operational}</span
                            >
                        </div>
                    </div>
                {/each}
            </div>
        {/if}

        <!-- Attacker Profile Risk Summary -->
        {#if profiles.length > 0 && goalRisks.length > 0}
            <div class="profile-summary">
                <h3>Risk by Attacker Profile</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Profile</th>
                            <th>Skill</th>
                            <th>Access</th>
                            {#each goalRisks as gr (gr.goal.id)}
                                <th title={gr.goal.name}
                                    >{gr.goal.name.substring(0, 15)}</th
                                >
                            {/each}
                        </tr>
                    </thead>
                    <tbody>
                        {#each profiles as p (p.id)}
                            <tr>
                                <td class="prof-name">🎭 {p.name}</td>
                                <td>{p.skill_level}/5</td>
                                <td>{p.access_level}/5</td>
                                {#each goalRisks as gr (gr.goal.id)}
                                    {@const viable = gr.paths.filter(
                                        (path) =>
                                            path.max_skill_level <=
                                                p.skill_level &&
                                            path.max_access_level <=
                                                p.access_level,
                                    )}
                                    {@const maxProb =
                                        viable.length > 0
                                            ? Math.max(
                                                  ...viable.map(
                                                      (v) =>
                                                          v.overall_probability,
                                                  ),
                                              )
                                            : 0}
                                    <td>
                                        <span
                                            class="risk-badge sm {getSeverityLabel(
                                                maxProb,
                                            ).toLowerCase()}"
                                        >
                                            {viable.length > 0
                                                ? formatProbability(maxProb)
                                                : "—"}
                                        </span>
                                    </td>
                                {/each}
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    {/if}
</div>

<style>
    .dashboard {
        max-width: 1200px;
        margin: 0 auto;
    }
    .page-header {
        margin-bottom: 16px;
    }
    .page-header h2 {
        margin: 0;
        font-size: 1.15rem;
    }
    .loading {
        text-align: center;
        padding: 40px;
        color: #718096;
    }
    .empty-state {
        text-align: center;
        padding: 30px;
        color: #718096;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
    }
    .empty-state a {
        color: #1a365d;
    }

    /* Summary Cards */
    .summary-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 12px;
        margin-bottom: 20px;
    }
    .summary-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
        text-align: center;
    }
    .summary-card.warn {
        border-color: #fc8181;
        background: #fff5f5;
    }
    .summary-card.caution {
        border-color: #f6ad55;
        background: #fffaf0;
    }
    .sc-label {
        font-size: 0.72rem;
        text-transform: uppercase;
        color: #718096;
        margin-bottom: 6px;
        font-weight: 600;
    }
    .sc-value {
        font-size: 1.5rem;
        font-weight: 700;
        color: #2d3748;
    }
    .sc-sub {
        font-size: 0.78rem;
        color: #718096;
        margin-top: 2px;
    }

    /* Risk badges */
    .risk-badge {
        padding: 3px 10px;
        border-radius: 10px;
        font-weight: 700;
        font-size: 0.75rem;
        text-transform: uppercase;
        display: inline-block;
    }
    .risk-badge.sm {
        padding: 2px 6px;
        font-size: 0.65rem;
    }
    .risk-badge.low {
        background: #c6f6d5;
        color: #22543d;
    }
    .risk-badge.medium {
        background: #fefcbf;
        color: #744210;
    }
    .risk-badge.high {
        background: #fed7d7;
        color: #742a2a;
    }
    .risk-badge.critical {
        background: #e53e3e;
        color: white;
    }

    /* Goal risks */
    .goal-risks {
        margin-bottom: 20px;
    }
    .goal-risks h3 {
        margin: 0 0 12px;
        font-size: 0.95rem;
    }
    .goal-risk-card {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
    }
    .gr-header {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 10px;
    }
    .gr-name {
        font-weight: 700;
        font-size: 0.9rem;
    }
    .gr-score {
        font-size: 0.8rem;
        color: #4a5568;
        font-weight: 600;
    }

    .gr-stats {
        display: flex;
        gap: 20px;
        margin-bottom: 10px;
        flex-wrap: wrap;
    }
    .gr-stat {
        display: flex;
        flex-direction: column;
    }
    .gs-label {
        font-size: 0.65rem;
        text-transform: uppercase;
        color: #718096;
    }
    .gs-val {
        font-weight: 700;
        font-size: 0.9rem;
        color: #2d3748;
    }

    .gr-paths {
        margin-bottom: 8px;
    }
    .gp-label {
        font-size: 0.72rem;
        font-weight: 600;
        color: #718096;
        margin-bottom: 4px;
    }
    .gp-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
        background: #f7fafc;
        border-radius: 4px;
        margin-bottom: 3px;
        font-size: 0.78rem;
        flex-wrap: wrap;
    }
    .gp-rank {
        font-weight: 700;
        color: #718096;
        min-width: 24px;
    }
    .gp-steps {
        flex: 1;
        color: #4a5568;
    }
    .gp-prob {
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 8px;
        font-size: 0.7rem;
    }
    .gp-prob.low {
        background: #c6f6d5;
        color: #22543d;
    }
    .gp-prob.medium {
        background: #fefcbf;
        color: #744210;
    }
    .gp-prob.high {
        background: #fed7d7;
        color: #742a2a;
    }
    .gp-prob.critical {
        background: #e53e3e;
        color: white;
    }
    .gp-tag {
        font-size: 0.6rem;
        background: #fed7d7;
        color: #742a2a;
        padding: 1px 5px;
        border-radius: 4px;
    }
    .gp-empty {
        font-size: 0.78rem;
        color: #718096;
        font-style: italic;
    }

    .gr-impact {
        display: flex;
        gap: 10px;
        font-size: 0.78rem;
    }
    .gi-item {
        padding: 2px 6px;
        background: #f7fafc;
        border-radius: 4px;
    }

    /* Profile summary table */
    .profile-summary {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 16px;
        overflow-x: auto;
    }
    .profile-summary h3 {
        margin: 0 0 12px;
        font-size: 0.95rem;
    }
    .profile-summary table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.8rem;
    }
    .profile-summary th,
    .profile-summary td {
        padding: 8px 10px;
        border-bottom: 1px solid #e2e8f0;
        text-align: center;
    }
    .profile-summary th {
        font-weight: 600;
        color: #718096;
        font-size: 0.72rem;
        text-transform: uppercase;
    }
    .prof-name {
        text-align: left !important;
        font-weight: 600;
    }
</style>
