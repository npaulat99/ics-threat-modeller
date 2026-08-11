# `.tra-knowledge.json` schema

One file per TRA project, stored at `<project-root>/.tra-knowledge.json` (sibling to
`01-project-description/`, `02-assumptions/`, etc.). It is the structured knowledge-persistence
mechanism described in [.ai/README.md](../README.md): AI session memory for a project, not a TRA
artifact, and not read by the webapp or VS Code extension.

The **formal, authoritative schema** is
[.ai/knowledge/tra-knowledge.schema.json](./tra-knowledge.schema.json) (JSON Schema draft 2020-12).
This page is a prose walkthrough of it — if the two ever disagree, the JSON Schema file wins. Check
a file against it with:

```sh
node tools/validate-knowledge-file.mjs <project-root>/.tra-knowledge.json
```

An example instance is at [.ai/examples/example.tra-knowledge.json](../examples/example.tra-knowledge.json)
(it validates cleanly against the schema).

## Top-level shape

```jsonc
{
  "schemaVersion": 1,
  "projectId": "test",              // matches 01-project-description/project.json projectId
  "updatedAt": "2026-08-11T09:00:00Z",

  "interview": {
    "currentStep": "03-system-assets",   // step key currently being worked on, or null
    "completedSteps": ["01-project-description", "02-assumptions"],
    "openQuestions": [
      {
        "id": "Q-4",
        "step": "03-system-assets",
        "category": "authenticationMethods",
        "question": "What authenticates the firmware-update interface?",
        "askedAt": null,                 // set once actually asked in a session
        "status": "pending"              // pending | answered | deferred
      }
    ],
    "answeredQuestions": [
      {
        "id": "Q-1",
        "step": "02-assumptions",
        "question": "Is the device reachable from the plant IT network, or only the OT network?",
        "answer": "Only the OT network, via a firewalled VLAN.",
        "answeredAt": "2026-08-10T14:20:00Z",
        "kind": "fact"                   // fact | assumption | recommendation-accepted | recommendation-rejected
      }
    ]
  },

  "confirmedContext": {
    "assets": [],
    "communicationPaths": [],
    "trustBoundaries": [],
    "authenticationMethods": [],
    "maintenanceAccess": [],
    "availabilityRequirements": [],
    "constraints": []
  },

  "decisionLog": [
    {
      "date": "2026-08-10T15:00:00Z",
      "change": "Added attacker profile ATK-2 (remote opportunistic scanner) to 02-assumptions/assumptions.json",
      "affectedFiles": ["02-assumptions/assumptions.json"],
      "rationale": "User confirmed the OT VLAN is reachable from a contractor VPN.",
      "approvedBy": "user",
      "approvedAt": "2026-08-10T15:00:00Z"
    }
  ]
}
```

## Field notes

- **`interview.openQuestions` / `answeredQuestions`** — the question queue built by context
  extraction and gap analysis, and its history. Always consult `answeredQuestions` before asking
  the user anything; never re-ask a question already answered here in an earlier session.
- **`confirmedContext`** — free-text entries for information the user has confirmed but that may not
  yet be promoted into an official step file (e.g. captured mid-interview, before enough is known to
  write a well-formed `system.json` asset). Each entry should carry a `sourceQuestionId` pointing back
  into `answeredQuestions`, and, once promoted, a `promotedTo` pointer (e.g.
  `"03-system-assets/system.json#AS-3"`).
- **`decisionLog`** — one entry per approved write to a TRA step file, so the audit trail of "who
  approved what, and why" survives independently of git history / chat transcripts.
- **`kind` / `category` vocabularies are intentionally small and fixed** (`fact`, `assumption`,
  `recommendation-accepted`, `recommendation-rejected`) to keep the fact/assumption/recommendation
  distinction machine-checkable, not just a convention in prose.

## Non-goals

- Not a replacement for `assumptions.json` — confirmed assumptions that belong in the official TRA
  chain still get promoted there so they participate in `validate.js` checks and reports.
- Not validated by `webapp/server/src/validate.js` and not rendered in `report/index.html`. If a
  future need arises to surface interview provenance in the report, that is a schema change to the
  official artifacts, not an extension of this file.

## Validating a knowledge file

`tools/validate-knowledge-file.mjs` is a small, dependency-free structural check (no JSON-Schema
library involved, matching the hand-written style of `webapp/server/src/validate.js`) that enforces
the required fields and fixed vocabularies from `tra-knowledge.schema.json`. Exit code is non-zero if
any issue is found, so it is safe to use as a pre-commit or CI check on `.tra-knowledge.json` files.
