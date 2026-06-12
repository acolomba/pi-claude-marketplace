import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import lockfile from "proper-lockfile";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import { setMarketplaceAutoupdate } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts";
import { loadConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import {
  loadState,
  saveState,
} from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ScopedLocations } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import type { ExtensionState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  // `pi` required on AutoupdateOptions; mirror production
  // wiring shape (D-18-06). `pi` is actively
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
  const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
  const home = await mkdtemp(path.join(tmpdir(), "mp-au-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "mp-au-cwd-"));
  process.env.HOME = home;
  // SC-1: getAgentDir() honors PI_CODING_AGENT_DIR FIRST and only falls back
  // to homedir(). Clear it so the hermetic HOME above actually governs the
  // user scope -- otherwise a developer/CI env that sets the variable would
  // make these tests read AND write the real Pi agent dir.
  delete process.env.PI_CODING_AGENT_DIR;
  try {
    return await fn({ home, cwd });
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

// SPLIT-01: autoupdate is carved out of MARKETPLACE_RECORD_SCHEMA and the
// write-back lives in `claude-plugins.json` (CFG-02). After a flip, read
// the post-flip value from the config file, not from state.json (D-13
// ORDERING RAIL scrubs the legacy field on the next loadState once the
// config file exists).
function recordAutoupdate(
  rec: ExtensionState["marketplaces"][string] | undefined,
): boolean | undefined {
  return (rec as unknown as Record<string, unknown> | undefined)?.autoupdate as boolean | undefined;
}

/** Read the post-flip `autoupdate` for a marketplace from `claude-plugins.json`. */
async function configAutoupdate(
  locations: ScopedLocations,
  name: string,
): Promise<boolean | undefined> {
  const cfg = await loadConfig(locations.configJsonPath);
  if (cfg.status !== "valid") {
    return undefined;
  }

  return cfg.config.marketplaces?.[name]?.autoupdate;
}

function makeMarketplaceRecord(
  name: string,
  scope: "user" | "project",
  cwd: string,
  autoupdate?: boolean,
): ExtensionState["marketplaces"][string] {
  const base: ExtensionState["marketplaces"][string] = {
    name,
    scope,
    source: pathSource("./src"),
    addedFromCwd: cwd,
    manifestPath: path.join(cwd, "marketplace.json"),
    marketplaceRoot: cwd,
    plugins: {},
  };

  // SPLIT-01: write autoupdate via cast (carved out of MARKETPLACE_RECORD_SCHEMA).
  if (autoupdate !== undefined) {
    (base as Record<string, unknown>).autoupdate = autoupdate;
  }

  return base;
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

    // post-flip `autoupdate` lives in `claude-plugins.json`.
    assert.equal(await configAutoupdate(locations, "mp"), true);
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
    assert.equal(await configAutoupdate(locations, "mp"), false);
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
    assert.equal(recordAutoupdate(after.marketplaces["mp"]), true);
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
    // post-flip `autoupdate` lives in `claude-plugins.json`.
    assert.equal(await configAutoupdate(locations, "mp"), true);
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

    // Only the FRESH flip (to-flip) writes back to
    // the config; the idempotent `already` row is byte-stable. Both end up
    // resolved as `autoupdate: true` via the merged config (state still
    // carries the seeded `already.autoupdate=true` unscrubbed because the
    // config write touched only the flipped row, and the test's loadState
    // scrubs only when the config file exists -- it does, so we read from
    // the config-side source of truth).
    assert.equal(await configAutoupdate(locations, "to-flip"), true);

    // Catalog forms: one notification carries both rows.
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

test("I2 / PR #51: write-back skipped (unsynthesizable source) renders a failed row, never silent success", async () => {
  // Pre-fix: writeAutoupdateBack silently dropped entries with no
  // synthesizable source from the batch but the name stayed in
  // `finalResult.changed`, so the final notify rendered success for a flip
  // that was never persisted. After the fix the skipped name is demoted to
  // an honest failed row (closed-set `not found` reason; no new tokens).
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });

    // Seed a record whose source.raw is NOT a string (forward-compat unknown
    // shape) so buildAutoupdatePatch cannot synthesize a `source` for the
    // first-time config write. State carries no autoupdate field so the flip
    // is fresh; the config file does not exist yet so no config-side `source`
    // is available either.
    const record: ExtensionState["marketplaces"][string] = {
      name: "mp-unsynth",
      scope: "project",
      // source.raw deliberately a non-string; SP-7 path is taken via
      // the unknown-kind admission.
      source: { kind: "unknown" },
      addedFromCwd: cwd,
      manifestPath: path.join(cwd, "marketplace.json"),
      marketplaceRoot: cwd,
      plugins: {},
    };
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { "mp-unsynth": record },
    });

    const { ctx, pi, notifications } = makeCtx();
    await setMarketplaceAutoupdate({
      ctx,
      pi,
      name: "mp-unsynth",
      enable: true,
      scope: "project",
      cwd,
    });

    assert.equal(notifications.length, 1);
    const msg = notifications[0]!.message;
    // The row MUST NOT claim success -- the `<autoupdate>` fresh-flip marker
    // is forbidden because the write-back never landed.
    assert.ok(
      !msg.includes("● mp-unsynth [project] <autoupdate>") || msg.includes("(failed)"),
      `unsynthesizable source must NOT render as silent fresh-flip success; got: ${msg}`,
    );
    // The row MUST surface a failure -- closed-set `not found` reason is the
    // permissive fallback used elsewhere in this orchestrator (matches the
    // synthetic-child cascade form).
    assert.match(
      msg,
      /\(failed\)/,
      `unsynthesizable source must render a (failed) row; got: ${msg}`,
    );
    // Severity must be error per D-16-11 (any failed row -> error).
    assert.equal(notifications[0]!.severity, "error");
  });
});

