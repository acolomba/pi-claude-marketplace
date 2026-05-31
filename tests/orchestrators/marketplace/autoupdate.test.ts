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
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  // Plan 18-00: `pi` required on AutoupdateOptions; mirror production
  // wiring shape (D-18-06 preserved). Plan 18-02: `pi` is now actively
  // consumed by the orchestrator to drive notify()'s soft-dep probe
  // (D-16-14); the stub still satisfies the ExtensionAPI surface.
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

test("MAU-1 / UXG-04: enable=true on a single marketplace flips false->true and emits V2 `<autoupdate>` marker with NO reload-hint trailer (SNM-33 / D-22-03)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd, false) },
    });

    const { ctx, pi, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, pi, name: "mp", enable: true, scope: "project", cwd });

    const after = await loadState(locations.extensionRoot);
    assert.equal(after.marketplaces["mp"]!.autoupdate, true);
    assert.equal(notifications.length, 1);
    // SNM-33 / D-22-03: a fresh autoupdate flip mutates a marketplace record,
    // not a Pi-visible resource, so NO `/reload` trailer.
    assert.equal(notifications[0]!.message, "● mp [project] <autoupdate>");
    // D-18-05 severity ladder: fresh autoupdate enable -> info (no 2nd arg).
    assert.equal(notifications[0]!.severity, undefined);
  });
});

test("MAU-1 / UXG-04: enable=false flips true->false and emits V2 `<no autoupdate>` off-marker with NO reload-hint trailer (SNM-33 / D-22-03)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd, true) },
    });
    const { ctx, pi, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, pi, name: "mp", enable: false, scope: "project", cwd });
    const after = await loadState(locations.extensionRoot);
    assert.equal(after.marketplaces["mp"]!.autoupdate, false);
    // SNM-33 / D-22-03: fresh autoupdate flip -> NO `/reload` trailer.
    assert.equal(notifications[0]!.message, "● mp [project] <no autoupdate>");
    // D-18-05 severity ladder: fresh autoupdate disable -> info (no 2nd arg).
    assert.equal(notifications[0]!.severity, undefined);
  });
});

test("MAU-3 / UXG-04: idempotent -- already-true + enable=true emits V2 `<autoupdate> {already autoupdate}` at severity info (benign per UXG-02 / D-28-07)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd, true) },
    });
    const { ctx, pi, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, pi, name: "mp", enable: true, scope: "project", cwd });
    const after = await loadState(locations.extensionRoot);
    assert.equal(after.marketplaces["mp"]!.autoupdate, true);
    assert.equal(notifications[0]!.message, "● mp [project] <autoupdate> {already autoupdate}");
    // UXG-02 / D-28-06/07 severity ladder: the benign idempotent flip reason
    // `already autoupdate` is in BENIGN_REASONS -> info (no severity arg).
    assert.equal(notifications[0]!.severity, undefined);
  });
});

test("MAU-3 / UXG-04: idempotent -- already-false + enable=false emits V2 `<no autoupdate> {already no autoupdate}` at severity info (benign per UXG-02 / D-28-07)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd, false) },
    });
    const { ctx, pi, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, pi, name: "mp", enable: false, scope: "project", cwd });
    assert.equal(
      notifications[0]!.message,
      "● mp [project] <no autoupdate> {already no autoupdate}",
    );
    // UXG-02 / D-28-06/07 severity ladder: the benign idempotent flip reason
    // `already no autoupdate` is in BENIGN_REASONS -> info (no severity arg).
    assert.equal(notifications[0]!.severity, undefined);
  });
});

test("MAU-4: missing autoupdate field treated as false; enable=true flips it to true (V2 `<autoupdate>` marker)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    // No autoupdate field -- treated as false per MAU-4.
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd) },
    });
    const { ctx, pi, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, pi, name: "mp", enable: true, scope: "project", cwd });
    const after = await loadState(locations.extensionRoot);
    assert.equal(after.marketplaces["mp"]!.autoupdate, true);
    // SNM-33 / D-22-03: fresh autoupdate flip -> NO `/reload` trailer.
    assert.equal(notifications[0]!.message, "● mp [project] <autoupdate>");
    // D-18-05 severity ladder: fresh enable -> info.
    assert.equal(notifications[0]!.severity, undefined);
  });
});

test("MAU-4: missing autoupdate field treated as false; enable=false reports V2 `<no autoupdate> {already no autoupdate}` idempotently", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd) },
    });
    const { ctx, pi, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, pi, name: "mp", enable: false, scope: "project", cwd });
    assert.equal(
      notifications[0]!.message,
      "● mp [project] <no autoupdate> {already no autoupdate}",
    );
    // UXG-02 / D-28-06/07 severity ladder: the benign idempotent flip reason
    // `already no autoupdate` is in BENIGN_REASONS -> info (no severity arg).
    assert.equal(notifications[0]!.severity, undefined);
  });
});

