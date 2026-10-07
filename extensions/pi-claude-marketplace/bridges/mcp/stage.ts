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
// key the adapter loads (AFILE-03). Commit is a single
// `atomicWriteJson` -- no per-file rename loop, no EXDEV risk, no
// partial-state recovery surface. Abort is a synchronous no-op because
// prepare wrote nothing to disk.
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

import { foldedMcpServerKey, generatedMcpServerKey } from "../../domain/name.ts";
import { atomicWriteJson } from "../../shared/atomic-json.ts";
import {
  McpConfigFileError,
  McpServerCollisionError,
  McpServerKeyCollisionError,
} from "../../shared/errors-bridges.ts";
import { errorMessage } from "../../shared/errors.ts";

import {
  ADAPTER_SERVER_KEYS,
  partitionServers,
  readMcpConfigDoc,
  withPluginServers,
  type McpConfigDoc,
} from "./adapter-doc.ts";
import { inactiveOverrideFields, stampServers } from "./adapter-entry.ts";
import { walkMcpSources, type McpSourceWalk } from "./collision-slots.ts";
import { isOwnedBy, pluginSetFieldsOf } from "./marker.ts";
import { safeSet } from "./safe-set.ts";

import type { McpSubstitutionContext, VariableReport } from "./substitute.ts";
import type {
  McpReplacement,
  PreparedMcpStaging,
  StageMcpCommitResult,
  StageMcpInput,
  StagedMcpRecord,
} from "./types.ts";
import type {
  McpConfigFileNotice,
  McpConfigNotice,
  McpOverrideKeptNotice,
  McpVariablesMissingNotice,
} from "../../shared/notification-dispatch.ts";
import type { Scope } from "../../shared/types.ts";

interface McpReplacementInternals {
  /** The raw prior bytes, so a restore is byte-exact even for invalid UTF-8. */
  readonly oldBytes: Buffer | undefined;
}

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
 * An owned entry in the target is a self-replace and stays exempt, under
 * either spelling, unless a foreign entry under the loaded key folds equal to
 * the name: the plugin's entry then sits under the shadowed key, and staging
 * would replace the foreign one.
 */
