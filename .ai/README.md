# EmbedRisk AI framework

This folder documents the GitHub Copilot agent/prompt framework that assists engineers running a
Threat and Risk Assessment (TRA) with EmbedRisk. It supersedes the original concept draft in
[.ai/todo.md](./todo.md); that file is kept for historical reference only.

The framework is not a generic chatbot. It is a structured engineering assistant that guides the TRA
workflow described in [docs/HOW-TO-TRA.md](../docs/HOW-TO-TRA.md), asks targeted questions instead of
guessing, and only ever writes to a TRA project's JSON files after explicit user approval.

## Where the pieces live

VS Code discovers Copilot customizations from fixed locations, so the executable parts of this
framework live under `.github/`, following the same convention as the existing
[.github/copilot-instructions.md](../.github/copilot-instructions.md). This folder (`.ai/`) holds the
non-executable, human-facing parts: this README, the knowledge-file schema, and worked examples.

| What | Where | Notes |
|---|---|---|
| Agents | [.github/agents/](../.github/agents/) | Personas with restricted tools, see below |
| Prompts | [.github/prompts/](../.github/prompts/) | One-off, parameterized tasks, run via `/` in chat |
| Instructions | [.github/instructions/](../.github/instructions/) | Auto-attached rules for TRA JSON / knowledge-file edits |
| Knowledge-file schema | [.ai/knowledge/tra-knowledge.schema.json](./knowledge/tra-knowledge.schema.json) (formal) + [knowledge-schema.md](./knowledge/knowledge-schema.md) (walkthrough) | The `.tra-knowledge.json` sidecar format |
| Examples | [.ai/examples/](./examples/) | A worked interview excerpt, a review report, a sample knowledge file |

## Agents

| Agent | File | Role | Writes files? |
|---|---|---|---|
| TRA Facilitator | [tra-facilitator.agent.md](../.github/agents/tra-facilitator.agent.md) | Primary orchestrator: interviews the user, coordinates the other agents, runs the state-based workflow, is the only agent that writes TRA JSON, and only after approval | Yes, gated |
| Context Extractor | [tra-context-extractor.agent.md](../.github/agents/tra-context-extractor.agent.md) | Subagent: reads existing project files, reports facts found and gaps | No |
| Threat Analyst | [tra-threat-analyst.agent.md](../.github/agents/tra-threat-analyst.agent.md) | Subagent: proposes STRIDE threats and Likelihood x Impact ratings with cited evidence | No |
| Mitigation Advisor | [tra-mitigation-advisor.agent.md](../.github/agents/tra-mitigation-advisor.agent.md) | Subagent: proposes countermeasures mapped to threats, OT-constraint aware | No |
| TRA Reviewer | [tra-reviewer.agent.md](../.github/agents/tra-reviewer.agent.md) | Standalone or subagent: schema/consistency/plausibility review, structured report | No |
| Sparring Partner | [tra-sparring-partner.agent.md](../.github/agents/tra-sparring-partner.agent.md) | Standalone: discusses and challenges decisions, explores alternatives | Never |

Use the agent picker in VS Code chat to run **TRA Facilitator**, **TRA Reviewer**, or
**Sparring Partner** directly. The other three are subagents the Facilitator delegates to; they are
not meant to be picked directly (`user-invocable: false`).

## Prompts

| Prompt | File | Use for |
|---|---|---|
| Review a single TRA | [tra-review-single.prompt.md](../.github/prompts/tra-review-single.prompt.md) | Full compliance/plausibility review of one project |
| Review multiple TRAs | [tra-review-multiple.prompt.md](../.github/prompts/tra-review-multiple.prompt.md) | Cross-project consistency (comparable devices, diverging ratings) |
| Plausibility check | [tra-plausibility-check.prompt.md](../.github/prompts/tra-plausibility-check.prompt.md) | Quick sanity pass on ratings/assumptions, no full audit |
| Prepare a TRA interview | [tra-prepare-interview.prompt.md](../.github/prompts/tra-prepare-interview.prompt.md) | Run gap analysis and preview the question queue before interviewing |
| Challenge assumptions | [tra-challenge-assumptions.prompt.md](../.github/prompts/tra-challenge-assumptions.prompt.md) | Sparring session on `02-assumptions/assumptions.json` |
| Management summary | [tra-management-summary.prompt.md](../.github/prompts/tra-management-summary.prompt.md) | One-page, non-technical summary for a release/milestone gate |

Run these via `/` in Copilot Chat, or `Chat: Run Prompt...` from the command palette.

## Structured knowledge persistence

Each TRA project folder (sibling to `01-project-description/`, ..., `09-defects/`) can have a
`.tra-knowledge.json` sidecar file. It is **not** part of the shared TRA schema — the webapp and the
VS Code extension never read it, and `webapp/server/src/validate.js` never validates it — it exists
purely so a Copilot session remembers what has already been asked and answered, across sessions,
without re-interviewing the user.

It stores, per [.ai/knowledge/tra-knowledge.schema.json](./knowledge/tra-knowledge.schema.json) (the
formal schema; [.ai/knowledge/knowledge-schema.md](./knowledge/knowledge-schema.md) is a prose
walkthrough of it):

- the open/answered interview question queue (tagged `fact`, `assumption`,
  `recommendation-accepted`, or `recommendation-rejected`),
- confirmed context not yet promoted into an official step file (assets, communication paths, trust
  boundaries, authentication methods, maintenance access, availability requirements, constraints),
- a decision log of every approved write to a TRA JSON file, with rationale and approver.

