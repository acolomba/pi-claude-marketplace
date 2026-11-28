// platform/git-process.ts
//
// D-SG-01: the extension runs the user's system git, with no fallback. Every
// git process it starts comes from this module. A run passes an argument array
// to an absolute git path, with no shell, through the shared launcher
// (platform/process-run.ts). git's stdin is closed, and the launcher's timeout
// stops the whole process tree (SG-PRC-01).
//
// D-SG-04: git is looked up in the absolute entries of PATH only. A relative
// or empty entry resolves against the child's working directory, so a
// repository could plant its own git there. On Windows only git.exe runs.
// Node cannot start a git.cmd or a git.bat without a shell (D-PL9-18), so one
// found first is refused, and a candidate inside Pi's working directory is
// skipped. On macOS, a git whose real path is /usr/bin/git is the xcrun shim
// unless a developer directory holds a real git; the lookup refuses the shim
// before any spawn, because running it opens the Command Line Tools installer.
// Each instance keeps a found git per PATH and working directory. It never
// keeps a miss, so a git installed after a failure is found by the next
// command without a Pi restart (NFR-2). A run that finds its git gone (a start
// error with the file missing, an exit 127, or an `xcrun: error:` stderr)
// drops the found git, so the next lookup searches PATH again.
//
// D-SG-05, SG-PRC-02, SG-PRC-03: one builder hardens every command. The `-c`
// pairs turn off hooks, fsmonitor, askpass, template hooks, and the ext, fd,
// git, ftp, and ftps transports. The environment forces the non-interactive
// values over the user's own, removes the variables that point git at another
// repository, and sets `LC_MESSAGES=C` so a failure reads the same in every
// locale. `GIT_CEILING_DIRECTORIES` is set to the parent of the real working
// directory, because git ignores a ceiling that equals its working directory.
// The user's own git configuration stays: HOME, the global and system config
// files, GIT_CONFIG_COUNT and its keys, GIT_CONFIG_PARAMETERS, credential
// helpers, and proxies. A request's own `-c` pairs (D-SG-16), such as an
// `insteadOf` rewrite, come before the module's pairs. git keeps the last
// value of a single-valued key, so no request pair can undo the hardening.
//
// SG-PRC-03: a request without a working directory runs in the neutral
// directory, a private, empty directory that platform/git-neutral-directory.ts
// makes and checks before each use. The ceiling at its parent keeps git out of
// every other directory, so neither the repository Pi runs in nor a
// repository planted in a shared directory steers the command. Every command
// also carries `safe.bareRepository=explicit`, so git never takes the
// directory it runs in for a bare repository it was not pointed at.
//
// SG-PRC-01, E7: a request carries Pi's own flags as options and the data a
// marketplace controls as operands. Each subcommand's operand rule puts the
// operands after the options, behind `--end-of-options` where git accepts
// it, so git never reads an operand as an option. A request whose operands
// break its rule starts no process.
//
// D-SG-02, SG-PRC-04: a request runs on one of two lanes. The local lane is
// upstream's network-free lane: GIT_ALLOW_PROTOCOL=/ names no transport, and
// no user config can re-allow one, while a user's `protocol.<name>.allow=
// always` does beat `-c protocol.allow=never`. GIT_SSH_COMMAND=false, the
// remote-helper aliases, and the lane's `-c` pairs close the rest. Unlike
// upstream's lane, it keeps the user's git configuration. No production
// caller uses the local lane until the clone transport moves to system git.
// The network lane keeps the user's GIT_ALLOW_PROTOCOL without ext, fd, git,
// ftp, and ftps. The user's list still decides every other transport,
// remote helpers included, as git's allow-list does, and no config can
// re-allow a transport the list leaves out (D-SG-05).
//
// D-SG-05, SG-PRC-02, Q14 `nn`: a network-lane clone, fetch, or ls-remote
// runs the user's own ssh in batch mode. The module first reads
// `core.sshCommand` and `ssh.variant` with one local-lane `git config` in the
// neutral directory. The user's command is a non-empty GIT_SSH_COMMAND, else
// that `core.sshCommand`, else GIT_SSH quoted for `sh`, else `ssh`. The
// variant is GIT_SSH_VARIANT, else `ssh.variant`, else the base name of the
// command's first word. Pi appends `-o BatchMode=yes -o
// StrictHostKeyChecking=yes`, or `-batch` for plink and putty, and nothing
// for tortoiseplink. The result is GIT_SSH_COMMAND, which git reads before
// any config scope, so a repository's own `core.sshCommand` never runs.
// GIT_SSH goes. The command starts with `CDPATH= cd -- <neutral directory>`,
// so ssh never runs in the repository, and git then reads `CDPATH=` as the
// program's name. D-SG-08: so unless the user set GIT_SSH_VARIANT, the
// module exports the variant it resolved as GIT_SSH_VARIANT: the user's
// `ssh.variant`, else the base name when it names one of git's variants
// (ssh, plink, putty, tortoiseplink). Without it, git would check the
// variant with a `<command> -G` launch, which plink and tortoiseplink fail,
// and then run them as `simple`, which takes no port and gives tortoiseplink
// no `-batch`. Any other base name keeps git's own check. D-SG-03: no option
// controls host-key updates; ssh's own default applies.
//
// SG-PRC-01, WR-06: a request's timeout bounds the whole command. The ssh
// read and the run share one deadline, so each launch gets only the time left,
// and a command with no time left starts nothing.
//
// SG-PRC-05: a run that exits with a code its request does not allow rejects
// with the kind platform/git-failure-kind.ts reads from the exit code and the
// C-locale stderr. D-SG-35: the kind is read from git's raw stderr, and the
// error holds that stderr redacted in Claude Code's order: the spellings of
// the request's remote URL that carry a secret first, then the credential
// rules, then the absolute paths, line by line (`redactShownText` in
// shared/redact-absolute-paths.ts). A network request's error also carries
// its remote. The error's message never holds stderr. D-SG-06: after a
// `git-too-old` failure, and only then, the
// module reads `git version` once and writes it to the debug log. The read
// stops when the request's signal aborts.
//
// SG-SSH-02: the module also runs the user's own ssh for a closed set of
// launches, each with a fixed argument list and a fixed limit. ssh is looked
// up in the absolute entries of PATH only, as git is, and on Windows only
// ssh.exe runs. A miss starts nothing and is never kept. A launch runs in the
// neutral directory (Claude Code runs it in the home directory; the result is
// the same), with the base environment unchanged, so the user's agent socket
// reaches ssh, and with stdin closed. Its timeout stops the whole process
// tree. No debug log names the command, because a user's ssh arguments can
// name key files.
//
// D-SG-01, D-PL9-11: this module is the extension's sanctioned git and ssh
// spawn site. It may import Node's child-process module, for its own spawn
// binding; the rule pack's child-process-chokepoint rule and
// test/architecture/no-shell-out.test.ts name every module that may. Only
// platform/git.ts may import this module (the GIT_PROCESS_IMPORTERS zone of
// BLOCK C in eslint.config.js).

