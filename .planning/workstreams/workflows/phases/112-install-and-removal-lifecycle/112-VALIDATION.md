---
phase: "112"
slug: "install-and-removal-lifecycle"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-05"
validated: "2026-09-10"
---

# Phase 112 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (built in), Node >= 20.19.0; CI on Node 24 |
| **Config file** | none — driven by `package.json` scripts |
| **Quick run command** | `node --test tests/orchestrators/plugin/install.test.ts` |
| **Full suite command** | `npm run check` |
| **Pair coverage command** | `node scripts/test-coverage-direct.mjs <production path>` |
| **Estimated runtime** | ~5s for one orchestrator owner test; ~4 min for the full chain |

---

## Sampling Rate

- **After every task commit:** `npm run typecheck && npx eslint <changed paths> && node --test <the owner test>`
- **After every wave:** `npm run typecheck && npm run lint && npm run fallow && npm run test:corresponding && npm test`
- **Before `/gsd-verify-work`:** `npm run check` green, plus `node scripts/test-coverage-direct.mjs` reporting `hit === found` on branches, functions and lines for **every** touched production path
- **Max feedback latency:** ~15 seconds (one orchestrator owner test plus its coverage pair)

**Every touched file is at 100% direct coverage today and none is on the
`D-116-01a` accepted-shortfall list** (all seven claimants are `edge/*`). Measured:
`install.ts` at branches 238/238, functions 51/51, lines 2460/2460. So every new
branch must be covered by that file's own owner test — there is no precedent here
for accepting a shortfall.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| — | — | — | prerequisite | V5 | `state.json` records carry a `resources.workflows` array, validated by `PLUGIN_INSTALL_RECORD_SCHEMA` on every read | unit | `node --test tests/persistence/state-io.test.ts` | ✅ extended | ✅ green |
| — | — | — | WLIF-01 | — | install writes envelopes as the sixth ledger phase | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ extended | ✅ green |
| — | — | — | WLIF-01 | V12 | **a later (state) phase failure removes every placed envelope from disk** — assert on disk state, not on the rejection | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ extended | ✅ green |
| — | — | — | WLIF-01 | — | an undo that cannot remove a name raises `[workflows] (rollback failed)` | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ extended | ✅ green |
| — | — | — | WLIF-01 | V12 | a containment refusal from the undo propagates **verbatim**, with no rollback-partial marker | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✅ extended | ✅ green |
| — | — | — | criterion 2 | — | all three closed sets carry `workflows` and the exhaustiveness pin holds | unit + type | `npm run typecheck && node --test tests/orchestrators/types.test.ts` | ✅ extended | ✅ green |
| — | — | — | WLIF-03 | V12 | `uninstall` leaves no envelope in `workflowsSavedDir` | unit | `node --test tests/orchestrators/plugin/uninstall.test.ts` | ✅ extended | ✅ green |
| — | — | — | WLIF-03 | — | `disable` removes envelopes and **retains** `resources.workflows` | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ✅ extended | ✅ green |
| — | — | — | WLIF-03 | V12 | `marketplace remove --cascade` removes envelopes for every plugin | unit | `node --test tests/orchestrators/marketplace/remove.test.ts` | ✅ extended | ✅ green |
| — | — | — | WLIF-03 | — | a partial removal reports per-name reasons through a typed error **and folds the record** | unit | `node --test tests/orchestrators/marketplace/shared.test.ts` | ✅ extended | ✅ green |
| — | — | — | criterion 4 | — | `reinstall` replaces envelopes and records the names it actually wrote | unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ extended | ✅ green |
| — | — | — | criterion 6 | V12 | an **aged** orphan staging tree is removed; a **fresh** one is not | unit | `node --test tests/orchestrators/plugin/workflows-staging-gc.test.ts` | ✅ landed | ✅ green |
| — | — | — | fallow edge | — | the `orchestrators` zone allows `bridges-workflows`; omitting it exits 1 naming the edge | gate | `npm run fallow` | ✅ | ✅ green |
| — | — | — | criterion 7 | — | whole chain green | gate | `npm run check` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/orchestrators/plugin/workflows-staging-gc.test.ts` — new; covers criterion 6. Must land in the **same commit** as its module (`test:corresponding` runs before `npm test`).
- [x] A `workflows?: { sourceName: string; body?: string }[]` arm on each of the **six** per-file seeding helpers. No shared `tests/helpers/` exists (deleted by PR #167), so this is six independent edits, not one.
- [x] Framework install: none.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A crash-orphaned staging tree older than the age bound is actually swept on a real machine | criterion 6 | The sweep's trigger is a real lifecycle event and its input is a wall-clock age; a unit test can only fake the clock or the mtime. | Deferred to the milestone's live UAT. The in-phase assertion is the aged/fresh discrimination against a controlled mtime. |
| The 0.19.0 bump repairs a stale `--partial` record end to end | Phase 111 criterion 8 | Requires a record persisted by the released 0.18.1 and a reload. This phase is what makes the repair *run*; observing it needs a real prior install. | Milestone live UAT. |

Everything else has automated verification.

---

## Validation Audit 2026-09-10

| Metric | Count |
|--------|-------|
| Map rows audited | 14 |
| Covered | 14 |
| Partial | 0 |
| Missing | 0 |
| Manual-only rows audited | 2 |
| Gaps found | 0 |
| Tests generated | 0 |

Run retroactively; this file was seeded by plan-phase and never reconciled. The
audit ran fourteen owner test files live rather than trusting the map — several
hundred cases, all green, including `state-io` (42/42), `install` (157/157),
`uninstall` (65/65), `enable-disable` (77/77), `reinstall` (127/127),
`marketplace/shared` (61/61), `marketplace/remove` (23/23), `plugin/shared`
(81/81) and `workflows-staging-gc` (23/23).

**Task ID and Plan columns read `—` rather than retrofitted values** — the
planner never filled them and inventing a mapping now would fabricate one.

### The red-then-green fold claim: real, with an honest limit on the proof

The mechanism is real and was verified by reading the type declarations rather
than accepting the narration. `applyPartialCascadeFold`'s `dropped` parameter and
`remove.ts`'s hand-rolled equivalent are both structural TypeScript parameters, so
deleting a filter line produces NO compile error — a six-axis object still
satisfies a five-axis shape structurally. That is precisely why a hand-written
case is needed, and the case at `plugin/shared.test.ts:1697` documents in its own
comment why it exists and asserts the post-fold value rather than the pre-fold
one. It would go red if the filter line were removed.

The limit, stated rather than glossed: the audit did **not** re-enact the
delete-and-observe cycle, because doing so requires editing a production file and
that run was read-only. The historical observation is accepted on the summary's
narration; what was independently established is that the test is non-vacuous
today and capable of catching the regression.

### The partial-cascade ordering is load-bearing and pinned

`marketplace/shared.ts:407` assigns `dropped.workflows` before the throw at
`:415`. The case at `marketplace/shared.test.ts:794` asserts
`outcome.dropped.workflows` on the THROWN-and-caught outcome, so reversing the two
statements would leave that array empty and turn the assertion red. Ordering
dependence confirmed rather than assumed.

### One documentation-precision note, and why it is not a gap here

`workflows-staging-gc.ts:148-154` calls a containment refusal "still loud", while
both call sites discard the returned leak array in a bare `catch {}`. That is
accurate as a comment-precision complaint, and it is filed separately. It is NOT
a validation gap: the silence is deliberate under the decision that hygienic
cleanup never becomes the primary user-facing path, and **no row in this file
claims user-visible loudness**. The tests correctly exercise the function's own
return value in isolation, which is the contract that actually exists.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

`nyquist_compliant: true` is set with both Manual-Only rows adjudicated as
genuinely un-automatable rather than declined:

1. **A crash-orphaned staging tree older than the age bound is swept on a real
   machine.** Un-automatable as literally stated — it wants a real crash and a
   real 24-hour wait. The equivalent behavior IS automated today through
   controlled mtime manipulation, with both the aged-sweep and the
   fresh-is-spared directions passing. The manual row is honestly scoped to the
   real-machine residue alone.
2. **The version bump repairs a stale `--partial` record end to end.** Needs a
   record persisted by a previously released version plus a reload, which a
   hermetic test cannot construct without faking prior-version behavior.
   Legitimately deferred to live UAT. It is arguably mis-filed here rather than
   in the phase that owns the bump — a filing quibble, not a coverage gap.

**Approval:** validated 2026-09-10
