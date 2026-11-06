import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { mock, verify, when } from "strong-mock";

import { withMcpServerStatus } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts";
import { noteBuiltinServerOwners } from "../../../extensions/pi-claude-marketplace/platform/mcp-builtin-status.ts";
import { createHermeticEnvironment } from "../../platform/hermetic-environment.ts";

import type { RecordedMcpServers } from "../../../extensions/pi-claude-marketplace/domain/mcp-implementation.ts";
import type { PluginInstallRecord } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type {
  McpStatusLookup,
  McpStatusReader,
} from "../../../extensions/pi-claude-marketplace/platform/mcp-status.ts";
import type { ActiveMcpImplementation } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type {
  McpServerStatus,
  McpServerSummaryEntry,
  PluginInfoMessage,
  PluginInfoRowBase,
} from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";
import type { HermeticEnvironment } from "../../platform/hermetic-environment.ts";
import type { TestContext } from "node:test";

/** An info block for plugin `alpha` with resolved components. */
function infoBlock(
  status: PluginInfoRowBase["status"],
  mcp: readonly McpServerSummaryEntry[] | undefined,
  marketplaceScope: Scope = "user",
): PluginInfoMessage {
  return {
    kind: "plugin-info",
    marketplaceName: "mp",
    marketplaceScope,
    marketplaceDetails: { autoupdate: false },
    plugin: {
      status,
      name: "alpha",
      version: "1.0.0",
      componentsResolved: true,
      components: { skills: ["alpha-skill"], ...(mcp !== undefined && { mcp }) },
    },
  } satisfies PluginInfoMessage;
}

/** An enabled install record for `alpha` that wrote `mcpServers`. */
function installRecord(mcpServers: readonly string[]): PluginInstallRecord {
  return {
    version: "1.0.0",
    resolvedSource: "./plugins/alpha",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: {
      skills: ["alpha-skill"],
      prompts: [],
      agents: [],
      mcpServers: [...mcpServers],
      hooks: [],
      workflows: [],
    },
    enabled: true,
    provenance: "explicit",
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } satisfies PluginInstallRecord;
}

/** MSEL-01: a status lookup through `reader` under `implementation`. */
function lookupThrough(
  reader: McpStatusReader,
  implementation: ActiveMcpImplementation = "adapter",
): McpStatusLookup {
  return { reader, implementation, projectTrusted: true, cwd: "/work/project" };
}

function answering(answer: ReturnType<McpStatusReader["lookup"]>): McpStatusLookup {
  return lookupThrough({ lookup: () => answer } satisfies McpStatusReader);
}

/** The port that reads one record's MCP servers for the built-in stamp. */
type ServersPort = Parameters<typeof withMcpServerStatus>[4];

/** MSEL-01: the port for the adapter and `none` cases, whose stamp never reads it. */
const notRead: ServersPort = () => Promise.resolve<RecordedMcpServers>({ kind: "unreadable" });

for (const { answer, token } of [
  { answer: "connected", token: "connected" },
  { answer: "cached", token: "cached, connects on first use" },
  { answer: "needs-auth", token: "needs authentication" },
  { answer: "blocked", token: "pending approval" },
  { answer: "disabled", token: "disabled" },
  { answer: "not-connected", token: "not connected" },
  { answer: "failed", token: "failed" },
  { answer: "no-snapshot", token: "status unknown" },
  { answer: "unrecognized", token: "status unknown" },
  { answer: "unlisted", token: "not loaded" },
] as const satisfies readonly {
  answer: ReturnType<McpStatusReader["lookup"]>;
  token: McpServerStatus;
}[]) {
  test(`ASTAT-01: an installed row's recorded server answering ${answer} reads ${token}`, async () => {
    // arrange
    const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);

    // act
    const stamped = await withMcpServerStatus(
      block,
      installRecord(["api"]),
      answering(answer),
      undefined,
      notRead,
    );

    // assert
    assert.deepStrictEqual(
      stamped,
      infoBlock("installed", [{ name: "plugin:alpha:api", status: token }]),
    );
  });
}

