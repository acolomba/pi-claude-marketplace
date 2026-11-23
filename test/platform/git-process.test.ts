import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";

import { createNeutralDirectory } from "../../extensions/pi-claude-marketplace/platform/git-neutral-directory.ts";
import {
  createGitProcess,
  NODE_GIT_HOST,
  NODE_GIT_PROCESS,
  NODE_GIT_SPAWN,
} from "../../extensions/pi-claude-marketplace/platform/git-process.ts";
import { GitCommandError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import { hermeticGitEnvironment } from "../../features/lib/hermetic-git.ts";
import { HttpsGitHost } from "../../features/lib/https-git-host/server.ts";
import { SshGitHost } from "../../features/lib/ssh-git-host/host.ts";

import { captureDebugLog } from "./debug-log-capture.ts";
import {
  createGitTestDirectory,
  createGitTestRepository,
  runSystemGit,
} from "./git-test-repository.ts";
import { createHermeticEnvironment } from "./hermetic-environment.ts";
import { createProcessFake } from "./process-fake.ts";
import { livingGroupMembers } from "./process-group.ts";

import type {
  GitProcess,
  GitProcessHost,
  GitRequest,
} from "../../extensions/pi-claude-marketplace/platform/git-process.ts";
import type { ProcessSpawn } from "../../extensions/pi-claude-marketplace/platform/process-run.ts";
import type { GitFailure } from "../../extensions/pi-claude-marketplace/shared/errors.ts";
import type { GitTestRepository } from "./git-test-repository.ts";
import type { ProcessControl, ProcessLaunch } from "./process-fake.ts";
import type { TestContext } from "node:test";

const NODE_SPAWN = spawn as ProcessSpawn;
const KILL_GRACE_MS = 200;
const FILL_INPUT = "protocol=https\nhost=github.com\n\n";

const FILL: GitRequest = {
  subcommand: "credential",
  options: ["fill"],
  lane: "network",
  input: FILL_INPUT,
  timeoutMs: 5_000,
};

// D-SG-05: the `-c` pairs of every command, in their order.
function hardening(hooksPath: string): string[] {
  const pairs = `core.fsmonitor=
core.hooksPath=${hooksPath}
core.askPass=
protocol.ext.allow=never
core.alternateRefsCommand=f() { git --git-dir="$1" for-each-ref --format='%(objectname)'; }; f
submodule.recurse=false
log.showSignature=false
format.pretty=medium
gc.auto=0
maintenance.auto=false
diff.autoRefreshIndex=false
hook.applypatch-msg.enabled=false
hook.pre-applypatch.enabled=false
hook.post-applypatch.enabled=false
hook.pre-commit.enabled=false
hook.pre-merge-commit.enabled=false
hook.prepare-commit-msg.enabled=false
hook.commit-msg.enabled=false
hook.post-commit.enabled=false
hook.pre-rebase.enabled=false
hook.post-checkout.enabled=false
hook.post-merge.enabled=false
hook.pre-push.enabled=false
hook.pre-receive.enabled=false
hook.update.enabled=false
hook.proc-receive.enabled=false
hook.post-receive.enabled=false
hook.post-update.enabled=false
hook.reference-transaction.enabled=false
hook.push-to-checkout.enabled=false
hook.pre-auto-gc.enabled=false
hook.post-rewrite.enabled=false
hook.sendemail-validate.enabled=false
hook.fsmonitor-watchman.enabled=false
hook.p4-changelist.enabled=false
hook.p4-prepare-changelist.enabled=false
hook.p4-post-changelist.enabled=false
hook.p4-pre-submit.enabled=false
hook.post-index-change.enabled=false
protocol.fd.allow=never
protocol.git.allow=never
protocol.ftp.allow=never
protocol.ftps.allow=never
init.defaultRefFormat=files
core.longpaths=true
credential.interactive=false
init.templateDir=
safe.bareRepository=explicit`.split("\n");
  return pairs.flatMap((pair) => ["-c", pair]);
}

// The values every child gets on POSIX, besides PATH and the ceiling.
const POSIX_FORCED = {
  GIT_TERMINAL_PROMPT: "0",
  GIT_ASKPASS: "",
  GCM_INTERACTIVE: "never",
  GIT_LFS_SKIP_SMUDGE: "1",
  GIT_DEFAULT_REF_FORMAT: "files",
  GIT_NO_LAZY_FETCH: "1",
  GIT_NO_REPLACE_OBJECTS: "1",
  GIT_PROXY_COMMAND: "",
  LC_MESSAGES: "C",
} as const;

interface HostSetup {
  readonly platform?: NodeJS.Platform;
  /** The files that exist: executable on POSIX, present on Windows. */
  readonly files?: readonly string[];
  readonly realpaths?: Readonly<Record<string, string>>;
  readonly cwd?: string;
  /** The real path of the neutral directory. */
  readonly neutral?: string;
  /** Why the neutral directory cannot be made. */
  readonly neutralFailure?: Error;
  /** The paths whose real path cannot be read. */
  readonly unresolvable?: readonly string[];
}

interface RecordingHost {
  readonly host: GitProcessHost;
  readonly files: Set<string>;
  readonly probes: string[];
  readonly groupSignals: Array<readonly [number, string]>;
  cwd: string;
}

function createHost(setup: HostSetup = {}): RecordingHost {
  const files = new Set(setup.files ?? ["/usr/bin/git"]);
  const probes: string[] = [];
  const groupSignals: Array<readonly [number, string]> = [];
  const probe = (file: string): Promise<boolean> => {
    probes.push(file);
    return Promise.resolve(files.has(file));
  };

  const recording: RecordingHost = {
    files,
    probes,
    groupSignals,
    cwd: setup.cwd ?? "/work/project",
    host: {
      platform: setup.platform ?? "linux",
      isFile: probe,
      isExecutable: probe,
      signalGroup: (pid, signal) => {
        groupSignals.push([pid, signal]);
      },
      realpath: (file) =>
        setup.unresolvable?.includes(file) === true
          ? Promise.reject(Object.assign(new Error(`ENOENT: ${file}`), { code: "ENOENT" }))
          : Promise.resolve(setup.realpaths?.[file] ?? file),
      cwd: () => recording.cwd,
      neutralDirectory: () =>
        setup.neutralFailure === undefined
          ? Promise.resolve(setup.neutral ?? "/tmp")
          : Promise.reject(setup.neutralFailure),
    },
  };
  return recording;
}

interface StartedLauncher {
  readonly spawn: ProcessSpawn;
  /** Settles at the first launch, once the run watches its process. */
  readonly started: Promise<void>;
}

function startedLauncher(control: ProcessControl): StartedLauncher {
  let markStarted: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  return {
    started,
    spawn: (command, args, options) => {
      const process = control.spawn(command, args, options);
      markStarted();
      return process;
    },
  };
}

interface FakeGit {
  readonly git: GitProcess;
  readonly control: ProcessControl;
  readonly started: Promise<void>;
  readonly host: RecordingHost;
}

// A null `pid` makes a process that never starts, so only an `error` settles it.
function createFakeGit(
  env: NodeJS.ProcessEnv = { PATH: "/usr/bin" },
  setup: HostSetup = {},
  pid: number | null = 4242,
): FakeGit {
  const control = createProcessFake(pid ?? undefined);
  const launcher = startedLauncher(control);
  const host = createHost(setup);
  const git = createGitProcess({
    spawn: launcher.spawn,
    host: host.host,
    env,
    killGraceMs: KILL_GRACE_MS,
  });
  return { git, control, started: launcher.started, host };
}

interface LaunchSequence {
  readonly spawn: ProcessSpawn;
  /** Settles at the launch with this index, once the run watches its process. */
  readonly at: (index: number) => Promise<ProcessControl>;
  readonly all: () => readonly ProcessLaunch[];
}

// Gives every launch its own fake process, so one run can start several.
function launchSequence(): LaunchSequence {
  const controls: ProcessControl[] = [];
  const waiting = new Map<number, (control: ProcessControl) => void>();
  const launched: ProcessLaunch[] = [];
  return {
    spawn: (command, args, options) => {
      const control = createProcessFake(4242 + controls.length);
      const process = control.spawn(command, args, options);
      launched.push([command, args, options]);
      waiting.get(controls.length)?.(control);
      controls.push(control);
      return process;
    },
    at: (index) =>
      new Promise((resolve) => {
        const control = controls[index];
        if (control === undefined) {
          waiting.set(index, resolve);
        } else {
          resolve(control);
        }
      }),
    all: () => [...launched],
  };
}

function createSequencedGit(
  setup: HostSetup = {},
  env: NodeJS.ProcessEnv = { PATH: "/usr/bin" },
): {
  readonly git: GitProcess;
  readonly launches: LaunchSequence;
  readonly host: RecordingHost;
} {
  const launches = launchSequence();
  const host = createHost(setup);
  const git = createGitProcess({
    spawn: launches.spawn,
    host: host.host,
    env,
    killGraceMs: KILL_GRACE_MS,
  });
  return { git, launches, host };
}

interface ExpectedFailure {
  readonly failure: GitFailure;
  readonly operation: string;
  readonly exitCode: number | null;
  readonly stderr: string;
  readonly cause?: unknown;
}

function gitFailure(expected: ExpectedFailure): (error: unknown) => boolean {
  return (error) => {
    assert.ok(error instanceof GitCommandError);
    assert.deepStrictEqual(
      {
        failure: error.failure,
        operation: error.operation,
        exitCode: error.exitCode,
        stderr: error.stderr,
        cause: error.cause,
      },
      { cause: undefined, ...expected },
    );
    return true;
  };
}

async function caseDirectory(t: TestContext): Promise<string> {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "pi-cm-git-process-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

// A script that records each run in its own file and prints `output`.
async function recordingScript(
  root: string,
  name: string,
  output: string,
): Promise<{ readonly script: string; readonly record: string }> {
  const script = path.join(root, name);
  const record = path.join(root, `${name}.ran`);
  await writeFile(script, `#!/bin/sh\necho ran >> '${record}'\n${output}\n`, { mode: 0o755 });
  return { script, record };
}

// D-SG-02: the `-c` pairs of the local lane, after the D-SG-05 pairs.
const LOCAL_LANE = [
  "alias.remote-none=version",
  "alias.remote-none.command=version",
  "alias.remote-/.command=version",
  "fetch.bundleURI=",
  "help.autocorrect=0",
  "protocol.file.allow=never",
].flatMap((pair) => ["-c", pair]);

// The user's own git configuration, which every lane keeps.
const USER_CONFIG = {
  HOME: "/home/user",
  GIT_CONFIG_GLOBAL: "/home/user/.gitconfig",
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "credential.helper",
  GIT_CONFIG_VALUE_0: "store",
  GIT_CONFIG_PARAMETERS: "'user.name'='user'",
} as const;

const LOCAL_READ: GitRequest = {
  subcommand: "rev-parse",
  lane: "local",
  options: ["--verify"],
  operands: ["HEAD"],
  cwd: "/work/clone",
  timeoutMs: 5_000,
};

// A real-git run that rejects with `kind` and `exitCode`.
function rejectsAs(kind: GitFailure["kind"], exitCode: number): (error: unknown) => boolean {
  return (error) => {
    assert.ok(error instanceof GitCommandError);
    assert.deepStrictEqual([error.kind, error.exitCode], [kind, exitCode]);
    return true;
  };
}

// The user config of a case that allows every transport git knows of.
const PERMISSIVE_CONFIG = `[protocol "file"]
\tallow = always
[protocol "https"]
\tallow = always
[protocol "ext"]
\tallow = always
`;

// A user config that allows each transport the module bans.
const ALWAYS_BANNED_CONFIG = ["fd", "git", "ftp", "ftps"]
  .map((name) => `[protocol "${name}"]\n\tallow = always\n`)
  .join("");

interface LaneFixture {
  readonly root: string;
  readonly repository: GitTestRepository;
  /** A bare clone of the repository, which is its plain-path `origin`. */
  readonly bare: string;
  /** The module, with the case's HOME and its permissive user config. */
  readonly git: GitProcess;
  /** The same module with `variables` and `config` over its base environment. */
  readonly gitWith: (variables: NodeJS.ProcessEnv, config?: string) => Promise<GitProcess>;
}

// A committed repository with an `origin`, a `v1.0.0` tag, and a `feature`
// branch, and a module whose user config allows every transport.
interface RealGitOptions {
  /** The neutral directory, which also holds the user config file. */
  readonly root: string;
  readonly env: NodeJS.ProcessEnv;
  /** The text of the user config file that GIT_CONFIG_GLOBAL names. */
  readonly config: string;
  readonly spawn?: ProcessSpawn;
  readonly killGraceMs?: number;
}

// The module over real git, with its own user config file.
async function realGit(options: RealGitOptions): Promise<GitProcess> {
  const configPath = path.join(await mkdtemp(path.join(options.root, "gitconfig-")), "config");
  await writeFile(configPath, options.config);
  return createGitProcess({
    spawn: options.spawn ?? NODE_SPAWN,
    host: { ...NODE_GIT_HOST, neutralDirectory: () => Promise.resolve(options.root) },
    env: { ...options.env, GIT_CONFIG_GLOBAL: configPath },
    killGraceMs: options.killGraceMs ?? KILL_GRACE_MS,
  });
}

async function laneFixture(t: TestContext): Promise<LaneFixture> {
  const root = await caseDirectory(t);
  const repository = await createGitTestRepository(t, { boundary: "local" });
  const bare = path.join(root, "origin.git");
  await repository.cloneBare(bare);
  await repository.run("remote", "add", "origin", bare);
  await repository.run("tag", "v1.0.0");
  await repository.run("branch", "feature");
  const gitWith = (variables: NodeJS.ProcessEnv, config = ""): Promise<GitProcess> =>
    realGit({
      root,
      env: { ...hermeticGitEnvironment(root), ...variables },
      config: `${PERMISSIVE_CONFIG}${config}`,
    });

  return { root, repository, bare, git: await gitWith({}), gitWith };
}

// A stand-in started in its own directory, closed before that directory goes.
async function startStandIn<Host extends { close(): Promise<void> }>(
  t: TestContext,
  start: (root: string) => Promise<Host>,
): Promise<{ readonly root: string; readonly host: Host }> {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "pi-cm-stand-in-")));
  const host = await start(root);
  t.after(async () => {
    try {
      await host.close();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  return { root, host };
}

interface SshFixture {
  /** The case directory, which is the module's neutral directory. */
  readonly root: string;
  readonly host: SshGitHost;
  /** The scp-form URL of the served `acme/tools` repository. */
  readonly url: string;
  /** The commit that `main` of the served repository names. */
  readonly oid: string;
  /** The module with the stub `ssh` first on PATH and `config` as the user config. */
  readonly gitWith: (variables: NodeJS.ProcessEnv, config?: string) => Promise<GitProcess>;
}

// The ssh stand-in with `stand-in.test` registered and `acme/tools` served.
async function sshFixture(t: TestContext): Promise<SshFixture> {
  const root = await caseDirectory(t);
  const standIn = await startStandIn(t, (directory) =>
    SshGitHost.start(path.join(directory, "ssh"), {
      repositoriesRoot: path.join(directory, "repositories"),
    }),
  );
  await standIn.host.register("stand-in.test", { probe: { kind: "authenticated", user: "acme" } });
  const served = await createGitTestRepository(t, { boundary: "local" });
  await served.cloneBare(path.join(standIn.root, "repositories", "acme", "tools.git"));
  const env = hermeticGitEnvironment(root, { PATH: standIn.host.searchPath() });
  return {
    root,
    host: standIn.host,
    url: "git@stand-in.test:acme/tools.git",
    oid: served.initialOid,
    gitWith: (variables, config = "") => realGit({ root, env: { ...env, ...variables }, config }),
  };
}

interface HttpsFixture {
  /** The case directory, which is the module's neutral directory and HOME. */
  readonly root: string;
  readonly host: HttpsGitHost;
  /** The URL of the served `acme/tools` repository. */
  readonly url: string;
  /** The base environment that trusts the host's certificate. */
  readonly env: NodeJS.ProcessEnv;
}

// The https stand-in, serving `acme/tools`.
async function httpsFixture(t: TestContext): Promise<HttpsFixture> {
  const root = await caseDirectory(t);
  const { host } = await startStandIn(t, (directory) => HttpsGitHost.start(directory));
  const served = await createGitTestRepository(t, { boundary: "local" });
  await served.cloneBare(host.repositoryPath("tools"));
  return {
    root,
    host,
    url: host.repositoryUrl("tools"),
    env: hermeticGitEnvironment(root, { GIT_SSL_CAINFO: host.certificatePath }),
  };
}

interface PidRecordingSpawn {
  readonly spawn: ProcessSpawn;
  /** The pid of the first git started with `subcommand` among its arguments. */
  readonly pidOf: (subcommand: string) => number;
}

// Node's spawn, recording the pid of each git it starts.
function pidRecordingSpawn(): PidRecordingSpawn {
  const launched: Array<{ readonly args: readonly string[]; readonly pid: number | undefined }> =
    [];
  return {
    spawn: (command, args, options) => {
      const child = NODE_SPAWN(command, args, options);
      launched.push({ args, pid: child.pid });
      return child;
    },
    pidOf: (subcommand) => {
      const pid = launched.find(({ args }) => args.includes(subcommand))?.pid;
      if (pid === undefined) {
        throw new Error(`no git ${subcommand} started`);
      }

      return pid;
    },
  };
}

// A real-git run that rejects at its timeout of `timeoutMs`.
function rejectsWithTimeout(timeoutMs: number): (error: unknown) => boolean {
  return (error) => {
    assert.ok(error instanceof GitCommandError);
    assert.deepStrictEqual(error.failure, { kind: "timeout", timeoutMs });
    return true;
  };
}

// Q14 `nn`: the read of the user's ssh settings, on the local lane.
const SSH_READ = [
  ...hardening("/dev/null"),
  ...LOCAL_LANE,
  "config",
  "--get-regexp",
  "--end-of-options",
  String.raw`^(core\.sshcommand|ssh\.variant)$`,
];

// D-SG-05: the options Pi appends to an OpenSSH command.
const BATCH_OPTIONS = "-o BatchMode=yes -o StrictHostKeyChecking=yes";

const SSH_LIST: GitRequest = {
  subcommand: "ls-remote",
  lane: "network",
  operands: ["git@h.test:acme/tools.git"],
  timeoutMs: 5_000,
};

// What the stub ssh receives for `acme/tools` on `stand-in.test`: git puts
// Pi's options first, then its own protocol option and the destination.
// D-SG-08: the stub's base name is `ssh`, so git runs no `-G` check.
const STAND_IN_BATCH = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=yes"];
const STAND_IN_PROTOCOL = ["-o", "SendEnv=GIT_PROTOCOL", "git@stand-in.test"];
const STAND_IN_UPLOAD = "git-upload-pack 'acme/tools.git'";

// The GIT_SSH_COMMAND that runs `command` from the neutral directory.
function fromNeutral(command: string, neutral = "/tmp"): string {
  return `CDPATH= cd -- '${neutral}' 2>/dev/null || cd / || exit 1; ${command}`;
}

interface ConfigAnswer {
  readonly code: number;
  readonly stdout: string;
}

// `git config --get-regexp` exits 1 when no key matches.
const NO_SSH_CONFIG: ConfigAnswer = { code: 1, stdout: "" };

function sshConfigLines(stdout: string): ConfigAnswer {
  return { code: 0, stdout };
}

// Runs `request` over `env`, answers the config read with `answer`, and
// closes the command with 0.
async function runAfterSshRead(
  env: NodeJS.ProcessEnv,
  answer: ConfigAnswer,
  request: GitRequest = SSH_LIST,
  setup: HostSetup = {},
): Promise<readonly ProcessLaunch[]> {
  const { git, launches } = createSequencedGit(setup, env);
  const pending = git.run(request);
  const read = await launches.at(0);
  read.writeStdout(answer.stdout);
  read.close(answer.code);
  (await launches.at(1)).close(0);
  await pending;
  return launches.all();
}

interface ProjectFixture {
  readonly home: string;
  /** The user's own project repository. */
  readonly project: GitTestRepository;
  /** A clone directory without `.git` inside the project. */
  readonly nested: string;
  /** A directory outside the project. */
  readonly outside: string;
  /** A symlink in `outside` that points at `nested`. */
  readonly link: string;
  /** The module, with the case's HOME and an empty user config. */
  readonly git: GitProcess;
}

async function projectFixture(t: TestContext): Promise<ProjectFixture> {
  const home = await caseDirectory(t);
  const project = await createGitTestRepository(t, { boundary: "local" });
  const nested = path.join(project.dir, ".pi/pi-claude-marketplace/clones/tools");
  await mkdir(nested, { recursive: true });
  const outside = await createGitTestDirectory(t, { boundary: "local" });
  const link = path.join(outside, "tools");
  await symlink(nested, link);
  const git = createGitProcess({
    spawn: NODE_SPAWN,
    host: { ...NODE_GIT_HOST, neutralDirectory: () => Promise.resolve(home) },
    env: hermeticGitEnvironment(home),
    killGraceMs: KILL_GRACE_MS,
  });
  return { home, project, nested, outside, link, git };
}

describe("createGitProcess", () => {
  test("D-SG-04: spawns the first absolute git on PATH with the hardened argv and the neutral directory", async () => {
    // arrange
    const { git, control, started, host } = createFakeGit(
      { PATH: "relative::/opt/tools:/usr/bin" },
      { neutral: "/private/tmp" },
    );

    // act
    const pending = git.run(FILL);
    await started;
    control.writeStdout("username=x-access-token\npassword=token-1\n");
    control.close(0);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, {
      exitCode: 0,
      stdout: "username=x-access-token\npassword=token-1\n",
      stderr: "",
    });
    assert.deepStrictEqual(control.launches(), [
      [
        "/usr/bin/git",
        [...hardening("/dev/null"), "credential", "fill"],
        {
          cwd: "/private/tmp",
          env: {
            ...POSIX_FORCED,
            PATH: "/opt/tools:/usr/bin",
            GIT_CEILING_DIRECTORIES: "/private",
          },
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
          detached: true,
          windowsHide: true,
        },
      ],
    ]);
    assert.deepStrictEqual(host.probes, ["/opt/tools/git", "/usr/bin/git"]);
    assert.strictEqual(control.input(), FILL_INPUT);
    assert.strictEqual(control.inputEnded(), true);
  });

  test("SG-PRC-02, SG-PRC-03: forces the non-interactive values and keeps the user's git configuration", async () => {
    // arrange
    const base: NodeJS.ProcessEnv = {
      PATH: "relative::/opt/tools:/usr/bin",
      HOME: "/home/user",
      GIT_CONFIG_GLOBAL: "/home/user/.gitconfig",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "credential.helper",
      GIT_CONFIG_VALUE_0: "store",
      GIT_CONFIG_PARAMETERS: "'user.name'='user'",
      SSH_AUTH_SOCK: "/run/user/agent.sock",
      HTTPS_PROXY: "http://proxy.test:3128",
      NO_PROXY: "localhost",
      GIT_TERMINAL_PROMPT: "1",
      GIT_ASKPASS: "/usr/bin/ksshaskpass",
      GCM_INTERACTIVE: "always",
      GIT_LFS_SKIP_SMUDGE: "0",
      GIT_DEFAULT_REF_FORMAT: "reftable",
      GIT_DIR: "/elsewhere/.git",
      GIT_WORK_TREE: "/elsewhere",
      GIT_COMMON_DIR: "/elsewhere/.git",
      GIT_INDEX_FILE: "/elsewhere/.git/index",
      GIT_DISCOVERY_ACROSS_FILESYSTEM: "1",
      GIT_OBJECT_DIRECTORY: "/elsewhere/.git/objects",
      GIT_ALTERNATE_OBJECT_DIRECTORIES: "/elsewhere/objects",
      GIT_SHALLOW_FILE: "/elsewhere/.git/shallow",
      GIT_NAMESPACE: "elsewhere",
      GIT_IMPLICIT_WORK_TREE: "0",
      GIT_REFERENCE_BACKEND: "reftable",
      GIT_TEMPLATE_DIR: "/elsewhere/templates",
      GIT_CEILING_DIRECTORIES: "/elsewhere",
      LC_ALL: "de_DE.UTF-8",
      LC_MESSAGES: "de_DE.UTF-8",
    };
    const unchangedBase = structuredClone(base);
    const { git, control, started } = createFakeGit(base, {
      neutral: "/private/tmp",
    });

    // act
    const pending = git.run(FILL);
    await started;
    control.close(0);
    await pending;

    // assert
    assert.deepStrictEqual(control.launches()[0]?.[2].env, {
      ...POSIX_FORCED,
      PATH: "/opt/tools:/usr/bin",
      HOME: "/home/user",
      GIT_CONFIG_GLOBAL: "/home/user/.gitconfig",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "credential.helper",
      GIT_CONFIG_VALUE_0: "store",
      GIT_CONFIG_PARAMETERS: "'user.name'='user'",
      SSH_AUTH_SOCK: "/run/user/agent.sock",
      HTTPS_PROXY: "http://proxy.test:3128",
      NO_PROXY: "localhost",
      GIT_CEILING_DIRECTORIES: "/private",
      LC_CTYPE: "de_DE.UTF-8",
    });
    assert.deepStrictEqual(base, unchangedBase);
  });

  test("SG-PRC-02: keeps the user's own proxy command, lazy-fetch, and replace-objects values", async () => {
    // arrange
    const { git, control, started } = createFakeGit({
      PATH: "/usr/bin",
      GIT_PROXY_COMMAND: "/usr/local/bin/proxy",
      GIT_NO_LAZY_FETCH: "0",
      GIT_NO_REPLACE_OBJECTS: "0",
    });

    // act
    const pending = git.run(FILL);
    await started;
    control.close(0);
    await pending;

    // assert
    assert.deepStrictEqual(control.launches()[0]?.[2].env, {
      ...POSIX_FORCED,
      PATH: "/usr/bin",
      GIT_PROXY_COMMAND: "/usr/local/bin/proxy",
      GIT_NO_LAZY_FETCH: "0",
      GIT_NO_REPLACE_OBJECTS: "0",
      GIT_CEILING_DIRECTORIES: "/",
    });
  });

  for (const { askpass, label } of [
    { askpass: undefined, label: "no GIT_ASKPASS" },
    { askpass: "", label: "an empty GIT_ASKPASS" },
    { askpass: "/usr/bin/ksshaskpass", label: "an askpass program" },
  ]) {
    test(`SG-PRC-02: gives git an empty GIT_ASKPASS for ${label}`, async () => {
      // arrange
      const { git, control, started } = createFakeGit({
        PATH: "/usr/bin",
        ...(askpass !== undefined && { GIT_ASKPASS: askpass }),
      });

      // act
      const pending = git.run(FILL);
      await started;
      control.close(0);
      await pending;

      // assert
      assert.strictEqual(control.launches()[0]?.[2].env.GIT_ASKPASS, "");
    });
  }

  test("SG-PRC-02: on Windows replaces every spelling of a forced variable and runs git.exe", async () => {
    // arrange
    const { git, control, started } = createFakeGit(
      { Path: '"C:\\Git\\cmd";relative', Git_Askpass: "x", git_terminal_prompt: "1" },
      {
        platform: "win32",
        files: [String.raw`C:\Git\cmd\git.exe`],
        cwd: String.raw`C:\work\project`,
        neutral: String.raw`C:\Users\user\AppData\Local\Temp`,
      },
    );

    // act
    const pending = git.run(FILL);
    await started;
    control.close(0);
    await pending;

    // assert
    assert.deepStrictEqual(control.launches(), [
      [
        String.raw`C:\Git\cmd\git.exe`,
        [...hardening(String.raw`\\.\NUL`), "credential", "fill"],
        {
          cwd: String.raw`C:\Users\user\AppData\Local\Temp`,
          env: {
            ...POSIX_FORCED,
            Path: String.raw`C:\Git\cmd`,
            GIT_CEILING_DIRECTORIES: String.raw`C:\Users\user\AppData\Local`,
          },
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
          detached: false,
          windowsHide: true,
        },
      ],
    ]);
  });

  for (const { launcher } of [{ launcher: "git.cmd" }, { launcher: "git.bat" }]) {
    test(`D-PL9-18: refuses a ${launcher} found first as git-missing`, async () => {
      // arrange
      const { git } = createFakeGit(
        { PATH: String.raw`C:\Git\cmd` },
        { platform: "win32", files: [path.win32.join(String.raw`C:\Git\cmd`, launcher)] },
      );

      // act & assert
      await assert.rejects(
        git.locate(),
        gitFailure({
          failure: { kind: "git-missing", detail: "batch-launcher" },
          operation: "lookup",
          exitCode: null,
          stderr: "",
        }),
      );
    });
  }

  for (const { label, pathValue, cwd, realpaths, expected } of [
    {
      label: "in the working directory",
      pathValue: String.raw`C:\work\project;C:\Git\cmd`,
      cwd: String.raw`C:\work\project`,
      realpaths: {},
      expected: String.raw`C:\Git\cmd\git.exe`,
    },
    {
      label: "below the working directory in another case",
      pathValue: String.raw`c:\WORK\Project\bin;C:\Git\cmd`,
      cwd: String.raw`C:\work\project`,
      realpaths: {},
      expected: String.raw`C:\Git\cmd\git.exe`,
    },
    {
      label: "whose real path lies in the working directory",
      pathValue: String.raw`C:\link\bin;C:\Git\cmd`,
      cwd: String.raw`C:\work\project`,
      realpaths: { [String.raw`C:\link\bin`]: String.raw`C:\work\project\bin` },
      expected: String.raw`C:\Git\cmd\git.exe`,
    },
    {
      label: "in the real path of the working directory",
      pathValue: String.raw`C:\work\project\bin;D:\Git\cmd`,
      cwd: String.raw`C:\short`,
      realpaths: { [String.raw`C:\short`]: String.raw`C:\work\project` },
      expected: String.raw`D:\Git\cmd\git.exe`,
    },
  ]) {
    test(`D-SG-04: skips a Windows git ${label} and runs a later one`, async () => {
      // arrange
      const directories = pathValue.split(";");
      const { git } = createFakeGit(
        { PATH: pathValue },
        {
          platform: "win32",
          files: directories.map((directory) => path.win32.join(directory, "git.exe")),
          cwd,
          realpaths,
        },
      );

      // act
      const found = await git.locate();

      // assert
      assert.strictEqual(found, expected);
    });
  }

  for (const { label, env, platform } of [
    { label: "an unset PATH", env: {}, platform: "linux" },
    { label: "an empty PATH", env: { PATH: "" }, platform: "linux" },
    { label: "an all-relative PATH", env: { PATH: "bin:.:" }, platform: "linux" },
    { label: "an unset Windows PATH", env: {}, platform: "win32" },
  ] as const) {
    test(`SG-PRC-06: gives git-missing for ${label} and spawns nothing`, async () => {
      // arrange
      const { git, control, host } = createFakeGit(env, { platform });

      // act & assert
      await assert.rejects(
        git.run(FILL),
        gitFailure({
          failure: { kind: "git-missing", detail: "not-found" },
          operation: "lookup",
          exitCode: null,
          stderr: "",
        }),
      );
      assert.deepStrictEqual(control.launches(), []);
      assert.deepStrictEqual(host.probes, []);
    });
  }

  test("NFR-2: finds a git installed after a lookup missed", async () => {
    // arrange
    const { git, host } = createFakeGit({ PATH: "/usr/bin" }, { files: [] });
    await assert.rejects(git.locate(), GitCommandError);
    host.files.add("/usr/bin/git");

    // act
    const found = await git.locate();

    // assert
    assert.strictEqual(found, "/usr/bin/git");
  });

  test("D-SG-04: does not probe a found git again for the same PATH and working directory", async () => {
    // arrange
    const { git, host } = createFakeGit({ PATH: "/opt/tools:/usr/bin" });
    await git.locate();

    // act
    const found = await git.locate();

    // assert
    assert.strictEqual(found, "/usr/bin/git");
    assert.deepStrictEqual(host.probes, ["/opt/tools/git", "/usr/bin/git"]);
  });

  test("D-SG-04: looks git up again for a different PATH", async () => {
    // arrange
    const env: NodeJS.ProcessEnv = { PATH: "/usr/bin" };
    const { git, host } = createFakeGit(env, { files: ["/usr/bin/git", "/opt/tools/git"] });
    await git.locate();
    env.PATH = "/opt/tools";

    // act
    const found = await git.locate();

    // assert
    assert.strictEqual(found, "/opt/tools/git");
    assert.deepStrictEqual(host.probes, ["/usr/bin/git", "/opt/tools/git"]);
  });

  test("D-SG-04: looks git up again for a different working directory", async () => {
    // arrange
    const { git, host } = createFakeGit();
    await git.locate();
    host.cwd = "/work/other";

    // act
    const found = await git.locate();

    // assert
    assert.strictEqual(found, "/usr/bin/git");
    assert.deepStrictEqual(host.probes, ["/usr/bin/git", "/usr/bin/git"]);
  });

  for (const { label, env, setup } of [
    { label: "/usr/bin/git", env: { PATH: "/usr/bin" }, setup: {} },
    {
      label: "a git whose real path is /usr/bin/git",
      env: { PATH: "/usr/local/bin" },
      setup: {
        files: ["/usr/local/bin/git"],
        realpaths: { "/usr/local/bin/git": "/usr/bin/git" },
      },
    },
    {
      label: "/usr/bin/git with a relative DEVELOPER_DIR",
      env: { PATH: "/usr/bin", DEVELOPER_DIR: "Developer" },
      setup: { files: ["/usr/bin/git", "Developer/usr/bin/git"] },
    },
    {
      label: "/usr/bin/git with an unreadable xcode-select link",
      env: { PATH: "/usr/bin" },
      setup: { unresolvable: ["/var/db/xcode_select_link"] },
    },
  ]) {
    test(`D-SG-04, SG-PRC-06: on macOS refuses ${label} as the xcrun shim before any spawn`, async () => {
      // arrange
      const { git, control } = createFakeGit(env, { platform: "darwin", ...setup });

      // act & assert
      await assert.rejects(
        git.run(FILL),
        gitFailure({
          failure: { kind: "git-missing", detail: "macos-shim" },
          operation: "lookup",
          exitCode: null,
          stderr: "",
        }),
      );
      assert.deepStrictEqual(control.launches(), []);
    });
  }

  test("D-SG-04: on macOS looks for a real git in DEVELOPER_DIR, the xcode-select choice, and the Command Line Tools", async () => {
    // arrange
    const { git, host } = createFakeGit(
      { PATH: "/usr/bin", DEVELOPER_DIR: "/Applications/Xcode.app/Contents/Developer" },
      {
        platform: "darwin",
        realpaths: {
          "/var/db/xcode_select_link": "/Applications/Xcode-beta.app/Contents/Developer",
        },
      },
    );

    // act
    await assert.rejects(git.locate(), GitCommandError);

    // assert
    assert.deepStrictEqual(host.probes, [
      "/usr/bin/git",
      "/Applications/Xcode.app/Contents/Developer/usr/bin/git",
      "/Applications/Xcode-beta.app/Contents/Developer/usr/bin/git",
      "/Library/Developer/CommandLineTools/usr/bin/git",
    ]);
  });

  for (const { label, env, setup } of [
    {
      label: "DEVELOPER_DIR",
      env: { PATH: "/usr/bin", DEVELOPER_DIR: "/Applications/Xcode.app/Contents/Developer" },
      setup: { files: ["/usr/bin/git", "/Applications/Xcode.app/Contents/Developer/usr/bin/git"] },
    },
    {
      label: "the xcode-select choice",
      env: { PATH: "/usr/bin" },
      setup: {
        files: ["/usr/bin/git", "/Applications/Xcode.app/Contents/Developer/usr/bin/git"],
        realpaths: { "/var/db/xcode_select_link": "/Applications/Xcode.app/Contents/Developer" },
      },
    },
    {
      label: "the Command Line Tools",
      env: { PATH: "/usr/bin" },
      setup: { files: ["/usr/bin/git", "/Library/Developer/CommandLineTools/usr/bin/git"] },
    },
  ]) {
    test(`D-SG-04: on macOS runs /usr/bin/git when ${label} holds a real git`, async () => {
      // arrange
      const { git } = createFakeGit(env, { platform: "darwin", ...setup });

      // act
      const found = await git.locate();

      // assert
      assert.strictEqual(found, "/usr/bin/git");
    });
  }

  test("D-SG-04: on macOS runs a git found before /usr/bin with no shim check", async () => {
    // arrange
    const { git, host } = createFakeGit(
      { PATH: "/opt/homebrew/bin:/usr/bin" },
      {
        platform: "darwin",
        files: ["/opt/homebrew/bin/git", "/usr/bin/git"],
        realpaths: { "/opt/homebrew/bin/git": "/opt/homebrew/Cellar/git/2.47.0/bin/git" },
      },
    );

    // act
    const found = await git.locate();

    // assert
    assert.strictEqual(found, "/opt/homebrew/bin/git");
    assert.deepStrictEqual(host.probes, ["/opt/homebrew/bin/git"]);
  });

  test("NFR-2: finds the Command Line Tools installed after a shim verdict", async () => {
    // arrange
    const { git, host } = createFakeGit({ PATH: "/usr/bin" }, { platform: "darwin" });
    await assert.rejects(git.locate(), GitCommandError);
    host.files.add("/Library/Developer/CommandLineTools/usr/bin/git");

    // act
    const found = await git.locate();

    // assert
    assert.strictEqual(found, "/usr/bin/git");
  });

  for (const { code } of [{ code: "ENOENT" }, { code: "EACCES" }]) {
    test(`D-SG-04: reports a git that is gone at a spawn ${code} as git-missing and looks it up again`, async () => {
      // arrange
      const startError = Object.assign(new Error(`spawn /usr/bin/git ${code}`), { code });
      const { git, control, started, host } = createFakeGit(undefined, undefined, null);
      const pending = git.run(FILL);
      await started;
      host.files.delete("/usr/bin/git");
      control.fail(startError);
      await assert.rejects(
        pending,
        gitFailure({
          failure: { kind: "git-missing", detail: "not-found" },
          operation: "credential fill",
          exitCode: null,
          stderr: "",
          cause: startError,
        }),
      );
      host.files.add("/usr/bin/git");

      // act
      const found = await git.locate();

      // assert
      assert.strictEqual(found, "/usr/bin/git");
      assert.deepStrictEqual(host.probes, ["/usr/bin/git", "/usr/bin/git", "/usr/bin/git"]);
    });
  }

  test("D-SG-04: keeps a git that still exists after a spawn ENOENT and reports failed", async () => {
    // arrange
    const startError = Object.assign(new Error("spawn /usr/bin/git ENOENT"), { code: "ENOENT" });
    const { git, control, started, host } = createFakeGit(undefined, undefined, null);
    const pending = git.run(FILL);
    await started;
    control.fail(startError);
    await assert.rejects(
      pending,
      gitFailure({
        failure: { kind: "failed" },
        operation: "credential fill",
        exitCode: null,
        stderr: "",
        cause: startError,
      }),
    );

    // act
    const found = await git.locate();

    // assert
    assert.strictEqual(found, "/usr/bin/git");
    assert.deepStrictEqual(host.probes, ["/usr/bin/git", "/usr/bin/git"]);
  });

  for (const { label, code, stderr, failure } of [
    {
      label: "an exit 127",
      code: 127,
      stderr: "",
      failure: { kind: "git-missing", detail: "not-found" },
    },
    {
      label: "an xcrun error",
      code: 1,
      stderr: "xcrun: error: invalid active developer path (/Library/Developer/CommandLineTools)\n",
      failure: { kind: "git-missing", detail: "macos-shim" },
    },
  ] as const) {
    test(`D-SG-04: reports ${label} as git-missing and looks git up again`, async () => {
      // arrange
      const { git, control, started, host } = createFakeGit();
      const pending = git.run(FILL);
      await started;
      control.writeStderr(stderr);
      control.close(code);
      await assert.rejects(
        pending,
        gitFailure({ failure, operation: "credential fill", exitCode: code, stderr }),
      );

      // act
      const found = await git.locate();

      // assert
      assert.strictEqual(found, "/usr/bin/git");
      assert.deepStrictEqual(host.probes, ["/usr/bin/git", "/usr/bin/git"]);
    });
  }

  test("resolves a run that exits with 0 under a signal that never aborts", async () => {
    // arrange
    const { git, control, started } = createFakeGit();

    // act
    const pending = git.run({ ...FILL, signal: new AbortController().signal });
    await started;
    control.writeStdout("out");
    control.writeStderr("warning");
    control.close(0);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { exitCode: 0, stdout: "out", stderr: "warning" });
  });

  test("resolves a run that exits with an allowed code", async () => {
    // arrange
    const { git, control, started } = createFakeGit();

    // act
    const pending = git.run({ ...FILL, allowExit: [1] });
    await started;
    control.writeStdout("listed");
    control.close(1);
    const run = await pending;

    // assert
    assert.deepStrictEqual(run, { exitCode: 1, stdout: "listed", stderr: "" });
  });

  for (const { label, allowExit, code } of [
    { label: "an exit without allowed codes", allowExit: undefined, code: 128 },
    { label: "an exit outside the allowed codes", allowExit: [1], code: 2 },
  ]) {
    test(`SG-PRC-05: rejects ${label} as failed with redacted stderr`, async () => {
      // arrange
      const { git, control, started } = createFakeGit();

      // act
      const pending = git.run({ ...FILL, ...(allowExit !== undefined && { allowExit }) });
      await started;
      control.writeStderr(
        "fatal: unexpected answer from 'https://user:secret@example.test/x.git/'\n",
      );
      control.close(code);

      // assert
      await assert.rejects(
        pending,
        gitFailure({
          failure: { kind: "failed" },
          operation: "credential fill",
          exitCode: code,
          stderr: "fatal: unexpected answer from 'https://***@example.test/x.git/'\n",
        }),
      );
    });
  }

  test("SG-PRC-05: rejects a run that closes without an exit code or stderr as no-stderr", async () => {
    // arrange
    const { git, control, started } = createFakeGit();

    // act
    const pending = git.run(FILL);
    await started;
    control.close(null);

    // assert
    await assert.rejects(
      pending,
      gitFailure({
        failure: { kind: "no-stderr" },
        operation: "credential fill",
        exitCode: null,
        stderr: "",
      }),
    );
  });

  test("SG-PRC-05: rejects a disallowed exit with the kind its C-locale stderr names", async () => {
    // arrange
    const { git, control, started } = createFakeGit();

    // act
    const pending = git.run(FILL);
    await started;
    control.writeStderr("fatal: transport 'ext' not allowed\n");
    control.close(128);

    // assert
    await assert.rejects(
      pending,
      gitFailure({
        failure: { kind: "protocol-refused" },
        operation: "credential fill",
        exitCode: 128,
        stderr: "fatal: transport 'ext' not allowed\n",
      }),
    );
  });

  test("D-SG-06: logs the git version once after a git-too-old failure", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const { git, launches } = createSequencedGit({ neutral: "/private/tmp" });

    // act
    const pending = git.run(FILL);
    const fill = await launches.at(0);
    fill.writeStderr("error: unknown option `no-such-flag'\n");
    fill.close(129);
    const version = await launches.at(1);
    version.writeStdout("git version 2.17.1\nextra\n");
    version.close(0);

    // assert
    await assert.rejects(
      pending,
      gitFailure({
        failure: { kind: "git-too-old" },
        operation: "credential fill",
        exitCode: 129,
        stderr: "error: unknown option `no-such-flag'\n",
      }),
    );
    assert.deepStrictEqual(logged, ["[git] git version: git version 2.17.1"]);
    assert.deepStrictEqual(
      launches.all().map(([command, args, options]) => [command, args, options.cwd]),
      [
        ["/usr/bin/git", [...hardening("/dev/null"), "credential", "fill"], "/private/tmp"],
        ["/usr/bin/git", [...hardening("/dev/null"), "version"], "/private/tmp"],
      ],
    );
  });

  test("D-SG-06: logs an unreadable version and keeps the git-too-old failure when the version read fails", async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const { git, launches } = createSequencedGit();

    // act
    const pending = git.run(FILL);
    const fill = await launches.at(0);
    fill.close(129);
    const version = await launches.at(1);
    version.writeStderr("error: unknown option `version'\n");
    version.close(129);

    // assert
    await assert.rejects(
      pending,
      gitFailure({
        failure: { kind: "git-too-old" },
        operation: "credential fill",
        exitCode: 129,
        stderr: "",
      }),
    );
    assert.deepStrictEqual(logged, ["[git] git version: unreadable"]);
    assert.strictEqual(launches.all().length, 2);
  });

  test("SG-PRC-01: rejects a run past its timeout with the limit after stopping its process tree", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { git, started, host } = createFakeGit();

    // act
    const pending = git.run({ ...FILL, timeoutMs: 50 });
    await started;
    t.mock.timers.tick(50);
    t.mock.timers.tick(KILL_GRACE_MS);
    t.mock.timers.tick(KILL_GRACE_MS);

    // assert
    await assert.rejects(
      pending,
      gitFailure({
        failure: { kind: "timeout", timeoutMs: 50 },
        operation: "credential fill",
        exitCode: null,
        stderr: "",
      }),
    );
    assert.deepStrictEqual(host.groupSignals, [
      [4242, "SIGTERM"],
      [4242, "SIGKILL"],
    ]);
  });

  test("rejects an already-aborted request before any lookup or spawn", async () => {
    // arrange
    const reason = new Error("cancelled");
    const controller = new AbortController();
    controller.abort(reason);
    const { git, control, host } = createFakeGit();

    // act & assert
    await assert.rejects(
      git.run({ ...FILL, signal: controller.signal }),
      gitFailure({
        failure: { kind: "aborted" },
        operation: "credential fill",
        exitCode: null,
        stderr: "",
        cause: reason,
      }),
    );
    assert.deepStrictEqual(control.launches(), []);
    assert.deepStrictEqual(host.probes, []);
  });

  test("rejects a run aborted while it runs as aborted after stopping its process tree", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const reason = new Error("cancelled");
    const controller = new AbortController();
    const { git, started, host } = createFakeGit();

    // act
    const pending = git.run({ ...FILL, signal: controller.signal });
    await started;
    controller.abort(reason);
    t.mock.timers.tick(KILL_GRACE_MS);
    t.mock.timers.tick(KILL_GRACE_MS);

    // assert
    await assert.rejects(
      pending,
      gitFailure({
        failure: { kind: "aborted" },
        operation: "credential fill",
        exitCode: null,
        stderr: "",
        cause: reason,
      }),
    );
    assert.deepStrictEqual(host.groupSignals, [
      [4242, "SIGTERM"],
      [4242, "SIGKILL"],
    ]);
  });

  test("rejects a run whose launcher throws as failed with that error as cause", async () => {
    // arrange
    const launchError = new Error("spawn EACCES");
    const git = createGitProcess({
      spawn: () => {
        throw launchError;
      },
      host: createHost().host,
      env: { PATH: "/usr/bin" },
      killGraceMs: KILL_GRACE_MS,
    });

    // act & assert
    await assert.rejects(
      git.run(FILL),
      gitFailure({
        failure: { kind: "failed" },
        operation: "credential fill",
        exitCode: null,
        stderr: "",
        cause: launchError,
      }),
    );
  });

  test("E11: rejects with the filesystem error of a working directory that does not exist", async () => {
    // arrange
    const missing = Object.assign(new Error("ENOENT: no such file or directory"), {
      code: "ENOENT",
    });
    const { host, control } = createFakeGit();
    const git = createGitProcess({
      spawn: control.spawn,
      host: { ...host.host, realpath: () => Promise.reject(missing) },
      env: { PATH: "/usr/bin" },
      killGraceMs: KILL_GRACE_MS,
    });

    // act & assert
    await assert.rejects(git.run({ ...FILL, cwd: "/gone" }), (error: unknown) => {
      assert.strictEqual(error, missing);
      return true;
    });
    assert.deepStrictEqual(control.launches(), []);
  });

  test("SG-PRC-03: refuses a working directory whose parent holds the PATH delimiter", async () => {
    // arrange
    const { git, control } = createFakeGit({ PATH: "/usr/bin" }, { neutral: "/srv/a:b/tmp" });

    // act & assert
    await assert.rejects(
      git.run(FILL),
      gitFailure({
        failure: { kind: "refused-input" },
        operation: "credential fill",
        exitCode: null,
        stderr: "",
      }),
    );
    assert.deepStrictEqual(control.launches(), []);
  });

  test("SG-PRC-03: rejects as failed with the cause when the neutral directory cannot be made", async () => {
    // arrange
    const refused = new Error(
      "/agent/pi-claude-marketplace/git-neutral is not a private, empty directory",
    );
    const { git, control } = createFakeGit({ PATH: "/usr/bin" }, { neutralFailure: refused });

    // act & assert
    await assert.rejects(
      git.run(FILL),
      gitFailure({
        failure: { kind: "failed" },
        operation: "credential fill",
        exitCode: null,
        stderr: "",
        cause: refused,
      }),
    );
    assert.deepStrictEqual(control.launches(), []);
  });

  test("SG-PRC-01: starts git with closed stdin in the real path of the request's directory", async () => {
    // arrange
    const { git, control, started } = createFakeGit(
      { PATH: "/usr/bin" },
      { realpaths: { "/work/clone": "/real/clone" } },
    );

    // act
    const pending = git.run({
      subcommand: "credential",
      lane: "network",
      cwd: "/work/clone",
      timeoutMs: 5_000,
    });
    await started;
    control.close(0);
    await pending;

    // assert
    assert.deepStrictEqual(control.launches(), [
      [
        "/usr/bin/git",
        [...hardening("/dev/null"), "credential"],
        {
          cwd: "/real/clone",
          env: { ...POSIX_FORCED, PATH: "/usr/bin", GIT_CEILING_DIRECTORIES: "/real" },
          shell: false,
          stdio: ["ignore", "pipe", "pipe"],
          detached: true,
          windowsHide: true,
        },
      ],
    ]);
  });

  for (const { label, configure } of [
    {
      label: "core.askPass",
      configure: (script: string) => ({ config: `[core]\n\taskPass = ${script}\n`, variables: {} }),
    },
    {
      label: "GIT_ASKPASS",
      configure: (script: string) => ({ config: "", variables: { GIT_ASKPASS: script } }),
    },
    {
      label: "SSH_ASKPASS",
      configure: (script: string) => ({ config: "", variables: { SSH_ASKPASS: script } }),
    },
  ]) {
    test(`E10: never runs the user's ${label} program during a credential lookup`, async (t) => {
      // arrange
      const root = await caseDirectory(t);
      const askpass = await recordingScript(root, "askpass", "echo fromaskpass");
      const { config, variables } = configure(askpass.script);
      const configPath = path.join(root, "gitconfig");
      await writeFile(configPath, config);
      const git = createGitProcess({
        spawn: NODE_SPAWN,
        host: { ...NODE_GIT_HOST, neutralDirectory: () => Promise.resolve(root) },
        env: { ...hermeticGitEnvironment(root), GIT_CONFIG_GLOBAL: configPath, ...variables },
        killGraceMs: KILL_GRACE_MS,
      });

      // act
      const filled = git.run({ ...FILL, input: "protocol=https\nhost=example.test\n\n" });

      // assert
      await assert.rejects(filled, (error: unknown) => {
        assert.ok(error instanceof GitCommandError);
        assert.deepStrictEqual([error.kind, error.exitCode], ["https-auth", 128]);
        return true;
      });
      await assert.rejects(access(askpass.record), { code: "ENOENT" });
    });
  }

  test("SG-PRC-03: never consults the credential helper of a repository enclosing the neutral directory", async (t) => {
    // arrange
    const root = await caseDirectory(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const helper = await recordingScript(
      root,
      "helper",
      "echo username=fromhelper\necho password=fromhelper",
    );
    await repository.run("config", "credential.helper", `!${helper.script}`);
    const neutral = path.join(repository.dir, "neutral");
    await mkdir(neutral);
    const git = createGitProcess({
      spawn: NODE_SPAWN,
      host: { ...NODE_GIT_HOST, neutralDirectory: () => Promise.resolve(neutral) },
      env: hermeticGitEnvironment(root),
      killGraceMs: KILL_GRACE_MS,
    });

    // act
    const filled = git.run({ ...FILL, input: "protocol=https\nhost=example.test\n\n" });

    // assert
    await assert.rejects(filled, (error: unknown) => {
      assert.ok(error instanceof GitCommandError);
      assert.deepStrictEqual([error.kind, error.exitCode], ["https-auth", 128]);
      return true;
    });
    await assert.rejects(access(helper.record), { code: "ENOENT" });
  });

  for (const { layout, init } of [
    { layout: "a repository", init: ["init", "--quiet"] },
    { layout: "a bare repository layout", init: ["init", "--quiet", "--bare"] },
  ]) {
    test(`SG-PRC-03: runs neither the credential helper nor the ssh command of ${layout} planted in the neutral directory's parent`, async (t) => {
      // arrange
      const root = await caseDirectory(t);
      const shared = path.join(root, "shared");
      const bin = path.join(root, "bin");
      await mkdir(bin);
      const userSsh = await recordingScript(bin, "ssh", "exit 255");
      const helper = await recordingScript(root, "helper", "echo username=u\necho password=p");
      const plantedSsh = await recordingScript(root, "planted-ssh", "exit 255");
      const call = { cwd: root, home: root, variables: {} };
      await runSystemGit(call, ...init, shared);
      await runSystemGit(call, "-C", shared, "config", "credential.helper", `!${helper.script}`);
      await runSystemGit(call, "-C", shared, "config", "core.sshCommand", plantedSsh.script);
      const planted = await runSystemGit({ ...call, cwd: shared }, "config", "core.sshCommand");
      const git = createGitProcess({
        spawn: NODE_SPAWN,
        host: {
          ...NODE_GIT_HOST,
          neutralDirectory: createNeutralDirectory({ parent: () => shared, uid: process.getuid }),
        },
        env: hermeticGitEnvironment(root, {
          PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
        }),
        killGraceMs: KILL_GRACE_MS,
      });

      // act
      const filled = git.run({ ...FILL, input: "protocol=https\nhost=example.test\n\n" });
      const listed = git.run({ ...SSH_LIST, timeoutMs: 10_000 });

      // assert
      assert.strictEqual(planted, plantedSsh.script);
      await assert.rejects(filled, rejectsAs("https-auth", 128));
      await assert.rejects(listed, rejectsAs("ssh-auth", 128));
      await access(userSsh.record);
      await assert.rejects(access(helper.record), { code: "ENOENT" });
      await assert.rejects(access(plantedSsh.record), { code: "ENOENT" });
    });
  }

  test("SG-PRC-03: takes no bare repository layout for the working directory of a network-lane command", async (t) => {
    // arrange
    const root = await caseDirectory(t);
    const bare = path.join(root, "bare");
    const helper = await recordingScript(root, "helper", "echo username=u\necho password=p");
    const call = { cwd: root, home: root, variables: {} };
    await runSystemGit(call, "init", "--quiet", "--bare", bare);
    await runSystemGit(call, "-C", bare, "config", "credential.helper", `!${helper.script}`);
    const git = createGitProcess({
      spawn: NODE_SPAWN,
      host: { ...NODE_GIT_HOST, neutralDirectory: () => Promise.resolve(root) },
      env: hermeticGitEnvironment(root),
      killGraceMs: KILL_GRACE_MS,
    });

    // act
    const filled = git.run({ ...FILL, cwd: bare, input: "protocol=https\nhost=example.test\n\n" });

    // assert
    await assert.rejects(filled, rejectsAs("https-auth", 128));
    await assert.rejects(access(helper.record), { code: "ENOENT" });
  });
});

