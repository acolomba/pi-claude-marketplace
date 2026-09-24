---
phase: 07-marketplace-repo-tag-resolution
reviewed: 2026-09-19T23:59:00Z
depth: standard
iteration: 3
files_reviewed: 37
files_reviewed_list:
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/domain/plugin-resolver.ts
  - extensions/pi-claude-marketplace/domain/release-tag.ts
  - extensions/pi-claude-marketplace/domain/resolver-types.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/marketplace-tag-probe.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/platform/git.ts
  - extensions/pi-claude-marketplace/shared/fs-utils.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - scripts/test-coverage-direct.pin.json
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/catalog-uat/catalog-parser.test.ts
  - tests/architecture/catalog-uat/fixtures/plugin-install.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/dependency-doc-agreement.test.ts
  - tests/architecture/marketplace-tag-probe-offline.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/domain/release-tag.test.ts
  - tests/integration/path-source-tag-install.test.ts
  - tests/orchestrators/plugin/clone-cache.test.ts
  - tests/orchestrators/plugin/dependency-tag-probe.test.ts
  - tests/orchestrators/plugin/install-cascade.messaging.test.ts
  - tests/orchestrators/plugin/install-cascade.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/marketplace-tag-probe.test.ts
  - tests/orchestrators/plugin/update-preflight.test.ts
  - tests/orchestrators/plugin/update-swap.test.ts
  - tests/platform/git.test.ts
  - tests/shared/notification-types.test.ts
findings:
  critical: 0
  warning: 4
  info: 6
  total: 10
status: issues_found
---

# Phase 07: Code Review Report (re-review, iteration 3)

**Reviewed:** 2026-09-19T23:59:00Z
**Depth:** standard
**Files Reviewed:** 37
**Status:** issues_found

## Summary

This is a re-review of the second fix batch (`371d8269..HEAD`, 9 commits ending `5428d4fe`)
against iteration 2's two blockers and six warnings. I read every diff hunk, re-opened the
surrounding production code, diffed the reverted files against the pre-fix baseline `4cbafee5`
byte-for-byte, and ran the toolchain myself rather than trusting `07-REVIEW-FIX.md`.

**Both iteration-2 blockers are genuinely closed, and CR-02's revert is complete.**

`CR-01` (the broken CI coverage gate) is fixed at the root, not pinned around.
`npm run test:coverage:direct` now exits **0**, and `platform/git.ts` measures
`branches 77/77, functions 17/17, lines 706/706` — the `force` true-arm is reached through the
wrapper by the new `tests/platform/git.test.ts:1291` case, which discriminates (without `force`,
`git.checkout`'s `'110'` analyze case is a noop against a work tree emptied to bare `.git`, so
`README.md` never appears). The separate `install-outcome.ts` pin edit in `5428d4fe` is a
legitimate bookkeeping reconciliation, not a masked gap: the measured reading is now
`branches 120/122, lines 1122/1128`, the *deficit* (the same two pinned arms) is unchanged, and
the three-line growth traces exactly to the comment-only edit at `install-outcome.ts:979-982`.
The reconciler reports "3 pinned shortfall(s) matched … exactly", with no unpinned shortfall.

`CR-02` (the silently reversed locked decision D-07-03) is reverted, and I could not find a
single lingering trace of the `warning` behavior anywhere:

- `git diff 4cbafee5..HEAD` over `install-cascade.messaging.ts`, `catalog-contract.test.ts`,
  `fixtures/plugin-install.ts` and `install-cascade.messaging.test.ts` is **empty** — a byte-exact
  revert, not a re-write that happens to look similar. `EXPECTED_UTF8_BYTES` is back to `29_798`,
  the fixture's `expectedSeverity: "warning"` field is gone and its row is `severity: "info"`, and
  the severity ternary is replaced by the bare `companionSeverity(...)` call.
- `docs/dependency-resolution.md:104`'s divergence sentence is restored **verbatim** ("This
  extension reports it as a plain note instead, because nothing has gone wrong at install time");
  `docs/output-catalog.md`'s heading is back to `(TAGS-02 / D-07-03)`, the
  `A plugin operation needs attention.` block header is gone from the example, and the prose says
  "a quiet `info`-level note (D-07-03) -- a deliberate divergence from upstream". The only
  remaining delta in either doc against the baseline is iteration 1's intended WR-08 sentence and
  WR-10's "Phase 6's" → "the" edit.
