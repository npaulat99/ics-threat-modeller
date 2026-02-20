# Project Requirements Document

## Database-Backed Threat Modeling Tool for Embedded Field Devices

**Version:** 1.0
**Date:** 2026-02-20

---

## 1. Project Overview

### 1.1 Purpose

Build a desktop application for modeling cybersecurity risks of embedded field devices (sensors, actuators, PLCs) in process and factory automation using attack trees and attack paths. The tool replaces spreadsheet-based threat modeling with a structured, database-backed approach that provides traceability, versionability, and intersubjective comparability of risk analyses.

### 1.2 Target Users

- Security analysts assessing embedded field devices
- Device development engineers with limited security expertise
- Auditors reviewing threat models for IEC 62443 / CRA compliance

### 1.3 Scope

The tool targets **device-level** threat modeling (Purdue Level 0/1), not system-level or ICS-level analysis. It covers the full workflow: system definition → attacker model → attack tree construction → per-step assessment → path probability computation → countermeasure assignment → versioned export.

### 1.4 Constraints & Assumptions

| ID | Constraint / Assumption |
|----|------------------------|
| C-1 | The tool runs as a cross-platform desktop application (Windows, macOS, Linux). |
| C-2 | All data is stored locally in a SQLite database file; no cloud dependency. |
| C-3 | The threat model data format must be Git-diffable (JSON/YAML text serialization). |
| C-4 | Assessment scales use 5-point ordinal values (not 1–10) to avoid false precision. |
| C-5 | The tool does **not** perform impact/damage assessment — it focuses on attack probability. Device manufacturers often cannot determine downstream impact because the deployment context is unknown. |
| C-6 | The catalog knowledge base is extensible; initial delivery includes a starter set, not full coverage. |
| A-1 | Users have basic familiarity with cybersecurity concepts and the device they are analyzing. |
| A-2 | Git is available on the user's system for version control workflows (optional but recommended). |

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop framework | **Tauri** (Rust backend + web frontend) | Small binary, low memory, native OS integration, file system access |
| Database | **SQLite** | Zero-config, file-based, portable; schema portable to PostgreSQL |
| Frontend | HTML / CSS / TypeScript (framework TBD — e.g., Svelte, React, Vue) | Rich interactive tree visualization, form-based data entry |
| Serialization | JSON and YAML | Git-compatible, human-readable, diffable |
| Version control | Git (external) | Standard tooling for branching, merging, pull request review |

---

## 3. Data Model

### 3.1 Layered Architecture

The data model is organized into three layers that **must** be kept strictly separated:

| Layer | Concern | Contains |
|-------|---------|----------|
| **Structural** | _What_ can go wrong | Goals, Steps, Sub-steps, Categories, Countermeasures, Weaknesses, AND/OR conjunctions |
| **Assessment** | _How likely_ it is | 7 cost factors per step, access level, skill level, computed probabilities |
| **Context** | _Who_ attacks and _where_ | Attacker profiles, deployment assumptions, project-specific assessment overrides |

### 3.2 Entity Types

| Entity | Assessed? | Description |
|--------|-----------|-------------|
| **Goal** | Impact only | Root node — the attacker's overarching objective. One per attack tree. |
| **Step** | ✅ Yes (7 cost factors) | A concrete attacker action. Primary unit of assessment. |
| **Sub-step** | ✅ Yes (7 cost factors) | Fine-grained decomposition of a Step. Inherits assessment structure. |
| **Category / Label** | ❌ No | Non-assessed grouping container for thematic organization. Excluded from risk calculations. |
| **Countermeasure** | Effectiveness + cost | Defensive measure linked to a Step/Sub-step. Modifies cost factors of its parent. |
| **Weakness** | Severity | Vulnerability or design flaw linked to a Step/Sub-step. Modifies cost factors of its parent. |

### 3.3 Relationships

```
Goal
 ├── Category (optional grouping, nestable)
 │    └── Step
 │         ├── Sub-step
 │         ├── Countermeasure
 │         └── Weakness
 └── Step (directly under Goal)
      ├── Sub-step
      ├── Countermeasure
      └── Weakness
```

