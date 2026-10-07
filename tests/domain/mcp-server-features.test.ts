import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  classifyMcpServer,
  translateMcpServer,
} from "../../extensions/pi-claude-marketplace/domain/mcp-server-features.ts";

import type { McpServerVerdict } from "../../extensions/pi-claude-marketplace/domain/mcp-server-features.ts";

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

describe("translateMcpServer", () => {
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
});

interface VerdictRow {
  readonly title: string;
  readonly server: unknown;
  readonly verdict: McpServerVerdict;
}

const SUPPORTED: McpServerVerdict = { kind: "supported" };

const VERDICT_ROWS: readonly VerdictRow[] = [
  {
    title: "ANAME-07: a number is malformed",
    server: 5,
    verdict: { kind: "malformed", detail: "(root): must be object" },
  },
  {
    title: "ANAME-07: null is malformed",
    server: null,
    verdict: { kind: "malformed", detail: "(root): must be object" },
  },
  {
    title: "ANAME-07: an array is malformed",
    server: [],
    verdict: { kind: "malformed", detail: "(root): must be object" },
  },
  {
    title: "ANAME-07: a url with no type is malformed",
    server: { url: "https://x" },
    verdict: { kind: "malformed", detail: "(root): must have required properties command" },
  },
  {
    title: "ANAME-07: an unknown type is malformed",
    server: { type: "grpc", url: "x" },
    verdict: { kind: "malformed", detail: 'unknown type "grpc"' },
  },
  {
    title: "ANAME-07: an empty command is malformed",
    server: { command: "" },
    verdict: { kind: "malformed", detail: "/command: must not have fewer than 1 characters" },
  },
  {
    title: "ANAME-07: a fractional timeout is malformed",
    server: { command: "node", timeout: 1.5 },
    verdict: { kind: "malformed", detail: "/timeout: must be integer" },
  },
  {
    title: "ANAME-07: a zero timeout is malformed",
    server: { command: "node", timeout: 0 },
    verdict: { kind: "malformed", detail: "/timeout: must be >= 1" },
  },
  {
    title: "ANAME-07: a string timeout is malformed",
    server: { command: "node", timeout: "60" },
    verdict: { kind: "malformed", detail: "/timeout: must be integer" },
  },
  {
    title: "ANAME-07: a non-string env value is malformed",
    server: { command: "node", env: { A: 1 } },
    verdict: { kind: "malformed", detail: "/env/A: must be string" },
  },
  {
    title: "ANAME-07: a non-string args element is malformed",
    server: { command: "node", args: ["a", 2] },
    verdict: { kind: "malformed", detail: "/args/1: must be string" },
  },
  {
    title: "ANAME-07: a callbackPort above 65535 is malformed",
    server: { type: "http", url: "x", oauth: { callbackPort: 70_000 } },
    verdict: { kind: "malformed", detail: "/oauth/callbackPort: must be <= 65535" },
  },
  {
    title: "ANAME-07: a non-https authServerMetadataUrl is malformed",
    server: { type: "http", url: "x", oauth: { authServerMetadataUrl: "http://x" } },
    verdict: {
      kind: "malformed",
      detail: '/oauth/authServerMetadataUrl: must match pattern "^https://"',
    },
  },
  {
    title: "ANAME-07: empty scopes are malformed",
    server: { type: "http", url: "x", oauth: { scopes: "" } },
    verdict: { kind: "malformed", detail: "/oauth/scopes: must not have fewer than 1 characters" },
  },
  {
    title: "ANAME-07: a non-string header value is malformed",
    server: { type: "sse", url: "x", headers: { A: 1 } },
    verdict: { kind: "malformed", detail: "/headers/A: must be string" },
  },
  {
    title: "ANAME-07: an http server with no url is malformed",
    server: { type: "streamable-http" },
    verdict: { kind: "malformed", detail: "(root): must have required properties url" },
  },
  {
    title: "ANAME-07: a ws server with a non-string url is malformed",
    server: { type: "ws", url: 5 },
    verdict: { kind: "malformed", detail: "/url: must be string" },
  },
  {
    title: "ANAME-07: an invalid request_timeout_ms is ignored, not malformed",
    server: { type: "http", url: "x", request_timeout_ms: "soon" },
    verdict: SUPPORTED,
  },
  {
    title: "ANAME-07: role and discoveryCache never block a server",
    server: { type: "http", url: "x", role: "comms", discoveryCache: true },
    verdict: SUPPORTED,
  },
  {
    title: "ANAME-07: a stdio server keeps a role of any value",
    server: { command: "node", role: 5 },
    verdict: SUPPORTED,
  },
  {
    title:
      "ANAME-07: a falsy oauth.xaa, an empty toolPermissions and a tool without a policy are supported",
    server: {
      type: "sse",
      url: "x",
      oauth: { xaa: false },
      toolPermissions: {},
      tools: [{ name: "read" }],
      bareElicitationCapability: false,
    },
    verdict: SUPPORTED,
  },
  {
    title: "ANAME-07: a stdio server ignores the remote-only headersHelper",
    server: { command: "node", headersHelper: "./headers.sh" },
    verdict: SUPPORTED,
  },
  {
    title: "ANAME-07: a valid ws server is blocked by ws",
    server: { type: "ws", url: "wss://mcp.example.com/ws" },
    verdict: { kind: "blocked", feature: "ws" },
  },
  {
    title: "ANAME-07: an sse-ide server is blocked without validation",
    server: { type: "sse-ide" },
    verdict: { kind: "blocked", feature: "sse-ide" },
  },
  {
    title: "ANAME-07: a ws-ide server is blocked without validation",
    server: { type: "ws-ide" },
    verdict: { kind: "blocked", feature: "ws-ide" },
  },
  {
    title: "ANAME-07: an sdk server is blocked without validation",
    server: { type: "sdk" },
    verdict: { kind: "blocked", feature: "sdk" },
  },
  {
    title: "ANAME-07: a claudeai-proxy server is blocked without validation",
    server: { type: "claudeai-proxy" },
    verdict: { kind: "blocked", feature: "claudeai-proxy" },
  },
  {
    title: "ANAME-07: headersHelper blocks a remote server",
    server: { type: "http", url: "x", headersHelper: "./headers.sh" },
    verdict: { kind: "blocked", feature: "headersHelper" },
  },
  {
    title: "ANAME-07: a truthy oauth.xaa blocks a remote server",
    server: { type: "sse", url: "x", oauth: { xaa: true } },
    verdict: { kind: "blocked", feature: "oauth.xaa" },
  },
  {
    title: "ANAME-07: a per-tool permission_policy blocks a remote server",
    server: {
      type: "http",
      url: "x",
      tools: [{ name: "read" }, { name: "drop", permission_policy: "always_deny" }],
    },
    verdict: { kind: "blocked", feature: "tools[].permission_policy" },
  },
  {
    title: "ANAME-07: a non-empty toolPermissions blocks a remote server",
    server: { type: "http", url: "x", toolPermissions: { drop: "blocked" } },
    verdict: { kind: "blocked", feature: "toolPermissions" },
  },
  {
    title: "ANAME-07: bareElicitationCapability true blocks a stdio server",
    server: { command: "node", bareElicitationCapability: true },
    verdict: { kind: "blocked", feature: "bareElicitationCapability" },
  },
  {
    title: "ANAME-07: bareElicitationCapability true blocks a remote server",
    server: { type: "http", url: "x", bareElicitationCapability: true },
    verdict: { kind: "blocked", feature: "bareElicitationCapability" },
  },
  {
    title: "ANAME-07: headersHelper wins over bareElicitationCapability in table order",
    server: { type: "http", url: "x", bareElicitationCapability: true, headersHelper: "./h.sh" },
    verdict: { kind: "blocked", feature: "headersHelper" },
  },
  {
    title: "ANAME-07: a per-tool policy wins over toolPermissions in table order",
    server: {
      type: "sse",
      url: "x",
      toolPermissions: { drop: "blocked" },
      tools: [{ name: "drop", permission_policy: "always_ask" }],
    },
    verdict: { kind: "blocked", feature: "tools[].permission_policy" },
  },
  {
    title: "AVAR-03: a command of exactly ~ blocks a stdio server",
    server: { command: "~" },
    verdict: { kind: "blocked", feature: "command ~" },
  },
  {
    title: "AVAR-03: a command starting with ~/ blocks a stdio server",
    server: { command: "~/bin/server" },
    verdict: { kind: "blocked", feature: "command ~" },
  },
  {
    title: "AVAR-03: a command starting with ~\\ blocks a stdio server",
    server: { command: "~\\bin\\server.exe" },
    verdict: { kind: "blocked", feature: "command ~" },
  },
  {
    title: "AVAR-03: a command starting with a reference whose default is ~ blocks a stdio server",
    server: { command: "${HOME_DIR:-~}/bin/x" },
    verdict: { kind: "blocked", feature: "command ~" },
  },
  {
    title:
      "AVAR-03: a command that is a reference whose default starts with ~/ blocks a stdio server",
    server: { command: "${X:-~/bin}" },
    verdict: { kind: "blocked", feature: "command ~" },
  },
  {
    title: "AVAR-03: an args element starting with ~/ blocks a stdio server",
    server: { command: "node", args: ["--x", "~/a"] },
    verdict: { kind: "blocked", feature: "args ~" },
  },
  {
    title:
      "AVAR-03: an args element that is a reference whose default starts with ~\\ blocks a stdio server",
    server: { command: "node", args: ["${X:-~\\a}"] },
    verdict: { kind: "blocked", feature: "args ~" },
  },
  {
    title: "AVAR-03: command ~ wins over args ~ in table order",
    server: { command: "~/a", args: ["~/b"] },
    verdict: { kind: "blocked", feature: "command ~" },
  },
  {
    title: "AVAR-03: args ~ wins over bareElicitationCapability in table order",
    server: { command: "node", args: ["~/a"], bareElicitationCapability: true },
    verdict: { kind: "blocked", feature: "args ~" },
  },
  {
    title: "AVAR-03: a command starting with ~user stays supported",
    server: { command: "~user/bin" },
    verdict: SUPPORTED,
  },
  {
    title: "AVAR-03: a ~/ that is not leading stays supported",
    server: { command: "node", args: ["a~/b"] },
    verdict: SUPPORTED,
  },
  {
    title: "AVAR-03: a ~/ after an empty default stays supported",
    server: { command: "node", args: ["${X:-}~/a"] },
    verdict: SUPPORTED,
  },
  {
    title: "AVAR-03: a leading reference with no default stays supported",
    server: { command: "${HOME}/bin/x" },
    verdict: SUPPORTED,
  },
  {
    title: "AVAR-03: a reference whose default is ~user stays supported",
    server: { command: "${X:-~user}" },
    verdict: SUPPORTED,
  },
  {
    title: "AVAR-03: a ~/ in a remote url or header stays supported",
    server: { type: "http", url: "https://h.test/~/x", headers: { A: "~/x" } },
    verdict: SUPPORTED,
  },
];

describe("classifyMcpServer", () => {
  for (const { title, server, verdict } of VERDICT_ROWS) {
    test(title, () => {
      // arrange
      const expectedVerdict = verdict;

      // act
      const classified = classifyMcpServer(server);

      // assert
      assert.deepStrictEqual(classified, expectedVerdict);
    });
  }
});
