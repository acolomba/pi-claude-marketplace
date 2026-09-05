---
phase: "112"
slug: "install-and-removal-lifecycle"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-05"
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
| TBD | TBD | TBD | prerequisite | V5 | `state.json` records carry a `resources.workflows` array, validated by `PLUGIN_INSTALL_RECORD_SCHEMA` on every read | unit | `node --test tests/persistence/state-io.test.ts` | ✏️ extend | ⬜ pending |
| TBD | TBD | TBD | WLIF-01 | — | install writes envelopes as the sixth ledger phase | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✏️ extend | ⬜ pending |
| TBD | TBD | TBD | WLIF-01 | V12 | **a later (state) phase failure removes every placed envelope from disk** — assert on disk state, not on the rejection | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✏️ extend | ⬜ pending |
| TBD | TBD | TBD | WLIF-01 | — | an undo that cannot remove a name raises `[workflows] (rollback failed)` | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✏️ extend | ⬜ pending |
| TBD | TBD | TBD | WLIF-01 | V12 | a containment refusal from the undo propagates **verbatim**, with no rollback-partial marker | unit | `node --test tests/orchestrators/plugin/install.test.ts` | ✏️ extend | ⬜ pending |
| TBD | TBD | TBD | criterion 2 | — | all three closed sets carry `workflows` and the exhaustiveness pin holds | unit + type | `npm run typecheck && node --test tests/orchestrators/types.test.ts` | ✏️ extend | ⬜ pending |
| TBD | TBD | TBD | WLIF-03 | V12 | `uninstall` leaves no envelope in `workflowsSavedDir` | unit | `node --test tests/orchestrators/plugin/uninstall.test.ts` | ✏️ extend | ⬜ pending |
| TBD | TBD | TBD | WLIF-03 | — | `disable` removes envelopes and **retains** `resources.workflows` | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts` | ✏️ extend | ⬜ pending |
| TBD | TBD | TBD | WLIF-03 | V12 | `marketplace remove --cascade` removes envelopes for every plugin | unit | `node --test tests/orchestrators/marketplace/remove.test.ts` | ✏️ extend | ⬜ pending |
| TBD | TBD | TBD | WLIF-03 | — | a partial removal reports per-name reasons through a typed error **and folds the record** | unit | `node --test tests/orchestrators/marketplace/shared.test.ts` | ✏️ extend | ⬜ pending |
| TBD | TBD | TBD | criterion 4 | — | `reinstall` replaces envelopes and records the names it actually wrote | unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✏️ extend | ⬜ pending |
| TBD | TBD | TBD | criterion 6 | V12 | an **aged** orphan staging tree is removed; a **fresh** one is not | unit | `node --test tests/orchestrators/plugin/workflows-staging-gc.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | fallow edge | — | the `orchestrators` zone allows `bridges-workflows`; omitting it exits 1 naming the edge | gate | `npm run fallow` | ✅ | ⬜ pending |
| TBD | TBD | TBD | criterion 7 | — | whole chain green | gate | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/orchestrators/plugin/workflows-staging-gc.test.ts` — new; covers criterion 6. Must land in the **same commit** as its module (`test:corresponding` runs before `npm test`).
- [ ] A `workflows?: { sourceName: string; body?: string }[]` arm on each of the **six** per-file seeding helpers. No shared `tests/helpers/` exists (deleted by PR #167), so this is six independent edits, not one.
- [ ] Framework install: none.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A crash-orphaned staging tree older than the age bound is actually swept on a real machine | criterion 6 | The sweep's trigger is a real lifecycle event and its input is a wall-clock age; a unit test can only fake the clock or the mtime. | Deferred to the milestone's live UAT. The in-phase assertion is the aged/fresh discrimination against a controlled mtime. |
| The 0.19.0 bump repairs a stale `--partial` record end to end | Phase 111 criterion 8 | Requires a record persisted by the released 0.18.1 and a reload. This phase is what makes the repair *run*; observing it needs a real prior install. | Milestone live UAT. |

Everything else has automated verification.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
