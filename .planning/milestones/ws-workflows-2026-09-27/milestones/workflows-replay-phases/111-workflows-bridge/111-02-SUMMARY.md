---
phase: 111-workflows-bridge
plan: 02
subsystem: bridges
tags: [workflows, discovery, symlink-refusal, soft-fail, fallow-zones, node-test]

# Dependency graph
requires:
  - phase: 110-domain-and-platform-modules
    provides: "`domain/workflow-script.ts::admitWorkflowScript` and `WORKFLOW_SCRIPT_EXTENSIONS`, the verdict union discovery renders"
  - phase: 111-workflows-bridge
    provides: "111-01's `workflowArtifactPath` composer and the three `$HOME`-derived workflows roots on `ScopedLocations`"
provides:
  - "`bridges/workflows/types.ts` -- the thirteen bridge types, including the `kind: \"noop\" | \"staged\"` prepared union and the `UnstageWorkflowFailure` record"
  - "`discoverPluginWorkflows` -- the flat, symlink-refusing, byte-faithful scan with its per-file `warnings[]` channel"
  - "`unstagePluginWorkflows` -- removal strictly by recorded name, ENOENT-idempotent, accumulating `failed[]`"
  - "The fourth outcome phrase `was installed but will not run` and the `stem-fallback` arm of `verdictWarning`"
  - "The `bridges-workflows` fallow zone, its allow rule and its forbidden-calls entry"
affects: [111-03, 111-04, install-lifecycle, admission-gate]

actuals:
  tokens: 15898
  tasks: 3
  commits: 1

tech-stack:
  added: []
  patterns:
    - "A permission-mutating case shares one `t.after()` with its tree removal: `t.after` hooks run in registration order, so a removal registered earlier races the still-locked directory"
    - "An admitted-but-caveated warning arm reuses the soft-fail composer with an outcome phrase that states the admitted fact first"
    - "A case-fold dedup case plants two real directories differing only in case, so the folded key is what collapses them rather than a non-existent second path"

key-files:
  created:
    - extensions/pi-claude-marketplace/bridges/workflows/types.ts
    - extensions/pi-claude-marketplace/bridges/workflows/discover.ts
    - extensions/pi-claude-marketplace/bridges/workflows/unstage.ts
    - tests/bridges/workflows/types.test.ts
    - tests/bridges/workflows/discover.test.ts
    - tests/bridges/workflows/unstage.test.ts
  modified:
    - .fallowrc.json

key-decisions:
  - "The criterion-4 row is emitted from `verdictWarning` in the discovery module, reusing `softFailWarning` with a fourth outcome phrase. No second message template was composed and `stage.ts` was not touched."
  - "The reason names the missing NAME and states the description as the engine's other requirement. It never claims this script's description is absent, because both measured stem-fallback shapes carry one."
  - "The uppercase-suffix case is a stem-fallback script, because the stem strip is only observable on that arm. Its warnings array was pinned only after the arm landed, so it did not pre-assert unbuilt behavior."
  - "The three permission cases build their own temp root rather than using `createPluginRoot`, so the restoring `chmod` and the tree removal share one hook. Registration-order hooks made the split form fail on cleanup, not on assertion."
  - "The case-fold dedup case plants two real directories (`workflows/` and `WORKFLOWS/`) each holding a script of the same name, so the assertion fails without the fold instead of passing on an absent second directory."

patterns-established:
  - "Admitted-but-caveated warning: state the admitted fact first, the caveat second, through the existing soft-fail composer"
  - "Every warning assertion compares the whole `warnings` array with one strict deep comparison against exact strings; a spurious extra row fails the case"
  - "A boundary-zone insertion and the first file under that zone land in the same commit, because `boundaries.coverage.requireAllFiles` fails the gate loudly in between"

requirements-completed: [WBRG-01, WBRG-02, WBRG-03]

