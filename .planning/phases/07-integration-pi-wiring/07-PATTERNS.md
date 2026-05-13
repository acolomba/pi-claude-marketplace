# Phase 07: Integration & Pi Wiring - Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** 22 new/modified file groups
**Analogs found:** 21 / 22

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/index.ts` | route / entrypoint | event-driven + request-response | `extensions/pi-claude-marketplace/edge/register.ts` | role-match |
| `extensions/pi-claude-marketplace/platform/pi-api.ts` | platform wrapper | request-response | `extensions/pi-claude-marketplace/platform/git.ts` + `presentation/soft-dep.ts` | role-match |
| `extensions/pi-claude-marketplace/presentation/soft-dep.ts` | presentation shim | transform | `extensions/pi-claude-marketplace/presentation/index.ts` pattern: barrel/shim export | partial |
| `extensions/pi-claude-marketplace/orchestrators/discover.ts` | orchestrator | file-I/O transform | `extensions/pi-claude-marketplace/bridges/skills/discover.ts` + `bridges/commands/discover.ts` | data-flow-match |
| `extensions/pi-claude-marketplace/transaction/with-state-guard.ts` | transaction | CRUD + file-I/O | existing same file | exact |
| `extensions/pi-claude-marketplace/persistence/locations.ts` | persistence utility | transform / file-I/O path construction | existing same file | exact |
| `extensions/pi-claude-marketplace/shared/markers.ts` | shared constants | transform | existing same file | exact |
| `extensions/pi-claude-marketplace/shared/errors.ts` | shared errors | error propagation | existing same file | exact |
| `extensions/pi-claude-marketplace/domain/manifest.ts` | domain model / utility | file-I/O seam + validation | existing same file | role-match |
| `eslint.config.js` | config | transform / static analysis | existing same file | exact |
| `package.json` | config | dependency + script config | existing same file | exact |
| `.github/workflows/ci.yml` | CI config | batch | existing same file | exact |
| `.github/workflows/e2e-nightly.yml` | CI config | batch | `.github/workflows/ci.yml` | role-match |
| `tests/orchestrators/discover.test.ts` | test | file-I/O transform | `tests/bridges/skills/discover.test.ts` | data-flow-match |
| `tests/transaction/with-state-guard.test.ts` | test | CRUD + file-I/O | existing same file | exact |
| `tests/architecture/manifest-read-seam.test.ts` | architecture test | file-I/O / static scan | `tests/architecture/no-orchestrator-network.test.ts` | exact |
| `tests/architecture/markers-snapshot.test.ts` | architecture test | snapshot / transform | existing same file | exact |
| `tests/integration/concurrent-install.test.ts` | integration test | batch + multi-process file-I/O | `tests/transaction/with-state-guard.test.ts` + `tests/edge/handlers/plugin/install.test.ts` | partial |
| `tests/e2e/_pinned-sha.ts` | test fixture constant | config | `shared/markers.ts` constant export style | partial |
| `tests/e2e/_targets.ts` | test fixture config | config / transform | `tests/edge/register.test.ts` mock-fixture interface style | partial |
| `tests/e2e/_fixtures/<sha>/**` | test fixture data | file-I/O | `tests/bridges/_fixtures/**` usage in bridge tests | role-match |
| `tests/e2e/*.test.ts` | e2e test | request-response + file-I/O | `tests/edge/register.test.ts` + `tests/edge/handlers/plugin/install.test.ts` | role-match |
| `REQUIREMENTS.md` / `PROJECT.md` / `CHANGELOG.md` | docs | transform | Phase supersession docs patterns from context | no-code-analog |

## Pattern Assignments

### `extensions/pi-claude-marketplace/index.ts` (route / entrypoint, event-driven + request-response)

**Analog:** `extensions/pi-claude-marketplace/edge/register.ts`

**Imports pattern** (lines 35-56):
```typescript
import { makeLocationsResolver } from "../orchestrators/edge-deps.ts";

import {
  isClaudePluginCommandLine,
  normalizeCompletionWhitespace,
} from "./completions/normalize.ts";
import { registerListMarketplacesTool, registerListPluginsTool } from "./handlers/tools.ts";
import { routeClaudePlugin } from "./router.ts";

import type { SubcommandHandlers } from "./router.ts";
import type { EdgeDeps } from "./types.ts";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
```

**Registration core pattern** (lines 72-94):
```typescript
export function registerClaudePluginCommand(pi: ExtensionAPI, deps: EdgeDeps): void {
  const handlers: SubcommandHandlers = {
    install: makeInstallHandler(pi),
    uninstall: makeUninstallHandler(pi),
    update: makeUpdateHandler(pi),
    list: makeListHandler(),
    marketplaceAdd: makeAddHandler(deps),
    marketplaceRemove: makeRemoveHandler(pi),
    marketplaceList: handleMarketplaceList,
    marketplaceUpdate: makeMarketplaceUpdateHandler(deps),
    marketplaceAutoupdate: makeAutoupdateHandler(true),
    marketplaceNoautoupdate: makeAutoupdateHandler(false),
  };

  pi.registerCommand("claude:plugin", {
    description: COMMAND_DESCRIPTION,
    handler: (args, ctx) => routeClaudePlugin(args, handlers, ctx),
    getArgumentCompletions: (prefix) =>
      getArgumentCompletions(prefix, makeLocationsResolver(process.cwd())),
  });
```

**Event registration pattern** (lines 101-117):
```typescript
pi.on("session_start", (_event, ctx) => {
  ctx.ui.addAutocompleteProvider((current) => ({
    getSuggestions: (lines, line, col, options) =>
      current.getSuggestions(lines, line, col, options),
    applyCompletion: (lines, line, col, item, prefix) => {
      const result = current.applyCompletion(lines, line, col, item, prefix);
      const original = lines[line] ?? "";
      if (!isClaudePluginCommandLine(original)) {
        return result;
      }

      return normalizeCompletionWhitespace(result);
    },
    shouldTriggerFileCompletion: (lines, line, col) =>
      current.shouldTriggerFileCompletion?.(lines, line, col) ?? true,
  }));
});
```

**Apply to Phase 7:** replace stub lines 25-43 in `index.ts` with a thin function that imports `homedir`, `locationsFor`, `aggregateDiscoveredResources`, `DEFAULT_GIT_OPS`, `updateSinglePlugin`, and the two registration helpers. The `resources_discover` handler should be registered before or after command/tool helpers, but keep the body a shim only.

---

### `extensions/pi-claude-marketplace/platform/pi-api.ts` (platform wrapper, request-response)

**Analogs:** `platform/git.ts`, `presentation/soft-dep.ts`

**Platform wrapper import/export style** from `platform/git.ts` (lines 1-5, 31-43, 98-107):
```typescript
import * as fs from "node:fs";

import * as git from "isomorphic-git";
import http from "isomorphic-git/http/node";

export interface CloneOptions {
  dir: string;
  url: string;
  ref?: string;
  singleBranch?: boolean;
}

export async function clone(opts: CloneOptions): Promise<void> {
  await git.clone({
    fs,
    http,
    dir: opts.dir,
    url: opts.url,
    ...(opts.ref !== undefined && { ref: opts.ref }),
    ...(opts.singleBranch !== undefined && { singleBranch: opts.singleBranch }),
  });
}
```

**Soft-dep helper pattern to move** from `presentation/soft-dep.ts` (lines 24-39, 53-66):
```typescript
import { PI_MCP_ADAPTER_NOT_LOADED, PI_SUBAGENTS_NOT_LOADED } from "../shared/markers.ts";

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export function hasLoadedPiSubagents(pi: ExtensionAPI): boolean {
  try {
    return pi.getAllTools().some((tool) => tool.name === "subagent");
  } catch {
    return false;
  }
}

export function hasLoadedPiMcpAdapter(pi: ExtensionAPI): boolean {
  try {
    return pi.getAllTools().some((tool) => {
      if (tool.name === "mcp") {
        return true;
      }

      const src: unknown = tool.sourceInfo.source;
      return typeof src === "string" && src.includes("pi-mcp-adapter");
    });
  } catch {
    return false;
  }
}
```

**Apply to Phase 7:** `platform/pi-api.ts` is the only direct `@mariozechner/pi-coding-agent` import. Re-export types (`ExtensionAPI`, `ExtensionContext`, `ExtensionCommandContext`, `AutocompleteItem`, `ResourcesDiscoverEvent`, `ResourcesDiscoverResult`, `ToolDefinition`, `ToolInfo`; alias `Tool` only if needed). Move the helper implementations here; keep warning composers if callsites expect them, or export a `softDepStatus` wrapper as locked by context.

---

### `extensions/pi-claude-marketplace/presentation/soft-dep.ts` (presentation shim, transform)

**Analog:** one-line re-export shim required by D-03.

**Current body to replace** (lines 24-99): direct marker imports, direct peer type import, helper implementations, and warning composers.

**Target pattern:**
```typescript
export {
  hasLoadedPiMcpAdapter,
  hasLoadedPiSubagents,
  mcpAdapterWarningIfNeeded,
  softDepStatus,
  subagentWarningIfNeeded,
} from "../platform/pi-api.ts";
```

Keep only the exports that exist after the wrapper move. This preserves existing Phase 4/5 callsites.

---

### `extensions/pi-claude-marketplace/orchestrators/discover.ts` (orchestrator, file-I/O transform)

**Analogs:** `bridges/skills/discover.ts`, `bridges/commands/discover.ts`

**Imports pattern** from `bridges/skills/discover.ts` (lines 22-30):
```typescript
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import { assertSafeName, generatedSkillName } from "../../domain/name.ts";

import type { DiscoveredSkill } from "./types.ts";
import type { ResolvedPluginInstallable } from "../../domain/resolver.ts";
import type { Dirent } from "node:fs";
```

**ENOENT handling pattern** from `bridges/skills/discover.ts` (lines 75-85):
```typescript
let entries: Dirent[];
try {
  entries = await readdir(skillsDir, { withFileTypes: true, encoding: "utf8" });
} catch (err) {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === "ENOENT" || code === "ENOTDIR") {
    continue;
  }

  throw err;
}
```

**Deterministic disk walk pattern** from `bridges/commands/discover.ts` (lines 70-90):
```typescript
const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

for (const entry of sorted) {
  if (entry.name.startsWith(".")) {
    continue;
  }

  if (!entry.isFile()) {
    continue;
  }

  if (!entry.name.endsWith(".md")) {
    continue;
  }

  const full = path.join(commandsDir, entry.name);
  const stat = await lstat(full);
```

**Return-freeze pattern** from `bridges/skills/discover.ts` (lines 149-152):
```typescript
return {
  discovered: Object.freeze([...seenByGenerated.values()]),
  warnings: Object.freeze(warnings),
};
```

**Apply to Phase 7:** write small helpers such as `readSkillPaths(loc)` and `readPromptPaths(loc)`. Treat `ENOENT` and `ENOTDIR` as empty. Collect all other per-scope/per-kind errors, attempt both scopes, then throw `AggregateResourcesDiscoverError` if any occurred. Sort output for stable tests. No state.json reads.

---

### `extensions/pi-claude-marketplace/transaction/with-state-guard.ts` (transaction, CRUD + file-I/O)

**Analog:** existing same file.

**Current critical section** (lines 52-60):
```typescript
export async function withStateGuard<T>(
  locations: ScopedLocations,
  mutate: (state: ExtensionState) => Promise<T> | T,
): Promise<T> {
  const fresh = await loadState(locations.extensionRoot);
  const result = await mutate(fresh);
  await saveState(locations.extensionRoot, fresh);
  return result;
}
```

**Apply to Phase 7:** acquire `proper-lockfile.lock(locations.extensionRoot, { lockfilePath: stateLockFile(locations), realpath: false, retries: 0, stale: 10_000, update: 2_000 })` before `loadState`, release in `finally`. Wrap lock-acquisition failures in `StateLockHeldError`; do not change the public signature or caller contracts.

---

### `extensions/pi-claude-marketplace/persistence/locations.ts` (persistence utility, path construction)

**Analog:** existing same file.

**Path field pattern** (lines 117-132):
```typescript
const extensionRoot = path.join(scopeRoot, "pi-claude-marketplace");
const stateJsonPath = path.join(extensionRoot, "state.json");
const agentsDir = path.join(scopeRoot, "agents");
const agentsStagingDir = path.join(extensionRoot, "agents-staging");
const agentsIndexPath = path.join(extensionRoot, "agents-index.json");
const mcpJsonPath = path.join(scopeRoot, "mcp.json");
const skillsStagingDir = path.join(extensionRoot, "skills-staging");
const commandsStagingDir = path.join(extensionRoot, "commands-staging");
const skillsTargetDir = path.join(extensionRoot, "resources", "skills");
const promptsTargetDir = path.join(extensionRoot, "resources", "prompts");
```

**Method-helper containment pattern** (lines 201-210):
```typescript
async pluginCacheFile(marketplace: string): Promise<string> {
  assertSafeName(marketplace, `pluginCacheFile marketplace name "${marketplace}"`);
  const candidate = path.join(cacheDir, "plugins", `${marketplace}.json`);
  await assertPathInside(cacheDir, candidate, `pluginCacheFile(${marketplace})`);
  return candidate;
},
```

**Apply to Phase 7:** add a `readonly stateLockFile: string` or `stateLockFile(loc): string` helper for `<scopeRoot>/pi-claude-marketplace/.state-lock`. If helper is async, use `assertPathInside(extensionRoot, candidate, ...)`; if field is sync, follow existing hard-coded suffix rationale.

---

### `extensions/pi-claude-marketplace/shared/markers.ts` and `shared/errors.ts` (shared constants/errors)

**Analog:** existing same files.

**Marker extension pattern** from `markers.ts` (lines 15-26):
```typescript
/**
 * PUP-6 recovery hint (Phase 5 extension beyond ES-5).
 *
 * Stable user-contract prefix. The runtime caller in
 * `orchestrators/plugin/update.ts` appends ` "${pluginName}".` after this
 * prefix to compose the final user-visible hint.
 */
