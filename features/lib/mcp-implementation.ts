/**
 * @fileoverview Which MCP implementation a Pi runs, which one its launch
 * implies, and the sandbox files that decide it (DUAL-01, DUAL-02).
 *
 * A Pi runs pi-mcp-adapter when it lists the adapter's `/mcp-adapter`
 * command, else Pi's built-in MCP when it lists an `/mcp` command from
 * `builtin:mcp`, else none: the precedence the extension itself applies
 * (MSEL-01). The harness compares that with what the Pi's launch implies
 * (P1-DC-14): the adapter when the launch loads it, else none when Pi starts
 * with `--no-mcp` or the user or project settings hold `-builtin:mcp`, else
 * built-in.
 *
 * pi-mcp-adapter turns Pi's built-in MCP off once per adapter version: at
 * `session_start`, unless `<agent dir>/mcp-onboarding.json` records its
 * version, it adds `-builtin:mcp` to the user settings and then records the
 * version. The write happens after its `session_start` returns. The harness
 * seeds that file so the adapter leaves the sandbox settings alone, and waits
 * for it when a scenario needs the adapter's real write.
 *
 * Every file this module reads or writes lies under the run's root, which
 * `support/pi-process.ts` makes in the temp directory; a location outside it
 * is refused, so no helper touches the user's own Pi settings or the
 * repository (T-01-14).
 */

import assert from "node:assert/strict";
import { readFile, realpath, rename, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { stubPidFiles } from "./mcp-stub-server.ts";
import { isRunning } from "./turn-records.ts";

import type { ListedCommand } from "../../test/e2e/_rpc.ts";

/** A cucumber profile, which names the MCP implementation its shared Pi runs (DUAL-01). */
export type McpProfile = "adapter" | "builtin";

/** The MCP implementation a Pi runs, or none (MSEL-01). */
export type McpImplementation = McpProfile | "none";

/** What a Pi's launch says about its MCP implementation. */
export interface McpLaunch {
  /** Whether the Pi loads pi-mcp-adapter. */
  readonly adapterLoaded: boolean;
  /** Whether the Pi starts with `--no-mcp`. */
  readonly noMcp: boolean;
  /** Whether the user or project settings hold `-builtin:mcp` when the Pi starts. */
  readonly builtinTurnedOff: boolean;
}

// `support/pi-process.ts` makes the run's root with this prefix in the temp directory.
const RUN_ROOT_PREFIX = "pi-cm-features-";

const SETTINGS_FILE = "settings.json";

const ONBOARDING_FILE = "mcp-onboarding.json";

// The `extensions` entry that turns Pi's built-in MCP off, as pi-mcp-adapter and `pi config` write it.
const BUILTIN_OFF_ENTRY = "-builtin:mcp";

const BUILTIN_SOURCE_PATH = "builtin:mcp";

// ADET-02: Pi lists a second command of the same name with a `:<n>` suffix.
const ADAPTER_COMMAND_NAME = /^mcp-adapter(?::\d+)?$/u;

const POLL_MS = 50;

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns `value` as a profile, or throws when it names no profile. */
export function parseMcpProfile(value: unknown): McpProfile {
  if (value === "adapter" || value === "builtin") {
    return value;
  }

  throw new Error(
    `the world parameter mcpImplementation is ${JSON.stringify(value)}; expected adapter or builtin`,
  );
}

/**
 * Returns the MCP implementation of a Pi from its `get_commands` listing: the
 * adapter when an extension command is named `mcp-adapter`, else built-in
 * when the extension command `mcp` comes from `builtin:mcp`, else none.
 */
export function classifyMcpImplementation(commands: readonly ListedCommand[]): McpImplementation {
  const extensionCommands = commands.filter((command) => command.source === "extension");
  if (extensionCommands.some((command) => ADAPTER_COMMAND_NAME.test(command.name))) {
    return "adapter";
  }

  if (
    extensionCommands.some(
      (command) => command.name === "mcp" && command.sourcePath === BUILTIN_SOURCE_PATH,
    )
  ) {
    return "builtin";
  }

  return "none";
}

/** Returns the MCP implementation that `launch` implies (P1-DC-14). */
export function expectedMcpImplementation(launch: McpLaunch): McpImplementation {
  if (launch.adapterLoaded) {
    return "adapter";
  }

  return launch.noMcp || launch.builtinTurnedOff ? "none" : "builtin";
}

// Returns `name` in `directory` after checking that the directory resolves
// under the run's root (T-01-14). The directory must exist.
async function runFile(directory: string, name: string): Promise<string> {
  const temporary = await realpath(tmpdir());
  const resolved = await realpath(directory);
  const [first, ...rest] = path.relative(temporary, resolved).split(path.sep);
  if (first?.startsWith(RUN_ROOT_PREFIX) !== true || rest.length === 0) {
    throw new Error(`${directory} is outside the run's root under ${temporary}`);
  }

  return path.join(resolved, name);
}

// Writes `text` to `file` through a temporary file and a rename, so Pi never
// reads a half-written file.
async function replaceFile(file: string, text: string): Promise<void> {
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, text, { flag: "wx" });
  await rename(temporary, file);
}

