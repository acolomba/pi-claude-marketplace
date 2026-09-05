// persistence/locations.ts
//
// ScopedLocations -- the typed bundle of every name-derived path the
// extension writes to. Per SC-3, the bundle has a unique-symbol brand
// so hand-crafted shapes that mix scopes do NOT type-check.
//
// Per SC-7, every name-derived path inside the bundle goes through
// assertPathInside (D-15 single chokepoint). The three
// method-helpers (pluginDataDir / marketplaceDataDir / sourceCloneDir)
// exist precisely to enforce this -- callers MUST NOT compose paths
// by string concatenation; they call the methods.
//
// Per D-10, ScopedLocations is per-scope independent.
// Cross-scope reads are explicitly not modeled here.

import path from "node:path";

import { assertSafeName } from "../domain/name.ts";
import { workflowProjectKey } from "../domain/workflow-project-key.ts";
import { getAgentDir } from "../platform/pi-api.ts";
import { workflowHomeDir } from "../platform/workflow-home.ts";
import { assertPathInside } from "../shared/path-safety.ts";

import type { Scope } from "../shared/types.ts";

/** Unique brand symbol; consumers cannot mint a ScopedLocations directly. */
const SCOPED_LOCATIONS_BRAND: unique symbol = Symbol("ScopedLocations");

/**
 * Typed bundle of every name-derived path the extension writes to (SC-2,
 * SC-3, SC-7). Branded with a unique symbol so a hand-crafted object
 * literal that mixes scopes (e.g. user-scope `agentsDir` paired with a
 * project-scope `extensionRoot`) cannot type-check.
 *
 * The three method-helpers (pluginDataDir / marketplaceDataDir /
 * sourceCloneDir) accept potentially-untrusted name strings and route
 * them through assertPathInside before returning, defending against an
 * attacker-controlled marketplace name like `'../escape'` (SC-7, NFR-10).
 */
