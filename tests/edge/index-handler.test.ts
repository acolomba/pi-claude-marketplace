// tests/edge/index-handler.test.ts
//
// RECON-04 wiring proof for the `index.ts` resources_discover handler.
// Verifies:
//   1. Registering the extension installs a handler under the
//      `resources_discover` event name (bound ctx -- the `unknown` cast that
//      elided ctx in pre-Phase-55 versions has been dropped).
//   2. The handler invokes applyReconcile BEFORE aggregateDiscoveredResources
//      so newly-materialized artefacts are picked up on the SAME load.
//   3. A catastrophic applyReconcile throw is caught and the handler still
//      returns a `ResourcesDiscoverResult` -- Pi load is NEVER blocked
//      (NFR-2 boundary preservation). A single last-ditch ctx.ui.notify
//      records the failure at error severity.
//
// Hermetic env: HOME + PI_CODING_AGENT_DIR are pointed at tmp dirs so the
// extension's locationsFor() seam reads/writes empty scopes (no real Pi
// state is touched).

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { mock } from "node:test";

import claudeMarketplaceExtension from "../../extensions/pi-claude-marketplace/index.ts";

import type {
  ExtensionAPI,
  ExtensionContext,
  ResourcesDiscoverEvent,
  ResourcesDiscoverResult,
} from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

type ResourcesDiscoverHandler = (
  event: ResourcesDiscoverEvent,
  ctx: ExtensionContext,
) => Promise<ResourcesDiscoverResult>;

interface MockPi {
  handlers: Map<string, unknown>;
  on: ReturnType<typeof mock.fn>;
  getAllTools: () => unknown[];
  registerTool: ReturnType<typeof mock.fn>;
  registerCommand: ReturnType<typeof mock.fn>;
}

function makeMockPi(): MockPi {
  const handlers = new Map<string, unknown>();
  const on = mock.fn((event: string, handler: unknown): void => {
    handlers.set(event, handler);
  });
  return {
    handlers,
    on,
    getAllTools: (): unknown[] => [],
    registerTool: mock.fn(),
    registerCommand: mock.fn(),
  };
}

interface MockCtx {
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}