test("CMC-10 + SC-6: bare form across both empty scopes succeeds with `(no marketplaces)` sentinel", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, pi, enable: true, cwd }); // no name, no scope
    // D-16-17: empty marketplaces[] -> notify() emits the sentinel
    // verbatim.
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
    // post-flip `autoupdate` lives in `claude-plugins.json` (user scope).
    assert.equal(await configAutoupdate(userLocations, "only"), true);
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

test("ATTR-05: single-name flip with name absent from BOTH scopes surfaces standalone `(failed) {not added}` (no reason-less row)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const { ctx, pi, notifications } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, pi, name: "absent-zzz-9999", enable: true, cwd });
    assert.equal(notifications.length, 1);
    // ATTR-05 / D-48-C Shape 1: missing-everywhere routes through the
    // standalone MarketplaceNotAddedMessage `{not added}` variant -- NOT the
    // former reason-LESS bare `(failed)`. The bare form carries `first.scope`
    // (the scope where the first not-found was observed); SC-6 iterates
    // project-before-user, so the bracket is `[project]`. The standalone
    // not-added variant routes via isInfoKind -> error severity with NO
    // summary prefix.
    assert.equal(
      notifications[0]!.message,
      "1 marketplace operation failed.\n\n⊘ absent-zzz-9999 [project] (failed) {not added}",
    );
    // D-18-05 severity ladder: not-added -> error.
    assert.equal(notifications[0]!.severity, "error");
  });
});

