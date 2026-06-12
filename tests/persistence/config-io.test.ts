import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CONFIG_VALIDATOR,
  type ConfigLoadResult,
  type ScopeConfig,
  loadConfig,
  saveConfig,
} from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";

/**
 * CFG-01 (typebox-validated load/save round-trip) + CFG-03 (absent/invalid/valid
 * trichotomy; 0-byte file is invalid, NOT valid-with-empty-defaults) + SPLIT-02
 * write-site containment (saveConfig refuses paths escaping scopeRoot).
 *
 * Mirrors `tests/persistence/state-io.test.ts` for scaffolding:
 * isolated tmp scopeRoot per test, retry-cleanup loop, no shared fixtures.
 *
 * A 0-byte `claude-plugins.json` MUST land in the
 * `invalid` arm, never `valid` with empty desired state. The renderer that
 * encoded the violation as GREEN at v1.10/v1.11 must not recur here.
 */

async function tmpScopeRoot(): Promise<{ scopeRoot: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-cm-config-test-"));
  const scopeRoot = path.join(dir, ".pi");
  await mkdir(scopeRoot, { recursive: true });
  // Cleanup retries with a short sleep -- mirrors state-io.test.ts to absorb
  // any racing background persists; this seam has no fire-and-forget persist
  // but the convention is cheap and forward-compatible.
  const cleanup = async (): Promise<void> => {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await rm(dir, { recursive: true, force: true });
        return;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOTEMPTY" && attempt < 9) {
          await new Promise<void>((resolve) => setTimeout(resolve, 25));
          continue;
        }

        throw err;
      }
    }
  };

  return { scopeRoot, cleanup };
}

// ──────────────────────────────────────────────────────────────────────────
// A. loadConfig trichotomy (CFG-03 / D-15)
// ──────────────────────────────────────────────────────────────────────────

test("CFG-03 loadConfig on missing file returns { status: 'absent' }", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const got: ConfigLoadResult = await loadConfig(filePath);
    assert.equal(got.status, "absent");
  } finally {
    await cleanup();
  }
});

test("CFG-03: loadConfig on 0-byte file lands in 'invalid' (never 'valid' with empty config)", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await writeFile(filePath, "");
    const got = await loadConfig(filePath);
    assert.equal(got.status, "invalid");
    if (got.status === "invalid") {
      assert.equal(got.filePath, filePath);
      assert.match(got.error, /JSON parse|Unexpected end of JSON input/);
    }
  } finally {
    await cleanup();
  }
});

test("CFG-03 loadConfig on malformed JSON returns 'invalid' with JSON parse error", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await writeFile(filePath, "{not json");
    const got = await loadConfig(filePath);
    assert.equal(got.status, "invalid");
    if (got.status === "invalid") {
      assert.match(got.error, /JSON parse/);
    }
  } finally {
    await cleanup();
  }
});

test("CFG-03 loadConfig on JSON-valid but schema-invalid (marketplaces: string) returns 'invalid'", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await writeFile(filePath, JSON.stringify({ marketplaces: "not an object" }));
    const got = await loadConfig(filePath);
    assert.equal(got.status, "invalid");
    if (got.status === "invalid") {
      assert.match(got.error, /schema/i);
    }
  } finally {
    await cleanup();
  }
});

test("D-11 loadConfig with schemaVersion: 2 lands in 'invalid' (only literal 1 accepted)", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await writeFile(filePath, JSON.stringify({ schemaVersion: 2 }));
    const got = await loadConfig(filePath);
    assert.equal(got.status, "invalid");
  } finally {
    await cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// B. loadConfig valid cases (CFG-01)
// ──────────────────────────────────────────────────────────────────────────

test("CFG-01 / D-05 loadConfig on minimal-valid {} returns 'valid' with undefined records", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await writeFile(filePath, "{}");
    const got = await loadConfig(filePath);
    assert.equal(got.status, "valid");
    if (got.status === "valid") {
      assert.equal(got.filePath, filePath);
      assert.equal(got.config.marketplaces, undefined);
      assert.equal(got.config.plugins, undefined);
    }
  } finally {
    await cleanup();
  }
});

test("CFG-01 / D-04 loadConfig on CONTEXT specifics example (autoupdate/enabled undefined at load)", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const example = {
      marketplaces: { "acme-tools": { source: "acme/claude-tools" } },
      plugins: { "code-reviewer@acme-tools": {} },
    };
    await writeFile(filePath, JSON.stringify(example));
    const got = await loadConfig(filePath);
    assert.equal(got.status, "valid");
    if (got.status === "valid") {
      assert.equal(got.config.marketplaces?.["acme-tools"]?.source, "acme/claude-tools");
      // D-04: defaults applied at consume time, NOT at load. autoupdate/enabled
      // are absent in the file and remain `undefined` after load.
      assert.equal(got.config.marketplaces?.["acme-tools"]?.autoupdate, undefined);
      assert.equal(got.config.plugins?.["code-reviewer@acme-tools"]?.enabled, undefined);
    }
  } finally {
    await cleanup();
  }
});

test("D-09 loadConfig accepts unknown top-level keys (lenient)", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await writeFile(filePath, JSON.stringify({ marketplaces: {}, typo: 1, future_field: "x" }));
    const got = await loadConfig(filePath);
    assert.equal(got.status, "valid");
  } finally {
    await cleanup();
  }
});

test("D-09 loadConfig accepts unknown entry-level fields (lenient)", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const withExtras = {
      marketplaces: {
        mp: { source: "a/b", futureField: "x", extraTag: true },
      },
      plugins: {
        "p@mp": { enabled: true, futureField: 42 },
      },
    };
    await writeFile(filePath, JSON.stringify(withExtras));
    const got = await loadConfig(filePath);
    assert.equal(got.status, "valid");
  } finally {
    await cleanup();
  }
});

