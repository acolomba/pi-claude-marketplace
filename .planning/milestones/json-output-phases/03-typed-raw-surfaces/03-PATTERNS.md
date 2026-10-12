# Phase 3: Typed Raw Surfaces - Pattern Map

**Mapped:** 2026-10-02
**Files analyzed:** 20
**Analogs found:** 19 / 20

All paths are relative to the repo root. `E` = `extensions/pi-claude-marketplace`.
All analogs are git-tracked source.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
| --- | --- | --- | --- | --- |
| `E/shared/notification-types.ts` (append raw kinds after line 992) | model | transform | same file, `PruneCommittedWarningMessage` / `MarketplaceNotAddedMessage` (:958-971), `NotificationMessage` union (:979-992) | exact |
| `E/shared/notification-resolve.ts` (+ `resolveRawSurface`) | utility (resolve) | transform | same file, `resolveNotAddedReason` (:524-533); `errorMessage` import (:3) | exact |
| `E/shared/notification-grammar.ts` (+ `NotifyArguments`, `formatRawSurface`, envelope-arity fn) | utility (text strategy) | transform | same file, `formatNotificationText` (:1075-1084) | exact |
| `E/shared/notification-dispatch.ts` (private `deliver` sink, helpers become kind constructors, delete `makeRawNotifyFn`) | service (sink) | request-response | same file, `emitWithSummary` (:82-89) and helpers (:100-193, :335-345) | exact |
| `E/bridges/hooks/runtime.ts` (export `STOP_OVERRIDE_CAP`) | config | n/a | same file :8 | exact |
| `E/bridges/hooks/settle.ts` (pass cap) | bridge | event-driven | same file :377-379 | exact |
| `E/bridges/hooks/async-rewake/registry.ts` (:434, call unchanged) | bridge | event-driven | unchanged call | exact |
| `E/domain/github-auth.ts` (`NotifyFn` -> `onDeviceCode`) | domain | request-response (callback) | same file :110-126, :434-436 | exact |
| `E/orchestrators/auth-host.ts` (bind `onDeviceCode`) | orchestrator | request-response | same file :182, :195 | exact |
| `E/index.ts` (:142, :163 to new helpers) | entry | event-driven | same file :135-170 | exact |
| `E/edge/handlers/plugin/help.ts` (unchanged) | controller | request-response | n/a | exact |
| `tests/shared/notification-dispatch.test.ts` | test | n/a | same file :5714-5756 | exact |
| `tests/shared/notification-grammar.test.ts` (+ D-15 arity rows, raw formatting) | test | n/a | same file :1297-1450 (`formatNotificationText` cases) | exact |
| `tests/shared/notification-resolve.test.ts` (+ `resolveRawSurface`) | test | n/a | same file (resolve cases) | exact |
| `tests/domain/github-auth.test.ts`, `tests/domain/device-flow-contract.ts`, `tests/domain/device-flow-fake.test.ts` | test / shared test support | n/a | existing `notifyFn:` sites (23) and `notifications` recorder (`device-flow-contract.ts:106-125`) | exact |
| `tests/integration/auth-e2e.test.ts` (:30, :132) | test | n/a | same file | exact |
| `tests/architecture/hooks-cap-notify.test.ts` (pass cap) | test (arch) | n/a | same file :22 | exact |
| `tests/architecture/no-credential-leak.test.ts` (retarget AUTH-09 + planted controls) | test (arch gate) | file-I/O scan | `tests/architecture/no-orchestrator-network.test.ts` :85-160 | role-match |
| `tests/architecture/<presentation-sink>.test.ts` (NEW, D-16) + group in `tests/architecture/gate-targets.ts` | test (arch gate) | file-I/O scan | `tests/architecture/no-orchestrator-network.test.ts`; `gate-targets.ts` :38, :157 | exact |
| `.planning/phases/03-typed-raw-surfaces/03-CORPUS-CHANGES.json` | ledger | n/a | `.planning/phases/02-row-policies/02-CORPUS-CHANGES.json` (format only; removals have no precedent) | partial |

