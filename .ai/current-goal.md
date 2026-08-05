# Current goal

Goal: 1 — Launch the webapp into an existing project folder
Active step: 1.2 — Add a runnable CLI entry point for the webapp

## Objective

Add a runnable command-line entry point (a `bin` for the webapp) that starts the existing server
against a resolved projects root, so an existing project folder can be opened from a normal shell
without VS Code and without first clicking `+ New project` in the UI.

This step implements only the **projects-container** case and the resolution precedence from the
launch contract. Detecting a single-project folder and preselecting it (the parent-root
adaptation) is deferred to step 1.3, and the VS Code convenience command is deferred to step 1.4.

## Files allowed to change

- `webapp/bin/embedrisk.js` (new — the CLI launcher)
- `webapp/package.json` (add the `bin` field and, if helpful, a matching npm script)
- `.ai/progress.md`
- `.ai/current-goal.md`

Do not modify `webapp/server/src/*`, the client, or the extension in this step. The launcher must
reuse the existing server unchanged.

## Expected behavior

Follow `webapp/docs/launch-contract.md` exactly:

- Resolve the target folder with the precedence: explicit CLI path argument > `TRA_PROJECTS_DIR` >
	current working directory.
- Treat the resolved folder as a **projects-container** root (existing server semantics). Single-
	project detection is out of scope for this step.
- Start the existing server against that root. Because `webapp/server/src/paths.js` reads
	`TRA_PROJECTS_DIR` at module load, the launcher must set the resolved absolute path into
	`process.env.TRA_PROJECTS_DIR` **before** importing/starting the server, then hand off to the
	current server entry point.
- Preserve existing defaults: `PORT` still defaults to `4317`, the server still binds `0.0.0.0`
	(with `HOST` override), and the report/API behavior is unchanged.
- `npm start` (`node server/src/index.js`) must keep working exactly as before; the launcher is an
	additional entry point, not a replacement.

## Acceptance criteria

- A `bin` entry exists for the webapp and starts the server without VS Code, from any working
	directory.
- Passing an explicit folder path opens that folder; with no argument, `TRA_PROJECTS_DIR` is used;
	with neither, the current working directory is used — matching the documented precedence.
- No file under `webapp/server/`, `webapp/client/`, or `vscode-extension/` is modified.
- The existing `npm start` flow and default port/bind behavior are unchanged.

## Required tests

- Precedence unit check: expose the folder-resolution logic as a small pure function and assert the
	three-way precedence (explicit argument > `TRA_PROJECTS_DIR` > cwd) with a plain Node `assert`
	script, consistent with the repo's existing framework-free test style (`tools/test-models.js`).
- Smoke check: run the `bin` against a temporary folder and confirm the server reports
	`Projects directory: <resolved path>` and answers an HTTP request on `PORT`, then stop it.
- Regression: confirm `npm start` still starts the server against the default `webapp/projects`
	root when no override is set.

## Risks

- `paths.js` reads `TRA_PROJECTS_DIR` at import time; setting the env var after importing the
	server would silently use the wrong root. The launcher must set it first.
- Accidentally changing the default projects directory or port for the existing `npm start` flow.
- Overreach into single-project detection or the VS Code command, which belong to steps 1.3 and
	1.4; keep this step to the container-mode CLI only.
