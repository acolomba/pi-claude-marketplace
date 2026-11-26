/**
 * @fileoverview Reads and rewrites one plugin's record, or one marketplace's
 * record, in a scope's installation record file (`state.json`), the way an
 * earlier release or a hand edit leaves it.
 *
 * Each function takes the scope root the caller names, which lies in the
 * scenario's sandbox. A rewrite keeps every other member of the file.
 *
 * One function leaves the record readable but not saveable: it moves the file
 * into a read-only subdirectory of the extension root and links the file's
 * place to it. The state lock lives in the writable extension root, but the
 * atomic save resolves the link and creates its temporary file beside the
 * moved file, where it is refused.
 */

import {
  chmod,
  cp,
  mkdir,
  open,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { isPlainObject } from "./field-rows.ts";

// Where one marketplace's record sits in a scope's `state.json`: the file,
// each object on the path from the file's root to the record, and the record.
interface LocatedMarketplaceRecord {
  readonly marketplace: string;
  readonly stateFile: string;
  readonly state: Readonly<Record<string, unknown>>;
  readonly marketplaces: Readonly<Record<string, unknown>>;
  readonly marketplaceRecord: Readonly<Record<string, unknown>>;
}

// Where one plugin's record sits in a scope's `state.json`: its marketplace's
// record, the plugins that record lists, and the plugin's record.
interface LocatedRecord extends LocatedMarketplaceRecord {
  readonly plugin: string;
  readonly plugins: Readonly<Record<string, unknown>>;
  readonly record: Readonly<Record<string, unknown>>;
}

// The JSON object `holder[member]`, throwing with `what` when it is absent or
// anything but an object.
function objectMember(
  holder: Readonly<Record<string, unknown>>,
  member: string,
  what: string,
): Record<string, unknown> {
  const value = holder[member];
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value));
  }

  throw new Error(`${what} is not a JSON object`);
}

/**
 * The plugin and marketplace names of `pluginId`, split at its last `@`.
 * Throws when either name is empty.
 */
export function splitPluginId(pluginId: string): { plugin: string; marketplace: string } {
  const at = pluginId.lastIndexOf("@");
  if (at <= 0 || at === pluginId.length - 1) {
    throw new Error(`${pluginId} is not a <plugin>@<marketplace> id`);
  }

  return { plugin: pluginId.slice(0, at), marketplace: pluginId.slice(at + 1) };
}

// The record of `marketplace` in the `state.json` of the scope at
// `scopeRoot`, with the objects that hold it. Throws with the file path when
// the scope records no such marketplace.
async function locateMarketplaceRecord(
  scopeRoot: string,
  marketplace: string,
): Promise<LocatedMarketplaceRecord> {
  const stateFile = path.join(scopeRoot, "pi-claude-marketplace", "state.json");
  const parsed: unknown = JSON.parse(await readFile(stateFile, "utf8"));
  // The file's root is the one member of a holder, so one reader checks every level.
  const state = objectMember({ root: parsed }, "root", stateFile);
  const marketplaces = objectMember(state, "marketplaces", `the marketplaces of ${stateFile}`);
  const marketplaceRecord = objectMember(
    marketplaces,
    marketplace,
    `the record of the marketplace ${marketplace} in ${stateFile}`,
  );
  return { marketplace, stateFile, state, marketplaces, marketplaceRecord };
}

// The record of `pluginId` in the `state.json` of the scope at `scopeRoot`,
// with the objects that hold it. Throws with the file path when the scope
// records no such plugin.
async function locateRecord(scopeRoot: string, pluginId: string): Promise<LocatedRecord> {
  const { plugin, marketplace } = splitPluginId(pluginId);
  const located = await locateMarketplaceRecord(scopeRoot, marketplace);
  const plugins = objectMember(
    located.marketplaceRecord,
    "plugins",
    `the plugins of ${marketplace}`,
  );
  const record = objectMember(plugins, plugin, `the record of ${pluginId} in ${located.stateFile}`);
  return { ...located, plugin, plugins, record };
}

// Writes `located`'s file with `marketplaceRecord` in place of its
// marketplace's record, keeping every other member of the file.
async function writeMarketplaceRecord(
  located: LocatedMarketplaceRecord,
  marketplaceRecord: Readonly<Record<string, unknown>>,
): Promise<void> {
  const state = {
    ...located.state,
    marketplaces: { ...located.marketplaces, [located.marketplace]: marketplaceRecord },
  };
  await writeFile(located.stateFile, `${JSON.stringify(state, null, 2)}\n`);
}

/**
 * The record of `pluginId` in the `state.json` of the scope at `scopeRoot`.
 * Throws when the scope records no such plugin.
 */
