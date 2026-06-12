---
phase: 53-pure-reconcile-planner-dry-run-preview
reviewed: 2026-06-10T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/domain/source.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/preview.ts
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - extensions/pi-claude-marketplace/edge/register.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/preview.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/no-orchestrator-network.test.ts
  - tests/architecture/notify-grammar-invariant.test.ts
  - tests/architecture/notify-types.test.ts
  - tests/architecture/reconcile-planner-purity.test.ts
  - tests/edge/completions/provider.test.ts
  - tests/edge/handlers/plugin/preview.test.ts
  - tests/edge/router.test.ts
  - tests/orchestrators/reconcile/notify.test.ts
  - tests/orchestrators/reconcile/plan-convergence.test.ts
  - tests/orchestrators/reconcile/plan.test.ts
  - tests/orchestrators/reconcile/preview.test.ts
  - tests/persistence/migrate-config.test.ts
  - tests/shared/notify-v2.test.ts
findings:
  critical: 0
  warning: 8
  info: 6
  total: 14
status: issues_found
---

# Phase 53: Code Review Report

**Reviewed:** 2026-06-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Reviewed the Phase 53 pure reconcile planner (`planReconcile`), the read-only
`/claude:plugin preview` orchestrator + edge shim, the six new `will *`
closed-set tokens across `shared/notify.ts` (tuples, variants, renderer arms),
the exhaustive-switch fallout in `tools.ts` / `plugin/list.ts`, the catalog
amendments, and the accompanying test suite.

The core invariants hold and are well-gated:

