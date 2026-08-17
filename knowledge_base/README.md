# Embedded / Industrial Threat Knowledge Base

A curated, domain-specific threat knowledge base for **embedded field devices in industrial
automation (process automation, factory automation, ICS/OT, and IIoT)**. It is built from four MITRE
sources — **EMB3D, CWE, CAPEC, ESTM** — plus the **OWASP Top Ten 2025** as a contextual enrichment
lens, and optimized for a future **Threat Identification Agent** that analyzes a project repository,
detects device properties, and proposes relevant threats and mitigations for a specific embedded
component.

> Built entirely from the source databases in this repository. **No threat, mitigation, mapping, or
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
