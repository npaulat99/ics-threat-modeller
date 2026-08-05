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

## Next step

- Goal 1, step 1.1: decide and document the launch contract in `webapp/docs/launch-contract.md`.

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
