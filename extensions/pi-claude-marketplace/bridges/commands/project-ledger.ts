// bridges/commands/project-ledger.ts
//
// D-CF3-07: the project-scope commands this user installed, listed in the
// user's own record of project installs, outside the project. A project's
// `.pi/pi-claude-marketplace/` tree lives in the repository, so a clone can
// carry a staged command whose `!` commands would run on whoever opens it.
// Only a record under the user scope root, which no repository can write,
// tells this user's install apart from such a clone.
//
// The record is the D-CF2-13 project ledger in `persistence/project-installs.ts`:
// one file per project (IN-06), named by the SHA-256 of the project's real
// path, whose `skills` map also lists commands. A command's generated name
// holds the namespace separator and never equals a skill name, so the two
// kinds share the map. This module declares the ledger it needs as a
// structural type, and the orchestrators pass in the user's ledger.
//
// The ledger itself enforces WR-02: content this version cannot update makes
// the update throw and stays as it was. The commit writes after its staging
// cleanup (IN-02), so a failed write leaves no staging directory behind.

import { createHash } from "node:crypto";
import path from "node:path";

import type { ScopedLocations } from "../../persistence/locations.ts";

/** One committed project command: its plugin and the digest of its staged file. */
export interface ProjectCommandEntry {
  readonly plugin: string;
  readonly sha256: string;
}

/** A change to the commands the ledger lists for one project. */
export interface ProjectCommandChange {
  /** The project directory, the parent of the project scope root. */
  readonly projectPath: string;
  /** Generated names the project no longer holds from this install. */
  readonly forget: readonly string[];
  /** Generated names of the commands this install committed, with their entries. */
  readonly remember: ReadonlyMap<string, ProjectCommandEntry>;
}

/** The user's record of project installs, as the commands bridge writes it. */
export interface ProjectCommandLedger {
  readonly update: (change: ProjectCommandChange) => Promise<void>;
}

/** D-CF3-07: the lowercase hex SHA-256 of the UTF-8 bytes of a staged command file. */
export function commandFileDigest(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * D-CF3-07: the change that drops `forget` from the ledger of the project
 * whose scope `locations` names, with nothing to remember yet. A commit adds
 * the commands it committed. A user-scope location returns `undefined`: no
 * repository can write the user scope, so its commands need no record.
 */
export function projectCommandChange(
  locations: ScopedLocations,
  forget: readonly string[],
): ProjectCommandChange | undefined {
  if (locations.scope === "user") {
    return undefined;
  }

  return { projectPath: path.dirname(locations.scopeRoot), forget, remember: new Map() };
}
