// tests/domain/resolver-loose.test.ts
//
// Loose-mode resolver coverage (MM-6 / MM-7). resolveLoose differs from
// resolveStrict in TWO ways:
//   1. MM-6: component declarations come from the entry ONLY -- a manifest
//      declaration without a matching entry-level declaration is a conflict;
//      implicit-by-convention is disabled.
//   2. MM-7: mcpServers come from the entry ONLY -- manifest.mcpServers OR
//      a standalone .mcp.json without an entry-level declaration is a conflict.
//
// PR-3 (unsupported components) and PR-5 (dependencies) work identically
// in both modes; spot-checked here with one test each.

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  type ResolveContext,
  type ResolvedPlugin,
  requirePartialInstallable,
  resolveLoose,
} from "../../extensions/pi-claude-marketplace/domain/resolver.ts";

import type { PluginEntry } from "../../extensions/pi-claude-marketplace/domain/components/plugin.ts";

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

type LooseEntry = Record<string, unknown>;

function basicEntry(over: LooseEntry = {}): PluginEntry {
  return { name: "p1", source: "./local", ...over };
}

// ──────────────────────────────────────────────────────────────────────────
// MM-6: entry-only component-path resolution
// ──────────────────────────────────────────────────────────────────────────

test("MM-6 entry.skills declared -> installable with skills", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "skills")]: "dir",
  });
  const r = await resolveLoose(basicEntry({ source: "./local", skills: "skills" }), ctx);
  assert.equal(r.state, "installable", `notes if not: ${r.notes.join(" / ")}`);

  if (r.state === "installable") {
    // D-07 array shape (loose mode is entry-only with no convention probe).
    assert.deepEqual(r.componentPaths.skills, ["skills"]);
    assert.ok(r.supported.includes("skills"));
  }
});

