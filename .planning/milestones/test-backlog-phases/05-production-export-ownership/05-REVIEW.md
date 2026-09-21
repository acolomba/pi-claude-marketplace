---
phase: 05-production-export-ownership
reviewed: 2026-09-15T05:20:00Z
depth: deep
diff_base: 2c67f391
files_reviewed: 120
files_reviewed_list:
  - .fallowrc.json
  - eslint.config.js
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/index.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-compact.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-compact.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-end.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/session-start.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/stop-failure.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/stop.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/user-prompt-submit.ts
  - extensions/pi-claude-marketplace/bridges/hooks/stage.ts
  - extensions/pi-claude-marketplace/bridges/skills/index.ts
  - extensions/pi-claude-marketplace/bridges/skills/unstage.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin-path.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
  - extensions/pi-claude-marketplace/persistence/config-io.ts
  - extensions/pi-claude-marketplace/persistence/state-io.ts
  - extensions/pi-claude-marketplace/platform/README.md
  - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
  - extensions/pi-claude-marketplace/platform/git-credential.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/shared/completion-cache.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - scripts/check-phase-06-hub-ledger.mjs
  - tests/architecture/closed-set-enrollment.test.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/config-state-consistency.test.ts
  - tests/architecture/cross-op-convergence.test.ts
  - tests/architecture/cross-surface-reason-parity.test.ts
  - tests/architecture/fallow-production-mode.test.ts
  - tests/architecture/gate-targets.ts
  - tests/architecture/hooks-foundation.test.ts
  - tests/architecture/hooks-translators.test.ts
  - tests/architecture/no-credential-leak.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/architecture/partial-vocabulary-guard.test.ts
  - tests/architecture/unowned-exports-census.test.ts
  - tests/bridges/hooks/index.test.ts
  - tests/bridges/hooks/payloads/post-compact.test.ts
  - tests/bridges/hooks/payloads/post-tool-use-failure.test.ts
  - tests/bridges/hooks/payloads/post-tool-use.test.ts
  - tests/bridges/hooks/payloads/pre-compact.test.ts
  - tests/bridges/hooks/payloads/pre-tool-use.test.ts
  - tests/bridges/hooks/payloads/session-end.test.ts
  - tests/bridges/hooks/payloads/session-start.test.ts
  - tests/bridges/hooks/payloads/stop-failure.test.ts
  - tests/bridges/hooks/payloads/stop.test.ts
  - tests/bridges/hooks/payloads/user-prompt-submit.test.ts
  - tests/bridges/hooks/stage.test.ts
  - tests/bridges/skills/index.test.ts
  - tests/bridges/skills/unstage.test.ts
  - tests/index.test.ts
  - tests/integration/auth-e2e.test.ts
  - tests/integration/concurrent-install-child.ts
  - tests/integration/fold-adoption.test.ts
  - tests/integration/hooks-cross-scope-reconcile.test.ts
  - tests/integration/load-reconcile-race-child.ts
  - tests/integration/transaction-lifecycle-cascade.test.ts
  - tests/orchestrators/auth-host.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin-path.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/fetch.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/install.messaging.test.ts
  - tests/orchestrators/plugin/operations.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/reinstall-replace.test.ts
  - tests/orchestrators/plugin/reinstall.messaging.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/backfill.test.ts
  - tests/orchestrators/reconcile/reconcile.messaging.test.ts
  - tests/persistence/config-io.test.ts
  - tests/persistence/state-io.test.ts
  - tests/platform/git-auth-callbacks.test.ts
  - tests/platform/git-credential.test.ts
  - tests/platform/git.test.ts
  - tests/scripts/check-phase-06-hub-ledger.test.ts
  - tests/shared/completion-cache.test.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/notification-summary.test.ts
  - tests/shared/notification-types.test.ts
  - tests/shared/notify-reasons.test.ts
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 5 (waves 5-11): Code Review Report

**Reviewed:** 2026-09-15T05:20:00Z
**Depth:** deep (cross-file, with two live analyzer probes)
**Diff base:** `2c67f391..HEAD`, paths `extensions/ tests/ scripts/ eslint.config.js .fallowrc.json`
**Files Reviewed:** 120
**Status:** issues_found

