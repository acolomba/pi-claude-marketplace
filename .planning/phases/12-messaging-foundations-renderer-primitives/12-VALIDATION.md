---
phase: 12
slug: messaging-foundations-renderer-primitives
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-22
audited: 2026-05-24
---

# Phase 12 -- Validation Strategy

> Per-phase validation contract; post-execution Nyquist audit reconciled against HEAD on 2026-05-24.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in) + native TS strip per `package.json` (Node >=22.18) |
| **Config file** | `package.json` `scripts.test` / `scripts.check` (no separate config) |
| **Quick run command** | `node --test tests/<layer>/<file>.test.ts` (per file) or `npm test -- --test-name-pattern "<area>"` |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | ~25-60 seconds for `npm run check`; <2s per targeted test file |
| **Current baseline** | 1249/1249 tests pass at HEAD (audited 2026-05-24) |

---

## Sampling Rate

- **After every task commit:** Run the targeted test file (e.g., `node --test tests/architecture/grammar-frontmatter.test.ts`)
- **After every plan wave:** Run `npm run check`
- **Before `/gsd:verify-work`:** `npm run check` must be green (NFR-6 gate)
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Audited against HEAD on 2026-05-24. Every row resolves to ✅ green via a behavioral or source-byte test that runs as part of `npm run check`.

| Requirement | Threat Ref | Expected Behavior | Test Type | Automated Command | Test File | Status |
|-------------|------------|-------------------|-----------|-------------------|-----------|--------|
| **CMC-08** | T-12.01-01 | `STATUS_TOKENS` (`as const`) is set-equal to the binding frontmatter `status_tokens:` block in `docs/messaging-style-guide.md`. Closed-set membership is frontmatter-bound; the drift test asserts set-equality (Phase 13 D-13-20 extended the set to 15 entries by adding `"reinstalled"` -- the mirrored frontmatter edit keeps the drift test green; the Phase 12 "14 entries" plan number is superseded by the live frontmatter). | unit (drift) | `node --test tests/architecture/grammar-frontmatter.test.ts` | `tests/architecture/grammar-frontmatter.test.ts` | ✅ green |
| **CMC-11** | T-12.01-01 | `REASONS` (`as const`) is set-equal to the binding frontmatter `reasons:` block. Phase 12 locked the closed set at 23 entries; Phase 13 sub-waves 2c/3 added 5 more (`already enabled`, `already disabled`, `permission denied`, `source missing`, `network unreachable`) with lockstep frontmatter updates. Current count: 28. Drift test still asserts equality. | unit (drift) | `node --test tests/architecture/grammar-frontmatter.test.ts` | same file as CMC-08 (one assertion per closed set) | ✅ green |
| **CMC-14 (composer)** | T-12.02-01 | `reloadHint([])` === `""`; `reloadHint(["any"])` === `"/reload to pick up changes"`; `reloadHint(["a","b","c"])` returns the same trailer (names not interpolated). `appendReloadHint` joins body + hint with the `\n\n` blank-line separator (Phase 13 MSG-RH-1 conformance landed; Phase 12 had `\n`, now `\n\n` -- forward progress, captured by the test assertion). | unit (behavior) | `node --test tests/presentation/reload-hint.test.ts` | `tests/presentation/reload-hint.test.ts` | ✅ green |
| **CMC-14 (verb selector gone)** | T-12.02-02 | `ReloadVerb` is fully purged from `extensions/`; `presentation/reload-hint.ts` does not import `RELOAD_HINT_PREFIX`; the legacy `"Run /reload to "` marker is absent from non-allow-listed sources (locked by `no-legacy-markers` test + MSG-RH-1 lint rule). | source assertion + architectural test | `node --test tests/architecture/no-legacy-markers.test.ts && node --test tests/lint-rules/msg-rh-1-reload-hint.test.js` | `tests/architecture/no-legacy-markers.test.ts` (CMC-35/D-13-12 byte-grep gate) + `tests/lint-rules/msg-rh-1-reload-hint.test.js` (AST gate) | ✅ green |
| **CMC-14 (callsite migration)** | T-12.02-03 | All current `reloadHint(...)` callsites (11 at HEAD; Phase 13 added 3 to the original 8) compile under the 1-arg signature `(names: readonly string[]) => string`. Typecheck is the binding gate; the rewritten test file uses the new signature so any signature regression breaks both the test and typecheck. | unit + typecheck | `npm run typecheck && node --test tests/presentation/reload-hint.test.ts` | `tests/presentation/reload-hint.test.ts` + `npm run typecheck` over `orchestrators/**` | ✅ green |
| **CMC-19** | T-12.04-01 | `shared/notify.ts` exports `notifySuccess`, `notifyWarning`, `notifyError`, `notifyUsageError` with the documented signatures. Behavior tests cover severity routing, cause-chain composition (D-CMC-12 / Phase 13 MSG-CC-1 conformance landed), and NFR-9 stack/path non-disclosure. `notifyUsageError` is integration-tested via edge handlers + MSG-SR-7 lint rule. Header docs comment names the 4 wrappers and links to style guide §10 MSG-SR-1..7. | unit (behavior) + integration | `node --test tests/shared/notify.test.ts && node --test tests/lint-rules/msg-sr-7-usage-error-routing.test.js` | `tests/shared/notify.test.ts` (7 wrapper behavior tests) + `tests/edge/**` (notifyUsageError integration) | ✅ green |
| **CMC-36** | T-12.03-01 | `persistence/migrate.ts` `console.warn` body is byte-exact: `` `Legacy marketplace migration could not be persisted to ${stateJsonPath}; the in-memory normalized state is being used and the on-disk state.json is unchanged. Cause: ${errMsg}.` ``. Legacy wording `"failed to persist migrated state to"` is fully removed. Asserted via source-byte read and runtime mock-capture under simulated EIO. | source-byte + runtime mock | `node --test tests/persistence/migrate.test.ts` | `tests/persistence/migrate.test.ts` (CMC-36 source-byte test + IL-3 runtime capture) | ✅ green |
| **CMC-37** | T-12.03-02, T-12.03-04 | The line directly above the `console.warn(...)` in `persistence/migrate.ts` is byte-exact `// eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail`; exactly one `console.warn(` callsite exists in the file; `eslint.config.js` IL-3 rule shape is unchanged (no config widening). | source-byte regex + count + lint | `node --test tests/persistence/migrate.test.ts && npm run lint` | `tests/persistence/migrate.test.ts` (CMC-37 IL-3 comment regex + single-callsite count) + `eslint.config.js` review | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · MISSING (no test)*

