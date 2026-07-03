# TRA Studio — web application

A browser-based application for the **Threat & Risk Assessment (TRA)** methodology for embedded
OT field devices. It is a parallel alternative to the VS Code extension in [`../tra`](../tra):
the **layered Data Flow Diagram is the centrepiece**, surrounded by guided panels for every
methodology step, with a **live, bidirectional link to the JSON files** on disk.

> Edit in the UI and the JSON files update instantly. Edit a JSON file in your editor and the UI
> updates instantly. The project folder remains the single source of truth.

## Why this design

| Requirement (project.md)                     | How it is met                                                                 |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| DFD as the centre, with recursive layers     | React Flow canvas; trust boundaries enclose their members; external interfaces stay visible as you zoom in |
| Intuitive, modern UI/UX                       | Step navigation, contextual inspector, live risk badges, toolbar drill/inspect |
| Store information as JSON per step            | One JSON file per step under `projects/<id>/` (identical schema to `tra/`)      |
| Edit via UI **and** via JSON files (live)     | WebSocket sync + `chokidar` file watching with echo-suppression                |
| Risk rating (Bug Bar + CVSS)                  | Guided per-threat calculator: Bug Bar impact (max of C/I/A/Safety) + 4-factor likelihood; CVSS informs exploitability |
| Optional attack-defence trees                 | AND/OR/SAND gates (Kordy/Jhawar), per-step access/skill/cost, defence + vulnerability nodes, deterministic metrics |
| Future export formats                         | The risk engine returns structured data; HTML report today, others pluggable   |

## Architecture

```
tra-webapp/
  server/            Node (Express + ws + chokidar) — REST + WebSocket, file watching, report
    src/index.js       wiring: API, WebSocket, file watcher
    src/artifacts.js   step <-> file mapping, read/write, hash-based echo suppression, scaffolding
    src/risk.js        Risk = Likelihood x Impact, bands, residual
    src/validate.js    plausibility checker (incl. trust-boundary + attack-tree checks)
    src/report.js      standalone HTML report (mirrors tra/tools/generate_report.py)
    src/git.js         pull shared knowledge base (read-only) + commit a project to its own repo
  client/            Vite + React + React Flow + zustand
    src/components/dfd/   the layered DFD canvas (the centrepiece)
    src/components/panels/ one panel per step
    src/state/store.ts    state + live-sync transport
  .assets/knowledge-base/  risk scheme + reusable threat/countermeasure library
  projects/<id>/           one folder per TRA project (seeded with the radar-sensor example)
```

### Live sync model

- A UI edit calls `save(step, value)` → optimistic local update → (debounced) WebSocket `save`
  → the server writes the JSON file and relays the change to **other** connected clients.
- The server watches the `projects/` tree. An **external** file edit (hash differs from the last
  value the server wrote) is broadcast to **all** clients, so the UI tracks hand-edited files live.
- Echoes of our own writes are suppressed by comparing content hashes, so there is no feedback loop.

## Run it

```bash
cd tra-webapp
npm install            # installs server + client (npm workspaces)
npm run build          # builds the client into client/dist
npm start              # serves UI + API + WebSocket on http://localhost:4317
```

Open <http://localhost:4317>.

The server binds to `0.0.0.0`, so it is reachable from outside the VM (e.g. the Windows host):
it prints a `network: http://<ip>:4317` URL on startup. Override the interface/port with the
`HOST` and `PORT` environment variables.

### Development (hot reload)

```bash
npm run dev            # Vite dev server on :5173 (proxies API + WS to the backend on :4317)
```

### Point at a different project root

```bash
TRA_PROJECTS_DIR=/path/to/projects npm start
# e.g. reuse the extension's projects:  TRA_PROJECTS_DIR=../tra/projects npm start
```

## DFD navigation

The DFD is the centrepiece. Navigation works through reliable toolbar controls and (where the
browser supports it) direct canvas interaction:

| Control                        | Action                                            |
| ------------------------------ | ------------------------------------------------- |
| **Select node…** menu / click  | select a node to edit in the inspector            |
| **double-click a node**        | open that component's sub-layer (offers to create one if none exists) |
| **▲ Up** button / breadcrumb   | return to the parent layer                        |
| **+ Process / Store / …**      | add a node to the current layer                   |
| Inspector → **Connections**    | add / label / delete data flows between nodes     |

Selecting a node also focuses the inspector's risk matrix on **that component** (the threats that
reference it), so the 5×5 grid doubles as a per-component view.

