// Strict-mode resolver coverage. 1:1 mapping between PR-2 cases and tests
// (9 tests for the 9 cases). Plus PR-3 multi, PR-4 implicit-by-convention
// (positive + negative), PR-5 dependencies, PR-6 requireInstallable
// narrowing/throwing, and one MM-5 happy path.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  type GitPluginRootResult,
  type ResolveContext,
  type ResolvedPlugin,
  requirePartialInstallable,
  requireInstallable,
  resolveStrict,
} from "../../extensions/pi-claude-marketplace/domain/resolver.ts";
import { PluginShapeError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { PluginEntry } from "../../extensions/pi-claude-marketplace/domain/components/plugin.ts";

/**
 * Build an in-memory ResolveContext. `files` maps absolute paths to either:
 *   - "dir"           -> directory exists
 *   - "file"          -> file exists, but readFileText is not stubbed (will throw)
 *   - { contents: s } -> file exists with given contents
 * Anything not in the map -> null (does not exist).
 */
function mockCtx(
  marketplaceRoot: string,
  files: Record<string, "dir" | "file" | { contents: string }>,
): ResolveContext {
  return {
    marketplaceRoot,
    statKind(p: string): Promise<"file" | "dir" | null> {
      const v = files[p];

      if (v === undefined) {
        return Promise.resolve(null);
      }

      if (v === "dir") {
        return Promise.resolve("dir");
      }

      return Promise.resolve("file");
    },
    readFileText(p: string): Promise<string> {
      const v = files[p];

      if (v && typeof v === "object" && "contents" in v) {
        return Promise.resolve(v.contents);
      }

      return Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    },
  };
}

const MP = "/abs/marketplace";
const ROOT = (rel: string): string => path.resolve(MP, rel);

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Load a `tests/fixtures/<name>.json` payload as a raw string. */
function fixture(name: string): Promise<string> {
  return readFile(path.resolve(FIXTURE_DIR, "../fixtures", `${name}.json`), "utf8");
}

/**
 * Test entries are intentionally typed as `Record<string, unknown>` (the third-party
 * boundary -- a marketplace.json author can put any garbage here). The resolver's
 * job is to classify it; tests must therefore be free to construct shapes that
 * violate PluginEntry's type. We assert-cast at the resolver boundary.
 */
type LooseEntry = Record<string, unknown>;

function basicEntry(over: LooseEntry = {}): PluginEntry {
  return { name: "p1", source: "./local", ...over };
}

// ──────────────────────────────────────────────────────────────────────────
// PR-2: nine non-installable cases (1 test per case)
// ──────────────────────────────────────────────────────────────────────────

// PURL-01: a github source is no longer rejected as an unsupported kind. With
// NO resolveGitPluginRoot injected (the pure path-only caller), it resolves
// `unavailable` because git sources require a clone-cache resolver -- the
// path-only back-compat arm, NOT the old "unsupported source kind" rejection.
test("PR-2(1) github source with no clone resolver -> unavailable (requires clone resolver)", async () => {
  const ctx = mockCtx(MP, {});
  const r = await resolveStrict(basicEntry({ source: "owner/repo" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("clone")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

// PURL-01: same for an object-form url source -- no longer "unsupported source
// kind: url"; without an injected callback it needs a clone resolver.
test("PR-2(1) url source with no clone resolver -> unavailable (requires clone resolver)", async () => {
  const ctx = mockCtx(MP, {});
  const r = await resolveStrict(
    basicEntry({ source: { source: "url", url: "https://gitlab.com/obra/superpowers.git" } }),
    ctx,
  );
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("clone")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("PR-2(2) source path escape -> notInstallable", async () => {
  const ctx = mockCtx(MP, {});
  const r = await resolveStrict(basicEntry({ source: "../escape" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("escapes marketplace root")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("PR-2(3) source dir does not exist -> notInstallable", async () => {
  const ctx = mockCtx(MP, {}); // no entries -> statKind returns null
  const r = await resolveStrict(basicEntry({ source: "./missing" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("source dir does not exist")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("PR-2(4) malformed plugin.json -> notInstallable", async () => {
  const ctx = mockCtx(MP, {
    [ROOT("./local")]: "dir",
    [path.join(ROOT("./local"), ".claude-plugin", "plugin.json")]: { contents: "{ not json" },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("malformed plugin.json")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

// HOOK-01: hooks moved from UNSUPPORTED to SUPPORTED. A plugin declaring
// `hooks` at the entry level with NO hooks/hooks.json on disk is no longer
// rejected with "contains hooks" -- the resolver only owns convention-file
// discovery; entry/manifest-level hooks-field semantics are deferred to
// future dispatch work.
test("HOOK-01: entry declares hooks field but no hooks/hooks.json on disk -> installable WITHOUT hooks in supported", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(basicEntry({ source: "./local", hooks: { onLoad: "x" } }), ctx);
  assert.equal(r.state, "installable", `notes if not installable: ${r.notes.join(" / ")}`);

  if (r.state === "installable") {
    assert.ok(!r.supported.includes("hooks"));
    assert.ok(
      !r.notes.some((n) => n.includes("contains hooks")),
      `notes must no longer contain "contains hooks": ${r.notes.join(" / ")}`,
    );
  }
});

// HOOK-01 / D-57-04: a parseable hooks/hooks.json on disk admits the plugin
// with hooks added to the supported set (mirrors the supported-side
// implicit-by-convention pattern used for skills/commands/agents).
test("HOOK-01: hooks/hooks.json present + parseable -> installable WITH hooks in supported", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] }],
      }),
    },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes if not installable: ${r.notes.join(" / ")}`);

  if (r.state === "installable") {
    assert.ok(r.supported.includes("hooks"));
    assert.ok(
      !r.notes.some((n) => n.includes("contains hooks")),
      `notes must no longer contain "contains hooks": ${r.notes.join(" / ")}`,
    );
  }
});

// D-57-04: structurally-malformed hooks/hooks.json flips installable: false
// with the parse-failure detail surfaced in notes.
test("D-57-04: hooks/hooks.json present + parse-fails -> notInstallable + parse-detail note", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: { contents: "not-valid-json" },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("malformed hooks.json") || n.includes("hooks.json")),
    `notes must mention hooks.json parse failure: ${r.notes.join(" / ")}`,
  );
});

// D-57-04 parse-fail second arm: structurally-malformed JSON (valid syntax,
// wrong shape per HOOKS_VALIDATOR) also flips installable: false.
test("D-57-04: hooks/hooks.json with structural-shape mismatch -> notInstallable", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    // Top-level value not an array -> HOOKS_VALIDATOR rejects.
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({ PreToolUse: "not-an-array" }),
    },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("hooks.json")),
    `notes must mention hooks.json: ${r.notes.join(" / ")}`,
  );
});

// PHOOK-02 / D-71-03: a hooks.json that PARSES but drops a non-bucket-A
// event (here `Stop`) while keeping a supported group resolves the
// force-degradable `unsupported` arm, NOT `unavailable`. The kept group still
// materializes (hooksConfigPath recorded, `"hooks"` in supported) and the
// dropped `Stop` is enumerated in droppedHooks. `"hooks"` is intentionally a
// member of BOTH supported and unsupported (dual membership).
test("PHOOK-02 / D-71-03: hooks.json with a kept group + dropped Stop event -> unsupported", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: await fixture("hooks-posttooluse-and-stop"),
    },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "partially-available", `notes: ${r.notes.join(" / ")}`);

  if (r.state === "partially-available") {
    assert.ok(r.unsupported.includes("hooks"), `unsupported: ${r.unsupported.join(" / ")}`);
    assert.ok(r.supported.includes("hooks"), `supported: ${r.supported.join(" / ")}`);
    assert.equal(r.hooksConfigPath, path.join("hooks", "hooks.json"));
    assert.deepEqual(r.droppedHooks, [{ kind: "event", event: "Stop" }]);
  }
});

// D-71-02 / PHOOK-02: an intra-event matcher mix keeps the clean group and
// drops only the unsupportable (regex) group. The event survives partially:
// `unsupported` with hooksConfigPath recorded and the regex group enumerated.
test("D-71-02: intra-event matcher mix keeps the clean group, drops the regex group -> unsupported", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: await fixture("hooks-pretooluse-matcher-mix"),
    },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "partially-available", `notes: ${r.notes.join(" / ")}`);

  if (r.state === "partially-available") {
    assert.ok(r.unsupported.includes("hooks"), `unsupported: ${r.unsupported.join(" / ")}`);
    assert.ok(r.supported.includes("hooks"), `supported: ${r.supported.join(" / ")}`);
    assert.equal(r.hooksConfigPath, path.join("hooks", "hooks.json"));
    assert.deepEqual(r.droppedHooks, [
      { kind: "group", event: "PreToolUse", matcher: ".*", cond: "regex" },
    ]);
  }
});

// D-71-03 / Q2: a Stop-only config filters to the EMPTY subset. It still
// resolves `unsupported` (droppedHooks recorded) but stages nothing: no
// hooksConfigPath and `"hooks"` is absent from supported (mirrors the
// LSP-only precedent where force installs nothing).
test("D-71-03 / Q2: Stop-only config (empty subset) -> unsupported, no hooksConfigPath, hooks absent from supported", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: await fixture("hooks-stop-only"),
    },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "partially-available", `notes: ${r.notes.join(" / ")}`);

  if (r.state === "partially-available") {
    assert.ok(r.unsupported.includes("hooks"), `unsupported: ${r.unsupported.join(" / ")}`);
    assert.ok(
      !r.supported.includes("hooks"),
      `supported must omit hooks: ${r.supported.join(" / ")}`,
    );
    assert.equal(r.hooksConfigPath, undefined);
    assert.deepEqual(r.droppedHooks, [{ kind: "event", event: "Stop" }]);
  }
});

// WR-02 (D-58 review): an I/O failure reading hooks/hooks.json
// PROPAGATES out of resolveStrict instead of being wrapped with the
// `malformed hooks.json:` prefix and lumped into the `{unsupported hooks}`
// bucket. The outer `narrowProbeError` ladder (used by list / info)
// classifies the thrown error by `.code` so the row reports the truthful
// failure class (e.g. `{permission denied}` for EACCES).
test("WR-02: hooks/hooks.json EACCES propagates out of resolveStrict (not wrapped as malformed)", async () => {
  const localRoot = ROOT("./local");
  const hooksPath = path.join(localRoot, "hooks", "hooks.json");
  // Custom context: statKind reports the file exists, readFileText
  // throws EACCES (the file is readable to stat but not to read).
  const ctx: ResolveContext = {
    marketplaceRoot: MP,
    statKind(p: string): Promise<"file" | "dir" | null> {
      if (p === localRoot) {
        return Promise.resolve("dir");
      }

      if (p === hooksPath) {
        return Promise.resolve("file");
      }

      return Promise.resolve(null);
    },
    readFileText(p: string): Promise<string> {
      if (p === hooksPath) {
        return Promise.reject(Object.assign(new Error("EACCES"), { code: "EACCES" }));
      }

      return Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    },
  };
  await assert.rejects(
    () => resolveStrict(basicEntry({ source: "./local" }), ctx),
    (err: unknown) => {
      assert.ok(err instanceof Error, "rejection must be an Error");
      assert.equal(
        (err as NodeJS.ErrnoException).code,
        "EACCES",
        "EACCES must propagate unchanged for narrowProbeError to classify",
      );
      return true;
    },
  );
});

// SURF-05 / D-63-08: a handler with `rewakeMessage` and NO `asyncRewake: true`
// flips `partial.orphanRewake = true`. One-per-plugin invariant -- a single
// orphan handler is enough.
test("SURF-05 / D-63-08: rewakeMessage without asyncRewake -> orphanRewake === true", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "echo orphan", rewakeMessage: "follow up please" }],
          },
        ],
      }),
    },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes if not installable: ${r.notes.join(" / ")}`);
  if (r.state === "installable") {
    assert.equal(r.orphanRewake, true);
  }
});

// SURF-05 / D-63-08: the SAME handler with `asyncRewake: true` is no longer
// orphan -- the companion field has its required parent. Resolver leaves
// `orphanRewake` absent (absence-or-false invariant).
test("SURF-05 / D-63-08: rewakeMessage WITH asyncRewake: true -> orphanRewake absent (no warning)", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command: "echo paired",
                asyncRewake: true,
                rewakeMessage: "follow up please",
              },
            ],
          },
        ],
      }),
    },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes if not installable: ${r.notes.join(" / ")}`);
  if (r.state === "installable") {
    assert.equal(r.orphanRewake, undefined);
  }
});

// SURF-05 / D-63-08: `rewakeSummary` is the second orphan-bearing companion
// field; absence of `asyncRewake: true` ALSO flips the flag (covers both
// fields in the family).
test("SURF-05 / D-63-08: rewakeSummary without asyncRewake -> orphanRewake === true", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PostToolUse: [
          {
            matcher: "Edit",
            hooks: [{ type: "command", command: "echo summary", rewakeSummary: "what happened" }],
          },
        ],
      }),
    },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes if not installable: ${r.notes.join(" / ")}`);
  if (r.state === "installable") {
    assert.equal(r.orphanRewake, true);
  }
});

// SURF-05 / D-63-08: one-per-plugin invariant -- multiple groups across
// multiple events with ONLY ONE orphan handler still emit a single
// plugin-level flag (no per-handler aggregation).
test("SURF-05 / D-63-08: multi-event / multi-group config with ONE orphan -> orphanRewake === true (one-per-plugin)", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "echo ok" }],
          },
        ],
        PostToolUse: [
          {
            matcher: "Edit",
            hooks: [
              { type: "command", command: "echo first" },
              {
                type: "command",
                command: "echo second",
                rewakeMessage: "orphan #1",
              },
            ],
          },
          {
            matcher: "Write",
            hooks: [{ type: "command", command: "echo write" }],
          },
        ],
        SessionStart: [{ hooks: [{ type: "command", command: "echo start" }] }],
      }),
    },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes if not installable: ${r.notes.join(" / ")}`);
  if (r.state === "installable") {
    // boolean flag -- no count of N orphan handlers, just the single bit.
    assert.equal(r.orphanRewake, true);
  }
});

// SURF-05 / D-63-08: a hooks.json that exists and parses but contains NO
// rewake companion fields at all leaves `orphanRewake` absent. Regression
// guard for the no-op happy path.
test("SURF-05 / D-63-08: hooks.json without any rewake fields -> orphanRewake absent", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo ok" }] }],
      }),
    },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes if not installable: ${r.notes.join(" / ")}`);
  if (r.state === "installable") {
    assert.equal(r.orphanRewake, undefined);
  }
});

