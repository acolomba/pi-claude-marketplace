// bridges/mcp/stage.ts
//
// MC-6 prepare/commit/abort for the MCP bridge, plus replacement
// exports: replacePreparedMcp, rollbackMcpReplacement, finalizeMcpReplacement.
// The prepare phase reads the scope's `mcp-adapter.json` with
// pi-mcp-adapter's grammar and refuses a file it cannot read (AFILE-02). Each
// plugin server goes under the key Claude Code's tool names use,
// `generatedMcpServerKey(plugin, server)` (ANAME-01), while the record keeps
// the declared name. It partitions existing entries into ours-vs-theirs by
// `_piClaudeMarketplace` marker across both server keys, checks every new key
// against the full
// definitions in pi-mcp-adapter's nine config sources (AFILE-05, MC-4, RN-5),
// short-circuits AS-8 noops, hands the new entries and the entries they
// replace to adapter-entry.ts, which applies the AFILE-06 carry-forward and
// the MC-5 marker, and builds the next doc IN MEMORY only, writing under the
// key the adapter loads (AFILE-03). Commit is one `atomicWriteJson` per
// rewritten file, skipped when the file already holds those bytes -- no
// per-file rename loop, no EXDEV risk. Abort is a synchronous no-op because
// prepare wrote nothing to disk.
//
// AMIG-01 / AMIG-02: prepare also reads the plugin's marked entries in the
// scope's legacy `mcp.json` and drops the leftovers pi-mcp-adapter wrote under
// their old names in the scope's `mcp-adapter.json`. A stage writes no file of
// the other scope: it holds only its own scope's lock, so the project
// `mcp-adapter.json` disable stubs of a user-scope plugin are left to the
// reload move, which takes the project-scope lock for them
// (`removeProjectDisableStubs`). The replace writes the scope's
// `mcp-adapter.json` and only then removes the marked legacy entries, so a
// server is never in neither file. A replace that fails part way restores
// what it wrote, in reverse order. The rollback restores `mcp.json` first;
// when that restore fails it leaves the adapter file as written, so the
// server stays in one of them.
//
// The collision throw is a typed `McpServerCollisionError` so callers can
// `instanceof`-discriminate the refusal category.
//
// W-05: the commit result carries `recorded: StagedMcpRecord[]` so callers
// can populate state.json from the bridge return value without re-deriving
// the per-server `targetPath`.

import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import writeFileAtomic from "write-file-atomic";

import { unenforcedToolRules } from "../../domain/mcp-server-features.ts";
import { foldedMcpServerKey, generatedMcpServerKey } from "../../domain/name.ts";
import { atomicWriteJson } from "../../shared/atomic-json.ts";
import {
  McpConfigFileError,
  McpServerCollisionError,
  McpServerKeyCollisionError,
} from "../../shared/errors-bridges.ts";
import { errorMessage, errorWithManualRecovery } from "../../shared/errors.ts";

import {
  ADAPTER_SERVER_KEYS,
  partitionServers,
  readMcpConfigDoc,
  restoredOverrideNames,
  storedChoicesFor,
  withPluginServersKeepingChoices,
  type McpConfigDoc,
} from "./adapter-doc.ts";
import { inactiveOverrideFields, stampServers } from "./adapter-entry.ts";
import { walkMcpSources, type McpSourceWalk } from "./collision-slots.ts";
import {
  leftoverNames,
  namesWithNoLiveServer,
  readLegacyMcpNames,
  removeLegacyMcpEntries,
  withoutServers,
} from "./legacy.ts";
import { isOwnedBy, isPlainObject, pluginSetFieldsOf } from "./marker.ts";
import { safeSet } from "./safe-set.ts";

import type { McpSubstitutionContext, VariableReport } from "./substitute.ts";
import type {
  McpReplacement,
  PreparedMcpStaged,
  PreparedMcpStaging,
  RawMcpDoc,
  RemoveLegacyMcpResult,
  StageMcpCommitResult,
  StageMcpInput,
  StagedMcpRecord,
} from "./types.ts";
import type {
  McpConfigFileNotice,
  McpConfigNotice,
  McpCredentialsBlankedNotice,
  McpLeftoverRemovedNotice,
  McpOverrideKeptNotice,
  McpOverrideRestoredNotice,
  McpToolRulesUnenforcedNotice,
  McpVariablesMissingNotice,
} from "../../shared/notification-dispatch.ts";
import type { Scope } from "../../shared/types.ts";

