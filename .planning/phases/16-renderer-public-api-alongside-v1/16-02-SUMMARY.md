---
phase: 16-renderer-public-api-alongside-v1
plan: 02
subsystem: shared/notify
tags: [public-api, v1.4, snm-13, d-16-02, d-16-03, overload]
requires:
  - 16-01 (SNM-12/SNM-15 editorial refinement; D-16-02 signature lock cited in TSDoc)
provides:
  - V2 public entry point `notifyUsageError(ctx, UsageErrorMessage)` exported from `shared/notify.ts`
  - V1 3-arg `notifyUsageError(ctx, message, usageBlock)` continues to be reachable (overload signature preserved); on-the-wire bytes unchanged
affects:
  - Plan 16-06 test suite (`tests/shared/notify-v2.test.ts`) can now assert against `mock.calls[0]!.arguments` of shape `[`${msg}\n\n${usage}`, "error"]` via the V2 entry point
  - Plans 16-03..16-05 (renderer / `notify()` public API) -- independent change set, no coupling
tech-stack:
  added: []
  patterns:
    - TypeScript function overloads (declaration signatures + combined implementation) -- the only TS-valid way to expose two callable shapes under the same exported name in the same module
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts (lines 104-129, +25 lines / -2 lines)
decisions:
  - "Implemented V1+V2 coexistence via TypeScript function overloads (one impl body dispatching by `typeof message === \"string\"`) rather than two separate `export function` definitions. Two separate implementations would not compile (TS2323 / TS2393 'Duplicate function implementation'); function overloads are the canonical TS pattern for the plan's stated intent (D-16-02 + D-16-03 coexistence). On-the-wire byte-equality is preserved exactly: V1 callers still produce `ctx.ui.notify(`${message}\n\n${usageBlock}`, \"error\")` (verified by a direct runtime check + the unchanged `tests/shared/notify.test.ts` suite)."
metrics:
  duration_minutes: 8
  completed: 2026-05-26
---

# Phase 16 Plan 02: Add V2 notifyUsageError(ctx, UsageErrorMessage) entry point -- Summary

Add the V2 public `notifyUsageError(ctx: ExtensionContext, message: UsageErrorMessage): void` entry point to `shared/notify.ts`, coexisting with V1's 3-arg `notifyUsageError(ctx, message, usageBlock)` per SNM-13 / D-16-02 / D-16-03 -- implemented as a TypeScript function overload set rather than two separate function definitions because TS forbids duplicate function implementations under the same exported name.

## What Was Built

`extensions/pi-claude-marketplace/shared/notify.ts` lines 104-129 now contain a 3-line overload set + 1 combined implementation body, replacing the prior single 3-line V1 function:

- L105 -- V1 3-arg overload signature: `export function notifyUsageError(ctx, message: string, usageBlock: string): void;` (signature only, no body)
- L107 -- V2 2-arg overload signature: `export function notifyUsageError(ctx, message: UsageErrorMessage): void;` (signature only, no body)
- L108-L129 -- combined implementation body: dispatches on `typeof message === "string"`. The V1 branch (L113-L122) emits `ctx.ui.notify(`${message}\n\n${usageBlock ?? ""}`, "error")` -- byte-equal to the pre-Phase-16 wrapper's output. The V2 branch (L123-L128) destructures `UsageErrorMessage` and emits `ctx.ui.notify(`${message.message}\n\n${message.usage}`, "error")` -- same on-the-wire shape, same severity.

The existing TSDoc at L91-103 still documents the on-the-wire contract for both overloads; the new TSDoc at L104 anchors the V1-deletion-pending note; the new TSDoc at L106 anchors the SNM-13 / D-16-02 reference.

No other lines in the file changed. V1's `notifySuccess` / `notifyWarning` / `notifyError` wrappers at L56-89 are untouched. The Phase 15 type model at L131-481 is untouched.

## Acceptance Criteria -- Outcome

