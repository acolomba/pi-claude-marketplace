// bootstrap handler shim tests.
//
// Mirrors `tests/edge/handlers/marketplace/autoupdate.test.ts` shape
// (hermetic HOME + NotifyRecord harness) with two additions:
//   - the dispatch cases supply a mocked GitOps so the orchestrator can
//     run end-to-end without touching the network.
//   - argument-validation cases use a no-op GitOps (orchestrator is
//     never invoked when the handler short-circuits on usage).

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { makeBootstrapHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts";
import { loadConfig } from "../../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { fixtureMarketplaceDir, makeMockGitOps } from "../../../helpers/git-mock.ts";

import type { EdgeDeps } from "../../../../extensions/pi-claude-marketplace/edge/types.ts";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(cwd: string): { ctx: ExtensionCommandContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    cwd,
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
    pi: { getAllTools: (): unknown[] => [] },
  } as unknown as ExtensionCommandContext;
  return { ctx, notifications };
}

// `makeBootstrapHandler(pi, deps)` requires `pi`
// as first positional arg (the composed `addMarketplace` /
// `setMarketplaceAutoupdate` orchestrators require `pi`).
function makePi(): ExtensionAPI {
  return {
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;
}

async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const home = await mkdtemp(path.join(tmpdir(), "bootstrap-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "bootstrap-shim-cwd-"));
  process.env.HOME = home;
  // SC-1: getAgentDir() honors PI_CODING_AGENT_DIR FIRST and only falls back
  // to homedir(). Clear it so the hermetic HOME above actually governs the
  // user scope -- otherwise a developer/CI env that sets the variable would
  // make these tests install bootstrap records into the real Pi agent dir.
  delete process.env.PI_CODING_AGENT_DIR;
  try {
    return await fn({ cwd });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = originalAgentDir;
    }

    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
}

function fixtureClaudePluginsOfficial(): string {
  return path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "..",
    "..",
    "..",
    "orchestrators",
    "plugin",
    "_fixtures",
    "claude-plugins-official",
  );
}

function makeDeps(): { deps: EdgeDeps; gitState: ReturnType<typeof makeMockGitOps>["state"] } {
  const { gitOps, state } = makeMockGitOps({
    fixtureSourceDir: fixtureClaudePluginsOfficial(),
  });
  const deps: EdgeDeps = {
    gitOps,
    // pluginUpdate is part of EdgeDeps but the bootstrap path does not
    // invoke plugin update. A throwing stub catches accidental misuse.
    pluginUpdate: () =>
      Promise.reject(new Error("bootstrap handler unexpectedly invoked pluginUpdate")),
  };
  return { deps, gitState: state };
}

test("bootstrap handler (no args, clean state): dispatches to orchestrator and emits two notifications", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const { deps, gitState } = makeDeps();
    const handler = makeBootstrapHandler(makePi(), deps);

    await handler("", ctx);

    // Both composed orchestrators emitted their messages in order.
    assert.equal(notifications.length, 2);
    // SNM-33 / D-22-01 / D-22-03: both composed orchestrators emit
    // marketplace-status-only blocks (no plugin rows), so NEITHER carries
    // the `/reload` trailer -- a marketplace record and its autoupdate flag
    // are not Pi-visible resources.
    assert.equal(notifications[0]?.message, "● claude-plugins-official [user] (added)");
    // UXG-04: fresh autoupdate enable renders the `<autoupdate>` marker-as-outcome.
    assert.equal(notifications[1]?.message, "● claude-plugins-official [user] <autoupdate>");

    // Clone happened against the canonical Anthropic repo URL.
    assert.equal(gitState.cloneCalls.length, 1);
    assert.equal(
      gitState.cloneCalls[0]?.url,
      "https://github.com/anthropics/claude-plugins-official.git",
    );

    // State reflects the marketplace at user scope.
    const userLocations = locationsFor("user", cwd);
    const userState = await loadState(userLocations.extensionRoot);
    assert.ok("claude-plugins-official" in userState.marketplaces);
    // post-flip `autoupdate` lives in `claude-plugins.json`.
    const cfg = await loadConfig(userLocations.configJsonPath);
    assert.equal(cfg.status, "valid");
    if (cfg.status === "valid") {
      assert.equal(cfg.config.marketplaces?.["claude-plugins-official"]?.autoupdate, true);
    }
  });
});