test("ASTAT-01: a partially-installed row's recorded server is stamped", async () => {
  // arrange
  const block = infoBlock("partially-installed", [{ name: "plugin:alpha:api" }]);

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord(["api"]),
    answering("cached"),
    undefined,
    notRead,
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("partially-installed", [
      { name: "plugin:alpha:api", status: "cached, connects on first use" },
    ]),
  );
});

for (const status of [
  "disabled",
  "available",
  "partially-available",
  "remote",
  "unavailable",
  "failed",
] as const) {
  test(`ASTAT-01: a ${status} row gets no server state`, async () => {
    // arrange
    const block = infoBlock(status, [{ name: "plugin:alpha:api" }]);

    // act
    const stamped = await withMcpServerStatus(
      block,
      installRecord(["api"]),
      answering("connected"),
      undefined,
      notRead,
    );

    // assert
    assert.deepStrictEqual(stamped, infoBlock(status, [{ name: "plugin:alpha:api" }]));
  });
}

test("ASTAT-01: an installed row with unresolved components is left as it is", async () => {
  // arrange
  const block: PluginInfoMessage = {
    kind: "plugin-info",
    marketplaceName: "mp",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: { status: "installed", name: "alpha", componentsResolved: false },
  };

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord(["api"]),
    answering("connected"),
    undefined,
    notRead,
  );

  // assert
  assert.deepStrictEqual(stamped, {
    kind: "plugin-info",
    marketplaceName: "mp",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: { status: "installed", name: "alpha", componentsResolved: false },
  });
});

test("ASTAT-01: an installed row without an installation record is left as it is", async () => {
  // arrange
  const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);

  // act
  const stamped = await withMcpServerStatus(
    block,
    undefined,
    answering("connected"),
    undefined,
    notRead,
  );

  // assert
  assert.deepStrictEqual(stamped, infoBlock("installed", [{ name: "plugin:alpha:api" }]));
});

test("ASTAT-01: an installed row without an mcp list is left as it is", async () => {
  // arrange
  const block = infoBlock("installed", undefined);

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord(["api"]),
    answering("connected"),
    undefined,
    notRead,
  );

  // assert
  assert.deepStrictEqual(stamped, infoBlock("installed", undefined));
});

test("ASTAT-01: a left-out server keeps only its unsupported feature and an unrecorded server gets no state", async () => {
  // arrange
  const block = infoBlock("partially-installed", [
    { name: "plugin:alpha:api" },
    { name: "plugin:alpha:extra" },
    { name: "plugin:alpha:live", unsupportedFeature: "ws" },
  ]);

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord(["api", "live"]),
    answering("failed"),
    undefined,
    notRead,
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("partially-installed", [
      { name: "plugin:alpha:api", status: "failed" },
      { name: "plugin:alpha:extra" },
      { name: "plugin:alpha:live", unsupportedFeature: "ws" },
    ]),
  );
});

for (const implementation of ["adapter", "none"] as const) {
  test(`ANAME-01 / ASTAT-01 / MSEL-01: under ${implementation} the lookup's reader is asked for the recorded server's generated adapter key`, async () => {
    // arrange
    const reader = mock<McpStatusReader>({ exactParams: true, name: "mcp status" });
    when(() => reader.lookup("plugin_alpha_my_api_"))
      .thenReturn("connected")
      .times(1);
    const block = infoBlock("installed", [{ name: "plugin:alpha:my.api" }]);

    // act
    const stamped = await withMcpServerStatus(
      block,
      installRecord(["my.api"]),
      lookupThrough(reader, implementation),
      undefined,
      notRead,
    );

    // assert
    assert.deepStrictEqual(
      stamped,
      infoBlock("installed", [{ name: "plugin:alpha:my.api", status: "connected" }]),
    );
    verify(reader);
  });
}

