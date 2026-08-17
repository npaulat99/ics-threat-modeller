# Canonical Schema — Phase 3

Primary format: **JSON Lines (`.jsonl`)** — one self-contained JSON object per line, optimized for
streaming, chunked retrieval, and low token overhead. All canonical entity files share one schema.

## 1. Canonical entry (every line in `canonical/*.jsonl`)

| Field | Type | Meaning |
|-------|------|---------|
| `source` | string | `EMB3D` \| `CWE` \| `CAPEC` \| `ESTM` \| `OWASP` |
| `original_id` | string | ID in the source DB (e.g. `TID-101`, `CWE-1300`, `CAPEC-26`, `EST000004`, `A04:2025`) |
| `canonical_id` | string | Globally unique KB ID (e.g. `EMB3D-TID-101`, `CWE-1300`, `CAPEC-26`, `ESTM-EST000004`, `OWASP-A04-2025`) |
| `entity_type` | string | `threat` \| `mitigation` \| `device_property` \| `weakness` \| `weakness_category` \| `attack_pattern` \| `technique` \| `tactic` \| `risk_category` |
| `name` | string | Human-readable title |
| `description` | string | Normalized plain-text description (truncated for very long CWE/CAPEC text) |
| `applicability` | object | Source-specific structured facts (see below) |
| `industrial_relevance` | string | Traceable relevance basis label (e.g. `native-embedded`, `CWE-ICS-category`) |
| `embedded_relevance` | string | `Tier 1` \| `Tier 2` \| `Tier 3` |
| `relevance_basis` | string | Why this entry was retained/scored — traceable to source groupings/refs |
| `related_entities` | array | `{relation, target (canonical_id), source}` cross-links |
| `mitigations` | array | Mitigation canonical-ids (EMB3D) or compact mitigation phrases (CWE/CAPEC) |
| `evidence` | string | Supporting evidence / observed CVEs (may be empty) |
| `source_reference` | object | `{source_file, id, url, [stix_id/sheet]}` — full traceability to origin |

### `applicability` by entity type
- **threat (EMB3D):** `threat_category`, `maturity`, `cwe_refs[]`, `cve_refs[]`
- **mitigation (EMB3D):** `maturity`, `iec_62443_mappings`, `references`
- **device_property (EMB3D):** `category`, `is_subproperty`, `parent_property`, `subproperties[]`
- **weakness (CWE):** `abstraction`, `status`, `platforms[]`, `cwe_categories[]`
- **weakness_category (CWE):** `status`, `member_count`
- **attack_pattern (CAPEC):** `abstraction`, `status`, `likelihood`, `severity`, `prerequisites[]`, `consequences[]`
- **technique/tactic (ESTM):** `tactic`, `tactic_name`, `type` / `matrix`
- **risk_category (OWASP):** `cwe_category`, `cwes_mapped`, `cwes_mapped_in_kb`, `embedded_relevant_cwes`, `notable_cwes[]`, `total_cves`, `avg_incidence_rate`

### `related_entities` relation vocabulary
`mitigated_by`, `mitigates_threat`, `triggered_by_property`, `indicates_threat`,
`maps_to_weakness`, `exploits_weakness`, `exploited_by`, `childof`, `peerof`, `canprecede`,
`subproperty_of`, `has_subproperty`, `has_member`, `in_tactic`.

## 2. Files

```
knowledge_base/
├── canonical/
│   ├── embed_threats.jsonl          (81  threat)
│   ├── embed_mitigations.jsonl      (89  mitigation)
│   ├── embed_properties.jsonl       (59  device_property)
│   ├── cwe_weaknesses.jsonl         (922 weakness)
│   ├── cwe_categories.jsonl         (57  weakness_category)
│   ├── capec_attack_patterns.jsonl  (536 attack_pattern)
│   ├── estm_tactics.jsonl           (13  tactic)
│   ├── estm_techniques.jsonl        (218 technique)
│   └── owasp_top10.jsonl            (10  risk_category)
├── index/                           (token-efficient retrieval layer)
│   ├── threats_compact.jsonl        (81  threats + full cross-links, ~42 KB)
│   ├── mitigations_compact.jsonl    (89  mitigations + maturity + IEC 62443, ~19 KB)
│   └── cwe_to_owasp.json            (CWE -> OWASP 2025 reverse map, ~9 KB)
├── embed/                           (Phase 5 — EMBED mapping-oriented KB)
│   ├── property_threat_mitigation_map.jsonl
│   └── property_index.json
├── tombstones.jsonl                 (126 removed-entry records)
├── build_stats.json
└── validation_stats.json
```

## 3. EMBED mapping KB (`embed/`) — Phase 5

`property_threat_mitigation_map.jsonl` — one row per **(device property → threat)** pair, carrying the
full chain the agent needs:

```
project characteristic  →  property_id / property (+ category)
                        →  threat_id / threat (+ category)
                        →  weaknesses[]  (CWE ids -> canonical weakness entries)
                        →  mitigations[] {id, name, maturity, iec_62443}
```

`property_index.json` — compact lookup (`property_id`, `property`, `category`, `is_subproperty`,
`parent`, `threats[]`) for fast **project-property matching** by the future agent.

## 4. ID normalization rules
- EMB3D: `EMB3D-<TID|MID|PID>`; CWE: `CWE-<n>`; CAPEC: `CAPEC-<n>`; ESTM: `ESTM-<EST|ETAC id>`; OWASP: `OWASP-A<nn>-2025`.
- CWE ids are taken from the authoritative definition URL when the source label disagrees (typo fix).
- All cross-references use `canonical_id` targets; unresolved targets are disallowed (validated).

## 5. OWASP Top Ten 2025 (contextual enrichment lens)
`canonical/owasp_top10.jsonl` holds the 10 OWASP 2025 risk categories, each linked to its member CWEs
via the authoritative CWE mapping (`CAT-1436`–`CAT-1445`, from `cwec_v4.20.xml`). Embedded relevance is
derived from the share of mapped CWEs that are embedded Tier 1/2 (A04 Cryptographic, A07 Authentication
rank highest; A05 Injection is Tier 3). Use `index/cwe_to_owasp.json` to annotate any shortlisted CWE
with its OWASP category in one lookup — no need to load `owasp_top10.jsonl`.
