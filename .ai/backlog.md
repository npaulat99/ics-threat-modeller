# Backlog — whole-goal execute prompts

Each block below is a complete, paste-ready execute prompt for one goal. When `current-goal.md` is
finished and reviewed, copy the next goal's block (from its `# ===` header to the next one) over the
contents of `.ai/current-goal.md`, then run the execute pass.

Global guardrails for every goal (do not repeat inside each block):

- Follow `.github/copilot-instructions.md` and `.ai/context.md`. Prioritise security, simplicity,
	readability.
- The on-disk step JSON format is shared by two consumers. Any schema/field change must be checked
	against `webapp/client/src/types.ts`, `webapp/server/src/{artifacts,validate,report}.js`, and the
	`vscode-extension` code that parses/renders the same data, plus example projects.
- Match each package's module style (server ESM `.js`; client TS/React + zustand; extension TS;
	`vscode-extension/media/*.js` stays CommonJS). No new bundler/linter/test framework.
- Validate the touched slice: `cd webapp && npm test`, `npm --workspace client run typecheck` or
	`npm run build`, `node tools/test-models.js`, and the extension compile where relevant.
- Read the referenced files first to ground every change in the real code.


# === Goal: 1 — Launch the webapp into an existing project folder (and preselect a single project)

## Feature summary

A user with an existing on-disk TRA project (or a folder of projects) must be able to open it in the
EmbedRisk webapp from a normal shell — without VS Code and without first clicking `+ New project`.
An optional VS Code command is a convenience that shells out to the same CLI. The canonical
behaviour is defined in `webapp/docs/launch-contract.md`; the CLI is the single source of truth for
turning an input folder into an effective projects root plus an optional preselected project id.

## Current state (already implemented — do not redo)

- `webapp/docs/launch-contract.md` — the launch contract (container vs single-project shapes,
	precedence `explicit arg > TRA_PROJECTS_DIR > cwd`, entry points, compatibility requirements).
- `webapp/bin/embedrisk.js` — ESM `bin` launcher with a pure `resolveProjectsDir(argv, env, cwd)`
	(precedence resolver) and a symlink-safe main-module guard; sets `TRA_PROJECTS_DIR` before
	importing `../server/src/index.js`.
- `webapp/package.json` — `bin.embedrisk`, `open` and `test` scripts.
- `webapp/test/embedrisk.test.mjs` — plain-Node `assert` tests (precedence + symlink startup).

## Remaining work to implement in this pass

Implement all four parts below, in order.

### Part A — Single-project detection in the CLI

- Add a filesystem-aware resolver in `webapp/bin/embedrisk.js`, e.g.
	`resolveLaunchTarget(argv, env, cwd)`, that first calls `resolveProjectsDir(...)` for the target
	folder, then classifies it and returns `{ projectsRoot, preselectId }`:
	- Single-project folder (directly contains the canonical first-step dir `01-project-description`)
		→ `{ projectsRoot: dirname(target), preselectId: basename(target) }`.
	- Otherwise (container or anything else) → `{ projectsRoot: target, preselectId: null }`.
- Classification must be defensive: any stat/read error is treated as a container so a bad path can
	never crash startup. Keep `resolveProjectsDir` pure; put filesystem access only in the new
	resolver.
- In `main()`, set `process.env.TRA_PROJECTS_DIR = projectsRoot` before importing the server, and
	set `process.env.TRA_PRESELECT_PROJECT = preselectId` only when a preselect id is present.

### Part B — Server exposes the preselected project

- In `webapp/server/src/index.js`, read `process.env.TRA_PRESELECT_PROJECT` and expose it to the
	client via a tiny read-only endpoint (e.g. `GET /api/config` returning
	`{ preselectProjectId: string | null }`). Do not change existing endpoints or defaults.
- Validate that the preselect id, if set, actually exists in `listProjects()`; if it does not,
	return `null` (never trust an unvalidated id, and never let a stale env break startup).

### Part C — Client honours the preselected project

- In `webapp/client/src/state/store.ts` `init()`, after loading `/api/projects`, fetch
	`/api/config`; if `preselectProjectId` is present and matches a listed project, select that one
	instead of `projects[0]`. Fall back to the current `projects[0]` behaviour otherwise.
