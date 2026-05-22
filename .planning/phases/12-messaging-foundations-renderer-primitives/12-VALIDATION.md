---
phase: 12
slug: messaging-foundations-renderer-primitives
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 12 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in) + `tsx`/native TS strip per package.json |
| **Config file** | `package.json` `scripts.test` / `scripts.check` (no separate config) |
| **Quick run command** | `npm test -- --test-name-pattern "<area>"` (per file or per area) |
| **Full suite command** | `npm run check` (typecheck + ESLint + Prettier + tests) |
| **Estimated runtime** | ~30-60 seconds for `npm run check`; <5s per targeted test file |

---

## Sampling Rate

- **After every task commit:** Run the targeted test file (e.g., `npm test tests/architecture/grammar-frontmatter.test.ts`)
- **After every plan wave:** Run `npm run check`
- **Before `/gsd:verify-work`:** `npm run check` must be green (NFR-6 gate)
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Plans are not yet authored; this section is a requirement-to-test map that the planner MUST honor when populating each task's `<acceptance_criteria>` and `<automated>` blocks. The planner will fill in concrete `Task ID` / `Plan` / `Wave` columns; the rows here pre-allocate the verification spine.

| Requirement | Threat Ref | Expected Behavior | Test Type | Automated Command | Test File (new or existing) | Status |
|-------------|------------|-------------------|-----------|-------------------|------------------------------|--------|
| **CMC-08** | -- | `STATUS_TOKENS` array (`as const`) equals frontmatter `status_tokens:` set in `docs/messaging-style-guide.md` (frontmatter is binding -- 14 tokens; `reinstalled` is internal, not in this set) | unit (drift) | `npm test tests/architecture/grammar-frontmatter.test.ts` | `tests/architecture/grammar-frontmatter.test.ts` (NEW per D-CMC-04) | ⬜ pending |
| **CMC-11** | -- | `REASONS` array (`as const`) equals frontmatter `reasons:` set (frontmatter is binding -- reconcile 23 vs 24 per research finding; planner MUST document the resolved count and align CONTEXT/REQUIREMENTS/ROADMAP) | unit (drift) | `npm test tests/architecture/grammar-frontmatter.test.ts` | same file as CMC-08 (set-equality assertion per set) | ⬜ pending |
| **CMC-14 (composer)** | -- | `reloadHint([])` === `""`; `reloadHint(["any"])` === `"/reload to pick up changes"`; `ReloadVerb` type no longer exported | unit (behavior) | `npm test tests/presentation/reload-hint.test.ts` | `tests/presentation/reload-hint.test.ts` (REWRITE per D-CMC-09) | ⬜ pending |
| **CMC-14 (verb selector gone)** | -- | `grep -E "\b(load\|refresh\|drop)\b.*(verb\|ReloadVerb)" extensions/pi-claude-marketplace/presentation/reload-hint.ts` returns no match; `ReloadVerb` export removed from `presentation/index.ts` | source assertion | `! grep -E "\\b(load\\\|refresh\\\|drop)\\b" extensions/pi-claude-marketplace/presentation/reload-hint.ts \|\| true; ! grep "ReloadVerb" extensions/pi-claude-marketplace/presentation/index.ts` | n/a (CLI audit) | ⬜ pending |
| **CMC-14 (callsite migration)** | -- | All 8 (NOT 6 -- research finding) `reloadHint(...)` callsites compile under the new signature `(names: readonly string[]) => string`; `npm run typecheck` green | unit + typecheck | `npm run typecheck` AND `npm test tests/presentation/reload-hint.test.ts` | callsites: `orchestrators/plugin/install.ts:690`, `orchestrators/plugin/uninstall.ts:237`, `orchestrators/plugin/update.ts:731`, `orchestrators/plugin/reinstall.ts:372`, `orchestrators/plugin/reinstall.ts:871`, `orchestrators/marketplace/update.ts:358`, `orchestrators/marketplace/remove.ts:278`, `orchestrators/import/execute.ts:339-341` | ⬜ pending |
| **CMC-19** | -- | `shared/notify.ts` exports `notifySuccess`, `notifyWarning`, `notifyError`, `notifyUsageError` with unchanged signatures; docs comment names the four wrappers and links style guide §10 MSG-SR-1..7 | source assertion | `npm run typecheck` AND `grep -c "export function notify\\(Success\\|Warning\\|Error\\|UsageError\\)" extensions/pi-claude-marketplace/shared/notify.ts` returns 4 | `tests/shared/notify.test.ts` (if exists -- verify untouched green) | ⬜ pending |
| **CMC-36** | -- | `persistence/migrate.ts:178` `console.warn` body is byte-exact: `Legacy marketplace migration could not be persisted to ${path}; the in-memory normalized state is being used and the on-disk state.json is unchanged. Cause: ${errMsg}.` (terminal period, no `MANUAL RECOVERY REQUIRED:` prefix, no compact-grammar tokens) | source + behavior assertion | `grep -F "Legacy marketplace migration could not be persisted to" extensions/pi-claude-marketplace/persistence/migrate.ts` returns match; new/updated unit test asserts emitted string under simulated EIO write failure | `tests/persistence/migrate.test.ts` (REWRITE or ADD case) | ⬜ pending |
| **CMC-37** | -- | Line directly above the `console.warn(...)` at `persistence/migrate.ts:178` is `// eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail` (verbatim); `eslint.config.js` is unchanged | source assertion | `npm run lint` AND `awk '/console\\.warn/{print prev} {prev=$0}' extensions/pi-claude-marketplace/persistence/migrate.ts \| grep -F "IL-3: load-time migrate save fail"`; `git diff --name-only origin/main..HEAD -- eslint.config.js` returns empty | n/a (CLI audit + ESLint) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Non-Regression Verifications (Phase 12 MUST NOT break these)