- Sibling nodes under a parent are connected by **AND** or **OR** conjunctions.
- The overall structure forms a **Directed Acyclic Graph (DAG)**.

### 3.4 Aggregation Logic

| Conjunction | Aggregation Rule |
|-------------|-----------------|
| **OR** | Parent risk = **maximum** (most feasible) child probability — attacker chooses path of least resistance. |
| **AND** | Parent risk = **product** of all child probabilities — all steps must succeed. |

### 3.5 Database Schema (Core Tables)

| Table | Key Columns |
|-------|-------------|
| `projects` | id, name, description, device_metadata, created_at, updated_at |
| `attacker_profiles` | id, project_id, name, skill_level (1–5), access_level (1–5), description |
| `goals` | id, project_id, name, description, impact_category, catalog_source_id (nullable) |
| `categories` | id, parent_id (goal or category), name, description |
| `steps` | id, parent_id (goal, category, or step), parent_type, conjunction (AND/OR), name, description, access_level (1–5), skill_level (1–5), catalog_source_id (nullable) |
| `substeps` | id, parent_step_id, conjunction (AND/OR), name, description, access_level (1–5), skill_level (1–5) |
| `countermeasures` | id, parent_id, parent_type (step/substep), name, description, effectiveness, implementation_cost |
| `weaknesses` | id, parent_id, parent_type (step/substep), name, description, severity, cve_id (nullable) |
| `assessments` | id, entity_id, entity_type (step/substep), is_reference (bool), time_effort (1–5), prior_knowledge (1–5), exploitability (1–5), window_of_opportunity (1–5), detection_probability (1–5), preparation_effort (1–5), abort_risk (1–5), rationale_comment (text), override_rationale (text, nullable) |
| `attack_technique_mappings` | id, entity_id, entity_type, framework (e.g. "ATT&CK ICS", "EMB3D"), technique_id (e.g. "T0831"), technique_name |
| `tags` | id, entity_id, entity_type, key (e.g. "interface"), value (e.g. "JTAG", "Ethernet") |
| `catalog_entries` | id, type, name, description, tree_data (JSON), source_framework, version |
| `change_log` | id, project_id, entity_id, entity_type, change_type (add/modify/remove/override), old_value (JSON), new_value (JSON), author, timestamp, rationale |

All entities carry a **stable UUID** that persists across versions.

---

## 4. Assessment Methodology

### 4.1 Path-Global: Access Level

Each step declares a required access level. The path-global access level is the **maximum** across all steps:

$$\text{access}_P = \max_{s \in P} \text{access}(s)$$

| Value | Level | Description |
|-------|-------|-------------|
| 1 | Remote (unauthenticated) | Network access without preconditions |
| 2 | Remote (authenticated) | Authenticated access (VPN, certificate) |
| 3 | Adjacent | Maintenance network / fieldbus |
| 4 | Local | On-site, device enclosure closed |
| 5 | Physical | Enclosure open, debug/hardware access |

### 4.2 Path-Global: Attacker Skill

Each step declares a required skill. The path-global skill is the **maximum** across all steps:

$$\text{skill}_P = \max_{s \in P} \text{skill}(s)$$

| Value | Level | Typical Actor |
|-------|-------|---------------|
| 1 | Script Kiddie | Use of readily available exploits |
| 2 | Experienced Hacker | Custom exploit development |
| 3 | Security Engineer | Reverse engineering capabilities |
| 4 | Expert Team | Hardware/firmware co-design |
| 5 | Nation-State Actor | Laboratories, insider access, supply chain |

### 4.3 Path Validity Filter

$$E_P = \begin{cases} 1 & \text{if } \text{skill}_P \leq \text{skill}_\text{attacker} \\ 0 & \text{otherwise} \end{cases}$$

Paths where $E_P = 0$ are classified as **not realistic** under the given attacker model and excluded from risk calculation.

### 4.4 Access Probability (evaluated once per path)

| Access Level | $P_\text{access}$ (default, configurable per project) |
|-------------|------|
| 1 — Remote (unauth.) | 0.9 |
| 2 — Remote (auth.) | 0.7 |
| 3 — Adjacent | 0.5 |
| 4 — Local | 0.3 |
| 5 — Physical | 0.1 |

### 4.5 Cost Factors (evaluated per step)