## Summary

I read the complete content diff for every non-test file in scope (54 production files plus
`.fallowrc.json` and `eslint.config.js`), and the content diff for 28 of the 65 test files,
selecting the ones where an assertion could plausibly have been weakened by a move or a
privatization. Two findings are backed by live probes against the installed analyzer in an
isolated scratch fixture (no repository file was touched).

What I checked and could **not** fault:

- **The payload-translator renames are identifier-only.** All ten module bodies are otherwise
  unchanged, and the two dispatch tables in `dispatch-exec.ts` and `async-rewake/registry.ts`
  map each new name to the same event it had before.
- **`buildAuthCallbacks` moved byte-identically.** `diff` of the old `platform/git.ts` region
  against `platform/git-auth-callbacks.ts` shows no change to the state machine, and the eight
  moved tests in `tests/platform/git-auth-callbacks.test.ts` are byte-identical to the block
  they came from (one trailing newline aside).
- **The four notification vocabularies did not drift.** I extracted the old `as const` tuples
  and the new bare unions mechanically and compared: membership *and* order are identical for
  all 44 / 24 / 19 / 7 members.
- **The `outcomeToPluginMessage` scope-bracket removal is a real dead branch**, not a rendering
  change: `renderReinstallPartitionAndNotify` keys its blocks on `${outcome.scope}:${marketplace}`
  and sets `block.scope = outcome.scope`, so the removed `rowScope` was always `undefined`.
- **`cross-surface-reason-parity` did not lose strength.** `classifyEntityShapeError`'s
  `not-installable` arm passes `reasons`/`unsupportedKinds`/`partialable` straight to
  `narrowResolverReasons` and returns the result verbatim, so the new proxy is exact.
- **The `RingBuffer.read` annotation is justified and narrow.** `registry.ts:445-446` really
  does read it twice through `entry.stderrBuffer` / `entry.stdoutBuffer`, and the annotation
  names the `unused-class-member` class only.
- **The retired `listBranches` / `listRemotes` / `check-phase-06-hub-ledger.mjs` have no
  remaining caller** anywhere outside `.planning/`, and the retirements carry `@ts-expect-error`
  proofs.
- **NFR-2 and lock re-entrancy are intact.** `index.ts`'s `resources_discover` double try/catch
  is unchanged, and `ENABLE_DISABLE_TRANSACTION.runInstallLedger` still binds the guard-free
  ledger body, exactly as `REAL_ENABLE_DISABLE_TRANSACTION` did.

The five warnings below are all of the class the phase brief named: a gate or an invariant that
stopped covering what it was written for, or a documented claim the source contradicts. None is
a shipped-behaviour defect I can demonstrate with an input, which is why nothing is Critical.

## Warnings

### WR-01: Production dead-code mode silently un-gates the whole `tests/` and `scripts/` trees, including circular-dependency detection

**File:** `.fallowrc.json:2-6`; claim contradicted at `tests/architecture/import-boundaries.test.ts:150-166` and `.planning/codebase/ARCHITECTURE.md` ("Circular imports: cycle detection is now whole-repo")
**Severity:** WARNING

**Issue:** 05-28 changed `"production": false` to `"production": { "deadCode": true, ... }`.
`fallow dead-code --help` documents production mode as "exclude test/story/dev files", and
circular-dependency detection is one of the issue classes `dead-code` computes. The phase added
controls proving `health` and `dupes` kept their test-inclusive scope
(`tests/architecture/fallow-production-mode.test.ts:340-388`), but added nothing for the
`dead-code` classes that are *not* about production reachability: circular dependencies,
re-export cycles, unresolved imports, unused files, and stale suppressions over `tests/`.

I measured it. In an isolated fixture carrying a production entry plus a two-file cycle under
`tests/`:

```
production: false                      -> "Circular dependencies (1)", exit 1
production: { deadCode: true, ... }     -> "No issues found", exit 0
```

The same cycle planted between two production-reachable files still exits 1, so the loss is
scoped exactly to `tests/` and `scripts/`.

