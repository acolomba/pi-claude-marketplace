// bridges/hooks/project-ledger.ts
//
// D-CF2-13 for hooks: the project-scope hook configs this user installed,
// listed in the user's own record of project installs, outside the project. A
// project's `.pi/pi-claude-marketplace/` tree lives in the repository, so a
// clone can carry a `state.json` and a staged `hooks.json` whose commands
// would run on whoever opens it, with no command from that user. Claude Code
// loads a project's plugins only when `installed_plugins.json` in the user's
// config directory lists them for that project, and skips the others
// (`not_installed_here`). Only a record under the user scope root, which no
// repository can write, tells this user's install apart from such a clone.
//
// The record is the D-CF2-13 project ledger in `persistence/project-installs.ts`:
// one file per project (IN-06), whose `skills` map also lists commands. A
// hooks entry is keyed `hooks/<plugin>`. Skill and command names pass
// `assertSafeName`, which rejects `/`, so the key never equals one of them.
// The entry holds the digest of the staged `hooks.json` bytes, and every
// write runs under the project's state lock, as the skills writes do.

import { createHash } from "node:crypto";
import path from "node:path";

import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ProjectSkillLedgerChange } from "../../persistence/project-installs.ts";

/** The key of the staged hooks config of `plugin` in a project's ledger. */
export function projectHookLedgerKey(plugin: string): string {
  return `hooks/${plugin}`;
}

/** The lowercase hex SHA-256 of the bytes of a staged `hooks.json`. */
export function hookConfigDigest(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * The change that drops the hooks config of `plugin` from the ledger of the
 * project whose scope `locations` names, with nothing to remember yet. A write
 * adds the config it staged. A user-scope location returns `undefined`: no
 * repository can write the user scope, so its hooks need no record.
 */
export function projectHookChange(
  locations: ScopedLocations,
  plugin: string,
): ProjectSkillLedgerChange | undefined {
  if (locations.scope === "user") {
    return undefined;
  }

  return {
    projectPath: path.dirname(locations.scopeRoot),
    forget: [projectHookLedgerKey(plugin)],
    remember: new Map(),
  };
}