test("ASTAT-01: stamping keeps the entry order and the unset and withheld lists, and leaves its input alone", async () => {
  // arrange
  const entries = (): McpServerSummaryEntry[] => [
    { name: "plugin:alpha:zeta", unsetVariables: ["ZETA_TOKEN"] },
    { name: "plugin:alpha:beta", withheldVariables: ["ANTHROPIC_API_KEY"] },
  ];
  const block = infoBlock("installed", entries());

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord(["beta", "zeta"]),
    answering("needs-auth"),
    undefined,
    notRead,
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("installed", [
      {
        name: "plugin:alpha:zeta",
        unsetVariables: ["ZETA_TOKEN"],
        status: "needs authentication",
      },
      {
        name: "plugin:alpha:beta",
        withheldVariables: ["ANTHROPIC_API_KEY"],
        status: "needs authentication",
      },
    ]),
  );
  assert.deepStrictEqual(block, infoBlock("installed", entries()));
});

for (const { answer, token } of [
  { answer: "connected", token: "overridden by project scope" },
  { answer: "cached", token: "overridden by project scope" },
  { answer: "needs-auth", token: "overridden by project scope" },
  { answer: "blocked", token: "overridden by project scope" },
  { answer: "disabled", token: "overridden by project scope" },
  { answer: "not-connected", token: "overridden by project scope" },
  { answer: "failed", token: "overridden by project scope" },
  { answer: "unrecognized", token: "overridden by project scope" },
  { answer: "unlisted", token: "overridden by project scope" },
  { answer: "no-snapshot", token: "status unknown" },
] as const satisfies readonly {
  answer: ReturnType<McpStatusReader["lookup"]>;
  token: McpServerStatus;
}[]) {
  test(`ASTAT-01: a user row's server the enabled project record lists, answering ${answer}, reads ${token}`, async () => {
    // arrange
    const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);

    // act
    const stamped = await withMcpServerStatus(
      block,
      installRecord(["api"]),
      answering(answer),
      installRecord(["api"]),
      notRead,
    );

    // assert
    assert.deepStrictEqual(
      stamped,
      infoBlock("installed", [{ name: "plugin:alpha:api", status: token }]),
    );
  });
}

test("ASTAT-01: a project row is never overridden by its own project record", async () => {
  // arrange
  const block = infoBlock("installed", [{ name: "plugin:alpha:api" }], "project");

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord(["api"]),
    answering("connected"),
    installRecord(["api"]),
    notRead,
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("installed", [{ name: "plugin:alpha:api", status: "connected" }], "project"),
  );
});

for (const { label, projectRecord } of [
  {
    label: "a disabled project record",
    projectRecord: { ...installRecord(["api"]), enabled: false },
  },
  { label: "a project record without the server", projectRecord: installRecord(["other"]) },
  { label: "no project record", projectRecord: undefined },
] as const satisfies readonly {
  label: string;
  projectRecord: PluginInstallRecord | undefined;
}[]) {
  test(`ENBL-08 / ASTAT-01: with ${label} the user row's server keeps the snapshot's state`, async () => {
    // arrange
    const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);

    // act
    const stamped = await withMcpServerStatus(
      block,
      installRecord(["api"]),
      answering("failed"),
      projectRecord,
      notRead,
    );

    // assert
    assert.deepStrictEqual(
      stamped,
      infoBlock("installed", [{ name: "plugin:alpha:api", status: "failed" }]),
    );
  });
}

test("ASTAT-01: only the user row's server the project record lists reads overridden by project scope", async () => {
  // arrange
  const block = infoBlock("installed", [{ name: "plugin:alpha:api" }, { name: "plugin:alpha:db" }]);

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord(["api", "db"]),
    answering("connected"),
    installRecord(["api"]),
    notRead,
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("installed", [
      { name: "plugin:alpha:api", status: "overridden by project scope" },
      { name: "plugin:alpha:db", status: "connected" },
    ]),
  );
});

/** The `mcpServerConfigs` of a record that lists `servers` for Pi's built-in MCP. */
function serverConfigs(
  servers: readonly string[],
): NonNullable<PluginInstallRecord["mcpServerConfigs"]> {
  return servers.map((name) => ({ name, config: { command: "node" } }));
}

/** An enabled install record for `alpha` whose `mcpServerConfigs` lists `servers`. */
function builtinRecord(servers: readonly string[]): PluginInstallRecord {
  return { ...installRecord([]), mcpServerConfigs: serverConfigs(servers) };
}