- **Purity (DIFF-01 SC#1):** `plan.ts` imports only `domain/source.ts` leaf
  helpers and `./types.ts`; the comment-stripped grep gate
  (`reconcile-planner-purity.test.ts`) plus the NFR-5 gate
  (`no-orchestrator-network.test.ts`, extended to all three reconcile files)
  enforce it structurally. Verified by direct read: no fs/network/notify/save
  surface.
- **CFG-03 abort:** `preview.ts` checks `base.status`/`local.status` BEFORE
  calling `planReconcile` and emits a `(failed) {invalid manifest}` basename
  row (T-53-02-02 honored); the orchestrator test proves no `will uninstall`
  leakage from an invalid config.
- **Disabled plugins:** `enabled === false` + recorded routes to
  `pluginsToDisable`; `enabled === false` + not-recorded is a no-op — disabled
  plugins never surface as pending installs (covered by plan.test.ts matrix).
- **REASONS stays at 29** (counted; `source mismatch` reused per Pitfall 53-7);
  `STATUS_TOKENS` = 21, `PLUGIN_STATUSES` = 15, `MARKETPLACE_STATUSES` = 9,
  all type-length-locked in `notify-types.test.ts`.
- **Reload-hint:** `shouldEmitReloadHint` triggers only on the four head
  transition tokens; `will *` rows and `reconcile-preview-empty` are
  structurally excluded (asserted byte-level in `notify-grammar-invariant.test.ts`
  and `notify-v2.test.ts`).
- **IL-2:** exactly one `notify()` per preview invocation on every path
  (empty / cascade / invalid-config), asserted by the orchestrator test.
- **Subject-first row grammar** holds in all six new renderer arms.

However, the planner has a real logic gap around plugins declared under
marketplaces that are scheduled for removal (contradictory `will remove` +
`will install` output), the preview orchestrator has no failure containment
for a corrupt `state.json` (raw throw escapes the command handler), the new
tests are not hermetic against `PI_CODING_AGENT_DIR`, and the catalog's
normative conventions tables were NOT amended in lockstep with the new tokens
— the catalog now contradicts its own preview section.

## Warnings

### WR-01: Planner emits contradictory actions for plugins declared under a marketplace scheduled for removal

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:166-230`
**Issue:** `buildMarketplaceUniverse` unions declared AND recorded marketplace
names, so a plugin entry `cr@mp` whose marketplace `mp` exists only in state
(i.e. `mp` is in `marketplacesToRemove`) is NOT classified as dangling.
`classifyDeclaredPlugin` then pushes it into `pluginsToInstall` (if not
recorded) or `pluginsToDisable` (if `enabled: false` and recorded). The
preview renders a self-contradictory block:

```text
○ mp [project] (will remove)
  ● cr (will install)
```

You cannot install into (or disable under) a marketplace being torn down.
This is the realistic "user deleted the marketplace entry but forgot the
plugin entry" config, and Phase 55's apply path will consume this plan
verbatim. Note the uninstall bucket already has the symmetric guard
(`buildUninstallBucket` skips removed marketplaces to avoid double-billing);
the install/disable buckets do not.
**Fix:** In `classifyDeclaredPlugin`, treat a declared plugin whose
marketplace is not in `merged.marketplaces` as dangling regardless of state
presence (check the declared map, not the universe), or explicitly skip
install/disable classification when the marketplace is in the remove set:

```ts
if (merged.marketplaces[marketplace] === undefined) {
  acc.dangling.push({ scope, marketplace, declaredSource: "", recordedSource: MARKETPLACE_NOT_DECLARED, cause: "source-mismatch" });
  return;
}
```

(Then `buildMarketplaceUniverse` becomes dead and can be deleted.) Add a
plan.test.ts matrix cell for "declared plugin + recorded-but-undeclared
marketplace".

### WR-02: Malformed plugin keys are silently dropped — no diagnostic at all

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:66-75,189-191`
**Issue:** `parsePluginKey` returns `undefined` for keys with no `@`, a
leading `@`, or a trailing `@`, and `classifyDeclaredPlugin` silently
`return`s. A user who declares `"my-plugin": {}` (forgot the
`@marketplace` suffix) gets a preview that simply omits the entry — the
command whose whole purpose is to surface config↔state divergence hides a
declared entry with zero signal. This is inconsistent with the
dangling-reference case, which DOES produce a diagnostic row. The header
comment frames this as "a typo cannot wedge the planner", but not-wedging
and not-reporting are different requirements.
**Fix:** Emit a `PlannedSourceMismatch` (or a dedicated diagnostic bucket
entry) for malformed keys, e.g. reuse the sentinel pattern with the raw key
as the subject, so the preview shows a `(failed)` row instead of nothing.

### WR-03: Dangling-reference diagnostic discards the plugin identity and mislabels the cause

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:196-205`; `extensions/pi-claude-marketplace/orchestrators/reconcile/types.ts:126-132`
**Issue:** The dangling bucket records only `{ scope, marketplace,
declaredSource: "", recordedSource: "<marketplace not declared>" }` —
`PlannedSourceMismatch` has no plugin field, so the offending config key
(`cr@phantom-mp`) is unrecoverable from the plan. Two consequences:
(a) the Phase 53 preview renders `⊘ phantom-mp [project] (failed)
{source mismatch}` and the user cannot tell WHICH plugin entry is dangling
(N dangling plugins under one phantom marketplace collapse into one
anonymous row); (b) the types.ts doc promises "Phase 55 can render it
without ambiguity", which is structurally impossible without the plugin
name. Additionally, `{source mismatch}` semantically misdirects the user
toward a source comparison when the actual problem is an undeclared
marketplace (acknowledged Pitfall 53-7 trade-off, but it compounds the
missing-plugin-name problem).
**Fix:** Add an optional `readonly plugin?: string` to
`PlannedSourceMismatch` (or a distinct `PlannedDanglingReference` type) and
populate it in `classifyDeclaredPlugin`; project it as a child
`(failed)`-class plugin row or fold the key into the diagnostic.

### WR-04: `previewReconcile` has no failure containment for `loadState` — corrupt state.json escapes as a raw throw (IL-2 gap)

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/preview.ts:106`; `extensions/pi-claude-marketplace/edge/handlers/plugin/preview.ts:56-61`
**Issue:** `loadState` throws on unparseable JSON and schema-invalid records
(`state-io.ts:170,177,214`). Neither `previewReconcile` nor the edge shim
catches, so a hand-edited/corrupt `state.json` aborts the command with an
unhandled rejection — no `ctx.ui.notify` output at all. This is asymmetric
within the SAME command: corrupt **config** gets the carefully designed
CFG-03 structured `(failed) {invalid manifest}` row, while corrupt **state**
gets an unstructured crash. The sibling read-only orchestrator
`listPlugins` (plugin/list.ts:803-854) catches exactly this class and emits
a synthetic `(failed)` row with a narrowed closed-set reason.
**Fix:** Wrap the per-scope `loadState` in try/catch and emit a structured
row mirroring the CFG-03 path, e.g.:

```ts
let state: ExtensionState;
try {
  state = await loadState(loc.extensionRoot);
} catch (err) {
  invalidBlocks.push({ name: "state.json", scope, status: "failed",
    reasons: [narrowListFailReason(err)], plugins: [] });
  continue;
}
```

### WR-05: Invalid-config blocks bypass the MSG-GR-3 sort — mixed output is mis-ordered

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/preview.ts:125-130`
**Issue:** The projection sorts plan blocks via `compareByNameThenScope`, but
`invalidBlocks` are appended AFTER the sorted projection. When the project
scope has an invalid config and the user scope has pending actions, the
output renders user-scope plan blocks first and the project-scope failure
last — violating the single per-scope row-order policy (name primary,
project-before-user) that every other list-rendering surface routes through
`compareByNameThenScope`. The in-code comment only addresses key collision,
not ordering.
**Fix:**

```ts
const message: CascadeNotificationMessage = {
  marketplaces: [...projection.marketplaces, ...invalidBlocks].sort(
    (a, b) => compareByNameThenScope(a, b),
  ),
};
```

### WR-06: output-catalog.md conventions tables NOT amended for the six `will *` tokens — catalog now self-contradicts

**File:** `docs/output-catalog.md:9-11,121-150`
**Issue:** The lockstep contract for new closed-set tokens requires the
catalog amendment to land with the tuple/renderer change. The new
`## /claude:plugin preview` section landed (lines 1194-1264), but the
normative "Conventions" surfaces did not:
- **Glyphs legend (line 10):** "`○` ... Never used on marketplace headers"
  is now FALSE — the `(will remove)` marketplace header renders `○`
  (`renderMpHeader` will-remove arm; catalog's own line 1226 area and
  notify-v2.test.ts:3467 prove the byte form `○ old-mp [project] (will remove)`).
- **"Status token reference" plugin table (lines ~123-140):** missing
  `(will install)` / `(will uninstall)` / `(will enable)` / `(will disable)`.
- **"Marketplace status tokens (4 entries)" table (line 141):** missing
  `(will add)` / `(will remove)`; the "(4 entries)" count is stale against
  the 9-member `MARKETPLACE_STATUSES` tuple.
**Fix:** Add the six tokens to the two token tables, correct the `○` glyph
sentence ("never used on marketplace headers EXCEPT `(will remove)`"), add
`(will disable)` to the `⊘` list, and update the "(4 entries)" count.

### WR-07: New preview tests are not hermetic against `PI_CODING_AGENT_DIR`

**File:** `tests/orchestrators/reconcile/preview.test.ts:43-62`; `tests/edge/handlers/plugin/preview.test.ts:54-71`
**Issue:** Both `withHermeticHome` helpers override only `HOME`. Per SC-1,
`getAgentDir()` honors `PI_CODING_AGENT_DIR` FIRST and falls back to HOME —
the repo's own hermetic convention saves AND deletes that var (see
`tests/orchestrators/marketplace/info.test.ts:76-97`). With
`PI_CODING_AGENT_DIR` set (the normal case inside a Pi session), every
user-scope arm in these tests reads the developer's REAL agent dir: the
"empty-steady-state", "scope fan-out", and bare-dispatch tests assert
`"Preview: next reload will apply 0 actions."` and will fail/flake whenever
the real user config and state diverge.
**Fix:** Mirror the established pattern — capture
`process.env.PI_CODING_AGENT_DIR`, `delete` it inside the try, restore in
the finally, in both helpers.

