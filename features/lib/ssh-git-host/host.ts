/**
 * @fileoverview The SSH stand-in, which a run puts first on every Pi's PATH.
 *
 * The stand-in is a directory with a `bin/ssh` wrapper, a hosts file, a
 * launch log, and the scratch HOME of the `git upload-pack` it runs. Pi
 * fixes its PATH when it starts, so the run starts the stand-in before Pi and
 * keeps it as long as Pi, beside the https git host, and resets it before
 * every scenario (HOST-02). It serves the bare repositories of the git host's
 * repositories root read-only, so a repository a scenario publishes clones
 * over SSH and over HTTPS alike. The wrapper `exec`s Node on the stub module,
 * so a caller that kills the wrapper at a timeout kills the stub itself, and
 * no held stub outlives its scenario (SG-HRN-03).
 */

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { waitUntilProcessesExit } from "../mcp-implementation.ts";

import { HOME_DIRECTORY, HOSTS_FILE, isSshLaunchRecord, LAUNCHES_FILE } from "./launch.ts";
import { STUB_ENTRY } from "./stub.ts";

import type { SshHostArm, SshHostsFile, SshLaunchRecord } from "./launch.ts";

// A host name the stub can match exactly, with no character a shell or a URL reads.
const HOST_NAME = /^[A-Za-z0-9.-]+$/;

// A stub exits within milliseconds of its git, which may die before it
// reaps the stub; the margin covers a loaded CI runner. A held stub never
// exits on its own, so a reset that finds one fails after this wait.
const STUB_EXIT_GRACE_MS = 5_000;

// The one extra line an arm may add to `ssh -G`, such as `proxycommand nc %h %p`.
const PROXY_LINE = /^(proxycommand|proxyjump) [^\n]+$/;

/** The hosts the stand-in registers and every launch it recorded. */
export interface SshHostSnapshot {
  readonly hosts: readonly string[];
  readonly launches: readonly SshLaunchRecord[];
}

/** Returns `text` single-quoted for `/bin/sh`, failing on a quote it would have to escape. */
function shellQuoted(text: string): string {
  if (text.includes("'")) {
    throw new Error(`the ssh stand-in cannot embed a path with a quote: ${text}`);
  }

  return `'${text}'`;
}

/**
 * The SSH stand-in. Start one with `SshGitHost.start()`, put `searchPath()`
 * on the PATH of every git and Pi that must reach it, register the hosts a
 * scenario serves, and call `reset()` between scenarios and `close()` at the
 * end of the run.
 */
export class SshGitHost {
  /** The directory that holds the stub `ssh`. */
  readonly binDirectory: string;
  private readonly hostsPath: string;
  private readonly launchesPath: string;
  private readonly repositoriesRoot: string;
  private readonly hosts = new Map<string, SshHostArm>();

  private constructor(root: string, repositoriesRoot: string) {
    this.binDirectory = path.join(root, "bin");
    this.hostsPath = path.join(root, HOSTS_FILE);
    this.launchesPath = path.join(root, LAUNCHES_FILE);
    this.repositoriesRoot = repositoriesRoot;
  }

  /**
   * Makes the stand-in under `root`, with no host and an empty launch log,
   * serving the bare repositories under `options.repositoriesRoot`.
   */
  static async start(
    root: string,
    options: { readonly repositoriesRoot: string },
  ): Promise<SshGitHost> {
    const wrapper = `#!/bin/sh\nexec ${[process.execPath, STUB_ENTRY, root].map(shellQuoted).join(" ")} "$@"\n`;
    const host = new SshGitHost(root, options.repositoriesRoot);
    await mkdir(host.binDirectory, { recursive: true });
    await mkdir(path.join(root, HOME_DIRECTORY), { recursive: true });
    await host.writeHosts();
    await writeFile(host.launchesPath, "");
    await writeFile(path.join(host.binDirectory, "ssh"), wrapper, { mode: 0o755 });
    return host;
  }

  /** Returns a PATH with the stub's directory first, then `base`. */
  searchPath(base = process.env.PATH ?? ""): string {
    return `${this.binDirectory}${path.delimiter}${base}`;
  }

  /** Registers `host`, so the stub answers it with `arm`. */
  async register(host: string, arm: SshHostArm): Promise<void> {
    if (!HOST_NAME.test(host)) {
      throw new Error(`the ssh stand-in cannot register the host ${JSON.stringify(host)}`);
    }

    if (this.hosts.has(host)) {
      throw new Error(`the ssh stand-in registers ${host} already`);
    }

    if (arm.proxy !== undefined && !PROXY_LINE.test(arm.proxy)) {
      throw new Error(`the ssh stand-in's proxy is not one proxy line: ${arm.proxy}`);
    }

    this.hosts.set(host, arm);
    await this.writeHosts();
  }

  /** Returns the number of launches recorded so far, the start of a window. */
  async mark(): Promise<number> {
    return (await this.readLaunches()).length;
  }

  /** Returns the launches recorded since `mark()` returned `window`. */
  async launchesSince(window: number): Promise<SshLaunchRecord[]> {
    return (await this.readLaunches()).slice(window);
  }

  /** Returns the registered host names, sorted, and every recorded launch. */
  async snapshot(): Promise<SshHostSnapshot> {
    return { hosts: [...this.hosts.keys()].sort(), launches: await this.readLaunches() };
  }

  /**
   * Empties the hosts and the launch log, then fails, naming the pids, when a
   * stub it recorded still runs after a short grace.
   */
  async reset(): Promise<void> {
    const launches = await this.readLaunches();
    this.hosts.clear();
    await this.writeHosts();
    await writeFile(this.launchesPath, "");
    await SshGitHost.awaitExits(launches);
  }

  /** Fails, naming the pids, when a stub the stand-in recorded still runs after a short grace. */
  async close(): Promise<void> {
    await SshGitHost.awaitExits(await this.readLaunches());
  }

  private static async awaitExits(launches: readonly SshLaunchRecord[]): Promise<void> {
    await waitUntilProcessesExit(
      launches.map((launch) => launch.pid),
      STUB_EXIT_GRACE_MS,
    );
  }

  /** Writes the hosts file whole through a temporary file and a rename, so a stub never reads half. */
  private async writeHosts(): Promise<void> {
    const file: SshHostsFile = {
      repositoriesRoot: this.repositoriesRoot,
      hosts: Object.fromEntries(this.hosts),
    };
    const temporary = `${this.hostsPath}.tmp`;
    await writeFile(temporary, `${JSON.stringify(file)}\n`);
    await rename(temporary, this.hostsPath);
  }

  private async readLaunches(): Promise<SshLaunchRecord[]> {
    const lines = (await readFile(this.launchesPath, "utf8")).split("\n").filter(Boolean);
    return lines.map((line) => {
      const parsed: unknown = JSON.parse(line);
      if (!isSshLaunchRecord(parsed)) {
        throw new Error(`the ssh stand-in's launch log holds a line that is no launch: ${line}`);
      }

      return parsed;
    });
  }
}