test("MAU-2 / CMC-33 (V2): bare form flips every marketplace in scope; one notify() emits both rows separated by blank line", async () => {
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
    const { ctx, pi, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, pi, enable: true, scope: "project", cwd });

    const after = await loadState(locations.extensionRoot);
    assert.equal(after.marketplaces["already"]!.autoupdate, true);
    assert.equal(after.marketplaces["to-flip"]!.autoupdate, true);

    // V2 catalog forms: one notification carries both rows.
    // D-16-06: caller-order honored (no alphabetic sort at the
    // orchestrator). The orchestrator's accumulator pushes
    // `result.changed[]` rows BEFORE `result.unchanged[]` rows (see
    // setMarketplaceAutoupdate's per-scope loop), so the changed
    // marketplace ("to-flip") precedes the unchanged one ("already")
    // in the rendered output -- regardless of state insertion order.
    // Both row bytes assert as substrings so the test stays robust to
    // the intra-block join discipline.
    assert.equal(notifications.length, 1);
    const message = notifications[0]!.message;
    assert.ok(
      message.includes("● already [project] <autoupdate> {already autoupdate}"),
      `expected idempotent row, got: ${message}`,
    );
    assert.ok(
      message.includes("● to-flip [project] <autoupdate>"),
      `expected fresh-enable row, got: ${message}`,
    );
    // Caller-order invariant: changed-first-then-unchanged grouping
    // (the orchestrator's accumulator order); to-flip precedes already.
    assert.ok(
      message.indexOf("● to-flip [project]") < message.indexOf("● already [project]"),
      `expected changed-first ordering (to-flip before already), got: ${message}`,
    );
    // Mixed-outcome multi-marketplace: the only non-success row is the
    // BENIGN idempotent flip (`already autoupdate` in BENIGN_REASONS) and the
    // other row is a fresh enable (success), so per UXG-02 / D-28-06 the whole
    // cascade computes info (no severity arg). The fresh `<autoupdate>` row is
    // not a skip, so there is no actionable row to poison the routing.
    assert.equal(notifications[0]!.severity, undefined);
    // SNM-33 / D-22-03: neither row carries a plugin state-change token
    // (autoupdate flips mutate marketplace records only), so NO trailer.
    assert.ok(
      !message.includes("/reload to pick up changes"),
      `expected NO reload-hint trailer, got: ${message}`,
    );
  });
});

test("CMC-10 + SC-6: bare form across both empty scopes succeeds with `(no marketplaces)` sentinel", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, pi, enable: true, cwd }); // no name, no scope
    // D-16-17: empty marketplaces[] -> notify() emits the sentinel
    // verbatim. The V1 byte form is identical to V2.
    assert.equal(notifications[0]!.message, "(no marketplaces)");
  });
});

test("Single-name flip across BOTH scopes when --scope omitted: flip in user scope only emits V2 `<autoupdate>` marker (no error)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const userLocations = locationsFor("user", cwd);
    await mkdir(userLocations.extensionRoot, { recursive: true });
    await saveState(userLocations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { only: makeMarketplaceRecord("only", "user", cwd, false) },
    });
    const { ctx, pi, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, pi, name: "only", enable: true, cwd });
    // user-scope flip succeeded; project-scope MarketplaceNotFoundError was swallowed gracefully.
    assert.equal(notifications.length, 1);
    // SNM-33 / D-22-03: fresh autoupdate flip -> NO `/reload` trailer.
    assert.equal(notifications[0]!.message, "● only [user] <autoupdate>");
    assert.notEqual(notifications[0]!.severity, "error");
    // D-18-05: fresh enable -> info severity.
    assert.equal(notifications[0]!.severity, undefined);
  });
});

test("single-name cross-scope flip surfaces state lock failures as V2 `(failed)` row at severity error", async () => {
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
      const { ctx, pi, notifications } = makeCtx();
      await setMarketplaceAutoupdate({ ctx, pi, name: "only", enable: true, cwd });

      // The marketplace header carries no cause (SNM-10), so the held-lock
      // failure is surfaced through a synthetic failed-plugin child whose
      // cause-chain trailer carries StateLockHeldError's actionable retry
      // message ("Retry after it completes."). The child narrows to the
      // `lock held` reason.
      assert.equal(notifications.length, 1);
      assert.match(notifications[0]!.message, /^⊘ only \[project\] \(failed\)$/m);
      assert.match(notifications[0]!.message, /\{lock held\}/);
      assert.match(notifications[0]!.message, /cause:.*Retry after it completes\./);
      // failed -> error severity.
      assert.equal(notifications[0]!.severity, "error");
    } finally {
      await release();
    }
  });
});

test("Single-name flip across BOTH scopes when name absent from BOTH scopes: surfaces V2 `(failed)` row at severity error", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, pi, name: "absent-zzz-9999", enable: true, cwd });
    assert.equal(notifications.length, 1);
    // missingEverywhere path: `first.scope` is the FIRST scope in the
    // SC-6 iteration order ("project" comes before "user"). The
    // failure row carries the scope where the FIRST not-found was
    // observed.
    // Phase 29 / UXG-07 (D-29-03): 0 failed plugins, 1 failed marketplace
    // -> the "1 marketplace operation failed." summary line is prepended.
    assert.equal(
      notifications[0]!.message,
      "1 marketplace operation failed.\n\n⊘ absent-zzz-9999 [project] (failed)",
    );
    // D-18-05 severity ladder: failed -> error.
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
