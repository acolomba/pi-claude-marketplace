// Quick 260516-02r: bootstrap orchestrator tests.
//
// Phase 13 Plan 13-02c-01 migration: the legacy sentence-form
// assertions (`Added marketplace ...`, `Enabled autoupdate: ...`,
// `Already enabled: ...`) have been migrated to the compact-line
// MarketplaceRow forms per CMC-28 / CMC-30 / CMC-33.
//
// Covers:
//   a. First run, clean state: addMarketplace + setMarketplaceAutoupdate
//      compose into TWO notifications: `● <mp> [user] <autoupdate>
//      (added)` followed by the marker-as-outcome `● <mp> [user]
//      <autoupdate>`.
//   b. Second run, fully idempotent: marketplace already present AND
//      autoupdate true. The duplicate-name path is swallowed so
//      addMarketplace does NOT emit; setMarketplaceAutoupdate emits
//      the single `● <mp> [user] <autoupdate> {already autoupdate}` row
//      (UXG-04 marker-as-outcome + idempotence brace).
//   c. Half-bootstrapped (autoupdate off): autoupdate flips to true,
//      emits ONE marker-as-outcome row.
//   d. User scope only: project-scope state file is never created.
//   e. Non-duplicate error from clone propagates and the autoupdate
//      step is NEVER reached.
//
// Inherited trade-off (WR-05 in orchestrators/marketplace/add.ts):
// `addMarketplace` for a GitHub source clones into a staging dir
// BEFORE the duplicate-name check (the derived name lives inside the
// cloned manifest). On the second-run / half-bootstrapped paths the
// orchestrator therefore DOES invoke `gitOps.clone` once. NFR-5
// concerns path-source / read-only commands; the existing add.test.ts
// MA-9 case ("the clone DID happen (NFR-5 not violated for github
// source)") documents the same behavior for the parent orchestrator.
// The plan's pre-execution claim that clone is never invoked on the
// idempotent path was inconsistent with the existing add design; this
// test follows the actual behavior rather than the pre-execution claim.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { bootstrapClaudePlugin } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { makeMockGitOps } from "../../helpers/git-mock.ts";

import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  // Plan 18-00: `pi` required on BootstrapOptions (mirroring the composed
  // marketplace orchestrators); mirror production wiring shape.
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

async function withHermeticHome<T>(
  fn: (env: { home: string; cwd: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "bootstrap-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "bootstrap-cwd-"));
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

function makeBootstrapMarketplaceRecord(
  cwd: string,
  autoupdate: boolean,
): ExtensionState["marketplaces"][string] {
  // The bootstrap target name; matches the manifest name field served
  // by the test fixture at
  // tests/orchestrators/plugin/_fixtures/claude-plugins-official.
  return {
    name: "claude-plugins-official",
    scope: "user",
    // Use a path source for the seeded record; bootstrap re-creates
    // the record from the (mocked) github clone source on first run.
    // For the second-run / half-bootstrapped paths the source field
    // is not read again, so the synthetic path source is harmless.
    source: pathSource("./seeded"),
    addedFromCwd: cwd,
    manifestPath: path.join(cwd, "marketplace.json"),
    marketplaceRoot: cwd,
    plugins: {},
    autoupdate,
  };
}

function fixtureClaudePluginsOfficial(): string {
  return path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "_fixtures",
    "claude-plugins-official",
  );
}

test("bootstrap (clean state): adds marketplace + enables autoupdate; two notifications", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    const { gitOps, state: gitState } = makeMockGitOps({
      fixtureSourceDir: fixtureClaudePluginsOfficial(),
    });

    await bootstrapClaudePlugin({ ctx, pi, cwd, gitOps });

    // State has the marketplace recorded under user scope with autoupdate=true.
    const userLocations = locationsFor("user", cwd);
    const userState = await loadState(userLocations.extensionRoot);
    assert.ok("claude-plugins-official" in userState.marketplaces);
    const recorded = userState.marketplaces["claude-plugins-official"];
    assert.ok(recorded);
    assert.equal(recorded.scope, "user");
    assert.equal(recorded.autoupdate, true);

    // Exactly two notifications in order. SNM-33 / D-22-01 / D-22-03:
    // both are marketplace-status-only blocks (no plugin rows), so NEITHER
    // carries the `/reload` trailer -- a marketplace record (and its
    // autoupdate flag) is not a Pi-visible resource. `addMarketplace` and
    // `setMarketplaceAutoupdate` both inherit the collapsed reload-hint rule.
    assert.equal(notifications.length, 2);
    assert.equal(notifications[0]?.message, "● claude-plugins-official [user] (added)");
    // UXG-04: fresh autoupdate enable renders the `<autoupdate>` marker-as-outcome.
    assert.equal(notifications[1]?.message, "● claude-plugins-official [user] <autoupdate>");
    // Clone happened exactly once on the clean path.
    assert.equal(gitState.cloneCalls.length, 1);
    assert.equal(
      gitState.cloneCalls[0]?.url,
      "https://github.com/anthropics/claude-plugins-official.git",
    );
  });
});

