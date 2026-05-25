---
phase: quick-260525-cjr
plan: 01
type: execute
status: complete
completed_at: "2026-05-25T11:38:00Z"
duration_minutes: 145
test_count_baseline: 1249
test_count_final: 1326
test_count_delta: +77
commits:
  - sha: b3c9471
    type: docs
    subject: correct 5 stale code-comment anchors
  - sha: 4d25791
    type: fix
    subject: narrow git ref catch in marketplace shared
  - sha: e337b26
    type: fix
    subject: surface non-resolver errors in plugin list
  - sha: 895d526
    type: refactor
    subject: require declaresAgents/declaresMcp booleans
  - sha: d893545
    type: refactor
    subject: typed dispatch in 4 reason narrowers
  - sha: 749a796
    type: test
    subject: guard scope-order drift outside lint glob
  - sha: 35b5f98
    type: fix
    subject: preserve Error.cause on rollback undo failure
  - sha: 5e8ba1a
    type: refactor
    subject: split PluginUpdateOutcome on partition
  - sha: 1a14c0f
    type: refactor
    subject: collapse install outcome error variants
  - sha: 6410c75
    type: refactor
    subject: expose readonly shape on PluginShapeError
  - sha: 9270a8b
    type: fix
    subject: align manifest-field reason predicate with resolver
  - sha: 930dd33
    type: refactor
    subject: converge outcomeToCascadeRow on shared helper
  - sha: c2faf27
    type: refactor
    subject: assertNever in iconForPluginRow
  - sha: 74c2242
    type: test
    subject: malformed-input cases for compact-line
  - sha: f96f19e
    type: test
    subject: same-name cross-scope reinstall ordering
  - sha: 2fff85f
    type: docs
    subject: strip phase-ticket density from comments
---

# Quick Task 260525-cjr: Apply PR #22 Review Fixes Summary

PR #22 (the v1.3 "Consistent Messaging" milestone PR) carried 16
reviewer-flagged fixes spanning three tiers: 3 critical correctness items
(A1-A3), 3 important type/error hygiene items (B1-B3), and 10 polish
items (C1-C10). Every fix landed as a separate atomic commit so each
can be reverted independently; the only documented inter-fix dependency
is the planned B2 → C4 sequencing (B2 introduced typed-dispatch
fallbacks; C4 then exposed the `shape` field that lets those call
sites narrow on `e.shape.kind`).

`npm run check` is green: typecheck + ESLint + Prettier + 1326/1326
tests pass (1249 baseline + 77 new tests).

## Per-task Summary

### Task 1 (A1) -- `docs(260525-cjr): correct 5 stale code-comment anchors` -- commit `b3c9471`

Files: `presentation/reload-hint.ts`, `presentation/cascade-summary.ts`,
`presentation/compact-line.ts`, `shared/errors.ts`.

- `reload-hint.ts` -- the comment narrating "Phase 13's atomic three-file
  edit deletes the legacy constant" is replaced with a present-tense
  description of the current state (no legacy reload-hint prefix
  constant remains in `shared/markers.ts`).
- `cascade-summary.ts` -- dropped the citation of the nonexistent
  `no-notify-from-presentation.test.ts` enforcement gate; kept the
  convention description.
- `compact-line.ts` -- dropped the misleading `plugin-list.ts:22-24`
  line anchor from the `ICON_INSTALLED` block (those line numbers
  pointed at docstring text, not at constant definitions).
- `shared/errors.ts` -- replaced 4 exact-line anchors
  (`install.ts:263/285/294/902`, `resolver.ts:786`) and the reference
  to the deleted `/is not installable:\s*(.+)$/` regex with
  function-name anchors (`installPlugin`, `requireInstallable`,
  `classifyEntityShapeError`).

### Task 2 (A2) -- `fix(260525-cjr): narrow git ref catch in marketplace shared` -- commit `4d25791`

Files: `orchestrators/marketplace/shared.ts`,
`tests/orchestrators/marketplace/shared.test.ts` (NEW),
`tests/helpers/git-mock.ts`.

