import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import lockfile from "proper-lockfile";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { setMarketplaceAutoupdate } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
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

async function withHermeticHome<T>(
  fn: (env: { home: string; cwd: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "mp-au-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-au-cwd-"));
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

function makeMarketplaceRecord(
  name: string,
  scope: "user" | "project",
  cwd: string,
  autoupdate?: boolean,
): ExtensionState["marketplaces"][string] {
  return {
    name,
    scope,
    source: pathSource("./src"),
    addedFromCwd: cwd,
    manifestPath: path.join(cwd, "marketplace.json"),
    marketplaceRoot: cwd,
    plugins: {},
    ...(autoupdate !== undefined && { autoupdate }),
  };
}

test("MAU-1: enable=true on a single marketplace flips flag from false -> true and emits 'Enabled autoupdate: <name>.'", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd, false) },
    });

    const { ctx, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, name: "mp", enable: true, scope: "project", cwd });

    const after = await loadState(locations.extensionRoot);
    assert.equal(after.marketplaces["mp"]!.autoupdate, true);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "Enabled autoupdate: mp.");
  });
});

test("MAU-1: enable=false flips flag from true -> false and emits 'Disabled autoupdate: <name>.'", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd, true) },
    });
    const { ctx, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, name: "mp", enable: false, scope: "project", cwd });
    const after = await loadState(locations.extensionRoot);
    assert.equal(after.marketplaces["mp"]!.autoupdate, false);
    assert.equal(notifications[0]!.message, "Disabled autoupdate: mp.");
  });
});

test("MAU-3: idempotent -- already-true + enable=true emits 'Already enabled: <name>.' and does NOT change state", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd, true) },
    });
    const { ctx, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, name: "mp", enable: true, scope: "project", cwd });
    const after = await loadState(locations.extensionRoot);
    assert.equal(after.marketplaces["mp"]!.autoupdate, true);
    assert.equal(notifications[0]!.message, "Already enabled: mp.");
  });
});

test("MAU-3: idempotent -- already-false + enable=false emits 'Already disabled: <name>.'", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd, false) },
    });
    const { ctx, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, name: "mp", enable: false, scope: "project", cwd });
    assert.equal(notifications[0]!.message, "Already disabled: mp.");
  });
});

test("MAU-4: missing autoupdate field treated as false; enable=true flips it to true", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    // No autoupdate field -- treated as false per MAU-4.
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd) },
    });
    const { ctx, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, name: "mp", enable: true, scope: "project", cwd });
    const after = await loadState(locations.extensionRoot);
    assert.equal(after.marketplaces["mp"]!.autoupdate, true);
    assert.equal(notifications[0]!.message, "Enabled autoupdate: mp.");
  });
});

test("MAU-4: missing autoupdate field treated as false; enable=false reports 'Already disabled' (idempotent)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd) },
    });
    const { ctx, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, name: "mp", enable: false, scope: "project", cwd });
    assert.equal(notifications[0]!.message, "Already disabled: mp.");
  });
});

test("MAU-2: bare form (no name) flips every marketplace in scope; mixed changed + unchanged emits both lines", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    // Two marketplaces: one already true, one false.
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        already: makeMarketplaceRecord("already", "project", cwd, true),
        "to-flip": makeMarketplaceRecord("to-flip", "project", cwd, false),
      },
    });
    const { ctx, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, enable: true, scope: "project", cwd });

    const after = await loadState(locations.extensionRoot);
    assert.equal(after.marketplaces["already"]!.autoupdate, true);
    assert.equal(after.marketplaces["to-flip"]!.autoupdate, true);

    // Both lines present.
    assert.match(notifications[0]!.message, /Enabled autoupdate: to-flip\./);
    assert.match(notifications[0]!.message, /Already enabled: already\./);
  });
});

test("SC-6: bare form across both scopes -- explicit empty scopes succeeds with marker string", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, enable: true, cwd }); // no name, no scope
    assert.equal(notifications[0]!.message, "No marketplaces configured.");
  });
});

test("Single-name flip across BOTH scopes when --scope omitted: flips in user scope only does NOT surface project-scope-not-found error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const userLocations = locationsFor("user", cwd);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { only: makeMarketplaceRecord("only", "user", cwd, false) },
    });
    const { ctx, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, name: "only", enable: true, cwd });
    // user-scope flip succeeded; project-scope MarketplaceNotFoundError was swallowed gracefully.
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "Enabled autoupdate: only.");
    assert.notEqual(notifications[0]!.severity, "error");
  });
});

test("single-name cross-scope flip surfaces state lock failures instead of reporting partial success", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const userLocations = locationsFor("user", cwd);
    const projectLocations = locationsFor("project", cwd);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    await mkdir(projectLocations.extensionRoot, { recursive: true });
    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { only: makeMarketplaceRecord("only", "user", cwd, false) },
    });
    const release = await lockfile.lock(projectLocations.extensionRoot, {
      lockfilePath: projectLocations.stateLockFile,
      realpath: false,
    });

    try {
      const { ctx, notifications } = makeCtx();
      await setMarketplaceAutoupdate({ ctx, name: "only", enable: true, cwd });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]!.severity, "error");
      assert.match(
        notifications[0]!.message,
        /Another pi-claude-marketplace operation is in progress/,
      );
    } finally {
      await release();
    }
  });
});

test("Single-name flip across BOTH scopes when name absent from BOTH scopes: surfaces error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, name: "absent-zzz-9999", enable: true, cwd });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
  });
});

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/^\s*\/\/.*$/gm, ""); // line comments
}

test("NFR-5: autoupdate source has zero references to platform/git, gitOps, or DEFAULT_GIT_OPS", async () => {
  const src = await readFile(
    "extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts",
    "utf8",
  );
  const code = stripComments(src);
  assert.equal(code.includes("platform/git"), false);
  assert.equal(code.includes("DEFAULT_GIT_OPS"), false);
  assert.equal(code.includes("gitOps"), false);
});