/** A file a replace is about to write, and what it held before. */
interface PriorFile {
  readonly filePath: string;
  /** The raw prior bytes, so a restore is byte-exact even for invalid UTF-8. */
  readonly bytes: Buffer | undefined;
  /** Whether this is the scope's legacy `mcp.json`. */
  readonly legacy: boolean;
}

interface McpReplacementInternals {
  /** The files the replace wrote, in write order. */
  readonly written: readonly PriorFile[];
}

const NOTHING_REMOVED: RemoveLegacyMcpResult = Object.freeze({
  removedNames: Object.freeze([]),
  notices: Object.freeze([]),
  written: Object.freeze([]),
});

const mcpReplacementInternals = new WeakMap<
  Extract<McpReplacement, { kind: "replaced" }>,
  McpReplacementInternals
>();

interface McpCollisionCheck {
  readonly cwd: string;
  readonly names: readonly string[];
  readonly ours: Readonly<Record<string, unknown>>;
  readonly theirs: Readonly<Record<string, unknown>>;
  readonly targetPath: string;
  readonly pluginName: string;
  readonly marketplaceName: string;
}

/** A source that defines a server in full, and the key it uses there. */
interface McpDeclarer {
  readonly sourcePath: string;
  readonly key: string;
}

/**
 * ANAME-03: the keys among `keys` that equal `name` once both fold `-` to
 * `_`, because Pi gives such keys one tool namespace.
 */
function foldedMatches(keys: readonly string[], name: string): readonly string[] {
  const folded = foldedMcpServerKey(name);
  return keys.filter((key) => foldedMcpServerKey(key) === folded);
}

/**
 * The sources other than the plugin's own entries that define `name` in full,
 * under `name` or a key that folds equal to it (ANAME-03), each with its own
 * key. An entry marked for the same plugin never counts, whichever source
 * holds it, because the adapter still loads one effective server (AFILE-05).
 * The target file counts when a foreign entry there holds such a key.
 */
function otherDeclarers(
  walk: McpSourceWalk,
  check: McpCollisionCheck,
  name: string,
): readonly McpDeclarer[] {
  const folded = foldedMcpServerKey(name);
  const declarers = [...walk.declarations]
    .filter(([key]) => foldedMcpServerKey(key) === folded)
    .flatMap(([key, declarations]) =>
      declarations
        .filter(
          (declaration) =>
            declaration.sourcePath !== check.targetPath &&
            !isOwnedBy(declaration.entry, check.pluginName, check.marketplaceName),
        )
        .map((declaration) => ({ sourcePath: declaration.sourcePath, key })),
    );
  const targetDeclarers = foldedMatches(Object.keys(check.theirs), name).map((key) => ({
    sourcePath: check.targetPath,
    key,
  }));
  return [...declarers, ...targetDeclarers];
}

function precedenceOf(walk: McpSourceWalk, sourcePath: string): number {
  return walk.sourcePaths.indexOf(sourcePath);
}

/**
 * AFILE-05 / MC-4: refuses a new name that another source already defines in
 * full, under the name or under a key that folds equal to it (ANAME-03). The
 * refusal names the highest-precedence other declarer, its key, and the
 * source pi-mcp-adapter would load, which is the target when it ranks higher.
 * An entry the plugin owns under the exact name in the target is a
 * self-replace and stays exempt, unless a foreign entry under the loaded key
 * folds equal to the name: the plugin's entry then sits under the shadowed
 * key, and staging would replace the foreign one. An owned entry under a
 * spelling that only folds equal to the name is a rename, so the other sources
 * are still walked for the new key.
 */
async function assertNoMcpCollisions(check: McpCollisionCheck): Promise<void> {
  if (check.names.length === 0) {
    return;
  }

  const walk = await walkMcpSources(check.cwd);
  for (const name of check.names) {
    if (
      Object.hasOwn(check.ours, name) &&
      foldedMatches(Object.keys(check.theirs), name).length === 0
    ) {
      continue;
    }

    const owner = [...otherDeclarers(walk, check, name)]
      .sort(
        (left, right) => precedenceOf(walk, left.sourcePath) - precedenceOf(walk, right.sourcePath),
      )
      .at(-1);
    if (owner !== undefined) {
      const winningPath =
        precedenceOf(walk, owner.sourcePath) > precedenceOf(walk, check.targetPath)
          ? owner.sourcePath
          : check.targetPath;
      throw new McpServerCollisionError(name, owner.sourcePath, winningPath, owner.key);
    }
  }
}

