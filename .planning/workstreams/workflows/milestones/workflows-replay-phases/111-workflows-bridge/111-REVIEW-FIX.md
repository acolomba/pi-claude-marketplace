---
phase: 111-workflows-bridge
fixed_at: 2026-09-05T15:00:00Z
review_path: .planning/workstreams/workflows/phases/111-workflows-bridge/111-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 111: Code Review Fix Report

Two fix passes are recorded here in order. Everything down to the iteration-1
footer is that pass, unedited. The iteration-2 pass is appended below it, and
the frontmatter above counts iteration 2 only.

**Fixed at:** 2026-09-05
**Source review:** `.planning/workstreams/workflows/phases/111-workflows-bridge/111-REVIEW.md`
**Iteration:** 1
**Scope:** critical + warning (CR-01, CR-02, WR-01..WR-09). Info findings out of scope.

**Summary:**

- Findings in scope: 11
- Fixed: 8 (CR-01, CR-02, WR-01, WR-02, WR-03, WR-04, WR-05, WR-07)
- Deferred with a named ROADMAP carrier: 2 (WR-08, WR-09)
- Rejected on inspection: 1 (WR-06's injection proposal; one sub-claim of WR-02
  also refuted by measurement, see below)

**Gate:** `npm run check` exits 0 — typecheck, lint, fallow, format:check,
test:corresponding, test:corresponding:negative, test:coverage:direct:negative,
test, test:integration.

**Direct coverage held at 100% on every touched pair** (`hit === found`), measured
after the last change:

| Module | Branches | Functions | Lines |
| --- | --- | --- | --- |
| `bridges/workflows/discover.ts` | 51/51 | 13/13 | 344/344 |
| `bridges/workflows/stage.ts` | 59/59 | 13/13 | 444/444 |
| `bridges/workflows/unstage.ts` | 7/7 | 1/1 | 64/64 |

No suppression, no `node:coverage ignore`, no threshold override was added.

---

## Fixed Issues

### CR-01: A mid-loop displacement failure destroyed already-displaced envelopes

**Files modified:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts`,
`tests/bridges/workflows/stage.test.ts`
**Commit:** `9f248b35`
**Status:** fixed, verified by a red-first regression test

`displacePreviousTargets` accumulated into a local array and returned it by
value, so a non-ENOENT rename failure threw the list away. The caller's
`displaced` stayed `[]`, the restore loop iterated nothing, the retention guard
never fired, and `cleanupStaging` removed the staging root with `.previous/`
still inside it.

The accumulator is now caller-owned and mutated in place — the position
`bridges/commands/stage.ts:384` already gives its `backups`. A move is recorded
the instant it succeeds.

**Reproduced before fixing.** The new case uses two previous names and fails the
second; against the unfixed module it failed with the destroyed file:

```text
ENOENT: no such file or directory, open '.../saved/acme:one.json'
```

The pre-existing case at `stage.test.ts:745` used a single name whose *first*
displacement fails, where an empty list is correct, which is why it stayed green
with the defect present.

### CR-02: `onPlaced` reported a name whose target the restore loop overwrote

**Files modified:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts`,
`tests/bridges/workflows/stage.test.ts`
**Commit:** `ae45af9e`
**Status:** fixed, verified by a red-first regression test

The restore loop now records the targets it reclaimed, and the placement report
filters them out. `stillPlaced` carries its rename pairs rather than bare names,
so the comparison reads a target path directly — the reviewer's suggested
`_renamePairs.find(...)` lookup would have added a `pair !== undefined` arm no
input can reach, costing a branch against the phase's 100% requirement.

**Reproduced before fixing:** `onPlaced` reported `['acme:greet']` while that
target held `PREVIOUS ENVELOPE\n`. The byte assertion passed both before and
after; only the report changed, which is the defect.

### WR-01: `unstagePluginWorkflows` threw out of its loop

**Files modified:** `extensions/pi-claude-marketplace/bridges/workflows/unstage.ts`,
`tests/bridges/workflows/unstage.test.ts`
**Commit:** `a28d3d0f`
**Status:** fixed, verified by two red-first regression tests

