/**
 * @fileoverview Writes a scope's `state.json` the way an earlier or a newer
 * release left it (D-BG-13).
 *
 * One writer records the marketplace and the declaration that an earlier
 * version's `marketplace add` wrote for a local marketplace, which today's add
 * may refuse, such as one under a reserved name. The record goes into the
 * scope's `state.json` beside any record it already holds, and the
 * declaration is the only marketplace of the scope's base `claude-plugins.json`.
 *
 * Another rewrites the whole file into the shape that a named release
 * persisted, from that release's schema in the repository's history, and one
 * gives the file a schema version newer than this release reads. Every writer
 * takes the scope root its caller names, which lies in the scenario's sandbox.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
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

// The members one object of a release's `state.json` holds: those the
// release's schema required, and those it let a writer leave out.
interface ReleaseMembers {
  readonly required: readonly string[];
  readonly optional: readonly string[];
}

// The members a release kept on the file and on each object nested in it.
// A release `beforeConfig` wrote no config files, and kept a marketplace's
// `autoupdate` on its record.
interface ReleaseShape {
  readonly schemaVersion: number;
  readonly beforeConfig: boolean;
  readonly file: ReleaseMembers;
  readonly marketplace: ReleaseMembers;
  readonly source: ReleaseMembers;
  readonly plugin: ReleaseMembers;
  readonly compatibility: ReleaseMembers;
  readonly resources: ReleaseMembers;
}

// The path source every release named here persisted, from `pathSource`.
const PATH_SOURCE: ReleaseMembers = { required: ["kind", "raw", "logical"], optional: [] };

const COMPATIBILITY: ReleaseMembers = {
  required: ["installable", "notes", "supported", "unsupported"],
  optional: [],
};

const MARKETPLACE: ReleaseMembers = {
  required: [
    "name",
    "scope",
    "source",
    "addedFromCwd",
    "manifestPath",
    "marketplaceRoot",
    "plugins",
  ],
  optional: ["lastUpdatedAt"],
};

const PLUGIN_BEFORE_ENABLED: ReleaseMembers = {
  required: ["version", "resolvedSource", "compatibility", "resources", "installedAt", "updatedAt"],
  optional: [],
};

const RESOURCES_BEFORE_HOOKS: ReleaseMembers = {
  required: ["skills", "prompts", "agents", "mcpServers"],
  optional: [],
};

const RESOURCES_WITH_HOOKS: ReleaseMembers = {
  required: [...RESOURCES_BEFORE_HOOKS.required, "hooks"],
  optional: [],
};

// Each release's shape, from `persistence/state-io.ts` at its tag.
const RELEASE_SHAPES: ReadonlyMap<string, ReleaseShape> = new Map([
  [
    "0.4.3",
    {
      schemaVersion: 1,
      beforeConfig: true,
      file: { required: ["schemaVersion", "marketplaces"], optional: [] },
      marketplace: { ...MARKETPLACE, optional: [...MARKETPLACE.optional, "autoupdate"] },
      source: PATH_SOURCE,
      plugin: PLUGIN_BEFORE_ENABLED,
      compatibility: COMPATIBILITY,
      resources: RESOURCES_BEFORE_HOOKS,
    },
  ],
  [
    "0.6.0",
    {
      schemaVersion: 1,
      beforeConfig: false,
      file: { required: ["schemaVersion", "marketplaces"], optional: [] },
      marketplace: MARKETPLACE,
      source: PATH_SOURCE,
      plugin: PLUGIN_BEFORE_ENABLED,
      compatibility: COMPATIBILITY,
      resources: RESOURCES_WITH_HOOKS,
    },
  ],
  [
    "0.19.2",
    {
      schemaVersion: 2,
      beforeConfig: false,
      file: {
        required: ["schemaVersion", "marketplaces"],
        optional: ["lastReconciledExtensionVersion"],
      },
      marketplace: MARKETPLACE,
      source: PATH_SOURCE,
      plugin: {
        required: [...PLUGIN_BEFORE_ENABLED.required, "enabled"],
        optional: ["resolvedSha", "hookEntries"],
      },
      compatibility: COMPATIBILITY,
      resources: RESOURCES_WITH_HOOKS,
    },
  ],
]);

// The members of `holder` that `members` names, in their order in `holder`.
// Throws with the first required member `holder` lacks.
function keepMembers(
  holder: Record<string, unknown>,
  members: ReleaseMembers,
  what: string,
): Record<string, unknown> {
  const missing = members.required.find((member) => !Object.hasOwn(holder, member));
  if (missing !== undefined) {
    throw new Error(`${what} has no ${missing} member, which the release required`);
  }

  const kept = new Set([...members.required, ...members.optional]);
  return Object.fromEntries(Object.entries(holder).filter(([member]) => kept.has(member)));
}

// The nested object `holder[member]` with only the members `members` names.
function keepNested(
  holder: Record<string, unknown>,
  member: string,
  members: ReleaseMembers,
  what: string,
): Record<string, unknown> {
  const nested = `the ${member} of ${what}`;
  return keepMembers(jsonObject(holder[member], nested), members, nested);
}

// The plugin record `record` with only the members `shape` kept.
function releasePlugin(
  record: unknown,
  shape: ReleaseShape,
  what: string,
): Record<string, unknown> {
  const plugin = keepMembers(jsonObject(record, what), shape.plugin, what);
  return {
    ...plugin,
    compatibility: keepNested(plugin, "compatibility", shape.compatibility, what),
    resources: keepNested(plugin, "resources", shape.resources, what),
  };
}

// The `autoupdate` the base config of the scope at `scopeRoot` declares for
// each marketplace that declares one.
async function declaredAutoupdates(scopeRoot: string): Promise<ReadonlyMap<string, boolean>> {
  const config = await readObject(path.join(scopeRoot, "claude-plugins.json"));
  const declared = Object.entries(objectMember(config, "marketplaces")).map(
    ([name, entry]): [string, unknown] => [name, objectMember({ entry }, "entry").autoupdate],
  );
  return new Map(
    declared.filter((pair): pair is [string, boolean] => typeof pair[1] === "boolean"),
  );
}

// The marketplace record `record` with only the members `shape` kept, and
// with `autoupdate` when it is given.
function releaseMarketplace(
  name: string,
  record: unknown,
  shape: ReleaseShape,
  autoupdate: boolean | undefined,
): Record<string, unknown> {
  const what = `the record of the marketplace ${name}`;
  const marketplace = keepMembers(jsonObject(record, what), shape.marketplace, what);
  const source = keepNested(marketplace, "source", shape.source, what);
  if (source.kind !== "path") {
    throw new Error(`${what} has a ${String(source.kind)} source; only a path source is written`);
  }

  const plugins = Object.entries(objectMember(marketplace, "plugins")).map(
    ([plugin, pluginRecord]): [string, Record<string, unknown>] => [
      plugin,
      releasePlugin(pluginRecord, shape, `the record of ${plugin}@${name}`),
    ],
  );
  return {
    ...marketplace,
    ...(autoupdate === undefined ? {} : { autoupdate }),
    source,
    plugins: Object.fromEntries(plugins),
  };
}

/**
 * Rewrites the `state.json` of the scope at `scopeRoot` into the shape that
 * `release` persisted, and returns what it wrote. The file, each marketplace
 * record, its path source, each plugin record, and its `compatibility` and
 * `resources` keep only the members that release's schema declared, and the
 * file gets that release's `schemaVersion`. A member today's install wrote
 * that the release had no place for is dropped; a member the release required
 * that the record lacks fails the rewrite with its name, as does a source
 * other than a path.
 *
 * - `0.4.3` is the last release with no config files: commit `5f1d0c57`
 *   added `claude-plugins.json` and `claude-plugins.local.json`, first
 *   released in 0.5.0. Its records hold no `resources.hooks`, and each
 *   marketplace record held its own `autoupdate`. The rewrite copies onto each
 *   record the `autoupdate` the scope's base config declares for it, and
 *   leaves the member out when the config declares none, as that release's
 *   `marketplace add` did. It then deletes both config files.
 * - `0.6.0` is the last release of schema version 1, whose plugin records
 *   hold no `enabled`; commit `222a7344` (ENBL-02) ended that shape.
 * - `0.19.2` is the last release of schema version 2, whose plugin records
 *   hold no `provenance`; commit `8b6ac3bc` (schema version 3) ended it.
 *
 * Only the record is rewritten. The installed artifacts stay where today's
 * install put them, which is not always where the release put them.
 */