import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";

import { hookDebugLog } from "../shared/debug-log.ts";
import { GitCommandError } from "../shared/errors.ts";
import { GITHUB_HOST } from "../shared/github-base-url.ts";
import { redactShownText } from "../shared/redact-absolute-paths.ts";

import { classifyGitExit } from "./git-failure-kind.ts";
import { createNeutralDirectory } from "./git-neutral-directory.ts";
import { getAgentDir } from "./pi-api.ts";
import { findOnWindowsPath, NODE_PROCESS_HOST, runProcess } from "./process-run.ts";

import type { GitFailure, GitRemote } from "../shared/errors.ts";
import type { OutputCapture, ProcessHost, ProcessRun, ProcessSpawn } from "./process-run.ts";

/**
 * D-SG-02: the lane a command runs on. `local` is upstream's network-free
 * lane, from which git reaches no transport; `network` may reach one.
 */
export type GitLane = "local" | "network";

/**
 * The git subcommands the extension runs. Each has an operand rule (E7); a
 * subcommand joins this set only with evidence for its own rule.
 */
export type GitSubcommand =
  | "clone"
  | "fetch"
  | "ls-remote"
  | "checkout"
  | "rev-parse"
  | "config"
  | "tag"
  | "update-ref"
  | "for-each-ref"
  | "version";

/** One git command to run. */
export interface GitRequest {
  readonly subcommand: GitSubcommand;
  readonly lane: GitLane;
  /** Pi-owned flags after the subcommand, in the order given. */
  readonly options?: readonly string[];
  /**
   * D-SG-16: Pi-owned `-c` pairs, such as an `insteadOf` rewrite. They come
   * before the module's own pairs: git keeps
   * the last value of a single-valued key, so the hardening placed after them
   * always wins (D-SG-05). They never go through GIT_CONFIG_COUNT, which the
   * module keeps for the user.
   */
  readonly config?: readonly string[];
  /**
   * SG-PRC-01: marketplace-controlled data, such as a URL, a ref, or a path.
   * The subcommand's operand rule places it after the options, where git
   * cannot read it as an option.
   */
  readonly operands?: readonly string[];
  /** The directory git runs in. Omitted, the command runs in the neutral directory. */
  readonly cwd?: string;
  /** Milliseconds before git and its process tree are stopped. */
  readonly timeoutMs: number;
  /** Stops git and its process tree when the owning operation is cancelled. */
  readonly signal?: AbortSignal;
  /** The non-zero exit codes that resolve instead of rejecting. */
  readonly allowExit?: readonly number[];
  /**
   * SG-SSH-05, upstream `Qmt`'s Windows pass: `print-config` adds ssh's `-G`
   * option, with its output sent to stderr, after the module's own ssh
   * command, so the ssh git starts prints the config it resolves and connects
   * to nothing. Only a network-lane `ls-remote` accepts it; any other request
   * that asks for it is refused before anything starts.
   */
  readonly sshTail?: "print-config";
  /**
   * D-SG-35: the remote a network request reaches, with the raw URL it sends.
   * `settleRun` replaces that URL's credential-bearing spellings in git's
   * stderr before anything else reads the stderr, and the failure carries the
   * remote with its URL redacted.
   */
  readonly remote?: GitRemote;
}

/** A run that exited with 0 or with an allowed code. */
export interface GitResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** The platform facts of a lookup and a run. */
export interface GitProcessHost extends ProcessHost {
  /** Resolves true for a regular file the process may execute; never rejects. */
  readonly isExecutable: (file: string) => Promise<boolean>;
  readonly realpath: (file: string) => Promise<string>;
  /** Pi's working directory. */
  readonly cwd: () => string;
  /** Milliseconds on a clock that never goes back. */
  readonly now: () => number;
  /**
   * Resolves with the real path of the neutral directory, and rejects when it
   * cannot be made or fails its checks.
   */
  readonly neutralDirectory: () => Promise<string>;
}

export interface GitProcessOptions {
  readonly spawn: ProcessSpawn;
  readonly host: GitProcessHost;
  /** The environment every child starts from. Read again at each lookup and run. */
  readonly env: NodeJS.ProcessEnv;
  /** Milliseconds after SIGTERM before a git that is still running gets SIGKILL. */
  readonly killGraceMs: number;
}

export interface GitProcess {
  /** The absolute path of the git to run; rejects with a `git-missing` GitCommandError. */
  readonly locate: () => Promise<string>;
  /** Resolves with the run; rejects with a GitCommandError when it failed. */
  readonly run: (request: GitRequest) => Promise<GitResult>;
}

/**
 * SG-SSH-02: the ssh launches the module runs. `github-probe` is Claude Code's
 * check of whether the user's ssh authenticates to GitHub. D-SG-18:
 * `github-config` is its `ssh -G` read of the config the user's ssh resolves
 * for GitHub, which prints that config and connects to nothing.
 */
export type SshLaunch = "github-probe" | "github-config";

/**
 * What one ssh launch did. `output` is stdout, a newline, and stderr, as
 * Claude Code reads it. `missing` means no ssh was found, so nothing started.
 */
export type SshRun =
  | {
      readonly kind: "ran";
      readonly exitCode: number | null;
      readonly output: string;
      readonly timedOut: boolean;
    }
  | { readonly kind: "missing" };

/** The git process plus the ssh launches of the same spawn site. */
export interface SystemGitProcess extends GitProcess {
  /**
   * Runs `launch` with the user's ssh. Rejects when ssh was found but could
   * not start, or when the neutral directory cannot be made.
   */
  readonly ssh: (launch: SshLaunch) => Promise<SshRun>;
}

const HOOK_NAMES = [
  "applypatch-msg",
  "pre-applypatch",
  "post-applypatch",
  "pre-commit",
  "pre-merge-commit",
  "prepare-commit-msg",
  "commit-msg",
  "post-commit",
  "pre-rebase",
  "post-checkout",
  "post-merge",
  "pre-push",
  "pre-receive",
  "update",
  "proc-receive",
  "post-receive",
  "post-update",
  "reference-transaction",
  "push-to-checkout",
  "pre-auto-gc",
  "post-rewrite",
  "sendemail-validate",
  "fsmonitor-watchman",
  "p4-changelist",
  "p4-prepare-changelist",
  "p4-post-changelist",
  "p4-pre-submit",
  "post-index-change",
] as const;

