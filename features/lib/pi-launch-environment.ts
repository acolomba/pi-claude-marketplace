/**
 * @fileoverview The environment a user starts Pi with, which a profile Pi
 * cannot otherwise receive: its environment is the run's allowlist plus
 * `TMPDIR` (HAR-05).
 *
 * A step writes the variables to `<home>/pi-launch-environment.json` before
 * the profile Pi starts, and the profile Pi loads this module as an
 * extension. When Pi loads it, before any session starts, it copies each
 * variable into Pi's `process.env` and logs them to
 * `<harness dir>/pi-launch-environment.jsonl`, so the step can check that
 * they arrived. Everything Pi starts after that, such as an MCP server
 * pi-mcp-adapter spawns, inherits them, as it would from the user's shell.
 * The file lies in the sandbox home, which the next scenario's `Before()`
 * empties.
 */

import { appendFileSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { harnessDirectory } from "./turn-records.ts";

/** The absolute path of this file, which a profile Pi loads as an extension. */
export const PI_LAUNCH_ENVIRONMENT_EXTENSION = fileURLToPath(import.meta.url);

const VARIABLES_FILE = "pi-launch-environment.json";
const LOG_FILE = "pi-launch-environment.jsonl";

function parseVariables(text: string): Readonly<Record<string, string>> {
  const parsed: unknown = JSON.parse(text);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed) ||
    !Object.values(parsed).every((value) => typeof value === "string")
  ) {
    throw new Error(`the launch environment is not an object of strings: ${text}`);
  }

  return parsed as Readonly<Record<string, string>>;
}

/**
 * Writes `variables` as the launch environment of the next profile Pi in the
 * sandbox home `home`, which must not hold one yet, and returns the path of
 * the file.
 */
export async function writeLaunchEnvironment(
  home: string,
  variables: Readonly<Record<string, string>>,
): Promise<string> {
  const file = path.join(home, VARIABLES_FILE);
  await mkdir(home, { recursive: true });
  await writeFile(file, `${JSON.stringify(variables)}\n`, { flag: "wx" });
  return file;
}

/**
 * Returns the variables each profile Pi that loaded this extension copied
 * into its environment, one object per Pi, read from the harness directory
 * `harness`.
 */
export async function readAppliedLaunchEnvironments(
  harness: string,
): Promise<Readonly<Record<string, string>>[]> {
  const text = await readFile(path.join(harness, LOG_FILE), "utf8");
  return text
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => parseVariables(line));
}

// fallow-ignore-next-line unused-export -- Pi's --extension loader reads this default.
export default function launchEnvironment(): void {
  const home = process.env.HOME;
  if (home === undefined || home === "") {
    throw new Error("the launch environment needs HOME to find its file");
  }

  const variables = parseVariables(readFileSync(path.join(home, VARIABLES_FILE), "utf8"));
  Object.assign(process.env, variables);
  appendFileSync(path.join(harnessDirectory(home), LOG_FILE), `${JSON.stringify(variables)}\n`);
}
