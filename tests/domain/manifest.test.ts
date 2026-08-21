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

test("DFEN-01 PLUGIN_ENTRY accepts defaultEnabled false", () => {
  assert.equal(
    PLUGIN_ENTRY_VALIDATOR.Check({ name: "p", source: "./local", defaultEnabled: false }),
    true,
  );
});

test("DFEN-01 PLUGIN_ENTRY accepts defaultEnabled true", () => {
  assert.equal(
    PLUGIN_ENTRY_VALIDATOR.Check({ name: "p", source: "./local", defaultEnabled: true }),
    true,
  );
});

test("DFEN-01 PLUGIN_ENTRY accepts an unrelated unknown key alongside defaultEnabled", () => {
  // D-09: the entry schema tolerates keys it does not name. Adding a named
  // optional property must not narrow that -- a marketplace.json author can
  // still carry vendor keys the extension knows nothing about.
  assert.equal(
    PLUGIN_ENTRY_VALIDATOR.Check({
      name: "p",
      source: "./local",
      defaultEnabled: false,
      vendorSpecificTelemetryKnob: { sampleRate: 3 },
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

test("MCPR-01 PLUGIN_ENTRY accepts mcpServers as a string reference", () => {
  assert.equal(
    PLUGIN_ENTRY_VALIDATOR.Check({
      name: "p",
      source: "./local",
      mcpServers: "./x.mcp.json",
    }),
    true,
  );
});

test("MCPR-01 MARKETPLACE accepts an entry with a string mcpServers (no whole-manifest throw)", async () => {
  assert.equal(
    MARKETPLACE_VALIDATOR.Check({
      name: "mp",
      plugins: [{ name: "p1", source: "./local", mcpServers: "./x.mcp.json" }],
    }),
    true,
  );

  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-manifest-mcpref-"));
  try {
    const manifestPath = path.join(tmp, "marketplace.json");
    await writeFile(
      manifestPath,
      JSON.stringify({
        name: "mp",
        plugins: [{ name: "p1", source: "./p1", mcpServers: "./x.mcp.json" }],
      }),
      "utf8",
    );

    // Must NOT throw InvalidMarketplaceManifestError -- the string is legal input.
    const manifest = await loadMarketplaceManifest(manifestPath);
    assert.equal(manifest.plugins[0]?.mcpServers, "./x.mcp.json");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("MCPR-03 marketplace with a broken string-ref plugin + valid sibling loads without throwing", async () => {
  // A broken reference is a RESOLUTION-time defect isolated to one plugin; the
  // schema still accepts the string, so the whole-manifest load never throws
  // and the sibling entry survives intact.
  assert.equal(
    MARKETPLACE_VALIDATOR.Check({
      name: "mp",
      plugins: [
        { name: "broken", source: "./broken", mcpServers: "./does-not-exist.mcp.json" },
        { name: "sibling", source: "./sibling", mcpServers: { srv: { command: "node" } } },
      ],
    }),
    true,
  );

  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-manifest-sibling-"));
  try {
    const manifestPath = path.join(tmp, "marketplace.json");
    await writeFile(
      manifestPath,
      JSON.stringify({
        name: "mp",
        plugins: [
          { name: "broken", source: "./broken", mcpServers: "./does-not-exist.mcp.json" },
          { name: "sibling", source: "./sibling" },
        ],
      }),
      "utf8",
    );

    const manifest = await loadMarketplaceManifest(manifestPath);
    assert.equal(manifest.plugins.length, 2);
    assert.equal(manifest.plugins[1]?.name, "sibling");
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test("DFEN-01 one malformed defaultEnabled rejects the WHOLE marketplace.json", async () => {
  // Contrast with the MCPR-03 case above, which loads fine and keeps its
  // sibling: there the schema ACCEPTS the value and the defect surfaces later,
  // at resolution time, isolated to one plugin. Here the entry schema itself
  // rejects, and because it is validated as a member of the marketplace schema
  // there is no per-plugin skip to fall back to -- the valid sibling below does
  // NOT survive. DFEN-01 asks for a failure "the same way any other schema
  // violation does", so a non-boolean here behaves exactly as a non-string
  // `version` already would. Do not make this test behave like MCPR-03.
  const tmp = await mkdtemp(path.join(os.tmpdir(), "pi-cm-manifest-defaultenabled-"));
  try {
    const manifestPath = path.join(tmp, "marketplace.json");
    await writeFile(
      manifestPath,
      JSON.stringify({
        name: "mp",
        plugins: [
          { name: "bad", source: "./bad", defaultEnabled: "false" },
          { name: "sibling", source: "./sibling" },
        ],
      }),
      "utf8",
    );

    await assert.rejects(
      () => loadMarketplaceManifest(manifestPath),
      (err: unknown) => {
        assert.ok(
          err instanceof InvalidMarketplaceManifestError,
          "a non-boolean defaultEnabled must throw a typed InvalidMarketplaceManifestError",
        );
        assert.match(err.message, /marketplace\.json schema invalid/);
        assert.match(err.message, /\/plugins\/0\/defaultEnabled/);
        return true;
      },
    );
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
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

test("DFEN-01 PLUGIN_ENTRY rejects defaultEnabled as string", () => {
  assert.equal(
    PLUGIN_ENTRY_VALIDATOR.Check({ name: "p", source: "./local", defaultEnabled: "false" }),
    false,
  );
});

// `null` is the likelier authoring mistake than a string -- a template or a
// codegen step that emits every known key writes `null` for the ones it has no
// value for. `Type.Optional(Type.Boolean())` admits `undefined` and `boolean`
// only, so it is rejected exactly like any other wrong type.
test("DFEN-01 PLUGIN_ENTRY rejects defaultEnabled as null", () => {
  assert.equal(
    PLUGIN_ENTRY_VALIDATOR.Check({ name: "p", source: "./local", defaultEnabled: null }),
    false,
  );
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

test("MCPR-02 PLUGIN_MANIFEST accepts mcpServers as a string reference", () => {
  assert.equal(PLUGIN_MANIFEST_VALIDATOR.Check({ mcpServers: "./x.mcp.json" }), true);
});

test("DFEN-01 PLUGIN_MANIFEST accepts defaultEnabled false", () => {
  assert.equal(PLUGIN_MANIFEST_VALIDATOR.Check({ name: "p", defaultEnabled: false }), true);
});

test("DFEN-01 PLUGIN_MANIFEST accepts an unrelated unknown key alongside defaultEnabled", () => {
  // D-09 again, from the plugin.json side: a plugin author's own vendor keys
  // stay legal after the named optional property was added.
  assert.equal(
    PLUGIN_MANIFEST_VALIDATOR.Check({
      name: "p",
      defaultEnabled: true,
      vendorSpecificTelemetryKnob: { sampleRate: 3 },
    }),
    true,
  );
});

test("PLUGIN_MANIFEST rejects name as number", () => {
  assert.equal(PLUGIN_MANIFEST_VALIDATOR.Check({ name: 42 }), false);
});

test("DFEN-01 PLUGIN_MANIFEST rejects defaultEnabled as string", () => {
  assert.equal(PLUGIN_MANIFEST_VALIDATOR.Check({ name: "p", defaultEnabled: "false" }), false);
});

// The plugin.json side of the null case above. Rejection here downgrades that
// one plugin to `unavailable` with a `malformed plugin.json` note, rather than
// invalidating a whole marketplace.json as the entry-side rejection does.
test("DFEN-01 PLUGIN_MANIFEST rejects defaultEnabled as null", () => {
  assert.equal(PLUGIN_MANIFEST_VALIDATOR.Check({ name: "p", defaultEnabled: null }), false);
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