test("ATTR-05: explicit-scope flip of a missing marketplace surfaces standalone `(failed) {not added}` with the scope bracket (not `{not found}`)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    // Empty project scope; request an explicit project-scope flip of a name
    // that is not added there. classifyAutoupdateFlip throws
    // MarketplaceNotFoundError for the explicit scope (S1).
    const { ctx, pi, notifications } = makeCtx();
    await setMarketplaceAutoupdate({
      ctx,
      pi,
      name: "absent-explicit",
      enable: true,
      scope: "project",
      cwd,
    });
    assert.equal(notifications.length, 1);
    // ATTR-05: the explicit-scope MarketplaceNotFoundError converts to the
    // standalone `{not added}` variant carrying the requested `[project]`
    // bracket -- the former synthetic-child `{not found}` reason is gone.
    assert.equal(
      notifications[0]!.message,
      "1 marketplace operation failed.\n\n⊘ absent-explicit [project] (failed) {not added}",
    );
    assert.doesNotMatch(notifications[0]!.message, /\{not found\}/);
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

// ──────────────────────────────────────────────────────────────────────────
// autoupdate WB-01 / --local / WR-09
// ──────────────────────────────────────────────────────────────────────────

test("WB-01: fresh enable writes back autoupdate=true to claude-plugins.json (with source carried from state)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd, false) },
    });

    const { ctx, pi } = makeCtx();
    await setMarketplaceAutoupdate({ ctx, pi, name: "mp", enable: true, scope: "project", cwd });

    const cfg = await loadConfig(locations.configJsonPath);
    assert.equal(cfg.status, "valid");
    if (cfg.status !== "valid") {
      return;
    }

    assert.equal(cfg.config.marketplaces?.["mp"]?.autoupdate, true);
    // The local file MUST be absent (base-target path).
    assert.equal((await loadConfig(locations.configLocalJsonPath)).status, "absent");
  });
});

test("IDEMPOTENT flip leaves the targeted config file BYTE-IDENTICAL (no mtime drift)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    // Seed state autoupdate=false so the FIRST call is a fresh flip and
    // creates the config; the SECOND call (now seed-aligned) is idempotent.
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd, false) },
    });

    const { ctx, pi } = makeCtx();
    // First flip: fresh enable=true -> writes claude-plugins.json (state's
    // autoupdate=false flips to true; not aligned).
    await setMarketplaceAutoupdate({ ctx, pi, name: "mp", enable: true, scope: "project", cwd });

    const { readFile, stat } = await import("node:fs/promises");
    const bytes1 = await readFile(locations.configJsonPath, "utf8");
    const stat1 = await stat(locations.configJsonPath);

    // Second flip: state is now autoupdate=true; enable=true -> idempotent.
    // The config file mtime MUST NOT change.
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
    await setMarketplaceAutoupdate({ ctx, pi, name: "mp", enable: true, scope: "project", cwd });

    const bytes2 = await readFile(locations.configJsonPath, "utf8");
    const stat2 = await stat(locations.configJsonPath);

    assert.equal(bytes1, bytes2, "idempotent flip MUST be byte-identical");
    assert.equal(
      stat1.mtimeMs,
      stat2.mtimeMs,
      "idempotent flip MUST NOT touch mtime (RECON-05 fixed point preserved)",
    );
  });
});

test("WB-01: --local routes the autoupdate write to claude-plugins.local.json; base file untouched", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd, false) },
    });

    const { ctx, pi } = makeCtx();
    await setMarketplaceAutoupdate({
      ctx,
      pi,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
      local: true,
    });

    const localCfg = await loadConfig(locations.configLocalJsonPath);
    assert.equal(localCfg.status, "valid");
    if (localCfg.status === "valid") {
      assert.equal(localCfg.config.marketplaces?.["mp"]?.autoupdate, true);
    }

    // The base file MUST be untouched.
    assert.equal((await loadConfig(locations.configJsonPath)).status, "absent");
  });
});

test("WR-09 / T-56-02-01: orchestrated-mode autoupdate flip skips write-back (state-only mutation)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd, false) },
    });

    const { ctx, pi } = makeCtx();
    await setMarketplaceAutoupdate({
      ctx,
      pi,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
      notifications: { mode: "orchestrated" },
    });

    // Neither config file is written in orchestrated mode.
    assert.equal((await loadConfig(locations.configJsonPath)).status, "absent");
    assert.equal((await loadConfig(locations.configLocalJsonPath)).status, "absent");
  });
});