---

## Non-Regression Verifications (Phase 12 baseline; Phase 13+ deletion expected)

| Asset | Why Phase 12 must not regress it | Verification | Status |
|-------|----------------------------------|--------------|--------|
| `tests/architecture/markers-snapshot.test.ts` | D-CMC-08 retained `RELOAD_HINT_PREFIX` in `shared/markers.ts` as a snapshot-test-only export through Phase 12. Phase 13's atomic three-file edit may delete it; until then, the snapshot must stay green. | `node --test tests/architecture/markers-snapshot.test.ts` | ✅ green |
| `eslint.config.js` `no-restricted-syntax` + `no-console` rules (IL-3) | CMC-37 forbids config-file rule widening; only the existing inline disable persists. | `npm run lint` over the file tree; grep confirms the IL-3 BLOCK A rule shape is intact | ✅ green |
| `tests/architecture/import-boundaries.test.ts` | D-11 layering boundary unchanged; new `shared/grammar/` sits below `presentation/` and `persistence/` (importable from anywhere without violation). | `node --test tests/architecture/import-boundaries.test.ts` | ✅ green |
| `tests/architecture/no-legacy-markers.test.ts` (CMC-35 byte-grep gate) | Locks the absence of the legacy ES-5 marker strings (`"Run /reload to "`, etc.) outside the allow-list -- backstop for CMC-14 (verb selector gone). | `node --test tests/architecture/no-legacy-markers.test.ts` | ✅ green |
| Existing `shared/notify.ts` callsite discipline (D-07) | No new direct `ctx.ui.notify` callsite introduced outside `shared/notify.ts`. | `grep -R "ctx.ui.notify" extensions/pi-claude-marketplace/ --include="*.ts"` returns only the 4 lines inside `shared/notify.ts` | ✅ green |

