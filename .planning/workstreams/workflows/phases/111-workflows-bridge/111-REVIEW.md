---
phase: 111-workflows-bridge
reviewed: 2026-09-05T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/workflows/discover.ts
  - extensions/pi-claude-marketplace/bridges/workflows/index.ts
  - extensions/pi-claude-marketplace/bridges/workflows/stage.ts
  - extensions/pi-claude-marketplace/bridges/workflows/types.ts
  - extensions/pi-claude-marketplace/bridges/workflows/unstage.ts
  - extensions/pi-claude-marketplace/persistence/locations.ts
  - extensions/pi-claude-marketplace/shared/errors-bridges.ts
  - extensions/pi-claude-marketplace/shared/extension-version.ts
  - .fallowrc.json
  - tests/bridges/workflows/discover.test.ts
  - tests/bridges/workflows/index.test.ts
  - tests/bridges/workflows/stage.test.ts
  - tests/bridges/workflows/types.test.ts
  - tests/bridges/workflows/unstage.test.ts
  - tests/integration/workflow-kind-inversion.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/persistence/locations.test.ts
  - tests/shared/errors-bridges.test.ts
  - tests/shared/extension-version.test.ts
findings:
  critical: 2
  warning: 9
  info: 5
  total: 16
status: issues_found
---

# Phase 111: Code Review Report

**Reviewed:** 2026-09-05
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Toolchain evidence gathered during this review, so the findings below are not
confusable with gate failures:

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | clean |
| `npx eslint` (all changed files) | clean |
| `fallow dead-code` / `health` / `dupes` | exit 0 |
| `node --test tests/bridges/workflows/` | 58 pass, 0 fail |
| `test:coverage:direct` on all four production files | 100% line / branch / function |

Every gate is green and the direct-pair coverage is 100% on `discover.ts`,
`stage.ts`, `unstage.ts` and `locations.ts`. Both Critical findings below live
**inside** that 100% coverage: the failing branches execute, but no assertion
inspects the state they leave behind.

The path-containment work is sound. `workflowArtifactPath` is the sole composer,
it is `await`ed at all three call sites (`stage.ts:189`, `stage.ts:252`,
`unstage.ts:34`), `assertSafeName` runs before `path.join`, `assertPathInside`
is anchored one level ABOVE the staging directory so the staging segment itself
is lstat'd, and the check precedes the `mkdir`. I could not construct an input
that writes outside the three admitted paths. `workflowProjectKey`'s output
character class genuinely cannot climb.

The defects are concentrated in the **commit/rollback triplet's failure paths**
and in **guards that are provably dead**. Three of the findings are backed by an
executed reproduction; two more are backed by a mutation that leaves the whole
suite green.

The three executor self-reports were each checked independently: the staging
dedup **is** unreachable (mutation-confirmed, WR-03); the `add.test.ts` injector
fix **is** discriminating and non-vacuous (both cases re-run, both still assert
the injected cause); the integration test's three `assert.ok` statements **are**
byte-identical (the diff touches only the comment). The third self-report is
correct as far as it goes, but the rewrite dropped a real assertion — see WR-05.

## Critical Issues

### CR-01: A mid-loop displacement failure permanently destroys already-displaced previous envelopes

**Severity:** BLOCKER (data loss)
**File:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts:235-267`, `:346-407`

**Issue:** `displacePreviousTargets` accumulates its `displaced[]` list in a
LOCAL variable and `throw`s on any non-`ENOENT` rename failure (line 261). The
throw discards that local list, so the caller's outer `displaced` (line 347)
is still `[]`. In the catch block the restore loop therefore iterates nothing,
`unrestored` stays empty, and the CR-01 guard at line 397 does not fire — so
`cleanupStaging` runs a recursive `rm` over the staging root, and `.previous/`
is inside it. The previous envelopes that were successfully moved aside one
statement earlier are deleted with it. They are not in the saved directory
(they were renamed out) and not in staging (it was removed). They are gone, with
no leak message naming them.

This is exactly the outcome the module's own header says the displace-rather-
than-unlink design exists to make impossible ("A bare unlink is unrecoverable…
a commit that failed after the removals would leave the saved directory holding
neither the previous envelopes nor the new ones", `stage.ts:226-230`).

The sibling bridges do not have this hole: `bridges/commands/stage.ts:384`
declares `backups` in the OUTER scope of `replacePreparedCommands`, so a throw
inside its backup loop still reaches `rollbackReplacementCommon` with the
partial list.

**Reproduced.** Two recorded previous names, the second resolving under a
regular file so its `rename` fails `ENOTDIR`:

```text
error: ENOTDIR: not a directory, rename '.../saved/blocker.json/acme:two.json' -> '.../.previous/acme:two.json'
saved dir entries after failed commit:   [ 'blocker.json' ]
staging dir entries after failed commit: []
AssertionError: previous envelope acme:one.json was DESTROYED
```

The existing test `"propagates a displacement failure that is not a missing
previous file"` (`stage.test.ts:745`) uses a SINGLE previous name whose FIRST
displacement fails, so `displaced` is legitimately empty and the case stays
green with the bug present.

