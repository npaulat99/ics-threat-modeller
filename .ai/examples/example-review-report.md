# Example: TRA Reviewer report

Illustrative output of `tra-reviewer` (via the `tra-review-single` prompt) against a hypothetical
project. Shows the expected severity grouping and citation style — actual findings depend on the
real project content.

---

## TRA Review: `example-device`

### Errors (must fix)

- `T3`: references unknown component `CMP-99` (no such component in `03-system-assets/system.json`).
- Duplicate ID `IF-2` — used by both an interface (`03-system-assets/system.json`) and a DFD node
  (`04-dfd/dfd.json`). IDs must be unique across the whole project.

### Warnings (address or explicitly accept)

- `T5`: attacker `ATK-1` (access: `local`) is not proximate enough to reach an exposure-4
  (`remote`) surface it's rated against — likelihood may be over-stated.
  **Recommendation:** either lower the rated exposure/likelihood, or attach a remote-capable
  attacker profile if remote reachability is real (confirm with the user, do not assume).
- `T7`: status `mitigated` but no implemented/verified countermeasure addresses it.
  **Recommendation:** confirm the countermeasure's `status` and `ticketUrl`, or revert `T7`'s status
  to `open` until implementation is confirmed.
- Coverage: interface `IF-4` (Modbus) has no threat — every external interface should have at least
  one.
- `CM-2`: a preventive control should reduce likelihood, not impact — it currently lowers `T2`'s
  impact (4→2) instead.

### Notices (accept if intentional)

- `R-9`: standalone security requirement — not derived from a threat and not backed by a
  countermeasure. Accept via `project.acceptedNotices` if this is a deliberate baseline requirement.

### Summary

2 errors, 4 warnings, 1 notice.

### Recommended next actions

1. Fix the two errors first (broken reference, duplicate id) — these block a trustworthy report.
2. Take the exposure/attacker mismatch (`T5`) and the unmitigated-but-marked-mitigated threat (`T7`)
   to the TRA Facilitator for a targeted correction — it will write the fix directly and log it, so
   review it afterwards via git like any other change.
3. Decide whether the standalone requirement notice should be accepted or linked to a threat.
