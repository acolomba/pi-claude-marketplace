// tests/integration/load-reconcile-race-child.ts
//
// RECON-06 child entry point. Forked by
// load-reconcile-race.test.ts; receives an IPC `{ cwd }` payload + a `go`
// signal (delivered as the IPC message itself); calls applyReconcile via a
// stub ctx + stub pi; reports notify args back over IPC; exits 0.
//
// Mirrors the shape of tests/integration/concurrent-install-child.ts but
// targets the load-time apply orchestrator instead of installPlugin. Stubs
// match the production resources_discover handler's surface: ctx.ui.notify
// accumulates messages into an array (parent uses this for diagnostic
// visibility only -- the integration assertions are state-consistency
// oriented, NOT byte-equality on notify output).

import { applyReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";

import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

interface StartMessage {
  readonly cwd: string;
}

interface NotificationRecord {
  readonly message: string;
  readonly severity?: string;
}

function isStartMessage(value: unknown): value is StartMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.cwd === "string";
}

function makePi(): ExtensionAPI {
  return {
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;
}

function sendResult(result: {
  readonly ok: boolean;
  readonly message?: string;
  readonly notifyArgs: readonly NotificationRecord[];
}): void {
  process.send?.(result, () => {
    process.disconnect?.();
  });
}

async function handleMessage(message: unknown): Promise<void> {
  if (!isStartMessage(message)) {
    sendResult({
      ok: false,
      message: `invalid start message: ${JSON.stringify(message)}`,
      notifyArgs: [],
    });
    return;
  }

  const notifyArgs: NotificationRecord[] = [];
  const ctx = {
    cwd: message.cwd,
    ui: {
      notify: (body: string, severity?: string): void => {
        notifyArgs.push(severity === undefined ? { message: body } : { message: body, severity });
      },
    },
  } as unknown as ExtensionContext;

  try {
    await applyReconcile({
      ctx,
      pi: makePi(),
      cwd: message.cwd,
      scope: "project",
    });
    sendResult({ ok: true, notifyArgs });
  } catch (err) {
    // NFR-2 violation -- applyReconcile MUST NOT throw past its boundary. The
    // test's assertion that both children exit code 0 catches this, but we
    // surface the error string here for diagnostic visibility.
    sendResult({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      notifyArgs,
    });
  }
}

process.on("message", (message: unknown) => {
  void handleMessage(message);
});

process.send?.("ready");
