---
phase: 04-ssh-sources-and-transport-selection
reviewed: 2026-11-26T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/github-plugin-transport.ts
  - extensions/pi-claude-marketplace/domain/github-transport.ts
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/orchestrators/github-transport.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-cascade-context.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-dependency-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-ledger.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-planning.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
  necessity: 2
status: issues_found
---

# Phase 4: Gap-Closure Code Review Report (plans 04-19..04-26)

**Reviewed:** 2026-11-26
**Depth:** standard
**Files Reviewed:** 31 (diff `373e8e6..3bde55c`, plus their tests and the new scenarios under `features/`)
**Status:** issues_found

## Summary

I reviewed the `via-http` note kind, the `clone` field on the four new row kinds, the optional
`clone.plugin` label, the `owner/repo` refusal (`InvalidGitHubRepositoryError` to
`unsupported source`), and the clone-note wiring through install, update, reinstall, autoupdate,
apply, import, bootstrap, and enable.

What checks out:

- **Redaction.** Every new note reaches the renderers through `resolveRows`, which runs
  `redactCloneNote` on both block notes and row notes. `redactCloneNote` now redacts `plugin`
  with `redactRowName`. `recordNote` stores redacted URLs. The bare D-MF-04 blocks and the
  bootstrap block go through the same path. `notification-present.ts:232` (info) also goes through
  `redactCloneNote`.
- **Schema and wire.** All 8 clone objects in `schema/claude-plugin.schema.json` gained `via-http`
  and `plugin`. `PLUGIN_ROW` and `MARKETPLACE_BLOCK` share one `CLONE`. `wireClone` emits `plugin`.
  `docs/json-output.md` matches.
- **The regex itself.** `GIT_SUBDIR_SHORTHAND` (`[A-Za-z0-9_.-]`) accepts exactly the character set
  of upstream `zHi`'s `/^[a-zA-Z0-9-_.]+\/[a-zA-Z0-9-_.]+$/`. The refusal runs before the force,
  the checks, and any attempt.
- **Notes on the right row.** I found no note on a row that did not clone and no cross-scope leak.
  apply, import, and the update paths each use a `withOwnCloneNotes` view per target.

The defects are as follows. An aborted bulk update now sends a second notification with a
duplicate block (WR-G-01). The autoupdate no-op path still drops a plugin re-clone's note, which
the direct bulk update now keeps (WR-G-02). The `owner/repo` check runs on the pair after Pi
normalizes it, not on the raw `repo` value that upstream checks, so Pi accepts and clones values
that upstream refuses (WR-G-03). Two clone-note helpers became pass-throughs that do nothing
(WR-G-04).

I read the necessity rubric (`.claude/gsd-core/references/necessity-review.md`).

## Warnings