coverage:
  - id: D1
    description: "The thirteen bridge types, including the prepared union's two discriminants and the required `failed` array on the unstage result, are consumed compile-time by their own owner test with no suppression directive"
    requirement: "WBRG-01"
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/types.test.ts (compile-time; `scripts/test-coverage-direct.mjs` classifies the module type-only)"
        status: pass
      - kind: other
        ref: "npm run test:corresponding && npm run test:corresponding:negative"
        status: pass
    human_judgment: false
  - id: D2
    description: "Discovery is flat and non-recursive, refuses symlinked entries before any read, filters dotfiles/directories/unadmitted suffixes silently, admits an uppercase suffix, and dedups by absolute source path (case-folded on a case-insensitive platform) but never by generated name"
    requirement: "WBRG-02"
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#scans a workflows directory flatly and never descends into a subdirectory"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#refuses a symlinked script without opening the file it points at"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#silently excludes dotfiles, directories and unadmitted suffixes"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#admits an uppercase script suffix and strips it from the fallback name"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#keeps both scripts when two files generate the same workflow name"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#discovers a script once when two declared spellings resolve to one directory"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#folds case when deduping declared paths on a case-insensitive platform"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every per-file failure -- an lstat throw, a readFile throw, a failed UTF-8 byte round trip, a skipped verdict, a refused verdict -- becomes one `warnings[]` row through one template and leaves every sibling script installing"
    requirement: "WBRG-03"
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#reports an entry whose lstat fails and still records its readable sibling"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#reports an unreadable script and still records its readable sibling"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#reports a script whose bytes do not survive a UTF-8 round trip"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#warns about a script that declares no metadata and still records the verdict"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#warns about a refused script and renders the verdict reason unparaphrased"
        status: pass
    human_judgment: false
  - id: D4
    description: "The read-side containment refusal is LOUD: a declared workflows component path that climbs out of or is absolute relative to the plugin root throws `PathContainmentError` rather than warning"
    requirement: "WBRG-02"
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#rejects a declared workflows path that climbs out of the plugin root"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#rejects an absolute declared workflows path"
        status: pass
    human_judgment: false
  - id: D5
    description: "A stem-fallback verdict earns exactly one warning row through the existing template, naming the missing literal name and stating the description as the engine's other requirement; the record is still returned, and a named verdict earns no row"
    requirement: "WBRG-03"
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#warns that a script declaring no name was installed but will not run"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#warns the same way when the declared name is present but not a literal"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/discover.test.ts#leaves a script with a readable literal name unwarned"
        status: pass
    human_judgment: false
  - id: D6
    description: "Unstage removes strictly by recorded name in recorded order, preserves foreign bytes, is ENOENT-idempotent, accumulates a non-ENOENT failure without abandoning later names, and delegates its containment refusal to the sole composer"
    requirement: "WBRG-01"
    verification:
      - kind: unit
        ref: "tests/bridges/workflows/unstage.test.ts#removes the recorded envelopes in order and preserves foreign bytes"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/unstage.test.ts#makes repeated unstaging a missing-envelope fixed point"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/unstage.test.ts#records an unremovable name and still removes the names after it"
        status: pass
      - kind: unit
        ref: "tests/bridges/workflows/unstage.test.ts#rejects a recorded name carrying a path separator"
        status: pass
    human_judgment: false
  - id: D7
    description: "The `bridges-workflows` fallow zone, its four-name allow rule and its forbidden-calls entry exist; the allow list names no sibling bridge zone, so a cross-bridge-kind import is a violation by construction"
    verification:
      - kind: other
        ref: "npm run fallow (exit 0, Boundary coverage section empty)"
        status: pass
    human_judgment: false

# Metrics
duration: 62 min
completed: 2026-09-05
status: complete
---

# Phase 111 Plan 02: Workflows bridge read side Summary

**The sixth bridge's read half -- thirteen types, a flat symlink-refusing byte-faithful discovery with a per-file soft-fail channel, and by-name removal that accumulates failures -- plus the `bridges-workflows` boundary zone and the one new behavior this phase authors: the admitted-but-caveated warning row for a stem-fallback script.**

## Performance

- **Duration:** 62 min
- **Started:** 2026-09-05T09:59:00Z
- **Completed:** 2026-09-05T11:01:00Z
- **Tasks:** 3
- **Files modified:** 7 (6 created, 1 modified)

## Accomplishments

- Three ported modules landed byte-for-byte from `features/workflow-port-wip` -- `types.ts` and `unstage.ts` with a zero-line diff against the port, `discover.ts` with exactly two removed lines, both of them the docblock sentence the new arm makes false.
- `discoverPluginWorkflows` reaches **100% direct coverage** (branches 56/56, functions 14/14, lines 348/348), including the `pathDedupKey` `darwin` arm that is otherwise unreachable on Linux and on the CI runner.
- `unstagePluginWorkflows` reaches **100% direct coverage** (branches 8/8, functions 1/1, lines 59/59).
- The criterion-4 row was written red-first and observed failing before the production arm existed.
- The `bridges-workflows` zone triple landed in the same commit as the first file under it, so the gate was never published red.

