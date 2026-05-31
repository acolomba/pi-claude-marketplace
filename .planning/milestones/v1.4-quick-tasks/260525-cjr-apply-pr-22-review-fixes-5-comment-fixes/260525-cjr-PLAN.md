---
phase: quick-260525-cjr
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/presentation/reload-hint.ts
  - extensions/pi-claude-marketplace/presentation/cascade-summary.ts
  - extensions/pi-claude-marketplace/presentation/compact-line.ts
  - extensions/pi-claude-marketplace/presentation/cause-chain.ts
  - extensions/pi-claude-marketplace/presentation/sort.ts
  - extensions/pi-claude-marketplace/presentation/rollback-partial.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/grammar/reasons.ts
  - extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts
  - extensions/pi-claude-marketplace/shared/grammar/markers.ts
  - extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts
  - extensions/pi-claude-marketplace/shared/types.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/edge/completions/provider.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  - extensions/pi-claude-marketplace/transaction/phase-ledger.ts
  - tests/architecture/scope-order-drift.test.ts
  - tests/presentation/compact-line.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
autonomous: true
requirements:
  - QUICK-260525-CJR
---

<objective>
Apply all 16 fixes from PR #22 code review (the v1.3 "Consistent Messaging"
milestone PR), one atomic commit per fix so each can be reverted
independently. Fixes span three tiers: 3 critical correctness items, 3
important type/error hygiene items, and 10 polish items (type narrowing,
comment cleanup, test coverage).

Purpose: Land reviewer feedback before merge while preserving the typed
dispatch and grammar invariants established in v1.3.

Output: 16 atomic commits on the current branch (`gsd/v1.3-replan-catalog`).
After all commits, `npm run check` must be green (typecheck + ESLint +
Prettier + 1249/1249 tests pass).

## Sequencing notes

- **B2 (Task 5) must land before C4 (Task 10).** Both touch `PluginShapeError`
  narrowing. B2 introduces typed-dispatch fallbacks in four narrowers; C4
  then exposes the `shape` field that those (and other) call sites can
  narrow on without `!`. Doing C4 first would force B2 to immediately
  rewrite the same call sites.
- **C2 (Task 8) is the largest diff.** Splitting `PluginUpdateOutcome` into
  a discriminated union on `partition` cascades into
  `orchestrators/plugin/update.ts`, `presentation/compact-line.ts`, edge
  handlers, and every test that constructs an update outcome. Plan for a
  wider blast radius than other tasks.
- **B1 (Task 4) touches multiple layers.** Search for sibling occurrences
  and update every emitter site so it populates explicit booleans instead
  of relying on the optional default.

## Branch and commit discipline

- Current branch: `gsd/v1.3-replan-catalog`. NEVER commit to `main`.
- Conventional Commits per CLAUDE.md (`fix(260525-cjr): ...`,
  `refactor(260525-cjr): ...`, `test(260525-cjr): ...`,
  `docs(260525-cjr): ...`). Title 5-72 chars; body lines ≤80.
- Run `pre-commit run --files <changed files>` before each `git commit`. A
  failed hook means the commit did NOT happen -- fix, restage, re-run; do
  not `--amend`.
- If committing from a worktree, prefix with `SKIP=trufflehog` and run
  `pre-commit run trufflehog --all-files` separately to confirm the scan is
  clean.
- NEVER use `--no-verify`.
</objective>

<execution_context>
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/workflows/execute-plan.md
@/home/acolomba/pi-claude-marketplace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@extensions/pi-claude-marketplace/shared/errors.ts
@extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
@extensions/pi-claude-marketplace/orchestrators/types.ts
@extensions/pi-claude-marketplace/presentation/compact-line.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1 (A1): Fix 5 inaccurate code comments</name>
  <files>
    extensions/pi-claude-marketplace/presentation/reload-hint.ts,
    extensions/pi-claude-marketplace/presentation/cascade-summary.ts,
    extensions/pi-claude-marketplace/presentation/compact-line.ts,
    extensions/pi-claude-marketplace/shared/errors.ts
  </files>
  <action>
Fix five inaccurate comments in a single commit.

1. `presentation/reload-hint.ts:13-15` -- rewrite the comment narrating
   "Phase 13's atomic three-file edit ... deletes the legacy constant" to
   present-tense description of current state: there is a single canonical
   reload-hint trailer and no legacy `RELOAD_HINT_PREFIX` fallback. Confirm
   absence by grepping `shared/markers.ts` for `RELOAD_HINT_PREFIX` (should
   be zero hits) before writing.

