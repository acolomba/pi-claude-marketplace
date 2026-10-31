---
phase: 02-row-policies
reviewed: 2026-10-02T12:01:56Z
depth: standard
iteration: 3
source_revision: 1dc61877
diff_base: 6e222b1f
prior_findings_resolved: [WR-02, WR-03, WR-04, IN-01]
files_reviewed: 15
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - scripts/check-unused-type-members.contracts.json
  - tests/architecture/soft-dep-marker-policy.test.ts
  - tests/orchestrators/import/execute.messaging.test.ts
  - tests/orchestrators/reconcile/reconcile.messaging.test.ts
  - tests/shared/notification-grammar.test.ts
findings:
  critical: 0
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 2: Code Review Report (iteration 3)

**Reviewed:** 2026-10-02T12:01:56Z
**Depth:** standard (narrow re-review of the iteration-2 fix delta)
**Files Reviewed:** 15
**Status:** issues_found
**Source revision:** `1dc61877`. Its source equals `50566a24`, and `git diff 50566a24 1dc61877 -- extensions tests scripts` is empty.
**Fix delta reviewed:** `6e222b1f..50566a24` (commits `c9c4f16b` for WR-02, `50566a24` for WR-03, WR-04, and IN-01)

## Summary

All four iteration-2 findings are resolved at the sites they named.

- **WR-02 is resolved.** I compiled a scratch probe in the session scratchpad.
  It used a tsconfig that extends the repository's tsconfig. Nothing in the
  repository changed. The table shows each argument type against HEAD's
  `composePluginLines`:

  | Argument type | Result at HEAD |
  | --- | --- |
  | `ResolvedRow` (both production callers pass this) | compiles |
  | `ResolvedMarketplace["plugins"]` element (`composeMarketplaceBlock` shape) | compiles |
  | `ResolvedRow<PluginPartiallyInstalledMessage>` | compiles |
  | `ResolvedRow<PluginInstalledMessage> \| ResolvedRow<PluginUpdatedMessage>` | compiles |
  | `PluginPartiallyInstalledMessage` | refused (TS2345, parameter `never`) |
  | `PluginPartiallyInstalledMessage \| ResolvedRow<PluginInstalledMessage>` | refused (TS2345, member `PluginPartiallyInstalledMessage`) |
  | `PluginPartiallyInstalledMessage \| PluginSkippedMessage` | refused (TS2345) |
  | element of `readonly (ResolvedRow \| PluginPartiallyInstalledMessage)[]` (`.map` and `for...of`) | refused (TS2345) |
  | `PluginInstalledMessage` (required `dependencies`) | refused (TS2345) |

  As a control, the iteration-2 form
  `R & ("dependencies" extends keyof R ? never : unknown)` accepts the union
  argument without error. It refuses only the single-row argument. So the new
  `@ts-expect-error` union negative at
  `tests/shared/notification-grammar.test.ts:72-74` is satisfied by the
  refusal and not by an unrelated error. It would fail with TS2578 if the
  refusal stopped distributing. `tsc --noEmit -p .` exits 0, so
  `composeMarketplaceBlock` (`notification-grammar.ts:858-866`) and
  `composeContextBlocks` (`notification-dispatch.ts:371-380`) still compile.
  The probe also shows two side effects that need no action. A generic
  wrapper `<T extends ResolvedRow>(r: T) => composePluginLines(r, …)` is
  refused because the conditional is deferred, and no such caller exists. A
  resolved row that adds `dependencies?: never` is also refused. The known
  explicit `<ResolvedRow>` type-argument bypass is not re-reported.
- **WR-03 is resolved at every site it listed.** The comments now describe
  row policies. Each claim checks out against current code:
  - `uninstall.ts:924-925`: `UNINSTALL_CONTEXT.rowPolicies` declares only
    `uninstalled` and `failed` (`uninstall.messaging.ts:31-37`).
  - The glyph table: `PLUGIN_ROW_LAYOUT["partially-available"]` carries
    `ICON_PARTIALLY_AVAILABLE` (`notification-grammar.ts:409`). The only other
    carrier is `pluginInfoStatusGlyph` (line 665).
  - The D-11 list (`joinTokens`, `renderScopeBracket`, `renderVersion`,
    `composeVersionArrow`, `composeReasons`): all five exist and are
    file-private.
  - The `WithPlugins` comment: the bound is
    `Msg extends PluginNotificationMessage & { status: Status }`
    (`notify-context.ts:46-49`), and `CommandContext.rowPolicies` is
    `Record<Status, RowPolicy>`, which is total. An unknown status at run
    time produces the `missingPolicy` diagnostic row
    (`notification-resolve.ts:346-354`, `notification-grammar.ts:424-426`).
  - `remove.ts`: the cause line is 4-space indented
    (`composeFailureLines`, `notification-grammar.ts:968-981`).

  The changed comments contain no phase or plan numbers. One residual block
  in the same file still describes the deleted switch. See WR-05.
