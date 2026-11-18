/**
 * @fileoverview A sandbox stand-in for GitHub's `gh` CLI.
 *
 * A scenario places the stand-in ahead of the system `PATH` in its profile Pi's
 * launch environment. Each invocation appends its arguments and
 * `GH_PROMPT_DISABLED` to `<harness>/github-cli.jsonl`, then prints the
 * configured token for `github.com` or exits 1 when signed out.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { writeLaunchEnvironment } from "./pi-launch-environment.ts";

/** File name of the JSONL call log inside a profile Pi's harness directory. */
export const GITHUB_CLI_LOG = "github-cli.jsonl";

export type GitHubCliStandInState =
  { readonly signedIn: false } | { readonly signedIn: true; readonly token: string };

export interface GitHubCliCall {
  readonly arguments: readonly string[];
  readonly promptDisabled: string | null;
}

export interface InstalledGitHubCliStandIn {
  readonly binDirectory: string;
  readonly launchFile: string;
}

function standInModuleSource(state: GitHubCliStandInState): string {
  return [
    'import { appendFileSync, mkdirSync } from "node:fs";',
    'import path from "node:path";',
    "",
    `const STATE = ${JSON.stringify(state)};`,
    "const home = process.env.HOME;",
    'if (home === undefined || home === "") {',
    "  process.exit(2);",
    "}",
    "",
    'const harness = path.join(home, "harness");',
    "mkdirSync(harness, { recursive: true });",
    "const args = process.argv.slice(2);",
    "const record = {",
    "  arguments: args,",
    "  promptDisabled: process.env.GH_PROMPT_DISABLED ?? null,",
    "};",
    `appendFileSync(path.join(harness, ${JSON.stringify(GITHUB_CLI_LOG)}), JSON.stringify(record) + "\\n");`,
    "",
    "if (",
    "  STATE.signedIn &&",
    "  args.length === 4 &&",
    '  args[0] === "auth" &&',
    '  args[1] === "token" &&',
    '  args[2] === "--hostname" &&',
    '  args[3] === "github.com"',
    ") {",
    '  process.stdout.write(STATE.token + "\\n");',
    "  process.exit(0);",
    "}",
    "",
    "process.exit(1);",
    "",
  ].join("\n");
}

function parseCall(line: string): GitHubCliCall {
  const parsed: unknown = JSON.parse(line);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`invalid gh cli log line: ${line}`);
  }

  const record = parsed as Record<string, unknown>;
  const args = record.arguments;
  const promptDisabled = record.promptDisabled;
  if (
    !Array.isArray(args) ||
    !args.every((item): item is string => typeof item === "string") ||
    (promptDisabled !== null && typeof promptDisabled !== "string")
  ) {
    throw new Error(`invalid gh cli log record: ${line}`);
  }

  return { arguments: args, promptDisabled };
}

/**
 * Writes the `gh` stand-in into `<home>/gh-bin` and records `PATH` in the next
 * profile Pi's launch environment.
 */
export async function installGitHubCliStandIn(
  home: string,
  state: GitHubCliStandInState,
): Promise<InstalledGitHubCliStandIn> {
  const binDirectory = path.join(home, "gh-bin");
  const modulePath = path.join(binDirectory, "gh-stand-in.mjs");
  const posixWrapper = path.join(binDirectory, "gh");
  const windowsWrapper = path.join(binDirectory, "gh.cmd");
  await mkdir(binDirectory, { recursive: true });
  await writeFile(modulePath, standInModuleSource(state), { flag: "wx", mode: 0o600 });
  await writeFile(posixWrapper, `#!/bin/sh\nexec "${process.execPath}" "${modulePath}" "$@"\n`, {
    flag: "wx",
    mode: 0o755,
  });
  await writeFile(windowsWrapper, `@"${process.execPath}" "${modulePath}" %*\r\n`, {
    flag: "wx",
    mode: 0o755,
  });
  const launchFile = await writeLaunchEnvironment(home, {
    PATH: `${binDirectory}${path.delimiter}${process.env.PATH ?? ""}`,
  });
  return { binDirectory, launchFile };
}

/** Reads every recorded `gh` call from `harness`, in call order. */
export async function readGitHubCliCalls(harness: string): Promise<GitHubCliCall[]> {
  const logPath = path.join(harness, GITHUB_CLI_LOG);
  if (!existsSync(logPath)) {
    return [];
  }

  const text = await readFile(logPath, "utf8");
  return text
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => parseCall(line));
}