**Fix:** hoist the accumulator so a partial displacement survives the throw.

```ts
async function displacePreviousTargets(
  prepared: PreparedWorkflowsStaged,
  displaced: { from: string; to: string }[],   // caller-owned, mutated in place
): Promise<void> {
  if (prepared._previousNames.length === 0) {
    return;
  }

  const displacedRoot = path.join(prepared.stagingRoot, DISPLACED_DIR);
  await mkdir(displacedRoot, { recursive: true });

  for (const name of prepared._previousNames) {
    const target = await prepared.locations.workflowArtifactPath(name);
    const aside = path.join(displacedRoot, `${name}.json`);
    await assertPathInside(displacedRoot, aside, "displaced previous workflow file");

    try {
      await rename(target, aside);
      displaced.push({ from: target, to: aside });   // recorded before any later throw
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }
}
```

and at the call site:

```ts
const displaced: { from: string; to: string }[] = [];
try {
  await mkdir(prepared.locations.workflowsSavedDir, { recursive: true });
  await displacePreviousTargets(prepared, displaced);
  ...
```

Add a case with two previous names where the SECOND displacement fails, and
assert the first name's bytes are still readable (either restored at its target
or, if the restore also failed, still present under `.previous/` with a leak
message naming that path).

### CR-02: `onPlaced` reports a name whose target the restore loop overwrote with the previous envelope

**Severity:** BLOCKER (incorrect contract; data loss in the documented consumer)
**File:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts:364-406`

**Issue:** `CommitWorkflowsOptions.onPlaced` is documented as "the names whose
envelope is sitting at its target path **as a result of this commit**"
(`types.ts:134-146`) and as "the caller's removal payload"
(`stage.ts:319-321`). That statement is demonstrably false on one path.

When a forward rename succeeds and its REVERSAL fails, the name lands in
`stillPlaced` (line 370). The restore loop then runs (lines 381-391) and
`rename(move.to, move.from)` **overwrites** the file at that target — POSIX
`rename(2)` replaces an existing regular file. For a replaced name the two
paths are identical, so the restore succeeds and puts the PREVIOUS envelope
back over the still-placed new one. `reportPlaced(stillPlaced)` then names it
anyway. A caller following the documented contract unlinks that name and
deletes the previous envelope the rollback just restored.

**Reproduced.** One previous name `acme:greet`, its forward rename succeeding,
its reversal blocked, its restore succeeding:

```text
onPlaced reported: [["acme:greet"]]
bytes actually at the greet target: "PREVIOUS ENVELOPE\n"
```

The existing case `"reports the still-placed names in discovery order when the
reversal fails"` (`stage.test.ts:835`) passes NO `previousWorkflowNames`, so the
restore loop never runs and the interaction is untested.

**Fix:** a name whose previous envelope was successfully restored is no longer
placed by this commit. Drop it from the report.

```ts
const restoredTargets = new Set<string>();
const unrestored: string[] = [];
for (const move of [...displaced].reverse()) {
  try {
    await rename(move.to, move.from);
    restoredTargets.add(move.from);
  } catch (restoreErr) {
    unrestored.push(...);
  }
}

// A target the restore loop reclaimed no longer holds this commit's envelope,
// whatever the reversal reported.
const placedNames = stillPlaced
  .reverse()
  .filter((name) => {
    const pair = prepared._renamePairs.find((candidate) => candidate.name === name);
    return pair !== undefined && !restoredTargets.has(pair.to);
  });

reportPlaced(placedNames);
```

