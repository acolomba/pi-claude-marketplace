import { installPlugin } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import {
  makeNotifyCollectingCtx,
  makeStubPi,
  type NotificationRecord,
} from "../helpers/ipc-child.ts";

interface StartMessage {
  readonly plugin: string;
  readonly marketplace: string;
  readonly cwd: string;
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

function sendResult(result: {
  readonly ok: boolean;
  readonly message: string;
  readonly notifications?: readonly NotificationRecord[];
}): void {
  process.send?.(result, () => {
    process.disconnect?.();
  });
}

async function handleMessage(message: unknown): Promise<void> {
  if (!isStartMessage(message)) {
    sendResult({ ok: false, message: `invalid start message: ${JSON.stringify(message)}` });
    return;
  }

  const { ctx, notifications } = makeNotifyCollectingCtx(message.cwd);

  try {
    await installPlugin({
      ctx,
      pi: makeStubPi(),
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
}

process.on("message", (message: unknown) => {
  void handleMessage(message);
});

process.send?.("ready");