This matters because `tests/` is not a thin tree here: it holds reusable fakes, the
`gate-targets.ts` registry, `source-scan.ts`, `fallow-report.ts`, and per-concern contract
modules. A cycle among those is a real TDZ hazard, and this phase itself deleted ~300 lines of
registry entries from `gate-targets.ts` — exactly the kind of change that leaves an orphaned
helper behind. `tests/architecture/import-boundaries.test.ts:166` still asserts the npm script
shape under the title "whole-repo cycle detection", and its rationale comment still reads
"whole-repo cycle detection must stay unfiltered"; that title is now false, and the test cannot
see the change because it inspects the argv, not the config.

**Fix:** Either restore whole-tree dead-code scope and gate production reachability some other
way, or — if the narrowing is intended — make the loss explicit and re-cover the classes that
were never about production reachability. Concretely:

1. Correct `import-boundaries.test.ts:150-166` and `.planning/codebase/ARCHITECTURE.md` so
   neither claims whole-repo cycle detection.
2. Add a second gated invocation for the test tree, e.g. a `fallow dead-code --no-production
   --circular-deps --fail-on-issues` step in the `fallow` npm script (the existing
   `ALLOWED_DEAD_CODE_TOKENS` allow-list in `import-boundaries.test.ts:205-218` will need the
   new tokens, and per its own instructions only after measuring that a planted cycle still
   exits 1).
3. Add a control to `fallow-production-mode.test.ts` in the shape of the two new scope cases:
   plant a cycle under `tests/` in the fixture and assert the shipping command reports it.

### WR-02: The credential-leak gate now scans `platform/git.ts`, which contains zero `hookDebugLog` call sites, and still has no non-empty-subject control

**File:** `tests/architecture/no-credential-leak.test.ts:319-356`
**Severity:** WARNING

**Issue:** The gate was re-aimed correctly — `platform/git-auth-callbacks.ts` was appended to
`CREDENTIAL_LEAK_TARGETS` (`tests/architecture/gate-targets.ts:412-417`) and the loop now scans
both files. But the repair did not add the guard that would stop the same failure recurring.
Measured:

```
grep -c hookDebugLog extensions/pi-claude-marketplace/platform/git.ts             -> 0
grep -c hookDebugLog extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts -> 9
```

`git.ts` is scanned over zero call sites and reports success, which is precisely the state that
let the original regression sit unnoticed. Nothing in the test asserts that the scanned set
contains at least one `hookDebugLog(` call site, so the next relocation of `buildAuthCallbacks`
(or a rename of `hookDebugLog`) leaves both files clean and the AUTH-09 gate silently inert
again. The file already applies this discipline elsewhere —
`no-credential-leak.test.ts:170-178` asserts `CREDENTIAL_LEAK_TARGETS.length > 0` and pins the
positional order, and `no-lifecycle-default-enabled-read.test.ts:131` carries the explicit
D-07-03 "an empty target group makes the scan report success over zero files" assertion.

**Fix:** Assert the subject is non-empty across the scanned set, so the gate fails when the
construct it guards disappears from every file it looks at:

```ts
const HOOK_DEBUG_CALL = /hookDebugLog\s*\(/g;
let scannedCallSites = 0;
for (const rel of [GIT_PLATFORM_FILE, GIT_AUTH_CALLBACKS_FILE]) {
  const stripped = stripComments(await readFile(path.join(REPO_ROOT, rel), "utf8"));
  scannedCallSites += [...stripped.matchAll(HOOK_DEBUG_CALL)].length;
  // ... existing two checks ...
}
assert.ok(
  scannedCallSites > 0,
  "AUTH-09: no hookDebugLog call site exists in any scanned file, so both checks above passed over nothing. Re-aim the gate at the module that now carries the calls.",
);
```

### WR-03: `loadState` / `saveState` / `loadConfig` / `saveConfig` were converted from a fail-closed type guard to a fail-open error probe, and the test that pinned the closed behaviour was deleted