// HOOK-01 regression guard: absent hooks/hooks.json + no entry/manifest
// declaration -> installable: true and hooks NOT in supported. This is the
// no-hooks happy path; the supported-side convention probe must not invent
// a hooks entry where none exists on disk.
test("HOOK-01: no hooks declared and no hooks/hooks.json -> installable WITHOUT hooks in supported", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable");

  if (r.state === "installable") {
    assert.ok(!r.supported.includes("hooks"));
  }
});

test("PR-4 discovers unsupported default component locations", async () => {
  const cases: readonly {
    readonly kind: string;
    readonly relativePath: string;
    readonly stat: "dir" | { contents: string };
  }[] = [
    { kind: "lspServers", relativePath: ".lsp.json", stat: { contents: "{}" } },
    {
      kind: "monitors",
      relativePath: path.join("monitors", "monitors.json"),
      stat: { contents: "[]" },
    },
    { kind: "themes", relativePath: "themes", stat: "dir" },
    { kind: "outputStyles", relativePath: "output-styles", stat: "dir" },
    { kind: "bin", relativePath: "bin", stat: "dir" },
    { kind: "settings", relativePath: "settings.json", stat: { contents: "{}" } },
  ];

  for (const c of cases) {
    const localRoot = ROOT(`./local-${c.kind}`);
    const ctx = mockCtx(MP, {
      [localRoot]: "dir",
      [path.join(localRoot, c.relativePath)]: c.stat,
    });
    const r = await resolveStrict(basicEntry({ source: `./local-${c.kind}` }), ctx);
    // D-64-06: an unsupported component kind with no structural defect
    // resolves the `unsupported` (force-degradable) arm.
    assert.equal(r.state, "partially-available", `${c.kind} should be unsupported`);
    assert.ok(r.notes.includes(`contains ${c.kind}`), `notes: ${r.notes.join(" / ")}`);
    if (r.state === "partially-available") {
      assert.ok(r.unsupported.includes(c.kind), `unsupported: ${r.unsupported.join(" / ")}`);
    }
  }
});

