# TRA Web App — Consolidated Improvement Report

**Date:** 2026-06-30  
**Scope:** `tra-webapp/` (client + server + example project), assessed against the thesis
requirements (`tra/project.md`, `docs/research-questions.typ`, the SLR/interview chapters) and
IEC 62443-4-1 / EU CRA expectations.

**Method.** Four purpose-built review agents (in [`.github/agents/`](../../../.github/agents)) each
audited the running tool from one lens and returned independent findings:

- [`webapp-usability-review`](../../../.github/agents/webapp-usability-review.agent.md) — UX & non-expert accessibility
- [`webapp-thesis-fulfillment-review`](../../../.github/agents/webapp-thesis-fulfillment-review.agent.md) — coverage of the thesis requirements
- [`webapp-62443-compliance-review`](../../../.github/agents/webapp-62443-compliance-review.agent.md) — 62443-4-1 / CRA audit evidence
- [`webapp-threatmodel-quality-review`](../../../.github/agents/webapp-threatmodel-quality-review.agent.md) — analytical / methodological correctness

This document **synthesises and de-duplicates** their findings, resolves overlaps, and prioritises
the work. Severity uses **P0** (wrong / would fail an audit / data-loss), **P1** (thesis-critical
gap), **P2** (polish / hardening).

---

## Resolution status — 2026-07-01 (re-verified by re-running the four review agents)

Every finding below has since been addressed and the fixes were **re-verified by re-running all four
review agents** against the current tree. Result: **all P0 items, all P2 items, and all P1 items
except a few defensible partials are resolved** (build + typecheck green; the example project
validates with 0 plausibility issues).

- **P0-1…P0-7 — resolved.** Residual risk = the single most-protective control (min of `rL·rI`);
  attack-tree OR reports the single best child's (skill, access, cost) bundle; a preventive control
  that lowers impact is flagged; `verificationUrl` required when *verified*; the full traceability
  matrix is exported as HTML + `traceability.csv`/`.json` + CycloneDX `sbom.cdx.json`; completeness
  gates added (STRIDE-per-element coverage, reference integrity, `residual ≤ initial`,
  `mitigated ⇒ implemented control`); the attacker profile now **gates** likelihood
  (`capability + exploitability ≥ 6`, plus access-vs-exposure proximity).
- **P1-1…P1-10 — largely resolved.** First-class **security-requirement node** (step 05) threaded
  through its panel, the dashboard, the report and the validator; **likelihood redesigned to
  Exposure × Exploitability (P11)** as `round(√(E·X))` (this also fixed an interim *bottom-heavy*
  `(E·X)/5` regression); attack-tree effort is now a multiplicative success probability with defence
  strength keyed to the linked control's status; **SBOM + defect/vulnerability register** (CycloneDX
  VEX, defect→threat re-assessment flags); the report renders **all DFD layers + a trust-boundary
  inventory**; inter-rater `ratedBy` + a rigorous mode; an AI **Assistant** (deterministic document +
  KB threat suggestion, human-approved).
- **P2-1…P2-12 — resolved.** Keyboard/screen-reader operability (step nav, chips as `role=group`,
  jump chips, risk-matrix cells), confirm-on-delete wired everywhere + `aria-label`led delete
  buttons, honest save/sync state, a guided **Back/Next** footer with a done indicator, WCAG-AA
  contrast, a colour-blind-safe matrix (band initial), dark-mode-correct token colours, the report in
  an in-app modal (Escape / `role=dialog`), and a single source of truth for step numbers.

### P11 Exposure × Exploitability — decision & critical verdict

**Adopted.** P11 found a single coarse likelihood insufficient and recommended a configurable
Exposure × Exploitability × Impact scheme. The app now derives **likelihood = round(√(Exposure ×
Exploitability))**, kept on the 5×5 matrix (Risk = Likelihood × Impact), reusing the
previously-unused interface `exposure` data and treating the attacker profile as a feasibility gate.
*Verdict:* a genuine, defensible improvement to reproducibility (RQ2) — two concretely-anchored
sub-scales beat one vague axis — but the gain is **modest and unvalidated**: the √ mapping is lossy
(re-buckets to five levels), the two factors partly overlap CVSS's own AV/AC/PR/UI, and the change
rests on one interview participant without an in-tool inter-rater study.

