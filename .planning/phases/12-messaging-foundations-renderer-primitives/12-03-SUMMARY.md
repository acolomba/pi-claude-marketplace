---
phase: 12-messaging-foundations-renderer-primitives
plan: 03
subsystem: messaging
tags: [il-3, console-warn, migrate, style-guide, cmc-36, cmc-37, d-cmc-14, d-cmc-15, d-cmc-16, source-byte-test]

# Dependency graph
requires:
  - phase: 1
    provides: persistence/migrate.ts with the single sanctioned console.warn (IL-3) callsite at line 178
  - phase: 12-01
    provides: docs/messaging-style-guide.md frontmatter as binding contract (51 bullets across status_tokens / reasons / markers / pattern_classes)
provides:
  - byte-exact §14.1 wording landed at persistence/migrate.ts:178 (CMC-36)
  - IL-3 inline eslint-disable-next-line comment preserved verbatim above the warn (CMC-37 / D-CMC-16)
  - docs/messaging-style-guide.md §14 + §14.1 reframed from "Phase 13 PROPOSES / discretion" to past-tense "Phase 12 landed"
  - three new source-byte tests in tests/persistence/migrate.test.ts that lock the wording, the IL-3 comment, and the single-callsite count as source-level invariants
affects: [phase-13, phase-14, IL-3-drift-guard, messaging-grammar-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-byte invariant tests: readFile(MIGRATE_PATH) + assert.ok(src.includes(expected)) / assert.match(src, regex) — lock user-contract wording and inline-disable comments as source-level invariants. Pattern reusable for any sanctioned out-of-channel emission."
    - "Atomic doc-code edit: when a wording is locked as binding contract in a style guide, the byte change and the doc reframing land in the same commit so no transient publication window exists where the doc says 'proposed' while the bytes already shipped (D-CMC-15)."

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/persistence/migrate.ts
    - docs/messaging-style-guide.md
    - tests/persistence/migrate.test.ts

key-decisions:
  - "Co-located the three new CMC-36/CMC-37 source-byte tests inside tests/persistence/migrate.test.ts (rather than splitting into tests/persistence/migrate-warn-wording.test.ts) so the full IL-3 contract — runtime mock-capture + wording + comment preservation + single-callsite count — is reviewable in one file. Planner discretion per Task 1; co-location wins on review cohesion."
  - "SKIP=mdformat,markdownlint-cli2 was used at commit time for docs/messaging-style-guide.md because the configured mdformat plugin set (mdformat-gfm + mdformat-gfm-alerts) does not include mdformat-frontmatter and so strips the YAML frontmatter on auto-format. The plan's acceptance criteria explicitly require the frontmatter to stay untouched (51 bullets) because Plan 12-01's drift contract reads it as binding. This mirrors the de-facto pattern of the seed commit (62d141d). Fixing the pre-commit config to add mdformat-frontmatter is a follow-up out of scope for Plan 12-03."

patterns-established:
  - "IL-3 source-byte invariant: any rewording of the single sanctioned console.warn must be locked at the source level (not just the runtime emission) by a readFile-based test that asserts the byte-exact template literal is present AND the legacy form is absent."
  - "IL-3 inline-disable preservation regex: /\\\\\\/\\\\\\/ eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail\\\\n\\\\s*console\\\\.warn\\\\(/ — asserts the eslint comment is byte-identical AND directly above the warn. Catches both reorder-of-rule-names and detachment of the comment from the warn line."
  - "Single-callsite count guard: /console\\\\.warn\\\\(/g over persistence/migrate.ts MUST return exactly 1 match. Locks IL-3 single-callsite at the source level independent of the eslint rule (defense in depth)."

requirements-completed: [CMC-36, CMC-37]

# Metrics
duration: ~14 min
completed: 2026-05-22
---

# Phase 12 Plan 03: IL-3 console.warn wording landing + atomic style-guide reframing

**Landed the byte-exact §14.1 wording at `persistence/migrate.ts:178` with the IL-3 inline-disable comment preserved verbatim, and atomically reframed `docs/messaging-style-guide.md` §14 + §14.1 from "Phase 13 PROPOSES / discretion" to past-tense "Phase 12 landed" — both edits in the same commit per D-CMC-15.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-22T20:16:00Z
- **Completed:** 2026-05-22T20:30:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- `persistence/migrate.ts:178` console.warn body now contains the byte-exact §14.1 sentence: `Legacy marketplace migration could not be persisted to ${stateJsonPath}; the in-memory normalized state is being used and the on-disk state.json is unchanged. Cause: ${errMsg}.` (CMC-36).
- The IL-3 inline disable comment `// eslint-disable-next-line no-restricted-syntax, no-console -- IL-3: load-time migrate save fail` is byte-identical to the prior file and sits on the line directly above the warn (CMC-37 / D-CMC-16).
- `docs/messaging-style-guide.md` §14 MSG-LC-1 row tail, §14.1 heading, and §14.1 closing paragraph are reframed to past-tense "Phase 12 landed" wording. The frontmatter (status_tokens / reasons / markers / pattern_classes; 51 bullets) is untouched — Plan 12-01's drift contract is unaffected.
- D-CMC-15 atomic-PR satisfied: `extensions/pi-claude-marketplace/persistence/migrate.ts` and `docs/messaging-style-guide.md` land in the same commit (`f380835`).
- Three new source-byte tests lock CMC-36 wording, CMC-37 IL-3 comment preservation, and CMC-37 single-callsite count as source-level invariants — they detect regressions at the test level even if the eslint rule is widened or the inline disable is detached.
- `npm run check` is green: typecheck + ESLint + Prettier + 1035 tests pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Update IL-3 warn capture + add CMC-36/37 source-byte tests** — `512a383` (test) — intentionally RED-first per TDD: the runtime regex and CMC-36 wording assertion failed until Task 2 landed the bytes. CMC-37 comment-preservation and single-callsite-count tests passed immediately because the existing comment already satisfied the regex and there was already exactly one callsite.
2. **Task 2: Land §14.1 IL-3 warn wording + atomically reframe doc** — `f380835` (feat) — rewrote the template-literal body inside the existing try/catch, and in the same commit reframed §14 MSG-LC-1 row tail + §14.1 heading + §14.1 closing paragraph in `docs/messaging-style-guide.md`. Both files appear in the diff (D-CMC-15 satisfied).

_Note: Task 1 was a pure RED commit per the plan's TDD design; Task 2 closes the RED→GREEN cycle by landing the bytes that turn the runtime and source-byte assertions green._

## Files Created/Modified

- `extensions/pi-claude-marketplace/persistence/migrate.ts` — Rewrote the `console.warn` template-literal body inside the existing try/catch at line ~178 to the byte-exact §14.1 wording. The surrounding try/catch, `errMsg = errorMessage(err)`, IL-3 inline disable comment, and closing `);` are all unchanged. Exactly one `console.warn(` callsite in the file.
- `docs/messaging-style-guide.md` — Three text edits in §14 / §14.1: row-tail of MSG-LC-1 (line ~490), §14.1 heading (line ~493), §14.1 closing paragraph (line ~507). The "Today's wording" and "Proposed replacement" code blocks inside §14.1 are untouched (the proposed-replacement bytes ARE the wording that landed — the framing prose around them flipped, the bytes inside the backticks are stable). Frontmatter, §14.2, and §15 ES-5 Replacement Table are untouched.
- `tests/persistence/migrate.test.ts` — Aligned the existing IL-3 runtime mock-capture test with the new wording (three regex updates); added `MIGRATE_PATH` constant via REPO_ROOT + fileURLToPath scaffolding; added three new source-byte tests: CMC-36 wording (byte-exact template literal present + legacy form absent), CMC-37 IL-3 comment preservation regex, CMC-37 single-callsite count.

## Decisions Made

- **Co-locate the three new source-byte tests in `tests/persistence/migrate.test.ts`** rather than splitting into a new `tests/persistence/migrate-warn-wording.test.ts`. Co-location wins on review cohesion: the existing IL-3 runtime mock-capture test is already there, and the four IL-3 contract assertions (runtime emission + wording + comment + count) are easier to audit in one file. Planner discretion per the Task 1 spec.
- **SKIP `mdformat` and `markdownlint-cli2` for `docs/messaging-style-guide.md`** at commit time. The configured `mdformat` plugin set (`mdformat-gfm` + `mdformat-gfm-alerts`) does not include `mdformat-frontmatter`, so `mdformat` strips the YAML frontmatter to prose on auto-format — which would violate the plan's explicit acceptance criterion that the frontmatter MUST stay untouched (51 bullets), since Plan 12-01's drift contract reads it as binding. The seed commit (`62d141d`) that introduced the file necessarily took the same approach. The proper fix — adding `mdformat-frontmatter` to `.pre-commit-config.yaml` and reconciling `markdownlint`'s MD041 vs. the file's leading horizontal rule — is a follow-up out of scope for Plan 12-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Skipped mdformat + markdownlint-cli2 hooks on commit of `docs/messaging-style-guide.md`**

- **Found during:** Task 2 (style guide doc edits)
- **Issue:** `mdformat` (with plugin set `mdformat-gfm` + `mdformat-gfm-alerts`, no `mdformat-frontmatter`) auto-rewrote the YAML frontmatter into prose on `pre-commit run --files docs/messaging-style-guide.md`, stripping the `---` markers and converting `status_tokens:`, `reasons:`, `markers:`, `pattern_classes:` into broken Markdown. `markdownlint-cli2` then flagged MD041 because the auto-rewrite turned the leading frontmatter into a horizontal rule. Both behaviors break the plan's acceptance criterion that the frontmatter MUST stay untouched (51 bullets preserved), because Plan 12-01's drift contract reads the frontmatter as binding contract.
- **Fix:** Reverted the mdformat damage with `git checkout HEAD -- docs/messaging-style-guide.md`, re-applied the three documented edits (§14 row tail, §14.1 heading, §14.1 closing paragraph), and committed with `SKIP=trufflehog,mdformat,markdownlint-cli2`. This mirrors the de-facto pattern of the seed commit `62d141d` that introduced the file — that commit also necessarily skipped these hooks (the file is structurally incompatible with the configured mdformat plugin set; running mdformat on the un-modified file destroys it).
- **Files modified:** (none beyond Task 2's planned edits)
- **Verification:** `head -60 docs/messaging-style-guide.md | grep -c "  - "` returns 51 (matches the pre-task baseline). `grep -cF "Phase 12 LANDED the new wording" docs/messaging-style-guide.md` returns 1. All other pre-commit hooks (prettier, eslint, typecheck, npm test, smartquote / dash / ligature / BiDi filters) pass.
- **Committed in:** `f380835` (Task 2 commit)
- **Follow-up needed (out of scope for this plan):** Add `mdformat-frontmatter` to `.pre-commit-config.yaml`'s `additional_dependencies` for the `mdformat` hook so future PRs touching this file don't need the SKIP. Separately, configure `markdownlint-cli2` to either disable MD041 for this file or accept the leading-horizontal-rule pattern. Both changes are tracking edits to project tooling, not to the messaging contract, so they belong in a tooling-hygiene PR rather than Plan 12-03 (which is laser-focused on the IL-3 wording landing).

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking; pre-commit tool incompatibility with the file's YAML frontmatter)
**Impact on plan:** Zero scope creep. The deviation defends the plan's explicit acceptance criterion (frontmatter MUST stay untouched, 51 bullets preserved) by skipping the pre-commit hooks that would otherwise destroy it. Functionally equivalent to the seed commit's pattern; no behavior or contract is altered.

## Issues Encountered

- `trufflehog` failed under the worktree sandbox with `failed to read index file: ... not a directory` — this is a known pre-existing sandbox issue (the project CLAUDE.md documents it explicitly) and `SKIP=trufflehog` is the documented worktree workaround. The underlying scan is clean (verified by running `pre-commit run trufflehog --all-files` outside the failing context).
- The Plan 12-03 frontmatter-untouched acceptance criterion claims a Plan 12-01 drift test exists at `tests/architecture/grammar-frontmatter.test.ts`. That file is not present in the current repository (Plan 12-01 may have used a different file name or not yet landed it). The criterion was therefore verified indirectly: `head -60 docs/messaging-style-guide.md | grep -c "  - "` returns 51 (matches the pre-Task-2 baseline), confirming the frontmatter is byte-untouched. Plan 12-01 will pick up the file as-is when its drift test lands.

## Self-Check: PASSED

- File `extensions/pi-claude-marketplace/persistence/migrate.ts` exists and contains the byte-exact §14.1 template literal (`grep -F "Legacy marketplace migration could not be persisted to ${stateJsonPath}"` returns 1 match).
- File `docs/messaging-style-guide.md` exists and contains the past-tense framing (`grep -cF "Phase 12 LANDED" / "### 14.1 Wording (Phase 12 landed)" / "The wording above is the binding text"` all return 1 each; old framing returns 0 each).
- File `tests/persistence/migrate.test.ts` exists with the updated runtime regexes and the three new source-byte tests (CMC-36/CMC-37 string appears 5 times).
- Commit `512a383` (Task 1 — test) exists in `git log --all`.
- Commit `f380835` (Task 2 — feat, atomic migrate.ts + style guide) exists in `git log --all`. Both files appear in `git diff --name-only HEAD~1 HEAD` (D-CMC-15 atomic-PR verified at the commit level).
- `eslint.config.js` is untouched (`git diff --name-only d6a781b HEAD -- eslint.config.js` is empty).
- `npm run check` exited 0 (typecheck + ESLint + Prettier + 1035 tests green).

## Next Phase Readiness

- Phase 13 (the later refactor pass on persistence/markers / ES-5 replacements) inherits a §14.1 that is now binding past-tense contract, not "proposed wording with planner discretion." Any future change to the IL-3 wording must update both the bytes at `persistence/migrate.ts:178` AND the §14.1 wording block AND the three CMC-36/CMC-37 source-byte tests, in the same atomic commit — the pattern is now precedent.
- The follow-up tooling work (add `mdformat-frontmatter` to `.pre-commit-config.yaml`, reconcile `markdownlint`'s MD041 with the file's leading horizontal rule) is a self-contained one-PR cleanup; recommend bundling with the next docs-touching PR rather than its own phase.
- No blockers for downstream Phase 12 plans (12-04, 12-05) — they touch different surfaces (notify wrapper docs, cross-reference integrity).

---
*Phase: 12-messaging-foundations-renderer-primitives*
*Completed: 2026-05-22*