`workflowArtifactPath` sat outside the try. It refuses as well as composes, so a
`SymlinkRefusedError` escaped the loop and abandoned every later envelope — the
opposite of the accumulate contract the module header states.

**The deliberate decision the reviewer asked for:** one policy, accumulate both
arms. A recorded name is *consumed* here, not generated; the generating side
still refuses loudly. `failed[]` is a required field carrying structured
`{name, reason}` precisely so a caller can act on per-name failures, and a
corrupt or hostile recorded name is exactly a per-name defect. The alternative
(splitting `assertSafeName` from the containment check) would put a second
composer in the tree, which is the thing WPTH-04 exists to prevent.

The existing separator case pinned the old throw, so it now asserts the recorded
failure *and* that a later name is still removed. A second case covers the
symlink scenario, which is the one that motivated the finding.

### WR-02: The symlink guard attribution — fixed as documentation; one sub-claim refuted

**Files modified:** `extensions/pi-claude-marketplace/bridges/workflows/discover.ts`,
`tests/bridges/workflows/discover.test.ts`
**Commit:** `31760be1`
**Status:** fixed (header re-anchored); the test-integrity half rejected on evidence

I ran the mutations rather than reasoning about them. Three runs:

| Mutation | Result |
| --- | --- |
| M1 — neutralize the `lstat` guard (`admit: true`) | 23/23 green (reproduces the reviewer) |
| M2 — neutralize the `Dirent` filter (`!entry.isFile()`) | symlink case still **green**; one unrelated case red |
| M3 — neutralize **both** | symlink case **red** |

This changes the diagnosis on both halves:

- **The header was wrong, and is fixed.** It credited the `lstat` with refusing
  symlinks. The `Dirent` filter is what refuses them and it runs first, because
  `readdir(withFileTypes)` answers `isFile() === false` for a symlink on every
  filesystem. The header now says so and names the `lstat` as the live-filesystem
  re-check.
- **The claim that the test "asserts something it does not test" is refuted.**
  M3 turns `"refuses a symlinked script without opening the file it points at"`
  red. The case does discriminate the refusal; it cannot attribute it to one
  layer, because two layers provide it. That is redundancy, not a vacuous test.

**Both guards kept.** The `lstat` is not dead code: it fires when the entry is
swapped for a link after the `readdir` snapshot, which the dirent cannot see. It
costs no coverage (`!x` is not a V8 branch — coverage stayed 51/51). And the
sibling `shared/fs-utils.ts::isPlainMarkdownFile` has the identical two-layer
shape, so removing it here would make workflows the only bridge without the
re-check. A note on the case records the redundancy so a future reader does not
repeat the "this branch is dead" inference.

### WR-03: The staging-side first-wins dedup was unreachable

