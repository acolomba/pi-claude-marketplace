import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { installPlugin } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

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
