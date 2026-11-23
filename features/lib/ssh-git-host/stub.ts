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
 * with `git upload-pack` in the hermetic environment. It answers `ssh -G` and
 * a probe launch with no remote command as the host's arm scripts, with the
 * strings and exit codes Claude Code 2.1.330 reads. A held probe answers
 * nothing until its caller kills it, and it ends on its own when its caller
 * dies or after a hard limit, so a killed caller leaves no stub running. Of
 * its own environment it reads only
 * `GIT_PROTOCOL`, which git sends for protocol v2 (SG-HRN-03, DRV-03).
 */

import { spawn } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  configLines,
  destinationParts,
  HOME_DIRECTORY,
  HOSTS_FILE,
  isSshHostsFile,
  LAUNCHES_FILE,
  parseSshLaunch,
  probeAnswer,
  servedRepository,
  uploadPackEnvironment,
  uploadPackPath,
} from "./launch.ts";

import type { SshHostArm, SshHostsFile, SshLaunch, SshLaunchRecord } from "./launch.ts";

/** The absolute path of this module, which the stand-in's wrapper runs. */
export const STUB_ENTRY = fileURLToPath(import.meta.url);

// OpenSSH's exit code for a failure of ssh itself, such as an unknown host.
const SSH_FAILURE = 255;

// git's exit code for a fatal error, such as a path that names no repository.
const GIT_FATAL = 128;

// The stub's caller, read when the module loads, before the launch is
// recorded. A caller that dies after the record is still the parent this
// read saw, so a held probe sees the death.
const CALLER_PID = process.ppid;

// A held probe checks this often whether its caller still runs. Once the
// caller dies, the stub's parent becomes another process.
const HOLD_POLL_MS = 1_000;

// A held probe ends on its own after this long. It is far longer than any
// timeout a caller gives a probe, so only a stub whose caller kept no
// timeout reaches it.
const HOLD_LIMIT_MS = 5 * 60_000;

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

/** Prints the config `ssh -G` resolves for `launch` to a registered host. */
function printConfig(launch: SshLaunch, destination: string, arm: SshHostArm): void {
  const port = launch.options.filter((option) => option.name === "-p").at(-1)?.value;
  process.stdout.write(`${configLines(destination, port, arm.proxy).join("\n")}\n`);
  process.exitCode = 0;
}

/**
 * Keeps the stub running with no answer until a signal ends it, until its
 * caller dies, or until the hold limit passes, and then exits as ssh fails.
 */
function hold(): void {
  setInterval(() => {
    if (process.ppid !== CALLER_PID) {
      process.exit(SSH_FAILURE);
    }
  }, HOLD_POLL_MS);
  setTimeout(() => {
    process.exit(SSH_FAILURE);
  }, HOLD_LIMIT_MS);
}

/** Answers a probe of `destination` as `arm` scripts, or holds it with no answer. */
function answerProbe(destination: string, arm: SshHostArm): void {
  const answered = probeAnswer(arm.probe, destination);
  if (answered === "hold") {
    hold();
    return;
  }

  process.stderr.write(answered.stderr);
  process.exitCode = answered.exitCode;
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
  const arm = hostArm(hosts, host);
  if (arm === undefined) {
    fail(`ssh: Could not resolve hostname ${host}: Name or service not known`, SSH_FAILURE);
    return;
  }

  if (launch.printConfig) {
    printConfig(launch, launch.destination, arm);
    return;
  }

  if (launch.command === "") {
    answerProbe(launch.destination, arm);
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
