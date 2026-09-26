---
phase: 111-workflows-bridge
reviewed: 2026-09-05T14:30:00Z
iteration: 2
depth: standard
diff_base: 48af9a19
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
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 111: Code Review Report (iteration 2)

**Reviewed:** 2026-09-05
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Both iteration-1 Criticals are genuinely fixed. Nine commits (`9f248b35`..`91929500`)
landed; the fixer's WR-02 rebuttal is correct and I concede it in full. Three
Warnings remain: one new defect the WR-01 fix introduced, one half of CR-02 the
fix did not carry across, and one containment gap iteration 1 missed.

Gates re-run at HEAD, all green:

| Check | Result |
| --- | --- |
| `npm run typecheck` | clean |
| `npx eslint` (all changed paths) | clean |
| `npm run fallow` | exit 0 (dead-code / health / dupes) |
| `node --test tests/bridges/workflows/` | 61 pass, 0 fail |
| `node --test tests/integration/workflow-kind-inversion.test.ts` | 1 pass |
| `test:coverage:direct` stage / discover / unstage | 59/59, 51/51, 7/7 branches — 100% |

### 1. Did any fix introduce a new defect?

**Yes, one.** The WR-01 fix moved `workflowArtifactPath` inside the accumulate
block, which makes `unstagePluginWorkflows` the only place in the extension that
folds a `PathContainmentError` into a soft result row instead of propagating it.
`transaction/phase-ledger.ts:89,125` — the exact position Phase 112 will put this
function in — re-throws that class by name. See **WR-10**.

The CR-02 fix is also incomplete rather than wrong: it corrected the structured
channel and left the human-readable one asserting the opposite. See **WR-11**.

No other regression. I traced every accumulator in the touched files:
`renamePairs` / `stagedNames` (prepare), `completedRenames` / `displaced`
(commit), `rollbackLeaks` / `stillPlaced` / `unrestored` / `restoredTargets`
(catch), `removed` / `failed` (unstage). None has the local-vs-outer shape CR-01
had. The catch block's own loops each wrap their `rename` and `cleanupStaging`
never throws (`shared/fs-utils.ts:40-52`), so nothing escapes it mid-accumulation.

### 2. Is the CR-01 fix complete?

**Yes — verified by execution, not by reading.** I ran the HEAD test file against
the pre-fix source (`git show 8dc74b0d:.../stage.ts`), which is a stricter check
than re-running the fixer's own claim:

```text
ℹ tests 26 / pass 24 / fail 2
✖ restores an already-displaced envelope when a later displacement fails
✖ omits a still-placed name whose target the restore loop reclaimed
```

Both regression cases are red-first against the unfixed module and green at HEAD.
The CR-01 case uses two previous names and fails the second (`stage.test.ts:792`),
which is the shape one previous name cannot expose. The sibling-accumulator sweep
above found no second instance of the pattern.

### 3. Is the CR-02 fix correct?

**On the structured channel, yes, and the fixer's divergence is justified.**
`stillPlaced` is populated only by pushing elements of `prepared._renamePairs`
(`stage.ts:372-374`), so a `_renamePairs.find(...)` lookup by name provably
cannot miss — the review's suggested `pair !== undefined` arm is unreachable, and
carrying the pair avoids it. Every rollback combination checks out:

| reversal | restore | reported? | target holds | correct? |
| --- | --- | --- | --- | --- |
| failed | succeeded | no (filtered) | previous envelope | yes |
| failed | failed | yes | new envelope | yes |
| failed | n/a (no previous) | yes | new envelope | yes |
| succeeded | succeeded | no | previous envelope | yes |
| succeeded | failed | no | nothing (leak reported) | yes |

`restoredTargets` compares `move.from` against `pair.to`; both come from the same
composer for the same name, so the string equality is sound. **But the leak text
in the same thrown error still names the reversal as failed** — WR-11.

### 4. WR-02 pushback — conceded

I re-ran all three mutations myself. The fixer's table reproduces exactly:

| Mutation | My result |
| --- | --- |
| M1 — `lstat` guard → `admit: true` | 23/23 green |
| M2 — `!entry.isFile()` → `false` | symlink case **green**; 1 unrelated case red (`silently excludes dotfiles, directories and unadmitted suffixes`) |
| M3 — both | symlink case **red** (`linked.js` now discovered) |

The fixer is right and iteration 1's test-integrity half was wrong. The case
`"refuses a symlinked script without opening the file it points at"` does
discriminate the refusal; it cannot attribute it to one layer because two layers
provide it, which is redundancy rather than a vacuous assertion. I also confirmed
the sibling claim by reading it: `shared/fs-utils.ts:306-313`
(`isPlainMarkdownFile`) is the identical `!entry.isFile()` → `lstat` →
`!isSymbolicLink()` shape. The re-anchored header and the test note are the right
resolution. No further action.

### Path containment — the iteration-1 conclusion needs one correction

