// test/integration/ipc-child.ts
//
// Shared stubs for the forked IPC child drivers under `test/integration/`.
// Each child stands up a minimal `ctx`, runs ONE orchestrator, and reports back
// over IPC. The stub surfaces below are the parts every child
// needs identically; the per-child start-message shape and result shape stay
// local, because those ARE the per-test contract.

import type { ExtensionContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

/** One `ctx.ui.notify(body, severity?)` call, captured in argument order. */
export interface NotificationRecord {
  readonly message: string;
  readonly severity?: string;
}

/**
 * A stub `ctx` whose `ui.notify` accumulates into the returned array rather
 * than writing anywhere. Mirrors the production `resources_discover` handler's
 * surface closely enough for the orchestrator under test; the parent process
 * reads the captured records back over IPC.
 */
export function makeNotifyCollectingCtx(cwd: string): {
  readonly ctx: ExtensionContext;
  readonly notifications: NotificationRecord[];
} {
  const notifications: NotificationRecord[] = [];
  const ctx = {
    mode: "tui",
    cwd,
    ui: {
      notify: (body: string, severity?: string): void => {
        notifications.push(
          severity === undefined ? { message: body } : { message: body, severity },
        );
      },
    },
  } as unknown as ExtensionContext;
  return { ctx, notifications };
}
