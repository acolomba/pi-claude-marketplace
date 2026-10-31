# Phase 8: Address tech debt: ledger dispositions and advisory - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-10
**Phase:** 08-address-tech-debt-ledger-dispositions-and-advisory
**Areas discussed:** Inherited ledger entries (21), This milestone's entries (84, 88, 89), Advisory remediation depth, Audit bookkeeping beyond the goal line

---

## Inherited ledger entries (21)

| Option | Description | Selected |
|--------|-------------|----------|
| Waive, reason names #236 (Recommended) | `windows waive <id>` with a `[json-output]` reason naming #236 (d7213bc2, 2026-10-05) as the deletion that made the entry moot | ✓ |
| Mark fixed | `windows fixed <id>` for all 21; cleaner counts, no recorded reason | |
| Triage individually | Read each archived SUMMARY and decide per entry | |

**User's choice:** Waive, reason names #236
**Notes:** All 21 entries describe the type-member gate or the coverage-producer pipeline that #236 deleted; 15 of 17 named files are absent.

---

## This milestone's entries (84, 88, 89)

| Option | Description | Selected |
|--------|-------------|----------|
| Add BACKLOG carrier, waive against it (Recommended) | New WOUT-01 with facts and settle recipe; waive 84 against it | ✓ |
| Waive without a carrier | Reason names the sandbox provider blocker only | |
| Settle it live in this phase | Provision a second provider and re-run; needs credentials | |

**User's choice (84):** Add BACKLOG carrier, waive against it

| Option | Description | Selected |
|--------|-------------|----------|
| Waive as accepted design (Recommended) | Dispatch's private composer is the one production reader of two grammar exports pinned by 138 test references | ✓ |
| Fix: move composer into grammar, make helpers private | Rewrite 15 test files; byte-identical output | |
| Fix-lite: move composer, keep both exports | Resolves location only | |

**User's choice (88):** Waive as accepted design

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the ordering, mark fixed (Recommended) | Resolve the pi-subagents root before the hermetic HOME swap in both resolver tests; CI keeps its documented skip | ✓ |
| Fix the ordering and add a CI global install | Same plus a pinned `npm install -g pi-subagents` in the integration job | |
| Waive as environment-dependent | Best-effort probe stays skipped | |

**User's choice (89):** Fix the ordering, mark fixed
**Notes:** Entry 85 was not asked about: the test it names exits 0, so it is marked fixed.

---

## Advisory remediation depth

| Option | Description | Selected |
|--------|-------------|----------|
| Root fix + record the nested residual (Recommended) | 3-line `npm audit fix`; nested copy recorded as Pi-shrinkwrap-pinned with carrier DEPADV-01 | ✓ |
| Root fix only, note it in the phase summary | Same lock change, no carrier | |
| Bump Pi to 1.x now | Clears both copies; a major upgrade, its own milestone | |

**User's choice:** Root fix + record the nested residual

| Option | Description | Selected |
|--------|-------------|----------|
| Carrier + update the 07 deferred item (Recommended) | DEP-07-03-01 points at DEPADV-01; no new ledger entry | ✓ |
| Also append a WINDOWS.md entry and waive it | Ledger shows the residual alongside the other dispositions | |

**User's choice:** Carrier + update the 07 deferred item
**Notes:** Phase 7 D-11 (preserve the e2e fixture tree) was carried forward, not re-asked.

---

## Audit bookkeeping beyond the goal line

| Option | Description | Selected |
|--------|-------------|----------|
| 03 → true; 01 stays false, untick its claim (Recommended) | 03 fully ticked; 01 missed its latency target and its contradicting box is unticked | ✓ |
| Both → true | Flip both; 01's frontmatter would claim what its checklist does not | |
| Leave both to the milestone close | Out of the goal line | |

**User's choice:** 03 → true; 01 stays false, untick its claim

| Option | Description | Selected |
|--------|-------------|----------|
| Leave them; the archive retires the flag (Recommended) | Phase 07 re-ran the whole-tree gate; six verifier runs add nothing | ✓ |
| Re-run verification for phases 1-6 | Regenerate six VERIFICATION.md digests | |

**User's choice:** Leave them; the archive retires the flag

---

## Roadmap section

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, write them as shown (Recommended) | Goal, requirements line, five success criteria written into the ROADMAP Phase 8 section | ✓ |
| Write them, but I will edit the wording after | Same edit, user adjusts before planning | |
| No, leave the placeholder | Keep `[To be planned]` | |

**User's choice:** Yes, write them as shown

## Claude's Discretion

Carrier wording and placement, batching of the 25 dispositions, the exact resolver refactor shape, how the root bump is proven, task boundaries and waves.

## Deferred Ideas

Pi 1.x devDependency bump (DEPADV-01); CI `npm audit` gate; CI global pi-subagents install; the Phase 04 LLM-tool error-text deferred item (milestone close); stale digests for phases 1-6 (archive).
