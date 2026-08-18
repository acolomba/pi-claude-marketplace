// tests/helpers/marketplace-seed.ts
//
// Shared fixture primitives for the orchestrator suites that seed a
// path-source marketplace into a scope's `state.json`.
//
// Only the parts that are IDENTICAL across those suites live here. The
// per-plugin `resources` defaults deliberately do NOT: `list.test.ts` pins the
// ENBL-18 semantics (disable preserves every array, `hooksOnly` seeds the
// hooks axis alone), `info.test.ts` seeds an empty inventory for a disabled
// record, and `info-manifest-absent.test.ts` gives a disabled record the same
// populated arrays an enabled one carries so the INFO-11 name lists have
// something to render. Those are three different fixture contracts, so each
// caller computes its own `resources` and passes the result in.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { saveConfig } from "../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { saveState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

import type { ScopedLocations } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";

/** The five inventory axes a persisted install record carries. */
export interface SeededResources {
  skills: string[];
  prompts: string[];
  agents: string[];
  mcpServers: string[];
  hooks: string[];
}

export interface SeededRecordInput {
  readonly version: string;
  /** Sets the record's `enabled` field to false (the ENBL-05 disabled marker). */
  readonly disabled?: boolean;
  /**
   * FSTAT-01 / D-66-01: the persisted `compatibility.unsupported` kinds. A
   * non-empty value reproduces a record that resolved `unsupported` at install
   * time, which is what makes `installable` false.
   */
  readonly unsupported?: readonly string[];
  readonly resolvedSource?: string;
  readonly hookEntries?: readonly Record<string, unknown>[];
}

/**
 * Build one persisted plugin install record. The caller supplies the resolved
 * `resources` because each suite's default inventory contract differs.
 */
export function buildInstalledPluginRecord(
  info: SeededRecordInput,
  resources: SeededResources,
): Record<string, unknown> {
  const unsupported = info.unsupported ?? [];
  return {
    version: info.version,
    resolvedSource: info.resolvedSource ?? "./placeholder",
    ...(info.hookEntries !== undefined && {
      hookEntries: info.hookEntries.map((e) => ({ ...e })),
    }),
    compatibility: {
      installable: unsupported.length === 0,
      notes: [],
      supported: [],
      unsupported: [...unsupported],
    },
    resources,
    enabled: info.disabled !== true,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

/**
 * Merge one marketplace record into the scope's `state.json`, preserving any
 * marketplace a previous seed call already wrote. A missing or unreadable
 * state.json means this is the first marketplace in the scope.
 */
export async function mergeMarketplaceIntoState(
  extensionRoot: string,
  mpName: string,
  record: Record<string, unknown>,
): Promise<void> {
  let existing: { marketplaces: Record<string, unknown> } = { marketplaces: {} };
  try {
    const raw = await readFile(path.join(extensionRoot, "state.json"), "utf8");
    existing = JSON.parse(raw) as { marketplaces: Record<string, unknown> };
  } catch {
    /* first marketplace in scope */
  }

  await saveState(extensionRoot, {
    schemaVersion: 2,
    marketplaces: { ...existing.marketplaces, [mpName]: record },
  } as unknown as Parameters<typeof saveState>[1]);
}

/**
 * SPLIT-01: `autoupdate` is read from `claude-plugins.json`, not from the
 * state record, so a fixture that pins autoupdate must seed the config too.
 * Existing marketplace entries are preserved.
 */
export async function seedAutoupdateConfig(
  locations: ScopedLocations,
  mpName: string,
  autoupdate: boolean,
): Promise<void> {
  const cfgPath = locations.configJsonPath;
  let existing: { marketplaces?: Record<string, { source: string; autoupdate?: boolean }> } = {};
  try {
    existing = JSON.parse(await readFile(cfgPath, "utf8")) as typeof existing;
  } catch {
    /* first marketplace in scope */
  }

  await saveConfig(
    cfgPath,
    {
      schemaVersion: 1,
      marketplaces: {
        ...(existing.marketplaces ?? {}),
        [mpName]: { source: `./${mpName}-src`, autoupdate },
      },
    },
    locations.scopeRoot,
  );
}

/**
 * Create the plugin source tree under a marketplace root so `resolveStrict`'s
 * `statKind` probe finds the paths a manifest entry declares.
 *
 * `installablePluginDirs` are plugin roots; `componentDirs` are per-plugin
 * component DIRECTORIES (skills); `componentFiles` are per-plugin component
 * FILES (agents and commands are `.md` files, not directories).
 */
export async function materializeMarketplaceTree(
  mpRoot: string,
  tree: {
    readonly installablePluginDirs?: readonly string[];
    readonly componentDirs?: Record<string, readonly string[]>;
    readonly componentFiles?: Record<string, readonly string[]>;
  },
): Promise<void> {
  for (const rel of tree.installablePluginDirs ?? []) {
    await mkdir(path.join(mpRoot, rel), { recursive: true });
  }

  for (const [pluginDir, components] of Object.entries(tree.componentDirs ?? {})) {
    for (const c of components) {
      await mkdir(path.join(mpRoot, pluginDir, c), { recursive: true });
    }
  }

  for (const [pluginDir, files] of Object.entries(tree.componentFiles ?? {})) {
    for (const rel of files) {
      const abs = path.join(mpRoot, pluginDir, rel);
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, "", "utf8");
    }
  }
}
