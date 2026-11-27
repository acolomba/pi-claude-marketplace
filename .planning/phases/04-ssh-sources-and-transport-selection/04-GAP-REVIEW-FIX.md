---
phase: 04-ssh-sources-and-transport-selection
fixed_at: 2026-11-27T00:00:00Z
review_path: .planning/phases/04-ssh-sources-and-transport-selection/04-GAP-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 5
skipped: 1
status: partial
---

# Phase 4: Gap-Closure Code Review Fix Report

**Fixed at:** 2026-11-27
**Source review:** `.planning/phases/04-ssh-sources-and-transport-selection/04-GAP-REVIEW.md`
**Iteration:** 1

The maintainer put all six findings in scope (decisions of 2026-11-27).

**Summary:**

- Findings in scope: 6
- Fixed: 5 (WR-G-01, WR-G-02, WR-G-03, WR-G-04, IN-G-01)
- Skipped: 1 (IN-G-02: the case it describes cannot occur; a guard scenario
  pins what apply reports instead)

Each fix ran its owner tests, `test/orchestrators/plugin/bootstrap.test.ts`,
`test/edge/register.test.ts`, and the direct coverage of its pairs before its
commit, and the commit hook ran `npm run check:commit`. Every check ran in
the fixer's isolated worktree of the main checkout (branch
`worktree-agent-a1e1690d070521272`, from `features/system-git` at `b0c6df9`).
The final suite results are under "Verification".

## Fixed Issues

### WR-G-01: An aborted bulk update sends a second notification that repeats the failed block's marketplace clone note

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts`,
`features/plugin/github-transport-update.feature`,
`features/step_definitions/plugin/update.steps.ts`,
`test/orchestrators/plugin/update-cascade.test.ts`
**Commit:** 112555c
**Applied fix:** the review's first fix. `groupCascadeOutcomes` takes
`abortedByFailure` and keeps a group with no rows only when the batch was not
aborted. A group with rows keeps its note, as before.
**Tests:** the unit case "an aborted bulk update sends no block that only
repeats the failed target's sync note" (red before the fix: it sent the
block). The scenario "Updating every plugin when one update fails after the
github marketplace moved names the re-clone once" (red before the fix: the
command reported a second cascade result). The step "the failed update names
these repairs" now adds the `marketplace clone note` and `marketplace clone
url` columns whenever a block names a re-clone, so the scenario checks that
the failure's own block names it. The three scenarios that already use the
step name no re-clone, so their tables did not change.
**Residual:** in an aborted batch, a rowless group of another marketplace,
whose sync re-cloned it for an earlier unchanged target, is also dropped.
373e8e6 did not show that group either. The review's second fix (drop only
the failing target's note) would keep it, but it also removes the note from
the failing marketplace's group that has rows, which changes current output.

### WR-G-02: The autoupdate no-op path drops the note of a plugin re-clone that the direct bulk update now keeps

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`,
`features/marketplace/update.feature`, `test/orchestrators/marketplace/update.test.ts`
**Commit:** fc00741
**Applied fix:** the no-op block of an unchanged marketplace whose autoupdate
cascade changed nothing keeps the up-to-date row of each outcome that carries
a clone note. The block keeps its own sync note, and every other row is still
dropped.
**Tests:** the unit case "an all-unchanged autoupdate cascade keeps the
up-to-date row of a plugin its update cloned and drops the others" (red
before the fix). The scenario "Updating an unchanged marketplace with
autoupdate on names the clone of the github plugin whose clone is gone",
next to the 04-23 one (red before the fix: no plugin row).

### WR-G-03: The `owner/repo` refusal checks the pair after Pi normalizes it, not upstream's raw `repo`

**Files modified:** `extensions/pi-claude-marketplace/domain/source.ts`,
`extensions/pi-claude-marketplace/orchestrators/github-transport.ts`,
`extensions/pi-claude-marketplace/shared/errors.ts`, `.planning/PROJECT.md`
(D-SG-18 row), `features/plugin/github-transport.feature`,
`test/domain/source.test.ts`, `test/orchestrators/github-transport.test.ts`
**Commit:** 96c6e31
**Applied fix:** `GitHubSource` has an optional `repository`: the `repo` of a
manifest `{ "source": "github" }` object as written. Only that object arm of
`parsePluginSource` sets it. The clone plan checks `repository` when it is
present and `<owner>/<repo>` otherwise, and it refuses before any probe,
check, or attempt, as before. The review's `source.raw` fix was not used,
because `raw` is also the URL of a `{ "source": "url" }` object on
github.com, which Claude Code clones as written and never checks against the
pattern. The `InvalidGitHubRepositoryError` doc now says which value it
holds. The D-SG-18 row has a one-sentence amendment that records the
boundary.
**Tests:** two new parse cases and two updated ones (a github object source
now carries `repository`). Four unit cases in `github-transport.test.ts`,
one per refused form. The four-row Outline "A github plugin whose repo
carries a ref or names a github url is refused as Claude Code refuses it
(D-SG-18)" (all four rows red before the fix: each installed).
**Behavior change (a `{ "source": "github" }` plugin entry only):**