2. `presentation/cascade-summary.ts:12-14` -- comment cites
   `tests/architecture/no-notify-from-presentation.test.ts` as the
   enforcement gate; that file does not exist. Grep `tests/` and
   `eslint.config*` / `.eslintrc*` /
   `extensions/pi-claude-marketplace/eslint-rules/` to see if another
   mechanism (lint rule, layering test) enforces "no notify from
   presentation". If one exists, repoint the comment. If none, drop the
   enforcement claim entirely -- describe only the convention.

3. `presentation/compact-line.ts:49-51` -- drop the
   `presentation/plugin-list.ts:22-24` line anchor in the `ICON_INSTALLED`
   comment. Those line numbers point to docstring text about MSG-PL-1, not
   a constant definition. Keep the convention description; remove the
   anchor.

4. `shared/errors.ts:303-304` -- comment references the regex
   `/is not installable:\s*(.+)$/` at `install.ts:902` as currently
   present. Grep confirms the regex was removed. Rewrite past-tense
   ("previously parsed ...") or drop the comment if it no longer adds
   value.

5. `shared/errors.ts:307-310` -- replace the four exact line anchors
   ("PI-3 / install.ts:263, install.ts:294 … PI-5 / install.ts:285 …
   resolver.ts:786") with function-name references (e.g.
   `requireInstallable`, `classifyEntityShapeError` -- verify the actual
   exported names in `install.ts` / `resolver.ts` before writing).

Single commit: `docs(260525-cjr): correct 5 stale code-comment anchors`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && grep -n "RELOAD_HINT_PREFIX" extensions/pi-claude-marketplace/presentation/reload-hint.ts extensions/pi-claude-marketplace/shared/markers.ts 2>&1 | grep -v "^#" || true ; grep -n "no-notify-from-presentation.test.ts" extensions/pi-claude-marketplace/presentation/cascade-summary.ts ; grep -n "plugin-list.ts:22-24" extensions/pi-claude-marketplace/presentation/compact-line.ts ; grep -nE "install\.ts:(263|285|294|902)|resolver\.ts:786" extensions/pi-claude-marketplace/shared/errors.ts</automated>
  </verify>
  <done>
All five comment-anchor patterns return zero grep hits. New comments
describe current state and reference identifiers (function/constant names)
instead of line numbers. Commit landed with conventional title.
  </done>
</task>

<task type="auto">
  <name>Task 2 (A2): Narrow bare catch in marketplace/shared.ts</name>
  <files>
    extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  </files>
  <action>
At `orchestrators/marketplace/shared.ts:163`, replace
`} catch { remoteSha = undefined; }` with a typed-dispatch catch that
distinguishes "git ref does not exist locally" from corrupted git dir /
EACCES / OOM / programming bugs.

Read isomorphic-git's exported error surface: prefer importing the named
error class (e.g. `NotFoundError`) if exported, otherwise fall back to
checking `err instanceof Error && err.name === "NotFoundError"`. Only
swallow NotFoundError into `remoteSha = undefined`; rethrow everything else
so the caller surfaces the real failure instead of silently falling back to
stale local state.

Confirm by reading the isomorphic-git node_modules type definitions or
documentation that NotFoundError is the canonical "ref missing" error from
the git call site in question. If the call is `resolveRef` / `readCommit` /
similar, document the exact error in a comment.

Add a focused unit test in `tests/orchestrators/marketplace/shared.test.ts`
(or the file that already covers `shared.ts`) asserting: (a) NotFoundError
results in `remoteSha === undefined`; (b) any other Error (e.g.
`new Error("EACCES")`) propagates.

Commit: `fix(260525-cjr): narrow git ref catch in marketplace shared`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && grep -n "catch " extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts | head -20 ; npm test -- --grep "marketplace.*shared" 2>&1 | tail -20</automated>
  </verify>
  <done>
No bare `catch {}` in `shared.ts:163` region. Non-NotFoundError throws
propagate. Test covers both paths and passes.
  </done>
</task>

<task type="auto">
  <name>Task 3 (A3): Surface unfiltered resolve errors in plugin/list.ts</name>
  <files>
    extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  </files>
  <action>
At `orchestrators/plugin/list.ts:255-263`, the catch around `resolveStrict`
routes ANY throw through `narrowResolverNotes`, which only recognizes
`hooks` / `lspServers` substrings. EACCES, EIO, JSON parse failures, and
bugs silently render as `(unavailable) {unsupported source}`. Per NFR-3's
fail-clean mandate that is the wrong behavior.

Refactor:

1. Detect resolver-domain errors first. `PluginShapeError` (from
   `shared/errors.ts`) is the canonical typed error; check
   `e instanceof PluginShapeError` and route through existing
   `narrowResolverNotes` logic.
