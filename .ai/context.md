# Project context

EmbedRisk is a TRA toolset for embedded OT/ICS field devices. The repository contains two
independent consumers of the same on-disk project format:

- `webapp/` — Vite + React TypeScript client plus a Node/Express ESM backend with live JSON sync
	over WebSocket and `chokidar`.
- `vscode-extension/` — TypeScript extension with a guided wizard, native editors, and a bundled
	runtime that also reads the same TRA project format.
- `knowledge-base/` — reusable attacker, threat, and countermeasure catalogues.
- `tools/` — CLI utilities and report generators.

## Project structure

- One JSON artifact per methodology step lives under `projects/<id>/`.
- Canonical step order: `01-project-description`, `02-assumptions`, `03-system-assets`, `04-dfd`,
	`05-requirements`, `06-threats`, `07-attack-trees`, `08-countermeasures`, `09-defects`, plus the
	change tracker and generated report.
- The webapp centres on the layered DFD; the remaining steps are adjacent panels or views.
- Shared schemas are mirrored in `webapp/client/src/types.ts` and consumed by
	`webapp/server/src/*.js` and the VS Code extension.

## Conventions and guardrails

- Schema or field changes usually require coordinated updates in `webapp/client/src/types.ts`,
	`webapp/server/src/artifacts.js`, `webapp/server/src/validate.js`, `webapp/server/src/report.js`,
	and any extension files that consume the same schema.
- Keep the draw.io custom models in `vscode-extension/media/*.js` as CommonJS so they continue to
	work both in the webview and when required from Node-based tests.
- There is no repository-wide formatter or linter. Match the surrounding package style and
	semicolon/quote conventions instead of reformatting unrelated code.
- The webapp server binds to `0.0.0.0` on port `4317` by default and serves the built client.
- `TRA_PROJECTS_DIR` can redirect the webapp to a different project root.
- Launch mechanics for existing projects are defined in `webapp/docs/launch-contract.md`; future
	CLI and VS Code entry points should resolve folder targets there instead of inventing local
	rules.
- `npm run build` in `webapp/` builds the client bundle; `npm --workspace client run typecheck`
	checks the client TypeScript.
- New implementation work should stay small and independently testable.

## Workflow note

- Future feature work should assume the planning files are the source of truth for the next step.
- The loop runs as split roles: `plan-step` (architect) → `execute-step` (implementer) →
	`verify-step` (validation) → `review-step` (reviewer) → `final-review` (goal sign-off), with
	`run-loop` as the single-invocation variant. `initialize-goals` (re)builds the backlog.
- When a change affects the shared JSON project format, inspect every consumer before editing.