Replaced the bare `} catch { remoteSha = undefined; }` in
`refreshGitHubClone` with a typed-dispatch catch that swallows only
isomorphic-git's `NotFoundError` (identified by `err.name`) into the
detached-HEAD fallback path. Any other failure (EACCES on .git,
corrupted git dir, programming bug in a `GitOps` stub) propagates so
the caller surfaces the real cause instead of silently falling back to
stale local state. Name-check rather than `instanceof` keeps the
orchestrator tier free of a direct `isomorphic-git` import (D-13).

Also patched `tests/helpers/git-mock.ts` so the mock's "unknown ref"
throw tags itself as `NotFoundError`, matching isomorphic-git's actual
runtime behavior -- without this, the existing detached-HEAD test
("D-14: detached-HEAD path checks out SHA directly without
forceUpdateRef") would have regressed.

Test coverage: 3 new tests on `refreshGitHubClone` covering the
NotFoundError fallback, non-NotFoundError propagation, and the happy
path.

### Task 3 (A3) -- `fix(260525-cjr): surface non-resolver errors in plugin list` -- commit `e337b26`

Files: `orchestrators/plugin/list.ts`,
`tests/orchestrators/plugin/list.test.ts`.

`availableRowComputation` previously routed EVERY caught throw through
`narrowResolverNotes`, which only recognises the substrings `hooks` and
`lspServers` and silently degraded everything else (EACCES, JSON parse
errors, EIO, programming bugs) to `(unavailable) {unsupported source}`
-- hiding the real failure class from the user and violating NFR-3
fail-clean.

Refactor:
- Widened the internal `PluginRowComputation.reasons` to a `ListReason`
  alias that is a subset of the closed `Reason` set, adding the four
  probe-error classes (`permission denied`, `source missing`,
  `unreadable`, `unparseable`).
- Added `narrowProbeError(err)`: typed dispatch that classifies caught
  errors by `code` (EACCES / EPERM / ENOENT / ENOTDIR) and by shape
  (`SyntaxError -> unparseable`), falling through to `unreadable` for
  any other Error -- explicitly NOT `unsupported source`.
- Captured each probe failure into a per-call `PROBE_FAILURES` buffer
  with the raw `errorMessage(err)`. After `renderPluginList`,
  `listPlugins` drains the buffer into a single trailing
  `notifyWarning` with the per-plugin cause detail (one notification
  per call, not one per failed row).
- Added `__test_narrowProbeError` re-export so the classifier branches
  can be tested directly.

Test coverage: 5 new unit tests covering every classifier branch
including a regression guard that an unrecognised generic Error does
NOT fall through to `unsupported source`.

**Deviation from plan:** The plan referenced a `PluginShapeError`
`instanceof` check inside the catch, but `resolveStrict` does not throw
`PluginShapeError` (only `requireInstallable` does, and `list` calls
`resolveStrict`). The classifier instead discriminates on Node errno
codes, which is the actual surface the catch sees. Documented in the
commit message.

### Task 4 (B1) -- `refactor(260525-cjr): require declaresAgents/declaresMcp booleans` -- commit `895d526`

Files: 8 extension files + 10 test files (18 files total).

Flipped `declaresAgents` and `declaresMcp` from `?: boolean` to
required `boolean` on every row / outcome shape that carries them so
CMC-13 is enforced by the TYPE rather than by a per-callsite comment.
Optional fields silently coerced `undefined -> false`, hiding
accidental emitter-site omissions; the required type now makes every
producer visible at `npx tsc --noEmit`.

Type definitions flipped: `PluginInlineRow`, `PluginCascadeRow`,
`PluginListRow`, `PluginUpdateOutcome`, `ReinstallReinstalledOutcome`,
`PluginRowComputation` (internal). Every producer site now sets BOTH
booleans explicitly; non-(updated) cascade rows pin to `false` per
MSG-SD-3 (the renderer narrows on status anyway, but the explicit
emission keeps the contract symmetrical).

Used a node:fs helper script (`/tmp/fix-declares.mjs`) to insert the
required booleans into ~150 row literals across test fixtures while
respecting nested literal scopes. Script logic: walk every
`{ ... kind: "plugin-{cascade,inline,list}" ... }` (and
`partition: "..."`) brace-balanced literal, check for existing
`declares*` fields, insert the missing ones at the correct
indentation. Manual edits handled the rest.

`grep -rn "declaresAgents?:|declaresMcp?:" extensions/ tests/` returns
zero hits.

### Task 5 (B2) -- `refactor(260525-cjr): typed dispatch in 4 reason narrowers` -- commit `d893545`

Files: `orchestrators/types.ts`,
`orchestrators/plugin/{reinstall,update,install}.ts`,
`orchestrators/marketplace/update.ts`, 3 test files.

Mirror the `orchestrators/marketplace/remove.ts::narrowCascadeFailure`
typed-dispatch pattern in four narrower / catch sites that previously
defaulted to misleading closed-set Reasons (typically
`{not in manifest}` or `{unsupported source}`) for any opaque thrown
error.

- **Site 1 (`reinstall.ts`):** Added
  `ReinstallFailedOutcome.reasons?` and a private
  `reasonsFromTypedError(err)` helper. Both catch sites
  (`reinstallPlugin`, `reinstallPlugins`) populate `reasons`; the
  consumer (`outcomeToCascadeRow`) prefers typed reasons over
  `narrowReasons(notes)` while preserving the
  `failureClass=manual-recovery` precedence.
- **Site 2 (`update.ts`):** Extended `reasonsFromTypedError` with
  errno-code branches (EACCES / EPERM / ENOENT / ENOTDIR).
- **Site 3 (`install.ts`):** Extended `narrowResolverReasons` with
  defensive errno-substring branches so opaque notes serialised by
  deeper helpers don't degrade to the permissive `unsupported source`
  fallback.
- **Site 4 (`marketplace/update.ts`):** Added a per-cascade
  `reasonsFromCascadeError(err)` helper invoked at the
  `cascadeAutoupdates` catch site so EACCES throws render as
  `{permission denied}` (not the legacy `{unreadable manifest}`
  fallback).

Test coverage:
- 4 new unit tests on `reinstall.ts::outcomeToCascadeRow` precedence
  locking (typed reasons > notes fallback; manual-recovery still wins
  over typed reasons).
- 9 new unit tests exercising every `narrowResolverReasons` branch in
  `install.ts` including the regression guard that an unclassifiable
  note does NOT silently degrade to `{unsupported source}`.
- 3 new end-to-end tests in `marketplace/update.ts` through
  `updateMarketplace` with a `pluginUpdate` stub that throws EACCES /
  ENOENT / generic Error -- the rendered cascade row carries the
  precise closed Reason (or defers to the legacy `unreadable manifest`
  fallback for the generic case).

### Task 6 (B3) -- `test(260525-cjr): guard scope-order drift outside lint glob` -- commit `749a796`

Files: `tests/architecture/scope-order-drift.test.ts` (NEW),
`extensions/pi-claude-marketplace/edge/completions/provider.ts`.

Added a repo-wide drift guard test that asserts no `extensions/**/*.ts`
file outside the canonical declaration sites (`shared/types.ts`
defines `SCOPES`; `presentation/sort.ts` is the canonical comparator)
contains either of the two duplicated scope-order patterns:
- `["user", "project"]` literal
- `=== "user" ? <n> : <m>` inline scope-rank ternary

Complements the existing ESLint `msg-gr-3-per-scope` rule, which is
scoped to `orchestrators/**` and `edge/handlers/**` only. The new test
runs at test-suite time and covers every TS file under `extensions/`.
Per-line opt-out via a `// scope-order: justified -- <reason>` marker
comment is supported.

**Fixed offender:** `edge/completions/provider.ts:70` was
`["user", "project"]` inline for tab-completion enumeration. Switched
to import-and-use the canonical `SCOPES` constant. The tab-completion
ordering is unchanged.

**Deviation from plan:** The plan mentioned three known offenders but
inspection showed only provider.ts still carried the user-first
literal. `shared/types.ts` is the canonical declaration (allowlisted);
`edge/handlers/plugin/import.ts:45` was already migrated to
`["project", "user"]` (project-first iteration order). The plan's
referenced allowlist file `shared/grammar/pattern-classes.ts` does NOT
contain the literal -- excluded from the allowlist.

### Task 7 (C1) -- `fix(260525-cjr): preserve Error.cause on rollback undo failure` -- commit `35b5f98`

Files: `transaction/phase-ledger.ts`,
`presentation/rollback-partial.ts`, 2 test files.

Extended `RollbackPartial` with `cause?: Error` to preserve the
original undo throw's `Error.cause` chain (previously only `msg` was
recorded, dropping deeper causes attached via
`new Error(msg, { cause })`). The
`composeRollbackPartialChildren` presenter now emits a
4-space-indented depth-5 cause-chain trailer beneath each child row
when `cause` is populated; back-compat preserved when `cause ===
undefined`.