**Files modified:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts`,
`extensions/pi-claude-marketplace/bridges/workflows/discover.ts`
**Commit:** `13b9df04`
**Status:** fixed — deleted

**Decision: delete, not keep-and-recomment.** The reviewer's confirmation that it
cannot fire is necessary but not sufficient reason on its own; the deciding
argument is that *if it ever became reachable it would be the wrong behavior*.
Silently keeping the first claimant of a duplicated generated name is exactly the
outcome `assertNoWorkflowNameCollisions` exists to prevent (WNAM-05) — the plugin
would install one script under a name its author gave to two. A guard that can
only do harm by firing is worse than no guard, so preserving it "in case the
upstream invariant loosens" would preserve a latent defect rather than a safety
net. If that invariant does loosen, the collision assert is the thing that must
change.

The replacement comment names the two invariants that make the list unique (the
collision assert, and discovery's absolute-source-path dedup). The stale
cross-reference in `discover.ts` ("The staging-side dedup runs AFTER the assert")
was corrected in the same commit. All 61 workflow cases stay green; stage.ts
coverage stays 59/59 branches.

### WR-04: `readEntriesGracefully` reimplemented a shared helper

**Files modified:** `extensions/pi-claude-marketplace/bridges/workflows/discover.ts`
**Commit:** `11b25648`
**Status:** fixed

Replaced with `shared/fs-utils.ts::readDirEntriesTolerant`, which the five
sibling bridges already import. Confirmed behaviorally identical before swapping
(same ENOENT/ENOTDIR arms, same rethrow; the shared one additionally passes the
default `encoding: "utf8"`).

### WR-05: The install-window assertion was dropped, and the title overstated the actor

**Files modified:** `tests/integration/workflow-kind-inversion.test.ts`
**Commit:** `cc951616`
**Status:** fixed

Both halves addressed:

1. The `ENOENT` window assertion is restored, positioned between the two acts —
   after `installPlugin`, before the manual bridge drive — where it is still
   true. This satisfies ROADMAP criterion 9 ("only the ENOENT half moves") more
   faithfully than dropping it: the case now proves the envelope IS written *and*
   keeps the invariant that install does not reach the engine's storage root.
   **It discriminates:** the envelope the case reads at the end lives under that
   same root, so the root demonstrably does not exist at the assertion point and
   does by the end.
2. The title said the install materializes the script. The body calls
   `prepareStageWorkflows` / `commitPreparedWorkflows` itself fifteen lines
   later. The title now names the bridge as the actor, so CI does not print a
   claim of install-level coverage for a wiring Phase 112 has not landed.

`stat` and the `home` parameter that the earlier edit dropped are both restored.

### WR-07: `{ concurrency: false }` guarded nothing

**Files modified:** `tests/bridges/workflows/discover.test.ts`
**Commit:** `b8630ec4`
**Status:** fixed

The option sets how many of a case's *subtests* run in parallel and this case has
none, so it was inert. Removed, and replaced with a note naming the property that
actually isolates it (`node:test` runs a file's top-level cases in sequence) and
the two changes that would end it.

I did **not** take the reviewer's alternative of threading `platform` through
`discoverPluginWorkflows`'s input. That parameter would have exactly one caller
passing a non-default value — the test — which is the test-only seam
CONVENTIONS.md §"Dependency injection over test-only seams" rules out, dressed as
injection.

---

## Deferred with a named carrier

Both are lifecycle concerns rather than leaf-bridge ones. Recorded as numbered
ROADMAP success criteria rather than prose, per the rule that CONTEXT and STATE
notes evaporate before the later phase reads them — the same route Phase 110 used
for its own WR-09.

**Commit:** `91929500`

### WR-08: Nothing garbage-collects orphaned staging trees — DEFERRED TO PHASE 112

**File:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts:166-176`
**Carrier:** ROADMAP Phase 112, new success criterion 6 (old 6 renumbered 7)

The finding is real and I confirmed the reachable leak paths: a crash, a
`SIGKILL`, or the deliberate retention path a failed restore takes. The tree
holds verbatim third-party executable JavaScript, sits under `~/.pi/workflows/`
outside every scope root, and is invisible to `uninstall` and to `/reload`.

Not fixed here because a correct sweep must be age-bounded so a concurrent
install's fresh staging root is never removed, and the bridge has no view of
which trees belong to a live transaction. Phase 112 owns the ledger, which is
where that view exists. Fixing it in the leaf bridge would mean inventing a
liveness heuristic at the one layer that cannot see liveness.

### WR-09: The warning channel is install-tense but feeds the read-only `info` surface — DEFERRED TO PHASE 113

**File:** `extensions/pi-claude-marketplace/bridges/workflows/discover.ts:100-188`
**Carrier:** ROADMAP Phase 113, new success criterion 5 (old 5 renumbered 6)

Confirmed: all four phrases assert an installation outcome, discovery runs before
anything is staged, and both `types.ts:26-30` and the discovery header state that
`info` consumes the same pass. On `info` for an uninstalled plugin every row is a
false statement, and `"was installed but will not run"` is the worst of them.

