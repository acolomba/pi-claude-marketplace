/**
 * @fileoverview A local marketplace that stands in for a published one.
 *
 * The marketplace is a directory with a `marketplace.json` manifest and one
 * plugin per entry, each with a single skill whose description names the
 * plugin version, so a new session shows which version is installed. Pi adds
 * it as a path source, so no scenario touches the network (NFR-5). Writing it
 * again with new versions publishes an update.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DataTable } from "@cucumber/cucumber";

/** One plugin the marketplace offers. */
export interface OfferedPlugin {
  readonly name: string;
  readonly version: string;
}

const OFFERED_PLUGIN_COLUMNS = ["name", "version"];

/** Reads a `| name | version |` table, throwing on a missing or unknown column. */
export function readOfferedPlugins(table: DataTable): OfferedPlugin[] {
  const [header] = table.raw();
  if (JSON.stringify(header) !== JSON.stringify(OFFERED_PLUGIN_COLUMNS)) {
    throw new Error(
      `expected the columns ${OFFERED_PLUGIN_COLUMNS.join(", ")}, got ${header?.join(", ")}`,
    );
  }

  return table.hashes().map((row) => ({ name: String(row.name), version: String(row.version) }));
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
    JSON.stringify({ name: plugin.name, version: plugin.version }),
  );
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${plugin.name}-skill\ndescription: A skill of ${plugin.name} ${plugin.version}.\n---\n\nVersion ${plugin.version}.\n`,
  );
}

/** Writes the marketplace `name` under `root`, offering `plugins`. */
export async function writeMarketplace(
  root: string,
  name: string,
  plugins: readonly OfferedPlugin[],
): Promise<void> {
  await Promise.all(plugins.map((plugin) => writePlugin(root, plugin)));
  await mkdir(path.join(root, ".claude-plugin"), { recursive: true });
  await writeFile(
    manifestPath(root),
    JSON.stringify({
      name,
      owner: { name: "features" },
      plugins: plugins.map((plugin) => ({
        name: plugin.name,
        source: `./plugins/${plugin.name}`,
        version: plugin.version,
      })),
    }),
  );
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
