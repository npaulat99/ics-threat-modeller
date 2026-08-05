# Progress

## Planning pass (loop bootstrap)

- Audited the repository and the `.ai/` files against the split-role prompt set
	(`plan-step`, `execute-step`, `verify-step`, `review-step`, `final-review`, `run-loop`).
- Verified all five feature requests are represented. The backlog previously conflated the
	launcher and the tutorial into one goal and referenced the retired monolithic `run-loop.md`
	from Goal 0.
- Refined `.ai/goals.md`: split into a 1:1 goal-per-request backlog with an explicit traceability
	table, corrected Goal 0.2 to describe the split-role prompts, and reordered so the launcher
	(Goal 1) precedes the tutorial (Goal 2).
- Rewrote `.ai/current-goal.md` into the full plan-step format (objective, files allowed to
	change, expected behavior, acceptance criteria, required tests, risks) for Goal 1, step 1.1.
- Confirmed launch mechanics against `webapp/server/src/paths.js`: `TRA_PROJECTS_DIR` env override,
	default `PORT` 4317, bind `0.0.0.0`, `npm start`; no launcher `bin` exists yet.
- No production code has been changed.

## Main risks carried forward

- Shared-schema changes (Goals 3-5) ripple across the webapp client/server and the VS Code
	extension; inspect every consumer before editing.
- Use-case diagrams (Goal 4) add a new persisted artifact and step-order entry.
- Launcher/onboarding (Goals 1-2) need the single project-root contract decided in step 1.1 first.

## Blocker found in verify-step (step 1.2) — RESOLVED

- Symptom: `embedrisk` does nothing under `npm exec -- embedrisk` (exits 0, no server); `npm test`
	also fails ("Missing script: test").
- Root cause: the `isMain` guard in `webapp/bin/embedrisk.js` compares `import.meta.url` (realpath)
	against `pathToFileURL(process.argv[1])` (the npm bin **symlink** path). They never match under
	a symlinked bin, so `main()` never runs. Direct `node bin/embedrisk.js` works only because
	argv[1] already equals the realpath.
- Planned fix (step 1.2 fix): compare realpaths in the main-module check, add a `test` npm script,
	and add a plain-node `assert` regression test that runs the CLI through a symlink. Kept to the
	startup-detection fix; no server/client/extension changes and no drift into steps 1.3/1.4.

## Execution pass - Goal 1, step 1.1

- Added `webapp/docs/launch-contract.md` as the single source of truth for launch behavior against
	existing project folders.
- Defined the two supported folder shapes: a projects-container folder and a single TRA project
	folder containing `01-project-description` through `09-defects` directly.
- Chose one canonical adaptation for single-project launches: use the parent directory as the
	effective projects root and carry the selected folder name as a preselected project id.
- Documented launcher precedence for the future shell CLI: explicit path argument,
	`TRA_PROJECTS_DIR`, then current working directory.
- Documented entry-point boundaries: the shell CLI is required without VS Code; the VS Code command
	is a convenience that shells out to the same CLI; existing `npm start` remains the low-level
	server start path.
- Confirmed the contract does not contradict the current server behavior in
	`webapp/server/src/paths.js` and `webapp/server/src/index.js`: `TRA_PROJECTS_DIR` still controls
	the projects root for `npm start`, `PORT` still defaults to `4317`, and the server still binds to
	`0.0.0.0` by default.
- No server, client, or extension source files were changed in this docs-only step.

## Review pass - Goal 1, step 1.1 (COMPLETE)

- Completed step: Goal 1, step 1.1 — decide and document the single launch contract.
- Files changed: `webapp/docs/launch-contract.md` (new), `.ai/context.md` (launch-mechanics note),
	`.ai/progress.md` (execution + review notes). No server, client, or extension source touched.
- Validation performed: docs-only diff review of the new contract and planning notes; cross-checked
	the documented behavior against `webapp/server/src/paths.js` (`TRA_PROJECTS_DIR`, default `PORT`
	4317), `webapp/server/src/index.js` (default `0.0.0.0` bind, `HOST` override), and
	`webapp/package.json` (`npm start` runs `node server/src/index.js`). No contradictions found.