2. For non-resolver errors (everything else), route through
   `notifyWarning` (or the existing notify channel in this file -- read the
   imports) with a distinct reason tag such as `unreadable` and include
   the underlying error message in the row's cause chain. The row must
   still render -- `list` is resilient -- but the user must see the real
   failure cause, not a misleading "unsupported source".
3. Confirm `notifyWarning` and the cause-chain helper are already imported
   in this file; if not, add the import.

Add a unit test in `tests/orchestrators/plugin/list.test.ts` covering an
unexpected throw (e.g. `EACCES`) and asserting the row carries the real
cause message, NOT `{unsupported source}`.

Commit: `fix(260525-cjr): surface non-resolver errors in plugin list`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && grep -n "narrowResolverNotes\|PluginShapeError" extensions/pi-claude-marketplace/orchestrators/plugin/list.ts | head -20 ; npm test -- --grep "plugin.*list" 2>&1 | tail -20</automated>
  </verify>
  <done>
Catch branches on `PluginShapeError` vs other; non-resolver errors surface
their real message via cause chain or notify. New test passes.
  </done>
</task>

<task type="auto">
  <name>Task 4 (B1): Promote declaresAgents/declaresMcp to required boolean</name>
  <files>
    extensions/pi-claude-marketplace/presentation/compact-line.ts,
    extensions/pi-claude-marketplace/orchestrators/types.ts
  </files>
  <action>
Flip `declaresAgents` and `declaresMcp` from `?: boolean` to required
`boolean` to enforce CMC-13 by type instead of by comment.

Touch points (confirmed in scope):
- `presentation/compact-line.ts:146-147` -- `PluginCascadeRow`
- `orchestrators/types.ts:42-43` -- `ReinstallReinstalledOutcome`
- `orchestrators/types.ts:141-142` -- `PluginUpdateOutcome` updated
  partition

Before editing, search the full repo
(`grep -rn "declaresAgents\|declaresMcp" extensions/ tests/`) and identify
every sibling occurrence in orchestrators/, edge/handlers/, presentation/,
and tests/. Build a list; every emitter site must populate explicit
booleans rather than relying on `undefined ≈ false`.

For each emitter that currently spreads an outcome without setting the
predicates, add explicit `declaresAgents: <expr>, declaresMcp: <expr>`
using the source of truth (likely a manifest check or a resolver-output
field). Where the source of truth is unclear, derive from the same logic
CMC-13's existing comment describes -- read the comment first.

After flipping the type, `npx tsc --noEmit` must surface every missing
site. Iterate until clean.

Commit: `refactor(260525-cjr): require declaresAgents/declaresMcp booleans`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && grep -rn "declaresAgents\?:\|declaresMcp\?:" extensions/ tests/ ; npx tsc --noEmit 2>&1 | tail -30</automated>
  </verify>
  <done>
Grep for `declaresAgents?:` / `declaresMcp?:` returns zero hits.
`npx tsc --noEmit` clean. All emitter sites populate explicit booleans.
Tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 5 (B2): Typed-dispatch narrowers in 4 sites</name>
  <files>
    extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/update.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/install.ts,
    extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  </files>
  <action>
Four `narrowReason` / `narrowFailReasons` / `narrowSkipReasons` /
`narrowResolverReasons` / `cascadeAutoupdates` sites default to misleading
closed-set reasons when the input doesn't substring-match. Mirror the
typed-dispatch pattern from
`orchestrators/marketplace/remove.ts:narrowCascadeFailure` (read it first
as the reference implementation): check `instanceof PluginShapeError`
first, then errno / Node error codes, then class checks, and only at the
bottom fall through to an explicit `unknown` / `other` reason (NOT a
misleading closed-set member).

Sites to refactor:

1. `orchestrators/plugin/reinstall.ts:709-712` -- `narrowReason` currently
   defaults `{not in manifest}` for any opaque cause, including
   permission-denied rollback. Add typed-dispatch; emit a distinct reason
   for errno-bearing errors.

2. `orchestrators/plugin/update.ts:1087-1135` -- `narrowFailReasons` /
   `narrowSkipReasons` use the same anti-pattern. Refactor both functions.

3. `orchestrators/plugin/install.ts:943-969` -- `narrowResolverReasons`
   drops unknown notes silently and falls through to `{unsupported
   source}`. Detect non-resolver causes and emit them through a distinct
   reason (e.g. `{unknown}` with the cause chain attached) rather than
   masquerading as "unsupported source".

