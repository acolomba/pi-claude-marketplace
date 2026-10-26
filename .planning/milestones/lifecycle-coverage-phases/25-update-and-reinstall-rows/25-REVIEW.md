---
phase: 25-update-and-reinstall-rows
reviewed: 2026-10-24T05:39:47Z
depth: standard
files_reviewed: 46
files_reviewed_list:
  - extensions/pi-claude-marketplace/domain/dependency-range.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-version.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/materialize-latest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-record.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-cascade.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/dependency-verdict.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-json.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notification-wire.ts
  - schema/claude-plugin.schema.json
  - docs/json-output.md
  - docs/dependency-resolution.md
  - docs/messaging-style-guide.md
  - docs/output-catalog.md
  - docs/prd/pi-claude-marketplace-prd.md
  - features/lib/run-tokens.ts
  - features/support/world.ts
  - features/plugin/update.feature
  - features/plugin/reinstall.feature
  - features/plugin/git-source-update.feature
  - features/plugin/list.feature
  - features/plugin/state-lock.feature
  - features/plugin/update-rollback.feature
  - features/marketplace/update.feature
  - test/orchestrators/plugin/warm-mirror-seed.ts
findings:
  critical: 1
  warning: 5
  info: 6
  total: 12
status: issues_found
---

# Phase 25: Code Review Report

**Reviewed:** 2026-10-24T05:39:47Z
**Depth:** standard
**Files Reviewed:** 46
**Status:** issues_found

## Summary

Scope: phase 25's own first-parent commits, `528d6aca`..`b65cfe71`, which is the
whole first-parent diff `2baa5a12..HEAD`. The commits before the merge
(`03d7e855`, `efee7f70`) touch only planning files. The merge `2baa5a12` brought
in phase 26 (`clone-cache.ts`, `fetch.ts`, `info --fetch`,
`install-clone-probe.ts`, `probeUnpinned`). Those files were read only where
phase 25 code calls them. Test files were read to check test reliability; they
are not listed as reviewed source.

Toolchain evidence, collected for this review: `npm run check:static` passes
(typecheck, lint, fallow, format, test pairing, feature check). `npm run
test:unpaired` and the unit suites of the touched update, reinstall, list,
grammar and JSON pairs pass under a scratch `HOME` and `PI_CODING_AGENT_DIR`.

The key invariants hold:

- `resolveUpdateCandidate`'s catch rethrows GHB-03 first, then
  `StateLockHeldError` (GIT-03), and only then classifies (`update-preflight.ts:469-479`).
  `resolveStrict` passes clone-seam throws through unwrapped, so a held lock
  still fails as `lock held`.
- D-05..D-09: `revisionCommits` names commits only at equal versions, with
  both commits present and different. `composeVersionArrow` only draws them.
  The wire `fromCommit`/`toCommit` comes from the same `commits` sub-object.
  The TypeBox wire schema, `schema/claude-plugin.schema.json` (both row
  definitions) and `docs/json-output.md` agree.
- D-14/D-15: update and reinstall fail `{not installed}` at `error` severity.
  Backfill treats that outcome as the silent converge (`backfill.ts:452`).
  The cross-scope signal row is `failed` under a `CommandContext<"failed">`.
- D-16/D-17: the host ladder, the `source missing` narrowing, the bare auth row,
  and the unclassified branch-4 row match `install.messaging.ts`.

The defects found are about consistency and edge cases. The version rule
draws a commit-less arrow at the same version when only one side has a
commit. A thrown failure before the candidate drops the installed version
that a returned one shows. One spread breaks a project rule. One JSON
contract sentence is wrong.

## Critical Issues

### CR-01: Spread of a possibly-undefined value in the cascade failure outcome

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:707`
**Issue:** `...report.move` spreads `CandidateReport.move`, typed
`RevisionMove | undefined`. It is `undefined` for every failure thrown before
the candidate (lock held in `probeUnpinned`, an unreadable dependency walk, a
layer refusal). `.agents/skills/typescript-style/rules/modules-and-data.md:29`
forbids spreading `undefined` into an object. The skill's classification table
makes "spreading a possibly-nullish value" a BLOCKER. Today the runtime result
is the same (spreading `undefined` adds no keys). But the same file guards the
same value correctly at line 823 (`args.report?.move ?? {}`), and
`reinstall-record.ts` uses `knownMove(input.move ?? {})`. So this site is the
one inconsistent spread of this value, and the type gives no protection if
`move` is ever widened to a non-object.
**Fix:**

```ts
      // UPR-03: the move a throw after the candidate attempted; nothing
      // before one.
      ...(report.move ?? {}),