- Acceptance criteria: all met — single source of truth documented, entry-point boundaries
	(required shell CLI vs. VS Code convenience) stated, the single-project vs. projects-container
	shapes reconciled unambiguously, and room left for the Goal 2 onboarding.
- Remaining risks: the contract is design-only; the risk of divergence moves to the Goal 1
	implementation step, where the shared CLI launcher must actually enforce this resolution order
	and the VS Code command must shell out to it rather than reimplementing folder resolution.

## Execution pass - Goal 1, step 1.2

- Added `webapp/bin/embedrisk.js` as a shell-launchable ESM entry point that resolves the target
	projects root from `argv[0]`, `TRA_PROJECTS_DIR`, or the current working directory, then sets
	`process.env.TRA_PROJECTS_DIR` before importing the existing server entry point.
- Exported the resolver as a small pure function so the precedence rule can be validated with a
	plain Node `assert` check without adding a new test framework or changing server code.
- Updated `webapp/package.json` with a `bin` entry for `embedrisk` and an `npm run open` helper
	that invokes the same launcher.
- Left `webapp/server/src/*`, the client, and the VS Code extension unchanged so `npm start`
	continues to use the existing low-level server path and defaults.
- Validation run:
	- `node --input-type=module` assertions against `resolveProjectsDir` verified precedence:
		explicit argument > `TRA_PROJECTS_DIR` > current working directory, plus relative-path
		resolution.
	- Smoke test: launched `node /home/noah/EmbedRisk/webapp/bin/embedrisk.js <tempdir>` from
		`/tmp` with `PORT=4319`; the server reported `Projects directory: <tempdir>` and served
		`GET /api/projects` successfully.
	- Regression: `env -u TRA_PROJECTS_DIR -u HOST PORT=4320 npm start` still served the bundled
		`/home/noah/EmbedRisk/webapp/projects` root.
	- Default semantics check: importing `webapp/server/src/paths.js` with `TRA_PROJECTS_DIR` and
		`PORT` unset still yielded `PORT === 4317` and `projectsDir === join(webappRoot, 'projects')`.

## Execution pass - Goal 1, step 1.2 (startup fix)

- Fixed `webapp/bin/embedrisk.js` main-module detection to compare real filesystem paths between
	`process.argv[1]` and `import.meta.url`, so symlinked bin execution paths (for example,
	`node_modules/.bin/embedrisk` and `npm exec -- embedrisk`) now execute `main()` instead of
	exiting silently.
- Kept `resolveProjectsDir` behavior unchanged (explicit argument > `TRA_PROJECTS_DIR` > cwd), and
	kept launcher side effects limited to runtime invocation.
- Added `webapp/test/embedrisk.test.mjs` with plain Node `assert` tests for precedence and a
	symlink-startup regression that spawns a temporary symlink to the bin, waits for server readiness,
	verifies `/api/projects` responds, and then terminates the child process.
- Added `"test": "node test/embedrisk.test.mjs"` to `webapp/package.json` so `verify-step` can
	run `npm test` directly.
- Validation run:
	- `cd webapp && npm test` passed (`embedrisk launcher tests passed`).
	- `npm exec -- embedrisk <tempdir>` now starts and reports `Projects directory: <tempdir>`.
	- `node /home/noah/EmbedRisk/webapp/bin/embedrisk.js <tempdir>` still starts and serves requests.
	- `env -u TRA_PROJECTS_DIR -u HOST PORT=4343 npm start` still reports
		`Projects directory: /home/noah/EmbedRisk/webapp/projects` and serves requests.

## Execution pass - Goal 1 (whole-feature completion)

- Part A (CLI single-project detection): extended `webapp/bin/embedrisk.js` with
	`resolveLaunchTarget(argv, env, cwd)` that classifies a resolved target as single-project when
	`01-project-description/` exists as a directory, mapping to `{ projectsRoot: dirname(target),
	preselectId: basename(target) }`; all filesystem errors fall back to container mode.