export interface ScopedLocations {
  readonly [SCOPED_LOCATIONS_BRAND]: true;
  readonly scope: Scope;
  /** Pi agent dir for user scope, `<cwd>/.pi` for project scope. */
  readonly scopeRoot: string;
  /** `<scopeRoot>/pi-claude-marketplace/` -- the extension's writable root. */
  readonly extensionRoot: string;
  /** `<extensionRoot>/state.json` -- atomic state file. */
  readonly stateJsonPath: string;
  /** `<extensionRoot>/.state-lock` -- per-scope cross-process lock sentinel. */
  readonly stateLockFile: string;
  /** `<scopeRoot>/agents/` -- where pi-subagents agents are written (SC-2). */
  readonly agentsDir: string;
  /** `<extensionRoot>/agents-staging/` -- pre-rename staging tree. */
  readonly agentsStagingDir: string;
  /** `<extensionRoot>/agents-index.json` -- on-disk agent ownership index (D-07). */
  readonly agentsIndexPath: string;
  /** `<scopeRoot>/mcp.json` -- MCP server registry (SC-2). */
  readonly mcpJsonPath: string;
  /** `<scopeRoot>/claude-plugins.json` -- declarative config base (CFG-01). */
  readonly configJsonPath: string;
  /** `<scopeRoot>/claude-plugins.local.json` -- per-machine override layer (CFG-02). */
  readonly configLocalJsonPath: string;
  /** `<extensionRoot>/skills-staging/` -- per-skill atomic-rename source (D-04). */
  readonly skillsStagingDir: string;
  /** `<extensionRoot>/commands-staging/` -- per-command atomic-rename source. */
  readonly commandsStagingDir: string;
  /** `<extensionRoot>/resources/skills/` -- per-skill atomic-rename target (SK-1). */
  readonly skillsTargetDir: string;
  /** `<extensionRoot>/resources/prompts/` -- per-command atomic-rename target (CM-1). */
  readonly promptsTargetDir: string;
  /** `<extensionRoot>/data/` -- per-marketplace, per-plugin cache root. */
  readonly dataRoot: string;
  /** `<extensionRoot>/sources/` -- where GitHub clones land. */
  readonly sourcesDir: string;
  /**
   * `<extensionRoot>/plugin-clones/` -- D-77-03 / NFR-10 source-addressed
   * plugin-clone cache root. Sibling of `sourcesDir` / `sources-staging` /
   * `cacheDir`; same-FS with `sources-staging/` so tmp+rename stays atomic
   * (NFR-1). Hard-coded suffix on `extensionRoot`; no name input participates
   * at this layer.
   */
  readonly pluginClonesDir: string;
  /**
   * `<extensionRoot>/hooks/` -- HOOK-01 / D-57-03 per-plugin hooks
   * container-dir root. Sibling of `dataRoot`, `sourcesDir`, `cacheDir`.
   * Hard-coded suffix on `extensionRoot`; no name input participates at
   * this layer (NFR-10 containment-by-construction). LIFE-03 is the
   * binding caller that asserts containment of plugin `hooks/hooks.json`
   * paths against this dir.
   */
  readonly hooksDir: string;
  /**
   * `<extensionRoot>/cache/` -- D-03 completion cache root.
   * Sibling of `dataRoot`, `sourcesDir`. Optimization-only: every file
   * inside this directory is rebuildable from `state.json` +
   * `marketplace.json` and may be deleted at any time.
   */
  readonly cacheDir: string;
  /**
   * `<extensionRoot>/cache/marketplace-names.json` -- D-03 file-backed
   * marketplace-names cache (per scope). Holds the union of marketplace
   * names visible in this scope; consumed by `getMarketplaceNames(scope)`
   * in `shared/completion-cache.ts`.
   */
  readonly marketplaceNamesCacheFile: string;
  /**
   * `~/.pi/workflows/` -- the host workflow engine's storage root
   * (WPTH-04). NOT under `scopeRoot`, NOT relocated by `PI_CODING_AGENT_DIR`,
   * and scope-INDEPENDENT: this member is byte-identical for
   * `locationsFor("user", cwd)` and `locationsFor("project", cwd)`. The engine
   * derives the root from the home directory and honors no override, so a
   * relocated value would put artifacts where it never looks.
   */
  readonly workflowsHomeDir: string;
  /**
   * The scope's canonical saved-workflow directory (WPTH-01):
   *   user    -> `<workflowsHomeDir>/saved/`
   *   project -> `<workflowsHomeDir>/projects/<key>/saved/`
   * where `<key>` is `workflowProjectKey(cwd)`. This is the ONLY workflows
   * member that branches on scope. The deprecated `<cwd>/.pi/workflows/saved/`
   * location is NEVER this value: the engine still reads it, but its own
   * module header says new writes live under the user's workflow home, so
   * writing it would make installed workflows vanish if that read is dropped
   * (WPTH-02).
   */
  readonly workflowsSavedDir: string;
  /**
   * `<workflowsHomeDir>/.pi-claude-marketplace-staging/` -- pre-rename staging
   * tree for workflow envelopes. Deliberately NOT under `extensionRoot`,
   * unlike every other bridge's staging directory: a project-scope
   * `extensionRoot` sits at `<cwd>/.pi/` and can live on a different
   * filesystem from the home directory, which makes the commit `rename()` fail
   * EXDEV. Staging beside the target keeps the rename inside one filesystem
   * (WPTH-05, NFR-1). Scope-independent, like `workflowsHomeDir`.
   *
   * Owner-named rather than generically named because this root is shared with
   * the host engine and with the user's own saved workflows -- a stray
   * directory here must say who left it.
   */
  readonly workflowsStagingDir: string;