// Claude Code's alternate-refs command, which lists only the objects of the
// alternate repository itself.
const ALTERNATE_REFS_COMMAND = `f() { git --git-dir="$1" for-each-ref --format='%(objectname)'; }; f`;

// D-SG-05: Claude Code's `-c` pairs, in its order, through the transport bans.
// PIN_PAIRS follows them.
function configPairs(hooksPath: string): readonly string[] {
  return [
    "core.fsmonitor=",
    `core.hooksPath=${hooksPath}`,
    "core.askPass=",
    "protocol.ext.allow=never",
    `core.alternateRefsCommand=${ALTERNATE_REFS_COMMAND}`,
    "submodule.recurse=false",
    "log.showSignature=false",
    "format.pretty=medium",
    "gc.auto=0",
    "maintenance.auto=false",
    "diff.autoRefreshIndex=false",
    ...HOOK_NAMES.map((name) => `hook.${name}.enabled=false`),
    "protocol.fd.allow=never",
    "protocol.git.allow=never",
    "protocol.ftp.allow=never",
    "protocol.ftps.allow=never",
  ];
}

// D-SG-05: the end of Claude Code's `pinArgs`, plus `credential.interactive`
// and an empty `init.templateDir`, so a template directory copies no hook.
// SG-PRC-03: `safe.bareRepository=explicit` stops git from taking the
// directory it runs in for a bare repository. git reads the key only from
// protected config, the command line included, so a repository cannot undo it.
const PIN_PAIRS = [
  "init.defaultRefFormat=files",
  "core.longpaths=true",
  "credential.interactive=false",
  "init.templateDir=",
  "safe.bareRepository=explicit",
] as const;

// D-SG-05: the transports that configPairs bans, which a user's
// GIT_ALLOW_PROTOCOL cannot allow.
const BANNED_PROTOCOLS: ReadonlySet<string> = new Set(["ext", "fd", "git", "ftp", "ftps"]);

// A GIT_ALLOW_PROTOCOL that names no transport, as upstream's lane writes it.
const NO_PROTOCOL = "/";

// SG-PRC-01, E7: how a subcommand takes operands, from git 2.43's answers.
// `clone`, `fetch`, `ls-remote`, `config`, `tag`, `update-ref`, and
// `for-each-ref` accept `--end-of-options` before the operands; D-SG-09 reads
// the local tag list with `for-each-ref`. `rev-parse` accepts it only with
// `--verify` and otherwise prints it back, so its operands need `--verify`.
// `checkout` reads the marker as a pathspec, so an operand that starts with
// `-` is refused and `--` ends the argv, which keeps every operand a ref.
// `version` takes no operands. The marker is added once, and
// only when operands are present.
interface OperandRule {
  /** Whether the request's operands may reach git. */
  readonly accepts: (options: readonly string[], operands: readonly string[]) => boolean;
  /** The words after the subcommand. */
  readonly words: (options: readonly string[], operands: readonly string[]) => readonly string[];
}

function optionsThenMarker(options: readonly string[], operands: readonly string[]): string[] {
  return operands.length === 0 ? [...options] : [...options, "--end-of-options", ...operands];
}

const MARKER_RULE: OperandRule = { accepts: () => true, words: optionsThenMarker };

const VERIFY_MARKER_RULE: OperandRule = {
  accepts: (options, operands) => operands.length === 0 || options.includes("--verify"),
  words: optionsThenMarker,
};

const DASH_REFUSED_RULE: OperandRule = {
  accepts: (_options, operands) => !operands.some((operand) => operand.startsWith("-")),
  words: (options, operands) =>
    operands.length === 0 ? [...options] : [...options, ...operands, "--"],
};

const NO_OPERANDS_RULE: OperandRule = {
  accepts: (_options, operands) => operands.length === 0,
  words: (options) => options,
};

// A subcommand's operand rule, and whether it can reach a remote over ssh.
interface SubcommandRule {
  readonly operands: OperandRule;
  readonly ssh: boolean;
}

const SUBCOMMAND_RULES: Readonly<Record<GitSubcommand, SubcommandRule>> = {
  clone: { operands: MARKER_RULE, ssh: true },
  fetch: { operands: MARKER_RULE, ssh: true },
  "ls-remote": { operands: MARKER_RULE, ssh: true },
  config: { operands: MARKER_RULE, ssh: false },
  tag: { operands: MARKER_RULE, ssh: false },
  "update-ref": { operands: MARKER_RULE, ssh: false },
  "for-each-ref": { operands: MARKER_RULE, ssh: false },
  "rev-parse": { operands: VERIFY_MARKER_RULE, ssh: false },
  checkout: { operands: DASH_REFUSED_RULE, ssh: false },
  version: { operands: NO_OPERANDS_RULE, ssh: false },
};

// D-SG-02: the `-c` pairs of upstream's network-free lane, after the D-SG-05
// pairs. Upstream passes them, and `safe.bareRepository=explicit`, which
// PIN_PAIRS gives every lane, through GIT_CONFIG_PARAMETERS. Pi keeps that
// variable for the user, so they ride `-c` here. The aliases point a remote
// helper at `git version`; they are defense in depth only, because git runs
// a helper it finds on disk before an alias of that name (E4).
const LOCAL_LANE_PAIRS = [
  "alias.remote-none=version",
  "alias.remote-none.command=version",
  "alias.remote-/.command=version",
  "fetch.bundleURI=",
  "help.autocorrect=0",
  "protocol.file.allow=never",
] as const;

// Variables a command's environment loses and gains.
interface EnvironmentChange {
  /** Removed in every spelling. */
  readonly removed: readonly string[];
  /** Set over the user's values, every spelling replaced. */
  readonly variables: Readonly<Record<string, string>>;
}

const NO_CHANGE: EnvironmentChange = { removed: [], variables: {} };

// What a lane does to every command on it.
interface LaneRules extends EnvironmentChange {
  /** Variables read from the user's environment, set after `variables`. */
  readonly derived: (
    base: NodeJS.ProcessEnv,
    rules: PlatformRules,
  ) => Readonly<Record<string, string>>;
  /** The `-c` pairs after the D-SG-05 pairs. */
  readonly pairs: readonly string[];
}

