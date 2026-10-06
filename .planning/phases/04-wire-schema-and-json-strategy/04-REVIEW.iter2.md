---
phase: 04-wire-schema-and-json-strategy
reviewed: 2026-10-04T12:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/notification-present.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/redact-credentials.ts
  - tests/architecture/no-credential-leak.test.ts
  - tests/shared/notification-present.test.ts
  - tests/shared/notification-resolve.test.ts
findings:
  critical: 1
  warning: 2
  info: 1
  total: 4
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-10-04T12:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Scope: the gap-closure diff `42f80dec..HEAD` (commits c8a45a9b, 5d988d7d). It
redacts marketplace block names and plugin row names in `resolveRows` and the
marketplace-not-added name in `presentNotification`, and it adds three AUTH-09
subject-name rows.

What holds:

- Block names, row names, and the not-added name are redacted at the model
  chokepoints. Every presentation reaches them: cascade, update no-op,
  reconcile-applied, and the tools `details` path through `presentCascade`.
- The wire `id` is built from the redacted names.
- The three new gate rows are not vacuous. `assertNoPlantedCredential` requires
  the `***` marker in both the payload and the text.
- The byte locks hold. I re-ran `node scripts/notify-corpus.mjs check`: 3143
  baseline entries present, 0 extra, exit 0. `git diff --exit-code 4e6c568a --
  docs/output-catalog.md` exits 0. The three suites pass (153/153).
- Comments cite only requirement and decision IDs. They contain no phase, plan,
  or wave numbers.

What fails:

- One reachable subject-name path still leaks a password into both strategies.
  The cause is the last-`@` split in the reconcile key parser: it cuts URL
  userinfo apart before the redactor sees it. The new `resolveRows` JSDoc names
  this exact scenario as its motivation (CR-02).
- The `"name" in resolved` guard admits a row whose `name` key holds a
  non-string value, and `redactCredentials` then throws inside the
  diagnostic-row arm (WR-07).
- The cascade gate rows read their text through the reconcile-applied
  composer, not the cascade text path. Their doc comment says otherwise (WR-08).

## Critical Issues

### CR-02: A hand-edited `enabledPlugins` key leaks its URL password through the plugin row name in text and JSON

**File:** `extensions/pi-claude-marketplace/shared/notification-resolve.ts:344-347, 370-372` (producer: `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts:86-95`, `extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts:211-220`, `:796-806`)

**Issue:** The new JSDoc gives this as the reason for redacting row names: "a
hand-edited `enabledPlugins` key names a pending or failed row after whatever
precedes its last `@`". `parsePluginKey` splits the key at `lastIndexOf("@")`.
When the user puts a credentialed URL in the marketplace slot, which is the
natural place for one, the split falls inside the URL:

- key `foo@https://alice:s3cret@github.com/o/r.git`
- plugin `foo@https://alice:s3cret`
- marketplace `github.com/o/r.git`

That marketplace is undeclared, so `applySourceMismatch` (and the matching
apply-outcome arm) emits a dangling-reference block with a failed child row
named `foo@https://alice:s3cret`. The userinfo pattern in `redactCredentials`
needs the `@` that ends userinfo, and the split consumed it, so the name passes
through unchanged:

```
⊘ github.com/o/r.git [user] (failed) {dangling reference}
  ⊘ foo@https://alice:s3cret (failed) {dangling reference}
```

I reproduced this through `presentNotification`. `JSON.stringify(toWirePayload(p)).includes("s3cret")`
returns `true`: the password appears in the row `name` and in the wire `id`.
This is the same SC3 / PMOD-04 failure class as the verifier's gap: a credential
the user typed reaches both strategies. The new tests plant the URL only in the
plugin slot (`https://alice:s3cret@github.com/o/r.git@mp`), where the last `@`
falls after the URL. That ordering is the one the redactor already handles.
`redactCredentials` alone cannot fix this. A bare `https://alice:s3cret` tail
looks the same as `https://host:8080`.