**File:** `extensions/pi-claude-marketplace/persistence/state-io.ts:458-466` and `485-490`; `extensions/pi-claude-marketplace/persistence/config-io.ts:153-163` and `186-191`
**Severity:** WARNING

**Issue:** All four boundaries previously read `if (!VALIDATOR.Check(value)) { reject }`, where
`Check` is TypeBox's type guard (`value is Static<T>`), and the detail formatter carried an
explicit `if (!first) return "(no detail available)"` arm for the case where `Check` failed but
`Errors` produced nothing. This phase inverted the predicate to
`const [err] = VALIDATOR.Errors(value); if (err !== undefined) { reject }` and replaced the
narrowing with an unchecked assertion (`parsed as ScopeConfig`, `normalized as ExtensionState`).

Two things changed, neither of which any gate can see:

1. **Direction of failure.** `Check`-fails-but-`Errors`-empty used to be rejected with
   `"(no detail available)"`. It is now **accepted**. `loadConfig` would return
   `{ status: "valid", config: <the rejected value> }` — for the deleted test's own input, that
   is `config: null` typed as `ScopeConfig`, which every consumer then dereferences.
   `saveState` would write a state.json its own docstring
   (`state-io.ts:477-483`) promises to refuse: "a caller bug … surfaces here instead of
   producing a corrupt state.json on disk."