```

## Warnings

### WR-01: A commit on one side only draws a no-op-looking `v1.0.0 → v1.0.0` arrow on move rows

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts:247-255`
(consumed at `reinstall.messaging.ts:233,311`, `update-row.ts:164`,
`update-cascade.ts:142`, `marketplace/update.messaging.ts:171`, `update-flow.ts:823`)
**Issue:** `revisionVersionSlot` returns the single version only when
`known.fromCommit === known.toCommit`. When the versions are equal and one
side has a commit while the other has none, it returns
`{ version: "1.0.0", from: "1.0.0" }` with no `commits`. The row then reads
`● ghp v1.0.0 → v1.0.0 (reinstalled)` and the JSON carries `from` equal to
`version`. This is the ambiguous same-version arrow that UPR-02 set out to
remove. D-12 says that when "only one side is known, it shows the single
version it knows". D-07 says that a pre-commit-recording record or a
git/path switch "shows none (no half-annotated arrow)". Concrete trigger: a
git record written before `resolvedSha` was recorded, reinstalled at the same
commit and version. Before this phase it rendered `v1.0.0`, and REI-01 needs
that form. Now it renders an arrow with nothing to tell the two sides apart.
The case is pinned as intended in `test/orchestrators/plugin/update-row.test.ts`
("a commit on the to side only gives the arrow without commits"), so the
test encodes the deviation.
**Fix:** Treat a one-sided commit at an equal version as "same revision as
far as the row can tell":

```ts
  const commitsComparable = known.fromCommit !== undefined && known.toCommit !== undefined;
  if (from === to && (!commitsComparable || known.fromCommit === known.toCommit)) {
    return { version: to };
  }
```

If a git/path source switch at the same version must stay visible, use a
reason token or a cause line for it, not a bare arrow. Then update the
`VERSION_SLOTS` / move-row tests to expect `{ version }`.

### WR-02: Pre-candidate failures show the installed version when returned, but no version when thrown

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:801-806,823`;
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts:295-302`
**Issue:** D-12 says a failure before the candidate shows "the installed
version alone when it came before (preflight, transport, D-16)". The
preflight failures that are *returned* (`failedCandidate`,
`update-preflight.ts:544-561`) carry `fromVersion`, and render `v1.0.0`.
The preflight failures that are *thrown* get no version on either verb: a
held lock in the unpinned clone probe (GIT-03), or
`DependencyDeclarationsUnreadableError` from the constraint gate
(`update-constraint-gate.ts:475`). The only version they could show comes from
`report.move`, which is unset before the candidate. Reinstall has already
read the record in `runReinstall`, and the update preflight has
`triaged.record`, yet the row drops the version. As a result, the same
`{lock held}` failure renders differently by source kind:
`features/plugin/git-source-update.feature:175` (git, the lock is taken in
the preflight) has no version, while `features/plugin/state-lock.feature:293`
(path, the lock is taken at the intent mark) has `version 1.0.0`. The
`NotifyDirectFailureArgs.report` doc (`update-flow.ts:801-805`) states the
divergence as policy, and the 25-04 plan chose it. But it contradicts D-12
and the phase goal that failed rows carry versions where known.
**Fix:** Report the record's version as soon as the record is read (for
example an `onRecord?: (fromVersion) => void` beside `onCandidate`, or seed
the holder with `{ fromVersion: record.version }` in `runReinstall` and in the
preflight). Then pass the partial move through `revisionVersionSlot`, which
already returns the single installed version for a one-sided move. Update the
lock-held and unreadable-walk scenarios to state `version 1.0.0`.

### WR-03: `docs/json-output.md` says a row with `from` always carries `version`, which is false for `updated` rows

**File:** `docs/json-output.md:582`
**Issue:** The new `version` cell reads "A row that carries `from` carries the
version it moved to." An `updated` row carries `from` and `to` and never
`version` (`notification-json.ts::wireVersion`, `case "updated"`). A JSON
consumer that follows this public contract and reads `version` whenever
`from` is present gets `undefined` on every update row. The `from` cell on the
next line has the right split.
**Fix:** "Plugin version. On a reinstalled, partially installed, or failed row
that carries `from`, the version it moved to; an updated row carries `to`
instead."

### WR-04: The `triageUpdateMembership` comment claims a record-first order that the preflight does not follow

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:625-628` (order set at `:941-946`)
**Issue:** The UPR-04 comment says "the record is checked before the manifest,
as Claude Code does". But `preparePluginUpdate` calls
`loadMarketplaceManifest(marketplace.manifestPath)` at line 941, before the
triage runs. Only the *lookup* follows the record check. If an update targets
a plugin that the scope does not record and the marketplace's cached manifest
is unreadable or invalid, the load throws, and the row fails as
`{invalid manifest}` / `{unreadable manifest}`, not `{not installed}`. That
is the reverse of the upstream order this phase cites (D-02). The comment
misleads anyone who later changes this function.
**Fix:** Either check `ownValue(marketplace.plugins, options.plugin)` before
loading the manifest:

```ts
  const record = ownValue(marketplace.plugins, options.plugin);
  if (record === undefined) {
    return staticPreflightRow({ partition: "failed", plugin: options.plugin,
      notes: ["not installed"], reason: "not installed" });
  }
  const manifest = await loadMarketplaceManifest(marketplace.manifestPath);
