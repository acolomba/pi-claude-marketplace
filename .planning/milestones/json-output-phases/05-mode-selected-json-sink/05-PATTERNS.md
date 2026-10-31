# Phase 5: Mode-Selected JSON Sink - Pattern Map

**Mapped:** 2026-10-06
**Scope:** Existing-file migration; no new production module is required.
**Analogs found:** 5 strong tracked analogs, plus their paired tests.

## File Classification

All paths below are relative to the repository root. Each named existing analog was checked against `git ls-files`; no install mirror is an analog. `tests/<same relative path>.test.ts` means the mirrored owner test under `tests/` for the corresponding `extensions/pi-claude-marketplace/` source. Changes to signatures may require other existing callers and owner tests; the planner should use compiler errors and current call searches to close that inventory.

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `extensions/pi-claude-marketplace/platform/pi-api.ts`; `shared/notification-run.ts`; `shared/notification-dispatch.ts` | provider; model; service | request-response; transform | themselves, especially `notification-dispatch.ts:78-107,247-253,345-376` | exact |
| `extensions/pi-claude-marketplace/edge/register.ts`; `edge/router.ts`; `edge/args-schema.ts`; `edge/handlers/shared.ts`; `edge/handlers/plugin/shared.ts`; `edge/handlers/marketplace/shared.ts`; all current `edge/handlers/plugin/{bootstrap,browse,enable-disable,fetch,help,import,info,install,list,pending,prune,reinstall,uninstall,update}.ts`; all current `edge/handlers/marketplace/{add,autoupdate,info,list,remove,update}.ts` | route; controller; utility | request-response | `edge/register.ts:133-138`; `edge/router.ts:159-264` | exact |
| `extensions/pi-claude-marketplace/orchestrators/auth-host.ts`; `orchestrators/plugin/{install-clone-probe,reinstall-clone-probe,dependency-tag-probe,fetch,info,update-preflight,install-flow,reinstall-flow,update-flow}.ts`; `orchestrators/marketplace/{add,update}.ts` | service | event-driven; request-response | `orchestrators/auth-host.ts:168-202,221-237` | exact |
| Existing diagnostics producers under `orchestrators/import/execute.ts`, `orchestrators/plugin/{prune,update-cascade,update-swap}.ts`, and their typed callers | service | event-driven | `shared/notification-dispatch.ts:153-209` | role-match |
| `extensions/pi-claude-marketplace/index.ts`; `bridges/hooks/async-rewake/registry.ts`; `bridges/hooks/settle.ts`; `bridges/hooks/event-router.ts` | provider; service | event-driven | `index.ts:90-184`; `async-rewake/registry.ts:388-455` | exact |
| `eslint.config.js`; `tests/architecture/presentation-sink.test.ts` | config; test | batch | `eslint.config.js:333-358,422-440` | exact |
| `tests/edge/notification-boundary.ts`; `tests/architecture/catalog-uat/mock-pi.ts`; `tests/shared/notification-run-seeds.ts`; JSON capture helper under existing notification test concern | test utility | event-driven; transform | `tests/edge/notification-boundary.ts:65-95`; `tests/architecture/catalog-uat/catalog-wire.test.ts:23-82` | exact |
| Mirrored owner tests for every modified source above; relevant `tests/architecture/catalog-uat/` and integration/command tests; context factories throughout `tests/` | test | request-response; event-driven | each current paired test; `tests/edge/notification-boundary.ts:65-95` | exact |

The producer list is a migration map, not an exhaustive edit mandate: compile-time callers and current searches for `notifyUsageError`, `notifyUsageInfo`, `notifyDeviceFlowPrompt`, `notifyDiagnostic`, `notifyAsyncRewakeSummary`, `notifyStopHookOverrideCap`, `openNotificationRun`, `buildCloneAuth`, `buildAuthForHost`, and `NotificationContext` identify the exact files that change. The current source search found 79 test files referencing run/context/boundary symbols, so context-mode updates must be audited beyond the named helpers. Keep paired owner tests with each changed source.

## Pattern Assignments

### Notification context, run, and transport

**Analogs:** `extensions/pi-claude-marketplace/platform/pi-api.ts`, `shared/notification-run.ts`, `shared/notification-dispatch.ts`, `shared/notification-json.ts`.