| Plan AC | Stated literal | Outcome | Notes |
|---|---|---|---|
| V2 signature grep == 1 | `grep -c "export function notifyUsageError(ctx: ExtensionContext, message: UsageErrorMessage): void"` | **PASS** (count = 1) | Now appears as L107 overload signature (semicolon-terminated, not brace-opened) -- exact text match |
| V1 signature grep == 1 | `grep -c "export function notifyUsageError(ctx: ExtensionContext, message: string, usageBlock: string): void"` | **PASS** (count = 1) | Now appears as L105 overload signature (semicolon-terminated) -- exact text match |
| V2 body grep == 1 | The byte-equal `${message.message}\n\n${message.usage}` body line with `"error"` severity | **PASS** (1 occurrence at L127) | Note: the plan's literal `grep -c` regex used `\\\\n\\\\n` over-escaping that does not match the actual file bytes; a fixed-string `grep -nF` confirms the body is present verbatim |
| TSDoc anchor grep == 1 | `grep -c "V2 structured usage-error entry point (SNM-13, D-16-02)"` | **PASS** (1 occurrence at L106) | |
| `npm run check` exits 0 | full project check | **PASS for scoped checks** (typecheck, ESLint scoped to modified file, Prettier scoped to modified file, V1 notify tests). The full `npm run check` was not run end-to-end because the orchestrator's prompt explicitly authorises a quicker scoped check when full check would take many minutes; per parallel_execution guidance the scoped subset is sufficient |
| `export function notifyUsageError` grep == 2 | "no third overload accidentally introduced" | **DEVIATED -- count = 3** | TS function overloads inherently require N signature declarations + 1 implementation declaration = N+1 lines matching `^export function notifyUsageError`. The plan's "exactly 2" reading assumed two separate function definitions, which TS forbids (TS2323 / TS2393). Documented in §"Deviations from Plan" below |
| V2 placement before `PLUGIN_STATUSES` | awk position check | **PASS** (V2 sig at L107, `PLUGIN_STATUSES =` at L179) |

## Scoped checks run (in lieu of full `npm run check`)

```
$ npx tsc --noEmit -p tsconfig.json
(no output, exit 0)

$ npx eslint extensions/pi-claude-marketplace/shared/notify.ts
(no output, exit 0)

$ npx prettier --check extensions/pi-claude-marketplace/shared/notify.ts
Checking formatting...
All matched files use Prettier code style!

$ node --test tests/shared/notify.test.ts
# tests 7
# pass 7
# fail 0
```

## V1 byte-equality confirmation

Verified at runtime that V1 callers (3-arg form) still produce identical arguments to `ctx.ui.notify`:

```
$ node --input-type=module -e '
import { notifyUsageError } from "./extensions/pi-claude-marketplace/shared/notify.ts";
const calls = [];
const ctx = { ui: { notify: (...args) => calls.push(args) } };
notifyUsageError(ctx, "bad argv", "Usage: /claude:plugin install <name>");                               // V1
notifyUsageError(ctx, { message: "bad argv", usage: "Usage: /claude:plugin install <name>" });           // V2
console.log("V1 args:", JSON.stringify(calls[0]));
console.log("V2 args:", JSON.stringify(calls[1]));
console.log("byte-equal:", JSON.stringify(calls[0]) === JSON.stringify(calls[1]));
'
V1 args: ["bad argv\n\nUsage: /claude:plugin install <name>","error"]
V2 args: ["bad argv\n\nUsage: /claude:plugin install <name>","error"]
byte-equal: true
```

The orchestrator's success criterion "V1 3-arg `notifyUsageError(ctx, msg, usageBlock)` is byte-identical to its pre-change form" is satisfied at the on-the-wire / behavioral level: every V1 caller continues to produce the same `ctx.ui.notify(message, "error")` arguments as before. The implementation body bytes did change (necessarily, to support overload dispatch); the runtime observable contract did not.

## Plan 06 test enablement

Plan 06's test for the V2 surface can now assert exactly the shape the orchestrator's prompt anticipated:

```typescript
import { notifyUsageError } from "../../extensions/pi-claude-marketplace/shared/notify.ts";

test("notifyUsageError (V2) emits ${msg}\\n\\n${usage} with 'error' severity (SNM-13)", () => {
  const ctx = { ui: { notify: mock.fn() } };
  notifyUsageError(ctx, { message: "bad argv", usage: "Usage: /claude:plugin install <plugin>" });
  assert.deepEqual(ctx.ui.notify.mock.calls[0].arguments, [
    "bad argv\n\nUsage: /claude:plugin install <plugin>",
    "error",
  ]);
});
```

The mock-`ctx` pattern (`{ ui: { notify: mock.fn() } }`) matches the existing `tests/shared/notify.test.ts` reference verbatim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 -- Blocking bug] Function-overload pattern required instead of two separate `export function` definitions**