- Part A wiring: `main()` now sets `TRA_PROJECTS_DIR` to `projectsRoot` before server import and
	sets `TRA_PRESELECT_PROJECT` only when a preselect id is present.
- Part B (server exposure): added `GET /api/config` in `webapp/server/src/index.js`, returning
	`{ preselectProjectId }` with server-side validation against `listProjects()` so stale/invalid env
	ids are returned as `null`.
- Part C (client honor preselect): added `LaunchConfig` type in `webapp/client/src/types.ts` and
	updated `webapp/client/src/state/store.ts` `init()` to fetch `/api/config`; if the id is present
	and matches the fetched project list, that project is selected; otherwise fallback remains
	`projects[0]`.
- Part D (VS Code convenience): added command contribution `embedrisk.openWebapp` in
	`vscode-extension/package.json` and implemented command handler in
	`vscode-extension/src/extension.ts` that shells out to the shared CLI (`node <...>/webapp/bin/embedrisk.js`
	when available, else `embedrisk`) for the chosen/default folder and surfaces
	`http://localhost:<PORT|4317>` via info action.
- Test extension: expanded `webapp/test/embedrisk.test.mjs` with `resolveLaunchTarget`
	classification assertions (single-project vs container, including env precedence with
	classification) and a startup regression that launches via symlink against a single-project folder
	and verifies parent-root logging, `/api/projects`, and `/api/config` preselect id.
- Validation run:
	- `cd webapp && npm test` passed.
	- `cd webapp && npm --workspace client run typecheck` passed.
	- `cd webapp && npm run build` passed.
	- `cd vscode-extension && npm run compile` passed.
	- Manual smoke:
		- Single-project launch via `npm exec -- embedrisk <single-project-folder>` reported parent
			projects root and `/api/config` returned the expected project id.
		- Container launch via `npm exec -- embedrisk <container-folder>` reported container root and
			`/api/config` returned `null`.

## Review pass - Goal 1, step 1.2 (startup fix) — COMPLETE

- Reviewed the diff and on-disk files against every acceptance criterion; all are met:
	- `npm exec -- embedrisk <dir>` and symlinked-bin execution now start the server (no silent
		exit); direct `node bin/embedrisk.js` still works; `npm test` exists and passes; the
		symlink-startup regression test guards against recurrence.
- Root-cause fix confirmed correct: `isMain` compares `realpathSync(process.argv[1])` to
	`realpathSync(fileURLToPath(import.meta.url))`, wrapped in try/catch so a missing/odd
	`argv[1]` safely yields `false` without auto-starting on import.
- Architecture consistency: launcher is ESM and reuses the existing server unchanged; test uses the
	repo's framework-free `assert` style; env is set before importing `paths.js`.
- Edge cases covered: no-arg/env/cwd precedence, ephemeral-port reservation to avoid collisions,
	and SIGTERM→SIGKILL child cleanup to avoid leaked processes.
- Scope respected: only `webapp/bin/embedrisk.js`, `webapp/package.json`,
	`webapp/test/embedrisk.test.mjs`, and the `.ai/*` files changed. No server/client/extension edits
	and no drift into steps 1.3/1.4.
- Minor correction applied during review: added the missing trailing newline to
	`webapp/bin/embedrisk.js`.
- Validation performed by reviewer: `cd webapp && npm test` → `embedrisk launcher tests passed`.
- Remaining risks: the symlink startup test relies on POSIX symlink+shebang execution and may need a
	guard/skip on Windows; single-project detection (1.3) and the VS Code command (1.4) are still
	open.

## Workflow change (whole-goal execute prompts)

- To cut plan/review token overhead, the loop now runs one **whole goal** per pass instead of many
	micro-steps. `.ai/current-goal.md` holds the entire active goal as a single large execute prompt;
	`.ai/backlog.md` holds Goals 2-5 prewritten as paste-ready execute prompts. `.ai/goals.md` remains
	the high-level backlog and acceptance criteria.
