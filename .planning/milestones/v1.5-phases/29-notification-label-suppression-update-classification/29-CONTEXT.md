# Phase 29: Notification Label Suppression & Update Classification - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers two independent UX fixes to the `notify()` / `update`
surfaces:

- **UXG-07 (cascade summary line):** Add a human-readable summary line before
  the cascade body for `error` and `warning` severity notifications so the host
  `Error:`/`Warning:` prefix is meaningful and contextual. The summary counts
  failed/skipped operations by type (plugin vs marketplace). `computeSeverity`,
  severity labels, and colors are all KEPT -- this is a message-composition
  change, not a severity-suppression change. The REQUIREMENTS.md spec
  (suppress label by routing to `info`) is superseded by the user decision
  captured in D-29-01/02.
- **UXG-08 (update classification):** Reorder `preflightUpdate` in
  `orchestrators/plugin/update.ts` so a plugin absent from the marketplace
  manifest returns `(failed) {not in manifest}` (matching `install`), not the
  current `(skipped) {not installed}` which fires before the manifest is
  consulted.

**Not in scope:** suppressing severity labels/colors; reclassifying
`install <already-installed>` from `failed` to `skipped` (UXG-09 -- the
`"plugin operation failed"` summary framing renders the `already installed`
case correctly without reclassification); any new notification capability;
any change to `notifyUsageError()` or the reload-hint ladder.

</domain>

<decisions>
## Implementation Decisions

### UXG-07 -- Summary line approach (overrides REQUIREMENTS.md spec)

- **D-29-01:** **KEEP severity routing.** `computeSeverity` stays active;
  `Error:`/`Warning:` labels and colors are preserved. The REQUIREMENTS.md
  spec (route cascades to `info` to suppress the label) is superseded by this
  decision: the user prefers the label+color pair and wants the prefix to be
  meaningful.
- **D-29-02:** For `error` and `warning` severity, `notify()` PREPENDS a
  summary line before the cascade body: `{summary}\n\n{cascade body}`. The
  composed string is passed to `ctx.ui.notify(composed, severity)` as before.
  Info severity: no summary line, cascade body only (no change to current
  behavior).
- **D-29-03:** Summary line wording is `"N plugin operation(s) [verb]."` /
  `"N plugin operation(s) and M marketplace operation(s) [verb]."`:
  - `error` → verb is `"failed"` (e.g., `"1 plugin operation failed."`,
    `"2 plugin operations and 1 marketplace operation failed."`)
  - `warning` → verb is `"skipped"` (e.g., `"1 plugin operation skipped."`,
    `"2 plugin operations skipped."`)
  - Singular/plural and mixed-type grammar: Claude's discretion on the exact
    sentence structure.
- **D-29-04:** Count rules for the summary:
  - Failed count: plugin rows with `status === "failed"` + marketplace rows
    with `status === "failed"`.
  - Skipped/actionable count: plugin rows with `status === "skipped"` whose
    reasons are NOT all benign + plugin rows with `status === "manual recovery"`
    + marketplace rows with `status === "skipped"` whose reasons are NOT all
    benign (i.e., the rows that route through `computeSeverity` arms 2, 3, 4).
  - The summary is derived from the same traversal that `computeSeverity`
    performs; a helper function co-located with `computeSeverity` in
    `shared/notify.ts` is the natural home.
- **D-29-05:** UXG-09 is **out of scope**. `install <already-installed>` stays
  classified as `(failed) {already installed}`. The summary reads
  `"1 plugin operation failed."` which is accurate (the operation could not
  complete). The per-row `{already installed}` reason in the cascade explains
  why. Reclassifying to `skipped` is a separate behavior change deferred to a
  future phase.

### UXG-07 -- Test and catalog lockstep

- **D-29-06:** The `expectedSeverity` field stays on catalog-uat fixtures (it
  still asserts the correct severity arg). The cascade byte forms for
  `error` and `warning` fixtures are updated to prepend the summary line per
  D-29-02/03. `notify-v2.test.ts` assertions for error/warning calls are
  updated to expect `[{summary + cascade}, severity]` pairs.
- **D-29-07:** `docs/output-catalog.md` byte blocks for error/warning cascades
  are updated to include the summary line. The catalog commentary on severity
  routing is updated to mention the summary line composition.

### UXG-08 -- Update classification fix