describe("createGitProcess operands and lanes", () => {
  for (const { label, request, words } of [
    {
      label: "clone",
      request: {
        subcommand: "clone",
        options: ["--quiet", "--no-checkout"],
        operands: ["https://example.test/x.git", "/work/clone"],
      },
      words: [
        "clone",
        "--quiet",
        "--no-checkout",
        "--end-of-options",
        "https://example.test/x.git",
        "/work/clone",
      ],
    },
    {
      label: "fetch",
      request: { subcommand: "fetch", options: ["--quiet"], operands: ["origin", "main"] },
      words: ["fetch", "--quiet", "--end-of-options", "origin", "main"],
    },
    {
      label: "ls-remote",
      request: {
        subcommand: "ls-remote",
        options: ["--heads"],
        operands: ["https://example.test/x.git"],
      },
      words: ["ls-remote", "--heads", "--end-of-options", "https://example.test/x.git"],
    },
    {
      label: "config",
      request: { subcommand: "config", options: ["--get-all"], operands: ["remote.origin.url"] },
      words: ["config", "--get-all", "--end-of-options", "remote.origin.url"],
    },
    {
      label: "tag",
      request: { subcommand: "tag", options: ["-l"], operands: ["v*"] },
      words: ["tag", "-l", "--end-of-options", "v*"],
    },
    {
      label: "update-ref",
      request: { subcommand: "update-ref", operands: ["refs/heads/pinned", "abc123"] },
      words: ["update-ref", "--end-of-options", "refs/heads/pinned", "abc123"],
    },
    {
      label: "rev-parse with --verify",
      request: { subcommand: "rev-parse", options: ["--verify", "--quiet"], operands: ["HEAD"] },
      words: ["rev-parse", "--verify", "--quiet", "--end-of-options", "HEAD"],
    },
    {
      label: "checkout",
      request: { subcommand: "checkout", options: ["--quiet"], operands: ["feature"] },
      words: ["checkout", "--quiet", "feature", "--"],
    },
    {
      label: "credential",
      request: { subcommand: "credential", options: ["fill"] },
      words: ["credential", "fill"],
    },
    {
      label: "version",
      request: { subcommand: "version" },
      words: ["version"],
    },
    {
      label: "ls-remote with operands that look like the marker or an option",
      request: {
        subcommand: "ls-remote",
        operands: ["--end-of-options", "--", "--upload-pack=x"],
      },
      words: ["ls-remote", "--end-of-options", "--end-of-options", "--", "--upload-pack=x"],
    },
    {
      label: "fetch with an empty operand list",
      request: { subcommand: "fetch", options: ["--quiet"], operands: [] },
      words: ["fetch", "--quiet"],
    },
    {
      label: "rev-parse without operands",
      request: { subcommand: "rev-parse", options: ["--show-toplevel"] },
      words: ["rev-parse", "--show-toplevel"],
    },
    {
      label: "checkout without operands",
      request: { subcommand: "checkout", options: ["--quiet"] },
      words: ["checkout", "--quiet"],
    },
  ] satisfies ReadonlyArray<{
    label: string;
    request: Pick<GitRequest, "subcommand" | "options" | "operands">;
    words: readonly string[];
  }>) {
    test(`SG-PRC-01, E7: places the operands of ${label} after Pi's options`, async () => {
      // arrange
      const { git, control, started } = createFakeGit();

      // act
      const pending = git.run({ ...request, lane: "local", timeoutMs: 5_000 });
      await started;
      control.close(0);
      await pending;

      // assert
      assert.deepStrictEqual(control.launches()[0]?.[1], [
        ...hardening("/dev/null"),
        ...LOCAL_LANE,
        ...words,
      ]);
    });
  }

  for (const { label, request } of [
    {
      label: "rev-parse with an operand and no --verify",
      request: { subcommand: "rev-parse", operands: ["HEAD"] },
    },
    {
      label: "checkout with an operand that starts with a dash",
      request: { subcommand: "checkout", operands: ["main", "--detach"] },
    },
    {
      label: "checkout with the operand --",
      request: { subcommand: "checkout", operands: ["--"] },
    },
    {
      label: "credential with an operand",
      request: { subcommand: "credential", operands: ["fill"] },
    },
    {
      label: "version with an operand",
      request: { subcommand: "version", operands: ["--build-options"] },
    },
  ] satisfies ReadonlyArray<{
    label: string;
    request: Pick<GitRequest, "subcommand" | "operands">;
  }>) {
    test(`SG-PRC-01, E7: refuses ${label} before any lookup or spawn`, async () => {
      // arrange
      const { git, control, host } = createFakeGit();

      // act & assert
      await assert.rejects(
        git.run({ ...request, lane: "local", timeoutMs: 5_000 }),
        gitFailure({
          failure: { kind: "refused-input" },
          operation: request.subcommand,
          exitCode: null,
          stderr: "",
        }),
      );
      assert.deepStrictEqual(control.launches(), []);
      assert.deepStrictEqual(host.probes, []);
    });
  }

  for (const { label, variables } of [
    { label: "unset protocol and ssh values", variables: {} },
    {
      label: "empty protocol and ssh values",
      variables: { GIT_ALLOW_PROTOCOL: "", GIT_SSH_COMMAND: "" },
    },
    {
      label: "a protocol list and an ssh program",
      variables: { GIT_ALLOW_PROTOCOL: "ext:https", GIT_SSH_COMMAND: "ssh -i /home/user/key" },
    },
    {
      label: "lazy fetch and LFS smudge turned back on",
      variables: { GIT_NO_LAZY_FETCH: "0", GIT_LFS_SKIP_SMUDGE: "0" },
    },
  ]) {
    test(`D-SG-02, SG-PRC-04: runs a local-lane request on the network-free lane over ${label}`, async () => {
      // arrange
      const { git, control, started } = createFakeGit(
        { PATH: "/usr/bin", ...USER_CONFIG, ...variables },
        { realpaths: { "/work/clone": "/real/clone" } },
      );

      // act
      const pending = git.run(LOCAL_READ);
      await started;
      control.close(0);
      await pending;

      // assert
      const [launch] = control.launches();
      assert.deepStrictEqual(
        [launch?.[1], launch?.[2].env],
        [
          [
            ...hardening("/dev/null"),
            ...LOCAL_LANE,
            "rev-parse",
            "--verify",
            "--end-of-options",
            "HEAD",
          ],
          {
            ...POSIX_FORCED,
            ...USER_CONFIG,
            PATH: "/usr/bin",
            GIT_CEILING_DIRECTORIES: "/real",
            GIT_ALLOW_PROTOCOL: "/",
            GIT_SSH_COMMAND: "false",
          },
        ],
      );
    });
  }

  test("D-SG-02: on Windows removes every spelling of a lane variable before setting it", async () => {
    // arrange
    const { git, control, started } = createFakeGit(
      {
        Path: String.raw`C:\Git\cmd`,
        git_allow_protocol: "ext:https",
        Git_Ssh_Command: "plink",
        git_no_lazy_fetch: "0",
      },
      {
        platform: "win32",
        files: [String.raw`C:\Git\cmd\git.exe`],
        cwd: String.raw`C:\work\project`,
      },
    );

    // act
    const pending = git.run({ ...LOCAL_READ, cwd: String.raw`C:\work\clone` });
    await started;
    control.close(0);
    await pending;

    // assert
    const [launch] = control.launches();
    assert.deepStrictEqual(
      [launch?.[1], launch?.[2].env],
      [
        [
          ...hardening(String.raw`\\.\NUL`),
          ...LOCAL_LANE,
          "rev-parse",
          "--verify",
          "--end-of-options",
          "HEAD",
        ],
        {
          ...POSIX_FORCED,
          Path: String.raw`C:\Git\cmd`,
          GIT_CEILING_DIRECTORIES: String.raw`C:\work`,
          GIT_ALLOW_PROTOCOL: "/",
          GIT_SSH_COMMAND: "false",
        },
      ],
    );
  });

  test("D-SG-02: gives a network-lane request none of the local lane's values or pairs", async () => {
    // arrange
    const env = { PATH: "/usr/bin", GIT_SSH_COMMAND: "ssh -i /home/user/key" };

    // act
    const launches = await runAfterSshRead(env, NO_SSH_CONFIG, {
      subcommand: "ls-remote",
      lane: "network",
      operands: ["https://example.test/x.git"],
      timeoutMs: 5_000,
    });

    // assert
    const launch = launches[1];
    assert.deepStrictEqual(
      [launch?.[1], launch?.[2].env],
      [
        [...hardening("/dev/null"), "ls-remote", "--end-of-options", "https://example.test/x.git"],
        {
          ...POSIX_FORCED,
          PATH: "/usr/bin",
          GIT_SSH_COMMAND: fromNeutral(`ssh -i /home/user/key ${BATCH_OPTIONS}`),
          GIT_SSH_VARIANT: "ssh",
          GIT_CEILING_DIRECTORIES: "/",
        },
      ],
    );
  });

  test("D-SG-02: gives a local-lane run and a network-lane run in flight together their own launch", async () => {
    // arrange
    const { git, launches } = createSequencedGit({
      realpaths: { "/work/clone": "/real/clone" },
    });

    // act
    const local = git.run(LOCAL_READ);
    const network = git.run({ ...FILL, cwd: "/work/clone" });
    const first = await launches.at(0);
    const second = await launches.at(1);
    second.close(0);
    first.close(0);
    await Promise.all([local, network]);

    // assert
    assert.deepStrictEqual(
      launches.all().map(([, args, options]) => [args, options.env]),
      [
        [
          [
            ...hardening("/dev/null"),
            ...LOCAL_LANE,
            "rev-parse",
            "--verify",
            "--end-of-options",
            "HEAD",
          ],
          {
            ...POSIX_FORCED,
            PATH: "/usr/bin",
            GIT_CEILING_DIRECTORIES: "/real",
            GIT_ALLOW_PROTOCOL: "/",
            GIT_SSH_COMMAND: "false",
          },
        ],
        [
          [...hardening("/dev/null"), "credential", "fill"],
          { ...POSIX_FORCED, PATH: "/usr/bin", GIT_CEILING_DIRECTORIES: "/real" },
        ],
      ],
    );
  });

  for (const { label, operand } of [
    { label: "a file:// URL", operand: (fixture: LaneFixture) => `file://${fixture.bare}` },
    { label: "a plain-path remote", operand: () => "origin" },
    { label: "an https URL", operand: () => "https://example.invalid/x.git" },
    { label: "an scp-form ssh URL", operand: () => "git@stand-in.test:acme/tools.git" },
    { label: "a remote-helper URL", operand: () => "foo::bar" },
  ]) {
    test(`SG-PRC-04, E3: refuses a local-lane fetch from ${label} under the user's always config`, async (t) => {
      // arrange
      const fixture = await laneFixture(t);

      // act
      const fetched = fixture.git.run({
        subcommand: "fetch",
        lane: "local",
        operands: [operand(fixture)],
        cwd: fixture.repository.dir,
        timeoutMs: 10_000,
      });

      // assert
      await assert.rejects(fetched, rejectsAs("protocol-refused", 128));
    });
  }

  test("SG-PRC-04: fetches the same plain-path remote on the network lane", async (t) => {
    // arrange
    const fixture = await laneFixture(t);

    // act
    const fetched = await fixture.git.run({
      subcommand: "fetch",
      lane: "network",
      options: ["--quiet"],
      operands: ["origin"],
      cwd: fixture.repository.dir,
      timeoutMs: 10_000,
    });

    // assert
    assert.deepStrictEqual(fetched, { exitCode: 0, stdout: "", stderr: "" });
  });

  for (const { label, request, observe, expected } of [
    {
      label: "rev-parse --verify of HEAD",
      request: () => ({ subcommand: "rev-parse", options: ["--verify"], operands: ["HEAD"] }),
      observe: ["rev-parse", "HEAD"],
      expected: (fixture: LaneFixture) => [
        `${fixture.repository.initialOid}\n`,
        fixture.repository.initialOid,
      ],
    },
    {
      label: "tag -l of v*",
      request: () => ({ subcommand: "tag", options: ["-l"], operands: ["v*"] }),
      observe: ["tag", "-l"],
      expected: () => ["v1.0.0\n", "v1.0.0"],
    },
    {
      label: "config --get-all of a key",
      request: () => ({
        subcommand: "config",
        options: ["--get-all"],
        operands: ["remote.origin.url"],
      }),
      observe: ["config", "--get-all", "remote.origin.url"],
      expected: (fixture: LaneFixture) => [`${fixture.bare}\n`, fixture.bare],
    },
    {
      label: "update-ref of a new ref",
      request: (fixture: LaneFixture) => ({
        subcommand: "update-ref",
        operands: ["refs/heads/pinned", fixture.repository.initialOid],
      }),
      observe: ["rev-parse", "refs/heads/pinned"],
      expected: (fixture: LaneFixture) => ["", fixture.repository.initialOid],
    },
    {
      label: "checkout of a branch",
      request: () => ({ subcommand: "checkout", options: ["--quiet"], operands: ["feature"] }),
      observe: ["symbolic-ref", "--short", "HEAD"],
      expected: () => ["", "feature"],
    },
  ] satisfies ReadonlyArray<{
    label: string;
    request: (fixture: LaneFixture) => Pick<GitRequest, "subcommand" | "options" | "operands">;
    observe: readonly string[];
    expected: (fixture: LaneFixture) => readonly [string, string];
  }>) {
    test(`SG-PRC-04, E3: runs a local-lane ${label} under the user's always config`, async (t) => {
      // arrange
      const fixture = await laneFixture(t);

      // act
      const read = await fixture.git.run({
        ...request(fixture),
        lane: "local",
        cwd: fixture.repository.dir,
        timeoutMs: 10_000,
      });

      // assert
      const observed = await runSystemGit(
        { cwd: fixture.repository.dir, home: fixture.root },
        ...observe,
      );
      assert.deepStrictEqual([read.stdout, observed], expected(fixture));
    });
  }

  test("SG-PRC-01: passes an operand that looks like --upload-pack to git as data", async (t) => {
    // arrange
    const fixture = await laneFixture(t);
    const program = await recordingScript(fixture.root, "upload-pack", "exit 1");
    await assert.rejects(
      runSystemGit(
        { cwd: fixture.repository.dir, home: fixture.root },
        "ls-remote",
        `--upload-pack=${program.script}`,
        "origin",
      ),
    );
    await access(program.record);
    await rm(program.record);

    // act
    const listed = fixture.git.run({
      subcommand: "ls-remote",
      lane: "network",
      operands: [`--upload-pack=${program.script}`],
      cwd: fixture.repository.dir,
      timeoutMs: 10_000,
    });

    // assert
    await assert.rejects(listed, rejectsAs("failed", 128));
    await assert.rejects(access(program.record), { code: "ENOENT" });
  });

  for (const { label, variables, allowed } of [
    { label: "an unset GIT_ALLOW_PROTOCOL", variables: {}, allowed: {} },
    {
      label: "a GIT_ALLOW_PROTOCOL key whose value is undefined",
      variables: { GIT_ALLOW_PROTOCOL: undefined },
      allowed: {},
    },
    {
      label: "GIT_ALLOW_PROTOCOL=https:ssh",
      variables: { GIT_ALLOW_PROTOCOL: "https:ssh" },
      allowed: { GIT_ALLOW_PROTOCOL: "https:ssh" },
    },
    {
      label: "GIT_ALLOW_PROTOCOL=ext:https",
      variables: { GIT_ALLOW_PROTOCOL: "ext:https" },
      allowed: { GIT_ALLOW_PROTOCOL: "https" },
    },
    {
      label: "GIT_ALLOW_PROTOCOL=https:persistent-https:s3, which names remote helpers",
      variables: { GIT_ALLOW_PROTOCOL: "https:persistent-https:s3" },
      allowed: { GIT_ALLOW_PROTOCOL: "https:persistent-https:s3" },
    },
    {
      label: "GIT_ALLOW_PROTOCOL=ext:fd:git:ftp:ftps, which names only banned transports",
      variables: { GIT_ALLOW_PROTOCOL: "ext:fd:git:ftp:ftps" },
      allowed: { GIT_ALLOW_PROTOCOL: "/" },
    },
    {
      label: "an empty GIT_ALLOW_PROTOCOL",
      variables: { GIT_ALLOW_PROTOCOL: "" },
      allowed: { GIT_ALLOW_PROTOCOL: "/" },
    },
    {
      label: "GIT_ALLOW_PROTOCOL=HTTPS, which git matches exactly",
      variables: { GIT_ALLOW_PROTOCOL: "HTTPS" },
      allowed: { GIT_ALLOW_PROTOCOL: "HTTPS" },
    },
    {
      label: "GIT_ALLOW_PROTOCOL=https::file, with an empty segment",
      variables: { GIT_ALLOW_PROTOCOL: "https::file" },
      allowed: { GIT_ALLOW_PROTOCOL: "https:file" },
    },
  ]) {
    test(`D-SG-05: passes ${label} to the network lane without the banned transports`, async () => {
      // arrange
      const { git, control, started } = createFakeGit({ PATH: "/usr/bin", ...variables });

      // act
      const pending = git.run(FILL);
      await started;
      control.close(0);
      await pending;

      // assert
      const [launch] = control.launches();
      assert.deepStrictEqual(
        [launch?.[1], launch?.[2].env],
        [
          [...hardening("/dev/null"), "credential", "fill"],
          { ...POSIX_FORCED, PATH: "/usr/bin", GIT_CEILING_DIRECTORIES: "/", ...allowed },
        ],
      );
    });
  }

  test("D-SG-05: on Windows keeps only the transports every spelling of GIT_ALLOW_PROTOCOL names", async () => {
    // arrange
    const { git, control, started } = createFakeGit(
      {
        Path: String.raw`C:\Git\cmd`,
        git_allow_protocol: "https:ssh:file",
        Git_Allow_Protocol: "https:ssh:http",
      },
      {
        platform: "win32",
        files: [String.raw`C:\Git\cmd\git.exe`],
        cwd: String.raw`C:\work\project`,
        neutral: String.raw`C:\Temp`,
      },
    );

    // act
    const pending = git.run(FILL);
    await started;
    control.close(0);
    await pending;

    // assert
    const [launch] = control.launches();
    assert.deepStrictEqual(
      [launch?.[1], launch?.[2].env],
      [
        [...hardening(String.raw`\\.\NUL`), "credential", "fill"],
        {
          ...POSIX_FORCED,
          Path: String.raw`C:\Git\cmd`,
          GIT_CEILING_DIRECTORIES: "C:\\",
          GIT_ALLOW_PROTOCOL: "https:ssh",
        },
      ],
    );
  });

  test("SG-PRC-03: refuses an ext:: command on the network lane under a user protocol list that names ext", async (t) => {
    // arrange
    const fixture = await laneFixture(t);
    const marker = path.join(fixture.root, "ext-ran");
    const command = `ext::sh -c touch% ${marker}`;
    await assert.rejects(
      runSystemGit(
        { cwd: fixture.root, home: fixture.root },
        "-c",
        "protocol.ext.allow=always",
        "ls-remote",
        command,
      ),
    );
    await access(marker);
    await rm(marker);
    const git = await fixture.gitWith({ GIT_ALLOW_PROTOCOL: "ext:https" });

    // act
    const listed = git.run({
      subcommand: "ls-remote",
      lane: "network",
      operands: [command],
      timeoutMs: 10_000,
    });

    // assert
    await assert.rejects(listed, rejectsAs("protocol-refused", 128));
    await assert.rejects(access(marker), { code: "ENOENT" });
  });

  for (const { operand } of [
    { operand: "fd::0" },
    { operand: "git://127.0.0.1:9/x" },
    { operand: "ftp://127.0.0.1:9/x" },
    { operand: "ftps://127.0.0.1:9/x" },
  ]) {
    test(`SG-PRC-03: refuses ${operand} on the network lane under a user list and config that allow it`, async (t) => {
      // arrange
      const fixture = await laneFixture(t);
      const git = await fixture.gitWith(
        { GIT_ALLOW_PROTOCOL: "ext:fd:git:ftp:ftps:https" },
        ALWAYS_BANNED_CONFIG,
      );

      // act
      const listed = git.run({
        subcommand: "ls-remote",
        lane: "network",
        operands: [operand],
        timeoutMs: 10_000,
      });

      // assert
      await assert.rejects(listed, rejectsAs("protocol-refused", 128));
    });
  }

  test("D-SG-05: refuses a remote helper that the user's protocol list leaves out and the config allows", async (t) => {
    // arrange
    const fixture = await laneFixture(t);
    const git = await fixture.gitWith(
      { GIT_ALLOW_PROTOCOL: "https:file" },
      `[protocol "foo"]\n\tallow = always\n`,
    );

    // act
    const listed = git.run({
      subcommand: "ls-remote",
      lane: "network",
      operands: ["foo::bar"],
      timeoutMs: 10_000,
    });

    // assert
    await assert.rejects(listed, rejectsAs("protocol-refused", 128));
  });

  test("D-SG-05: keeps the user's protocol list from allowing a file:// URL it leaves out", async (t) => {
    // arrange
    const fixture = await laneFixture(t);
    const git = await fixture.gitWith({ GIT_ALLOW_PROTOCOL: "https:ssh" });

    // act
    const listed = git.run({
      subcommand: "ls-remote",
      lane: "network",
      operands: [`file://${fixture.bare}`],
      timeoutMs: 10_000,
    });

    // assert
    await assert.rejects(listed, rejectsAs("protocol-refused", 128));
  });

  test("D-SG-05: lists a file:// URL that the user's protocol list names", async (t) => {
    // arrange
    const fixture = await laneFixture(t);
    const git = await fixture.gitWith({ GIT_ALLOW_PROTOCOL: "file" });
    const oid = fixture.repository.initialOid;

    // act
    const listed = await git.run({
      subcommand: "ls-remote",
      lane: "network",
      operands: [`file://${fixture.bare}`],
      timeoutMs: 10_000,
    });

    // assert
    assert.deepStrictEqual(listed, {
      exitCode: 0,
      stdout: `${oid}\tHEAD\n${oid}\trefs/heads/main\n`,
      stderr: "",
    });
  });

  test("SG-PRC-03, E5: runs neither a repository hook nor an fsmonitor program during a checkout", async (t) => {
    // arrange
    const fixture = await laneFixture(t);
    const call = { cwd: fixture.repository.dir, home: fixture.root };
    const hook = await recordingScript(
      path.join(fixture.repository.gitdir, "hooks"),
      "post-checkout",
      "exit 0",
    );
    const monitor = await recordingScript(fixture.root, "fsmonitor", "exit 1");
    await fixture.repository.run("config", "core.hooksPath", ".git/hooks");
    await fixture.repository.run("config", "core.fsmonitor", monitor.script);
    await runSystemGit(call, "checkout", "--quiet", "feature");
    await Promise.all([access(hook.record), access(monitor.record)]);
    await runSystemGit(call, "checkout", "--quiet", "main");
    await Promise.all([rm(hook.record), rm(monitor.record)]);

    // act
    const checkedOut = await fixture.git.run({
      subcommand: "checkout",
      lane: "local",
      options: ["--quiet"],
      operands: ["feature"],
      cwd: fixture.repository.dir,
      timeoutMs: 10_000,
    });

    // assert
    assert.deepStrictEqual(checkedOut, { exitCode: 0, stdout: "", stderr: "" });
    await assert.rejects(access(hook.record), { code: "ENOENT" });
    await assert.rejects(access(monitor.record), { code: "ENOENT" });
  });

  test("SG-PRC-03, E5, E6: copies and runs no template hook during a clone", async (t) => {
    // arrange
    const fixture = await laneFixture(t);
    const call = { cwd: fixture.root, home: fixture.root };
    const configured = path.join(fixture.root, "configured-template");
    const named = path.join(fixture.root, "named-template");
    await mkdir(path.join(configured, "hooks"), { recursive: true });
    await mkdir(path.join(named, "hooks"), { recursive: true });
    const configuredHook = await recordingScript(
      path.join(configured, "hooks"),
      "post-checkout",
      "exit 0",
    );
    const namedHook = await recordingScript(path.join(named, "hooks"), "post-checkout", "exit 0");
    const source = `file://${fixture.bare}`;
    await runSystemGit(call, "-c", `init.templateDir=${configured}`, "clone", "-q", source, "a");
    await runSystemGit(call, "clone", "-q", `--template=${named}`, source, "b");
    await Promise.all([
      access(configuredHook.record),
      access(namedHook.record),
      access(path.join(fixture.root, "a", ".git", "hooks", "post-checkout")),
      access(path.join(fixture.root, "b", ".git", "hooks", "post-checkout")),
    ]);
    await Promise.all([rm(configuredHook.record), rm(namedHook.record)]);
    const git = await fixture.gitWith(
      { GIT_TEMPLATE_DIR: named },
      `[init]\n\ttemplateDir = ${configured}\n`,
    );
    const clone = path.join(fixture.root, "clone");

    // act
    const cloned = await git.run({
      subcommand: "clone",
      lane: "network",
      options: ["--quiet"],
      operands: [source, clone],
      cwd: fixture.root,
      timeoutMs: 10_000,
    });

    // assert
    assert.deepStrictEqual(cloned, { exitCode: 0, stdout: "", stderr: "" });
    await assert.rejects(access(configuredHook.record), { code: "ENOENT" });
    await assert.rejects(access(namedHook.record), { code: "ENOENT" });
    await assert.rejects(access(path.join(clone, ".git", "hooks", "post-checkout")), {
      code: "ENOENT",
    });
  });
});

