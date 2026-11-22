// test/integration/mcp-migration.test.ts
//
// AMIG-02: one case of the move of a legacy `mcp.json`, kept as fault
// injection (ITSCOPE-01). A directory that the case makes read-only refuses
// the rewrite of `mcp.json` after `mcp-adapter.json` is written, and the next
// reload finishes the move with no server lost. The cucumber harness cannot
// refuse that one write. Everything a user can see of the move is in
// `features/mcp-server/legacy-move.feature`.

import assert from "node:assert/strict";
import { chmod, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  createHooksRouting,
  createHooksRuntime,
  readHooksJson,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/index.ts";
import { createApplyReconcile } from "../../extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts";
import { locationsFor } from "../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { loadState } from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { createCompletionCache } from "../../extensions/pi-claude-marketplace/shared/completion-cache.ts";
import { CHMOD_DENIAL_HINT, chmodDeniesThisProcess } from "../chmod-denial.ts";
import { withHermeticEnvironment } from "../platform/hermetic-environment.ts";

import { makeCtx, seedLegacyMcpInstall } from "./mcp-plugin-seed.ts";

import type { NotifyRecord } from "./mcp-plugin-seed.ts";
import type { TestContext } from "node:test";

const COST_LINE =
  "The new names reset what pi-mcp-adapter keeps for each server name: sign in again to servers that use OAuth, and approve project servers again. Until you reload, pi-mcp-adapter can still show the old names.";

async function reload(cwd: string): Promise<NotifyRecord[]> {
  // A command run: a load-origin run is an autoapply load, which keeps the
  // empty pass silent (AAP-02) where the command reports it.
  const { session, notifications } = makeCtx();
  await createApplyReconcile({ loadState })({
    ...session,
    cwd,
    hooksRouting: createHooksRouting(createHooksRuntime(), { readHooksJson }),
    completionCache: createCompletionCache(),
  });
  return notifications;
}

/**
 * APL-01 / D-08: the helper drives the apply operation, which reports a pass
 * that accumulated no outcome; the migration notice comes first.
 */
const APPLY_EMPTY_NOTICE: NotifyRecord = {
  message: "Apply: nothing to change.",
  severity: undefined,
};

/** The server keys of a scope's `mcp-adapter.json`; none when the file does not exist. */
async function adapterKeys(cwd: string): Promise<readonly string[]> {
  const raw = await readFile(locationsFor("project", cwd).mcpAdapterJsonPath, "utf8").catch(
    () => '{"mcpServers":{}}',
  );
  return Object.keys((JSON.parse(raw) as { mcpServers: Record<string, unknown> }).mcpServers);
}

/** The marked entries left in a scope's `mcp.json`. */
async function markedLegacyNames(cwd: string): Promise<readonly string[]> {
  const raw = await readFile(locationsFor("project", cwd).mcpJsonPath, "utf8");
  const servers = (JSON.parse(raw) as { mcpServers: Record<string, Record<string, unknown>> })
    .mcpServers;
  return Object.keys(servers).filter((name) => servers[name]?._piClaudeMarketplace !== undefined);
}

/**
 * Points `filePath` at a readable file inside a directory the test makes
 * read-only, so the file reads normally and an atomic write to it fails.
 * Returns the directory, which the case unlocks after acting.
 */
async function lockedLink(
  t: TestContext,
  cwd: string,
  filePath: string,
  bytes: string,
): Promise<string> {
  // A 0o555 directory stays writable for uid 0 with its default capabilities,
  // so the write this helper exists to refuse would succeed. Refuse up front and
  // name the environment.
  if (!(await chmodDeniesThisProcess())) {
    throw new Error(`lockedLink cannot deny this process. ${CHMOD_DENIAL_HINT}`);
  }

  const lockedDirectory = path.join(cwd, "locked");
  const target = path.join(lockedDirectory, path.basename(filePath));
  await mkdir(lockedDirectory, { recursive: true });
  await writeFile(target, bytes, "utf8");
  await rm(filePath, { force: true });
  await symlink(target, filePath);
  t.after(async () => {
    await chmod(lockedDirectory, 0o700).catch(() => undefined);
  });
  await chmod(lockedDirectory, 0o555);
  return lockedDirectory;
}

async function scopeBytes(cwd: string): Promise<readonly Buffer[]> {
  const locations = locationsFor("project", cwd);
  return Promise.all([
    readFile(locations.mcpJsonPath),
    readFile(locations.mcpAdapterJsonPath),
    readFile(locations.stateJsonPath),
  ]);
}

test("AMIG-02: a filesystem refusal between the two writes loses no server and the next reload finishes the move", async (t) => {
  await withHermeticEnvironment("mcp-migration-refused-", async ({ cwd }) => {
    // arrange
    await seedLegacyMcpInstall(cwd, "project", { command: "node", args: ["v1.js"] });
    const locations = locationsFor("project", cwd);
    const lockedDirectory = await lockedLink(
      t,
      cwd,
      locations.mcpJsonPath,
      await readFile(locations.mcpJsonPath, "utf8"),
    );

    // act
    const refused = await reload(cwd);
    const afterRefusal = {
      adapter: await adapterKeys(cwd),
      legacy: await markedLegacyNames(cwd),
    };
    await chmod(lockedDirectory, 0o700);
    const finished = await reload(cwd);
    const finishedBytes = await scopeBytes(cwd);
    const settled = await reload(cwd);

    // assert
    assert.deepStrictEqual(afterRefusal, { adapter: ["plugin_hello_srv_"], legacy: ["srv"] });
    // write-file-atomic names its temporary file with a random suffix.
    const refusedStable = refused.map((entry) => ({
      ...entry,
      message: entry.message.replace(/mcp\.json\.\d+/, "mcp.json.<tmp>"),
    }));
    assert.deepStrictEqual(refusedStable, [
      {
        message: [
          "Plugin MCP servers in mcp.json need attention.",
          "",
          "Left in mcp.json:",
          "  srv (hello) [project] The new entries are written, but mcp.json could not be updated: EACCES: permission denied, open 'mcp.json.<tmp>'. The next /reload finishes the move.",
        ].join("\n"),
        severity: "warning",
      },
      APPLY_EMPTY_NOTICE,
    ]);
    assert.deepStrictEqual(finished, [
      {
        message: [
          "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
          "",
          "Moved to mcp-adapter.json:",
          "  srv -> plugin_hello_srv_ (hello) [project]",
          COST_LINE,
          "/reload to pick up changes",
        ].join("\n"),
        severity: "info",
      },
      APPLY_EMPTY_NOTICE,
    ]);
    assert.deepStrictEqual(await markedLegacyNames(cwd), []);
    assert.deepStrictEqual(settled, [APPLY_EMPTY_NOTICE]);
    assert.deepStrictEqual(await scopeBytes(cwd), finishedBytes);
  });
});