The Pi import chokepoint re-exports upstream types at `platform/pi-api.ts:45-63`; the narrow consumer context is at `:133-141`. Add required mode there, using the current upstream `ExtensionMode` type if useful. The run's snapshot constructor is short and should stay structurally similar (`shared/notification-run.ts:11-22`):

```ts
export interface NotificationRun {
  readonly softDeps: SoftDepStatus;
}
export function openNotificationRun(pi: ToolInventory): NotificationRun {
  return { softDeps: softDepStatus(pi) };
}
```

Extend this with one required sink; do not store a mode snapshot. The dispatcher already has the only UI delivery site (`shared/notification-dispatch.ts:78-107`):

```ts
function deliver(ctx: NotificationContext, args: NotifyArguments | undefined): void {
  if (args === undefined) return;
  if (args.length === 1) {
    ctx.ui.notify(args[0]);
  } else {
    ctx.ui.notify(args[0], args[1]);
  }
}
function emitRawSurface(ctx: NotificationContext, surface: RawSurface): void {
  deliver(ctx, formatRawSurface(resolveRawSurface(surface)));
}
```

Preserve those argument counts. Route both resolved raw surfaces and presentations through one live-mode switch at emission. The existing converter already accepts both (`shared/notification-json.ts:46-55`):

```ts
export function toWirePayload(
  source: NotificationPresentation | ResolvedRawSurface,
): Type.Static<typeof NOTIFICATION_PAYLOAD_SCHEMA> {
  return "envelope" in source ? wirePresentation(source) : wireRawSurface(source);
}
```

Use the run sink for the sole `appendEntry("claude-plugin", payload)` call inside the dispatcher. Existing structured entry points (`notification-dispatch.ts:247-253,345-376`) already accept the run. Raw helper signatures at `:113-237` need the parent run. Preserve empty diagnostic and rewake no-ops before JSON conversion; the text formatter cases are in `notification-grammar.ts:1139-1159`.

### Command routing and raw errors

**Analogs:** `edge/register.ts:133-138`, `edge/router.ts:159-264`.

```ts
pi.registerCommand("claude:plugin", {
  description: COMMAND_DESCRIPTION,
  handler: (args, ctx) => routeClaudePlugin(args, handlers, ctx, openNotificationRun(pi)),
});
```

Keep one root run and pass it through routing, help, parsing wrappers, marketplace helpers, and each verb handler. Validate the plain `ctx.mode` before routing can mutate state. `edge/router.ts` already carries `NotificationRun` in its handler type; use that contract to avoid nested run construction. Existing raw help/error branches in `edge/router.ts:159-264` are the pattern for argument-error paths. The two LLM-tool constructors in `edge/handlers/tools.ts:47,120,487` also need the required sink but must keep returning details without appending session entries.

### Auth callback and nested operations

**Analog:** `orchestrators/auth-host.ts:168-202,221-237`.

```ts
export function buildAuthForHost(args: {
  host: string;
  credentialOps: CredentialOps;
  ctx: NotificationContext;
  deviceFlowHttp?: DeviceFlowHttp;
  authMemo?: Map<string, AuthAttemptResult>;
}): GitAuthBundle {
  // ...
  const onAuthRequired: OnAuthRequiredFn = async (): Promise<AuthAttemptResult> => {
    const memoized = authMemo?.get(host);
    if (memoized !== undefined) return memoized;
    const result = await initiateDeviceFlow({
      provider, host, credentialOps,
      onDeviceCode: (prompt) => { notifyDeviceFlowPrompt(ctx, prompt); },
      ...(deviceFlowHttp !== undefined && { http: deviceFlowHttp }),
    });
    authMemo?.set(host, result);
    return result;
  };
  return { kind: "device-flow", credentialOps, host, onAuthRequired };
}
```

Thread the same parent run through `buildAuthForHost`, `buildCloneAuth` (`:221-237`), clone/probe option types, and their current callers. The callback may run later, but it still belongs to the command's run. Preserve auth memo and polling behavior.

### Load and hook callbacks

**Analogs:** `index.ts:90-184`, `bridges/hooks/async-rewake/registry.ts:388-455`, `bridges/hooks/settle.ts:369-385`.

`index.ts:123-145` opens the load run inside a try block, then catches warning-delivery failures separately; `:156-182` independently recomputes PATH, emits per-scope warnings, and aggregates discovered resources. Guard mutation before hydration/reconcile/PATH while allowing the read-only aggregation tail. Reuse the same load run for both warnings. Use the existing opt-in logger (`shared/debug-log.ts:22-25`):

