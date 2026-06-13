// tests/architecture/cross-op-convergence.test.ts
//
// SC#1 cross-op convergence byte-identity matrix (Class-C-closed proof).
//
// The audit's Class C finding was that the "marketplace absent in the target
// scope" precondition rendered DIFFERENT user-facing rows across ops (some
// converged on the dedicated `{not added}` form, some threw raw). Every op
// now lands on the SINGLE dedicated `MarketplaceNotAddedMessage` variant
// + the ONE shared renderer
// (`renderMarketplaceNotAdded`). This test PROVES no op slipped its own row in.
//
// MECHANISM (WR-01 strengthening): rather than feeding one shared payload to the
// renderer 8 times (which would only prove renderer determinism), this test
// INVOKES EACH REAL ORCHESTRATOR against a MISSING marketplace in a hermetic
// HOME + tmp cwd (no state seeded -> the marketplace is absent in both scopes),
// captures the bytes + severity the orchestrator actually emitted through
// `ctx.ui.notify`, and asserts EVERY op's emission is byte-IDENTICAL to the
// canonical `⊘ <name> [scope?] (failed) {not added}` row AND identical to every
// other op's emission. This is the load-bearing capstone SC#1 lock: a future
// regression that gave one ORCHESTRATOR a divergent payload kind (e.g. a
// synthetic `(failed)` cascade row, or a raw throw) would break this gate even
// though each op's own orchestrator test might not catch the cross-op drift.
//
// CANONICAL ROWS (two):
//   - explicit-scope: `⊘ ghost-mp [project] (failed) {not added}`
//   - bare/bracketless: `⊘ ghost-mp (failed) {not added}`
// Both at severity "error", one emission per invocation (IL-2).
//
// SCOPE-BRACKET ASYMMETRY: `install` ALWAYS carries a resolved scope, so it has
// NO bracketless variant. `autoupdate`'s bare form is ALSO not bracketless -- it
// reports the first-observed scope's bracket (ATTR-05), so it converges on the
// EXPLICIT row. The explicit-scope matrix includes install + autoupdate; the
// bracketless-bare matrix excludes BOTH (info / uninstall / reinstall /
// plugin-update / marketplace-remove / marketplace-update keep a bracketless
// bare form).
//
// NO network: every op is invoked against an empty hermetic state. The
// not-added precondition short-circuits BEFORE any clone/fetch (NFR-5 by
// construction); marketplace-update injects a mock gitOps that would record any
// stray call, but the pre-guard miss returns before it is reached.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { setMarketplaceAutoupdate } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts";
import { removeMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts";
import { updateMarketplace } from "../../extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts";
import { getPluginInfo } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/info.ts";
import { installPlugin } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import { reinstallPlugins } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts";
import { uninstallPlugin } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts";
import { updatePlugins } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/update.ts";
import { makeMockGitOps } from "../helpers/git-mock.ts";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// ---------------------------------------------------------------------------
// Hermetic harness -- mirrors the per-op orchestrator test idiom
// (makeCtx + withHermeticHome). No seeded state -> the marketplace is absent in
// BOTH scopes, which drives every op onto the converged `{not added}` row.
// ---------------------------------------------------------------------------

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

async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "xop-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "xop-cwd-"));
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

const NAME = "ghost-mp";
const CANONICAL_EXPLICIT =
  "1 marketplace operation failed.\n\n⊘ ghost-mp [project] (failed) {not added}";
const CANONICAL_BARE = "1 marketplace operation failed.\n\n⊘ ghost-mp (failed) {not added}";

interface Emission {
  body: string;
  severity: string | undefined;
  callCount: number;
}

/**
 * Invoke a real orchestrator against a missing marketplace and return its sole
 * notify emission. Each invoker is the EXACT call shape copied from that op's
 * own orchestrator test file. `mode` selects the explicit-scope vs bare-form
 * invocation (install has no bare form).
 */
type Invoker = (env: {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  cwd: string;
  mode: "explicit" | "bare";
}) => Promise<void>;

const INVOKERS: Record<string, Invoker> = {
  // marketplace info (the canonical model). info.test.ts (f)/(g).
  info: async ({ ctx, pi, cwd, mode }) => {
    await getPluginInfo({
      ctx,
      pi,
      marketplace: NAME,
      plugin: "ghost",
      cwd,
      ...(mode === "explicit" && { scope: "project" as const }),
    });
  },
  // install ALWAYS carries a resolved scope -> explicit only. install.test.ts M1.
  install: async ({ ctx, pi, cwd }) => {
    await installPlugin({ ctx, pi, scope: "project", cwd, marketplace: NAME, plugin: "anything" });
  },
  // uninstall. uninstall.test.ts ATTR-04 / D-03.
  uninstall: async ({ ctx, pi, cwd, mode }) => {
    await uninstallPlugin({
      ctx,
      pi,
      cwd,
      marketplace: NAME,
      plugin: "ghost",
      ...(mode === "explicit" && { scope: "project" as const }),
    });
  },
  // reinstall (marketplace target). reinstall.test.ts ATTR-03.
  reinstall: async ({ ctx, pi, cwd, mode }) => {
    await reinstallPlugins({
      ctx,
      pi,
      cwd,
      target: { kind: "marketplace", marketplace: NAME },
      ...(mode === "explicit" && { scope: "project" as const }),
    });
  },
  // plugin update (marketplace target). update.test.ts ATTR-02.
  "update (plugin)": async ({ ctx, pi, cwd, mode }) => {
    await updatePlugins({
      ctx,
      pi,
      cwd,
      target: { kind: "marketplace", marketplace: NAME },
      ...(mode === "explicit" && { scope: "project" as const }),
    });
  },
  // marketplace remove. remove.test.ts ATTR-06 S3/S4.
  "marketplace remove": async ({ ctx, pi, cwd, mode }) => {
    await removeMarketplace({
      ctx,
      pi,
      name: NAME,
      cwd,
      ...(mode === "explicit" && { scope: "project" as const }),
    });
  },
  // autoupdate flip. autoupdate.test.ts ATTR-05.
  autoupdate: async ({ ctx, pi, cwd, mode }) => {
    await setMarketplaceAutoupdate({
      ctx,
      pi,
      name: NAME,
      enable: true,
      cwd,
      ...(mode === "explicit" && { scope: "project" as const }),
    });
  },
  // marketplace update -- converged via the cross-op gate. A mock gitOps is
  // injected so a (regression) stray network call would be recorded; the
  // pre-guard miss short-circuits before it is reached (NFR-5). update.test.ts
  // SC#1.
  "marketplace update": async ({ ctx, pi, cwd, mode }) => {
    const { gitOps } = makeMockGitOps();
    await updateMarketplace({
      ctx,
      pi,
      name: NAME,
      cwd,
      gitOps,
      ...(mode === "explicit" && { scope: "project" as const }),
    });
  },
};

async function captureOp(op: string, mode: "explicit" | "bare"): Promise<Emission> {
  return withHermeticHome(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    const invoke = INVOKERS[op];
    assert.ok(invoke !== undefined, `no invoker registered for op "${op}"`);
    await invoke({ ctx, pi, cwd, mode });
    const first = notifications[0];
    return {
      body: first?.message ?? "",
      severity: first?.severity,
      callCount: notifications.length,
    };
  });
}