`workflowArtifactPath` is still the sole composer of a saved-directory leaf
(`grep` over `extensions/` returns three call sites: `stage.ts:182`,
`stage.ts:252`, `unstage.ts:40`, each `await`ed). `workflowsSavedDir` is named
elsewhere only to `mkdir` it. That half holds.

What does not hold is iteration 1's stronger claim that no reachable write lands
outside the three admitted paths. The `.previous` join has a weaker containment
anchor than the staging root eight lines above it, and I built a case that writes
a user's envelope to an arbitrary directory through it — **WR-12**.

## Warnings

### WR-10: `unstagePluginWorkflows` now swallows `PathContainmentError`, which the codebase says must always propagate

**Severity:** WARNING (new defect, introduced by the WR-01 fix in `a28d3d0f`)
**File:** `extensions/pi-claude-marketplace/bridges/workflows/unstage.ts:31-57`

**Issue:** the fix moved `await input.locations.workflowArtifactPath(name)` inside
the per-name `try`. That was the right call for the abandonment problem, but the
catch it landed in filters only on `code !== "ENOENT"`, so a `SymlinkRefusedError`
or `PathContainmentError` is now recorded as an ordinary `failed[]` row.

The error class documents the opposite policy on itself
(`shared/path-safety.ts:5-7`): *"Inherits PI-14 handling: NEVER folded into
'rollback partial' lines; always propagates loudly."* Two accumulators in the
codebase honor that by name:

```ts
// transaction/phase-ledger.ts:88-91 — rollbackExecuted
} catch (undoErr) {
  if (undoErr instanceof PathContainmentError) {
    throw undoErr;                       // PI-14 bypass, never a partial row
  }
  partials.push({ phase: done.name, msg: errorMessage(undoErr), ... });
```

`invokeFailingPhaseUndo` (`phase-ledger.ts:125`) repeats it, and
`shared/fs-utils.ts:251` narrows on the class rather than absorbing it. The other
three unstage bridges keep the containment check outside the loop entirely
(`commands/unstage.ts:23`, `skills/unstage.ts:33`), so workflows is now the only
one of four that absorbs it.

**Why this matters concretely, not just stylistically.** Phase 112 will install
`unstagePluginWorkflows` as the workflows-phase `undo`. At that moment the
divergence becomes behavioral: a containment refusal there will be absorbed into
`failed[]`, `runPhases` will see a clean undo, and the PI-14 bypass in
`install.ts:1858` / `install.messaging.ts:235` will never see a
`PathContainmentError` to render. The install failure will lose the containment
cause the bypass exists to surface. The fix report argued the accumulate policy
on its merits but did not reconcile it against any of these three sites.

**Fix:** keep the accumulate contract, but make the class visible to the caller so
the ledger can honor PI-14 rather than being denied the chance. Discriminate the
row:

```ts
// types.ts
export interface UnstageWorkflowFailure {
  readonly name: string;
  readonly reason: string;
  /**
   * PI-14: a containment refusal is not an ordinary per-name I/O failure. It is
   * accumulated so one refused name does not abandon the executable envelopes
   * after it, and tagged so a ledger caller can still bypass on it.
   */
  readonly kind: "containment" | "io";
}

// unstage.ts
} catch (err) {
  if ((err as NodeJS.ErrnoException).code === "ENOENT") {
    continue;
  }

  failed.push({
    name,
    reason: errorMessage(err),
    kind: err instanceof PathContainmentError ? "containment" : "io",
  });
}
```

If instead the deliberate answer is that workflows diverges from PI-14 outright,
amend the `PathContainmentError` doc comment to record the exception — the class
currently states a rule this caller breaks.

### WR-11: the rollback leak text still claims a placement the CR-02 fix removed from the report

**Severity:** WARNING (incomplete fix of CR-02, `ae45af9e`)
**File:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts:372-425`

**Issue:** on the reversal-failed / restore-succeeded path the fix correctly drops
the name from `onPlaced`, but `rollbackLeaks` was pushed unconditionally at
line 377 and is still folded into the thrown message at line 425. The one error
object therefore carries two contradictory statements about the same file.

**Reproduced** (`onPlaced` now empty, message unchanged):

```text
onPlaced report : [[]]
bytes at target : "PREVIOUS ENVELOPE\n"
thrown message  : ENOENT: ... rename '.../absent.json' -> '.../saved/acme:shout.json'
  (additionally: failed to roll back workflow rename
   .../saved/acme:greet.json -> .../rollback-blocker: EISDIR: ...)
```

`acme:greet.json` holds the restored previous envelope. The structured channel
says so; the leak line says its rename was not rolled back, which reads as "the
new envelope is still sitting there". These leak strings are the manual-recovery
instructions — the sibling restore leak literally says *"move it back by hand"*
(`stage.ts:394-395`) — so an operator acting on this one deletes exactly the bytes
CR-02 was fixed to protect. That is the same hazard, on the channel the fix did
not cover.

The existing case `"omits a still-placed name whose target the restore loop
reclaimed"` (`stage.test.ts:942`) asserts `placed` and the target bytes but makes
no assertion about `error.message`, which is why it stays green.