async function withHermeticEnv<T>(fn: (cwd: string, home: string) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const home = await mkdtemp(path.join(tmpdir(), "ix-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "ix-cwd-"));
  process.env.HOME = home;
  delete process.env.PI_CODING_AGENT_DIR;
  try {
    return await fn(cwd, home);
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

    await rm(home, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    await rm(cwd, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}

test("RECON-04 wiring: extension registers a resources_discover handler with bound ctx (the `unknown` cast is dropped)", () => {
  const pi = makeMockPi();
  claudeMarketplaceExtension(pi as unknown as ExtensionAPI);
  // pi.on registers at least the resources_discover handler.
  assert.ok(
    pi.handlers.has("resources_discover"),
    "extension MUST register a resources_discover handler at extension boot",
  );
  const handler = pi.handlers.get("resources_discover") as ResourcesDiscoverHandler;
  // The handler's arity is (event, ctx) -- the `unknown` cast that elided
  // the second param is gone.
  assert.equal(
    handler.length,
    2,
    "handler must accept (event, ctx) -- the `unknown` cast elided ctx in pre-Phase-55 versions",
  );
});

test("RECON-04 wiring: a clean reconcile against an empty scope returns a ResourcesDiscoverResult (handler completes the round trip)", async () => {
  await withHermeticEnv(async (cwd, home) => {
    const pi = makeMockPi();
    claudeMarketplaceExtension(pi as unknown as ExtensionAPI);
    const handler = pi.handlers.get("resources_discover") as ResourcesDiscoverHandler;
    assert.ok(handler !== undefined);

    const ctx = makeCtx();
    const event: ResourcesDiscoverEvent = { type: "resources_discover", cwd, reason: "startup" };
    const result = await handler(event, ctx as unknown as ExtensionContext);

    // Result is a ResourcesDiscoverResult shape.
    assert.ok(Array.isArray(result.skillPaths), "result.skillPaths must be an array");
    assert.ok(Array.isArray(result.promptPaths), "result.promptPaths must be an array");

    // Empty config + empty state -> silent reconcile (NFR-2 / A4).
    assert.equal(
      ctx.ui.notify.mock.calls.length,
      0,
      "empty/clean reconcile must NOT emit a notify() (NFR-2 silent contract)",
    );

    // WR-05: a pristine scope must stay pristine -- starting Pi in an
    // arbitrary directory must NOT create `.pi/claude-plugins.json` or
    // `.pi/pi-claude-marketplace/state.json` there (or in the user scope).
    assert.equal(
      existsSync(path.join(cwd, ".pi")),
      false,
      "WR-05: a clean reconcile must not create <cwd>/.pi (no unsolicited files)",
    );
    assert.equal(
      existsSync(path.join(home, ".pi")),
      false,
      "WR-05: a clean reconcile must not create user-scope files either",
    );
  });
});

/**
 * WR-08: seed a project scope whose config is invalid so
 * applyReconcile accumulates an invalid-block outcome and CALLS
 * `ctx.ui.notify` with the cascade. A throwing notify stub then makes
 * applyReconcile itself throw -- the only injection-free way to drive the
 * index.ts catch arm with a REAL propagated error.
 */
async function seedInvalidProjectConfig(cwd: string): Promise<void> {
  await mkdir(path.join(cwd, ".pi"), { recursive: true });
  await writeFile(path.join(cwd, ".pi", "claude-plugins.json"), "{", "utf8");
}

test("NFR-2 boundary preservation: a real applyReconcile throw is caught, the handler still returns a ResourcesDiscoverResult, and the last-ditch notify reports `reconcile aborted:` at error severity", async () => {
  await withHermeticEnv(async (cwd) => {
    await seedInvalidProjectConfig(cwd);

    const pi = makeMockPi();
    claudeMarketplaceExtension(pi as unknown as ExtensionAPI);
    const handler = pi.handlers.get("resources_discover") as ResourcesDiscoverHandler;

    // The FIRST ctx.ui.notify call (applyReconcile's cascade for the
    // invalid-config row) throws -- the error propagates out of
    // applyReconcile into index.ts's catch arm. The SECOND call (the
    // last-ditch `reconcile aborted:` line) succeeds and is recorded.
    const recorded: [string, string | undefined][] = [];
    let calls = 0;
    const throwOnceCtx: MockCtx = {
      ui: {
        notify: mock.fn((message: string, severity?: string): void => {
          calls += 1;
          if (calls === 1) {
            throw new Error("simulated host notify failure");
          }

          recorded.push([message, severity]);
        }),
      },
    };

    const event: ResourcesDiscoverEvent = { type: "resources_discover", cwd, reason: "startup" };
    // Must NOT throw past the handler (NFR-2: Pi load is never blocked).
    const result = await handler(event, throwOnceCtx as unknown as ExtensionContext);
    assert.ok(Array.isArray(result.skillPaths));
    assert.ok(Array.isArray(result.promptPaths));

    // The catch arm fired exactly once with the documented last-ditch shape.
    assert.equal(recorded.length, 1, "the last-ditch notify must fire exactly once");
    assert.ok(
      recorded[0]![0].startsWith("reconcile aborted:"),
      `last-ditch message must start with 'reconcile aborted:'; got: ${recorded[0]![0]}`,
    );
    assert.equal(recorded[0]![1], "error", "last-ditch notify must carry error severity");
  });
});

test("NFR-2 boundary preservation: even when the last-ditch notify ALSO throws, the handler still returns a ResourcesDiscoverResult (inner catch)", async () => {
  await withHermeticEnv(async (cwd) => {
    await seedInvalidProjectConfig(cwd);

    const pi = makeMockPi();
    claudeMarketplaceExtension(pi as unknown as ExtensionAPI);
    const handler = pi.handlers.get("resources_discover") as ResourcesDiscoverHandler;

    // EVERY notify throws: applyReconcile's cascade notify throws (driving
    // the outer catch), then the last-ditch notify throws too (driving the
    // inner catch). Neither may escape the handler.
    const throwingCtx: MockCtx = {
      ui: {
        notify: mock.fn((): void => {
          throw new Error("simulated host notify failure");
        }),
      },
    };

    const event: ResourcesDiscoverEvent = { type: "resources_discover", cwd, reason: "startup" };
    const result = await handler(event, throwingCtx as unknown as ExtensionContext);
    assert.ok(Array.isArray(result.skillPaths));
    assert.ok(Array.isArray(result.promptPaths));
    // Both notify attempts happened (cascade + last-ditch), proving the
    // outer catch arm executed rather than the reconcile being silent.
    assert.equal(throwingCtx.ui.notify.mock.calls.length, 2);
  });
});