- Keep the change minimal and typed; add the config type to `webapp/client/src/types.ts` if needed.

### Part D — VS Code convenience command

- Add an `embedrisk.openWebapp` command in `vscode-extension/package.json` (`contributes.commands`,
	category `EmbedRisk`, title e.g. "Open webapp in this folder").
- Implement it in `vscode-extension/src/extension.ts` so it shells out to the shared CLI against the
	chosen folder (default: the first workspace folder; optionally prompt for a folder). It must NOT
	reimplement folder resolution — it invokes the `embedrisk` CLI (via `node <path>/bin/embedrisk.js`
	or the installed bin) so the launch contract stays single-sourced. Surface the served URL
	(`http://localhost:<PORT>`) to the user (e.g. open a browser / show an info message).

## Files allowed to change

- `webapp/bin/embedrisk.js`
- `webapp/server/src/index.js`
- `webapp/client/src/state/store.ts`, `webapp/client/src/types.ts` (only if a config type is needed)
- `webapp/test/embedrisk.test.mjs`
- `vscode-extension/package.json`, `vscode-extension/src/extension.ts`
- `webapp/docs/launch-contract.md` (only to reconcile wording if behaviour is clarified)
- `.ai/progress.md`, `.ai/current-goal.md`

Match each package's existing module style (server = ESM `.js` with explicit extensions; client =
TS/React; extension = TS). Do not introduce a bundler or test framework.

## Acceptance criteria

- From any shell, `embedrisk <folder>` (via `node bin/embedrisk.js`, `npm exec -- embedrisk`, or a
	global install) starts the server without VS Code and without a prior `+ New project`.
- A standalone single-project folder (contains `01-project-description`) is served by shifting the
	effective root to its parent and opening that project in the UI.
- A container folder is served as-is; when a valid preselect id is present the client opens that
	project, otherwise it opens `projects[0]` (unchanged fallback).
- The VS Code command opens the webapp for the workspace folder by calling the shared CLI (no
	duplicated resolution logic).
- Precedence (`explicit arg > TRA_PROJECTS_DIR > cwd`), default `PORT` 4317, bind `0.0.0.0`, and the
	existing `npm start` flow are all unchanged.

## Required tests / validation

- Extend `webapp/test/embedrisk.test.mjs` (plain Node `assert`):
	- `resolveLaunchTarget`: single-project temp folder → `{ parent, basename }`; container temp
		folder → `{ itself, null }`; precedence still holds when combined with classification.
	- Startup regression: launch against a temp single-project folder and assert the server reports
		`Projects directory: <parent>`, `/api/projects` lists the project, and `/api/config` returns
		its id as `preselectProjectId`.
- Run: `cd webapp && npm test`; `npm --workspace client run typecheck` (or `npm run build`) for the
	client change; the extension's compile/build for the command.
- Manual smoke: open a container and a single-project folder; confirm the right project opens.

## Risks / guardrails

- False positive: a container that itself contains a stray `01-project-description` would be
	misread as a single project — key strictly on the canonical first-step dir; broader discovery is
	out of contract.
- Never trust `TRA_PRESELECT_PROJECT` blindly — validate it against `listProjects()` server-side and
	match it client-side before selecting.
- Keep `resolveProjectsDir` pure; isolate all filesystem access in `resolveLaunchTarget` and treat
	stat errors as "container".
- The VS Code command must shell out to the CLI, not duplicate resolution. Reliably surface failures
	(missing Node, port in use) instead of failing silently.
---

# === Goal 2: New-project tutorial onboarding ===

Goal: 2 — Show a start/skip tutorial when a user opens a new project, and guide them through a tiny
example with a central animated walkthrough. (Webapp/React feature.)

## Feature summary

When a user opens a **new** project in the webapp, show a popup that explains this is a tutorial with
`Start tutorial` and `Skip tutorial`. If started, present a central animated walkthrough that guides
the user through a tiny example project, explaining every methodology step in the correct order
(what / how / why). The animation window sits in the middle and shows a cursor-driven actor using
EmbedRisk — **no visible keyboard**. Around the animation are short texts with the most important
information in **bold**. Keep it visually clean and balanced (window/background/text proportions,
focus on the animation, not too much text).