// D-SG-05, Q14 `nn`, WR-02: a GIT_ALLOW_PROTOCOL that names `ext` lets git
// run an `ext::` command despite `-c protocol.ext.allow=never` (verified on
// git 2.43). So the network lane passes the user's list on without the
// BANNED_PROTOCOLS names. git allows only the listed transports, remote
// helpers included, whatever the config says, so the list keeps its meaning.
// Names compare exactly, as git compares them, and empty names go. A list
// left with no name becomes NO_PROTOCOL, which allows nothing, as git reads
// an empty list. On Windows a transport stays only when every spelling's
// list names it. An unset variable, or one whose value is undefined, which
// Node leaves out of the child's environment, sets nothing.
function userProtocolList(
  base: NodeJS.ProcessEnv,
  rules: PlatformRules,
): Readonly<Record<string, string>> {
  const lists = spellingsOf(base, "GIT_ALLOW_PROTOCOL", rules)
    .sort(codeUnitOrder)
    .map((key) => base[key])
    .filter((value) => value !== undefined)
    .map((value) => value.split(":"));
  const [first, ...others] = lists;
  if (first === undefined) {
    return {};
  }

  const allowed = first.filter(
    (name) =>
      name !== "" && !BANNED_PROTOCOLS.has(name) && others.every((list) => list.includes(name)),
  );
  return { GIT_ALLOW_PROTOCOL: allowed.length === 0 ? NO_PROTOCOL : allowed.join(":") };
}

// D-SG-02: a user's `protocol.<name>.allow=always` beats
// `-c protocol.allow=never`, but no config re-allows a transport that
// GIT_ALLOW_PROTOCOL leaves out, so the local lane names none. It keeps the
// user's config, unlike upstream's lane, which strips it.
const LANES: Readonly<Record<GitLane, LaneRules>> = {
  local: {
    removed: [],
    variables: {
      GIT_ALLOW_PROTOCOL: NO_PROTOCOL,
      GIT_SSH_COMMAND: "false",
      GIT_NO_LAZY_FETCH: "1",
      GIT_LFS_SKIP_SMUDGE: "1",
    },
    derived: () => ({}),
    pairs: LOCAL_LANE_PAIRS,
  },
  network: {
    removed: ["GIT_ALLOW_PROTOCOL"],
    variables: {},
    derived: userProtocolList,
    pairs: [],
  },
};

// D-SG-05, Q14 `nn`: the one read of the user's ssh choice. It runs on the
// local lane without a working directory, so it runs in the neutral
// directory, and a repository's own config never answers it. Exit 1 means
// that neither key is set. IN-02: `--null` ends each record with NUL, so a
// value that holds a newline cannot pose as another key. D-SG-18: the plugin
// clone's `core.sshCommand` check reads the same keys.
export const SSH_CONFIG_READ = {
  subcommand: "config",
  lane: "local",
  options: ["--get-regexp", "--null"],
  operands: [String.raw`^(core\.sshcommand|ssh\.variant)$`],
  allowExit: [1],
} as const satisfies Omit<GitRequest, "timeoutMs">;

// Q14 `nn`: the options after the user's ssh command, by variant. git adds
// `-batch` to a tortoiseplink command itself. Any other variant runs as
// OpenSSH. D-SG-03: no option controls host-key updates, so ssh's own
// default applies.
const SSH_VARIANT_OPTIONS: ReadonlyMap<string, readonly string[]> = new Map([
  ["plink", ["-batch"]],
  ["putty", ["-batch"]],
  ["tortoiseplink", []],
]);

const OPENSSH_OPTIONS = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes"] as const;

// D-SG-08: the base names that name one of git's ssh variants.
const NAMED_VARIANTS: ReadonlySet<string> = new Set(["ssh", "plink", "putty", "tortoiseplink"]);

// A single quote inside a single-quoted `sh` word: close, escape, reopen.
const QUOTED_QUOTE = String.raw`'\''`;

function shellQuoted(text: string): string {
  return `'${text.replaceAll("'", QUOTED_QUOTE)}'`;
}

// The first word of `command`, unquoted as git's `split_cmdline` reads it.
// Outside quotes, whitespace ends the word and a quote opens a span; the
// same quote closes it. A backslash outside single quotes escapes the next
// character.
function firstWord(command: string): string {
  let word = "";
  let quote = "";
  let index = 0;
  while (index < command.length && (quote !== "" || !/\s/.test(command.charAt(index)))) {
    const character = command.charAt(index);
    const escape = character === "\\" && quote !== "'";
    if (escape) {
      word += command.charAt(index + 1);
    } else if (quote === "" && (character === "'" || character === '"')) {
      quote = character;
    } else if (character === quote) {
      quote = "";
    } else {
      word += character;
    }

    index += escape ? 2 : 1;
  }

  return word;
}

// Code-unit order, which Node uses to pick one Windows spelling.
function codeUnitOrder(left: string, right: string): number {
  return Number(left > right) - Number(left < right);
}

// The user's value of `name`. On Windows Node passes the first spelling in
// sorted order. An empty value counts as unset.
function userValue(env: NodeJS.ProcessEnv, name: string, rules: PlatformRules): string | undefined {
  const [key] = spellingsOf(env, name, rules).sort(codeUnitOrder);
  const value = key === undefined ? undefined : env[key];
  return value === "" ? undefined : value;
}

// The values of `git config --get-regexp --null`. Each record is the key, a
// newline, and the value, and ends with NUL; a key set with no value has no
// newline. A CR before the newline goes with it. The last record of a key
// wins, and an empty or missing value counts as unset.
export function configValues(stdout: string): ReadonlyMap<string, string> {
  const values = new Map<string, string>();
  for (const record of stdout.split("\0")) {
    const newline = record.indexOf("\n");
    const key = (newline === -1 ? record : record.slice(0, newline)).replace(/\r$/, "");
    const value = newline === -1 ? "" : record.slice(newline + 1);
    if (value === "") {
      values.delete(key);
    } else {
      values.set(key, value);
    }
  }

  return values;
}

// D-SG-08: the variant git must be told, because the wrapper hides the
// program's name. The user's GIT_SSH_VARIANT reaches git unchanged. A
// GIT_SSH_VARIANT from the user's `ssh.variant` also keeps a repository's
// own `ssh.variant` from choosing the options git adds.
function exportedVariant(
  userVariant: string | undefined,
  configVariant: string | undefined,
  nameVariant: string,
): string | undefined {
  if (userVariant !== undefined) {
    return undefined;
  }

  return configVariant ?? (NAMED_VARIANTS.has(nameVariant) ? nameVariant : undefined);
}

// SG-SSH-05: the words a request's `sshTail` adds after the ssh command, as
// upstream adds them to its own hardened command. A fixed literal: no
// marketplace value reaches it (T-04-34).
const SSH_TAILS: Readonly<Record<NonNullable<GitRequest["sshTail"]>, string>> = {
  "print-config": " -G >&2",
};