// Every converged op INVOKED in explicit-scope form (install included).
const OPS_EXPLICIT_SCOPE = [
  "info",
  "install",
  "uninstall",
  "reinstall",
  "update (plugin)",
  "marketplace remove",
  "autoupdate",
  "marketplace update",
] as const;

// Ops that support a truly BRACKETLESS bare form (absent from BOTH scopes, no
// requested scope to report) -- TWO ops are excluded:
//   - install: always carries a resolved scope (the edge defaults it), so it has
//     no bracketless variant.
//   - autoupdate: its bare form is NOT bracketless. When the name is absent from
//     BOTH scopes, setMarketplaceAutoupdate reports the FIRST-observed scope's
//     bracket (SC-6 iterates project-before-user -> `[project]`), so it converges
//     on the EXPLICIT-scope canonical row, not the bracketless one. This is the
//     documented ATTR-05 contract (autoupdate.test.ts) and autoupdate is asserted
//     in the explicit-scope matrix above. Invoking the REAL orchestrator (WR-01)
//     surfaced this asymmetry that the prior shared-payload loop masked.
const OPS_BARE = [
  "info",
  "uninstall",
  "reinstall",
  "update (plugin)",
  "marketplace remove",
  "marketplace update",
] as const;

test("SC#1 cross-op convergence: explicit-scope {not added} is byte-identical across every REAL orchestrator (incl. marketplace update)", async () => {
  // Invoke each real orchestrator against a missing marketplace and assert its
  // ACTUAL emission equals the canonical explicit-scope row AND every other
  // op's. The cross-op equality is the load-bearing convergence invariant.
  let canonicalBody: string | undefined;
  for (const op of OPS_EXPLICIT_SCOPE) {
    const emission = await captureOp(op, "explicit");
    assert.equal(
      emission.body,
      CANONICAL_EXPLICIT,
      `op "${op}" must emit the byte-identical explicit-scope canonical row (Class-C regression)`,
    );
    assert.equal(emission.severity, "error", `op "${op}" must emit at severity error`);
    assert.equal(emission.callCount, 1, `op "${op}" must emit exactly once (IL-2)`);
    // Direct cross-op byte-identity: op-A bytes === op-B bytes.
    if (canonicalBody === undefined) {
      canonicalBody = emission.body;
    } else {
      assert.equal(
        emission.body,
        canonicalBody,
        `op "${op}" bytes must equal every other op's bytes (the convergence invariant)`,
      );
    }
  }

  assert.equal(canonicalBody, CANONICAL_EXPLICIT);
});