  /** Returns `<dataRoot>/<mp>/<plugin>/` after SC-7 containment check. */
  pluginDataDir(mp: string, plugin: string): Promise<string>;
  /** Returns `<dataRoot>/<mp>/` after SC-7 containment check. */
  marketplaceDataDir(mp: string): Promise<string>;
  /** Returns `<sourcesDir>/<mp>/` after SC-7 containment check. */
  sourceCloneDir(mp: string): Promise<string>;
  /**
   * SC-7 / D-15 / NFR-10 / D-77-03: returns `<pluginClonesDir>/<key>/` after
   * `assertSafeName` + `assertPathInside` containment checks. `key` is a
   * `pluginCloneKey` (`<12hex>-<sha12>`) or `pluginMirrorKey` (`<12hex>`)
   * output; the chokepoint is the SOLE sanctioned composer of a plugin-clone
   * path -- call sites MUST route through it rather than string-concatenating
   * under `pluginClonesDir`.
   */
  pluginCloneDir(key: string): Promise<string>;
  /** Returns `<extensionRoot>/sources-staging/<uuid>/` after SC-7 / NFR-10 containment check (D-09 same-FS sibling of `sourcesDir`). */
  sourcesStagingDir(uuid: string): Promise<string>;
  /**
   * D-03: returns `<cacheDir>/plugins/<marketplace>.json` after
   * `assertSafeName` + `assertPathInside` containment checks. Consumed
   * by `getPluginIndex(scope, marketplace)` in `shared/completion-cache.ts`.
   * The cache file is optimization-only -- it can be deleted at any time
   * and will be lazily rebuilt from authoritative sources.
   */
  pluginCacheFile(marketplace: string): Promise<string>;
  /**
   * SC-7 / D-15 / NFR-10 / WPTH-04: returns
   * `<workflowsSavedDir>/<generatedName>.json` after `assertSafeName` +
   * `assertPathInside` containment checks. The SOLE sanctioned composer of a
   * workflow artifact path -- the workflows bridge MUST route through it
   * rather than joining a name onto the saved directory itself, which is what
   * keeps the untrusted `meta.name` from reaching `path.join` unchecked.
   *
   * The filename stem is the envelope's own `name`: the engine composes
   * `load(name)` and `delete(name)` as `join(dir, name + ".json")` while
   * `list()` reports the envelope field, so the two must agree (WBRG-01).
   */
  workflowArtifactPath(generatedName: string): Promise<string>;
}

/**
 * SOLE factory for ScopedLocations (SC-3 brand discipline).
 *
 * `scope` selects between user (Pi agent dir; defaults to `~/.pi/agent/`
 * and honors `PI_CODING_AGENT_DIR`) and project (`<cwd>/.pi/`) roots per
 * SC-1 / SC-2. `cwd` is used only for `scope === 'project'`; for
 * user scope, `cwd` is ignored.
 *
 * The returned object is frozen so a caller cannot mutate `scope` or any
 * of the derived path strings after construction; defense-in-depth around
 * the brand-symbol type-level guarantee.
 */
