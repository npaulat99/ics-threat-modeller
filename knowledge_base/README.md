# EmbedRisk Knowledge Base — Licensing, Attribution & Technical Reference

> **This document is the licensing clearinghouse for the `knowledge_base/` folder.**
> Every file here is derived from external databases whose copyright owners are credited below.
> **No file in this folder is licensed under GPLv3.** GPLv3 applies exclusively to EmbedRisk
> program code in `webapp/` and `vscode-extension/`. Consumers who redistribute any part of this
> knowledge base must preserve all copyright designations, permission statements, and disclaimer
> blocks reproduced in this document.

---

## Legal Compatibility Statement

The EmbedRisk program code (GPLv3) accesses this knowledge base at runtime as external data. No
knowledge-base file is statically linked into or compiled with the GPLv3 codebase. This
**runtime data coupling** means:

- MITRE-licensed datasets (EMB3D, CAPEC, CWE, ESTM) remain under their respective MITRE licenses.
- The OWASP dataset remains under Creative Commons Attribution 3.0 Unported (CC BY 3.0).
- GPLv3 copyleft does not propagate to data files accessed at runtime.
- Each dataset's attribution, disclaimer, and use-restriction terms are independently enforceable.

---

## Data Sources, Licenses & Attributions

### 1. EMB3D™ — The MITRE Corporation

**Files:** `canonical/embed_threats.jsonl`, `canonical/embed_mitigations.jsonl`,
`canonical/embed_properties.jsonl`, `embed/property_index.json`,
`embed/property_threat_mitigation_map.jsonl`, and derived entries in `index/threats_compact.jsonl`
and `index/mitigations_compact.jsonl`.

**Required copyright notice (verbatim):**

> ©2026 The MITRE Corporation. This work is reproduced and distributed with the permission of
> The MITRE Corporation.

**LICENSE** 
The MITRE Corporation grants a non-exclusive, royalty-free license to use,
copy, and create derivative works of EMB3D™ for internal business purposes or commercial use. Any
copy must reproduce MITRE's copyright designation and this license. MITRE must be notified of use at
[EMB3D@mitre.org](mailto:EMB3D@mitre.org). For all other uses of EMB3D™, contact MITRE at
[techtransfer@mitre.org](mailto:techtransfer@mitre.org). All rights not expressly granted are hereby
reserved. You shall not include a charge for EMB3D™ in any sales or license of derivative products
or services to the U.S. Government.

**DISCLAIMERS**

MITRE DOES NOT CLAIM EMB3D™ ENUMERATES ALL POSSIBILITIES FOR THE TYPES OF ACTIONS AND BEHAVIORS
DOCUMENTED AS PART OF EMB3D™'S ADVERSARY MODEL AND FRAMEWORK OF TECHNIQUES. USING THE INFORMATION
CONTAINED WITHIN EMB3D™ TO ADDRESS OR COVER FULL CATEGORIES OF TECHNIQUES WILL NOT GUARANTEE FULL
DEFENSIVE COVERAGE AS THERE MAY BE UNDISCLOSED TECHNIQUES OR VARIATIONS ON EXISTING TECHNIQUES NOT
DOCUMENTED BY EMB3D™.

EMB3D™ AND ALL DOCUMENTS AND THE INFORMATION CONTAINED THEREIN ARE PROVIDED ON AN "AS IS" BASIS AND
THE CONTRIBUTOR, THE ORGANIZATION HE/SHE REPRESENTS OR IS SPONSORED BY (IF ANY), THE MITRE
CORPORATION, ITS BOARD OF TRUSTEES, OFFICERS, AGENTS, AND EMPLOYEES, DISCLAIM ALL WARRANTIES,
EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, ANY WARRANTY THAT THE USE OF THE INFORMATION
THEREIN WILL NOT INFRINGE ANY RIGHTS OR ANY IMPLIED WARRANTIES OF ACCURACY, NONINFRINGEMENT,
MERCHANTABILITY, OR FITNESS FOR A PARTICULAR PURPOSE.

---

### 2. CAPEC™ — Common Attack Pattern Enumeration and Classification

**Files:** `canonical/capec_attack_patterns.jsonl` and derived cross-links in
`index/threats_compact.jsonl`.

**Copyright:** © The MITRE Corporation. CAPEC™ is a trademark of The MITRE Corporation.