Each step is rated on **seven** cost dimensions (1–5 ordinal scale; higher = higher cost for attacker = lower feasibility):

| # | Factor | Weight | Description |
|---|--------|--------|-------------|
| 1 | Time effort | 0.25 | Minutes → Months+ |
| 2 | Exploitability | 0.20 | Trivial → Very difficult |
| 3 | Window of opportunity | 0.15 | Permanently open → One-time |
| 4 | Detection probability | 0.15 | None → Very high (immediate alerting) |
| 5 | Prior knowledge | 0.10 | Publicly known → Zero-day |
| 6 | Preparation effort | 0.10 | None → Specialized lab infrastructure |
| 7 | Abort risk | 0.05 | Robust (no failure risk) → Very likely (bricking) |

**Weights sum to 1.0.** Weights are configurable but defaults are justified for the ICS/embedded domain.

### 4.6 Weighted Cost Score

$$C(s_i) = \sum_{k=1}^{7} w_k \cdot f_k(s_i) \quad \in [1, 5]$$

### 4.7 Cost Probability per Step

$$P_\text{cost}(s_i) = \frac{6 - C(s_i)}{5} \quad \in [0.2, 1.0]$$

### 4.8 Path Cost Probability

$$P_\text{cost}(P) = \prod_{i=1}^{n} P_\text{cost}(s_i)$$

### 4.9 Overall Path Probability

$$P(P | A) = E_P \cdot P_\text{access}(\text{access}_P) \cdot P_\text{cost}(P)$$

### 4.10 Computation Requirements

| ID | Requirement |
|----|-------------|
| CALC-1 | The tool **must** compute $C(s_i)$, $P_\text{cost}(s_i)$, $P_\text{cost}(P)$, and $P(P\|A)$ in real time whenever any input value changes. |
| CALC-2 | The tool **must** correctly apply AND/OR aggregation: OR = max child probability, AND = product of child probabilities. |
| CALC-3 | The tool **must** filter out paths where $E_P = 0$ and visually indicate them as "not realistic." |
| CALC-4 | All intermediate values (weighted score, per-step probability, per-path probability) **must** be visible and decomposable for audit. |
| CALC-5 | Changing a countermeasure or weakness **must** immediately update the affected step's cost factors and recompute all dependent path probabilities. |

---

## 5. Must-Have Requirements (MVP)

### 5.1 Project & System Definition

| ID | Requirement | Testable Criterion |
|----|-------------|--------------------|
| SYS-1 | Create a new threat model project with name, description, and device metadata (device type, architecture, communication interfaces, deployment context). | A project can be created, saved, reopened, and all metadata is persisted. |
| SYS-2 | Define the device's assets (firmware, configuration data, credentials, control logic, communication channels). | Assets are stored and displayed in project context. |
| SYS-3 | Define the device's interfaces with type classification (e.g., Ethernet/PROFINET, serial/RS-485, USB, JTAG/SWD, wireless, web UI). | Interfaces are listed and can be tagged on attack steps. |
| SYS-4 | Define deployment context: physical location, network connectivity, operational modes (normal, maintenance, firmware update), safety function participation. | Context fields are persisted and shown in project summary. |

### 5.2 Attacker Model

| ID | Requirement | Testable Criterion |
|----|-------------|--------------------|
| ATK-1 | Create one or more attacker profiles per project, each with a name, skill level (1–5), access level (1–5), and textual description. | Profiles are persisted and selectable for path filtering. |
| ATK-2 | When an attacker profile is selected, all attack paths requiring a higher skill level are automatically marked as "not realistic" ($E_P = 0$). | Selecting a "Script Kiddie" profile (skill=1) filters out all paths requiring skill ≥ 2. |
| ATK-3 | Multiple attacker profiles can be compared side-by-side to see which paths become realistic under different assumptions. | Switching profiles updates the path validity filter and recalculates all path probabilities. |

### 5.3 Attack Tree Construction