// The `extensions` entries of the Pi settings file `file`, none when it is absent.
async function settingsExtensions(file: string): Promise<readonly unknown[]> {
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error: unknown) {
    if (isMissing(error)) {
      return [];
    }

    throw error;
  }

  const settings: unknown = JSON.parse(text);
  const extensions = isRecord(settings) ? settings.extensions : undefined;
  return Array.isArray(extensions) ? (extensions as unknown[]) : [];
}

/**
 * Returns whether the `extensions` of `<agentDir>/settings.json` or of
 * `<projectDir>/.pi/settings.json` hold `-builtin:mcp`.
 */
export async function readBuiltinTurnedOff(agentDir: string, projectDir: string): Promise<boolean> {
  const files = await Promise.all([
    runFile(agentDir, SETTINGS_FILE),
    runFile(projectDir, path.join(".pi", SETTINGS_FILE)),
  ]);
  const entries = await Promise.all(files.map((file) => settingsExtensions(file)));
  return entries.some((extensions) => extensions.includes(BUILTIN_OFF_ENTRY));
}

// The onboarding file that pi-mcp-adapter `version` writes once it has turned
// Pi's built-in MCP off, so it does not turn it off again.
function adapterOnboardingSeedText(version: string): string {
  return JSON.stringify({
    version: 1,
    sharedConfigHintShown: false,
    setupCompleted: false,
    piBuiltinMcpHandledVersion: version,
  });
}

/** Writes the onboarding seed of pi-mcp-adapter `version` to a new `<agentDir>/mcp-onboarding.json`. */
export async function writeAdapterOnboardingSeed(agentDir: string, version: string): Promise<void> {
  const file = await runFile(agentDir, ONBOARDING_FILE);
  const text = adapterOnboardingSeedText(version);
  await writeFile(file, text, { flag: "wx" });
  assert.strictEqual(await readFile(file, "utf8"), text);
}

/**
 * Removes `<agentDir>/mcp-onboarding.json` when it holds exactly the seed of
 * pi-mcp-adapter `version`, so the adapter's next start makes its real
 * first-run write. A file the adapter wrote itself stays.
 */
export async function removeAdapterOnboardingSeed(
  agentDir: string,
  version: string,
): Promise<void> {
  const file = await runFile(agentDir, ONBOARDING_FILE);
  let text: string;
  try {
    text = await readFile(file, "utf8");
  } catch (error: unknown) {
    if (isMissing(error)) {
      return;
    }

    throw error;
  }

  if (text === adapterOnboardingSeedText(version)) {
    await rm(file);
  }
}

// The adapter version that `<agentDir>/mcp-onboarding.json` records, if any.
async function handledVersion(file: string): Promise<unknown> {
  try {
    const state: unknown = JSON.parse(await readFile(file, "utf8"));
    return isRecord(state) ? state.piBuiltinMcpHandledVersion : undefined;
  } catch (error: unknown) {
    // The adapter replaces the file through a rename, so a read sees no file
    // or a whole one.
    if (isMissing(error)) {
      return undefined;
    }

    throw error;
  }
}

