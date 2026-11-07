// D-P3-02 / MREC-03: the update path writes the neutral MCP verdict with
// `compatibilityBasis: "neutral"`. Each case drives the real update,
// reinstall, or disabled update in a hermetic home and reads the saved
// state.json: the swap's final write, the reinstall through the same swap,
// the intent mark a failed update leaves, and the disabled pin refresh.

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import {
  createEnableOperation,
  createInstallOperation,
  createReinstallOperation,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { createPluginUpdateOperations } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update-flow.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { makeCtx, seedMcpPlugin } from "./mcp-plugin-seed.ts";

const STDIO = { command: "node", args: ["v1.js"] };
const ASKER = { command: "node", args: ["asker.js"], bareElicitationCapability: true };
const AT_PROJECT = { scope: "project", marketplace: "mp", plugin: "hello" } as const;
const UPDATE_TARGET = { kind: "plugin", plugin: "hello", marketplace: "mp" } as const;

/** The neutral verdict of a skill-carrying `hello` whose servers every implementation admits. */
const NEUTRAL_WITH_SKILL = {
  installable: true,
  notes: [],
  supported: ["skills"],
  unsupported: [],
};

function operations() {
  const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
  const completionCache = createCompletionCache();
  return {
    install: createInstallOperation(hooksRouting, completionCache),
    setPluginEnabled: createEnableOperation(hooksRouting),
    reinstall: createReinstallOperation(hooksRouting, completionCache),
    updatePlugins: createPluginUpdateOperations(hooksRouting, completionCache).updatePlugins,
  };
}

/**
 * Publishes `hello` at `version` with one skill and the `.mcp.json` servers
 * `servers`, so the marketplace offers that version.
 */
async function publishHello(
  pluginRoot: string,
  version: string,
  servers: Readonly<Record<string, unknown>>,
): Promise<void> {
  const marketplaceRoot = path.dirname(path.dirname(pluginRoot));
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: "hello", version }),
  );
  await mkdir(path.join(pluginRoot, "skills", "tool"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, "skills", "tool", "SKILL.md"),
    `---\nname: tool\ndescription: tool ${version}\n---\n`,
  );
  await writeFile(path.join(pluginRoot, ".mcp.json"), JSON.stringify({ mcpServers: servers }));
  await writeFile(
    path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"),
    JSON.stringify({
      name: "mp",
      plugins: [{ name: "hello", source: "./plugins/hello", version }],
    }),
  );
}

/** Seeds and installs `hello` 1.0.0 with one skill and one stdio server at project scope. */
async function installHello(cwd: string): Promise<string> {
  const pluginRoot = await seedMcpPlugin(cwd, ["project"], STDIO);
  await publishHello(pluginRoot, "1.0.0", { srv: STDIO });
  await operations().install({ ...makeCtx().session, ...AT_PROJECT, cwd });
  return pluginRoot;
}

async function savedHello(cwd: string) {
  const record = (await loadState(locationsFor("project", cwd).extensionRoot)).marketplaces.mp
    ?.plugins.hello;
  assert.ok(record !== undefined);
  return record;
}

/** Rewrites the saved record as a build before D-P3-02 left it: no basis. */
async function dropBasis(cwd: string): Promise<void> {
  const locations = locationsFor("project", cwd);
  const state = await loadState(locations.extensionRoot);
  const record = state.marketplaces.mp?.plugins.hello;
  assert.ok(record !== undefined);
  delete record.compatibilityBasis;
  await saveState(locations.extensionRoot, state);
}

test("D-P3-02: an update to a version that adds a bare-elicitation server stores the neutral verdict with its basis", async () => {
  await withHermeticEnvironment("mcp-verdict-update-swap-", async ({ cwd }) => {
    // arrange
    const pluginRoot = await installHello(cwd);
    await dropBasis(cwd);
    await publishHello(pluginRoot, "1.1.0", { srv: STDIO, asker: ASKER });

    // act
    await operations().updatePlugins({
      ...makeCtx().session,
      scope: "project",
      cwd,
      target: UPDATE_TARGET,
    });

    // assert
    const record = await savedHello(cwd);
    assert.deepStrictEqual(
      {
        version: record.version,
        compatibility: record.compatibility,
        compatibilityBasis: record.compatibilityBasis,
        mcpServerConfigs: record.mcpServerConfigs,
      },
      {
        version: "1.1.0",
        compatibility: NEUTRAL_WITH_SKILL,
        compatibilityBasis: "neutral",
        mcpServerConfigs: [
          { name: "srv", config: STDIO },
          { name: "asker", config: ASKER },
        ],
      },
    );
  });
});

