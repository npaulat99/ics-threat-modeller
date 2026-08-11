---
description: "Run a quick plausibility and internal-consistency check on an EmbedRisk TRA project: implausible ratings, contradictory assumptions, attacker/exposure mismatches — without a full review report."
agent: tra-reviewer
argument-hint: "Path to the TRA project folder, optionally a specific step or threat id"
---
Run a focused plausibility pass on the project (or the specific step/threat id) provided. Skip the
full schema/reference-integrity sweep (that's `tra-review-single`); focus only on:

- Attacker `access` vs. rated `exposure`/`likelihoodFactors.exposure` mismatches.
- Attacker `capability` vs. `likelihoodFactors.exploitability` mismatches.
- Assumptions that contradict each other or contradict a rated threat (e.g. an "air-gapped" or
  "no remote access" assumption alongside a threat rated for a remote attacker).
- Countermeasures whose `residualLikelihood`/`residualImpact` don't make sense for their `type`
  (a preventive control should move likelihood, not impact, and vice versa for some detective/
  corrective controls — explain the mismatch, don't just flag it).

Report only genuine implausibilities with a one-line rationale each — do not repeat things that are
merely incomplete (missing fields) unless they make a rating impossible to sanity-check. This is a
sparring-style plausibility pass, not a compliance audit.