// SG-SSH-05: whether `request` may carry its `sshTail`. Only a network-lane
// `ls-remote` may, because only there does git start the user's ssh for a
// request that changes nothing.
function acceptsSshTail(request: GitRequest): boolean {
  return (
    request.sshTail === undefined ||
    (request.lane === "network" && request.subcommand === "ls-remote")
  );
}

// D-SG-05, Q14 `nn`: the user's ssh command with the variant's options, run
// from the neutral directory. GIT_SSH_COMMAND outranks every config scope,
// so a repository's own `core.sshCommand` never runs, and GIT_SSH goes.
// SG-SSH-05: `tail` follows the whole command.
function sshEnvironment(
  base: NodeJS.ProcessEnv,
  rules: PlatformRules,
  config: ReadonlyMap<string, string>,
  neutral: string,
  tail: GitRequest["sshTail"],
): EnvironmentChange {
  const program = userValue(base, "GIT_SSH", rules);
  const command =
    userValue(base, "GIT_SSH_COMMAND", rules) ??
    config.get("core.sshcommand") ??
    (program === undefined ? "ssh" : shellQuoted(program));
  const userVariant = userValue(base, "GIT_SSH_VARIANT", rules);
  const configVariant = config.get("ssh.variant");
  const nameVariant = rules.paths
    .basename(firstWord(command))
    .replace(/\.exe$/i, "")
    .toLowerCase();
  const variant = userVariant ?? configVariant ?? nameVariant;
  const options = SSH_VARIANT_OPTIONS.get(variant.toLowerCase()) ?? OPENSSH_OPTIONS;
  const suffix = tail === undefined ? "" : SSH_TAILS[tail];
  const wrapped = `CDPATH= cd -- ${shellQuoted(neutral)} 2>/dev/null || cd / || exit 1; ${[command, ...options].join(" ")}${suffix}`;
  const exported = exportedVariant(userVariant, configVariant, nameVariant);
  return {
    removed: ["GIT_SSH"],
    variables: {
      GIT_SSH_COMMAND: wrapped,
      ...(exported !== undefined && { GIT_SSH_VARIANT: exported }),
    },
  };
}

// The variables that point git at another repository, and GIT_TEMPLATE_DIR,
// which beats `-c init.templateDir=`.
const REMOVED_VARIABLES = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_COMMON_DIR",
  "GIT_INDEX_FILE",
  "GIT_DISCOVERY_ACROSS_FILESYSTEM",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_SHALLOW_FILE",
  "GIT_NAMESPACE",
  "GIT_IMPLICIT_WORK_TREE",
  "GIT_REFERENCE_BACKEND",
  "GIT_TEMPLATE_DIR",
] as const;

// SG-PRC-02: set over the user's values. An empty GIT_ASKPASS stops git from
// running `core.askPass` and `SSH_ASKPASS` too.
const FORCED_VARIABLES = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_ASKPASS: "",
  GCM_INTERACTIVE: "never",
  GIT_LFS_SKIP_SMUDGE: "1",
  GIT_DEFAULT_REF_FORMAT: "files",
  LC_MESSAGES: "C",
} as const;

// Set only when the user's environment has no value of its own.
const DEFAULT_VARIABLES = {
  GIT_NO_LAZY_FETCH: "1",
  GIT_NO_REPLACE_OBJECTS: "1",
  GIT_PROXY_COMMAND: "",
} as const;

// WR-04: a caller reads stdout as git's whole answer, such as a ref list, so a
// run whose stdout outgrows this capture rejects rather than resolve with a
// cut answer. A failure reason is the last line of stderr.
const STDOUT_CAPTURE: OutputCapture = { limit: 8_388_608, keep: "head" };
const STDERR_CAPTURE: OutputCapture = { limit: 65_536, keep: "tail" };

const STDOUT_CUT = `git wrote more than ${STDOUT_CAPTURE.limit} characters to stdout, so its answer is incomplete`;

const WINDOWS_LOOKUP_EXTENSIONS = [".exe", ".cmd", ".bat"] as const;

// SG-SSH-02: an ssh launch's argument list and limit, verbatim from Claude
// Code. The probe's limit is fixed and does not follow the git limit.
interface SshLaunchSpec {
  readonly args: readonly string[];
  readonly timeoutMs: number;
}

const SSH_LAUNCHES: Readonly<Record<SshLaunch, SshLaunchSpec>> = {
  "github-probe": {
    args: [
      "-T",
      "-o",
      "BatchMode=yes",
      "-o",
      "ConnectTimeout=2",
      "-o",
      "StrictHostKeyChecking=yes",
      `git@${GITHUB_HOST}`,
    ],
    timeoutMs: 3_000,
  },
  "github-config": { args: ["-G", `git@${GITHUB_HOST}`], timeoutMs: 5_000 },
};

// The answer of a probe is a line or two; the tail keeps ssh's last words.
const SSH_CAPTURE: OutputCapture = { limit: 65_536, keep: "tail" };

// D-SG-04: the xcrun shim, and the developer directories that hold a real git
// behind it.
const MACOS_SHIM = "/usr/bin/git";
const XCODE_SELECT_LINK = "/var/db/xcode_select_link";
const COMMAND_LINE_TOOLS = "/Library/Developer/CommandLineTools";

// The start errors of a git that may no longer exist.
const MISSING_START_CODES: ReadonlySet<unknown> = new Set(["ENOENT", "EACCES"]);

// D-SG-06: the one version read after a `git-too-old` failure.
const VERSION_REQUEST: GitRequest = { subcommand: "version", lane: "network", timeoutMs: 5_000 };

// How one platform spells paths and variable names.
interface PlatformRules {
  readonly paths: typeof path.posix;
  readonly sameName: (key: string, name: string) => boolean;
  readonly entry: (raw: string) => string;
  readonly config: readonly string[];
}

const WINDOWS_RULES: PlatformRules = {
  paths: path.win32,
  // Node on Windows uses the first spelling of a name in sorted order, so a
  // forced value must replace every spelling.
  sameName: (key, name) => key.toUpperCase() === name,
  entry: (raw) => (raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw),
  config: configPairs(String.raw`\\.\NUL`),
};

const POSIX_RULES: PlatformRules = {
  paths: path.posix,
  sameName: (key, name) => key === name,
  entry: (raw) => raw,
  config: configPairs("/dev/null"),
};

function rulesFor(platform: NodeJS.Platform): PlatformRules {
  return platform === "win32" ? WINDOWS_RULES : POSIX_RULES;
}

function spellingsOf(env: NodeJS.ProcessEnv, name: string, rules: PlatformRules): string[] {
  return Object.keys(env).filter((key) => rules.sameName(key, name));
}

