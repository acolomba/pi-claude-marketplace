---
phase: 03-typed-raw-surfaces
reviewed: 2026-10-03T03:01:35Z
depth: standard
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
  warning: 2
  info: 2
  total: 4
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-10-03T03:01:35Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** issues_found

## Summary

Scope: `git diff 46946d89..HEAD` over the 26 listed files.

The production refactor is correct. I traced each raw surface from the call
site through `resolveRawSurface`, `formatRawSurface`, and `deliver`. Each one
produces the same text and the same argument count as the code it replaced:

- usage-error and usage-info
- diagnostic, including its empty-list no-op
- the device-flow prompt
- reconcile-aborted, using `errorMessage` semantics
- plugin-path-skipped
- the async-rewake summary, including its empty no-op
- the stop-override cap, where `STOP_OVERRIDE_CAP` is 8

Info envelopes still pass one argument, and every other emission passes two.
No references to `makeRawNotifyFn`, `NotifyFn`, `notifyFn`, or
`formatNotificationText` remain in `extensions/`, `tests/`, `scripts/`, or
`docs/`. The re-pinned `contracts.json` positions match the current source.
The new imports form no cycle. `fallow dead-code` reports nothing for the new
exports. The six key test files pass: 281 tests, 0 failures.

Both findings concern the two architecture gates this phase added. Each gate
claims more than it enforces. I confirmed every bypass named below by running
the gate's own regexes against the bypass text
(`scratchpad/probe.mjs`). Neither gap leaks anything today. But AUTH-09 is the
only defense against a token reaching the device-flow prompt, because the type
system cannot tell a token from a user code.

## Structural Findings (fallow)

The structural pre-pass returned `fail` with 17 duplicate-block findings. All 17
are in files outside this review's scope: `scripts/check-*.mjs`,
`orchestrators/plugin/shared.ts`, and the edge handlers. The executors measured
them as inherited from the branch base. None is in a listed file or comes from
this phase's diff. Full normalized report:
`.planning/phases/03-typed-raw-surfaces/FALLOW-normalized.json`.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: The AUTH-09 device-code gate misses common call forms, so a token can reach the prompt

**File:** `tests/architecture/no-credential-leak.test.ts:158-217`
**Issue:** The gate's comment at lines 152-157 says that "neither a token field,
a variable, nor a spread object can reach the callback". Here is how
`scanDeviceCodeCalls` counts calls:

- It counts only text that matches `\bonDeviceCode\s*\(`.
- It requires every counted call to match `ALLOWED_DEVICE_CODE_CALL`.
- It requires at least one counted call.

These forms of the call give zero matches, so the gate does not see them. I
confirmed each one with the gate's regex:

```ts
opts.onDeviceCode.call(undefined, { verificationUri: deviceCode.verification_uri, userCode: r.accessToken });
opts["onDeviceCode"]({ verificationUri: deviceCode.verification_uri, userCode: r.accessToken });
const { onDeviceCode: show } = opts; show({ verificationUri: x, userCode: r.accessToken });
```

The real call at `domain/github-auth.ts:438` stays in place, so `calls > 0`
holds and `allowedCalls === calls` still passes. A token sent in any of these
forms reaches `notifyDeviceFlowPrompt` and then the UI. Type checks cannot stop
it, because `DeviceFlowPrompt.userCode` is a `string`. Two more gaps exist:

- `scanDeviceCodeCalls` reads only `GITHUB_AUTH_FILE`.
- `scanPromptBindings` counts `notifyDeviceFlowPrompt(` only in
  `PROVIDER_FILES`.

Any other production file can call the exported helper unchecked, for example
`orchestrators/marketplace/add.ts`, `update.ts`, or `install-outcome.ts`:
`notifyDeviceFlowPrompt(ctx, { verificationUri: url, userCode: cred.password })`.
The add/update test at line 499 still scans for `ctx.ui.notify(` literals. IL-2
forbids that call form in those files, so that scan can never find anything.

**Fix:**

1. Count every mention of the callback, not only the call form, and require
   that the only non-declaration mention is the allowed call:

   ```ts
   const mentions = [...stripped.matchAll(/\bonDeviceCode\b/g)].length;
   // exactly: 1 interface member + N allowed calls
   assert.strictEqual(mentions, 1 + allowedCalls, "AUTH-09: onDeviceCode is referenced outside the allowed call form");
   ```

2. Widen the `notifyDeviceFlowPrompt` scan to every file under
   `EXTENSION_ROOT_REL` except `shared/notification-dispatch.ts`. Require all
   its call sites to be the `ALLOWED_PROMPT_BINDING` in `auth-host.ts`.
