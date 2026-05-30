---
phase: 16-renderer-public-api-alongside-v1
reviewed: 2026-05-26T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - eslint.config.js
  - tests/shared/notify-v2.test.ts
  - docs/adr/v2-001-structured-notify.md
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 16: Code Review Report

**Reviewed:** 2026-05-26T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

The Phase 16 V2 renderer ships cleanly against the binding contract: the public
`notify(ctx, pi, message)` and 2-arg `notifyUsageError(ctx, message)` entry
points coexist with the V1 wrappers, the discriminated-union exhaustiveness is
gated by `assertNever` in both file-private helpers, the soft-dep probe is
called exactly once per `notify()` invocation, the severity ladder and
reload-hint trigger predicates match D-16-11 / D-16-12 exactly, the indent
ladder matches D-16-08 at every site, caller order is preserved (D-16-06), the
ESLint exemptions are bounded to `shared/notify.ts` and end at the V2 renderer
chokepoint, and the 32 per-status tests pin byte-exact strings via
`mock.calls[N]!.arguments` deepEqual against valid `Reason` literals. No
critical defects were found.

Four warning-tier issues warrant attention before Phase 21 teardown: a silent
behavioural divergence between the inline `composeVersionArrow` helper and its
V1 source for the `from === to` case (the V1 helper collapses to a single
version string; the inline copy always emits the arrow form), a misleading
documentation comment about which Pi-API magic-string the omitted second arg
corresponds to, an opportunistic `?? ""` fallback in `notifyUsageError` that
silently swallows a programming error rather than failing loudly, and a
borderline-unjustified `msg-nc-1` rule disable in the Block 5 ESLint exemption.
Four info-tier observations cover doc-comment line-number drift, repeated O(N)
scans inside `computeSeverity`, a parameter-typing widening in `composeReasons`
that loses Reason-set safety, and a minor doc-comment factual error in the test
file's banner about which D-15 decision is cited.

## Warnings

### WR-01: composeVersionArrow inline copy diverges from V1 helper for `from === to`

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:642-660`

**Issue:** The inline `composeVersionArrow` helper claims (lines 632-640) to
mirror `presentation/version-arrow.ts:33-50` byte-for-byte. It does not. The
V1 helper has FOUR documented branches (`presentation/version-arrow.ts:25-32`):

  - both undefined          → `undefined`
  - both present + EQUAL    → returns the single version string (the
    `(unchanged)` partition falls here)
  - both present + DIFFER   → `${from} → v${to}`
  - only `to` present       → `to`
  - only `from` present     → `from`

The notify.ts inline copy (`shared/notify.ts:647-649`) collapses the equal /
differ cases into one -- it returns `${from} → v${to}` whenever both sides are
present regardless of equality:

```ts
if (from !== undefined && to !== undefined) {
  return `${from} → v${to}`;
}
```

For the `updated` variant, Phase 15 D-15-04 declares `from`/`to` as REQUIRED
strings but does not constrain `from !== to`. A caller passing
`from: "1.0.0", to: "1.0.0"` (a no-op update, legitimate for the
`(unchanged)` partition once Phase 17 lifts it into v2 grammar) would render
`1.0.0 → v1.0.0 (updated)` instead of the V1 `v1.0.0 (updated)` form. This is
a silent grammar divergence between the V1 wrappers and the V2 renderer
during their coexistence window (Phases 16-20), exactly the byte-equality
invariant CONTEXT specifies the renderer must preserve.

**Fix:** Either mirror the V1 helper's equal-vs-differ branch (and update the
comment), or update the doc-comment to call out the intentional divergence
and add a test fixture that asserts the chosen V2 form for `from === to`:

```ts
function composeVersionArrow(from: string | undefined, to: string | undefined): string {
  if (from === undefined && to === undefined) {
    return "";
  }

  if (from !== undefined && to !== undefined) {
    if (from === to) {
      return renderVersion(to); // V1 parity: collapse to single version when equal
    }

    return `${from} → v${to}`;
  }

  if (to !== undefined) {
    return renderVersion(to);
  }

  return from ?? "";
}
```

### WR-02: Misleading doc comment claims "omit-2nd-arg = info severity (V1 notifySuccess precedent)"

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:1056-1058, 879-883`

