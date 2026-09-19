# Ground truth: uncovered branch conditions (local lcov, unit+integration+e2e merged per line)

138 uncovered conditions across 74 files (Sonar reports 134/74 — within V8 run jitter).
Model = Sonar's: per line, conditions = BRDA count, covered = BRDA with taken>0; max across the three reports.
Line numbers are V8 range starts and often land on comments/imports — the real branch is in the enclosing
construct (a catch, a `??`/`||`/`?.` fallback, a default param, an early-return guard, a ternary) near that line.
Verify fixes with check-branch-coverage.py in this directory.

## extensions/pi-claude-marketplace/shared/errors.ts (13 uncovered)

- line 107: 0/1 covered: `return new CleanupContextError(normalized.primary, [`
- line 278: 0/1 covered: `readonly scopes: readonly ("user" | "project")[];`
- line 289: 0/1 covered: `/** D-14 / MU-5: marketplace update failure preserves the retry-hint slot per MU-5. */`
- line 303: 0/1 covered: `* malformed JSON and a schema-invalid manifest. Giving the failure a typed`
- line 364: 0/1 covered: `* re-read of state shows the plugin record already exists (another process`
- line 389: 0/1 covered: `* absent at re-load time (another process completed the uninstall first).`
- line 410: 0/1 covered: `export class PluginUpdateConcurrencyError extends Error {`
- line 425: 0/1 covered: `readonly actualVersion?: string;`
- line 484: 0/1 covered: `* another Pi process already owns this scope's `.state-lock` sentinel.`
- line 508: 0/1 covered: `* `Error.cause` (passed via the options bag) carries the chained`
- line 540: 0/1 covered: `* directly to name the leaked paths on the rendered row (AS-7).`
- line 661: 0/1 covered: `* `causeChainTrailer` walker still surfaces the originating error.`
- line 688: 0/1 covered: `readonly reasons: readonly string[];`

## extensions/pi-claude-marketplace/persistence/state-io.ts (14 uncovered)

- line 26: 0/1 covered: `import { readFile } from "node:fs/promises";`
- line 388: 0/1 covered: `}`
- line 407: 1/2 covered: `parsedRecord !== undefined &&`
- line 412: 0/1 covered: `throw new Error(`state.json at ${stateJsonPath} has an unsupported schema version`);`
- line 419: 0/3 covered: `// captured it. The gate predicate lives HERE (not inside the migrator) so`
- line 420: 0/1 covered: `// `migrateLegacyMarketplaceRecords` stays a pure function with no hidden`
- line 421: 0/2 covered: `// I/O, and the D-13 gate decision is visible at the load seam where the`
- line 422: 0/1 covered: `// path is derived. The SYNC `existsSync` probe is taken once, before the`
- line 480: 0/1 covered: `* ST-1 / NFR-1 / AS-1: atomic state.json write via shared/atomic-json.ts.`
- line 483: 0/1 covered: `* caller bug (e.g. mutating a record into an invalid shape) surfaces`
- line 484: 0/1 covered: `* here instead of producing a corrupt state.json on disk.`

## extensions/pi-claude-marketplace/shared/path-safety.ts (9 uncovered)

- line 14: 1/2 covered: `readonly assertPathInside: (parent: string, child: string, label: string) => Promise<void>;`
- line 26: 0/1 covered: `super(`${label} escapes ${parent} (resolved: ${child}).`);`
- line 60: 0/1 covered: `super(parent, child, label);`
- line 111: 0/1 covered: `const normalizedChild = path.resolve(child);`
- line 123: 0/1 covered: `// Walk every parent component from `parent` down to `child` (inclusive).`
- line 131: 0/1 covered: `current = path.join(current, segment);`
- line 152: 0/1 covered: `current: string,`
- line 157: 0/1 covered: `throw new SymlinkRefusedError(`
- line 175: 0/1 covered: `const code = (err as NodeJS.ErrnoException).code;`

