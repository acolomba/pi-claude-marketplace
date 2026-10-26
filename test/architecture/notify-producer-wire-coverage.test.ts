/**
 * Cross-producer severity/reload parity for the standalone plugin command
 * contexts. Each case names and drives both producers through the real
 * notifyWithContext reducer/wire seam. Command-local labels, row policies, and
 * exact row bytes belong to the corresponding mirrored presenter owners.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  DISABLE_CONTEXT,
  ENABLE_CONTEXT,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts";
import { INSTALL_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts";
import { REINSTALL_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts";
import { UNINSTALL_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts";
import { UPDATE_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update.messaging.ts";
import { type Severity } from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import { notifyWithContext } from "../../extensions/pi-claude-marketplace/shared/notify-context.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import type { ExtensionContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { NotificationRun } from "../../extensions/pi-claude-marketplace/shared/notification-run.ts";

interface CapturedNotification {
  readonly message: string;
  readonly severity?: Severity;
}

interface WireFact {
  readonly severity: Severity | undefined;
  readonly reload: boolean;
}

type WireUi = Omit<ExtensionContext["ui"], "notify"> & {
  readonly notify: (message: string, severity?: Severity) => void;
};

interface WireHarness {
  readonly ctx: ExtensionContext;
  readonly run: NotificationRun;
  readonly ui: WireUi;
  readonly notifications: CapturedNotification[];
}

const RELOAD_TRAILER = "/reload to pick up changes";

function createWireHarness(name: string): WireHarness {
  const ctx = mock<ExtensionContext>({ exactParams: true, name: `${name} context` });
  const ui = mock<WireUi>({ exactParams: true, name: `${name} UI` });
  const notifications: CapturedNotification[] = [];
  when(() => ctx.mode)
    .thenReturn("tui")
    .times(1);
  when(() => ctx.ui).thenReturn(ui);
  when(() => ui.notify).thenReturn((message, severity) => {
    notifications.push({ message, ...(severity === undefined ? {} : { severity }) });
  });
  return { ctx, run: runWithNothingLoaded(), ui, notifications };
}

function wireFacts(notifications: readonly CapturedNotification[]): WireFact[] {
  return notifications.map(({ message, severity }) => ({
    severity,
    reload: message.endsWith(RELOAD_TRAILER),
  }));
}

test("enable and disable realized transitions share info severity and a reload trailer", () => {
  // arrange
  const enable = createWireHarness("enable");
  const disable = createWireHarness("disable");

  // act
  notifyWithContext(
    enable.ctx,
    enable.run,
    ENABLE_CONTEXT,
    [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            name: "alpha",
            dependencies: [],
            version: "1.0.0",
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
    undefined,
    "single",
  );
  notifyWithContext(
    disable.ctx,
    disable.run,
    DISABLE_CONTEXT,
    [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "disabled",
            name: "alpha",
            version: "1.0.0",
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
    undefined,
    "single",
  );
  const enableWire = wireFacts(enable.notifications);
  const disableWire = wireFacts(disable.notifications);

  // assert
  assert.deepStrictEqual(enableWire, [{ severity: undefined, reload: true }]);
  assert.deepStrictEqual(disableWire, [{ severity: undefined, reload: true }]);
  verify(enable.ctx);
  verify(enable.ui);
  verify(disable.ctx);
  verify(disable.ui);
});

test("install and uninstall realized transitions share info severity and a reload trailer", () => {
  // arrange
  const install = createWireHarness("install");
  const uninstall = createWireHarness("uninstall");

  // act
  notifyWithContext(
    install.ctx,
    install.run,
    INSTALL_CONTEXT,
    [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "installed",
            name: "beta",
            dependencies: [],
            version: "2.0.0",
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
    undefined,
    "single",
  );
  notifyWithContext(
    uninstall.ctx,
    uninstall.run,
    UNINSTALL_CONTEXT,
    [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "uninstalled",
            name: "beta",
            version: "2.0.0",
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
    undefined,
    "single",
  );
  const installWire = wireFacts(install.notifications);
  const uninstallWire = wireFacts(uninstall.notifications);

  // assert
  assert.deepStrictEqual(installWire, [{ severity: undefined, reload: true }]);
  assert.deepStrictEqual(uninstallWire, [{ severity: undefined, reload: true }]);
  verify(install.ctx);
  verify(install.ui);
  verify(uninstall.ctx);
  verify(uninstall.ui);
});

test("reinstall and update realized transitions share info severity and a reload trailer", () => {
  // arrange
  const reinstall = createWireHarness("reinstall");
  const update = createWireHarness("update");

  // act
  notifyWithContext(
    reinstall.ctx,
    reinstall.run,
    REINSTALL_CONTEXT,
    [
      {
        name: "official",
        scope: "project",
        plugins: [
          {
            status: "reinstalled",
            name: "gamma",
            dependencies: [],
            version: "3.0.0",
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
    undefined,
    "single",
  );
  notifyWithContext(
    update.ctx,
    update.run,
    UPDATE_CONTEXT,
    [
      {
        name: "official",
        scope: "project",
        plugins: [
          {
            status: "updated",
            name: "gamma",
            from: "2.0.0",
            to: "3.0.0",
            dependencies: [],
            severity: "info",
            needsReload: true,
          },
        ],
      },
    ],
    undefined,
    "single",
  );
  const reinstallWire = wireFacts(reinstall.notifications);
  const updateWire = wireFacts(update.notifications);

  // assert
  assert.deepStrictEqual(reinstallWire, [{ severity: undefined, reload: true }]);
  assert.deepStrictEqual(updateWire, [{ severity: undefined, reload: true }]);
  verify(reinstall.ctx);
  verify(reinstall.ui);
  verify(update.ctx);
  verify(update.ui);
});

test("enable and disable idempotent skips share info severity without a reload trailer", () => {
  // arrange
  const enable = createWireHarness("enable");
  const disable = createWireHarness("disable");

  // act
  notifyWithContext(
    enable.ctx,
    enable.run,
    ENABLE_CONTEXT,
    [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "delta",
            reasons: ["already enabled"],
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
    undefined,
    "single",
  );
  notifyWithContext(
    disable.ctx,
    disable.run,
    DISABLE_CONTEXT,
    [
      {
        name: "official",
        scope: "user",
        plugins: [
          {
            status: "skipped",
            name: "delta",
            reasons: ["already disabled"],
            severity: "info",
            needsReload: false,
          },
        ],
      },
    ],
    undefined,
    "single",
  );
  const enableWire = wireFacts(enable.notifications);
  const disableWire = wireFacts(disable.notifications);

  // assert
  assert.deepStrictEqual(enableWire, [{ severity: undefined, reload: false }]);
  assert.deepStrictEqual(disableWire, [{ severity: undefined, reload: false }]);
  verify(enable.ctx);
  verify(enable.ui);
  verify(disable.ctx);
  verify(disable.ui);
});

test("install and uninstall failures share error severity without a reload trailer", () => {
  // arrange
  const install = createWireHarness("install");
  const uninstall = createWireHarness("uninstall");

  // act
  notifyWithContext(
    install.ctx,
    install.run,
    INSTALL_CONTEXT,
    [
      {
        name: "official",
        scope: "project",
        plugins: [
          {
            status: "failed",
            name: "epsilon",
            reasons: ["network unreachable"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
    undefined,
    "single",
  );
  notifyWithContext(
    uninstall.ctx,
    uninstall.run,
    UNINSTALL_CONTEXT,
    [
      {
        name: "official",
        scope: "project",
        plugins: [
          {
            status: "failed",
            name: "epsilon",
            reasons: ["permission denied"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
    undefined,
    "single",
  );
  const installWire = wireFacts(install.notifications);
  const uninstallWire = wireFacts(uninstall.notifications);

  // assert
  assert.deepStrictEqual(installWire, [{ severity: "error", reload: false }]);
  assert.deepStrictEqual(uninstallWire, [{ severity: "error", reload: false }]);
  verify(install.ctx);
  verify(install.ui);
  verify(uninstall.ctx);
  verify(uninstall.ui);
});

test("UPR-04: reinstall and update absent-target failures share error severity without a reload trailer", () => {
  // arrange
  const reinstall = createWireHarness("reinstall");
  const update = createWireHarness("update");

  // act
  notifyWithContext(
    reinstall.ctx,
    reinstall.run,
    REINSTALL_CONTEXT,
    [
      {
        name: "official",
        scope: "project",
        plugins: [
          {
            status: "failed",
            name: "zeta",
            reasons: ["not installed"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
    undefined,
    "single",
  );
  notifyWithContext(
    update.ctx,
    update.run,
    UPDATE_CONTEXT,
    [
      {
        name: "official",
        scope: "project",
        plugins: [
          {
            status: "failed",
            name: "zeta",
            reasons: ["not installed"],
            severity: "error",
            needsReload: false,
          },
        ],
      },
    ],
    undefined,
    "single",
  );
  const reinstallWire = wireFacts(reinstall.notifications);
  const updateWire = wireFacts(update.notifications);

  // assert
  assert.deepStrictEqual(reinstallWire, [{ severity: "error", reload: false }]);
  assert.deepStrictEqual(updateWire, [{ severity: "error", reload: false }]);
  verify(reinstall.ctx);
  verify(reinstall.ui);
  verify(update.ctx);
  verify(update.ui);
});