| manifest `repo`                                           | before                                              | now                                                       |
| --------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------- |
| `acme/ghp#main`, `acme/ghp@v1`, `acme/ghp#`               | cloned `acme/ghp`, at that ref when one was written | refused: `unsupported source` with upstream's message     |
| `https://github.com/acme/ghp`, `.git`, `www.`, `:443`, `/` | cloned `acme/ghp`                                   | refused the same way                                      |
| `https://github.com/acme/ghp#main`                        | cloned `acme/ghp` at `main`                         | refused the same way                                      |
| `acme/ghp`, `acme/ghp.git`, `evil:x/ghp`                  | unchanged                                           | unchanged (cloned, cloned, refused)                       |
| `acme/ghp/`, `git@github.com:acme/ghp`                    | `unknown` source (`unavailable`)                    | unchanged: the parser refuses them before any clone plan |

The refusal reaches every surface that plans a plugin clone: install, fetch,
update, reinstall, `info --fetch`, `apply`, and import report `unsupported
source`, and enable reports its failure as before. `list` and `info`
without `--fetch` plan no clone and show such an entry as before.

**Unchanged inputs (D-MF-07 and D-PL5-13):** the `owner/repo` string
shorthand still splits at the first `@` or `#`. That covers the `marketplace
add` source, a stored or legacy string source, and a string plugin source.
The `{ "source": "url" }` object on github.com still normalizes to a github
source and clones (D-76-02). A git-subdir `url` still uses the same pattern,
on its own value. Not changed, and not checked against upstream here: the
tag listing of a constrained `github` dependency still reads `<owner>/<repo>`
before the clone plan refuses the entry.

### WR-G-04: `withUpdateCloneNote` and `withReinstallCloneNote` only pass their arguments to `withCloneNote`

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts`,
`test/orchestrators/plugin/update.messaging.test.ts`
**Commit:** 7e5046f
**Applied fix:** both wrappers are deleted, and their call sites call
`withCloneNote` directly. The "whatever its status" sentence moved to
`withCloneNote`'s doc. The wrapper's six unit cases went with it, because
`withCloneNote`'s own cases and the update cascade's up-to-date and skipped
row cases cover the same behavior. Refactor: no behavior change, and the
owner tests and pair coverage stayed green.

### IN-G-01: `isGitHubRepositoryFormat` and `isGitSubdirShorthand` have the same body

**Files modified:** `extensions/pi-claude-marketplace/domain/source.ts`,
`extensions/pi-claude-marketplace/domain/github-transport.ts`,
`extensions/pi-claude-marketplace/domain/github-plugin-transport.ts`,
`extensions/pi-claude-marketplace/orchestrators/github-transport.ts`,
`test/domain/source.test.ts`
**Commit:** 9049813
**Applied fix:** one exported predicate, `isGitHubOwnerRepo`, over one
constant, `GITHUB_OWNER_REPO`. Its doc names both uses. After WR-G-03 both
callers pass a value of the same kind: a git-subdir `url`, or a github
source's `repo` as written. Refactor: no behavior change.

## Skipped Issues

### IN-G-02: The failing member's labelled clone line appears only on the standalone enable

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:382-389`
**Reason:** the case the finding describes cannot occur, so there is nothing
to carry and no scenario can fail without a change. An orchestrated enable
runs no enable cascade. `resolveEnableCascadeStep` returns `skipped` when
the call is orchestrated, and the fresh-root cascade runs only `if (enable &&
!orchestrated)`. So `failingMember` is never set on the path that apply and
import take, and the `enable-failed` outcome they get never names a member.
apply enables each declared plugin through its own call, and a dependency
whose re-clone fails is reported on its own failed row, with its own clone
note and retry. A probe of import (`enabledPlugins` holding a disabled
`app@gits` whose dependency `ghp` has no clone) reported `app` as `skipped
{already installed}` and cloned nothing, so no import row can show a
member's clone either.
**Guard:** commit 96868c6 adds the scenario "Applying a config that
re-enables a github dependency whose clone fails names that clone on the
dependency's own failed row" to `features/plugin/github-transport-apply.feature`.
It passes on the current code. It pins the row that apply shows for this
failure, which no scenario covered before.
**Original issue:** when a re-enabled member's clone fails under `apply` or
`import`, the root's failed row shows only the root's (empty) note, while the
standalone enable shows the member's labelled line.