export const RECOVERY_PLUGIN_REINSTALL_PREFIX = "plugin-uninstall + plugin-install for";
```

**Error class pattern** from `errors.ts` (lines 120-128):
```typescript
export class ConcurrentInstallError extends Error {
  readonly plugin: string;
  readonly marketplace: string;
  constructor(plugin: string, marketplace: string) {
    super(`Plugin "${plugin}" was installed concurrently in marketplace "${marketplace}".`);
    this.name = "ConcurrentInstallError";
    this.plugin = plugin;
    this.marketplace = marketplace;
  }
}
```

**Aggregate error pattern** from `errors.ts` (lines 166-172):
```typescript
export class PluginUpdatePhase3Error extends Error {
  readonly failures: readonly Phase3Failure[];
  constructor(message: string, failures: readonly Phase3Failure[], options?: ErrorOptions) {
    super(message, options);
    this.name = "PluginUpdatePhase3Error";
    this.failures = failures;
  }
}
```

**Apply to Phase 7:** add `STATE_LOCK_HELD_PREFIX = "Another pi-claude-marketplace operation is in progress for"`; add `StateLockHeldError` carrying scope/path; add `AggregateResourcesDiscoverError` carrying per-scope failures and `cause` chain.

---

### `extensions/pi-claude-marketplace/domain/manifest.ts` (domain model / file-I/O seam)

**Analog:** existing same file plus architecture test pattern.

**TypeBox import/validator style** (lines 11-37):
```typescript
import Type from "typebox";
import { Compile } from "typebox/compile";

