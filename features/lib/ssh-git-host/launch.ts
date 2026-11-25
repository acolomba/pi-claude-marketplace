/**
 * @fileoverview One launch of the SSH stand-in's stub `ssh`.
 *
 * git runs `ssh <options> <destination> "git-upload-pack '<path>'"` for an
 * SSH remote, and a probe runs `ssh <options> <destination>` with no remote
 * command. This module reads such an argument list with a closed table of the
 * options that take a value, names the hosts a run registers and the scripted
 * answer of each, holds the shape of the record every launch appends to the
 * stand-in's launch log, and builds the environment of the `git upload-pack`
 * that serves a transport launch (SG-HRN-03, DRV-03). The stub and the
 * stand-in that writes its files share these names, so both read the same
 * files the same way.
 */

import path from "node:path";

import { hermeticGitEnvironment } from "../hermetic-git.ts";

/** The file under the stand-in directory that names the registered hosts. */
export const HOSTS_FILE = "hosts.json";

/** The file under the stand-in directory that holds one JSON line per launch. */
export const LAUNCHES_FILE = "launches.jsonl";

/** The scratch HOME, under the stand-in directory, of every `git upload-pack` the stub runs. */
export const HOME_DIRECTORY = "home";

/**
 * The scripted answer a registered host gives a probe launch. A
 * `no-repository` host authenticates its user, as `authenticated` does, but
 * answers every transport launch as GitHub answers a repository the user
 * cannot reach.
 */
export type SshProbeArm =
  | { readonly kind: "authenticated"; readonly user: string }
  | { readonly kind: "no-repository"; readonly user: string }
  | { readonly kind: "denied" }
  | { readonly kind: "host-key" }
  | { readonly kind: "hold" };

/** A registered host: its probe answer and the extra `ssh -G` line, if any. */
export interface SshHostArm {
  readonly probe: SshProbeArm;
  readonly proxy?: string;
}

/** One line of the launch log. */
export interface SshLaunchRecord {
  readonly pid: number;
  readonly argv: readonly string[];
  readonly gitProtocol?: string;
}

/** The file the stub reads at each launch: where repositories live, and the hosts. */
export interface SshHostsFile {
  readonly repositoriesRoot: string;
  readonly hosts: Readonly<Record<string, SshHostArm>>;
}

/** One option of a launch, with its value when the option takes one. */
export interface SshOption {
  readonly name: string;
  readonly value?: string;
}

/** A parsed launch: its options, whether it prints its config, its destination, and its command. */
export interface SshLaunch {
  readonly options: readonly SshOption[];
  /** Whether the launch is `ssh -G`, which prints the resolved config. */
  readonly printConfig: boolean;
  readonly destination: string | undefined;
  /** The remote command, its arguments joined with a space; `""` for a probe. */
  readonly command: string;
}

// The OpenSSH options that take a value, detached (`-p 2222`) or attached (`-p2222`).
const OPTIONS_WITH_VALUE = new Set([
  "-B",
  "-b",
  "-c",
  "-D",
  "-E",
  "-e",
  "-F",
  "-I",
  "-i",
  "-J",
  "-L",
  "-l",
  "-m",
  "-O",
  "-o",
  "-p",
  "-Q",
  "-R",
  "-S",
  "-W",
  "-w",
]);

const UPLOAD_PACK = /^git-upload-pack '(.*)'$/s;

/** Reads the option at `argv[index]` and returns it with the index of the next argument. */
function readOption(argv: readonly string[], index: number): [SshOption, number] {
  const token = argv[index] ?? "";
  const name = token.slice(0, 2);
  if (!OPTIONS_WITH_VALUE.has(name)) {
    return [{ name: token }, index + 1];
  }

  if (token.length > 2) {
    return [{ name, value: token.slice(2) }, index + 1];
  }

  const value = argv[index + 1];
  return [value === undefined ? { name } : { name, value }, index + 2];
}

/** Reads the leading options of `argv`, then its destination and remote command. */
export function parseSshLaunch(argv: readonly string[]): SshLaunch {
  const options: SshOption[] = [];
  let index = 0;
  while (argv[index]?.startsWith("-") === true) {
    const [option, next] = readOption(argv, index);
    options.push(option);
    index = next;
  }

  return {
    options,
    printConfig: options.some((option) => option.name === "-G"),
    destination: argv[index],
    command: argv.slice(index + 1).join(" "),
  };
}

/** Returns the user and the host of `destination`, such as `git` and `github.com`. */
export function destinationParts(destination: string): {
  readonly user: string | undefined;
  readonly host: string;
} {
  const at = destination.lastIndexOf("@");
  return at === -1
    ? { user: undefined, host: destination }
    : { user: destination.slice(0, at), host: destination.slice(at + 1) };
}

/** Returns the path of a `git-upload-pack '<path>'` command, or `undefined` for any other command. */
export function uploadPackPath(command: string): string | undefined {
  return UPLOAD_PACK.exec(command)?.[1];
}

/**
 * Returns the repository under `repositoriesRoot` that `requested` names, with
 * one leading `/` dropped, as the `ssh://` form sends it. Returns `undefined`
 * when `requested` is empty, holds a quote or a NUL, or resolves outside the
 * root, so no `git upload-pack` ever starts on it.
 */