| ID | Requirement | Testable Criterion |
|----|-------------|--------------------|
| TREE-1 | Create attack trees by adding a **Goal** as root node with name and description. | A Goal node appears as the tree root. |
| TREE-2 | Add **Steps** as children of a Goal or Category. Each Step has: name, description, required access level (1–5), required skill level (1–5). | Steps are created, displayed in tree, and persisted. |
| TREE-3 | Add **Sub-steps** as children of a Step, inheriting the same attribute structure. | Sub-steps appear nested under their parent Step. |
| TREE-4 | Add **Categories/Labels** as non-assessed grouping nodes under a Goal or another Category. | Categories visually group Steps but have no assessment values and are excluded from calculations. |
| TREE-5 | Set the conjunction type (**AND** or **OR**) for sibling nodes under any parent. | Conjunction is persisted, displayed (gate symbol), and used in aggregation. |
| TREE-6 | Add **Countermeasures** linked to a specific Step or Sub-step, with name, description, and effectiveness rating. | Countermeasures appear attached to their parent Step and influence its cost factors. |
| TREE-7 | Add **Weaknesses** linked to a specific Step or Sub-step, with name, description, severity, and optional CVE identifier. | Weaknesses appear attached to their parent Step and influence its cost factors. |
| TREE-8 | Delete, rename, and rearrange nodes (move within tree). Destructive actions require confirmation. | Nodes can be moved; deletion shows confirmation dialog; tree updates correctly. |
| TREE-9 | The tree structure forms a valid DAG — circular references are prevented by the tool. | Attempting to create a cycle produces an error message. |

### 5.4 Assessment

| ID | Requirement | Testable Criterion |
|----|-------------|--------------------|
| ASSESS-1 | For each Step/Sub-step, enter values (1–5) for all seven cost factors: time effort, prior knowledge, exploitability, window of opportunity, detection probability, preparation effort, abort risk. | All seven fields are present, accept only 1–5, and are persisted. |
| ASSESS-2 | Each cost factor assessment **must** support a free-text rationale comment explaining the rating. | Comment field is available per factor, persisted, and displayed. |
| ASSESS-3 | The weighted cost score $C(s_i)$ is computed and displayed in real time. | Changing any factor value immediately updates the displayed score. |
| ASSESS-4 | The cost probability $P_\text{cost}(s_i)$ is computed and displayed per step. | Value updates in real time. |
| ASSESS-5 | Overall path probabilities $P(P\|A)$ are computed and displayed for all extractable attack paths. | A list/table of all paths with their probabilities is shown and kept current. |
| ASSESS-6 | Path probability decomposition: clicking on a path shows the contribution of access probability, each step's cost probability, and the validity filter. | Drill-down view shows all intermediate values. |
| ASSESS-7 | Factor weights are configurable per project (defaults provided per §4.5). | Weights can be edited; recalculation reflects new weights. |
| ASSESS-8 | Access probability values ($P_\text{access}$) are configurable per project (defaults per §4.4). | Values can be edited per access level; recalculation reflects changes. |

### 5.5 Catalog & Knowledge Base

| ID | Requirement | Testable Criterion |
|----|-------------|--------------------|
| CAT-1 | The tool ships with a catalog of predefined attack trees for common field device threat categories (firmware compromise, process manipulation, persistent access, information leakage). | Catalog contains at least starter entries for the main threat categories. |
| CAT-2 | Each catalog entry includes: goal, hierarchical step decomposition, AND/OR logic, reference assessments (all 7 cost factors per step), suggested countermeasures, MITRE ATT&CK for ICS technique mappings. | All listed fields are present in catalog entries. |
| CAT-3 | **Catalog browser:** hierarchical navigation of catalog trees, organized by device type and threat category. | User can expand/collapse and browse the catalog tree. |
| CAT-4 | **Catalog search:** full-text search and ATT&CK technique ID search across catalog entries. | Searching "T0831" returns entries mapped to Manipulation of Control. |
| CAT-5 | **Catalog import:** one-click import of a catalog tree (or subtree) into the current project, creating a project-specific copy linked to the catalog source. | Imported tree appears in project; `catalog_source_id` is set. |
| CAT-6 | **Reference vs. override:** catalog reference assessments are preserved read-only. Project-specific overrides are stored separately and require a mandatory rationale. | Overriding a reference value prompts for rationale; both reference and override are visible side-by-side. |
| CAT-7 | Users can create new catalog entries from project data (extract a subtree back into the catalog for reuse). | A subtree can be promoted to a catalog entry. |
| CAT-8 | Catalog entries can be tagged with metadata (e.g., affected interface: JTAG, Ethernet, USB) to enable filtering. | Filtering by tag "JTAG" returns only entries relevant to JTAG interfaces. |

