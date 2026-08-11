---
description: "Use when reading or writing a project's .tra-knowledge.json sidecar file — the AI-only structured knowledge persistence mechanism for EmbedRisk TRA projects. Explains its purpose, schema, and why it is exempt from the TRA JSON approval gate."
applyTo: "**/.tra-knowledge.json"
---
# The `.tra-knowledge.json` sidecar file

This file lives at the root of a TRA project folder, next to `01-project-description/` etc. It is
**not** part of the shared TRA schema: the webapp and VS Code extension never read or write it, and
`webapp/server/src/validate.js` never checks it. It exists only so a Copilot session does not
re-ask the user questions already answered in a previous session.

Formal schema: [.ai/knowledge/tra-knowledge.schema.json](../../.ai/knowledge/tra-knowledge.schema.json)
(JSON Schema draft 2020-12; required/optional fields and fixed vocabularies are authoritative there).
Prose walkthrough: [.ai/knowledge/knowledge-schema.md](../../.ai/knowledge/knowledge-schema.md). Check
a file against the schema with `node tools/validate-knowledge-file.mjs <path-to-.tra-knowledge.json>`.

## Rules

- Safe to create and update without user approval — it is AI working memory, not a TRA artifact.
  The approval gate in
  [tra-json-editing.instructions.md](./tra-json-editing.instructions.md) does not apply to it.
- Never store secrets, credentials, or sensitive personal data in it — it is a plain, git-trackable
  JSON file intended to be readable in code review like any other project file.
- Always tag stored information as one of: `fact` (explicitly stated by the user or read from a
  project file), `assumption` (a working assumption the user explicitly confirmed), or
  `recommendation-accepted` / `recommendation-rejected` (an AI proposal the user decided on). Never
  store an AI inference as a bare fact.
- Before asking the user a question, check whether it is already answered here.
- When a piece of confirmed context is later promoted into an official step file (e.g. an asset the
  user described is now in `03-system-assets/system.json`), keep the sidecar entry but note the
  promotion (so the interview history stays auditable even after the data lives in its proper home).