Test coverage: 2 new transaction-layer tests proving the
`Error.cause` chain is preserved on `RollbackPartial.cause` (plus a
defensive test for non-Error throws), and 4 new presentation tests
covering the back-compat path, single-cause trailer, multi-partial
trailers, and empty-array.

### Task 8 (C2) -- `refactor(260525-cjr): split PluginUpdateOutcome on partition` -- commit `5e8ba1a`

Files: `orchestrators/types.ts`,
`orchestrators/marketplace/{shared,update}.ts`,
`orchestrators/plugin/update.ts`, 5 test files.

Replaced the single `interface PluginUpdateOutcome` (with every
partition-specific field marked optional) with a discriminated union
on `partition`. Each variant carries ONLY the fields reachable on that
partition; the compiler refuses to silently read `outcome.fromVersion`
from a skipped outcome. Variants: `PluginUpdateUpdatedOutcome`
(REQUIRED `fromVersion`/`toVersion`/`stagedAgents`/`stagedMcpServers`),
`PluginUpdateUnchangedOutcome` (REQUIRED `fromVersion`/`toVersion`),
`PluginUpdateSkippedOutcome` (REQUIRED `notes`/`reasons`),
`PluginUpdateFailedOutcome` (REQUIRED `notes`, optional
`reasons`/`phaseFailures`).