function commentsDroppedNotices(hadComments: boolean, scope: Scope): McpConfigFileNotice[] {
  return hadComments ? [{ kind: "comments-dropped", scope, file: "mcp-adapter.json" }] : [];
}

/** AMIG-01: one notice per old-name leftover the stage drops from a file. */
function leftoverNotices(
  names: readonly string[],
  scope: Scope,
  pluginName: string,
): McpLeftoverRemovedNotice[] {
  return names.map((server) => ({
    kind: "leftover-removed",
    scope,
    file: "mcp-adapter.json",
    plugin: pluginName,
    server,
  }));
}

/**
 * AFILE-06: one notice per staged name, in the plugin's declared order, that
 * absorbs a marker-less override holding fields the new entry does not carry
 * or carried fields the plugin's stamped entry sets (ANAME-07). A restaged
 * name that carries a kept override absorbs no overlay, so it adds no notice.
 */
function overrideKeptNotices(
  stamped: Readonly<Record<string, unknown>>,
  overlays: Readonly<Record<string, unknown>>,
  scope: Scope,
  pluginName: string,
): McpOverrideKeptNotice[] {
  const notices: McpOverrideKeptNotice[] = [];
  for (const [server, entry] of Object.entries(stamped)) {
    const overlay = Object.hasOwn(overlays, server) ? overlays[server] : undefined;
    const fields = isPlainObject(overlay)
      ? inactiveOverrideFields(overlay, pluginSetFieldsOf(entry))
      : [];
    if (fields.length > 0) {
      notices.push({
        kind: "override-kept",
        scope,
        file: "mcp-adapter.json",
        plugin: pluginName,
        server,
        fields,
      });
    }
  }

  return notices;
}

/**
 * AFILE-06: one notice per plugin entry the stage drops whose kept override it
 * writes back, decided by the test unstage uses. A staged key replaces its
 * entry, so it restores nothing.
 */
function overrideRestoredNotices(
  config: McpConfigDoc,
  stagedKeys: readonly string[],
  owner: { readonly scope: Scope; readonly pluginName: string; readonly marketplaceName: string },
): McpOverrideRestoredNotice[] {
  const { scope, pluginName, marketplaceName } = owner;
  return restoredOverrideNames(config, pluginName, marketplaceName)
    .filter((server) => !stagedKeys.includes(server))
    .map((server) => ({ kind: "override-restored", scope, file: "mcp-adapter.json", server }));
}

/**
 * AVAR-04 / AVAR-05: per server in declared order, a `variables-missing`
 * notice when its report names unset variables with no `:-` default, then a
 * `credentials-blanked` notice when it names set credentials blanked in `url`
 * or `headers`. Each carries the names only.
 */
function variableNotices(
  reports: ReadonlyMap<string, VariableReport>,
  scope: Scope,
  pluginName: string,
): (McpVariablesMissingNotice | McpCredentialsBlankedNotice)[] {
  const fact = { scope, file: "mcp-adapter.json", plugin: pluginName } as const;
  return [...reports].flatMap(([server, report]) => [
    ...(report.missing.length > 0
      ? [{ kind: "variables-missing", ...fact, server, names: report.missing } as const]
      : []),
    ...(report.blanked.length > 0
      ? [{ kind: "credentials-blanked", ...fact, server, names: report.blanked } as const]
      : []),
  ]);
}

/**
 * ANAME-07 / AMIG-01: one `tool-rules-unenforced` notice per server, in
 * declared order, whose raw config declares tool permission rules that
 * pi-mcp-adapter does not enforce. It names the adapter key and the field
 * names only.
 */
function toolRuleNotices(
  keyed: Readonly<Record<string, unknown>>,
  scope: Scope,
  pluginName: string,
): McpToolRulesUnenforcedNotice[] {
  return Object.entries(keyed).flatMap(([server, entry]) => {
    const fields = unenforcedToolRules(entry);
    return fields.length > 0
      ? [
          {
            kind: "tool-rules-unenforced",
            scope,
            file: "mcp-adapter.json",
            plugin: pluginName,
            server,
            fields,
          } as const,
        ]
      : [];
  });
}

