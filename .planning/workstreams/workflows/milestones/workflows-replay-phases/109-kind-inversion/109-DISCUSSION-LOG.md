# Phase 109: Kind inversion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-04
**Phase:** 109-kind-inversion
**Areas discussed:** `{workflows}` reason disposition, the three catalog states, the 109-111 silent window, how far WINV-02's proof reaches

---

## `{workflows}` reason disposition

**Question:** The `{workflows}` member of the `REASONS` closed set means "this plugin has workflows and we dropped them" — which the inversion makes false. WINV-03 says it cannot stay as-is. Which way does it go?

| Option | Description | Selected |
|--------|-------------|----------|
| Retire it (44→43) | Delete the tail `REASONS` member, the `kindToReason` arm, and the `UnsupportedReason` members in both `notify-reasons.ts` and `probe-classifiers.ts`. No phase in this milestone produces a plugin-level workflows reason. Cost: `compat-01`'s assertion message has to be amended to admit a removal. | ✓ |
| Keep with a second meaning | One comment change, every existing pin untouched. Cost: no producer was found for any honest second meaning, so the closed set would carry a member nothing emits. | |
| Keep now, retire in Phase 114 | Defer to the phase where the bridge's real reasons exist. Cost: reinterprets WINV-03's "cannot stay as-is", and the false meaning ships in every intermediate commit. | |

**User's choice:** Retire it (44→43)
**Notes:** The decisive evidence was that Phase 111 reports refused scripts through `warnings[]` rather than reasons, and the spike branch's two workflow tokens (`stale workflow command`, `requires pi-dynamic-workflows`) are separate closed-set members landing in Phases 113 and 114 — so nothing in the milestone would ever emit a repurposed token.

---

## Recording the removal in the closed-set ledgers

**Question:** Both closed-set gates document their history as a monotonic ledger — `notify-closed-set-locks` comments run "37→38 … 43→44", and `compat-01`'s failure message says tokens may only append at the tail. A removal is the first non-monotonic move either has seen. How is it recorded?

| Option | Description | Selected |
|--------|-------------|----------|
| Append the reversal, keep the WDET-04 line | New ledger line below the WDET-04 line so both moves stay readable in place; `compat-01`'s message amended narrowly to admit a removal only on unsupported→supported, arriving with its catalog rows. | ✓ |
| Rewrite the ledger as if WDET-04 never happened | Delete the "43 → 44" line so the narrative ends at 43 and reads clean. Cost: a reader who hits the #154 commit or the live spike branch finds a token the ledger says never existed. | |
| Amend `compat-01`'s message broadly | A general "additions and removals both arrive with their catalog rows" rule. Cost: stops naming the append-only tail discipline, which is the property the order-sensitive `deepEqual` actually enforces. | |

**User's choice:** Append the reversal, keep the WDET-04 line
**Notes:** Consistent with the project comment policy — decision and requirement IDs are traceability and are kept; only planning refs are stripped.

---

## The three catalog states

**Question:** The three workflow catalog states each demonstrate one token across three surfaces (list inventory, partial-install success, install rejection). Retiring `{workflows}` removes the only thing they demonstrate. WINV-04 says turn them, not delete them. What do they turn into?

| Option | Description | Selected |
|--------|-------------|----------|
| Turn each to its post-inversion form | Two become clean rows (not-installed, `(installed)`, no brace); the rejection state repoints to a plugin carrying workflows AND a still-unsupported kind, so a rejection still renders but its brace names the other kind. All three fixtures change expected bytes — a real red-then-green turn. | ✓ |
| Repoint all three to workflows-plus-unsupported | Uniform, three fixtures change one token each. Cost: nothing in the catalog then shows a workflow-bearing plugin installing cleanly, which is the actual change this phase makes. | |
| Delete all three | Their own prose says they add no workflow-specific glyph, heading, or wrapping rule, and each duplicates a generic sibling. Cost: WINV-04 asks for a red-then-green proof rather than an absence. | |

**User's choice:** Turn each to its post-inversion form
**Notes:** A constraint was checked before the options were framed — `catalog-uat` pairs each `catalog-state` annotation byte-for-byte with its fixture's `notify()` output and imposes no uniqueness rule across states, so two states rendering identical bytes is permitted. That is what makes the clean-row turn viable.

---

## Labelling the turned states

**Question:** Turned to their post-inversion form, two of the state ids become false: `workflow-partial-install-success` would label a clean `(installed)` row, and `workflow-partially-available-inventory` a row with no brace. Section headings also carry the `(WDET-04)` requirement tag from #154. How are they labelled?