## Pattern Assignments

### `E/shared/notification-types.ts` (model)

**Analog:** same file, :958-992. Small readonly kind interface, one JSDoc line, live `cause`:

```typescript
/** Scope-wide warning after a standalone prune state save succeeded. */
export interface PruneCommittedWarningMessage {
  readonly kind: "prune-committed-warning";
  readonly scope: Scope;
  readonly cause: Error;
}
...
/** Complete discriminated union accepted by the notification dispatcher. */
export type NotificationMessage =
  | CascadeNotificationMessage
  ...
  | ReconcileAppliedCascadeMessage;
```

Apply:
- Append after line 992 so the `:647` type-member pin stays put.
- Use three separate unions (D-14), e.g. `CommandRawSurface` (`usage-error`, `usage-info`, `diagnostic`, `device-flow-prompt`), `HookSurface` (`async-rewake-summary`, `stop-override-cap`), and `LoadSurface` (`reconcile-aborted`, `plugin-path-skipped`). Do not add them to `NotificationMessage` (D-01).
- `reconcile-aborted.cause: unknown`, because `index.ts` catches non-`Error` throws. This differs from the prune `cause: Error`.
- `plugin-path-skipped` uses `scope: Scope` (`shared/types.ts:16`). It must not import `SkippedPathScope` from orchestrators.
- Declare `DeviceFlowPrompt { readonly verificationUri: string; readonly userCode: string }` once here. The kind extends it, and the domain imports it as a type.
- `UsageErrorMessage` (:319) already exists. Reuse it, and either give it `kind` or wrap it.

### `E/shared/notification-resolve.ts` (resolve)

**Analog:** :3 and :524-533.

```typescript
import { errorMessage, manualRecoveryLeaks, serializeCauseChain } from "./errors.ts";
...
export function resolveNotAddedReason(message: MarketplaceNotAddedMessage): Reason {
  if (message.presentInOtherScope !== true || message.scope === undefined) {
    return "marketplace not added";
  }
  ...
}
```

Apply: `resolveRawSurface(surface)` uses `switch (surface.kind)`. Only `reconcile-aborted` changes: `cause` becomes `errorMessage(cause)`. Build the resolved type with `Exclude<..., ReconcileAbortedMessage> | ResolvedReconcileAborted`, never an object-literal `Extract` (that creates type-selection pins).

### `E/shared/notification-grammar.ts` (text strategy)

**Analog:** `formatNotificationText` :1068-1084. JSDoc states the byte contract, and the function is pure.

```typescript
export function formatNotificationText(envelope: ResolvedEnvelope, body: string): string {
  const folded = [ body, envelope.noOp ? UPDATE_NO_OP_HEADLINE : tallySentence(envelope.tally),
    envelope.needsReload ? RELOAD_HINT_TRAILER : "" ]
    .filter((segment) => segment !== "")
    .join("\n\n");

  return envelope.severity === "info" ? folded : `${envelope.summary}\n\n${folded}`;
}
```

Add:
- `export type NotifyArguments = readonly [text: string] | readonly [text: string, severity: Severity];`
- An envelope-arity wrapper that moves dispatch :84-88 (info gives a 1-tuple, otherwise a 2-tuple).
- `formatRawSurface(resolved): NotifyArguments | undefined`. Each raw arm returns a 2-tuple, and an empty diagnostic or summary returns `undefined`. Verbatim bytes:

| kind | text | severity |
| --- | --- | --- |
| usage-error | `` `${message}\n\n${usage}` `` | error |
| usage-info | `usage` | info |
| diagnostic | `` `${header}\n\n${lines.join("\n")}` ``, `lines.length === 0` returns undefined | warning |
| async-rewake-summary | `summary`, empty returns undefined | info |
| stop-override-cap | `` `Stop hook override cap reached.\n\n\`${pluginId}\`'s Stop hook blocked ${cap} times in a row; the turn ended despite its active block.` `` | warning |
| device-flow-prompt | `` `Open ${verificationUri} and enter: ${userCode}` `` | info |
| reconcile-aborted | `` `reconcile aborted: ${message}` `` | error |
| plugin-path-skipped | `` `plugin PATH not refreshed for ${scope} scope (install state unreadable): ${reason}` `` | warning |