---

## Wave 0 Requirements

- [x] `tests/architecture/grammar-frontmatter.test.ts` -- drift test (D-CMC-04) covering set-equality for STATUS_TOKENS + REASONS + (Phase 14 extended) MARKERS + PATTERN_CLASSES against `docs/messaging-style-guide.md` frontmatter
- [x] `tests/presentation/reload-hint.test.ts` -- rewritten per D-CMC-09: 5 assertions (empty / single / multi for `reloadHint`; suppression + blank-line join for `appendReloadHint`)
- [x] `tests/persistence/migrate.test.ts` -- runtime-capture assertions aligned with the new §14.1 wording + 3 source-byte tests (CMC-36 wording, CMC-37 IL-3 comment regex, CMC-37 single-callsite count)
- [x] `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts` -- 15-entry `as const` + derived `StatusToken` union (Phase 12 landed 14; Phase 13 D-13-20 added `"reinstalled"` with mirrored frontmatter edit)
- [x] `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` -- 28-entry `as const` + derived `Reason` union (Phase 12 landed 23; Phase 13 added 5 entries with mirrored frontmatter edits)
- [x] Frontmatter parser -- superseded by Phase 14's shared loader at `tests/lint-rules/lib/frontmatter.js` (`parseStyleGuideFrontmatter`, uses `yaml.parse()`); Phase 12's hand-rolled extractor was retired during the Phase 14 D-14-10 consolidation; the negative-path tests carry forward as loader-level assertions in `grammar-frontmatter.test.ts`

*All other Phase 12 test infrastructure is present in the repo. Wave 0 is COMPLETE; the file inventory matches reality at HEAD and all behavioral tests pass.*

---

## Forward-Progress Notes (Phase 13+ landed on the Phase 12 baseline)

These are not gaps; they are intentional extensions of the Phase 12 contract that landed in subsequent phases. The Phase 12 plans correctly deferred them; they are captured here so an auditor reading this file against HEAD does not flag them as drift.

