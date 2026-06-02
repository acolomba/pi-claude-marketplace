---
phase: 35-orchestrator-call-sites-output-catalog-auth
reviewed: 2026-06-01T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - tests/helpers/git-mock.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/architecture/no-credential-leak.test.ts
  - tests/shared/device-flow-prompt.test.ts
  - docs/output-catalog.md
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 35: Code Review Report

**Reviewed:** 2026-06-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 35 wires Device Flow authentication into the marketplace `add` and `update`
orchestrators (AUTH-01/02), adds the `makeRawNotifyFn` seam to `shared/notify.ts`,
extends the mock helpers, and documents the Device Flow prompt in the output catalog.
The implementation is largely sound. No blockers were found. Five warnings and three
info items follow.

---

## Warnings

### WR-01: `stripComments` in no-credential-leak gate strips only whole-line comments -- inline comments containing forbidden field names produce false positives (and future inline-comment doc mentions could silently break the gate)

**File:** `tests/architecture/no-credential-leak.test.ts:54-56`

**Issue:** `stripComments` applies `/^\s*\/\/.*$/gm` which removes lines that are
*entirely* a comment but does NOT remove the comment portion of lines like
`someCode(); // never store password here`. Verified empirically: the string
`'const x = 1; // this is not about password at all'` still contains `password`
after stripping. Two consequences:

1. A false positive: any documentation comment on a non-comment line inside
   `state-io.ts`, `migrate.ts`, or `with-state-guard.ts` that mentions `password`
   (e.g., a JSDoc `@throws` note or a review annotation) would trip the AUTH-09
   gate spuriously, blocking CI with no real violation.
2. A false negative: `new Error(helper(cred.password))` -- a credential
   interpolated inside a nested call -- is not matched by the `[^)]*` fragment
   which stops at the first `)`, so a real leak through a wrapper call escapes
   the Phase 35 gate regex (lines 153, 96, 129) as well.

The tests currently pass because no inline-comment mention exists today, but the
gate is structurally fragile.

**Fix:**
```typescript
function stripComments(src: string): string {
  // Remove block comments first, then trailing inline comments on any line.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");          // removes everything after // on any line
}
```

For the false-negative (nested call), consider matching more broadly or adding a
complementary AST-based check. At minimum, extend the inline-comment stripping so
the gate is resilient to documentation additions.

---

### WR-02: AUTH-09 Phase 35 regex cannot detect credential interpolation through a wrapper call

**File:** `tests/architecture/no-credential-leak.test.ts:153`

**Issue:** The regex
```
/(new\s+Error\s*\(|ctx\.ui\.notify\s*\()(?:[^)]*\$\{[^}]*(access_?token|…)|[^)]*\+\s*(access_?token|…))/i
```
uses `[^)]*` to scan for a forbidden token inside the argument list. This fragment
stops at the first `)` it encounters, so a credential interpolated via a helper
call escapes the scan:

```typescript
// Bypasses the gate -- [^)]* halts at the ) in helper():
ctx.ui.notify(helper(cred.password));
```

The same weakness exists in the Phase 32 and Phase 33 gate variants at lines 96
and 129. The gate is a defence-in-depth measure, not the primary control, but its
stated purpose ("prevents the most common credential-leak surfaces") is overstated
given this bypass.

**Fix:** Combine with the inline-comment stripping fix from WR-01, and widen the
scan to check for the forbidden identifiers anywhere in the function call rather
than constraining with `[^)]*`:

```typescript
// Simpler and more robust: forbidden tokens must not appear near Error/notify at all.
const forbidden =
  /(new\s+Error|ctx\.ui\.notify)\s*\([^;]*\b(access_?token|cred\.[a-z]+|r\.accessToken)\b/i;
```

---

### WR-03: `makeMockDeviceFlowHttp()` called with no `pollQueue` in the auth-bundle forwarding test -- `onAuthRequired` triggering the default `{ kind: "pending" }` loop would hang indefinitely

**File:** `tests/orchestrators/marketplace/add.test.ts:796`

**Issue:** The test "AUTH-01 add: the GitAuthBundle is forwarded by reference into
gitOps.clone (no re-bundling)" creates `makeMockDeviceFlowHttp()` with no arguments.
`makeMockDeviceFlowHttp` defaults `pollQueue: []` and `defaultPoll: { kind: "pending" }`.
If `onAuthRequired` were ever invoked during this test, `initiateDeviceFlow` would
poll forever (each call returns `{ kind: "pending" }`, there is no expiry mock,
and the poll loop has no iteration limit in production).

In practice the test is safe today because the mock `gitOps.clone` succeeds
immediately without consulting auth callbacks. But the test is one `gitOps` stub
behaviour change away from an infinite hang, with no timeout guard. There is no
`test` timeout option set and no `requestCodeThrows` escape hatch configured.

**Fix:** Either document the assumption explicitly (`// Device Flow is never
triggered in this test -- clone mock succeeds without auth`), or configure the mock
to fail fast if contacted:

```typescript
const { http: deviceFlowHttp } = makeMockDeviceFlowHttp({
  requestCodeThrows: new Error("Device Flow must not be invoked in this test"),
});
```

---

