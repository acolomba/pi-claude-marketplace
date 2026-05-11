import { installPlugin } from "../../extensions/claude-marketplace/orchestrators/plugin/install.ts";

import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../extensions/claude-marketplace/platform/pi-api.ts";

interface StartMessage {
  readonly plugin: string;
  readonly marketplace: string;
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
  return (
    typeof record.plugin === "string" &&
    typeof record.marketplace === "string" &&
    typeof record.cwd === "string"
  );
}

function makePi(): ExtensionAPI {
  return {
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;
}

function sendResult(result: {
  readonly ok: boolean;
  readonly message: string;
  readonly notifications?: readonly NotificationRecord[];
}): void {
  process.send?.(result, () => {
    process.disconnect?.();
  });
}

process.on("message", async (message: unknown) => {
  if (!isStartMessage(message)) {
    sendResult({ ok: false, message: `invalid start message: ${JSON.stringify(message)}` });
    return;
  }

  const notifications: NotificationRecord[] = [];
  const ctx = {
    cwd: message.cwd,
    ui: {
      notify: (body: string, severity?: string): void => {
        notifications.push(
          severity === undefined ? { message: body } : { message: body, severity },
        );
      },
    },
  } as unknown as ExtensionContext;

  try {
    await installPlugin({
      ctx,
      pi: makePi(),
      scope: "project",
      cwd: message.cwd,
      marketplace: message.marketplace,
      plugin: message.plugin,
    });

    const errorNotification = notifications.find(
      (notification) => notification.severity === "error",
    );
    if (errorNotification !== undefined) {
      sendResult({ ok: false, message: errorNotification.message, notifications });
      return;
    }

    sendResult({
      ok: true,
      message: notifications.map((notification) => notification.message).join("\n"),
      notifications,
    });
  } catch (err) {
    sendResult({
      ok: false,
      message: err instanceof Error ? err.message : String(err),
      notifications,
    });
  }
});

process.send?.("ready");
