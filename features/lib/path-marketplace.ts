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

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DataTable } from "@cucumber/cucumber";

/** A dependency element in object form: a plugin name and the version range it asks for. */
export interface RangedDependency {
  readonly name: string;
  readonly version: string;
}

/** One plugin the marketplace offers. */
export interface OfferedPlugin {
  readonly name: string;
  readonly version: string;
  /**
   * Dependency elements such as `lib`, `lib@tools` or `lib@^2.0.0`, or an
   * object naming a range the string form cannot carry; absent means none.
   */
  readonly dependencies?: readonly (string | RangedDependency)[];
}

/** Throws unless the table's header is exactly `columns`. */
export function requireColumns(table: DataTable, columns: readonly string[]): void {
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
 * One element of a `dependencies` cell: `lib (>=2.0.0)` is the object form
 * `{ "name": "lib", "version": ">=2.0.0" }`, for a range the string form
 * cannot carry; any other element is written as it reads.
 */
function readDependencyElement(element: string): string | RangedDependency {
  const ranged = /^(\S+) \((.+)\)$/.exec(element);
  return ranged?.[1] === undefined || ranged[2] === undefined
    ? element
    : { name: ranged[1], version: ranged[2] };
}

/**
 * Reads a `| name | version | dependencies |` table, throwing on a missing or
 * unknown column. The `dependencies` cell is a comma-separated list of
 * elements such as `lib`, `lib@tools`, `lib@^2.0.0` or `lib (>=2.0.0)`; an
 * empty cell means none.
 */
export function readOfferedPluginsWithDependencies(table: DataTable): OfferedPlugin[] {
  requireColumns(table, ["name", "version", "dependencies"]);
  return table.hashes().map((row) => {
    const dependencies = String(row.dependencies)
      .split(",")
      .map((element) => element.trim())
      .filter((element) => element !== "")
      .map(readDependencyElement);
    return {
      name: String(row.name),
      version: String(row.version),
      ...(dependencies.length > 0 && { dependencies }),
    };
  });
}

/**
 * Writes the plugin `plugin` at `pluginRoot`: its `plugin.json` and one skill
 * whose description names the plugin and its version.
 */
export async function writePluginFiles(pluginRoot: string, plugin: OfferedPlugin): Promise<void> {
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

async function writePlugin(root: string, plugin: OfferedPlugin): Promise<void> {
  await writePluginFiles(path.join(root, "plugins", plugin.name), plugin);
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
  manifestFile: string,
): Promise<void> {
  await Promise.all(plugins.map((plugin) => writePlugin(root, plugin)));
  await writeManifestText(manifestFile, manifestText(name, plugins));
}

/** Writes a manifest with a different byte length so the cache observes every rewrite. */
export async function writeManifestText(manifestFile: string, text: string): Promise<void> {
  let previousSize: number | undefined;
  try {
    previousSize = (await stat(manifestFile)).size;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  await mkdir(path.dirname(manifestFile), { recursive: true });
  await writeFile(manifestFile, Buffer.byteLength(text) === previousSize ? `${text}\n` : text);
}

/**
 * Adds `target` to the `allowCrossMarketplaceDependenciesOn` list of the
 * manifest, so its plugins may depend on plugins of `target`.
 */
export async function writeDependencyAllowance(
  manifestFile: string,
  target: string,
): Promise<void> {
  const manifest = JSON.parse(await readFile(manifestFile, "utf8")) as {
    allowCrossMarketplaceDependenciesOn?: string[];
  };
  manifest.allowCrossMarketplaceDependenciesOn = [
    ...(manifest.allowCrossMarketplaceDependenciesOn ?? []),
    target,
  ];
  await writeManifestText(manifestFile, JSON.stringify(manifest));
}

/** Sets the optional marketplace description without changing other fields. */
export async function writeMarketplaceDescription(
  manifestFile: string,
  description: string,
): Promise<void> {
  const manifest = JSON.parse(await readFile(manifestFile, "utf8")) as Record<string, unknown>;
  manifest.description = description;
  await writeManifestText(manifestFile, JSON.stringify(manifest));
}

/**
 * Rewrites the manifest of the marketplace `name` as valid JSON
 * that breaks the manifest schema: `plugins` is a string. Valid JSON keeps the
 * failure text the extension's own, and the new size defeats a manifest cache
 * keyed by modification time and size.
 */
export async function writeInvalidManifest(manifestFile: string, name: string): Promise<void> {
  await writeManifestText(
    manifestFile,
    JSON.stringify({ name, owner: { name: "features" }, plugins: "nope" }),
  );
}

/**
 * Rewrites the manifest of the marketplace `name` as JSON that
 * does not parse: the manifest with no plugins, short of its last character.
 * The manifest cache keys on modification time and size, remembers a failed
 * parse, and outlives a new session, so this text has a size of its own,
 * one byte less than the valid manifest.
 */
export async function writeMalformedManifest(manifestFile: string, name: string): Promise<void> {
  await writeManifestText(manifestFile, manifestText(name, []).slice(0, -1));
}