/** MREC-02: a recorded-servers port that answers `servers` as the record's own. */
function recording(servers: readonly string[]): ServersPort {
  return () =>
    Promise.resolve<RecordedMcpServers>({
      kind: "recorded",
      servers: serverConfigs(servers),
      bundle: false,
    });
}

function answeringReader(answer: ReturnType<McpStatusReader["lookup"]>): McpStatusReader {
  return { lookup: () => answer } satisfies McpStatusReader;
}

/**
 * MSEL-01: a built-in status lookup through `reader` in a case-owned Pi
 * environment, whose user and project `mcp.json` files the case may write.
 */
async function builtinLookup(
  t: TestContext,
  reader: McpStatusReader,
  projectTrusted = true,
): Promise<{ readonly lookup: McpStatusLookup; readonly environment: HermeticEnvironment }> {
  const environment = await createHermeticEnvironment(t, "info-mcp-status-");
  return {
    environment,
    lookup: { reader, implementation: "builtin", projectTrusted, cwd: environment.cwd },
  };
}

/** Writes Pi's `mcp.json` with `mcpServers` into `scopeRoot`. */
async function writeMcpJson(scopeRoot: string, mcpServers: Record<string, unknown>): Promise<void> {
  await mkdir(scopeRoot, { recursive: true });
  await writeFile(path.join(scopeRoot, "mcp.json"), JSON.stringify({ mcpServers }));
}

test("D-MB-13 / MSEL-01: under builtin the lookup's reader is asked for the recorded server's registered built-in name", async (t) => {
  // arrange
  const reader = mock<McpStatusReader>({ exactParams: true, name: "mcp status" });
  when(() => reader.lookup("plugin_alpha_my_api"))
    .thenReturn("connected")
    .times(1);
  const { lookup } = await builtinLookup(t, reader);
  const block = infoBlock("installed", [{ name: "plugin:alpha:my.api" }]);

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord([]),
    lookup,
    undefined,
    recording(["my.api"]),
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("installed", [{ name: "plugin:alpha:my.api", status: "connected" }]),
  );
  verify(reader);
});

for (const { answer, token } of [
  { answer: "connected", token: "connected" },
  { answer: "disabled", token: "disabled" },
  { answer: "not-connected", token: "not connected" },
  { answer: "unlisted", token: "not loaded" },
] as const satisfies readonly {
  answer: ReturnType<McpStatusReader["lookup"]>;
  token: McpServerStatus;
}[]) {
  test(`BLT-05: under builtin a recorded server answering ${answer} reads ${token}`, async (t) => {
    // arrange
    const { lookup } = await builtinLookup(t, answeringReader(answer));
    const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);

    // act
    const stamped = await withMcpServerStatus(
      block,
      installRecord([]),
      lookup,
      undefined,
      recording(["api"]),
    );

    // assert
    assert.deepStrictEqual(
      stamped,
      infoBlock("installed", [{ name: "plugin:alpha:api", status: token }]),
    );
  });
}

test("BLT-05: under builtin every server the record's servers read names is stamped, the ones the adapter blocks included", async (t) => {
  // arrange
  const { lookup } = await builtinLookup(t, answeringReader("connected"));
  const block = infoBlock("partially-installed", [
    { name: "plugin:alpha:api" },
    { name: "plugin:alpha:elicit" },
    { name: "plugin:alpha:extra" },
    { name: "plugin:alpha:live", unsupportedFeature: "ws" },
  ]);

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord(["api"]),
    lookup,
    undefined,
    recording(["api", "elicit", "live"]),
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("partially-installed", [
      { name: "plugin:alpha:api", status: "connected" },
      { name: "plugin:alpha:elicit", status: "connected" },
      { name: "plugin:alpha:extra" },
      { name: "plugin:alpha:live", unsupportedFeature: "ws" },
    ]),
  );
});

