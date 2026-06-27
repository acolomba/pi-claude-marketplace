// D-07 (COMP-01) fixture coverage. The strict-resolver Step 7 computes
// the UNION of declared (entry > manifest) + implicit-by-convention paths
// with first-wins dedup. Three fixtures lock the contract:
//
//   (a) default-only: only `<pluginRoot>/skills/` exists; manifest absent.
//       Implicit-by-convention populates the array.
//   (b) custom-only:  manifest declares `["custom/skills"]`; default
//       `<pluginRoot>/skills/` does NOT exist. Only the declared path lands
//       in the array.
//   (c) BOTH:         manifest declares `["custom/skills"]` AND default
//       `<pluginRoot>/skills/` exists. UNION yields BOTH paths with
//       declared-first ordering.

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  type ResolveContext,
  resolveStrict,
} from "../../extensions/pi-claude-marketplace/domain/resolver.ts";

import type { PluginEntry } from "../../extensions/pi-claude-marketplace/domain/components/plugin.ts";

/**
 * Hermetic ResolveContext factory. Mirrors the `mockCtx` pattern used in
 * `tests/domain/resolver-strict.test.ts`: `files` maps absolute paths to
 * either "dir" / "file" / { contents }; readFileText resolves only entries
 * whose value is an object with `contents`.
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

type LooseEntry = Record<string, unknown>;
function basicEntry(over: LooseEntry = {}): PluginEntry {
  return { name: "p1", source: "./local", ...over };
}

// ──────────────────────────────────────────────────────────────────────────
// Fixture (a): default-only -- implicit-by-convention populates the array.
// ──────────────────────────────────────────────────────────────────────────

test("COMP-01 (a) default skills/ only, no manifest field -> ['skills']", async () => {
  const localRoot = ROOT("./local");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [path.join(localRoot, "skills")]: "dir",
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes: ${r.notes.join(" / ")}`);
  if (r.state === "installable") {
    assert.deepEqual(r.componentPaths.skills, ["skills"]);
    assert.ok(r.supported.includes("skills"));
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Fixture (b): custom-only -- manifest declares custom path, default absent.
// ──────────────────────────────────────────────────────────────────────────

test("COMP-01 (b) manifest declares ['custom/skills']; default skills/ absent -> ['custom/skills']", async () => {
  const localRoot = ROOT("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", skills: ["custom/skills"] }) },
    [path.join(localRoot, "custom", "skills")]: "dir",
    // NOTE: /local/skills is intentionally absent.
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes: ${r.notes.join(" / ")}`);
  if (r.state === "installable") {
    assert.deepEqual(r.componentPaths.skills, ["custom/skills"]);
    assert.ok(r.supported.includes("skills"));
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Fixture (c): BOTH manifest ['custom/skills'] AND default skills/ exist ->
// UNION (declared-first ordering, implicit appended; first-wins dedup).
// ──────────────────────────────────────────────────────────────────────────

test("COMP-01 (c) BOTH manifest ['custom/skills'] AND default skills/ -> UNION ['custom/skills', 'skills']", async () => {
  const localRoot = ROOT("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", skills: ["custom/skills"] }) },
    [path.join(localRoot, "custom", "skills")]: "dir",
    [path.join(localRoot, "skills")]: "dir", // default ALSO exists
  });
  const r = await resolveStrict(basicEntry({ source: "./local" }), ctx);
  assert.equal(r.state, "installable", `notes: ${r.notes.join(" / ")}`);
  if (r.state === "installable") {
    // Declared first, implicit appended after, deduplicated.
    assert.deepEqual(r.componentPaths.skills, ["custom/skills", "skills"]);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Bonus: entry overrides manifest order; declared-first wins; dedup applies.
// ──────────────────────────────────────────────────────────────────────────

test("COMP-01 entry > manifest declared order; first-wins dedup across both", async () => {
  const localRoot = ROOT("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const ctx = mockCtx(MP, {
    [localRoot]: "dir",
    [manifestPath]: {
      // manifest declares "shared" AND "manifest-only"
      contents: JSON.stringify({ name: "p1", skills: ["shared", "manifest-only"] }),
    },
    [path.join(localRoot, "entry-only")]: "dir",
    [path.join(localRoot, "shared")]: "dir",
    [path.join(localRoot, "manifest-only")]: "dir",
  });
  // entry declares "entry-only" AND "shared"
  const r = await resolveStrict(
    basicEntry({ source: "./local", skills: ["entry-only", "shared"] }),
    ctx,
  );
  assert.equal(r.state, "installable", `notes: ${r.notes.join(" / ")}`);
  if (r.state === "installable") {
    // Order: entry first ("entry-only", "shared"), then manifest's unique
    // contribution ("manifest-only"); "shared" deduped on second occurrence.
    // Implicit-by-convention "skills" is NOT present here because the conventional
    // dir <pluginRoot>/skills was not registered in the statMap.
    assert.deepEqual(r.componentPaths.skills, ["entry-only", "shared", "manifest-only"]);
  }
});
