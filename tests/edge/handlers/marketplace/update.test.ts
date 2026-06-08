// marketplace update handler shim tests.
//
// Two forms via optional positional:
//   - bare    -> updateAllMarketplaces (empty-set silent success on
//                  fresh state -> `(no marketplaces)` EmptyToken per
//                  CMC-10)
//   - <name>  -> updateMarketplace (SC#1 convergence: a missing marketplace
//                  routes to the standalone `(failed) {not added}` variant,
//                  NOT a raw MarketplaceNotFoundError)

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { makeMarketplaceUpdateHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/marketplace/update.ts";
import { makeMockGitOps } from "../../../helpers/git-mock.ts";

import type { EdgeDeps } from "../../../../extensions/pi-claude-marketplace/edge/types.ts";
import type { PluginUpdateOutcome } from "../../../../extensions/pi-claude-marketplace/orchestrators/types.ts";
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
  } as unknown as ExtensionCommandContext;
  return { ctx, notifications };
}

// `makeMarketplaceUpdateHandler(pi, deps)` requires
// `pi` as first positional arg.
function makePi(): ExtensionAPI {
  return {
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;
}

function makeDeps(): { deps: EdgeDeps; pluginUpdateCalls: string[] } {
  const gitMock = makeMockGitOps();
  const pluginUpdateCalls: string[] = [];
  const pluginUpdate = (plugin: string): Promise<PluginUpdateOutcome> => {
    pluginUpdateCalls.push(plugin);
    return Promise.resolve({
      partition: "unchanged",
      name: plugin,
      fromVersion: "0.0.0",
      toVersion: "0.0.0",
      declaresAgents: false,
      declaresMcp: false,
    });
  };

  const deps: EdgeDeps = { gitOps: gitMock.gitOps, pluginUpdate };
  return { deps, pluginUpdateCalls };
}

async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "mp-update-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-update-shim-cwd-"));
  process.env.HOME = home;
  try {
    return await fn({ cwd });
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

test("shim :: bare /marketplace update calls updateAllMarketplaces", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const { deps } = makeDeps();
    const handler = makeMarketplaceUpdateHandler(makePi(), deps);
    await handler("", ctx);
    // updateAllMarketplaces on fresh state -> "No marketplaces configured."
    assert.equal(notifications.length, 1);
    // CMC-10: bare `(no marketplaces)` EmptyToken.
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("shim :: named /marketplace update <name> calls updateMarketplace with name", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const { deps } = makeDeps();
    const handler = makeMarketplaceUpdateHandler(makePi(), deps);
    // SC#1 cross-op convergence: updateMarketplace's pre-guard catches
    // resolveScopeFromState's MarketplaceNotFoundError (--scope omitted, name
    // absent in BOTH scopes) and routes to the standalone `(failed) {not added}`
    // variant -- no raw error escapes past the orchestrator. The handler
    // resolves (no rejection) and a single bracketless not-added row is emitted,
    // proving control reached updateMarketplace with the requested name.
    await handler("mymkt", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.message, "⊘ mymkt (failed) {not added}");
    assert.equal(notifications[0]!.severity, "error");
  });
});

test("shim :: --scope user/project propagated", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const { deps } = makeDeps();
    const handler = makeMarketplaceUpdateHandler(makePi(), deps);
    await handler("--scope project", ctx);
    // updateAllMarketplaces on project scope, empty -> "No marketplaces..."
    assert.equal(notifications.length, 1);
    // CMC-10: bare `(no marketplaces)` EmptyToken.
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("shim :: deps.pluginUpdate passed through to orchestrator for cascade", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx } = makeCtx(cwd);
    const { deps, pluginUpdateCalls } = makeDeps();
    const handler = makeMarketplaceUpdateHandler(makePi(), deps);
    // Empty state -> nothing to update -> pluginUpdate is never called (no
    // marketplaces with autoupdate=true). But the deps.pluginUpdate field
    // was structurally accepted -- the type-check that deps.pluginUpdate
    // reached the orchestrator option bag is a compile-time invariant. We
    // verify the call path didn't error out.
    await handler("", ctx);
    // No marketplaces -> no cascade -> pluginUpdate calls empty.
    assert.equal(pluginUpdateCalls.length, 0);
  });
});
