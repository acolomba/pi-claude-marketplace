---
phase: 01-presentation-model
reviewed: 2026-10-01T00:00:00Z
depth: standard
files_reviewed: 38
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - scripts/check-unused-type-members.contracts.json
  - scripts/check-unused-type-members.exceptions.json
  - scripts/notify-corpus.hook.mjs
  - scripts/notify-corpus.mjs
  - scripts/notify-corpus.negative.mjs
  - tests/architecture/catalog-uat/catalog-contract.test.ts
  - tests/architecture/gate-targets.ts
  - tests/architecture/soft-dep-marker-policy.test.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/register.test.ts
  - tests/integration/marketplace-add-seed-mirrors.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts
  - tests/orchestrators/plugin/fetch.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/shared/errors.test.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/notify-context.test.ts
findings:
  critical: 0
  warning: 1
  info: 5
  total: 6
status: issues_found
---

# Phase 1: Code Review Report (incremental re-review)

**Reviewed:** 2026-10-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

## Summary

This is an incremental re-review after `3eaa3d7c`. It has two parts.

1. **The review-fix commits.** These are `3093a652`, `25691b07`, `8f6a4f69`,
   `6bc023d7`, `736e69fc`, `fb68e4bf`, and `52863f55`. The full diff of each
   commit was read. All seven prior findings (WR-01, WR-02, IN-01..IN-05) are
   fixed as `01-REVIEW-FIX.md` describes:
   - **WR-01:** Each of the four wrappers now has an on case and an off case.
     The `{}` / `{requires pi-subagents}` bytes catch a wrapper that reads
     `CENTRAL_MARKER_POLICY`, an all-true policy, or an all-false policy.
   - **WR-02:** The table-totality case and the source-derived context scan
     both pass. The planted control is real.
   - **IN-03:** The `dependencies?: never` refusal holds. `ResolvedRow` omits
     `dependencies`, and only the four producer types that declare the key
     need refusing.
   - **IN-04:** The corpus hook and the argument fix are correct.
     `node scripts/notify-corpus.negative.mjs` exits 0 with Controls 5 and 6.
     A rescan of `extensions/pi-claude-marketplace/**/*.ts` confirms that only
     `shared/notification-dispatch.ts` spells `ui.notify(`, with 9 rewrites for
     9 occurrences.
   - **Type-member pins:** The re-pinned lines in the contracts and exceptions
     files resolve to the intended declarations: grammar `532`/`567`/`615`/`801`/`1413`,
     `add.ts:611`, `info.ts:1353`, `update-preflight.ts:144/145/354`, and
     `update-swap.ts:217`.
   - **Test runs:** `node --test` on `soft-dep-marker-policy.test.ts` and
     `notify-context.test.ts` passes 43 of 43 cases.

2. **The merge resolution in `a31a188b`.** The textual conflicts were in
   `marketplace/add.ts` (`opts.pi` -> `opts.run` in the new 7-argument
   `notifyWithContext` call), `marketplace/shared.ts` (the import block), the
   contracts JSON pins, and about 40 `pi` -> `run` test hunks. All of them
   were resolved correctly. No merged module probes `pi`, `getAllTools`, or
   `softDepStatus` at render time. No production caller hands a raw producer
   row to the newly guarded composers, because the tree typechecks with the
   refusal in place. The one presentation-model concern from the merge is
   WR-01. Main's new leftover-clone advisory composes its display string in
   the orchestrator: it adds the indent and redaction there, so the resolve
   step never sees structured data.

The remaining items are Info. They cover hook coverage gaps that the stricter
check still misses, permissive argument parsing, an inaccurate doc comment in
the new SC-5 scan, and stale comments in files that the IN-01 fix touched.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: The merged `marketplace add` leftover advisory is redacted and indented in the orchestrator, not in the resolve step

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:508-513` (call site `:566-574`)
**Issue:** Main added `removalAdvisories`, and the merge carried it onto the
branch's `notifyWithContext(..., advisories)` seam unchanged:

```ts
return cause instanceof UnremovableLeftoverCloneError
  ? [`    ${redactAbsolutePaths(cause.removalLeak)}`]
  : undefined;
```

This is a manual-recovery leak, which is failure detail. The orchestrator turns
it into a finished display line: it redacts the paths and adds the 4-space text
indent. That conflicts with two phase decisions:

- **D-11:** Failure detail, including manual-recovery leaks, is serialized in
  resolve. PMOD-04 redaction lands at that one site.
- **The D-11 text-only list:** "the 4- and 6-space cause-chain indents" belong
  to the text strategy.

Compare the only other `advisories` producer,
`composeRetainedWorkflowsAdvisories`. It lives in the presentation module
`shared/notification-summary.ts`. This line is the first advisory that an
orchestrator composes. Phase 4's model-to-DTO converter will therefore carry
an English string with 4 leading spaces and already-redacted text. The wire
schema cannot tell the leak apart from its layout. PMOD-04 then has a producer
site that it must find and de-duplicate. No test fails today, because the
bytes match main's catalog. The deviation is in the model contract that this
phase sets up.

**Fix:** Carry the leak as data and compose it in the presentation layer.
Either:

- add a typed member on the failed marketplace row (for example
  `leaks?: readonly string[]`), which resolve serializes the same way it
  serializes `manualRecoveryLeaks`; or
- at minimum, move the composition next to its sibling in
  `shared/notification-summary.ts`:

```ts
// shared/notification-summary.ts
export function composeLeftoverRemovalAdvisories(leak: string): readonly string[] {
  return [`    ${redactAbsolutePaths(leak)}`];
}
// orchestrators/marketplace/add.ts
return cause instanceof UnremovableLeftoverCloneError
  ? composeLeftoverRemovalAdvisories(cause.removalLeak)
  : undefined;
