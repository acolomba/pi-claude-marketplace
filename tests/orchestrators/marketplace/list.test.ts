import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  githubSource,
  pathSource,
} from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { listMarketplaces } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  // Plan 18-00: `pi` required on ListMarketplacesOptions; mirror
  // production wiring shape (D-18-06 preserved).
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
 * is hermetic. Restores the original HOME afterward.
 */
async function withHermeticHome<T>(
  fn: (env: { home: string; cwd: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "mp-list-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-list-cwd-"));
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

test("CMC-10 + SC-6: bare form emits `(no marketplaces)` EmptyToken when both scopes are empty", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    await listMarketplaces({ ctx, pi, cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "(no marketplaces)");
    assert.equal(notifications[0]!.severity, undefined);
  });
});

test("CMC-29: project-scope marketplace renders flat row `● <name> [<scope>]` -- no group header, no source-label suffix", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const projectLocations = locationsFor("project", cwd);
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    await saveState(projectLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        local: {
          name: "local",
          scope: "project",
          source: pathSource("./local-src"),
          addedFromCwd: cwd,
          manifestPath: path.join(cwd, "marketplace.json"),
          marketplaceRoot: cwd,
          plugins: {},
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listMarketplaces({ ctx, pi, scope: "project", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "● local [project]");
  });
});

test("CMC-29: github source renders the same flat row form (no parenthesised URL suffix)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const projectLocations = locationsFor("project", cwd);
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    await saveState(projectLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        official: {
          name: "official",
          scope: "project",
          source: githubSource("https://github.com/anthropics/claude-plugins-official"),
          addedFromCwd: cwd,
          manifestPath: path.join(cwd, "marketplace.json"),
          marketplaceRoot: cwd,
          plugins: {},
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listMarketplaces({ ctx, pi, scope: "project", cwd });
    // CMC-29: row form is `<icon> <name> [<scope>] [<marker>]` -- no
    // parenthesised source URL/path suffix per the new style guide. The
    // source is only used to derive the marker default at `add` time;
    // list rows show the marker, not the URL.
    assert.equal(notifications[0]!.message, "● official [project]");
  });
});

test("CMC-05 / MSG-GR-5: autoupdate=true emits `<autoupdate>` marker", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const projectLocations = locationsFor("project", cwd);
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    await saveState(projectLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        auto: {
          name: "auto",
          scope: "project",
          source: pathSource("./auto-src"),
          addedFromCwd: cwd,
          manifestPath: path.join(cwd, "marketplace.json"),
          marketplaceRoot: cwd,
          plugins: {},
          autoupdate: true,
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listMarketplaces({ ctx, pi, scope: "project", cwd });
    assert.equal(notifications[0]!.message, "● auto [project] <autoupdate>");
  });
});

test("ML-V2 / UXG-01: list surface does NOT render `<last-updated <iso>>`; lastUpdatedAt persists in state but is no longer emitted", async () => {
  // Plan 18-03 backwards-compatible enrichment: the persisted record carries
  // `lastUpdatedAt` (set at `add`/`update` time per persistence/state-io.ts:70).
  // V2 originally rendered `<last-updated <iso>>` on the list surface, but
  // UXG-01 (Plan 27-02) dropped that token -- the raw ISO timestamp is noise
  // and meaningless for path-source marketplaces. The `lastUpdatedAt` field
  // STAYS in state/type; only the renderer emission was removed. This test
  // keeps `lastUpdatedAt` on the persisted record to prove the field still
  // round-trips through state while the byte form no longer carries the token,
  // binding against the canonical catalog UAT fixture `mixed-scopes`
  // (the `alpha [project]` row, now `● ... <autoupdate>` only).
  await withHermeticHome(async ({ cwd }) => {
    const projectLocations = locationsFor("project", cwd);
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    await saveState(projectLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "test-mp": {
          name: "test-mp",
          scope: "project",
          source: pathSource("./tm-src"),
          addedFromCwd: cwd,
          manifestPath: path.join(cwd, "marketplace.json"),
          marketplaceRoot: cwd,
          plugins: {},
          autoupdate: true,
          lastUpdatedAt: "2026-05-25T00:00:00Z",
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listMarketplaces({ ctx, pi, scope: "project", cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "● test-mp [project] <autoupdate>");
    // List surface emits info severity (no 2nd arg) per D-16-11.
    assert.equal(notifications[0]!.severity, undefined);
  });
});

test("SC-6: bare form enumerates BOTH user and project; user-only entry renders as a flat row", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const userLocations = locationsFor("user", cwd);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "user-only": {
          name: "user-only",
          scope: "user",
          source: pathSource("./u"),
          addedFromCwd: cwd,
          marketplaceRoot: cwd,
          manifestPath: path.join(cwd, "marketplace.json"),
          plugins: {},
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await listMarketplaces({ ctx, pi, cwd }); // bare form -- no scope
    assert.equal(notifications[0]!.message, "● user-only [user]");
  });
});

test("ML-3: list source has zero imports from domain/manifest (no manifest reads)", async () => {
  const src = await readFile(
    "extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts",
    "utf8",
  );
  const code = stripComments(src);
  assert.equal(code.includes("domain/manifest"), false);
  assert.equal(code.includes("MARKETPLACE_VALIDATOR"), false);
  assert.equal(code.includes("loadMarketplaceManifest"), false);
});

/**
 * Strip line and block comments before grepping for forbidden symbols.
 * The explanatory header in list.ts mentions forbidden imports in prose
 * (e.g., "NO `gitOps` surface"); the source-grep guards must inspect
 * code only, not commentary.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/^\s*\/\/.*$/gm, ""); // line comments
}

test("NFR-5: list source has zero imports from platform/git or gitOps surface", async () => {
  const src = await readFile(
    "extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts",
    "utf8",
  );
  const code = stripComments(src);
  assert.equal(code.includes("platform/git"), false);
  assert.equal(code.includes("DEFAULT_GIT_OPS"), false);
  assert.equal(code.includes("gitOps"), false);
});

test("D-04 corollary: list does not use withStateGuard", async () => {
  const src = await readFile(
    "extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts",
    "utf8",
  );
  const code = stripComments(src);
  assert.equal(code.includes("withStateGuard"), false);
});
