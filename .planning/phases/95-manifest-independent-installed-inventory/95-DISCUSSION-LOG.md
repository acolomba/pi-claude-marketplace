# Phase 95: Manifest-independent installed inventory - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-08
**Phase:** 95-manifest-independent-installed-inventory
**Areas discussed:** Reason brace policy, Fold-path absence signal, Tool-surface asymmetry, Characterization scope

---

## Area selection

All four proposed gray areas were selected for discussion. A fifth candidate —
open decision 2, component name fidelity — was not offered as a Phase 95 area
because it governs `plugin info` (Phase 96); it was raised separately at
close-out and deferred.

---

## Reason brace policy

**Question:** INV-01 needs installed rows to carry `{not in manifest}`. What
rule should replace the current blanket omission?

| Option | Description | Selected |
|--------|-------------|----------|
| Narrow allowlist | Installed and partially-installed rows may carry reasons, but only from an explicit allowlist holding exactly `{not in manifest}`. Preserves original intent while gating future additions. *(Claude's recommendation)* | |
| General rule | Installed rows carry whatever typed reasons the orchestrator supplies, same as every other status arm. Simplest and most uniform; no structural gate. | ✓ |
| Keep omission, signal elsewhere | Leave rows brace-free and express manifest absence another way — likely reopens milestone scope, since `orphaned` status and persisted orphan flag are both Out of Scope. | |

**User's choice:** General rule
**Notes:** Overrode Claude's recommendation of the narrow allowlist. On
reflection the override is the more house-consistent choice: the established
invariant is that orchestrators determine state and stamp reasons while
`notify.ts` remains a dumb renderer, so an allowlist in the render path would
invert that ownership. Recorded as D-95-01.

**Question:** How should the recorded rationale distinguish `{not in manifest}`
from what the original decision excluded?

| Option | Description | Selected |
|--------|-------------|----------|
| Durable vs transient | `{not in manifest}` is a stable property of the record's relationship to its marketplace; the excluded braces were transient conditions tied to a pending action. *(Claude's recommendation)* | ✓ |
| Brace/trailer decoupling | Record that the original omission was defensive coupling to the reload-hint concern, which `shouldEmitReloadHint` provably ignores. | |
| Both | Lead with durable-vs-transient as the forward-looking rule, cite decoupling as supporting evidence. | |

**User's choice:** Durable vs transient
**Notes:** Combined with the general rule, this becomes documented editorial
guidance for future authors rather than a code-enforced gate. Recorded as
D-95-02.

---

## Fold-path absence signal

**Question:** How should the fold path carry the manifest-load outcome into row
building?