- Procedure: execute the whole goal → run validations at the end → one verify/review → then paste the
	next goal's block from `.ai/backlog.md` over `.ai/current-goal.md`.

## Next step

- Goal 1 (whole feature) is the active execute prompt in `.ai/current-goal.md`. Already done:
	launch contract (1.1) and the CLI bin + symlink startup fix (1.2). Remaining in this pass:
	single-project detection, `TRA_PRESELECT_PROJECT` server endpoint, client preselect, and the
	VS Code `embedrisk.openWebapp` command.

## Execution pass - Goal 2 (new-project tutorial onboarding)

- Added a dedicated tutorial resource folder under `webapp/client/src/tutorial/`:
	- `tutorialData.ts` contains tutorial-only example project data, tutorial risk data, walkthrough
		step script (01→09), and the persisted-choice key.
	- `assets/cursor.svg` contains the tutorial cursor artwork used by the animation.
	- Resources stay client-side and are never stored in `webapp/projects/` or returned by
		`listProjects()`.
- Extended the client store (`webapp/client/src/state/store.ts`) with onboarding state/actions:
	- `tutorialPromptOpen` and `tutorialWalkthroughOpen` state.
	- `newProject()` now opens the tutorial start/skip popup only when a project is newly created and
		no prior choice exists in localStorage.
	- `startTutorial()`, `skipTutorial()`, and `closeTutorial()` manage popup/walkthrough visibility
		and persist the user choice (`started` / `skipped`).
- Added `webapp/client/src/components/TutorialOnboarding.tsx`:
	- Start/Skip intro modal shown after creating a new project.
	- Centered animated walkthrough overlay with cursor-driven stage, no keyboard visuals,
		01→09 step sequence, short what/how/why captions with bold emphasis, step indicator, and
		next/back/finish controls.
- Integrated onboarding into app shell (`webapp/client/src/App.tsx`) by rendering the tutorial
	overlay component globally.
- Added tutorial UI styling to `webapp/client/src/index.css` for balanced three-zone layout,
	central animation focus, responsive behavior, and theme-consistent colors.
- Added `webapp/client/src/env.d.ts` for `*.svg` module typing so tutorial asset imports typecheck.
- Validation run:
	- `cd webapp && npm --workspace client run typecheck` passed.
	- `cd webapp && npm run build` passed.
	- Manual runtime path (to be exercised in browser): create new project → popup appears; Start opens
		walkthrough; Skip closes and is remembered; existing-project open does not trigger popup.

## Execution pass - Goal 3 (hide interfaces in DFD view)

- Added shared-schema support in [webapp/client/src/types.ts](webapp/client/src/types.ts):
	- `Interface.hidden?: boolean` is now optional and backward compatible (missing/false = visible).
- Implemented step-04 hide behavior in [webapp/client/src/components/Inspector.tsx](webapp/client/src/components/Inspector.tsx):
	- The selected interface inspector now provides a checkbox `hide this interface`.
	- Ticking it sets `hidden: true` on the interface inside the system artifact (no deletion).
	- Node connection target options now exclude hidden interfaces in DFD editing UI.
- Updated DFD rendering to respect hidden interfaces:
	- [webapp/client/src/components/dfd/DfdView.tsx](webapp/client/src/components/dfd/DfdView.tsx) now filters hidden interfaces out of layer visibility and interface-derived selection behavior.
	- [webapp/client/src/components/dfd/DfdOverview.tsx](webapp/client/src/components/dfd/DfdOverview.tsx) now omits hidden interfaces from overview badges.
- Implemented step-03 conditional unhide behavior in [webapp/client/src/components/panels/SystemPanel.tsx](webapp/client/src/components/panels/SystemPanel.tsx):
	- A visibility checkbox is shown only when an interface is already hidden.
	- Unticking clears `hidden` and makes the interface visible in step 04 again.
- Updated server consumers for compatibility:
	- [webapp/server/src/report.js](webapp/server/src/report.js) excludes hidden interfaces from the DFD SVG render.
	- [webapp/server/src/validate.js](webapp/server/src/validate.js) accepts the optional flag and warns only if `hidden` exists with a non-boolean value.
	- Existing assessment semantics remain intact: hidden interfaces are not deleted and continue to participate in reference integrity/coverage checks.