Not fixed here because the reviewer's own note applies — this is shipped text
that will be quoted back, and Phase 113 is the phase that builds the `info`
surface and therefore the one that should choose the wording. Changing it now
would mean picking user-visible phrasing for a surface that does not yet exist.
The carrier records the mechanism (make the phrase a parameter of the call) and
the `lstat`-call-site inaccuracy so neither is rediscovered.

---

## Rejected on inspection

### WR-06: The rollback branches are reachable only through internal state

**File:** `tests/bridges/workflows/stage.test.ts:180-207,693,810,857-868`
**Status:** injection proposal rejected; no change made

The finding's *description* is accurate — `redefineRenamePairPath` does depend on
an internal field name and on how many times the commit reads `pair.from`, and
`Object.freeze(renamePairs)` does freeze only the array, leaving its elements
mutable. I rejected the proposed remedy, not the observation.

**Why the `WorkflowFsOps` seam is not the honest fix.** The dependency is
`node:fs/promises`. This bridge's entire job is filesystem manipulation, so
`rename` is its domain rather than an external boundary, and all five sibling
bridges call it directly. An `opts.fsOps` parameter would have exactly one caller
supplying it — the test — which is the test-only seam CONVENTIONS.md rules out,
wearing the shape of dependency injection. It would also make workflows the only
bridge of six with an injected filesystem.

**Why the deep-freeze cannot be taken on its own.** I traced whether the three
dependent cases could be re-driven from real filesystem conditions instead.
Two can: removing a staged file between prepare and commit makes its forward
rename fail using only `prepared.stagingRoot`, which is public. The third cannot.
Reaching "forward rename succeeded, its reversal failed" needs the staging
directory writable for the forward pass and unwritable for the reverse — the same
directory, the same permission bit, with no hook between the two. Every other
route I checked (permissions, occupying the reversal target, the
`workflowArtifactPath` seam, which only runs before the rename loop) fails for
the same reason.

So deep-freezing forces one of: adding the rejected seam, or dropping that case.
Dropping it is not available — it covers the `stillPlaced` branch, which is
exactly the branch CR-02 was hiding in, and losing it would breach the phase's
100% direct-coverage requirement. Given the scope instruction not to contort
production code for testability, I left both alone.

**Residual risk, stated rather than fixed.** The mutable pair elements are a
hygiene issue, not a vulnerability: `_renamePairs` is underscore-prefixed, is
deliberately not re-exported from the barrel (`types.ts:11-14`), and the handle
lives between prepare and commit inside a single orchestrator. Exploiting it
requires already running in-process. The helper's own comment already states
plainly that element mutability is the lever it uses, so the coupling is
documented where a reader meets it.

---

## Scope boundaries observed

- `.planning/WINDOWS.md` — not touched.
- `orchestrators/` — not touched. No `"bridges-workflows"` entry was added to the
  `orchestrators` zone's `allow` array in `.fallowrc.json`.
- `EXTENSION_VERSION` and the other five bump sites — not touched; still `0.19.0`.
- Phase 109's five inverted files (`domain/resolver.ts`,
  `domain/components/plugin.ts`, `shared/notify.ts`, `shared/notify-reasons.ts`,
  `shared/probe-classifiers.ts`) — not touched.
- No test-only export, module-global setter, reset hook or production seam was
  added.
- No new file was created other than this report.
- Comment policy (`.claude/rules/typescript-comments.md`): no `Phase NN`,
  `Plan NN`, `Wave N` or bare `Pitfall N` token was introduced, and no comment
  narrates code that no longer exists. Requirement and finding IDs (`CR-01`,
  `WNAM-05`, `WLIF-03`, `D-14`, `WPTH-04`) are used as the durable anchors the
  policy permits.

## Commits