4. `orchestrators/marketplace/update.ts:308-320` -- `cascadeAutoupdates`
   swallows throws into a notes-only outcome with no `reasons[]`. Capture
   the throw, route through typed dispatch, populate `reasons` accordingly.

For each site, add a unit test asserting:
- Known-shape inputs still produce the expected reason
- Unknown-shape inputs (e.g. `new Error("EACCES")` or a permission-denied
  case) produce a distinct, non-misleading reason

Do NOT yet introduce the `shape` field from C4 -- keep changes scoped to
the narrowers and their test coverage. C4 (Task 10) will refactor the
consumers afterwards.

Commit: `refactor(260525-cjr): typed dispatch in 4 reason narrowers`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && grep -n "narrowReason\|narrowFailReasons\|narrowSkipReasons\|narrowResolverReasons" extensions/pi-claude-marketplace/orchestrators/plugin/*.ts extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts ; npm test -- --grep "narrow\|cascadeAutoupdates\|reinstall\|update" 2>&1 | tail -30</automated>
  </verify>
  <done>
All four narrowers check typed shapes before substring matching; unknown
inputs produce distinct non-misleading reasons. New tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 6 (B3): Scope-order drift architecture test</name>
  <files>
    tests/architecture/scope-order-drift.test.ts,
    extensions/pi-claude-marketplace/shared/types.ts,
    extensions/pi-claude-marketplace/edge/completions/provider.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
  </files>
  <action>
Create `tests/architecture/scope-order-drift.test.ts` that recursively
greps `extensions/**/*.ts` for two patterns:

1. `["user", "project"]` (literal array ordering)
2. `=== "user" ? 0 : 1` (inline scope-rank computation)

Use `node:fs/promises` + manual walker, or a glob library already in
devDependencies (check `package.json`). Allow-list ONLY:
- `extensions/pi-claude-marketplace/presentation/sort.ts`
- `extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts`

Verify the allowlist is correct by reading both files -- they must contain
the canonical sort helper / SCOPES_ORDER constant. If the pattern lives
elsewhere, adjust the allowlist accordingly with a comment justifying each
entry.

Failure message: point to the canonical sort helper / SCOPES_ORDER
constant and instruct the developer to import it instead of duplicating
the ordering.

Now choose path (a) -- fix the three known offenders to use the helper:
- `shared/types.ts:20`
- `edge/completions/provider.ts:70`
- `edge/handlers/plugin/import.ts:45`

Read each call site first. If the offender is a literal
`["user", "project"]` array used for iteration order, import
`SCOPES_ORDER` (or the equivalent exported constant from
`presentation/sort.ts` / `shared/grammar/pattern-classes.ts`) and replace.
If it's a ternary `=== "user" ? 0 : 1`, call the sort helper. If for some
reason an offender genuinely cannot use the helper (e.g. type-level
ordering for a tuple type), add it to the allowlist with a
`// scope-order: justified -- <reason>` marker -- but prefer the fix.

Run the new architecture test; it must PASS after the fixes (or with the
allowlist additions).

Commit: `test(260525-cjr): guard scope-order drift outside lint glob`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && npm test -- --grep "scope-order-drift" 2>&1 | tail -20</automated>
  </verify>
  <done>
Architecture test exists, runs, and passes. Three known offenders either
use the canonical helper or carry a `// scope-order: justified` marker.
  </done>
</task>

<task type="auto">
  <name>Task 7 (C1): Preserve Error.cause on rollback undo failures</name>
  <files>
    extensions/pi-claude-marketplace/transaction/phase-ledger.ts,
    extensions/pi-claude-marketplace/presentation/rollback-partial.ts
  </files>
  <action>
At `transaction/phase-ledger.ts:77`, `partials.push({ phase, msg:
errorMessage(undoErr) })` records text only; `undoErr.cause` is dropped.

1. Extend `RollbackPartial` (or whatever the type is named -- read the
   file) to carry `cause?: Error`.
2. Set `cause: undoErr instanceof Error ? undoErr : undefined` at the
   push site.
3. Update `presentation/rollback-partial.ts` --
   `composeRollbackPartialBody` and `renderRollbackPartial` -- to emit the
   cause-chain trailer for the undo failure itself (reuse the existing
   cause-chain helper from `presentation/cause-chain.ts`).
4. Add a test in the existing rollback-partial test file (or
   `tests/transaction/phase-ledger.test.ts`) where an undo throws an
   error with a `cause`, and assert the rendered output includes the
   cause-chain trailer.

Commit: `fix(260525-cjr): preserve Error.cause on rollback undo failure`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && grep -n "RollbackPartial\|cause" extensions/pi-claude-marketplace/transaction/phase-ledger.ts | head -20 ; npm test -- --grep "rollback" 2>&1 | tail -20</automated>
  </verify>
  <done>