Both `outcomeToCascadeRow` switches (marketplace + plugin sides) end
with `assertNever(outcome)` for compile-time exhaustiveness.

**Surface-area-impact note:** The change cascaded into 5 test files
(per-partition fixture construction). The largest concentration was in
`tests/orchestrators/marketplace/update.test.ts` -- 6 stub sites,
including one inner `Promise.resolve(...)` that needed per-branch
construction.

### Task 9 (C3) -- `refactor(260525-cjr): collapse install outcome error variants` -- commit `1a14c0f`

Files: `orchestrators/plugin/install.ts`,
`orchestrators/import/execute.ts`, 2 test files.

Collapsed the four pre-C3 error variants of `InstallPluginOutcome`
(`already-installed` / `unavailable` / `uninstallable` /
`unexpected-failure` -- each carrying a re-stringified `cause: string`)
into a single shape:
`{ readonly status: "failed"; readonly error: Error; readonly cause: string }`.

The typed `error` field is the dispatch surface; consumers narrow on
`instanceof PluginShapeError` (and, after C4, on `error.shape.kind`)
to recover the precise failure class without re-parsing the formatted
cause text. The `cause` is preserved for callers that read it for
rendering (orchestrated mode in `import/execute.ts`).

`import/execute.ts` recovers the legacy semantic dispatch via a new
`dispatchFailedOutcome(...)` helper that narrows on `instanceof
ConcurrentInstallError` + `instanceof PluginShapeError` and routes to
the matching pre-C3 bucket (skipped / unavailable warning /
uninstallable warning / unexpected-failure), preserving the
user-visible behavior.

### Task 10 (C4) -- `refactor(260525-cjr): expose readonly shape on PluginShapeError` -- commit `6410c75`

Files: `shared/errors.ts`, 4 orchestrator files,
`tests/shared/errors.test.ts`.

Replaced the pre-C4 optional mirror fields (`marketplace?` /
`reasons?`) with a single `readonly shape: PluginShapeErrorShape`
field that exposes the full discriminated union. Consumers narrow on
`e.shape.kind` to recover shape-specific data without non-null
assertions on the mirror fields (which existed only to compensate for
the absent shape getter). Kept `kind` and `plugin` as convenience
top-level shortcuts -- they appear on EVERY shape variant.