Pair it with a case that has both a blocked reversal and a recorded previous
name for the same generated name, asserting `onPlaced` reports `[]` and the
target holds the previous bytes.

## Warnings

### WR-01: `unstagePluginWorkflows` throws out of its loop, abandoning later envelopes

**Severity:** WARNING
**File:** `extensions/pi-claude-marketplace/bridges/workflows/unstage.ts:34`

**Issue:** `await input.locations.workflowArtifactPath(name)` sits OUTSIDE the
`try`. `workflowArtifactPath` runs `assertPathInside`, which throws
`SymlinkRefusedError` when the composed leaf is a symlink — a state the saved
directory can reach at any time, because it is shared with the user's own
hand-saved workflows and with every other tool. The throw escapes the loop, so
every later recorded name is skipped and the caller receives an exception
instead of the `failed[]` report the module was designed around. The module
header states the opposite contract: "accumulate rather than throw. A throw at
the first bad name would abandon every later envelope — executable files left
behind, and the caller told nothing about them" (`unstage.ts:41-44`). This is
the only cleanup path after a failed install, and the leftovers are executable
third-party code.

`displacePreviousTargets` (`stage.ts:252`) has the same shape, where it also
feeds CR-01.

**Reproduced.** A symlink planted at the first recorded name's target:

```text
outcome: THREW SymlinkRefusedError: workflowArtifactPath(acme:one) contains symlink .../saved/acme:one.json -> ...
left behind: [ 'acme:one.json', 'acme:two.json' ]
```

`acme:two.json` — an envelope this plugin owns — survives untouched.

**Fix:** bring the composer inside the accumulate block.

```ts
for (const name of input.previousWorkflowNames) {
  try {
    const target = await input.locations.workflowArtifactPath(name);
    await unlink(target);
    removed.push(name);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      continue;
    }

    failed.push({ name, reason: errorMessage(err) });
  }
}
```

Note this changes the existing case `"rejects a recorded name carrying a path
separator"` (`unstage.test.ts:156`), which currently pins the throw. Decide
deliberately: an `assertSafeName` failure on a name this extension generated is
a programming error and may stay a throw, but a `SymlinkRefusedError` on a
target somebody else planted must not be.

### WR-02: The documented symlink guard in discovery is dead code

**Severity:** WARNING
**File:** `extensions/pi-claude-marketplace/bridges/workflows/discover.ts:78-91`

**Issue:** the module header claims "We `lstat` each candidate before reading;
`isSymbolicLink()` short-circuits without touching the file body"
(`discover.ts:15-18`). It never runs for a symlink. `readdir(withFileTypes)`
reports `isFile() === false` and `isSymbolicLink() === true` for a symlink on
every filesystem (Node resolves `UV_DIRENT_UNKNOWN` through `lstat` before it
constructs the `Dirent` — the same fact `shared/fs-utils.ts:296-302` documents).
So `!entry.isFile()` at line 80 short-circuits first and the `lstat` at line 87
is only ever reached for a regular file, where `!stat.isSymbolicLink()` is
always `true`.

Verified two ways: an empirical `readdir` probe, and a mutation replacing line
88 with `return { ok: true, admit: true };` — **all 23 discover cases stay
green**, including `"refuses a symlinked script without opening the file it
points at"`. That case is therefore not a discriminator for the guard it names.
The 100% branch coverage does not catch this, because `!x` is not a V8 branch.

Symlinks are still refused (by `entry.isFile()`), so this is not an open hole —
it is a guard that cannot fire, a header that misattributes the protection, and
a test whose title promises a discrimination it does not make.