test("SC#1 cross-op convergence: bare/bracketless {not added} is byte-identical across every bare-capable REAL orchestrator (install excluded)", async () => {
  let canonicalBody: string | undefined;
  for (const op of OPS_BARE) {
    const emission = await captureOp(op, "bare");
    assert.equal(
      emission.body,
      CANONICAL_BARE,
      `op "${op}" must emit the byte-identical bare canonical row (Class-C regression)`,
    );
    assert.equal(emission.severity, "error", `op "${op}" must emit at severity error`);
    assert.equal(emission.callCount, 1, `op "${op}" must emit exactly once (IL-2)`);
    if (canonicalBody === undefined) {
      canonicalBody = emission.body;
    } else {
      assert.equal(
        emission.body,
        canonicalBody,
        `op "${op}" bare bytes must equal every other bare-capable op's bytes (the convergence invariant)`,
      );
    }
  }

  assert.equal(canonicalBody, CANONICAL_BARE);

  // Asymmetry guard: the explicit-scope and bare rows are DISTINCT (one carries
  // the [project] bracket, one does not) -- a regression collapsing them would
  // be a real byte change.
  assert.notEqual(
    CANONICAL_EXPLICIT,
    CANONICAL_BARE,
    "explicit-scope and bare rows must remain distinct byte forms",
  );
});

test("SC#1 cross-op convergence: NONE of the converged ops emit the lying `{network unreachable}` on a missing marketplace (CR-01 cross-check)", async () => {
  // CR-01 regression cross-check at the convergence layer: a missing/removed
  // marketplace must NEVER surface the network-reason default on ANY op (NFR-5 /
  // ATTR-10). marketplace update was the residual offender (TOCTOU raw throw ->
  // `?? network unreachable`); assert every op's missing-mp emission is the
  // `{not added}` convergence row and carries no `{network unreachable}`.
  for (const op of OPS_EXPLICIT_SCOPE) {
    const emission = await captureOp(op, "explicit");
    assert.doesNotMatch(
      emission.body,
      /\{network unreachable\}/,
      `op "${op}" must NEVER render the lying {network unreachable} reason on a missing marketplace`,
    );
    assert.match(
      emission.body,
      /\{not added\}/,
      `op "${op}" must render the converged {not added} reason`,
    );
  }
});
