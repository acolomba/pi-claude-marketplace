// The strict Pi notification boundary, shared by every suite that sizes IL-2.
//
// WR-08: the contract this factory encodes belongs to
// `shared/notification-dispatch.ts`, the one module that calls `ctx.ui.notify`,
// and not to any suite that uses it. One shared definition breaks once when that
// contract changes, so no suite keeps a copy that drifts.
//
// Soft-dependency probes are per command, never per emission (D-05, D-07). The
// registered `/claude:plugin` command and the `resources_discover` load pass each
// take one snapshot when they open their notification run. Handlers and
// orchestrators receive that run and never probe. The probe count therefore
// belongs to the tests of those two roots, test/edge/register.test.ts and
// test/index.test.ts, which each build their own strict Pi mock. This boundary
// holds no Pi mock and sizes only emissions and `cwd`. `expectSoftDepProbes` is
// the one place that says how many Pi reads a snapshot makes, so a change to the
// probe's read shape breaks once instead of in every strict Pi mock.
//
// Every count is stated by the caller, never derived here. `ctx.cwd` is stated
// only by a case whose path forwards it: a handler that rejects its input before
// delegating never reads `cwd`, and D-116-06 wants that absence provable.
//
// A count of 0 states no expectation at all rather than `times(0)`, because
// `strong-mock` treats `times(0)` as no limit: it installs the stub, serves every
// call, and verifies clean. A zero written as `times(0)` therefore proves nothing,
// which is the opposite of what a zero claims. Leaving the member unstated makes
// the mock serve its pending-call proxy instead, so the first unwanted emission
// or `cwd` read fails where it happens.

import { mock, verify, when } from "strong-mock";

import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import { createJsonCapture } from "./json-capture.ts";

import type {
  CommandInventoryItem,
  ExtensionCommandContext,
  ExtensionContext,
  PiInventory,
  ToolInventoryItem,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";

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
  readonly notifications: readonly Notification[];
  readonly verifyBoundary: () => void;
}

/**
 * States `probes` soft-dependency probes on `pi`, each answering with `tools`
 * and `commands`. A notification run takes one `softDepStatus(pi)` snapshot
 * when it opens (D-05), and this is the one place that says how many Pi reads
 * one snapshot makes: three `getAllTools()` reads (one per companion target)
 * and one `getCommands()` read (the pi-mcp-adapter command arm). A change to
 * the probe's read shape breaks here once (WR-08). A `probes` of 0 states nothing,
 * because `times(0)` is no limit.
 */
export function expectSoftDepProbes(
  pi: PiInventory,
  probes: number,
  tools: readonly ToolInventoryItem[] = [],
  commands: readonly CommandInventoryItem[] = [],
): void {
  if (probes > 0) {
    when(() => pi.getAllTools())
      .thenReturn(tools)
      .times(probes * 3);
    when(() => pi.getCommands())
      .thenReturn(commands)
      .times(probes);
  }
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
 * `cwd` is stated only when the case's path forwards it. An edge handler reads
 * `ctx.cwd` once on the path that reaches its orchestrator and never on a
 * rejection path, so a delegating case passes `{ value, reads: 1 }` and a
 * rejection case omits the parameter, leaving any `cwd` read unexpected.
 */
export function createNotificationBoundary(
  emissions: number,
  cwd?: { readonly value: string; readonly reads: number },
  modeReads = emissions,
): NotificationBoundary {
  const notifications: Notification[] = [];
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "extension context" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "notification UI" });
  if (modeReads > 0) {
    when(() => ctx.mode)
      .thenReturn("tui")
      .times(modeReads);
  }

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

  if (cwd !== undefined && cwd.reads > 0) {
    when(() => ctx.cwd)
      .thenReturn(cwd.value)
      .times(cwd.reads);
  }

  return {
    ctx,
    notifications,
    verifyBoundary: (): void => {
      verify(ctx);
      verify(ui);
    },
  };
}

/** Captures one machine emission while rejecting UI and command work. */
export function createMachineNotificationBoundary(mode: "json" | "rpc"): {
  readonly ctx: ExtensionCommandContext;
  readonly run: NotificationRun;
  readonly capture: ReturnType<typeof createJsonCapture>;
  readonly verifyBoundary: () => void;
} {
  const capture = createJsonCapture();
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.mode)
    .thenReturn(mode)
    .times(1);
  const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };
  return {
    ctx,
    run,
    capture,
    verifyBoundary: (): void => {
      verify(ctx);
    },
  };
}
