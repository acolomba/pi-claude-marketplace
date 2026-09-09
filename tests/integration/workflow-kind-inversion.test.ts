import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { installPlugin } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import { applyReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { EXTENSION_VERSION } from "../../extensions/pi-claude-marketplace/shared/extension-version.ts";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// WINV-02 install-level proof: a plugin carrying a `workflows/` directory
// installs on a plain `install`, with no partial opt-in, and renders the clean
// installed row. WBRG-01 and WPTH-01 pin the other half -- the plugin's
// workflow script materializes as an envelope at the scope's canonical saved
// path, carrying the script text verbatim.
//
// Those two halves are proved by DIFFERENT actors, and the case keeps them
// apart. `installPlugin` performs the first. The second is performed by the
// bridge, driven directly here: WLIF-01 is not wired, so the install still
// writes nothing under the engine's storage root, and the case asserts that
// window between the two acts rather than dropping it.

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as ExtensionContext;
  const pi = {
    getAllTools: (): unknown[] => [],
  } as ExtensionAPI;
  return { ctx, pi, notifications };
}

/**
 * Hand the temp home to the callback rather than making it re-read the global
 * that was just written. A caller reading `process.env.HOME` back needs a
 * `?? ""` to satisfy `strictNullChecks`, and that fallback turns a broken
 * precondition into a silent cwd-relative probe instead of a failure.
 */
async function withHermeticHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "workflow-inversion-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;
  try {
    return await fn(hermeticHome);
  } finally {
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    await rm(hermeticHome, { recursive: true, force: true });
  }
}

