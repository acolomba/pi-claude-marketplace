---
phase: 02-uninstall-data-disposition-and-the-uninstall-option-seam
reviewed: 2026-09-14T18:12:28Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/edge/flag-catalog.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/edge/handlers/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - tests/architecture/flag-catalog-drift.test.ts
  - tests/edge/flag-catalog.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/edge/handlers/shared.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
findings:
  critical: 1
  warning: 7
  info: 5
  total: 13
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-09-14T18:12:28Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

The change adds a `--keep-data` opt-out to `/claude:plugin uninstall` and generalizes
`extractLocalFlag` into a consuming scanner. The scanner rewrite is behavior-preserving
for the six legacy callers (traced token by token against the pre-change implementation);
`npx tsc --noEmit` is clean and the three flag-related suites pass (72/72).

The defects are not in the mechanics of the flag, they are in the blast radius of the
default it opts out of. `keepData` defaults to deletion on **every** call site, including
the one call site that has no human in the loop — the load-time reconcile. The opt-out
is also wired with a hand-written literal that fails **open** (toward deletion) on a
catalog rename, is absent from the only user-visible help surface, and does not extend to
the two sibling verbs that destroy the very same directory. Separately, the default
deletion path can throw a `SymlinkRefusedError` out of the command handler *after* the
state commit — a fixture the new tests construct but only exercise on the branch where
the throw cannot fire.

## Critical Issues

### CR-01: Load-time reconcile destroys persistent plugin data with no user action and no opt-out

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:350-358`
(reached via `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:799`)
**Issue:**
`applyPluginUninstalls` calls `uninstallPlugin({...})` without `keepData`, so
`opts.keepData ?? false` resolves to `false` and `runPostUninstallCleanup` runs
`rm(dataDir, { recursive: true, force: true })`. `tests/orchestrators/reconcile/apply.test.ts:1271`
now asserts this explicitly (`dataExistsAfterFirst === false`).

The trigger is not a user command. It is `resources_discover`, which fires on every
`/reload` and session start. A `git pull` that removes a plugin entry from a tracked
`claude-plugins.json`, a merge, a branch switch, or a hand-edit typo is enough: the next
reload silently and irreversibly deletes that plugin's entire persistent data tree.
There is no prompt, no notification distinguishing the deleting branch from the
preserving one (see WR-06), and no way to opt out, because reconcile has no command line.

The catalog's stated justification — "the load-time reconcile ... takes the same deletion
default, because it has no command line to carry the flag" (`docs/output-catalog.md:785`)
— is a restatement of the constraint, not a reason. The absence of a way to say "keep"
does not make "delete" the correct default; for a non-interactive convergence pass the
safe default is the reversible one. The phase shipped an opt-out and then made it
unreachable on the exact path where an opt-out matters most.

This behavior predates the change and is sanctioned by DATA-03 / D-02-04. It is filed as
a blocker anyway because the phase's whole subject is uninstall data disposition, the
decision is the one thing in scope that risks unrecoverable user data, and the phase is
the natural place to close it.

**Fix:**

```ts
// orchestrators/reconcile/apply.ts
const result = await uninstallPlugin({
  ctx: opts.ctx,
  pi: opts.pi,
  scope: op.scope,
  cwd: opts.cwd,
  marketplace: op.marketplace,
  plugin: op.plugin,
  // DATA-03: reconcile converges a config the operator may not have edited
  // himself (a pull, a merge, a branch switch). Destroying the data tree is
  // reserved for the explicit `uninstall` command, where the operator typed
  // the verb and can spell the disposition.
  keepData: true,
  notifications: { mode: "orchestrated" },
});
```

If the deletion default must stay, it needs a second gate that the operator controls (a
`claude-plugins.json` setting, or a pending-preview confirmation) plus a
`(uninstalled) {data removed}`-class reason on the reconcile row so the destruction is at
least reported. Silent + automatic + irreversible is the combination to break.

## Warnings

### WR-01: The `--keep-data` literal is duplicated in the handler and fails open toward deletion

**File:** `extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts:24,54`
**Issue:**
The accepted-flag list is derived from the catalog (`passThroughFlagNames("uninstall")`),
but the mapping to the option field is a separate hand-written literal:

```ts
const KEEP_DATA_FLAG = "--keep-data";
...(localFlag.consumedFlags.has(KEEP_DATA_FLAG) && { keepData: true }),
```

Rename the catalog entry (say to `--preserve-data`) and the two halves silently diverge:
the scanner consumes the new spelling, `consumedFlags.has("--keep-data")` returns `false`,
`keepData` is omitted, and the command **deletes the data the operator asked to keep**
while reporting success. The failure mode of a desynchronized literal here is data
destruction, not a usage error.

`tests/architecture/flag-catalog-drift.test.ts:119` pins `uninstall: ["--keep-data", "--local"]`
and would catch a rename — but only that one test stands between the rename and the data
loss, and the flag-catalog header comment claims this gate is derived "BY CONSTRUCTION"
(`edge/flag-catalog.ts:13-14`), which is only half true.

**Fix:** export the name from the catalog so a rename is a compile-time break at the
mapping site, not a runtime no-op:

```ts
// edge/flag-catalog.ts
const KEEP_DATA_FLAG_ENTRY: FlagEntry = {
  name: "--keep-data",
  description: "Preserve the plugin's persistent data directory",
  parse: true,
  complete: true,
};
export const KEEP_DATA_FLAG = KEEP_DATA_FLAG_ENTRY.name;
// ...CATALOG.uninstall: [KEEP_DATA_FLAG_ENTRY, WRITE_TARGET_FLAG_ENTRY],