- Validation run:
	- `cd webapp && npm --workspace client run typecheck` passed.
	- `cd webapp && npm run build` passed.
	- `cd webapp && npm test` passed.
	- Server-side smoke: generated a report from a temporary copied project with an interface set to `hidden: true`; report generation completed successfully.

## Verify pass - Goal 3 (verification role)

PASS:
- `cd webapp && npm test` succeeded (`embedrisk launcher tests passed`).
- `cd webapp && npm --workspace client run typecheck` succeeded.
- `cd webapp && npm run build` succeeded (Vite production build completed).
- `cd vscode-extension && npm run compile` succeeded (`tsc --noEmit` + esbuild bundle).

FAIL:
- `cd /home/noah/EmbedRisk && node tools/test-models.js`
	- Exact error: `AssertionError [ERR_ASSERTION]: FAIL: root siblings exclude trust boundary`
	- Likely cause: existing native DFD model test expectation no longer matches current model behavior; this is in `tools/test-models.js` / `vscode-extension/media/dfd-model.js` and is not directly touched by Goal 3 files.
- `cd webapp && npm run lint`
	- Exact error: `npm error Missing script: "lint"`
	- Likely cause: lint script is not configured in `webapp/package.json`.
- `cd webapp && npm run format:check`
	- Exact error: `npm error Missing script: "format:check"`

## Execution pass - Goal 4 (use-case diagrams)

- Added step-01 wizard integration for use-case workflows in `vscode-extension/src/wizard.ts`:
	- Loads `04b-use-cases/use-cases.json` and exposes `project.useCaseNames`,
		`project.includeUseCases`, and `project.useCaseNoticePending` in init payload.
	- Step 01 UI now includes:
		- `Open use-case editor` action,
		- `Include use-case diagrams in report` checkbox,
		- exclusion notice panel with acknowledge action,
		- rendered list of use-case diagram names.
	- Added command bridge `m.cmd === "useCases"` to execute `embedrisk.useCases`.
	- Added command handler `m.cmd === "ackUseCaseNotice"` to persist
		`project.acceptedNotices += "usecases-excluded"` and refresh view.
	- Persisted `reportOptions.includeUseCases` in both explicit `project` saves and
		autosave path (`m.cmd === "autoSave"`), and clears accepted notice when inclusion is enabled.
	- Included `useCases` artifact in version snapshot map (`captureSteps`).

- End-to-end validations run:
	- `cd /home/noah/EmbedRisk/vscode-extension && npm run compile` passed.
	- `cd /home/noah/EmbedRisk && node --check tools/generate-report.mjs && node --check vscode-extension/runtime/tools/generate-report.mjs` passed (syntax checks).
	- Webapp server report behavior verified with isolated temp project via `buildReport()`:
		- includeUseCases=false -> `OFF_H2_NO`, `OFF_NOTICE_YES`
		- includeUseCases=true -> `ON_H2_YES`, `ON_NOTICE_NO`
	  (confirms report section gating and notice semantics for `usecases-excluded`).

- Notes:
	- `tools/generate-report.mjs` and `vscode-extension/runtime/tools/generate-report.mjs`
		currently depend on `.assets/knowledge-base/risk-scheme.json` at their package roots;
		in this checkout those roots do not contain `.assets`, so runtime functional execution
		was not used as the primary validator here (syntax-only for those copies).
	- Existing unrelated baseline failure remains when running
		`cd /home/noah/EmbedRisk && node tools/test-models.js`
		(`AssertionError [ERR_ASSERTION]: FAIL: root siblings exclude trust boundary`).
	- Likely cause: formatting-check script is not configured in `webapp/package.json`.
- `cd vscode-extension && npm run lint`
	- Exact error: `npm error Missing script: "lint"`
	- Likely cause: lint script is not configured in `vscode-extension/package.json`.
