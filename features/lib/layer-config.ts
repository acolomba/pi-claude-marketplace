/**
 * @fileoverview Writes one layer config of a scope for the three setup steps
 * that write one.
 *
 * The steps model a hand edit or a version-control update of one layer config.
 * One writes only the `plugins` member, from a plugin table this module reads,
 * and one writes only the `marketplaces` member, from a marketplace table this
 * module reads: every other member of the file stays as it is. The third
 * writes the whole text of the file, which can leave it broken.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { isPlainObject } from "./field-rows.ts";
import { requireColumns } from "./path-marketplace.ts";

import type { DataTable } from "@cucumber/cucumber";

/** One plugin declaration of a layer config, under its `<plugin>@<marketplace>` key. */
export interface LayerPlugin {
  readonly key: string;
  readonly entry: { readonly enabled?: boolean };
}

/** One marketplace declaration of a layer config, under its name. */
export interface LayerMarketplace {
  readonly name: string;
  readonly entry: { readonly source: string; readonly autoupdate?: boolean };
}

const PLUGIN_COLUMNS: readonly string[] = ["marketplace", "plugin", "enabled"];
const MARKETPLACE_COLUMNS: readonly string[] = ["name", "source", "autoupdate"];

// `true` and `false` set the field, an empty cell leaves it out.
function readFlag(column: string, cell: string, key: string): boolean | undefined {
  switch (cell) {
    case "true":
      return true;
    case "false":
      return false;
    case "":
      return undefined;
    default:
      throw new Error(`the ${column} cell of ${key} is ${cell}; expected true, false, or empty`);
  }
}

// A config map keeps one entry per key, so a repeated row would vanish into
// the last one; the table must name each key once.
function requireDistinct(keys: readonly string[], what: string): void {
  if (new Set(keys).size !== keys.length) {
    throw new Error(`the table declares a ${what} twice: ${JSON.stringify(keys)}`);
  }
}

/**
 * Reads a `| marketplace | plugin | enabled |` table, throwing on a missing or
 * unknown column, on an `enabled` cell other than `true`, `false`, or empty,
 * and on a plugin the table declares twice.
 */
export function readLayerPlugins(table: DataTable): LayerPlugin[] {
  requireColumns(table, PLUGIN_COLUMNS);
  const plugins = table.hashes().map((row) => {
    const key = `${String(row.plugin)}@${String(row.marketplace)}`;
    const enabled = readFlag("enabled", String(row.enabled), key);
    return { key, entry: enabled === undefined ? {} : { enabled } };
  });
  requireDistinct(
    plugins.map((plugin) => plugin.key),
    "plugin",
  );
  return plugins;
}

/**
 * Reads a `| name | source | autoupdate |` table, throwing on a missing or
 * unknown column, on an `autoupdate` cell other than `true`, `false`, or
 * empty, and on a marketplace the table declares twice. The source stays as
 * the table states it, run tokens included.
 */
export function readLayerMarketplaces(table: DataTable): LayerMarketplace[] {
  requireColumns(table, MARKETPLACE_COLUMNS);
  const marketplaces = table.hashes().map((row) => {
    const name = String(row.name);
    const source = String(row.source);
    const autoupdate = readFlag("autoupdate", String(row.autoupdate), name);
    return { name, entry: autoupdate === undefined ? { source } : { source, autoupdate } };
  });
  requireDistinct(
    marketplaces.map((marketplace) => marketplace.name),
    "marketplace",
  );
  return marketplaces;
}

// The layer config as a JSON object, or a new file's first member when it does
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

// Replaces one member of the layer config at `filePath` with `value`, keeping
// every other member, and creates the file and its directory when they do not
// exist.
async function writeLayerMember(
  filePath: string,
  member: "marketplaces" | "plugins",
  value: object,
): Promise<void> {
  const written = { ...(await readLayerObject(filePath)), [member]: value };
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(written, null, 2)}\n`);
}

/**
 * Replaces the `plugins` member of the layer config at `filePath` with exactly
 * `plugins`, keeping every other member, and creates the file and its
 * directory when they do not exist.
 */
export async function writeLayerPlugins(
  filePath: string,
  plugins: readonly LayerPlugin[],
): Promise<void> {
  await writeLayerMember(
    filePath,
    "plugins",
    Object.fromEntries(plugins.map(({ key, entry }) => [key, entry])),
  );
}

/**
 * Replaces the `marketplaces` member of the layer config at `filePath` with
 * exactly `marketplaces`, keeping every other member, and creates the file and
 * its directory when they do not exist.
 */
export async function writeLayerMarketplaces(
  filePath: string,
  marketplaces: readonly LayerMarketplace[],
): Promise<void> {
  await writeLayerMember(
    filePath,
    "marketplaces",
    Object.fromEntries(marketplaces.map(({ name, entry }) => [name, entry])),
  );
}

/**
 * Writes `text` as the whole layer config at `filePath`, as a hand edit that
 * can break the file, and creates its directory when it does not exist.
 */
export async function writeLayerText(filePath: string, text: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, text);
}