**LICENSE**
The MITRE Corporation grants a non-exclusive, royalty-free license to use
CAPEC™ for research, development, and commercial purposes. Any copy must reproduce MITRE's copyright
designation and this license.

**DISCLAIMERS**

ALL DOCUMENTS AND THE INFORMATION CONTAINED THEREIN ARE PROVIDED ON AN "AS IS" BASIS AND THE
CONTRIBUTOR, THE ORGANIZATION HE/SHE REPRESENTS OR IS SPONSORED BY (IF ANY), THE MITRE CORPORATION,
ITS BOARD OF TRUSTEES, OFFICERS, AGENTS, AND EMPLOYEES, DISCLAIM ALL WARRANTIES, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTY THAT THE USE OF THE INFORMATION THEREIN WILL NOT
INFRINGE ANY RIGHTS OR ANY IMPLIED WARRANTIES OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.

---

### 3. CWE™ — Common Weakness Enumeration

**Files:** `canonical/cwe_weaknesses.jsonl`, `canonical/cwe_categories.jsonl`, and derived entries
in `index/cwe_to_owasp.json` and `index/threats_compact.jsonl`.

**Copyright:** © The MITRE Corporation. CWE™ is a trademark of The MITRE Corporation.
Contact [cwe@mitre.org](mailto:cwe@mitre.org) for clarification.

**LICENSE**
CWE™ is free to use by any organization or individual for any research,
development, and/or commercial purposes. MITRE grants a non-exclusive, royalty-free license. Any
copy must reproduce MITRE's copyright designation and this license.

**DISCLAIMER**

BY ACCESSING INFORMATION THROUGH THIS SITE YOU (AS "THE USER") HEREBY AGREES THE SITE AND THE
INFORMATION IS PROVIDED ON AN "AS IS" BASIS ONLY WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, AVAILABILITY, ACCURACY,
NONINFRINGEMENT, OR FITNESS FOR A PARTICULAR PURPOSE. USE OF THIS SITE AND THE INFORMATION IS AT
THE USER'S OWN RISK. THE USER SHALL COMPLY WITH ALL APPLICABLE LAWS, RULES, AND REGULATIONS, AND
THE DATA SOURCE'S RESTRICTIONS, WHEN USING THE SITE.

BY CONTRIBUTING INFORMATION TO THIS SITE YOU (AS "THE CONTRIBUTOR") HEREBY REPRESENTS AND WARRANTS
THE CONTRIBUTOR HAS OBTAINED ALL NECESSARY PERMISSIONS FROM COPYRIGHT HOLDERS AND OTHER THIRD
PARTIES TO ALLOW THE CONTRIBUTOR TO CONTRIBUTE, AND THIS SITE TO HOST AND DISPLAY, THE INFORMATION
AND ANY SUCH CONTRIBUTION, HOSTING, AND DISPLAYING WILL NOT VIOLATE ANY LAW, RULE, OR REGULATION.
ADDITIONALLY, THE CONTRIBUTOR HEREBY GRANTS ALL USERS OF SUCH INFORMATION A PERPETUAL, WORLDWIDE,
NON-EXCLUSIVE, NO-CHARGE, ROYALTY-FREE, IRREVOCABLE LICENSE TO REPRODUCE, PREPARE DERIVATIVE WORKS
OF, PUBLICLY DISPLAY, PUBLICLY PERFORM, SUBLICENSE, AND DISTRIBUTE SUCH INFORMATION AND ALL
DERIVATIVE WORKS.

THE MITRE CORPORATION EXPRESSLY DISCLAIMS ANY LIABILITY FOR ANY DAMAGES ARISING FROM THE
CONTRIBUTOR'S CONTRIBUTION OF SUCH INFORMATION, THE USER'S USE OF THE SITE OR SUCH INFORMATION,
AND THE MITRE CORPORATION'S HOSTING THE TOOL AND DISPLAYING THE INFORMATION. THE FOREGOING
DISCLAIMER SPECIFICALLY INCLUDES BUT IS NOT LIMITED TO GENERAL, CONSEQUENTIAL, INDIRECT,
INCIDENTAL, EXEMPLARY, OR SPECIAL OR PUNITIVE DAMAGES (INCLUDING BUT NOT LIMITED TO LOSS OF INCOME,
PROGRAM INTERRUPTION, LOSS OF INFORMATION, OR OTHER PECUNIARY LOSS) ARISING OUT OF USE OF THIS
INFORMATION, NO MATTER THE CAUSE OF ACTION, EVEN IF THE MITRE CORPORATION HAS BEEN ADVISED OF THE
POSSIBILITY OF SUCH DAMAGES.

