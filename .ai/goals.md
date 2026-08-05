# Project goals

## Traceability to the original request

The five feature requests map 1:1 onto the feature goals below. Goal 0 is loop scaffolding.

| Request (user's words)                                          | Goal |
| --------------------------------------------------------------- | ---- |
| "open with EmbedRisk" / launch webapp inside an existing folder | 1    |
| Tutorial that opens when a user opens a new project             | 2    |
| Hide interfaces in the DFD view                                 | 3    |
| Use-case diagrams in a draw.io-style editor                     | 4    |
| Assumptions referable by threats                                | 5    |

Order rationale: the launcher (Goal 1) is the smallest, most self-contained change and firms up
the project-root open flow that the new-project tutorial (Goal 2) also depends on. The three
modelling features (Goals 3-5) follow in the order the request listed them.

> Execution model: this file is the high-level backlog and acceptance criteria. The loop now runs
> **one whole goal per pass** — the active goal lives in `.ai/current-goal.md` as a single large
> execute prompt, and Goals 2-5 are prewritten as paste-ready execute prompts in `.ai/backlog.md`.
> The per-goal `Steps` below remain a checklist of what each execute prompt must cover.

---

## Goal 0: Loop system hardening (DONE)

Make the planning files and implementation loop match the actual EmbedRisk repository so future
iterations stay one-step, repo-aware, and safe.

### Steps

- [x] 0.1 Rewrite `.ai/context.md` with the current EmbedRisk architecture, shared-schema
	conventions, step order, and validation commands.
- [x] 0.2 Establish the split-role loop prompts (`plan-step`, `execute-step`, `verify-step`,
	`review-step`, `final-review`, plus `run-loop` as the single-invocation variant) so one pass
	handles exactly one step and validates the touched slice before widening scope.
- [x] 0.3 Reset `.ai/current-goal.md` and `.ai/progress.md` to the step-driven format and give the
	backlog a 1:1 mapping back to the original request.

### Acceptance criteria

- The loop prompts cannot drift into multi-step work.
- Shared-schema changes are explicitly treated as cross-package work.
- The planning files describe the real EmbedRisk webapp/extension stack instead of the stale
	placeholder stack.
- Every feature goal traces back to exactly one request bullet.

---

## Goal 1: Launch the webapp into an existing project folder

Let a user start the EmbedRisk webapp pointed at an existing project folder from a normal shell
(no VS Code required), with an optional VS Code convenience command.

### Steps

- [x] 1.1 Decide and document the single launch contract: what counts as a "project root", how a
	target folder is resolved (env override vs argument vs current directory), which entry points
	must work without VS Code, and which are VS Code conveniences.
- [ ] 1.2 Add a runnable CLI entry point (a `bin` for the webapp) that starts the server against a
	given or current folder without requiring a prior `+ New project` step.
- [ ] 1.3 Handle both shapes of target folder: a folder that already is a single TRA project
	(contains `01-…` steps) and a folder that is a container of projects.
- [ ] 1.4 Add an optional VS Code command ("EmbedRisk: Open webapp in this folder") that launches
	the same CLI against the workspace folder.

### Acceptance criteria

- An existing project folder can be opened without first creating a fresh project in the UI.
- The launcher works from a shell in any directory and does not depend on VS Code.
- The launch contract is written down once and referenced by every entry point.
- `TRA_PROJECTS_DIR` behaviour is preserved and reconciled with the new argument/CLI behaviour.

---

## Goal 2: New-project tutorial onboarding

Show a start/skip tutorial when a user opens a new project, and guide them through a tiny example
with a central animated walkthrough.

### Steps

- [ ] 2.1 Add a dedicated tutorial folder holding its own example project, tutorial risk data, and
	tutorial assets, isolated from regular project content.
- [ ] 2.2 Show a tutorial popup on new-project open with `Start tutorial` and `Skip tutorial`
	actions, persisting the user's choice.
- [ ] 2.3 Build the central animated walkthrough: a focused animation window (a cursor-driven
	actor using EmbedRisk, **no visible keyboard**) surrounded by short text that emphasises the
	important points in bold.
- [ ] 2.4 Sequence the walkthrough through every methodology step in the correct order with concise
	"what / how / why" framing and a visually balanced layout (window/background/text proportions,
	focus on the animation).

### Acceptance criteria

- The tutorial can be started or skipped from the new-project flow, and the choice is remembered.
- Tutorial resources live in a dedicated folder and do not pollute regular project content.
- The walkthrough covers each step in order with short, emphasis-highlighted text and no visible
	keyboard.
- The onboarding is visually clear, proportionate, and readable.

---

## Goal 3: Hide interfaces in the DFD view

Let the user hide an interface from the DFD view, then restore it from step 03 or via undo.

### Steps

- [ ] 3.1 Add a persisted hidden/visible state for interfaces in the shared project model.
- [ ] 3.2 Add a checkbox in step 04 to hide an interface, and only reveal the unhide control in
	step 03 after the interface has been hidden.
- [ ] 3.3 Make undo/redo, validation, and report generation respect hidden interfaces.

### Acceptance criteria

- Hiding an interface in step 04 removes it from the DFD presentation without corrupting the model.
- The user can restore visibility either through `CTRL+Z` undo or from step 03.
- The unhide control is not shown in step 03 until the interface is actually hidden.

---

## Goal 4: Use-case diagrams

Add a dedicated use-case editor for multiple diagrams, including misuse-case extensions, grouping
boxes, and report inclusion control, reusing the existing draw.io engine.

### Steps

- [ ] 4.1 Add a use-case artifact and wire it into the project step order, persistence, validation,
	and report generation.
- [ ] 4.2 Build the use-case editor with actors (named, label beneath the figure), actions
	(labelled inside the oval), full/dashed connections, arrow directions, parallel connection
	labels, and grouping boxes drawn behind the other entities.
- [ ] 4.3 Add misuse-case variants (blacked-out actor and action).
- [ ] 4.4 Add the step-01 navigation entry and a list of saved diagram names shown after the editor
	exits (Exit saves and returns to step 01).
- [ ] 4.5 Add a settings toggle to include use-case diagrams in the report, defaulting to `off`.
- [ ] 4.6 Show an acknowledgeable notice when (mis-)use cases exist but report inclusion is still
	`off`.

### Acceptance criteria

- Multiple use-case diagrams can be created, saved, reopened, and deleted safely.
- Actors, actions, connections, misuse-case variants, and grouping boxes are all representable.
- The report can include or exclude use cases via a user setting, with `no` as the default.
- If use cases exist but remain excluded, the user sees an explicit acknowledgement notice.

---

## Goal 5: Assumption references in threats

Make assumptions citeable from threat reasoning so reviewers can point to a specific assumption when
explaining why a threat is infeasible, implausible, or irrelevant.

### Steps

- [ ] 5.1 Add a structured way for threats to reference assumptions by ID.
- [ ] 5.2 Surface assumption references in threat rationale, validation, and report output.
- [ ] 5.3 Add cross-linking so reviewers can navigate from a threat to the supporting assumption.

### Acceptance criteria

- A threat can cite one or more assumptions by ID in a machine-readable way.
- Validation fails or warns when a threat references a missing assumption.
- The report makes the cited assumption visible wherever the threat rationale is shown.
- Reviewers can explain a low-risk or infeasible threat by pointing to a concrete assumption ID.
