/**
 * @fileoverview A local marketplace that stands in for a published one.
 *
 * The marketplace is a directory with a `marketplace.json` manifest and one
 * plugin per entry, each with a single skill. Pi adds it as a path source, so
 * no scenario touches the network (NFR-5). Writing it again with new versions
 * publishes an update.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** One plugin the marketplace offers. */
export interface OfferedPlugin {
  readonly name: string;
  readonly version: string;
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
    `---\nname: ${plugin.name}-skill\ndescription: A skill of ${plugin.name}.\n---\n\nVersion ${plugin.version}.\n`,
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
    path.join(root, ".claude-plugin", "marketplace.json"),
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
