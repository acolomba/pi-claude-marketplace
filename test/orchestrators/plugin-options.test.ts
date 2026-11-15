import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { createPluginOptionVariables } from "../../extensions/pi-claude-marketplace/orchestrators/plugin-options.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { marketplaceRecord, pluginRecord, seedState, stateFor } from "./scope-state-seeds.ts";

import type { PluginOptionDeps } from "../../extensions/pi-claude-marketplace/orchestrators/plugin-options.ts";
import type { PluginInstallRecord } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { TestContext } from "node:test";

const SPLIT = "{env:PI_CLAUDE_MARKETPLACE_EMPTY}";

function ownedName(scope: string, marketplace: string, plugin: string, key: string): string {
  const joined = [scope, marketplace, plugin, key].join("\0");
  const hex = createHash("sha256").update(joined).digest("hex").slice(0, 16);
  return `PI_CLAUDE_MARKETPLACE_OPTION_${hex}`;
}

function option(extra: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return { type: "string", title: "Option", description: "An option.", ...extra };
}

function optionsRecord(
  resolvedSource: string,
  enabled: boolean,
  userConfig: Readonly<Record<string, unknown>>,
): PluginInstallRecord {
  return { ...pluginRecord(resolvedSource, enabled), userConfig };
}

interface OptionScope {
  readonly env: NodeJS.ProcessEnv;
  readonly reads: string[];
  readonly deps: PluginOptionDeps;
  readonly userRoot: string;
  readonly projectRoot: string;
  readonly cwd: string;
}

async function createOptionScope(t: TestContext, label: string): Promise<OptionScope> {
  const { agentDir, cwd } = await createHermeticEnvironment(t, `plugin-options-${label}-`);
  const env: NodeJS.ProcessEnv = {};
  const reads: string[] = [];
  return {
    env,
    reads,
    deps: {
      env,
      loadState: async (extensionRoot, options) => {
        reads.push(extensionRoot);
        return loadState(extensionRoot, options);
      },
    },
    userRoot: path.join(agentDir, "pi-claude-marketplace"),
    projectRoot: path.join(cwd, ".pi", "pi-claude-marketplace"),
    cwd,
  };
}

const UNREADABLE_STATE = "{ not json";

async function seedUnreadableState(extensionRoot: string): Promise<void> {
  await mkdir(extensionRoot, { recursive: true });
  await writeFile(path.join(extensionRoot, "state.json"), UNREADABLE_STATE, "utf8");
}

function parseErrorOf(text: string): string {
  try {
    JSON.parse(text);
  } catch (err) {
    if (err instanceof Error) {
      return err.message;
    }
  }

  throw new Error("expected the text not to parse");
}

test("D-PG10-11: the user-scope apply sets one escaped variable per option of each enabled user record and keeps the project's names", async (t) => {
  // arrange
  const scope = await createOptionScope(t, "user");
  const projectName = ownedName("project", "catalog", "alpha", "mode");
  scope.env[projectName] = "project";
  scope.env.PI_CLAUDE_MARKETPLACE_OPTIONS = `project:${projectName}`;
  await seedState(
    scope.userRoot,
    stateFor("user", "/marketplaces/catalog", {
      alpha: optionsRecord("/plugins/alpha", true, {
        mode: option({ default: "fast" }),
        note: option({ required: false }),
      }),
      beta: optionsRecord("/plugins/beta", true, { mode: option({ default: "{env:HOME}" }) }),
      off: optionsRecord("/plugins/off", false, { mode: option({ default: "slow" }) }),
      plain: pluginRecord("/plugins/plain", true),
    }),
  );
  const alphaMode = ownedName("user", "catalog", "alpha", "mode");
  const alphaNote = ownedName("user", "catalog", "alpha", "note");
  const betaMode = ownedName("user", "catalog", "beta", "mode");
  const optionVariables = createPluginOptionVariables(scope.deps);

  // act
  await optionVariables.applyUserScope();

  // assert
  assert.deepStrictEqual(scope.env, {
    [projectName]: "project",
    [alphaMode]: "fast",
    [alphaNote]: "",
    [betaMode]: `{env:${SPLIT}HOME}`,
    PI_CLAUDE_MARKETPLACE_OPTIONS: `user:${alphaMode},user:${alphaNote},user:${betaMode},project:${projectName}`,
  });
  assert.deepStrictEqual(scope.reads, [scope.userRoot]);
});