test("MM-6 entry.skills absent but manifest declares skills -> conflict notInstallable", async () => {
  const localRoot = ROOT("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", skills: "skills" }) },
    [path.join(localRoot, "skills")]: "dir",
  });
  const r = await resolveLoose(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("component declarations conflict") && n.includes("skills")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("MM-6 entry + manifest both absent + <pluginRoot>/skills exists -> installable WITHOUT skills (no implicit-by-convention in loose)", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "skills")]: "dir",
  });
  const r = await resolveLoose(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes: ${r.notes.join(" / ")}`);

  if (r.state === "installable") {
    // D-07 array shape: empty array (no implicit-by-convention in loose mode).
    assert.deepEqual(r.componentPaths.skills, [], "no implicit-by-convention in loose mode");
    assert.ok(!r.supported.includes("skills"));
  }
});

// ──────────────────────────────────────────────────────────────────────────
// DFEN-02: install-time enablement in loose mode
// ──────────────────────────────────────────────────────────────────────────

// D-101-08: structurally the same shape as the MM-6 conflict test above -- a
// manifest declaration with a silent entry -- but the outcome inverts, because
// the loose-mode conflict rule is closed-set by construction. It iterates the
// three supported component-path kinds plus `mcpServers`; `defaultEnabled` is
// metadata and belongs to none of those sets, exactly as `description` and
// `version` have never been conflict material. Nothing in the code special-cases
// this, so this test is the only thing that would notice if a later edit widened
// the conflict machinery to iterate keys instead of a closed tuple.
test("DFEN-02 manifest-only defaultEnabled with a silent entry -> resolves carrying false, not a conflict", async () => {
  const localRoot = ROOT("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", defaultEnabled: false }) },
  });
  const r = await resolveLoose(basicEntry({ source: "./local" }), ctx);
  assert.notEqual(r.state, "unavailable", `notes: ${r.notes.join(" / ")}`);
  assert.ok(
    !r.notes.some((n) => n.includes("declarations conflict")),
    `metadata must not be conflict material, notes: ${r.notes.join(" / ")}`,
  );
  requirePartialInstallable(r);
  assert.equal(r.defaultEnabled, false);
});

// D-101-04: the four precedence shapes, each asserted against the literal the
// strict-mode suite asserts for the same inputs. The expected value is spelled
// out rather than obtained by cross-calling the other mode, so a divergence
// reads directly in the failure output. Both modes take the value from the one
// shared computation, so the evaluation order is mode-independent.
test("DFEN-02 loose: entry false + manifest true -> carries false (entry wins)", async () => {
  const localRoot = ROOT("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", defaultEnabled: true }) },
  });
  const r = await resolveLoose(basicEntry({ source: "./local", defaultEnabled: false }), ctx);
  requirePartialInstallable(r);
  assert.equal(r.defaultEnabled, false);
});

test("DFEN-02 loose: entry true + manifest false -> carries true (entry wins both ways)", async () => {
  const localRoot = ROOT("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", defaultEnabled: false }) },
  });
  const r = await resolveLoose(basicEntry({ source: "./local", defaultEnabled: true }), ctx);
  requirePartialInstallable(r);
  assert.equal(r.defaultEnabled, true);
});

test("DFEN-02 loose: absent at both declaration sites -> carries true", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveLoose(basicEntry({ source: "./local" }), ctx);
  requirePartialInstallable(r);
  assert.equal(r.defaultEnabled, true);
});

// The manifest-only cell again, read as a parity row rather than as the
// non-conflict proof above: the value the entry never declared still carries.
test("DFEN-02 loose: manifest-only declaration -> carries the manifest value", async () => {
  const localRoot = ROOT("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", defaultEnabled: false }) },
    [path.join(localRoot, "skills")]: "dir",
  });
  const r = await resolveLoose(basicEntry({ source: "./local", skills: "skills" }), ctx);
  requirePartialInstallable(r);
  assert.equal(r.defaultEnabled, false);
});

// D-101-01 / D-101-04: the partial arm in loose mode, with the value coming
// from the manifest fallback rather than the entry -- the strict-mode sibling
// covers the entry side. `themes` is an unsupported kind, so it degrades the
// plugin without a structural defect; it is not a component-path kind, so it is
// not loose-mode conflict material either.
test("DFEN-02 loose: partially-available arm carries the manifest-resolved defaultEnabled", async () => {
  const localRoot = ROOT("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", defaultEnabled: false }) },
  });
  const r = await resolveLoose(basicEntry({ source: "./local", themes: "./themes" }), ctx);
  assert.equal(r.state, "partially-available", `notes: ${r.notes.join(" / ")}`);
  requirePartialInstallable(r);
  assert.equal(r.defaultEnabled, false);
});

// ──────────────────────────────────────────────────────────────────────────
// MM-7: mcpServers entry-only
// ──────────────────────────────────────────────────────────────────────────

test("MM-7 entry.mcpServers absent + manifest.mcpServers present -> conflict notInstallable", async () => {
  const localRoot = ROOT("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [manifestPath]: {
      contents: JSON.stringify({ name: "p1", mcpServers: { srv: { command: "x" } } }),
    },
  });
  const r = await resolveLoose(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("mcpServers") && n.includes("conflict")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("MM-7 entry.mcpServers absent + standalone .mcp.json present -> conflict notInstallable", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, ".mcp.json")]: { contents: JSON.stringify({ srv: {} }) },
  });
  const r = await resolveLoose(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("mcpServers") && n.includes("conflict")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("MM-7 entry.mcpServers present + valid -> installable with mcpServers populated", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, { [localRoot]: "dir" });
  const r = await resolveLoose(
    basicEntry({ source: "./local", mcpServers: { srv1: { command: "node" } } }),
    ctx,
  );
  assert.equal(r.state, "installable", `notes: ${r.notes.join(" / ")}`);

  if (r.state === "installable") {
    assert.deepEqual(Object.keys(r.mcpServers), ["srv1"]);
  }
});

test("D-03 entry.mcpServers string reference in loose mode -> unavailable (not resolved, not malformed)", async () => {
  // Loose mode does not resolve the strict-mode string-reference feature; it
  // degrades honestly rather than mislabeling the string as a malformed map.
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveLoose(basicEntry({ source: "./local", mcpServers: "./x.mcp.json" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("string reference") && n.includes("loose mode")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

test("MM-7 entry.mcpServers malformed (non-object) in loose mode -> unavailable + malformed mcpServers note", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveLoose(basicEntry({ source: "./local", mcpServers: 42 }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("malformed mcpServers")),
    `notes: ${r.notes.join(" / ")}`,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// PR-3 + PR-5 in loose mode (same semantics as strict)
// ──────────────────────────────────────────────────────────────────────────

test("PR-3 loose: entry declares unsupported component -> notInstallable", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveLoose(basicEntry({ source: "./local", themes: ["dark"] }), ctx);
  // D-64-06: unsupported component kind, no structural defect -> unsupported.
  assert.equal(r.state, "partially-available");
  assert.ok(r.notes.some((n) => n === "contains themes"));
});

// HOOK-01 loose: hooks/hooks.json present + parseable -> installable with
// hooks supported. Mirrors the strict-mode admission path because the
// convention-file discovery is mode-agnostic (it does not depend on
// entry-vs-manifest declaration semantics).
test("HOOK-01 loose: hooks/hooks.json present + parseable -> installable WITH hooks in supported", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] }],
      }),
    },
  });
  const r = await resolveLoose(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes if not installable: ${r.notes.join(" / ")}`);

  if (r.state === "installable") {
    assert.ok(r.supported.includes("hooks"));
    assert.ok(!r.notes.some((n) => n.includes("contains hooks")));
  }
});