### 5.6 Data Persistence & Integrity

| ID | Requirement | Testable Criterion |
|----|-------------|--------------------|
| DATA-1 | All data is stored in a local SQLite database file. | Database file exists on disk; data survives application restart. |
| DATA-2 | Referential integrity is enforced: no orphaned steps, no dangling foreign keys. | Deleting a parent cascades or blocks (with warning) to children. |
| DATA-3 | Every entity has a stable UUID that persists across exports and reimports. | Exporting and reimporting a model preserves all UUIDs. |

### 5.7 Export & Import

| ID | Requirement | Testable Criterion |
|----|-------------|--------------------|
| IO-1 | Export the complete threat model to a single JSON file (all entities, assessments, context, metadata). | Exported file can be parsed as valid JSON containing all project data. |
| IO-2 | Export the threat model to a YAML file (same content as JSON). | Exported file is valid YAML. |
| IO-3 | Export to a **file-per-entity directory structure** for Git-compatible workflows (see §3.5 directory layout). | Directory structure matches specification; each entity is a separate file. |
| IO-4 | Reimport a previously exported JSON/YAML model with structural integrity validation and identifier conflict detection. | Round-trip: export → reimport produces identical data. |
| IO-5 | Partial import: import a specific subtree from another project or export file. | A selected subtree imports correctly into the current project. |

### 5.8 Versioning & Change Tracking

| ID | Requirement | Testable Criterion |
|----|-------------|--------------------|
| VER-1 | Save named threat model snapshots (versions) with timestamp, author, and description. | Snapshots are listed; a previous snapshot can be loaded. |
| VER-2 | **Semantic diff:** compare two versions and display classified changes (addition, modification, removal, override) per entity. | Diff view correctly highlights what changed between version A and version B. |
| VER-3 | Each change record stores: entity ID, change type, old value, new value, timestamp, author, optional rationale. | Change log entries contain all listed fields. |
| VER-4 | The text-based export (JSON/YAML) is designed for Git diffing: stable key ordering, consistent formatting, one entity per file option. | `git diff` between two exports shows meaningful, entity-level changes. |

---

## 6. Nice-to-Have Requirements (Post-MVP)

### 6.1 User Interface & Visualization

| ID | Requirement | Priority |
|----|-------------|----------|
| UI-1 | **Attack tree visualization** as an interactive graphical diagram: nodes distinguished by shape/color (Goal, Category, Step, Sub-step, Countermeasure, Weakness), AND/OR gate symbols, color-coded risk indicators. | High |
| UI-2 | **Navigation layout:** left sidebar (toolbox: node types, catalog, templates), main area (tree canvas), right sidebar (properties/details of selected element). | High |
| UI-3 | **Path highlighting:** click an attack path to highlight it through the tree. | Medium |
| UI-4 | **Critical path indicator:** automatically highlight the highest-probability path with a distinct visual marker (e.g., red border). | Medium |
| UI-5 | Expand/collapse subtrees to manage visual complexity of large trees. | High |
| UI-6 | Drag-and-drop and context menu for adding, removing, rearranging nodes. | Medium |
| UI-7 | **Color scheme:** neutral background; attack steps in red, countermeasures in green, weaknesses in yellow, critical path in dark red, active buttons in accent color. | Medium |
| UI-8 | Undo/redo functionality for tree editing operations. | Medium |
| UI-9 | Confirmation dialogs for all destructive actions (delete node, delete tree, clear assessments). | High |
| UI-10 | Empty form validation — users cannot submit nodes with required fields left blank. | High |

### 6.2 Reporting

| ID | Requirement | Priority |
|----|-------------|----------|
| RPT-1 | Generate a summary report of the threat model: all goals, top-N highest-probability paths, countermeasure coverage, assessment completeness. | Medium |
| RPT-2 | Export report as PDF with attack tree diagrams, assessment tables, and path probability rankings. | Low |
| RPT-3 | Risk heat map visualization: matrix of attack goals vs. attacker profiles showing which goals are realistic under which profiles. | Low |