// edge/handlers/plugin/uninstall.ts
import { KEEP_DATA_FLAG, passThroughFlagNames } from "../../flag-catalog.ts";
```

This mirrors how `SCOPE_TARGET_FLAG` is already exported for `extractLocalFlag`.

### WR-02: The user-visible top-level help still documents the old uninstall flag set

**File:** `extensions/pi-claude-marketplace/edge/router.ts:95`
**Issue:**
`TOP_LEVEL_USAGE` is the block printed for bare `/claude:plugin` and for an unrecognized
subcommand. It carries per-verb extra flags — `enable` and `disable` both list `[--local]`
on lines 102-103 — so it is a flag-documenting surface, not a verb index. Its uninstall
line still reads:

```
"  uninstall <plugin>@<marketplace> [--scope user|project]\n"
```

`--keep-data` is missing (so is `--local`, which predates this change). The only places an
operator can learn the opt-out exists are tab completion and the error text printed after
a malformed command — neither of which he reaches on the run that destroys his data.

Nothing gates this. `flag-catalog-drift.test.ts` reconciles catalog ↔ completions ↔
parse-sets; it never reads `TOP_LEVEL_USAGE` or any handler `USAGE` string, so the
catalog's single-source-of-truth claim does not reach the help text.

**Fix:**

```ts
"  uninstall <plugin>@<marketplace> [--scope user|project] [--keep-data] [--local]\n" +
```

and add a fourth reconciliation to `tests/architecture/flag-catalog-drift.test.ts`:
assert each catalog verb's `complete: true` names appear in that verb's `TOP_LEVEL_USAGE`
line, so the next flag addition cannot ship undocumented.

### WR-03: Consuming and non-consuming scanner modes disagree on a flag in the scope-value position, contradicting the adjacent comment

**File:** `extensions/pi-claude-marketplace/edge/handlers/shared.ts:92-95`
**Issue:**

```ts
// Preserve the legacy removal of --local even when it was a scope value.
const residualArgs = residualTokens
  .filter((token) => consuming || token !== SCOPE_TARGET_FLAG)
  .join(" ");
