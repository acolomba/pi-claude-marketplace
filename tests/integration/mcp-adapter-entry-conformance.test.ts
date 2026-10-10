// tests/integration/mcp-adapter-entry-conformance.test.ts
//
// D-08-02 / D-08-04: pi-mcp-adapter accepts two shapes this extension writes
// to `mcp-adapter.json`. Its config loader reads the top-level
// `_piClaudeMarketplace.serverChoices` store as no server, so a stored choice
// never shows up as a server after uninstall (D-08-02). Its OAuth check turns
// OAuth on for a remote entry beside clean non-Authorization headers, where
// the extension writes `auth: "oauth"`, and its header resolver accepts those
// headers; an entry whose header names an unset variable keeps OAuth off,
// because the resolver refuses that header (D-08-04).
//
// pi-mcp-adapter is an optional peer. The test finds it through
// `PI_MCP_ADAPTER_ROOT` only (pi-mcp-adapter-peer.ts) and imports its
// `dist/config.js`, `dist/mcp-auth-flow.js` and `dist/mcp-auth-fetch.js` in
// place. Each case skips only when that variable is unset. The CI
// `integration` job installs the pinned peer and always sets it, so CI runs
// every case.

import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { stampServers } from "../../extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts";
import {
  createInstallOperation,
  createUninstallOperation,
} from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { makeCtx, seedMcpPlugin } from "./mcp-plugin-seed.ts";
import { findPiMcpAdapterPackage, loadPiMcpAdapterModule } from "./pi-mcp-adapter-peer.ts";

import type {
  PiMcpAdapterAuthFetch,
  PiMcpAdapterAuthFlow,
  PiMcpAdapterConfig,
} from "./pi-mcp-adapter-peer.ts";

const NOT_INSTALLED = "PI_MCP_ADAPTER_ROOT is not set";

interface AdapterModules {
  readonly config: PiMcpAdapterConfig;
  readonly authFlow: PiMcpAdapterAuthFlow;
  readonly authFetch: PiMcpAdapterAuthFetch;
}

async function loadAdapterModules(): Promise<AdapterModules | undefined> {
  const peer = await findPiMcpAdapterPackage();
  if (peer === undefined) {
    return undefined;
  }

  return {
    config: await loadPiMcpAdapterModule<PiMcpAdapterConfig>(peer, "config"),
    authFlow: await loadPiMcpAdapterModule<PiMcpAdapterAuthFlow>(peer, "mcp-auth-flow"),
    authFetch: await loadPiMcpAdapterModule<PiMcpAdapterAuthFetch>(peer, "mcp-auth-fetch"),
  };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Readonly<Record<string, string>> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");
}

/** The entry `stampServers` writes for one sse server holding `headers`, staged with no variable set. */
function stampedSseEntry(headers: Readonly<Record<string, string>>): unknown {
  return stampServers({
    servers: { srv: { type: "sse", url: "https://mcp.example.test/sse", headers } },
    pluginName: "hello",
    marketplaceName: "mp",
    substitution: {
      pluginRoot: "/plugin/root",
      pluginData: "/plugin/data",
      projectDir: undefined,
      env: {},
    },
    previous: {},
    keptOverrides: {},
  }).stamped.srv;
}

test("D-08-02: pi-mcp-adapter loads a user file holding a stored server choice as the user's own servers only", async (t) => {
  const adapter = await loadAdapterModules();
  if (adapter === undefined) {
    t.skip(NOT_INSTALLED);
    return;
  }

  await withHermeticEnvironment("mcp-adapter-entry-conformance-", async ({ cwd }) => {
    // arrange
    await seedMcpPlugin(cwd, ["user"]);
    const adapterPath = locationsFor("user", cwd).mcpAdapterJsonPath;
    await mkdir(path.dirname(adapterPath), { recursive: true });
    await writeFile(adapterPath, '{ "mcpServers": { "mine": { "command": "my-server" } } }\n');
    const hooksRouting = createHooksRouting(createHooksRuntime(), { readHooksJson });
    const completionCache = createCompletionCache();
    const request = { scope: "user", cwd, marketplace: "mp", plugin: "hello" } as const;
    await createInstallOperation(
      hooksRouting,
      completionCache,
    )({ ...makeCtx().session, ...request });
    const installed = JSON.parse(await readFile(adapterPath, "utf8")) as {
      readonly mcpServers: Record<string, Record<string, unknown>>;
    };
    installed.mcpServers.plugin_hello_srv_ = {
      ...installed.mcpServers.plugin_hello_srv_,
      disabled: true,
      openUi: true,
    };
    await writeFile(adapterPath, JSON.stringify(installed, null, 2));

    // act
    await createUninstallOperation(
      hooksRouting,
      completionCache,
    )({ ...makeCtx().session, ...request });
    const uninstalled: unknown = JSON.parse(await readFile(adapterPath, "utf8"));
    const loaded = adapter.config.loadMcpConfig(undefined, cwd);

    // assert
    assert.deepStrictEqual(uninstalled, {
      mcpServers: { mine: { command: "my-server" } },
      _piClaudeMarketplace: {
        serverChoices: {
          plugin_hello_srv_: { plugin: "hello", fields: { disabled: true, openUi: true } },
        },
      },
    });
    assert.deepStrictEqual(loaded.mcpServers, { mine: { command: "my-server" } });
  });
});

test("D-08-04: pi-mcp-adapter keeps OAuth for the entry written beside a clean non-Authorization header and resolves that header", async (t) => {
  const adapter = await loadAdapterModules();
  if (adapter === undefined) {
    t.skip(NOT_INSTALLED);
    return;
  }

  // arrange
  const entry = stampedSseEntry({ "X-Team": "core" });
  assert.ok(isRecord(entry));
  const { headers } = entry;
  assert.ok(isStringRecord(headers));

  // act
  const supportsOAuth = adapter.authFlow.supportsOAuth(entry);
  const resolvedHeaders = adapter.authFetch.resolveOAuthHeaders(headers);

  // assert
  assert.deepStrictEqual(
    { auth: entry.auth, headers },
    { auth: "oauth", headers: { "X-Team": "core" } },
  );
  assert.strictEqual(supportsOAuth, true);
  assert.deepStrictEqual([...resolvedHeaders], [["x-team", "core"]]);
});

test("D-08-04: pi-mcp-adapter keeps OAuth off for the entry written beside a header naming an unset variable, whose header OAuth mode refuses", async (t) => {
  const adapter = await loadAdapterModules();
  if (adapter === undefined) {
    t.skip(NOT_INSTALLED);
    return;
  }

  // arrange
  const entry = stampedSseEntry({ "X-Org": "${PI_CM_UNSET_IN_CONFORMANCE}" });
  assert.ok(isRecord(entry));
  const { headers } = entry;
  assert.ok(isStringRecord(headers));

  // act
  const supportsOAuth = adapter.authFlow.supportsOAuth(entry);

  // assert
  assert.deepStrictEqual(
    { hasAuth: Object.hasOwn(entry, "auth"), headers },
    { hasAuth: false, headers: { "X-Org": "${PI_CM_UNSET_IN_CONFORMANCE}" } },
  );
  assert.strictEqual(supportsOAuth, false);
  assert.throws(() => adapter.authFetch.resolveOAuthHeaders(headers), TypeError);
});