test("MREC-02: under builtin each server the record's servers read names is stamped, one install did not write included", async (t) => {
  // arrange
  const { lookup } = await builtinLookup(t, answeringReader("connected"));
  const block = infoBlock("installed", [
    { name: "plugin:alpha:api" },
    { name: "plugin:alpha:elicit" },
    { name: "plugin:alpha:extra" },
  ]);
  const readServers = (() =>
    Promise.resolve<RecordedMcpServers>({
      kind: "re-resolved",
      servers: serverConfigs(["api", "elicit"]),
      bundle: false,
    })) satisfies ServersPort;

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord(["api"]),
    lookup,
    undefined,
    readServers,
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("installed", [
      { name: "plugin:alpha:api", status: "connected" },
      { name: "plugin:alpha:elicit", status: "connected" },
      { name: "plugin:alpha:extra" },
    ]),
  );
});

test("MREC-02: under builtin, when the record's servers cannot be read, the servers install wrote are stamped", async (t) => {
  // arrange
  const { lookup } = await builtinLookup(t, answeringReader("not-connected"));
  const block = infoBlock("installed", [{ name: "plugin:alpha:api" }, { name: "plugin:alpha:db" }]);
  const readServers = (() =>
    Promise.resolve<RecordedMcpServers>({ kind: "unreadable" })) satisfies ServersPort;

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord(["db"]),
    lookup,
    undefined,
    readServers,
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("installed", [
      { name: "plugin:alpha:api" },
      { name: "plugin:alpha:db", status: "not connected" },
    ]),
  );
});

test("MREC-02: under builtin the servers are read from the row's own record", async (t) => {
  // arrange
  const record = installRecord(["api"]);
  const readServers = mock<ServersPort>({ exactParams: true, name: "recorded servers" });
  when(() => readServers(record))
    .thenResolve({ kind: "recorded", servers: serverConfigs(["api"]), bundle: false })
    .times(1);
  const { lookup } = await builtinLookup(t, answeringReader("failed"));
  const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);

  // act
  const stamped = await withMcpServerStatus(
    block,
    record,
    lookup,
    builtinRecord(["api", "db"]),
    readServers,
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("installed", [{ name: "plugin:alpha:api", status: "failed" }]),
  );
  verify(readServers);
});

for (const implementation of ["adapter", "none"] as const) {
  test(`MSEL-01: under ${implementation} the record's servers are not read for the stamp`, async () => {
    // arrange
    const readServers = mock<ServersPort>({ exactParams: true, name: "recorded servers" });
    const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);
    const reader = mock<McpStatusReader>({ exactParams: true, name: "mcp status" });
    when(() => reader.lookup("plugin_alpha_api_"))
      .thenReturn("disabled")
      .times(1);

    // act
    const stamped = await withMcpServerStatus(
      block,
      installRecord(["api"]),
      lookupThrough(reader, implementation),
      undefined,
      readServers,
    );

    // assert
    assert.deepStrictEqual(
      stamped,
      infoBlock("installed", [{ name: "plugin:alpha:api", status: "disabled" }]),
    );
    verify(reader);
    verify(readServers);
  });
}

test("BLT-04 / T-02-19: under builtin a server the user's mcp.json configures under its folded name reads overridden by mcp.json, without asking the reader", async (t) => {
  // arrange
  const reader = mock<McpStatusReader>({ exactParams: true, name: "mcp status" });
  when(() => reader.lookup("plugin_alpha_db"))
    .thenReturn("connected")
    .times(1);
  const { lookup, environment } = await builtinLookup(t, reader);
  await writeMcpJson(environment.agentDir, { plugin_alpha_my_api: { command: "node" } });
  const block = infoBlock("installed", [
    { name: "plugin:alpha:my-api" },
    { name: "plugin:alpha:db" },
  ]);

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord([]),
    lookup,
    undefined,
    recording(["my-api", "db"]),
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("installed", [
      { name: "plugin:alpha:my-api", status: "overridden by mcp.json" },
      { name: "plugin:alpha:db", status: "connected" },
    ]),
  );
  verify(reader);
});

test("BLT-04 / D-MB-09: under builtin a server the trusted project's mcp.json configures reads overridden by mcp.json", async (t) => {
  // arrange
  const { lookup, environment } = await builtinLookup(t, answeringReader("connected"));
  await writeMcpJson(path.join(environment.cwd, ".pi"), {
    plugin_alpha_api: { url: "https://example.com/mcp" },
  });
  const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord([]),
    lookup,
    undefined,
    recording(["api"]),
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("installed", [{ name: "plugin:alpha:api", status: "overridden by mcp.json" }]),
  );
});