`RollbackPartial` carries `cause?: Error`. Renderer emits cause-chain
trailer for undo failures. New test passes.
  </done>
</task>

<task type="auto">
  <name>Task 8 (C2): Split PluginUpdateOutcome into discriminated union</name>
  <files>
    extensions/pi-claude-marketplace/orchestrators/types.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/update.ts,
    extensions/pi-claude-marketplace/presentation/compact-line.ts
  </files>
  <action>
Split `PluginUpdateOutcome` (currently at `orchestrators/types.ts:92-165`)
into a discriminated union on `partition`:

  - `{ partition: "updated"; fromVersion: string; toVersion: string; ... }`
  - `{ partition: "unchanged"; ... }`
  - `{ partition: "skipped"; ... }`
  - `{ partition: "failed"; phaseFailures: ...; ... }`

Move `fromVersion` / `toVersion` onto `Updated` (required there, absent
elsewhere). Move `phaseFailures` onto `Failed`. Drop all optional fields
that become unreachable in their partition.

This change cascades. Expect wider blast radius than other tasks:
- `orchestrators/plugin/update.ts` -- every site that constructs an
  outcome needs the right variant; every site that reads
  `fromVersion` / `toVersion` needs to narrow on
  `partition === "updated"` first.
- `presentation/compact-line.ts` -- render paths must narrow before
  reading partition-specific fields; replace any
  `outcome.fromVersion!` with proper switch/narrow.
- Edge handlers and tests -- grep `PluginUpdateOutcome` across the repo
  and fix all consumers.
- Tests -- fixture construction in test files.

After all narrowing is in place, add an `assertNever(outcome as never)`
in the render switch (`compact-line.ts`) to lock the exhaustiveness
check.

Run `npx tsc --noEmit` and the full test suite. Iterate until clean.

Commit: `refactor(260525-cjr): split PluginUpdateOutcome on partition`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && grep -rn "PluginUpdateOutcome" extensions/ tests/ | head -30 ; npx tsc --noEmit 2>&1 | tail -30</automated>
  </verify>
  <done>
`PluginUpdateOutcome` is a discriminated union on `partition`. No optional
`fromVersion` / `toVersion` / `phaseFailures` fields remain. `assertNever`
guards exhaustiveness in the render switch. Typecheck and tests clean.
  </done>
</task>

<task type="auto">
  <name>Task 9 (C3): Collapse InstallPluginOutcome error variants</name>
  <files>
    extensions/pi-claude-marketplace/orchestrators/plugin/install.ts,
    extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  </files>
  <action>
At `orchestrators/plugin/install.ts:127-139`, the error variants of
`InstallPluginOutcome` re-stringify the cause, losing typed dispatch
downstream.

Collapse the error variants into a single shape:
`{ status: "failed"; error: PluginShapeError | Error }`.

Update:
- All emitter sites in `install.ts` to set `error: <thrown>` directly.
- The edge handler at `edge/handlers/plugin/install.ts` (or wherever the
  outcome is consumed) to narrow `outcome.error instanceof
  PluginShapeError` before extracting shape-specific data, otherwise
  treat as generic Error.
- Tests that construct or assert against the outcome.

Commit: `refactor(260525-cjr): collapse install outcome error variants`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && grep -rn "InstallPluginOutcome" extensions/ tests/ | head -20 ; npx tsc --noEmit 2>&1 | tail -20 ; npm test -- --grep "install" 2>&1 | tail -20</automated>
  </verify>
  <done>
Error variants collapsed to single `{status: "failed", error}` shape
carrying the typed error. Consumers narrow on
`error instanceof PluginShapeError`. Typecheck and tests clean.
  </done>
</task>

<task type="auto">
  <name>Task 10 (C4): Expose readonly shape on PluginShapeError</name>
  <files>
    extensions/pi-claude-marketplace/shared/errors.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/install.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/update.ts,
    extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  </files>
  <action>
At `shared/errors.ts:351-375`, expose
`readonly shape: PluginShapeErrorShape` on `PluginShapeError` so consumers
can narrow on `e.shape.kind` without non-null assertions. Drop the
optional `marketplace` / `reasons` mirror fields (they exist only to
compensate for the absent `shape` getter).

1. Add `readonly shape: PluginShapeErrorShape` to the class. Initialize
   in the constructor.
2. Remove the optional mirror fields (`marketplace?`, `reasons?`) and any
   code that populates them.
