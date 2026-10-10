import assert from "node:assert/strict";
import test from "node:test";

import { It, mock, verify, when } from "strong-mock";

import { createMcpStatusTracker } from "../../extensions/pi-claude-marketplace/platform/mcp-status.ts";

import type { McpServerRuntimeStatus } from "../../extensions/pi-claude-marketplace/platform/mcp-status.ts";
import type { PiEventSource } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

/**
 * A plain event source that keeps every handler subscribed to it, and a
 * `publish` that delivers one payload to each of them, as Pi's bus does.
 */
function capturingSource(): {
  readonly events: PiEventSource;
  readonly publish: (data: unknown) => void;
} {
  const handlers: ((data: unknown) => void)[] = [];
  const events = {
    on: (_channel: string, handler: (data: unknown) => void) => {
      handlers.push(handler);
      return () => undefined;
    },
  } satisfies PiEventSource;
  return {
    events,
    publish: (data) => {
      for (const handler of handlers) {
        handler(data);
      }
    },
  };
}

test("ASTAT-01: subscribes once to pi-mcp-adapter/status/v1 and answers no-snapshot before any payload", () => {
  // arrange
  const events = mock<PiEventSource>({ exactParams: true, name: "event source" });
  const handler = It.willCapture<(data: unknown) => void>("status handler");
  when(() => events.on("pi-mcp-adapter/status/v1", handler))
    .thenReturn(() => undefined)
    .times(1);

  // act
  const tracker = createMcpStatusTracker(events);

  // assert
  assert.strictEqual(tracker.lookup("plugin_alpha_api_"), "no-snapshot");
  verify(events);
});

const RUNTIME_STATUSES: readonly McpServerRuntimeStatus[] = [
  "connected",
  "cached",
  "failed",
  "needs-auth",
  "not-connected",
  "blocked",
  "disabled",
];

for (const status of RUNTIME_STATUSES) {
  test(`ASTAT-01: a snapshot listing a server as ${status} answers ${status} for its key`, () => {
    // arrange
    const { events, publish } = capturingSource();
    const tracker = createMcpStatusTracker(events);

    // act
    publish({ version: 1, servers: [{ name: "plugin_alpha_api_", status }] });

    // assert
    assert.strictEqual(tracker.lookup("plugin_alpha_api_"), status);
  });
}

for (const key of [
  "plugin_alpha_db_",
  "PLUGIN_ALPHA_API_",
  "plugin_alpha-api_",
  "plugin-alpha_api_",
]) {
  test(`ASTAT-01: a snapshot that does not list ${key} answers unlisted for it`, () => {
    // arrange
    const { events, publish } = capturingSource();
    const tracker = createMcpStatusTracker(events);

    // act
    publish({ version: 1, servers: [{ name: "plugin_alpha_api_", status: "connected" }] });

    // assert
    assert.strictEqual(tracker.lookup(key), "unlisted");
  });
}

test("ASTAT-01: a full adapter-shaped snapshot with extra fields is read", () => {
  // arrange
  const { events, publish } = capturingSource();
  const tracker = createMcpStatusTracker(events);

  // act
  publish({
    version: 1,
    servers: [
      {
        name: "plugin_alpha_api_",
        status: "blocked",
        toolCount: 3,
        directToolCount: 1,
        resourceCount: 2,
        disabled: false,
        listenState: "disconnected",
        catalogStale: true,
        blockedReason: "project is not trusted",
      },
    ],
    totalTools: 3,
    totalResources: 2,
    connectedCount: 0,
    disabledCount: 1,
  });

  // assert
  assert.strictEqual(tracker.lookup("plugin_alpha_api_"), "blocked");
});

for (const { label, payload } of [
  {
    label: "a version 2 snapshot",
    payload: { version: 2, servers: [{ name: "plugin_alpha_api_", status: "connected" }] },
  },
  { label: "a null payload", payload: null },
  { label: "a string payload", payload: "connected" },
  { label: "an array payload", payload: [{ name: "plugin_alpha_api_", status: "connected" }] },
  { label: "an object without servers", payload: { version: 1 } },
  {
    label: "a server whose name is not a string",
    payload: { version: 1, servers: [{ name: 7, status: "connected" }] },
  },
  { label: "an empty servers list", payload: { version: 1, servers: [] } },
]) {
  test(`ASTAT-02: ${label} reads as no usable snapshot`, () => {
    // arrange
    const { events, publish } = capturingSource();
    const tracker = createMcpStatusTracker(events);

    // act
    publish(payload);

    // assert
    assert.strictEqual(tracker.lookup("plugin_alpha_api_"), "no-snapshot");
  });
}