test("CFG-03 / T-56-02-05: invalid local config aborts the flip; basename-only message; state untouched", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: makeMarketplaceRecord("mp", "project", cwd, false) },
    });

    const { writeFile } = await import("node:fs/promises");
    await writeFile(locations.configLocalJsonPath, "{ broken json", "utf8");

    const { ctx, pi, notifications } = makeCtx();
    await setMarketplaceAutoupdate({
      ctx,
      pi,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
      local: true,
    });

    // The throw is caught and routed through `notifyAutoupdateScopeFailure`
    // -> the synthetic-child cascade form. The message MUST NOT leak the
    // absolute local config path; the basename is acceptable as a clue.
    assert.ok(notifications.length >= 1);
    const note = notifications[0]!;
    assert.ok(
      !note.message.includes(locations.configLocalJsonPath),
      `must NOT leak absolute configLocalJsonPath, got: ${note.message}`,
    );

    // State was NOT saved: the seed value (autoupdate=false) persists.
    const after = await loadState(locations.extensionRoot);
    assert.equal(recordAutoupdate(after.marketplaces["mp"]), false);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// D-UPD: autoupdate flag-flip must leave a DISABLED plugin record alone.
// `setMarketplaceAutoupdate` flips a config flag; it does NOT update plugins.
// This test pins that the flip never accidentally re-materializes a
// disabled-but-recorded plugin's resources (the canonical
// isRecordedButDisabled marker: empty resources.* + installable=true).
// ──────────────────────────────────────────────────────────────────────────

test("D-UPD: setMarketplaceAutoupdate leaves a disabled plugin record untouched (state-side resources stay empty)", async () => {
  await withHermeticHome(async ({ cwd }) => {
    const locations = locationsFor("project", cwd);
    await mkdir(locations.extensionRoot, { recursive: true });
    // Seed a marketplace with a disabled plugin row: empty resources.* +
    // installable:true. The autoupdate flag-flip is a config-only mutation;
    // it must never re-materialize.
    const seededMp = makeMarketplaceRecord("mp", "project", cwd, false);
    (seededMp as { plugins: Record<string, unknown> }).plugins = {
      foo: {
        version: "1.0.0",
        resolvedSource: "/tmp/dummy-mp/plugins/foo",
        compatibility: {
          installable: true,
          notes: [],
          supported: [],
          unsupported: [],
        },
        resources: { skills: [], prompts: [], agents: [], mcpServers: [] },
        installedAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    };
    await saveState(locations.extensionRoot, {
      schemaVersion: 1,
      marketplaces: { mp: seededMp },
    });

    const { ctx, pi, notifications } = makeCtx();
    await setMarketplaceAutoupdate({
      ctx,
      pi,
      name: "mp",
      enable: true,
      scope: "project",
      cwd,
    });

    // Flag-flip surfaced (rendered byte form pinned by other tests).
    assert.ok(notifications.length >= 1);

    // D-UPD: state-side plugin record is UNTOUCHED -- resources.* still
    // empty (the plugin stays disabled until the user explicitly enables).
    const after = await loadState(locations.extensionRoot);
    const rec = (
      after.marketplaces["mp"] as unknown as {
        plugins: Record<
          string,
          {
            resources: {
              skills: string[];
              prompts: string[];
              agents: string[];
              mcpServers: string[];
            };
            compatibility: { installable: boolean };
          }
        >;
      }
    ).plugins.foo;
    assert.ok(rec !== undefined);
    assert.deepEqual(rec.resources.skills, [], "disabled record stays disabled across flag-flip");
    assert.deepEqual(rec.resources.prompts, []);
    assert.deepEqual(rec.resources.agents, []);
    assert.deepEqual(rec.resources.mcpServers, []);
    assert.equal(rec.compatibility.installable, true, "installable flag preserved");
  });
});