| Option | Description | Selected |
|--------|-------------|----------|
| Pass `ScopedManifest` bundle | Replace the `manifest` param with the existing `ScopedManifest` type at `list.ts:789-792`; both call sites pass the whole destructure result. *(Claude's recommendation)* | ✓ |
| Add a boolean param | Keep `manifest` and add `manifestLoaded: boolean`. Smaller diff, but two fields that must stay consistent — the drift shape that allowed the defect. | |
| Mirror the primary early-return | Skip the fold entirely on load error. Symmetric but over-corrects: hides installed plugins, which BOUND-03 does not ask for. | |

**User's choice:** Pass `ScopedManifest` bundle
**Notes:** Recorded as D-95-04 and D-95-05.

**Question:** The primary path hides every installed plugin under a marketplace
whose manifest fails to parse. BOUND-01 explicitly retains that. Keep it out of
scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Out of scope, log to backlog | Honor BOUND-01; capture the hidden-installed-plugins behavior as a deferred idea for a later milestone. *(Claude's recommendation)* | ✓ |
| Out of scope, no backlog entry | Treat current behavior as intended and carry nothing forward. | |
| Pull into v1.18 | Widen scope so a failed-manifest marketplace still lists installed records. Contradicts BOUND-01, needs new render forms. | |

**User's choice:** Out of scope, log to backlog
**Notes:** Backlog entry to be added to `.planning/BACKLOG.md`.

---

## Tool-surface asymmetry

**Question:** Does v1.18 widen the LLM tool reason projection, or accept the
asymmetry?

| Option | Description | Selected |
|--------|-------------|----------|
| Widen to both | Add `installed` and `partially-installed` to `pluginReasons`. Closes a pre-existing information loss and gives the agent the signal the milestone exists to produce. Costs a REQUIREMENTS.md amendment. *(Claude's recommendation)* | ✓ |
| Widen to partially-installed only | Fix the pre-existing gap but leave `{not in manifest}` off installed rows in the payload. Inconsistent in a new way. | |
| Accept asymmetry | Confirm the Out of Scope row; new reason renders on the slash command only. | |

**User's choice:** Widen to both
**Notes:** Two scouting findings drove this away from the pre-supposed Out of
Scope position: `projectRowStatus` already flattens four statuses into
`"installed"`, so a degraded install is currently indistinguishable from a clean
one in the tool payload; and `upgradable` already forwards reasons while also
projecting to `"installed"`, so the exclusion was never a held principle.
Recorded as D-95-06 / D-95-07.

**Question:** If widened, which phase carries the `tools.ts` change?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 95 with INV-01 | Projection change lands beside the row-builder change that produces the reason, verified together. *(Claude's recommendation)* | ✓ |
| Phase 98 with COMPAT-01/DOC-08 | Group with contract and documentation work; leaves the tool payload lagging for two phases. | |
| New requirement, decide at planning | Record the decision, assign an ID, let plan-phase place it. | |

**User's choice:** Phase 95 with INV-01

---

## Characterization scope

**Question:** Where should the Phase 95 characterization tests live?

| Option | Description | Selected |
|--------|-------------|----------|
| New dedicated file | `tests/orchestrators/plugin/list-manifest-absent.test.ts`. Distinct lifecycle; `list.test.ts` is already 2481 lines. Matches existing subject splits. *(Claude's recommendation)* | ✓ |
| Append to `list.test.ts` | Keep all list coverage in one file, adjacent to the existing 40 disabled/partial assertions. | |
| Split by requirement | One file per requirement group. Maximum traceability, most files. | |

**User's choice:** New dedicated file

**Question:** How tightly should the characterization assertions pin current
output?

| Option | Description | Selected |
|--------|-------------|----------|
| Byte-exact rows | Assert the full rendered row string per case, matching the project's byte-frozen output culture. *(Claude's recommendation)* | ✓ |
| Byte-exact rows plus severity and trailer | Also pin computed severity and `/reload` trailer presence. Strongest guard, largest update surface. | |
| Structural assertions | Assert status token and reasons array rather than rendered strings. Would not catch glyph or spacing drift. | |

**User's choice:** Byte-exact rows
**Notes:** Per INV-04 the set covers the canonical disabled shape only and must
not pin the current partial-disabled rendering, which ENBL-06 changes in Phase
97. Recorded as D-95-08 / D-95-09.

---

## Close-out

**Question:** Decide open decision 2 (component name fidelity) now or at Phase
96 discuss?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to Phase 96 discuss | Governs no Phase 95 code; Phase 96 discuss will have the `info.ts` reconstruction in front of it. *(Claude's recommendation)* | ✓ |
| Decide now | Settle it cold to satisfy STATE's recorded gate literally. | |

**User's choice:** Defer to Phase 96 discuss
**Notes:** STATE.md's gate should be re-pointed to "before Phase 96 planning".
Recorded as D-95-11.

**Question:** Fold the matched pending todo into Phase 95?

| Option | Description | Selected |
|--------|-------------|----------|
| Do not fold | Matched on generic keywords; subject is mutation paths Phase 95 does not touch. *(Claude's recommendation)* | ✓ |
| Fold into Phase 95 | Cover rare failure arms alongside the new test file. Widens the phase. | |
| Note for Phase 98 | Do not fold, but record as a candidate for the lifecycle regression sweep. | |

**User's choice:** Do not fold

**Question:** How should the tool-surface requirement amendment land?

| Option | Description | Selected |
|--------|-------------|----------|
| Quick task after discuss | Matches precedent set twice on this branch (`260807-q0v`, `260807-ur3`). Atomic, committed, traceable. *(Claude's recommendation)* | ✓ |
| Amend inline now | Edit the docs directly before writing CONTEXT.md. Fewer steps, no commit trail. | |
| Record in CONTEXT.md only | Let plan-phase reconcile. Risks planning from a stale REQUIREMENTS.md. | |

**User's choice:** Quick task after discuss
**Notes:** Recorded as D-95-10, with an explicit gate that planning must not
start until the amendment lands.

---

## Claude's Discretion

- Naming of the new requirement ID for the tool widening (`INV-05`, `TOOL-01`,
  or similar) — settle in the amendment quick task.
- Internal structure and fixture reuse within `list-manifest-absent.test.ts`.
- Whether the `ScopedManifest` param is threaded positionally or the signature
  reshaped, provided both call sites pass the bundle.

## Deferred Ideas

- Installed plugins hidden under a failed-manifest marketplace (`list.ts:862-874`
  emits a bare `(failed)` header with `plugins: []`). Out of scope per BOUND-01;
  to be logged in `.planning/BACKLOG.md`.
- Open decision 2 — component name fidelity on the state-only info arm.
  Deferred to Phase 96 discuss.
- Pending todo "Coverage sweep: test rare failure arms in
  update/reinstall/install" — reviewed, not folded; closer home is Phase 98's
  LIFE-04/05/06 sweep.