function removeVariable(env: NodeJS.ProcessEnv, name: string, rules: PlatformRules): void {
  for (const key of spellingsOf(env, name, rules)) {
    Reflect.deleteProperty(env, key);
  }
}

function setVariable(
  env: NodeJS.ProcessEnv,
  name: string,
  value: string,
  rules: PlatformRules,
): void {
  removeVariable(env, name, rules);
  env[name] = value;
}

interface SearchPath {
  /** The value of the first spelling of PATH, when the environment has one. */
  readonly value: string | undefined;
  /** Its absolute entries, unquoted on Windows, in PATH order. */
  readonly directories: readonly string[];
}

function absoluteEntries(value: string | undefined, rules: PlatformRules): string[] {
  return (value ?? "")
    .split(rules.paths.delimiter)
    .map(rules.entry)
    .filter((entry) => rules.paths.isAbsolute(entry));
}

function searchPath(env: NodeJS.ProcessEnv, rules: PlatformRules): SearchPath {
  const [key] = spellingsOf(env, "PATH", rules);
  const value = key === undefined ? undefined : env[key];
  return { value, directories: absoluteEntries(value, rules) };
}

// D-SG-05: a pure function of the base environment, the platform, the lane,
// the ssh change, and the real working directory; the base stays unchanged.
function gitEnvironment(
  base: NodeJS.ProcessEnv,
  rules: PlatformRules,
  lane: GitLane,
  ssh: EnvironmentChange,
  cwd: string,
): NodeJS.ProcessEnv {
  const env = { ...base };
  for (const name of [...REMOVED_VARIABLES, ...LANES[lane].removed, ...ssh.removed]) {
    removeVariable(env, name, rules);
  }

  for (const [name, value] of Object.entries(FORCED_VARIABLES)) {
    setVariable(env, name, value, rules);
  }

  for (const [name, value] of Object.entries(DEFAULT_VARIABLES)) {
    if (spellingsOf(env, name, rules).length === 0) {
      env[name] = value;
    }
  }

  const laneVariables = { ...LANES[lane].variables, ...LANES[lane].derived(base, rules) };
  for (const [name, value] of Object.entries({ ...laneVariables, ...ssh.variables })) {
    setVariable(env, name, value, rules);
  }

  // LC_ALL beats LC_MESSAGES, so its value moves to LC_CTYPE.
  const [locale] = spellingsOf(env, "LC_ALL", rules).map((key) => env[key]);
  if (locale !== undefined) {
    removeVariable(env, "LC_ALL", rules);
    setVariable(env, "LC_CTYPE", locale, rules);
  }

  setVariable(env, "GIT_CEILING_DIRECTORIES", rules.paths.dirname(cwd), rules);
  // git's own lookups of ssh and of helpers must not reach a planted program.
  for (const key of spellingsOf(env, "PATH", rules)) {
    env[key] = absoluteEntries(env[key], rules).join(rules.paths.delimiter);
  }

  return env;
}

// SG-PRC-01: the words after the subcommand, or undefined when its operand
// rule refuses the request's operands.
function subcommandWords(request: GitRequest): readonly string[] | undefined {
  const rule = SUBCOMMAND_RULES[request.subcommand].operands;
  const options = request.options ?? [];
  const operands = request.operands ?? [];
  return rule.accepts(options, operands) ? rule.words(options, operands) : undefined;
}

// A pure function of the request and the platform.
function gitArguments(
  request: GitRequest,
  rules: PlatformRules,
  words: readonly string[],
): string[] {
  const pairs = [
    ...(request.config ?? []),
    ...rules.config,
    ...PIN_PAIRS,
    ...LANES[request.lane].pairs,
  ];
  return [...pairs.flatMap((pair) => ["-c", pair]), request.subcommand, ...words];
}

function gitMissing(
  detail: Extract<GitFailure, { kind: "git-missing" }>["detail"],
): GitCommandError {
  return new GitCommandError({ kind: "git-missing", detail }, { operation: "lookup" });
}