// SG-PRC-03, E1, E2, E2b: git acts only on the repository a request names.
describe("createGitProcess discovery", () => {
  test("SG-PRC-03: answers the requested repository while GIT_DIR and GIT_WORK_TREE name another", async (t) => {
    // arrange
    const home = await caseDirectory(t);
    const requested = await createGitTestRepository(t, { boundary: "local" });
    const other = await createGitTestRepository(t, { boundary: "local" });
    const otherOid = await other.commit([{ filepath: "other.txt", contents: "other\n" }], "other");
    const pointed = await runSystemGit(
      { cwd: requested.dir, home },
      "--git-dir",
      other.gitdir,
      "--work-tree",
      other.dir,
      "rev-parse",
      "HEAD",
    );
    const git = createGitProcess({
      spawn: NODE_SPAWN,
      host: { ...NODE_GIT_HOST, neutralDirectory: () => Promise.resolve(home) },
      env: { ...hermeticGitEnvironment(home), GIT_DIR: other.gitdir, GIT_WORK_TREE: other.dir },
      killGraceMs: KILL_GRACE_MS,
    });

    // act
    const read = await git.run({ ...LOCAL_READ, cwd: requested.dir });

    // assert
    assert.deepStrictEqual([read.stdout, pointed], [`${requested.initialOid}\n`, otherOid]);
  });

  for (const { label, workingDirectory } of [
    {
      label: "a clone directory without .git inside the user's project",
      workingDirectory: (fixture: ProjectFixture) => fixture.nested,
    },
    {
      label: "a symlink, made outside the project, to that directory",
      workingDirectory: (fixture: ProjectFixture) => fixture.link,
    },
  ]) {
    test(`SG-PRC-03, E1, E2: finds no repository from ${label}`, async (t) => {
      // arrange
      const fixture = await projectFixture(t);
      const cwd = workingDirectory(fixture);
      const discovered = await runSystemGit({ cwd, home: fixture.home }, "rev-parse", "HEAD");

      // act
      const read = fixture.git.run({ ...LOCAL_READ, cwd });

      // assert
      await assert.rejects(read, rejectsAs("not-a-repository", 128));
      assert.strictEqual(discovered, fixture.project.initialOid);
    });
  }

  test("SG-PRC-03, E2b: ignores the project's url.insteadOf rewrite from a clone directory inside it", async (t) => {
    // arrange
    const fixture = await projectFixture(t);
    const missing = `file://${path.join(fixture.outside, "missing")}`;
    await fixture.project.run("config", `url.file://${fixture.project.dir}.insteadOf`, missing);
    const rewritten = await runSystemGit(
      { cwd: fixture.nested, home: fixture.home },
      "ls-remote",
      missing,
    );

    // act
    const listed = fixture.git.run({
      subcommand: "ls-remote",
      lane: "network",
      operands: [missing],
      cwd: fixture.nested,
      timeoutMs: 10_000,
    });

    // assert
    await assert.rejects(listed, rejectsAs("repository-not-found", 128));
    const oid = fixture.project.initialOid;
    assert.strictEqual(rewritten, `${oid}\tHEAD\n${oid}\trefs/heads/main`);
  });
});

