# Integration plan: issue trackers & ALM (Jira / Azure DevOps / Polarion)

> **Status: PLAN ONLY — not implemented.** This document describes how the TRA web app
> *would* connect countermeasures and threats to an external issue tracker / ALM tool so
> that implementation tickets and verification evidence are created and kept in sync
> automatically. No connector code exists yet; today the link is manual via the
> `ticketUrl` and `verificationUrl` fields on each countermeasure.

## 1. Goal & scope

The IEC 62443-4-1 dashboard requires, for every countermeasure marked **implemented** or
**verified**, a traceable link to:

- an **implementation ticket** (`ticketUrl`) — proof the work was scheduled/done, and
- a **verification record** (`verificationUrl`) — proof it was tested.

Today an engineer pastes those URLs by hand. This plan describes an optional integration
layer that:

1. **Creates** a ticket from a countermeasure (one click) and stores the returned URL/key.
2. **Pulls** the current ticket status back into the app (open / in progress / done) so the
   dashboard can flag stale or unverified items.
3. **Links** a verification work item (test case / test run) to the same countermeasure.

Out of scope for the first iteration: two-way editing of ticket bodies, comment sync,
attachment upload, and bulk reconciliation.

## 2. Where this fits the existing architecture

```
client (React) ──HTTP──▶ server (Express, :4317) ──HTTPS──▶ tracker REST API
                                   │
                                   └── secrets from env / OS keychain (never project JSON)
```

- All tracker calls happen **server-side only**. The browser never holds a tracker token.
- A new server module `server/src/integrations/` would hold one file per provider plus a
  shared `connector.js` interface. The existing `git.js` pattern (validated input, no shell,
  `execFile`/`fetch` with explicit args) is the model to follow.
- Endpoints (proposed):
  - `POST /api/projects/:id/countermeasures/:cmId/ticket` → create issue, return `{ url, key }`.
  - `GET  /api/projects/:id/countermeasures/:cmId/ticket` → fetch current status.
  - `POST /api/projects/:id/countermeasures/:cmId/verification` → link a test work item.
  - `GET  /api/integrations/status` → which provider is configured, connectivity check.

## 3. Configuration & secrets (security-critical)

- **No secrets in project files.** Project JSON may store only non-secret routing data
  (provider id, base URL, project/board key, default issue type).
- Secrets (PAT / OAuth client secret) come from **environment variables** or an OS secret
  store, read at server start: e.g. `TRA_JIRA_TOKEN`, `TRA_ADO_PAT`, `TRA_POLARION_TOKEN`.
- A `tracker` block in the **knowledge base** (`.assets/knowledge-base/integrations.json`,
  git-tracked, secret-free) defines the shared org-level defaults so the security unit owns
  one config for all projects.
- Validate all user-supplied URLs/keys (allowlist host, reject shell metacharacters) exactly
  as `git.js` already does for repo URLs.
- Apply least-privilege scopes on the token (create + read issues only; no admin).
- Rate-limit and time-out outbound calls; surface failures as non-blocking warnings.

## 4. Provider specifics

### 4.1 Jira (Atlassian Cloud / Data Center)

- **API:** Jira REST API v3 (`/rest/api/3`).
- **Auth:** Cloud → Basic auth with `email:API_TOKEN` (base64) or OAuth 2.0 (3LO);
  Data Center → Personal Access Token bearer.
- **Create ticket:** `POST /rest/api/3/issue` with
  `{ fields: { project: { key }, issuetype: { name }, summary, description (ADF) } }`.
  Map: summary = `"[CM] <cm.id> <cm.title>"`, description = countermeasure detail + addressed
  threat IDs + TRA project link. Store returned `key` → build `…/browse/<key>` URL.
- **Read status:** `GET /rest/api/3/issue/<key>?fields=status` → `fields.status.name`.
- **Verification link:** if Xray/Zephyr present, link a test issue via issue link
  (`POST /rest/api/3/issueLink`); otherwise store the test issue URL in `verificationUrl`.

### 4.2 Azure DevOps (Boards)

- **API:** Azure DevOps REST API 7.1 (`https://dev.azure.com/{org}/{project}/_apis/wit`).
- **Auth:** Personal Access Token (Basic, `:PAT` base64) or Microsoft Entra OAuth.
- **Create work item:** `POST .../wit/workitems/$Task?api-version=7.1` with a JSON-Patch body
  (`[{ op:'add', path:'/fields/System.Title', value }, …]`). Returns `id` + `_links.html.href`.
- **Read status:** `GET .../wit/workitems/{id}?fields=System.State` → `System.State`.
- **Verification link:** create/link a **Test Case** work item and relate it with
  `System.LinkTypes.Tested-By`, or store the test run URL in `verificationUrl`.

### 4.3 Polarion ALM

- **API:** Polarion REST API (OpenAPI, `/polarion/rest/v1`); older instances expose the
  Java/Web Services API — prefer REST where available.
- **Auth:** Personal Access Token (bearer).
- **Create work item:** `POST /projects/{projectId}/workitems` (JSON:API document) with
  `type` (e.g. `task`/`change_request`), `title`, `description`. Returns the work item id;
  build `…/polarion/#/project/{projectId}/workitem?id=<id>`.
- **Read status:** `GET /projects/{projectId}/workitems/{id}?fields[workitems]=status`.
- **Verification link:** link a **Test Case** work item via a `verifies`/`tests` link role,
  or reference a Polarion Test Run in `verificationUrl`. Polarion's native traceability makes
  it the richest target for 62443 evidence.

## 5. Data mapping (common model)

| TRA field | Ticket field | Notes |
|---|---|---|
| `cm.id` + `cm.title` | summary / title | prefix `[CM]` for filtering |
| `cm.detail` | description / body | append addressed threat IDs + TRA project name |
| `cm.addresses[].threat` | linked items / labels | one label/link per threat |
| ticket key/URL (returned) | `cm.ticketUrl` | written back into project JSON |
| ticket state → mapped | (dashboard badge) | open/in-progress/done → not-started/in-progress/implemented |
| test work item URL | `cm.verificationUrl` | required before status = verified |

State mapping table lives in `integrations.json` so each org can map its own workflow names.

## 6. Phasing

1. **Phase 0 (today):** manual `ticketUrl` / `verificationUrl` + dashboard validation warnings. ✅ done.
2. **Phase 1:** read-only status sync for one provider (start with Jira) — a "refresh status"
   button that colours the dashboard. No write scope needed.
3. **Phase 2:** one-click ticket creation (write scope), write `ticketUrl` back.
4. **Phase 3:** verification/test-case linking; Azure DevOps + Polarion connectors behind the
   same `connector.js` interface.
5. **Phase 4:** scheduled reconciliation + audit log of sync actions.

## 7. Open questions for the engineer

- Which tracker is the primary system of record at the target organisation?
- Self-hosted (Data Center / on-prem Polarion) or cloud? (changes auth + base URL handling)
- Is a dedicated service account available with least-privilege scopes?
- Should verification require a *passed* test run, or only a linked test case?