- **WR-04 is resolved at every site it listed.** The seven renamed
  `composePluginLines …` titles state the row behavior that each case checks.
  The `render` to `rowPolicyStatuses` rename keeps the whole-value
  `deepStrictEqual`. The SC-5 title fits its planted
  `rowPolicies: PLANTED_POLICY` fixture. No assertion was weakened, and no
  expected value changed. Other test titles, locals, and comments of the same
  class remain. See WR-06.
- **IN-01 is resolved.** The D-13 JSDoc states the rule directly, and the
  test comment names the single composer.
- **The contracts pin is correct.** The D-11 comment went from 4 lines to 2,
  and the `composePluginLines` JSDoc change sits after the pinned line, so the
  pin moves up by exactly 2. Line 925 is
  `): p is Extract<ResolvedRow, { status: …`, and `status` starts at column 32.
  `node scripts/check-unused-type-members.mjs --root .` exits 0 with 3
  recorded exceptions.

Verification at HEAD: `tsc --noEmit -p .` exit 0. Owner tests for the four
touched test files: 164 pass, 0 fail. ESLint exits 0 on
`notification-grammar.ts`, `notification-types.ts`, and the grammar test.
`prettier --check` exits 0 on all 15 delta files. The working tree is clean
apart from the pre-existing untracked `.planning/milestone.lock`.

## Narrative Findings (AI reviewer)

## Warnings

### WR-05: A comment block in notification-grammar.ts still describes the deleted central switch

**Classification:** WARNING. The comment describes code that no longer
exists, and the comments skill forbids that. It is the same defect class as
WR-03, and the WR-03 fix claimed a complete sweep of `extensions/`.
**File:** `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/shared/notification-grammar.ts:246-271`

**Issue:** The block sits directly above the D-11 comment that `50566a24`
rewrote. It says "this central switch is not the per-row dispatch path",
"This switch survives only as a STATICALLY-REFERENCED seam on the central
envelope", "Removing it would either break that exhaustiveness switch …",
and "The switch lists every status and has no default arm, so a future
`PluginNotificationMessage` variant becomes a type and lint error at this
switch." No such switch exists. Commit `029250ee` deleted
`renderPluginRow`. Rows are now formatted by `formatPluginRow` through the
`PLUGIN_ROW_LAYOUT` table (`notification-grammar.ts:401-421`), and its
exhaustiveness comes from `satisfies Record<PluginNotificationMessage["status"], PluginRowLayout>`.
The same commit removed the header line `File-private renderPluginRow + supporting helpers.`
and the line `dispatch each per-plugin body via the command's OWN context.render[status]`.
That left a broken sentence at lines 250-251: "…`notifyReconcileAppliedWithContext`,
which / map (`emitContextCascade` / …)".

**Evidence:** Compare
`git show 1c363b91:extensions/pi-claude-marketplace/shared/notification-grammar.ts | sed -n 320,346p`
with the current lines 246-271. `git log -S'dispatch each per-plugin body via'`
names `029250ee`. The fix log's sweep grep
(`renderPluginRow|dispatchRow|render*Row|render map`) does not match the
words "central switch" or "this switch", so this block was missed.

**Fix:** Replace the block with a present-tense description of the current
code, or delete it. Suggested text:

```typescript
// ---------------------------------------------------------------------------
// MOD-03 / D-02 / D-10: every producer routes its rows through
// `notifyWithContext` / `notifyReconcileAppliedWithContext`. `resolveRows`
// applies the command's own `rowPolicies`, and `composePluginLines` formats
// each resolved row through `PLUGIN_ROW_LAYOUT`. That table is total over the
// plugin status union, so a new `PluginNotificationMessage` variant is a type
// error there.
//
// SNM-16 / D-12: `resolveRows` composes soft-dep markers from the row's
// `dependencies`, the soft-dep snapshot, and the command's marker policy, so
// each row arrives with its final `reasons`.
// ---------------------------------------------------------------------------
```

### WR-06: Test titles, locals, and comments still name deleted render maps and arms

**Classification:** WARNING. These titles do not describe current public
behavior, which is a structure and readability finding under the
unit-testing review skill. Several comments are now false. It is the same
class as WR-04. One of the files is in this delta.

**Files:**

