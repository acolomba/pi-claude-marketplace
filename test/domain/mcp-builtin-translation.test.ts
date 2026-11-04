import assert from "node:assert/strict";
import { test } from "node:test";

import { translateBuiltinMcpServer } from "../../extensions/pi-claude-marketplace/domain/mcp-builtin-translation.ts";

interface TranslationRow {
  readonly title: string;
  readonly server: Readonly<Record<string, unknown>>;
  readonly description?: string;
  readonly config: Readonly<Record<string, unknown>>;
}

const SERVER_URL = "https://mcp.example.test";

const TRANSLATION_ROWS: readonly TranslationRow[] = [
  {
    title:
      "BLT-02: a stdio server gives command, args, env, timeout, exposure, description in order",
    server: {
      description: "own",
      timeout: 2500,
      env: { K: "v" },
      args: ["a.js"],
      command: "node",
    },
    description: "Demo plugin",
    config: {
      command: "node",
      args: ["a.js"],
      env: { K: "v" },
      timeout: 2.5,
      exposure: "deferred",
      description: "Demo plugin",
    },
  },
  {
    title: "BLT-02: a stdio server typed stdio gives no type",
    server: { type: "stdio", command: "node" },
    config: { command: "node", exposure: "deferred" },
  },
  {
    title:
      "BLT-02: an http server gives type http, url, headers, oauth, timeout, exposure, description",
    server: {
      timeout: 3000,
      oauth: {
        scopes: "read write",
        authServerMetadataUrl: "https://auth.example.test/meta",
        callbackPort: 8080,
        clientId: "client-1",
      },
      headers: { Authorization: "Bearer t" },
      url: SERVER_URL,
      type: "http",
    },
    description: "Demo plugin",
    config: {
      type: "http",
      url: SERVER_URL,
      headers: { Authorization: "Bearer t" },
      oauth: {
        clientId: "client-1",
        callbackUrl: "http://localhost:8080/callback",
        authServerMetadataUrl: "https://auth.example.test/meta",
        scope: "read write",
      },
      timeout: 3,
      exposure: "deferred",
      description: "Demo plugin",
    },
  },
  {
    title: "BLT-02: a streamable-http server is written as type http",
    server: { type: "streamable-http", url: SERVER_URL },
    config: { type: "http", url: SERVER_URL, exposure: "deferred" },
  },
  {
    title: "P2-DC-20: an oauth block without callbackPort gives no callbackUrl",
    server: { type: "http", url: SERVER_URL, oauth: { clientId: "client-1" } },
    config: {
      type: "http",
      url: SERVER_URL,
      oauth: { clientId: "client-1" },
      exposure: "deferred",
    },
  },
  {
    title: "P2-DC-05: a timeout below one second gives no timeout",
    server: { command: "node", timeout: 999 },
    config: { command: "node", exposure: "deferred" },
  },
  {
    title: "P2-DC-05: request_timeout_ms stands in for a remote timeout, capped at five minutes",
    server: { type: "http", url: SERVER_URL, request_timeout_ms: 900_000 },
    config: { type: "http", url: SERVER_URL, timeout: 300, exposure: "deferred" },
  },
  {
    title: "D-MB-02: alwaysLoad true gives exposure direct",
    server: { command: "node", alwaysLoad: true },
    config: { command: "node", exposure: "direct" },
  },
  {
    title: "D-MB-02: alwaysLoad false gives exposure deferred",
    server: { command: "node", alwaysLoad: false },
    config: { command: "node", exposure: "deferred" },
  },
  {
    title: "D-MB-02: alwaysLoad as the string true gives exposure deferred",
    server: { command: "node", alwaysLoad: "true" },
    config: { command: "node", exposure: "deferred" },
  },
  {
    title: "D-MB-02: alwaysLoad as the number 1 gives exposure deferred",
    server: { command: "node", alwaysLoad: 1 },
    config: { command: "node", exposure: "deferred" },
  },
  {
    title: "CC-1: a stdio server's Pi-only fields and adapter fields never appear",
    server: {
      command: "node",
      cwd: "/tmp",
      auth: { provider: "github" },
      toolExposure: { echo: "direct" },
      enabled: false,
      exposure: "hidden",
      directTools: true,
      toolPrefix: "none",
    },
    config: { command: "node", exposure: "deferred" },
  },
  {
    title: "D-MB-11: a remote server's Pi-only oauth keys and adapter fields never appear",
    server: {
      type: "http",
      url: SERVER_URL,
      headers: { "X-Key": "k" },
      auth: { provider: "github" },
      httpTransport: "sse",
      oauth: {
        clientSecret: "s",
        clientName: "n",
        clientRegistration: "dcr",
        callbackUrl: "http://localhost:1/callback",
      },
    },
    config: { type: "http", url: SERVER_URL, headers: { "X-Key": "k" }, exposure: "deferred" },
  },
];

for (const { title, server, description, config } of TRANSLATION_ROWS) {
  test(title, () => {
    // arrange
    const expectedJson = JSON.stringify(config);

    // act
    const translated = translateBuiltinMcpServer(server, description);

    // assert
    assert.strictEqual(JSON.stringify(translated), expectedJson);
  });
}