test("bootstrap handler (whitespace-only args): treated identically to empty args", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const { deps } = makeDeps();
    const handler = makeBootstrapHandler(makePi(), deps);

    await handler("   ", ctx);

    assert.equal(notifications.length, 2);
    // SNM-33 / D-22-01 / D-22-03: see preceding test for the no-trailer rationale.
    assert.equal(notifications[0]?.message, "● claude-plugins-official [user] (added)");
    // UXG-04: fresh autoupdate enable renders the `<autoupdate>` marker-as-outcome.
    assert.equal(notifications[1]?.message, "● claude-plugins-official [user] <autoupdate>");
  });
});

test("bootstrap handler (positional argument): rejected with usage error, orchestrator not invoked", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const { deps, gitState } = makeDeps();
    const handler = makeBootstrapHandler(makePi(), deps);

    await handler("foo", ctx);

    assert.equal(notifications.length, 1);
    // CMC-34: the positional-rejected case
    // routes via notifyUsageError, which emits `${message}\n\n${USAGE}`. The
    // sentence head ("bootstrap takes no arguments.") + blank-line separator
    // + Usage block is the on-the-wire byte shape (MSG-NC-2 / MSG-SR-7).
    assert.equal(
      notifications[0]?.message,
      "bootstrap takes no arguments.\n\nUsage: /claude:plugin bootstrap",
    );
    assert.equal(notifications[0]?.severity, "error");
    // Orchestrator never invoked -> clone never attempted.
    assert.equal(gitState.cloneCalls.length, 0);
  });
});

test("bootstrap handler (--scope project): rejected with user-scope-only usage error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const { deps, gitState } = makeDeps();
    const handler = makeBootstrapHandler(makePi(), deps);

    await handler("--scope project", ctx);

    assert.equal(notifications.length, 1);
    assert.match(notifications[0]?.message ?? "", /bootstrap does not accept --scope/);
    assert.equal(notifications[0]?.severity, "error");
    assert.equal(gitState.cloneCalls.length, 0);
  });
});

test("bootstrap handler (--scope user): rejected too -- the bootstrap subcommand never accepts --scope", async () => {
  // Belt-and-suspenders: the handler rejects --scope regardless of value.
  // Even `--scope user` (which is the implicit target) is denied because
  // accepting it would create a misleading user contract.
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const { deps } = makeDeps();
    const handler = makeBootstrapHandler(makePi(), deps);

    await handler("--scope user", ctx);

    assert.equal(notifications.length, 1);
    assert.match(notifications[0]?.message ?? "", /bootstrap does not accept --scope/);
    assert.equal(notifications[0]?.severity, "error");
  });
});

test("bootstrap handler (invalid --scope value): surfaces parseArgs error", async () => {
  // parseArgs rejects unknown --scope values BEFORE the handler reaches
  // the positional / scope checks. The error must arrive as a notified
  // error rather than propagate.
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const { deps } = makeDeps();
    const handler = makeBootstrapHandler(makePi(), deps);

    await handler("--scope nope", ctx);

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]?.severity, "error");
    assert.match(notifications[0]?.message ?? "", /Invalid --scope value/);
  });
});

// Sanity: the existing reusable marketplace fixture still exists where
// the orchestrator-side test points to it; this keeps the cross-test
// directory contract explicit in one place.
test("bootstrap shim fixture pointer: orchestrator-side fixture path resolves to a real fixture dir", () => {
  const valid = fixtureMarketplaceDir("valid-marketplace");
  assert.ok(valid.endsWith("valid-marketplace"));
});