- **D-29-08:** In `preflightUpdate` (`orchestrators/plugin/update.ts`), the
  fix is to consult the manifest BEFORE concluding `"not installed"`. When the
  plugin is absent from local state (`record === undefined`), load the cached
  manifest and check for the plugin's entry:
  - Entry absent from manifest → return `partition: "failed"`, `reasons:
    ["not in manifest"]` (matching `install`'s `"not-in-manifest"` arm).
  - Entry present in manifest but not installed → return `partition:
    "skipped"`, `reasons: ["not installed"]` (current behavior, preserved).
  - This fixes the case where a typo / nonexistent plugin name hits
    `"not installed"` instead of `"not in manifest"` because the manifest
    check was unreachable.
- **D-29-09:** Async ordering: `loadCachedMarketplaceManifest` is already used
  later in the same function (line 604); moving the call earlier is safe
  (cached). Claude chooses the cleanest restructure (move the load up vs
  inline a second check in the `record === undefined` branch).

### Claude's Discretion

- Exact sentence structure for mixed plugin+marketplace summary counts
  (e.g., `"2 plugin operations and 1 marketplace operation failed."` vs
  `"2 plugin, 1 marketplace operation failed."`).
- Whether to extract a `buildSummaryLine(message, severity)` helper or
  inline the counting in `notify()` alongside `computeSeverity`.
- Pluralization logic (`"1 plugin operation"` vs `"2 plugin operations"`).
- The exact restructure in `preflightUpdate` (extract a sub-function, reorder
  the existing checks, etc.).
- Test naming/placement for the new summary-line assertions within the
  existing `notify-v2.test.ts` structure.
- Catalog commentary wording for the summary line behavior.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & source findings

- `.planning/REQUIREMENTS.md` -- UXG-07 (line 31) and UXG-08 (line 32)
  definitions. **NOTE:** The UXG-07 spec (suppress label via `info` routing)
  is superseded by D-29-01/02 -- read the spec for context but implement per
  the decisions above.
- `.planning/v1.4-MILESTONE-UAT.md` -- the 2026-05-30/31 hands-on UAT sweeps
  that surfaced UXG-07/08.

### Prior phase context (carry-forward decisions)

- `.planning/phases/28-severity-routing-label-discipline/28-CONTEXT.md` --
  D-28-11 (host API constraint: no label-without-color path), D-28-13
  (entrypoint split: `notify()` vs `notifyUsageError()`), D-28-06 (5-arm
  ladder), D-28-03 (`not installed` routes to `warning`). All still in effect
  for this phase.

### Implementation surface (UXG-07)

- `extensions/pi-claude-marketplace/shared/notify.ts` -- `computeSeverity`
  (line 1135, stays active), `allBenign` + `BENIGN_REASONS` (lines 108-123,
  stay active), `notify` entry (line ~1338, the call site that gains the
  summary composition), `notifyUsageError` (line 198, unchanged).

### Implementation surface (UXG-08)

- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` --
  `preflightUpdate` function, specifically lines 592-616: the `record ===
  undefined` check (line 592-601, returns `"not installed"` -- to be guarded
  by a prior manifest check) and the manifest check (line 604-616, returns
  `"not in manifest"` for skipped -- to be promoted to `"failed"` when plugin
  is absent from manifest and not installed).

### Test gates (move in lockstep)

- `tests/architecture/catalog-uat.test.ts` -- byte-equality gate; fixtures
  with `expectedSeverity: "error"` or `"warning"` need updated expected
  strings to include the summary line.
- `tests/shared/notify-v2.test.ts` -- `ctx.ui.notify` call arg assertions for
  error/warning cases need updated expected string (with summary prefix).

### Spec / contract docs to sync

- `docs/output-catalog.md` -- byte forms for error/warning cascades need the
  summary line prepended; commentary on severity routing updated to mention
  summary composition.
- `docs/messaging-style-guide.md` -- binding contract; any severity-ladder
  or message-composition prose that should reflect the summary line addition.
- `docs/adr/v2-001-structured-notify.md` -- note the summary line extension;
  any prose claiming `notify()` emits cascade-only string needs updating.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `computeSeverity` (`notify.ts:1135`) -- stays active; the traversal logic it
  performs (iterating `message.marketplaces` + `mp.plugins`) is the same
  traversal needed to count failed/skipped items for the summary line. A
  `buildSummaryLine` helper can share or mirror this traversal.
- `allBenign` + `BENIGN_REASONS` (`notify.ts:108-123`) -- stay active; the
  "not all benign" predicate is the discriminator for actionable-skip counts
  in the warning summary.
- `loadCachedMarketplaceManifest` (`update.ts:604`) -- already called in
  `preflightUpdate`; moving the call earlier for the UXG-08 fix uses the
  cached path and does not add net I/O.

### Established Patterns

- Severity is the *second arg* to `ctx.ui.notify` -- the string passed as
  the first arg is what the host prepends `Error: ` / `Warning: ` to. The
  summary line therefore appears immediately after the label prefix (no
  newline between `Error:` and the summary text).
- `notify()` currently produces: `{cascade body}\n\n{reload-hint?}`. After
  Phase 29 for error/warning: `{summary}\n\n{cascade body}\n\n{reload-hint?}`.
  Info: unchanged.
- `install.ts` uses `partition: "failed"` + `reasons: ["not in manifest"]`
  for the not-in-manifest case (line 1170-1178). UXG-08 aligns `update.ts`
  to this same pattern.

### Integration Points

- `notify()` is the sole cascade call site; all commands that flow through it
  will automatically gain the summary line once `notify()` is updated.
- `notifyUsageError()` is structurally separate (`notify.ts:198`) -- not
  affected by UXG-07; its existing `"error"` arg and message+usage format
  stay unchanged.
- `preflightUpdate` is the single chokepoint for per-plugin update routing;
  the UXG-08 fix lives entirely within that function.

</code_context>

<specifics>
## Specific Ideas

- User confirmed the cascade body already conveys per-plugin state
  (`(failed) {already installed}`, `(skipped) {not installed}`, etc.) and the
  summary line's job is to give the `Error:`/`Warning:` prefix something
  meaningful to introduce -- not to restate the cascade body.
- Example the user had in mind:
  ```
  Error: 1 plugin operation failed.

   ● uat-mp [user]
     ⊘ up (failed) {not in manifest}
       cause: Plugin "up" not found in marketplace "uat-mp".
  ```
- "Focus on operation (the command) rather than what happened to each plugin,
  which is going to display its condition anyway." -- user framing; this
  motivates `"plugin operation(s)"` rather than `"plugin(s)"` in the summary.

</specifics>

<deferred>
## Deferred Ideas

- **UXG-09: Reclassify `install <already-installed>` from `failed` to
  `skipped`** -- the `"plugin operation failed"` summary framing makes this
  acceptable for Phase 29. A future phase could change the partition from
  `failed` to `skipped` for the `already-installed` case if the operator
  finds `(failed) {already installed}` confusing vs `(skipped) {already
  installed}`. Deferred, not dropped.

</deferred>

---

*Phase: 29-notification-label-suppression-update-classification*
*Context gathered: 2026-05-31*
