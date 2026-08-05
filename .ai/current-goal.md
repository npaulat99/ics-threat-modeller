# Current goal (whole-feature execute prompt)

> Workflow: this file now holds an **entire goal** as one large execute prompt, not a single micro
> step. Implement the whole remaining feature in one pass, run the validations at the end, then do a
> single verify/review. When this goal is done, paste the next goal's block from `.ai/backlog.md`
> into this file. Keep the shared-schema guardrails from `.github/copilot-instructions.md` and
> `.ai/context.md`.

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