### WR-08: Stale load-bearing closed-set documentation in shared/notify.ts (counts and retired-frontmatter references)

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:145-147,240,255-257,291-293`
**Issue:** Comments that document the closed-set contract now contradict the
code shipped in this same file:
- Line 257: "Runtime tuple of every plugin status literal. **11 entries**" —
  the tuple has 15 (type-locked at 15 in notify-types.test.ts:139).
- Line 292: "Runtime tuple of every marketplace status literal. **7
  entries**" — the tuple has 9 (type-locked at 9).
- Line 240: "SNM-03 (PluginNotificationMessage discriminated union, **11
  variants**)" — 15 variants.
- Lines 55, 145, 186, 196: `REASONS` / `STATUS_TOKENS` / `MARKERS` /
  `PATTERN_CLASSES` are each documented as "Byte-equal to the ... block in
  the **binding frontmatter** at `docs/messaging-style-guide.md`" — guide
  v2.0 explicitly retired the YAML frontmatter ("Closed-set authority moved
  from frontmatter keys to `as const` tuples"); there is no frontmatter to
  be byte-equal to. (Related, outside this review's file scope:
  `docs/messaging-style-guide.md` still enumerates an 11-variant union /
  7-member marketplace set and describes a reload-hint trigger that includes
  marketplace statuses `{added, removed, updated}`, which
  `shouldEmitReloadHint` explicitly does NOT implement — that normative doc
  needs the same lockstep correction.)
**Fix:** Update the entry counts (or drop hard-coded counts in favor of
"see the type-length locks in notify-types.test.ts"), and rewrite the four
"byte-equal to frontmatter" sentences to reference the tuples as the sole
authority per guide v2.0.

## Info

### IN-01: `String(recordedRecord.source)` yields "[object Object]" for unknown-stored records

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:122`
**Issue:** Stored sources are objects post-`loadState`, so the
`unknown-stored` diagnostic's `recordedSource` is the useless
`"[object Object]"`, defeating the types.ts promise that "the operator can
see what the unrecognised value actually is". plan.test.ts:154-159 already
flags the bytes as a deferred implementation detail.
**Fix:** `typeof source === "string" ? source : JSON.stringify(source)`.

