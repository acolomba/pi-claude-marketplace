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
//
// A count of 0 states no expectation at all rather than `times(0)`, because
// `strong-mock` treats `times(0)` as no limit: it installs the stub, serves every
// call, and verifies clean. A zero written as `times(0)` therefore proves nothing,
// which is the opposite of what a zero claims. Leaving the member unstated makes
// the mock serve its pending-call proxy instead, so the first unwanted emission,
// probe, or `cwd` read fails where it happens.

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
 * `toolProbes` counts `pi.getAllTools()` reads, not emissions, and the ratio
 * between the two is NOT fixed. `notify()` takes one soft-dependency probe per
 * emission and each probe reads `getAllTools()` twice, so a case whose emissions
 * all go through `notify()` states `emissions * 2`. Three paths break that
 * arithmetic:
 *
 * - `notifyUsageError` writes straight to `ctx.ui.notify` and probes nothing, so
 *   a usage-error case states 0.
 * - `makeRawNotifyFn` does the same, so a raw-text emission -- the reconcile's
 *   last-ditch error line and the plugin PATH warning both take this route --
 *   raises `emissions` without raising `toolProbes`.
 * - An emission routed through a caller-supplied `ui` (see `tests/index.test.ts`'s
 *   `contextNotifyingThrough`) never reaches this boundary's `ui` mock, so it does
 *   not count toward `emissions` at all while still probing through `pi`. Those
 *   cases state `emissions` of 0 beside a non-zero `toolProbes`.
 *
 * So state the count the case actually observes, and when it moves, find out WHY
 * before changing the number: refitting it until the case goes green turns the
 * count from a claim about the soft-dependency probe into a fudge factor, and the
 * IL-2 sizing proof this file exists to protect goes with it. The count is stated
 * rather than derived because the paths disagree, and a wrong default fails naming
 * the probe instead of the mistake. The probe reports no companion extension
 * loaded, which is what makes a row's declared agent and MCP dependencies visible
 * as markers.
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
  if (emissions > 0) {
    when(() => ctx.ui)
      .thenReturn(ui)
      .times(emissions);
    when(() => ui.notify)
      .thenReturn((message, severity) => {
        notifications.push(severity === undefined ? { message } : { message, severity });
      })
      .times(emissions);
  }

  if (toolProbes > 0) {
    when(() => pi.getAllTools())
      .thenReturn([])
      .times(toolProbes);
  }

  if (cwd !== undefined && cwd.reads > 0) {
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
