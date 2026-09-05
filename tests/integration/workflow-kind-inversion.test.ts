import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import { installPlugin } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/install.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

// WINV-02 install-level proof: a plugin carrying a `workflows/` directory
// installs on a plain `install`, with no partial opt-in, and renders the clean
// installed row. D-109-06 pins the other half of the same install -- the host
// engine's storage root is not written, because the kind resolves supported
// while no bridge materializes it.

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
    `export default { name: "greet" };\n`,
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

  const { saveState, loadState } =
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

test("WINV-02 / D-109-06: a workflow-bearing plugin installs with no partial flag and writes no workflow artifact", async () => {
  await withHermeticHome(async (home) => {
    const cwd = await mkdtemp(path.join(tmpdir(), "workflow-inversion-"));
    try {
      // arrange
      await seedWorkflowPlugin({ cwd, marketplaceRoot: path.join(cwd, "mp-src") });
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

      // assert -- D-109-06: the workflows kind resolves supported, and no bridge
      // materializes it, so the host engine's storage root is never created.
      await assert.rejects(stat(path.join(home, ".pi", "workflows")), {
        code: "ENOENT",
      });
    } finally {
      await rm(cwd, { recursive: true, force: true });
    }
  });
});
