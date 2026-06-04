// tests/orchestrators/marketplace/info.test.ts
//
// Phase 43 / Plan 43-01 / Task 2: integration tests for the read-only
// `getMarketplaceInfo` orchestrator. Hermetic HOME + tmp cwd + saveState
// fixtures; the orchestrator is the SOLE site that projects local
// marketplace state into the Phase 42 info-message variants.
//
// Coverage:
//   (a) single-scope github + autoupdate + lastUpdatedAt + description
//   (b) single-scope github no `ref`
//   (c) single-scope path source (no last_updated, no description)
//   (d) single-scope marketplace.json without `description`
//   (e) both-scopes fan-out (project-first per MSG-GR-3 / INFO-03)
//   (f) `--scope` mismatch in project only, requested user
//   (g) `--scope` mismatch in user only, requested project
//   (h) absent from both scopes, no `--scope` -> bare row, no [scope]
//   (i) NFR-5 grep-gate: no `platform/git` / `DEFAULT_GIT_OPS` /
//       `refreshGitHubClone` imports in `info.ts`
//   (j) barrel re-export: `orchestrators/marketplace/index.ts` exposes
//       `getMarketplaceInfo`

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  githubSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { getMarketplaceInfo } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const pi = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
    pi,
  } as unknown as ExtensionContext;
  return { ctx, pi, notifications };
}

/**
 * Run a callback with HOME pointing at a tmp dir so user-scope state
 * is hermetic. Restores HOME after.
 */
async function withHermeticHome<T>(
  fn: (env: { home: string; cwd: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "mp-info-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-info-cwd-"));
  process.env.HOME = home;
  try {
    return await fn({ home, cwd });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
}

/**
 * Write a minimal `marketplace.json` at the given path. Optional
 * `description` is appended as a top-level field (the schema permits
 * additional properties per Phase 43 info-surface conventions).
 */
async function writeMarketplaceJson(
  manifestPath: string,
  name: string,
  description?: string,
): Promise<void> {
  await mkdir(path.dirname(manifestPath), { recursive: true });
  const obj: Record<string, unknown> = { name, plugins: [] };
  if (description !== undefined) {
    obj.description = description;
  }

  await writeFile(manifestPath, JSON.stringify(obj));
}

test("INFO-01: single-scope github source with autoupdate + lastUpdatedAt + description renders the 4-line body", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const userLocations = locationsFor("user", cwd);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    const manifestPath = path.join(userLocations.extensionRoot, "claude-plugins-official.json");
    await writeMarketplaceJson(
      manifestPath,
      "claude-plugins-official",
      "Official Claude marketplace",
    );

    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "claude-plugins-official": {
          name: "claude-plugins-official",
          scope: "user",
          source: githubSource("https://github.com/anthropics/claude-plugins-official#main"),
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot: cwd,
          plugins: {},
          autoupdate: true,
          lastUpdatedAt: "2026-06-03T00:00:00Z",
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getMarketplaceInfo({ ctx, pi, name: "claude-plugins-official", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● claude-plugins-official [user] <autoupdate>",
        "github: anthropics/claude-plugins-official#main",
        "last_updated: 2026-06-03T00:00:00Z",
        "description: Official Claude marketplace",
      ].join("\n"),
    );
  });
});

test("INFO-01: single-scope github source with NO ref drops the #<ref> suffix from the `github:` line", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const userLocations = locationsFor("user", cwd);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    const manifestPath = path.join(userLocations.extensionRoot, "mp.json");
    await writeMarketplaceJson(manifestPath, "mp");

    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        mp: {
          name: "mp",
          scope: "user",
          source: githubSource("https://github.com/owner/repo"),
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot: cwd,
          plugins: {},
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getMarketplaceInfo({ ctx, pi, name: "mp", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    // No `#<ref>` suffix; autoupdate defaults to false on the info surface.
    assert.equal(
      notifications[0]!.message,
      ["● mp [user] <no autoupdate>", "github: owner/repo"].join("\n"),
    );
  });
});

test("INFO-01: single-scope path source renders `path: <abs>`; NO `last_updated:`; NO `description:`", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const projectLocations = locationsFor("project", cwd);
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    const manifestPath = path.join(projectLocations.extensionRoot, "local-mp.json");
    await writeMarketplaceJson(manifestPath, "local-mp");

    await saveState(projectLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "local-mp": {
          name: "local-mp",
          scope: "project",
          source: pathSource("/abs/path/to/mp"),
          addedFromCwd: cwd,
          manifestPath,
          // NOTE: `marketplaceRoot` is what the renderer emits on the
          // `path:` line per the orchestrator's path-source projection.
          marketplaceRoot: "/abs/path/to/mp",
          plugins: {},
          autoupdate: false,
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getMarketplaceInfo({ ctx, pi, name: "local-mp", scope: "project", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      ["● local-mp [project] <no autoupdate>", "path: /abs/path/to/mp"].join("\n"),
    );
  });
});