// D-SG-05, Q14 `nn`: a network command that can use ssh runs the user's own
// ssh with the batch options, from the neutral directory.
describe("createGitProcess ssh", () => {
  test("D-SG-05: reads the user's ssh settings on the local lane in the neutral directory first", async () => {
    // arrange
    const request: GitRequest = { ...SSH_LIST, cwd: "/work/clone" };

    // act
    const launches = await runAfterSshRead({ PATH: "/usr/bin" }, NO_SSH_CONFIG, request, {
      realpaths: { "/work/clone": "/real/clone" },
    });

    // assert
    assert.deepStrictEqual(
      launches.map(([command, args, options]) => [command, args, options.cwd, options.env]),
      [
        [
          "/usr/bin/git",
          SSH_READ,
          "/tmp",
          {
            ...POSIX_FORCED,
            PATH: "/usr/bin",
            GIT_CEILING_DIRECTORIES: "/",
            GIT_ALLOW_PROTOCOL: "/",
            GIT_SSH_COMMAND: "false",
          },
        ],
        [
          "/usr/bin/git",
          [...hardening("/dev/null"), "ls-remote", "--end-of-options", "git@h.test:acme/tools.git"],
          "/real/clone",
          {
            ...POSIX_FORCED,
            PATH: "/usr/bin",
            GIT_CEILING_DIRECTORIES: "/real",
            GIT_SSH_VARIANT: "ssh",
            GIT_SSH_COMMAND: fromNeutral(`ssh ${BATCH_OPTIONS}`),
          },
        ],
      ],
    );
  });

  for (const { subcommand, operands } of [
    { subcommand: "clone", operands: ["git@h.test:acme/tools.git", "/work/clone"] },
    { subcommand: "fetch", operands: ["origin"] },
    { subcommand: "ls-remote", operands: ["git@h.test:acme/tools.git"] },
  ] satisfies ReadonlyArray<Pick<GitRequest, "subcommand" | "operands">>) {
    test(`D-SG-05: runs a network-lane ${subcommand} with the user's ssh in batch mode`, async () => {
      // arrange
      const request: GitRequest = { subcommand, operands, lane: "network", timeoutMs: 5_000 };

      // act
      const launches = await runAfterSshRead({ PATH: "/usr/bin" }, NO_SSH_CONFIG, request);

      // assert
      assert.deepStrictEqual(
        launches.map(([, args, options]) => [args, options.env.GIT_SSH_COMMAND]),
        [
          [SSH_READ, "false"],
          [
            [...hardening("/dev/null"), subcommand, "--end-of-options", ...operands],
            fromNeutral(`ssh ${BATCH_OPTIONS}`),
          ],
        ],
      );
    });
  }

  for (const { label, env, answer, command, variables } of [
    {
      label: "a non-empty GIT_SSH_COMMAND before core.sshCommand and GIT_SSH",
      env: { GIT_SSH_COMMAND: "ssh -i /home/user/key", GIT_SSH: "/usr/bin/other-ssh" },
      answer: sshConfigLines("core.sshcommand config-ssh\n"),
      command: `ssh -i /home/user/key ${BATCH_OPTIONS}`,
      variables: { GIT_SSH_VARIANT: "ssh" },
    },
    {
      label: "core.sshCommand under an empty GIT_SSH_COMMAND, before GIT_SSH",
      env: { GIT_SSH_COMMAND: "", GIT_SSH: "/usr/bin/other-ssh" },
      answer: sshConfigLines("core.sshcommand config-ssh -F /home/user/ssh-config\n"),
      command: `config-ssh -F /home/user/ssh-config ${BATCH_OPTIONS}`,
      variables: {},
    },
    {
      label: "GIT_SSH with a space and a quote, quoted for sh",
      env: { GIT_SSH: "/opt/my tools/it's-ssh" },
      answer: NO_SSH_CONFIG,
      command: String.raw`'/opt/my tools/it'\''s-ssh' ${BATCH_OPTIONS}`,
      variables: {},
    },
    {
      label: "ssh when nothing names a program",
      env: {},
      answer: NO_SSH_CONFIG,
      command: `ssh ${BATCH_OPTIONS}`,
      variables: { GIT_SSH_VARIANT: "ssh" },
    },
    {
      label: "the last value of a repeated core.sshCommand",
      env: {},
      answer: sshConfigLines("core.sshcommand first-ssh\ncore.sshcommand second-ssh\n"),
      command: `second-ssh ${BATCH_OPTIONS}`,
      variables: {},
    },
    {
      label: "config lines that end in CRLF",
      env: {},
      answer: sshConfigLines("core.sshcommand my-ssh\r\nssh.variant plink\r\n"),
      command: "my-ssh -batch",
      variables: { GIT_SSH_VARIANT: "plink" },
    },
    {
      label: "an empty last core.sshCommand as unset",
      env: {},
      answer: sshConfigLines("core.sshcommand first-ssh\ncore.sshcommand \n"),
      command: `ssh ${BATCH_OPTIONS}`,
      variables: { GIT_SSH_VARIANT: "ssh" },
    },
    {
      label: "a valueless last ssh.variant as unset",
      env: { GIT_SSH_COMMAND: "plink" },
      answer: sshConfigLines("ssh.variant ssh\nssh.variant\n"),
      command: "plink -batch",
      variables: { GIT_SSH_VARIANT: "plink" },
    },
    {
      label: "GIT_SSH_VARIANT=plink",
      env: { GIT_SSH_VARIANT: "plink" },
      answer: NO_SSH_CONFIG,
      command: "ssh -batch",
      variables: { GIT_SSH_VARIANT: "plink" },
    },
    {
      label: "ssh.variant=putty",
      env: {},
      answer: sshConfigLines("ssh.variant putty\n"),
      command: "ssh -batch",
      variables: { GIT_SSH_VARIANT: "putty" },
    },
    {
      label: "the user's GIT_SSH_VARIANT before ssh.variant",
      env: { GIT_SSH_COMMAND: "plink", GIT_SSH_VARIANT: "ssh" },
      answer: sshConfigLines("ssh.variant plink\n"),
      command: `plink ${BATCH_OPTIONS}`,
      variables: { GIT_SSH_VARIANT: "ssh" },
    },
    {
      label: "the base name plink",
      env: { GIT_SSH_COMMAND: "plink -P 2222" },
      answer: NO_SSH_CONFIG,
      command: "plink -P 2222 -batch",
      variables: { GIT_SSH_VARIANT: "plink" },
    },
    {
      label: "the base name PLINK.EXE",
      env: { GIT_SSH_COMMAND: "C:/PuTTY/PLINK.EXE" },
      answer: NO_SSH_CONFIG,
      command: "C:/PuTTY/PLINK.EXE -batch",
      variables: { GIT_SSH_VARIANT: "plink" },
    },
    {
      label: "the base name tortoiseplink",
      env: { GIT_SSH_COMMAND: "tortoiseplink" },
      answer: NO_SSH_CONFIG,
      command: "tortoiseplink",
      variables: { GIT_SSH_VARIANT: "tortoiseplink" },
    },
    {
      label: "the base name TortoisePlink.exe",
      env: { GIT_SSH_COMMAND: "/opt/TortoisePlink.exe -v" },
      answer: NO_SSH_CONFIG,
      command: "/opt/TortoisePlink.exe -v",
      variables: { GIT_SSH_VARIANT: "tortoiseplink" },
    },
    {
      label: "the base name ssh",
      env: { GIT_SSH_COMMAND: "/usr/bin/ssh" },
      answer: NO_SSH_CONFIG,
      command: `/usr/bin/ssh ${BATCH_OPTIONS}`,
      variables: { GIT_SSH_VARIANT: "ssh" },
    },
    {
      label: "the base name my-ssh",
      env: { GIT_SSH_COMMAND: "my-ssh" },
      answer: NO_SSH_CONFIG,
      command: `my-ssh ${BATCH_OPTIONS}`,
      variables: {},
    },
    {
      label: "a single-quoted first word",
      env: { GIT_SSH_COMMAND: "'/opt/My Tools/plink' -v" },
      answer: NO_SSH_CONFIG,
      command: "'/opt/My Tools/plink' -v -batch",
      variables: { GIT_SSH_VARIANT: "plink" },
    },
    {
      label: "a double-quoted first word with an escape",
      env: { GIT_SSH_COMMAND: String.raw`"/opt/My \"Tools\"/plink.exe" -v` },
      answer: NO_SSH_CONFIG,
      command: String.raw`"/opt/My \"Tools\"/plink.exe" -v -batch`,
      variables: { GIT_SSH_VARIANT: "plink" },
    },
    {
      label: "a first word with an escaped space",
      env: { GIT_SSH_COMMAND: String.raw`/opt/My\ Tools/plink -v` },
      answer: NO_SSH_CONFIG,
      command: String.raw`/opt/My\ Tools/plink -v -batch`,
      variables: { GIT_SSH_VARIANT: "plink" },
    },
    {
      label: "a GIT_SSH named plink.exe",
      env: { GIT_SSH: "/opt/putty/plink.exe" },
      answer: NO_SSH_CONFIG,
      command: "'/opt/putty/plink.exe' -batch",
      variables: { GIT_SSH_VARIANT: "plink" },
    },
    {
      label: "the base name ssh.exe",
      env: { GIT_SSH_COMMAND: "C:/OpenSSH/ssh.exe" },
      answer: NO_SSH_CONFIG,
      command: `C:/OpenSSH/ssh.exe ${BATCH_OPTIONS}`,
      variables: { GIT_SSH_VARIANT: "ssh" },
    },
    {
      label: "the base name putty",
      env: { GIT_SSH_COMMAND: "putty" },
      answer: NO_SSH_CONFIG,
      command: "putty -batch",
      variables: { GIT_SSH_VARIANT: "putty" },
    },
  ] satisfies ReadonlyArray<{
    label: string;
    env: NodeJS.ProcessEnv;
    answer: ConfigAnswer;
    command: string;
    variables: NodeJS.ProcessEnv;
  }>) {
    test(`D-SG-05, D-SG-03, D-SG-08: composes the ssh command and variant from ${label}`, async () => {
      // arrange
      const base = { PATH: "/usr/bin", ...env };

      // act
      const launches = await runAfterSshRead(base, answer);

      // assert
      assert.deepStrictEqual(launches[1]?.[2].env, {
        ...POSIX_FORCED,
        PATH: "/usr/bin",
        GIT_CEILING_DIRECTORIES: "/",
        ...variables,
        GIT_SSH_COMMAND: fromNeutral(command),
      });
    });
  }

  test("D-SG-05: on Windows reads the spelling Node passes and replaces every spelling of the ssh variables", async () => {
    // arrange
    const base = {
      Path: String.raw`C:\Git\cmd`,
      Git_Ssh: String.raw`C:\Other\ssh.exe`,
      GIT_SSH: String.raw`C:\PuTTY\plink.exe`,
      git_ssh_command: "",
      Git_Ssh_Variant: "plink",
    };

    // act
    const launches = await runAfterSshRead(base, sshConfigLines("ssh.variant ssh\n"), SSH_LIST, {
      platform: "win32",
      files: [String.raw`C:\Git\cmd\git.exe`],
      cwd: String.raw`C:\work\project`,
      neutral: String.raw`C:\Temp`,
    });

    // assert
    assert.deepStrictEqual(launches[1]?.[2].env, {
      ...POSIX_FORCED,
      Path: String.raw`C:\Git\cmd`,
      GIT_CEILING_DIRECTORIES: "C:\\",
      Git_Ssh_Variant: "plink",
      GIT_SSH_COMMAND: fromNeutral(String.raw`'C:\PuTTY\plink.exe' -batch`, String.raw`C:\Temp`),
    });
  });

  for (const { label, request, sshCommand } of [
    { label: "a network-lane credential", request: FILL, sshCommand: "ssh -i /home/user/key" },
    {
      label: "a network-lane version",
      request: { subcommand: "version", lane: "network", timeoutMs: 5_000 },
      sshCommand: "ssh -i /home/user/key",
    },
    {
      label: "a local-lane fetch",
      request: { subcommand: "fetch", lane: "local", operands: ["origin"], timeoutMs: 5_000 },
      sshCommand: "false",
    },
  ] satisfies ReadonlyArray<{ label: string; request: GitRequest; sshCommand: string }>) {
    test(`D-SG-05: starts no ssh read and composes no ssh command for ${label}`, async () => {
      // arrange
      const { git, launches } = createSequencedGit(
        {},
        { PATH: "/usr/bin", GIT_SSH_COMMAND: "ssh -i /home/user/key", GIT_SSH: "/usr/bin/ssh" },
      );

      // act
      const pending = git.run(request);
      (await launches.at(0)).close(0);
      await pending;

      // assert
      assert.deepStrictEqual(
        launches.all().map(([, , options]) => [options.env.GIT_SSH_COMMAND, options.env.GIT_SSH]),
        [[sshCommand, "/usr/bin/ssh"]],
      );
    });
  }

  test("D-SG-05: rejects the command with the error of a failed ssh read", async () => {
    // arrange
    const { git, launches } = createSequencedGit();

    // act
    const pending = git.run(SSH_LIST);
    const read = await launches.at(0);
    read.writeStderr("fatal: bad config line 1 in file /home/user/.gitconfig\n");
    read.close(128);

    // assert
    await assert.rejects(
      pending,
      gitFailure({
        failure: { kind: "failed" },
        operation: "config --get-regexp",
        exitCode: 128,
        stderr: "fatal: bad config line 1 in file /home/user/.gitconfig\n",
      }),
    );
    assert.strictEqual(launches.all().length, 1);
  });

  test("D-SG-05: stops at the ssh read when the request is cancelled during it", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const reason = new Error("cancelled");
    const controller = new AbortController();
    const { git, launches, host } = createSequencedGit();

    // act
    const pending = git.run({ ...SSH_LIST, signal: controller.signal });
    await launches.at(0);
    controller.abort(reason);
    t.mock.timers.tick(KILL_GRACE_MS);
    t.mock.timers.tick(KILL_GRACE_MS);

    // assert
    await assert.rejects(
      pending,
      gitFailure({
        failure: { kind: "aborted" },
        operation: "config --get-regexp",
        exitCode: null,
        stderr: "",
        cause: reason,
      }),
    );
    assert.deepStrictEqual(
      [launches.all().length, host.groupSignals],
      [
        1,
        [
          [4242, "SIGTERM"],
          [4242, "SIGKILL"],
        ],
      ],
    );
  });

  test("D-SG-05: gives the ssh read the request's timeout", async (t) => {
    // arrange
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { git, launches } = createSequencedGit();

    // act
    const pending = git.run({ ...SSH_LIST, timeoutMs: 50 });
    await launches.at(0);
    t.mock.timers.tick(50);
    t.mock.timers.tick(KILL_GRACE_MS);
    t.mock.timers.tick(KILL_GRACE_MS);

    // assert
    await assert.rejects(
      pending,
      gitFailure({
        failure: { kind: "timeout", timeoutMs: 50 },
        operation: "config --get-regexp",
        exitCode: null,
        stderr: "",
      }),
    );
    assert.strictEqual(launches.all().length, 1);
  });
});