## extensions/pi-claude-marketplace/bridges/hooks/async-rewake/pid-table.ts (7 uncovered)

- line 17: 0/1 covered: `// environment under PI_CLAUDE_MARKETPLACE_REWAKE_DISPATCH so the`
- line 118: 1/2 covered: `(parsed as { version?: unknown }).version === ASYNC_REWAKE_PID_TABLE_VERSION &&`
- line 119: 0/1 covered: `Array.isArray((parsed as { entries?: unknown }).entries)`
- line 121: 0/1 covered: `return (parsed as PidTableFile).entries;`
- line 124: 0/1 covered: `hookDebugLog("async-rewake: pid-table shape mismatch");`
- line 131: 0/1 covered: `hookDebugLog(`async-rewake: pid-table read failed: ${errorMessage(err)}`);`
- line 173: 0/1 covered: `hookDebugLog(`async-rewake: pid-table unlink failed: ${errorMessage(err)}`);`

## extensions/pi-claude-marketplace/bridges/hooks/event-router.ts (5 uncovered)

- line 27: 0/1 covered: `//     `compareByNameThenScope` (project before user, alphabetical by`
- line 242: 0/1 covered: `* ascending (preserves source-file order across the`
- line 447: 0/1 covered: `readonly readHooksJson: (hooksJsonPath: string) => Promise<string>;`
- line 489: 0/1 covered: `* `getAgentDir()` indirection through `locationsFor`, project via`
- line 802: 0/1 covered: `* -- the extension factory in `index.ts` -- does NOT pass it, so production`

## extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts (5 uncovered)

- line 35: 1/2 covered: `import { locationsFor } from "../../persistence/locations.ts";`
- line 37: 0/1 covered: `import * as defaultGit from "../../platform/git.ts";`
- line 38: 0/2 covered: `import { hookDebugLog } from "../../shared/debug-log.ts";`
- line 84: 0/1 covered: `readonly credentialOps: CredentialOps;`

## extensions/pi-claude-marketplace/shared/errors-bridges.ts (4 uncovered)

- line 11: 0/1 covered: `// agent file is, in effect, an "ownership escape" from the extension's`
- line 33: 0/1 covered: `this.message = `Refusing to overwrite agent file at ${targetPath}: ${reason}.`;`
- line 83: 0/1 covered: `super(`Refusing to stage MCP server "${serverName}": already exists in ${owningPath}.`);`
- line 117: 0/1 covered: `super(`invalid command source "${sourceName}" in "${commandsDir}"`, options);`

## extensions/pi-claude-marketplace/orchestrators/import/settings.ts (3 uncovered)

- line 25: 2/3 covered: `return isPlainObject(value) ? value : {};`
- line 60: 0/1 covered: `} catch (err) {`
- line 123: 0/1 covered: `if (envDir !== undefined && !path.isAbsolute(envDir)) {`

## extensions/pi-claude-marketplace/platform/git.ts (5 uncovered)

- line 26: 1/2 covered: `*   - shallow clones / depth (deferred until needed; full history is kept)`
- line 29: 0/1 covered: `*     (the `buildAuthCallbacks` factory + `CloneOptions.auth?` /`
- line 31: 0/3 covered: `*     wires it at the call sites). When `opts.auth` is omitted, clone`

## extensions/pi-claude-marketplace/bridges/commands/discover.ts (2 uncovered)

- line 14: 0/1 covered: `// CM-4: discovery is recursive. A file at `commands/build/web.md` is`
- line 178: 0/1 covered: `return isErrnoException(err) && TOLERATED_WALK_ERRNOS.has(err.code ?? "");`

## extensions/pi-claude-marketplace/bridges/hooks/runtime.ts (2 uncovered)

- line 54: 1/2 covered: `readonly advanceGeneration: () => number;`
- line 94: 0/1 covered: `capNotifiedThisSession = false;`

## extensions/pi-claude-marketplace/bridges/mcp/stage.ts (2 uncovered)