| Topic | Phase 12 state | Current (HEAD) state | Reason | Drift impact |
|-------|----------------|----------------------|--------|--------------|
| `STATUS_TOKENS` count | 14 entries | 15 entries (added `"reinstalled"`) | D-13-20 LOCKED: the reinstall catalog at `docs/output-catalog.md` emits `(reinstalled)` on cascade rows; extending the closed set preserves observability of which rows the reinstall partition processed. Mirrored in the binding frontmatter in the same commit. | None -- drift test still green; the frontmatter is the binding contract. |
| `REASONS` count | 23 entries | 28 entries (added `already enabled`, `already disabled`, `permission denied`, `source missing`, `network unreachable`) | Phase 13 sub-wave 2c + Wave 3 catalog UAT additions per CMC-33 / catalog binding at `docs/output-catalog.md`. Mirrored in the binding frontmatter. | None -- drift test still green. |
| `appendReloadHint` join | `\n` (single newline) | `\n\n` (blank-line discipline) | Phase 13 MSG-RH-1 conformance pass landed the blank-line-above join per the style guide §5 contract. Phase 12 deferred this as a TODO. | None -- the reload-hint test asserts the current behavior; orchestrator integration fixtures aligned in the same commit. |
| `notifyError` body | Pass-through with `\nCause: ${msg}` placeholder | `${message}\n\n${causeChainTrailer(cause)}` (depth-5 MSG-CC-1 walker) | D-CMC-12 deferred the MSG-CC-1 cause-chain rewrite to Phase 13. Landed; trailer surfaces only `Error.message` per NFR-9. | None -- notify.test.ts asserts both empty-cause and cause-chain paths. |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| `docs/messaging-style-guide.md` §14.1 update lands in the SAME PR as the `persistence/migrate.ts:178` byte change | D-CMC-15 (atomic alignment) | Cross-file atomicity is a PR-shape contract, not a unit test invariant. | Verified at Plan 12-03 commit `f380835`: both files appear in the diff; §14.1 says "Phase 12 LANDED" (no "PROPOSES" / "discretion" framing). | ✅ verified |
| Reload-hint trailer user-visible carve-out (D-CMC-10) is documented in PLAN.md / CHANGELOG.md | D-CMC-10 | Roadmap criterion #4 ("output unchanged except migrate.ts") is structurally relaxed by criterion #2 ("verb selector gone"); the carve-out must be cited so reviewers don't reject the diff. | Verified: `grep -F "D-CMC-10" CHANGELOG.md` returns the Phase-12 Unreleased entry containing "8 reload-hint callsite trailers now emit /reload to pick up changes" and "roadmap criterion #2 authorizes". | ✅ verified |
| REQUIREMENTS.md CMC-08 reconciliation lands (drop the "+ reinstalled" clause) | CMC-08 doc inconsistency | Phase 12 dropped the clause to align the closed set with the frontmatter; Phase 13's D-13-20 re-added `"reinstalled"` to the set with a mirrored frontmatter edit. REQUIREMENTS.md still says "14 frontmatter entries" with a Phase 13 cross-reference. | Verified at Plan 12-01 commit `12bb10e`; REQUIREMENTS.md CMC-08 no longer has the spurious "+ reinstalled" clause. The Phase 13 expansion is captured in the D-13-20 lock and the binding frontmatter. | ✅ verified |
| REASONS count reconciliation (Phase 12: 23, Phase 13: 28) | CMC-11 doc inconsistency | Same human-ratification pattern: the frontmatter is the binding count, expanded in lockstep with the closed-set module across Phase 13. | Verified: REQUIREMENTS.md / ROADMAP / CONTEXT all say "23 reasons" (the Phase 12 binding count); the Phase 13 additions are captured in the binding frontmatter and the constants module header. Drift test enforces consistency. | ✅ verified |

---

## Audit Findings (2026-05-24)

**Audit method:** Each row in the per-task map was checked against HEAD: (a) the cited test file was read to confirm it asserts the requirement; (b) the test was run in isolation via `node --test <file>` to confirm it passes; (c) the implementation file was inspected to confirm the behavior under test matches the requirement.

**Result:** All 8 per-task rows resolved to ✅ green via behavioral or source-byte tests that run as part of `npm run check`. No new tests had to be generated -- the Phase 12 plans' executors and the Phase 13/14 follow-ons combined cover every requirement with a test that can fail.

**Wave 0:** All three test files and both constants modules exist. The two extra `shared/grammar/` modules (`markers.ts`, `pattern-classes.ts`) are Phase 14 additions that fall outside the Phase 12 scope but the grammar-frontmatter test now covers all four closed sets (extended per D-14-10b).

**Forward-progress drift (not gaps):** STATUS_TOKENS grew from 14 to 15 (added `"reinstalled"` per D-13-20); REASONS grew from 23 to 28 (Phase 13 catalog additions); `appendReloadHint` joins with `\n\n` (Phase 13 MSG-RH-1 conformance); `notifyError` body composes the depth-5 MSG-CC-1 trailer (D-CMC-12 Phase 13). Each change landed with a mirrored binding-contract update (frontmatter / style guide / catalog) so the drift tests stay green.

**Security:** 12-SECURITY.md status=passed, threats_open=0; 12-VERIFICATION.md status=passed (7/7 truths, all 6 requirements satisfied).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: every plan task has at least one automated verify (no 3-task dry run)
- [x] Wave 0 covers all dependencies (`grammar-frontmatter.test.ts`, `reload-hint.test.ts` rewrite, `migrate.test.ts` wording case) -- all present at HEAD
- [x] No watch-mode flags in any task command
- [x] Feedback latency < 60s per `npm run check` (~25s observed at HEAD)
- [x] `nyquist_compliant: true` set in frontmatter -- every gap row resolves to a behavioral or source-byte test that runs in `npm run check`

**Approval:** validated (2026-05-24)
