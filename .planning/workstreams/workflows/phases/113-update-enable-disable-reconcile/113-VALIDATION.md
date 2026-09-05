---
phase: "113"
slug: "update-enable-disable-reconcile"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-05"
---

# Phase 113 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node built-in) — Node 26.8.1 local, Node 24 in CI |
| **Config file** | none — glob-driven from `package.json` scripts |
| **Quick run command** | `node --test "tests/<area>/<file>.test.ts"` (single file; substitute the pair under work) |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | ~15 s per single-file run; ~6-9 min for `npm run check` |

Two gates inside `npm run check` bear directly on this phase and are easy to
forget: `test:corresponding` requires every production file to have a paired
test file, and `test:coverage:direct:negative` guards the direct-coverage
measurement itself. This phase adds no new production FILE — the retained-tree
scan is a sibling export inside the existing
`orchestrators/plugin/workflows-staging-gc.ts`, which is already paired — so the
pairing gate should stay satisfied without new files.

---

## Sampling Rate

- **After every task commit:** `npm run typecheck` + the single-file
  `node --test` for the pair(s) touched + `npm run test:coverage:direct` for
  those pairs
- **After every plan wave:** `npm run lint && npm run fallow && npm test`
- **Before `/gsd-verify-work`:** `npm run check` green end to end, plus
  `pre-commit run --all-files` leaving no file modified
- **Max feedback latency:** ~30 seconds at task level

Recorded operator preference: do NOT re-run a suite an executor already
reported green — spot-check with grep / git log instead.

---

## Per-Task Verification Map

Populated by the planner. Each task carries an `<automated>` verify command
drawn from the requirement map below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| pending | — | — | — | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### Requirement → test map (from RESEARCH.md)

| Criterion / Req | Behavior | Test type | Automated command | File exists? |
|---|---|---|---|---|
| Crit 1 | `update` prepares/aborts/commits/records workflows | unit | `node --test tests/orchestrators/plugin/update.test.ts` | ✅ |
| Crit 1 (record policy) | intent-mark union; finalize narrow-with-placed-names; failure arm | unit | same | ✅ |
| Crit 2 / WLIF-05 | staged workflow names on the projection; enable re-materializes; disable unstages | unit | `node --test tests/orchestrators/plugin/enable-disable.test.ts tests/orchestrators/plugin/install.test.ts` | ✅ |
| Crit 3 | two consecutive `applyReconcile` runs materialize nothing new | integration | `node --test tests/integration/workflow-kind-inversion.test.ts` (or a new sibling) | ✅ file; ❌ case (Wave 0) |
| Crit 3 (unit half) | plan buckets exclude a clean recorded record; backfill gates hold | unit | `node --test tests/orchestrators/reconcile/plan.test.ts tests/orchestrators/reconcile/backfill.test.ts` | ✅ |
| Crit 4 (`info` bytes) | `workflows:` line renders last, both arms | byte-equality | `node --test tests/architecture/catalog-uat.test.ts` + paired `docs/output-catalog.md` | ✅ runner; ❌ fixtures (Wave 0) |
| Crit 4 (`info` composition) | admitted arms only; generated names; sorted | unit | `node --test tests/orchestrators/plugin/info.test.ts` | ✅ |
| Crit 4 (`list` guard) | a workflow-bearing plugin's `list` row is byte-stable | byte-equality | `node --test tests/architecture/catalog-uat.test.ts` | ✅ runner; ❌ fixture (Wave 0) |
| Crit 4 (forcing proof) | widening `components` without updating the kind set fails typecheck | compile-time | `npm run typecheck` + a deliberate revert as negative control | ❌ Wave 0 — the current tuple does NOT guard this direction |
| Crit 5 / WR-09 | both tense tables; per-call-site `read` vs `inspected` split; install phrases byte-identical; `info` renders the preview warnings | unit + byte-equality | `node --test tests/bridges/workflows/discover.test.ts tests/orchestrators/plugin/info.test.ts tests/architecture/catalog-uat.test.ts` | ✅ files; ❌ render fixtures (Wave 0) |
| Crit 6 / WR-03 | one case per widened slot, driven through `update` | unit | `node --test tests/orchestrators/plugin/update.test.ts tests/orchestrators/types.test.ts` | ✅ files; ❌ cases (Wave 0) |
| Crit 7 / WR-06 | `scanRetainedWorkflowsStaging` reports exactly the retained set, sorted, count-bearing; sweep signature unchanged | unit | `node --test tests/orchestrators/plugin/workflows-staging-gc.test.ts` | ✅ |
| Crit 7 (render) | advisory line on BOTH `pending` arms, byte-identical | byte-equality | `node --test tests/architecture/catalog-uat.test.ts tests/orchestrators/reconcile/pending.test.ts` | ✅ runners; ❌ fixtures (Wave 0) |
| Crit 8 / WLIF-06 | the reload remedy is stated on a retiring row, from all four verbs | unit + byte-equality | `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts tests/architecture/catalog-uat.test.ts` + the four verb suites | ✅ runners; ❌ everything else (Wave 0) |
| WLIF-04 | reinstall replaces a workflow artifact | unit | `node --test tests/orchestrators/plugin/reinstall.test.ts` | ✅ file; case existence unverified |
| Crit 9 | whole chain green | gate | `npm run check` | ✅ |

---

## Wave 0 Requirements

- [ ] A compile-forcing proof for the `info` component-kind set — nothing guards
      the widening direction today. Land it with a negative control that shows
      the probe fires.
- [ ] `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` paired
      fixtures for: an `info` row with a `workflows:` line (resolved arm), an
      `info` row with a `workflows:` line (state-only arm), the `list`
      regression row, an `info` row carrying preview-tense discovery warnings,
      the two `pending` arms carrying a retained-tree advisory, and one retiring
      row per WLIF-06 stamping verb.
- [ ] Criterion-6 cases: one per widened slot (`update.ts`'s
      `PHASE3_FAILURE_PHASES`, `orchestrators/types.ts`, `shared/errors.ts`),
      each driving a **workflows** failure through the `update` verb.
- [ ] A workflows-failure vehicle for `update`. A `WorkflowTargetOccupiedError`
      planted at a target path is the cheapest deterministic vehicle — it places
      nothing, so the placed-names report is empty and the finalize failure arm
      narrows to the recorded names alone.
- [ ] A criterion-3 double-reconcile idempotence case with a negative control.
- [ ] `tests/bridges/workflows/discover.test.ts` — every existing
      `discoverPluginWorkflows({ pluginName, resolved })` call needs a `tense`
      if the parameter is required (~25 sites).
- [ ] A WLIF-04 case (reinstall replaces a workflow artifact: old envelope gone,
      new envelope present, record rewritten), then correct the traceability row
      in the same commit as the evidence.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The lingering command actually stays runnable for the session | WLIF-06 | Pi has no `unregisterCommand`; proving the command is still live needs a real Pi session, not a unit harness. The stamped row itself IS unit-testable and that is what this phase gates on | In a live Pi session, install a workflow-bearing plugin, `/reload`, run the workflow command, `uninstall` the plugin, then run the command again without reloading — it still runs, and the uninstall output named the reload remedy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