import { PLUGIN_ENTRY_SCHEMA } from "./components/plugin.ts";

export const MARKETPLACE_SCHEMA = Type.Object({
  name: Type.String(),
  plugins: Type.Array(PLUGIN_ENTRY_SCHEMA),
  strict: Type.Optional(Type.Boolean()),
  owner: Type.Optional(
    Type.Object({
      name: Type.String(),
    }),
  ),
});

export type MarketplaceManifest = Type.Static<typeof MARKETPLACE_SCHEMA>;
export const MARKETPLACE_VALIDATOR = Compile(MARKETPLACE_SCHEMA);
```

**Apply to Phase 7:** add `loadMarketplaceManifest(manifestPath: string): Promise<MarketplaceManifest>` here, using `readFile` + `JSON.parse` + `MARKETPLACE_VALIDATOR.Parse` or equivalent existing validator convention. Migrate every manifest-path `readFile(...marketplace.json...)` caller to this seam before enabling `manifest-read-seam.test.ts`.

---

## Test Pattern Assignments

### `tests/orchestrators/discover.test.ts` (test, file-I/O transform)

**Analog:** `tests/bridges/skills/discover.test.ts`

**Tmpdir + cleanup pattern** (lines 94-113):
```typescript
test("discoverPluginSkills skips dotfile-prefixed directories", async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "discover-dotfiles-"));
  try {
    const skillsDir = path.join(tmp, "skills");
    await mkdir(skillsDir, { recursive: true });
    await mkdir(path.join(skillsDir, ".hidden"));
    await writeFile(path.join(skillsDir, ".hidden", "SKILL.md"), "---\nname: x\n---\nbody");
    await mkdir(path.join(skillsDir, "visible"));
    await writeFile(path.join(skillsDir, "visible", "SKILL.md"), "---\nname: visible\n---\nbody");

    const resolved = makeResolved(tmp, skillsDir);
    const { discovered } = await discoverPluginSkills({ pluginName: "acme", resolved });
    assert.equal(discovered.length, 1);
  } finally {
    await cleanupStaging(tmp, "test-cleanup");
  }
});
```

**ENOENT test pattern** (lines 76-85):
```typescript
test("SK-5 discoverPluginSkills returns [] when skills dir missing (ENOENT graceful)", async () => {
  const pluginRoot = path.join(FIXTURES, "empty-mcp");
  const skillsDir = path.join(pluginRoot, "skills");
  const resolved = makeResolved(pluginRoot, skillsDir);

  const { discovered, warnings } = await discoverPluginSkills({ pluginName: "acme", resolved });
  assert.deepEqual([...discovered], []);
  assert.deepEqual([...warnings], []);
});
```

**Apply to Phase 7:** create real staged resource directories under `locationsFor("project", tmp).skillsTargetDir` / `promptsTargetDir`; assert sorted paths; assert missing dirs return empty; chmod/symlink error cases may need platform skips.

---

### `tests/edge/register.test.ts` and `tests/e2e/*.test.ts` (mock Pi / e2e registration)

**Analog:** `tests/edge/register.test.ts`

**Mock Pi pattern** (lines 42-70):
```typescript
interface MockPi {
  pi: ExtensionAPI;
  commands: Map<string, RegisteredCommand>;
  tools: Map<string, RegisteredTool>;
  events: Map<string, ((event: unknown, ctx: ExtensionContext) => unknown)[]>;
}

function makeMockPi(): MockPi {
  const commands = new Map<string, RegisteredCommand>();
  const tools = new Map<string, RegisteredTool>();
  const events = new Map<string, ((event: unknown, ctx: ExtensionContext) => unknown)[]>();

  const pi = {
    registerCommand: (name: string, options: RegisteredCommand): void => {
      commands.set(name, options);
    },
    registerTool: (tool: RegisteredTool): void => {
      tools.set(tool.name, tool);
    },
    on: (event: string, handler: (event: unknown, ctx: ExtensionContext) => unknown): void => {
      const list = events.get(event) ?? [];
      list.push(handler);
      events.set(event, list);
    },
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;

  return { pi, commands, tools, events };
}
```

**Registration assertions** (lines 96-109, 291-313):
```typescript
test("D-04 :: registerClaudePluginCommand registers claude:plugin command on pi", () => {
  const { pi, commands } = makeMockPi();
  registerClaudePluginCommand(pi, makeDeps());

  assert.equal(commands.size, 1, "exactly one registered command");
  assert.ok(commands.has("claude:plugin"), "command name is claude:plugin");
});

test("D-04 :: registerClaudeMarketplaceTools calls pi.registerTool exactly twice", () => {
  const { pi, tools } = makeMockPi();
  registerClaudeMarketplaceTools(pi);

  assert.equal(tools.size, 2, "exactly two tools registered");
});
```

**Apply to Phase 7:** Layer A e2e imports `index.ts`, calls default export with this mock, then drives `commands.get("claude:plugin")!.handler(...)`, tool `execute(...)`, and `events.get("resources_discover")![0](...)` against real tmp HOME/cwd and pinned upstream fixtures.

---

### `tests/edge/handlers/plugin/install.test.ts` and `tests/integration/concurrent-install.test.ts` (hermetic process/env tests)

**Analog:** `tests/edge/handlers/plugin/install.test.ts`

**Hermetic HOME/cwd pattern** (lines 50-67):
```typescript
async function withHermeticHome<T>(fn: (env: { cwd: string }) => Promise<T>): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "install-shim-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "install-shim-cwd-"));
  process.env.HOME = home;
  try {
    return await fn({ cwd });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    await rm(home, { recursive: true, force: true });
    await rm(cwd, { recursive: true, force: true });
  }
}
```

**Notification capture pattern** (lines 31-42):
```typescript
function makeCtx(cwd: string): { ctx: ExtensionCommandContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    cwd,
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as unknown as ExtensionCommandContext;
  return { ctx, notifications };
}
```

**Apply to Phase 7:** for forked children, pass isolated env (`HOME`, `PI_SCOPE_ROOT_OVERRIDE` if implemented, cwd) explicitly to `child_process.fork`. The child script should report success/error via IPC rather than stdout, matching the no-shell-output discipline.

---

### `tests/transaction/with-state-guard.test.ts` (test, CRUD + file-I/O)

**Analog:** existing same file.

**Tmp scope setup** (lines 33-43):
```typescript
async function setupTmpScope(): Promise<TmpScope> {
  const tmp = await mkdtemp(path.join(tmpdir(), "pi-cm-guard-test-"));
  const loc = locationsFor("project", tmp);
  await mkdir(loc.extensionRoot, { recursive: true });
  return {
    loc,
    cleanup: async (): Promise<void> => {
      await rm(tmp, { recursive: true, force: true });
    },
  };
}
```

**Throw path assertion** (lines 99-128):
```typescript
await assert.rejects(
  () =>
    withStateGuard(loc, (state) => {
      const existing = state.marketplaces.mp1?.plugins.p1;
      if (existing) {
        state.marketplaces.mp1!.plugins.p2 = existing;
      }

      throw new Error("simulated mid-mutation failure");
    }),
  /simulated mid-mutation failure/,
);
const onDisk = await readOnDisk(loc.stateJsonPath);
assert.equal(onDisk.marketplaces.mp1?.plugins.p2, undefined);
```

**Apply to Phase 7:** extend with lock acquired/released, lock-held fail-fast, mutate throws releases, save throws releases. Use `proper-lockfile.lock(loc.extensionRoot, { lockfilePath: stateLockFile(loc), realpath: false })` in the test to pre-hold a lock when asserting `StateLockHeldError`.

---

### `tests/architecture/manifest-read-seam.test.ts` (architecture test, static scan)

**Analog:** `tests/architecture/no-orchestrator-network.test.ts`

**Repo-root + readFile pattern** (lines 1-8, 58-76):
```typescript
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

for (const rel of FORBIDDEN_TARGETS) {
  let src: string;
  try {
    src = await readFile(path.join(REPO_ROOT, rel), "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      continue;
    }

    throw err;
  }
```

**Comment stripping + offender reporting** (lines 52-56, 76-88):
```typescript
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const stripped = stripComments(src);
for (const { name, pattern } of FORBIDDEN_PATTERNS) {
  if (pattern.test(stripped)) {
    offenders.push(`${rel} matches forbidden ${name}: ${String(pattern)}`);
  }
}

assert.deepEqual(offenders, [], `...${offenders.join("\n  ")}...`);
```

**Apply to Phase 7:** scan `extensions/pi-claude-marketplace/**/*.ts` excluding `domain/manifest.ts`; assert no stripped source has `readFile`/`fs.readFile` call context containing `marketplace.json`. Reuse explicit offender messages.

---

### `tests/architecture/markers-snapshot.test.ts` (snapshot test, transform)

**Analog:** existing same file.

**Phase extension marker pattern** (lines 96-110):
```typescript
/**
 * PUP-6 recovery-hint prefix (Phase 5 extension beyond ES-5).
 *
 * D-04: This constant is INTENTIONALLY excluded from the 5-row ES-5 literals
 * table above (its `literals.length === 5` assertion remains untouched).
 */