- Grepping the whole tree for `WR-05`, `unverified version`, and `fellBackToCurrentCopy` turns up
  nothing outside `.planning/`; the three renamed test titles are back to their pre-regression
  wording; the integration and install-flow expectations no longer carry `severity: "warning"` or
  the block header.
- Iteration 1's WR-05 second option was taken: `notify-reasons.ts:313-320` now records why the
  reason stays `info`, cites D-07-03, and tells a future reader not to raise it without a
  superseding decision.

**The six iteration-2 warnings all landed, and I could not break any of them.** WR-01's
lightweight-tag arm now decides the target's type (`git.readCommit` in a nested catch); I checked
`node_modules/isomorphic-git/index.js:6095-6106` and `resolveCommit` throws `ObjectTypeError` for
a non-commit, so a lightweight blob/tree tag yields `undefined` and the probe drops it. WR-02's
projection now agrees with the write, and the sha-only case discriminates — the sibling
`"does not rewrite an unchanged disabled pin"` case at `update-preflight.test.ts:378` proves that
seed's projection matches exactly, so the stale sha really is the only difference. I also chased
the obvious way that fix could have gone wrong: `GitPluginRootResult.resolvedSha` is a REQUIRED
`string` (`resolver-types.ts:124`) and `captured` is set on every arm of both git probes, so
`preflight.resolvedSha === undefined` can only ever mean a non-git source — no git or npm record
can have a live sha deleted. WR-03, WR-04, WR-05 and WR-06 all landed as described, and the new
`clone-cache` staging-leak case discriminates (before the fix the `mkdir` left the directory
behind, failing its `stagingEntries` assertion).

**What is left** is four test-quality and comment-policy defects, three of them introduced or
missed by the fix passes themselves, plus the info items iterations 1 and 2 left out of scope.
Nothing here is a correctness or security defect; no Critical issues remain.

## Warnings

### WR-01: GSD plan references and removed-code narration survive in `install-cascade.test.ts`, which WR-10 reported as closed

**File:** `tests/orchestrators/plugin/install-cascade.test.ts:1312`, `1444-1447`, `1596-1598`
**Issue:** Iteration 1's WR-10 (`2d333a9d`, "strip GSD phase/plan references from comments and
test titles") was recorded closed in iteration 2's ledger. Three comment blocks in this file were
missed, and all three are direct violations of `skills/typescript-comments/SKILL.md`:

```ts
// line 1312
  // arrange: 07-01's behaviour must not move.

// lines 1444-1447
  // arrange: TAGS-02 supersedes the interim 07-01 behaviour -- a local
  // read failure is never a transport failure, and it is no longer a cascade
  // failure of any kind either. It takes the SAME fallback arm the
  // no-matching-tag case does (D-07-07).

// lines 1596-1598
// TAGS-02: a path source's own no-matching-tag arm no longer fails the
// cascade (it falls back to the marketplace's current copy instead), so it is
// no longer a member of this loop -- see the dedicated TAGS-02 test below.
```