---

### 4. ESTM — Embedded Systems Techniques Matrix (MITRE)

**Files:** `canonical/estm_tactics.jsonl`, `canonical/estm_techniques.jsonl`.

**Copyright:** ©2025 The MITRE Corporation. All rights reserved.

**Sponsorship and distribution notice**

> Sponsor: Cyber Resiliency Office for Weapon Systems (CROWS). Dept. No.: N157.
> Contract No.: FA8702-24-C-0001. Project No.: 101716.25.306.4PA0.
>
> The views, opinions and/or findings contained in this report are those of The MITRE Corporation
> and should not be construed as an official government position, policy, or decision, unless
> designated by other documentation.
>
> DISTRIBUTION STATEMENT A — Approved for public release: distribution is unlimited.
> Case 25-2080.

ESTM was produced under U.S. Government contract. The U.S. Government retains certain rights. Use
must comply with all applicable laws, regulations, and Executive Orders.

---

### 5. OWASP Top Ten 2025

**Files:** `canonical/owasp_top10.jsonl`, `index/cwe_to_owasp.json`.

**Copyright:** © Copyright 2021–2025 OWASP Top 10 Team.

**License:** [Creative Commons Attribution 3.0 Unported (CC BY 3.0)](http://creativecommons.org/licenses/by/3.0/deed.en_US).

**Attribution:** This work includes material derived from the OWASP Top Ten 2025, produced by the
OWASP Top 10 Team and the OWASP Foundation. The OWASP Top Ten is a registered trademark of the
OWASP Foundation. Under CC BY 3.0, you are free to share and adapt this material provided you give
appropriate credit to the OWASP Top 10 Team, provide a link to the license, and indicate if changes
were made.

---

## Redistribution Obligations

When redistributing this knowledge base, or any derivative thereof, you must:

1. Preserve this README in full, including all verbatim disclaimer blocks.
2. Reproduce the EMB3D copyright notice `©2026 The MITRE Corporation. This work is reproduced and
   distributed with the permission of The MITRE Corporation.` on all copies of EMB3D-derived files.
3. Reproduce MITRE copyright notices on all copies of CAPEC™- and CWE™-derived files.
4. Credit the OWASP Top 10 Team and link to CC BY 3.0 on all copies of OWASP-derived files.
5. Notify MITRE of EMB3D use at [EMB3D@mitre.org](mailto:EMB3D@mitre.org).
6. Not include a charge for EMB3D™ in any sales or license of derivative products or services to
   the U.S. Government.
7. Comply with all applicable laws, regulations, and Executive Orders.

---

## Technical Reference

A curated, domain-specific threat knowledge base for **embedded field devices in industrial
automation (process automation, factory automation, ICS/OT, and IIoT)**. It is built from four MITRE
sources — **EMB3D, CWE, CAPEC, ESTM** — plus the **OWASP Top Ten 2025** as a contextual enrichment
lens, and optimized for a **Threat Identification Agent** that analyzes a project repository,
detects device properties, and proposes relevant threats and mitigations for a specific embedded
component.

> Built entirely from the source databases listed above. **No threat, mitigation, mapping, or
> relevance was invented.** Every entry is traceable via `source_reference`, and every removal has a
> tombstone.

## Contents

| Path | What |
|------|------|
| `canonical/*.jsonl` | 1,975 canonical entries (schema: `SCHEMA.md`) |
| `index/threats_compact.jsonl` | **Token-efficient** threat matrix: every EMB3D threat with its properties, mitigations, CWEs, CAPECs + short description (42 KB) |
| `index/mitigations_compact.jsonl` | Mitigations with maturity + ISA/IEC 62443 mapping + threats (19 KB) |
| `index/cwe_to_owasp.json` | Reverse map: CWE → OWASP Top Ten 2025 category (9 KB) |
| `canonical/owasp_top10.jsonl` | OWASP Top Ten 2025 risk categories, cross-linked to CWE |
| `embed/property_threat_mitigation_map.jsonl` | EMB3D project→property→threat→mitigation chains |
| `embed/property_index.json` | Compact property lookup for project-property matching (16 KB) |
| `threat-identification.prompt.md` | Ready-to-run per-project agent prompt (VS Code `/` prompt) |
| `tombstones.jsonl` | 126 removed entries (id, source, reason, referenced-by) |
| `build_stats.json` / `validation_stats.json` | Build & validation metrics |
| `SCHEMA.md` | Canonical schema (Phase 3) |

Governance / rationale docs live one level up: `DATA_SOURCE_ANALYSIS.md` (Phase 1),
`DOMAIN_RELEVANCE_ANALYSIS.md` (Phase 2), `PRUNING_REPORT.md` (Phase 4),
`VALIDATION_REPORT.md` (Phase 7). Build/validate scripts are in `../scripts/`.

## Entry counts

| Source | Entity | Count |
|--------|--------|------:|
| EMB3D | threats / mitigations / properties | 81 / 89 / 59 |
| CWE | weaknesses / categories | 922 / 57 |
| CAPEC | attack patterns | 536 |
| ESTM | techniques / tactics | 218 / 13 |
| OWASP | Top Ten 2025 risk categories | 10 |
| **Total** | | **1,985** |

Relevance tiers: **Tier 1 = 665**, **Tier 2 = 777**, **Tier 3 = 533** (see `SCHEMA.md` /
`DOMAIN_RELEVANCE_ANALYSIS.md`).

## How the future agent uses it

1. **Detect device properties** from the project repo (OS/RTOS, MCU architecture, fieldbus/industrial
   Ethernet, wireless, boot/update mechanism, auth/crypto, debug interfaces, safety functions, network
   exposure, firmware characteristics).
2. **Match** detected characteristics to EMB3D **properties** via `embed/property_index.json`.
3. **Expand** each matched property to its **threats → mitigations** via
   `embed/property_threat_mitigation_map.jsonl` (mitigations carry maturity + ISA/IEC 62443 mappings).
4. **Enrich / brainstorm** with cross-linked **CWE weaknesses**, **CAPEC attack patterns**, and
   **ESTM techniques/tactics**, prioritizing Tier 1/2 and using Tier 3 for attack-chain reasoning.
5. **Frame** each shortlisted CWE against its **OWASP Top Ten 2025** category via
   `index/cwe_to_owasp.json` (a familiar risk-category label + prevention guidance).
6. **Cite** everything via `source_reference` and each entry's `canonical_id`.

## Per-project usage (token-efficient)

Copy this `knowledge_base/` folder into a project repo and run `threat-identification.prompt.md`
against it. The prompt enforces a staged retrieval protocol so token cost scales with the **shortlist**,
not the KB size:

- **Load once (~77 KB total):** `index/threats_compact.jsonl`, `index/mitigations_compact.jsonl`,
  `embed/property_index.json`. This alone covers property matching, threat shortlisting, and mitigation
  selection (the whole property→threat→mitigation→CWE→CAPEC chain is precomputed in the compact files).
- **Never load** the large `canonical/cwe_weaknesses.jsonl` (1.6 MB) or `canonical/capec_attack_patterns.jsonl`
  (0.97 MB) in full.
- **Fetch detail on demand by exact id**, batched with ripgrep alternation, e.g.:
  ```
  rg -N '"canonical_id": "(CWE-787|CWE-306)"' canonical/cwe_weaknesses.jsonl
  rg -N '"canonical_id": "(CAPEC-123|CAPEC-26)"' canonical/capec_attack_patterns.jsonl
  ```
  Each JSONL line is a self-contained entry, so a keyed grep returns exactly the entities you need.

## Cross-source graph

```
EMB3D property (PID) → EMB3D threat (TID) → EMB3D mitigation (MID)  [+ IEC 62443]
                              │
                              ├─ maps_to_weakness → CWE weakness → CWE ancestors / categories
                              │                          ▲
                              │                          └─ exploited_by ── CAPEC attack pattern
                              └─ (conceptual) ── ESTM technique → ESTM tactic
```

## Reproduce

```powershell
python ../scripts/build_kb.py       # regenerate canonical KB from untouched sources
python ../scripts/build_index.py    # regenerate the token-efficient index/ files
python ../scripts/validate_kb.py    # referential integrity + mapping consistency checks
```