3. Update consumers in `orchestrators/plugin/install.ts`,
   `orchestrators/plugin/update.ts`,
   `orchestrators/plugin/reinstall.ts` -- replace `e.marketplace!` /
   `e.reasons!` reads with narrowed reads, e.g.
   `e.shape.kind === "X" ? e.shape.marketplace : ...`. Use a switch on
   `e.shape.kind` where multiple branches exist.
4. Update any tests that construct `PluginShapeError` with the mirror
   fields to pass `shape` instead.

Run `npx tsc --noEmit` and the full test suite. The B2 typed-dispatch
narrowers from Task 5 should now naturally narrow on `e.shape.kind`.

Commit: `refactor(260525-cjr): expose readonly shape on PluginShapeError`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && grep -n "marketplace?:\|reasons?:" extensions/pi-claude-marketplace/shared/errors.ts ; grep -rn "\.marketplace!\|\.reasons!" extensions/ tests/ | head -20 ; npx tsc --noEmit 2>&1 | tail -20</automated>
  </verify>
  <done>
`PluginShapeError` exposes `readonly shape`. Optional `marketplace?` /
`reasons?` mirror fields removed. No `.marketplace!` / `.reasons!`
non-null assertions remain. Typecheck and tests clean.
  </done>
</task>

<task type="auto">
  <name>Task 11 (C5): Fix dead MANIFEST_FIELD_REASONS carve-out</name>
  <files>
    extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  </files>
  <action>
At `orchestrators/plugin/install.ts:935,950`, the
`MANIFEST_FIELD_REASONS` carve-out predicate is dead: the resolver emits
`"contains hooks"` / `"contains lspServers"` (verified via
`domain/resolver.ts:685`), not bare `"hooks"` / `"lspServers"`.

Read `domain/resolver.ts:685` to confirm the exact emitted strings, then
choose option (a) -- preserve intent:

- Change the predicate to match the resolver's actual output (e.g.
  `note.startsWith("contains ")` plus a token extraction), and emit the
  bare token (`hooks` / `lspServers`) as the `Reason`.
- Update `MANIFEST_FIELD_REASONS` if it is also stale.
- Adjust any JSDoc that documents the carve-out so it matches the
  refactored predicate.

Add a unit test in `tests/orchestrators/plugin/install.test.ts` (or
adjacent) asserting that a resolver note of `"contains hooks"` produces a
`Reason` containing the bare `hooks` token (NOT `unsupported source`).

Commit: `fix(260525-cjr): align manifest-field reason predicate with resolver`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && grep -n "MANIFEST_FIELD_REASONS\|contains hooks\|contains lspServers" extensions/pi-claude-marketplace/orchestrators/plugin/install.ts extensions/pi-claude-marketplace/domain/resolver.ts ; npm test -- --grep "manifest.*reason\|MANIFEST_FIELD" 2>&1 | tail -20</automated>
  </verify>
  <done>
Predicate matches resolver output. Bare `hooks` / `lspServers` tokens
flow through as `Reason`. JSDoc updated. New test passes.
  </done>
</task>

<task type="auto">
  <name>Task 12 (C6): Converge outcomeToCascadeRow on composeVersionArrow</name>
  <files>
    extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  </files>
  <action>
Two `outcomeToCascadeRow` implementations diverge on version-arrow
formatting:
- `orchestrators/marketplace/update.ts:353-356` inlines logic
- `orchestrators/plugin/update.ts:1063-1077` already uses
  `composeVersionArrow`

Read `orchestrators/plugin/update.ts:1063-1077` to confirm the helper
name and signature, then refactor `orchestrators/marketplace/update.ts:
353-356` to call the same helper. If the helper is not exported from a
shared module, lift it to one (e.g.
`presentation/version-arrow.ts` or `shared/version-arrow.ts`) and
re-import in both call sites.

Add a unit test in the appropriate test file asserting both call paths
produce identical output for representative inputs (matching versions,
hash versions, missing version).

Commit: `refactor(260525-cjr): converge outcomeToCascadeRow on shared helper`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && grep -n "composeVersionArrow\|outcomeToCascadeRow" extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts extensions/pi-claude-marketplace/orchestrators/plugin/update.ts ; npm test -- --grep "version.*arrow\|cascadeRow" 2>&1 | tail -20</automated>
  </verify>
  <done>
Both `outcomeToCascadeRow` sites call the same `composeVersionArrow`
helper. No inline arrow formatting remains. Tests pass.
  </done>
</task>

<task type="auto">
  <name>Task 13 (C7): Close iconForPluginRow exhaustiveness gap</name>
  <files>
    extensions/pi-claude-marketplace/presentation/compact-line.ts
  </files>
  <action>
