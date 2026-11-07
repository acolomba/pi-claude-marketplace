import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { readMcpJsonServerNamespaces } from "../../../extensions/pi-claude-marketplace/bridges/mcp/builtin-overrides.ts";
import { captureDebugLog } from "../../platform/debug-log-capture.ts";

import type { TestContext } from "node:test";

async function caseDirectory(t: TestContext): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "builtin-overrides-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

/** Writes `text` to `name` in `directory` and returns the file's path. */
async function mcpJson(directory: string, name: string, text: string): Promise<string> {
  const file = path.join(directory, name);
  await writeFile(file, text);
  return file;
}

const NOT_JSON = "[mcp] mcp.json servers not read: the file is not valid JSON";

for (const { label, text, lines } of [
  { label: "an empty file", text: "", lines: [NOT_JSON] },
  { label: "invalid JSON", text: "{ mcpServers: ", lines: [NOT_JSON] },
  {
    label: "a JSON file with comments",
    text: '// servers\n{"mcpServers":{"a":{"url":"x"}}}',
    lines: [NOT_JSON],
  },
  { label: "a top level that is an array", text: '[{"mcpServers":{"a":{"url":"x"}}}]', lines: [] },
  { label: "a top level that is null", text: "null", lines: [] },
  { label: "a file with no mcpServers", text: '{"mcp-servers":{"a":{"url":"x"}}}', lines: [] },
  { label: "an mcpServers that is an array", text: '{"mcpServers":[{"url":"x"}]}', lines: [] },
  { label: "an mcpServers that is null", text: '{"mcpServers":null}', lines: [] },
] as const) {
  test(`BLT-04 / P2-DC-15: ${label} configures no server and logs ${lines.length} line(s)`, async (t) => {
    // arrange
    const logged = captureDebugLog(t);
    const file = await mcpJson(await caseDirectory(t), "mcp.json", text);

    // act
    const namespaces = readMcpJsonServerNamespaces([file]);

    // assert
    assert.deepStrictEqual(namespaces, new Set());
    assert.deepStrictEqual(logged, lines);
  });
}

test("T-02-18: an mcp.json whose text holds a credential logs no part of it", async (t) => {
  // arrange
  const logged = captureDebugLog(t);
  const file = await mcpJson(
    await caseDirectory(t),
    "mcp.json",
    '{"mcpServers": {"api": {"headers": {"Authorization": secret-token-123}}}}',
  );

  // act
  const namespaces = readMcpJsonServerNamespaces([file]);

  // assert
  assert.deepStrictEqual(namespaces, new Set());
  assert.deepStrictEqual(logged, [NOT_JSON]);
});

test("BLT-04: an absent file configures no server and logs nothing", async (t) => {
  // arrange
  const logged = captureDebugLog(t);
  const file = path.join(await caseDirectory(t), "mcp.json");

  // act
  const namespaces = readMcpJsonServerNamespaces([file]);

  // assert
  assert.deepStrictEqual(namespaces, new Set());
  assert.deepStrictEqual(logged, []);
});

test("BLT-04 / T-02-18: a file that cannot be read as a file configures no server and is logged", async (t) => {
  // arrange
  const logged = captureDebugLog(t);
  const file = path.join(await caseDirectory(t), "mcp.json");
  await mkdir(file);

  // act
  const namespaces = readMcpJsonServerNamespaces([file]);

  // assert
  assert.deepStrictEqual(namespaces, new Set());
  assert.deepStrictEqual(logged, [
    "[mcp] mcp.json servers not read: EISDIR: illegal operation on a directory, read",
  ]);
});

test("BLT-04 / P2-DC-15: an entry counts when it is an object with a string command or url", async (t) => {
  // arrange
  const logged = captureDebugLog(t);
  const file = await mcpJson(
    await caseDirectory(t),
    "mcp.json",
    JSON.stringify({
      mcpServers: {
        local: { command: "node", args: ["server.js"] },
        remote: { url: "https://example.com/mcp" },
        "only-enabled": { enabled: false },
        "only-type": { type: "http" },
        "number-command": { command: 7 },
        "array-entry": [{ command: "node" }],
        "null-entry": null,
        "string-entry": "node",
      },
    }),
  );

  // act
  const namespaces = readMcpJsonServerNamespaces([file]);

  // assert
  assert.deepStrictEqual(namespaces, new Set(["local", "remote"]));
  assert.deepStrictEqual(logged, []);
});

test("BLT-04: a server name has every - folded to _", async (t) => {
  // arrange
  const logged = captureDebugLog(t);
  const file = await mcpJson(
    await caseDirectory(t),
    "mcp.json",
    JSON.stringify({ mcpServers: { "plugin_my-plugin_my-api": { command: "node" } } }),
  );

  // act
  const namespaces = readMcpJsonServerNamespaces([file]);

  // assert
  assert.deepStrictEqual(namespaces, new Set(["plugin_my_plugin_my_api"]));
  assert.deepStrictEqual(logged, []);
});

test("BLT-04 / P2-DC-15: a leading byte order mark is stripped before the parse", async (t) => {
  // arrange
  const logged = captureDebugLog(t);
  const file = await mcpJson(
    await caseDirectory(t),
    "mcp.json",
    `${String.fromCodePoint(0xfeff)}${JSON.stringify({ mcpServers: { docs: { url: "https://example.com/mcp" } } })}`,
  );

  // act
  const namespaces = readMcpJsonServerNamespaces([file]);

  // assert
  assert.deepStrictEqual(namespaces, new Set(["docs"]));
  assert.deepStrictEqual(logged, []);
});

test("BLT-04: the names of every given file are merged, and a bad file adds nothing", async (t) => {
  // arrange
  const logged = captureDebugLog(t);
  const directory = await caseDirectory(t);
  const user = await mcpJson(
    directory,
    "user.json",
    JSON.stringify({ mcpServers: { shared: { command: "a" }, "user-only": { command: "b" } } }),
  );
  const broken = await mcpJson(directory, "broken.json", "{");
  const project = await mcpJson(
    directory,
    "project.json",
    JSON.stringify({
      mcpServers: { shared: { url: "https://example.com" }, project: { url: "p" } },
    }),
  );

  // act
  const namespaces = readMcpJsonServerNamespaces([user, broken, project]);

  // assert
  assert.deepStrictEqual(namespaces, new Set(["shared", "user_only", "project"]));
  assert.deepStrictEqual(logged, [NOT_JSON]);
});

test("BLT-04: no file configures no server", () => {
  // arrange
  const files: readonly string[] = [];

  // act
  const namespaces = readMcpJsonServerNamespaces(files);

  // assert
  assert.deepStrictEqual(namespaces, new Set());
});