async function seedWorkflowPlugin(opts: {
  readonly cwd: string;
  readonly marketplaceRoot: string;
  readonly marketplaceName?: string;
  readonly pluginName?: string;
  readonly version?: string;
}): Promise<{ readonly pluginRoot: string; readonly manifestPath: string }> {
  const marketplaceName = opts.marketplaceName ?? "mp";
  const pluginName = opts.pluginName ?? "hello";
  const version = opts.version ?? "1.0.0";

  const pluginRoot = path.join(opts.marketplaceRoot, "plugins", pluginName);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({ name: pluginName, version }),
  );

  // Seed at least one skill so the install path stages something visible.
  const skillDir = path.join(pluginRoot, "skills", "tool");
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\nname: tool\n---\n\nbody for ${pluginName} ${version}.\n`,
  );

  await mkdir(path.join(pluginRoot, "workflows"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, "workflows", "greet.js"),
    `export const meta = { name: "greet", description: "greets" };\n`,
  );

  await mkdir(path.join(opts.marketplaceRoot, ".claude-plugin"), { recursive: true });
  const manifestPath = path.join(opts.marketplaceRoot, ".claude-plugin", "marketplace.json");
  await writeFile(
    manifestPath,
    JSON.stringify({
      name: marketplaceName,
      plugins: [{ name: pluginName, source: `./plugins/${pluginName}`, version }],
    }),
  );

  const locations = locationsFor("project", opts.cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  const { saveState } =
    await import("../../extensions/pi-claude-marketplace/persistence/state-io.ts");
  const state = await loadState(locations.extensionRoot);
  await saveState(locations.extensionRoot, {
    schemaVersion: 1,
    marketplaces: {
      ...state.marketplaces,
      [marketplaceName]: {
        name: marketplaceName,
        scope: "project",
        source: pathSource(`./${path.basename(opts.marketplaceRoot)}`),
        addedFromCwd: opts.cwd,
        manifestPath,
        marketplaceRoot: opts.marketplaceRoot,
        plugins: {},
      },
    },
  });

  return { pluginRoot, manifestPath };
}

test("WINV-02 / WBRG-01: a workflow-bearing plugin installs with no partial flag, and the bridge materializes its script as an envelope", async () => {
  await withHermeticHome(async (home) => {
    const cwd = await mkdtemp(path.join(tmpdir(), "workflow-inversion-"));
    try {
      // arrange
      await seedWorkflowPlugin({
        cwd,
        marketplaceRoot: path.join(cwd, "mp-src"),
      });
      const { ctx, pi, notifications } = makeCtx();

      // act
      await installPlugin({
        ctx,
        pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });

      // assert -- WINV-02: the plain install succeeds on the clean installed row
      const summary = notifications.map((n) => n.message).join("\n");
      assert.ok(summary.includes("(installed)"), `expected (installed) row; got: ${summary}`);
      assert.ok(!summary.includes("(failed)"), `expected no failure row; got: ${summary}`);
      assert.ok(
        !summary.includes("(partially-available)"),
        `expected no partially-available token; got: ${summary}`,
      );
      assert.ok(!summary.includes("--partial"), `expected no partial-flag hint; got: ${summary}`);
      assert.ok(!summary.includes("{workflows}"), `expected no reason brace; got: ${summary}`);

      // assert -- WINV-01 precondition: the fixture must actually engage the
      // inverted kind. This is what keeps the envelope assertion below from
      // being green for the wrong reason: this block proves the resolver
      // admitted the kind, and that one proves the bridge acted on it.
      const persisted = await loadState(locationsFor("project", cwd).extensionRoot);
      const record = persisted.marketplaces["mp"]?.plugins["hello"];
      assert.ok(record, "expected an installed record for hello");
      assert.ok(
        record.compatibility.supported.includes("workflows"),
        `fixture must resolve workflows supported; got: ${record.compatibility.supported.join(" / ")}`,
      );
      assert.ok(
        !record.compatibility.unsupported.includes("workflows"),
        `workflows must not be recorded unsupported; got: ${record.compatibility.unsupported.join(" / ")}`,
      );

      // assert -- WLIF-01 / WBRG-01 / WPTH-01: the install itself now drives
      // the bridge, so the engine's storage root exists and the script has
      // materialized as an envelope at the project scope's canonical saved
      // path. The whole object is compared so a missing or extra field fails
      // the case; the byte-level key order is pinned by the staging module's
      // own owner test.
      await stat(path.join(home, ".pi", "workflows"));
      const locations = locationsFor("project", cwd);
      const envelopePath = path.join(locations.workflowsSavedDir, "hello:greet.json");

      assert.deepStrictEqual(JSON.parse(await readFile(envelopePath, "utf8")), {
        name: "hello:greet",
        description: "greets",
        script: 'export const meta = { name: "greet", description: "greets" };\n',
      });
      // WLIF-01: the record names exactly the envelope the install placed. It
      // is the only inventory of it that survives the process.
      assert.deepStrictEqual(record.resources.workflows, ["hello:greet"]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// RECON-05: a load-time reconcile does not re-materialize workflow envelopes
//
// Two independent structures already give this guarantee -- a declared,
// enabled, already-recorded plugin lands in no plan bucket, and the load-time
// backfill returns before scanning once the extension version has been stamped.
// The cases below pin the OBSERVABLE consequence of both, so a later change to
// either cannot quietly start rewriting executable code on every load.
//
// Modification times are read back off the real files. They are backdated
// first so that "no write happened" and "a write happened" are distinguishable
// without depending on the timer resolution of two operations that can land in
// the same millisecond -- the negative control at the bottom is what proves the
// harness can still see a write after the backdating.
// ──────────────────────────────────────────────────────────────────────────

/** A time far enough in the past that any real write moves it. */
const BACKDATED = new Date("2020-01-01T00:00:00.000Z");

async function backdate(...paths: readonly string[]): Promise<void> {
  for (const target of paths) {
    await utimes(target, BACKDATED, BACKDATED);
  }
}

async function mtimeMsOf(target: string): Promise<number> {
  return (await stat(target)).mtimeMs;
}

/**
 * WCONV-02: every axis a rewrite could move. Byte equality alone is satisfied
 * by an atomic rewrite of identical content, which is a write; the inode
 * catches that rename and the nanosecond mtime catches a truncating rewrite
 * that reused the inode.
 */
async function fileSnapshot(target: string): Promise<{
  readonly bytes: string;
  readonly inode: bigint;
  readonly mtimeNs: bigint;
}> {
  const [bytes, metadata] = await Promise.all([
    readFile(target, "utf8"),
    stat(target, { bigint: true }),
  ]);
  return Object.freeze({ bytes, inode: metadata.ino, mtimeNs: metadata.mtimeNs });
}

test("RECON-05: two consecutive reconciles leave a workflow envelope untouched", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "workflow-reconcile-idem-"));
    try {
      // arrange
      await seedWorkflowPlugin({ cwd, marketplaceRoot: path.join(cwd, "mp-src") });
      const install = makeCtx();
      await installPlugin({
        ctx: install.ctx,
        pi: install.pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      const locations = locationsFor("project", cwd);
      const envelopePath = path.join(locations.workflowsSavedDir, "hello:greet.json");
      await stat(envelopePath);
      await backdate(envelopePath, locations.stateJsonPath);

      // act -- the FIRST load also closes the backfill's version gate, which is
      // a state.json write by design, so only the envelope is claimed here.
      const first = makeCtx();
      await applyReconcile({ ctx: first.ctx, pi: first.pi, cwd, scope: "project" });
      const envelopeAfterFirst = await mtimeMsOf(envelopePath);
      const stateAfterFirst = await mtimeMsOf(locations.stateJsonPath);

      const second = makeCtx();
      await applyReconcile({ ctx: second.ctx, pi: second.pi, cwd, scope: "project" });

      // assert -- the envelope is untouched by BOTH loads, and the second load
      // touches nothing at all: the plugin is declared, enabled and recorded,
      // so it lands in no plan bucket, and the stamp the first load wrote
      // closes the backfill gate before it scans.
      assert.strictEqual(envelopeAfterFirst, BACKDATED.getTime());
      assert.strictEqual(await mtimeMsOf(envelopePath), BACKDATED.getTime());
      assert.strictEqual(await mtimeMsOf(locations.stateJsonPath), stateAfterFirst);
      // A clean, empty reconcile is documented as silent, so a notification is
      // itself a regression -- it would mean an outcome row accumulated.
      assert.deepStrictEqual(first.notifications, []);
      assert.deepStrictEqual(second.notifications, []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("RECON-05 negative control: a forced-open gate over a grown set DOES rewrite it", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "workflow-reconcile-control-"));
    try {
      // arrange -- the same install and the same mtime harness as the case
      // above, then the two conditions that case relies on being absent:
      // a recorded extension version that differs from the running constant
      // (gate open) over a record the resolver can now support more of than it
      // did (strict growth), which is what the backfill re-materializes.
      await seedWorkflowPlugin({ cwd, marketplaceRoot: path.join(cwd, "mp-src") });
      const install = makeCtx();
      await installPlugin({
        ctx: install.ctx,
        pi: install.pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      const locations = locationsFor("project", cwd);
      const envelopePath = path.join(locations.workflowsSavedDir, "hello:greet.json");
      const persisted = JSON.parse(await readFile(locations.stateJsonPath, "utf8")) as {
        lastReconciledExtensionVersion?: string;
        marketplaces: Record<
          string,
          {
            plugins: Record<
              string,
              {
                compatibility: {
                  installable: boolean;
                  notes: string[];
                  supported: string[];
                  unsupported: string[];
                };
              }
            >;
          }
        >;
      };
      const record = persisted.marketplaces["mp"]?.plugins["hello"];
      assert.ok(record, "precondition: the install must have written a record");
      assert.notStrictEqual(
        EXTENSION_VERSION,
        "0.0.0",
        "precondition: the forced stamp must differ from the running constant",
      );
      persisted.lastReconciledExtensionVersion = "0.0.0";
      record.compatibility = {
        installable: false,
        notes: [],
        supported: ["skills"],
        unsupported: ["workflows"],
      };
      await writeFile(locations.stateJsonPath, JSON.stringify(persisted));
      await backdate(envelopePath);

      // act
      const reconciled = makeCtx();
      await applyReconcile({ ctx: reconciled.ctx, pi: reconciled.pi, cwd, scope: "project" });

      // assert -- the SAME backdated-mtime harness the idempotence case uses
      // observes the rewrite, so that case's "unchanged" assertions are
      // measuring a write that this harness is capable of seeing.
      assert.notStrictEqual(await mtimeMsOf(envelopePath), BACKDATED.getTime());
      assert.deepStrictEqual(JSON.parse(await readFile(envelopePath, "utf8")), {
        name: "hello:greet",
        description: "greets",
        script: 'export const meta = { name: "greet", description: "greets" };\n',
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("WCONV-01 / WCONV-02: one load converges a record whose kind was invisible, and the next load rewrites nothing", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "workflow-convergence-"));
    try {
      // arrange -- install normally, then rewrite the record into the shape a
      // plugin leaves behind when it is installed while the workflows kind is
      // still invisible to the resolver: `installable: true`, `skills`
      // recorded, and NOTHING unsupported. That is the population this
      // convergence exists for, and it is why the record alone cannot be told
      // apart from a clean install -- only the growth test sees the boundary
      // move. The envelope goes with it, because that install never placed one.
      await seedWorkflowPlugin({ cwd, marketplaceRoot: path.join(cwd, "mp-src") });
      const install = makeCtx();
      await installPlugin({
        ctx: install.ctx,
        pi: install.pi,
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      const locations = locationsFor("project", cwd);
      const envelopePath = path.join(locations.workflowsSavedDir, "hello:greet.json");
      await rm(envelopePath);
      const { saveState } =
        await import("../../extensions/pi-claude-marketplace/persistence/state-io.ts");
      const seeded = await loadState(locations.extensionRoot);
      const seededRecord = seeded.marketplaces["mp"]?.plugins["hello"];
      assert.ok(seededRecord, "precondition: the install must have written a record");
      assert.notStrictEqual(
        EXTENSION_VERSION,
        "0.0.0",
        "precondition: the forced stamp must differ from the running constant",
      );
      seeded.lastReconciledExtensionVersion = "0.0.0";
      seededRecord.compatibility = {
        installable: true,
        notes: [],
        supported: ["skills"],
        unsupported: [],
      };
      seededRecord.resources = { ...seededRecord.resources, workflows: [] };
      await saveState(locations.extensionRoot, seeded);

      // act -- the load the user did not initiate
      const first = makeCtx();
      await applyReconcile({ ctx: first.ctx, pi: first.pi, cwd, scope: "project" });

      // assert -- the FIRST load converged. Without this half the equality
      // below would also be satisfied by a scan that never ran at all.
      const converged = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(converged, "expected the record to survive the load");
      assert.ok(
        converged.compatibility.supported.includes("workflows"),
        `expected the grown set to be recorded; got: ${converged.compatibility.supported.join(" / ")}`,
      );
      assert.deepStrictEqual(converged.resources.workflows, ["hello:greet"]);
      assert.deepStrictEqual(JSON.parse(await readFile(envelopePath, "utf8")), {
        name: "hello:greet",
        description: "greets",
        script: 'export const meta = { name: "greet", description: "greets" };\n',
      });
      assert.notDeepStrictEqual(first.notifications, []);

      // arrange -- the snapshot that matters is taken AFTER the first load: the
      // promotion legitimately rewrites the compatibility block, the resources
      // and the updated-at stamp, and the first load also closes the version
      // gate. Backdating first removes any dependence on two loads landing in
      // different timer ticks.
      await backdate(envelopePath, locations.stateJsonPath);
      const stateAfterFirst = await fileSnapshot(locations.stateJsonPath);
      const envelopeAfterFirst = await fileSnapshot(envelopePath);

      // act -- the next load over the converged scope
      const second = makeCtx();
      await applyReconcile({ ctx: second.ctx, pi: second.pi, cwd, scope: "project" });

      // assert -- self-heal is one-time. An atomic rewrite of identical content
      // is still a write, so bytes alone would not carry this claim.
      assert.deepStrictEqual(await fileSnapshot(locations.stateJsonPath), stateAfterFirst);
      assert.deepStrictEqual(await fileSnapshot(envelopePath), envelopeAfterFirst);
      assert.deepStrictEqual(second.notifications, []);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
