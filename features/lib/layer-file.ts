/**
 * @fileoverview Reads the plugin table of the one setup step that writes a
 * layer file, and writes that file's `plugins` member.
 *
 * The step models a hand edit or a version-control update of one layer file of
 * a scope. It owns only the `plugins` member: every other member, such as the
 * `marketplaces` member a `marketplace add` wrote, stays as it is.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { isPlainObject } from "./field-rows.ts";

import type { DataTable } from "@cucumber/cucumber";

/** One plugin declaration of a layer file, under its `<plugin>@<marketplace>` key. */
export interface LayerPlugin {
  readonly key: string;
  readonly entry: { readonly enabled?: boolean };
}

const COLUMNS: readonly string[] = ["marketplace", "plugin", "enabled"];

// `true` and `false` set the field, an empty cell leaves it out.
function readEnabled(cell: string, key: string): { readonly enabled?: boolean } {
  switch (cell) {
    case "true":
      return { enabled: true };
    case "false":
      return { enabled: false };
    case "":
      return {};
    default:
      throw new Error(`the enabled cell of ${key} is ${cell}; expected true, false, or empty`);
  }
}

/**
 * Reads a `| marketplace | plugin | enabled |` table, throwing on a missing or
 * unknown column and on an `enabled` cell other than `true`, `false`, or empty.
 */
export function readLayerPlugins(table: DataTable): LayerPlugin[] {
  const [header] = table.raw();
  if (JSON.stringify(header) !== JSON.stringify(COLUMNS)) {
    throw new Error(`expected the columns ${COLUMNS.join(", ")}, got ${header?.join(", ")}`);
  }

  return table.hashes().map((row) => {
    const key = `${String(row.plugin)}@${String(row.marketplace)}`;
    return { key, entry: readEnabled(String(row.enabled), key) };
  });
}

// The layer file as a JSON object, or a new file's first member when it does
// not exist yet.
async function readLayerObject(filePath: string): Promise<object> {
  if (!existsSync(filePath)) {
    return { schemaVersion: 1 };
  }

  const content = await readFile(filePath, "utf8");
  const config: unknown = JSON.parse(content);
  if (!isPlainObject(config)) {
    throw new Error(`${filePath} is not a JSON object: ${content}`);
  }

  return config;
}

/**
 * Replaces the `plugins` member of the layer file at `filePath` with exactly
 * `plugins`, keeping every other member, and creates the file and its
 * directory when they do not exist.
 */
export async function writeLayerPlugins(
  filePath: string,
  plugins: readonly LayerPlugin[],
): Promise<void> {
  const config = await readLayerObject(filePath);
  const written = {
    ...config,
    plugins: Object.fromEntries(plugins.map(({ key, entry }) => [key, entry])),
  };
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(written, null, 2)}\n`);
}