export async function rewriteStateAsRelease(args: {
  readonly scopeRoot: string;
  readonly release: string;
}): Promise<Record<string, unknown>> {
  const { scopeRoot, release } = args;
  const shape = RELEASE_SHAPES.get(release);
  if (shape === undefined) {
    throw new Error(`no state.json shape is known for release ${release}`);
  }

  const stateFile = stateFilePath(scopeRoot);
  const state = keepMembers(
    jsonObject(JSON.parse(await readFile(stateFile, "utf8")), stateFile),
    shape.file,
    stateFile,
  );
  const autoupdates = shape.beforeConfig
    ? await declaredAutoupdates(scopeRoot)
    : new Map<string, boolean>();
  const marketplaces = Object.entries(objectMember(state, "marketplaces")).map(
    ([name, record]): [string, Record<string, unknown>] => [
      name,
      releaseMarketplace(name, record, shape, autoupdates.get(name)),
    ],
  );
  const written = {
    ...state,
    schemaVersion: shape.schemaVersion,
    marketplaces: Object.fromEntries(marketplaces),
  };
  await writeFile(stateFile, `${JSON.stringify(written, null, 2)}\n`);
  if (shape.beforeConfig) {
    await rm(path.join(scopeRoot, "claude-plugins.json"), { force: true });
    await rm(path.join(scopeRoot, "claude-plugins.local.json"), { force: true });
  }

  return written;
}

/**
 * Sets the `schemaVersion` of the `state.json` of the scope at `scopeRoot` to
 * one past the newest this release reads, as a newer release would write it,
 * and keeps every other member. Returns the version it wrote.
 */
export async function rewriteStateWithNewerSchema(scopeRoot: string): Promise<number> {
  const stateFile = stateFilePath(scopeRoot);
  const state = jsonObject(JSON.parse(await readFile(stateFile, "utf8")), stateFile);
  const schemaVersion = STATE_SCHEMA_VERSION + 1;
  await writeFile(stateFile, `${JSON.stringify({ ...state, schemaVersion }, null, 2)}\n`);
  return schemaVersion;
}
