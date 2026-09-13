# Phase 6: Assertion and Module Refinement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-08
**Phase:** 06-assertion-and-module-refinement
**Areas discussed:** Extracted public surface, Exact-output ownership, Split rollout order, Temporary forwarding seams

---

## Todo Review

| Option | Description | Selected |
|---|---|---|
| Leave deferred | Preserve the unused-type-member gate as evidence-only history for Phase 9 closure. | ✓ |
| Fold into Phase 6 | Expand Phase 6 to implement the unused-member gate. | |

**User's choice:** Leave deferred.
**Notes:** REQUIREMENTS.md records no terminal finding that authorizes active implementation.

---

## Extracted Public Surface

| Question | Options considered | Selected |
|---|---|---|
| Visibility of new modules | Minimal production surface; layer-level barrels; mixed policy | Minimal production surface |
| Existing entry-point signatures | Preserve all; allow cleanup; preserve external only | Allow cleanup |
| Justification for signature changes | Boundary-driven; broader API cleanup; testability-driven | Broader API cleanup |
| Compatibility handling | Atomic migration; temporary overload; permanent dual form | Atomic migration |

**User's choice:** Use minimal production exports, permit broader contract cleanup, and migrate every caller atomically without overloads or compatibility forms.
**Notes:** No barrel export is added without a current production consumer.

---

## Exact-Output Ownership

| Question | Options considered | Selected |
|---|---|---|
| Body-focused test coexistence | Focused plus exhaustive boundary cases; full bytes everywhere; catalog-centered | Focused plus exhaustive boundary cases |
| Location of expected strings | Owner-local constants; shared fixtures; output catalog | Owner-local constants |
| Dynamic values | Deterministic exact output; normalized placeholders; patterns | Deterministic exact output |
| Notification cardinality | Exact calls plus exact array; exact array only; call count only | Exact calls plus exact array |

**User's choice:** Retain justified focused-body cases, add independent zero/one/many exact-byte owner cases, use deterministic fixture values, and enforce strict complete notification sequences.
**Notes:** `docs/output-catalog.md` stays an independent cross-check rather than becoming the owner tests' fixture source.

---

## Split Rollout Order

| Question | Options considered | Selected |
|---|---|---|
| Critical path | Prerequisites then leaf-to-flow; flow-by-flow; high-risk first | Prerequisites then leaf-to-flow |
| Parallelism | Dependency-aware waves; strict sequence; maximum parallelism | Dependency-aware waves |
| Command order | Install→update→reinstall→list; list-first; research-ranked | Install→update→reinstall→list |
| Verification cadence | Focused per plan, gates per wave, final full suite; full suite each split; final gates only | Focused per plan, gates per wave, final full suite |

**User's choice:** Complete assertion and patch-removal prerequisites first, then dependency-aware leaf splits, followed by install, update, reinstall, and list.
**Notes:** Catalog follows emitter/notify contracts. Shared gates and documentation serialize. Each wave runs affected structural gates; closure runs `npm run check`.

---

## Temporary Forwarding Seams

| Question | Options considered | Selected |
|---|---|---|
| Temporary internal forwarding | None; wave-bounded; phase-bounded | None |
| Atomic move blocked by overlap | Smaller atomic boundary; exception; defer | Smaller atomic boundary |
| Original large module after extraction | Retain orchestration facade; delete; stable re-export facade | Delete |
| Proof before deletion | Complete ownership map; compiler/tests only; map plus tombstone | Complete ownership map |

**User's choice:** Use no forwarding layers. Replan oversized moves around genuine smaller leaf contracts, delete original large modules, and require a complete ownership and stale-reference proof first.
**Notes:** Empty re-export shells and old-path orchestration facades do not survive Phase 6.

## the agent's Discretion

- Exact names for new files, symbols, parameters, and local factories.
- Exact grouping of disjoint leaf work into dependency-aware waves.
- The smallest genuine production leaf boundary used to make a move atomic.

## Deferred Ideas

- Keep the unused-type-member gate as evidence-only history for Phase 9 closure.
- Keep uninstall, the info split, and unauthorized builtin-patch sites outside Phase 6.