// D-SG-05, CONTEXT [Hardening]: real git runs the user's ssh, never a
// repository's, and never in the repository.
describe("createGitProcess ssh with real git", () => {
  test("D-SG-05: lists an ssh remote through the stub ssh with the batch options", async (t) => {
    // arrange
    const fixture = await sshFixture(t);
    const git = await fixture.gitWith({});
    const window = await fixture.host.mark();

    // act
    const listed = await git.run({
      subcommand: "ls-remote",
      lane: "network",
      operands: [fixture.url],
      timeoutMs: 10_000,
    });

    // assert
    const launches = await fixture.host.launchesSince(window);
    assert.deepStrictEqual(
      [listed.stdout, launches.map((launch) => launch.argv)],
      [
        `${fixture.oid}\tHEAD\n${fixture.oid}\trefs/heads/main\n`,
        [[...STAND_IN_BATCH, ...STAND_IN_PROTOCOL, STAND_IN_UPLOAD]],
      ],
    );
  });

  test("D-SG-05: keeps the arguments of the user's core.sshCommand before the batch options", async (t) => {
    // arrange
    const fixture = await sshFixture(t);
    const key = path.join(fixture.root, "id_case");
    const stub = path.join(fixture.host.binDirectory, "ssh");
    const git = await fixture.gitWith({}, `[core]\n\tsshCommand = ${stub} -i ${key}\n`);
    const window = await fixture.host.mark();

    // act
    await git.run({
      subcommand: "ls-remote",
      lane: "network",
      operands: [fixture.url],
      timeoutMs: 10_000,
    });

    // assert
    const launches = await fixture.host.launchesSince(window);
    assert.deepStrictEqual(
      launches.map((launch) => launch.argv),
      [["-i", key, ...STAND_IN_BATCH, ...STAND_IN_PROTOCOL, STAND_IN_UPLOAD]],
    );
  });

  for (const { program } of [{ program: "plink" }, { program: "tortoiseplink" }]) {
    test(`D-SG-08: lists an ssh:// remote with a port through a ${program} that refuses -G`, async (t) => {
      // arrange
      const fixture = await sshFixture(t);
      const record = path.join(fixture.root, `${program}-arguments`);
      const script = path.join(fixture.root, program);
      const stub = path.join(fixture.host.binDirectory, "ssh");
      // Records its arguments, refuses -G as plink does, and hands the
      // OpenSSH form of the rest to the stub ssh.
      await writeFile(
        script,
        `#!/bin/sh
printf '%s\\n' "$*" >> '${record}'
for arg do
  shift
  case $arg in
    -G) exit 1 ;;
    -batch) ;;
    -P) set -- "$@" -p ;;
    *) set -- "$@" "$arg" ;;
  esac
done
exec '${stub}' "$@"
`,
        { mode: 0o755 },
      );
      const git = await fixture.gitWith({ GIT_SSH: script });

      // act
      const listed = await git.run({
        subcommand: "ls-remote",
        lane: "network",
        operands: ["ssh://git@stand-in.test:2222/acme/tools.git"],
        timeoutMs: 10_000,
      });

      // assert
      assert.deepStrictEqual(
        [listed.stdout, await readFile(record, "utf8")],
        [
          `${fixture.oid}\tHEAD\n${fixture.oid}\trefs/heads/main\n`,
          "-batch -P 2222 git@stand-in.test git-upload-pack '/acme/tools.git'\n",
        ],
      );
    });
  }

  test("CONTEXT [Hardening]: never runs the core.sshCommand of the repository it fetches in", async (t) => {
    // arrange
    const fixture = await sshFixture(t);
    const repository = await createGitTestRepository(t, { boundary: "local" });
    const own = await recordingScript(fixture.root, "repository-ssh", "exit 255");
    await repository.run("remote", "add", "origin", fixture.url);
    await repository.run("config", "core.sshCommand", own.script);
    const call = {
      cwd: repository.dir,
      home: fixture.root,
      variables: { PATH: fixture.host.searchPath() },
    };
    await assert.rejects(runSystemGit(call, "fetch", "origin"));
    await access(own.record);
    await rm(own.record);
    const git = await fixture.gitWith({});

    // act
    const fetched = await git.run({
      subcommand: "fetch",
      lane: "network",
      options: ["--quiet"],
      operands: ["origin"],
      cwd: repository.dir,
      timeoutMs: 10_000,
    });

    // assert
    assert.deepStrictEqual(
      [fetched, await runSystemGit(call, "rev-parse", "FETCH_HEAD")],
      [{ exitCode: 0, stdout: "", stderr: "" }, fixture.oid],
    );
    await assert.rejects(access(own.record), { code: "ENOENT" });
  });

  test("D-SG-05: runs the user's ssh in the neutral directory for a fetch in a repository", async (t) => {
    // arrange
    const fixture = await laneFixture(t);
    const record = path.join(fixture.root, "ssh-directories");
    const program = path.join(fixture.root, "directory-ssh");
    await writeFile(program, `#!/bin/sh\npwd -P >> '${record}'\nexit 255\n`, { mode: 0o755 });
    await fixture.repository.run("remote", "set-url", "origin", "git@h.test:acme/tools.git");
    const git = await fixture.gitWith({ GIT_SSH_COMMAND: program });

    // act
    const fetched = git.run({
      subcommand: "fetch",
      lane: "network",
      operands: ["origin"],
      cwd: fixture.repository.dir,
      timeoutMs: 10_000,
    });

    // assert
    await assert.rejects(fetched, rejectsAs("ssh-auth", 128));
    assert.strictEqual(await readFile(record, "utf8"), `${fixture.root}\n${fixture.root}\n`);
  });
});