export function servedRepository(repositoriesRoot: string, requested: string): string | undefined {
  if (/['"\0]/.test(requested)) {
    return undefined;
  }

  const relative = requested.startsWith("/") ? requested.slice(1) : requested;
  const resolved = path.resolve(repositoriesRoot, relative);
  const inside = path.relative(repositoriesRoot, resolved);
  if (
    relative === "" ||
    inside === "" ||
    inside === ".." ||
    inside.startsWith(`..${path.sep}`) ||
    path.isAbsolute(inside)
  ) {
    return undefined;
  }

  return resolved;
}

/**
 * Returns the environment of the `git upload-pack` the stub runs: the suite's
 * hermetic git environment with HOME `home`, plus `GIT_PROTOCOL` when git sent
 * one, and nothing else. So the `GIT_EXEC_PATH` that git puts in the stub's
 * environment, and every other variable the stub inherits, stays out of
 * upload-pack (DRV-03).
 */
export function uploadPackEnvironment(
  home: string,
  gitProtocol: string | undefined,
): NodeJS.ProcessEnv {
  return hermeticGitEnvironment(
    home,
    gitProtocol === undefined ? {} : { GIT_PROTOCOL: gitProtocol },
  );
}

/** What the stub writes to stderr for a probe, and the code it exits with. */
export interface SshProbeAnswer {
  readonly stderr: string;
  readonly exitCode: number;
}

// ssh's own refusal of every key, which names the destination's user and host.
function deniedAnswer(destination: string): SshProbeAnswer {
  const { user, host } = destinationParts(destination);
  return { stderr: `${user ?? "git"}@${host}: Permission denied (publickey).\n`, exitCode: 255 };
}

// ssh's own refusal of a host whose key it does not know.
const HOST_KEY_ANSWER: SshProbeAnswer = {
  stderr: "Host key verification failed.\n",
  exitCode: 255,
};

/**
 * Returns the answer of the arm `arm` to a probe of `destination`, or `"hold"`
 * when the stub answers nothing until its caller kills it. The strings and
 * exit codes are the ones Claude Code 2.1.330 reads: success is exit 1 with
 * `successfully authenticated`, and a not-configured answer is exit 255 with
 * `Permission denied (publickey` or `Host key verification failed`. The denied
 * line names the destination's user, `git` when it names none, and its host.
 */
export function probeAnswer(arm: SshProbeArm, destination: string): SshProbeAnswer | "hold" {
  switch (arm.kind) {
    case "authenticated":
    case "no-repository":
      return {
        stderr: `Hi ${arm.user}! You've successfully authenticated, but GitHub does not provide shell access.\n`,
        exitCode: 1,
      };
    case "denied":
      return deniedAnswer(destination);
    case "host-key":
      return HOST_KEY_ANSWER;
    case "hold":
      return "hold";
  }
}

/**
 * Returns the answer of the arm `arm` to a transport launch to `destination`,
 * such as git's `git-upload-pack`, or `undefined` when the stub serves the
 * launch. A `denied` or `host-key` host refuses it with the text and the exit
 * code of its probe answer, as a real ssh refuses both before any command
 * runs. A `no-repository` host answers as GitHub does for a repository the
 * user cannot reach: `ERROR: Repository not found.` and exit 1. An
 * `authenticated` host serves the launch, and so does a `hold` host, whose
 * hold is for probes only.
 */
export function transportRefusal(
  arm: SshProbeArm,
  destination: string,
): SshProbeAnswer | undefined {
  switch (arm.kind) {
    case "denied":
      return deniedAnswer(destination);
    case "host-key":
      return HOST_KEY_ANSWER;
    case "no-repository":
      return { stderr: "ERROR: Repository not found.\n", exitCode: 1 };
    case "authenticated":
    case "hold":
      return undefined;
  }
}

/**
 * Returns the lines `ssh -G <destination>` prints: `host`, `user` (`git` when
 * the destination names none), `hostname`, and `port` (22 unless `-p` named
 * one), then the arm's proxy line when it names one. Claude Code 2.1.330 runs
 * `ssh -G git@github.com` to find a `proxycommand` or `proxyjump` line.
 */
export function configLines(
  destination: string,
  port: string | undefined,
  proxy: string | undefined,
): string[] {
  const { user, host } = destinationParts(destination);
  return [
    `host ${host}`,
    `user ${user ?? "git"}`,
    `hostname ${host}`,
    `port ${port ?? "22"}`,
    ...(proxy === undefined ? [] : [proxy]),
  ];
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProbeArm(value: unknown): value is SshProbeArm {
  if (!isRecord(value)) {
    return false;
  }

  switch (value.kind) {
    case "authenticated":
    case "no-repository":
      return typeof value.user === "string";
    case "denied":
    case "host-key":
    case "hold":
      return true;
    default:
      return false;
  }
}

function isHostArm(value: unknown): value is SshHostArm {
  return (
    isRecord(value) &&
    isProbeArm(value.probe) &&
    (value.proxy === undefined || typeof value.proxy === "string")
  );
}

/** Returns whether `value` is a hosts file the stand-in wrote. */
export function isSshHostsFile(value: unknown): value is SshHostsFile {
  return (
    isRecord(value) &&
    typeof value.repositoriesRoot === "string" &&
    isRecord(value.hosts) &&
    Object.values(value.hosts).every((arm) => isHostArm(arm))
  );
}

/** Returns whether `value` is one record of the launch log. */
export function isSshLaunchRecord(value: unknown): value is SshLaunchRecord {
  return (
    isRecord(value) &&
    Number.isInteger(value.pid) &&
    Array.isArray(value.argv) &&
    value.argv.every((argument) => typeof argument === "string") &&
    (value.gitProtocol === undefined || typeof value.gitProtocol === "string")
  );
}
