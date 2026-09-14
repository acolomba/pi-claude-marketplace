import { mock, verify, when } from "strong-mock";

import type {
  NotificationContext,
  NotificationUi,
  ToolInventory,
  ToolInventoryItem,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

export type MockCtx = NotificationContext;
export type MockPi = ToolInventory;
type NotifyArguments = [message: string, severity?: "info" | "warning" | "error"];
type MockNotificationUi = Omit<NotificationUi, "notify"> & {
  readonly notify: (...args: NotifyArguments) => void;
};

export interface CapturedNotification {
  readonly message: string;
  readonly severity?: "info" | "warning" | "error";
  readonly argumentCount: 1 | 2;
}

export interface MockContextBoundary {
  readonly ctx: MockCtx;
  readonly notifications: readonly CapturedNotification[];
  readonly verifyContext: () => void;
}

/** Creates a strict notification boundary sized for one catalog emission. */
export function makeCtx(): MockContextBoundary {
  const notifications: CapturedNotification[] = [];
  const ctx = mock<NotificationContext>({ exactParams: true, name: "catalog context" });
  const ui = mock<MockNotificationUi>({ exactParams: true, name: "catalog notification UI" });
  when(() => ctx.ui)
    .thenReturn(ui)
    .times(1);
  when(() => ui.notify)
    .thenReturn((...args: NotifyArguments) => {
      const [message, severity] = args;
      const argumentCount = args.length === 1 ? 1 : 2;
      notifications.push(
        severity === undefined ? { message, argumentCount } : { message, severity, argumentCount },
      );
    })
    .times(1);

  return {
    ctx,
    notifications,
    verifyContext: (): void => {
      verify(ctx);
      verify(ui);
    },
  };
}

function makePi(tools: readonly ToolInventoryItem[]): MockPi {
  const pi = mock<ToolInventory>({ exactParams: true, name: "catalog Pi API" });
  when(() => pi.getAllTools())
    .thenReturn(tools)
    .times(2);
  return pi;
}

/** Reports both companion extensions loaded. */
export function piWithBothLoaded(): MockPi {
  return makePi([{ name: "subagent" }, { name: "mcp" }]);
}

/** Reports only the MCP companion extension loaded. */
export function piWithMcpLoaded(): MockPi {
  return makePi([{ name: "mcp" }]);
}

/** Reports no companion extension loaded. */
export function piWithNothingLoaded(): MockPi {
  return makePi([]);
}

/** Verifies the catalog renderer performed exactly two tool probes. */
export function verifyPi(pi: MockPi): void {
  verify(pi);
}
