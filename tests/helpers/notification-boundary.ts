// The strict Pi notification boundary, shared by every suite that sizes IL-2.
//
// WR-08: four suites carried byte-identical copies of this factory and its four
// types. The contract they encode is not theirs -- it belongs to
// `shared/notify.ts`: one soft-dependency probe per emission, and that probe
// reads `pi.getAllTools()` twice. When the probe count changes, one shared
// definition breaks once instead of four suites drifting apart, and a drifted
// `times()` count weakens the IL-2 sizing proof silently rather than failing
// loudly.

import { mock, verify, when } from "strong-mock";

import type {
  ExtensionAPI,
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
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly notifications: readonly Notification[];
  readonly verifyBoundary: () => void;
}

/**
 * The Pi boundary, sized to the emissions the case promises. Every count is an
 * exact `times()`, so an extra or a missing notification fails the case where it
 * happens: `emissions` of 0 states that nothing may be emitted at all.
 *
 * `notify` takes one soft-dependency probe per emission and that probe reads
 * `pi.getAllTools()` twice, which is the `toolProbes` default. A case whose
 * emission never reaches the probe (a message with no soft-dependency markers to
 * resolve) passes its own count. The probe reports no companion extension
 * loaded, which is what makes a row's declared agent and MCP dependencies
 * visible as markers.
 */
export function createNotificationBoundary(
  emissions: number,
  toolProbes = emissions * 2,
): NotificationBoundary {
  const notifications: Notification[] = [];
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
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