| Finding | Commit | Kind |
| --- | --- | --- |
| CR-01 | `9f248b35` | `fix(workflows): keep displaced envelopes recoverable on a failed commit` |
| CR-02 | `ae45af9e` | `fix(workflows): drop reclaimed targets from the placement report` |
| WR-01 | `a28d3d0f` | `fix(workflows): let one refused name not abandon the envelopes after it` |
| WR-02 | `31760be1` | `docs(workflows): attribute the symlink refusal to the layer that makes it` |
| WR-04 | `11b25648` | `refactor(workflows): read directory entries through the shared helper` |
| WR-03 | `13b9df04` | `refactor(workflows): drop the staging dedup that cannot fire` |
| WR-07 | `b8630ec4` | `test(workflows): state the real isolation of the platform-dedup case` |
| WR-05 | `cc951616` | `test(workflows): keep the install-window pin and name the case honestly` |
| WR-08, WR-09 | `91929500` | `docs(workflows): carry two review deferrals as phase success criteria` |

Every commit ran `pre-commit run --files <changed paths>` clean apart from the
structural `trufflehog` git-mode failure this checkout always produces (`.git` is
a file), which was cleared each time by a filesystem scan
(`--results=verified,unknown --fail`, 0 verified and 0 unverified secrets) before
committing with `SKIP=trufflehog`. No `--no-verify`, no `--amend`. `git status`
was checked after each commit for prettier-hook rewrites; none were left behind.

---

_Fixed: 2026-09-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

---

# Phase 111: Code Review Fix Report (iteration 2)

**Fixed at:** 2026-09-05
**Source review:** `.planning/workstreams/workflows/phases/111-workflows-bridge/111-REVIEW.md` (iteration 2)
**Iteration:** 2
**Scope:** critical + warning (WR-10, WR-11, WR-12). IN-06 is Info and out of scope.

**Summary:**

- Findings in scope: 3
- Fixed: 3 (WR-10, WR-11, WR-12)
- Skipped: 0

Each fix was **reproduced red-first** before the source was touched, and one of
the three (WR-12) was reproduced through a standalone probe as well as through
its test, because the escape it describes is a filesystem outcome rather than a
return value.

**Gate:** `npm run check` exits 0 — typecheck, lint, fallow, format:check,
test:corresponding, test:corresponding:negative, test:coverage:direct:negative,
test (unit), test:integration. `node --test tests/bridges/workflows/` is 62 pass
/ 0 fail (61 before, plus the WR-12 case).

**Verification ran in the main checkout**, not in an isolated worktree:
`workflow.use_worktrees` is `false` in `.planning/config.json`, so this pass
edited and committed on `features/workflow` directly. The numbers below are
reproducible from the tree as it stands.

**Direct coverage held at 100% on every touched pair** (`hit === found`),
measured after the last change:

| Module | Branches | Functions | Lines |
| --- | --- | --- | --- |
| `bridges/workflows/unstage.ts` | 11/11 | 1/1 | 100/100 |
| `bridges/workflows/stage.ts` | 62/62 | 14/14 | 456/456 |
| `bridges/workflows/discover.ts` (untouched) | 51/51 | 13/13 | 344/344 |

Branch counts rose (7 → 11, 59 → 62) because both fixes added real arms; every
one is reached by a case. No suppression, no `node:coverage ignore`, no
threshold override was added.

---

## Fixed Issues

### WR-10: `unstagePluginWorkflows` swallowed `PathContainmentError`

**Files modified:** `extensions/pi-claude-marketplace/bridges/workflows/unstage.ts`,
`extensions/pi-claude-marketplace/bridges/workflows/types.ts`,
`tests/bridges/workflows/unstage.test.ts`
**Commit:** `4964b398`
**Status:** fixed, verified by a red-first regression test

The finding is correct and it is mine: the WR-01 fix moved the composer inside a
catch that filtered only on `code !== "ENOENT"`, which made this the one
accumulator in the extension that softens a class documenting the opposite
policy on itself.

**I did not take the suggested remedy, and the divergence is the substance of
this fix.** The review proposed tagging the row `kind: "containment" | "io"`.
That records the class but does not restore PI-14: both ledger sites
(`phase-ledger.ts:89,125`) bypass on `instanceof` applied to a **thrown** error,
so a tagged row still returns a clean undo and Phase 112 would have to invent a
translation from `failed[].kind` back into a throw for the bypass to fire. It
also adds a discriminant nothing reads yet, for a caller that does not exist.

