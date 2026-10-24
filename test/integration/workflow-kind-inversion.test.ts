import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { createInstallOperation } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/operations.ts";
import { createApplyReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import { createLoadReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/load.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { runWithNothingLoaded } from "../shared/notification-run-seeds.ts";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const applyReconcile = createApplyReconcile({ loadState });
const loadReconcile = createLoadReconcile({ loadState });
const installPlugin = createInstallOperation(
  createHooksRouting(createHooksRuntime(), { readHooksJson }),
  createCompletionCache(),
);

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

/** APL-01 / D-08: the advisory an apply pass that accumulates no outcome sends. */
const APPLY_EMPTY_NOTICE: NotifyRecord = { message: "Apply: nothing to change." };

function makeCtx(): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    mode: "tui",
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
 *
 * WPTH-04: `PI_CODING_AGENT_DIR` is cleared for the same span, so the workflow
 * root is `<home>/.pi/workflows/`. With the variable set, the cases would write
 * into the developer's real workflow root.
 */
async function withHermeticHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "workflow-inversion-home-"));
  const prevHome = process.env.HOME;
  const prevAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.HOME = hermeticHome;
  delete process.env.PI_CODING_AGENT_DIR;
  try {
    return await fn(hermeticHome);
  } finally {
    if (prevHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = prevHome;
    }

    if (prevAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = prevAgentDir;
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
      const { ctx, notifications } = makeCtx();

      // act
      await installPlugin({
        ctx,
        run: runWithNothingLoaded(),
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
// RECON-05: `apply` does not re-materialize workflow envelopes
//
// Two independent structures already give this guarantee -- a declared,
// enabled, already-recorded plugin lands in no plan bucket, and a record whose
// catalog candidate neither moved nor grew its supported set is no catalog
// move (D-10). The cases below pin the OBSERVABLE consequence of both, so a
// later change to either cannot quietly start rewriting executable code on
// every `apply`.
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
        run: runWithNothingLoaded(),
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      const locations = locationsFor("project", cwd);
      const envelopePath = path.join(locations.workflowsSavedDir, "hello:greet.json");
      await stat(envelopePath);
      await backdate(envelopePath, locations.stateJsonPath);

      // act
      const first = makeCtx();
      await applyReconcile({
        ctx: first.ctx,
        run: runWithNothingLoaded(),
        cwd,
        scope: "project",
        hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
        completionCache: createCompletionCache(),
      });
      const envelopeAfterFirst = await mtimeMsOf(envelopePath);

      const second = makeCtx();
      await applyReconcile({
        ctx: second.ctx,
        run: runWithNothingLoaded(),
        cwd,
        scope: "project",
        hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
        completionCache: createCompletionCache(),
      });

      // assert -- neither apply touches the envelope or state.json: the plugin
      // is declared, enabled and recorded, so it lands in no plan bucket, and
      // its supported set did not grow, so it is no catalog move. D-13: no
      // apply writes the extension-version stamp either.
      assert.strictEqual(envelopeAfterFirst, BACKDATED.getTime());
      assert.strictEqual(await mtimeMsOf(envelopePath), BACKDATED.getTime());
      assert.strictEqual(await mtimeMsOf(locations.stateJsonPath), BACKDATED.getTime());
      // D-08: a clean, empty apply reports only that it has nothing to change,
      // so any other notification is a regression -- it would mean an outcome
      // row accumulated.
      assert.deepStrictEqual(first.notifications, [APPLY_EMPTY_NOTICE]);
      assert.deepStrictEqual(second.notifications, [APPLY_EMPTY_NOTICE]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});

test("RECON-05 negative control: a record whose supported set grew DOES rewrite it", async () => {
  await withHermeticHome(async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "workflow-reconcile-control-"));
    try {
      // arrange -- the same install and the same mtime harness as the case
      // above, then the condition that case relies on being absent: a record
      // the resolver can now support more of than it did (strict growth),
      // which `apply` re-materializes (D-10, D-25).
      await seedWorkflowPlugin({ cwd, marketplaceRoot: path.join(cwd, "mp-src") });
      const install = makeCtx();
      await installPlugin({
        ctx: install.ctx,
        run: runWithNothingLoaded(),
        scope: "project",
        cwd,
        marketplace: "mp",
        plugin: "hello",
      });
      const locations = locationsFor("project", cwd);
      const envelopePath = path.join(locations.workflowsSavedDir, "hello:greet.json");
      const persisted = JSON.parse(await readFile(locations.stateJsonPath, "utf8")) as {
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
      await applyReconcile({
        ctx: reconciled.ctx,
        run: runWithNothingLoaded(),
        cwd,
        scope: "project",
        hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
        completionCache: createCompletionCache(),
      });

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

test("WCONV-01 / WCONV-02: a load leaves a record whose kind was invisible alone, one apply converges it, and the next apply rewrites nothing", async () => {
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
        run: runWithNothingLoaded(),
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
      seededRecord.compatibility = {
        installable: true,
        notes: [],
        supported: ["skills"],
        unsupported: [],
      };
      seededRecord.resources = { ...seededRecord.resources, workflows: [] };
      await saveState(locations.extensionRoot, seeded);
      const stateBeforeLoad = await fileSnapshot(locations.stateJsonPath);

      // act -- the load the user did not initiate
      const load = makeCtx();
      await loadReconcile({
        ctx: load.ctx,
        run: runWithNothingLoaded(),
        cwd,
        hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
      });

      // assert -- APL-03 / D-04: the load only previews the growth move; it
      // writes no record and places no envelope.
      assert.deepStrictEqual(await fileSnapshot(locations.stateJsonPath), stateBeforeLoad);
      await assert.rejects(stat(envelopePath), { code: "ENOENT" });
      assert.match(
        load.notifications.map((n) => n.message).join("\n"),
        /hello .*\(will update\) \{components now supported/,
      );

      // act -- the apply the user runs
      const first = makeCtx();
      await applyReconcile({
        ctx: first.ctx,
        run: runWithNothingLoaded(),
        cwd,
        scope: "project",
        hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
        completionCache: createCompletionCache(),
      });

      // assert -- the apply converged. Without this half the equality below
      // would also be satisfied by a convergence that never ran at all.
      const converged = (await loadState(locations.extensionRoot)).marketplaces["mp"]?.plugins[
        "hello"
      ];
      assert.ok(converged, "expected the record to survive the apply");
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
      // WCONV-03 on the bytes, not on the count. This case drives the real
      // applyReconcile -> convergence -> projection -> notify chain over an
      // installed plugin, so the PRODUCER of the convergence marker is
      // exercised end to end; the catalog cases hand-build their input. An
      // "emitted something" assertion would stay green through a regression that
      // stopped producing the outcome, or produced it under another kind.
      // The converged record now declares a `workflows` dependency, and this
      // test's run never loads the host workflow engine, so the soft-dep
      // marker joins the convergence reason in the same brace (WDEP-01).
      assert.match(
        first.notifications.map((n) => n.message).join("\n"),
        /\(installed\) \{components now supported, requires pi-dynamic-workflows\}/,
      );

      // arrange -- the snapshot that matters is taken AFTER the first apply: the
      // promotion legitimately rewrites the compatibility block, the resources
      // and the updated-at stamp. Backdating first removes any dependence on
      // two applies landing in different timer ticks.
      await backdate(envelopePath, locations.stateJsonPath);
      const stateAfterFirst = await fileSnapshot(locations.stateJsonPath);
      const envelopeAfterFirst = await fileSnapshot(envelopePath);

      // act -- the next apply over the converged scope
      const second = makeCtx();
      await applyReconcile({
        ctx: second.ctx,
        run: runWithNothingLoaded(),
        cwd,
        scope: "project",
        hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
        completionCache: createCompletionCache(),
      });

      // assert -- self-heal is one-time. An atomic rewrite of identical content
      // is still a write, so bytes alone would not carry this claim.
      assert.deepStrictEqual(await fileSnapshot(locations.stateJsonPath), stateAfterFirst);
      assert.deepStrictEqual(await fileSnapshot(envelopePath), envelopeAfterFirst);
      assert.deepStrictEqual(second.notifications, [APPLY_EMPTY_NOTICE]);
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