### WR-04: `renderMpHeader` "skipped" arm for autoupdate-idempotent reasons includes a trailing space when `reasonsBrace` is guaranteed non-empty, producing correct output only by coincidence

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:693,697`

**Issue:** Lines 693 and 697:
```typescript
return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] <autoupdate> ${reasonsBrace}`;
return `${ICON_INSTALLED} ${mp.name} [${mp.scope}] <no autoupdate> ${reasonsBrace}`;
```
These arms are only entered when `mp.reasons?.includes("already autoupdate")` (or
`"already no autoupdate"`) is true, which means `reasonsBrace` is always non-empty
at this point. The output is therefore always correct. However, the code is
asymmetric with the "no reasonsBrace" arm directly below it (line 700-702) which
carefully guards against an empty `reasonsBrace` to avoid trailing spaces.

If `composeReasons` were ever changed to return an empty string for these reason
values (e.g., a future BENIGN_REASONS exclusion that filtered them from the brace),
the arms at 693/697 would silently emit trailing spaces that the catalog-uat byte
equality gate would catch but only at test time.

**Fix:** Apply the same guard used on line 700-702:
```typescript
// line 692-693
if (mp.reasons?.includes("already autoupdate")) {
  return reasonsBrace === ""
    ? `${ICON_INSTALLED} ${mp.name} [${mp.scope}] <autoupdate>`
    : `${ICON_INSTALLED} ${mp.name} [${mp.scope}] <autoupdate> ${reasonsBrace}`;
}
// line 695-697
if (mp.reasons?.includes("already no autoupdate")) {
  return reasonsBrace === ""
    ? `${ICON_INSTALLED} ${mp.name} [${mp.scope}] <no autoupdate>`
    : `${ICON_INSTALLED} ${mp.name} [${mp.scope}] <no autoupdate> ${reasonsBrace}`;
}
```

---

### WR-05: `currentBranchOverride: null` initialisation in `makeMockGitOps` is silently dropped if `null` is the initial value

**File:** `tests/helpers/git-mock.ts:97-99`

**Issue:** The conditional spread:
```typescript
...(initial?.currentBranchOverride !== undefined && {
  currentBranchOverride: initial.currentBranchOverride,
}),
```
correctly spreads `null` because `null !== undefined` is `true`. However, the
`MockGitState` type declares `currentBranchOverride?: string | null`, which means
the property is truly absent from a freshly constructed state object when the
condition is false. The `currentBranch` method at line 213:
```typescript
if (state.currentBranchOverride !== undefined) {
  return state.currentBranchOverride ?? undefined;
}
```
correctly returns `undefined` for a stored `null` via the `?? undefined` coalesce.

The logic is currently correct, but the double-negative (`null` meaning
"detached HEAD" stored as an absent-vs-null distinction) is fragile. If a future
reader writes:
```typescript
if (state.currentBranchOverride) {  // falsy check instead of !== undefined
```
then `null` (detached HEAD) would fall through to the `localRefs` derivation
instead of returning `undefined`, silently breaking all detached-HEAD tests without
a type error.

**Fix:** Use a distinct sentinel type instead of overloading `null`:
```typescript
currentBranchOverride?: string | "DETACHED";
// and at read time:
return state.currentBranchOverride === "DETACHED" ? undefined : state.currentBranchOverride;
```
This makes the intent explicit and removes the silent `null === detached HEAD`
convention that a future reader must know.

---

## Info

### IN-01: Stale line-number reference in `device-flow-prompt.test.ts`

**File:** `tests/shared/device-flow-prompt.test.ts:13,15`

**Issue:** The file header refers to `domain/github-auth.ts:385` as the emission
site. Line numbers in source files drift with each edit. If `github-auth.ts` is
modified, the reference becomes misleading without causing a test failure.

**Fix:** Reference the function name or a stable marker instead of a line number:
```
// emitted by initiateDeviceFlow (domain/github-auth.ts) after a
// successful POST /login/device/code ...
```

---

### IN-02: `renderPartition` in `shared.ts` is unreachable dead code

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:250-280`

**Issue:** `renderPartition` and the V1 partition-header approach are retired per
Plan 13-02c-01 and MSG-GR-3. The function is exported but no in-tree caller imports
it. It accumulates technical debt by maintaining a parallel rendering path that the
V2 cascade mapper (`outcomeToCascadePluginMessage`) superseded.

**Fix:** Remove `renderPartition` from `shared.ts`. If any external consumer
depends on it, move it to a compatibility shim with a `@deprecated` JSDoc and a
tracking issue.

---

### IN-03: `docs/output-catalog.md` -- `mp-failure-network` state and the update.ts actual output diverge; catalog comment is accurate but the discrepancy is undocumented

**File:** `docs/output-catalog.md:893-902` and `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts:742-749`

**Issue:** The catalog state `mp-failure-network` shows:
```
⊘ official [user] (failed)
```
(bare failed marketplace header, no plugin children). The update.ts failure path
in `refreshOneMarketplace` actually emits a synthetic failed-plugin child carrying
the `MarketplaceUpdateError` cause chain:
```
⊘ official [user] (failed)
  ⊘ official (failed) {network unreachable}
    cause: ...
```
The catalog's note at lines 901-902 acknowledges this correctly ("orchestrators
wanting to surface the cause must do so via a per-plugin … row"). The discrepancy
is intentional, but the catalog state `mp-failure-network` does not document that
`marketplace update` *does* use the per-plugin approach and therefore does NOT match
this bare-header shape. A reader might assume all marketplace failures look like the
catalog state. The `catalog-uat.test.ts` fixture presumably covers the real update
output separately.

**Fix:** Add a note to the `mp-failure-network` catalog state clarifying that
`marketplace update` uses the synthetic-child approach and matches a different shape,
or add a separate `mp-update-failure` catalog state that reflects the real output.

---

_Reviewed: 2026-06-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