export function locationsFor(scope: Scope, cwd: string): ScopedLocations {
  const scopeRoot = scope === "user" ? getAgentDir() : path.join(cwd, ".pi");

  const extensionRoot = path.join(scopeRoot, "pi-claude-marketplace");
  const stateJsonPath = path.join(extensionRoot, "state.json");
  const stateLockFile = path.join(extensionRoot, ".state-lock");
  const agentsDir = path.join(scopeRoot, "agents");
  const agentsStagingDir = path.join(extensionRoot, "agents-staging");
  const agentsIndexPath = path.join(extensionRoot, "agents-index.json");
  const mcpJsonPath = path.join(scopeRoot, "mcp.json");
  // CFG-01 / CFG-02: declarative config base + per-machine override sit under
  // scopeRoot at the same tier as agentsDir and mcpJsonPath. NFR-10 containment
  // is enforced at the WRITE site (saveConfig) rather than here; both paths are
  // composed from hard-coded suffixes on scopeRoot so the locations.ts comment
  // block below (lines 134-143) covering the suffix-only construction applies.
  const configJsonPath = path.join(scopeRoot, "claude-plugins.json");
  const configLocalJsonPath = path.join(scopeRoot, "claude-plugins.local.json");
  const skillsStagingDir = path.join(extensionRoot, "skills-staging");
  const commandsStagingDir = path.join(extensionRoot, "commands-staging");
  const skillsTargetDir = path.join(extensionRoot, "resources", "skills");
  const promptsTargetDir = path.join(extensionRoot, "resources", "prompts");
  const dataRoot = path.join(extensionRoot, "data");
  const sourcesDir = path.join(extensionRoot, "sources");
  // D-77-03 / NFR-10: source-addressed plugin-clone cache root. Sibling of
  // dataRoot, sourcesDir, cacheDir; same-FS with sources-staging/ so the
  // tmp+rename clone commit stays atomic (NFR-1). Hard-coded suffix on
  // extensionRoot; no name input participates at this layer.
  const pluginClonesDir = path.join(extensionRoot, "plugin-clones");
  // HOOK-01 / D-57-03: per-plugin hooks container-dir root. Sibling of
  // dataRoot, sourcesDir, cacheDir. Hard-coded suffix on extensionRoot;
  // no name input participates at this layer (NFR-10 by construction).
  // LIFE-03 is the binding caller that will assert plugin hooks/hooks.json
  // paths against this root.
  const hooksDir = path.join(extensionRoot, "hooks");
  // D-03: completion cache root. Sibling of dataRoot, sourcesDir.
  const cacheDir = path.join(extensionRoot, "cache");
  const marketplaceNamesCacheFile = path.join(cacheDir, "marketplace-names.json");
  // WPTH-04: the host workflow engine's storage root. Unlike every other base
  // in this factory it does NOT hang off scopeRoot -- the engine derives it
  // from the home directory and honors no override, so it reaches the bundle
  // through the platform seam and nowhere else.
  const workflowsHomeDir = workflowHomeDir();
  // WPTH-01: the only workflows member that branches on scope, mirroring the
  // scopeRoot branch at the top of this function. The project arm's middle
  // segment is derived from cwd rather than hard-coded -- see the disposition
  // note below.
  const workflowsSavedDir =
    scope === "user"
      ? path.join(workflowsHomeDir, "saved")
      : path.join(workflowsHomeDir, "projects", workflowProjectKey(cwd), "saved");
  // WPTH-05: staging is a SIBLING of the saved directory under the engine's
  // own root, not a child of extensionRoot, so the commit rename() stays
  // within one filesystem (NFR-1). It sits outside all three directories the
  // engine scans, so staged bytes are invisible to it.
  const workflowsStagingDir = path.join(workflowsHomeDir, ".pi-claude-marketplace-staging");

  // T-03-04 disposition: every new field above (including hooksDir per
  // HOOK-01 / D-57-03) is constructed from `extensionRoot` joined to a
  // HARD-CODED suffix; no untrusted name components participate. Per W-10
  // / B-04, the bridges that join leaf names onto these dirs MUST call
  // assertPathInside on the resulting leaf.
  // We do not call assertPathInside here because (a) it is async and
  // locationsFor is sync (callers like loadState/saveState rely on the
  // sync shape), and (b) the suffix-only construction makes a containment
  // escape impossible at this layer.
  //
  // WPTH-01 amends clause (a) of that disposition, not clause (b):
  // `workflowsSavedDir`'s project arm interpolates `workflowProjectKey(cwd)`,
  // which is DERIVED from cwd rather than hard-coded. It is still escape-proof
  // at this layer because the derivation's own character class is
  // `[a-z0-9._-]` with every other run collapsed to a single dash, the
  // leading/trailing dash strip runs over that result, and an empty result
  // falls back to the literal `project`. A lone `.` and a `..` are therefore
  // unreachable outputs and no path separator can survive, so the joined
  // segment cannot climb out of `workflowsHomeDir`. Name-bearing LEAVES under
  // the saved directory are a different matter and do route through
  // `assertPathInside` -- see `workflowArtifactPath`.

  const bundle: ScopedLocations = Object.freeze({
    [SCOPED_LOCATIONS_BRAND]: true as const,
    scope,
    scopeRoot,
    extensionRoot,
    stateJsonPath,
    stateLockFile,
    agentsDir,
    agentsStagingDir,
    agentsIndexPath,
    mcpJsonPath,
    configJsonPath,
    configLocalJsonPath,
    skillsStagingDir,
    commandsStagingDir,
    skillsTargetDir,
    promptsTargetDir,
    dataRoot,
    sourcesDir,
    pluginClonesDir,
    hooksDir,
    cacheDir,
    marketplaceNamesCacheFile,
    workflowsHomeDir,
    workflowsSavedDir,
    workflowsStagingDir,

    async pluginDataDir(mp: string, plugin: string): Promise<string> {
      // Defense-in-depth: route both name inputs through assertSafeName before
      // path.join + assertPathInside (T-5-09 mitigation). assertPathInside
      // alone does NOT catch every embedded separator
      // (e.g. `plugin = "p/sub"` joins to `<dataRoot>/mp/p/sub` which STAYS
      // inside dataRoot). assertSafeName upstream rejects "/" and "\" path
      // separators, "." / ".." traversal segments, and ASCII control chars.
      assertSafeName(mp, `pluginDataDir marketplace name "${mp}"`);
      assertSafeName(plugin, `pluginDataDir plugin name "${plugin}"`);
      const candidate = path.join(dataRoot, mp, plugin);
      await assertPathInside(dataRoot, candidate, `pluginDataDir(${mp}, ${plugin})`);
      return candidate;
    },

    async marketplaceDataDir(mp: string): Promise<string> {
      // Defense-in-depth: assertSafeName upstream rejects separator-bearing
      // marketplace names that path.join would silently nest under dataRoot.
      assertSafeName(mp, `marketplaceDataDir marketplace name "${mp}"`);
      const candidate = path.join(dataRoot, mp);
      await assertPathInside(dataRoot, candidate, `marketplaceDataDir(${mp})`);
      return candidate;
    },

    async sourceCloneDir(mp: string): Promise<string> {
      // Defense-in-depth: assertSafeName upstream rejects separator-bearing
      // marketplace names that path.join would silently nest under sourcesDir.
      assertSafeName(mp, `sourceCloneDir marketplace name "${mp}"`);
      const candidate = path.join(sourcesDir, mp);
      await assertPathInside(sourcesDir, candidate, `sourceCloneDir(${mp})`);
      return candidate;
    },

    async pluginCloneDir(key: string): Promise<string> {
      // SC-7 / D-15 / NFR-10 / D-77-03: mirror the sourceCloneDir chokepoint
      // exactly. The key is a `pluginCloneKey` (`<12hex>-<sha12>`) or
      // `pluginMirrorKey` (`<12hex>`) output (safe by construction), but gate
      // through assertSafeName for symmetry and defense-in-depth before
      // path.join, then assertPathInside on the resulting leaf against
      // pluginClonesDir.
      assertSafeName(key, `pluginCloneDir clone key "${key}"`);
      const candidate = path.join(pluginClonesDir, key);
      await assertPathInside(pluginClonesDir, candidate, `pluginCloneDir(${key})`);
      return candidate;
    },

    async sourcesStagingDir(uuid: string): Promise<string> {
      const sourcesStagingRoot = path.join(extensionRoot, "sources-staging");
      const candidate = path.join(sourcesStagingRoot, uuid);
      await assertPathInside(sourcesStagingRoot, candidate, `sourcesStagingDir(${uuid})`);
      return candidate;
    },

    async pluginCacheFile(marketplace: string): Promise<string> {
      // D-03 / T-EDGE-5b: marketplace names originate in user-
      // supplied state, so route through assertSafeName before composing
      // a path. assertPathInside enforces NFR-10 containment on the
      // resulting leaf path against cacheDir.
      assertSafeName(marketplace, `pluginCacheFile marketplace name "${marketplace}"`);
      const candidate = path.join(cacheDir, "plugins", `${marketplace}.json`);
      await assertPathInside(cacheDir, candidate, `pluginCacheFile(${marketplace})`);
      return candidate;
    },

    async workflowArtifactPath(generatedName: string): Promise<string> {
      // SC-7 / D-15 / NFR-10 / WPTH-04: mirror the pluginCacheFile chokepoint,
      // which is the closest analog because it too appends a `.json` suffix.
      // The name originates in a plugin-authored `meta.name`, so it is
      // untrusted: assertSafeName rejects "/" and "\" separators, the "." and
      // ".." traversal segments and ASCII control chars before path.join sees
      // it, and assertPathInside then walks every component of the resulting
      // leaf against the saved directory.
      assertSafeName(generatedName, `workflowArtifactPath workflow name "${generatedName}"`);
      const candidate = path.join(workflowsSavedDir, `${generatedName}.json`);
      await assertPathInside(
        workflowsSavedDir,
        candidate,
        `workflowArtifactPath(${generatedName})`,
      );
      return candidate;
    },
  });

  return bundle;
}