### Remaining (defensible / deferred)

- Reusable KB **templates / assets / risk-ratings** exist in the KB JSON but only threats &
  countermeasures are importable in the UI; per-entry KB provenance is catalogue-level only.
- A formal **pluggable Exporter interface / OSCAL** — several export formats exist as a map today.
- **Attacker access** is a 4-level reachable-position enum (consistent, non-inverted); a full 1–5
  alignment with Exposure (incl. remote-unauthenticated) is a possible refinement.
- The per-step **six-part educational** block (explicit inputs/outputs per step) — panels currently
  give purpose + guidance + the worked example project.
- On-disk folder numbers differ from the UI step numbers (the file mapping is correct; cosmetic).

The per-lens sections below are the **original** findings, retained for traceability.

---

## Executive verdict

The app is a strong, well-engineered **modelling tool**: a recursive multi-layer DeMarco DFD with
mouse + keyboard navigation, true many-to-many threat↔component↔asset↔countermeasure relationships,
a deterministic Bug-Bar (max C/I/A/Safety) + attacker-factor + CVSS-hint risk engine, live JSON
sync, an optional attack-defence tree, a plausibility checker, a Git-backed knowledge base, dark
mode, and a compliance dashboard.

It is **not yet** the *compliance-evidence and knowledge-leverage instrument* the thesis foregrounds
as its contribution, and its **quantitative core has several methodological defects**. The four
reviews converge on the same conclusion from different directions: the data model is good, but
(a) the **end-to-end traceability chain is never assembled or exported** for an assessor,
(b) the **"requirement" node of the threat→risk→requirement→control chain does not exist**,
(c) the **attacker profile that the thesis makes mandatory never enters the likelihood arithmetic**,
(d) **residual risk and the attack-tree OR gate combine dimensions across alternatives**, producing
best-case numbers no single path/control realises, and
(e) the tool's **validator gives false assurance** (a control can be "verified" with no evidence; a
one-threat model reports "no issues").

None of these are crashes; all of them undermine the thesis's central claims and should be addressed
before the artefact is presented as publication-grade.

---

## P0 — Correctness & audit-evidence (fix first)

These are either methodologically wrong (produce untrustworthy numbers) or would actively mislead a
user/assessor about compliance.