test("D-PG10-23: the load apply in a trusted project sets both scopes, two plugins with one key get two names, and a repeated apply changes nothing", async (t) => {
  // arrange
  const scope = await createOptionScope(t, "trusted");
  await seedState(
    scope.userRoot,
    stateFor("user", "/marketplaces/catalog", {
      alpha: optionsRecord("/plugins/alpha", true, { mode: option({ default: "user-fast" }) }),
    }),
  );
  await seedState(scope.projectRoot, {
    schemaVersion: 2,
    marketplaces: {
      catalog: marketplaceRecord("catalog", "project", "/marketplaces/catalog", {
        alpha: optionsRecord("/plugins/alpha", true, { mode: option({ default: "alpha-fast" }) }),
        beta: optionsRecord("/plugins/beta", true, { mode: option({ default: "beta-slow" }) }),
      }),
    },
  });
  const userAlpha = ownedName("user", "catalog", "alpha", "mode");
  const projectAlpha = ownedName("project", "catalog", "alpha", "mode");
  const projectBeta = ownedName("project", "catalog", "beta", "mode");
  const expectedEnv = {
    [userAlpha]: "user-fast",
    [projectAlpha]: "alpha-fast",
    [projectBeta]: "beta-slow",
    PI_CLAUDE_MARKETPLACE_OPTIONS: `user:${userAlpha},project:${projectAlpha},project:${projectBeta}`,
  };
  const optionVariables = createPluginOptionVariables(scope.deps);

  // act
  await optionVariables.applyForLoad(scope.cwd, true);
  const envAfterFirst = { ...scope.env };
  await optionVariables.applyForLoad(scope.cwd, true);

  // assert
  assert.deepStrictEqual(envAfterFirst, expectedEnv);
  assert.deepStrictEqual(scope.env, expectedEnv);
  assert.deepStrictEqual(scope.reads, [
    scope.userRoot,
    scope.projectRoot,
    scope.userRoot,
    scope.projectRoot,
  ]);
});

test("D-PG10-23: the load apply in an untrusted project does not open the project state and removes the project's names", async (t) => {
  // arrange
  const scope = await createOptionScope(t, "untrusted");
  await seedUnreadableState(scope.projectRoot);
  const projectName = ownedName("project", "catalog", "alpha", "mode");
  scope.env[projectName] = "project";
  scope.env.PI_CLAUDE_MARKETPLACE_OPTIONS = `project:${projectName}`;
  await seedState(
    scope.userRoot,
    stateFor("user", "/marketplaces/catalog", {
      alpha: optionsRecord("/plugins/alpha", true, { mode: option({ default: "fast" }) }),
    }),
  );
  const userAlpha = ownedName("user", "catalog", "alpha", "mode");
  const optionVariables = createPluginOptionVariables(scope.deps);

  // act
  await optionVariables.applyForLoad(scope.cwd, false);

  // assert
  assert.deepStrictEqual(scope.env, {
    [userAlpha]: "fast",
    PI_CLAUDE_MARKETPLACE_OPTIONS: `user:${userAlpha}`,
  });
  assert.deepStrictEqual(scope.reads, [scope.userRoot]);
});

test("D-PG10-23 / NFR-2: a scope whose state cannot be read keeps its names, is debug-logged, and the other scope is applied", async (t) => {
  // arrange
  const scope = await createOptionScope(t, "unreadable");
  const consoleError = t.mock.method(console, "error", () => undefined);
  const previousDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  t.after(() => {
    if (previousDebug === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = previousDebug;
    }
  });
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  await seedUnreadableState(scope.userRoot);
  const userName = ownedName("user", "catalog", "alpha", "mode");
  scope.env[userName] = "kept";
  scope.env.PI_CLAUDE_MARKETPLACE_OPTIONS = `user:${userName}`;
  await seedState(
    scope.projectRoot,
    stateFor("project", "/marketplaces/catalog", {
      alpha: optionsRecord("/plugins/alpha", true, { mode: option({ default: "fast" }) }),
    }),
  );
  const projectAlpha = ownedName("project", "catalog", "alpha", "mode");
  // The parser's wording differs between Node releases, so it is read back here.
  const parseCause = parseErrorOf(UNREADABLE_STATE);
  const optionVariables = createPluginOptionVariables(scope.deps);

  // act
  await optionVariables.applyForLoad(scope.cwd, true);

  // assert
  assert.deepStrictEqual(scope.env, {
    [userName]: "kept",
    [projectAlpha]: "fast",
    PI_CLAUDE_MARKETPLACE_OPTIONS: `user:${userName},project:${projectAlpha}`,
  });
  assert.deepStrictEqual(
    consoleError.mock.calls.map(({ arguments: [line] }) => String(line)),
    [
      `[env] plugin options: kept the user scope's variables: state.json at ${path.join(scope.userRoot, "state.json")} is not valid JSON: ${parseCause}`,
    ],
  );
});

