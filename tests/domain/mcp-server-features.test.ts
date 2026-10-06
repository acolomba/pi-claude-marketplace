import assert from "node:assert/strict";
import test from "node:test";

import { translateMcpServer } from "../../extensions/pi-claude-marketplace/domain/mcp-server-features.ts";

interface TranslationRow {
  readonly title: string;
  readonly server: Readonly<Record<string, unknown>>;
  readonly description?: string;
  readonly entry: Readonly<Record<string, unknown>>;
}

const SEARCH_OWNED = { directTools: "search", toolPrefix: "mcp" } as const;

const ROWS: readonly TranslationRow[] = [
  {
    title:
      "ANAME-07: an sse server keeps url, headers, its OAuth mapping and timeout and drops adapter-only keys",
    server: {
      type: "sse",
      url: "https://mcp.example.com/sse",
      headers: { "X-Team": "core" },
      timeout: 90_000,
      alwaysLoad: true,
      oauth: {
        clientId: "pi-client",
        callbackPort: 8765,
        scopes: "read write",
        clientSecret: "s3cret",
        skipIssuerMetadataValidation: true,
        redirectUri: "https://evil.example/cb",
      },
      approveTools: false,
      auth: { provider: "anthropic" },
      bearerTokenEnv: "ANTHROPIC_API_KEY",
      requestHeadersCommand: { command: "sign" },
      cwd: "/",
      lifecycle: "eager",
    },
    entry: {
      url: "https://mcp.example.com/sse",
      headers: { "X-Team": "core" },
      httpTransport: "sse",
      oauth: {
        clientId: "pi-client",
        redirectUri: "http://localhost:8765/callback",
        scope: "read write",
      },
      requestTimeoutMs: 90_000,
      directTools: true,
      toolPrefix: "mcp",
    },
  },
  {
    title: "ANAME-05: a stdio server keeps command, args and env and drops lifecycle",
    server: {
      type: "stdio",
      command: "node",
      args: ["server.js"],
      env: { LOG: "1" },
      timeout: 500,
      lifecycle: "keep-alive",
      inheritEnv: false,
    },
    entry: { command: "node", args: ["server.js"], env: { LOG: "1" }, ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: a server without a type is a stdio server",
    server: { command: "node", url: "https://mcp.example.com" },
    entry: { command: "node", ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: an http server keeps url and headers and sets no httpTransport",
    server: { type: "http", url: "https://mcp.example.com", headers: { A: "1" }, command: "x" },
    entry: { url: "https://mcp.example.com", headers: { A: "1" }, ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: a streamable-http server keeps url and headers and sets no httpTransport",
    server: { type: "streamable-http", url: "https://mcp.example.com", headers: { A: "1" } },
    entry: { url: "https://mcp.example.com", headers: { A: "1" }, ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: an unknown type writes the owned fields only",
    server: { type: "ws", url: "wss://mcp.example.com", timeout: 5000, command: "node" },
    entry: SEARCH_OWNED,
  },
  {
    title: "ANAME-07: stdio fields of the wrong type are not copied",
    server: { command: 5, args: "server.js", env: ["LOG=1"] },
    entry: SEARCH_OWNED,
  },
  {
    title: "ANAME-07: remote fields of the wrong type are not copied",
    server: { type: "http", url: 5, headers: ["A: 1"] },
    entry: SEARCH_OWNED,
  },
  {
    title: "ANAME-07: a timeout of 999 writes no requestTimeoutMs",
    server: { command: "node", timeout: 999 },
    entry: { command: "node", ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: a timeout of 1000 writes requestTimeoutMs 1000",
    server: { command: "node", timeout: 1000 },
    entry: { command: "node", requestTimeoutMs: 1000, ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: a timeout of 3000000000 is capped at 2147483647",
    server: { command: "node", timeout: 3_000_000_000 },
    entry: { command: "node", requestTimeoutMs: 2_147_483_647, ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: a non-integer timeout writes no requestTimeoutMs",
    server: { command: "node", timeout: 1500.5 },
    entry: { command: "node", ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: a string timeout writes no requestTimeoutMs",
    server: { command: "node", timeout: "5000" },
    entry: { command: "node", ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: an http timeout of 60000 writes requestTimeoutMs 60000",
    server: { type: "http", url: "https://mcp.example.com", timeout: 60_000 },
    entry: { url: "https://mcp.example.com", requestTimeoutMs: 60_000, ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: an http request_timeout_ms of 300001 folds in as 300000",
    server: { type: "http", url: "https://mcp.example.com", request_timeout_ms: 300_001 },
    entry: { url: "https://mcp.example.com", requestTimeoutMs: 300_000, ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: an http request_timeout_ms of 999 writes no requestTimeoutMs",
    server: { type: "http", url: "https://mcp.example.com", request_timeout_ms: 999 },
    entry: { url: "https://mcp.example.com", ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: a string request_timeout_ms writes no requestTimeoutMs",
    server: { type: "sse", url: "https://mcp.example.com", request_timeout_ms: "5000" },
    entry: { url: "https://mcp.example.com", httpTransport: "sse", ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: a present timeout of 500 keeps request_timeout_ms from folding in",
    server: {
      type: "http",
      url: "https://mcp.example.com",
      timeout: 500,
      request_timeout_ms: 5000,
    },
    entry: { url: "https://mcp.example.com", ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: a stdio server ignores request_timeout_ms",
    server: { command: "node", request_timeout_ms: 5000 },
    entry: { command: "node", ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: an oauth holding only clientSecret writes no oauth",
    server: { type: "http", url: "https://mcp.example.com", oauth: { clientSecret: "s3cret" } },
    entry: { url: "https://mcp.example.com", ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: an oauth that is not an object writes no oauth",
    server: { type: "http", url: "https://mcp.example.com", oauth: "pi-client" },
    entry: { url: "https://mcp.example.com", ...SEARCH_OWNED },
  },
  ...[0, 65_536, 80.5, "8765"].map((callbackPort): TranslationRow => ({
    title: `ANAME-07: a callbackPort of ${JSON.stringify(callbackPort)} writes no redirectUri`,
    server: {
      type: "http",
      url: "https://mcp.example.com",
      oauth: { clientId: "pi-client", callbackPort },
    },
    entry: { url: "https://mcp.example.com", oauth: { clientId: "pi-client" }, ...SEARCH_OWNED },
  })),
  {
    title: "ANAME-07: a callbackPort of 65535 maps to a localhost redirect URI",
    server: { type: "http", url: "https://a.example", oauth: { callbackPort: 65_535 } },
    entry: {
      url: "https://a.example",
      oauth: { redirectUri: "http://localhost:65535/callback" },
      ...SEARCH_OWNED,
    },
  },
  {
    title: "ANAME-07: a callbackPort of 1 maps to a localhost redirect URI",
    server: { type: "http", url: "https://a.example", oauth: { callbackPort: 1 } },
    entry: {
      url: "https://a.example",
      oauth: { redirectUri: "http://localhost:1/callback" },
      ...SEARCH_OWNED,
    },
  },
  {
    title: "ANAME-07: an https authServerMetadataUrl is copied",
    server: {
      type: "http",
      url: "https://a.example",
      oauth: { authServerMetadataUrl: "https://auth.example/.well-known/oauth" },
    },
    entry: {
      url: "https://a.example",
      oauth: { authServerMetadataUrl: "https://auth.example/.well-known/oauth" },
      ...SEARCH_OWNED,
    },
  },
  {
    title: "ANAME-07: an http authServerMetadataUrl is not copied",
    server: {
      type: "http",
      url: "https://a.example",
      oauth: { clientId: "pi-client", authServerMetadataUrl: "http://auth.example/meta" },
    },
    entry: { url: "https://a.example", oauth: { clientId: "pi-client" }, ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: an empty scopes is not copied",
    server: {
      type: "http",
      url: "https://a.example",
      oauth: { clientId: "pi-client", scopes: "" },
    },
    entry: { url: "https://a.example", oauth: { clientId: "pi-client" }, ...SEARCH_OWNED },
  },
  {
    title: "ANAME-07: oauth on a stdio server is ignored",
    server: { command: "node", oauth: { clientId: "pi-client", callbackPort: 8765 } },
    entry: { command: "node", ...SEARCH_OWNED },
  },
  ...["true", 1, false].map((alwaysLoad): TranslationRow => ({
    title: `ANAME-04: alwaysLoad ${JSON.stringify(alwaysLoad)} gives directTools "search"`,
    server: { command: "node", alwaysLoad },
    entry: { command: "node", ...SEARCH_OWNED },
  })),
  {
    title: "ANAME-04: a plugin directTools and toolPrefix are replaced by the owned values",
    server: { command: "node", directTools: false, toolPrefix: "short" },
    entry: { command: "node", ...SEARCH_OWNED },
  },
  {
    title: "ANAME-06: a server-level description is never copied",
    server: { command: "node", description: "From server" },
    entry: { command: "node", ...SEARCH_OWNED },
  },
  {
    title: "ANAME-06: the plugin's description replaces a server-level description",
    server: { command: "node", description: "From server" },
    description: "Hello tools",
    entry: { command: "node", description: "Hello tools", ...SEARCH_OWNED },
  },
];

for (const { title, server, description, entry } of ROWS) {
  test(title, () => {
    // arrange
    const expectedEntry = entry;

    // act
    const translated = translateMcpServer(server, description);

    // assert
    assert.deepStrictEqual(translated, expectedEntry);
  });
}

test("ANAME-07: writes fields in the order transport, oauth, timeout, description, owned", () => {
  // arrange
  const server = {
    lifecycle: "eager",
    alwaysLoad: true,
    timeout: 90_000,
    oauth: { scopes: "read", clientId: "pi-client" },
    headers: { A: "1" },
    url: "https://mcp.example.com/sse",
    type: "sse",
  };

  // act
  const translated = translateMcpServer(server, "Hello tools");

  // assert
  assert.equal(
    JSON.stringify(translated),
    '{"url":"https://mcp.example.com/sse","headers":{"A":"1"},"httpTransport":"sse",' +
      '"oauth":{"clientId":"pi-client","scope":"read"},"requestTimeoutMs":90000,' +
      '"description":"Hello tools","directTools":true,"toolPrefix":"mcp"}',
  );
});
