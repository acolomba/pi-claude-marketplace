---
phase: 21
slug: final-teardown-green-gate
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-05-27
---

# Phase 21 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `21-RESEARCH.md` §"Validation Architecture" (lines 483-523).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node --test` (built-in) with `tsx` loader for `.ts` |
| **Config file** | None -- CLI flags wired in `package.json` `scripts` (lines 70-82) |
| **Quick run command** | `npm test` (test layer only, ~1188 tests post-Phase-21) |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) per NFR-6 / CLAUDE.md |
| **Estimated runtime** | Tests ~30-60 s; full `check` ~60-120 s |

---

## Sampling Rate

- **After every atomic commit** (Plan 21-01 + Plan 21-02): `npm run check` MUST be GREEN before the commit lands. Plans 21-01 and 21-02 are single-commit-atomic per D-21-08 -- intermediate states are non-compiling and not committed.
- **After Plan 21-03's final gate:** `npm run check` GREEN, plus manual SUMMARY.md test-count accounting against the 1367 → ~1188 expected delta.
- **Pre-commit hooks** (per CLAUDE.md): `pre-commit run --files <changed>` BEFORE `git commit`. NEVER `--no-verify`.
- **Max feedback latency:** ~2 minutes (full `npm run check`).

---

## Per-Task Verification Map

Phase 21 plans are **directory-scale deletions + cross-file consolidations**, not per-REQ feature additions. The verification map is regression-oriented (catch what each plan could BREAK) rather than acceptance-oriented (assert what each plan ADDS).

| Plan | Wave | Requirements | Regression risk | Catcher | Automated Command | Status |
|------|------|--------------|-----------------|---------|-------------------|--------|
| 21-01 | 1 | SNM-24, SNM-25, SNM-27, SNM-28 | MSG-* lint plugin orphans (delete refs but leave wirings) | ESLint config-loader | `npm run lint` | ⬜ pending |
| 21-01 | 1 | SNM-27 | BLOCK A `no-restricted-syntax` selector regression after message-string update | ESLint | `npm run lint` | ⬜ pending |
| 21-01 | 1 | SNM-27 | `package.json` test glob references stale `tests/lint-rules/**` after dir delete | `npm test` "no files found" | `npm test 2>&1 \| grep -i 'no files'` (must be empty) | ⬜ pending |
| 21-01 | 1 | SNM-24, SNM-25, SNM-28 | Stray deleted dirs/files survive commit | Static post-condition | `! test -d tests/lint-rules && ! test -f tests/architecture/msg-rule-registry.test.ts && ! test -f tests/architecture/no-legacy-markers.test.ts` | ⬜ pending |
| 21-02 | 2 | SNM-22 | V1 wrapper deletion leaves dangling caller in extension code | TypeScript + `node --test` (compile failure) | `npm run typecheck` + `npm test` | ⬜ pending |
| 21-02 | 2 | SNM-22 | `tests/shared/notify.test.ts` not deleted in lockstep with V1 wrappers (CONTEXT miss; RESEARCH §1.5) | `node --test` (compile failure on first test load) | `npm test` | ⬜ pending |
| 21-02 | 2 | SNM-29 | Forgotten consumer migration for `shared/grammar/*` import paths | TypeScript | `npm run typecheck` | ⬜ pending |
| 21-02 | 2 | SNM-29 | `presentation/` clean-sweep leaves `import` to deleted file | TypeScript | `npm run typecheck` | ⬜ pending |
| 21-02 | 2 | SNM-29 | `package.json` test/coverage globs reference deleted `tests/presentation/**` | `npm test` "no files found" | `npm test 2>&1 \| grep -i 'no files'` | ⬜ pending |
| 21-02 | 2 | SNM-22, SNM-29 | Stray `shared/grammar/` or `presentation/` directories survive commit | Static post-condition | `! test -d extensions/pi-claude-marketplace/shared/grammar && ! test -d extensions/pi-claude-marketplace/presentation && ! test -d tests/presentation` | ⬜ pending |
| 21-02 | 2 | SNM-29 | BLOCK C zone violation if `edge/handlers/tools.ts` → `domain/source.ts` not BLOCK-C-amended | ESLint `import-x/no-restricted-paths` | `npm run lint` | ⬜ pending |
| 21-02 | 2 | SNM-29 | `tests/architecture/scope-order-drift.test.ts:158` string reference to `presentation/sort.ts` not updated (CONTEXT miss; RESEARCH §1.5) | `node --test` (string-equality assertion fails) | `npm test -- tests/architecture/scope-order-drift.test.ts` | ⬜ pending |
| 21-02 | 2 | SNM-22, SNM-29 | V2 catalog byte-equality drift from consolidation | `tests/architecture/catalog-uat.test.ts` | `npm test -- tests/architecture/catalog-uat.test.ts` | ⬜ pending |
| 21-02 | 2 | SNM-22, SNM-29 | Compile-time `Reason`/`StatusToken` type holes after inline | `tests/architecture/notify-types.test.ts` | `npm test -- tests/architecture/notify-types.test.ts` | ⬜ pending |
| 21-02 | 2 | SNM-29 | V2 per-variant renderer drift | `tests/shared/notify-v2.test.ts` (41 tests) | `npm test -- tests/shared/notify-v2.test.ts` | ⬜ pending |
| 21-02 | 2 | SNM-22 | Live V1 wrapper caller anywhere in repo | Grep | `! grep -rnE 'notify(Success\|Warning\|Error)\(' extensions/ tests/ \| grep -vE '//\|^\s*\*'` (after `edge/args-schema.ts` `notifyError` → `onError` rename) | ⬜ pending |
| 21-02 | 2 | SNM-22, SNM-29 | Phase 5/7 markers regression (orthogonal -- must NOT break) | `tests/architecture/markers-snapshot.test.ts` | `npm test -- tests/architecture/markers-snapshot.test.ts` | ⬜ pending |
| 21-03 | 3 | SNM-32 | `npm run check` fails any layer (typecheck \| lint \| format \| tests) | Full `check` pipeline | `npm run check` | ⬜ pending |
| 21-03 | 3 | SNM-32 | Test-count regression vs expected ~1188 (1367 baseline - ~179 deletions) | Manual count cross-check | `npm test 2>&1 \| grep -E 'tests \\d+'` vs `21-SUMMARY.md` arithmetic | ⬜ pending |
| 21-03 | 3 | SNM-22, 24, 25, 27, 28, 29, 32 | CHANGELOG / STATE.md / PROJECT.md / REQUIREMENTS.md not updated to record closure | Manual review | Read closed files for v1.4 entry + Phase 21 closure marks | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

