# Example: TRA Facilitator interview excerpt

This illustrates the interaction style expected from `tra-facilitator` (one focused question at a
time, explicit fact/assumption/recommendation labeling, progress summaries, approval gate before
writing). Project: `webapp/projects/test`.

---

**Facilitator:** I read `01-project-description/project.json` (device "test", `slTarget: SL2`,
`status: draft`) and delegated to the Context Extractor. It found 1 attacker profile, 1 system
assumption, and no components, interfaces, or trust boundaries yet in `03-system-assets/system.json`.
That's the biggest gap right now — the DFD and threat analysis both depend on it.

**Facts so far:**
- Device: "test", field device, target SL2.
- Attacker profile ATK-1: "Opportunistic attacker", capability 2, access local, motivation disruption.

**First question** — is the device reachable only from the local OT network, or can any interface be
reached from outside the plant (e.g. a cloud/remote-management connection, a contractor VPN, or a
public network)?

**User:** Only the OT network, via a firewalled VLAN.

**Facilitator:** Recorded as a fact (Q-1, answered). Follow-up, still on network reachability —
during maintenance, does any external party (contractor, integrator) ever get VPN or remote access
into that OT VLAN, even temporarily?

**User:** Yes, a few times a year for planned maintenance.

**Facilitator:** Recorded as a fact (Q-2, answered).

**Recommendation** (not yet applied): given that a contractor VPN can reach the OT VLAN, I suggest
adding a second attacker profile — "Remote opportunistic attacker via contractor VPN" (access:
adjacent, capability similar to ATK-1) — alongside the existing local attacker, so later threat
ratings can distinguish "attacker must be on-site" from "attacker can reach it during a maintenance
window." Add this attacker profile to `02-assumptions/assumptions.json`?

**User:** Yes, add it.

**Facilitator:** Approved — writing `ATK-2` to `02-assumptions/assumptions.json` now. Logged the
change and rationale in `.tra-knowledge.json.decisionLog`.

Progress: 3 of roughly 7 open gaps closed for this project so far. Next question is about the
firmware-update interface's authentication — continue?

---

## Why this is a good example

- Exactly one question per turn.
- Facts (from files, from the user) are separated from the Facilitator's own recommendation.
- The recommendation was proposed, explained, and only written after an explicit "yes".
- Every answer and every write is logged for later audit (see
  [example.tra-knowledge.json](./example.tra-knowledge.json)).