/**
 * Waits until `<agentDir>/mcp-onboarding.json` records pi-mcp-adapter
 * `version`, which the adapter writes after its settings edit, and fails
 * after `timeoutMs`.
 */
export async function waitForAdapterOnboarding(
  agentDir: string,
  version: string,
  timeoutMs: number,
): Promise<void> {
  const file = await runFile(agentDir, ONBOARDING_FILE);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const recorded = await handledVersion(file);
    if (recorded === version) {
      return;
    }

    if (Date.now() >= deadline) {
      assert.fail(
        `pi-mcp-adapter ${version} recorded no onboarding within ${timeoutMs} ms; ${ONBOARDING_FILE} records ${JSON.stringify(recorded)}`,
      );
    }

    await delay(POLL_MS);
  }
}

// Replaces the `extensions` of `<agentDir>/settings.json` with what `change`
// returns for them, keeping every other member, creating the file when it is
// absent, and checking that the file holds the new entries.
async function changeUserExtensions(
  agentDir: string,
  change: (extensions: readonly unknown[]) => readonly unknown[],
): Promise<void> {
  const file = await runFile(agentDir, SETTINGS_FILE);
  let settings: Readonly<Record<string, unknown>> = {};
  try {
    const parsed: unknown = JSON.parse(await readFile(file, "utf8"));
    assert.ok(isRecord(parsed), `${file} holds no settings object`);
    settings = parsed;
  } catch (error: unknown) {
    if (!isMissing(error)) {
      throw error;
    }
  }

  const extensions = Array.isArray(settings.extensions) ? (settings.extensions as unknown[]) : [];
  const changed = change(extensions);
  await replaceFile(file, `${JSON.stringify({ ...settings, extensions: changed }, null, 2)}\n`);
  assert.deepStrictEqual(await settingsExtensions(file), changed);
}

/**
 * Adds `-builtin:mcp` to the `extensions` of `<agentDir>/settings.json`, as
 * pi-mcp-adapter or a user does, and fails when it is already there.
 */
export async function turnOffBuiltinMcp(agentDir: string): Promise<void> {
  await changeUserExtensions(agentDir, (extensions) => {
    assert.ok(!extensions.includes(BUILTIN_OFF_ENTRY), "Pi's built-in MCP is already turned off");
    return [...extensions, BUILTIN_OFF_ENTRY];
  });
}

/**
 * Removes `-builtin:mcp` from the `extensions` of `<agentDir>/settings.json`,
 * as a user does (P1-DC-08), and fails when it is not there.
 */
export async function turnOnBuiltinMcp(agentDir: string): Promise<void> {
  await changeUserExtensions(agentDir, (extensions) => {
    assert.ok(extensions.includes(BUILTIN_OFF_ENTRY), "Pi's built-in MCP is not turned off");
    return extensions.filter((entry) => entry !== BUILTIN_OFF_ENTRY);
  });
}

/**
 * Returns the pids that the pid files of the stub MCP servers in `harness`
 * name, none when the directory is absent.
 */
export async function stubPidsIn(harness: string): Promise<readonly number[]> {
  let names: readonly string[];
  try {
    await runFile(harness, ".");
    names = await stubPidFiles(harness);
  } catch (error: unknown) {
    if (isMissing(error)) {
      return [];
    }

    throw error;
  }

  const texts = await Promise.all(names.map((name) => readFile(path.join(harness, name), "utf8")));
  return texts.map((text, index) => {
    const pid = Number(text.trim());
    assert.ok(Number.isInteger(pid) && pid > 0, `${names[index]} names no pid: ${text}`);
    return pid;
  });
}

/** Waits until every process of `pids` has exited, and fails with the live ones after `timeoutMs`. */
export async function waitUntilProcessesExit(
  pids: readonly number[],
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const running = pids.filter((pid) => isRunning(pid));
    if (running.length === 0) {
      return;
    }

    if (Date.now() >= deadline) {
      assert.fail(`these processes still run after ${timeoutMs} ms: ${running.join(", ")}`);
    }

    await delay(POLL_MS);
  }
}