3. Add planted offenders for `.call(`, for bracket access, and for a helper
   call from a non-provider orchestrator.

### WR-02: The SC-5 presentation-sink gate accepts composed text passed to the structured formatter

**File:** `tests/architecture/presentation-sink.test.ts:468-480`, `extensions/pi-claude-marketplace/shared/notification-dispatch.ts:90-91, 277-289`
**Issue:** The gate's header (lines 19-25) says that "a composed template, a
pre-composed tuple, or a variable reaching the sink is a violation". But the
gate only checks that `deliver` gets a direct `formatEnvelopeArguments(` or
`formatRawSurface(` call. It never looks at what goes into those calls.

`deliver(ctx, formatEnvelopeArguments(envelope, \`composed ${x}\`))` passes
both patterns and the placement clause. I confirmed this with the gate's
regexes. The dispatch module already sends English sentences to the sink this
way. `emitWithSummary(ctx, resolveEnvelope(message), body)` receives the
following bodies:

- `` `Nothing to prune in ${message.scope} scope: ...` `` (prune-empty, line 284)
- `` `Prune committed in ${message.scope} scope.\n  ${causeChainTrailer(...)}` `` (line 289)
- `"Pending: next reload will apply 0 actions."` (line 278)

TEXT-01, now marked Complete, says text is "a pure formatter of the model".
SC-5 says "No output surface hands the text sink a pre-composed string".
Neither claim holds for these three kinds, and the D-16 gate cannot detect the
gap. These composition sites are older than this phase. The gate and the
requirement checkbox are new.

The patterns also miss lexical variants:

- `deliver(this.ctx, …)` and `deliver(ctx.inner, …)`: pattern 2 requires a
  bare identifier.
- `ctx.ui["notify"](…)`

**Fix:** Do one of these:

- (a) Move the three body sentences into `notification-grammar.ts`, for
  example as `renderPruneEmpty(scope)`, `renderPruneCommitted(...)`, and
  `renderPendingEmpty(...)`. Then extend the gate to forbid template literals
  and string literals in the dispatch module outside comments, with an
  allow-list for the remaining literals.
- (b) Narrow the gate's header and the SC-5/TEXT-01 wording to "the sink
  receives only formatter output". Record the three structured bodies as
  carried debt in ROADMAP so Phase 4's JSON strategy does not inherit the
  overclaim.

Whichever you choose, add a planted offender of the form
`deliver(ctx, formatEnvelopeArguments(envelope, \`x\`));`. Then the gate's
documented guarantee has a test, or its documented limit does.

## Info

### IN-01: Planted controls accept any assertion of the scan, not the clause they target

**File:** `tests/architecture/no-credential-leak.test.ts:377`, `tests/architecture/presentation-sink.test.ts:580`
**Issue:** The planted-offender controls use `rejection: /AUTH-09/` and
`rejection: /D-16/`. Every assertion in each scan matches these patterns,
including the "zero calls exist" vacuity messages, the import check, and the
placement check. The benign control proves that the planted line causes a
rejection. It does not prove which clause rejected the line. For example, the
presentation-sink header says "only the placement clause can reject" the third
offender (line 37), but no test pins that.
**Fix:** Give each offender its own expected-message regex. For example, use
`/AUTH-09 violation: .* calls onDeviceCode/` for the domain offenders and
`/notify call\(s\); exactly the two inside deliver/` for the third sink
offender.

### IN-02: The stop-override cap is passed separately from the comparison that trips it

**File:** `extensions/pi-claude-marketplace/bridges/hooks/settle.ts:378`, `extensions/pi-claude-marketplace/bridges/hooks/runtime.ts:12,179`
**Issue:** The runtime compares `consecutiveBlockCount >= STOP_OVERRIDE_CAP`
inside `recordStopReentry`. Settle then imports the same constant on its own
and passes it to `notifyStopHookOverrideCap`. The warning's number and the
real threshold are linked only because both read one module constant. A
runtime fake or a future per-runtime cap could trip at one count while the
warning states another. `notifyStopHookOverrideCap(ctx, id, cap)` also accepts
any `number`.
**Fix:** Return the cap on the transition, as `{ reenter: false, notifyCap:
true, cap: STOP_OVERRIDE_CAP }`. Have settle pass `transition.cap`, so the
warning reports the value the comparison used. `STOP_OVERRIDE_CAP` can then
stay private to `runtime.ts`, except for the catalog byte-pin test.

---

_Reviewed: 2026-10-03T03:01:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
