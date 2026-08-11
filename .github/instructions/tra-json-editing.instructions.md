---
description: "Use when creating or modifying TRA step JSON files (project.json, assumptions.json, system.json, dfd.json, requirements.json, threats.json, attack-trees.json, countermeasures.json, defects.json) in an EmbedRisk project. Covers the approval gate, id conventions, and field names shared by both the webapp and the VS Code extension."
applyTo: "**/01-project-description/*.json,**/02-assumptions/*.json,**/03-system-assets/*.json,**/04-dfd/*.json,**/04b-use-cases/*.json,**/05-requirements/*.json,**/06-threats/*.json,**/07-attack-trees/*.json,**/08-countermeasures/*.json,**/09-defects/*.json"
---
# Editing TRA step JSON files

These files are the shared, on-disk TRA schema read and written by both `webapp/server` and
`vscode-extension`. Do not add, rename, or remove fields — only populate the existing schema (see
`webapp/client/src/types.ts` for the authoritative field list per step).

## Approval gate

Never write to any of these files without the user having explicitly approved the specific change in
this session. Preparing a diff/summary for review is fine; writing it is not, until approved. This
applies whether you are the TRA Facilitator or invoked directly for a quick edit.

## Identifiers

- Every id (component, interface, trust boundary, asset, threat, requirement, countermeasure, attack
  tree, defect, attacker profile, DFD node) must match `^[A-Za-z0-9 _\-:.]+$` and be **unique across
  the whole project**, not just within its own file — id-space is shared project-wide.
- **One documented exception**: a `04-dfd/dfd.json` node of `type: trust-boundary` is allowed, and
  expected, to reuse the id of the matching `03-system-assets/system.json` trust boundary it
  represents — they are the same entity viewed from two files, not a duplicate. Do not "fix" this by
  renaming one of them; it is exactly what `webapp/server/src/validate.js` allows.
- Prefer short, stable, human-readable ids with a step-scoped prefix already used in the project
  (e.g. `AS-` assets, `T` threats, `CM-`/`ATK-` etc.) — check existing ids in the project before
  inventing a new prefix.

## Traceability chain

Keep every new entry connected to the chain **asset -> threat -> risk rating -> requirement ->
countermeasure -> residual risk**:

- A threat should reference real `components`/`assets`/`interfaceRef` ids and, where a rating is
  claimed, an `attackerRef` whose `access` can plausibly reach the referenced interface's `exposure`.
- A high/critical threat (`likelihood * impact >= 12`) should get a `requirement` derived from it
  unless deliberately `status: accepted` (with `acceptedBy`, `acceptanceRationale`, `reviewDate` set).
- A countermeasure's `addresses[].threat` must reference an existing threat id, and a `preventive`
  countermeasure should lower `residualLikelihood`, not `residualImpact` (and vice versa for
  controls that reduce consequence rather than probability).

## Do not silently default

Leave a field absent (or explicitly flag it as an open question) rather than filling it with a
plausible-sounding value the user has not confirmed — especially `likelihood`, `impact`,
`likelihoodFactors`, `impactDimensions`, `attackerRef`, and any `status`/date field.