```

or reword the comment to say only that the record is checked before the
manifest *lookup*.

### WR-05: A range-admitted `--partial` update drops the disclosure that the same reinstall shows

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts:157-173` vs `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts:219,236`
**Issue:** D-22 makes the constraint disclosure ride the cause line of
`updated` and `reinstalled` rows through one carrier "so the two verbs cannot
word it differently". `updatedRowFromOutcome` returns the
`partially-installed` form before it computes `cause`, and its doc says
"The `partially-installed` form has no cause slot". `reinstalledRowFromOutcome`
attaches `disclosureCause(outcome.constraint)` even when
`outcome.partialDegrade` is set. Take a plugin a dependent's range admits,
which lands partially: `update --partial` shows no range line, but
`reinstall` (whose row stays `reinstalled`) names the range and its holders.
The `constraint` value is on the outcome in both cases.
**Fix:** Add an optional `cause?: Error` to `PluginPartiallyInstalledMessage`
(resolve and JSON already handle `cause` through `remedyFailure`; add the
status to the `resolveRow` branch). Then set it from `constraintCauseFor(outcome)`
in the partial arm, or record the deliberate exclusion in D-22 and the catalog.

## Info

### IN-01: Two identical per-target candidate holders

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts:214-222`, `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts:278-280,432-434`
**Issue:** `CandidateReport` and `ReportedCandidate` are the same
`{ move?: RevisionMove }` shape. `update-flow.ts` fills it through
`recordCandidate`, and `reinstall-flow.ts` through an inline closure. The
`onCandidate` contract lives on `ThreePhaseArgsBase` in `update-swap.ts`.
**Fix:** Export one holder type and `recordCandidate` from `update-swap.ts`
(or `materialize-latest.ts`) and use it in both flows.

### IN-02: The reconcile remedy's comma-joined ranges read as part of the sentence's own list

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts:412`
**Issue:** With INR-05's `, ` join, two declared ranges render as
`Update "lib@tools" to satisfy ^1.0.0, >=1.2.0, or uninstall "app@tools"`.
A reader can take `>=1.2.0` for a third alternative of the "or" list.
**Fix:** Bracket the range list, for example
`to satisfy (${held.range}), or uninstall ...`, or reword it as
`to satisfy every range ${held.range}; or uninstall ...`.

### IN-03: Update's invalid and too-complex cause lines drop the diagnostic that install's lines keep

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:214-225`
**Issue:** `describeConstraint` no longer receives `fold.detail` ("input 2 of
3 is not a valid version range", which cap tripped). Install still prints it
(`install-cascade.messaging.ts:396,405`). The update line names every
declared range, but not which one is unreadable or which limit was exceeded.
D-20 asked for this, but the two verbs now explain the same declaration with
different detail.
**Fix:** Optional: append the fold's position-only detail after the declared
ranges on the `invalid` and `too-complex` arms.

### IN-04: The source-access classifier doc still says update uses the transport ladder

**File:** `extensions/pi-claude-marketplace/shared/git-failure-classifiers.ts:172-174`
**Issue:** "the transport ladder that update and the plugin verbs use leaves a
missing ref unclassified". Update's candidate resolution now uses
`classifyGitHostFailure` (`update-preflight.ts:499`). The claim about a
missing ref is still true, but the description of which ladder update uses
is not.
**Fix:** "the transport and host ladders that update and the plugin verbs use
leave a missing ref unclassified."

### IN-05: The move-row types allow shapes the text and the wire render differently

**File:** `extensions/pi-claude-marketplace/shared/notification-types.ts:448-451`, `extensions/pi-claude-marketplace/shared/notification-json.ts:652-658`, `extensions/pi-claude-marketplace/shared/notification-grammar.ts:470-477` (`renderVersionSlot`, `move` arm)
**Issue:** `RevisionMoveFields` makes `from` and `commits` independently
optional, and `version` is optional on those messages. A producer that sets
`commits` without `from` gets plain text (the `move` arm ignores `commits`),
but `moveFields` still emits `fromCommit`/`toCommit`. That breaks the
documented "present exactly when the text form shows the short commits".
`from` without `version` draws `v1.0.0 → ` with an empty right side. Today
only `revisionVersionSlot` builds these fields, so neither shape occurs. The
`VersionCommits` doc claims "no row can draw a half-annotated arrow", but the
types do not enforce it.
**Fix:** Model the slot as a union:
`{ version?: string; from?: never; commits?: never } | { version: string; from: string; commits?: VersionCommits }`.

### IN-06: Comment and doc lines over the 100-column width

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-constraint-gate.ts:121`, `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts:398`
**Issue:** Prettier does not wrap comments. These two edited lines are 104
and 128 characters long. All other comments in the files wrap at 100.
**Fix:** Rewrap the two comments.

---

_Reviewed: 2026-10-24T05:39:47Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
