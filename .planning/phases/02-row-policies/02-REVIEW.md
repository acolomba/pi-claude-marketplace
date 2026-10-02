---
phase: 02-row-policies
reviewed: 2026-10-02T10:15:38Z
depth: standard
iteration: 2
source_revision: 6e222b1f
prior_findings_resolved: [CR-01, WR-01]
files_reviewed: 53
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-summary.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - extensions/pi-claude-marketplace/shared/notify-context.ts
  - scripts/check-unused-type-members.contracts.json
  - scripts/check-unused-type-members.exceptions.json
  - tests/architecture/catalog-uat/fixtures/plugin-pending.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/soft-dep-marker-policy.test.ts
  - tests/orchestrators/import/execute.messaging.test.ts
  - tests/orchestrators/marketplace/add.messaging.test.ts
  - tests/orchestrators/marketplace/autoupdate.messaging.test.ts
  - tests/orchestrators/marketplace/list.messaging.test.ts
  - tests/orchestrators/marketplace/remove.messaging.test.ts
  - tests/orchestrators/marketplace/update.messaging.test.ts
  - tests/orchestrators/plugin/enable-disable.messaging.test.ts
  - tests/orchestrators/plugin/fetch.messaging.test.ts
  - tests/orchestrators/plugin/info.messaging.test.ts
  - tests/orchestrators/plugin/install.messaging.test.ts
  - tests/orchestrators/plugin/list.messaging.test.ts
  - tests/orchestrators/plugin/reinstall.messaging.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/orchestrators/plugin/uninstall.messaging.test.ts
  - tests/orchestrators/plugin/update.messaging.test.ts
  - tests/orchestrators/reconcile/pending.test.ts
  - tests/orchestrators/reconcile/reconcile.messaging.test.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/notification-resolve.test.ts
  - tests/shared/notification-summary.test.ts
  - tests/shared/notification-types.test.ts
  - tests/shared/notify-context.test.ts
findings:
  critical: 0
  warning: 3
  info: 1
  total: 4
status: issues_found
---

# Phase 2: Code Review Report (iteration 2)

**Reviewed:** 2026-10-02T10:15:38Z
**Depth:** standard
**Files Reviewed:** 53
**Status:** issues_found
**Source revision:** `6e222b1f`
**Fix delta reviewed:** `87fbe890..6e222b1f` (commits `6abaddf9`, `0a05d28d`)
**Phase diff base:** `1c363b91`

## Summary

Both iteration-1 findings are resolved for the failure modes they reported.

- **CR-01 is resolved.** The owner case enables `contentReasons` and asserts
  the full produced row, `⊘ hello (skipped) {not installed, marketplace in user scope}`.
  I ran four in-memory mutations of `orchestrators/plugin/shared.ts` through a
  Node load hook. No file on disk changed. Each mutation fails the case
  (0 pass, 1 fail): `reasons: []`, swapped scope-qualifier tokens, a wrong
  block scope, and a `warning` severity. A negative control (missing anchor)
  confirms the hook rewrites the file. The baseline diff changes one line,
  and its `before` matches the original blob `25f4e3c0` at line 1907. The
  ledger entry matches D-07's 29th approved replacement.
- **WR-01 is resolved for the reported producer.** A single
  `PluginPartiallyInstalledMessage` argument is now refused with
  `TS2345 ... parameter of type 'never'`. The restored `@ts-expect-error` is
  satisfied by that refusal. It is not satisfied by an unrelated error. Both
  production callers still compile. Both pass the full `ResolvedRow` union
  (`notification-grammar.ts:865`, `notification-dispatch.ts:371`). The union
  omits `dependencies` from every member, so the conditional resolves to
  `unknown`. The refusal is weaker than the suggested member form for
  union-typed arguments. See WR-02.

Verification at HEAD: `tsc --noEmit -p .` exits 0. Owner tests for
`plugin/shared`, `notification-grammar`, and `notification-dispatch` pass
(421/421). ESLint passes on the three fix-touched files.
`fallow audit --base 87fbe890` returns `pass` with zero introduced findings.
The fix comments contain no phase or plan numbers.