// D-57-04 loose: malformed hooks/hooks.json flips installable: false with
// parse-failure detail.
test("D-57-04 loose: hooks/hooks.json present + parse-fails -> notInstallable + parse-detail note", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: { contents: "not-valid-json" },
  });
  const r = await resolveLoose(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("hooks.json")),
    `notes must mention hooks.json: ${r.notes.join(" / ")}`,
  );
});

// HOOK-01 loose regression guard: no declaration + no convention file ->
// installable: true and hooks NOT in supported.
test("HOOK-01 loose: no hooks declared and no hooks/hooks.json -> installable WITHOUT hooks in supported", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveLoose(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable");

  if (r.state === "installable") {
    assert.ok(!r.supported.includes("hooks"));
  }
});

test("PR-4 loose: discovers unsupported default component locations", async () => {
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
    { kind: "settings", relativePath: "settings.json", stat: { contents: "{}" } },
    { kind: "workflows", relativePath: "workflows", stat: "dir" },
  ];

  for (const c of cases) {
    const localRoot = ROOT(`./local-${c.kind}`);
    const ctx = mockCtx(MP, {
      [localRoot]: "dir",
      [path.join(localRoot, c.relativePath)]: c.stat,
    });
    const r = await resolveLoose(basicEntry({ source: `./local-${c.kind}` }), ctx);
    // D-64-06: unsupported component kind, no structural defect -> unsupported.
    assert.equal(r.state, "partially-available", `${c.kind} should be unsupported`);
    assert.ok(r.notes.includes(`contains ${c.kind}`), `notes: ${r.notes.join(" / ")}`);
  }
});