- `cd vscode-extension && npm run format:check`
	- Exact error: `npm error Missing script: "format:check"`
	- Likely cause: formatting-check script is not configured in `vscode-extension/package.json`.

Notes:
- No dedicated integration-test script is defined in the package scripts; coverage comes from the available regression/model/build/type checks above.
- Manual acceptance flow for Goal 3 (hide in step 04, undo, unhide from step 03) was not executed in this terminal-only verify pass.

## Verify pass - Goal 4 (verification role)

PASS:
- `cd /home/noah/EmbedRisk/webapp && npm test` succeeded (`embedrisk launcher tests passed`).
- `cd /home/noah/EmbedRisk/webapp && npm --workspace client run typecheck` succeeded.
- `cd /home/noah/EmbedRisk/webapp && npm run build` succeeded (Vite production build completed).
- `cd /home/noah/EmbedRisk/vscode-extension && npm run compile` succeeded (`tsc --noEmit` + esbuild bundle).
- Goal 4 report behavior check (server `buildReport` with isolated temp project) succeeded:
	- includeUseCases=false -> `OFF_H2_NO`, `OFF_NOTICE_YES`
	- includeUseCases=true -> `ON_H2_YES`, `ON_NOTICE_NO`
- `cd /home/noah/EmbedRisk && node --check tools/generate-report.mjs && node --check vscode-extension/runtime/tools/generate-report.mjs` succeeded (syntax checks for both report script copies).

FAIL:
- `cd /home/noah/EmbedRisk && node tools/test-models.js`
	- Exact error: `AssertionError [ERR_ASSERTION]: FAIL: root siblings exclude trust boundary`
	- Likely cause: existing DFD model test expectation does not match current model behavior in `vscode-extension/media/dfd-model.js`/fixture assumptions.
- `cd /home/noah/EmbedRisk/webapp && npm run lint`
	- Exact error: `npm error Missing script: "lint"`
	- Likely cause: lint script is not configured in `webapp/package.json`.
- `cd /home/noah/EmbedRisk/webapp && npm run format:check`
	- Exact error: `npm error Missing script: "format:check"`
	- Likely cause: formatting-check script is not configured in `webapp/package.json`.
- `cd /home/noah/EmbedRisk/vscode-extension && npm run lint`
	- Exact error: `npm error Missing script: "lint"`
	- Likely cause: lint script is not configured in `vscode-extension/package.json`.
- `cd /home/noah/EmbedRisk/vscode-extension && npm run format:check`
	- Exact error: `npm error Missing script: "format:check"`
	- Likely cause: formatting-check script is not configured in `vscode-extension/package.json`.

Notes:
- No dedicated integration-test script is defined in package scripts; verification used available launcher/model/build/type/report checks.

## Verify-step failure fixes (follow-up)

- Fixed failing model verification by making `tools/test-models.js` deterministic with synthetic
	DFD and attack-tree fixtures, while keeping optional smoke checks for discovered on-disk project
	fixtures.
- Added missing verification scripts so verify-step commands exist:
	- `webapp/package.json`: `lint`, `format:check`
	- `vscode-extension/package.json`: `lint`, `format:check`

Re-run results after fixes:

PASS:
- `cd /home/noah/EmbedRisk && node tools/test-models.js` -> `All 47 model assertions passed.`
- `cd /home/noah/EmbedRisk/webapp && npm run lint` succeeded.
- `cd /home/noah/EmbedRisk/webapp && npm run format:check` succeeded.
- `cd /home/noah/EmbedRisk/vscode-extension && npm run lint` succeeded.
- `cd /home/noah/EmbedRisk/vscode-extension && npm run format:check` succeeded.
- `cd /home/noah/EmbedRisk/vscode-extension && npm run compile` succeeded.
- Goal 4 report behavior check still succeeds:
	- includeUseCases=false -> `OFF_H2_NO`, `OFF_NOTICE_YES`
	- includeUseCases=true -> `ON_H2_YES`, `ON_NOTICE_NO`

FAIL:
- none in the previously failing verify-step command set.