Updated 5 consumers (`classifyEntityShapeError`,
`reasonsFromTypedError` in reinstall and plugin/update,
`reasonsFromCascadeError` in marketplace/update,
`dispatchFailedOutcome` in import/execute) to narrow on
`err.shape.kind`. The B2 typed-dispatch helpers naturally pick up the
new shape without any further refactor.

### Task 11 (C5) -- `fix(260525-cjr): align manifest-field reason predicate with resolver` -- commit `9270a8b`

Files: `orchestrators/plugin/install.ts`,
`tests/orchestrators/plugin/install.test.ts`.

The `MANIFEST_FIELD_REASONS` carve-out in `narrowResolverReasons` was
dead code: the predicate compared the WHOLE resolver note against the
bare set `{"hooks", "lspServers"}`, but the resolver's
`addUnsupportedKindNotes` helper writes the prefix-form
`partial.notes.push(\`contains ${kind}\`)` (resolver.ts:685). Result:
the bare-token check never matched, the row degraded to
`{unsupported source}`, and the catalog's `(unavailable) {hooks}` /
`(unavailable) {lspServers}` shapes were unreachable.

Fix: added a `MANIFEST_FIELD_NOTE_PREFIX = "contains "` constant and a
typed helper `manifestFieldTokenFromNote(note) -> Reason | undefined`
that strips the prefix and re-checks the remaining token against
`MANIFEST_FIELD_REASONS`. Updated `narrowResolverReasons` to call the
new helper as the first branch.

Updated 3 existing tests that built bare-token reasons directly (the
dead-predicate form) to use the live `"contains <kind>"` form,
exercising the actual code path. Added 2 new tests covering the
recognition path with the bare-token output assertion, and 1 new test
asserting that other `"contains <kind>"` values not in the bare-token
set fall through to the legacy `{unsupported source}` fallback.

### Task 12 (C6) -- `refactor(260525-cjr): converge outcomeToCascadeRow on shared helper` -- commit `930dd33`

Files: `presentation/version-arrow.ts` (NEW),
`orchestrators/{marketplace,plugin}/update.ts`,
`tests/presentation/version-arrow.test.ts` (NEW).

Two `outcomeToCascadeRow` implementations diverged on version-slot
formatting:
- `marketplace/update.ts` inlined the
  `\`${fromVersion} → v${toVersion}\`` string directly.
- `plugin/update.ts` had a file-private `composeVersionArrow(from, to)`
  helper.

Lifted `composeVersionArrow` to a new pure-helper module at
`presentation/version-arrow.ts` (single source of truth for MSG-PL-3).
Both call sites now produce byte-equal slot text by construction.

Test coverage: 7 new unit tests exercising every input permutation
including a hash-version pair (PI-7 string-compare regression guard).

### Task 13 (C7) -- `refactor(260525-cjr): assertNever in iconForPluginRow` -- commit `c2faf27`

Files: `presentation/compact-line.ts`.

Replaced the permissive `default -> ⊘` fallthrough in
`iconForPluginRow` with explicit cases for every StatusToken member
that is excluded by the per-row type narrows (`added`, `removed`,
`no marketplaces`, `no plugins`). The `default` arm now ends with
`assertNever(status)` so a future StatusToken addition fails at
compile time inside this switch instead of silently degrading to ⊘.

### Task 14 (C8) -- `test(260525-cjr): malformed-input cases for compact-line` -- commit `74c2242`

Files: `tests/presentation/compact-line.test.ts`.

Added 8 lock-in tests covering well-typed-but-edge-case-valued inputs:
empty version, undefined/empty reasons, Unicode/emoji/CJK in name,
CJK in marketplace, very long name (200 chars), empty name,
mixed-direction (BiDi) text. The renderer is a pure transform; these
tests document the existing behavior so a future refactor cannot
silently regress it.

### Task 15 (C9) -- `test(260525-cjr): same-name cross-scope reinstall ordering` -- commit `f96f19e`

Files: `tests/orchestrators/plugin/reinstall.test.ts`.

Added an integration test that exercises the project-before-user
stable-sort tie-break on `MarketplaceRow.scope` end-to-end through
`reinstallPlugins`. The existing PRL-13 deterministic-sort test uses
DISTINCT marketplace names (a / u / z) so the marketplace-name primary
key never produces same-name pairs; the scope tie-break is therefore
only tested at the unit level on `compareByNameThenScope`. The new
test seeds the SAME marketplace name in BOTH user and project scopes
and asserts both outcome-order AND rendered-body-order place project
first.