Trust boundaries are drawn automatically around their member nodes (a boundary must contain at
least one node). External interfaces (HART, Bluetooth, JTAG …) are pinned on every layer and
re-attach to the most specific visible component as you zoom in.

## Data model

One JSON file per step under `projects/<id>/`, matching the `tra/` methodology and schemas
(`tra/.assets/schema/*`):

- `01-project-description/project.json` — device, scope, modelling depth, SL-T.
- `02-assumptions/assumptions.json` — device/system/environment/operational + **mandatory** attacker profiles.
- `03-system-assets/system.json` — components, interfaces, trust boundaries, assets with C/I/A/Safety.
- `04-dfd/dfd.json` — layered DeMarco nodes + flows; nodes additionally carry `x`/`y` for layout.
- `06-threats/threats.json` — STRIDE, affected components, primary interface, Likelihood/Impact, plus
  optional Bug Bar `impactDimensions`, `likelihoodFactors` and `cvss` from the guided calculator.
- `07-attack-trees/attack-trees.json` — optional attack-defence trees (AND/OR/SAND gates, per-step
  access/skill/cost, defence + vulnerability nodes), each linked to a threat.
- `08-countermeasures/countermeasures.json` — m:n `addresses` with residual L/I.

**Risk = Likelihood × Impact** (5×5), banded Low/Medium/High/Critical. Impact follows the Bug Bar
(`max(C, I, A, Safety)`, safety-dominant); likelihood is attacker-grounded (required access,
capability, exploitability, control maturity), with CVSS as an optional exploitability signal.
The canonical scheme is `.assets/knowledge-base/risk-scheme.json`.

## Compliance & collaboration

- **Traceability matrix & exports** — the report renders the full **asset → threat → risk →
  requirement → control → residual → evidence** chain as one table, and writes machine-readable
  `traceability.csv`, `traceability.json` and a CycloneDX `sbom.cdx.json` into the project's
  `report/` folder (also downloadable from the Review step). The DFD is rendered across **all
  layers with trust boundaries**, and the report header pins the **knowledge-base version**.
- **Security requirements (step 05)** — a first-class requirement artifact links
  threats → requirements (with the standard clause / SL·FR) → countermeasures, closing the
  IEC 62443-4-1 SR chain.
- **Risk methodology (P11)** — likelihood is decomposed into **Exposure × Exploitability** (after
  the interview finding that a single coarse likelihood is insufficient), combined as a geometric
  mean onto the familiar 5×5 matrix; impact is the Bug Bar `max(C/I/A/Safety)`. The mandatory
  attacker profile seeds and gates the factors. **Rigorous mode** (Project panel) makes the
  structured rubric and a named rater compulsory for reproducibility.
- **Dashboard (IEC 62443-4-1 overview)** — components (with SBOM version/supplier + third-party
  flag), interfaces, assets, threats, requirements, countermeasures and open defects, with
  ticket/verification-link gaps flagged. Every row links back to the underlying item.
- **SBOM & defect register** — components carry version/supplier/license/CPE (exported as
  CycloneDX); a **defect/vulnerability register** (step 09) tracks CVEs per component across the
  lifecycle, and accepted residual risks require a **sign-off owner, rationale and review date**.
- **Plausibility checker** — reference integrity, STRIDE-per-element/interface coverage,
  residual ≤ initial, mitigated-needs-implemented-control, preventive-control-must-not-cut-impact,
  attacker-proximity vs. exposure, and the requirement chain.
- **Assistant** — drop specifications into `projects/<id>/documents/`; the app proposes applicable
  threats from the shared knowledge base by transparent keyword matching (rule-based, human
  reviewed — the seam where future AI agents plug in).
- **Knowledge base** — browse the department-shared **Bug Bar**, reusable threats/countermeasures/
  **assets/risk-ratings/templates**, and the risk scheme; git-tracked and pull-only.
- **Cross-links, CRA intended purpose & foreseeable use, git integration, dark mode** — threats ↔ countermeasures
  ↔ requirements ↔ assets are click-navigable; the Project panel captures the intended purpose and
  reasonably foreseeable use (both in the report); the shared KB is pulled read-only and a project commits
  to its own repository.
- **Accessibility & guidance** — keyboard-operable navigation, chips and links with focus rings;
  delete confirmation; read-only IDs; an honest save/offline indicator; a Back/Next wizard with a
  per-step "done when"; and colour-blind-safe risk-matrix band letters.

> **Integrations roadmap.** Connecting countermeasures to Jira / Azure DevOps / Polarion is
> documented as a **plan only** in [`docs/integration-api-plan.md`](docs/integration-api-plan.md);
> no tracker connector is implemented yet.