test("D-MB-09 / T-02-17: under builtin the mcp.json of a project Pi does not trust overrides no user server", async (t) => {
  // arrange
  const { lookup, environment } = await builtinLookup(t, answeringReader("connected"), false);
  await writeMcpJson(path.join(environment.cwd, ".pi"), { plugin_alpha_api: { command: "x" } });
  const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord([]),
    lookup,
    undefined,
    recording(["api"]),
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("installed", [{ name: "plugin:alpha:api", status: "connected" }]),
  );
});

test("T-02-18: under builtin an unreadable user mcp.json reads as no override", async (t) => {
  // arrange
  const { lookup, environment } = await builtinLookup(t, answeringReader("disabled"));
  await writeFile(path.join(environment.agentDir, "mcp.json"), '{"mcpServers": {');
  const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord([]),
    lookup,
    undefined,
    recording(["api"]),
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("installed", [{ name: "plugin:alpha:api", status: "disabled" }]),
  );
});

test("D-MB-09: under builtin a project row reads project not trusted while Pi does not trust the project, before any mcp.json override, without asking the reader", async (t) => {
  // arrange
  const reader = mock<McpStatusReader>({ exactParams: true, name: "mcp status" });
  const { lookup, environment } = await builtinLookup(t, reader, false);
  await writeMcpJson(environment.agentDir, { plugin_alpha_api: { command: "node" } });
  const block = infoBlock(
    "installed",
    [{ name: "plugin:alpha:api" }, { name: "plugin:alpha:db" }, { name: "plugin:alpha:extra" }],
    "project",
  );

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord([]),
    lookup,
    undefined,
    recording(["api", "db"]),
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock(
      "installed",
      [
        { name: "plugin:alpha:api", status: "project not trusted" },
        { name: "plugin:alpha:db", status: "project not trusted" },
        { name: "plugin:alpha:extra" },
      ],
      "project",
    ),
  );
  verify(reader);
});

/** Gives the registered names to their owners, as the registration step's sync does, for this case. */
function ownedBy(
  t: TestContext,
  owners: Readonly<Record<string, readonly [scope: Scope, marketplace: string, plugin: string]>>,
): void {
  t.after(() => {
    noteBuiltinServerOwners(new Map());
  });
  noteBuiltinServerOwners(
    new Map(
      Object.entries(owners).map(([name, [scope, marketplace, plugin]]) => [
        name,
        { scope, marketplace, plugin },
      ]),
    ),
  );
}

test("BLT-05: under builtin a trusted project row whose record owns the name reads the reader's answer", async (t) => {
  // arrange
  ownedBy(t, { plugin_alpha_api: ["project", "mp", "alpha"] });
  const { lookup } = await builtinLookup(t, answeringReader("connected"));
  const block = infoBlock("installed", [{ name: "plugin:alpha:api" }], "project");

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord([]),
    lookup,
    builtinRecord(["api"]),
    recording(["api"]),
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("installed", [{ name: "plugin:alpha:api", status: "connected" }], "project"),
  );
});

test("ASTAT-01 / P2-DC-14: under builtin only the user row's server that a project record owns reads overridden by project scope", async (t) => {
  // arrange
  ownedBy(t, {
    plugin_alpha_api: ["project", "mp", "alpha"],
    plugin_alpha_db: ["user", "mp", "alpha"],
  });
  const reader = mock<McpStatusReader>({ exactParams: true, name: "mcp status" });
  when(() => reader.lookup("plugin_alpha_db"))
    .thenReturn("not-connected")
    .times(1);
  const { lookup } = await builtinLookup(t, reader);
  const block = infoBlock("installed", [{ name: "plugin:alpha:api" }, { name: "plugin:alpha:db" }]);

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord([]),
    lookup,
    builtinRecord(["api"]),
    recording(["api", "db"]),
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("installed", [
      { name: "plugin:alpha:api", status: "overridden by project scope" },
      { name: "plugin:alpha:db", status: "not connected" },
    ]),
  );
  verify(reader);
});

