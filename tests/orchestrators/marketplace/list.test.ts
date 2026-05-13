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

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
    pi: { getAllTools: (): unknown[] => [] },
  } as unknown as ExtensionContext;
  return { ctx, notifications };
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

test("ML-4 + SC-6: bare form (no scope) emits 'No marketplaces configured.' when both scopes are empty", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx();
    await listMarketplaces({ ctx, cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "No marketplaces configured.");
    assert.equal(notifications[0]!.severity, undefined);
  });
});

test("ML-1 + ML-2: project-scope marketplace renders one line under project heading with path source", async () => {
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

    const { ctx, notifications } = makeCtx();
    await listMarketplaces({ ctx, scope: "project", cwd });
    assert.equal(notifications.length, 1);
    assert.match(
      notifications[0]!.message,
      /project scope marketplaces:\n\s+● local \(\.\/local-src\)/,
    );
  });
});

test("ML-2: github source renders canonical URL", async () => {
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

    const { ctx, notifications } = makeCtx();
    await listMarketplaces({ ctx, scope: "project", cwd });
    assert.match(
      notifications[0]!.message,
      /● official \(https:\/\/github\.com\/anthropics\/claude-plugins-official\)/,
    );
  });
});

test("ML-2: autoupdate flag appends ' [autoupdate]' suffix", async () => {
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

    const { ctx, notifications } = makeCtx();
    await listMarketplaces({ ctx, scope: "project", cwd });
    assert.match(notifications[0]!.message, /● auto \(\.\/auto-src\) \[autoupdate\]/);
  });
});

test("SC-6: bare form enumerates BOTH user and project; user-only entry appears under user heading", async () => {
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
          manifestPath: path.join(cwd, "marketplace.json"),
          marketplaceRoot: cwd,
          plugins: {},
        },
      },
    });

    const { ctx, notifications } = makeCtx();
    await listMarketplaces({ ctx, cwd }); // bare form -- no scope
    assert.match(notifications[0]!.message, /user scope marketplaces:\n\s+● user-only/);
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