The Facilitator reads and updates it freely (no approval needed — it's AI working memory, not a TRA
artifact) and always consults it before asking a question, so returning to a project in a new
session picks up where it left off. See
[.ai/examples/example.tra-knowledge.json](./examples/example.tra-knowledge.json) and
[.ai/examples/example-interview-excerpt.md](./examples/example-interview-excerpt.md) for a worked
example.

## The approval workflow

The Facilitator runs a state-based workflow: **repository analysis -> context extraction -> gap
analysis -> user interview -> draft generation -> user review -> JSON update -> final review**. Every
transition into "JSON update" — any write to a `01-project-description/` .. `09-defects/` file — stops
and asks for explicit approval first: a summary of what changes, in which file(s), and why. There is
no exception. This is enforced both by instruction
([tra-json-editing.instructions.md](../.github/instructions/tra-json-editing.instructions.md)) and by
tool restriction (only the Facilitator has the `edit` tool; every subagent and the Reviewer/Sparring
Partner are read-only).

## No implicit assumptions

Whenever required information is missing, agents must ask a focused question rather than invent an
answer, and must label every statement as one of: **fact** (from a file or a prior answer),
**user-provided information** (this session's answer), **assumption** (a working assumption the user
explicitly confirmed), or **recommendation** (the AI's proposal, pending accept/reject). This applies
to all agents, not just the Facilitator — see each agent file's own constraints section.

## Using this with EmbedRisk in VS Code

1. Open the repository in VS Code with GitHub Copilot Chat.
2. To start or continue a TRA, select the **TRA Facilitator** agent and point it at a project folder
   (e.g. `webapp/projects/test`, or a folder created via the VS Code extension's "EmbedRisk: New
   Project" command).
3. To review without going through the interview, use the **TRA Reviewer** agent or the
   `tra-review-single` / `tra-review-multiple` prompts directly.
4. To discuss a decision without risking a file change, use the **Sparring Partner** agent or the
   `tra-challenge-assumptions` prompt.
5. Review the Facilitator's proposed changes like any other code change — the `.tra-knowledge.json`
   decision log and the project's own git history together give a full audit trail of what changed,
   when, why, and who approved it.

## Testing and validating the framework

Because these are prompt-engineered behaviors, not code, most validation exercises the workflow
rather than unit-testing prose — but two parts of the framework *are* plain executable checks:

- **Schema/plausibility validator, runnable directly**: `node webapp/server/src/validate-cli.js
  <path-to-project-folder>` (from the repository root), or `npm run validate -- <path-to-project>`
  from [webapp/](../webapp/) (e.g. `npm run validate -- projects/test`). It loads a project's step
  files exactly as the server does and runs the same `validate()` from
  [webapp/server/src/validate.js](../webapp/server/src/validate.js) — no file writes, safe for CI.
  Compare its output to what the `tra-reviewer` agent reports on the same project; a mismatch means
  an agent instruction has drifted from the actual schema in `webapp/client/src/types.ts`.
- **Knowledge-file schema check**: `node tools/validate-knowledge-file.mjs
  <path-to-.tra-knowledge.json>` checks a sidecar file against
  [.ai/knowledge/tra-knowledge.schema.json](./knowledge/tra-knowledge.schema.json).
- **Framework acceptance check**: `node tools/test-tra-framework.mjs` statically verifies the
  approval-gate mechanism (only `tra-facilitator` has the `edit` tool; every other agent is
  read-only), that the approval-gate wording is present and consistent between the Facilitator and
  `tra-json-editing.instructions.md`, that the one-question-at-a-time interview rule is documented,
  and that the DFD trust-boundary id-alias exception is stated consistently. It falsifies a broken
  approval gate (e.g. someone adding `edit` to a subagent, or dropping the "no exception" wording)
  without requiring a live model run.

The remaining behaviors still require exercising the workflow in chat:

- **Dry-run the Facilitator** against [webapp/projects/test](../webapp/projects/test/) (a
  deliberately sparse example project) and confirm it: asks one question at a time, creates
  `.tra-knowledge.json` without asking, and stops for approval before writing any step file.
- **Cross-session memory check**: answer a few interview questions, end the session, start a new one
  on the same project, and confirm the Facilitator does not re-ask anything already recorded in
  `.tra-knowledge.json`.
- **Approval-gate check (live)**: ask the Facilitator to make a change and then, mid-conversation,
  ask it to "just do it" without confirming — it must still stop and ask for explicit approval.
- **Schema drift check**: whenever `webapp/client/src/types.ts` or `webapp/server/src/validate.js`
  changes, re-run `node tools/test-tra-framework.mjs` and re-check
  [tra-json-editing.instructions.md](../.github/instructions/tra-json-editing.instructions.md) and
  the Threat Analyst / Mitigation Advisor / Reviewer agent bodies for field names that no longer
  match.
- Treat `.tra-knowledge.json` as reviewable, git-tracked content: a PR that changes a project should
  make its knowledge-file diff (if any) as understandable as the JSON artifact diff.

## Future extension points

The structure is deliberately modular so new capability can be added as another subagent or prompt
without touching the Facilitator's core state machine:

- **IEC 62443 mapping**: a read-only subagent that maps requirements/countermeasures to IEC 62443-4-2
  CR/FR references, invoked from the Mitigation Advisor step.
- **Attack path analysis**: a subagent that reasons over `07-attack-trees/attack-trees.json` across
  multiple threats to find compound attack paths, invoked after the threat/countermeasure steps.
- **Project-wide consistency**: extend `tra-review-multiple` (or add a dedicated subagent) once more
  example projects exist, e.g. to check knowledge-base reuse drift across a whole product line.

Add new agents under `.github/agents/`, new prompts under `.github/prompts/`, and document them in
the tables above — do not create a parallel structure elsewhere.
