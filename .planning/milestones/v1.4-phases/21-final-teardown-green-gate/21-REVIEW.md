---
phase: 21-final-teardown-green-gate
reviewed: 2026-05-27T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/args-schema.ts
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/persistence/migrate.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/import-boundaries.test.ts
  - tests/architecture/notify-types.test.ts
  - tests/architecture/scope-order-drift.test.ts
  - tests/persistence/migrate.test.ts
  - tests/transaction/rollback.test.ts
findings:
  critical: 2
  warning: 6
  info: 4
  total: 12
status: issues_found
---

# Phase 21: Code Review Report

**Reviewed:** 2026-05-27T00:00:00Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

The phase 21 deletions (V1 notification wrappers, `shared/grammar/` inlining
into `shared/notify.ts`, retirement of the `presentation/` zone) are
mechanically clean and the architectural tests (`import-boundaries.test.ts`,
`notify-types.test.ts`, `scope-order-drift.test.ts`) are well-targeted gates.
However, several pre-existing correctness defects in the orchestrator
notification paths surface clearly in the consolidated code:

1. `updatePlugins` discards the entire previously-accumulated outcome batch
   when any mid-batch plugin hits a phase-3a aggregate failure -- successful
   per-plugin updates that already mutated state are committed to disk but
   never reported.
2. `installPlugin` emits a `PluginFailedMessage` carrying a `scope` field
   on the plugin row, but `scope` already lives at the marketplace level
   for this single-plugin emission; emitting it again is a structural
   redundancy that's been intentionally omitted from peer orchestrators
   (`uninstall.ts`, `reinstall.ts`) per the same in-file commentary.
3. Multiple narrowers fall through to closed-set Reasons (`"not in
   manifest"`, `"unreadable manifest"`) that do not describe the underlying
   error, masking the actual failure class to the user.

Several of these are pre-existing v1.3 behaviors carried forward, not
defects introduced by phase 21 itself, but they survived the teardown
unchanged and remain in the shipped surface.

The intentional comment-density increase in `shared/notify.ts`,
`shared/errors.ts`, and the orchestrator files is consistent with the
phase plan's stated consolidation goal and is not flagged as a complexity
smell.

## Structural Findings (fallow)

No `<structural_findings>` block was supplied to this review; cross-module
fallow findings should appear here when produced by the upstream structural
pass.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `updatePlugins` silently drops successful outcomes when later plugin hits phase-3a aggregate failure

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:352-354`
**Issue:** When `runThreePhaseUpdate` returns a `partition: "failed"` outcome
with `phaseFailures` populated (the phase-3a aggregate path), the code
issues a bare `return;` and never invokes `renderUpdateCascadeAndNotify`.
The early-return is correct in suppressing a *duplicate* failure
notification for the failing plugin (which already fired
`notifyDirectFailure` inline from `runThreePhaseUpdate`), but it ALSO
suppresses the cascade summary for every plugin that succeeded earlier in
the same batch. Those earlier plugins have already committed state to
disk inside their own `withStateGuard` closure (phase 2 of the 3-phase
sequence), so the user is left with state changes they never saw acknowledged.

The on-disk state and the user-visible report diverge: if a 5-plugin
batch update sees plugins #1-#3 update successfully and #4 hit a phase-3a
aggregate, the user only sees the #4 failure row and never learns plugins
#1-#3 were updated. The reload-hint trailer is also lost for the
successful updates because the cascade emission is the only site that
would have driven it.

**Fix:** Emit the cascade for the accumulated outcomes BEFORE returning,
or attach the failed plugin's outcome to the cascade and skip the inline
emission entirely. Concrete patch:

```ts
if (outcome.partition === "failed" && outcome.phaseFailures !== undefined) {
  // The failing plugin already fired its own notifyDirectFailure inline
  // (with reasonOverride + rollbackPartial children). Emit the cascade
  // for the EARLIER successful outcomes so they are not silently lost.
  if (outcomes.length > 0) {
    renderUpdateCascadeAndNotify(ctx, pi, outcomes);
  }
  return;
}

