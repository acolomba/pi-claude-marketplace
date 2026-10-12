---
phase: 03-typed-raw-surfaces
reviewed: 2026-10-03T05:13:33Z
depth: standard
iteration: 3
files_reviewed: 26
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - extensions/pi-claude-marketplace/domain/github-auth.ts
  - extensions/pi-claude-marketplace/index.ts
  - extensions/pi-claude-marketplace/orchestrators/auth-host.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts
  - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
  - extensions/pi-claude-marketplace/shared/notification-grammar.ts
  - extensions/pi-claude-marketplace/shared/notification-resolve.ts
  - extensions/pi-claude-marketplace/shared/notification-types.ts
  - scripts/check-unused-type-members.contracts.json
  - tests/architecture/gate-targets.ts
  - tests/architecture/hooks-cap-notify.test.ts
  - tests/architecture/no-credential-leak.test.ts
  - tests/architecture/presentation-sink.test.ts
  - tests/architecture/temp-root-control.ts
  - tests/domain/device-flow-contract.ts
  - tests/domain/github-auth.test.ts
  - tests/integration/auth-e2e.test.ts
  - tests/orchestrators/marketplace/add.test.ts
  - tests/shared/notification-dispatch.test.ts
  - tests/shared/notification-grammar.test.ts
  - tests/shared/notification-resolve.test.ts
  - tests/shared/notification-types.test.ts
findings:
  critical: 0
  warning: 0
  info: 4
  total: 4
status: clean
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-03T05:13:33Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** clean (no Critical or Warning findings; 4 Info items)
**Iteration:** 3 (re-review after fix commit 13729cd8)

## Summary

Scope: `git diff 46946d89..HEAD` over the 26 listed files. Since iteration 2,
only `tests/architecture/presentation-sink.test.ts` changed
(`git diff --stat 16f507cd..HEAD` shows that one file, +62/-5). This pass
focused on that commit. Iteration 2 already re-reviewed the other files, and
they have not changed since.

**The iteration-2 WR-01 fix holds (D-16, commit 13729cd8).**

- `assertSinkPlacement` now has two mention clauses:
  - every `\bui\b` mention must be one of the `sinkCalls` notify calls (2);
  - every `\bdeliver\b` mention must be the declaration or a direct
    `deliver(<ctx>, formatEnvelopeArguments(` / `formatRawSurface(` call.
- In the stripped live module, `ui` appears 2 times and `deliver` 3 times
  (1 declaration and 2 formatter calls). So the unmutated copy passes, and the
  live-tree test passes.
- The three new offenders are non-vacuous. I copied the gate into the
  scratchpad (`probe-sink3.test.ts`) and logged each rejection message:
  - `.call`: "names ui 4 time(s); only the 2 notify calls inside deliver may."
  - destructure: "names ui 3 time(s); ..."
  - alias: "names deliver 4 time(s); only its declaration and 2 direct
    formatter call(s) may."
  Each message matches the pinned `rejection` regex. The pattern clause runs
  first and does not fire on these forms, so the pinned regex proves that the
  mention clause rejected them.
- Negative control: `probe-sink3-neg.test.ts` is the same gate with only the
  two mention asserts removed. All three new offenders then pass. So the
  offenders depend on the new clause and do not pass by accident.
- Other indirect forms the new clauses reject: `deliver.call(null, ctx, ...)`
  ("names deliver 4") and `ctx?.ui?.notify?.(...)` ("names ui 3").
- The header now has "Mentions" and "Limit" sections that match what the
  gate enforces. The "Limit" text is the one iteration 2 asked for.

**Regression checks:**

- `node --test tests/architecture/presentation-sink.test.ts`: 13 tests, 13
  pass, 0 fail.