## Read first

- `webapp/client/src/App.tsx` — the `+ New project` flow (`promptNewProject` → `newProject(name)`).
- `webapp/client/src/state/store.ts` — `newProject`/`createProject` and `init` (where to trigger the
	popup and persist the "seen tutorial" choice, e.g. via `localStorage`).
- `webapp/client/src/components/SettingsModal.tsx` and `index.css` / `tra-ui.css` for existing modal
	and styling patterns to reuse.

## Implementation parts

### Part A — Dedicated tutorial folder

- Create a dedicated tutorial folder (e.g. `webapp/tutorial/` or `webapp/client/src/tutorial/`) that
	holds the tutorial's own example project data, its tutorial risk data, and any assets (SVG/CSS)
	for the animation. Tutorial resources must NOT pollute `webapp/projects/` or regular project
	content, and must not be picked up by `listProjects()`.

### Part B — Tutorial popup on new-project open

- After a new project is created, show a modal with a short intro and two actions: `Start tutorial`
	and `Skip tutorial`. Persist the choice (e.g. `localStorage` key) so it does not reappear every
	time; only trigger on genuinely new projects, not on opening an existing one.

### Part C — Central animated walkthrough

- Build a centered overlay: a focused **animation window** in the middle showing a cursor/hand actor
	performing EmbedRisk actions (no visible keyboard), surrounded by concise captions with key points
	in **bold**. Provide next/back/close controls and a step indicator.
- Sequence the walkthrough through the methodology steps in order (`01-project-description` …
	`09-defects`), each with a one- or two-line what/how/why. Keep animations lightweight (CSS/SVG or
	small JS), not a heavy dependency.

### Part D — Visual polish

- Balanced proportions and consistent theme (light/dark) with the rest of the app; readable, not
	text-heavy; the animation is the focal point.

## Acceptance criteria

- Opening a new project shows the start/skip popup; the choice is remembered.
- Starting the tutorial runs a centered animated walkthrough covering every step in order with short,
	bold-highlighted captions and no visible keyboard.
- Tutorial resources live in a dedicated folder and never appear as a real project.
- The onboarding is visually clean, proportionate, and readable in both themes.

## Required tests / validation

- `npm --workspace client run typecheck` and `npm run build` succeed.
- Manual: create a new project → popup appears → Start runs the walkthrough end-to-end; Skip dismisses
	and is remembered; existing-project open does not show it.

## Risks / guardrails

- Do not let tutorial data leak into `webapp/projects/` or `listProjects()`.
- Keep animation dependencies minimal; prefer CSS/SVG over a large animation library.
- Respect the "no visible keyboard" and "focus on the animation, minimal text" constraints.

---

# === Goal 3: Hide interfaces in the DFD view ===

Goal: 3 — Let the user hide an interface from the DFD view (step 04), then restore it via `CTRL+Z`
or from step 03. (Shared-schema + webapp UI feature.)

## Feature summary

In step 04 (DFD) the user can select an interface and tick a checkbox "hide this interface", which
removes it from the DFD presentation. Undo (`CTRL+Z`) restores it. Alternatively the user can go to
step 03 (system assets), where — **only after** an interface has been hidden — an unhide checkbox
becomes available to make it visible again. Hidden state must persist and be respected by undo/redo,
validation, and report generation.

## Read first

- `webapp/client/src/types.ts` — the `Interface` type (interfaces live in the `system` artifact,
	`03-system-assets/system.json`).
- `webapp/server/src/artifacts.js` (`STEP_FILES`, defaults), `webapp/server/src/validate.js`,
	`webapp/server/src/report.js` — the server consumers of the interface data.
- `webapp/client/src/components/dfd/DfdView.tsx` and `DfdOverview.tsx` — DFD rendering.
- `webapp/client/src/components/panels/SystemPanel.tsx` — step 03 UI.
- `webapp/shared/dfdEngine.js` and any extension code that reads interfaces
	(`vscode-extension/src/*.ts`, `media/dfd-model.js`) for the shared-schema impact.