**None** -- existing test infrastructure covers every Phase 21 regression risk:

- `node --test` framework already wired
- `tsx` loader already configured (per `package.json`)
- The architecture-test trio (`catalog-uat`, `notify-types`, `markers-snapshot`) and per-variant renderer suite (`notify-v2.test.ts`) already cover the V2 surface
- `npm run check` pipeline (typecheck + ESLint + Prettier + tests) is the GREEN gate

No new test files are required by Phase 21. The planner has discretion (per CONTEXT.md "Claude's Discretion") on adding a small `compareByNameThenScope` block in `tests/shared/notify-v2.test.ts` if the comparator's orchestrator-test coverage is judged thin.

`wave_0_complete: true` reflects this.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| BLOCK A `no-restricted-syntax` message strings reference `notify` / `notifyUsageError` (V2-only) and not the deleted V1 wrapper names | SNM-22, SNM-27 | The message text is a string in `eslint.config.js`; no test asserts its content. A stale string is functionally harmless but contradicts SC #3. | After Plan 21-01: read BLOCK A's `messageId` / `message` fields and confirm V2-only phrasing. |
| Plan 21-02 atomic-commit file count ≤ ~200 (CONTEXT D-21-02 "Claude's Discretion" guidance) | SNM-22, SNM-29 | The reviewability heuristic is human judgment; no automated check enforces "≤200 files". | Run `git show --stat <plan-21-02-commit>` and confirm file count. If genuinely > 200, justify why a sub-plan split was not taken. |
| Plan 21-03 CHANGELOG entry matches the v1.0..v1.3 format precedent | SNM-32 | Format consistency is style judgment; no test enforces it. | Read `CHANGELOG.md` v1.0..v1.3 entries and confirm the v1.4 entry mirrors them (heading shape, SNM-ID list, one-line annotations). |
| `package.json` test/coverage globs (lines 76 + 80) updated alongside dir deletions | SNM-24, SNM-29 | Drift catches via "no files found" warning only if the glob is matched zero times; otherwise silently passes. | After Plan 21-01: grep `package.json` for `tests/lint-rules`. After Plan 21-02: grep for `presentation`. Both must be absent. |
| Plan 21-02 BLOCK C decision (CONTEXT-deferred) -- pick one of three RESEARCH §3 strategies and execute consistently | SNM-29 | The decision (extend `domain/` zone, narrow `presentation/` exemption, or amend allowed-from list) is a planning decision; no test asserts which path was taken. | Plan 21-02 author must record the chosen BLOCK C strategy in the plan's `<must_haves>` or `<truths>` and verify post-commit that `npm run lint` is GREEN with the chosen strategy. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or "no Wave 0 dependencies" (every regression risk maps to a `npm run check` sub-command or static post-condition grep)
- [x] Sampling continuity: every Plan 21-01 / 21-02 atomic commit gates on `npm run check`; no 3 consecutive untested plan slices
- [x] Wave 0 covers all MISSING references (none -- infrastructure complete)
- [x] No watch-mode flags (full-suite runs only -- atomic commits demand the post-edit state, not incremental)
- [x] Feedback latency < ~2 min (full `npm run check`)
- [ ] `nyquist_compliant: true` -- set to `true` after the planner confirms every plan's `<automated>` block references commands listed in the regression matrix above.

**Approval:** pending -- planner sets `nyquist_compliant: true` after PLAN.md authorship verifies each plan's verification stanzas reference the matrix above.
