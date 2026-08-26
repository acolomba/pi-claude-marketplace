// Owner for edge/handlers/plugin/help.ts.
//
// Tests for the /claude:plugin help handler:
//   - empty args or "help" topic emits TOP_LEVEL_USAGE at info severity
//   - "marketplace" topic emits MARKETPLACE_USAGE at info severity
//   - unknown topic emits usage error at error severity

import { test } from "node:test";

import { mock, verify, when } from "strong-mock";

import { makeHelpHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts";
import {
  MARKETPLACE_USAGE,
  TOP_LEVEL_USAGE,
} from "../../../../extensions/pi-claude-marketplace/edge/router.ts";

import type { ExtensionCommandContext } from "../../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

test("help with empty args emits top-level usage at info severity", async () => {
  const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.ui).thenReturn(ui);
  when(() => {
    ui.notify(TOP_LEVEL_USAGE, "info");
  }).thenReturn();

  const helpHandler = makeHelpHandler();
  await helpHandler("", ctx);

  verify(ctx);
  verify(ui);
});

test("help with 'help' topic emits top-level usage at info severity", async () => {
  const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.ui).thenReturn(ui);
  when(() => {
    ui.notify(TOP_LEVEL_USAGE, "info");
  }).thenReturn();

  const helpHandler = makeHelpHandler();
  await helpHandler("help", ctx);

  verify(ctx);
  verify(ui);
});

test("help with 'marketplace' topic emits marketplace usage at info severity", async () => {
  const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.ui).thenReturn(ui);
  when(() => {
    ui.notify(MARKETPLACE_USAGE, "info");
  }).thenReturn();

  const helpHandler = makeHelpHandler();
  await helpHandler("marketplace", ctx);

  verify(ctx);
  verify(ui);
});

test("help with unknown topic emits usage error at error severity", async () => {
  const ui = mock<ExtensionCommandContext["ui"]>({ exactParams: true, name: "UI" });
  const ctx = mock<ExtensionCommandContext>({ exactParams: true, name: "command context" });
  when(() => ctx.ui).thenReturn(ui);
  when(() => {
    ui.notify(
      'Unknown help topic: "unknown".\n\nUsage: /claude:plugin help [marketplace]',
      "error",
    );
  }).thenReturn();

  const helpHandler = makeHelpHandler();
  await helpHandler("unknown", ctx);

  verify(ctx);
  verify(ui);
});
