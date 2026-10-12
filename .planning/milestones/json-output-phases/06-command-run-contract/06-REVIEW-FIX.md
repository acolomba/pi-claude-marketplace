---
phase: 06-command-run-contract
fixed_at: 2026-10-09T22:35:31Z
review_path: .planning/phases/06-command-run-contract/06-REVIEW.md
iteration: 3
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-10-09T22:35:31Z
**Source review:** `.planning/phases/06-command-run-contract/06-REVIEW.md`
**Iteration:** 3 (final automatic fix pass)

**Summary:** One finding in scope (CR-01); one fixed; none skipped.

## Fixed Issues

### CR-01: Windows current-drive-rooted paths escape detection

**Status:** fixed: developer confirmed (option 1, 2026-10-09)
**Commit:** `045f53cd5060082c5df6371853338f6765cd1c2d`
**Subject:** `fix: redact current-drive-rooted paths in machine errors`

**Files modified:**

- `extensions/pi-claude-marketplace/shared/notification-command-error.ts`
- `tests/shared/notification-command-error.test.ts`
- `tests/edge/command-run.test.ts`
- `tests/shared/notification-json.test.ts`
- `tests/architecture/no-credential-leak.test.ts`

**Applied fix:** A one-line change recognizes a single backslash as a local
path prefix, alongside a slash. Current-drive-rooted Windows paths now
reach the existing conservative tail handling. Drive-letter, UNC, extended
UNC, extended drive, slash roots, and file URLs retain that handling.
Unambiguous paths become `[path]`; ambiguous affected causes become
`Command failure details omitted.`. No new delimiter heuristic was added.

The direct root-form matrix checks nine roots, twelve directory variants,
and four quoting choices: 432 complete expected presentations. Variants
include spaces, Unicode, embedded quotes, angle brackets, LF, CRLF, tabs,
and Unicode line/paragraph separators. Nested causes and reload facts are
included. Eight root forms also run through five diagnostic variants in
both JSON and RPC: 80 complete command-boundary payload assertions.

The converter adds four current-drive-rooted cases. Architecture tests add
56 complete JSON/RPC delivery expectations across seven root forms. Both
disclosure helpers now require an independently expected complete cause
chain, in addition to existing credential/fixture checks. New controls
plant both untouched paths and partially redacted suffixes: 120 negative
checks across the converter and architecture cases. No new marker names
were added to make the helpers reject only these fixtures.

The original safe payloads, previous real missing-file reproductions,
HTTP(S) credential redaction, file URLs, UNC, bounded causes, hostile
fallbacks, and D-08 regressions remain covered and pass. The new Windows
diagnostics are synthetic tests through the actual command boundary on
Linux; they do not claim native Windows filesystem execution.

## Verification

Checks ran in the isolated worktree
`/home/acolomba/src/pi-claude-marketplace-json/.claude/worktrees/rf-06-cr01-iter3`
with Node `v26.11.0`. The worktree reused the parent's existing
`node_modules` through a symlink. No dependency was added or installed.

- **Reproduction:** Before the production change, the new tests against
  `6680ff1b` produced 70 failures and 840 passes. Log:
  `/tmp/cr01-iter3-red.log`.
- **Focused tests:** Resolver, command boundary, converter, dispatcher, and
  architecture tests passed: 1,198 tests, zero failures, skips, or todos.
  Log: `/tmp/cr01-iter3-focused.log`.
- **Inspection:** CodeGraph preceded live source and caller inspection.
  Reviewed the formatted source/test diff; `git diff --cached --check`
  passed and unstaged source/test changes were absent. The required
  TypeScript writing/review and local-verification skills governed the fix.
- **Fallow:** `fallow audit --base HEAD --format json --quiet` passed before
  commit against `6680ff1b`, covering five changed files with zero dead-code
  issues, complexity findings, or duplication groups. Report:
  `/tmp/cr01-iter3-fallow.json`. The generated TypeScript cache entrypoint
  advisory was unrelated to this fix.
- **Fixers:** `SKIP=npm-check pre-commit run --files <the five files above>`
  passed after formatting and restaging. Log:
  `/tmp/cr01-iter3-precommit.log`.
- **Normal commit hook:** `npm run check:commit` and commit-message checks
  passed. The hook covers static checks, unpaired architecture/contract
  tests, and direct coverage for the three affected source-test pairs.
  Log: `/tmp/cr01-iter3-commit.log`. The commit ran in the foreground with
  the longest available tool wait, using automatic escalation for shared
  Git/LFS metadata and subprocess access. No amend, rebase, or hook bypass
  was used.
- **Strict corpus:** After the successful normal hook, ran sequentially on
  the committed tree:
  `TEST_CONCURRENCY=4 node scripts/notify-corpus.mjs check`.
  Exit status 0; log: `/tmp/cr01-iter3-corpus.log`. Independent assertions
  required exactly one summary matching `Notify corpus check passed: 3149
  baseline entries present, 0 extra.`, and no missing, extra, refusal, or
  failure lines. Assertions passed. The runner reported 10,090 tests,
  10,089 passes, zero failures, and one inherited skip. No corpus recapture.
- **Protected inputs:** Git comparisons confirmed the shared text redactor
  unchanged and the frozen corpus directory plus `docs/output-catalog.md`
  unchanged from `26cb0056`. SHA-256 checks confirmed the parent's current
  REVIEW.md and all iteration-2/3 review/fix-report backups were untouched.
  Checksums: `/tmp/cr01-iter3-preserved-records.sha256`.

## Scope and Handoff

Only CR-01 and the five source/test files above were committed. This report
is intentionally uncommitted. No other planning record was modified by
this remediation. The temporary worktree is merged into `features/json`
and removed during handoff.

The fix remains subject to human verification and the parent's final
independent re-review. Both descriptor-less prohibitions remain
**flagged-unverified**: no persistent or cross-command/user tracking or
telemetry, and no implication that an error or delivery fault rolled back
an already committed operation. Neither receives an automated-pass claim.

The parent owns a fresh full `npm run check` for the new combined tree,
independent re-review, final security/goal verification, and SECURITY,
VALIDATION, REVIEW-DISPOSITION, STATE, ROADMAP, and REVIEW.md updates.
The prior parent full gate at `6680ff1b` does not verify this new commit.
The passing commit hook and focused checks are not a full GSD gate verdict.

---

_Fixed: 2026-10-09T22:35:31Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 3_

## Developer confirmation

On 2026-10-09, the user selected option 1, "Accept and continue verification."
The accepted machine-error behavior replaces local paths with `[path]` and
ambiguous affected causes with `Command failure details omitted.`. Text
output remains unchanged. This resolves the redaction confirmation required
by the fix workflow. It does not resolve the two prohibition flags or claim
native Windows filesystem execution.
