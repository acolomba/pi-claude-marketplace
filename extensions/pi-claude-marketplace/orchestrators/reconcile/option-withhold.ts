// orchestrators/reconcile/option-withhold.ts
//
// D-PG10-25: the load step that holds back, in one scope's `mcp-adapter.json`,
// the entries that name an option of a plugin whose install record's stored
// `userConfig` does not parse, and restores them once the record reads again
// (`bridges/mcp/option-withhold.ts`). It amends APL-D1 (a load changes no
// installation state) as D-MB-03 and AMIG-01 do: installing or editing a
// record runs no plugin command, and pi-mcp-adapter would otherwise start the
// server with blank option values. It runs after the AMIG-01 move, under the
// scope's state lock, and saves no state. A pristine scope, and a scope with
// no `mcp-adapter.json`, take no lock and write nothing. A pi-subagents
// background child runs no MCP step, so it skips this one too (D-MB-12).
//
// Pi fires `session_start` before `resources_discover`, and pi-mcp-adapter
// reads its config and starts its servers from its own `session_start`. So the
// extension factory, which Pi awaits before any session event, also runs the
// step for the user scope, as it sets the user scope's option variables
// (D-PG10-23). It leaves a commented file to the load, which reports the
// dropped comments (AFILE-04). The project scope waits for the load, as its
// option variables do.
//
// NFR-5: no network. This module stays outside `NETWORK_SEAMS`.

import { syncWithheldOptionServers } from "../../bridges/mcp/index.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { unreadableUserConfigOf } from "../../persistence/state-io.ts";
import { isSubagentChild } from "../../platform/subagent-child.ts";
import { hookDebugLog } from "../../shared/debug-log.ts";
import { errorMessage } from "../../shared/errors.ts";
import { pathExists } from "../../shared/fs-utils.ts";
import { ownValue } from "../../shared/own-key.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";

import type { McpMigrationInput } from "./types.ts";
import type { RecordedOptionsReading } from "../../bridges/mcp/index.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
import type { SubagentChildEnv } from "../../platform/subagent-child.ts";

/** How `state` records the options of `plugin@marketplace`. */
function readingOf(
  state: ExtensionState,
  marketplace: string,
  plugin: string,
): RecordedOptionsReading {
  const record = ownValue(ownValue(state.marketplaces, marketplace)?.plugins, plugin);
  if (record === undefined) {
    return "absent";
  }

  return unreadableUserConfigOf(record) === undefined ? "readable" : "unreadable";
}

/** D-PG10-25: withholds and restores one scope's option-naming entries. */
export async function withholdUnreadableOptionServers(
  input: Pick<McpMigrationInput, "scope" | "cwd" | "notices">,
  keepCommentedFile = false,
): Promise<void> {
  const locations = locationsFor(input.scope, input.cwd);
  const [hasState, hasAdapterFile] = await Promise.all([
    pathExists(locations.stateJsonPath),
    pathExists(locations.mcpAdapterJsonPath),
  ]);
  if (!hasState || !hasAdapterFile) {
    return;
  }

  const notices = await withLockedStateTransaction(
    locations,
    (tx) =>
      syncWithheldOptionServers({
        scope: input.scope,
        filePath: locations.mcpAdapterJsonPath,
        keepCommentedFile,
        optionsOf: ({ marketplace, plugin }) => readingOf(tx.state, marketplace, plugin),
      }),
    { persistMigration: false },
  );
  input.notices.push(...notices);
}

/**
 * D-PG10-25 / NFR-2: the user scope's step at extension load, outside a
 * pi-subagents child (D-MB-12). A failure is logged and never stops the load.
 */
export async function withholdUserOptionServersAtStartup(
  cwd: string,
  env: SubagentChildEnv,
): Promise<void> {
  if (isSubagentChild(env)) {
    return;
  }

  try {
    await withholdUnreadableOptionServers({ scope: "user", cwd, notices: [] }, true);
  } catch (err) {
    hookDebugLog(
      `plugin options: held-back servers not synced at load: ${errorMessage(err)}`,
      "mcp",
    );
  }
}