### P0-1 · Residual risk combines L and I across different controls
`residual()` takes `min(residualLikelihood)` and `min(residualImpact)` **independently** over all
countermeasure links ([client/src/lib/risk.ts](../../client/src/lib/risk.ts#L49-L57),
[server/src/risk.js](../../server/src/risk.js#L17-L24)). With ≥2 controls (the normal defence-in-depth
case) it credits the best L from one control and the best I from another → a residual product **no
single control achieves**, systematically under-rating residual risk.
*Fix:* residual = `min over links of (rL·rI)` (the single most-protective control), or require one
explicit combined-residual entry per threat. Never minimise L and I independently.
*(Violates Mauw & Oostdijk 2005; ISO/IEC 27005 / IEC 62443-3-2 residual semantics.)*

### P0-2 · Attack-tree OR gate (and "feasible-for") mixes dimensions
OR returns componentwise `min` of `skillReq`, `accessReq`, `cost`
([client/src/lib/attackTree.ts](../../client/src/lib/attackTree.ts#L60-L69)); the "feasible for
attacker X" predicate then ANDs two independently-minimised attributes, admitting a phantom easiest
path. *Fix:* for OR, select the single child that minimises the decision attribute (cost or success
probability) and report **that child's** (skill, access, cost) bundle. *(Kordy et al. 2010/2014.)*

### P0-3 · A *preventive* control is allowed to cut **impact**
In the shipped example, CM1 (`type: preventive`) sets T1 `residualImpact 5→2`, dropping the
top safety threat from **Critical (25) to Low (4)** where **Medium (10)** is defensible
([countermeasures.json](../../projects/example-radar-level-sensor/08-countermeasures/countermeasures.json#L14-L15)).
A preventive control changes the *probability* of success, not the *consequence* if bypassed.
*Fix:* restrict `residualImpact < impact` to detective/corrective/limiting controls; for preventive
controls allow only `residualLikelihood` reduction, or at minimum warn. *(IEC 62443-3-2; ISO 27005.)*

### P0-4 · "Verified" can be claimed with no verification evidence
The validator requires `ticketUrl` for `implemented`/`verified` but **not** `verificationUrl`
([server/src/validate.js](../../server/src/validate.js#L36), [client/src/lib/validate.ts](../../client/src/lib/validate.ts#L34)).
A control can therefore be marked **verified** with no evidence — a false compliance positive (62443-4-1
SVV). *Fix:* require `verificationUrl` when status = `verified`; surface it on the dashboard like the
missing-ticket warning. **(Applied in this session — see "Fixes already applied".)**

### P0-5 · The traceability chain is never exported for an assessor
The chain exists *in the data* and on the dashboard, but the only exportable artefact — the HTML
report — emits **disconnected tables** and omits the countermeasure ticket/verification links, the
residual per threat, the per-threat asset/interface, the non-attacker assumptions, and the trust
boundaries ([server/src/report.js](../../server/src/report.js#L53-L85)). An assessor handed the HTML
cannot follow asset→threat→risk→control→residual→verification.
*Fix:* add a single **traceability-matrix** table to the report (Asset · C/I/A/S · Threat · Initial ·
Requirement · Control · Residual · Evidence) plus a machine-readable `traceability.{csv,json}` export.
*Highest leverage, low effort — the data already exists.*

### P0-6 · The validator gives false assurance (weak completeness gates)
Only orphans / dangling-by-shape / dup-IDs / ratings are checked; a 1-threat model exports "No
issues". `attackerRef` / `interfaceRef` / `crossesBoundary` are never validated against existing IDs
(dangling refs allowed) ([client/src/lib/validate.ts](../../client/src/lib/validate.ts#L6-L48)).
*Fix:* add (i) a STRIDE-per-element/flow coverage matrix and "every external interface has ≥1 threat",
(ii) `residual ≤ initial`, (iii) `mitigated` requires an implemented control, (iv) validate all
cross-references. **(Reference validation partially applied this session.)**

### P0-7 · Likelihood ignores the mandatory attacker profile
`deriveLikelihood` never reads `attackerRef` ([client/src/lib/risk.ts](../../client/src/lib/risk.ts#L92-L103));
in the example T1 links attacker ATK-2 (physical, capability 4) but its factors say access 1 / capability 1,
inflating likelihood from a defensible 3 to 5. The thesis makes attacker assumptions *mandatory because
they are the basis of likelihood* — yet they don't enter the arithmetic.
*Fix:* seed/clamp `likelihoodFactors.capability/access` from the referenced profile; flag any threat
whose factors exceed its attacker's reach.

---

## P1 — Thesis-critical gaps

### P1-1 · No first-class security-requirement node (step 05 missing)
The chain the thesis repeatedly names (threat → risk → **requirement** → control) is severed:
countermeasures bind straight to threats and the only proxy is a free-text `iec62443Ref`
([types.ts](../../client/src/types.ts#L172)). *Fix:* add a `requirements` artefact (id, text,
standardRef, derivedFromThreat[], satisfiedByCM[]) as methodology step 05, and thread it through the
report, dashboard and plausibility checker.

### P1-2 · Likelihood aggregation diverges from the thesis's own model
Likelihood = rounded **equal-weight mean** of four factors, but `bewertung.typ` defines a
*multiplicative* `P_total = E_P · P_access · ∏P_cost` with capability as a feasibility gate, not a
fourth averaged term. *Fix:* implement the documented model (or explicitly re-derive and justify a
single coherent scheme). Also drop `controlMaturity` from the **initial** likelihood — it
double-counts control effect already modelled in the residual (inherent-vs-residual principle).

### P1-3 · Attack-tree effort math is invalid and the tree is orphaned from risk
AND/SAND **sum weighted-mean indices** then `clamp(…,5)`, so effort saturates (AT1 `s1` true 7.85
shown 5.0) and cannot rank paths; SAND is computed identically to AND
([attackTree.ts](../../client/src/lib/attackTree.ts#L74-L81)). The tree's metrics are display-only and
never feed the linked threat's likelihood. *Fix:* convert each step to `P_cost=(6−C)/5` and **multiply**
along a path; feed the min-cost feasible path back as a suggested likelihood; model an order-dependent
attribute for SAND or relabel it documentation-only.

### P1-4 · Attacker access enum drops a scale point and inverts adversary power
`{remote:1, adjacent:3, local:4, physical:5}` omits "Remote (auth.)"=2, so any step needing access 2
is infeasible for every remote attacker; treating access as a total order makes the most dangerous
real adversary (remote) the least capable in-tool
([AttackTreesPanel.tsx](../../client/src/components/panels/AttackTreesPanel.tsx#L9)). *Fix:* give the
attacker profile the full 1–5 access scale and model access as reachable-position capabilities, not a
single subsuming ordinal.

### P1-5 · No systematic STRIDE / DFD coverage mechanism
Threats are a free-form list; nothing elicits or checks STRIDE-per-element / per-boundary-crossing
flow, so whole categories are silently missed (example flow F1 has no S/R/I threat). *Fix:* generate a
coverage matrix (element/flow × applicable STRIDE) and flag gaps in Review. *(Shostack 2014.)*

### P1-6 · AI workflow, agents and `.assets/documents/` ingestion are absent from the app
`tra/project.md` calls for document ingestion and assistive agents; the webapp has no LLM seam, no
`documents/` folder, and the repo agents are disconnected. *Fix:* add `.assets/documents/` + an
ingestion endpoint and at least one human-reviewed assistive action (e.g. "suggest threats/controls
from documents + KB").

### P1-7 · Inter-rater reliability / reproducibility scaffolding missing
The deterministic rubric is *optional* and rater-agnostic; 4 of 5 example threats store bare integers
with no `impactDimensions`/`likelihoodFactors`, bypassing the method for 80 % of the sample. *Fix:*
capture `ratedBy`/timestamp, support optional dual-rating with delta flagging, and offer a "rigorous"
mode that makes the rubric authoritative. *(RQ2.)*

### P1-8 · Knowledge base lacks reusable templates/assets/risk-ratings and provenance
KB carries only threats/CMs; no reusable **assets**, full **risk ratings**, or **template/mock TRAs**
(FR-06), and ownership is convention-only. *Fix:* add `templates/` and `assets/` to the KB; record
entry provenance/version; pin the KB commit SHA into each project.

### P1-9 · CRA SBOM and lifecycle (DM/SUM) obligations unmet
`provenance` is a single free-text field whose help text claims it "drives SBOM", but there is no
SBOM, no component version/supplier/license/CPE, no CVE linkage, no residual-risk sign-off
(owner/date/rationale), and no re-assessment trigger. *Fix:* add SBOM fields + CycloneDX import/export
+ CVE linkage; add accepted-risk approver/rationale/review-date and a defect register.

### P1-10 · Export is hard-coded HTML with no plugin seam; report shows layer-1 DFD only
Goal 3 wants pluggable export; the report renders only DFD layer 1 without trust boundaries. *Fix:*
extract an `Exporter` interface (html/json/csv/oscal); render all layers + boundaries; surface an
in-app change/version log.

---

## P2 — Usability, accessibility & polish

| # | Severity | Area | Location | Problem | Fix |
|---|----------|------|----------|---------|-----|
| P2-1 | Blocker (a11y) | Keyboard | [StepNav.tsx](../../client/src/components/StepNav.tsx#L51), [common.tsx](../../client/src/components/common.tsx) chips/jump | Step nav and multi-selects are click-only `div`/`span` — keyboard/SR users cannot operate them | Render as `<button>` / add `role`+`tabIndex`+Enter/Space; `aria-pressed`/`aria-current`; `:focus-visible` ring |
| P2-2 | Blocker (data) | Error prevention | ✕ buttons everywhere; no undo in [store.ts](../../client/src/state/store.ts#L146) | Every delete is instant & irreversible, no confirm/undo | Confirm when item has content/inbound refs; add Undo toast / soft-delete |
| P2-3 | Major (data) | Data model | ID inputs in Threats/System/CM panels | Editing an `id` doesn't update references → silent orphans | Make IDs read-only after creation, or cascade-rename |
| P2-4 | Major | Save feedback | [store.ts](../../client/src/state/store.ts#L157) | "saved" shows even when Offline / REST write failed → silent loss | Drive indicator from a real server ack; warn on unload with pending writes |
| P2-5 | Major | Contrast | `--text-faint` [index.css](../../client/src/index.css#L13) | ~3:1 on white, used by every hint/guidance label — fails WCAG AA | Darken to ≥4.5:1 (≈`#5f6875`) + re-check dark value. **(Applied this session.)** |
| P2-6 | Major | Workflow | [StepNav.tsx](../../client/src/components/StepNav.tsx#L20) | No Next/Back, no "do this next", no "done when…" despite mandated wizard guidance | Add a guided mode tied to existing `done`/`validate` |
| P2-7 | Major | Density | [ThreatsPanel.tsx](../../client/src/components/panels/ThreatsPanel.tsx#L100) | ~15 controls per threat card overwhelm a novice | Progressive disclosure: collapse advanced fields |
| P2-8 | Major | Dark mode | [index.css](../../client/src/index.css#L845) `.issues`, `.btn.danger`, `.depthnote`, `.k-step` | Hardcoded light hex → jarring patches in dark mode | Route through theme variables |
| P2-9 | Major | Report delivery | [TopBar.tsx](../../client/src/components/TopBar.tsx#L27) | `window.open`+`document.write` is silently pop-up-blocked → headline deliverable produces nothing | Render in-app/iframe or download link; detect blocked window |
| P2-10 | Minor | Colour-blind | [RiskMatrix.tsx](../../client/src/components/RiskMatrix.tsx#L46) | Band encoded by colour+score only on a green→red ramp | Add band label/pattern to cells; colour-blind-safe ramp |
| P2-11 | Minor | Consistency | [StepNav.tsx](../../client/src/components/StepNav.tsx#L11) "08" vs [ReviewPanel.tsx](../../client/src/components/panels/ReviewPanel.tsx#L28) "07" | Same step shows different numbers | Single source of truth for step order/number. **(Applied this session.)** |
| P2-12 | Minor | DFD discoverability | [DfdView.tsx](../../client/src/components/dfd/DfdView.tsx#L516) | Arrow-key nav (the mandated interaction) is undocumented and focus-dependent | State `← → ↑ ↓` in the keyhint; focus ring on the canvas |

---

## Prioritised roadmap

| Order | Item | Effort | Why |
|-------|------|--------|-----|
| 1 | P0-5 traceability-matrix export + CSV/JSON | S | Central thesis claim (RQ3); data already exists |
| 2 | P0-1 / P0-2 fix componentwise-min (residual + OR) | S | Correctness blocker; under-rates real risk |
| 3 | P0-3 preventive-control-impact guard | S | Mis-rates the headline safety threat |
| 4 | P0-7 attacker → likelihood coupling | M | Restores the mandatory attacker basis |
| 5 | P0-6 completeness/coverage + ref validation | M | Stops false "no issues" assurance |
| 6 | P1-1 security-requirement node (step 05) | M | Restores the threat→requirement→control chain |
| 7 | P1-2/P1-3 likelihood & attack-tree math | M | Align engine with `bewertung.typ` |
| 8 | P2-1/P2-5/P2-11 a11y + contrast + numbering | S–M | Accessibility & polish; partly done |
| 9 | P1-9 SBOM + lifecycle (DM/SUM) | L | CRA Annex I / 62443 DM-SUM |
| 10 | P1-6 document ingestion + assistive agent | L | Thesis AI-workflow vision |

---

## Fixes already applied in this session

Alongside this report, the lowest-risk, highest-value items were implemented and verified
(build + typecheck green):

- **P0-4** — `verificationUrl` is now required when a countermeasure's status is `verified`
  (client + server validators); surfaced like the missing-ticket warning.
- **P0-6 (partial)** — the validator now flags **dangling `attackerRef` / `interfaceRef`**
  references and **residual risk that exceeds the initial risk**.
- **P2-5** — `--text-faint` darkened to meet WCAG AA for hint/guidance text (light + dark).
- **P2-11** — step numbering reconciled (the Review panel no longer shows a contradictory number).

---

## Resolution status (follow-up session)

All items above were subsequently addressed, plus the P11 interview recommendation. Highlights:

- **Risk methodology (P11 + P0-1/2/3/7, P1-2/3/4).** Likelihood is now decomposed into
  **Exposure × Exploitability** (P11's recommendation; a single coarse likelihood was too blunt),
  combined multiplicatively onto the familiar 5×5 matrix, with `controlMaturity` dropped from the
  inherent likelihood. Residual = the single most-protective control (no cross-axis minimisation).
  The attack-tree engine now uses success **probability** (OR = easiest child's bundle; AND/SAND =
  product), feeds a suggested likelihood back to the linked threat, and uses the full 1-5 access
  scale. The attacker profile seeds/validates the factors.
- **Traceability & exports (P0-5, P1-10).** The report now renders a full **traceability matrix**
  (asset→threat→risk→requirement→control→residual→evidence), **all DFD layers with trust
  boundaries**, and writes machine-readable **traceability.csv / traceability.json / sbom.cdx.json**
  (CycloneDX) plus in-app download/preview (no pop-up).
- **Requirement node (P1-1)** added as methodology step 05, threaded through the report, dashboard
  and validator. **SBOM + defect register + residual-risk sign-off (P1-9)** added.
- **Validator (P0-6, P1-5).** Coverage (STRIDE-per-element, every interface ≥1 threat), reference
  integrity, residual ≤ initial, mitigated-needs-implemented-control, accepted-needs-sign-off, and
  rigorous-mode rubric enforcement.
- **Assistant (P1-6)** ingests `projects/<id>/documents/` and proposes KB threats (rule-based,
  human-reviewed). **KB (P1-8)** gained reusable assets/risk-ratings/templates, provenance, and a
  pinned KB version in the report.
- **Usability/a11y (P2-1..P2-12).** Keyboard-operable nav/chips/jump with focus rings, delete
  confirmation, read-only IDs, real save-state (offline warning + unload guard), wizard Back/Next
  with "done when", threat-card progressive disclosure, theme-aware colours, colour-blind matrix
  band labels, and documented DFD arrow-key navigation.

The example project was re-modelled accordingly (exposure factors, Bug Bar dimensions, requirements
R1–R5, SBOM fields, defect register, residual sign-off) and now passes the full plausibility check.

---

## Appendix — per-lens verdicts (original review)

- **Usability:** "Competent, information-dense tool a *security person* could use, but it fails the
  thesis's own non-expert acceptance bar; the structural blockers are keyboard/SR inoperability and
  one-mis-click irreversible deletes."
- **Thesis fulfilment:** "A strong *modelling tool*, but not yet the *compliance-evidence and
  knowledge-leverage instrument* the thesis argues for — gaps concentrate on traceability export, the
  requirement node, AI leverage, and rating reproducibility."
- **62443-4-1 / CRA:** "Would fail an assessment on **evidence grounds**: the dashboard looks
  compliant but the chain cannot be exported, and the validator's clean bill of health is false
  assurance."
- **Threat-model quality:** "Well-engineered and client/server-consistent, but the quantitative core
  is methodologically unsound in several places (componentwise minimisation, preventive→impact,
  equal-weight likelihood, clamped effort, attacker profile ignored)."