## Implementation parts

### Part A — Persisted hidden flag

- Add an optional `hidden?: boolean` (default falsy) to the interface model in `types.ts` and the
	system artifact. Absence/`false` means visible — keep backward compatibility with existing files.

### Part B — Hide control in step 04

- In the DFD view, when an interface is selected, offer a "hide this interface" checkbox that sets
	`hidden = true`. Hidden interfaces are omitted from the DFD presentation (but remain in the model).

### Part C — Conditional unhide in step 03

- In the step-03 system panel, show an unhide checkbox for an interface **only when** it is currently
	hidden; unticking it clears `hidden`. Do not show the control for never-hidden interfaces.

### Part D — Undo/redo, validation, report

- Ensure the hide/unhide mutation flows through the existing undo/redo (`CTRL+Z`) history.
- Update `validate.js` and `report.js` (and the extension/report copies if applicable) so hidden
	interfaces are handled consistently (e.g. excluded from the DFD render but still counted where the
	assessment requires them, per existing semantics). Confirm behaviour against example projects.

## Acceptance criteria

- Hiding an interface in step 04 removes it from the DFD presentation without corrupting the model.
- `CTRL+Z` restores a hidden interface; step 03 also offers an unhide control, shown only once the
	interface is hidden.
- Hidden state persists to disk and is respected by validation and report generation.
- Existing projects without the flag continue to load and render unchanged.

## Required tests / validation

- `npm --workspace client run typecheck` / `npm run build`; server-side check that
	`validate`/`report` handle the flag; `node tools/test-models.js` if the DFD models are touched.
- Manual: hide in 04 → gone from DFD; undo → back; hide again → unhide from 03 → back.

## Risks / guardrails

- This is a shared-schema change — update every consumer (client, server validate/report, extension,
	report copies under `vscode-extension/runtime/tools/` and `tools/`).
- Keep the flag optional and backward compatible; never drop a hidden interface from the persisted
	model (hidden ≠ deleted).

---

# === Goal 4: Use-case diagrams ===

Goal: 4 — Add a use-case diagram editor (reusing the existing draw.io engine) with misuse-case
extensions, grouping boxes, a new persisted artifact, and report-inclusion control.

## Decision to make first

The draw.io engine currently lives in the **VS Code extension** (`vscode-extension/media/drawio/`,
`vscode-extension/src/dfdEditor.ts`). Confirm the host for the use-case editor: implement it where
draw.io already exists (the extension) unless the current-goal instructions say the webapp. Either
way, the use-case **artifact** must be added to the shared step model so both consumers can read it
and the report can include it. Read these before deciding:
`vscode-extension/src/{extension,dfdEditor,wizard}.ts`, `vscode-extension/media/*.js`,
`webapp/server/src/artifacts.js`, `webapp/client/src/types.ts`.

## Feature summary

From step 01 a button opens a Use-Case editor. The user can model multiple use-case diagrams with the
standard building blocks: **Actor** (stick figure with a name label beneath the feet), **Action**
(oval with description text centered inside), and **Connection** lines (full or dashed; plain or
arrow pointing either direction; with a parallel text label). Include misuse-case variants
(blacked-out actor and blacked-out action). The user can add **grouping boxes** placed behind the
other entities (full border, like the label technique but solid) to group and name areas, selecting
which entities belong inside. An **Exit** button saves the use cases and returns to step 01, which
then shows a list of all use-case diagram names. A setting controls whether use-case diagrams are
included in the final report (**default: no**). If the user added (mis-)use cases but left the default
`no`, show an acknowledgeable notice that they will be excluded (they can confirm it is intentional).

## Implementation parts

### Part A — Use-case artifact + wiring

- Add a new use-case artifact to the project step model (`artifacts.js` `STEP_FILES`/defaults,
	`types.ts`), persisted as its own JSON, and wire it into persistence, validation, and report
	generation. Preserve the existing step order and backward compatibility.

### Part B — Editor (reuse draw.io)

- Build the editor on the existing draw.io engine with: named actors (label beneath the figure),
	actions (label centered in the oval), connections (full/dashed, plain/arrow with direction,
	parallel label), and grouping boxes rendered **behind** other entities with a solid border and a
	name, where the user selects the contained entities.