The refusal is now **raised**, which is what the existing machinery already
knows how to handle with no Phase 112 coordination at all.

**The two policies are not in tension, so nothing was traded away.** The loop
still runs to completion; the refusal is remembered and thrown after it. So the
envelopes recorded after a refused name are still removed — the whole point of
WR-01 — and the class still reaches the caller. The split is by error class,
not by position:

- ordinary per-name failure → `failed[]`, loop continues (WLIF-03)
- containment refusal → recorded, loop continues, raised at the end (PI-14)
- ENOENT → idempotent skip (NFR-3)

This also restores what the phase contract actually said. `111-02-SUMMARY.md:142`
describes the unstage as accumulating `failed[]` **and** "delegat[ing] its
containment refusal to the sole composer", and the threat row that motivates the
accumulation (`111-02-PLAN.md`, T-111-13) is scoped to "an unlink failure". A
composer refusal was never the thing `failed[]` was built to carry.

**The first refusal is the one raised**, not the last: every later one is
reached only by the decision to continue past the first, so raising a later one
would report a refusal that the recovery policy itself caused.

**It is thrown bare.** `appendLeaks` and `appendLeakToError` both return a plain
`Error` wrapping the original as `cause`, which would carry the text and destroy
the class — the one thing the caller narrows on. The `failed[]` rows collected
before a refusal are therefore lost on that path; that is the correct trade,
because the alternative loses the bypass.

**Reproduced before fixing.** The pre-existing symlink case asserted the row, so
it was rewritten into the case that would have caught this, and it fails against
the unfixed module on `assert.ok(error instanceof SymlinkRefusedError)`. It uses
**two** refused names followed by a removable one, which is the shape one refused
name cannot expose: it pins the first-wins choice and the continue-anyway
contract in the same case.

The separator case (`../escape`) is untouched and still asserts a `failed[]`
row — `assertSafeName` throws a plain `Error`, not a `PathContainmentError`, so
the two arms are distinguished by class and both are covered.

`types.ts` records the narrowed contract on `failed` itself, so a reader meets
it where the field is declared rather than only in the loop.

### WR-11: the rollback leak text contradicted the placement report

**Files modified:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts`,
`tests/bridges/workflows/stage.test.ts`
**Commit:** `3b16b169`
**Status:** fixed, verified by a red-first regression test

Confirmed exactly as described. Against the unfixed module the new assertion
prints the two contradictory statements in one error object:

```text
... rename '.../absent.json' -> '.../saved/acme:shout.json'
  (additionally: failed to roll back workflow rename
   .../saved/acme:greet.json -> .../rollback-blocker: EISDIR: ...)
```

while `onPlaced` reported `[]` and `acme:greet.json` held the restored previous
envelope.

**Fixed by unifying, not by duplicating the predicate.** The reversal failure's
reason now travels with its pair, and both channels are built from one
`stranded` list after the restore loop:

- `reportPlaced(stranded.map(...))` — the structured removal payload
- `stranded.map(...)` → `rollbackLeaks` — the human-readable recovery text

Two independent filters on one condition is how the halves came apart in the
first place, so there is now one place to change if the condition ever moves.
The leak strings are the manual-recovery instructions — the sibling restore leak
says to move a file back by hand — so the two channels must not be able to
disagree.

The leak text is byte-identical for a genuinely stranded pair; the existing
`"reports the still-placed names in discovery order"` case still passes
unchanged, including its `assert.match` on the leak prefix. The only difference
is leak ordering (discovery order now, unwind order before), which no case
asserts and which matches the order the report already used.

### WR-12: the `.previous` join was anchored on itself

**Files modified:** `extensions/pi-claude-marketplace/bridges/workflows/stage.ts`,
`tests/bridges/workflows/stage.test.ts`
**Commit:** `ede9459e`
**Status:** fixed, verified by a red-first regression test and a standalone probe

**Verified rather than pasted, as asked.** I planted `.previous` as a link to an
outside directory between prepare and commit and ran the real commit:

```text
commit error    : none (commit succeeded)
outside dir now : [ 'acme:greet.json' ]
  contents      : acme:greet.json "PREVIOUS ENVELOPE\n"