| Option | Description | Selected |
|--------|-------------|----------|
| Rename ids and retag to WINV | Ids become what the rows now show; headings retag to `(WINV-04)`. `catalog-uat` pairs purely by id string, so a rename is mechanically free. | ✓ |
| Keep ids, retag headings only | Preserves traceability across the inversion. Cost: two ids describe the opposite of what their block renders, and the id is what a future search lands on. | |
| Rename ids, keep both tags | Headings carry `(WDET-04 / WINV-04)`, mirroring the source ledger decision. Cost: doc headings accumulate requirement history the source ledger already carries. | |

**User's choice:** Rename ids and retag to WINV
**Notes:** A state id reading "partial" above a clean row is the same stale-contract problem WINV-05 corrects in the prose.

---

## The 109-111 silent window

**Question:** After Phase 109 and before Phase 111's bridge, a workflow-bearing plugin resolves `installable`, renders `● (installed)` with no brace, and materializes zero workflow commands — less honest than today's `partially-available {workflows}`. How is the window handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Accept it, record it in the phase artifacts | Land the full inversion and record the intermediate state in SUMMARY and VERIFICATION; cut no release from the branch before Phase 111. Contained: `features/workflow`, no `push` trigger on `features/**`, milestone runs end to end in one session. | ✓ |
| Split the tuples: unsupported now, supported at 111 | Cost: in between, `workflows` is in neither closed set — the silently-ignored-kind failure the T-02-25 security note warns about. Strictly worse than the window it avoids. | |
| Add a temporary install-time note | Closes the honesty gap for real. Cost: a feature built solely to be deleted in 111, needing its own closed-set reason and catalog state, in a phase that has already changed the reason set once. | |

**User's choice:** Accept it, record it in the phase artifacts
**Notes:** The risk named alongside the recommendation was that a mid-milestone pause leaves the branch looking shippable when it is not — and this workstream's own history (the spike branch, never merged) is exactly that failure. Accepted with the recording obligation as the mitigation.

---

## How far WINV-02's proof reaches

**Question:** Criterion 2 says the plugin "installs on a plain `install`, with no `--partial`" — but in Phase 109 there is nothing to materialize. How far does the proof reach?

| Option | Description | Selected |
|--------|-------------|----------|
| Resolver arm plus an install-level window test | Resolver owner test moves the workflows row out of `unsupportedConventionScenarios` and asserts the `installable` arm plus a populated `componentPaths.workflows`; an install-level test asserts both that the install succeeds without `--partial` and that no workflow artifact exists on disk. | ✓ |
| Resolver level only | Prove the arm where the change lives. Cost: criterion 2 says "installs", and no test in this phase would show an install. | |
| Resolver plus install, no artifact assertion | Survives Phase 111 unchanged, no test churn. Cost: the window goes unpinned, and "install succeeded" alone would stay green in 111 whether or not the bridge wrote anything. | |

**User's choice:** Resolver arm plus an install-level window test
**Notes:** Scouting established that `tests/edge/handlers/plugin/install.test.ts` uses "workflow" only in the generic English sense ("the install workflow") — the only real workflow-kind fixture in the suite is `tests/domain/resolver.test.ts:101`. The Phase 111 flip of the no-artifact assertion was explicitly carried into CONTEXT.md's Deferred Ideas so it is not left behind.

---

## Claude's Discretion

- Comment wording throughout, and which file carries which half of the reason deletion.
- The fixture plugin name and shape for the install-level window test, and which second unsupported kind the repointed rejection state uses (`themes` suggested, not required).
- Whether the resolver exports a `SupportedKind` type alongside `SUPPORTED_COMPONENT_KINDS` — the spike branch does, main does not; only if something in the phase needs it, since `fallow dead-code` flags unused exports.
- Whether the manifest schema move gets a positive locking test mirroring the `HOOK-01` precedent in `hooks-foundation.test.ts`.
- Rewording the `notify.ts` doc comments at lines 930 and 1778 that name workflows as a `--partial` example.

## Deferred Ideas

- **Phase 111 must flip the install-level window assertion** from "no workflow artifact exists" to "the envelopes are written". Carried into CONTEXT.md's Deferred Ideas for transfer to Phase 111's context.
- `docs/workflows-compatibility.md` is Phase 114's deliverable (WDOC-01..03) — not created or referenced here.
- The `requires pi-dynamic-workflows` soft-dep marker (Phase 114) and the `stale workflow command` reason (Phase 113) are the reason the retired token is not repurposed — but must not be pre-added in this phase.
- `WNAM-06` needs rewording; it requires reuse of a shared colon-name helper that does not exist on this branch. Recorded in `port/README.md`; belongs to Phase 110.

## Process note

The default discuss flow checks "more questions or next area?" after each area. Both areas that resolved decisively in two questions (the reason disposition and the catalog states) advanced without that check, and the closing "which gray areas remain unclear?" gate served as the single reopen point. The user selected "I'm ready for context".