for (const status of ["reconnecting", "\u001b[31mconnected\u001b[0m"]) {
  test(`ASTAT-02: the status ${JSON.stringify(status)} answers unrecognized for its key only`, () => {
    // arrange
    const { events, publish } = capturingSource();
    const tracker = createMcpStatusTracker(events);

    // act
    publish({
      version: 1,
      servers: [
        { name: "plugin_alpha_api_", status },
        { name: "plugin_alpha_db_", status: "cached" },
      ],
    });

    // assert
    assert.deepStrictEqual(
      [tracker.lookup("plugin_alpha_api_"), tracker.lookup("plugin_alpha_db_")],
      ["unrecognized", "cached"],
    );
  });
}

for (const { label, payload } of [
  { label: "an invalid payload", payload: { version: 2, servers: [] } },
  { label: "the empty shutdown snapshot", payload: { version: 1, servers: [] } },
]) {
  test(`ASTAT-02: ${label} replaces an earlier valid snapshot`, () => {
    // arrange
    const { events, publish } = capturingSource();
    const tracker = createMcpStatusTracker(events);
    publish({ version: 1, servers: [{ name: "plugin_alpha_api_", status: "connected" }] });

    // act
    publish(payload);

    // assert
    assert.strictEqual(tracker.lookup("plugin_alpha_api_"), "no-snapshot");
  });
}

test("ASTAT-01: a later valid snapshot replaces an earlier one", () => {
  // arrange
  const { events, publish } = capturingSource();
  const tracker = createMcpStatusTracker(events);
  publish({
    version: 1,
    servers: [
      { name: "plugin_alpha_api_", status: "connected" },
      { name: "plugin_alpha_db_", status: "connected" },
    ],
  });

  // act
  publish({ version: 1, servers: [{ name: "plugin_alpha_api_", status: "failed" }] });

  // assert
  assert.deepStrictEqual(
    [tracker.lookup("plugin_alpha_api_"), tracker.lookup("plugin_alpha_db_")],
    ["failed", "unlisted"],
  );
});

test("ASTAT-01: a snapshot that lists one name twice answers its later entry", () => {
  // arrange
  const { events, publish } = capturingSource();
  const tracker = createMcpStatusTracker(events);

  // act
  publish({
    version: 1,
    servers: [
      { name: "plugin_alpha_api_", status: "connected" },
      { name: "plugin_alpha_api_", status: "needs-auth" },
    ],
  });

  // assert
  assert.strictEqual(tracker.lookup("plugin_alpha_api_"), "needs-auth");
});

test("ASTAT-02: a payload whose getter throws stays inside the handler and reads as no usable snapshot", () => {
  // arrange
  const { events, publish } = capturingSource();
  const tracker = createMcpStatusTracker(events);
  publish({ version: 1, servers: [{ name: "plugin_alpha_api_", status: "connected" }] });
  const hostile = {
    version: 1,
    get servers(): never {
      throw new Error("hostile getter");
    },
  };

  // act
  publish(hostile);

  // assert
  assert.strictEqual(tracker.lookup("plugin_alpha_api_"), "no-snapshot");
});

/** A value that converts to "connected" first and to "constructor" afterwards. */
function shiftingKey(): object {
  let conversions = 0;
  return {
    toString: () => {
      conversions += 1;
      return conversions === 1 ? "connected" : "constructor";
    },
  };
}

/** An accessor that answers `first` on its first read and `later()` afterwards. */
function swappingField(first: string, later: () => unknown): () => unknown {
  let reads = 0;
  return () => {
    reads += 1;
    return reads === 1 ? first : later();
  };
}

for (const { label, server } of [
  {
    label: "a status that turns into an object after the check",
    server: () => {
      const status = swappingField("connected", shiftingKey);
      return {
        name: "plugin_alpha_api_",
        get status() {
          return status();
        },
      };
    },
  },
  {
    label: "a name that turns into an object after the check",
    server: () => {
      const name = swappingField("plugin_alpha_api_", shiftingKey);
      return {
        get name() {
          return name();
        },
        status: "connected",
      };
    },
  },
  {
    label: "a status whose second read throws",
    server: () => {
      const status = swappingField("connected", () => {
        throw new Error("hostile getter");
      });
      return {
        name: "plugin_alpha_api_",
        get status() {
          return status();
        },
      };
    },
  },
]) {
  test(`ASTAT-02: ${label} reads as no usable snapshot`, () => {
    // arrange
    const { events, publish } = capturingSource();
    const tracker = createMcpStatusTracker(events);
    publish({ version: 1, servers: [{ name: "plugin_alpha_api_", status: "connected" }] });

    // act
    publish({ version: 1, servers: [server()] });

    // assert
    assert.strictEqual(tracker.lookup("plugin_alpha_api_"), "no-snapshot");
  });
}

test("ASTAT-02: a status that turns into an unknown string after the check answers unrecognized", () => {
  // arrange
  const { events, publish } = capturingSource();
  const tracker = createMcpStatusTracker(events);
  const status = swappingField("connected", () => "constructor");

  // act
  publish({
    version: 1,
    servers: [
      {
        name: "plugin_alpha_api_",
        get status() {
          return status();
        },
      },
    ],
  });

  // assert
  assert.strictEqual(tracker.lookup("plugin_alpha_api_"), "unrecognized");
});