`07-01` is the `Plan NN-NN` form the policy forbids outright ("`Phase NN`, `Plan NN`,
`Plan NN-NN`, `Wave N`, `Task N` references to GSD planning steps"). The "supersedes the interim
… behaviour" and "no longer fails / no longer a member" phrasings are the "narration of code that
no longer exists" clause ("A comment describes the code as it stands, not the shape it
replaced"). `07-01` is also the durability failure the policy exists to prevent: the plan file is
archived at milestone close and the token stops resolving to anything.

**Fix:** State the current fact and keep only the durable anchors.

```ts
  // arrange: a path-source member's own constraint resolution, which the
  // git-backed arm below must not be able to change.

  // arrange: a local tag-listing read failure takes the SAME fallback arm the
  // no-matching-tag case does, and is never a cascade failure (D-07-07).

// TAGS-02: this loop covers the "absent" tag-source arm only. A path source's
// no-matching-tag arm falls back to the marketplace's current copy and has its
// own case below.
```

### WR-02: the fix pass itself added a `Before this fix, …` comment the policy forbids

**File:** `tests/orchestrators/plugin/install-flow.test.ts:3076-3081`
**Issue:** Iteration 1's WR-03 fix (`824ededb`, the `marketplaceTagProbe` injection point)
introduced this arrange comment, and it survived both the WR-10 comment sweep and iteration 2:

```ts
      // arrange: a path-source dependency constrained to `^1.0.0`, on a
      // marketplace root that is deliberately NOT a git repository. Before
      // this fix, `installPlugin` had no seam for this arm (unlike the
      // network `tagProbe` sibling's), so the real local probe was always
      // reached and its `ENOENT` on `.git` was the only outcome obtainable --
      // no fixture-free unit test could answer this constraint at all.
```

`skills/typescript-comments/SKILL.md` names `Pre-fix, X …` and `X no longer …` in its forbidden
list and requires the rationale be restated as a present-tense fact about the current code. Three
of these six lines describe a shape that is no longer in the tree; a reader of the file as it
stands cannot check any of it.

**Fix:**

```ts
      // arrange: a path-source dependency constrained to `^1.0.0`, on a
      // marketplace root that is deliberately NOT a git repository -- the
      // `marketplaceTagProbe` seam is what lets this case answer the
      // constraint instead of taking the real probe's `ENOENT` on `.git`.
```

### WR-03: the WR-03 fix replaced a whole-value memo assertion with a weaker single-key check

**File:** `tests/orchestrators/plugin/dependency-tag-probe.test.ts:439`
**Issue:** `9d23d306` rewrote this case's final memo assertion:

```diff
-  assert.deepStrictEqual([...tagMemo], []);
+  assert.strictEqual(tagMemo.has(PLUGIN_REPO_URL), false);
```

`skills/typescript-unit-testing-review/SKILL.md` classifies this shape twice over: "Whole values
compared with `assert.deepStrictEqual()`; asserting existence … when the whole value is the
promise is a finding", and "a revision that weakens assertions is a finding even when the tests
still pass". The loss is concrete — the old form fails an implementation that memoizes a failed
listing under any other key (a canonicalized URL, an auth-qualified key); the new form passes it.
The sibling `marketplace-tag-probe.test.ts:206` carries the same weak shape, so the two files now
agree in the weaker direction rather than the stronger one.

**Fix:** Assert the whole memo, in both files.

```ts
  assert.deepStrictEqual([...tagMemo], []);
```

### WR-04: the new staging-leak case asserts the error by message substring, breaking its own file's established pattern

**File:** `tests/orchestrators/plugin/clone-cache.test.ts:1721`
**Issue:** The WR-04 regression test (`26bc904f`) discriminates correctly on the leak, but its
rejection predicate reads:

```ts
    (err: unknown) => err instanceof Error && err.message.includes("ENOENT"),
```

`skills/typescript-unit-testing-review/SKILL.md`: "Errors asserted by class and structured fields
(`instanceof`, `error.code`, `error.orderId`), not by message substring." The same file already
does it the required way at lines **440, 478, 655 and 1124** (`{ code: "ENOENT" }`), so this is an
in-file inconsistency introduced by the fix, not a house-style question. A message-substring match
also survives a locale- or Node-version-dependent message change.

The case additionally leaves the verb's own failure contract unasserted: every other failure path
in `materializeMarketplaceTagClone` re-throws through `appendLeakToError` (`clone-cache.ts:688`),
and nothing here proves the annotation reaches the caller on the `cp` arm. A fix that moved the
`cp` inside the `try` but forgot `appendLeakToError` would still pass.

**Fix:**

```ts
  // act & assert
  await assert.rejects(
    materializeMarketplaceTagClone({ /* … */ }),
    { code: "ENOENT" },
  );
  assert.deepEqual(await stagingEntries(locations), []);
```

and add the leak-annotation assertion the sibling failure cases in this file already make.

## Info

### IN-01: the reason-count narrative still contradicts itself (carried forward, unfixed since iteration 1)

**File:** `extensions/pi-claude-marketplace/shared/notify-reasons.ts:50-65`
**Issue:** Unchanged. Lines 54-56 say the LOAD-03 addition and the D-06-07 retirement "cancel,
which is why the count ends this phase where the sentence before it left off" — i.e. **57** — and
line 60, written by this phase, then says `(58 to 59)`. `REASONS` really holds 59, and
`notify-closed-set-locks.test.ts:93` pins it with a correct narrative. Lines 64-65's pre-existing
claim that "the arithmetic above is renumbered rather than annotated with the gap" is false as
the block now stands.
**Fix:** Reword the cancel sentence to land on 58, matching the lock test's own comment.

### IN-02: test doubles still named after their kind, and the race case still has no AAA markers

**File:** `tests/orchestrators/plugin/marketplace-tag-probe.test.ts:24-55`, `219-266`
**Issue:** Unchanged from iteration 2. `createFakeSeam` / `FakeSeamOptions` / the local `fake`
name the double by its construction, and the 40-line concurrency case carries no
`// arrange` / `// act` / `// assert` markers. Several sibling cases in the same `describe` also
lack them. The cases themselves are correct and discriminating.
**Fix:** Rename to the role (`createTagListing`) and add the three phase markers.

### IN-03: the relabelled failure detail still reads `path path "…"` and still names a "plugin clone" — and a gate now pins it

**File:** `extensions/pi-claude-marketplace/shared/fs-utils.ts:338, 350`,
`tests/orchestrators/plugin/clone-cache.test.ts:1751`
**Issue:** Unchanged from iteration 2: the pinned-`path` arm produces
`path path "./plugins/formatter" does not exist in the plugin clone`. The doubled word reads as a
typo in user-facing output, and `assert.match(result.detail, /^path path "/u)` now gates the
awkward form in, so fixing the wording later also costs a gate edit.
**Fix:** Pass a noun phrase rather than a bare kind (`"source path"` / `"git-subdir path"`) and
word the missing case against the tag: `source path "./plugins/formatter" does not exist at the
selected release tag`. Update the gate's pattern in the same edit.

### IN-04: a marketplace whose `.git` is a file (worktree or submodule) still cannot materialize a tag clone

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:667-685`
**Issue:** Unchanged from iteration 2. `cp(path.join(marketplaceRoot, ".git"), …)` copies a `.git`
**file** verbatim when the marketplace checkout is a git worktree or submodule; the file holds
`gitdir: <absolute path>` and isomorphic-git resolves `gitdir` as `<dir>/.git` with no gitlink
support, so the checkout fails with a raw isomorphic-git error. The comment block at 667-673 now
reasons explicitly about what copying `.git` does and does not admit and still does not name this
case. This project is itself developed from worktrees.
**Fix:** Detect the gitlink (`stat(.git).isFile()`) and fail with a named reason, or resolve it
and copy the real gitdir. At minimum record the limitation in the comment.

### IN-05: `install-outcome.ts` claims a change is "byte-identical to today", which the policy forbids

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts:490-494`
**Issue:** The comment reads "Added ONLY when a pin is present, so an unpinned `path` source stays
byte-identical to today (neither field is set at all)."
`skills/typescript-comments/SKILL.md`: "A claim of the form 'this is byte-identical to what came
before' is not a fact about the current code at all -- the gate that pins the bytes is, so name
the gate or say nothing."
**Fix:** Drop the clause, or name the gate that holds the property (the catalog byte pin, or the
`install-flow` case that asserts the unpinned row).

### IN-06: the disabled-refresh clone sweep no longer runs when only a record's compatibility changed

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:483-485`
**Issue:** The WR-05 fix narrowed both sweep gates from `resolvedSha !== undefined` to
`preflight.resolvedSha !== preflight.record.resolvedSha`. That is right for the case it targets,
and I confirmed the `update-swap.ts:1107` sibling loses nothing reachable (for every git kind,
`deriveUpdateToVersion` derives the version from the sha, so an unchanged sha returns the
`unchanged` partition before `swapPluginUpdate` is ever called). The preflight gate does lose one
reachable case: a **disabled** git-source record whose compatibility notes changed but whose sha
did not now skips the sweep it used to perform. No new orphan is created — the record's own clone
is still live — so this only drops an opportunistic cleanup of orphans left by an earlier crash,
which `uninstall` and `marketplace remove` still perform.
**Fix:** None required for correctness. If the opportunistic sweep is worth keeping, widen to
`preflight.resolvedSha !== preflight.record.resolvedSha || preflight.record.resolvedSha !== undefined`
and say so in the comment; otherwise leave it.

---

## Verification performed

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | clean (exit 0) |
| `npx eslint <all changed .ts in 371d8269..HEAD>` | clean (exit 0) |
| `npx prettier --check <all changed files>` | "All matched files use Prettier code style!" |
| `npm test` | **6,721 pass / 0 fail** (331 suites), exit 0 |
| `npm run test:integration` | 0 fail, exit 0 |
| `npm run test:corresponding` | "Corresponding-test gate passed.", exit 0 |
| `npm run test:coverage:direct` | **exit 0** — "3 pinned shortfall(s) matched … exactly" (iteration 2's CR-01 closed) |
| ↳ `platform/git.ts` | `branches 77/77, functions 17/17, lines 706/706` — "Direct coverage passed" |
| ↳ `install-outcome.ts` | `branches 120/122, lines 1122/1128` — matches the reconciled pin |
| `npx fallow dead-code` | exit 0, "No issues found" |
| `npx fallow dupes` | exit 0 (1,148 pre-existing lines across 42 files, none in this phase's files) |
| `npx fallow health` | exit 0, "0 above threshold", maintainability 91.7 |
| `git diff 4cbafee5..HEAD -- <CR-02's five files>` | empty for four of five — byte-exact revert |

Cross-checked against sources, not inferred: `node_modules/isomorphic-git/index.js:6095-6106`
(`resolveCommit` throws `ObjectTypeError` for a non-commit, which is what makes WR-01's nested
`readCommit` catch correct), `resolver-types.ts:124` (`GitPluginRootResult.resolvedSha` is a
required `string`, which is what makes WR-02's `?? shaFallback` removal safe for git sources), and
`transaction/with-state-guard.ts:70-75` (`withStateGuard` loads state fresh, so
`preflight.record.resolvedSha` in the WR-05 gate is genuinely the pre-swap value).

## Iteration-2 closure ledger

| Iteration 2 finding | Status |
| --- | --- |
| CR-01 — `test:coverage:direct` fails, `platform/git.ts` unpinned at 75/76 | **closed**, covered not pinned |
| CR-02 — fallback severity contradicts locked D-07-03 | **closed**, byte-exact revert + D-07-03 rationale recorded in `notify-reasons.ts` |
| WR-01 — lightweight blob/tree tag yields a non-commit oid | **closed**, paired test at `git.test.ts:1291` |
| WR-02 — stale-`resolvedSha` clear never fires on a sha-only difference | **closed**, discriminating test added |
| WR-03 — `dependency-tag-probe.ts` dead memo eviction | **closed**, both probes now agree (assertion weakened → this iteration's WR-03) |
| WR-04 — `.git` copy outside the staging guard | **closed** (assertion style → this iteration's WR-04) |
| WR-05 — clearing a `resolvedSha` skips the clone GC | **closed** (one reachable narrowing → IN-06) |
| WR-06 — two `describe()` blocks for one entrypoint | **closed**, folded with AAA markers |
| IN-01 / IN-02 / IN-03 / IN-04 / IN-05 | out of fix scope; IN-01..IN-04 carried forward, IN-05 resolved (both probe docstrings now state the same rule) |

## Scope note

The `files:` list passed in this invocation (28 entries) omits nine files the second fix batch
actually changed: `update-preflight.ts`, `update-swap.ts`, `fs-utils.ts`,
`scripts/test-coverage-direct.pin.json`, `tests/platform/git.test.ts`,
`tests/orchestrators/plugin/clone-cache.test.ts`, `update-preflight.test.ts`,
`update-swap.test.ts` and `dependency-tag-probe.test.ts`. Reviewing the config list alone would
have missed every one of iteration 2's WR-01, WR-02, WR-04 and WR-05 fixes and the coverage-pin
edit. This review covers the union; `files_reviewed_list` records it.

---

_Reviewed: 2026-09-19T23:59:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