| Asset | Why Phase 12 must not regress it | Verification |
|-------|----------------------------------|--------------|
| `tests/architecture/markers-snapshot.test.ts` | D-CMC-08 retains `RELOAD_HINT_PREFIX` in `shared/markers.ts` as snapshot-test-only export; Phase 13's atomic three-file edit deletes it, NOT Phase 12. Deletion here regresses the snapshot test and violates NFR-6. | `npm test tests/architecture/markers-snapshot.test.ts` is green after every task; `grep "RELOAD_HINT_PREFIX" extensions/pi-claude-marketplace/shared/markers.ts` still returns the export |
| `eslint.config.js` `no-restricted-syntax` + `no-console` rules | CMC-37 forbids config-file rule widening; only the existing inline disable persists | `git diff --name-only origin/main..HEAD -- eslint.config.js` empty; `npm run lint` green |
| `tests/architecture/import-boundaries.test.ts` | D-11 layering boundary unchanged; new `shared/grammar/` sits below `presentation/` and `persistence/` (importable from anywhere without violation) | `npm test tests/architecture/import-boundaries.test.ts` green |
| Existing `shared/notify.ts` callsite discipline (D-07) | No new `ctx.ui.notify` direct callsite introduced (composers live in `presentation/`, return strings) | `npm test tests/architecture/` (if architectural test asserts the discipline); `grep -R "ctx.ui.notify" extensions/pi-claude-marketplace/ --include="*.ts"` returns only `shared/notify.ts` lines |

---

## Wave 0 Requirements

- [ ] `tests/architecture/grammar-frontmatter.test.ts` -- NEW drift test (D-CMC-04) covering CMC-08 + CMC-11 set-equality vs `docs/messaging-style-guide.md` frontmatter
- [ ] `tests/presentation/reload-hint.test.ts` -- REWRITE per D-CMC-09: drop 3-verb assertions, add empty/single/multi-name assertions for the new constant trailer
- [ ] `tests/persistence/migrate.test.ts` -- ADD or REWRITE the `console.warn` wording assertion case (CMC-36); existing test file likely covers other migrate paths and should stay green
- [ ] `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts` -- NEW (D-CMC-02)
- [ ] `extensions/pi-claude-marketplace/shared/grammar/reasons.ts` -- NEW (D-CMC-02)
- [ ] Frontmatter parser -- hand-rolled regex helper per research recommendation (precedent at `tests/helpers/prd-extract.ts`); no new npm dep required

*All other Phase 12 test infrastructure already exists in the repo.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `docs/messaging-style-guide.md` §14.1 update lands in the SAME PR as the `persistence/migrate.ts:178` byte change | D-CMC-15 (atomic alignment) | Cross-file atomicity is a PR-shape contract, not a unit test invariant; reviewer attests | At PR review: confirm both files appear in the diff; confirm §14.1 no longer says "Phase 13 PROPOSES the new wording" or "Phase 13's planner has FINAL discretion" |
| Reload-hint trailer user-visible carve-out (D-CMC-10) is documented in PLAN.md / CHANGELOG.md | D-CMC-10 | Roadmap criterion #4 ("output unchanged except migrate.ts") is structurally relaxed by criterion #2 ("verb selector gone") -- humans need the carve-out noted so reviewers don't reject the diff | At PR review: confirm PLAN.md and/or CHANGELOG.md call out that 8 reload-hint callsite trailers now emit `/reload to pick up changes` in Phase 12 (Phase 13 still owns the other user-visible surface migrations) |
| REQUIREMENTS.md CMC-08 reconciliation lands (drop the "+ reinstalled" clause OR add reinstalled -- researcher recommends DROP, evidenced by `orchestrators/types.ts:12` + `reinstall.ts:184,403,685`) | CMC-08 doc inconsistency | Cross-doc edit decision needs human ratification before commit | Planner MUST land the chosen reconciliation in the same phase; reviewer confirms REQUIREMENTS.md text matches the constants module membership |
| REASONS count reconciliation (CONTEXT/REQUIREMENTS/ROADMAP all say 24; frontmatter has 23 per research finding) | CMC-11 doc inconsistency | Same as above -- human ratification on the binding count | Planner MUST land the resolved count in REQUIREMENTS/ROADMAP/CONTEXT cross-references; the drift test enforces frontmatter binding |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (planner gate)
- [ ] Wave 0 covers all MISSING references (`grammar-frontmatter.test.ts`, `reload-hint.test.ts` rewrite, `migrate.test.ts` wording case)
- [ ] No watch-mode flags in any task command
- [ ] Feedback latency < 60s per `npm run check`
- [ ] `nyquist_compliant: true` set in frontmatter (flip after planner populates the per-task verify map columns)

**Approval:** pending
