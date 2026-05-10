// persistence/locations.ts
//
// ScopedLocations -- the typed bundle of every name-derived path the
// extension writes to. Per SC-3, the bundle has a unique-symbol brand
// so hand-crafted shapes that mix scopes do NOT type-check.
//
// Per SC-7, every name-derived path inside the bundle goes through
// assertPathInside (Phase 1 D-15 single chokepoint). The three
// method-helpers (pluginDataDir / marketplaceDataDir / sourceCloneDir)
// exist precisely to enforce this -- callers MUST NOT compose paths
// by string concatenation; they call the methods.
//
// Per CONTEXT.md D-10, ScopedLocations is per-scope independent.
// Cross-scope reads are explicitly not modeled here.

import os from "node:os";
import path from "node:path";

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
  /** `~/.pi/agent` for user scope, `<cwd>/.pi` for project scope. */
  readonly scopeRoot: string;
  /** `<scopeRoot>/claude-marketplace/` -- the extension's writable root. */
  readonly extensionRoot: string;
  /** `<extensionRoot>/state.json` -- atomic state file. */
  readonly stateJsonPath: string;
  /** `<scopeRoot>/agents/` -- where pi-subagents agents are written (SC-2). */
  readonly agentsDir: string;
  /** `<extensionRoot>/agents-staging/` -- pre-rename staging tree. */
  readonly agentsStagingDir: string;
  /** `<extensionRoot>/agents-index.json` -- on-disk agent ownership index (D-07). */
  readonly agentsIndexPath: string;
  /** `<scopeRoot>/mcp.json` -- MCP server registry (SC-2). */
  readonly mcpJsonPath: string;
  /** `<extensionRoot>/skills-staging/` -- per-skill atomic-rename source (Phase 3 D-04). */
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

  /** Returns `<dataRoot>/<mp>/<plugin>/` after SC-7 containment check. */
  pluginDataDir(mp: string, plugin: string): Promise<string>;
  /** Returns `<dataRoot>/<mp>/` after SC-7 containment check. */
  marketplaceDataDir(mp: string): Promise<string>;
  /** Returns `<sourcesDir>/<mp>/` after SC-7 containment check. */
  sourceCloneDir(mp: string): Promise<string>;
}

/**
 * SOLE factory for ScopedLocations (SC-3 brand discipline).
 *
 * `scope` selects between user (`~/.pi/agent/`) and project (`<cwd>/.pi/`)
 * roots per SC-1 / SC-2. `cwd` is used only for `scope === 'project'`; for
 * user scope, `cwd` is ignored.
 *
 * The returned object is frozen so a caller cannot mutate `scope` or any
 * of the derived path strings after construction; defense-in-depth around
 * the brand-symbol type-level guarantee.
 */
export function locationsFor(scope: Scope, cwd: string): ScopedLocations {
  const scopeRoot =
    scope === "user" ? path.join(os.homedir(), ".pi", "agent") : path.join(cwd, ".pi");

  const extensionRoot = path.join(scopeRoot, "claude-marketplace");
  const stateJsonPath = path.join(extensionRoot, "state.json");
  const agentsDir = path.join(scopeRoot, "agents");
  const agentsStagingDir = path.join(extensionRoot, "agents-staging");
  const agentsIndexPath = path.join(extensionRoot, "agents-index.json");
  const mcpJsonPath = path.join(scopeRoot, "mcp.json");
  const skillsStagingDir = path.join(extensionRoot, "skills-staging");
  const commandsStagingDir = path.join(extensionRoot, "commands-staging");
  const skillsTargetDir = path.join(extensionRoot, "resources", "skills");
  const promptsTargetDir = path.join(extensionRoot, "resources", "prompts");
  const dataRoot = path.join(extensionRoot, "data");
  const sourcesDir = path.join(extensionRoot, "sources");

  // T-03-04 disposition: every new field above is constructed from
  // `extensionRoot` joined to a HARD-CODED suffix; no untrusted name
  // components participate. Per W-10 / B-04, the bridges that join leaf
  // names onto these dirs MUST call assertPathInside on the resulting
  // leaf -- enforced in their plans (03-03 / 03-04 / 03-05 / 03-06).
  // We do not call assertPathInside here because (a) it is async and
  // locationsFor is sync (callers like loadState/saveState rely on the
  // sync shape), and (b) the suffix-only construction makes a containment
  // escape impossible at this layer.

  const bundle: ScopedLocations = Object.freeze({
    [SCOPED_LOCATIONS_BRAND]: true as const,
    scope,
    scopeRoot,
    extensionRoot,
    stateJsonPath,
    agentsDir,
    agentsStagingDir,
    agentsIndexPath,
    mcpJsonPath,
    skillsStagingDir,
    commandsStagingDir,
    skillsTargetDir,
    promptsTargetDir,
    dataRoot,
    sourcesDir,

    async pluginDataDir(mp: string, plugin: string): Promise<string> {
      const candidate = path.join(dataRoot, mp, plugin);
      await assertPathInside(dataRoot, candidate, `pluginDataDir(${mp}, ${plugin})`);
      return candidate;
    },

    async marketplaceDataDir(mp: string): Promise<string> {
      const candidate = path.join(dataRoot, mp);
      await assertPathInside(dataRoot, candidate, `marketplaceDataDir(${mp})`);
      return candidate;
    },

    async sourceCloneDir(mp: string): Promise<string> {
      const candidate = path.join(sourcesDir, mp);
      await assertPathInside(sourcesDir, candidate, `sourceCloneDir(${mp})`);
      return candidate;
    },
  });

  return bundle;
}