The secondary re-read found no behavior defect in the phase-2 policy data,
missing-policy handling, or retained-workflow facts. The merges from main add
cause-bearing `disabled`, `uninstalled`, and update `skipped` rows.
`resolveRow` (`notification-resolve.ts:410-470`) resolves each of them into
`failure`. The merges brought back no render callback. The remaining findings
are comments and test titles that phase 2 left pointing at deleted helpers.

## Narrative Findings (AI reviewer)

### Warnings

### WR-02: The `dependencies` refusal does not apply to union-typed arguments

**Classification:** WARNING. Some type protection at a presentation boundary is still missing. Current output is correct.
**File:** `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/shared/notification-grammar.ts:931-942`
**Related:** `/home/acolomba/src/pi-claude-marketplace-json/tests/shared/notification-grammar.test.ts:58-71`

**Issue:** The check `"dependencies" extends keyof R` does not distribute over
union members. `keyof (A | B)` contains only the keys that every member shares.
If one member of the argument's union lacks `dependencies`, the conditional
resolves to `unknown`, and an unresolved member passes. The suggested
`ResolvedRow & { readonly dependencies?: never }` form refuses each member,
so this fix is weaker for unions. The JSDoc says "a producer row that still
declares `dependencies` is refused". That is true only for a non-union
argument. `composePluginLines` takes the full row union, so a future caller
with a mixed row array, for example
`(ResolvedRow | PluginPartiallyInstalledMessage)[]`, is a plausible way to skip
`resolveRows` without the type checker noticing.

