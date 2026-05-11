import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import claudeMarketplaceExtension from "../../extensions/claude-marketplace/index.ts";
import { locationsFor } from "../../extensions/claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/claude-marketplace/persistence/state-io.ts";

import { PINNED_SHA } from "./_pinned-sha.ts";
import { targetByPlugin } from "./_targets.ts";

import type { ExtensionState } from "../../extensions/claude-marketplace/persistence/state-io.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../extensions/claude-marketplace/platform/pi-api.ts";

const execFileAsync = promisify(execFile);

const UPSTREAM_URL = "https://github.com/anthropics/claude-plugins-official.git";
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

export interface NotifyRecord {
  readonly message: string;
  readonly severity?: string;
}

export interface E2EEnvironment {
  readonly home: string;
  readonly cwd: string;
  readonly upstreamRoot: string;
  marketplaceAdded: boolean;
}

interface RegisteredCommand {
  readonly handler: (args: string, ctx: ExtensionContext) => Promise<void>;
}

interface ResourceDiscoverResult {
  readonly skillPaths: readonly string[];
  readonly promptPaths: readonly string[];
}

export interface MockPiHarness {
  readonly pi: ExtensionAPI;
  readonly commands: Map<string, RegisteredCommand>;
  readonly events: Map<
    string,
    ((event: unknown, ctx: ExtensionContext) => Promise<ResourceDiscoverResult>)[]
  >;
}

export function makeMockPi(tools: readonly unknown[]): MockPiHarness {
  const commands = new Map<string, RegisteredCommand>();
  const events = new Map<
    string,
    ((event: unknown, ctx: ExtensionContext) => Promise<ResourceDiscoverResult>)[]
  >();

  const pi = {
    registerCommand: (name: string, command: RegisteredCommand): void => {
      commands.set(name, command);
    },
    registerTool: (): void => {
      // Not exercised by the e2e assertions.
    },
    on: (
      event: string,
      handler: (event: unknown, ctx: ExtensionContext) => Promise<ResourceDiscoverResult>,
    ): void => {
      const list = events.get(event) ?? [];
      list.push(handler);
      events.set(event, list);
    },
    getAllTools: (): readonly unknown[] => tools,
  } as unknown as ExtensionAPI;

  return { pi, commands, events };
}

export function makeCtx(cwd: string): { ctx: ExtensionContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    cwd,
    ui: {
      notify: (message: string, severity?: string): void => {
        notifications.push(severity === undefined ? { message } : { message, severity });
      },
      addAutocompleteProvider: (): void => {
        // session_start is not exercised in e2e tests.
      },
    },
  } as unknown as ExtensionContext;

  return { ctx, notifications };
}

async function prepareUpstreamCheckout(root: string): Promise<string> {
  const dir = path.join(root, "claude-plugins-official");
  await execFileAsync("git", ["init", dir]);
  await execFileAsync("git", ["-C", dir, "remote", "add", "origin", UPSTREAM_URL]);
  const ref = process.env.PI_CM_E2E_REF === "main" ? "main" : PINNED_SHA;
  await execFileAsync("git", ["-C", dir, "fetch", "--depth", "1", "origin", ref], {
    env: process.env.GITHUB_TOKEN
      ? { ...process.env, GITHUB_TOKEN: process.env.GITHUB_TOKEN }
      : process.env,
    timeout: 120_000,
  });
  await execFileAsync("git", ["-C", dir, "checkout", "FETCH_HEAD"]);
  return dir;
}

export async function withE2EEnvironment<T>(fn: (env: E2EEnvironment) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const originalCwd = process.cwd();
  const root = await mkdtemp(path.join(tmpdir(), "pi-cm-e2e-"));
  const home = path.join(root, "home");
  const cwd = path.join(root, "project");
  process.env.HOME = home;
  await mkdir(home, { recursive: true });
  await mkdir(cwd, { recursive: true });

  try {
    const upstreamRoot = await prepareUpstreamCheckout(root);
    process.chdir(cwd);
    return await fn({ home, cwd, upstreamRoot, marketplaceAdded: false });
  } finally {
    process.chdir(originalCwd);
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    await rm(root, { recursive: true, force: true });
  }
}

export async function installTargetWithMockPi(
  env: E2EEnvironment,
  plugin: string,
  tools: readonly unknown[],
): Promise<{
  readonly mock: MockPiHarness;
  readonly ctx: ExtensionContext;
  readonly notifications: readonly NotifyRecord[];
  readonly state: ExtensionState;
}> {
  const target = targetByPlugin(plugin);
  const mock = makeMockPi(tools);
  const { ctx, notifications } = makeCtx(env.cwd);
  claudeMarketplaceExtension(mock.pi);
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

export type NightlyClassification = "pass" | "upstream-change" | "regression";

export function classifyNightlyFailure(args: {
  readonly failed: boolean;
  readonly snapshotDiff: string;
}): NightlyClassification {
  if (!args.failed) {
    return "pass";
  }

  return args.snapshotDiff.trim().length > 0 ? "upstream-change" : "regression";
}

export async function runPiRuntimeSmoke(): Promise<{
  readonly ok: boolean;
  readonly output: string;
}> {
  const root = await mkdtemp(path.join(tmpdir(), "pi-cm-runtime-smoke-"));
  const home = path.join(root, "home");
  const cwd = path.join(root, "project");
  const bin = path.join(REPO_ROOT, "node_modules", ".bin", "pi");
  const extension = path.join(REPO_ROOT, "extensions", "claude-marketplace", "index.ts");

  try {
    await mkdir(home, { recursive: true });
    await mkdir(cwd, { recursive: true });
    const { stdout, stderr } = await execFileAsync(
      bin,
      ["--offline", "--no-extensions", "--extension", extension, "--help"],
      { cwd, env: { ...process.env, HOME: home, PI_OFFLINE: "1" }, timeout: 30_000 },
    );
    const output = `${stdout}\n${stderr}`;
    return { ok: !/failed to load|error loading/i.test(output), output };
  } catch (err) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}\n${error.message ?? ""}`;
    return { ok: false, output };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function readPinnedMarketplaceSnapshot(): Promise<string> {
  return readFile(
    path.join(REPO_ROOT, "tests/e2e/_fixtures", PINNED_SHA, "marketplace.json"),
    "utf8",
  );
}