```

With the anchor raised to `prepared.stagingRoot` the same probe returns
`SymlinkRefusedError: displaced previous workflow file contains symlink
.../.previous -> /tmp/...`, the outside directory stays empty, and all 61
pre-existing workflow cases stay green — confirming the reviewer's note that no
current case discriminates the anchor, which is why a new one was added.

**The severity judgment is left where the reviewer put it.** The capability
needed is a same-user concurrent process with write access inside the staging
tree during the prepare→commit window, which `path-safety.ts:70-76` accepts as
residual TOCTOU risk, and which is not reachable from plugin-authored input. I
found no evidence to move it in either direction, so WARNING stands.

**I did not add a second check before the `mkdir`.** The staging-root comment
eight lines up justifies its pre-`mkdir` position by saying a recursive `mkdir`
follows a symlinked parent, so I checked whether a **dangling** `.previous` link
would let `mkdir` create a directory outside the tree before the refusal fires.
It does not:

```text
commit error : Error: ENOENT: no such file or directory, mkdir '.../.previous'
outside dir  : []
```

Node's recursive `mkdir` refuses to build through a dangling link, so there is
no residual for a second check to close and the one-identifier fix is complete.
Recorded here so the question is not re-derived from the asymmetry with the
staging-root join.

The new case plants a file inside the outside directory as well, so it asserts
two things rather than one: nothing was written through the link, and the
staging cleanup that follows the refusal removed the **link** rather than what
it points at.

---

## Out of scope this pass

**IN-06** (a throwing `onPlaced` destroys the original error and every rollback
leak) is Info, and this pass ran `--fix` without `--all`. Untouched. The WR-11
fix did not make it worse: `reportPlaced` is still one call in the same
position, and the expression it is handed is now shorter than before.

The iteration-1 dispositions are unchanged and were not re-opened: WR-06
(rejected with reasoning), WR-08 and WR-09 (carried as numbered Phase 112 / 113
ROADMAP success criteria), IN-01..IN-05 (Info).

## Scope boundaries observed

- `orchestrators/` — not touched. No `"bridges-workflows"` entry was added to
  the `orchestrators` zone's `allow` array in `.fallowrc.json`.
- `EXTENSION_VERSION` and the other five bump sites — not touched; still
  `0.19.0`.
- Phase 109's five inverted files (`domain/resolver.ts`,
  `domain/components/plugin.ts`, `shared/notify.ts`, `shared/notify-reasons.ts`,
  `shared/probe-classifiers.ts`) — not touched.
- `.planning/WINDOWS.md` — not touched.
- WR-08 and WR-09 — left on their ROADMAP carriers.
- No test-only export, module-global setter, reset hook or production seam was
  added. No new production or test file was created.
- Comment policy (`.claude/rules/typescript-comments.md`): no `Phase NN`,
  `Plan NN`, `Wave N` or bare `Pitfall N` token was introduced. Requirement and
  decision IDs (`PI-14`, `WLIF-03`, `WPTH-04`, `NFR-3`, `CR-02`) are used as the
  durable anchors the policy permits.

## Commits

| Finding | Commit | Kind |
| --- | --- | --- |
| WR-10 | `4964b398` | `fix(workflows): raise a containment refusal the ledger can bypass on` |
| WR-11 | `3b16b169` | `fix(workflows): withhold the leak text for a reclaimed rollback target` |
| WR-12 | `ede9459e` | `fix(workflows): lstat the displaced directory segment before using it` |

Every commit ran `pre-commit run --files <changed paths>` clean apart from the
structural `trufflehog` git-mode failure this checkout always produces (`.git`
is a file), which was cleared each time by a filesystem scan
(`--results=verified,unknown --fail`, 0 verified and 0 unverified secrets)
before committing with `SKIP=trufflehog`. No `--no-verify`, no `--amend`.
`git status` was checked after each commit for prettier-hook rewrites; none were
left behind.

---

_Fixed: 2026-09-05_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