test("WDET-02 loose: every workflow signal resolves to one exact unsupported kind", async () => {
  const cases: readonly {
    readonly name: string;
    readonly source: string;
    readonly entry?: Readonly<Record<string, unknown>>;
    readonly manifest?: Readonly<Record<string, unknown>>;
    readonly directory?: boolean;
  }[] = [
    {
      name: "entry null declaration",
      source: "./workflow-entry-null",
      entry: Object.freeze({ workflows: null }),
    },
    {
      name: "entry false declaration",
      source: "./workflow-entry-false",
      entry: Object.freeze({ workflows: false }),
    },
    {
      name: "plugin manifest null declaration",
      source: "./workflow-manifest-null",
      manifest: Object.freeze({ name: "p1", workflows: null }),
    },
    {
      name: "plugin manifest false declaration",
      source: "./workflow-manifest-false",
      manifest: Object.freeze({ name: "p1", workflows: false }),
    },
    { name: "conventional directory", source: "./workflow-directory", directory: true },
    {
      name: "declaration and directory",
      source: "./workflow-combined",
      entry: Object.freeze({ workflows: 23 }),
      directory: true,
    },
  ];

  for (const c of cases) {
    const localRoot = ROOT(c.source);
    const files: Record<string, "dir" | { contents: string }> = { [localRoot]: "dir" };

    if (c.manifest !== undefined) {
      files[path.join(localRoot, ".claude-plugin", "plugin.json")] = {
        contents: JSON.stringify(c.manifest),
      };
    }

    if (c.directory === true) {
      files[path.join(localRoot, "workflows")] = "dir";
    }

    const r = await resolveLoose(basicEntry({ source: c.source, ...c.entry }), mockCtx(MP, files));
    assert.equal(r.state, "partially-available", c.name);
    if (r.state === "partially-available") {
      assert.deepEqual(r.unsupported, ["workflows"], c.name);
      assert.deepEqual(r.notes, ["contains workflows"], c.name);
    }
  }
});

test("WDET-02 loose: a workflows regular file is not a convention signal", async () => {
  const localRoot = ROOT("./workflow-file");
  const r = await resolveLoose(
    basicEntry({ source: "./workflow-file" }),
    mockCtx(MP, {
      [localRoot]: "dir",
      [path.join(localRoot, "workflows")]: { contents: "opaque workflow bytes" },
    }),
  );

  assert.equal(r.state, "installable");
  assert.equal(r.notes.includes("contains workflows"), false);
  if (r.state === "installable") {
    assert.equal(r.unsupported.includes("workflows"), false);
  }
});

test("WDET-02 loose: named local workflow layouts classify in parallel without a network seam call", async () => {
  let networkCalls = 0;
  const sources = Object.freeze(["./claude-security", "./code-modernization"] as const);
  const entries = Object.freeze(sources.map((source) => Object.freeze(basicEntry({ source }))));

  const results = await Promise.all(
    entries.map((entry) => {
      const localRoot = ROOT(entry.source as string);
      const files = Object.freeze({
        [localRoot]: "dir" as const,
        [path.join(localRoot, "workflows")]: "dir" as const,
      });
      const ctx: ResolveContext = {
        ...mockCtx(MP, files),
        resolveGitPluginRoot(): Promise<never> {
          networkCalls += 1;
          return Promise.reject(new Error("network seam must stay unused"));
        },
      };
      return resolveLoose(entry, ctx);
    }),
  );

  assert.deepEqual(
    results.map((r) => ({
      state: r.state,
      unsupported: r.state === "partially-available" ? r.unsupported : [],
      notes: r.notes,
    })),
    sources.map(() => ({
      state: "partially-available",
      unsupported: ["workflows"],
      notes: ["contains workflows"],
    })),
  );
  assert.equal(networkCalls, 0);
  assert.deepEqual(
    entries,
    sources.map((source) => basicEntry({ source })),
  );
});

test("D-106-06 loose: a workflow signal cannot expose a structurally invalid plugin root", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveLoose(
    basicEntry({ source: "./local", mcpServers: [1, 2, 3], workflows: 29 }),
    ctx,
  );

  assert.equal(r.state, "unavailable");
  assert.ok(r.notes.some((note) => note.includes("malformed mcpServers")));
  assert.ok(r.notes.includes("contains workflows"));
  assert.ok(!("pluginRoot" in r));
});

