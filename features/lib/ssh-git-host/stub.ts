/**
 * @fileoverview The stub `ssh` of the SSH stand-in.
 *
 * The stand-in's generated `bin/ssh` wrapper runs this module with the
 * absolute Node path and the stand-in directory as its fixed first argument;
 * the rest are ssh's own arguments. So the stub needs no variable in Pi's
 * environment, and it finds the hosts file and the launch log from that
 * directory. It appends every launch to the log, then answers a host the run
 * did not register as an unreachable host, so no scenario reaches a real ssh
 * server, and serves a `git-upload-pack` command from the repositories root
 * with `git upload-pack` in the hermetic environment. Of its own environment
 * it reads only `GIT_PROTOCOL`, which git sends for protocol v2 (SG-HRN-03,
 * DRV-03).
 */

import { spawn } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  destinationParts,
  HOME_DIRECTORY,
  HOSTS_FILE,
  isSshHostsFile,
  LAUNCHES_FILE,
  parseSshLaunch,
  servedRepository,
  uploadPackEnvironment,
  uploadPackPath,
} from "./launch.ts";

import type { SshHostArm, SshHostsFile, SshLaunchRecord } from "./launch.ts";

/** The absolute path of this module, which the stand-in's wrapper runs. */
export const STUB_ENTRY = fileURLToPath(import.meta.url);

// OpenSSH's exit code for a failure of ssh itself, such as an unknown host.
const SSH_FAILURE = 255;

// git's exit code for a fatal error, such as a path that names no repository.
const GIT_FATAL = 128;

/** Writes `message` as one stderr line and sets the stub's exit code. */
function fail(message: string, exitCode: number): void {
  process.stderr.write(`${message}\n`);
  process.exitCode = exitCode;
}

/** Appends one whole JSON line for this launch to the launch log. */
async function recordLaunch(directory: string, argv: readonly string[]): Promise<void> {
  const gitProtocol = process.env.GIT_PROTOCOL;
  const record: SshLaunchRecord =
    gitProtocol === undefined
      ? { pid: process.pid, argv }
      : { pid: process.pid, argv, gitProtocol };
  await appendFile(path.join(directory, LAUNCHES_FILE), `${JSON.stringify(record)}\n`);
}

/** Reads and checks the hosts file the stand-in wrote. */
async function readHosts(directory: string): Promise<SshHostsFile> {
  const parsed: unknown = JSON.parse(await readFile(path.join(directory, HOSTS_FILE), "utf8"));
  if (!isSshHostsFile(parsed)) {
    throw new Error(`the ssh stand-in's ${HOSTS_FILE} is not a hosts file`);
  }

  return parsed;
}

/** Returns the arm of `host`, or `undefined` when the run did not register it. */
function hostArm(hosts: SshHostsFile, host: string): SshHostArm | undefined {
  return Object.hasOwn(hosts.hosts, host) ? hosts.hosts[host] : undefined;
}

/** Runs `git upload-pack` on the repository `requested` names, on the stub's own stdio. */
async function serveUploadPack(
  directory: string,
  hosts: SshHostsFile,
  requested: string,
): Promise<void> {
  const repository = servedRepository(hosts.repositoriesRoot, requested);
  if (repository === undefined) {
    fail(`fatal: '${requested}' does not appear to be a git repository`, GIT_FATAL);
    return;
  }

  const child = spawn("git", ["upload-pack", "--strict", repository], {
    stdio: "inherit",
    env: uploadPackEnvironment(path.join(directory, HOME_DIRECTORY), process.env.GIT_PROTOCOL),
  });
  process.exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (exitCode: number | null) => {
      resolve(exitCode ?? GIT_FATAL);
    });
  });
}

/** Answers the launch whose ssh arguments are `argv`. */
async function answer(directory: string, argv: readonly string[]): Promise<void> {
  await recordLaunch(directory, argv);
  const launch = parseSshLaunch(argv);
  if (launch.destination === undefined) {
    fail("usage: ssh destination [command]", SSH_FAILURE);
    return;
  }

  const hosts = await readHosts(directory);
  const { host } = destinationParts(launch.destination);
  if (hostArm(hosts, host) === undefined) {
    fail(`ssh: Could not resolve hostname ${host}: Name or service not known`, SSH_FAILURE);
    return;
  }

  const requested = uploadPackPath(launch.command);
  if (requested !== undefined) {
    await serveUploadPack(directory, hosts, requested);
    return;
  }

  fail(`ssh stand-in: no answer for ${JSON.stringify(argv)}`, SSH_FAILURE);
}

if (process.argv[1] === STUB_ENTRY) {
  const [, , directory, ...argv] = process.argv;
  if (directory === undefined) {
    throw new Error("usage: stub.ts <stand-in directory> [ssh arguments]");
  }

  await answer(directory, argv);
}