### Part C — Misuse-case variants

- Support blacked-out actor and blacked-out action styling for misuse cases.

### Part D — Step-01 entry + list + Exit

- Add a button in step 01 to open the editor; support multiple diagrams; `Exit` saves and returns to
	step 01, which lists all diagram names. Support reopen and safe delete.

### Part E — Report inclusion setting + notice

- Add a setting to include use-case diagrams in the report, defaulting to `off`.
- When (mis-)use cases exist but inclusion is still `off`, show an acknowledgeable notice; record the
	acknowledgement so it is not nagging.

## Acceptance criteria

- Multiple use-case diagrams can be created, saved, reopened, and deleted safely.
- Actors, actions, connections (full/dashed, plain/arrow both directions, labeled), misuse variants,
	and grouping boxes are all representable and persisted.
- Step 01 shows the list of diagram names after Exit; the report includes or excludes use cases per
	the setting, defaulting to `no`.
- If use cases exist but remain excluded, the user sees and can acknowledge the notice.

## Required tests / validation

- `node tools/test-models.js` (extend for the use-case model if it follows the isomorphic
	CommonJS-model pattern); the extension compile/build; report generation on an example with and
	without inclusion.

## Risks / guardrails

- New persisted artifact + step-model change ripples to both consumers and both report copies
	(`tools/` and `vscode-extension/runtime/tools/`). Update all of them.
- Keep `vscode-extension/media/*.js` models CommonJS (loadable in the webview and via `require()` in
	`tools/test-models.js`).
- Default report inclusion is `no`; do not silently include use cases.

---

# === Goal 5: Assumption references in threats ===

Goal: 5 — Make assumptions citeable from threat reasoning so a low-risk/infeasible/irrelevant threat
can point to a concrete assumption ("… not feasible because in A-1 we assumed …").

## Feature summary

A threat can reference one or more assumptions by ID as machine-readable reasoning. These references
surface in the threat rationale, in validation (warn/fail on a missing assumption id), and in the
report, with cross-linking so a reviewer can navigate from a threat to the supporting assumption.

## Read first

- `webapp/client/src/types.ts` — the `Threat` and assumption types; assumptions live in
	`02-assumptions/assumptions.json` (categories: device/system/environment/operational/attacker),
	threats in `06-threats/threats.json`.
- `webapp/client/src/components/panels/{ThreatsPanel,AssumptionsPanel}.tsx` — the UIs.
- `webapp/server/src/{validate,report}.js` and the extension threat/report code — consumers.
- `webapp/client/src/lib/ids.ts` — id/reference helpers already used for cross-links.

## Implementation parts

### Part A — Structured reference field

- Add an optional field on the threat model (e.g. `assumptionRefs?: string[]`) holding assumption
	IDs. Keep it optional and backward compatible.

### Part B — UI to cite assumptions

- In the threats panel, let the user pick/add one or more assumption IDs as reasoning (a picker over
	existing assumptions). Show the cited assumption text inline in the threat rationale.

### Part C — Validation

- In `validate.js` (and the client `lib/validate.ts` if it mirrors), warn or fail when a threat
	references an assumption ID that does not exist.

### Part D — Report + cross-linking

- Surface cited assumptions wherever the threat rationale appears in the report, with a link/anchor
	from the threat to the supporting assumption (and ideally back).

## Acceptance criteria

- A threat can cite one or more assumptions by ID in a machine-readable way, backward compatibly.
- Validation flags a threat that references a missing assumption.
- The report shows the cited assumption wherever the threat rationale is shown, with navigation from
	the threat to the assumption.
- A reviewer can justify a low-risk/infeasible threat by pointing to a concrete assumption ID.

## Required tests / validation

- `npm --workspace client run typecheck` / `npm run build`; server validate/report checks; report
	generation on an example that cites an assumption.

## Risks / guardrails

- Shared-schema change — update client, server validate/report, extension, and both report copies.
- Keep references optional; do not break existing threats/assumptions files.
- Validate/normalise assumption IDs (reuse `lib/ids.ts`); do not render unvalidated ids as links.