test("D-11 loadConfig accepts explicit schemaVersion: 1", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    await writeFile(filePath, JSON.stringify({ schemaVersion: 1, marketplaces: {} }));
    const got = await loadConfig(filePath);
    assert.equal(got.status, "valid");
  } finally {
    await cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// C. saveConfig round-trip (CFG-01)
// ──────────────────────────────────────────────────────────────────────────

test("CFG-01 saveConfig + loadConfig round-trip preserves shape", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const config: ScopeConfig = {
      schemaVersion: 1,
      marketplaces: {
        "acme-tools": { source: "acme/claude-tools", autoupdate: true },
      },
      plugins: {
        "code-reviewer@acme-tools": { enabled: true },
      },
    };
    await saveConfig(filePath, config, scopeRoot);
    const onDisk = await readFile(filePath, "utf8");
    // Byte-stable round-trip modulo trailing "\n" (atomicWriteJson appends one).
    assert.equal(onDisk, JSON.stringify(config, null, 2) + "\n");

    const reloaded = await loadConfig(filePath);
    assert.equal(reloaded.status, "valid");
    if (reloaded.status === "valid") {
      assert.deepEqual(reloaded.config, config);
    }
  } finally {
    await cleanup();
  }
});

test("CFG-01 saveConfig refuses in-memory value that fails schema validation", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    // marketplaces value is a string, not a Record -- schema-invalid.
    const bad = { marketplaces: "not an object" };
    await assert.rejects(
      () => saveConfig(filePath, bad as unknown as ScopeConfig, scopeRoot),
      /saveConfig refused/,
    );
  } finally {
    await cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// D. saveConfig NFR-10 containment (SPLIT-02 write-site)
// ──────────────────────────────────────────────────────────────────────────

test("NFR-10 / SPLIT-02 saveConfig refuses filePath that escapes scopeRoot", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    // Construct an escapingPath that climbs above scopeRoot:
    //   scopeRoot   = <tmpdir>/<scope>
    //   escapingPath = <tmpdir>/<scope>/../elsewhere/claude-plugins.json
    // path.relative(scopeRoot, escapingPath) starts with "..".
    const escapingPath = path.join(scopeRoot, "..", "elsewhere", "claude-plugins.json");
    const validConfig: ScopeConfig = { schemaVersion: 1, marketplaces: {} };
    await assert.rejects(() => saveConfig(escapingPath, validConfig, scopeRoot), /escapes/);
  } finally {
    await cleanup();
  }
});

test("NFR-10 saveConfig succeeds when filePath is inside scopeRoot", async () => {
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    const config: ScopeConfig = { schemaVersion: 1 };
    await saveConfig(filePath, config, scopeRoot);
    // Verify it actually wrote.
    const raw = await readFile(filePath, "utf8");
    assert.equal(raw, JSON.stringify(config, null, 2) + "\n");
  } finally {
    await cleanup();
  }
});

// ──────────────────────────────────────────────────────────────────────────
// CONFIG_VALIDATOR exported as a JIT-compiled typebox validator (D-07 mirror).
// ──────────────────────────────────────────────────────────────────────────

test("CONFIG_VALIDATOR exports a JIT-compiled validator (D-07 mirror)", () => {
  assert.equal(typeof CONFIG_VALIDATOR.Check, "function");
  assert.equal(CONFIG_VALIDATOR.Check({}), true);
  assert.equal(CONFIG_VALIDATOR.Check({ schemaVersion: 1 }), true);
  assert.equal(CONFIG_VALIDATOR.Check({ schemaVersion: 2 }), false);
  assert.equal(CONFIG_VALIDATOR.Check({ marketplaces: "x" }), false);
});

test("T6 / PR #51 / CFG-03: loadConfig non-ENOENT read-failure arm (EISDIR) returns 'invalid' with a `read failed:` error -- portable via a DIRECTORY named claude-plugins.json", async () => {
  // Pre-T6 the loadConfig non-ENOENT read-failure arm at
  // config-io.ts:128-133 (the `catch` that returns `invalid` with a
  // `read failed: <message>` error string for any non-ENOENT readFile
  // error) had no test hit. The portable way to drive it without chmod
  // tricks is to create a DIRECTORY at the target path: Node's readFile
  // against a directory throws EISDIR with `.code === "EISDIR"`, which is
  // non-ENOENT and so routes through the read-failure arm rather than the
  // `absent` arm. (chmod 0o000 is not portable on root-owned CI tmpdirs;
  // EISDIR works on every platform we ship to.)
  const { scopeRoot, cleanup } = await tmpScopeRoot();
  try {
    const filePath = path.join(scopeRoot, "claude-plugins.json");
    // Directory at the target path -- readFile against it throws EISDIR
    // (verified: Node 22.x consistently surfaces err.code === "EISDIR").
    await mkdir(filePath, { recursive: true });
    const got = await loadConfig(filePath);
    assert.equal(got.status, "invalid");
    if (got.status === "invalid") {
      assert.equal(got.filePath, filePath);
      // The read-failure arm prefixes the underlying message with
      // `read failed:` -- this distinguishes it from the JSON-parse arm
      // (`JSON parse failed:`) and the schema-validation arm
      // (`schema validation failed:`).
      assert.match(
        got.error,
        /^read failed: /,
        `T6: expected the read-failure arm prefix; got error=${got.error}`,
      );
      // EISDIR is the underlying Node error -- pin it explicitly so a
      // future refactor that swallows the cause stringification trips this
      // test instead of silently flattening the diagnostic.
      assert.match(
        got.error,
        /EISDIR/,
        `T6: expected EISDIR in the cause text; got error=${got.error}`,
      );
    }
  } finally {
    await cleanup();
  }
});