for (const { label, owner, scope, token } of [
  {
    label: "a project record of another marketplace owns the name, the user row",
    owner: ["project", "other", "alpha"],
    scope: "user",
    token: "overridden by project scope",
  },
  {
    label: "a user record of another marketplace owns the name, the user row",
    owner: ["user", "other", "alpha"],
    scope: "user",
    token: "not loaded",
  },
  {
    label: "another plugin's server folds to the name, the user row",
    owner: ["user", "mp", "alpha-x"],
    scope: "user",
    token: "not loaded",
  },
  {
    label: "the user record owns the name, the trusted project row",
    owner: ["user", "mp", "alpha"],
    scope: "project",
    token: "not loaded",
  },
] as const satisfies readonly {
  label: string;
  owner: readonly [Scope, string, string];
  scope: Scope;
  token: McpServerStatus;
}[]) {
  test(`ASTAT-01 / P2-DC-14: under builtin when ${label} reads ${token}, without asking the reader`, async (t) => {
    // arrange
    ownedBy(t, { plugin_alpha_api: owner });
    const reader = mock<McpStatusReader>({ exactParams: true, name: "mcp status" });
    const { lookup } = await builtinLookup(t, reader);
    const block = infoBlock("installed", [{ name: "plugin:alpha:api" }], scope);

    // act
    const stamped = await withMcpServerStatus(
      block,
      installRecord([]),
      lookup,
      undefined,
      recording(["api"]),
    );

    // assert
    assert.deepStrictEqual(
      stamped,
      infoBlock("installed", [{ name: "plugin:alpha:api", status: token }], scope),
    );
    verify(reader);
  });
}

test("P2-DC-14: under builtin a server the trusted project record lists but the step registered for the user reads the reader's answer", async (t) => {
  // arrange
  ownedBy(t, { plugin_alpha_api: ["user", "mp", "alpha"] });
  const { lookup } = await builtinLookup(t, answeringReader("connected"));
  const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord([]),
    lookup,
    builtinRecord(["api"]),
    recording(["api"]),
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("installed", [{ name: "plugin:alpha:api", status: "connected" }]),
  );
});

test("BLT-05: under builtin an mcp.json override comes before a project override", async (t) => {
  // arrange
  ownedBy(t, { plugin_alpha_api: ["project", "mp", "alpha"] });
  const { lookup, environment } = await builtinLookup(t, answeringReader("connected"));
  await writeMcpJson(environment.agentDir, { plugin_alpha_api: { command: "node" } });
  const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);

  // act
  const stamped = await withMcpServerStatus(
    block,
    installRecord([]),
    lookup,
    builtinRecord(["api"]),
    recording(["api"]),
  );

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("installed", [{ name: "plugin:alpha:api", status: "overridden by mcp.json" }]),
  );
});

for (const { label, projectRecord, projectTrusted } of [
  {
    label: "a disabled project record",
    projectRecord: { ...builtinRecord(["api"]), enabled: false },
    projectTrusted: true,
  },
  {
    label: "a project record without the server",
    projectRecord: builtinRecord(["other"]),
    projectTrusted: true,
  },
  { label: "no project record", projectRecord: undefined, projectTrusted: true },
  {
    label: "a project record of a project Pi does not trust",
    projectRecord: builtinRecord(["api"]),
    projectTrusted: false,
  },
] as const satisfies readonly {
  label: string;
  projectRecord: PluginInstallRecord | undefined;
  projectTrusted: boolean;
}[]) {
  test(`ENBL-08 / P2-DC-14: under builtin with ${label} and no owner for the name the user row's server keeps the reader's answer`, async (t) => {
    // arrange
    const { lookup } = await builtinLookup(t, answeringReader("disabled"), projectTrusted);
    const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);

    // act
    const stamped = await withMcpServerStatus(
      block,
      installRecord([]),
      lookup,
      projectRecord,
      recording(["api"]),
    );

    // assert
    assert.deepStrictEqual(
      stamped,
      infoBlock("installed", [{ name: "plugin:alpha:api", status: "disabled" }]),
    );
  });
}