### 6.3 Advanced Catalog & Intelligence Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| ADV-1 | Import MITRE EMB3D threat data (STIX 2.0 JSON format) to enrich the catalog with embedded-device-specific threat entries and mitigation mappings. | Medium |
| ADV-2 | Import/sync MITRE ATT&CK for ICS technique updates to keep catalog mappings current. | Low |
| ADV-3 | Dynamic update suggestions: when new catalog entries or threat intelligence are available, suggest additions to existing project threat models. | Low |
| ADV-4 | **Hub node detection:** identify steps that appear in many attack paths (high fan-in) — these represent high-leverage defense points even if their individual probability is moderate. | Medium |

### 6.4 Collaboration & Multi-User

| ID | Requirement | Priority |
|----|-------------|----------|
| COLLAB-1 | Support for PostgreSQL backend as an alternative to SQLite for multi-user concurrent access. | Low |
| COLLAB-2 | Role-based access control: viewer, analyst (edit assessments), editor (edit structure), admin (manage catalog). | Low |

### 6.5 Developer Experience & Extensibility

| ID | Requirement | Priority |
|----|-------------|----------|
| EXT-1 | Additional cost factors can be added to the assessment schema without structural database migration (schema-flexible assessment storage). | Low |
| EXT-2 | Plugin/extension mechanism for custom export formats or integrations with external tools (e.g., PLCOpen XML import, issue tracker integration). | Low |

### 6.6 Documentation & Onboarding

| ID | Requirement | Priority |
|----|-------------|----------|
| DOC-1 | In-app documentation page accessible from a navigation bar link. Opens in a new tab/window so the user does not lose work in progress. | Medium |
| DOC-2 | Placeholder text in input fields to guide users on expected data format. | High |
| DOC-3 | Home/landing page introducing the tool, its features, and a quick-start workflow. | Medium |

---

## 7. Traceability Matrix

The following table maps requirements to the thesis research questions and regulatory drivers to ensure full coverage:

| Requirement Group | RQ Coverage | Regulatory Driver |
|-------------------|------------|-------------------|
| SYS-* (System Definition) | RQ1, RQ5 | IEC 62443-4-1, CRA |
| ATK-* (Attacker Model) | RQ1, RQ5 | IEC 62443-3-2, ISO/SAE 21434 |
| TREE-* (Tree Construction) | RQ2, RQ5 | IEC 62443-4-1 |
| ASSESS-* (Assessment) | RQ3 | ISO/SAE 21434 TARA, OWASP |
| CAT-* (Catalog) | RQ4 | MITRE ATT&CK, EMB3D |
| IO-* (Import/Export) | RQ6 | IEC 62443-4-1 (lifecycle) |
| VER-* (Versioning) | RQ2, RQ6 | IEC 62443-4-1, CRA |
| CALC-* (Computation) | RQ3 | — (methodological) |
| UI-* (Visualization) | RQ7 | — (usability) |

---

## 8. Acceptance Criteria Summary

The MVP is considered complete when:

1. A user can create a project, define device metadata and interfaces, and configure attacker profiles.
2. Attack trees can be built with Goals, Categories, Steps, Sub-steps, Countermeasures, and Weaknesses, connected by AND/OR conjunctions.
3. All seven cost factors can be entered per Step/Sub-step with rationale comments; weighted scores and probabilities compute correctly in real time.
4. Path probabilities are correctly computed using the formula $P(P|A) = E_P \cdot P_\text{access} \cdot P_\text{cost}(P)$ with proper AND/OR aggregation.
5. A catalog of starter attack trees can be browsed, searched, and imported into projects; reference assessments are preserved alongside project overrides.
6. The threat model can be exported to JSON/YAML and reimported losslessly (round-trip integrity).
7. Named versions can be saved and compared via semantic diff showing additions, modifications, and removals.
8. All data is persisted in SQLite and survives application restart.

---

## Appendix A: Cost Factor Detail Tables

### A.1 Time Effort