```

The comment states an unconditional property; the predicate short-circuits on `consuming`,
so the removal is preserved for the five array-form callers and **dropped** for the
consuming caller. Same input, two outcomes:

- `install --scope --local foo@bar` → residual `--scope foo@bar` → `Invalid --scope value: "foo@bar"`
- `uninstall --scope --local foo@bar` → residual `--scope --local foo@bar` → `Invalid --scope value: "--local"`

The consuming message is the better of the two, so this reads as a deliberate improvement
that was applied to one verb and then described by a comment that denies it happened.
`tests/edge/handlers/shared.test.ts:344-363` locks the consuming behavior, and
`tests/edge/handlers/shared.test.ts:136` locks the legacy behavior, so the divergence is
pinned in two places with nothing naming it as intentional.

**Fix:** state the split in the comment, and prefer converging the two modes:

```ts
// Consuming callers keep a scope-value token verbatim so the downstream parser
// can name the offending value; array-form callers strip every SCOPE_TARGET_FLAG
// token regardless of position (their downstream parser cannot).
```

### WR-04: The `--keep-data` promise is scoped to one verb; two sibling verbs still hard-delete the same directory

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:615`,
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts:274-277`
**Issue:**
`<scopeRoot>/pi-claude-marketplace/data/<mp>/<plugin>` is destroyed by three code paths.
This phase gave one of them an opt-out:

| Path | Opt-out |
| --- | --- |
| `uninstall` (`orchestrators/plugin/uninstall.ts:485-493`) | `--keep-data` |
| `marketplace remove` (`remove.ts:615`, per unstaged plugin, then `marketplaceDataDir`) | none |
| `reinstall` (`reinstall-replace.ts:274-277`, post-commit maintenance) | none |

`marketplace remove` is strictly more destructive than `uninstall` — it deletes every
plugin's data under the marketplace — and offers no way to keep any of it. `reinstall` is
worse for surprise: an operator reinstalling a plugin to repair a broken artifact is not
asking to lose his session data, and nothing in the command name says he will.

DATA-01 as written ("preserve the plugin's persistent data directory") is therefore true
of one verb only, and the operator has no way to infer which.

**Fix:** either thread `keepData` through `removeMarketplace` and the reinstall
maintenance step (same option-bag shape, default unchanged), or record explicitly in
`docs/output-catalog.md` that the opt-out is uninstall-only and that `reinstall` and
`marketplace remove` always discard data, so the gap is a stated contract rather than a
discovery.

### WR-05: Data retained by `--keep-data` has no supported removal path afterwards

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:771-773,793-800`
**Issue:**
`runPostCommitCleanup` — the only code that deletes the data dir on this path — is
reached only after a successful record removal. Once `uninstall --keep-data` has removed
the installation record, a second `uninstall` finds `installed === undefined`, sets
`alreadyGone = true`, and returns through `emitAlreadyGone` at line 771 **before** the
cleanup call at line 793. So the retained tree can never be removed by `uninstall`.

`--delete-data` is deliberately rejected (D-02-05, `docs/output-catalog.md:785`, rationale:
"the default needs no second spelling"), but that rationale assumes the default is always
reachable. After `--keep-data` it is not. The only supported route back is
install-then-uninstall-without-the-flag; otherwise the directory is orphaned for the life
of the scope, invisible to `list`, and not swept by `garbageCollectPluginClones` (which
walks `pluginClonesDir`, not `dataRoot`).

**Fix:** make the deletion reachable when no record exists. Cheapest form: on the
`alreadyGone` standalone arm, run the data-dir removal before emitting the row (the
operator named the target and the record is gone, so there is nothing to strand), or add
the orphan-data sweep to the same reconcile pass that GCs clones.

### WR-06: Both dispositions render byte-identical output, so the irreversible branch is unreported

**File:** `docs/output-catalog.md:785`,
`extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:834-841`
**Issue:**
The catalog states the flag "changes none of the output bytes below -- there is no
retained-data report and no retained-path trailer (D-02-01)", and the code matches: the
`PluginUninstalledMessage` is constructed identically regardless of `keepData`. The
operator who typed `--keep-data` gets no confirmation it took effect (a typo such as
`--keepdata` is rejected, but a future alias drift per WR-01 would not be), and the
operator who forgot it gets no signal that a data tree was just destroyed.

Every other irreversible-vs-reversible distinction in this codebase is carried in the
reasons brace; this one is the only destructive branch with no token at all. The closed
`REASONS` set already carries the machinery (`shared/notification-types.ts::REASONS`).

**Fix:** stamp one reason on the preserving branch so the two outcomes are
distinguishable, e.g. `○ demo v1.0.0 (uninstalled) {data kept}`, and add the catalog state
beside the existing `success` block. This costs one closed-set member and leaves the
default row byte-frozen as D-02-01 requires.

### WR-07: A symlinked data directory makes the default disposition throw out of the command handler after the state commit

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:480-493`
**Issue:**
`locations.pluginDataDir()` runs `assertPathInside`, which refuses **all** symlinks in
every segment from `dataRoot` down to the leaf (`shared/path-safety.ts`, D-14). Verified
directly against the real module:

```
THREW: SymlinkRefusedError | pluginDataDir(mp, hello) contains symlink
  .../data/mp/hello -> .../outside (parent: .../data, target: .../data/mp/hello)