## Task Commits

This plan produces one commit, by design (`<commit_boundary>`): tasks 1 and 2 leave the tree knowingly red because the corresponding-test gate and the dead-code report both stay red until every module in the group has its owner test.

1. **Tasks 1-3: the workflows bridge read side** - `fc893974` (feat)

The commit carries exactly the seven paths in `files_modified` and nothing else, verified with `git show --pretty=format: --name-only HEAD`.

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/workflows/types.ts` - the thirteen bridge types; ported unedited (0-line diff against the port branch)
- `extensions/pi-claude-marketplace/bridges/workflows/discover.ts` - the flat scan, the soft-fail channel, and the new `unrunnableWarning` helper plus the `stem-fallback` arm of `verdictWarning`
- `extensions/pi-claude-marketplace/bridges/workflows/unstage.ts` - by-name removal; ported unedited (0-line diff against the port branch)
- `.fallowrc.json` - the `bridges-workflows` zone, allow rule and forbidden-calls entry, each inserted immediately after its `bridges-hooks` sibling
- `tests/bridges/workflows/types.test.ts` - 214 lines, no `test()` and no `describe()`; a compile-time consumer of all thirteen exports with 22 `@ts-expect-error` negative cases, each carrying prose on the same comment
- `tests/bridges/workflows/discover.test.ts` - 23 cases, flat top level
- `tests/bridges/workflows/unstage.test.ts` - 5 cases, flat top level

## The red, as observed

The criterion-4 assertions were added to `discover.test.ts` **before** any edit to `discover.ts`. `node --test tests/bridges/workflows/discover.test.ts` reported:

```
ℹ tests 23
ℹ pass 21
ℹ fail 2
```

Both failures were `assert.deepStrictEqual(discovery.warnings, [expected])` with

```
actual: []
expected: [ 'workflow script "aaa-quiet.js" in "…/workflows" was installed but will not run: …' ]
```

in `warns that a script declaring no name was installed but will not run` and
`warns the same way when the declared name is present but not a literal`.

After the arm landed: **23 tests, 23 pass, 0 fail.**

Exactly two cases went red, not three: the uppercase-suffix case (also a stem-fallback script) asserted only `discovery.discovered` at that point. Its whole-warnings-array assertion was added **after** the arm landed, so it never pre-asserted unbuilt behavior.

## The fourth outcome phrase and its reason, verbatim

For the later admission-gate phase to extend this seam without a message-shape change, here is the composed row exactly as it ships.

The helper:

```ts
function unrunnableWarning(fileName: string, workflowsDir: string): string {
  return softFailWarning(
    fileName,
    workflowsDir,
    "was installed but will not run",
    "the engine loads a command only from a literal `meta.name` with a non-empty " +
      "`meta.description`, and this script declares no readable name",
  );
}
```

The rendered row, as the three criterion-4 cases assert it character-for-character:

```
workflow script "greet.js" in "/plugin/workflows" was installed but will not run: the engine loads a command only from a literal `meta.name` with a non-empty `meta.description`, and this script declares no readable name
```

- **Outcome phrase:** `was installed but will not run`. The admitted fact leads, the caveat follows. That is what distinguishes this arm from the three soft-fails (`could not be read and was skipped`, `was not installed`, `was refused`), each of which states a non-outcome.
- **Reason:** names the missing **name**. The description is stated as the *other requirement the engine imposes*, never as a second observed absence -- both measured stem-fallback shapes carry a description, so a row claiming otherwise would be a false statement about the file.
- **Template:** unchanged. `grep -c 'softFailWarning' discover.ts` prints exactly `5` -- the composer's own definition plus the four outcome-phrase helpers that delegate to it. No second template exists.
- **Seam:** the row is emitted from `verdictWarning` in the discovery module. `stage.ts` was not touched and is not in this plan's blast radius; it already re-exports the discovery warnings unchanged, so the row will reach the commit result with no staging edit.

## The two flagged planner assumptions, resolved in practice

### WBRG-02 (unclassified): the four filters are independently observable

**Assumption held.** Each negative is paired with an admissible positive control in the same directory, so a filter that dropped everything fails the case rather than passing it:

| Filter | Negative planted | Positive control |
|---|---|---|
| nested directory | `workflows/nested/shout.js` | `workflows/greet.js` |
| dotfile | `.hidden.js` | `greet.js` |
| directory with an admitted suffix | `bundle.js/` (a directory) | `greet.js` |
| unadmitted suffix | `notes.txt` | `greet.js` |
| symlink | `linked.js` -> a script outside the plugin root | `greet.js` |

The symlink case additionally asserts that the linked target's distinctive body text appears nowhere in the serialized result, which is what proves the body was never opened rather than merely not recorded.

**The `pathDedupKey` exception was resolved as the plan anticipated, and strengthened.** `process.platform` is relocated to `darwin` with the original property descriptor captured via `Object.getOwnPropertyDescriptor` and restored in a `t.after()` registered before the mutation; the case is marked `{ concurrency: false }`. The plan's case shape (one directory declared under two case-differing spellings) would have passed **vacuously** on Linux, where `WORKFLOWS/` simply does not exist and `readdir` returns nothing. The landed case therefore plants **two real directories**, `workflows/` and `WORKFLOWS/`, each holding a `greet.js`: under the folded key the second is deduped to one record, and without the fold both are discovered and the assertion fails. The coverage claim is met and the assertion is load-bearing rather than incidental.

### WBRG-03 (unclassified): warnings are asserted as exact strings, not rendered

**Assumption held, unchanged.** Nothing renders these warnings until a later phase wires a caller, so every warning assertion in `discover.test.ts` is a whole-array `assert.deepStrictEqual` against exact strings. No rendered-output assertion was attempted. `grep -c 'assert\.match('` over the non-comment lines prints `0`; there is no membership check, index read or length check anywhere in the file, so a spurious extra row fails its case.

## Direct-coverage figures

| Module | Result |
|---|---|
| `bridges/workflows/types.ts` | `type-only` (classified by `scripts/test-coverage-direct.mjs`; no coverage owed) |
| `bridges/workflows/discover.ts` | branches **56/56**, functions **14/14**, lines **348/348** |
| `bridges/workflows/unstage.ts` | branches **8/8**, functions **1/1**, lines **59/59** |

## Decisions Made

See `key-decisions` in the frontmatter. The two worth restating:

**The permission cases build their own temp root.** Three cases mutate a directory or file mode. Written as the analogs suggest -- `createPluginRoot` registering the tree removal, then a separate `t.after()` restoring the mode -- two of them **failed on cleanup**, not on assertion: `node:test` runs `t.after` hooks in registration order, so the removal ran first and hit `EACCES` on the still-locked path. The landed form calls `mkdtemp` directly and registers **one** hook that restores the mode and then removes the tree, which is what the commands analog actually does at `discover.test.ts:379-405`. The restoring `chmod` is still registered before the mutating one.

**The uppercase-suffix case is a stem-fallback script.** The stem strip is only observable on the stem-fallback arm -- a named script's generated name comes from its own `meta.name` and would prove nothing about suffix handling. `Loud.JS` therefore yields `acme:Loud`, proving that the lowercased-suffix filter and the domain stem rule admit the same set.

## Deviations from Plan

### Test-design deviations

**1. The case-fold dedup case plants two real directories rather than one directory under two spellings**

- **Plan text:** "Declare the same directory under two spellings that differ only in letter case, and assert each script appears exactly once."
- **What was done:** two real directories, `workflows/` and `WORKFLOWS/`, each holding a `greet.js`, declared under both spellings.
- **Why:** on the Linux dev box and on the Node 24 CI runner the filesystem is case-**sensitive**, so `WORKFLOWS/` under the plan's shape does not exist, `readdir` returns `[]`, and the case passes whether or not the key is folded. It would have covered the `darwin` arm while asserting nothing about it. The landed form fails without the fold (two records, one expected), so the coverage claim and the behavioral claim are both real. The plan's stated intent is preserved and strengthened.

**2. Three permission cases do not use the shared `createPluginRoot` helper**

- **Plan text:** "Restore the mode in a `t.after()` registered before the mutation."
- **What was done:** the restoring `chmod` is registered before the mutation, but it shares one hook with the tree removal, and those cases call `mkdtemp` directly instead of `createPluginRoot`.
- **Why:** measured. With the removal registered first (which `createPluginRoot` forces), `rm` runs before the restoring `chmod` and fails with `EACCES`, turning two green assertions into two red cases. The ordering constraint the plan names is satisfied; only the hook count changed. This matches `tests/bridges/commands/discover.test.ts:379-405`, which uses the same combined form.

**3. The uppercase-suffix case's warnings array was pinned after task 3, not during task 2**

- **Plan text:** task 2's acceptance criteria require every warning assertion to compare the whole array.
- **What was done:** during task 2 that case asserted `discovery.discovered` only; its whole-warnings-array assertion was added in task 3 immediately after the arm landed.
- **Why:** the case's script is a stem-fallback, so its correct warnings array is `[]` before the arm and a one-element array after. Pinning `[]` in task 2 would have created a third red case in task 3 for a behavior the plan predicted at two; pinning the post-arm value in task 2 would have asserted unbuilt behavior. Deferring the pin by one task keeps the red observation exactly as predicted and still leaves every warning assertion in the committed file comparing a whole array.

---

**Total deviations:** 0 auto-fixed bugs, 3 test-design deviations.
**Impact on plan:** all three are confined to test code and each strengthens or preserves the plan's stated intent. No production behavior departs from the plan. The only production edit this plan authored is the fourth outcome phrase, the new arm, and the two replaced docblock lines, exactly as the prohibitions require.

## The adjacency deliberately NOT closed here

A **`named` verdict carrying no `description`** is equally unloadable by the engine's `validateMeta`, and it earns **no row**. That is the admission-gate phase's territory (its criterion about a `meta` the engine's literal validation would reject), and shaping this row through `softFailWarning` is precisely what lets that phase subsume it without a message-shape change.

Also deliberately out of scope, per `<commit_boundary>` and the phase boundary: `stage.ts` and the barrel `index.ts` were **not** checked out. `ls extensions/pi-claude-marketplace/bridges/workflows/` prints exactly `discover.ts types.ts unstage.ts`. Nothing wires the bridge into an orchestrator, and no version constant was touched.

## Issues Encountered

Two cases failed on their **cleanup hook**, not on their assertion, and the runner reported them as ordinary failures with a filesystem error in place of an assertion diff. The distinguishing signal is the error's `syscall` -- `scandir` and `unlink` on paths the case itself had locked -- rather than an `ERR_ASSERTION`. Resolved by the combined-hook form described above. Recorded because the failure looks like a broken assertion in the summary line and is not one.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The read side is landed and green. `111-03` may check out `stage.ts` and `index.ts` and write their owner tests; the `bridges-workflows` zone already covers them, so the `Boundary coverage` section will stay empty.
- `prepareStageWorkflows` will forward `discoverWarnings` unchanged, so the criterion-4 row reaches `StageWorkflowsCommitResult.warnings` with no staging edit. `111-03`'s stage-side criterion-4 case should assert the same exact string **while the envelope is still staged**, so the row is not mistaken for a refusal.
- `workflowArtifactPath` is **async**. Every call site in `stage.ts` must `await` it; a forgotten `await` yields a path leaf named `[object Promise]` rather than throwing.
- Full gate chain green at `fc893974`: `typecheck` 0 errors, `lint` clean, `fallow` exit 0 with an empty `Boundary coverage` section, `format:check` clean, both corresponding-test gates passing, `npm test` 5349/5349 and `npm run test:integration` 32/32.
- The five kind-inversion files were clean at the commit boundary (`git status --porcelain` over them printed nothing).
- No `fallow-ignore` marker, coverage exception, `test.skip`, `test.todo`, `test.only`, stub, TODO or FIXME was added.

## Self-Check: PASSED

- All six created files and the one modified file exist on disk.
- Commit `fc893974` resolves in `git log --all` and contains exactly the seven planned paths.
- `grep -c 'bridges-workflows' .fallowrc.json` prints `3`; the allow list is exactly `domain, persistence, shared, platform` and no `orchestrators` rule mentions the zone.
- `grep -c 'softFailWarning' discover.ts` prints `5`.
- `git diff features/workflow-port-wip` over `types.ts` and `unstage.ts` is empty; over `discover.ts` it removes exactly the two docblock lines.
- No planning-artifact token (phase, plan, wave or numbered pitfall) appears in any comment or test title in the changed files.

---
*Phase: 111-workflows-bridge*
*Completed: 2026-09-05*