```ts
export function hookDebugLog(detail: string, tag = "hooks"): void {
  if (process.env.PI_CLAUDE_MARKETPLACE_DEBUG === "1") {
    console.error(`[${tag}] ${detail}`);
  }
}
```

In `async-rewake/registry.ts:396-424`, terminal child removal, PID persistence, and generation checks precede summary output; at `:432-455`, its emission has a local catch and completion logic continues. Keep that ordering while constructing the hook run at the protected callback. In `settle.ts:369-385`, the cap transition is recorded before `notifyStopHookOverrideCap`; isolate delivery failure so it cannot undo the transition or block independent valid reentry. `event-router.ts:766-770,816-877,916-934` currently creates a shared directory at factory time; move fresh creation to a guarded session-start path because factory time lacks context mode.

### ESLint restriction and architecture check

**Analog:** `eslint.config.js:333-358,422-440`; `tests/architecture/presentation-sink.test.ts:89-105,134-182`.

```js
files: [
  "extensions/pi-claude-marketplace/orchestrators/**/*.ts",
  "extensions/pi-claude-marketplace/domain/**/*.ts",
],
ignores: NETWORK_SEAMS,
rules: {
  "no-restricted-syntax": ["error", ...NETWORK_FREE_SYNTAX_SELECTORS],
},
```

The later test block disables this rule. Compose the new append-entry restriction with the existing production restrictions, including network-free modules; an overlapping later rule replaces an earlier one. Update the architecture scan's direct-delivery allowlist for the one dispatcher call. Prove the lint restriction with temporary violations in an ordinary extension module and a network-free module; remove them afterward. Do not add a committed gate self-test.

### Test boundaries and JSON capture

**Analogs:** `tests/edge/notification-boundary.ts:65-95`, `tests/architecture/catalog-uat/catalog-wire.test.ts:23-82`, `tests/shared/notification-run-seeds.ts:5-20`.

```ts
const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "extension context" });
const ui = mock<NotificationUi>({ exactParams: true, name: "notification UI" });
// Exact times(emissions), then verify(ctx) and verify(ui).
```

The catalog uses `Compile(NOTIFICATION_PAYLOAD_SCHEMA)` in test code (`catalog-wire.test.ts:29,82`), and verifies the serialized payload; it also walks the original payload for unsafe values (`:10-21`). Put a capture helper in the existing notification test concern that records every type/payload, validates every entry, retains failures even when append throws, and exposes explicit verification after callbacks settle. Give every context fake an explicit required mode, including shared strict mocks and casts. Extend run seeds with a required sink that rejects unexpected JSON delivery in text-only tests. Test live mode changes with one run, exact no-notify behavior for `json`/`rpc`, and unchanged inventory probe counts. Preserve the existing text corpus and catalog baseline.

## Shared Patterns

- **Imports:** Named relative imports for internal modules, type-only imports separate (`notification-dispatch.ts:1-45`); upstream Pi types cross through `platform/pi-api.ts:45-63`.
- **Error containment:** Commands propagate unsupported-mode errors; lifecycle roots use narrow catches and `hookDebugLog` (`index.ts:123-182`, `async-rewake/registry.ts:432-455`).
- **Validation:** Mode membership check happens at operation roots and again at emission. Schema validation stays in tests (`catalog-wire.test.ts:29,82`).
- **Testing:** Each changed production source has a mirrored owner test with 100% direct line/function/branch coverage. Use `node --test <owner-test>` during development; the hook checks staged inputs, and each combined GSD wave/phase gate uses `npm run check` per `skills/local-verification/SKILL.md`.

## No Analog Found

No new production mechanism needs an unrelated analog. The new mode selector, required entry sink, and JSON capture are extensions of the exact owner modules above. There is no existing append-entry implementation to copy; use the installed Pi 0.87.1 declaration (`appendEntry<T = unknown>(customType: string, data?: T): void`) and the peer floor 0.86.1. Do not infer a context mode from UI capability.

## Metadata

**Search scope:** Tracked `extensions/pi-claude-marketplace/`, `tests/`, and `eslint.config.js`; CodeGraph consulted first, followed by current source and targeted call searches.
**Tracked source files in scope:** 737.
**Pattern extraction date:** 2026-10-06.
