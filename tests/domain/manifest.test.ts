import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { MCP_SERVERS_VALIDATOR } from "../../extensions/pi-claude-marketplace/domain/components/mcp.ts";
import {
  PLUGIN_ENTRY_VALIDATOR,
  PLUGIN_MANIFEST_VALIDATOR,
} from "../../extensions/pi-claude-marketplace/domain/components/plugin.ts";
import {
  loadMarketplaceManifest,
  MARKETPLACE_VALIDATOR,
} from "../../extensions/pi-claude-marketplace/domain/manifest.ts";
import { InvalidMarketplaceManifestError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

// ──────────────────────────────────────────────────────────────────────────
// MM-1: MARKETPLACE_SCHEMA accept matrix
// ──────────────────────────────────────────────────────────────────────────

test("MM-1 MARKETPLACE accepts minimal {name, plugins:[]}", () => {
  assert.equal(MARKETPLACE_VALIDATOR.Check({ name: "test", plugins: [] }), true);
});

test("MM-1 MARKETPLACE accepts full shape with strict + owner", () => {
  assert.equal(
    MARKETPLACE_VALIDATOR.Check({
      name: "test",
      plugins: [],
      strict: true,
      owner: { name: "Alice" },
    }),
    true,
  );
});

test("MM-1 MARKETPLACE accepts strict=false", () => {
  assert.equal(MARKETPLACE_VALIDATOR.Check({ name: "x", plugins: [], strict: false }), true);
});

test("MM-1 MARKETPLACE accepts plugins[] populated with valid entries", () => {
  assert.equal(
    MARKETPLACE_VALIDATOR.Check({
      name: "x",
      plugins: [
        { name: "p1", source: "./local" },
        { name: "p2", source: "owner/repo" },
      ],
    }),
    true,
  );
});

test("MM-1 MARKETPLACE rejects missing name", () => {
  assert.equal(MARKETPLACE_VALIDATOR.Check({ plugins: [] }), false);
});

test("MM-1 MARKETPLACE rejects missing plugins", () => {
  assert.equal(MARKETPLACE_VALIDATOR.Check({ name: "x" }), false);
});

test("MM-1 MARKETPLACE rejects name as number", () => {
  assert.equal(MARKETPLACE_VALIDATOR.Check({ name: 42, plugins: [] }), false);
});

test("MM-1 MARKETPLACE rejects plugins as object", () => {
  assert.equal(MARKETPLACE_VALIDATOR.Check({ name: "x", plugins: {} }), false);
});

test("MM-1 MARKETPLACE rejects plugins as null", () => {
  assert.equal(MARKETPLACE_VALIDATOR.Check({ name: "x", plugins: null }), false);
});

test("NFR-8 loadMarketplaceManifest reads and validates marketplace.json through the domain seam", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-manifest-"));
  try {
    const manifestPath = path.join(tmp, "marketplace.json");
    await writeFile(
      manifestPath,
      JSON.stringify({ name: "test-marketplace", plugins: [{ name: "p", source: "./p" }] }),
      "utf8",
    );

    const manifest = await loadMarketplaceManifest(manifestPath);

    assert.equal(manifest.name, "test-marketplace");
    assert.equal(manifest.plugins[0]?.name, "p");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("D-48-B loadMarketplaceManifest throws InvalidMarketplaceManifestError on schema-invalid marketplace.json", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-manifest-invalid-"));
  try {
    const manifestPath = path.join(tmp, "marketplace.json");
    await writeFile(manifestPath, JSON.stringify({ name: "missing-plugins" }), "utf8");

    await assert.rejects(
      () => loadMarketplaceManifest(manifestPath),
      (err: unknown) => {
        assert.ok(
          err instanceof InvalidMarketplaceManifestError,
          "schema-invalid manifest must throw a typed InvalidMarketplaceManifestError",
        );
        assert.match(err.message, /marketplace\.json schema invalid/);
        return true;
      },
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("D-48-B loadMarketplaceManifest throws InvalidMarketplaceManifestError on malformed JSON (carries SyntaxError cause)", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-manifest-malformed-"));
  try {
    const manifestPath = path.join(tmp, "marketplace.json");
    await writeFile(manifestPath, "{ this is not json", "utf8");

    await assert.rejects(
      () => loadMarketplaceManifest(manifestPath),
      (err: unknown) => {
        assert.ok(
          err instanceof InvalidMarketplaceManifestError,
          "malformed JSON must throw a typed InvalidMarketplaceManifestError",
        );
        assert.ok(err.cause instanceof SyntaxError, "the original SyntaxError survives as cause");
        return true;
      },
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

// ──────────────────────────────────────────────────────────────────────────
// MM-2: PLUGIN_ENTRY_SCHEMA accept matrix
// ──────────────────────────────────────────────────────────────────────────

test("MM-2 PLUGIN_ENTRY accepts minimal {name, source}", () => {
  assert.equal(PLUGIN_ENTRY_VALIDATOR.Check({ name: "p", source: "./local" }), true);
});

test("MM-2 PLUGIN_ENTRY accepts source as object (resolver classifies)", () => {
  assert.equal(
    PLUGIN_ENTRY_VALIDATOR.Check({ name: "p", source: { type: "github", repo: "o/r" } }),
    true,
  );
});

test("MM-2 PLUGIN_ENTRY accepts metadata fields", () => {
  assert.equal(
    PLUGIN_ENTRY_VALIDATOR.Check({
      name: "p",
      source: "./local",
      description: "desc",
      version: "1.0.0",
    }),
    true,
  );
});

test("MM-2 PLUGIN_ENTRY accepts opaque unsupported components", () => {
  assert.equal(
    PLUGIN_ENTRY_VALIDATOR.Check({
      name: "p",
      source: "./local",
      hooks: { someHook: { command: "x" } },
      themes: ["dark"],
      settings: { foo: "bar" },
    }),
    true,
  );
});

test("MM-2 PLUGIN_ENTRY accepts opaque dependencies (PI-13)", () => {
  assert.equal(
    PLUGIN_ENTRY_VALIDATOR.Check({
      name: "p",
      source: "./local",
      dependencies: { other: "1.0" },
    }),
    true,
  );
});

test("MM-2 PLUGIN_ENTRY accepts mcpServers map", () => {
  assert.equal(
    PLUGIN_ENTRY_VALIDATOR.Check({
      name: "p",
      source: "./local",
      mcpServers: { srv1: { command: "node" } },
    }),
    true,
  );
});

test("MM-2 PLUGIN_ENTRY rejects missing name", () => {
  assert.equal(PLUGIN_ENTRY_VALIDATOR.Check({ source: "./local" }), false);
});

test("MM-2 PLUGIN_ENTRY rejects missing source", () => {
  assert.equal(PLUGIN_ENTRY_VALIDATOR.Check({ name: "p" }), false);
});

test("MM-2 PLUGIN_ENTRY rejects name as number", () => {
  assert.equal(PLUGIN_ENTRY_VALIDATOR.Check({ name: 1, source: "./local" }), false);
});

// ──────────────────────────────────────────────────────────────────────────
// PLUGIN_MANIFEST_SCHEMA (standalone plugin.json)
// ──────────────────────────────────────────────────────────────────────────

test("PLUGIN_MANIFEST accepts empty object", () => {
  assert.equal(PLUGIN_MANIFEST_VALIDATOR.Check({}), true);
});

test("PLUGIN_MANIFEST accepts full shape", () => {
  assert.equal(
    PLUGIN_MANIFEST_VALIDATOR.Check({
      name: "p",
      version: "1.0.0",
      description: "x",
      mcpServers: { srv: {} },
      hooks: { a: 1 },
      dependencies: { other: "1.0" },
    }),
    true,
  );
});

test("PLUGIN_MANIFEST rejects name as number", () => {
  assert.equal(PLUGIN_MANIFEST_VALIDATOR.Check({ name: 42 }), false);
});

// ──────────────────────────────────────────────────────────────────────────
// MCP_SERVERS_SCHEMA
// ──────────────────────────────────────────────────────────────────────────

test("MCP_SERVERS accepts empty object", () => {
  assert.equal(MCP_SERVERS_VALIDATOR.Check({}), true);
});

test("MCP_SERVERS accepts populated map", () => {
  assert.equal(
    MCP_SERVERS_VALIDATOR.Check({
      srv1: { command: "node", args: ["server.js"] },
      srv2: { command: "python" },
    }),
    true,
  );
});

test("MCP_SERVERS rejects array", () => {
  assert.equal(MCP_SERVERS_VALIDATOR.Check([]), false);
});

test("MCP_SERVERS rejects null", () => {
  assert.equal(MCP_SERVERS_VALIDATOR.Check(null), false);
});