### WR-G-01: An aborted bulk update now sends a second notification that repeats the failed block's marketplace clone note

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts:224-243` (with `:290`, and `update-flow.ts:660-675`)
**Issue:** `groupCascadeOutcomes` now makes a group for every outcome, and keeps a group that has
no rows when it has a clone note (`group.plugins.length > 0 || group.clone !== undefined`). The
abort guard at `:290` (`abortedByFailure && marketplaces.length === 0`) was the only thing that
kept an aborted batch silent. That guard no longer fires when the only group left has no rows
but carries the PUP-2 sync note. Example: in a plural `/claude:plugin update`, marketplace `mp` is
re-cloned by its sync, plugin `a` is unchanged, and plugin `b` of `mp` throws.
`notifyDirectFailure` already shows the `mp` block with the sync note (`clones:
targetScoped.clones`, `update-flow.ts:671`). Then `abortUpdateBatch` calls `composeCascade(...,
true, clones)`, which now sends a second notification. That notification has no headline and holds
only the same block and the same note. I reproduced this with a scratch test:
`composeUpdateCascade(ctx, run, [unchanged("hello")], "plural", true, { plugins:
createGitHubCloneNotes(), marketplace: () => ({ note: "via-ssh", url: "git@github.com:acme/mp.git" })
})` emits `● mp [project]\n  Cloning via SSH: git@github.com:acme/mp.git`. At `373e8e6` it emitted
nothing. The 04-22 unit case "after a separately reported failure..." covers only a kept plugin
row, not this bare block.
**Fix:** Keep a group that has no rows only when the batch was not aborted, because the failure
notification already names the sync of the failing target's marketplace:

```ts
// groupCascadeOutcomes(outcomes, probe, cardinality, clones, abortedByFailure)
.filter(
  (group) => group.plugins.length > 0 || (!abortedByFailure && group.clone !== undefined),
)
```

Or keep the group but drop its `clone` when the failure notification already names the same
`scope:marketplace`. Add a unit case for an aborted plural batch with only an unchanged outcome and
a marketplace note. It should expect no notification.

### WR-G-02: The autoupdate no-op path drops the note of a plugin re-clone that the direct bulk update now keeps

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:1262-1271` (row source `orchestrators/marketplace/update.messaging.ts:89-94`, seam `orchestrators/plugin/update-flow.ts:1014-1046`)
**Issue:** 04-23 gives every autoupdate outcome its own clone note (`withTargetCloneNotes`). Its
summary says the note reaches "the skipped row of an unchanged ... outcome". But when the
manifest is unchanged and every outcome is `unchanged`, `refreshOneMarketplace` folds the result
into `{ status: "skipped", reasons: ["up-to-date"], ...clone, plugins: [] }`. That drops every plugin
row, and each `outcome.clone` with it. An unchanged outcome can carry a clone: when a plugin's
cached mirror is gone, the update re-clones it at the same commit. The direct path shows this in
the new scenario "Updating a github plugin whose clone is gone ... names the clone on its
up-to-date row". So `marketplace update tools` with autoupdate on, run after the mirror was
deleted, clones over GitHub and names no transport. WINDOWS #135 (ff125d7) fixed exactly this gap
for the direct bulk update, and the autoupdate cascade still has it. D-SG-22 expects every GitHub
clone to name its transport.
**Fix:** Keep the rows of the unchanged outcomes that cloned, in the no-op block:

```ts
if (!snapshot.changed && cascadeIsNoOp) {
  const cloned = outcomes
    .filter((o) => o.clone !== undefined)
    .map((o) => outcomeToCascadePluginMessage(o, scope));
  const noopRows: Single<MarketplaceRows<UpdateRowMsg>> = [
    { name, scope, status: "skipped", reasons: ["up-to-date"], ...clone, plugins: cloned },
  ];
  ...
}
```

Add a unit case in `test/orchestrators/marketplace/update.test.ts` for an all-unchanged autoupdate
cascade whose outcome carries `clone`. Add a scenario next to the 04-23 one that deletes the
cached clones first.

### WR-G-03: The `owner/repo` refusal checks the pair after Pi normalizes it, not upstream's raw `repo`, so Pi clones values that `zHi` refuses

**File:** `extensions/pi-claude-marketplace/orchestrators/github-transport.ts:388-393`; `extensions/pi-claude-marketplace/domain/source.ts:202-212`; doc `extensions/pi-claude-marketplace/shared/errors.ts:1450-1455`
**Issue:** Upstream `zHi(e, ...)` tests the manifest's `repo` string itself (04-EVIDENCE.md Q7).
Pi tests `${source.owner}/${source.repo}`. Pi builds that pair only after
`githubObjectSource` → `parsePluginSource(repo)` has removed a `#ref` or `@ref` suffix and folded a
`https://github.com/...` URL. I checked this with a scratch script:

| manifest `repo` | Pi pair | Pi accepts | upstream accepts |
| --- | --- | --- | --- |
| `acme/ghp#main` | `acme/ghp` (ref `main`) | yes | no |
| `acme/ghp@v1` | `acme/ghp` (ref `v1`) | yes | no |
| `https://github.com/acme/ghp` | `acme/ghp` | yes | no |
| `https://github.com/acme/ghp.git` | `acme/ghp` | yes | no |
| `acme/ghp/` | (`unknown` source) | no, with a different reason and message | no, with `Invalid GitHub repository format` |