test("PUP-6 recovery-hint prefix is byte-for-byte 'plugin-uninstall + plugin-install for'", () => {
  assert.equal(markers.RECOVERY_PLUGIN_REINSTALL_PREFIX, "plugin-uninstall + plugin-install for");
});
```

**Apply to Phase 7:** add a separate test for `STATE_LOCK_HELD_PREFIX` without changing the original ES-5 count until the PRD is amended.

---

## Config and CI Pattern Assignments

### `eslint.config.js` (config, static analysis)

**Analog:** existing same file.

**Scoped rule block pattern** (lines 124-245):
```javascript
{
  // BLOCK C (D-11): Import-direction enforcement.
  files: ["extensions/pi-claude-marketplace/**/*.ts"],
  rules: {
    "import-x/no-restricted-paths": [
      "error",
      {
        basePath: import.meta.dirname,
        zones: [
          {
            target: "./extensions/pi-claude-marketplace/edge",
            from: [
              "./extensions/pi-claude-marketplace/bridges",
              "./extensions/pi-claude-marketplace/domain",
              "./extensions/pi-claude-marketplace/transaction",
              "./extensions/pi-claude-marketplace/persistence",
              "./extensions/pi-claude-marketplace/platform",
            ],
            message: "edge/ may only import from orchestrators/, presentation/, shared/.",
          },
        ],
      },
    ],
  },
}
```

**Test override pattern** (lines 253-266):
```javascript
{
  files: ["tests/**/*.ts"],
  rules: {
    "@typescript-eslint/no-floating-promises": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-unnecessary-condition": "off",
    "@typescript-eslint/dot-notation": "off",
    "no-restricted-syntax": "off",
    "no-console": "off",
  },
}
```

**Apply to Phase 7:** add `no-restricted-imports` for `@mariozechner/pi-coding-agent` in extension files. Exempt `extensions/pi-claude-marketplace/platform/pi-api.ts` and tests. Keep direct peer imports in tests allowed.

---

### `package.json` (config, dependency + scripts)

**Analog:** existing same file.

**Current dependency/script shape** (lines 5-22, 35-52):
```json
"dependencies": {
  "isomorphic-git": "^1.37.6",
  "write-file-atomic": "^8.0.0"
},
"devDependencies": {
  "@mariozechner/pi-coding-agent": "^0.73.1",
  "@types/write-file-atomic": "^4.0.3"
},
"peerDependencies": {
  "@mariozechner/pi-coding-agent": ">=0.70.6",
  "typebox": "*"
},
"scripts": {
  "check": "npm run typecheck && npm run lint && npm run format:check && npm test",
  "test": "node --test \"tests/**/*.test.ts\"",
  "test:integration": "node --test \"tests/integration/**/*.test.ts\"",
  "typecheck": "tsc --noEmit"
}
```

**Apply to Phase 7:** add runtime `proper-lockfile`, dev `@types/proper-lockfile`, peer floor `@mariozechner/pi-coding-agent: >=0.73.1`, narrow `test` to unit dirs, and add `test:e2e` / `test:e2e:nightly` scripts.

---

### `.github/workflows/ci.yml` and `.github/workflows/e2e-nightly.yml` (CI config, batch)

**Analog:** `.github/workflows/ci.yml`

**Workflow structure** (lines 1-11, 24-44):
```yaml
name: CI