// D-SG-04: the first executable `command` in `directories`, in PATH order.
async function findOnPosixPath(
  command: string,
  directories: readonly string[],
  host: GitProcessHost,
): Promise<string | undefined> {
  for (const directory of directories) {
    const candidate = path.posix.join(directory, command);
    // eslint-disable-next-line no-await-in-loop -- PATH order decides which program runs
    if (await host.isExecutable(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

async function findGitOnPosix(
  directories: readonly string[],
  host: GitProcessHost,
): Promise<string> {
  const git = await findOnPosixPath("git", directories, host);
  if (git === undefined) {
    throw gitMissing("not-found");
  }

  return git;
}

// Whether `directory` is `parent` or lies below it, ignoring case.
function isWithin(parent: string, directory: string): boolean {
  const relative = path.win32.relative(parent.toLowerCase(), directory.toLowerCase());
  const [first] = relative.split(path.win32.sep);
  return first !== ".." && !path.win32.isAbsolute(relative);
}

// WR-03: the real path of `file`, or undefined when it cannot be read.
function realpathOrUndefined(host: GitProcessHost, file: string): Promise<string | undefined> {
  return host.realpath(file).catch(() => undefined);
}

// D-SG-04: the Windows candidate filter. Claude Code skips a match inside the
// working directory and keeps looking. WR-03: so is a match whose directory
// has no readable real path.
async function outsideWorkingDirectory(
  host: GitProcessHost,
): Promise<(candidate: string) => Promise<boolean>> {
  const cwd = host.cwd();
  // WR-03: a working directory that no longer exists holds no candidate, so
  // its path as given is enough.
  const realCwd = await realpathOrUndefined(host, cwd);
  const workingDirectories = realCwd === undefined ? [cwd] : [cwd, realCwd];
  return async (candidate) => {
    const directory = path.win32.dirname(candidate);
    const realDirectory = await realpathOrUndefined(host, directory);
    return (
      realDirectory !== undefined &&
      ![directory, realDirectory].some((found) =>
        workingDirectories.some((working) => isWithin(working, found)),
      )
    );
  };
}

async function findGitOnWindows(env: NodeJS.ProcessEnv, host: GitProcessHost): Promise<string> {
  const found = await findOnWindowsPath("git", env, host, {
    extensions: WINDOWS_LOOKUP_EXTENSIONS,
    accept: await outsideWorkingDirectory(host),
  });
  if (found === undefined) {
    throw gitMissing("not-found");
  }

  if (path.win32.extname(found).toLowerCase() !== ".exe") {
    throw gitMissing("batch-launcher");
  }

  return found;
}

// D-SG-04: whether `git` is the macOS xcrun shim. Claude Code checks before
// every spawn, with no spawn of its own, but its build does not show which
// files it reads. So this check is an assumption, and the manual check on a
// Mac confirms it: xcrun finds a developer directory through DEVELOPER_DIR,
// the xcode-select choice, or the Command Line Tools.
async function isXcrunShim(
  git: string,
  env: NodeJS.ProcessEnv,
  host: GitProcessHost,
): Promise<boolean> {
  // WR-03: a git whose real path cannot be read is gone.
  const realGit = await realpathOrUndefined(host, git);
  if (realGit === undefined) {
    throw gitMissing("not-found");
  }

  if (realGit !== MACOS_SHIM) {
    return false;
  }

  const selected = await realpathOrUndefined(host, XCODE_SELECT_LINK);
  const developerDirectories = [env.DEVELOPER_DIR, selected, COMMAND_LINE_TOOLS].filter(
    (directory): directory is string => directory !== undefined && path.posix.isAbsolute(directory),
  );
  const holdsGit = await Promise.all(
    developerDirectories.map((directory) => host.isFile(path.posix.join(directory, "usr/bin/git"))),
  );
  return !holdsGit.includes(true);
}

async function findGit(
  env: NodeJS.ProcessEnv,
  host: GitProcessHost,
  directories: readonly string[],
): Promise<string> {
  if (host.platform === "win32") {
    return findGitOnWindows(env, host);
  }

  const git = await findGitOnPosix(directories, host);
  if (host.platform === "darwin" && (await isXcrunShim(git, env, host))) {
    throw gitMissing("macos-shim");
  }

  return git;
}

// SG-SSH-02, D-SG-04: the user's ssh, from the absolute entries of PATH only;
// on Windows only ssh.exe. Undefined when there is none.
async function findSsh(env: NodeJS.ProcessEnv, host: GitProcessHost): Promise<string | undefined> {
  if (host.platform === "win32") {
    return findOnWindowsPath("ssh", env, host, {
      extensions: [".exe"],
      accept: await outsideWorkingDirectory(host),
    });
  }

  return findOnPosixPath("ssh", searchPath(env, POSIX_RULES).directories, host);
}

// D-SG-04: a start error whose git file is gone. The working directory exists
// by then, because its real path resolved, so the ENOENT is the git's (E11).
async function startFailedWithoutGit(
  failure: GitCommandError,
  git: string,
  host: GitProcessHost,
): Promise<boolean> {
  const { cause } = failure;
  return (
    failure.kind === "failed" &&
    cause instanceof Error &&
    "code" in cause &&
    MISSING_START_CODES.has(cause.code) &&
    !(await host.isFile(git))
  );
}

// The error's operation is the subcommand and its first Pi-owned word, such as
// `rev-parse --verify`, never an operand (AUTH-09).
function operationOf(request: GitRequest): string {
  return [request.subcommand, ...(request.options ?? []).slice(0, 1)].join(" ");
}

// The result of a finished run, or the error it rejects with.
function settleRun(
  run: ProcessRun,
  request: GitRequest,
  operation: string,
): GitResult | GitCommandError {
  const details = {
    operation,
    stderr: redactShownText(run.stderr, request.remote === undefined ? [] : [request.remote.url]),
    ...(request.remote !== undefined && { remote: request.remote }),
  };
  if (request.signal?.aborted === true) {
    return new GitCommandError({ kind: "aborted" }, details, { cause: request.signal.reason });
  }

  if (run.error !== undefined) {
    return new GitCommandError({ kind: "failed" }, details, { cause: run.error });
  }

  if (run.timedOut) {
    return new GitCommandError({ kind: "timeout", timeoutMs: request.timeoutMs }, details);
  }

  const { code } = run;
  if (code === 0 || (code !== null && request.allowExit?.includes(code) === true)) {
    return run.truncated?.includes("stdout") === true
      ? new GitCommandError(
          { kind: "failed" },
          { ...details, exitCode: code },
          { cause: new RangeError(STDOUT_CUT) },
        )
      : { exitCode: code, stdout: run.stdout, stderr: run.stderr };
  }

  return new GitCommandError(
    classifyGitExit(code, run.stderr),
    code === null ? details : { ...details, exitCode: code },
  );
}

// WR-03: rethrows a failure that comes before any launch as a `failed`
// GitCommandError with that failure as its cause.
function failsBeforeLaunch(operation: string): (error: unknown) => never {
  return (error) => {
    throw new GitCommandError({ kind: "failed" }, { operation }, { cause: error });
  };
}

// The first line of a `git version` answer.
function firstLine(text: string): string {
  return text.replace(/\r?\n[\s\S]*/, "");
}

/**
 * Binds a git process to one launcher, host, and base environment.
 * Construction does no I/O; the instance owns the cache of found gits.
 */
// fallow-ignore-next-line unused-export -- NODE_GIT_PROCESS below composes it in production, and the module test composes it with a fake launcher and host.
export function createGitProcess(options: GitProcessOptions): SystemGitProcess {
  const { host } = options;
  const found = new Map<string, string>();

  async function lookup(): Promise<{ readonly git: string; readonly key: string }> {
    const rules = rulesFor(host.platform);
    const search = searchPath(options.env, rules);
    const key = JSON.stringify([search.value ?? null, host.cwd()]);
    const cached = found.get(key);
    if (cached !== undefined) {
      return { git: cached, key };
    }

    const git = await findGit(options.env, host, search.directories);
    found.set(key, git);
    return { git, key };
  }

  async function locate(): Promise<string> {
    const { git } = await lookup();
    return git;
  }

  // D-SG-04: a run whose git is gone reports git-missing and drops the found
  // git. A run that already holds it finishes with it; only later lookups
  // search again.
  async function backstop(
    failure: GitCommandError,
    git: string,
    key: string,
  ): Promise<GitCommandError> {
    const reported = (await startFailedWithoutGit(failure, git, host))
      ? new GitCommandError(
          { kind: "git-missing", detail: "not-found" },
          { operation: failure.operation },
          { cause: failure.cause },
        )
      : failure;
    if (reported.kind === "git-missing") {
      found.delete(key);
    }

    return reported;
  }

  // WR-06: the milliseconds left before `deadline`. A command with none left
  // rejects with its request's limit and starts nothing.
  function timeLeft(request: GitRequest, deadline: number, operation: string): number {
    const remaining = deadline - host.now();
    if (remaining <= 0) {
      throw new GitCommandError({ kind: "timeout", timeoutMs: request.timeoutMs }, { operation });
    }

    return remaining;
  }

  async function execute(request: GitRequest, deadline: number): Promise<GitResult> {
    const operation = operationOf(request);
    if (request.signal?.aborted === true) {
      throw new GitCommandError(
        { kind: "aborted" },
        { operation },
        { cause: request.signal.reason },
      );
    }

    // A refused request starts nothing, and its error names no operand.
    const words = subcommandWords(request);
    if (words === undefined || !acceptsSshTail(request)) {
      throw new GitCommandError({ kind: "refused-input" }, { operation });
    }

    const { git, key } = await lookup();
    const rules = rulesFor(host.platform);
    const cwd = await workingDirectory(request, operation);
    // git cannot hold a ceiling whose path contains the PATH delimiter.
    if (rules.paths.dirname(cwd).includes(rules.paths.delimiter)) {
      throw new GitCommandError({ kind: "refused-input" }, { operation });
    }

    const ssh = await sshChange(request, rules, deadline);
    const timeoutMs = timeLeft(request, deadline, operation);
    const processRun = await runProcess(
      { spawn: options.spawn, host },
      {
        command: git,
        args: gitArguments(request, rules, words),
        cwd,
        env: gitEnvironment(options.env, rules, request.lane, ssh, cwd),
        timeoutMs,
        killGraceMs: options.killGraceMs,
        signal: request.signal,
        stdout: STDOUT_CAPTURE,
        stderr: STDERR_CAPTURE,
        windowsHide: true,
      },
    );
    const settled = settleRun(processRun, request, operation);
    if (settled instanceof GitCommandError) {
      throw await backstop(settled, git, key);
    }

    return settled;
  }

  // D-SG-05: a network-lane command that can use ssh first reads the user's
  // ssh choice, under the request's deadline and cancellation. No debug log
  // names the command or the read, because a user's ssh arguments can name
  // key files.
  async function sshChange(
    request: GitRequest,
    rules: PlatformRules,
    deadline: number,
  ): Promise<EnvironmentChange> {
    if (request.lane === "local" || !SUBCOMMAND_RULES[request.subcommand].ssh) {
      return NO_CHANGE;
    }

    const read = await execute(
      {
        ...SSH_CONFIG_READ,
        timeoutMs: request.timeoutMs,
        ...(request.signal !== undefined && { signal: request.signal }),
      },
      deadline,
    );
    const neutral = await neutralDirectory(operationOf(request));
    return sshEnvironment(options.env, rules, configValues(read.stdout), neutral, request.sshTail);
  }

  // SG-PRC-03: a neutral directory that cannot be made fails the command.
  function neutralDirectory(operation: string): Promise<string> {
    return host.neutralDirectory().catch(failsBeforeLaunch(operation));
  }

  // WR-03: the real path of the request's directory, or of the neutral
  // directory without one. A directory that cannot be resolved, such as one
  // that no longer exists, fails the command before any launch.
  function workingDirectory(request: GitRequest, operation: string): Promise<string> {
    return request.cwd === undefined
      ? neutralDirectory(operation)
      : host.realpath(request.cwd).catch(failsBeforeLaunch(operation));
  }

  // D-SG-06: the version read runs through `execute`, so it never reads the
  // version again. WR-06: it stops when the failed request's signal aborts.
  async function logGitVersion(signal: AbortSignal | undefined): Promise<void> {
    const request: GitRequest = { ...VERSION_REQUEST, ...(signal !== undefined && { signal }) };
    const versionLine = await execute(request, host.now() + request.timeoutMs).then(
      (version) => firstLine(version.stdout),
      () => "unreadable",
    );
    hookDebugLog(`git version: ${versionLine}`, "git");
  }

  async function run(request: GitRequest): Promise<GitResult> {
    try {
      return await execute(request, host.now() + request.timeoutMs);
    } catch (error: unknown) {
      if (error instanceof GitCommandError && error.kind === "git-too-old") {
        await logGitVersion(request.signal);
      }

      throw error;
    }
  }

  // SG-SSH-02: one ssh launch in the neutral directory, with the base
  // environment as it is and stdin closed. A lookup miss starts nothing.
  async function ssh(launch: SshLaunch): Promise<SshRun> {
    const command = await findSsh(options.env, host);
    if (command === undefined) {
      return { kind: "missing" };
    }

    const spec = SSH_LAUNCHES[launch];
    const processRun = await runProcess(
      { spawn: options.spawn, host },
      {
        command,
        args: spec.args,
        cwd: await host.neutralDirectory(),
        env: options.env,
        timeoutMs: spec.timeoutMs,
        killGraceMs: options.killGraceMs,
        stdout: SSH_CAPTURE,
        stderr: SSH_CAPTURE,
        windowsHide: true,
      },
    );
    if (processRun.error !== undefined) {
      throw processRun.error;
    }

    return {
      kind: "ran",
      exitCode: processRun.code,
      output: `${processRun.stdout}\n${processRun.stderr}`,
      timedOut: processRun.timedOut,
    };
  }

  return { locate, run, ssh };
}

async function isExecutableFile(file: string): Promise<boolean> {
  try {
    const stats = await stat(file);
    await access(file, constants.X_OK);
    return stats.isFile();
  } catch {
    return false;
  }
}

/**
 * The shared process host, plus an execute probe, `realpath`, Pi's cwd, a
 * monotonic clock, and the neutral directory.
 */
// fallow-ignore-next-line unused-export -- NODE_GIT_PROCESS below binds it in production, and the real-git cases of the module test run through it.
export const NODE_GIT_HOST: GitProcessHost = Object.freeze({
  ...NODE_PROCESS_HOST,
  isExecutable: isExecutableFile,
  realpath: (file: string) => realpath(file),
  cwd: () => process.cwd(),
  now: () => performance.now(),
  // NFR-10: under the user scope's extension root; `getAgentDir` reads its
  // variable on every call.
  neutralDirectory: createNeutralDirectory({
    parent: () => path.join(getAgentDir(), "pi-claude-marketplace"),
    uid: process.getuid,
  }),
});

/**
 * The real process launcher: Node's own `spawn`, narrowed to the
 * `ProcessSpawn` contract. The cast narrows `ChildProcess` to the streams,
 * events, and `kill` a run uses.
 */
// fallow-ignore-next-line unused-export -- NODE_GIT_PROCESS below binds it in production, and the module test pins it to Node's spawn.
export const NODE_GIT_SPAWN = spawn as ProcessSpawn;

// Milliseconds after SIGTERM before a git that is still running gets SIGKILL.
const KILL_GRACE_MS = 1_000;

/**
 * D-SG-04: the process's one production git process, bound to this process's
 * environment, so a found git is looked up once per PATH and working
 * directory.
 */
export const NODE_GIT_PROCESS: SystemGitProcess = createGitProcess({
  spawn: NODE_GIT_SPAWN,
  host: NODE_GIT_HOST,
  env: process.env,
  killGraceMs: KILL_GRACE_MS,
});