/**
 * ANAME-01: the plugin's servers under their generated keys, in declared
 * order. `safeSet` keeps every key an own property (WR-01).
 *
 * ANAME-03: the key rule maps many names to one key, and Pi gives keys that
 * differ only by `-` versus `_` one tool namespace. Two servers that land on
 * one folded key refuse rather than one shadowing the other.
 */
function keyedServers(
  pluginName: string,
  servers: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const keyed: Record<string, unknown> = {};
  const earlierByFoldedKey = new Map<string, { readonly declared: string; readonly key: string }>();
  for (const [declared, entry] of Object.entries(servers)) {
    const key = generatedMcpServerKey(pluginName, declared);
    const earlier = earlierByFoldedKey.get(foldedMcpServerKey(key));
    if (earlier !== undefined) {
      throw new McpServerKeyCollisionError(
        pluginName,
        [earlier.declared, declared],
        [earlier.key, key],
      );
    }

    earlierByFoldedKey.set(foldedMcpServerKey(key), { declared, key });
    safeSet(keyed, key, entry);
  }

  return keyed;
}

function noopStaging(notices: readonly McpConfigNotice[]): PreparedMcpStaging {
  const result: StageMcpCommitResult = {
    stagedNames: Object.freeze<string[]>([]),
    recorded: Object.freeze<StagedMcpRecord[]>([]),
    warnings: Object.freeze<string[]>([]),
    notices: Object.freeze([...notices]),
  };
  return { kind: "noop", result };
}

/**
 * Reads the target config. With nothing to stage, an unreadable file comes
 * back as its refusal so prepare can leave the file alone and report it; a
 * plugin with servers refuses (AFILE-02).
 */
async function readTargetConfig(
  filePath: string,
  hasServers: boolean,
): Promise<McpConfigDoc | McpConfigFileError> {
  try {
    return await readMcpConfigDoc(filePath, ADAPTER_SERVER_KEYS);
  } catch (err) {
    if (err instanceof McpConfigFileError && !hasServers) {
      return err;
    }

    throw err;
  }
}

/**
 * D-08-02: each overlay with the stored choice for its name below it, field by
 * field, so the user's stub wins over the choice the store kept.
 */
function overStoredChoices(
  overlays: Readonly<Record<string, unknown>>,
  stored: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const [name, overlay] of Object.entries(overlays)) {
    // `partitionServers` admits only plain-object overlays.
    const fields = overlay as Readonly<Record<string, unknown>>;
    safeSet(merged, name, Object.hasOwn(stored, name) ? { ...stored[name], ...fields } : fields);
  }

  return merged;
}

/**
 * MC-6 prepare: in-memory only. Reads the scope's `mcp-adapter.json`,
 * partitions existing entries by marker across both server keys, checks each
 * new key against the full definitions in pi-mcp-adapter's nine config
 * sources (AFILE-05, MC-4; the plugin's own marked entries are exempt in every
 * source), stamps every new entry (AFILE-06 carry-forward, MC-5 marker), and
 * builds the next doc. A staged entry replaces a marker-less override under
 * its name, makes its carried fields active and keeps the whole override in
 * its marker. A plugin entry the stage drops writes its kept override back
 * (AFILE-01, AFILE-06). The result's notices end with each server's
 * `variables-missing` notice for unset variables with no default, then its
 * `credentials-blanked` notice for set credentials blanked in `url` or
 * `headers` (AVAR-04, AVAR-05), then one `tool-rules-unenforced` notice per
 * server that declares tool permission rules (ANAME-07). AS-8 noop
 * short-circuits when there is nothing new AND nothing previously-ours -- in
 * that case
 * `commitPreparedMcp` writes no file (PRD success criterion: AS-8 noop
 * produces no `mcp-adapter.json`).
 *
 * Throws `McpConfigFileError` when the target cannot be read and there are
 * servers to stage (AFILE-02), and `McpServerCollisionError` when another
 * source defines a new key in full.
 */
