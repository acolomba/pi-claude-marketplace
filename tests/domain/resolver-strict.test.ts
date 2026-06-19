// Strict-mode resolver coverage. 1:1 mapping between PR-2 cases and tests
// (9 tests for the 9 cases). Plus PR-3 multi, PR-4 implicit-by-convention
// (positive + negative), PR-5 dependencies, PR-6 requireInstallable
// narrowing/throwing, and one MM-5 happy path.

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  type ResolveContext,
  type ResolvedPlugin,
  requireInstallable,
  resolveStrict,
} from "../../extensions/pi-claude-marketplace/domain/resolver.ts";

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

test("PR-2(1) non-path source kind (github) -> notInstallable", async () => {
  const ctx = mockCtx(MP, {});
  const r = await resolveStrict(basicEntry({ source: "owner/repo" }), ctx);
  assert.equal(r.installable, false);
  assert.ok(
    r.notes.some((n) => n.includes("unsupported source kind")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("PR-2(1) upstream object source kind (url) -> notInstallable", async () => {
  const ctx = mockCtx(MP, {});
  const r = await resolveStrict(
    basicEntry({ source: { source: "url", url: "https://github.com/obra/superpowers.git" } }),
    ctx,
  );
  assert.equal(r.installable, false);
  assert.ok(r.notes.includes("unsupported source kind: url"), `notes: ${r.notes.join(" / ")}`);
});

test("PR-2(2) source path escape -> notInstallable", async () => {
  const ctx = mockCtx(MP, {});
  const r = await resolveStrict(basicEntry({ source: "../escape" }), ctx);
  assert.equal(r.installable, false);
  assert.ok(
    r.notes.some((n) => n.includes("escapes marketplace root")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("PR-2(3) source dir does not exist -> notInstallable", async () => {
  const ctx = mockCtx(MP, {}); // no entries -> statKind returns null
  const r = await resolveStrict(basicEntry({ source: "./missing" }), ctx);
  assert.equal(r.installable, false);
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
  assert.equal(r.installable, false);
  assert.ok(
    r.notes.some((n) => n.includes("malformed plugin.json")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

// HOOK-01: hooks moved from UNSUPPORTED to SUPPORTED. A plugin declaring
// `hooks` at the entry level with NO hooks/hooks.json on disk is no longer
// rejected with "contains hooks" -- the resolver only owns convention-file
// discovery; entry/manifest-level hooks-field semantics are deferred to a
// future dispatch milestone.
test("HOOK-01: entry declares hooks field but no hooks/hooks.json on disk -> installable WITHOUT hooks in supported", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(basicEntry({ source: "./local", hooks: { onLoad: "x" } }), ctx);
  assert.equal(r.installable, true, `notes if not installable: ${r.notes.join(" / ")}`);

  if (r.installable) {
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
  assert.equal(r.installable, true, `notes if not installable: ${r.notes.join(" / ")}`);

  if (r.installable) {
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
  assert.equal(r.installable, false);
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
  assert.equal(r.installable, false);
  assert.ok(
    r.notes.some((n) => n.includes("hooks.json")),
    `notes must mention hooks.json: ${r.notes.join(" / ")}`,
  );
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
  assert.equal(r.installable, true, `notes if not installable: ${r.notes.join(" / ")}`);
  if (r.installable) {
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
  assert.equal(r.installable, true, `notes if not installable: ${r.notes.join(" / ")}`);
  if (r.installable) {
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
  assert.equal(r.installable, true, `notes if not installable: ${r.notes.join(" / ")}`);
  if (r.installable) {
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
  assert.equal(r.installable, true, `notes if not installable: ${r.notes.join(" / ")}`);
  if (r.installable) {
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
  assert.equal(r.installable, true, `notes if not installable: ${r.notes.join(" / ")}`);
  if (r.installable) {
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
  assert.equal(r.installable, true);

  if (r.installable) {
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
    assert.equal(r.installable, false, `${c.kind} should be unavailable`);
    assert.ok(r.notes.includes(`contains ${c.kind}`), `notes: ${r.notes.join(" / ")}`);
    assert.ok(r.unsupported.includes(c.kind), `unsupported: ${r.unsupported.join(" / ")}`);
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
  assert.equal(r.installable, false);
  assert.ok(r.notes.includes("contains themes"), `notes: ${r.notes.join(" / ")}`);
  assert.ok(r.notes.includes("contains monitors"), `notes: ${r.notes.join(" / ")}`);
});

test("PR-2(6) malformed mcpServers (array form) -> notInstallable", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(basicEntry({ source: "./local", mcpServers: [1, 2, 3] }), ctx);
  assert.equal(r.installable, false);
  assert.ok(
    r.notes.some((n) => n.includes("malformed mcpServers")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("PR-2(7) non-string component path (skills: 42) -> notInstallable", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(basicEntry({ source: "./local", skills: 42 }), ctx);
  assert.equal(r.installable, false);
  assert.ok(
    r.notes.some((n) => n.includes("is not a string")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("PR-2(8) escaping component path (skills: '../outside') -> notInstallable", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(basicEntry({ source: "./local", skills: "../outside" }), ctx);
  assert.equal(r.installable, false);
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
  assert.equal(r.installable, false);
  assert.ok(
    r.notes.some((n) => n.includes("is not a string")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("PR-2(9) [D-07 narrowed] nested array element -> notInstallable with descriptive note", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(basicEntry({ source: "./local", skills: [["skills"]] }), ctx);
  assert.equal(r.installable, false);
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
  assert.equal(r.installable, false);
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
  assert.equal(r.installable, true, `notes if not: ${r.notes.join(" / ")}`);

  if (r.installable) {
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
  assert.equal(r.installable, true);

  if (r.installable) {
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
  assert.equal(r.installable, true);
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
  assert.equal(r.installable, true, `notes if not installable: ${r.notes.join(" / ")}`);

  if (r.installable) {
    assert.equal(r.pluginRoot, localRoot);
    assert.ok(r.supported.includes("skills"));
    // D-07: manifest declares "skills" AND implicit "skills/" exists; UNION
    // applies first-wins dedup so the result is a single-element ["skills"].
    assert.deepEqual(r.componentPaths.skills, ["skills"]);
  }
});