test("bootstrap (already bootstrapped): swallows duplicate-name, reports idempotent autoupdate", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Seed user state with the marketplace already present + autoupdate true.
    const userLocations = locationsFor("user", cwd);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    const seeded: ExtensionState = {
      schemaVersion: 1,
      marketplaces: {
        "claude-plugins-official": makeBootstrapMarketplaceRecord(cwd, true),
      },
    };
    await saveState(userLocations.extensionRoot, seeded);
    const before = await loadState(userLocations.extensionRoot);

    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureClaudePluginsOfficial(),
    });

    await bootstrapClaudePlugin({ ctx, pi, cwd, gitOps });

    // State unchanged (deep-equal, modulo the autoupdate field which was
    // already true; setMarketplaceAutoupdate hits the unchanged path).
    const after = await loadState(userLocations.extensionRoot);
    assert.deepEqual(after, before);
    // Exactly one notification: the idempotent autoupdate report.
    // UXG-04 catalog form -- the `<autoupdate>` marker-as-outcome + the
    // `{already autoupdate}` idempotence brace (no `(skipped)` token).
    // The benign reason `already autoupdate` (in BENIGN_REASONS) routes
    // severity to info per UXG-02 / D-28-06/07 (no severity arg).
    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]?.message,
      "● claude-plugins-official [user] <autoupdate> {already autoupdate}",
    );
    assert.equal(notifications[0]?.severity, undefined);
    // No `(added)` row in this run.
    assert.equal(
      notifications.some((n) => n.message.includes("(added)")),
      false,
    );
  });
});

test("bootstrap (half-configured: autoupdate off): swallows duplicate-name, flips autoupdate to true", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const userLocations = locationsFor("user", cwd);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: {
        "claude-plugins-official": makeBootstrapMarketplaceRecord(cwd, false),
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureClaudePluginsOfficial(),
    });

    await bootstrapClaudePlugin({ ctx, pi, cwd, gitOps });

    const after = await loadState(userLocations.extensionRoot);
    assert.equal(after.marketplaces["claude-plugins-official"]?.autoupdate, true);
    assert.equal(notifications.length, 1);
    // SNM-33 / D-22-03: UXG-04 `<autoupdate>` marker-as-outcome header-only
    // block, NO `/reload` trailer (the autoupdate flag is not a Pi-visible
    // resource).
    assert.equal(notifications[0]?.message, "● claude-plugins-official [user] <autoupdate>");
    // No `(added)` row in this run.
    assert.equal(
      notifications.some((n) => n.message.includes("(added)")),
      false,
    );
  });
});

test("bootstrap touches ONLY user scope: project-scope state file is never created", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi } = makeCtx();
    const { gitOps } = makeMockGitOps({
      fixtureSourceDir: fixtureClaudePluginsOfficial(),
    });

    await bootstrapClaudePlugin({ ctx, pi, cwd, gitOps });

    // Project scope must remain empty (loadState on missing dir returns
    // DEFAULT_STATE per persistence/state-io.ts).
    const projectLocations = locationsFor("project", cwd);
    const projectState = await loadState(projectLocations.extensionRoot);
    assert.deepEqual(projectState.marketplaces, {});

    // User scope must have the marketplace.
    const userLocations = locationsFor("user", cwd);
    const userState = await loadState(userLocations.extensionRoot);
    assert.ok("claude-plugins-official" in userState.marketplaces);
  });
});

test("bootstrap (non-duplicate clone error): propagates and autoupdate step is NOT reached", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    const cloneFailure = new Error("network down");
    const { gitOps, state: gitState } = makeMockGitOps({
      fixtureSourceDir: fixtureClaudePluginsOfficial(),
      cloneThrows: cloneFailure,
    });

    await assert.rejects(
      bootstrapClaudePlugin({ ctx, pi, cwd, gitOps }),
      (err: unknown): err is Error => err instanceof Error && err.message.includes("network down"),
    );

    // Clone was attempted exactly once.
    assert.equal(gitState.cloneCalls.length, 1);

    // No `(added)` row emitted (add failed before its notify).
    assert.equal(
      notifications.some((n) => n.message.includes("(added)")),
      false,
    );

    // The autoupdate step was never reached: no autoupdate-related
    // notification AND user state has no recorded marketplace.
    assert.equal(
      notifications.some((n) => /autoupdate/i.test(n.message)),
      false,
    );
    const userLocations = locationsFor("user", cwd);
    const userState = await loadState(userLocations.extensionRoot);
    assert.deepEqual(userState.marketplaces, {});
  });
});