Keep a production importer for `formatNotificationText` (the wrapper calls it inside grammar, and dispatch imports the wrapper). If it loses its only cross-module reader, un-export it and move its tests.

### `E/shared/notification-dispatch.ts` (sink)

**Analog:** :82-89, the current sink shape that `deliver` replaces:

```typescript
function emitWithSummary(ctx: NotificationContext, envelope: ResolvedEnvelope, body: string): void {
  const text = formatNotificationText(envelope, body);
  if (envelope.severity === "info") {
    ctx.ui.notify(text);
  } else {
    ctx.ui.notify(text, envelope.severity);
  }
}
```

Current helpers to convert. Signatures stay, except the cap helper gains `cap`:

```typescript
export function notifyUsageError(ctx: NotificationContext, message: UsageErrorMessage): void {
  ctx.ui.notify(`${message.message}\n\n${message.usage}`, "error");
}
export function notifyUsageInfo(ctx: NotificationContext, usage: string): void { ... }          // :107
export function notifyDiagnostic(ctx, header: string, lines: readonly string[]): void { ... }   // :130
export function notifyAsyncRewakeSummary(ctx, summary: string): void { ... }                     // :155
export function notifyStopHookOverrideCap(ctx, pluginId: string): void { ... }                   // :188 -> (ctx, pluginId, cap)
export function makeRawNotifyFn(ctx) { ... }                                                     // :335-345 DELETE
```

Rules:
- Exactly two `ctx.ui.notify(` spellings may exist in the file: `ctx.ui.notify(args[0])` and `ctx.ui.notify(args[0], args[1])`, both inside `deliver`.
- No `ui.notify(` may appear anywhere else in extension source, including comments and string literals. The corpus hook counts raw text (`scripts/notify-corpus.hook.mjs:33,66-74`). Rewrite the JSDoc prose at :122-129, :148, :182, and :329-331 that names `ctx.ui.notify`.
- Group entries (`emitCommandRawSurface` / `emitHookSurface` / `emitLoadSurface`) are file-private, so the census stays empty.
- Remove the duplicated-`8` rationale from the cap JSDoc (:183-186), because the cap now arrives as data (D-07).
- The `dispatchInfoMessage` pin at `:204` shifts. Re-pin by changing the line only, after Prettier.

### `E/bridges/hooks/runtime.ts` + `settle.ts`

`runtime.ts:8`: `const STOP_OVERRIDE_CAP = 8;` becomes `export const`. In `settle.ts:27`, change `import type { HooksRuntime } from "./runtime.ts";` to a mixed import that adds the value. At :377-379:

```typescript
  if (transition.notifyCap) {
    notifyStopHookOverrideCap(ctx, pluginId);   // -> (ctx, pluginId, STOP_OVERRIDE_CAP)
  }
```

### `E/domain/github-auth.ts`

**Current** :110-123 and :434-436:

```typescript
export type NotifyFn = (message: string, severity?: "info" | "warning" | "error") => void;
export interface InitiateDeviceFlowOpts {
  ...
  /** Pre-bound ctx.ui.notify callback per D-32-04. */
  notifyFn: NotifyFn;
...
  // AUTH-03 + AUTH-09: ONLY user_code + verification_uri interpolated.
  opts.notifyFn(`Open ${deviceCode.verification_uri} and enter: ${deviceCode.user_code}`, "info");
```

Target:
- `onDeviceCode: (prompt: DeviceFlowPrompt) => void;` with `import type { DeviceFlowPrompt } from "../shared/notification-types.ts";`.
- The call is exactly `opts.onDeviceCode({ verificationUri: deviceCode.verification_uri, userCode: deviceCode.user_code });`. The AUTH-09 allow-list regex keys on this form.
- Delete `NotifyFn` with its JSDoc. The JSDoc names `ctx.ui.notify`, and the corpus hook counts that text in every extension module.

