import { mock, verify, when } from "strong-mock";

import type {
  NotificationContext,
  ToolInventory,
  ToolInventoryItem,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

export type MockCtx = NotificationContext;
export type MockPi = ToolInventory;
type NotifyArguments = [message: string, severity?: "info" | "warning" | "error"];
interface MockNotificationUi {
  readonly notify: (...args: NotifyArguments) => void;
}

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
    .times(3);
  return pi;
}

/**
 * Probe reports all three companions loaded -- pi-subagents, pi-mcp-adapter and
 * the host workflow engine -- so no soft-dep marker fires on any row, whatever
 * that row declares.
 */
export function piWithAllLoaded(): MockPi {
  return makePi([{ name: "subagent" }, { name: "mcp" }, { name: "workflow_control" }]);
}

/** Reports pi-subagents and pi-mcp-adapter loaded, the host workflow engine NOT loaded. */
export function piWithBothLoaded(): MockPi {
  return makePi([{ name: "subagent" }, { name: "mcp" }]);
}

/**
 * Probe reports pi-subagents and pi-mcp-adapter loaded, the host workflow engine
 * NOT loaded -- `{requires pi-dynamic-workflows}` fires on dep-bearing rows
 * declaring workflows, and no other soft-dep marker fires (WDEP-01). Byte-identical
 * to `piWithBothLoaded`; this name is for call sites specifically exercising the
 * workflow-engine-absent scenario.
 */
export function piWithoutWorkflowEngine(): MockPi {
  return piWithBothLoaded();
}

/** Reports only the MCP companion extension loaded. */
export function piWithMcpLoaded(): MockPi {
  return makePi([{ name: "mcp" }]);
}

/** Reports no companion extension loaded. */
export function piWithNothingLoaded(): MockPi {
  return makePi([]);
}

/** Verifies the catalog renderer performed exactly three tool probes. */
export function verifyPi(pi: MockPi): void {
  verify(pi);
}