**Issue:** Two distinct doc comments tell the reader the V2 dispatch's
omit-2nd-arg branch is the V1 `notifySuccess` precedent. The first
(`shared/notify.ts:879-883`, severity-ladder spec block) says:

```
//   3. Otherwise                                                -> undefined (info)
```

The second (`shared/notify.ts:1056-1058`, dispatch implementation comment)
says:

```
// D-16-11: severity dispatch via the Pi API's magic-string second-arg
// convention. omit-2nd-arg = info severity (V1 notifySuccess precedent at
// shared/notify.ts:57-59); "warning" / "error" otherwise.
```

Both calls this "info severity". The Pi API's accepted magic strings are
`"info" | "warning" | "error"` (per the file header comment line 20). The V1
`notifySuccess` wrapper at lines 59-61 omits the second arg, which the Pi API
then defaults to... whatever `notify()` defaults to when severity is
unspecified. That is not necessarily `"info"` -- the doc comment is asserting
a Pi-API behaviour without proof. Tests assert `arguments.length === 1` (test
25), which only checks that no second arg was passed, not that the Pi API
treats it as `"info"`. If Pi's default ever drifts from `"info"` to (e.g.)
`"warning"`, the V2 surface would silently misroute every success
notification.

**Fix:** Either drop the "info severity" framing in both doc comments and
state simply "omit-2nd-arg uses Pi API's default severity, matching V1
notifySuccess precedent", or add an architecture test that calls `notify()`
with a no-op payload and asserts whatever shape the Pi API materializes for
the omitted-severity case. The second option also catches Pi-API peer-bump
drift.

### WR-03: `notifyUsageError` impl silently swallows missing `usageBlock`

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:106-131`

**Issue:** The V1 overload signature on line 107 requires
`usageBlock: string`, but the impl body (line 124) compensates for the
overload-vs-impl typing gap with `usageBlock ?? ""`. The justifying comment
(lines 119-123) acknowledges this is solely to satisfy strict-null-check
without `// eslint-disable no-non-null-assertion`. The behaviour is
defensive but silently masks a real bug class: a caller that compiles via
`as never` / `as any` (the V2 tests themselves do exactly this -- see
`tests/shared/notify-v2.test.ts:209` etc.) and passes only `(ctx, "msg")`
without a usageBlock would route to the V1 branch and emit `msg\n\n` (a
trailing blank line, no Usage block) at `"error"` severity instead of
throwing. The catalog UAT pins byte-exact strings but does not cover this
misuse path.

This is also a silent V1-byte-equality REGRESSION: the pre-Phase-16 V1
wrapper (cited in the comment at line 117) was:
`ctx.ui.notify(\`${message}\n\n${usageBlock}\`, "error")`. With
`usageBlock === undefined`, V1 would have interpolated the literal
`"undefined"` substring into the output (visible bug, easily caught in test
or by the user). The current `?? ""` fallback hides this from both
callers and tests.

**Fix:** Either narrow at runtime and throw a clear programmer error when
the V1 branch is matched with `usageBlock === undefined`, or use the
non-null assertion with an explicit `eslint-disable` justification citing
the overload signature as the guarantor:

```ts
if (typeof message === "string") {
  if (usageBlock === undefined) {
    // The overload signature forbids this; throw eagerly so misuse via
    // `as any` / `as never` surfaces in tests rather than the user log.
    throw new Error("notifyUsageError V1 overload requires usageBlock");
  }

  ctx.ui.notify(`${message}\n\n${usageBlock}`, "error");
} else {
  ctx.ui.notify(`${message.message}\n\n${message.usage}`, "error");
}
```

### WR-04: ESLint Block 5 exemption for shared/notify.ts disables msg-nc-1 unnecessarily

**File:** `eslint.config.js:289-301`

