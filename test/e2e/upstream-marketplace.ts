/**
 * @fileoverview The upstream Claude plugin marketplace that the e2e suites
 * install from: a shallow checkout of the pinned commit (or `main` for the
 * nightly run), added as a path source and installed through a mock Pi.
 */

import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import claudeMarketplaceExtension from "../../extensions/pi-claude-marketplace/index.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";
import { makeCtx, makeMockPi } from "../platform/mock-pi.ts";
import { allowlistedEnvironment } from "../platform/process-environment.ts";

import { PINNED_SHA } from "./_pinned-sha.ts";
import { E2E_MARKETPLACE_NAME, targetByPlugin } from "./_targets.ts";

import type { ExtensionState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { MockPiHarness, NotifyRecord } from "../platform/mock-pi.ts";

const execFileAsync = promisify(execFile);

const UPSTREAM_URL = "https://github.com/anthropics/claude-plugins-official.git";

export interface E2EEnvironment {
  readonly home: string;
  readonly cwd: string;
  readonly upstreamRoot: string;
  marketplaceAdded: boolean;
}

// The proxy and CA variables that git's HTTPS transport reads, so the fetch
// works behind a proxy. The fetch reads a public URL, so it needs no token.
const HTTPS_TRANSPORT_VARIABLES: readonly string[] = [
  "https_proxy",
  "HTTPS_PROXY",
  "all_proxy",
  "ALL_PROXY",
  "no_proxy",
  "NO_PROXY",
  "GIT_SSL_CAINFO",
  "GIT_SSL_CAPATH",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
];

async function prepareUpstreamCheckout(root: string): Promise<string> {
  const dir = path.join(root, "claude-plugins-official");
  // HOME is the hermetic home that withHermeticEnvironment set.
  const env = allowlistedEnvironment(["PATH", "HOME"]);
  await execFileAsync("git", ["init", dir], { env });
  await execFileAsync("git", ["-C", dir, "remote", "add", "origin", UPSTREAM_URL], { env });
  const ref = process.env.PI_CM_E2E_REF === "main" ? "main" : PINNED_SHA;
  await execFileAsync("git", ["-C", dir, "fetch", "--depth", "1", "origin", ref], {
    env: allowlistedEnvironment(["PATH", "HOME", ...HTTPS_TRANSPORT_VARIABLES]),
    timeout: 120_000,
  });
  await execFileAsync("git", ["-C", dir, "checkout", "FETCH_HEAD"], { env });
  await renameUpstreamMarketplace(dir);
  return dir;
}

/**
 * D-PL5-23: rewrites the `name` the checkout's manifest declares to
 * `E2E_MARKETPLACE_NAME`, keeping the pinned commit and every other field.
 * The checkout is added as a path source, which may not declare the reserved
 * `claude-plugins-official`.
 */
async function renameUpstreamMarketplace(dir: string): Promise<void> {
  const manifestPath = path.join(dir, ".claude-plugin", "marketplace.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Record<string, unknown>;
  await writeFile(
    manifestPath,
    `${JSON.stringify({ ...manifest, name: E2E_MARKETPLACE_NAME }, null, 2)}\n`,
  );
}

export async function withE2EEnvironment<T>(fn: (env: E2EEnvironment) => Promise<T>): Promise<T> {
  return withHermeticEnvironment("pi-cm-e2e-", async ({ root, home, cwd }) => {
    const originalCwd = process.cwd();
    try {
      const upstreamRoot = await prepareUpstreamCheckout(root);
      process.chdir(cwd);
      return await fn({ home, cwd, upstreamRoot, marketplaceAdded: false });
    } finally {
      process.chdir(originalCwd);
    }
  });
}

export async function installTargetWithMockPi(
  env: E2EEnvironment,
  plugin: string,
  tools: readonly unknown[],
  slashCommands: readonly unknown[] = [],
): Promise<{
  readonly mock: MockPiHarness;
  readonly ctx: ExtensionContext;
  readonly notifications: readonly NotifyRecord[];
  readonly state: ExtensionState;
}> {
  const target = targetByPlugin(plugin);
  const mock = makeMockPi(tools, slashCommands);
  const { ctx, notifications } = makeCtx(env.cwd);
  await claudeMarketplaceExtension(mock.pi);
  const command = mock.commands.get("claude:plugin");
  if (command === undefined) {
    throw new Error("claude:plugin command was not registered");
  }

  if (!env.marketplaceAdded) {
    await command.handler(`marketplace add ${env.upstreamRoot} --scope project`, ctx);
    env.marketplaceAdded = true;
  }

  await command.handler(`install ${target.plugin}@${target.marketplace} --scope project`, ctx);
  const state = await loadState(locationsFor("project", env.cwd).extensionRoot);
  return { mock, ctx, notifications, state };
}