- line 28: 0/1 covered: `import { errorMessage } from "../../shared/errors.ts";`
- line 100: 0/1 covered: `this.mcpJsonPath = mcpJsonPath;`

## extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts (2 uncovered)

- line 49: 0/1 covered: `import type { Dependency } from "../../shared/concerns/soft-dep.ts";`
- line 182: 0/1 covered: `*     as a `marketplace-not-added` carrying the REQUESTED scope (the`

## extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts (2 uncovered)

- line 17: 0/1 covered: `// structural `"marketplace not added"` sentinel can flow through; mirrors the orchestrator`
- line 240: 0/1 covered: `/** Plugin disable failure outcome. */`

## extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts (2 uncovered)

- line 32: 0/1 covered: `//     mid-write reaches this boundary. The add, install and toggle loops carry`
- line 322: 0/1 covered: `...(opts.gitOps !== undefined && { gitOps: opts.gitOps }),`

## extensions/pi-claude-marketplace/persistence/migrate.ts (2 uncovered)

- line 13: 0/1 covered: `// the default derivation. Per ST-5: missing resources.agents /`
- line 279: 0/1 covered: `} catch (err) {`

## extensions/pi-claude-marketplace/shared/completion-cache.ts (2 uncovered)

- line 16: 0/1 covered: `//     - memory hit AND now() - loadedAt <= 10 minutes -> return cached`
- line 152: 0/1 covered: `// ---------------------------------------------------------------------------`

## extensions/pi-claude-marketplace/bridges/agents/discover.ts (1 uncovered)

- line 15: 0/1 covered: `// agent name across array elements; the second occurrence surfaces in`

## extensions/pi-claude-marketplace/bridges/agents/marker.ts (1 uncovered)

- line 12: 0/1 covered: `//   - GENERATED_AGENT_MARKER is the current-format signature, emitted by`

## extensions/pi-claude-marketplace/bridges/agents/stage.ts (1 uncovered)

- line 27: 0/1 covered: `import path from "node:path";`

## extensions/pi-claude-marketplace/bridges/commands/stage.ts (1 uncovered)

- line 27: 0/1 covered: `// Re-stage path: previous-named target files (`previousCommandNames`) are`

## extensions/pi-claude-marketplace/bridges/commands/unstage.ts (1 uncovered)

- line 14: 0/1 covered: `import type { UnstageCommandsInput, UnstageCommandsResult } from "./types.ts";`

## extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts (1 uncovered)

- line 499: 0/1 covered: `* D-62-05 `/reload` cleanup walk. Iterates the in-memory registry,`

## extensions/pi-claude-marketplace/bridges/hooks/async-rewake/ring-buffer.ts (1 uncovered)

- line 74: 0/1 covered: `* Append `chunk` bytes to the buffer. On overflow (chunk larger than`

## extensions/pi-claude-marketplace/bridges/hooks/hook-env.ts (1 uncovered)

- line 12: 0/1 covered: `import path from "node:path";`

## extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts (1 uncovered)

- line 11: 0/1 covered: `// permission-rule grammar is small -- three metacharacters (`*` segment-`

## extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts (1 uncovered)

- line 38: 0/1 covered: `// today; callers pass `ctx.cwd` as the `projectRoot` fallback so a`

## extensions/pi-claude-marketplace/bridges/hooks/stage.ts (1 uncovered)

- line 15: 0/1 covered: `import { lstat, readFile, readdir, readlink, realpath, rm } from "node:fs/promises";`

## extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts (1 uncovered)

- line 13: 0/1 covered: `import { homedir } from "node:os";`

## extensions/pi-claude-marketplace/bridges/mcp/parse.ts (1 uncovered)

- line 15: 0/1 covered: `import { assertSafeName } from "../../domain/name.ts";`

## extensions/pi-claude-marketplace/bridges/skills/discover.ts (1 uncovered)