test("INFO-01: single-scope github source with marketplace.json missing description renders WITHOUT a description line", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const userLocations = locationsFor("user", cwd);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    const manifestPath = path.join(userLocations.extensionRoot, "no-desc.json");
    // No `description` field on the manifest -> renderer omits the line.
    await writeMarketplaceJson(manifestPath, "no-desc");

    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "no-desc": {
          name: "no-desc",
          scope: "user",
          source: githubSource("https://github.com/o/no-desc"),
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot: cwd,
          plugins: {},
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getMarketplaceInfo({ ctx, pi, name: "no-desc", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.ok(
      !notifications[0]!.message.includes("description:"),
      "body must not carry a `description:` line when marketplace.json lacks one",
    );
  });
});

test("INFO-03: both-scopes fan-out emits ONE notify call; project block FIRST, user block SECOND, joined by one blank line", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const projectLocations = locationsFor("project", cwd);
    const userLocations = locationsFor("user", cwd);
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    await mkdir(userLocations.extensionRoot, { recursive: true });
    const projectManifest = path.join(projectLocations.extensionRoot, "my-mp.json");
    const userManifest = path.join(userLocations.extensionRoot, "my-mp.json");
    await writeMarketplaceJson(projectManifest, "my-mp");
    await writeMarketplaceJson(userManifest, "my-mp");

    await saveState(projectLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "my-mp": {
          name: "my-mp",
          scope: "project",
          source: pathSource("/repo/path/my-mp"),
          addedFromCwd: cwd,
          manifestPath: projectManifest,
          marketplaceRoot: "/repo/path/my-mp",
          plugins: {},
          autoupdate: true,
        },
      },
    });
    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "my-mp": {
          name: "my-mp",
          scope: "user",
          source: githubSource("https://github.com/someuser/my-mp"),
          addedFromCwd: cwd,
          manifestPath: userManifest,
          marketplaceRoot: cwd,
          plugins: {},
          autoupdate: false,
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getMarketplaceInfo({ ctx, pi, name: "my-mp", cwd });
    assert.equal(notifications.length, 1, "IL-2: exactly one ctx.ui.notify call");
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● my-mp [project] <autoupdate>",
        "path: /repo/path/my-mp",
        "",
        "● my-mp [user] <no autoupdate>",
        "github: someuser/my-mp",
      ].join("\n"),
    );
  });
});

test("INFO-04: --scope user mismatch (mp only in project) emits bare `{not added}` row with severity error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const projectLocations = locationsFor("project", cwd);
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    const manifestPath = path.join(projectLocations.extensionRoot, "p-only.json");
    await writeMarketplaceJson(manifestPath, "p-only");

    await saveState(projectLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "p-only": {
          name: "p-only",
          scope: "project",
          source: pathSource("/p"),
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot: "/p",
          plugins: {},
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getMarketplaceInfo({ ctx, pi, name: "p-only", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "⊘ p-only [user] (failed) {not added}");
    assert.equal(notifications[0]!.severity, "error");
  });
});

test("INFO-04: --scope project mismatch (mp only in user) emits bare `{not added}` row with severity error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const userLocations = locationsFor("user", cwd);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    const manifestPath = path.join(userLocations.extensionRoot, "u-only.json");
    await writeMarketplaceJson(manifestPath, "u-only");

    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "u-only": {
          name: "u-only",
          scope: "user",
          source: pathSource("/u"),
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot: "/u",
          plugins: {},
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getMarketplaceInfo({ ctx, pi, name: "u-only", scope: "project", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "⊘ u-only [project] (failed) {not added}");
    assert.equal(notifications[0]!.severity, "error");
  });
});

test("D-03: absent from BOTH scopes with no --scope renders `(failed) {not added}` WITHOUT any [scope] bracket", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    await getMarketplaceInfo({ ctx, pi, name: "ghost-mp", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "⊘ ghost-mp (failed) {not added}");
    assert.equal(notifications[0]!.severity, "error");
    assert.ok(
      !notifications[0]!.message.includes("[user]") &&
        !notifications[0]!.message.includes("[project]"),
      "absent-from-both must NOT carry a [scope] bracket (D-03)",
    );
  });
});

