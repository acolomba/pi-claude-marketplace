---
phase: "8"
slug: "direct-coverage"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-10"
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` (Node's built-in runner), Node v26.8.2 locally / 24 in CI |
| **Config file** | none — configured entirely through `package.json` scripts |
| **Quick run command** | `node --test <test-path>` |
| **Pair coverage command** | `node scripts/test-coverage-direct.mjs <source-path>` |
| **Full suite command** | `npm run check` |
| **Estimated runtime** | quick run ~1–10 s; `npm run check` several minutes; a full report sweep ≈ 8.1 min |

---

## Sampling Rate

- **After every task commit:** `node --test <changed test path>`, plus
  `node scripts/test-coverage-direct.mjs <changed source path>` for each pair the task
  touched — **explicit single pairs**. Never the bare `npm run test:coverage:direct`, which
  selects 147 pairs and 6.5 minutes on this branch.
- **After every plan wave:** `npm run typecheck && npm run lint && npm run fallow && npm run format:check && npm run test:coverage:direct:negative && npm test`
- **Before `/gsd-verify-work`:** `npm run check` green, `pre-commit run --all-files` green,
  and the second full report run complete with the pin regenerated from it.
- **Max feedback latency:** 10 s per task-level check.

---

## Per-Task Verification Map

> Task IDs are `<plan>.<task>`. Wave numbers below are the plan frontmatter waves (1-based);
> the three rows this document originally labelled Wave 0 are plan 08-01, the phase's first wave.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01.1 | 08-01 | 1 | RCOV-01 | T-08-04 | the reporter enumerates every pair `productionPaths()` returns without throwing | negative control | `npm run test:coverage:direct:negative` | ✅ file, ❌ case | ⬜ pending |
| 01.2 | 08-01 | 1 | RCOV-03 | T-08-06 | `pre-commit run --all-files` is green before a new hook joins it | smoke | `pre-commit run --all-files` | ✅ command, currently red | ⬜ pending |
| 01.3 | 08-01 | 1 | RCOV-01 | T-08-04 | one complete enumeration sweep, measured in the repository | manual measurement | `npm run test:coverage:direct:report` (≈8 min, **in the repository**) | n/a — artifact | ⬜ pending |
| 02.1 | 08-02 | 2 | RCOV-02 | T-08-08, T-08-09 | `edge/args.ts` reads complete after the rewrite, and trailing `--scope` still throws | pair coverage + unit | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/edge/args.ts` and `node --test tests/edge/args.test.ts` | ✅ files, ❌ 2 cases | ⬜ pending |
| 02.2 | 08-02 | 2 | RCOV-02 | T-08-07 | `edge/handlers/shared.ts` reads complete, and `--scope --local` still answers `local: false` | pair coverage + unit | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/edge/handlers/shared.ts` and `node --test "tests/edge/**/*.test.ts"` | ✅ files, ❌ 2 cases | ⬜ pending |
| 02.3 | 08-02 | 2 | RCOV-02 | T-08-09 | `edge/handlers/plugin/pending.ts` reads complete | pair coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts` | ✅ | ⬜ pending |
| 03.1 | 08-03 | 2 | RCOV-02 | T-08-10, T-08-11, T-08-12 | all four `generationIsCurrent` guards return early, reached through the injected `HooksRuntime` | unit + pair coverage | `node --test "tests/bridges/hooks/**/*.test.ts"` and `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/bridges/hooks/event-router.ts` | ✅ file, ❌ 3 cases | ⬜ pending |
| 03.2 | 08-03 | 2 | RCOV-02 | T-08-13 | `isUpdatePreflightOutcome` discriminates both arms with real values | unit + pair coverage | `node --test tests/orchestrators/plugin/update-preflight.test.ts` and `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` | ✅ file, ❌ 2 cases | ⬜ pending |
| 04.1 | 08-04 | 2 | RCOV-01, RCOV-02 | T-08-03, T-08-15 | the pin loads and validates, and one reading parser serves the gate and the reporter | negative control | `node -e` self-consistency check over `loadCoveragePin` + `assertPinnedReadings` + `shortfallReadingOf` | ❌ — new module and data file | ⬜ pending |
| 04.2 | 08-04 | 2 | RCOV-03 | T-08-04, T-08-14 | an explicitly named base resolves exactly or errors, and never falls back to the chain | CLI assertion | `node scripts/test-coverage-direct.mjs --base refs/heads/definitely-not-a-real-ref` exits non-zero | ❌ — new argument | ⬜ pending |
| 04.3 | 08-04 | 2 | RCOV-03 | T-08-03, T-08-04 | the pin fails on an addition, a changed reading, a stale row, an empty pin with a shortfall, and a row outside the enumeration | negative control | `npm run test:coverage:direct:negative` | ✅ file, ❌ 6 cases | ⬜ pending |
| 05.1 | 08-05 | 3 | RCOV-02 | T-08-01, T-08-02 | the port is declared with two verbs, and its fake plus shared contract plus the contract's own negative control pass | unit | `node --test tests/platform/removal-ops-fake.test.ts` | ❌ — three new files | ⬜ pending |
| 05.2 | 08-05 | 3 | RCOV-02 | T-08-16, T-08-17 | the whole tree typechecks as one unit with a required collaborator at every call site | type + unit | `npm run typecheck` and `node --test` over the six migrated owner tests | ✅ files | ⬜ pending |
| 05.3 | 08-05 | 3 | RCOV-02 | T-08-18 | one cleanup failure is observable from `commitPreparedSkills` with no builtin patched | unit + pair coverage | `node --test tests/bridges/skills/stage.test.ts` and `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/shared/fs-utils.ts` | ✅ file | ⬜ pending |
| 06.1 | 08-06 | 4 | RCOV-02 | T-08-12 | every `rm`/`rename` fault goes through the collaborator; exactly the three non-port verbs stay patched | unit + pair coverage | `node --test tests/shared/fs-utils.test.ts` and a surviving-verb census over that file | ✅ file | ⬜ pending |
| 06.2 | 08-06 | 4 | RCOV-02 | T-08-19 | the interleaved leak array is asserted as a whole ordered value, and the residue partition on both sides, per bridge (G1) | unit + pair coverage | `node --test tests/bridges/skills/stage.test.ts tests/bridges/commands/stage.test.ts tests/bridges/agents/stage.test.ts` plus the three pair readings | ✅ files, ❌ G1 cases | ⬜ pending |
| 06.3 | 08-06 | 4 | RCOV-02 | T-08-18, T-08-20 | each restored proof goes red against a planted production regression and green again after reverting | plant-and-revert | `git status --porcelain -- extensions/` empty, then `npm run check` | ✅ commands | ⬜ pending |
| 07.1 | 08-07 | 4 | RCOV-02 | T-08-19 | the three `commitPrepared*` leak arms surface exact `bridgeWarnings` bytes through the required collaborator | unit | `node --test tests/orchestrators/plugin/install-outcome.test.ts` | ✅ file, ❌ 3 cases | ⬜ pending |
| 07.2 | 08-07 | 4 | RCOV-02 | T-08-22 | owner coverage is added without stripping the sibling's own reading | pair coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` | ✅ file | ⬜ pending |
| 07.3 | 08-07 | 4 | RCOV-02 | T-08-21 | `install-outcome.ts`'s final reading is recorded verbatim, and no pin row is added | pair coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts` | ✅ file, ❌ ~60 lines | ⬜ pending |
| 07.4 | 08-07 | 4 | RCOV-02 | T-08-21 | the disposition of any residual reading is the developer's recorded decision, never a pin row | checkpoint:decision | blocking; reply with one option id | n/a — decision | ⬜ pending |
| 08.1 | 08-08 | 5 | RCOV-01, RCOV-02 | T-08-03, T-08-04 | the regenerated pin equals the second sweep's refusal set in both directions, and the strict arm exits 0 | manual measurement + CLI | `npm run test:coverage:direct:report` then `node scripts/test-coverage-direct.mjs --all --report coverage/all-pairs.jsonl` | ✅ commands | ⬜ pending |
| 08.2 | 08-08 | 5 | RCOV-01, RCOV-02 | T-08-24, T-08-06 | the rewritten clauses and all three signature carriers agree | planning-contract gate | `node scripts/revalidation.mjs scope-impact --check` and `node --test tests/architecture/revalidation.test.ts` | ✅ commands | ⬜ pending |
| 08.3 | 08-08 | 5 | RCOV-01, RCOV-02 | T-08-23 | the roadmap and `CONTRIBUTING.md` list exactly the pinned rows and restate no count | doc assertion | a `node -e` comparison of `CONTRIBUTING.md`'s rows against the loaded pin | ✅ file | ⬜ pending |
| 09.1 | 08-09 | 6 | RCOV-03 | T-08-26, T-08-27 | the scoped local hook runs the same gate with a commit-scoped base and is green | smoke | `pre-commit run npm-coverage-direct --all-files` then `pre-commit run --all-files` | ❌ — new hook | ⬜ pending |
| 09.2 | 08-09 | 6 | RCOV-03 | T-08-04, T-08-25 | the CI job resolves `origin/main` at full depth, asserts the printed base, and cannot mask the gate's exit status | CI assertion | an extracted-job structural check plus `grep -qx 'Changed-pair base: origin/main'` against a local run | ❌ — new CI job | ⬜ pending |
| 09.3 | 08-09 | 6 | RCOV-01, RCOV-02, RCOV-03 | — | the whole gate chain is green with both wirings in place | full suite | `npm run check` and `pre-commit run --all-files` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/test-coverage-direct.report.mjs:112` — repair the `map(pairForPath)` arity bug
      (`D-08-A01`; blocks RCOV-01 entirely — the reporter has never run to completion)
- [ ] `scripts/test-coverage-direct.negative.mjs` — a case planting the reporter's pair
      enumeration, so the repair carries its own control (`D-08-A09`)
- [ ] `.pre-commit-config.yaml` — widen the `fix-unicode-dashes` exclusion (`D-08-20`), so
      `--all-files` is green **before** a new hook is added to it
- [ ] The enumeration report run, **in the repository**, to completion (`D-08-A10`) — the
      input to every classification decision downstream

*No framework install is needed; `node:test` is built in.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The committed pin equals a fresh measurement of the final tree | RCOV-01 | The sweep takes ≈8 min and is not in `npm run check` by design | Run `npm run test:coverage:direct:report` in the repository after all code work lands; regenerate the pin from that run and diff it against the committed file |
| The pre-commit hook's real cost on a working branch | RCOV-03 | Depends on branch length and staged content | Stage a one-pair change and time the hook; record the measured figure in `CONTRIBUTING.md` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s at task level
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