// The process-group cases need `ps` and POSIX process groups.
const PROCESS_GROUPS = {
  skip: process.platform === "win32" && "Windows has no ps and no POSIX process groups",
};

// SG-PRC-02: a remote that asks for a password, a passphrase, or a host-key
// answer fails without a prompt, and a timeout leaves no process behind.
describe("createGitProcess without prompts or leftovers", () => {
  test("SG-PRC-02, E10: rejects an https remote that asks for a password as https-auth without askpass", async (t) => {
    // arrange
    const fixture = await httpsFixture(t);
    await fixture.host.arm("tools", { kind: "credential", user: "acme", password: "secret" });
    const askpass = await recordingScript(fixture.root, "askpass", "echo wrong");
    const call = {
      cwd: fixture.root,
      home: fixture.root,
      variables: { GIT_SSL_CAINFO: fixture.host.certificatePath },
    };
    await assert.rejects(
      runSystemGit(call, "-c", `core.askPass=${askpass.script}`, "ls-remote", fixture.url),
    );
    await access(askpass.record);
    await rm(askpass.record);
    const git = await realGit({
      root: fixture.root,
      env: fixture.env,
      config: `[core]\n\taskPass = ${askpass.script}\n`,
    });

    // act
    const listed = git.run({
      subcommand: "ls-remote",
      lane: "network",
      operands: [fixture.url],
      timeoutMs: 10_000,
    });

    // assert
    await assert.rejects(listed, rejectsAs("https-auth", 128));
    await assert.rejects(access(askpass.record), { code: "ENOENT" });
  });

  test("SG-PRC-02, E16: runs the user's ssh without a terminal and with the batch options", async (t) => {
    // arrange
    const fixture = await laneFixture(t);
    const record = path.join(fixture.root, "ssh-launches");
    const program = path.join(fixture.root, "terminal-ssh");
    await writeFile(
      program,
      `#!/bin/sh
if (: < /dev/tty) 2>/dev/null; then echo tty >> '${record}'; else echo no-tty >> '${record}'; fi
printf '%s\\n' "$@" >> '${record}'
exit 255
`,
      { mode: 0o755 },
    );
    const git = await fixture.gitWith({ GIT_SSH_COMMAND: program });

    // act
    const listed = git.run({ ...SSH_LIST, timeoutMs: 10_000 });

    // assert
    await assert.rejects(listed, rejectsAs("ssh-auth", 128));
    // git's `-G` check fails, so the transport launch runs as the simple variant.
    assert.deepStrictEqual((await readFile(record, "utf8")).split("\n"), [
      "no-tty",
      ...STAND_IN_BATCH,
      "-G",
      "-o",
      "SendEnv=GIT_PROTOCOL",
      "git@h.test",
      "no-tty",
      ...STAND_IN_BATCH,
      "git@h.test",
      "git-upload-pack 'acme/tools.git'",
      "",
    ]);
  });

  test("SG-PRC-02, E16: rejects an ssh remote whose host key is unknown as ssh-host-key-unknown", async (t) => {
    // arrange
    const fixture = await laneFixture(t);
    const program = await recordingScript(
      fixture.root,
      "host-key-ssh",
      "echo 'Host key verification failed.' >&2\nexit 255",
    );
    const git = await fixture.gitWith({ GIT_SSH_COMMAND: program.script });

    // act
    const listed = git.run({ ...SSH_LIST, timeoutMs: 10_000 });

    // assert
    await assert.rejects(listed, rejectsAs("ssh-host-key-unknown", 128));
  });

  test(
    "SG-PRC-02, E9: leaves no process of a timed-out https command",
    PROCESS_GROUPS,
    async (t) => {
      // arrange
      const fixture = await httpsFixture(t);
      await fixture.host.arm("tools", { kind: "hold" });
      const launcher = pidRecordingSpawn();
      const git = await realGit({
        root: fixture.root,
        env: fixture.env,
        config: "",
        spawn: launcher.spawn,
        killGraceMs: 500,
      });
      const window = fixture.host.mark();

      // act
      const listed = git.run({
        subcommand: "ls-remote",
        lane: "network",
        operands: [fixture.url],
        timeoutMs: 1_500,
      });

      // assert
      await assert.rejects(listed, rejectsWithTimeout(1_500));
      await fixture.host.waitForRequestsSettledAfter(window);
      assert.deepStrictEqual(fixture.host.requestsSince(window).requests, [
        {
          method: "GET",
          path: "/acme/tools.git/info/refs?service=git-upload-pack",
          status: "dropped",
        },
      ]);
      assert.deepStrictEqual(await livingGroupMembers(launcher.pidOf("ls-remote")), []);
    },
  );

  test(
    "SG-PRC-02, E8: leaves no process of a timed-out ssh command whose ssh never answers",
    PROCESS_GROUPS,
    async (t) => {
      // arrange
      const root = await caseDirectory(t);
      const record = path.join(root, "ssh-pids");
      const program = path.join(root, "sleeping-ssh");
      await writeFile(program, `#!/bin/sh\nsleep 30 &\necho "$$ $!" >> '${record}'\nwait\n`, {
        mode: 0o755,
      });
      const launcher = pidRecordingSpawn();
      // The variant skips git's `-G` check, so the transport launch is the one that hangs.
      const git = await realGit({
        root,
        env: { ...hermeticGitEnvironment(root), GIT_SSH_COMMAND: program, GIT_SSH_VARIANT: "ssh" },
        config: "",
        spawn: launcher.spawn,
        killGraceMs: 500,
      });

      // act
      const listed = git.run({ ...SSH_LIST, timeoutMs: 1_500 });

      // assert
      await assert.rejects(listed, rejectsWithTimeout(1_500));
      assert.match(await readFile(record, "utf8"), /^\d+ \d+\n$/);
      assert.deepStrictEqual(await livingGroupMembers(launcher.pidOf("ls-remote")), []);
    },
  );
});