export async function readPluginRecord(
  scopeRoot: string,
  pluginId: string,
): Promise<Readonly<Record<string, unknown>>> {
  return (await locateRecord(scopeRoot, pluginId)).record;
}

/**
 * Replaces the record of `pluginId` (`<plugin>@<marketplace>`) in the
 * `state.json` of the scope at `scopeRoot` with the members `rewrite` returns
 * for it, keeping every other member of the file. Throws with the file path
 * when the scope records no such plugin.
 */
export async function rewritePluginRecord(
  scopeRoot: string,
  pluginId: string,
  rewrite: (record: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>,
): Promise<void> {
  const located = await locateRecord(scopeRoot, pluginId);
  const { plugin, plugins, record } = located;
  await writeMarketplaceRecord(located, {
    ...located.marketplaceRecord,
    plugins: { ...plugins, [plugin]: rewrite(record) },
  });
}

/**
 * The record of `marketplace` in the `state.json` of the scope at
 * `scopeRoot`. Throws when the scope records no such marketplace.
 */
export async function readMarketplaceRecord(
  scopeRoot: string,
  marketplace: string,
): Promise<Readonly<Record<string, unknown>>> {
  return (await locateMarketplaceRecord(scopeRoot, marketplace)).marketplaceRecord;
}

/**
 * Replaces the record of `marketplace` in the `state.json` of the scope at
 * `scopeRoot` with the members `rewrite` returns for it, keeping every other
 * member of the file. Throws with the file path when the scope records no
 * such marketplace.
 */
export async function rewriteMarketplaceRecord(
  scopeRoot: string,
  marketplace: string,
  rewrite: (record: Readonly<Record<string, unknown>>) => Readonly<Record<string, unknown>>,
): Promise<void> {
  const located = await locateMarketplaceRecord(scopeRoot, marketplace);
  await writeMarketplaceRecord(located, rewrite(located.marketplaceRecord));
}

/**
 * Copies the plugin directory that the record of `pluginId` names in its
 * `resolvedSource` to `pluginRoot`, and points `resolvedSource` at the copy.
 * Every other member of the file stays. Throws when the record names no
 * plugin directory, and when a file of the copy already exists.
 */
export async function relocatePluginRoot(
  scopeRoot: string,
  pluginId: string,
  pluginRoot: string,
): Promise<void> {
  const { resolvedSource } = await readPluginRecord(scopeRoot, pluginId);
  if (typeof resolvedSource !== "string") {
    throw new Error(`the record of ${pluginId} names no plugin root`);
  }

  await cp(resolvedSource, pluginRoot, { recursive: true, errorOnExist: true, force: false });
  await rewritePluginRecord(scopeRoot, pluginId, (record) => ({
    ...record,
    resolvedSource: pluginRoot,
  }));
}

/** A scope's installation record that loads but cannot be saved. */
export interface HeldInstallationRecord {
  /** Makes the held record's directory writable again, so the sandbox can be removed. */
  readonly release: () => Promise<void>;
  /**
   * The error message of an open for writing of a numbered file beside the
   * held record, the call the atomic save makes for its temporary file.
   */
  readonly saveError: string;
}

/**
 * Holds the installation record of the scope at `scopeRoot` read-only: moves
 * its `state.json` into the new subdirectory `held-record` of the extension
 * root, links `state.json` to the moved file, and makes the subdirectory
 * read-only. Throws when an open for writing beside the moved file succeeds,
 * as it does for a process that ignores file modes.
 */
export async function holdInstallationRecordReadOnly(
  scopeRoot: string,
): Promise<HeldInstallationRecord> {
  const extensionRoot = path.join(scopeRoot, "pi-claude-marketplace");
  const stateFile = path.join(extensionRoot, "state.json");
  const heldDirectory = path.join(extensionRoot, "held-record");
  await mkdir(heldDirectory);
  const heldFile = path.join(await realpath(heldDirectory), "state.json");
  await rename(stateFile, heldFile);
  await symlink(heldFile, stateFile);
  await chmod(heldDirectory, 0o555);
  const release = (): Promise<void> => chmod(heldDirectory, 0o755);
  // write-file-atomic names its temporary file `<real path>.<uint32>`.
  const temporaryFile = `${heldFile}.1`;
  try {
    const handle = await open(temporaryFile, "w");
    await handle.close();
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "EACCES") {
      return { release, saveError: error.message };
    }

    await release();
    throw error;
  }

  await release();
  await rm(temporaryFile, { force: true });
  throw new Error(
    `${temporaryFile} was opened for writing in a read-only directory: file modes are not enforced`,
  );
}