**Fix:** either drop the `lstat` and re-anchor the header on the `Dirent`, or —
if the residual TOCTOU re-check is wanted — keep it and make the test
discriminate by exercising the branch that actually decides (e.g. a case
asserting that the `lstat` failure path, not the dirent filter, is what produces
the `readFailureWarning`; the existing `"reports an entry whose lstat fails"`
case at `discover.test.ts:254` already does this and should carry the symlink
claim's weight instead).

### WR-03: The staging-side first-wins dedup is unreachable

**Severity:** WARNING
**File:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts:139-154`

**Issue:** confirms the executor's self-report. `seen.has(verdict.generatedName)`
can never be `true` through the public API. Two distinct scripts sharing a
generated name are rejected by `assertNoWorkflowNameCollisions` at line 137 —
including the case where both carry the same `fileName`, since that assert
groups by `generatedName` and counts claimants. One script reached twice is
already impossible: `discoverPluginWorkflows` dedups by absolute source path
(`discover.ts:321-327`).

Mutation-confirmed: removing the guard (`if (verdict === undefined)`) leaves
**all 24 stage cases green**.

The comment claims it "guards the residual case of one script reached twice" —
that case is closed upstream, so the comment describes a hazard that no longer
exists and invites a future reader to keep the branch.

**Fix:** delete the `seen` set and the guard, and replace the comment with the
fact that carries: the collision assert and the path dedup between them make the
admitted list already unique by generated name.

```ts
const admitted = discovered
  .map(admittedVerdict)
  .filter((verdict) => verdict !== undefined);
```

### WR-04: `readEntriesGracefully` reimplements a shared helper

**Severity:** WARNING
**File:** `extensions/pi-claude-marketplace/bridges/workflows/discover.ts:43-55`

**Issue:** this is byte-for-byte the behavior of
`shared/fs-utils.ts::readDirEntriesTolerant` (same `ENOENT`/`ENOTDIR` → `[]`,
same rethrow). All five sibling bridges import the shared helper
(`agents/discover.ts:26`, `commands/discover.ts:52`, `skills/discover.ts:30`);
the workflows bridge is the only one that carries a private copy. Two
implementations of the same tolerance policy drift silently — the `ENOTDIR`
arm in particular exists so a declared component path that is a file behaves as
"declares none of that kind", and a future amendment to that policy would now
need to be made twice.

**Fix:**

```ts
import { readDirEntriesTolerant } from "../../shared/fs-utils.ts";
...
const entries = await readDirEntriesTolerant(workflowsDir);
```

and delete `readEntriesGracefully` plus its now-unused `Dirent` import if
nothing else needs it.

### WR-05: The install-window assertion was removed, not inverted, and the test title overstates what the system under test does

**Severity:** WARNING
**File:** `tests/integration/workflow-kind-inversion.test.ts:139,187-220`

**Issue:** two problems in one edit.

1. The old `assert.rejects(stat(join(home, ".pi", "workflows")), { code: "ENOENT" })`
   is gone and nothing replaced it. `grep -rn "D-109-06" tests/` returns
   nothing. The invariant "a plain `install` does not bring the engine's storage
   root into existence" is now ungated. That invariant does not become moot when
   the bridge lands — until Phase 112 wires `WLIF-01`, `installPlugin` still must
   not write there, and after Phase 112 the property becomes "install writes
   exactly the envelopes it recorded". Either way, dropping it silently is a
   coverage regression.
2. The title now reads `"a workflow-bearing plugin installs with no partial flag
   and its workflow script materializes as an envelope"`. The install does not
   materialize anything — the test body calls `prepareStageWorkflows` and
   `commitPreparedWorkflows` itself, 15 lines later. The in-body comment is
   honest about this, but the title is what CI prints, and it will read as
   install-level coverage of a wiring that does not exist. If Phase 112 never
   lands the orchestrator call, this green case says otherwise.

**Fix:** keep the window assertion where it is still true, and name the test for
what it proves.

```ts
// assert -- the install itself materializes nothing yet: no orchestrator drives
// the bridge, so the engine's storage root must still be absent at this point.
await assert.rejects(stat(path.join(home, ".pi", "workflows")), { code: "ENOENT" });

// act -- stand-in for the install-driven path, replaced by it in the wiring phase.
const prepared = await prepareStageWorkflows({ locations, pluginName: "hello", resolved });
await commitPreparedWorkflows(prepared);
```

with the title changed to name the two separate facts, e.g.
`"WINV-02 / WBRG-01: a workflow-bearing plugin installs with no partial flag, and the bridge materializes its script as an envelope"`.
Restore the `home` parameter and the `stat` import that the edit dropped.

### WR-06: The commit rollback branches are reachable only by rewriting production internals

**Severity:** WARNING
**File:** `tests/bridges/workflows/stage.test.ts:180-207,693,810,857-868`

**Issue:** `redefineRenamePairPath` uses `Object.defineProperty` to swap a
property on an element of `prepared._renamePairs` for a getter that returns a
different path on the second read. Three cases depend on it. The project's
unit-testing rules say a test uses only the module's exports and that when a
unit is hard to test the dependency wants to become an explicit collaborator,
not a hole punched into the module. Two consequences:

- The cases are coupled to an internal field name and to the exact NUMBER of
  times the commit reads `pair.from`. A refactor that hoists `pair.from` into a
  local — a legal, behavior-preserving edit — turns the read-count getters at
  lines 857-868 into a different scenario without failing anything.
- It documents a real production leak: `Object.freeze(renamePairs)` freezes the
  ARRAY, not its elements, and `_renamePairs` is typed
  `readonly { name: string; from: string; to: string }[]` — the elements are
  mutable. Any holder of a staged handle can rewrite a rename target.

**Fix:** make the filesystem operation an injected collaborator, matching the
`makeMockGitOps` / `makeMockCredentialOps` pattern the conventions name:

```ts
export interface WorkflowFsOps {
  readonly rename: (from: string, to: string) => Promise<void>;
}

export async function commitPreparedWorkflows(
  prepared: PreparedWorkflowsStaging,
  opts?: CommitWorkflowsOptions & { readonly fsOps?: WorkflowFsOps },
): Promise<string | undefined> { ... }
```

and, independently of the tests, deep-freeze the pairs:
`Object.freeze(renamePairs.map((pair) => Object.freeze(pair)))`.

### WR-07: `{ concurrency: false }` on the `process.platform` case guards nothing

**Severity:** WARNING
**File:** `tests/bridges/workflows/discover.test.ts:459-462`

**Issue:** the option reads as isolation for a case that mutates a process
global. `concurrency` sets how many of a test's **subtests** run in parallel;
this case has none, so the option is inert. Isolation here comes from
`node:test`'s default sequential execution of top-level cases in a file — which
is not what the code says, and which a future `--test-concurrency` change or a
`describe` wrapper would silently remove. A guard that reads as protection but
cannot fire is the same failure class as WR-02 and WR-03.

**Fix:** drop the option and state the real reason in a comment, or make the
isolation structural by not mutating the global at all — extract the platform
read into an injectable parameter:

```ts
// discover.ts
function pathDedupKey(full: string, platform: NodeJS.Platform = process.platform): string {
  return platform === "darwin" || platform === "win32" ? full.toLowerCase() : full;
}
```

which also makes the `win32` arm reachable from a Linux CI run.

### WR-08: Nothing garbage-collects orphaned staging trees, and they are outside every cleanup root

**Severity:** WARNING
**File:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts:166-176`

**Issue:** `<workflowsStagingDir>/<uuid>/` is created before the write loop and
removed only by `commitPreparedWorkflows` or `abortPreparedWorkflows`. A crash,
a `SIGKILL`, or the deliberate CR-01 retention path (line 397-400) leaves the
directory behind, holding verbatim third-party executable JavaScript. Because
the staging root lives under `~/.pi/workflows/` and not under any scope root,
nothing sweeps it: `unstage.ts:12-13` says so explicitly of the envelopes, and
the same is true of the staging trees. They accumulate for the life of the
machine, in the user's home, invisible to `uninstall` and to `/reload`.

**Fix:** sweep stale siblings at prepare time, bounded by age so a concurrent
install is never touched.

```ts
// Best-effort sweep of trees left by an interrupted commit. Age-bounded so a
// concurrent install's fresh staging root is never removed.
await sweepStaleStagingRoots(locations.workflowsStagingDir, STALE_STAGING_AGE_MS);
```

At minimum, record the leak in a way the user can act on: the CR-01 retention
message names its path, but a crash-orphaned tree names nothing anywhere.

### WR-09: The warning channel is install-tense but is documented as the shared source for the read-only `info` surface

**Severity:** WARNING
**File:** `extensions/pi-claude-marketplace/bridges/workflows/discover.ts:100-188`

**Issue:** all four phrases assert an installation outcome — `"was installed but
will not run"`, `"was not installed"`, `"was refused"`, `"could not be read and
was skipped"`. `discoverPluginWorkflows` runs BEFORE anything is staged, and
`types.ts:26-30` plus `discover.ts:22-24` both state that the read-only `info`
surface consumes this same discovery. On `info` for a plugin that is not
installed, every one of those rows is a false statement, and
`"was installed but will not run"` is the worst of them: it tells the user an
envelope exists that does not.

The `"could not be read and was skipped"` phrase is also inaccurate at its
`lstat` call site (`discover.ts:312`), where nothing was read.

**Fix:** make the outcome phrase a parameter of the discovery call rather than a
constant of the module, so the staging surface and the `info` surface each state
their own tense:

```ts
export async function discoverPluginWorkflows(input: {
  pluginName: string;
  resolved: WorkflowDiscoveryTarget;
  /** How a soft-fail is phrased: `install` states an outcome, `inspect` states a finding. */
  voice: "install" | "inspect";
}): Promise<DiscoverPluginWorkflowsResult>
```

If that is Phase 112's call to make, record it there — the wording is shipped
text and will be quoted back.

## Info

### IN-01: `workflowArtifactPath` refusal messages repeat the name

**File:** `extensions/pi-claude-marketplace/persistence/locations.ts:370`,
`tests/persistence/locations.test.ts:494-505`

The label already interpolates the name, and `assertSafeName` interpolates it
again for the separator and control-character arms, producing
`workflowArtifactPath workflow name "acme/deploy" "acme/deploy" must not contain path separators.`
The non-empty and dot arms do not, so the messages are internally inconsistent.
The pattern is inherited from `pluginDataDir` / `pluginCacheFile`, so this is
pre-existing — but the new data-driven cases now PIN the doubled string as
expected output, which makes it harder to fix later. Consider passing a label
without the name (`"workflowArtifactPath workflow name"`) and letting
`assertSafeName` supply it once.

### IN-02: `UnstageWorkflowsResult.warnings` is structurally always empty

**File:** `extensions/pi-claude-marketplace/bridges/workflows/unstage.ts:56`,
`types.ts:171`

`unstagePluginWorkflows` has exactly one construction site and it always returns
`Object.freeze<string[]>([])`. Four cases assert `warnings: []`, which proves
nothing about behavior. Either the field is shape-parity with the sibling
bridges (say so in the doc comment) or it should go.

### IN-03: The new fallow zone has no planting test, and the codebase docs still say 13 zones

**File:** `.fallowrc.json:48-51,117-120,176-179`

`bridges-workflows` brings the zone count to 14.
`.planning/codebase/ARCHITECTURE.md` and `CONVENTIONS.md` still say 13 and
`STACK.md` still says 12. Per the house rule that "a gate wants a test that
plants the violation, not one that reads the config", nothing verifies the new
zone actually fires — `tests/architecture/import-boundaries.test.ts` only covers
the coarser ESLint 8-folder matrix, so a typo in the zone pattern would be
undetectable. Same gap as the five sibling bridge zones, so this is not a
regression, but it now applies to a zone whose whole point is to keep a bridge
that writes outside every scope root from importing sideways.

### IN-04: The HOME-relocation helper is copied four times

**File:** `tests/bridges/workflows/stage.test.ts:96`,
`tests/bridges/workflows/unstage.test.ts:33`,
`tests/persistence/locations.test.ts:99`,
`tests/integration/workflow-kind-inversion.test.ts:55`

Four near-identical implementations, each with the same three-paragraph comment
explaining the same ordering rule. All four are correct (restoration registered
before the mutation, absent variable deleted rather than reassigned — the
`event-router.test.ts` ordering trap was NOT copied). But the invariant now has
four places to get wrong. The comment belongs in one place next to the workflows
tests it serves.

### IN-05: One error assertion goes through message text

**File:** `tests/bridges/workflows/stage.test.ts:942`

`assert.strictEqual(error.message.includes(prepared.stagingRoot), true)` asserts
by substring where the rule is class plus structured fields. The leak text is
genuinely the contract here, so this is defensible — but the assertion would
also pass if the path appeared for an unrelated reason. Comparing the full
composed leak string would discriminate.

---

_Reviewed: 2026-09-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