**Issue:** Block 5's `ignores: [..., "extensions/pi-claude-marketplace/shared/notify.ts"]`
disables three rules for the V2 renderer file: `msg-nc-1-entity-error`,
`msg-sd-1-soft-dep-reason`, and `msg-sd-2-soft-dep-predicate`. The
justifying comment (lines 280-288) cites only the soft-dep-marker
duplication for `msg-sd-1` / `msg-sd-2`. There is no `msg-nc-1` (entity-
error literal) duplication in `shared/notify.ts` -- the renderer does not
emit entity-error literals. The `msg-nc-1` exemption is broader than the
duplication justification warrants and risks masking a future regression
that introduces an entity-error literal into `shared/notify.ts` (where the
renderer would then own a grammar slot for which the dedicated lint rule
is silenced).

The wider concern: the Block 5 ignores entry was added for a precise
soft-dep-marker chokepoint reason, but its rule list copies the entire
Block 5 ruleset without filtering for the rules that actually apply to
`shared/notify.ts`. The same critique applies symmetrically to Block 4a
(`msg-rh-1` is the cited reason; `msg-mr-1` / `msg-mr-2` / `msg-rp-1`
exemptions are tagged-along) -- `shared/notify.ts` legitimately owns the
`"(manual recovery)"` literal in `renderPluginRow` (line 844) and the
`"[${phase.phase}] (rollback failed)"` literal in
`composeRollbackPartialLines` (line 983), so those exemptions are
justified.

**Fix:** Split the Block 5 ignores into rule-specific blocks:

```js
{
  files: ["extensions/pi-claude-marketplace/**/*.ts"],
  ignores: [
    "extensions/pi-claude-marketplace/presentation/compact-line.ts",
    "extensions/pi-claude-marketplace/shared/grammar/reasons.ts",
    "extensions/pi-claude-marketplace/shared/notify.ts",
  ],
  plugins: { msg: msgPlugin },
  rules: {
    "msg/msg-sd-1-soft-dep-reason": "error",
    "msg/msg-sd-2-soft-dep-predicate": "error",
  },
},
{
  files: ["extensions/pi-claude-marketplace/**/*.ts"],
  ignores: [
    "extensions/pi-claude-marketplace/presentation/compact-line.ts",
    "extensions/pi-claude-marketplace/shared/grammar/reasons.ts",
    // NOTE: shared/notify.ts intentionally NOT exempted -- V2 renderer
    // does not own entity-error literals and msg-nc-1 should fire if one
    // is introduced.
  ],
  plugins: { msg: msgPlugin },
  rules: {
    "msg/msg-nc-1-entity-error": "error",
  },
},
```

## Info

### IN-01: Doc-comment line-number citations drift from source line numbers

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:540-544, 595, 605, 642, 683, 1056`

**Issue:** Multiple doc-comments cite source line numbers that no longer
match the current file (Phase 16 additions shifted line numbers). Examples:

  - Line 252 cites `presentation/compact-line.ts:96` (verified -- present).
  - Line 541 cites `shared/notify.ts:466` for D-15-06 -- line 466 is
    inside `MarketplaceNotificationMessage`, which is correct (line 464
    in current file). Close.
  - Line 595 cites `presentation/compact-line.ts:489-491` for joinTokens
    -- verified at the cited lines.
  - Line 605 cites `presentation/compact-line.ts:481-487` for
    renderVersion -- verified at the cited lines.
  - Line 632-633 cites `presentation/version-arrow.ts:33-50` byte-for-byte
    -- see WR-01: this claim is FALSE (the inline copy diverges).

These references are doc-only and do not affect runtime behaviour, but they
will continue to drift through Phases 17-21 unless a CI test asserts they
are stable. The cause-chain trailer doc comment at line 882 (`shared/notify
.ts:57-59`) is correct.

**Fix:** Either drop the line-range citations and refer to the symbol name
alone (e.g. "mirrors `joinTokens` in `presentation/compact-line.ts`"), or
add an architecture test that parses the cited references and asserts the
named symbols exist at the cited line ranges. The first option is far
cheaper and removes the maintenance tax.

### IN-02: `computeSeverity` makes two passes over `marketplaces` instead of one

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:903-928`