### IN-02: Projection scaffolding duplicated between import and reconcile; unused `key` field

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:47-111`; `extensions/pi-claude-marketplace/orchestrators/import/execute.ts:264-291,450-469`
**Issue:** `MarketplaceBlock`, `ensureMarketplaceBlock`, and the
`blockToMarketplaceMessage` skeleton are near-verbatim copies (acknowledged
"mirrors" in the header). In both copies the `key` field stored on the block
is never read after insertion (the Map key carries it).
**Fix:** Extract a shared block-accumulator helper (or at least drop the
dead `key` field from both `MarketplaceBlock` interfaces).

### IN-03: Command description omits `preview` (and `info`)

**File:** `extensions/pi-claude-marketplace/edge/register.ts:63-65`
**Issue:** `COMMAND_DESCRIPTION` enumerates "Bootstrap, install, uninstall,
list, import, update, and reinstall" — the new `preview` verb (and the
existing `info`) are absent from the user-visible command description.
**Fix:** Add "preview" (and "info") to the enumeration.

### IN-04: Comment nits in renderer and planner

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:1253`; `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:25`
**Issue:** (a) The `will remove` arm comment says "Reuses ICON_UNINSTALLED
(`○`)" — no such constant exists; the code uses `ICON_AVAILABLE`. (b)
plan.ts header carries a literal unresolved placeholder: "Pitfall 53-?".
**Fix:** Rename the comment reference to `ICON_AVAILABLE`; resolve or drop
the `53-?` placeholder.

### IN-05: `parsePluginKey` cannot represent marketplace names containing `@`

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:66-75`
**Issue:** `lastIndexOf("@")` deliberately favors plugin names containing
`@`, which means a marketplace name containing `@` (key `p@m@x`,
marketplace `m@x`) parses as marketplace `x` → fails the universe check →
spurious dangling diagnostic, even though `recordedKeys.has(key)` would have
matched the full string. Low impact (such names are likely rejected
upstream), but the asymmetry is undocumented.
**Fix:** Document the constraint ("marketplace names must not contain `@`")
at the parser, or validate marketplace names at config load.

### IN-06: Redundant guard condition in `buildUninstallBucket`

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:247`
**Issue:** For any recorded marketplace, `!merged.marketplaces[mpName]` and
`!marketplaceDiff.declaredAndRecorded.has(mpName)` are always equal
(`declaredAndRecorded` is populated for every declared+recorded name before
any continue), so the `&&` of the two is a tautological duplicate — one
operand is dead.
**Fix:** Keep a single condition (`!marketplaceDiff.declaredAndRecorded.has(mpName)`)
and note the equivalence, or keep both but mark the second as
belt-and-suspenders explicitly.

---

_Reviewed: 2026-06-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