// D-90-06 loose: a bin/ dir on disk resolves installable (runtime-honored via
// the PENV-01 PATH ledger), not partially-available.
test("D-90-06 loose: bin/ dir on disk -> installable, no bin contains-note", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "bin")]: "dir",
  });
  const r = await resolveLoose(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes if not installable: ${r.notes.join(" / ")}`);
  assert.ok(
    !r.notes.some((n) => n.includes("contains bin")),
    `notes must not contain "contains bin": ${r.notes.join(" / ")}`,
  );
});

test("PR-5 loose: entry.dependencies -> installable with manual-install note", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveLoose(
    basicEntry({ source: "./local", dependencies: { other: "1.0" } }),
    ctx,
  );
  assert.equal(r.state, "installable");
  assert.ok(r.notes.some((n) => n.includes("must be installed manually")));
});

// ──────────────────────────────────────────────────────────────────────────
// MM-6 happy path (loose)
// ──────────────────────────────────────────────────────────────────────────

test("MM-6 loose happy path: entry declares skills and commands -> installable with both supported", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "skills")]: "dir",
    [path.join(localRoot, "commands")]: "dir",
  });
  const r = await resolveLoose(
    basicEntry({ source: "./local", skills: "skills", commands: "commands" }),
    ctx,
  );
  assert.equal(r.state, "installable", `notes: ${r.notes.join(" / ")}`);

  if (r.state === "installable") {
    // D-07 array shape.
    assert.deepEqual(r.componentPaths.skills, ["skills"]);
    assert.deepEqual(r.componentPaths.commands, ["commands"]);
    assert.deepEqual(r.supported.sort(), ["commands", "skills"]);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// D-07: loose mode accepts top-level arrays in entry-only fields with first-
// wins dedup; no implicit-by-convention probing.
// ──────────────────────────────────────────────────────────────────────────

test("D-07 loose: entry.skills as multi-element array preserves declared order with dedup", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "a")]: "dir",
    [path.join(localRoot, "b")]: "dir",
  });
  const r = await resolveLoose(basicEntry({ source: "./local", skills: ["a", "b", "a"] }), ctx);
  assert.equal(r.state, "installable", `notes: ${r.notes.join(" / ")}`);

  if (r.state === "installable") {
    // First-wins dedup; declared order preserved.
    assert.deepEqual(r.componentPaths.skills, ["a", "b"]);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// RSTATE-02 / D-64-07: structural precedence (loose mode)
// ──────────────────────────────────────────────────────────────────────────

// Loose mode: a manifest/standalone mcpServers conflict (structural) plus an
// entry-declared unsupported kind (themes) resolves `unavailable` -- the
// structural defect wins over the unsupported-component signal.
test("RSTATE-02 loose: structural conflict + unsupported kind -> unavailable (structural precedence)", async () => {
  const localRoot = ROOT("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [manifestPath]: {
      contents: JSON.stringify({ name: "p1", mcpServers: { srv: { command: "x" } } }),
    },
  });
  const r = await resolveLoose(basicEntry({ source: "./local", themes: ["dark"] }), ctx);
  assert.equal(r.state, "unavailable");
  assert.ok(
    r.notes.some((n) => n.includes("mcpServers") && n.includes("conflict")),
    `structural note missing; got: ${r.notes.join(" / ")}`,
  );
  assert.ok(
    r.notes.includes("contains themes"),
    `unsupported note missing; got: ${r.notes.join(" / ")}`,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// RSTATE-04 / D-64-04: requirePartialInstallable gate (loose mode)
// ──────────────────────────────────────────────────────────────────────────

test("RSTATE-04 loose: requirePartialInstallable admits installable and exposes pluginRoot", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r: ResolvedPlugin = await resolveLoose(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable");
  requirePartialInstallable(r);
  assert.equal(typeof r.pluginRoot, "string");
});

test("RSTATE-04 loose: requirePartialInstallable admits unsupported and exposes pluginRoot", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r: ResolvedPlugin = await resolveLoose(
    basicEntry({ source: "./local", themes: ["dark"] }),
    ctx,
  );
  assert.equal(r.state, "partially-available");
  requirePartialInstallable(r);
  assert.equal(typeof r.pluginRoot, "string");
});

test("RSTATE-04 loose: requirePartialInstallable throws on unavailable", async () => {
  const ctx = mockCtx(MP, {});
  const r = await resolveLoose(basicEntry({ source: "./missing" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.throws(
    () => {
      requirePartialInstallable(r);
    },
    (err: unknown) =>
      err instanceof Error && err.message.includes('Plugin "p1" is not installable'),
  );
});