outcomes.push({ target: t, outcome });
```

Alternative: fold the failed row into the cascade and drop the inline
`notifyDirectFailure` from `runThreePhaseUpdate` (would require threading
the phase-3a rollback-partial children through `outcomeToCascadePluginMessage`,
which already has the failed-arm machinery for `phaseFailures`).

### CR-02: `installPlugin` internal-error defensive arm emits redundant `scope` field on plugin row, contradicting the file's own IN-04 convention

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:799-815`
**Issue:** The defensive "internal error" arm (when `installCtx` ended up
undefined on the success path) constructs a `PluginFailedMessage` with a
`scope` field set on the plugin row:

```ts
plugins: [
  {
    status: "failed",
    name: plugin,
    reasons: [] as const,
    scope,  // <-- redundant; same as the marketplace block's scope
    cause: internalErr,
  },
],
```

Per the file's own IN-04 commentary at install.ts:936-944, the canonical
convention is to OMIT `scope` from the plugin row when it matches the
marketplace block's scope; the renderer's `renderScopeBracket` (notify.ts:743)
already suppresses the bracket in that case. The file's `composeInstallFailureMessage`
helper (install.ts:1020-1104) explicitly omits scope from rows produced on
the primary failure path... but this defensive internal-error arm bypasses
that helper and emits the row inline with the redundant scope set.

This is the same inconsistency that IN-04 set out to fix on the main
emission path. The user-visible behavior is identical (the renderer
suppresses the bracket either way), so this is not a wire-format bug; it
is a contract violation that will trip a future invariant test if the
omit-convention is asserted at compile or test time, and it diverges from
the canonical recipe pinned in the file's commentary.

**Fix:** Route the internal-error arm through the same
`composeInstallFailureMessage` helper used by the primary catch path, or
inline-mirror it to omit the row-level scope:

```ts
notify(ctx, pi, {
  marketplaces: [
    {
      name: marketplace,
      scope,
      plugins: [
        {
          status: "failed",
          name: plugin,
          reasons: [] as const,
          // scope omitted -- matches marketplace block per IN-04 convention.
          cause: internalErr,
        },
      ],
    },
  ],
});
```

## Warnings

### WR-01: `update.ts` `notifyDirectFailure` puts the marketplace name in the plugin-row slot when `target.kind === "marketplace"`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:222`
**Issue:** On the marketplace-form failure path:

```ts
pluginName: target.kind === "plugin" ? target.plugin : target.marketplace,
```

When the user runs `/claude:plugin update @<marketplace>` (no plugin name),
the synthetic plugin-row identity is set to the marketplace name. The
rendered output reads `⊘ <marketplace> (failed) {<reason>}` *underneath*
a marketplace block also named `<marketplace>`, producing a redundant /
confusing row. The bare-form path (WR-05) deliberately introduced
`SYNTHETIC_UPDATE_PLACEHOLDER_NAME = "(update)"` to avoid exactly this
operator-confusion; the marketplace-form path replicates the original
defect that WR-05 fixed for the bare form.

**Fix:** Use a synthetic placeholder for the marketplace-form path too, or
restructure the failed surface to use a marketplace-level failed status
(matching how `marketplace/update.ts:612-614` handles its own
mp-level failures with `status: "failed", plugins: []`):

```ts
// Option A: synthetic placeholder, mirrors the bare-form fix.
pluginName: target.kind === "plugin" ? target.plugin : `(${target.marketplace})`,

// Option B (preferred): structural marketplace-level failure.
notify(opts.ctx, opts.pi, {
  marketplaces: [
    {
      name: target.marketplace,
      scope: explicitScope ?? "project",
      status: "failed",
      plugins: [],
    },
  ],
});
return;
```