### `E/orchestrators/auth-host.ts`

:182 `const notifyFn = makeRawNotifyFn(ctx);` and :195 `notifyFn,` become `onDeviceCode: (prompt) => { notifyDeviceFlowPrompt(ctx, prompt); },`. Update the import from `../shared/notification-dispatch.ts`.

### `E/index.ts`

:142 `makeRawNotifyFn(ctx)(\`reconcile aborted: ${errorMessage(err)}\`, "error");` becomes `notifyReconcileAborted(ctx, err);`.
:163-166 becomes `notifyPluginPathSkipped(ctx, skip);`. The helper reads `skip.scope` and `skip.reason` explicitly, which keeps `SkippedPathScope`'s members read.
Keep both NFR-2 inner try/catch plus `hookDebugLog` blocks unchanged. Drop the `errorMessage` import if it becomes unused (the `notifyErr` debug lines still use it).

### `tests/shared/notification-dispatch.test.ts`

**Analog:** :5714-5726 (one helper, one case, exact tuple):

```typescript
test("stop override dispatch preserves exact warning bytes", (t) => {
  // arrange
  const ctx = createContext(t);

  // act
  notifyStopHookOverrideCap(ctx as never, "official:guard");

  // assert
  assert.deepStrictEqual(ctx.ui.notify.mock.calls[0]!.arguments, [
    "Stop hook override cap reached.\n\n`official:guard`'s Stop hook blocked 8 times in a row; the turn ended despite its active block.",
    "warning",
  ]);
});
```

- Add `8` as the cap argument. The bytes stay identical, so the corpus entry is unchanged.
- Delete the `makeRawNotifyFn` case (:5742-5756). This removes corpus entries `["plain"]` and `["failed","error"]` (D-17).
- Add one case each for `notifyDeviceFlowPrompt`, `notifyReconcileAborted`, and `notifyPluginPathSkipped`. These are the ledgered extras, so keep them minimal. Put the per-arm formatting and the D-15 arity rows in the grammar test, which emits nothing.

### `tests/shared/notification-grammar.test.ts` (D-15)

Use one `test()` per raw kind. Type the rows with `satisfies Record<RawSurface["kind"], Row>`. Each row is an independently written literal tuple, for example `["reconcile aborted: boom", "error"]`. Add one case proving that an info envelope gives a 1-tuple.

### `tests/architecture/<presentation-sink>.test.ts` (NEW, D-16)

**Analog:** `tests/architecture/no-orchestrator-network.test.ts`. Imports :7-10 (`materializeTargets, plantBenignNearMiss, plantOffender, withTempRoot` from `./temp-root-control.ts`), and the cases at :85-160:

```typescript
test("NFR-5 + ...: network-free orchestrators have zero gitOps surface", async () => {
  // act
  const report = await assertNoForbiddenSurface(NETWORK_FREE_TARGETS, FORBIDDEN_PATTERNS, describeNetworkViolation);
  // assert
  assert.ok(NETWORK_FREE_TARGETS.length > 0, "D-07-03: an empty target group ...");
  assert.deepEqual(report.visited, [...NETWORK_FREE_TARGETS], "D-07-03: ...");
});

test("NFR-5: the gate fires on a gitOps surface planted in a copy of a real target", async () => {
  await withTempRoot("network-gate-offender-", async (root) => {
    // arrange
    await materializeTargets(root, NETWORK_FREE_TARGETS);
    await plantOffender(root, NETWORK_FREE_CONTROL_TARGET, "const gitOps = DEFAULT_GIT_OPS;");
    // act & assert
    await assert.rejects(() => assertNoForbiddenSurface(..., { root }), /gitOps surface detected .../);
  });
});
// + benign (:130) and comment near-miss via plantBenignNearMiss (:149-153)
```