## Scenarios added or changed

- Added: `features/plugin/github-transport-update.feature`, "Updating every
  plugin when one update fails after the github marketplace moved names the
  re-clone once" (WR-G-01).
- Added: `features/marketplace/update.feature`, "Updating an unchanged
  marketplace with autoupdate on names the clone of the github plugin whose
  clone is gone" (WR-G-02).
- Added: `features/plugin/github-transport.feature`, the Outline "A github
  plugin whose repo carries a ref or names a github url is refused as Claude
  Code refuses it (D-SG-18)", four rows (WR-G-03).
- Added: `features/plugin/github-transport-apply.feature`, "Applying a config
  that re-enables a github dependency whose clone fails names that clone on
  the dependency's own failed row" (IN-G-02 guard).
- Changed step: "the failed update names these repairs" adds the marketplace
  clone columns only when a block names a re-clone. No existing scenario was
  re-baselined: the three that use the step name no re-clone, and no
  existing table changed.

## Verification

All suites ran in the fixer's isolated worktree, not in the main checkout.

These results are for the tree at 9049813 (all fix commits applied):

- `npm run test:modules`: passed (exit 0), with the session's
  `GIT_CONFIG_*` variables unset.
- `npm run test:integration`: passed (exit 0), with the optional-peer cache
  installed once by `node scripts/install-test-peers.mjs`.
- Cucumber, adapter profile (`features`): 2419 scenarios, 2414 passed, 5
  failed. The 5 failures are the known fd Glob scenarios of
  `features/hook/tool-use.feature` (lines 296, 355, 443, 1696, and 1834).
- Cucumber, builtin profile (`features`): 261 scenarios, all passed.
- `npm run check` was not run, as instructed. Each commit's hook ran
  `npm run check:commit`.

## Follow-up: aborted batch re-clone

This closes the WR-G-01 residual above (04-VERIFICATION.md truth 5, D-SG-22).

**Commit:** 2788f80
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts`,
`features/plugin/github-transport-update.feature`,
`features/step_definitions/plugin/update.steps.ts`,
`test/orchestrators/plugin/update-cascade.test.ts`
**Applied fix:** `composeUpdateCascade` and the `UpdateCascadeComposer` type
take `abortedBy?: UpdateCascadeTarget`, the failing target, in place of the
`abortedByFailure` boolean. `groupCascadeOutcomes` drops a group with no rows
only when its marketplace and scope are the failing target's. A rowless group
of any other marketplace, or of the same marketplace in the other scope, keeps
its sync note. `abortUpdateBatch` takes the target as `cascade.failedTarget`
from all three callers (sync failure, phase-2 throw, phase-3a aggregate). The
run that finishes passes `undefined`. Output does not change in any other
case: a group with rows keeps its note, and the failing target's rowless group
is still dropped.
**Tests (red before the fix):**

- Unit, `update-cascade.test.ts`: "an aborted bulk update keeps the block of
  another marketplace's sync re-clone" (failing target in `mp`, unchanged
  outcome in `other`; it sent nothing before the fix) and "an aborted bulk
  update keeps the sync re-clone block of the failed target's marketplace in
  the other scope" (it rejects a filter keyed on the name alone). The WR-G-01
  case still passes.
- Scenario, `github-transport-update.feature`: "Updating every plugin when a
  later marketplace's update fails still names the re-clone of an earlier
  github marketplace". `kit` moves and is re-cloned for the unchanged `app`,
  then `zed@tools` fails in the physical replace. The command reports two
  results: the failure, whose `tools` block names its own re-clone once, and
  then a `kit` block that names its re-clone. Before the fix, the command
  reported only the failure. The WR-G-01 scenario still fails when every
  rowless group is kept.
- Changed step: "the failed update names these repairs" reads every cascade
  of the command in emission order, and gives a block with no plugin rows one
  row with empty plugin cells. The three earlier users report one cascade
  whose blocks all have rows, so their tables did not change.

**Verification (fixer's worktree):** with the `GIT_CONFIG_*` variables unset,
`update-cascade.test.ts` and `update-flow.test.ts` passed (331 tests), and so
did `npm run typecheck` and `npm run check:features`. Cucumber
`github-transport-update.feature` and `update.feature` passed: 45 scenarios
under the adapter profile, and the `@mcp` scenario of each file under the
builtin profile. The commit hook ran `npm run check:commit` and passed.

---

_Fixed: 2026-11-27_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