- line 12: 0/1 covered: `//     throwing. RN-6 / D-141-04: that holds in both directions -- two skill`

## extensions/pi-claude-marketplace/bridges/skills/stage.ts (1 uncovered)

- line 30: 0/1 covered: `cleanupStaging,`

## extensions/pi-claude-marketplace/bridges/skills/unstage.ts (1 uncovered)

- line 17: 0/1 covered: `export interface SkillsUnstageRemover {`

## extensions/pi-claude-marketplace/domain/component-paths.ts (1 uncovered)

- line 17: 0/1 covered: `| { readonly ok: true; readonly absolutePath: string }`

## extensions/pi-claude-marketplace/domain/components/hooks/schema.ts (1 uncovered)

- line 20: 0/1 covered: `const HOOK_HANDLER_SCHEMA = Type.Unsafe<HookHandlerEntry>({`

## extensions/pi-claude-marketplace/domain/components/mcp.ts (1 uncovered)

- line 11: 0/1 covered: `import { Compile } from "typebox/compile";`

## extensions/pi-claude-marketplace/domain/components/plugin.ts (1 uncovered)

- line 9: 0/1 covered: `// `source` as Unknown.`

## extensions/pi-claude-marketplace/domain/hooks-resolution.ts (1 uncovered)

- line 10: 1/2 covered: `export interface HooksResolution extends Pick<ComponentPathResolution, "supported" | "notes"> {`

## extensions/pi-claude-marketplace/domain/manifest.ts (1 uncovered)

- line 20: 0/1 covered: `* MM-1: `marketplace.json` shape. Required: string `name`, array `plugins`.`

## extensions/pi-claude-marketplace/domain/mcp-resolution.ts (1 uncovered)

- line 17: 0/1 covered: `}`

## extensions/pi-claude-marketplace/domain/plugin-resolver.ts (1 uncovered)

- line 20: 0/1 covered: `// discriminator. The three-way `state` field keeps the secondary`

## extensions/pi-claude-marketplace/domain/plugin-root.ts (1 uncovered)

- line 8: 0/1 covered: `// installable-vs-non-installable union does not constrain its shape). An`

## extensions/pi-claude-marketplace/domain/source.ts (1 uncovered)

- line 460: 0/1 covered: `while (rest.endsWith("/")) {`

## extensions/pi-claude-marketplace/domain/unsupported-components.ts (1 uncovered)

- line 14: 0/1 covered: `* PR-3: a declaration or matching convention for these kinds selects the`

## extensions/pi-claude-marketplace/domain/version.ts (1 uncovered)

- line 11: 0/1 covered: `//   6. Return SHA-256 truncated to 12 hex chars, prefixed `hash-`.`

## extensions/pi-claude-marketplace/edge/handlers/tools.ts (1 uncovered)

- line 18: 0/1 covered: `// this plan precisely to keep the tool execute bodies on the right side of`

## extensions/pi-claude-marketplace/orchestrators/discover.ts (1 uncovered)

- line 15: 0/1 covered: `type ResourceKind = ResourcesDiscoverFailure["kind"];`

## extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts (1 uncovered)

- line 32: 0/1 covered: `//   // is computed by `notify()` (mp.status `"added"` is state-changing);`

## extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts (1 uncovered)

- line 26: 0/1 covered: `// `shouldEmitReloadHint` fires only on a PLUGIN row with a state-changing`

## extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts (1 uncovered)

- line 22: 0/1 covered: `//      and emits the `{marketplace not added}` notify when the marketplace is in neither`

## extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts (1 uncovered)

- line 23: 0/1 covered: `//  The per-plugin cause chain rides on `PluginFailedMessage.cause`;`

## extensions/pi-claude-marketplace/orchestrators/plugin-path.ts (1 uncovered)

- line 17: 0/1 covered: `import { hookDebugLog } from "../shared/debug-log.ts";`

## extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts (1 uncovered)

