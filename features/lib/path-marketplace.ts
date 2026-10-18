/**
 * @fileoverview A local marketplace that stands in for a published one.
 *
 * The marketplace is a directory with a `marketplace.json` manifest and one
 * plugin per entry, each with a single skill whose description names the
 * plugin version, so a new session shows which version is installed. Pi adds
 * it as a path source, so no scenario touches the network (NFR-5). Writing it
 * again with new versions publishes an update. A plugin's dependencies go in
 * its own `plugin.json`, which outranks the marketplace entry when Pi reads
 * what the plugin declares.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DataTable } from "@cucumber/cucumber";

/** One plugin the marketplace offers. */
export interface OfferedPlugin {
  readonly name: string;
  readonly version: string;
  /** Dependency elements such as `lib` or `lib@tools`; absent means none. */
  readonly dependencies?: readonly string[];
}

/** Throws unless the table's header is exactly `columns`. */
function requireColumns(table: DataTable, columns: readonly string[]): void {
  const [header] = table.raw();
  if (JSON.stringify(header) !== JSON.stringify(columns)) {
    throw new Error(`expected the columns ${columns.join(", ")}, got ${header?.join(", ")}`);
  }
}

/** Reads a `| name | version |` table, throwing on a missing or unknown column. */
export function readOfferedPlugins(table: DataTable): OfferedPlugin[] {
  requireColumns(table, ["name", "version"]);
  return table.hashes().map((row) => ({ name: String(row.name), version: String(row.version) }));
}

/**
 * Reads a `| name | version | dependencies |` table, throwing on a missing or
 * unknown column. The `dependencies` cell is a comma-separated list of
 * elements such as `lib` or `lib@tools`; an empty cell means none.
 */
export function readOfferedPluginsWithDependencies(table: DataTable): OfferedPlugin[] {
  requireColumns(table, ["name", "version", "dependencies"]);
  return table.hashes().map((row) => {
    const dependencies = String(row.dependencies)
      .split(",")
      .map((element) => element.trim())
      .filter((element) => element !== "");
    return {
      name: String(row.name),
      version: String(row.version),
      ...(dependencies.length > 0 && { dependencies }),
    };
  });
}

function manifestPath(root: string): string {
  return path.join(root, ".claude-plugin", "marketplace.json");
}

async function writePlugin(root: string, plugin: OfferedPlugin): Promise<void> {
  const pluginRoot = path.join(root, "plugins", plugin.name);
  const skillDir = path.join(pluginRoot, "skills", `${plugin.name}-skill`);
  await mkdir(path.join(pluginRoot, ".claude-plugin"), { recursive: true });
  await mkdir(skillDir, { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: plugin.name,
      version: plugin.version,
      ...(plugin.dependencies !== undefined && { dependencies: plugin.dependencies }),
    }),
  );
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${plugin.name}-skill\ndescription: A skill of ${plugin.name} ${plugin.version}.\n---\n\nVersion ${plugin.version}.\n`,
  );
}

function manifestText(name: string, plugins: readonly OfferedPlugin[]): string {
  return JSON.stringify({
    name,
    owner: { name: "features" },
    plugins: plugins.map((plugin) => ({
      name: plugin.name,
      source: `./plugins/${plugin.name}`,
      version: plugin.version,
    })),
  });
}

/** Writes the marketplace `name` under `root`, offering `plugins`. */
export async function writeMarketplace(
  root: string,
  name: string,
  plugins: readonly OfferedPlugin[],
): Promise<void> {
  await Promise.all(plugins.map((plugin) => writePlugin(root, plugin)));
  await mkdir(path.join(root, ".claude-plugin"), { recursive: true });
  await writeFile(manifestPath(root), manifestText(name, plugins));
}

/**
 * Adds `target` to the `allowCrossMarketplaceDependenciesOn` list of the
 * manifest under `root`, so its plugins may depend on plugins of `target`.
 */
export async function writeDependencyAllowance(root: string, target: string): Promise<void> {
  const manifest = JSON.parse(await readFile(manifestPath(root), "utf8")) as {
    allowCrossMarketplaceDependenciesOn?: string[];
  };
  manifest.allowCrossMarketplaceDependenciesOn = [
    ...(manifest.allowCrossMarketplaceDependenciesOn ?? []),
    target,
  ];
  await writeFile(manifestPath(root), JSON.stringify(manifest));
}

/** Sets the optional marketplace description without changing other fields. */
export async function writeMarketplaceDescription(
  root: string,
  description: string,
): Promise<void> {
  const manifest = JSON.parse(await readFile(manifestPath(root), "utf8")) as Record<
    string,
    unknown
  >;
  manifest.description = description;
  await writeFile(manifestPath(root), JSON.stringify(manifest));
}

/**
 * Rewrites the manifest of the marketplace `name` under `root` as valid JSON
 * that breaks the manifest schema: `plugins` is a string. Valid JSON keeps the
 * failure text the extension's own, and the new size defeats a manifest cache
 * keyed by modification time and size.
 */
export async function writeInvalidManifest(root: string, name: string): Promise<void> {
  await writeFile(
    manifestPath(root),
    JSON.stringify({ name, owner: { name: "features" }, plugins: "nope" }),
  );
}

/**
 * Rewrites the manifest of the marketplace `name` under `root` as JSON that
 * does not parse: the manifest with no plugins, short of its last character.
 * The manifest cache keys on modification time and size, remembers a failed
 * parse, and outlives a new session, so this text has a size of its own,
 * one byte less than the valid manifest.
 */
export async function writeMalformedManifest(root: string, name: string): Promise<void> {
  await writeFile(manifestPath(root), manifestText(name, []).slice(0, -1));
}