| Value | Duration | Description |
|-------|----------|-------------|
| 1 | Minutes | Immediately executable |
| 2 | Hours | Limited preparation effort |
| 3 | Days | Targeted preparation required |
| 4 | Weeks | Extended analysis or development |
| 5 | Months+ | Long-term operation |

### A.2 Prior Knowledge

| Value | Knowledge | Description |
|-------|-----------|-------------|
| 1 | Publicly known | Documented, known vulnerability |
| 2 | Widely known | Known in expert circles |
| 3 | Limited availability | Accessible only to few experts |
| 4 | Internal | Not publicly documented |
| 5 | Unknown | Zero-day or proprietary knowledge |

### A.3 Exploitability

| Value | Exploitability | Description |
|-------|---------------|-------------|
| 1 | Trivial | Directly reproducible |
| 2 | Easy | Minor adaptation needed |
| 3 | Moderate | Specific conditions required |
| 4 | Difficult | Complex prerequisites |
| 5 | Very difficult | High technical barriers |

### A.4 Window of Opportunity

| Value | Window | Description |
|-------|--------|-------------|
| 1 | Permanently open | Always exploitable |
| 2 | Regular | E.g., cyclic maintenance |
| 3 | Occasional | Rare operational states |
| 4 | Brief | Very limited time window |
| 5 | One-time | A singular event |

### A.5 Detection Probability

| Value | Detection | Description |
|-------|-----------|-------------|
| 1 | None | No monitoring or logging |
| 2 | Low | Irregular monitoring |
| 3 | Moderate | Standard monitoring in place |
| 4 | High | Targeted detection likely |
| 5 | Very high | Immediate alerting |

### A.6 Preparation Effort

| Value | Preparation | Description |
|-------|-------------|-------------|
| 1 | None | Immediate execution possible |
| 2 | Software setup | Setup of tools or scripts |
| 3 | Test environment | Build test environment or simulation |
| 4 | Device procurement | Procurement of hardware or specific components |
| 5 | Specialized infrastructure | Access to specialized laboratories required |

### A.7 Abort Risk

| Value | Abort Risk | Description |
|-------|------------|-------------|
| 1 | Robust | No risk of failure or bricking |
| 2 | Rare aborts | Low risk of malfunction |
| 3 | Moderate | Possible risk of malfunction |
| 4 | Frequent | Elevated risk of malfunction or bricking |
| 5 | Very likely | Significant risk of malfunction or bricking |

---

## Appendix B: File-Per-Entity Export Structure

```
threat-model/
  meta.yaml                    # Project metadata, factor weights, access probabilities
  attacker-profiles/
    profile-<uuid>.yaml
  goals/
    <goal-uuid>/
      goal.yaml                # Goal definition + impact
      categories/
        <cat-uuid>.yaml
      steps/
        <step-uuid>/
          step.yaml            # Step definition + assessment (ref + override)
          substeps/
            <substep-uuid>.yaml
          countermeasures/
            <cm-uuid>.yaml
          weaknesses/
            <weakness-uuid>.yaml
  catalog-sources.yaml         # Mapping of catalog_source_ids to catalog versions
  changelog.yaml               # Semantic change log
```

---

## Appendix C: MITRE ATT&CK for ICS Technique Categories (Reference)

The catalog should map attack steps to these tactic categories:

| Tactic | Example Techniques |
|--------|--------------------|
| Initial Access | T0819 External Remote Services, T0822 Internet Accessible Device, T0862 Supply Chain Compromise |
| Execution | T0858 Change Operating Mode, T0871 Execution through API |
| Persistence | T0891 Hardcoded Credentials, T0889 Modify Program, T0857 System Firmware |
| Evasion | T0820 Exploitation for Evasion, T0872 Indicator Removal on Host |
| Discovery | T0840 Network Connection Enumeration, T0842 Network Sniffing |
| Lateral Movement | T0886 Remote Services |
| Inhibit Response Function | T0878 Alarm Suppression, T0803 Block Command Message, T0816 Device Restart/Shutdown |
| Impair Process Control | T0806 Brute Force I/O, T0836 Modify Parameter, T0831 Manipulation of Control |
| Impact | T0826 Loss of Availability, T0827 Loss of Control, T0880 Loss of Safety, T0879 Damage to Property |