At `presentation/compact-line.ts:405-410`, replace the `iconForPluginRow`
fallthrough with an exhaustiveness assertion.

1. Replace the fallthrough branch with `assertNever(status as never)`
   (import `assertNever` from the existing util -- read the file to find
   the canonical location; if none exists, add a one-line helper).
2. Ensure every existing `status` variant has an explicit branch
   returning the right icon constant.
3. The TypeScript exhaustiveness check should then catch any future
   variant addition at compile time.

No new tests required -- the type system enforces this. But run the full
test suite to confirm no regression.

Commit: `refactor(260525-cjr): assertNever in iconForPluginRow`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && grep -n "iconForPluginRow\|assertNever" extensions/pi-claude-marketplace/presentation/compact-line.ts ; npx tsc --noEmit 2>&1 | tail -10</automated>
  </verify>
  <done>
`iconForPluginRow` ends with `assertNever(status as never)`. No
fallthrough branch remains. Typecheck clean.
  </done>
</task>

<task type="auto">
  <name>Task 14 (C8): Malformed-input tests for compact-line</name>
  <files>
    tests/presentation/compact-line.test.ts
  </files>
  <action>
Add 5-8 malformed-input test cases to
`tests/presentation/compact-line.test.ts`:

1. `version: ""` (empty string) -- renders without throwing; verify the
   rendered version slot is either omitted or shows a deterministic
   placeholder.
2. `reasons: undefined` -- renders without throwing; equivalent to
   no-reasons row.
3. `reasons: []` -- explicit empty array; renders without the reasons
   suffix.
4. Unicode in `name` (e.g. emoji, RTL combining chars) -- rendered
   verbatim without alignment corruption.
5. Unicode in `marketplace` (e.g. CJK characters) -- rendered verbatim.
6. (Optional) Very long `name` (e.g. 200 chars) -- no panic; verify
   truncation/wrap behavior matches existing convention.
7. (Optional) Mixed-direction text in `name`.

Assertions should follow the file's existing snapshot or string-equality
style. Do NOT change production code -- these tests document existing
behavior and lock it in.

Commit: `test(260525-cjr): malformed-input cases for compact-line`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && npm test -- --grep "compact-line" 2>&1 | tail -30</automated>
  </verify>
  <done>
5-8 new test cases added covering empty version, undefined/empty reasons,
and Unicode in name/marketplace. All pass.
  </done>
</task>

<task type="auto">
  <name>Task 15 (C9): Same-name cross-scope reinstall ordering test</name>
  <files>
    tests/orchestrators/plugin/reinstall.test.ts
  </files>
  <action>
Add an integration test for same-name cross-scope reinstall ordering.

Current test around line 933 of `tests/orchestrators/plugin/reinstall.test.ts`
uses distinct marketplace names (a, u, z), so the
project-before-user tie-breaker on `MarketplaceRow.scope` never fires at
integration level.

Add a fixture where the SAME marketplace name exists in both `user` and
`project` scopes. Assert the project-scope row renders BEFORE the
user-scope row in the cascade output. Use the existing test helpers in
the file for fixture construction.

Commit: `test(260525-cjr): same-name cross-scope reinstall ordering`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && npm test -- --grep "reinstall.*cross-scope\|same-name\|tie-breaker" 2>&1 | tail -20</automated>
  </verify>
  <done>
New test exercises the project-before-user tie-breaker on a same-name
fixture and passes.
  </done>
</task>

<task type="auto">
  <name>Task 16 (C10): Strip phase-ticket density from comments</name>
  <files>
    extensions/pi-claude-marketplace/presentation/compact-line.ts,
    extensions/pi-claude-marketplace/shared/grammar/reasons.ts,
    extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts,
    extensions/pi-claude-marketplace/shared/grammar/markers.ts,
    extensions/pi-claude-marketplace/shared/grammar/pattern-classes.ts,
    extensions/pi-claude-marketplace/shared/errors.ts,
    extensions/pi-claude-marketplace/presentation/cause-chain.ts,
    extensions/pi-claude-marketplace/presentation/sort.ts,
    extensions/pi-claude-marketplace/presentation/rollback-partial.ts
  </files>
  <action>
Strip phase-ticket density from comments across these files. They rot at
milestone-archive time (already happening at commit `06c4117`). Single
commit covering all files.

Files and regions to clean:

1. `presentation/compact-line.ts:1-51` -- strip D-CMC-01..08, D-13-05..20,
   Plan 14-03 references.
2. `presentation/compact-line.ts:62-64` -- drop the redundant restatement
   of MSG-IC-1..3 (the codes appear elsewhere; this is duplicative).