2. **Who proves the shape.** The compiler proved it before; a comment proves it now
   (`config-io.ts:162`: "Errors uses the same compiled schema; no issues proves this parsed JSON
   has the public shape"). That comment is not accurate: in `typebox@1.3.28`,
   `Validator.Errors` short-circuits to `[]` only on the accelerated path
   (`node_modules/typebox/build/compile/validator.mjs:57-61`); otherwise it delegates to the
   dynamic `Value.Errors` walk, which is a different implementation from `Value.Check`.

The tests that pinned the old closed behaviour were removed in the same change:
`tests/persistence/config-io.test.ts` lost "uses the no-detail fallback when validation exposes
no errors", and `tests/persistence/state-io.test.ts` lost both "formats a root validator failure
through the public loader" and "uses the no-detail fallback when an invalid save has no
validator errors". They were the only cases exercising the divergence.

I could not construct an input that makes `Check` and `Errors` disagree on these schemas
(`IsAccelerated()` returns `true` here, so the accept path is equivalent today), which is why
this is a WARNING and not a BLOCKER. The defect is that a deliberate fail-closed guard on the
persistence boundary was traded for a coverage-shaped fail-open one.

**Fix:** Keep `Check` as the guard, and derive the message from `Errors` with a branch-free
formatter so no uncoverable arm reappears:

```ts
function firstValidationErrorDetail(errors: readonly TLocalizedValidationError[]): string {
  return errors
    .slice(0, 1)
    .map((e) => `${e.instancePath || "<root>"}: ${e.message}`)
    .join("");
}

if (!STATE_VALIDATOR.Check(normalized)) {
  throw new Error(
    `state.json at ${stateJsonPath} failed schema validation: ${firstValidationErrorDetail(STATE_VALIDATOR.Errors(normalized))}`,
  );
}
// `normalized` is narrowed by the guard -- no `as` needed.
```

This restores the guard and the narrowing, keeps the exact message format for every real error
(the 35 existing `failed schema validation` assertions in `tests/` are unaffected), and has no
branch that a test cannot reach.

### WR-04: `operations.ts` claims to be "the single place that binds those contracts", but reinstall has a second production binding that the user-facing verb actually uses

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts:3-7` and `123-128`; second binding at `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts:216-226`, reached from `extensions/pi-claude-marketplace/edge/register.ts:90`
**Severity:** WARNING

**Issue:** The module header states: "this owner is the single place that binds those contracts
to the concrete Node implementations, so a command boundary asks for an operation rather than
assembling one." For reinstall that is not true. Two functions bind
`REAL_REINSTALL_TRANSACTION` with identical bodies:

```ts
// operations.ts:127
return createReinstallPlugin(REAL_REINSTALL_TRANSACTION, hooksRouting, completionCache);
// reinstall-flow.ts:225 (module-private, reached via createNodeReinstallPlugins)
return createReinstallPlugin(REAL_REINSTALL_TRANSACTION, hooksRouting, completionCache);
```

`orchestrators/reconcile/backfill.ts:214` uses the first. `edge/register.ts:90` — a command
boundary, the exact caller the header says should not assemble one — uses the second, so the
`/claude:plugin reinstall` verb the user types does not go through the composition owner at all,
and `tests/orchestrators/plugin/operations.test.ts`'s reinstall coverage does not exercise the
user-facing path.

Failure scenario: someone later changes the composition owner's reinstall binding (a different
transaction member, an added collaborator, a wrapper). `npm run check` stays green, backfill
reinstall gets the new behaviour, and the `/claude:plugin reinstall` command silently keeps the
old one. I recognise the split is deliberate (05-18 scoped the owner to backfill and kept the
bulk wrapper private) — the defect is that the header asserts an invariant the tree does not
hold, and the duplicated binding has no gate keeping the two in step.

**Fix:** Either move the bulk composer into `operations.ts` as
`createReinstallOperations(hooksRouting, completionCache)` and have `edge/register.ts` import it
(deleting the private `createNodeReinstallPlugin`), or amend the `operations.ts` header to state
the true scope — which verbs it owns, and that reinstall's bulk form is bound in
`reinstall-flow.ts` for a named reason. The first option is preferable; it removes the second
binding rather than documenting it.

### WR-05: The two new "only place this glyph reaches a row" comments are contradicted by the same file, and the compat-01 docstring repeats the claim

**File:** `extensions/pi-claude-marketplace/shared/notification-grammar.ts:72-75` and `98-101`; contradicted at `1277` and `1281`; claim repeated at `tests/architecture/compat-01-no-expansion.test.ts:136-141` and `421`
**Severity:** WARNING

**Issue:** 05-23 privatized `ICON_REMOTE` and `ICON_PARTIALLY_AVAILABLE` and justified each with:

> Module-private: `renderRemoteRow` below is the only place this glyph reaches a row, so that
> row's bytes are its public contract.

Both glyphs have a **second** production carrier in the same module:
`pluginInfoStatusGlyph` (`notification-grammar.ts:1260-1289`) returns `ICON_REMOTE` for
`status: "remote"` (line 1277) and `ICON_PARTIALLY_AVAILABLE` for
`status: "partially-available"` (line 1281), and it is invoked from the `info` row renderer at
line 1432. The compat-01 header repeats the error — "the two that are module-private are pinned
through the rows that carry them", "Their public carriers are the two row renderers" — and the
new test at line 421 pins only `renderRemoteRow` / `renderPartiallyAvailableRow`.

The code-point pin still functions today, because both paths read the same constant, so a
changed code point fails the test through the row renderers. The defect is the ownership claim:
a reader reasoning about blast radius from these comments will conclude the `info` surface does
not carry these glyphs, and a future edit that gives `pluginInfoStatusGlyph` its own literal (or
its own eighth glyph constant, which the declaration-count clause would catch but the code-point
clause would not attribute) is exactly the change the comments say is impossible.

**Fix:** Correct all three comments to name both carriers, and extend the new clause so the
`info` path is pinned in its own right:

```ts
// notification-grammar.ts
 * Module-private: two renderers carry this glyph to output -- `renderRemoteRow`
 * below and `pluginInfoStatusGlyph`'s `remote` arm -- so those rows' bytes are
 * its public contract.
```

and add the `info`-row byte assertion alongside the two existing ones in the
`"COMPAT-01: the two module-private glyphs reach the output on their own rows"` case.

## Info

### IN-01: Comments across six modules still name `REASONS`, `STATUS_TOKENS`, and `PLUGIN_STATUSES`, which no longer exist

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts:355,432`; `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts:26-27,81`; `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts:435`; `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:38`; `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:176`; `extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts:144`
**Severity:** WARNING-adjacent, filed as Info

**Issue:** 05-23 replaced the four runtime tuples with bare unions and updated the comments in
`notification-types.ts`, `notification-dispatch.ts`, and `notify-reasons.ts`, but not the six
call-site modules above. `install.messaging.ts:432` is the worst of them — it instructs a future
author to "have an entry in `MANIFEST_FIELD_TO_REASON` below mapping them to a member of the
closed `Reason` set in `shared/notification-types.ts::REASONS`", naming a symbol that is gone.
Separately, `persistence/migrate.ts:122,159,175,201` and `persistence/config-write-back.ts:61`
describe the validation contract as `STATE_VALIDATOR.Check` / `CONFIG_VALIDATOR.Check`, which is
no longer the call the code makes (see WR-03).

**Fix:** Replace the tuple names with the type names (`Reason`, `StatusToken`, `PluginStatus`),
and re-word the `migrate.ts` / `config-write-back.ts` references to describe the validation step
rather than a specific method name.

### IN-02: `tests/scripts` was deleted but is still a member of the `node --test` brace glob

**File:** `package.json` `scripts.test` and `scripts["test:coverage:unit"]` (the directory removal is in this diff: `tests/scripts/check-phase-06-hub-ledger.test.ts`)
**Severity:** Info

**Issue:** Both globs still read
`"tests/{architecture,bridges,domain,edge,orchestrators,persistence,platform,scripts,shared,transaction}/**/*.test.ts"`,
and `tests/scripts/` no longer exists. `partial-vocabulary-guard.test.ts:66-85` was correctly
updated to drop `scripts` from `POLICED_TEST_ROOTS` with an explanatory note; the npm globs were
not. It is harmless today (the brace member matches nothing) but it is a stale claim about the
suite's shape, and it means a future `tests/scripts/` file would be picked up by the runner
while sitting outside the policed roots.

**Fix:** Drop `scripts` from both brace lists, or re-create the directory with content if a
scripts suite is expected to return.

### IN-03: `buildAuthCallbacks` documents a `deviceFlowAttempted` closure variable that does not exist

**File:** `extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts:66-70` and `118-125`
**Severity:** Info

**Issue:** Both the JSDoc ("The factory owns a closure-scoped `deviceFlowAttempted` flag (set
when `onAuthRequired` returns `{ ok: true }`)") and the inline CP-9 note describe a variable the
function body never declares. This is pre-existing — the same prose sat in
`platform/git.ts:379,433` before the move — but 05-21 copied it verbatim into a brand-new module
whose whole stated purpose is to "own the complete protocol", which is the moment to have caught
it.

**Fix:** Delete the two references to the non-existent flag and keep only the CP-9 statement
that `onAuthFailure` unconditionally returns `{ cancel: true }`.

### IN-04: The read-only `info` and `fetch` commands now load the whole install/uninstall/reinstall/enable graph (design note, not a defect)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts:14-42`; entered from `extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts:10` and `.../fetch.ts:18`
**Severity:** Info — this one is a matter of taste, ranked last

**Issue:** Binding all six operations in one module means importing `operations.ts` for
`getPluginInfo` also evaluates the module graph of `install-flow.ts`, `uninstall.ts`,
`reinstall-flow.ts`, `enable-disable.ts`, `transaction/`, and `../marketplace/shared.ts` — which
re-exports `DEFAULT_GIT_OPS` and therefore `platform/git.ts` and `isomorphic-git`. NFR-5 is not
violated: it forbids network *access*, `operations.ts` is now in `NETWORK_FREE_TARGETS`, and
none of the forbidden tokens appear in it. The whole graph is loaded by `index.ts` anyway. I
note it only because the phase's own network-gate registry exists to keep git out of the
read-only verbs' *reach*, and centralised composition moves that reach in the opposite
direction. If the operator prefers the current shape for composition clarity — which is a
defensible trade — no change is needed.

**Fix (optional):** Split the two read-only value bindings (`fetchPlugins`, `getPluginInfo`)
into a sibling `operations-read.ts` that imports only `fetch.ts`, `info.ts`, and
`git-source-probe.ts`, and add it to `NETWORK_FREE_TARGETS`.

---

_Reviewed: 2026-09-15T05:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
