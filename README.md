# ICS Threat Modeller

A desktop application for **attack-tree based threat modelling** of Industrial Control Systems (ICS) and embedded field devices. Built with [Tauri 2](https://v2.tauri.app/) (Rust backend + Svelte frontend) and SQLite.

![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [Windows](#windows)
  - [Linux](#linux)
- [Building from Source](#building-from-source)
  - [Native Build](#native-build)
  - [Docker Build](#docker-build)
- [Usage](#usage)
  - [Creating a Project](#creating-a-project)
  - [Building Attack Trees](#building-attack-trees)
  - [Cost Factor Assessment](#cost-factor-assessment)
  - [Probability Calculations](#probability-calculations)
  - [Catalog](#catalog)
  - [Export & Import](#export--import)
  - [Versioning & Snapshots](#versioning--snapshots)
- [Project Structure](#project-structure)
- [Development](#development)
- [License](#license)

---

## Features

- **Attack Tree Modelling** — Build hierarchical attack trees with goals, categories, steps, and substeps.  AND/OR conjunctions for flexible modelling.
- **Quantitative Assessment** — Five cost factors (Elapsed Time, Expertise, Knowledge of Target, Window of Opportunity, Equipment) scored 0–10 with configurable weights.
- **Probability Calculation** — Automatic computation of attack path probabilities using the cost-based methodology from the thesis (§4). Supports AND/OR aggregation.
- **Countermeasures & Weaknesses** — Attach countermeasures (with effectiveness ratings) and weaknesses to any step or substep.
- **Attacker Profiles** — Define attacker archetypes with capability levels, motivations, and resources.
- **MITRE ATT&CK for ICS Mappings** — Map attack steps to ATT&CK technique IDs.
- **Catalog** — Pre-built attack tree templates (firmware compromise, process manipulation, persistent access, etc.) with one-click import.
- **Export / Import** — Full project export/import in JSON or YAML format.
- **Versioning** — Create named snapshots, compare them with semantic diffing, and restore previous states.
- **SQLite Database** — All data stored locally in a single portable `.db` file with WAL mode.
- **Cross-platform** — Runs on Windows and Linux as a native desktop application.
- **Docker Support** — Build inside a Docker container for reproducible builds.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Tauri 2 Shell                   │
│  ┌────────────────┐    ┌──────────────────────┐  │
│  │  Svelte 4 GUI  │◄──►│    Rust Backend     │  │
│  │  (TypeScript)  │    │   (tauri commands)   │  │
│  │                │    │                      │  │
│  │  • Tree View   │    │  • SQLite (rusqlite) │  │
│  │  • Assessment  │    │  • Probability Calc  │  │
│  │  • Catalog     │    │  • Export/Import     │  │
│  │  • Export/Imp  │    │  • Versioning/Diff   │  │
│  │  • Versioning  │    │  • Catalog Seed      │  │
│  └────────────────┘    └──────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## Prerequisites

### Windows

| Tool        | Version  | Install                                                |
|-------------|----------|--------------------------------------------------------|
| **Rust**    | ≥ 1.70   | [rustup.rs](https://rustup.rs/)                        |
| **Node.js** | ≥ 18     | [nodejs.org](https://nodejs.org/)                      |
| **npm**     | ≥ 9      | Included with Node.js                                  |
| **WebView2**| Latest   | Pre-installed on Windows 10/11; or download from [Microsoft](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) |
| **Visual Studio Build Tools** | 2019+ | Select "Desktop development with C++" workload |

### Linux (Debian/Ubuntu)

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# System dependencies for Tauri
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev
```

---

## Installation

### Pre-built Binaries

Download the latest release for your platform from the [Releases](../../releases) page:

- **Windows**: `ICS-Threat-Modeller_x.y.z_x64-setup.exe` (installer) or `.msi`
- **Linux**: `.deb` package or `.AppImage`

### Windows

1. Download and run the installer.
2. The application installs to `C:\Program Files\ICS Threat Modeller\`.
3. Launch from the Start Menu or desktop shortcut.

### Linux

```bash
# Debian/Ubuntu (.deb)
sudo dpkg -i ics-threat-modeller_x.y.z_amd64.deb

# Or use the AppImage
chmod +x ICS-Threat-Modeller_x.y.z_amd64.AppImage
./ICS-Threat-Modeller_x.y.z_amd64.AppImage
```

---

## Building from Source

### Native Build

```bash
# 1. Clone the repository
git clone https://github.com/your-org/ics-threat-modeller.git
cd ics-threat-modeller

# 2. Install frontend dependencies
npm install

# 3. Development mode (hot-reload)
npm run tauri dev

# 4. Production build
npm run tauri build
```

The built application will be in `src-tauri/target/release/bundle/`.

### Docker Build

Build the application inside a Docker container (no local Rust/Node toolchain needed):

```bash
# Build using Docker Compose
docker compose run --rm build-only

# The binary and bundle will be in ./output/
ls output/
```

Or build the full image:

```bash
docker compose build ics-threat-modeller
```

To run the containerised application (Linux only, requires X11):

```bash
xhost +local:docker
docker compose up ics-threat-modeller
```

---

## Usage

### Creating a Project

1. Launch the application.
2. Click **"Open Projects"** on the home page or use the sidebar.
3. Click **"+ New Project"** and enter a name, description, and device type.
4. Configure project-specific parameters:
   - **Access Probability (P_access)** — likelihood the attacker has network/physical access.
   - **Entry Point Probability (E_P)** — probability of a viable entry point existing.
   - **Factor Weights** — relative importance of each cost factor (must sum to ~1.0).

### Building Attack Trees

1. Open a project and navigate to **Attack Tree**.
2. Click **"+ Goal"** to create a top-level attack goal (e.g., *"Compromise Device Firmware"*).
3. Use the **"+"** button on any node to add children:
   - **Steps** (attack steps, can be leaf or composite).
   - **Categories** (organisational grouping under goals).
   - **Substeps** (detailed sub-actions under a step).
4. Click any node to view its details in the right panel.

### Cost Factor Assessment

1. Navigate to the **Assessment** page.
2. Select a goal, then select a leaf step.
3. For each cost factor, set a value from 0 (trivial) to 10 (extremely difficult):
   - **Elapsed Time** — time required for the attack.
   - **Expertise** — technical skill level needed.
   - **Knowledge of Target** — target-specific knowledge required.
   - **Window of Opportunity** — access conditions needed.
   - **Equipment** — specialised tools required.
4. Add a rationale explaining each rating.
5. The probability is computed automatically:
   - $C(s_i) = \sum_j w_j \cdot v_j$ (weighted cost)
   - $P_{cost}(s_i) = 1 - C(s_i) / 10$ (cost-to-probability mapping)

### Probability Calculations

Attack path probabilities are computed as:

$$P(P | A) = E_P \cdot P_{access} \cdot \prod_{i \in P} P_{cost}(s_i)$$

Goal-level aggregation:
- **OR**: $P_{goal} = 1 - \prod_k (1 - P_k)$ (any path succeeds)
- **AND**: $P_{goal} = \prod_k P_k$ (all paths must succeed)

Results are shown in the **Path Probability Table** with severity ratings (Low/Medium/High/Critical).

### Catalog

The catalog provides pre-built attack tree templates:

- **Firmware Compromise** — JTAG extraction, update hijacking
- **Process Manipulation** — HMI setpoint modification, PLC logic change
- **Persistent Access** — backdoor implantation, network infrastructure compromise
- **Information Leakage** — traffic capture, historian exfiltration
- **Supply Chain Attack** — trojanised component delivery
- **Credential Theft** — default credentials, IT/OT convergence
- **Denial of Service** — network flooding, malformed packets
- **Sensor Spoofing** — MITM on sensor networks

Click **"Import into Project"** to add a template to your current project.

### Export & Import

- **Export**: Select JSON or YAML format and click "Export Project". Copy the output or save to a file.
- **Import**: Paste JSON/YAML data and click "Import" to create a new project from the data.
- All project data is included: goals, steps, assessments, countermeasures, weaknesses, technique mappings, and tags.

### Versioning & Snapshots

1. Navigate to **Versions**.
2. **Create Snapshot**: Enter a name and optional description/author, then click "Save Snapshot".
3. **Restore**: Click "Restore" on any snapshot to replace current project data.
4. **Compare**: Select two snapshots and click "Compare" to see a semantic diff showing added, removed, and modified entities with field-level changes.

---

## Project Structure

```
ics-threat-modeller/
├── src/                          # Frontend (Svelte + TypeScript)
│   ├── lib/
│   │   ├── types.ts              # TypeScript type definitions
│   │   ├── api.ts                # Tauri invoke wrappers
│   │   ├── calculations.ts       # Client-side probability calculations
│   │   └── stores.ts             # Svelte stores (application state)
│   ├── components/
│   │   ├── Layout.svelte         # App layout with sidebar
│   │   ├── Sidebar.svelte        # Navigation sidebar
│   │   ├── TreeView.svelte       # Attack tree visualisation
│   │   ├── TreeNode.svelte       # Recursive tree node
│   │   ├── AssessmentForm.svelte  # Cost factor assessment form
│   │   ├── CostFactorInput.svelte # Individual factor slider
│   │   ├── PathProbabilityTable.svelte # Path probability results
│   │   ├── CatalogBrowser.svelte  # Catalog search and import
│   │   ├── ExportImportDialog.svelte # Export/Import UI
│   │   ├── VersionManager.svelte  # Snapshot management
│   │   ├── DiffView.svelte        # Snapshot comparison view
│   │   └── ConfirmDialog.svelte   # Confirmation modal
│   ├── pages/
│   │   ├── Home.svelte
│   │   ├── ProjectList.svelte
│   │   ├── ProjectDetail.svelte
│   │   ├── AttackerProfiles.svelte
│   │   ├── AttackTree.svelte
│   │   ├── Assessment.svelte
│   │   ├── Catalog.svelte
│   │   ├── ExportImport.svelte
│   │   └── Versions.svelte
│   ├── App.svelte                # Root component with router
│   ├── main.ts                   # Application entry point
│   └── app.css                   # Global styles
├── src-tauri/                    # Backend (Rust)
│   ├── src/
│   │   ├── main.rs               # Binary entry point
│   │   ├── lib.rs                # Tauri app setup & command registration
│   │   ├── db/
│   │   │   ├── mod.rs            # Database connection management
│   │   │   ├── schema.rs         # 13-table SQLite schema
│   │   │   └── models.rs         # All data structs (entities, DTOs)
│   │   ├── commands/
│   │   │   ├── mod.rs            # Command module declarations
│   │   │   ├── projects.rs       # Project CRUD
│   │   │   ├── attacker_profiles.rs
│   │   │   ├── goals.rs          # Goals with cascade delete
│   │   │   ├── categories.rs
│   │   │   ├── steps.rs          # Steps with recursive cascade
│   │   │   ├── substeps.rs
│   │   │   ├── countermeasures.rs
│   │   │   ├── weaknesses.rs
│   │   │   ├── assessments.rs    # Including upsert
│   │   │   ├── calculations.rs   # Probability engine
│   │   │   ├── tags.rs           # Tags + ATT&CK mappings
│   │   │   ├── catalog.rs        # Catalog CRUD + import + seed
│   │   │   ├── export_import.rs  # JSON/YAML/directory export/import
│   │   │   └── versioning.rs     # Snapshots, diff, change log
│   │   └── catalog/
│   │       ├── mod.rs
│   │       └── starter_data.rs   # 8 pre-built attack tree templates
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── build.rs
├── public/
│   └── favicon.svg
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
├── .gitignore
├── package.json
├── vite.config.ts
├── tsconfig.json
├── svelte.config.js
└── index.html
```

---

## Development

```bash
# Start dev server with hot-reload
npm run tauri dev

# Type-check frontend
npm run check

# Build for production
npm run tauri build

# Run Rust tests
cd src-tauri && cargo test

# Format Rust code
cd src-tauri && cargo fmt

# Lint Rust code
cd src-tauri && cargo clippy
```

### Database

The SQLite database is created automatically at `ics_threat_modeller.db` in the application's working directory. It uses:
- **WAL mode** for concurrent read performance.
- **Foreign keys** enforced.
- **13 tables**: projects, goals, categories, steps, substeps, countermeasures, weaknesses, assessments, attacker_profiles, attack_technique_mappings, tags, catalog_entries, snapshots, change_log.

### Technology Stack

| Layer     | Technology                             |
|-----------|----------------------------------------|
| Framework | Tauri 2.x                              |
| Frontend  | Svelte 4, TypeScript, Vite 6           |
| Backend   | Rust (edition 2021)                    |
| Database  | SQLite via rusqlite 0.31 (bundled)     |
| Routing   | svelte-spa-router 4                    |
| Styling   | Scoped CSS with CSS custom properties  |
| Build     | Vite (frontend), Cargo (backend)       |
| Container | Docker with multi-stage build          |

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.