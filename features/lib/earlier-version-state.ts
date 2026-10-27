/**
 * @fileoverview Writes the record and the declaration that an earlier
 * version's `marketplace add` wrote for a local marketplace, which today's add
 * may refuse, such as one under a reserved name.
 *
 * The record goes into the scope's `state.json` beside any record it already
 * holds, and the declaration is the only marketplace of the scope's base
 * `claude-plugins.json`.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { isPlainObject } from "./field-rows.ts";
import { writeLayerMarketplaces } from "./layer-config.ts";

import type { PathPublication } from "./published-marketplace.ts";

const STATE_SCHEMA_VERSION = 3;

/** The scope's installation record file under `scopeRoot`. */
function stateFilePath(scopeRoot: string): string {
  return path.join(scopeRoot, "pi-claude-marketplace", "state.json");
}

// `value` as a JSON object, throwing when it is anything else.
function jsonObject(value: unknown, what: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    throw new Error(`${what} is not a JSON object`);
  }

  return Object.fromEntries(Object.entries(value));
}

// The JSON object `file` holds, or an empty object when it does not exist.
async function readObject(file: string): Promise<Record<string, unknown>> {
  return existsSync(file) ? jsonObject(JSON.parse(await readFile(file, "utf8")), file) : {};
}

// The object member `member` of `holder`, or an empty object when it is absent.
function objectMember(holder: Record<string, unknown>, member: string): Record<string, unknown> {
  return holder[member] === undefined ? {} : jsonObject(holder[member], `the ${member} member`);
}

/**
 * Records the dir marketplace `published` as `name` in the scope at
 * `scopeRoot`, added from `projectDir`, the way an earlier version's
 * `marketplace add` recorded it, and declares it in the scope's base config.
 * Returns the record it wrote.
 */
export async function recordEarlierVersionMarketplace(args: {
  readonly scopeRoot: string;
  readonly scope: string;
  readonly projectDir: string;
  readonly name: string;
  readonly published: PathPublication;
}): Promise<unknown> {
  const { scopeRoot, scope, projectDir, name, published } = args;
  const stateFile = stateFilePath(scopeRoot);
  const state = await readObject(stateFile);
  const record = {
    name,
    scope,
    source: { kind: "path", raw: published.root, logical: published.root },
    addedFromCwd: projectDir,
    manifestPath: published.manifestPath,
    marketplaceRoot: published.root,
    plugins: {},
  };
  const marketplaces = { ...objectMember(state, "marketplaces"), [name]: record };
  await mkdir(path.dirname(stateFile), { recursive: true });
  await writeFile(
    stateFile,
    `${JSON.stringify({ ...state, schemaVersion: STATE_SCHEMA_VERSION, marketplaces }, null, 2)}\n`,
  );

  await writeLayerMarketplaces(path.join(scopeRoot, "claude-plugins.json"), [
    { name, entry: { source: published.root } },
  ]);
  return record;
}

/**
 * Rewrites the url source of the marketplace `name` in the scope's `state.json`
 * under `scopeRoot` to name `url`, the way an earlier version recorded a url
 * marketplace whose clone URL ends in `.json`. The checkout and every other
 * member of the record stay as they were. Returns the source it wrote.
 */
export async function recordEarlierVersionCloneUrl(args: {
  readonly scopeRoot: string;
  readonly name: string;
  readonly url: string;
}): Promise<unknown> {
  const { scopeRoot, name, url } = args;
  const stateFile = stateFilePath(scopeRoot);
  const state = await readObject(stateFile);
  const marketplaces = objectMember(state, "marketplaces");
  const record = jsonObject(marketplaces[name], `the record of the marketplace ${name}`);
  const source = { ...objectMember(record, "source"), kind: "url", raw: url, url };
  await writeFile(
    stateFile,
    `${JSON.stringify({ ...state, marketplaces: { ...marketplaces, [name]: { ...record, source } } }, null, 2)}\n`,
  );

  return source;
}

/** The record of the marketplace `name` in the scope's `state.json` under `scopeRoot`. */
export async function recordedMarketplace(scopeRoot: string, name: string): Promise<unknown> {
  return objectMember(await readObject(stateFilePath(scopeRoot)), "marketplaces")[name];
}
