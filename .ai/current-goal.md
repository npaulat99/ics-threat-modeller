# Current goal (whole-feature execute prompt)

> Workflow: this file now holds an **entire goal** as one large execute prompt, not a single micro
> step. Implement the whole remaining feature in one pass, run the validations at the end, then do a
> single verify/review. When this goal is done, paste the next goal's block from `.ai/backlog.md`
> into this file. Keep the shared-schema guardrails from `.github/copilot-instructions.md` and
> `.ai/context.md`.

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
