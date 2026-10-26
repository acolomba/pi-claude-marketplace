import assert from "node:assert/strict";
import test from "node:test";

import { mock, verify, when } from "strong-mock";

import { withMcpServerStatus } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts";

import type { PluginInstallRecord } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { McpStatusReader } from "../../../extensions/pi-claude-marketplace/platform/mcp-status.ts";
import type {
  McpServerStatus,
  McpServerSummaryEntry,
  PluginInfoMessage,
  PluginInfoRowBase,
} from "../../../extensions/pi-claude-marketplace/shared/notification-types.ts";
import type { Scope } from "../../../extensions/pi-claude-marketplace/shared/types.ts";

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

function answering(answer: ReturnType<McpStatusReader["lookup"]>): McpStatusReader {
  return { lookup: () => answer } satisfies McpStatusReader;
}

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
  test(`ASTAT-01: an installed row's recorded server answering ${answer} reads ${token}`, () => {
    // arrange
    const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);

    // act
    const stamped = withMcpServerStatus(
      block,
      installRecord(["api"]),
      answering(answer),
      undefined,
    );

    // assert
    assert.deepStrictEqual(
      stamped,
      infoBlock("installed", [{ name: "plugin:alpha:api", status: token }]),
    );
  });
}

test("ASTAT-01: a partially-installed row's recorded server is stamped", () => {
  // arrange
  const block = infoBlock("partially-installed", [{ name: "plugin:alpha:api" }]);

  // act
  const stamped = withMcpServerStatus(
    block,
    installRecord(["api"]),
    answering("cached"),
    undefined,
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
  test(`ASTAT-01: a ${status} row gets no server state`, () => {
    // arrange
    const block = infoBlock(status, [{ name: "plugin:alpha:api" }]);

    // act
    const stamped = withMcpServerStatus(
      block,
      installRecord(["api"]),
      answering("connected"),
      undefined,
    );

    // assert
    assert.deepStrictEqual(stamped, infoBlock(status, [{ name: "plugin:alpha:api" }]));
  });
}

test("ASTAT-01: an installed row with unresolved components is left as it is", () => {
  // arrange
  const block: PluginInfoMessage = {
    kind: "plugin-info",
    marketplaceName: "mp",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: false },
    plugin: { status: "installed", name: "alpha", componentsResolved: false },
  };

  // act
  const stamped = withMcpServerStatus(
    block,
    installRecord(["api"]),
    answering("connected"),
    undefined,
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

test("ASTAT-01: an installed row without an installation record is left as it is", () => {
  // arrange
  const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);

  // act
  const stamped = withMcpServerStatus(block, undefined, answering("connected"), undefined);

  // assert
  assert.deepStrictEqual(stamped, infoBlock("installed", [{ name: "plugin:alpha:api" }]));
});

test("ASTAT-01: an installed row without an mcp list is left as it is", () => {
  // arrange
  const block = infoBlock("installed", undefined);

  // act
  const stamped = withMcpServerStatus(
    block,
    installRecord(["api"]),
    answering("connected"),
    undefined,
  );

  // assert
  assert.deepStrictEqual(stamped, infoBlock("installed", undefined));
});

test("ASTAT-01: a left-out server keeps only its unsupported feature and an unrecorded server gets no state", () => {
  // arrange
  const block = infoBlock("partially-installed", [
    { name: "plugin:alpha:api" },
    { name: "plugin:alpha:extra" },
    { name: "plugin:alpha:live", unsupportedFeature: "ws" },
  ]);

  // act
  const stamped = withMcpServerStatus(
    block,
    installRecord(["api", "live"]),
    answering("failed"),
    undefined,
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

test("ANAME-01 / ASTAT-01: the reader is asked for the recorded server's generated adapter key", () => {
  // arrange
  const mcpStatus = mock<McpStatusReader>({ exactParams: true, name: "mcp status" });
  when(() => mcpStatus.lookup("plugin_alpha_my_api_"))
    .thenReturn("connected")
    .times(1);
  const block = infoBlock("installed", [{ name: "plugin:alpha:my.api" }]);

  // act
  const stamped = withMcpServerStatus(block, installRecord(["my.api"]), mcpStatus, undefined);

  // assert
  assert.deepStrictEqual(
    stamped,
    infoBlock("installed", [{ name: "plugin:alpha:my.api", status: "connected" }]),
  );
  verify(mcpStatus);
});

test("ASTAT-01: stamping keeps the entry order and the unset and withheld lists, and leaves its input alone", () => {
  // arrange
  const entries = (): McpServerSummaryEntry[] => [
    { name: "plugin:alpha:zeta", unsetVariables: ["ZETA_TOKEN"] },
    { name: "plugin:alpha:beta", withheldVariables: ["ANTHROPIC_API_KEY"] },
  ];
  const block = infoBlock("installed", entries());

  // act
  const stamped = withMcpServerStatus(
    block,
    installRecord(["beta", "zeta"]),
    answering("needs-auth"),
    undefined,
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
  test(`ASTAT-01: a user row's server the enabled project record lists, answering ${answer}, reads ${token}`, () => {
    // arrange
    const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);

    // act
    const stamped = withMcpServerStatus(
      block,
      installRecord(["api"]),
      answering(answer),
      installRecord(["api"]),
    );

    // assert
    assert.deepStrictEqual(
      stamped,
      infoBlock("installed", [{ name: "plugin:alpha:api", status: token }]),
    );
  });
}

test("ASTAT-01: a project row is never overridden by its own project record", () => {
  // arrange
  const block = infoBlock("installed", [{ name: "plugin:alpha:api" }], "project");

  // act
  const stamped = withMcpServerStatus(
    block,
    installRecord(["api"]),
    answering("connected"),
    installRecord(["api"]),
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
  test(`ENBL-08 / ASTAT-01: with ${label} the user row's server keeps the snapshot's state`, () => {
    // arrange
    const block = infoBlock("installed", [{ name: "plugin:alpha:api" }]);

    // act
    const stamped = withMcpServerStatus(
      block,
      installRecord(["api"]),
      answering("failed"),
      projectRecord,
    );

    // assert
    assert.deepStrictEqual(
      stamped,
      infoBlock("installed", [{ name: "plugin:alpha:api", status: "failed" }]),
    );
  });
}

test("ASTAT-01: only the user row's server the project record lists reads overridden by project scope", () => {
  // arrange
  const block = infoBlock("installed", [{ name: "plugin:alpha:api" }, { name: "plugin:alpha:db" }]);

  // act
  const stamped = withMcpServerStatus(
    block,
    installRecord(["api", "db"]),
    answering("connected"),
    installRecord(["api"]),
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