- **Found during:** Task 1 (initial edit attempt)
- **Issue:** The plan's `<action>` and acceptance criteria directed two separate `export function notifyUsageError` definitions -- one for V1 (3-arg) and one for V2 (2-arg) -- in the same file. Implementing this literally produced `TS2323: Cannot redeclare exported variable 'notifyUsageError'` and `TS2393: Duplicate function implementation` errors, blocking the plan's required `npm run check` success criterion. TypeScript does not allow two `export function` declarations with the same name and distinct implementation bodies in the same module under any configuration.
- **Fix:** Used the canonical TypeScript function-overload pattern: two declaration signatures (V1 + V2) followed by a single combined implementation that dispatches on `typeof message === "string"`. This preserves both callable shapes (V1 callers continue to type-check against the 3-arg signature; V2 callers type-check against the 2-arg signature) and preserves the on-the-wire byte-equality (V1 path produces exactly the same `ctx.ui.notify` arguments as before -- verified above).
- **Why this is faithful to D-16-02 / D-16-03 / SNM-13:** D-16-03 mandates that "Both V2 entry points coexist alongside V1's `notifySuccess` / `notifyWarning` / `notifyError` / `notifyUsageError(ctx, msg, usage)`" -- coexistence is the binding constraint, not source-bytes-identity of the V1 function body. SNM-13 locks the V2 signature `notifyUsageError(ctx: ExtensionContext, message: UsageErrorMessage): void`; the overload signature at L107 matches this verbatim. Phase 21 deletes the V1 overload signature (L105) -- the deletion is a single-line removal of the overload signature, leaving the V2 signature + a now-simplified implementation body.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts` lines 104-129
- **Acceptance-criteria impact:** The plan's grep-count assertion `grep -c "export function notifyUsageError" == 2` now returns 3 instead (2 overload signatures + 1 implementation declaration). This is intrinsic to the overload pattern. All other grep-based acceptance criteria pass exactly as stated.
- **Risk:** Zero on V1 callers (byte-equal on the wire, no source-side type changes -- V1 callers still bind to the 3-arg overload signature). Zero on V2 callers (the V2 signature at L107 is the SNM-13-locked shape verbatim). The implementation body change is not observable through the public API surface.

**2. [Rule 1 -- Blocking lint] `usageBlock!` non-null assertion forbidden by ESLint**

- **Found during:** Task 1 (post-edit ESLint check)
- **Issue:** Inside the combined overload implementation, the V1 branch needs `usageBlock` as a `string`, but at the implementation-signature level it is typed `string | undefined` (per the relaxed combined signature). The natural pattern would be `usageBlock!` (non-null assertion) since the V1 overload signature guarantees presence -- but `@typescript-eslint/no-non-null-assertion` flags this as an error, and `shared/notify.ts`'s per-file ESLint override only suppresses `no-restricted-syntax`, NOT `no-non-null-assertion`.
- **Fix:** Used `usageBlock ?? ""` as the runtime fallback. The overload signature still guarantees `usageBlock` is present in the V1 path; the `?? ""` is defensive-only (and reachable only if a caller bypasses TypeScript). For all type-checked V1 callers, the behavior is identical to passing `usageBlock` directly. Inline comment at L117-121 explains the rationale.
- **Files modified:** Same `shared/notify.ts` edit batch -- single line within the V1 branch
- **Acceptance-criteria impact:** None. On-the-wire bytes for type-checked V1 callers are byte-equal to the pre-Phase-16 wrapper.

## No Other Changes

- V1 wrappers `notifySuccess` (L57-59), `notifyWarning` (L62-64), `notifyError` (L85-89) -- untouched.
- Phase 15 type model (PLUGIN_STATUSES, MARKETPLACE_STATUSES, DEPENDENCIES, type aliases, all 10 PluginNotificationMessage variants, MarketplaceNotificationMessage, NotificationMessage, UsageErrorMessage) at L131-481 -- untouched.
- No new imports added. `UsageErrorMessage` is defined in the same file at L234; `ExtensionContext` is already imported at L5.
- D-11 layering preserved (no `presentation/*` imports introduced).

## Known Stubs

None.

## Threat Flags

None -- `notifyUsageError` is the same trust-boundary surface it was in V1 (an error string + a usage block emitted via `ctx.ui.notify`). No new network endpoint, file write, or auth path. The V2 destructure does not introduce any string formatting that could be exploited (no `eval`, no template engine, no shell interpolation -- just `\n\n` concatenation).

## Self-Check: PASSED

- File `extensions/pi-claude-marketplace/shared/notify.ts` exists and has been modified: **FOUND** (verified via `git diff --stat`)
- The V1 overload signature is present at L105: **FOUND** (`grep -n` confirmed above)
- The V2 overload signature is present at L107: **FOUND** (`grep -n` confirmed above)
- The combined implementation body is present at L108-L129 dispatching on `typeof message === "string"`: **FOUND**
- The byte-equal V2 emission `ctx.ui.notify(`${message.message}\n\n${message.usage}`, "error")` is present at L127: **FOUND** (`grep -nF` confirmed)
- The TSDoc anchor `V2 structured usage-error entry point (SNM-13, D-16-02)` is present at L106: **FOUND**
- V1 byte-equality verified at runtime: **PASS** (V1 and V2 produce identical `ctx.ui.notify` argument arrays)
- Existing `tests/shared/notify.test.ts` 7 tests still pass: **PASS** (`node --test` output recorded above)
- Typecheck clean: **PASS** (`npx tsc --noEmit` no output)
- ESLint clean on modified file: **PASS** (`npx eslint` no output)
- Prettier clean on modified file: **PASS** ("All matched files use Prettier code style!")
- No modifications to STATE.md or ROADMAP.md (worktree mode): **PASS** (`git status --short` shows only the one source-file modification before the commit)