### WR-02: `narrowDirectFailReason` and peer narrowers fall back to misleading closed-set Reasons

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1350`
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1440-1441`
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1463-1464`
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:846`
**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:170`
**Issue:** Several narrowers default to a closed-set Reason that does NOT
describe the underlying failure when no narrower predicate matches:
- `narrowDirectFailReason` (update.ts:1350) returns `"unreadable manifest"`
  for any unrecognised error -- including network-class errors that did
  not trip the `"network"` substring branch, generic FS errors with no
  errno code, etc.
- `narrowSkipReason` / `narrowFailReason` (update.ts:1440, 1464) return
  `"not in manifest"` -- the operator reads that as a real classification.
- `narrowReason` (reinstall.ts:846) explicitly returns `"not in manifest"`
  as a catch-all with the comment "the most-permissive cascade skip reason
  ... matches the operator mental model 'we couldn't reconcile this row'."
  Returning a member of the closed set for an unknown cause masks the
  actual error class behind a recognisable but incorrect token.
- `narrowCascadeFailure` (remove.ts:170) returns `"not in manifest"` for
  `AgentsUnstageFailureError` (when the closed set has no per-agent
  foreign-content member) and as the catch-all default.

The closed-set Reasons exist precisely so the operator can distinguish
classes of failure. Defaulting to an existing member rather than surfacing
the raw cause (via the cause-chain trailer, which the renderer ALREADY
emits for failed rows) means the cause-chain text gets a misleading
`{not in manifest}` label that contradicts what the user reads in the
trailer.

**Fix:** Either expand the closed-set Reasons to include an `"unknown"` /
`"other"` / `"unclassified"` member that the catch-all can return without
making false claims, OR (cleaner) make the brace optional and emit no
`{<reason>}` brace at all when no narrower matches; rely on the
cause-chain trailer (which already fires structurally on `failed` rows
per D-16-08) to carry the diagnostic. The renderer's `composeReasons`
already returns `""` for an empty array per notify.ts:799-801.

### WR-03: `narrowCascadeFailure` substring-fallback branches are advertised as "possibly dead" but never measured

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:152-170`
**Issue:** The `narrowCascadeFailure` helper has a defensive textual
fallback that the JSDoc itself calls out as "may be dead code -- a future
audit may show them dead and they can be deleted in a follow-up."
Carrying defensive-but-possibly-dead substring-matching code with a
TODO-style hedge in the JSDoc creates a class of code that can never be
removed (the test suite cannot prove a defensive fallback is dead
without an exhaustive case enumeration). Either the branches are needed
(in which case the typed-dispatch path is incomplete and that's the bug),
or they are dead (in which case they should be deleted in this teardown
phase).

The same pattern appears in `narrowResolverReasons` (install.ts:1264-1311)
with the same "defensive errno-substring fallback" JSDoc hedge.

**Fix:** Either:
1. Audit-and-delete: instrument the substring branches in a single CI run,
   confirm they never fire across the test suite, delete them.
2. Convert to assertion: change the substring branches to `assert(false,
   "unreachable; bug if hit")` so a real production hit surfaces as a
   crash rather than silently routing to the permissive Reason.

The drive-by mention in the JSDoc that "they can be deleted" is exactly
the kind of dead-code hedge that Phase 21's stated teardown goal should
have resolved.

### WR-04: Stale documentation references to retired `presentation/` and `shared/grammar/` paths

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:200,202,218,223,247,264,324,491,511,563,597,686,692,699,709,773,952`
**File:** `extensions/pi-claude-marketplace/shared/errors.ts:42-43,99-104,212`
**File:** `extensions/pi-claude-marketplace/transaction/rollback.ts:8,34,63`
**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:485`
**Issue:** Comments throughout the shared/* and transaction/ files still
reference `presentation/compact-line.ts`, `presentation/cause-chain.ts`,
`presentation/sort.ts`, `presentation/rollback-partial.ts`,
`presentation/reload-hint.ts`, and `shared/grammar/status-tokens.ts` /
`shared/grammar/reasons.ts` as if those modules still exist. Phase 21
(D-21-02) retired those paths; the comments now point readers to files
that don't exist.

Examples:
- notify.ts:200,202: "Pattern: shared/grammar/status-tokens.ts:34-52"
- notify.ts:563: "V2 grammar constants duplicated from
  presentation/compact-line.ts per D-16-04. Phase 21 deletes both copies."
  -- Phase 21 already deleted the `presentation/` copy; the wording reads
  as if the duplication is still live.
- notify.ts:773: "Mirrors `presentation/compact-line.ts` `composeReasons`
  (lines 458-479)" -- the file is gone.
- errors.ts:42-43: "Located in `shared/errors.ts` because `shared/notify.ts`
  cannot import from `presentation/` (D-11 layering). `presentation/cause-chain.ts`
  re-exports this symbol so presentation-layer consumers reference it via
  `presentation/`." -- the re-export does not exist.

This is a maintenance hazard: a new contributor following these
references finds nothing, and the `assertNever` / `composeReasons`
duplications described in the comments as "duplicated literals; Phase 21
deletes both copies" sit half-resolved (one half deleted, comment claims
both).

**Fix:** Sweep the comments to remove dead path references, or rewrite
them to say "previously in <path>; canonicalised here in Phase 21". A
search for `presentation/` and `shared/grammar/` across `extensions/`
yields ~25 occurrences across 5 files -- none of those paths exist on
disk anymore.

### WR-05: `update.ts` `notifyDirectFailure` always sets a plugin-row `scope` matching the marketplace block's scope

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1238-1252`
**Issue:** `notifyDirectFailure` writes:

```ts
const failedRow: PluginFailedMessage = {
  status: "failed",
  name: pluginName,
  scope,  // <-- always set, always === marketplace's scope at the callsite
  reasons,
  cause,
  ...
};
notify(ctx, pi, {
  marketplaces: [{ name: marketplace, scope, plugins: [failedRow] }],
});
```

Every caller passes the SAME `scope` for both the marketplace block and
the plugin row. Per the IN-04 orphan-fold convention documented in
install.ts:936-944 and the renderer behavior at notify.ts:743 the
`row.scope === mp.scope` case is suppressed at render time, but the
caller is still emitting a structurally redundant field -- the same
defect CR-02 calls out in the install.ts defensive arm, replicated five
times in update.ts. Same severity reasoning as CR-02 (no byte-output
difference today; contract divergence from the project's stated
"omit when matches" convention).

**Fix:** Drop the row-level `scope` from `notifyDirectFailure`'s row construction:

```ts
const failedRow: PluginFailedMessage = {
  status: "failed",
  name: pluginName,
  reasons,
  cause,
  ...(args.rollbackPartial !== undefined && args.rollbackPartial.length > 0 && { ... }),
};
```

Update the `notifyBareFormEnumerateFailure` helper (update.ts:1379) the
same way (it emits `scope: scope ?? "user"` on the row, matching the
block scope).

### WR-06: `narrowSkipReason` fallback in `marketplace/update.ts` returns `"up-to-date"` for empty-notes path -- a SUCCESS Reason for a skipped-with-no-info case

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:531-548`
**Issue:** The legacy substring-fallback in `narrowSkipReason` ends with:

```ts
const notes = outcome.notes;
if (notes.length === 0) {
  return "up-to-date";
}
// ...substring matches...
return "up-to-date";
```

The function is called to narrow a `PluginUpdateSkippedOutcome` -- by
construction the plugin was skipped, but `"up-to-date"` is the closed
Reason emitted for the `(unchanged)` partition (line 478). Reaching this
fallback means the producer signalled "skipped" without any `reasons`
or `notes`, and the renderer surfaces `{up-to-date}` to the user. The
operator reads "skipped -- up-to-date" and assumes nothing was wrong,
when in fact the producer failed to populate its outcome contract.

**Fix:** Throw or assert on the empty-notes / no-substring-match path
rather than mapping to a SUCCESS reason. A `partition: "skipped"`
outcome with no notes and no reasons is a producer-contract violation
and deserves to surface as such:

```ts
if (notes.length === 0) {
  // A "skipped" outcome with no notes/reasons is a producer-contract
  // violation; surface the violation rather than masking it as
  // up-to-date.
  return "not in manifest"; // or assert(false, "skipped outcome must carry a reason")
}
```

Same argument applies to `narrowFailReason` (update.ts:559-590) which
defaults to `"unreadable manifest"` for the empty-notes case.

## Info

### IN-01: Stale legacy comment in `uninstall.ts` references retired CMC IDs and D- numbers

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts:296-303`
**Issue:** The 8-line block comment at uninstall.ts:296 leads with "CMC-24
/ D-13-05 / D-13-06 legacy comment:" -- calling itself a "legacy comment"
in-band is the symptom of a comment that should have been rewritten or
removed during the teardown. The substance (MSG-SD-3 / no soft-dep
marker on uninstalled rows) is correct and useful; the V1 CMC-24 /
D-13-05 / D-13-06 references add nothing for a reader at HEAD.
**Fix:** Rewrite as: "MSG-SD-3: the uninstalled variant has NO per-row
soft-dep predicate fields by construction -- the renderer cannot emit
`{requires pi-subagents}` / `{requires pi-mcp}` markers on (uninstalled)
rows." Drop the historical decision numbers.

### IN-02: `notify.ts` `Sortable` interface duplicates `Scope` type instead of importing it

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:1234-1237`
**Issue:** `Sortable.scope` is typed as the inline literal union
`"user" | "project"` rather than the exported `Scope` type from
`./types.ts`. The drift-guard test (`scope-order-drift.test.ts`) does
not catch this (it looks for `["user", "project"]` array literals, not
union types), but the inline literal repetition is one more drift
vector. Note the import block at notify.ts:5 already imports
`type Scope from "./types.ts"` for use elsewhere in the same file.
**Fix:**
```ts
export interface Sortable {
  readonly name: string;
  readonly scope: Scope;
}
```

### IN-03: `migrate.ts` `ensurePluginResources` silently rejects non-object plugin values without surfacing a warning

**File:** `extensions/pi-claude-marketplace/persistence/migrate.ts:62-95`
**Issue:** The `ensurePluginResources` helper short-circuits to `false`
when `plugins` is non-object/null/array, and also `continue`s past any
individual plugin entry whose `plRaw` is non-object. The outer ST-4 /
ST-5 normalize contract preserves data integrity but silently discards
malformed plugin records without flagging them. Compare to
`migrateLegacyMarketplaceRecords` at line 138-143, which at least sets
`mutated = true` (so the bad shape is overwritten on persist) -- the
inner-plugin path neither logs nor mutates.

This is a deviation from the file's own "fill / normalize" intent: a
corrupted plugin record sits on disk, the migrator skips it, the user
gets no diagnostic, and a later install touching the same marketplace
sees a different shape than expected.

**Fix:** Either set `mutated = true` and elide the bad record (matching
the marketplace-level behavior) or surface the bad shape via the same
console.warn channel used for persist failures (IL-3 already permits
one sanctioned warn in this file; a second would require updating the
CMC-37 test asserting "exactly one sanctioned warn callsite").

### IN-04: Excessively long block comments in orchestrator files reduce readability

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1-60`
**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1-56`
**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:1-103`
**Issue:** The file-leading block comments in install.ts (60 lines),
update.ts (56 lines), and marketplace/update.ts (103 lines) carry
decision-history references (D-19-01, D-19-02, D-18-03, MR-1..8, MU-7,
RH-1..5, PU-1..8, PI-1..15...) and Plan-NN-NN cross-references that
made sense during active development but now duplicate what
PROJECT.md / REQUIREMENTS.md / the planning archive carries
authoritatively. The teardown phase is a natural point to compress
these to the 5-10 lines that materially describe the file's purpose
to a reader at HEAD.

**Fix:** During a subsequent doc pass, compress each leading comment to
the operational description ("what does this file do", "what
invariants must be preserved"). Move historical decision references to
PROJECT.md / a dedicated `docs/decisions/` directory if they have
ongoing value, or delete if they are already captured by the planning
archive.

---

_Reviewed: 2026-05-27T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
