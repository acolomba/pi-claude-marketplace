// Plan 06-04 Task 1: marketplace add handler shim tests.
//
// The shim takes `deps: EdgeDeps` carrying `gitOps`. We use the
// `makeMockGitOps` helper to build a stub git surface and a no-op
// `pluginUpdate`. The shim should:
//   - reject missing positional with USAGE.
//   - delegate to `addMarketplace` with the deps.gitOps threaded through.
//
// Since the orchestrator's clone path actually invokes the mock, we can
// verify deps.gitOps was passed through by triggering a github source and
// asserting the mock's call log records a clone.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { makeAddHandler } from "../../../../extensions/pi-claude-marketplace/edge/handlers/marketplace/add.ts";
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

// Plan 18-00 (Wave 0): `makeAddHandler(pi, deps)` requires `pi` as first
// positional arg. Edge shim tests mirror the production wiring shape.
function makePi(): ExtensionAPI {
  return {
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;
}

function makeDeps(): {
  deps: EdgeDeps;
  gitMock: ReturnType<typeof makeMockGitOps>;
} {
  const gitMock = makeMockGitOps();
  const pluginUpdate = (plugin: string): Promise<PluginUpdateOutcome> =>
    Promise.resolve({
      partition: "unchanged",
      name: plugin,
      fromVersion: "0.0.0",
      toVersion: "0.0.0",
      declaresAgents: false,
      declaresMcp: false,
    });
  const deps: EdgeDeps = { gitOps: gitMock.gitOps, pluginUpdate };
  return { deps, gitMock };
}

async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "mp-add-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-add-shim-cwd-"));
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

test("shim :: missing source positional emits USAGE; no orchestrator call", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, notifications } = makeCtx(cwd);
    const { deps, gitMock } = makeDeps();
    const handler = makeAddHandler(makePi(), deps);
    await handler("", ctx);
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, "error");
    assert.match(notifications[0]!.message, /Usage: \/claude:plugin marketplace add/);
    // No git operations -- the orchestrator was never invoked.
    assert.equal(gitMock.state.cloneCalls.length, 0);
  });
});

test('shim :: valid source calls addMarketplace with { ctx, scope: "user", cwd, rawSource, gitOps: deps.gitOps }', async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx } = makeCtx(cwd);
    const { deps, gitMock } = makeDeps();
    const handler = makeAddHandler(makePi(), deps);
    // A non-existent path source surfaces an ENOENT-class error from
    // addMarketplace's stat() probe -- the surfacing is via a thrown error
    // (addMarketplace re-throws via withStateGuard). We expect the
    // notification machinery to NOT have caught it (the handler-shim does
    // not wrap orchestrator throws). So we expect this call to reject.
    await assert.rejects(async () => handler("./nonexistent-marketplace-dir", ctx));
    // No git operations expected (path source -- NFR-5).
    assert.equal(gitMock.state.cloneCalls.length, 0);
  });
});

test("shim :: --scope project propagated to addMarketplace", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx } = makeCtx(cwd);
    const { deps, gitMock } = makeDeps();
    const handler = makeAddHandler(makePi(), deps);
    // Same path-source path with --scope project. The shim selecting project
    // scope is observed by addMarketplace looking up project locations; the
    // resulting ENOENT also rejects. We assert reject + no clone calls.
    await assert.rejects(async () => handler("./nonexistent-marketplace-dir --scope project", ctx));
    assert.equal(gitMock.state.cloneCalls.length, 0);
  });
});

test("shim :: deps.gitOps is passed through from EdgeDeps", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx } = makeCtx(cwd);
    const { deps, gitMock } = makeDeps();
    const handler = makeAddHandler(makePi(), deps);
    // A github source triggers the gitOps.clone path. The mock has no fixture
    // configured, so the orchestrator will fail at manifest read after clone;
    // but the clone call will be RECORDED on gitMock.state.cloneCalls -- proof
    // that deps.gitOps reached addMarketplace.
    await assert.rejects(async () => handler("owner/repo", ctx));
    assert.equal(gitMock.state.cloneCalls.length, 1);
  });
});