export async function prepareStageMcpServers(input: StageMcpInput): Promise<PreparedMcpStaging> {
  const { locations, cwd, marketplaceName, pluginName, servers, pluginRoot, pluginData } = input;
  // ANAME-01: entries, collisions and notices use the generated keys; the
  // record keeps the declared names.
  const declaredNames = Object.keys(servers);
  const keyed = keyedServers(pluginName, servers);
  const newKeys = Object.keys(keyed);

  const config = await readTargetConfig(locations.mcpAdapterJsonPath, newKeys.length > 0);
  if (config instanceof McpConfigFileError) {
    // AS-8 / AFILE-02: nothing is written, so the unreadable file keeps its
    // bytes, and the orchestrator tells the user it was left unchanged.
    const leftUnchanged: McpConfigFileNotice = {
      kind: "left-unchanged",
      scope: locations.scope,
      file: "mcp-adapter.json",
    };
    return noopStaging([leftUnchanged]);
  }

  // Partition existing into ours-vs-theirs by marker (MC-5).
  const { ours, overlays, theirs, keptOverrides } = partitionServers(
    config,
    pluginName,
    marketplaceName,
  );

  // AFILE-05 / MC-4: any other full definition of a new key refuses.
  await assertNoMcpCollisions({
    cwd,
    names: newKeys,
    ours,
    theirs,
    targetPath: locations.mcpAdapterJsonPath,
    pluginName,
    marketplaceName,
  });

  // AMIG-01: the plugin's marked entries in the scope's legacy mcp.json. Their
  // names are the old names whose adapter leftovers the stage drops.
  const legacyNames = await readLegacyMcpNames(locations.mcpJsonPath, pluginName, marketplaceName);

  // AS-8 noop: nothing new, nothing previously-ours AND no legacy entry. Don't
  // materialize the file; commit returns the noop result without touching
  // disk. A leftover sits under a legacy name, so none can exist here.
  if (newKeys.length === 0 && Object.keys(ours).length === 0 && legacyNames.length === 0) {
    return noopStaging([]);
  }

  // AMIG-01: an override stub under a name another source still defines
  // applies to that live server, so it stays. A panel copy is a full server
  // that would run beside the new key, so it always goes.
  const stubs = leftoverNames(config, legacyNames, { newKeys, panelCopies: false });
  const deadStubs = await namesWithNoLiveServer(cwd, stubs, {
    leftoverPath: locations.mcpAdapterJsonPath,
    legacyPath: locations.mcpJsonPath,
    pluginName,
    marketplaceName,
  });
  const leftovers = leftoverNames(config, legacyNames, { newKeys, panelCopies: true }).filter(
    (name) => !stubs.includes(name) || deadStubs.includes(name),
  );

  // The CLAUDE_PROJECT_DIR arm is decided HERE, once (MENV-03): project scope
  // resolves `${CLAUDE_PROJECT_DIR}` at install to the project root `cwd` (NOT
  // scopeRoot); user scope carries `undefined`, so the reference stays in the
  // entry for Pi's process to supply at runtime (AVAR-01). `env` is the
  // caller's environment, which Claude's rule reads to decide which
  // variables are set (AVAR-02, D-08-06).
  const substitution: McpSubstitutionContext = {
    pluginRoot,
    pluginData,
    projectDir: locations.scope === "project" ? cwd : undefined,
    env: input.env,
  };
  // AFILE-06: each new entry carries the user's fields from the entry it
  // replaces. A marker-less override stub under the selected key wins over the
  // plugin's previous marked entry. The new entry keeps the absorbed stub, or
  // the override the plugin's previous entry kept, in its marker. Overlays and
  // the plugin's entries under the selected key never share a name. D-08-02:
  // a key with no previous entry of the plugin carries the choice the store
  // keeps for it, below an absorbed stub's fields; the write consumes it.
  // Object spread defines own data properties, so a server named `__proto__`
  // stays an own key (WR-01).
  const stored = storedChoicesFor(config, pluginName, marketplaceName, newKeys);
  const {
    stamped,
    warnings: stampWarnings,
    variableReports,
  } = stampServers({
    servers: keyed,
    pluginName,
    marketplaceName,
    substitution,
    previous: { ...stored, ...ours, ...overStoredChoices(overlays, stored) },
    keptOverrides: { ...keptOverrides, ...overlays },
    description: input.description,
  });

  // Keep theirs verbatim; replace ours with stamped (or drop ours when
  // there are no new servers), and drop the old-name leftovers. A plugin that
  // has no server, owns no entry and left no leftover leaves the file alone.
  const rewritesTarget = newKeys.length > 0 || Object.keys(ours).length > 0 || leftovers.length > 0;
  const next = rewritesTarget
    ? withoutServers(
        withPluginServersKeepingChoices(config, pluginName, marketplaceName, stamped),
        config.serverKey,
        leftovers,
      )
    : undefined;

  // W-05: callers read `recorded` to populate state.json. `sourcePath`
  // is the canonical provenance the install path passes in (e.g.
  // "<pluginRoot>/.mcp.json" or "<pluginRoot>/<plugin>.json#mcpServers");
  // when omitted we fall back to a synthetic `<plugin>#mcpServers` tag.
  const sourcePath = input.sourcePath ?? `${pluginName}#mcpServers`;
  const recorded: readonly StagedMcpRecord[] = Object.freeze(
    declaredNames.map((generatedName) => ({
      generatedName,
      sourcePath,
      targetPath: locations.mcpAdapterJsonPath,
    })),
  );

  // AFILE-04: the writer drops JSONC comments, so a rewritten target whose
  // bytes held comments is reported. The noop branches write nothing and keep
  // the comments. AFILE-06: each absorbed override with fields the new entry
  // does not carry is reported after them, then each override a dropped entry
  // writes back. AVAR-04 / AVAR-05: each server's missing-variable and
  // withheld-credential notices follow, then ANAME-07: each server's
  // unenforced tool-rule notice. AMIG-01: each dropped leftover comes last.
  const notices = Object.freeze<McpConfigNotice[]>([
    ...commentsDroppedNotices(rewritesTarget && config.hadComments, locations.scope),
    ...overrideKeptNotices(stamped, overlays, locations.scope, pluginName),
    ...overrideRestoredNotices(config, newKeys, {
      scope: locations.scope,
      pluginName,
      marketplaceName,
    }),
    ...variableNotices(variableReports, locations.scope, pluginName),
    ...toolRuleNotices(keyed, locations.scope, pluginName),
    ...leftoverNotices(leftovers, locations.scope, pluginName),
  ]);
  const result: StageMcpCommitResult = {
    stagedNames: Object.freeze([...declaredNames]),
    recorded,
    warnings: Object.freeze(stampWarnings),
    notices,
  };

  return {
    kind: "staged",
    locations,
    stagedNames: result.stagedNames,
    result,
    ...(next !== undefined && { _nextDoc: next }),
    ...(legacyNames.length > 0 && {
      _legacy: { pluginName, marketplaceName, names: legacyNames },
    }),
  };
}

