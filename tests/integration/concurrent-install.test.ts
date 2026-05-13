import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  saveState,
  type ExtensionState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { STATE_LOCK_HELD_PREFIX } from "../../extensions/pi-claude-marketplace/shared/markers.ts";

interface ChildResult {
  readonly ok: boolean;
  readonly message: string;
  readonly notifications: readonly { readonly message: string; readonly severity?: string }[];
}

interface RaceEnv {
  readonly cwd: string;
  readonly home: string;
  readonly cleanup: () => Promise<void>;
}

interface RaceOutcome {
  readonly first: ChildResult;
  readonly second: ChildResult;
}

interface PluginRecordSummary {
  readonly resources?: {
    readonly skills?: readonly string[];
    readonly prompts?: readonly string[];
    readonly agents?: readonly string[];
    readonly mcpServers?: readonly string[];
  };
}

interface StateSummary {
  readonly marketplaces: Record<
    string,
    {
      readonly plugins: Record<string, PluginRecordSummary | undefined>;
    }
  >;
}

const CHILD_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "concurrent-install-child.ts",
);

async function setupRaceEnv(prefix: string): Promise<RaceEnv> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  const cwd = path.join(root, "project");
  const home = path.join(root, "home");
  await mkdir(cwd, { recursive: true });
  await mkdir(home, { recursive: true });
  return {
    cwd,
    home,
    cleanup: async (): Promise<void> => {
      await rm(root, { recursive: true, force: true });
    },
  };
}

async function seedMarketplace(opts: {
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugins: readonly string[];
}): Promise<void> {
  const marketplaceRoot = path.join(opts.cwd, "mp-src");
  await mkdir(path.join(marketplaceRoot, ".claude-plugin"), { recursive: true });

  const entries: Record<string, unknown>[] = [];
  for (const plugin of opts.plugins) {
    const pluginRoot = path.join(marketplaceRoot, "plugins", plugin);
    await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
    await writeFile(
      path.join(pluginRoot, ".claude-plugin", "plugin.json"),
      JSON.stringify({ name: plugin, version: "1.0.0" }),
    );

    for (let i = 0; i < 30; i += 1) {
      const skillDir = path.join(pluginRoot, "skills", `tool-${i.toString().padStart(2, "0")}`);
      await mkdir(skillDir, { recursive: true });
      await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: tool-${i}\n---\n\nBody.\n`);
    }

    entries.push({ name: plugin, source: `./plugins/${plugin}`, version: "1.0.0" });
  }

  const manifestPath = path.join(marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(manifestPath, JSON.stringify({ name: opts.marketplace, plugins: entries }));

  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  const state: ExtensionState = {
    schemaVersion: 1,
    marketplaces: {
      [opts.marketplace]: {
        name: opts.marketplace,
        scope: "project",
        source: pathSource("./mp-src"),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot,
        plugins: {},
      },
    },
  };
  await saveState(locations.extensionRoot, state);
}

async function runRace(
  env: RaceEnv,
  firstPlugin: string,
  secondPlugin: string,
): Promise<RaceOutcome> {
  const first = fork(CHILD_PATH, [], {
    cwd: env.cwd,
    env: { ...process.env, HOME: env.home },
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  const second = fork(CHILD_PATH, [], {
    cwd: env.cwd,
    env: { ...process.env, HOME: env.home },
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });

  const waitReady = (child: ReturnType<typeof fork>): Promise<void> =>
    new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => {
        reject(new Error(`child exited ${String(code)} before ready`));
      });
      child.once("message", (message) => {
        if (message === "ready") {
          resolve();
        } else {
          reject(new Error(`unexpected child ready message: ${JSON.stringify(message)}`));
        }
      });
    });

  await Promise.all([waitReady(first), waitReady(second)]);

  const waitResult = (child: ReturnType<typeof fork>, plugin: string): Promise<ChildResult> =>
    new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`child for ${plugin} exited ${String(code)} before result`));
        }
      });
      child.once("message", (message) => {
        resolve(message as ChildResult);
      });
    });

  const firstResult = waitResult(first, firstPlugin);
  const secondResult = waitResult(second, secondPlugin);

  first.send({ plugin: firstPlugin, marketplace: "mp", cwd: env.cwd });
  second.send({ plugin: secondPlugin, marketplace: "mp", cwd: env.cwd });

  return {
    first: await firstResult,
    second: await secondResult,
  };
}

function assertOneWinner(outcome: RaceOutcome): ChildResult {
  const results = [outcome.first, outcome.second];
  const winners = results.filter((result) => result.ok);
  const losers = results.filter((result) => !result.ok);

  assert.equal(winners.length, 1, JSON.stringify(results));
  assert.equal(losers.length, 1, JSON.stringify(results));
  assert.match(losers[0]!.message, new RegExp(STATE_LOCK_HELD_PREFIX));
  return winners[0]!;
}

async function readState(cwd: string): Promise<StateSummary> {
  const locations = locationsFor("project", cwd);
  return JSON.parse(await readFile(locations.stateJsonPath, "utf8")) as StateSummary;
}

async function listSkillDirs(cwd: string): Promise<readonly string[]> {
  const locations = locationsFor("project", cwd);
  try {
    return (await readdir(locations.skillsTargetDir)).sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw err;
  }
}

test("D-15 same-plugin race leaves one installed record and no orphan skills", async () => {
  const env = await setupRaceEnv("pi-cm-same-race-");
  try {
    await seedMarketplace({ cwd: env.cwd, marketplace: "mp", plugins: ["alpha"] });
    assertOneWinner(await runRace(env, "alpha", "alpha"));

    const state = await readState(env.cwd);
    assert.deepEqual(Object.keys(state.marketplaces.mp!.plugins), ["alpha"]);
    const installedSkills = state.marketplaces.mp!.plugins.alpha!.resources!.skills ?? [];
    assert.deepEqual(await listSkillDirs(env.cwd), [...installedSkills].sort());
  } finally {
    await env.cleanup();
  }
});

test("D-15 different-plugin same-scope race records exactly one plugin and no orphan skills", async () => {
  const env = await setupRaceEnv("pi-cm-different-race-");
  try {
    await seedMarketplace({ cwd: env.cwd, marketplace: "mp", plugins: ["alpha", "beta"] });
    assertOneWinner(await runRace(env, "alpha", "beta"));

    const state = await readState(env.cwd);
    const pluginNames = Object.keys(state.marketplaces.mp!.plugins);
    assert.equal(pluginNames.length, 1);
    const installedSkills =
      state.marketplaces.mp!.plugins[pluginNames[0]!]!.resources!.skills ?? [];
    assert.deepEqual(await listSkillDirs(env.cwd), [...installedSkills].sort());
  } finally {
    await env.cleanup();
  }
});