3. `shared/grammar/reasons.ts:22-38` -- strip the Phase 12 / Phase 13
   Wave 3 reconciliation narrative.
4. `shared/grammar/status-tokens.ts` header -- strip Plan IDs.
5. `shared/grammar/markers.ts` header -- strip Plan IDs.
6. `shared/grammar/pattern-classes.ts` header -- strip Plan IDs.
7. `shared/errors.ts:299-301` -- strip "Quick task 260525-aub" reference.
8. `presentation/cause-chain.ts:24-29` -- strip "Phase 14.2-fix WR-03".
9. `presentation/sort.ts:13-15` -- strip "D-13-15 places it here…"
   narration.
10. `presentation/rollback-partial.ts:19-24, 80-86` -- strip
    "Plan 14-06 / D-14-04" references.

Rules:

- KEEP binding-contract sentences: drift-test names, layering
  constraints, NFR references (e.g. NFR-1, NFR-3, NFR-10).
- KEEP message-spec codes (MSG-*, CMC-*) that are referenced from tests
  or grammar tables -- these are the live contract.
- STRIP ticket IDs (D-XX-YY, Plan NN-NN, Phase NN, "Quick task XXXXXX")
  and historical narration ("Phase 13's atomic three-file edit…",
  "reconciliation narrative…", "places it here…").
- When in doubt about whether a code is binding, grep for it elsewhere
  in the repo. If it's only referenced in comments, it's narration --
  strip it. If a test or grammar table references it, keep it.

Commit: `docs(260525-cjr): strip phase-ticket density from comments`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace && grep -nE "D-(CMC|13|14)-[0-9]+|Plan 1[34]-[0-9]+|Phase 1[234](\.[0-9]+)?|Quick task" extensions/pi-claude-marketplace/presentation/compact-line.ts extensions/pi-claude-marketplace/shared/grammar/*.ts extensions/pi-claude-marketplace/shared/errors.ts extensions/pi-claude-marketplace/presentation/cause-chain.ts extensions/pi-claude-marketplace/presentation/sort.ts extensions/pi-claude-marketplace/presentation/rollback-partial.ts | grep -v "^Binary"</automated>
  </verify>
  <done>
Grep for `D-CMC-*` / `D-13-*` / `D-14-*` / `Plan 13-*` / `Plan 14-*` /
`Phase 12` / `Phase 13` / `Phase 14*` / `Quick task` returns zero hits in
the listed files. Binding-contract sentences (NFR refs, MSG-* codes,
drift-test names) preserved.
  </done>
</task>

</tasks>

<verification>
After all 16 commits land on `gsd/v1.3-replan-catalog`:

1. `npm run check` -- must pass (typecheck + ESLint + Prettier + tests).
2. Test count: expect 1249 baseline + new tests from Tasks 2, 3, 5, 6, 7,
   8 (where applicable), 11, 14, 15. Confirm 1249 baseline tests still
   pass; new test count is additive.
3. `git log --oneline` shows 16 atomic commits with the
   `<type>(260525-cjr): <subject>` conventional-commit format.
4. If working in a worktree: run `pre-commit run trufflehog --all-files`
   one final time to confirm secret-scan is clean.
</verification>

<success_criteria>
- [ ] 16 atomic commits on `gsd/v1.3-replan-catalog`, one per fix, in the
  order A1, A2, A3, B1, B2, B3, C1, C2, C3, C4, C5, C6, C7, C8, C9, C10.
- [ ] Each commit independently revertible (no cross-fix dependencies in
  the diff except the documented B2→C4 sequencing).
- [ ] `npm run check` green (typecheck + ESLint + Prettier + all tests).
- [ ] No `?: boolean` on `declaresAgents` / `declaresMcp` anywhere
  (B1 done).
- [ ] No `.marketplace!` / `.reasons!` non-null assertions on
  `PluginShapeError` (C4 done).
- [ ] `PluginUpdateOutcome` is a discriminated union on `partition`
  (C2 done).
- [ ] `tests/architecture/scope-order-drift.test.ts` exists and passes
  (B3 done).
- [ ] Stale comment anchors purged; binding-contract sentences preserved
  (A1, C10 done).
</success_criteria>

<output>
After all 16 commits land, write summary to:
`.planning/quick/260525-cjr-apply-pr-22-review-fixes-5-comment-fixes/260525-cjr-SUMMARY.md`
covering: which fixes shipped, files touched per fix, any deviations from
the plan (e.g. allowlist additions in B3, blast-radius surprises in C2),
final `npm run check` outcome, and test-count delta.
</output>