**Evidence:** I compiled a scratch probe (outside the repo, using the
repository's compiler options) against HEAD's `composePluginLines`:

| Argument type | HEAD (conditional) | Member form `dependencies?: never` | Distributive variant (below) |
| --- | --- | --- | --- |
| `ResolvedRow` (production) | compiles | compiles | compiles |
| `ResolvedRow<PluginPartiallyInstalledMessage>` | compiles | compiles | compiles |
| `PluginPartiallyInstalledMessage` | **refused** | refused | refused |
| `PluginPartiallyInstalledMessage \| ResolvedRow<PluginInstalledMessage>` | **accepted** | refused | refused |
| `PluginPartiallyInstalledMessage \| PluginSkippedMessage` | **accepted** | refused | refused |
| element of `(ResolvedRow \| PluginPartiallyInstalledMessage)[]` | **accepted** | refused | refused |
| explicit `composePluginLines<ResolvedRow>(partial, …)` | **accepted** | refused | accepted |

A local widened to `ResolvedRow` before the call passes under every form.
That bypass is inherent to a parameter-side refusal and is not part of this
finding.

**Fix:** Distribute the check over the members of `R`. The form below declares
no member, so it does not add to the unused-type-member gate's inventory.
Confirm this with `npm run lint:type-members`. It also keeps the
`Parameters<typeof composePluginLines>[0]` positive check valid:

```typescript
/** The members of `R` that still declare `dependencies`. */
type UnresolvedRowMembers<R> = R extends unknown
  ? "dependencies" extends keyof R
    ? R
    : never
  : never;

export function composePluginLines<R extends ResolvedRow>(
  p: R & ([UnresolvedRowMembers<R>] extends [never] ? unknown : never),
  mpScope: Scope,
): string[] {
```

Add a union negative next to the existing one in the grammar test:

```typescript
void ((row: PluginPartiallyInstalledMessage | ResolvedRow<PluginInstalledMessage>) =>
  // @ts-expect-error a union with an unresolved member still declares its dependencies
  composePluginLines(row, "user"));
```

If the gap is accepted instead, change the JSDoc so it limits the claim to a
non-union argument.

### WR-03: Production comments describe deleted render helpers

**Classification:** WARNING. These comments describe code that no longer
exists, which breaks the comment policy. CONTEXT says "comments ... must
follow each changed declaration."
**Files (in the reviewed set):**

- `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/shared/notification-grammar.ts:83-86`:
  "two renderers carry this glyph to a row -- `renderPartiallyAvailableRow` below and …".
  `renderPartiallyAvailableRow` does not exist. The glyph reaches the row
  through the status table at line 411.
- `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/shared/notification-grammar.ts:278-282`:
  says the primitives `(joinTokens, …, pluginRow)` use "the `export` keyword
  only [to] widen their visibility so sibling command render maps can CALL them".
  Phase 2 removed their `export` (base line 358 `export function joinTokens` is
  now line 283 `function joinTokens`). `pluginRow` no longer exists, and no
  render maps remain.
- `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/shared/notification-types.ts:782-788`:
  mentions a "runtime `TypeError` inside `dispatchRow`" and "the context's
  render map". Phase 2 deleted `dispatchRow` (D-03), and contexts now carry
  `rowPolicies`.
- `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts:294-296`:
  "render through reconcile's own render map (MOD-03), never the central
  renderPluginRow switch". Neither exists.
- `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:347`:
  "the pending render map's status set".
- `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/shared/notification-resolve.ts:394`:
  "a row with no render arm". The condition is now a missing row policy. The
  frozen output text `no render arm for` at `notification-grammar.ts:427` is a
  byte contract and stays.

**Same defect outside the 53-file list:** phase 2 deleted these symbols, so the
same comments are now false in `orchestrators/marketplace/update.ts:858`
(`renderPluginRow`), `orchestrators/marketplace/remove.ts:818`
(`renderPluginRow`), `orchestrators/import/execute.ts:1490-1493` (render map,
`renderPluginRow`), `orchestrators/reconcile/apply.ts:1357-1360` (render map,
`renderPluginRow`), and `orchestrators/plugin/uninstall.ts:924`
("uninstall's render map has no `skipped` arm").

**Evidence:**
`grep -rn -i "renderPluginRow\|dispatchRow\|render map\|renderPartiallyAvailableRow" extensions`
lists every site above. The base revision `1c363b91` contains each named
symbol, and HEAD contains none of them.

**Fix:** Restate each comment in present tense against the current model. A
row's `status` selects its entry in the context's `rowPolicies`.
`resolveRows` composes reasons, and `composePluginLines` formats the row. A
status the policy map omits gets the defensive diagnostic row. For example,
`pending.ts:294-296` becomes "D-02: thread PENDING_CONTEXT so the
pending-tense rows resolve through reconcile's own row policies (MOD-03)."

### WR-04: Test titles and keys name deleted render helpers

**Classification:** WARNING. The test titles do not describe public
behavior, which is a structure and readability finding in the unit-testing
review.
**Files:**

- `/home/acolomba/src/pi-claude-marketplace-json/tests/shared/notification-grammar.test.ts:1189, 1206, 1223, 1235, 1247, 1256, 1265`:
  the case titles begin with `renderUninstalledRow`, `renderAvailableRow`,
  `renderRemoteRow`, `renderUnavailableRow`, `renderPartiallyAvailableRow`,
  and `renderDisabledRow`. Phase 2 deleted all of these functions. Each body
  now calls `composePluginLines`.
- `/home/acolomba/src/pi-claude-marketplace-json/tests/orchestrators/import/execute.messaging.test.ts:37, 43`:
  the expected and observed objects use a `render:` key, but the key holds
  `Object.keys(IMPORT_CONTEXT.rowPolicies)`.
- `/home/acolomba/src/pi-claude-marketplace-json/tests/orchestrators/reconcile/reconcile.messaging.test.ts:58`
  ("each render map is pinned …") and
  `/home/acolomba/src/pi-claude-marketplace-json/tests/architecture/soft-dep-marker-policy.test.ts:394`
  (title "… after an exported render map").

**Fix:** Title each case by the behavior it checks, for example
`"composePluginLines renders a partially-available row with its dropped kinds"`.
Rename the `render` key to `rowPolicyStatuses`. Change "render map" to "row
policy map" in the comment and the title.

### Info

### IN-01: The `composePluginLines` JSDoc explains the code through a rejected alternative

**File:** `/home/acolomba/src/pi-claude-marketplace-json/extensions/pi-claude-marketplace/shared/notification-grammar.ts:934-937`
**Related:** `/home/acolomba/src/pi-claude-marketplace-json/tests/shared/notification-grammar.test.ts:58-62`

**Issue:** "The refusal is a conditional on the argument's keys rather than a
`dependencies?: never` member, so it declares no member that nothing reads."
The sentence uses the "X rather than Y" framing that the comments skill
forbids. It also contains a double negative. The test comment still says "the
row composers", but only one composer remains.

**Fix:** State the fact directly: "The refusal is a type conditional and
declares no member, so the unused-type-member gate has nothing to report." In
the test comment, write "the row composer".

---

_Reviewed: 2026-10-02T10:15:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2_