**Issue:** The severity-ladder implementation walks `message.marketplaces`
TWICE: once for the failed-class match (lines 905-915), once for the
warning-class match (lines 918-924). This is not a correctness bug -- the
first-match-wins semantics requires the failed pass to complete fully
before any warning pass evaluates anything (D-16-11) -- but it can be done
in a single pass with one early return:

```ts
function computeSeverity(message: NotificationMessage): "warning" | "error" | undefined {
  let warning = false;
  for (const mp of message.marketplaces) {
    if (mp.status === "failed") {
      return "error"; // first-match wins
    }

    for (const p of mp.plugins) {
      if (p.status === "failed") {
        return "error";
      }

      if (p.status === "skipped" || p.status === "manual recovery") {
        warning = true;
      }
    }
  }

  return warning ? "warning" : undefined;
}
```

The single-pass form is equivalent under D-16-11 (the failed-vs-warning
relative order is preserved because the first-failed found anywhere returns
immediately). Performance is out of v1 scope, but the code-quality angle
remains: the two-pass form invites a future maintainer to "optimize" by
combining them in a way that breaks the first-match invariant.

**Fix:** Use the single-pass form above; assert the rewrite preserves
deepEqual on every per-status test.

### IN-03: `composeReasons` widens `Reason[]` to `string[]` and loses type safety

**File:** `extensions/pi-claude-marketplace/shared/notify.ts:683-704`

**Issue:** The first parameter is typed `readonly string[] | undefined`
rather than `readonly Reason[] | undefined`. The doc-comment at lines 676-681
acknowledges this is "for cross-variant ergonomics" because each switch arm
passes either `p.reasons` (Reason[]) or `undefined`. The widening is not
strictly necessary -- TypeScript's structural subtyping would accept
`readonly Reason[]` and `undefined` against a `readonly Reason[] | undefined`
parameter just as readily. The widening DOES allow the helper to silently
accept a string array that is NOT a Reason member, which could mask a
regression where a caller hand-builds a `reasons: ["arbitrary text"]` array.

The V1 source helper `presentation/compact-line.ts:458-479` declares the
parameter as `readonly Reason[] | undefined` -- the V2 inline copy is
strictly more permissive than the V1 source it claims (line 674-675) to
mirror.

**Fix:** Narrow the parameter type to `readonly Reason[] | undefined` to
match the V1 source the inline copy is asserted to mirror.

### IN-04: Test banner cites `D-15-02/D-15-04` for an inapplicable claim

**File:** `tests/shared/notify-v2.test.ts:31-37`

**Issue:** The SCOPE-BRACKET PLACEMENT (conditional emission) sub-spec at
lines 28-37 says:

```
For `installed` | `updated` | `reinstalled` | `uninstalled` |
`upgradable` | `skipped` | `failed` | `manual recovery`, the
`scope?: Scope` field is OPTIONAL (Phase 15 D-15-02/D-15-04).
```

`D-15-02` is the per-variant `dependencies` discipline; `D-15-04` is the
`version vs from/to` placement decision (see `shared/notify.ts:148-152`).
Neither D-15-02 nor D-15-04 governs the `scope?` optionality. The
governing decision is SNM-11 (the MSG-PL-6 carve-out for `available` /
`unavailable`) referenced correctly elsewhere in the same banner (line 23
and line 333) and at `shared/notify.ts:283-285`.

This is a doc-only typo in the test-file banner; it does not affect test
behaviour. Worth fixing because the test file is the de facto v2 spec
until Phase 17 lifts it into the output catalog (banner line 116).

**Fix:** Replace `(Phase 15 D-15-02/D-15-04)` with `(Phase 15 SNM-11
carve-out: scope? is structurally optional on the 8 variants; absent
entirely on the 2 list-surface variants)`.

---

_Reviewed: 2026-05-26T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