test("D-P3-02: a reinstall of a legacy record stores the neutral verdict with its basis", async () => {
  await withHermeticEnvironment("mcp-verdict-update-reinstall-", async ({ cwd }) => {
    // arrange
    const pluginRoot = await installHello(cwd);
    await publishHello(pluginRoot, "1.0.0", { srv: STDIO, asker: ASKER });
    await dropBasis(cwd);

    // act
    await operations().reinstall({ ...makeCtx().session, ...AT_PROJECT, cwd });

    // assert
    const record = await savedHello(cwd);
    assert.deepStrictEqual(
      {
        version: record.version,
        compatibility: record.compatibility,
        compatibilityBasis: record.compatibilityBasis,
      },
      { version: "1.0.0", compatibility: NEUTRAL_WITH_SKILL, compatibilityBasis: "neutral" },
    );
  });
});

test("D-P3-02: a failed update keeps the basis of the record its intent mark carries", async () => {
  await withHermeticEnvironment("mcp-verdict-update-failed-", async ({ cwd }) => {
    // arrange
    const pluginRoot = await installHello(cwd);
    await publishHello(pluginRoot, "1.1.0", { srv: STDIO, asker: ASKER });
    await mkdir(path.join(pluginRoot, "skills", "extra"), { recursive: true });
    await writeFile(
      path.join(pluginRoot, "skills", "extra", "SKILL.md"),
      "---\nname: extra\n---\n",
    );
    const locations = locationsFor("project", cwd);
    await writeFile(path.join(locations.skillsTargetDir, "hello-extra"), "a user's file");

    // act
    await operations().updatePlugins({
      ...makeCtx().session,
      scope: "project",
      cwd,
      target: UPDATE_TARGET,
    });

    // assert
    const record = await savedHello(cwd);
    assert.deepStrictEqual(
      {
        version: record.version,
        compatibility: record.compatibility,
        compatibilityBasis: record.compatibilityBasis,
      },
      {
        version: "1.0.0",
        compatibility: { ...NEUTRAL_WITH_SKILL, installable: false, notes: ["update-in-progress"] },
        compatibilityBasis: "neutral",
      },
    );
  });
});

test("D-P3-02: a disabled update stores the neutral verdict with its basis, and repeating it writes nothing", async () => {
  await withHermeticEnvironment("mcp-verdict-update-disabled-", async ({ cwd }) => {
    // arrange
    const pluginRoot = await installHello(cwd);
    const { setPluginEnabled, updatePlugins } = operations();
    await setPluginEnabled({ ...makeCtx().session, ...AT_PROJECT, cwd, enable: false });
    await dropBasis(cwd);
    await publishHello(pluginRoot, "1.1.0", { srv: STDIO, asker: ASKER });
    const { stateJsonPath } = locationsFor("project", cwd);

    // act
    await updatePlugins({ ...makeCtx().session, scope: "project", cwd, target: UPDATE_TARGET });
    const refreshedBytes = await readFile(stateJsonPath, "utf8");
    const repeated = makeCtx();
    await updatePlugins({ ...repeated.session, scope: "project", cwd, target: UPDATE_TARGET });

    // assert
    const record = await savedHello(cwd);
    assert.deepStrictEqual(
      {
        enabled: record.enabled,
        version: record.version,
        compatibility: record.compatibility,
        compatibilityBasis: record.compatibilityBasis,
        repeatedMessages: repeated.notifications.map((n) => n.message),
        unchangedBytes: (await readFile(stateJsonPath, "utf8")) === refreshedBytes,
      },
      {
        enabled: false,
        version: "1.1.0",
        compatibility: NEUTRAL_WITH_SKILL,
        compatibilityBasis: "neutral",
        repeatedMessages: ["● mp [project]\n  ⊘ hello (skipped) {up-to-date}"],
        unchangedBytes: true,
      },
    );
  });
});