```

If the deviation stays, record it with a decision ID so Phase 4 sees it.

## Info

### IN-01: The strict corpus hook still misses some `notify` spellings, and it rewrites inside string literals

**File:** `scripts/notify-corpus.hook.mjs:15-17,26,59-68`
**Issue:** The new check compares `text.split("ui.notify(")` with the
`bareReceiverCall` matches. It refuses every spelling that contains the exact
substring `ui.notify(` without a bare receiver. Spellings without that
substring are counted by neither side, so they stay unrecorded with no error:

- `ctx.ui?.notify(`
- `ctx.ui.notify (`
- `ctx.ui.notify.call(ctx.ui, ...)`
- `const { notify } = ctx.ui; notify(...)`

The doc says that any other spelling "fails to load with an error", which
overstates the check. The ESLint IL-2 selector is switched off inside
`notification-dispatch.ts`, which is exactly where these calls live, so
nothing else guards that file. The rewrite also runs on raw text, so a string
or template literal that contains `X.ui.notify(` would change its runtime
value under capture. Today no extension file does either (verified).
**Fix:** Narrow the doc claim to "any spelling containing `ui.notify(`".
Optionally, also count `/\bnotify\b/` member accesses on `.ui` in
`notification-dispatch.ts` and refuse when the counts differ. Or state these
spellings as a known limit of D-01.

### IN-02: `capture --files` with no values silently captures the whole suite

**File:** `scripts/notify-corpus.mjs:300-325`
**Issue:** `flagValues` returns `[]` for `capture --files --out x.jsonl` and
for a `--files` list that is cut short by an unknown flag
(`--files a.test.ts --verbose b.test.ts` drops `b.test.ts`). In both cases,
`parseCaptureArgs` falls back to `suiteGlobs()`. An operator who asked for a
subset gets a full-suite capture, or a shorter list, with no message.
**Fix:** When `--files` is present but `flagValues` returns no values, throw
`capture --files needs at least one <path>`. Reject flags other than `--out`
and `--files`.

### IN-03: The SC-5 context scan doc says an unexported pin is labelled `(unexported)`, but it can take a preceding export's name

**File:** `tests/architecture/soft-dep-marker-policy.test.ts:271-282`
**Issue:** `contextNamesIn` labels each pin with the last `export const`
between it and the previous pin. Take an unexported context that follows an
exported render map in the same segment, such as
`export const X_RENDER = ...; const X_CONTEXT = {...} satisfies CommandContext<...>`.
That context is labelled `X_RENDER (...)`, not `(unexported)`. The gate still
fails, because no table row has that name, so this is not a false pass. The
failure diff points at the wrong symbol, though, and the doc comment
("A pin with no exported const before it is labelled `(unexported)`") does not
describe the code. Also, `stripComments` removes only whole-line `//`
comments. A trailing `// ... satisfies CommandContext<...>` comment on a code
line would add a phantom pin.
**Fix:** Label a pin by the `const` declaration that directly contains it.
For example, take the last `/^(export )?const (\w+)/m` in the segment and
prefix `(unexported) ` when the `export` group is missing. Or reword the doc
to describe the current behavior.

### IN-04: Comments next to the IN-01 edits still describe removed or incomplete surfaces

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts:1392-1397`, `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts:15-17,69-70`
**Issue:**

- **`update-swap.ts`:** The rewritten comment names only
  `{requires pi-subagents}` / `{requires pi-mcp}` and "declaresAgents /
  declaresMcp". The same return also stamps `declaresWorkflows`, which drives
  `{requires pi-dynamic-workflows}`. The sibling comment in `update-row.ts`
  names all three markers.
- **`list.ts`:** The header still shows the flow as
  `notify(opts.ctx, opts.run, { marketplaces: ... })`, and it says the empty
  case renders "through renderMarketplaceList". The code calls
  `notifyWithContext(..., LIST_CONTEXT, ..., "plural")`, and no
  `renderMarketplaceList` exists anywhere in `extensions/`. The comment at
  `:69-70` also names `notify(opts.ctx, opts.run, ...)`.

The comment policy forbids narrating code that no longer exists.
**Fix:** Add `{requires pi-dynamic-workflows}` / `declaresWorkflows` to the
`update-swap.ts` comment. In `list.ts`, replace the stale call and function
names with `notifyWithContext(..., LIST_CONTEXT, ...)` and
`(no marketplaces)` from the cascade emitter.

### IN-05: `installedLikeRow` takes `reasons` as a separate parameter, which the D-13 refusal does not cover

**File:** `extensions/pi-claude-marketplace/shared/notification-grammar.ts:610-627`
**Issue:** The `dependencies?: never` refusal guards `p`. The final reasons
arrive through a separate `reasons: readonly Reason[] | undefined`
parameter, which accepts a producer row's unresolved `reasons` as easily as
resolved ones. All 7 callers pass `p.reasons` today (verified), so nothing
drops a marker. However, the type-level control in
`tests/shared/notification-grammar.test.ts` cannot see this path. The two
sibling composers, `pluginRow` and `partiallyInstalledRow`, read `p.reasons`
themselves.
**Fix:** Add `readonly reasons?: readonly Reason[]` to `p` and drop the
trailing parameter, so the reasons come from the guarded row. Update the 7
call sites, which are mechanical edits. Re-pin the `installedLikeRow.p`
exception if its line moves.

---

_Reviewed: 2026-10-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