- Targets come from a new `gate-targets.ts` group. Copy the shape at `gate-targets.ts:38` (`NETWORK_FREE_TARGETS = [...] as const`) and the control-target export at :157. Spell the full path literal there, never in the gate file (D-07-06).
- Patterns and the positive count of exactly two `ui.notify(` occurrences follow RESEARCH "D-16 sink gate". Use `stripComments` from `source-scan.ts:57` for the count.
- Plant two offenders: a direct `ctx.ui.notify(\`x\`, "info")` and `deliver(ctx, [\`pre-composed\`, "info"])`.
- Run `npx fallow dupes` before committing, because the offender, benign, and near-miss trio is clone-prone.

### `tests/architecture/no-credential-leak.test.ts` (AUTH-09 retarget)

**Current vacuity point** :160-166:

```typescript
/** The `new Error(\`...\`)` / `notifyFn(\`...\`)` call forms. */
const ERROR_OR_NOTIFY_FN_LITERAL_CALL_SITE =
  /(?:new\s+Error\s*\(|notifyFn\s*\()\s*(`(?:[^`\\]|\\.)*`)/g;
```

The same `notifyFn\s*\(` form also appears at :230-231 and :372-373. Keep `CREDENTIAL_IN_LITERAL` (:134-135) and `assertNoCredentialInLiterals` (:148).
- Add a positive `onDeviceCode\s*\(` count (at least 1).
- Add the exact-form allow-list, under which every call site must match `\.onDeviceCode\(\s*\{\s*verificationUri:\s*deviceCode\.verification_uri,\s*userCode:\s*deviceCode\.user_code,?\s*\}\s*\)`.
- Scan the `auth-host.ts` binding.
- The scans read `REPO_ROOT` directly today, so give them a `root` parameter first. Then add planted controls with the `temp-root-control.ts` helpers, as in the sink gate above.

### `03-CORPUS-CHANGES.json`

**Analog format:** `.planning/phases/02-row-policies/02-CORPUS-CHANGES.json`. It is an array of `{line, file, before:{message,severity,argc}, after:{...}, multiplicity, test, preserves}`. Removals use `before` only (or `after: null`). Additions use `after` only. Phase 2 has no precedent for either, so state the chosen shape in the plan.

## Shared Patterns

### Single sink, IL-2
**Source:** `E/shared/notification-dispatch.ts:82-89`. ESLint exempts only this file (`eslint.config.js:141`, :152-154). Every new helper ends in `deliver(ctx, formatX(resolveX(kind)))`.

### Test structure
**Source:** `tests/shared/notification-dispatch.test.ts:5714-5726`. Each test uses `createContext(t)` with `// arrange` / `// act` / `// assert`, and asserts the exact `ctx.ui.notify.mock.calls[i].arguments` tuple. Expected strings are literals, never produced by the formatter.

### Architecture gate
**Sources:** `tests/architecture/source-scan.ts:93` (`assertNoForbiddenSurface(targets, patterns, describe, { root })`) and `tests/architecture/temp-root-control.ts:46,66,116,127`. Every gate has four parts:
- a non-vacuity count
- a `visited` deep-equal check (D-07-03)
- an offender case
- benign and near-miss cases

### Comments
Comments cite D-NN, AUTH-09, NFR-2, RAWS-0N, and STOP-07. They name no phase, plan, or `Pitfall N`.

## No Analog Found

| File | Role | Reason |
| --- | --- | --- |
| `03-CORPUS-CHANGES.json` removal/addition entries | ledger | The Phase 2 ledger has only before/after rewrites. Removal-only and addition-only entry shapes are new. |

## Metadata

**Analog search scope:** `E/shared`, `E/domain`, `E/orchestrators/auth-host.ts`, `E/index.ts`, `E/bridges/hooks`, `tests/architecture`, `tests/shared`, `.planning/phases/02-row-policies`
**Files scanned:** ~14
**Pattern extraction date:** 2026-10-02
