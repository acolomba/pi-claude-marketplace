// Spike 005: prototype against the REAL resolver + info orchestrator (no
// mocks of domain/business logic) to observe end-to-end what
// pi-claude-marketplace actually does when a plugin declares `dependencies`
// in the three shapes Spike 004 confirmed are valid upstream:
//   1. all bare strings           (this repo's existing test coverage)
//   2. mixed strings + objects    (upstream's own documented example)
//   3. all objects (version-pinned only) -- plausible real-world shape,
//      e.g. a "bundle" plugin whose whole point is pinned dependencies
//
// Run: node .planning/spikes/005-pi-cm-dependency-behavior/prototype.ts

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { getPluginInfo } from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/info.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { resolveStrict } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const CASES = [
  {
    name: "p-strings",
    label: "all bare strings (existing test shape)",
    dependencies: ["helper@utils-mp", "another@aux"],
  },
  {
    name: "p-mixed",
    label: "mixed strings + objects (upstream's own doc example)",
    dependencies: ["audit-logger", { name: "secrets-vault", version: "~2.1.0" }],
  },
  {
    name: "p-objects-only",
    label: "all objects, version-pinned only (bundle-style plugin)",
    dependencies: [{ name: "db-migrate", version: "^3.0" }, { name: "oncall-runbook" }],
  },
];

function makeCtx(): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: string[] } {
  const notifications: string[] = [];
  const pi = { getAllTools: (): unknown[] => [] } as unknown as ExtensionAPI;
  const ctx = {
    ui: { notify: (m: string): void => void notifications.push(m) },
    pi,
  } as unknown as ExtensionContext;
  return { ctx, pi, notifications };
}

async function main(): Promise<void> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "spike-005-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "spike-005-cwd-"));
  process.env.HOME = home;

  try {
    const scope = "user" as const;
    const locations = locationsFor(scope, cwd);
    await mkdir(locations.extensionRoot, { recursive: true });

    const mpRoot = path.join(home, ".pi", "agent", "pi-claude-marketplace", "marketplaces", "mp");
    await mkdir(path.join(mpRoot, ".claude-plugin"), { recursive: true });

    const plugins = CASES.map((c) => ({
      name: c.name,
      source: `./${c.name}`,
      version: "1.0.0",
      skills: "skills",
      dependencies: c.dependencies,
    }));
    await writeFile(
      path.join(mpRoot, ".claude-plugin", "marketplace.json"),
      JSON.stringify({ name: "mp", plugins }),
      "utf8",
    );

    for (const c of CASES) {
      await mkdir(path.join(mpRoot, c.name, "skills", "s1"), { recursive: true });
    }

    const stateJsonPath = path.join(locations.extensionRoot, "state.json");
    await writeFile(
      stateJsonPath,
      JSON.stringify({
        schemaVersion: 2,
        marketplaces: {
          mp: {
            name: "mp",
            scope,
            source: { kind: "path", raw: mpRoot },
            addedFromCwd: cwd,
            manifestPath: path.join(mpRoot, ".claude-plugin", "marketplace.json"),
            marketplaceRoot: mpRoot,
            plugins: Object.fromEntries(
              CASES.map((c) => [
                c.name,
                {
                  version: "1.0.0",
                  resolvedSource: `./${c.name}`,
                  compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
                  resources: {
                    skills: [`${c.name}-skill`],
                    prompts: [],
                    agents: [],
                    mcpServers: [],
                    hooks: [],
                  },
                  enabled: true,
                  installedAt: "2026-01-01T00:00:00.000Z",
                  updatedAt: "2026-01-01T00:00:00.000Z",
                },
              ]),
            ),
          },
        },
      }),
      "utf8",
    );

    console.log("=== Part 1: real resolveStrict() against each shape ===\n");
    for (const c of CASES) {
      const entry = {
        name: c.name,
        source: `./${c.name}`,
        version: "1.0.0",
        skills: "skills",
        dependencies: c.dependencies,
      };
      const resolved = await resolveStrict(entry as never, { marketplaceRoot: mpRoot });
      console.log(`${c.name} (${c.label})`);
      console.log(`  state: ${resolved.state}`);
      console.log(`  notes: ${JSON.stringify(resolved.notes)}`);
      console.log("");
    }

    console.log("=== Part 2: real getPluginInfo() rendered output per shape ===\n");
    for (const c of CASES) {
      const { ctx, pi, notifications } = makeCtx();
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: c.name, scope, cwd });
      console.log(`--- ${c.name} (${c.label}) ---`);
      console.log(notifications[0] ?? "(no notification)");
      console.log(
        notifications[0]?.includes("dependencies:")
          ? ">>> dependencies line PRESENT\n"
          : ">>> dependencies line ABSENT (info silently dropped it)\n",
      );
    }
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

await main();