/**
 * AMIG-01: writes `doc` unless the file already holds the bytes
 * `atomicWriteJson` would write, so a re-stage that changes nothing keeps the
 * file, its inode and its mtime. A write first records the file's prior bytes
 * in `written`, so a restore covers a write that failed part way.
 */
async function writeIfChanged(
  filePath: string,
  doc: RawMcpDoc,
  written: PriorFile[],
): Promise<void> {
  const prior = await readOptionalBytes(filePath);
  if (prior?.equals(Buffer.from(JSON.stringify(doc, null, 2) + "\n", "utf8")) === true) {
    return;
  }

  written.push({ filePath, bytes: prior, legacy: false });
  await atomicWriteJson(filePath, doc);
}

/** The staged write of the scope's `mcp-adapter.json`. */
async function writeStagedDoc(prepared: PreparedMcpStaged, written: PriorFile[]): Promise<void> {
  if (prepared._nextDoc !== undefined) {
    await writeIfChanged(prepared.locations.mcpAdapterJsonPath, prepared._nextDoc, written);
  }
}

/**
 * MC-6 commit: one write of the scope's `mcp-adapter.json` when the stage
 * rewrites it, skipped when the file already holds its bytes (AMIG-01); a
 * zero-op for the noop branch. It never touches
 * `mcp.json`: a caller that commits removes the legacy entries itself, in the
 * order it needs. Returns the same `StageMcpCommitResult` the prepare phase
 * computed (W-05) so callers have a stable hand-off shape regardless of which
 * branch the prepare took.
 */
export async function commitPreparedMcp(
  prepared: PreparedMcpStaging,
): Promise<StageMcpCommitResult> {
  if (prepared.kind === "staged") {
    await writeStagedDoc(prepared, []);
  }

  return prepared.result;
}

/**
 * MC-6 abort: synchronous no-op. The prepare phase wrote nothing to
 * disk -- the merged doc lives only inside the discriminated union --
 * so there is nothing to roll back. Exists for symmetry with the agent
 * and skill bridges' prepare/commit/abort triplet.
 */
export function abortPreparedMcp(_prepared: PreparedMcpStaging): void {
  // No-op: nothing was written outside memory pre-commit.
}