So Pi clones four forms that Claude Code refuses. For the first two, Pi also checks out a ref that
the manifest's `ref` field never named. The parity constraint in AGENTS.md (upstream parity)
allows no such divergence without a recorded decision. The `InvalidGitHubRepositoryError` doc
says the joined pair is "the value upstream checks", which is not true. The regex itself matches
upstream. The difference is where the check runs.
**Fix:** Test the raw manifest value. For an object source, `GitHubSource.raw` is the `repo` string
(`githubObjectSource` passes it to `parsePluginSource`, which echoes it as `raw`):

```ts
if (source.kind === "github") {
  const repository = source.raw; // the manifest's `repo`, as zHi receives it
  if (!isGitHubRepositoryFormat(repository)) {
    return Promise.reject(new InvalidGitHubRepositoryError(repository));
  }
}
```

If a github source can also come from a form other than the object `repo` (a string plugin
source), carry the raw `repo` explicitly on `GitHubSource` and test that value instead. Correct the
`errors.ts` doc. Add unit and scenario cases for `acme/ghp#main` and
`https://github.com/acme/ghp`. Each should expect `unsupported source` and no request. If the
maintainer wants to keep the ref-suffix tolerance, record it as a decision with an ID.

### WR-G-04: Generality without instantiation — `withUpdateCloneNote` and `withReinstallCloneNote` now only pass their arguments to `withCloneNote`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts:58-64`; `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts:169-175`
**Category:** necessity
**Issue:** 04-22 removed the status filters, so both functions are now `return withCloneNote(row,
notes, subject);` and nothing else. The status guard was the only reason each wrapper existed. Its
doc still describes a per-status contract, which is now only "whatever its status", and the code
does not enforce it. `withEnableCloneNote` (`enable-disable.messaging.ts:119-121`) still filters
`skipped`, so a reader cannot tell which wrappers do something without reading each one.
**Fix:** Delete both wrappers. Call `withCloneNote` directly at their call sites
(`update-cascade.ts:200-204`, `reinstall.messaging.ts` render loop), and move the "every status"
sentence to `withCloneNote`'s doc.

## Info

### IN-G-01: Generality without instantiation — `isGitHubRepositoryFormat` and `isGitSubdirShorthand` are two exported predicates with the same body

**File:** `extensions/pi-claude-marketplace/domain/source.ts:116-127`
**Category:** necessity
**Issue:** Both functions return `GIT_SUBDIR_SHORTHAND.test(x)`. The comment says one constant
keeps the two uses from drifting, and that already holds through the shared regex. The second
exported name adds a public symbol and a pairing burden for direct coverage, and it gives no
separate behavior. This is a judgment call. The separate name does document intent at the call
site.
**Fix:** Keep one predicate, for example rename it to `isGitHubOwnerRepo` and use it for both
callers. Or leave it as it is and note in the doc that the two names are aliases on purpose. If
WR-G-03 is fixed to test the raw `repo`, check again whether the two predicates still match the
same input domain.

### IN-G-02: The failing member's labelled clone line appears only on the standalone enable. apply and import enable failures still name nothing

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts:382-389`, `:929-938`; consumers `orchestrators/reconcile/apply.ts:934`, `orchestrators/import/execute.ts:1376`
**Issue:** `failingMember` is private to the module on purpose ("the typed result an orchestrated
caller gets has no such member"). So when a re-enabled member's clone fails under `apply` or
`import`, the root's failed row shows `cloneNoteOf(notes, root)`. That note is always empty here,
because the root's phase runs after every member's. The member's attempts are recorded in the
call's own notes view, but no row shows them. The standalone `enable` now shows the labelled line.
This is the same failure and the same clone, reported differently on two surfaces. The maintainer
decision covers the shape of the standalone enable failure. It does not explicitly cover the
orchestrated surfaces, so this is Info.
**Fix:** Either expose `failingMember` on the orchestrated `enable-failed` outcome and have apply and
import read `{ ...noteFor(failingMember), plugin: failingMember }` the way
`withRootCloneNote` does, or record the orchestrated gap next to WINDOWS #139.

---

_Reviewed: 2026-11-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