// ---------------------------------------------------------------------------
// Source-coerce fallback (NFR-12 forward-compat): non-github source kinds
// (`url`, `git-subdir`, `npm`, `unknown`) coerce to the `path` arm with
// `record.marketplaceRoot` as the absolute path.
// ---------------------------------------------------------------------------

test('NFR-12: forward-compat `kind: "unknown"` source coerces to the `path:` arm with marketplaceRoot', async () => {
  await withHermeticHome(async ({ cwd }) => {
    const userLocations = locationsFor("user", cwd);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    const manifestPath = path.join(userLocations.extensionRoot, "unknown-mp.json");
    await writeMarketplaceJson(manifestPath, "unknown-mp");

    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "unknown-mp": {
          name: "unknown-mp",
          scope: "user",
          // Forward-compat tail: `normalizeStoredSource` accepts
          // `kind: "unknown"` records verbatim. The orchestrator must
          // coerce non-github discriminators to the `path:` arm so a
          // future source kind still renders rather than silently
          // throwing on a missing discriminator branch.
          source: { kind: "unknown", raw: "npm:foo@1.0.0", reason: "future kind" },
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot: "/abs/path/to/unknown-mp",
          plugins: {},
        },
      },
    } as unknown as Parameters<typeof saveState>[1]);

    const { ctx, pi, notifications } = makeCtx();
    await getMarketplaceInfo({ ctx, pi, name: "unknown-mp", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.match(notifications[0]!.message, /^path: \/abs\/path\/to\/unknown-mp$/m);
  });
});

// ---------------------------------------------------------------------------
// Manifest read/parse failures surface as `(failed) {<reason>}` rows
// instead of silently swallowing to `description: undefined`. Mirrors
// the `plugin/info.ts` discipline.
// ---------------------------------------------------------------------------

test("Manifest missing on disk surfaces `(failed) {source missing}` row, not silent success", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const userLocations = locationsFor("user", cwd);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    const manifestPath = path.join(userLocations.extensionRoot, "missing-mp.json");
    // Intentionally do NOT write the manifest -- ENOENT on read.

    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "missing-mp": {
          name: "missing-mp",
          scope: "user",
          source: pathSource("./missing-src"),
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot: "/abs/missing-mp",
          plugins: {},
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getMarketplaceInfo({ ctx, pi, name: "missing-mp", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    // ENOENT classifier -> `source missing`. The pre-fix body would
    // have been the success body without a `description:` line, with
    // info severity -- silent.
    assert.match(notifications[0]!.message, /\(failed\) \{source missing\}/);
  });
});

test("Manifest with malformed JSON surfaces `(failed) {unparseable}` row, not silent success", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const userLocations = locationsFor("user", cwd);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    const manifestPath = path.join(userLocations.extensionRoot, "bad-mp.json");
    await mkdir(path.dirname(manifestPath), { recursive: true });
    await writeFile(manifestPath, "{ not valid json", "utf8");

    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "bad-mp": {
          name: "bad-mp",
          scope: "user",
          source: pathSource("./bad-src"),
          addedFromCwd: cwd,
          manifestPath,
          marketplaceRoot: "/abs/bad-mp",
          plugins: {},
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getMarketplaceInfo({ ctx, pi, name: "bad-mp", scope: "user", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /\(failed\) \{unparseable\}/);
  });
});

test("NFR-5: info.ts has zero imports from platform/git, DEFAULT_GIT_OPS, or refreshGitHubClone", async () => {
  const src = await readFile(
    "extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts",
    "utf8",
  );
  // Strip comments before grep so the explanatory header that mentions
  // forbidden symbols in PROSE does not produce false positives.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(code.includes("platform/git"), false, "info.ts must not import platform/git");
  assert.equal(
    code.includes("DEFAULT_GIT_OPS"),
    false,
    "info.ts must not reference DEFAULT_GIT_OPS",
  );
  assert.equal(
    code.includes("refreshGitHubClone"),
    false,
    "info.ts must not reference refreshGitHubClone",
  );
});

test("Barrel: orchestrators/marketplace/index.ts re-exports getMarketplaceInfo and GetMarketplaceInfoOptions", async () => {
  // Static-import the symbol via the barrel; both name + type re-exports
  // must resolve at typecheck time. The runtime assertion below proves
  // the named export is a function (not undefined).
  const mod =
    await import("../../../extensions/pi-claude-marketplace/orchestrators/marketplace/index.ts");
  assert.equal(typeof mod.getMarketplaceInfo, "function");
});