test("PR-3 experimental themes/monitors declarations are unsupported", async () => {
  const localRoot = ROOT("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [manifestPath]: {
      contents: JSON.stringify({
        name: "p1",
        experimental: { themes: "./themes", monitors: "./monitors.json" },
      }),
    },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  // D-64-06: unsupported component kinds, no structural defect -> unsupported.
  assert.equal(r.state, "partially-available");
  assert.ok(r.notes.includes("contains themes"), `notes: ${r.notes.join(" / ")}`);
  assert.ok(r.notes.includes("contains monitors"), `notes: ${r.notes.join(" / ")}`);
});

test("PR-2(6) malformed mcpServers (array form) -> notInstallable", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(basicEntry({ source: "./local", mcpServers: [1, 2, 3] }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("malformed mcpServers")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("PR-2(7) non-string component path (skills: 42) -> notInstallable", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(basicEntry({ source: "./local", skills: 42 }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("is not a string")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("PR-2(8) escaping component path (skills: '../outside') -> notInstallable", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(basicEntry({ source: "./local", skills: "../outside" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("escapes plugin root")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

// D-07 (COMP-01) narrows PR-2(9): top-level arrays of strings are LEGAL.
// Only non-string elements (or nested arrays) inside the array are rejected
// at the element level. The error note reads "is not a string" (from
// PR-2 case 7) or "contains nested array element".
test("PR-2(9) [D-07 narrowed] array containing non-string element -> notInstallable", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(basicEntry({ source: "./local", skills: [42] }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("is not a string")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("PR-2(9) [D-07 narrowed] nested array element -> notInstallable with descriptive note", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(basicEntry({ source: "./local", skills: [["skills"]] }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("nested array element")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// PR-3 multi: two unsupported components both surface
// ──────────────────────────────────────────────────────────────────────────

test("PR-3 multiple unsupported components both surface as notes", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(
    basicEntry({ source: "./local", themes: { dark: {} }, bin: { tool: "x" } }),
    ctx,
  );
  // D-64-06: multiple unsupported kinds, no structural defect -> unsupported.
  assert.equal(r.state, "partially-available");
  assert.ok(
    r.notes.includes("contains themes"),
    `themes note missing; got: ${r.notes.join(" / ")}`,
  );
  assert.ok(r.notes.includes("contains bin"), `bin note missing; got: ${r.notes.join(" / ")}`);
});

// ──────────────────────────────────────────────────────────────────────────
// PR-4 [D-07/COMP-01]: implicit-by-convention SUPPLEMENTS declared paths.
// The strict-resolver Step 7 computes the UNION of declared + implicit;
// first-wins dedup preserves declared-first ordering.
// ──────────────────────────────────────────────────────────────────────────

test("PR-4 implicit-by-convention populates componentPaths.skills when neither entry nor manifest declares it", async () => {
  const ctx = mockCtx(MP, {
    [ROOT("./local")]: "dir",
    [path.join(ROOT("./local"), "skills")]: "dir",
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes if not: ${r.notes.join(" / ")}`);

  if (r.state === "installable") {
    assert.deepEqual(r.componentPaths.skills, ["skills"]);
    assert.ok(r.supported.includes("skills"));
  }
});

// D-07 corollary: entry declares "custom" AND implicit "skills/" exists ->
// UNION (declared-first ordering), NOT a short-circuit on the declared path.
test("D-07 entry-declared path UNIONs with implicit-by-convention (was: PR-4 short-circuit)", async () => {
  const ctx = mockCtx(MP, {
    [ROOT("./local")]: "dir",
    [path.join(ROOT("./local"), "skills")]: "dir",
    [path.join(ROOT("./local"), "custom")]: "dir",
  });
  const r = await resolveStrict(basicEntry({ source: "./local", skills: "custom" }), ctx);
  assert.equal(r.state, "installable");

  if (r.state === "installable") {
    // Declared first, implicit-by-convention appended after.
    assert.deepEqual(r.componentPaths.skills, ["custom", "skills"]);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// PR-5: dependencies stay installable but get a note
// ──────────────────────────────────────────────────────────────────────────

test("PR-5 entry.dependencies present -> installable: true with manual-install note", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(
    basicEntry({ source: "./local", dependencies: { other: "1.0" } }),
    ctx,
  );
  assert.equal(r.state, "installable");
  assert.ok(
    r.notes.some((n) => n.includes("must be installed manually")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// PR-6: requireInstallable
// ──────────────────────────────────────────────────────────────────────────

test("PR-6 requireInstallable on installable narrows to installable variant", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r: ResolvedPlugin = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  requireInstallable(r);
  // After the assertion, TypeScript narrows r to ResolvedPluginInstallable
  assert.equal(typeof r.pluginRoot, "string");
});

test("PR-6 requireInstallable on not-installable throws with 'is not installable' + notes", async () => {
  const ctx = mockCtx(MP, {});
  const r = await resolveStrict(basicEntry({ source: "./missing" }), ctx);
  assert.throws(
    () => {
      requireInstallable(r);
    },
    (err: unknown) =>
      err instanceof Error &&
      err.message.includes('Plugin "p1" is not installable') &&
      err.message.includes("source dir does not exist"),
  );
});

test("PR-6 requireInstallable(r, 'update') throws with 'is no longer installable'", async () => {
  const ctx = mockCtx(MP, {});
  const r = await resolveStrict(basicEntry({ source: "./missing" }), ctx);
  assert.throws(
    () => {
      requireInstallable(r, "update");
    },
    (err: unknown) => err instanceof Error && err.message.includes("is no longer installable"),
  );
});

// ──────────────────────────────────────────────────────────────────────────
// MM-5 happy path
// ──────────────────────────────────────────────────────────────────────────

test("MM-5 happy path: valid entry + manifest with skills -> installable with skills supported", async () => {
  const localRoot = ROOT("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", skills: "skills" }) },
    [path.join(localRoot, "skills")]: "dir",
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes if not installable: ${r.notes.join(" / ")}`);

  if (r.state === "installable") {
    assert.equal(r.pluginRoot, localRoot);
    assert.ok(r.supported.includes("skills"));
    // D-07: manifest declares "skills" AND implicit "skills/" exists; UNION
    // applies first-wins dedup so the result is a single-element ["skills"].
    assert.deepEqual(r.componentPaths.skills, ["skills"]);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// RSTATE-02 / D-64-07: structural precedence
// ──────────────────────────────────────────────────────────────────────────

// A plugin that is BOTH structurally broken (malformed mcpServers) AND
// declares an unsupported component kind (themes) resolves `unavailable` --
// the structural defect wins, so `pluginRoot` never leaks through the
// `unsupported` arm. Both reasons are still present in `notes`.
test("RSTATE-02: structural defect + unsupported kind -> unavailable (structural precedence)", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(
    basicEntry({ source: "./local", mcpServers: [1, 2, 3], themes: { dark: {} } }),
    ctx,
  );
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("malformed mcpServers")),
    `structural note missing; got: ${r.notes.join(" / ")}`,
  );
  assert.ok(
    r.notes.includes("contains themes"),
    `unsupported note missing; got: ${r.notes.join(" / ")}`,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// RSTATE-04 / D-64-04: requirePartialInstallable gate
// ──────────────────────────────────────────────────────────────────────────

test("RSTATE-04 requirePartialInstallable admits installable and exposes pluginRoot", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r: ResolvedPlugin = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable");
  requirePartialInstallable(r);
  // After the assertion r is ResolvedPluginInstallable | ResolvedPluginPartiallyAvailable.
  assert.equal(typeof r.pluginRoot, "string");
});

test("RSTATE-04 requirePartialInstallable admits unsupported and exposes pluginRoot", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r: ResolvedPlugin = await resolveStrict(
    basicEntry({ source: "./local", themes: { dark: {} } }),
    ctx,
  );
  assert.equal(r.state, "partially-available");
  requirePartialInstallable(r);
  // D-64-06: the unsupported arm keeps pluginRoot, so force can degrade it.
  assert.equal(typeof r.pluginRoot, "string");
});

test("RSTATE-04 requirePartialInstallable throws on unavailable with 'is not installable'", async () => {
  const ctx = mockCtx(MP, {});
  const r = await resolveStrict(basicEntry({ source: "./missing" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.throws(
    () => {
      requirePartialInstallable(r);
    },
    (err: unknown) =>
      err instanceof Error &&
      err.message.includes('Plugin "p1" is not installable') &&
      err.message.includes("source dir does not exist"),
  );
});

test("RSTATE-04 requirePartialInstallable(r, 'update') throws with 'is no longer installable'", async () => {
  const ctx = mockCtx(MP, {});
  const r = await resolveStrict(basicEntry({ source: "./missing" }), ctx);
  assert.throws(
    () => {
      requirePartialInstallable(r, "update");
    },
    (err: unknown) => err instanceof Error && err.message.includes("is no longer installable"),
  );
});

// ──────────────────────────────────────────────────────────────────────────
// SEV-02 / IN-02 / D-69-03 / RSTATE-05: requireInstallable on the `unsupported`
// arm carries the force hint + typed unsupported-kind list
// ──────────────────────────────────────────────────────────────────────────

// requireInstallable throws on an `unsupported` (force-degradable) plugin, and
// the thrown PluginShapeError pins the force-hint ternaries:
// `partialable: r.state === "partially-available"` (true here) and
// `unsupportedKinds: r.state === "partially-available" ? r.unsupported : []` (the typed
// component-kind list, NOT the empty structural default). A regression that
// dropped either would silently suppress the `--force` hint on the render row.
test("SEV-02 / IN-02: requireInstallable on unsupported throws partialable with the typed unsupportedKinds", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(basicEntry({ source: "./local", themes: { dark: {} } }), ctx);
  assert.equal(r.state, "partially-available");
  assert.throws(
    () => {
      requireInstallable(r);
    },
    (err: unknown) => {
      assert.ok(err instanceof PluginShapeError, "must throw PluginShapeError");
      assert.equal(err.shape.kind, "not-installable");
      if (err.shape.kind === "not-installable") {
        assert.equal(err.shape.partialable, true);
        assert.deepEqual(err.shape.unsupportedKinds, ["themes"]);
      }

      return true;
    },
  );
});

// ──────────────────────────────────────────────────────────────────────────
// SURF-05 / D-63-08 / D-71-03: detectOrphanRewake runs over the FILTERED kept
// subset, so a DROPPED group's orphan-rewake field cannot raise a false marker
// ──────────────────────────────────────────────────────────────────────────

// A hooks config with one KEPT supported group (matcher "Bash") and one DROPPED
// unsupportable group (regex matcher ".*") whose only handler declares
// `rewakeMessage` WITHOUT `asyncRewake:true`. The orphan lives in the dropped
// group, so it never enters the filtered subset `detectOrphanRewake` scans ->
// `orphanRewake` stays absent even though the plugin resolves `unsupported`.
test("SURF-05 / D-71-03: orphan in a DROPPED group does not flag orphanRewake -> unsupported, orphanRewake absent", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [
          { matcher: "Bash", hooks: [{ type: "command", command: "echo ok" }] },
          {
            matcher: ".*",
            hooks: [{ type: "command", command: "echo orphan", rewakeMessage: "later" }],
          },
        ],
      }),
    },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "partially-available", `notes: ${r.notes.join(" / ")}`);
  if (r.state === "partially-available") {
    assert.equal(r.orphanRewake, undefined);
    assert.ok(r.supported.includes("hooks"), `supported: ${r.supported.join(" / ")}`);
    assert.deepEqual(r.droppedHooks, [
      { kind: "group", event: "PreToolUse", matcher: ".*", cond: "regex" },
    ]);
  }
});

// Converse: the orphan lives in the KEPT group (matcher "Bash") while the regex
// group drops. The kept group IS in the filtered subset, so `orphanRewake`
// still flags true even though the plugin resolves `unsupported`.
test("SURF-05 / D-71-03: orphan in the KEPT group still flags orphanRewake -> unsupported, orphanRewake true", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "echo orphan", rewakeMessage: "later" }],
          },
          { matcher: ".*", hooks: [{ type: "command", command: "echo drop" }] },
        ],
      }),
    },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "partially-available", `notes: ${r.notes.join(" / ")}`);
  if (r.state === "partially-available") {
    assert.equal(r.orphanRewake, true);
    assert.deepEqual(r.droppedHooks, [
      { kind: "group", event: "PreToolUse", matcher: ".*", cond: "regex" },
    ]);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// PHOOK-01 / D-71-01: droppedHooks carries the `kind:"handler"` and non-regex
// `cond` group shapes
// ──────────────────────────────────────────────────────────────────────────

// A `kind:"handler"` drop: a non-`command` handler in an otherwise-supportable
// group. The `command` handler survives (group + event kept, "hooks" supported),
// and the dropped handler is enumerated at HANDLER granularity.
test("PHOOK-01: a non-command handler in a kept group drops at handler granularity -> unsupported", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "echo ok" }, { type: "notification" }],
          },
        ],
      }),
    },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "partially-available", `notes: ${r.notes.join(" / ")}`);
  if (r.state === "partially-available") {
    assert.ok(r.supported.includes("hooks"), `supported: ${r.supported.join(" / ")}`);
    assert.deepEqual(r.droppedHooks, [
      { kind: "handler", event: "PreToolUse", matcher: "Bash", handlerType: "notification" },
    ]);
  }
});

