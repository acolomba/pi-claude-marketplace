// platform/git-process.ts
//
// D-SG-01: the extension runs the user's system git, with no fallback. Every
// git process it starts comes from this module. A run passes an argument array
// to an absolute git path, with no shell, through the shared launcher
// (platform/process-run.ts). The launcher writes the input to stdin and closes
// it, and its timeout stops the whole process tree (SG-PRC-01).
//
// D-SG-04: git is looked up in the absolute entries of PATH only. A relative
// or empty entry resolves against the child's working directory, so a
// repository could plant its own git there. On Windows only git.exe runs.
// Node cannot start a git.cmd or a git.bat without a shell (D-PL9-18), so one
// found first is refused, and a candidate inside Pi's working directory is
// skipped. Each instance keeps a found git per PATH and working directory. It
// never keeps a miss, so a git installed after a failure is found by the next
// command without a Pi restart (NFR-2).
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
// helpers, and proxies.
//
// A request without a working directory runs in the neutral directory, the
// real path of the host's temporary directory, so the repository Pi runs in
// never steers the command.
//
// D-PL9-11: this module imports nothing from Node's child-process module yet.
// Its one production launcher is still bound in platform/git-credential.ts.

import { constants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { GitCommandError } from "../shared/errors.ts";

import { findOnWindowsPath, NODE_PROCESS_HOST, runProcess } from "./process-run.ts";

import type { GitFailure } from "../shared/errors.ts";
import type { OutputCapture, ProcessHost, ProcessRun, ProcessSpawn } from "./process-run.ts";

/** D-SG-02: the lane a command runs on. */
export type GitLane = "network";

/** The git subcommands the extension runs. */
export type GitSubcommand = "credential";

/** One git command to run. */
export interface GitRequest {
  readonly subcommand: GitSubcommand;
  readonly lane: GitLane;
  /** Pi-owned words after the subcommand, in the order given. */
  readonly options?: readonly string[];
  /** The directory git runs in. Omitted, the command runs in the neutral directory. */
  readonly cwd?: string;
  /** Written to stdin, which then closes. Without input, stdin is closed from the start. */
  readonly input?: string;
  /** Milliseconds before git and its process tree are stopped. */
  readonly timeoutMs: number;
  /** Stops git and its process tree when the owning operation is cancelled. */
  readonly signal?: AbortSignal;
  /** The non-zero exit codes that resolve instead of rejecting. */
  readonly allowExit?: readonly number[];
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
  /** The host's temporary directory, whose real path is the neutral directory. */
  readonly tmpdir: () => string;
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

// D-SG-05: Claude Code's `-c` pairs, in its order, plus `credential.interactive`
// and an empty `init.templateDir`, so a template directory copies no hook.
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
    "init.defaultRefFormat=files",
    "core.longpaths=true",
    "credential.interactive=false",
    "init.templateDir=",
  ];
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

// git writes far less to stdout than this; a failure reason is the last line
// of stderr.
const STDOUT_CAPTURE: OutputCapture = { limit: 8_388_608, keep: "head" };
const STDERR_CAPTURE: OutputCapture = { limit: 65_536, keep: "tail" };

const WINDOWS_LOOKUP_EXTENSIONS = [".exe", ".cmd", ".bat"] as const;

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

// D-SG-05: a pure function of the base environment, the platform, and the
// real working directory; the base stays unchanged.
function gitEnvironment(
  base: NodeJS.ProcessEnv,
  rules: PlatformRules,
  cwd: string,
): NodeJS.ProcessEnv {
  const env = { ...base };
  for (const name of REMOVED_VARIABLES) {
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

function gitArguments(request: GitRequest, rules: PlatformRules): string[] {
  return [
    ...rules.config.flatMap((pair) => ["-c", pair]),
    request.subcommand,
    ...(request.options ?? []),
  ];
}

function gitMissing(detail: Extract<GitFailure, { kind: "git-missing" }>["detail"]): Error {
  return new GitCommandError({ kind: "git-missing", detail }, { operation: "lookup" });
}

async function findGitOnPosix(
  directories: readonly string[],
  host: GitProcessHost,
): Promise<string> {
  for (const directory of directories) {
    const candidate = path.posix.join(directory, "git");
    // eslint-disable-next-line no-await-in-loop -- PATH order decides which git runs
    if (await host.isExecutable(candidate)) {
      return candidate;
    }
  }

  throw gitMissing("not-found");
}

// Whether `directory` is `parent` or lies below it, ignoring case.
function isWithin(parent: string, directory: string): boolean {
  const relative = path.win32.relative(parent.toLowerCase(), directory.toLowerCase());
  const [first] = relative.split(path.win32.sep);
  return first !== ".." && !path.win32.isAbsolute(relative);
}

async function findGitOnWindows(env: NodeJS.ProcessEnv, host: GitProcessHost): Promise<string> {
  const cwd = host.cwd();
  const workingDirectories = [cwd, await host.realpath(cwd)];
  // Claude Code skips a match inside the working directory and keeps looking.
  const accept = async (candidate: string): Promise<boolean> => {
    const directory = path.win32.dirname(candidate);
    const directories = [directory, await host.realpath(directory)];
    return !directories.some((found) =>
      workingDirectories.some((working) => isWithin(working, found)),
    );
  };

  const found = await findOnWindowsPath("git", env, host, {
    extensions: WINDOWS_LOOKUP_EXTENSIONS,
    accept,
  });
  if (found === undefined) {
    throw gitMissing("not-found");
  }

  if (path.win32.extname(found).toLowerCase() !== ".exe") {
    throw gitMissing("batch-launcher");
  }

  return found;
}

// The error's operation is the subcommand and its first Pi-owned word, such as
// `credential fill`, never an operand or the input (AUTH-09).
function operationOf(request: GitRequest): string {
  return [request.subcommand, ...(request.options ?? []).slice(0, 1)].join(" ");
}

function settleRun(run: ProcessRun, request: GitRequest, operation: string): GitResult {
  const details = { operation, stderr: run.stderr };
  if (request.signal?.aborted === true) {
    throw new GitCommandError({ kind: "aborted" }, details, { cause: request.signal.reason });
  }

  if (run.error !== undefined) {
    throw new GitCommandError({ kind: "failed" }, details, { cause: run.error });
  }

  if (run.timedOut) {
    throw new GitCommandError({ kind: "timeout", timeoutMs: request.timeoutMs }, details);
  }

  const { code } = run;
  if (code === 0 || (code !== null && request.allowExit?.includes(code) === true)) {
    return { exitCode: code, stdout: run.stdout, stderr: run.stderr };
  }

  throw new GitCommandError(
    { kind: "failed" },
    code === null ? details : { ...details, exitCode: code },
  );
}

/**
 * Binds a git process to one launcher, host, and base environment.
 * Construction does no I/O; the instance owns the cache of found gits.
 */
export function createGitProcess(options: GitProcessOptions): GitProcess {
  const { host } = options;
  const found = new Map<string, string>();

  async function locate(): Promise<string> {
    const rules = rulesFor(host.platform);
    const search = searchPath(options.env, rules);
    const key = JSON.stringify([search.value ?? null, host.cwd()]);
    const cached = found.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const git =
      host.platform === "win32"
        ? await findGitOnWindows(options.env, host)
        : await findGitOnPosix(search.directories, host);
    found.set(key, git);
    return git;
  }

  async function run(request: GitRequest): Promise<GitResult> {
    const operation = operationOf(request);
    if (request.signal?.aborted === true) {
      throw new GitCommandError(
        { kind: "aborted" },
        { operation },
        { cause: request.signal.reason },
      );
    }

    const git = await locate();
    const rules = rulesFor(host.platform);
    const cwd = await host.realpath(request.cwd ?? host.tmpdir());
    // git cannot hold a ceiling whose path contains the PATH delimiter.
    if (rules.paths.dirname(cwd).includes(rules.paths.delimiter)) {
      throw new GitCommandError({ kind: "refused-input" }, { operation });
    }

    const processRun = await runProcess(
      { spawn: options.spawn, host },
      {
        command: git,
        args: gitArguments(request, rules),
        cwd,
        env: gitEnvironment(options.env, rules, cwd),
        timeoutMs: request.timeoutMs,
        killGraceMs: options.killGraceMs,
        signal: request.signal,
        ...(request.input !== undefined && { input: request.input }),
        stdout: STDOUT_CAPTURE,
        stderr: STDERR_CAPTURE,
        windowsHide: true,
      },
    );
    return settleRun(processRun, request, operation);
  }

  return { locate, run };
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

/** The shared process host, plus an execute probe, `realpath`, Pi's cwd, and the temp directory. */
export const NODE_GIT_HOST: GitProcessHost = Object.freeze({
  ...NODE_PROCESS_HOST,
  isExecutable: isExecutableFile,
  realpath: (file: string) => realpath(file),
  cwd: () => process.cwd(),
  tmpdir: () => tmpdir(),
});