test("D-PG10-11: before any load, the apply after a command applies the user scope only", async (t) => {
  // arrange
  const scope = await createOptionScope(t, "again-before-load");
  const projectName = ownedName("project", "catalog", "alpha", "mode");
  scope.env[projectName] = "project";
  scope.env.PI_CLAUDE_MARKETPLACE_OPTIONS = `project:${projectName}`;
  await seedState(
    scope.userRoot,
    stateFor("user", "/marketplaces/catalog", {
      alpha: optionsRecord("/plugins/alpha", true, { mode: option({ default: "fast" }) }),
    }),
  );
  const userAlpha = ownedName("user", "catalog", "alpha", "mode");
  const optionVariables = createPluginOptionVariables(scope.deps);

  // act
  await optionVariables.applyAgain();

  // assert
  assert.deepStrictEqual(scope.env, {
    [projectName]: "project",
    [userAlpha]: "fast",
    PI_CLAUDE_MARKETPLACE_OPTIONS: `user:${userAlpha},project:${projectName}`,
  });
  assert.deepStrictEqual(scope.reads, [scope.userRoot]);
});

// One enabled `alpha` with the option `mode` in each scope, its default the scope's name.
async function seedBothScopes(scope: OptionScope): Promise<void> {
  await seedState(
    scope.userRoot,
    stateFor("user", "/marketplaces/catalog", {
      alpha: optionsRecord("/plugins/alpha", true, { mode: option({ default: "user" }) }),
    }),
  );
  await seedState(
    scope.projectRoot,
    stateFor("project", "/marketplaces/catalog", {
      alpha: optionsRecord("/plugins/alpha", true, { mode: option({ default: "project" }) }),
    }),
  );
}

test("D-PG10-11 / D-PG10-23: the apply after a command reads the project of the last load when it was trusted", async (t) => {
  // arrange
  const scope = await createOptionScope(t, "again-trusted");
  const optionVariables = createPluginOptionVariables(scope.deps);
  await optionVariables.applyForLoad(scope.cwd, true);
  await seedBothScopes(scope);
  scope.reads.length = 0;
  const userAlpha = ownedName("user", "catalog", "alpha", "mode");
  const projectAlpha = ownedName("project", "catalog", "alpha", "mode");

  // act
  await optionVariables.applyAgain();

  // assert
  assert.deepStrictEqual(scope.env, {
    [userAlpha]: "user",
    [projectAlpha]: "project",
    PI_CLAUDE_MARKETPLACE_OPTIONS: `user:${userAlpha},project:${projectAlpha}`,
  });
  assert.deepStrictEqual(scope.reads, [scope.userRoot, scope.projectRoot]);
});

test("D-PG10-11 / D-PG10-23: the apply after a command leaves the project out when the last load did not trust it", async (t) => {
  // arrange
  const scope = await createOptionScope(t, "again-untrusted");
  const optionVariables = createPluginOptionVariables(scope.deps);
  await optionVariables.applyForLoad(scope.cwd, false);
  await seedBothScopes(scope);
  scope.reads.length = 0;
  const userAlpha = ownedName("user", "catalog", "alpha", "mode");

  // act
  await optionVariables.applyAgain();

  // assert
  assert.deepStrictEqual(scope.env, {
    [userAlpha]: "user",
    PI_CLAUDE_MARKETPLACE_OPTIONS: `user:${userAlpha}`,
  });
  assert.deepStrictEqual(scope.reads, [scope.userRoot]);
});

test("D-PG10-11: the next apply removes the names of a plugin that is uninstalled or disabled, or no longer declares the option", async (t) => {
  // arrange
  const scope = await createOptionScope(t, "again-gone");
  await seedState(
    scope.userRoot,
    stateFor("user", "/marketplaces/catalog", {
      alpha: optionsRecord("/plugins/alpha", true, { mode: option({ default: "fast" }) }),
      beta: optionsRecord("/plugins/beta", true, { mode: option({ default: "fast" }) }),
      gamma: optionsRecord("/plugins/gamma", true, {
        mode: option({ default: "fast" }),
        retries: option({ default: "3" }),
      }),
    }),
  );
  const optionVariables = createPluginOptionVariables(scope.deps);
  await optionVariables.applyUserScope();
  await seedState(
    scope.userRoot,
    stateFor("user", "/marketplaces/catalog", {
      beta: optionsRecord("/plugins/beta", false, { mode: option({ default: "fast" }) }),
      gamma: optionsRecord("/plugins/gamma", true, { mode: option({ default: "fast" }) }),
    }),
  );
  const gammaMode = ownedName("user", "catalog", "gamma", "mode");

  // act
  await optionVariables.applyAgain();

  // assert
  assert.deepStrictEqual(scope.env, {
    [gammaMode]: "fast",
    PI_CLAUDE_MARKETPLACE_OPTIONS: `user:${gammaMode}`,
  });
});