**Fix:** Redact the whole key before it is split for display, so the userinfo
boundary is still present. For example, in the reconcile producer (or wherever
the dangling or pending row's subject is derived from the raw key):

```ts
// Redact before splitting: the last-@ split can cut URL userinfo apart.
const shown = redactCredentials(key);            // "foo@https://***@github.com/o/r.git"
const at = shown.lastIndexOf("@");
const displayPlugin = shown.slice(0, at);        // "foo@https://***"
const displayMarketplace = shown.slice(at + 1);  // "github.com/o/r.git"
```

Keep the raw `parsePluginKey` result for lookups. Use the redacted split only
for the row and block subjects. Then add an AUTH-09 row that plants
`foo@https://alice:s3cret@github.com/o/r.git` through the dangling-reference
shape, so the gate can see this ordering.

## Warnings

### WR-07: The `"name" in resolved` guard admits a non-string `name`, and `redactCredentials` throws in the diagnostic-row arm

**File:** `extensions/pi-claude-marketplace/shared/notification-resolve.ts:370-373`

**Issue:** The guard checks only that the key exists. An out-of-band row is the
reason the guard exists, and the reason the `missingPolicy` arm renders a
diagnostic instead of throwing. Such a row can carry `name: undefined` (for
example, from a spread of an optional value) or a non-string value. Before this
change, that row rendered `undefined (failed) {internal: no render arm for ...}`
through the grammar's `"name" in row ? row.name : "?"` idiom, which the summary
says this guard mirrors. Now `redactCredentials(undefined)` throws
`TypeError: Cannot read properties of undefined (reading 'replace')` from
`resolveRows`. I reproduced it with `presentNotification(run, { marketplaces:
[{ name: "mp", scope: "user", plugins: [{ status: "unknown", name: undefined }] }] })`.
The arm that exists to turn a producer bug into a visible diagnostic now turns
it into an uncaught exception at the notify call.

**Fix:** Guard on the value's type, not on the key:

```ts
// An out-of-band row can arrive without a string `name`; it keeps that shape.
const redacted =
  typeof (resolved as { name?: unknown }).name === "string"
    ? { ...resolved, name: redactCredentials(resolved.name) }
    : resolved;
```

Then add a resolve test for a `missingPolicy` row whose `name` is `undefined`.
It asserts that the row resolves and keeps its shape.

### WR-08: The cascade subject-name gate rows do not read the production cascade text path, and their doc comment says they do

**File:** `tests/architecture/no-credential-leak.test.ts:754-757, 806-810, 1037-1058`

**Issue:** The block comment says the subject-name rows compose text "over the
grammar function the text strategy uses for that presentation".
`probeCascadeSubject` asserts `presentation.kind === "cascade"` and then
composes the body with `composeReconcileAppliedBody`. The text strategy does
not use that function for a cascade. It uses the dispatch-private
`formatCascadePresentation`, which calls `composeContextBlocks` and then
`foldAdvisories` (`notification-dispatch.ts:280-304`). `composeContextBlocks`
is a hand-maintained duplicate of `composeMarketplaceBlock` ("It writes the same
lines as grammar's `composeMarketplaceBlock`"). The bytes match for these
fixtures, but nothing in the gate checks the code that actually renders a
cascade's block and row names. If that duplicate drifts, it could reintroduce a
subject string, and these rows would stay green.

**Fix:** Plant the two cascade-subject sites in a `reconcile-applied-cascade`
message. `composeReconcileAppliedBody` is the production body for that kind, so
the probe becomes exact:

```ts
function probeReconcileAppliedSubject(message: NotificationMessage): LeakProbe {
  const presentation = presentNotification(runWithAllLoaded(), message);
  assert.ok(presentation.kind === "reconcile-applied-cascade");
  return probeComposedText(presentation, composeReconcileAppliedBody(presentation.marketplaces));
}
// ...probe: () => probeReconcileAppliedSubject({ kind: "reconcile-applied-cascade", marketplaces: [...] })
```

Alternatively, correct the comment to say that the cascade rows read the
reconcile-applied composer as a stand-in for the cascade text path.

## Info

### IN-10: An `ssh://git@host/...` subject is now masked to `ssh://***@host/...`

**File:** `extensions/pi-claude-marketplace/shared/notification-resolve.ts:356`, `extensions/pi-claude-marketplace/shared/redact-credentials.ts:28-29`

**Issue:** Block names now pass through the userinfo pattern. A failed
`marketplace add ssh://git@github.com/o/r.git` will now display
`ssh://***@github.com/o/r.git`. The `git` user name is not a secret. The
redactor JSDoc and the new test (`keeps an scp-style marketplace block name
unchanged`) protect only the scp form `git@host:owner/repo`. The corpus does not
cover the `ssh://` form, so the lock cannot catch this text change.

**Fix:** If the ssh user should stay visible (as it does in the scp form), leave
userinfo without a `:` unredacted for `ssh://` and `git+ssh://` schemes. If not,
record the masking as intended in the redactor JSDoc and add a test that pins
the `ssh://` form.

---

_Reviewed: 2026-10-04T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