- `npx eslint` and `npx prettier --check` on the changed file are clean.
- No production source changed, so output bytes cannot change.
- The bracket-access offender (`ctx.ui["notify"](args[0])`) used to reject
  on the literal clause. It now rejects first on the mention clause ("names
  ui 3 time(s)"). The test still passes because that offender keeps the
  default `/D-16/`. See IN-01: this is the silent clause drift that IN-01
  describes.

**Remaining items.** All are Info. One is new (IN-04): the mention clauses
count `ui` and `deliver`, but not the two formatter names. So a local binding
that shadows a formatter passes every clause. This is the same class as
IN-03(1), a shadowed `deviceCode` in AUTH-09, and I gave it the same severity.
IN-01..IN-03 carry forward. IN-01 is partly resolved.

## Structural Findings (fallow)

The structural pre-pass for iteration 1 returned `fail` with 17 duplicate-block
findings. All 17 are in files outside this review's scope: `scripts/check-*.mjs`,
`orchestrators/plugin/shared.ts`, and the edge handlers. They came from the
branch base, and none comes from this phase's diff. Full normalized report:
`.planning/phases/03-typed-raw-surfaces/FALLOW-normalized.json`. The fixer's
audit for 13729cd8 returned verdict `warn`, with 0 dead-code findings, 0
complexity findings, and the same 17 inherited clone groups.

## Narrative Findings (AI reviewer)

## Info

### IN-01: Most planted controls still accept any assertion of the scan, not the clause they target

**File:** `tests/architecture/no-credential-leak.test.ts:688`, `tests/architecture/presentation-sink.test.ts:237-264, 282`
**Issue:** 13729cd8 partly resolves this finding.

- The three new D-16 offenders now pin their clause through the optional
  `rejection` field.
- The seven older D-16 offenders still use the default `/D-16/`, and all
  eight AUTH-09 offenders still use `/AUTH-09/`.
- This iteration shows the risk is real. The bracket-access offender moved
  from the literal clause to the new mention clause, and no test noticed. That
  move is harmless here. But the same loose match would also accept a reject
  from the wrong clause, or from the stale-entry and vacuity messages, which
  also match `/D-16/`.
- The header claim at `presentation-sink.test.ts:59-60` ("only the placement
  clause can reject it") is still not asserted.

**Fix:** Make `rejection` required, and give every offender a pinned regex.
Examples:

| Offender kind | Expected regex |
| --- | --- |
| D-16 composed-template offenders | `/composes text outside the text strategy/` |
| D-16 third (sanctioned spelling outside `deliver`) | `/holds 3 notify call/` |
| D-16 pre-composed tuple / member-chain variable | `/hands the notify sink a value/` |
| D-16 bracket access | `/names ui 3 time\(s\)/` |
| AUTH-09 domain call | `/calls onDeviceCode \d+ time/` |
| AUTH-09 indirect forms | `/names onDeviceCode \d+ time\(s\), but only/` |
| AUTH-09 provider stray | `/names notifyDeviceFlowPrompt/` |
| AUTH-09 outside file | `/may name onDeviceCode or notifyDeviceFlowPrompt, but these files do too/` |

### IN-02: The stop-override cap is passed separately from the comparison that trips it

**File:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts:23, 378`, `extensions/pi-claude-marketplace/bridges/hooks/runtime.ts:12, 179`
**Issue:** Unchanged. The runtime compares
`consecutiveBlockCount >= STOP_OVERRIDE_CAP` inside `recordStopReentry`.
Settle imports the same constant separately and passes it to
`notifyStopHookOverrideCap`. The warning's number matches the real threshold
only because both read the same module constant. A runtime fake, or a future
per-runtime cap, could trip at one count while the warning states another.
**Fix:** Return the cap on the transition, as
`{ reenter: false, notifyCap: true, cap: STOP_OVERRIDE_CAP }`, and have settle
pass `transition.cap`.

### IN-03: AUTH-09 has lexical limits its header does not state, and one scan is vacuous

**File:** `tests/architecture/no-credential-leak.test.ts:174-182, 509-552`
**Issue:** Unchanged.

1. `ALLOWED_DEVICE_CODE_CALL` trusts the identifier `deviceCode`. A shadowed
   `const deviceCode = { ..., user_code: r.accessToken }` followed by the
   sanctioned call shape passes every clause. So does a template-key access,
   ``opts[`onDevice${'Code'}`](...)``. The comment at lines 176-179 says that
   "neither a token field, a variable, nor a spread object can reach the
   callback". The shadowed binding is a counterexample.
2. The add/update scan (lines 509-552) matches `ctx.ui.notify(` template
   literals. IL-2 already forbids that call form in those files, and it was
   absent at the diff base. So the scan cannot fire, and it has no vacuity
   check. This was already true at the diff base.

**Fix:**

- (1) Add "lexical: a shadowed `deviceCode` binding or a computed key is not
  detected" to the comment. Optionally, require exactly one
  `\bdeviceCode\s*=` binding.
- (2) Retarget the scan at the exported raw helpers that take free text
  (`notifyUsageInfo(`, `notifyDiagnostic(`, `notifyAsyncRewakeSummary(`).
  Or delete the `ctx.ui.notify` half and say that IL-2's ESLint and fallow
  bans cover it.

### IN-04: The D-16 mention clauses do not count the formatter names, so a shadowed formatter reaches the sink

**File:** `tests/architecture/presentation-sink.test.ts:41-51, 164-181`
**Issue:** The new clauses count `ui` and `deliver` but not
`formatEnvelopeArguments` or `formatRawSurface`. The pattern clause and
`formatterDeliverCalls` accept any token spelled `formatRawSurface(`, so a
local binding with that name gets past them. I planted this probe in a copy
of the dispatch module:

```ts
function leak(ctx: NotificationContext, m: { cause: Error }): void {
  const formatRawSurface = (_x: unknown): NotifyArguments => [m.cause.message];
  deliver(ctx, formatRawSurface(0));
}
```

It passed every clause. The pattern clause sees a direct formatter call. The
`deliver` mention count is 4, and the allowed count is also 4, so they match.
There are no `ui` mentions and no literals, and the grammar import is still
present. ESLint does not catch it either, because `eslint.config.js` does not
enable `no-shadow`.

This differs from the documented "Limit". That Limit covers a *body variable*
passed to a real formatter. Here, the formatter itself is replaced. The probe
is contrived, and nothing in the module does this today. That puts it in the
same class as IN-03(1), so it is Info.

Two other lexical forms also passed, and both are more contrived: a
unicode-escaped identifier (`ctx.ui.notify.call(...)`) and reflective
access (`Object.values(ctx)`). One further nit: the two presence asserts at
lines 189 and 194 accept only a plain identifier as the context
(`[\w$]*`). The pattern clause and `formatterDeliverCalls` also accept a
member chain such as `this.ctx` (`[\w$.]*`). This mismatch fails closed, so it
only causes a false rejection if `deliver` is ever called with a member-chain
context.

**Fix:** Count formatter mentions the same way. In the stripped module, each
formatter name appears exactly twice today: the import and one `deliver` call.

```ts
for (const name of ["formatEnvelopeArguments", "formatRawSurface"] as const) {
  const mentions = [...stripped.matchAll(new RegExp(`\\b${name}\\b`, "g"))].length;
  const calls = [...stripped.matchAll(
    new RegExp(`\\bdeliver\\(\\s*[A-Za-z_$][\\w$.]*\\s*,\\s*${name}\\(`, "g"))].length;
  assert.strictEqual(mentions, 1 + calls,
    `D-16: ${SINK_FILE} names ${name} ${mentions} time(s); only its import and ${calls} deliver call(s) may.`);
}
```

Add the probe above as a planted offender pinned to `/names formatRawSurface 3
time\(s\)/`. Alternatively, add "lexical: a shadowed formatter binding,
unicode-escaped identifiers, and reflective property access are not detected"
to the header's "Limit" section.

---

_Reviewed: 2026-10-03T05:13:33Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
