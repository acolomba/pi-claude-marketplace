// fallow-ignore-file unused-file -- standalone operator-run demo driver: an engineer invokes it from the command line and no module ever imports it, so being unreachable from the import graph is its intended shape, not a defect.
/**
 * Standalone interactive demo for the `/claude:plugin browse` picker.
 *
 * Run it in a real terminal (needs a TTY for raw input + alt screen):
 *
 *     node demos/browse-demo.ts
 *
 * No pi session, no disk, no network -- marketplaces and plugins are canned
 * fixtures. Drive it with the arrow keys, Enter to open/select, Esc to go
 * back / cancel. Selecting an action prints the PickerResult and exits.
 *
 * Why this exists: the picker is a terminal component (`ctx.ui.custom`) that
 * cannot be exercised headlessly. This script wires the same `PluginBrowser`
 * component to a real `TuiMainScreen` so you can click through the screens
 * (marketplaces -> plugins -> actions -> install scope) and see the status-filtered
 * action set before installing the extension into a real pi session.
 */

import { ProcessTerminal, TuiMainScreen } from "@earendil-works/pi-tui";

import { PluginBrowser } from "../extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts";

import type {
  MarketplaceEntry,
  PickerResult,
} from "../extensions/pi-claude-marketplace/edge/browser/plugin-browser.ts";
import type { Theme } from "../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { PluginNotificationMessage } from "../extensions/pi-claude-marketplace/shared/notification-types.ts";

// Mock theme (hand-rolled ANSI; the real Theme lives behind the package
// `exports` map, unreachable from outside).

const RESET = "\x1b[0m";
const FG: Record<string, string> = {
  accent: "\x1b[36m", // cyan
  dim: "\x1b[2m",
  muted: "\x1b[90m", // gray
  warning: "\x1b[33m", // yellow
  success: "\x1b[32m", // green
  error: "\x1b[31m", // red
};

// Cast through `unknown` because the real `Theme` is a class with private
// fields (fgColors/bgColors/mode) -- this hand-rolled mock only implements
// the fg/bg/bold surface PluginBrowser actually calls.
const theme = {
  fg: (color: string, text: string): string => `${FG[color] ?? ""}${text}${RESET}`,
  bg: (_color: string, text: string): string => text,
  bold: (text: string): string => `\x1b[1m${text}${RESET}`,
} as unknown as Theme;

// Canned data.

const marketplaces: readonly MarketplaceEntry[] = [
  {
    name: "anthropic-official",
    scope: "user",
    pluginCount: 5,
    source: "github:anthropics/claude-plugins-official",
  },
  {
    name: "team-plugins",
    scope: "project",
    pluginCount: 2,
    source: "github:your-org/team-plugins",
  },
  {
    name: "empty-marketplace",
    scope: "user",
    pluginCount: 0,
    source: "github:example/empty",
  },
];

const official: readonly PluginNotificationMessage[] = [
  {
    status: "installed",
    name: "code-review",
    dependencies: [],
    severity: "info",
    needsReload: false,
    version: "1.4.0",
  },
  { status: "available", name: "docs-helper", version: "0.3.1" },
  { status: "unavailable", name: "windows-only-tool", reasons: ["unsupported source"] },
  { status: "disabled", name: "legacy-migrator", severity: "info", needsReload: false },
  { status: "upgradable", name: "test-runner", reasons: [], version: "2.0.0" },
];

const team: readonly PluginNotificationMessage[] = [
  {
    status: "installed",
    name: "team-skills",
    dependencies: [],
    severity: "info",
    needsReload: false,
    version: "0.9.0",
  },
  { status: "remote", name: "gitlab-bridge" },
];

async function pluginLoader(mp: MarketplaceEntry): Promise<readonly PluginNotificationMessage[]> {
  switch (mp.name) {
    case "anthropic-official":
      return official;
    case "team-plugins":
      return team;
    default:
      return [];
  }
}

// Run.

function main(): void {
  const terminal = new ProcessTerminal();
  const tui = new TuiMainScreen(terminal);

  const browser = new PluginBrowser({
    tui,
    theme,
    marketplaces,
    pluginLoader,
    onSelect: (result: PickerResult) => {
      tui.stop();
      process.stdout.write(`\nSelected:\n${JSON.stringify(result, null, 2)}\n`);
      process.exit(0);
    },
    onCancel: () => {
      tui.stop();
      process.stdout.write("\nCancelled.\n");
      process.exit(0);
    },
  });

  tui.addChild(browser);
  tui.setFocus(browser);

  process.on("SIGINT", () => {
    tui.stop();
    process.exit(130);
  });

  tui.start();
}

main();