- `/home/acolomba/src/pi-claude-marketplace-json/tests/orchestrators/reconcile/reconcile.messaging.test.ts:115, 133-134`:
  the title is "reconcile contexts expose their exact labels and declared
  render arms", and the locals are `pendingRenderArms` and
  `appliedRenderArms`. The values are `Object.keys(*_CONTEXT.rowPolicies)`.
  This file is in the delta: `50566a24` rewrote its line-58 comment to say
  "row policy map", so the title and locals now contradict that comment.
- `/home/acolomba/src/pi-claude-marketplace-json/tests/orchestrators/plugin/install.messaging.test.ts:27, 29, 41`:
  the title is "exposes the install label and all six render arms", and the
  locals are `expectedRenderArms` and `renderArms`. The values are
  `Object.keys(INSTALL_CONTEXT.rowPolicies)`.
- `/home/acolomba/src/pi-claude-marketplace-json/tests/orchestrators/plugin/install-cascade.messaging.test.ts:122`:
  the title is "adds exactly the RESV-05 skip arm to install's own render map".
- `/home/acolomba/src/pi-claude-marketplace-json/tests/shared/notification-resolve.test.ts:838, 862` and
  `/home/acolomba/src/pi-claude-marketplace-json/tests/shared/notify-context.test.ts:431`:
  these titles say "has a render arm", "has no render arm", and "a missing
  render arm". The condition they test is a status absent from
  `rowPolicies`. The output literal `no render arm for` is a frozen byte
  contract and stays.
- Comments that are now false:
  - `tests/orchestrators/plugin/uninstall.test.ts:1263-1264` says
    "renderPluginRow's composeReasons call passes (false, false)". The real
    mechanism is the uninstall row policy, which sets `markers: false`.
  - `tests/orchestrators/plugin/list-flow.test.ts:1788` says "the render arm
    hard-codes both soft-dep arguments false".
  - `tests/orchestrators/plugin/install-flow.test.ts:1645` says "If the
    `disabled` render arm ever threaded the real soft-dep flags".
  - `tests/orchestrators/plugin/update-flow.test.ts:8550-8551` says "the
    verb-local `UPDATE_RENDER` map … the central `renderPluginRow` arm".
  - `tests/architecture/catalog-uat/fixtures/plugin-list.ts:507-508` says
    "composed by `LIST_RENDER`, while the central `renderPluginRow` arms …".
  - `tests/architecture/notify-producer-wire-coverage.test.ts:4` says
    "Command-local labels, render arms, and exact row bytes".

**Evidence:** At the phase base `1c363b91`, these contexts exposed `.render`
(`install.messaging.test.ts:36`, `reconcile.messaging.test.ts:89-90`), and
`LIST_RENDER` and `UPDATE_RENDER` existed in `list.messaging.ts:101` and
`update.messaging.ts:56`. At HEAD, `git grep "LIST_RENDER\|UPDATE_RENDER" -- extensions`
returns nothing. Iteration 2 listed only four test files under WR-04, so the
fix did not reach these.

**Fix:** Rename the titles and locals so they describe row policies, for
example `"reconcile contexts expose their exact labels and declared row policy statuses"`,
`pendingPolicyStatuses`, and `"a status with no row policy reports its named row before the adjacent present row"`.
Restate the false comments in terms of the policy. For example, in
`uninstall.test.ts`: "uninstall's row policies set `markers: false`, so no
soft-dep marker can appear." Keep the `no render arm for` output literal
unchanged. A last sweep with
`grep -rn -i "render arm\|render map\|renderPluginRow\|_RENDER\b\|central switch\|this switch" extensions tests`
should find only the frozen output literal and the unrelated
`edge/handlers/tools.ts` `renderPluginRow`.

## Info

### IN-02: The rewritten `WithPlugins` comment keeps the "X rather than Y" framing

**File:** `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/shared/notification-types.ts:780-783`
**Issue:** The new sentence is accurate. But "surfaces as a real compile error
rather than as a diagnostic row at run time" uses the contrast framing that
the comments skill forbids ("No `not X but Y` framing. State Y."). Iteration
2 flagged the same framing in IN-01.
**Fix:** State the fact: "… so a status drift between a producer and the
context's row policies is a compile error at the producer."

### IN-03: The glyph comment names the layout table by description, not by identifier

**File:** `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/shared/notification-grammar.ts:83-86`
**Issue:** "the row status glyph table below" is accurate.
`PLUGIN_ROW_LAYOUT["partially-available"]` at line 409 carries the glyph.
But that table holds `icon`, `scope`, and `version` layout, and the comment
does not name it. Grep cannot find it, while the other carrier,
`pluginInfoStatusGlyph`, is named.
**Fix:** Write "`PLUGIN_ROW_LAYOUT`'s `partially-available` entry and
`pluginInfoStatusGlyph`'s `partially-available` arm".

---

_Reviewed: 2026-10-02T12:01:56Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 3_
