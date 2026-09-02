// The strict Pi notification boundary, shared by every suite that sizes IL-2.
//
// WR-08: four suites carried byte-identical copies of this factory and its four
// types. The contract they encode is not theirs -- it belongs to
// `shared/notify.ts`: `notify()` runs one soft-dependency probe per emission,
// and that probe reads `pi.getAllTools()` twice. When the probe count changes,
// one shared definition breaks once instead of four suites drifting apart, and a
// drifted `times()` count weakens the IL-2 sizing proof silently rather than
// failing loudly.
//
// Every count is stated by the caller, never derived here. `notifyUsageError`
// writes straight to `ctx.ui.notify` and probes nothing, so a derived probe count
// would leave a usage-error case with an unmet `getAllTools()` expectation that
// names nothing about the case's real mistake. `ctx.cwd` is stated the same way,
// and only by a case whose path forwards it: a handler that rejects its input
// before delegating never reads `cwd`, and D-116-06 wants that absence provable.

import { mock, verify, when } from "strong-mock";

import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

export type NotificationSeverity = Parameters<ExtensionContext["ui"]["notify"]>[1];

type NotificationUi = Omit<ExtensionContext["ui"], "notify"> & {
  readonly notify: (message: string, severity?: NotificationSeverity) => void;
};

export interface Notification {
  readonly message: string;
  readonly severity?: NotificationSeverity;
}

export interface NotificationBoundary {
  readonly ctx: ExtensionCommandContext;
  readonly pi: ExtensionAPI;
  readonly notifications: readonly Notification[];
  readonly verifyBoundary: () => void;
}

/**
 * The Pi boundary, sized to the emissions the case promises. Every count is an
 * exact `times()`, so an extra or a missing notification fails the case where it
 * happens: `emissions` of 0 states that nothing may be emitted at all.
 *
 * `ctx` is an `ExtensionCommandContext`, the shape every edge handler signature
 * takes. It extends `ExtensionContext`, so a consumer handing `ctx` to an
 * orchestrator keeps compiling and no consumer needs a cast.
 *
 * `toolProbes` counts `pi.getAllTools()` reads, not emissions. `notify()` takes
 * one soft-dependency probe per emission and each probe reads `getAllTools()`
 * twice, so a `notify()` case states `emissions * 2`; `notifyUsageError` never
 * probes, so a usage-error case states 0. The count is stated rather than derived
 * because the two paths disagree, and a wrong default fails naming the probe
 * instead of the mistake. The probe reports no companion extension loaded, which
 * is what makes a row's declared agent and MCP dependencies visible as markers.
 *
 * `cwd` is stated only when the case's path forwards it. An edge handler reads
 * `ctx.cwd` once on the path that reaches its orchestrator and never on a
 * rejection path, so a delegating case passes `{ value, reads: 1 }` and a
 * rejection case omits the parameter, leaving any `cwd` read unexpected.
 */
export function createNotificationBoundary(
  emissions: number,
  toolProbes: number,
  cwd?: { readonly value: string; readonly reads: number },
): NotificationBoundary {
  const notifications: Notification[] = [];
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "extension context" });
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "notification UI" });
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(emissions);
  when(() => pi.getAllTools())
    .thenReturn([])
    .times(toolProbes);
  when(() => ui.notify)
    .thenReturn((message, severity) => {
      notifications.push(severity === undefined ? { message } : { message, severity });
    })
    .times(emissions);

  if (cwd !== undefined) {
    when(() => ctx.cwd)
      .thenReturn(cwd.value)
      .times(cwd.reads);
  }

  return {
    ctx,
    pi,
    notifications,
    verifyBoundary: (): void => {
      verify(ctx);
      verify(pi);
      verify(ui);
    },
  };
}