async function assertNoMcpCollisions(check: McpCollisionCheck): Promise<void> {
  if (check.names.length === 0) {
    return;
  }

  const walk = await walkMcpSources(check.cwd);
  for (const name of check.names) {
    if (
      foldedMatches(Object.keys(check.ours), name).length > 0 &&
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function commentsDroppedNotices(hadComments: boolean, scope: Scope): McpConfigFileNotice[] {
  return hadComments ? [{ kind: "comments-dropped", scope, file: "mcp-adapter.json" }] : [];
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
 * AVAR-04: one notice per server whose variable report names unset variables
 * with no `:-` default, in declared order. It carries the names only.
 */
function variableNotices(
  reports: ReadonlyMap<string, VariableReport>,
  scope: Scope,
  pluginName: string,
): McpVariablesMissingNotice[] {
  return [...reports]
    .filter(([, report]) => report.missing.length > 0)
    .map(([server, report]) => ({
      kind: "variables-missing",
      scope,
      file: "mcp-adapter.json",
      plugin: pluginName,
      server,
      names: report.missing,
    }));
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
 * MC-6 prepare: in-memory only. Reads the scope's `mcp-adapter.json`,
 * partitions existing entries by marker across both server keys, checks each
 * new key against the full definitions in pi-mcp-adapter's nine config
 * sources (AFILE-05, MC-4; the plugin's own marked entries are exempt in every
 * source), stamps every new entry (AFILE-06 carry-forward, MC-5 marker), and
 * builds the next doc. A staged entry replaces a marker-less override under
 * its name, makes its carried fields active and keeps the whole override in
 * its marker. A plugin entry the stage drops writes its kept override back
 * (AFILE-01, AFILE-06). The result's notices end with one `variables-missing`
 * notice per server that references unset variables with no default
 * (AVAR-04). AS-8 noop short-circuits when
 * there is nothing new AND nothing previously-ours -- in that case
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

  // AS-8 noop: nothing new AND nothing previously-ours. Don't materialize
  // the file; commit returns the noop result without touching disk.
  if (newKeys.length === 0 && Object.keys(ours).length === 0) {
    return noopStaging([]);
  }

  // The CLAUDE_PROJECT_DIR arm is decided HERE, once (MENV-03): project scope
  // resolves `${CLAUDE_PROJECT_DIR}` at install to the project root `cwd` (NOT
  // scopeRoot); user scope carries `undefined`, so the reference stays in the
  // entry for Pi's process to supply at runtime (AVAR-01). `env` is the
  // environment Claude's rule reads to decide which variables are set
  // (AVAR-02).
  const substitution: McpSubstitutionContext = {
    pluginRoot,
    pluginData,
    projectDir: locations.scope === "project" ? cwd : undefined,
    env: input.env ?? process.env,
  };
  // AFILE-06: each new entry carries the user's fields from the entry it
  // replaces. A marker-less override stub under the selected key wins over the
  // plugin's previous marked entry. The new entry keeps the absorbed stub, or
  // the override the plugin's previous entry kept, in its marker. Overlays and
  // the plugin's entries under the selected key never share a name. Object
  // spread defines own data properties, so a server named `__proto__` stays an
  // own key (WR-01).
  const {
    stamped,
    warnings: stampWarnings,
    variableReports,
  } = stampServers({
    servers: keyed,
    pluginName,
    marketplaceName,
    substitution,
    previous: { ...ours, ...overlays },
    keptOverrides: { ...keptOverrides, ...overlays },
    description: input.description,
  });

  // Keep theirs verbatim; replace ours with stamped (or drop ours when
  // there are no new servers).
  const next = withPluginServers(config, pluginName, marketplaceName, stamped);

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

  // AFILE-04: the staged branch always rewrites the file, and the writer drops
  // JSONC comments, so a commented file is reported. The noop branches write
  // nothing and keep the comments. AFILE-06: each absorbed override with
  // fields the new entry does not carry is reported after it. AVAR-04: each
  // server that references unset variables with no default comes last.
  const notices = Object.freeze<McpConfigNotice[]>([
    ...commentsDroppedNotices(config.hadComments, locations.scope),
    ...overrideKeptNotices(stamped, overlays, locations.scope, pluginName),
    ...variableNotices(variableReports, locations.scope, pluginName),
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
    _nextDoc: next,
  };
}

/**
 * MC-6 commit: a single `atomicWriteJson` for the staged branch; a
 * zero-op for the noop branch. Returns the same `StageMcpCommitResult`
 * the prepare phase computed (W-05) so callers have a stable hand-off
 * shape regardless of which branch the prepare took.
 */
export async function commitPreparedMcp(
  prepared: PreparedMcpStaging,
): Promise<StageMcpCommitResult> {
  if (prepared.kind === "noop") {
    return prepared.result;
  }

  await atomicWriteJson(prepared.locations.mcpAdapterJsonPath, prepared._nextDoc);
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

export async function replacePreparedMcp(prepared: PreparedMcpStaging): Promise<McpReplacement> {
  if (prepared.kind === "noop") {
    return { kind: "noop", prepared };
  }

  const oldBytes = await readOptionalBytes(prepared.locations.mcpAdapterJsonPath);
  await commitPreparedMcp(prepared);

  const replacement: Extract<McpReplacement, { kind: "replaced" }> = {
    kind: "replaced",
    prepared,
  };
  mcpReplacementInternals.set(replacement, { oldBytes });
  return replacement;
}

export async function rollbackMcpReplacement(
  replacement: McpReplacement,
): Promise<readonly string[]> {
  if (replacement.kind === "noop") {
    return Object.freeze([]);
  }

  const internals = requireMcpReplacementInternals(replacement);
  const leaks: string[] = [];
  try {
    if (internals.oldBytes === undefined) {
      await rm(replacement.prepared.locations.mcpAdapterJsonPath, { force: true });
    } else {
      await mkdir(path.dirname(replacement.prepared.locations.mcpAdapterJsonPath), {
        recursive: true,
      });
      await writeFileAtomic(replacement.prepared.locations.mcpAdapterJsonPath, internals.oldBytes);
    }
  } catch (err) {
    leaks.push(
      `failed to restore mcp-adapter.json at ${replacement.prepared.locations.mcpAdapterJsonPath}: ${errorMessage(err)}`,
    );
  }

  return Object.freeze(leaks);
}

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