// A non-regex `cond`: an unmapped Claude tool (`MultiEdit`) has no Pi TOOL-01
// reverse-map entry, so its matcher group drops with `cond:"unmapped-tool"`.
test("PHOOK-01: an unmapped-tool matcher drops the group with cond unmapped-tool -> unsupported", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [{ matcher: "MultiEdit", hooks: [{ type: "command", command: "echo x" }] }],
      }),
    },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "partially-available", `notes: ${r.notes.join(" / ")}`);
  if (r.state === "partially-available") {
    assert.deepEqual(r.droppedHooks, [
      { kind: "group", event: "PreToolUse", matcher: "MultiEdit", cond: "unmapped-tool" },
    ]);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// PURL-01 / PURL-03: git plugin sources (url / git-subdir / github-object) are
// installable when a `resolveGitPluginRoot` callback materializes their clone
// root. The resolver stays network-free: the clone-vs-probe policy is injected.
// ──────────────────────────────────────────────────────────────────────────

// A materialized clone root that `mockCtx`'s file map treats as an existing
// directory. Its `.claude-plugin/plugin.json` is deliberately absent (best-effort
// per PR-2 case 4) so the plugin resolves installable with an empty component set.
const CLONE_ROOT = "/abs/plugin-clones/deadbeef00-cafef00dba/";

/**
 * Build a ResolveContext whose `resolveGitPluginRoot` returns a fixed result and
 * whose file map treats `CLONE_ROOT` (and any component dirs) as present. The
 * marketplaceRoot is still `MP`, but git sources never touch it -- their
 * pluginRoot comes from the injected callback.
 */
function gitCtx(
  result: GitPluginRootResult,
  files: Record<string, "dir" | "file" | { contents: string }> = { [CLONE_ROOT]: "dir" },
): ResolveContext {
  return {
    ...mockCtx(MP, files),
    resolveGitPluginRoot(): Promise<GitPluginRootResult> {
      return Promise.resolve(result);
    },
  };
}

test("PURL-01: url source + materialized callback -> installable carrying the clone pluginRoot", async () => {
  const ctx = gitCtx({
    kind: "materialized",
    pluginRoot: CLONE_ROOT,
    resolvedSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  });
  const r = await resolveStrict(
    basicEntry({ source: { source: "url", url: "https://gitlab.com/o/p.git" } }),
    ctx,
  );
  assert.equal(r.state, "installable", `notes if not installable: ${r.notes.join(" / ")}`);
  if (r.state === "installable") {
    assert.equal(r.pluginRoot, CLONE_ROOT);
  }
});

test("PURL-01: git-subdir source + materialized callback -> installable carrying the clone pluginRoot", async () => {
  const subRoot = path.join(CLONE_ROOT, "packages", "plug");
  const ctx = gitCtx(
    {
      kind: "materialized",
      pluginRoot: subRoot,
      resolvedSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    },
    { [subRoot]: "dir" },
  );
  const r = await resolveStrict(
    basicEntry({
      source: { source: "git-subdir", url: "https://gitlab.com/o/p", path: "packages/plug" },
    }),
    ctx,
  );
  assert.equal(r.state, "installable", `notes if not installable: ${r.notes.join(" / ")}`);
  if (r.state === "installable") {
    assert.equal(r.pluginRoot, subRoot);
  }
});

test("PURL-01: github-object source + materialized callback -> installable carrying the clone pluginRoot", async () => {
  const ctx = gitCtx({
    kind: "materialized",
    pluginRoot: CLONE_ROOT,
    resolvedSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  });
  const r = await resolveStrict(
    basicEntry({ source: { source: "github", repo: "owner/repo" } }),
    ctx,
  );
  assert.equal(r.state, "installable", `notes if not installable: ${r.notes.join(" / ")}`);
  if (r.state === "installable") {
    assert.equal(r.pluginRoot, CLONE_ROOT);
  }
});

test("PURL-01: npm source stays unavailable with unsupported-source note", async () => {
  const ctx = gitCtx({
    kind: "materialized",
    pluginRoot: CLONE_ROOT,
    resolvedSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  });
  const r = await resolveStrict(
    basicEntry({ source: { source: "npm", package: "some-plugin" } }),
    ctx,
  );
  assert.equal(r.state, "unavailable");
  assert.ok(r.notes.includes("unsupported source kind: npm"), `notes: ${r.notes.join(" / ")}`);
});

test("PURL-01: url source with NO resolveGitPluginRoot injected -> unavailable (path-only back-compat)", async () => {
  const ctx = mockCtx(MP, {});
  const r = await resolveStrict(
    basicEntry({ source: { source: "url", url: "https://gitlab.com/o/p.git" } }),
    ctx,
  );
  assert.equal(r.state, "unavailable");
  // No pluginRoot leaks (NFR-7); a note explains the missing clone resolver.
  assert.ok(
    r.notes.some((n) => n.includes("clone")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("PURL-01: path source is unchanged -- marketplaceRoot escape check still fires (regression)", async () => {
  // Even with a git callback present, a path source uses the marketplaceRoot
  // derivation + escape check, never the callback.
  const ctx = gitCtx({
    kind: "materialized",
    pluginRoot: CLONE_ROOT,
    resolvedSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  });
  const r = await resolveStrict(basicEntry({ source: "../escape" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("escapes marketplace root")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("PURL-03: escapes result -> unavailable carrying the escape detail", async () => {
  const detail = "source path escapes clone root: ../../etc";
  const ctx = gitCtx({ kind: "escapes", detail });
  const r = await resolveStrict(
    basicEntry({
      source: { source: "git-subdir", url: "https://gitlab.com/o/p", path: "../../etc" },
    }),
    ctx,
  );
  assert.equal(r.state, "unavailable");
  assert.ok(r.notes.includes(detail), `notes: ${r.notes.join(" / ")}`);
});

test("PURL-03: missing-subdir result -> unavailable carrying the missing detail", async () => {
  const detail = "source missing: packages/absent";
  const ctx = gitCtx({ kind: "missing-subdir", detail });
  const r = await resolveStrict(
    basicEntry({
      source: { source: "git-subdir", url: "https://gitlab.com/o/p", path: "packages/absent" },
    }),
    ctx,
  );
  assert.equal(r.state, "unavailable");
  assert.ok(r.notes.includes(detail), `notes: ${r.notes.join(" / ")}`);
});

test("PURL-01: not-cached result -> unavailable (never carries pluginRoot)", async () => {
  const ctx = gitCtx({ kind: "not-cached" });
  const r = await resolveStrict(
    basicEntry({ source: { source: "url", url: "https://gitlab.com/o/p.git" } }),
    ctx,
  );
  assert.equal(r.state, "unavailable");
  // NFR-7: the unavailable arm structurally omits pluginRoot.
  assert.ok(!("pluginRoot" in r), "unavailable arm must not carry pluginRoot");
});

// PURL-01: a materialized git clone feeds the SAME downstream stages as a path
// source. A malformed plugin.json at the returned clone root still trips the
// existing structural note (the git branch does not bypass manifest reading).
test("PURL-01: materialized clone with malformed plugin.json -> unavailable with the manifest note", async () => {
  const manifestPath = path.join(CLONE_ROOT, ".claude-plugin", "plugin.json");
  const ctx = gitCtx(
    {
      kind: "materialized",
      pluginRoot: CLONE_ROOT,
      resolvedSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    },
    { [CLONE_ROOT]: "dir", [manifestPath]: { contents: "{ not json" } },
  );
  const r = await resolveStrict(
    basicEntry({ source: { source: "url", url: "https://gitlab.com/o/p.git" } }),
    ctx,
  );
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("malformed plugin.json")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

// PURL-01: a materialized clone whose directory does not exist on disk still
// trips PR-2 case 3 (source dir does not exist) -- the git branch does not skip
// the dir-existence check.
test("PURL-01: materialized clone whose dir is absent -> unavailable (source dir does not exist)", async () => {
  // The callback claims materialized, but the file map has no CLONE_ROOT dir.
  const ctx = gitCtx(
    {
      kind: "materialized",
      pluginRoot: CLONE_ROOT,
      resolvedSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    },
    {},
  );
  const r = await resolveStrict(
    basicEntry({ source: { source: "url", url: "https://gitlab.com/o/p.git" } }),
    ctx,
  );
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("source dir does not exist")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("PR-2(1) unclassifiable source (non-string/non-object) -> unavailable with the unknown-kind reason", async () => {
  const ctx = mockCtx(MP, {});
  const r = await resolveStrict(basicEntry({ source: 42 }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) =>
      n.includes("unsupported source kind: unknown (source must be a string or object)"),
    ),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("PR-2(1) object source with an unrecognized discriminator -> unavailable, reason carries the parser detail", async () => {
  const ctx = mockCtx(MP, {});
  const r = await resolveStrict(basicEntry({ source: { source: "weird" } }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) =>
      n.includes("unsupported source kind: unknown (unrecognized source kind: weird)"),
    ),
    `notes: ${r.notes.join(" / ")}`,
  );
});