describe("NODE_GIT_HOST", () => {
  for (const { label, mode, executable } of [
    { label: "an executable file", mode: 0o755, executable: true },
    { label: "a file without an execute bit", mode: 0o644, executable: false },
  ]) {
    test(`reports ${label} as executable: ${executable}`, async (t) => {
      // arrange
      const root = await caseDirectory(t);
      const file = path.join(root, "git");
      await writeFile(file, "#!/bin/sh\n", { mode });

      // act
      const found = await NODE_GIT_HOST.isExecutable(file);

      // assert
      assert.strictEqual(found, executable);
    });
  }

  for (const { label, entry } of [
    { label: "a directory", entry: "." },
    { label: "a missing path", entry: "missing" },
  ]) {
    test(`reports ${label} as not executable`, async (t) => {
      // arrange
      const root = await caseDirectory(t);

      // act
      const found = await NODE_GIT_HOST.isExecutable(path.join(root, entry));

      // assert
      assert.strictEqual(found, false);
    });
  }

  test("resolves a symbolic link to its real path", async (t) => {
    // arrange
    const root = await caseDirectory(t);
    await mkdir(path.join(root, "target"));
    await symlink(path.join(root, "target"), path.join(root, "link"));

    // act
    const resolved = await NODE_GIT_HOST.realpath(path.join(root, "link"));

    // assert
    assert.strictEqual(resolved, path.join(root, "target"));
  });

  test("SG-PRC-03, NFR-10: reads Pi's working directory and keeps the neutral directory in Pi's agent directory", async (t) => {
    // arrange
    const environment = await createHermeticEnvironment(t, "pi-cm-git-host-");

    // act
    const directories = [NODE_GIT_HOST.cwd(), await NODE_GIT_HOST.neutralDirectory()];

    // assert
    assert.deepStrictEqual(directories, [
      process.cwd(),
      path.join(environment.agentDir, "pi-claude-marketplace", "git-neutral"),
    ]);
  });
});

describe("NODE_GIT_SPAWN", () => {
  test("D-SG-01: is Node's own spawn", () => {
    // arrange
    const nodeLauncher: unknown = spawn;

    // act
    const productionLauncher: unknown = NODE_GIT_SPAWN;

    // assert
    assert.strictEqual(productionLauncher, nodeLauncher);
  });
});

describe("NODE_GIT_PROCESS", () => {
  test("D-SG-04: locates an absolute, executable git on this process's PATH", async () => {
    // act
    const found = await NODE_GIT_PROCESS.locate();

    // assert
    assert.deepStrictEqual(
      {
        absolute: path.isAbsolute(found),
        name: path.basename(found),
        executable: await NODE_GIT_HOST.isExecutable(found),
      },
      { absolute: true, name: "git", executable: true },
    );
  });
});