### Task 16 (C10) -- `docs(260525-cjr): strip phase-ticket density from comments` -- commit `2fff85f`

Files: 9 files (`presentation/compact-line.ts`,
`presentation/cause-chain.ts`, `presentation/sort.ts`,
`presentation/rollback-partial.ts`, `shared/grammar/reasons.ts`,
`shared/grammar/status-tokens.ts`, `shared/grammar/markers.ts`,
`shared/grammar/pattern-classes.ts`, `shared/errors.ts`).

Stripped historical ticket / plan / phase references from 9 files.
The ticket density rots at milestone-archive time (commit 06c4117 of
the milestone-v1.3 archive demonstrated the pattern). Kept binding
contract sentences (MSG-* / CMC-* live-contract codes, NFR-* refs,
drift-test names); stripped narration (D-XX-YY, Plan NN-NN, Phase NN,
Quick task XXXXXX, and historical "Phase 13's three-file edit" /
"places it here" / "Wave 2 sub-wave 2a continuation" style).

Verification: `grep -nE "D-(CMC|13|14)-[0-9]+|Plan 1[34]-[0-9]+|Phase
1[234](\.[0-9]+)?|Quick task"` across the 9 listed files returns zero
hits.

## Final Verification

```
$ npm run check
...
# tests 1326
# suites 90
# pass 1326
# fail 0
# cancelled 0
# skipped 0
```

- Typecheck: clean (`npx tsc --noEmit` produces no output).
- ESLint: clean (`npm run lint` produces no error or warning).
- Prettier: clean (`npm run format:check` reports "All matched files
  use Prettier code style!").
- Tests: 1326/1326 pass (baseline 1249 + 77 new tests added across
  Tasks 2, 3, 5, 6, 7, 11, 12, 14, 15).
- Commit history: 16 atomic commits on `worktree-agent-abf11c1b5473e2d0b`
  in the documented order (A1 → A2 → A3 → B1 → B2 → B3 → C1 → C2 →
  C3 → C4 → C5 → C6 → C7 → C8 → C9 → C10). Each commit is
  independently revertible; the only intentional inter-fix dependency
  is B2 → C4 (documented in the plan).

## Deviations from Plan

1. **Task 3 (A3):** The plan referenced a `PluginShapeError`
   `instanceof` check inside the catch, but `resolveStrict` does not
   throw `PluginShapeError` (only `requireInstallable` does, and `list`
   calls `resolveStrict` directly). The classifier instead
   discriminates on Node errno codes, which is the actual surface the
   catch sees. The user-visible goal (precise Reason classification
   instead of misleading `{unsupported source}`) is preserved.

2. **Task 6 (B3):** The plan mentioned three known offenders. Only
   one (`edge/completions/provider.ts:70`) still carried the
   user-first literal at execution time; the other two
   (`shared/types.ts` is canonical; `edge/handlers/plugin/import.ts`
   was already project-first) did not need changes. The
   `shared/grammar/pattern-classes.ts` file the plan listed as a
   possible allowlist entry does NOT contain the literal and was
   excluded from the allowlist.

3. **Task 8 (C2):** Surface-area impact larger than initial estimate
   (9 files modified, 6 test stub sites updated). Documented in the
   commit message and the test-fixture refactor used per-partition
   construction so the discriminated union's required fields are
   visible at every fixture site.

## Trufflehog scan note

Per CLAUDE.md `Git` section, every commit was prefixed with
`SKIP=trufflehog`. Running `pre-commit run trufflehog --all-files`
from inside the worktree fails with `failed to read index file:
open .git/index: not a directory` because trufflehog cannot
read its own `.git` file (worktree `.git` is a file, not a
directory). This is the documented worktree sandbox limitation in
CLAUDE.md -- the underlying scan would pass; running the scan from
the main repo checkout after merge is the recommended verification.
No new secrets were introduced (no API keys, no credentials, no
high-entropy hex strings added by any commit -- the only hex strings
modified are the `abcdef...` fixture SHAs in `update.test.ts` which
predate this work).
