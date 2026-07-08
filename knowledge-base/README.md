# EmbedRisk Knowledge Base

This part of the repository holds reusable security knowledge for Threat and Risk Assessments (TRAs).

The goal is to keep recurring attacker assumptions, threat patterns, and countermeasure mappings in one place so teams can reuse them instead of starting from scratch in every project.

## Why this is useful

A shared KB helps teams:

- preserve security knowledge and prior assessments across projects and product generations,
- onboard new practitioners faster with concrete, domain-relevant examples,
- reduce avoidable subjectivity and fluctuations in TRA outcomes,
- improve consistency and traceability of security decisions company-wide.

## KB parts (what each file is for)

- `ot-attackers.json`: attacker profile examples for OT/IEC 62443 contexts (for assumptions and threat plausibility).
- `ot-threats.json`: reusable OT threat examples, including STRIDE and CVSS v4.0 vectors.
- `ot-countermeasures.json`: reusable control examples linked to threat keys.

Together, these files provide a practical starting point for building your own organization-specific KB.

## Important scope note

These files are initial examples to demonstrate how KBs can look and how the data can be structured.

Treat them as a template, then evolve them into your company-internal KB with your own products, architectures, incidents, and security expectations. The strongest value comes from capturing your internal lessons learned and assessment rationale over time.

## Contributing your expertise

If you want to share improvements or domain expertise, contributions are welcome.

- refine attacker profiles,
- add realistic threats and stronger mappings,
- improve countermeasure guidance,
- submit updates via PR so others can benefit from the same knowledge.

## Recommended structure

Use one top-level `knowledge-base/` folder with multiple JSON files split by KB family or domain slice.

- Keep attackers in their own file because they are conceptually different from importable threats and countermeasures.
- Keep threats and countermeasures in separate files so they remain easy to review and extend.
- Add more domain files over time, for example `ot-wireless-threats.json` or `ot-plc-countermeasures.json`.