```

That resolution sits deliberately **outside** the `try` ("a containment failure must
propagate"), and `runPostCommitCleanup` is awaited at line 793 with no surrounding catch,
so the error escapes `uninstallPluginWithTransaction` → the edge handler → the Pi command
dispatcher. By then the cascade has run, the state record is deleted, the config layers
are swept and the routes are dropped: **the uninstall succeeded, and the operator sees a
raw `SymlinkRefusedError` instead of the `(uninstalled)` row and the `/reload` hint.**

This predates the change, but the change is what makes it reviewable here: the new test
`tests/orchestrators/plugin/uninstall.test.ts` ("preservation bypasses the data path…")
constructs precisely this fixture — `await symlink(retainedDir, dataDir)` — and then runs
it with `keepData: true`, the one branch that skips `pluginDataDir()` entirely. The test
plants the hazard and exercises the only path on which it cannot fire.

**Fix:** treat a containment refusal on the *cleanup* path as a leak, not a fatal, since
nothing is being written and the durable work already committed:

```ts
if (!keepData) {
  try {
    const dataDir = await locations.pluginDataDir(marketplace, plugin);
    await rm(dataDir, { recursive: true, force: true });
  } catch {
    // D-19-01: post-commit hygiene, including a containment refusal on a
    // symlinked data dir, never becomes the primary user-facing path.
  }
}
```

and add the `keepData: false` half of the symlink case to the orchestrator owner, asserting
the `(uninstalled)` notification still renders and the symlink target survives.

## Info

### IN-01: Handler file header documents the pre-change flag set

**File:** `extensions/pi-claude-marketplace/edge/handlers/plugin/uninstall.ts:3-5`
**Issue:** The header still reads
`/claude:plugin uninstall <plugin>@<marketplace> [--scope user|project]` while `USAGE` on
line 18 carries `[--keep-data] [--local]`. It also calls the shim "Identical shim shape as
install.ts", which is no longer true — install uses the array form, uninstall the
consuming form.
**Fix:** mirror the `USAGE` string in the header and drop or qualify the install
comparison.

### IN-02: `isUnknownFlag`'s allow-list test is unreachable in consuming mode

**File:** `extensions/pi-claude-marketplace/edge/handlers/shared.ts:80-88,99-105`
**Issue:** In consuming mode every member of `acceptedFlags` is consumed and `continue`d at
line 80-84, so `!acceptedFlags.includes(token)` at line 104 is always `true` by the time
`isUnknownFlag` runs. The clause is live only for the array form.
**Fix:** document that the predicate serves both modes and that the second clause is the
array-form allow-list, or split it into two named predicates so neither carries a dead
term.

### IN-03: The consuming overload promises a non-optional `consumedFlags` the implementation types as optional

**File:** `extensions/pi-claude-marketplace/edge/handlers/shared.ts:38-43,55,96`
**Issue:** Overload 1 returns `{ ...; consumedFlags: ReadonlySet<string> }`; the
implementation signature returns `consumedFlags?: ReadonlySet<string>`. TypeScript checks
overload-to-implementation compatibility loosely, so a future edit that returns the
consuming branch without the field compiles clean and breaks
`localFlag.consumedFlags.has(...)` at the call site only at runtime. Exactly the hazard
`orchestrators/plugin/uninstall.ts:564-576` (WR-01) already documents for its own overload
pair.
**Fix:** return a discriminated result type from a single signature, or add a
`satisfies`-style pin in the owner suite that asserts the consuming branch always carries
the field.

### IN-04: The NFR-10 comment now sits above a conditional it no longer describes

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:480-493`
**Issue:** The comment "NFR-10: resolve OUTSIDE the try. `pluginDataDir` is not a path join
-- it runs assertSafeName on both segments and assertPathInside on the result, and a
containment failure must propagate" now precedes `if (!keepData)`. On the `--keep-data`
path none of that runs: the containment assertion is skipped, and with it the only
`assertSafeName(plugin, …)` on the cleanup path (`locations.pluginCacheFile(marketplace)`
above still covers the marketplace name). Harmless today — nothing is written on that
branch — but the comment reads as an invariant and is now a property of one branch.
**Fix:** move the comment inside the `if (!keepData)` block and note that the preserving
branch touches no name-derived path, so it needs no assertion.

### IN-05: The cleanup seam's `typeof` contract does not force a double to observe `keepData`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:168,462-469`
**Issue:** `runPostCommitCleanup: typeof runPostUninstallCleanup` grew a sixth positional
parameter. TypeScript accepts a function of fewer parameters where more are expected, so a
five-parameter stub injected through `UninstallTransaction` still satisfies the seam and
silently ignores the disposition. No current test does this, but the seam no longer makes
it a compile error.
**Fix:** switch `runPostUninstallCleanup` to an options-bag parameter
(`{ completionCache, locations, scope, marketplace, plugin, keepData }`), which makes an
omitted `keepData` a compile error in any double.

---

_Reviewed: 2026-09-14T18:12:28Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