**Fix:** withhold the reversal leak for a pair the restore loop reclaimed, the
same predicate the report already uses. Build the leaks after the restore loop
rather than during the reversal loop:

```ts
for (const pair of stillPlaced) {
  if (restoredTargets.has(pair.to)) {
    // The restore reclaimed this target, so the failed reversal cost nothing:
    // the previous envelope is back at its own path and nothing is stranded.
    continue;
  }

  rollbackLeaks.push(
    `failed to roll back workflow rename ${pair.to} -> ${pair.from}: ${reasons.get(pair.name)}`,
  );
}
```

Extend the case at `stage.test.ts:942` with
`assert.doesNotMatch(error.message, /failed to roll back workflow rename/)`, which
is the assertion that would have caught this.

### WR-12: the `.previous` join is anchored on itself, so a symlink at that fixed name writes outside the staging root

**Severity:** WARNING
**File:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts:244-254`

**Issue:** `displacePreviousTargets` anchors its containment check on
`displacedRoot`:

```ts
const displacedRoot = path.join(prepared.stagingRoot, DISPLACED_DIR);
await mkdir(displacedRoot, { recursive: true });
...
await assertPathInside(displacedRoot, aside, "displaced previous workflow file");
```

`assertPathInside` trusts its own boundary and starts the walk at it
(`path-safety.ts:88-97`), so `.previous` itself is never `lstat`'d. `mkdir` with
`recursive: true` succeeds silently on an existing symlink-to-directory, so a link
planted at that name is followed rather than refused.

This is the exact failure the same file refuses to make eight lines earlier, in
its own words (`stage.ts:160-167`): *"anchoring on `workflowsStagingDir` would
skip an lstat of the one segment an attacker could have replaced with a symlink,
leaving a check that cannot fail. Anchoring one level up lstats the staging
directory itself."* `DISPLACED_DIR` is a **fixed, predictable** name, which makes
it a materially softer target than the `randomUUID` staging root that reasoning
protects.

**Reproduced.** `.previous` planted as a link to an outside directory between
prepare and commit:

```text
commit error    : none (commit succeeded)
outside dir now : ["acme:greet.json"]
  contents      : acme:greet.json "PREVIOUS ENVELOPE\n"
```

The commit reports success while the user's previous envelope — script text — has
been written to an attacker-chosen directory outside `~/.pi/workflows/`.

**Not classified BLOCKER, deliberately:** the capability required is write access
to `<home>/.pi/workflows/.pi-claude-marketplace-staging/<uuid>/` during the
prepare→commit window, i.e. a same-user concurrent process. `path-safety.ts:70-76`
documents that residual TOCTOU risk as accepted, and such an attacker can already
rewrite the envelopes directly, so there is no privilege gain and no data loss.
It would be a BLOCKER if the escape were reachable from plugin-authored input;
it is not — `workflowProjectKey` and `assertSafeName` still hold that line.

**Fix — one identifier.** Raise the anchor so `.previous` is a walked segment:

```ts
await assertPathInside(prepared.stagingRoot, aside, "displaced previous workflow file");
```

**Verified:** with that change the probe above returns
`SymlinkRefusedError: displaced previous workflow file contains symlink
.../.previous -> ...`, the outside directory stays empty, and all 61 workflow
cases stay green — which also shows no current case discriminates the anchor.
Pair the fix with one, mirroring `"refuses a staging directory that has been
replaced by a symbolic link"` (`stage.test.ts:396`).

## Info

### IN-06: a throwing `onPlaced` destroys the original error and every rollback leak

**File:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts:337-339,419-425`

`reportPlaced` runs immediately before `throw appendLeaks(err, [...])`. If the
caller's `onPlaced` callback throws, that callback's error replaces the commit
failure and all accumulated leak text — including the CR-01 retention message
naming the only surviving copy of a previous envelope — is lost. The contract
does not forbid a throwing callback, and the leak strings are the recovery
instructions. Pre-existing shape, but the CR-02 fix made the call an expression
with two chained transforms, so it is worth pinning now rather than later: wrap
the invocation in `try { ... } catch { /* the commit failure outranks it */ }`,
or compute `placedNames` first and report after `appendLeaks` has built the error.

_Note, not a re-report:_ the WR-01 fix added a second pin of the doubled-name
string flagged as IN-01 in iteration 1
(`unstage.test.ts:166-168`, `'workflowArtifactPath workflow name "../escape"
"../escape" must not contain path separators.'`). Severity is unchanged; the
cost of fixing IN-01 later is now one call site higher.

---

_Iteration-1 findings IN-01..IN-05 were out of scope for the fix pass and are not
re-reported. WR-06 (rejected with reasoning), WR-08 and WR-09 (carried as
numbered Phase 112 / 113 ROADMAP criteria) are settled and not re-opened._

---

_Reviewed: 2026-09-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
