// tests/domain/resolver-strict.test.ts
//
// Strict-mode resolver coverage. Per Open Question 5: 1:1 mapping between
// PR-2 cases and tests (9 tests for the 9 cases). Plus PR-3 multi, PR-4
// implicit-by-convention (positive + negative), PR-5 dependencies, PR-6
// requireInstallable narrowing/throwing, and one MM-5 happy path.

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

test("PR-2(5) / PR-3 declared unsupported component (hooks) -> notInstallable + 'contains hooks' note", async () => {
  const ctx = mockCtx(MP, { [ROOT("./local")]: "dir" });
  const r = await resolveStrict(basicEntry({ source: "./local", hooks: { onLoad: "x" } }), ctx);
  assert.equal(r.installable, false);
  assert.ok(
    r.notes.some((n) => n === "contains hooks"),
    `notes: ${r.notes.join(" / ")}`,
  );
  assert.ok(r.unsupported.includes("hooks"));
});

test("PR-4 hooks/hooks.json convention -> notInstallable + 'contains hooks' note", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: { contents: JSON.stringify({ hooks: {} }) },
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.installable, false);
  assert.ok(
    r.notes.some((n) => n === "contains hooks"),
    `notes: ${r.notes.join(" / ")}`,
  );
  assert.ok(r.unsupported.includes("hooks"));
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

// D-07 (COMP-01) narrows PR-2(9): top-level arrays of strings are now LEGAL.
// Only non-string elements (or nested arrays) inside the array are rejected
// at the element level. The error note now reads "is not a string" (from
// PR-2 case 7) or "contains nested array element" rather than "array-form".
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
// PR-4 [D-07/COMP-01 SUPERSEDED]: implicit-by-convention now SUPPLEMENTS
// declared paths rather than acting as a fallback-only short-circuit. The
// strict-resolver Step 7 computes the UNION of declared + implicit; first-
// wins dedup preserves declared-first ordering. The supersession docs land
// in Plan 05-10; the behavior change lands here.
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
