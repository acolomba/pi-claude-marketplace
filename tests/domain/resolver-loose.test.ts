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
  requireForceInstallable,
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

// ──────────────────────────────────────────────────────────────────────────
// PR-3 + PR-5 in loose mode (same semantics as strict)
// ──────────────────────────────────────────────────────────────────────────

test("PR-3 loose: entry declares unsupported component -> notInstallable", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveLoose(basicEntry({ source: "./local", themes: ["dark"] }), ctx);
  // D-64-06: unsupported component kind, no structural defect -> unsupported.
  assert.equal(r.state, "unsupported");
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
    { kind: "bin", relativePath: "bin", stat: "dir" },
    { kind: "settings", relativePath: "settings.json", stat: { contents: "{}" } },
  ];

  for (const c of cases) {
    const localRoot = ROOT(`./local-${c.kind}`);
    const ctx = mockCtx(MP, {
      [localRoot]: "dir",
      [path.join(localRoot, c.relativePath)]: c.stat,
    });
    const r = await resolveLoose(basicEntry({ source: `./local-${c.kind}` }), ctx);
    // D-64-06: unsupported component kind, no structural defect -> unsupported.
    assert.equal(r.state, "unsupported", `${c.kind} should be unsupported`);
    assert.ok(r.notes.includes(`contains ${c.kind}`), `notes: ${r.notes.join(" / ")}`);
  }
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
// RSTATE-04 / D-64-04: requireForceInstallable gate (loose mode)
// ──────────────────────────────────────────────────────────────────────────

test("RSTATE-04 loose: requireForceInstallable admits installable and exposes pluginRoot", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r: ResolvedPlugin = await resolveLoose(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable");
  requireForceInstallable(r);
  assert.equal(typeof r.pluginRoot, "string");
});

test("RSTATE-04 loose: requireForceInstallable admits unsupported and exposes pluginRoot", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r: ResolvedPlugin = await resolveLoose(
    basicEntry({ source: "./local", themes: ["dark"] }),
    ctx,
  );
  assert.equal(r.state, "unsupported");
  requireForceInstallable(r);
  assert.equal(typeof r.pluginRoot, "string");
});

test("RSTATE-04 loose: requireForceInstallable throws on unavailable", async () => {
  const ctx = mockCtx(MP, {});
  const r = await resolveLoose(basicEntry({ source: "./missing" }), ctx);
  assert.equal(r.state, "unavailable");
  assert.throws(
    () => {
      requireForceInstallable(r);
    },
    (err: unknown) =>
      err instanceof Error && err.message.includes('Plugin "p1" is not installable'),
  );
});