/** AMIG-02: removes the plugin's marked legacy entries, recording `mcp.json` first. */
async function removeLegacy(
  prepared: PreparedMcpStaged,
  written: PriorFile[],
): Promise<RemoveLegacyMcpResult> {
  if (prepared._legacy === undefined) {
    return NOTHING_REMOVED;
  }

  const { mcpJsonPath } = prepared.locations;
  written.push({
    filePath: mcpJsonPath,
    bytes: await readOptionalBytes(mcpJsonPath),
    legacy: true,
  });
  return removeLegacyMcpEntries({
    locations: prepared.locations,
    pluginName: prepared._legacy.pluginName,
    marketplaceName: prepared._legacy.marketplaceName,
  });
}

async function restoreFile(file: PriorFile): Promise<void> {
  if (file.bytes === undefined) {
    await rm(file.filePath, { force: true });
  } else {
    await mkdir(path.dirname(file.filePath), { recursive: true });
    await writeFileAtomic(file.filePath, file.bytes);
  }
}

/**
 * AMIG-02: restores the written files to their prior bytes in reverse write
 * order, so `mcp.json` comes first, and returns one leak per file it could
 * not restore. When `mcp.json` cannot be restored it stops: the adapter file
 * keeps the plugin's new entries, so the servers removed from `mcp.json` stay
 * in one file.
 */
async function restoreFiles(written: readonly PriorFile[]): Promise<string[]> {
  const leaks: string[] = [];
  for (const file of [...written].reverse()) {
    try {
      // eslint-disable-next-line no-await-in-loop -- mcp.json is restored before the adapter file it decides about
      await restoreFile(file);
    } catch (err) {
      leaks.push(
        `failed to restore ${path.basename(file.filePath)} at ${file.filePath}: ${errorMessage(err)}`,
      );
      if (file.legacy) {
        return leaks;
      }
    }
  }

  return leaks;
}

/**
 * AMIG-02 / NFR-3: performs a staged preparation's writes as one
 * compensatable step: the scope's `mcp-adapter.json`, then the removal of the
 * plugin's marked entries from the scope's `mcp.json`.
 * Each file's prior bytes are kept for `rollbackMcpReplacement`. A failure
 * part way restores what was already written, in reverse order, and rethrows,
 * as a `ManualRecoveryError` when a restore leaked.
 */
export async function replacePreparedMcp(prepared: PreparedMcpStaging): Promise<McpReplacement> {
  if (prepared.kind === "noop") {
    return { kind: "noop", prepared };
  }

  const written: PriorFile[] = [];
  let legacy: RemoveLegacyMcpResult;
  try {
    await writeStagedDoc(prepared, written);
    legacy = await removeLegacy(prepared, written);
  } catch (err) {
    throw errorWithManualRecovery(err, await restoreFiles(written));
  }

  const replacement: Extract<McpReplacement, { kind: "replaced" }> = {
    kind: "replaced",
    prepared,
    legacy,
  };
  mcpReplacementInternals.set(replacement, { written: Object.freeze(written) });
  return replacement;
}

/**
 * AMIG-02 / NFR-3: restores every file the replace wrote to its exact prior
 * bytes, `mcp.json` first, then the scope's `mcp-adapter.json`. When the
 * `mcp.json` restore fails it returns that leak at once and leaves the
 * adapter file as written. Returns one leak per file it could not
 * restore.
 */
export async function rollbackMcpReplacement(
  replacement: McpReplacement,
): Promise<readonly string[]> {
  if (replacement.kind === "noop") {
    return Object.freeze([]);
  }

  return Object.freeze(await restoreFiles(requireMcpReplacementInternals(replacement).written));
}

/**
 * AMIG-02: accepts a replacement this module made and returns no leaks, since
 * a replace that stays has nothing left to clean up. Throws for a handle it
 * did not make.
 */
export function finalizeMcpReplacement(replacement: McpReplacement): readonly string[] {
  if (replacement.kind === "noop") {
    return Object.freeze([]);
  }

  requireMcpReplacementInternals(replacement);
  return Object.freeze([]);
}

function requireMcpReplacementInternals(
  replacement: Extract<McpReplacement, { kind: "replaced" }>,
): McpReplacementInternals {
  const internals = mcpReplacementInternals.get(replacement);
  if (internals === undefined) {
    throw new Error("Unknown MCP replacement handle.");
  }

  return internals;
}

async function readOptionalBytes(filePath: string): Promise<Buffer | undefined> {
  try {
    return await readFile(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }

    throw err;
  }
}