- line 28: 0/1 covered: `import { ensureGitSuffix, parsePluginSource } from "../../domain/source.ts";`

## extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts (1 uncovered)

- line 10: 0/1 covered: `// orphan that the next idempotent pass removes (NFR-3 fail-clean).`

## extensions/pi-claude-marketplace/orchestrators/plugin/discover-names.ts (1 uncovered)

- line 11: 0/1 covered: `// Imports the three per-kind bridge barrels directly. An aggregate barrel`

## extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts (1 uncovered)

- line 28: 1/2 covered: `// `tests/architecture/no-orchestrator-network.test.ts` (FORBIDDEN_TARGETS) is`

## extensions/pi-claude-marketplace/orchestrators/plugin/git-source-probe.ts (1 uncovered)

- line 14: 1/2 covered: `// so `edge-deps.ts` can consume it while the no-orchestrator-network gate`

## extensions/pi-claude-marketplace/orchestrators/plugin/info.ts (1 uncovered)

- line 45: 0/1 covered: `type ParsedSource,`

## extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts (1 uncovered)

- line 38: 0/1 covered: `selectDeclaringConfigWriteTarget,`

## extensions/pi-claude-marketplace/orchestrators/plugin/install-outcome.ts (1 uncovered)

- line 32: 0/1 covered: `//   POST-state-commit (D-08 / AS-6):  mkdir(pluginDataDir), dropped per D-19-01`

## extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts (1 uncovered)

- line 29: 0/1 covered: `// `reinstallPlugins`: the edge handler calls it for every target form, and it`

## extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts (1 uncovered)

- line 42: 0/1 covered: `import type { AgentsReplacement, PreparedAgentsStaging } from "../../bridges/agents/index.ts";`

## extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts (1 uncovered)

- line 23: 0/1 covered: `// notification shape for "cleanup leak after a successful state mutation".`

## extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts (1 uncovered)

- line 33: 0/1 covered: `// not, so every one of them was dark on this path) and split by install's`

## extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts (1 uncovered)

- line 169: 0/1 covered: `for (const mp of Object.values(state.marketplaces)) {`

## extensions/pi-claude-marketplace/orchestrators/reconcile/pending.ts (1 uncovered)

- line 26: 0/1 covered: `// dedicated `ReconcilePendingEmptyMessage` standalone-arm variant whose`

## extensions/pi-claude-marketplace/persistence/agents-index-io.ts (1 uncovered)

- line 14: 0/1 covered: `// Wire field name `agents:`; see agents-index-schema.ts for the rationale`

## extensions/pi-claude-marketplace/persistence/agents-index-schema.ts (1 uncovered)

- line 11: 0/1 covered: `// Validators are compiled ONCE at module load (not inside loaders);`

## extensions/pi-claude-marketplace/persistence/config-io.ts (1 uncovered)

- line 14: 0/1 covered: `// bad input rather than silently coercing it to empty desired state.`

## extensions/pi-claude-marketplace/persistence/locations.ts (1 uncovered)

- line 11: 0/1 covered: `// by string concatenation; they call the methods.`

## extensions/pi-claude-marketplace/shared/atomic-json.ts (1 uncovered)

- line 13: 0/1 covered: `*   - cleans up tmp files on process crash via signal-exit hooks`

## extensions/pi-claude-marketplace/shared/fs-utils.ts (1 uncovered)

- line 18: 0/1 covered: `//   - RemovalOps / createRemovalOps: the injected `rm` + `rename` port the`

## extensions/pi-claude-marketplace/shared/session-env.ts (1 uncovered)

- line 10: 0/1 covered: `* Pure-leaf posture (mirrors `shared/debug-log.ts`): no module-level state,`

## extensions/pi-claude-marketplace/transaction/with-state-guard.ts (1 uncovered)

- line 14: 0/1 covered: `// closure -- the guard does not enforce them itself. Pattern:`