on:
  push:
    branches:
      - main
      - features/**
  pull_request:
    branches:
      - main

jobs:
  check:
    name: npm run check (Node 24)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node 24
        uses: actions/setup-node@v4
        with:
          node-version: "24"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run full check pipeline
        run: npm run check
```

**Apply to Phase 7:** extend CI with `npm run test:integration`, `npm run test:e2e`, and `npm pack --dry-run`. New nightly workflow should reuse checkout/setup/npm ci, add `schedule` + `workflow_dispatch`, and run `npm run test:e2e:nightly`; failure classification can be implemented in the test script/output but the workflow should keep the separate nightly surface.

---

## Shared Patterns

### Import ordering and type imports

**Source:** `edge/register.ts` lines 35-56 and `bridges/skills/discover.ts` lines 22-30.
**Apply to:** all new TypeScript files.
```typescript
import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import { something } from "../domain/name.ts";

import type { SomeType } from "../domain/resolver.ts";
import type { Dirent } from "node:fs";
```

### Error handling for missing filesystem paths

**Source:** `bridges/skills/discover.ts` lines 75-85.
**Apply to:** `orchestrators/discover.ts`, fixture readers where appropriate.
```typescript
try {
  entries = await readdir(skillsDir, { withFileTypes: true, encoding: "utf8" });
} catch (err) {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === "ENOENT" || code === "ENOTDIR") {
    continue;
  }

  throw err;
}
```

### Stable exported constants and marker tests

**Source:** `shared/markers.ts` lines 15-26; `tests/architecture/markers-snapshot.test.ts` lines 96-110.
**Apply to:** `STATE_LOCK_HELD_PREFIX`.
```typescript
export const RECOVERY_PLUGIN_REINSTALL_PREFIX = "plugin-uninstall + plugin-install for";

test("PUP-6 recovery-hint prefix is byte-for-byte 'plugin-uninstall + plugin-install for'", () => {
  assert.equal(markers.RECOVERY_PLUGIN_REINSTALL_PREFIX, "plugin-uninstall + plugin-install for");
});
```

### Hermetic tmp HOME/cwd tests

**Source:** `tests/edge/handlers/plugin/install.test.ts` lines 50-67.
**Apply to:** e2e, integration, and subprocess smoke.
```typescript
const originalHome = process.env.HOME;
const home = await mkdtemp(path.join(tmpdir(), "install-shim-home-"));
const cwd = await mkdtemp(path.join(tmpdir(), "install-shim-cwd-"));
process.env.HOME = home;
try {
  return await fn({ cwd });
} finally {
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  await rm(home, { recursive: true, force: true });
  await rm(cwd, { recursive: true, force: true });
}
```

### Architecture scan tests

**Source:** `tests/architecture/no-orchestrator-network.test.ts` lines 52-88.
**Apply to:** manifest read seam and peer-import boundary tests.
```typescript
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

assert.deepEqual(offenders, [], `NFR violation:\n  ${offenders.join("\n  ")}`);
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `REQUIREMENTS.md` / `PROJECT.md` / `CHANGELOG.md` supersession edits | docs | transform | No source-code analog read in this pass; use Phase 1/4/5 supersession precedent named in `07-CONTEXT.md`. |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/**/*.ts`, `tests/**/*.test.ts`, `.github/workflows/*.yml`, `eslint.config.js`, `package.json`
**Files scanned:** 200+ via glob; 21 source/test/config analogs read
**Pattern extraction date:** 2026-05-11
