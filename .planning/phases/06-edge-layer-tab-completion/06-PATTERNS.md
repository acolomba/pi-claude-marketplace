# Phase 6: Edge Layer & Tab Completion - Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** ~30 new + 5 modified
**Analogs found:** 28 / 30 (2 novel: `shared/completion-cache.ts`, `tests/edge/register.test.ts`)

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `edge/router.ts` | router | request-response | `git show features/initial:extensions/claude-marketplace/commands/router.ts` | exact (V1 port verbatim, notify routing changes) |
| `edge/args.ts` | parser | transform | `git show features/initial:extensions/claude-marketplace/args.ts` | exact (V1 port verbatim, import path only) |
| `edge/args-schema.ts` | parser | transform | `git show features/initial:extensions/claude-marketplace/commands/_args.ts` | exact (V1 port verbatim, import paths) |
| `edge/types.ts` | types | -- | `orchestrators/types.ts` | role-match (cross-module types module) |
| `edge/register.ts` | registration | event-driven | `git show features/initial:extensions/claude-marketplace/index.ts` (V1 entrypoint) | role-match (V1 was monolithic; new is two helpers) |
| `edge/completions/provider.ts` | completion dispatcher | request-response | `git show features/initial:extensions/claude-marketplace/index.ts` (getArgumentCompletions block) | exact (port verbatim with cache-backed accessors) |
| `edge/completions/data.ts` | accessor | read-through | `git show features/initial:extensions/claude-marketplace/completions.ts` (load* helpers) | role-match (V1 loaders replaced by cache reads) |
| `edge/completions/normalize.ts` | utility | transform | `git show features/initial:extensions/claude-marketplace/completions.ts::normalizeCompletionWhitespace` | exact (V1 port verbatim) |
| `edge/handlers/plugin/install.ts` | handler (shim) | request-response | `orchestrators/plugin/install.ts` (caller-side) + Pattern 1 in RESEARCH.md | role-match (thin shim wrapper) |
| `edge/handlers/plugin/uninstall.ts` | handler (shim) | request-response | `orchestrators/plugin/uninstall.ts` (callee) | role-match |
| `edge/handlers/plugin/update.ts` | handler (shim) | request-response | `orchestrators/plugin/update.ts` (callee) | role-match |
| `edge/handlers/plugin/list.ts` | handler (shim) | request-response | `orchestrators/plugin/list.ts` (callee) | role-match |
| `edge/handlers/marketplace/add.ts` | handler (shim) | request-response | `orchestrators/marketplace/add.ts` (callee) | role-match |
| `edge/handlers/marketplace/remove.ts` | handler (shim) | request-response | `orchestrators/marketplace/remove.ts` (callee) | role-match |
| `edge/handlers/marketplace/list.ts` | handler (shim) | request-response | `orchestrators/marketplace/list.ts` (callee; also V1 `handleMarketplaceList`) | exact |
| `edge/handlers/marketplace/update.ts` | handler (shim) | request-response | `orchestrators/marketplace/update.ts` (callee) | role-match |
| `edge/handlers/marketplace/autoupdate.ts` | handler (shim, dual-form) | request-response | `orchestrators/marketplace/autoupdate.ts` (callee) | role-match |
| `edge/handlers/tools.ts` | LLM tool registration | request-response | `git show features/initial:extensions/claude-marketplace/commands/list-marketplaces.ts` | exact (V1 port + filter params) |
| `shared/completion-cache.ts` | cache module | read-through + invalidation | `shared/atomic-json.ts` (atomic I/O) + `persistence/state-io.ts` (read+validate+rebuild) | novel composite |
| `persistence/locations.ts` (extension) | path helper | -- | existing `pluginDataDir`/`marketplaceDataDir`/`sourceCloneDir` method pattern | exact (in-place additive) |
| `orchestrators/marketplace/add.ts` (edit) | orchestrator | + cache-invalidation hook | existing post-state-commit window in same file (after `withStateGuard` at line 108) | exact (in-place edit) |
| `orchestrators/marketplace/remove.ts` (edit) | orchestrator | + cache-invalidation hook | existing post-state-commit window in same file (after guard at line 148, before line 152 cleanup) | exact |
| `orchestrators/marketplace/update.ts` (edit) | orchestrator | + cache-invalidation hook | existing post-state-commit window | exact |
| `orchestrators/plugin/install.ts` (edit) | orchestrator | + cache-invalidation hook | existing post-state-commit window (after `mkdir(installCtx.pluginDataDir)` at line ~587) | exact |
| `orchestrators/plugin/uninstall.ts` (edit) | orchestrator | + cache-invalidation hook | existing post-state-commit window | exact |
| `tests/edge/router.test.ts` | test | -- | `tests/orchestrators/marketplace/list.test.ts` (pure-unit scaffold) | role-match |
| `tests/edge/args.test.ts` | test | -- | `tests/orchestrators/marketplace/list.test.ts` | role-match |
| `tests/edge/args-schema.test.ts` | test | -- | `tests/orchestrators/marketplace/list.test.ts` | role-match |
| `tests/edge/completions/provider.test.ts` | test | -- | `tests/orchestrators/plugin/install.test.ts` (hermetic FS) | role-match |
| `tests/edge/completions/data.test.ts` | test | -- | `tests/orchestrators/plugin/install.test.ts` | role-match |
| `tests/edge/completions/normalize.test.ts` | test | -- | `tests/orchestrators/marketplace/list.test.ts` (pure-unit) | role-match |
| `tests/edge/handlers/plugin/*.test.ts` | test | -- | `tests/orchestrators/plugin/install.test.ts` + spy on orchestrator | role-match |
| `tests/edge/handlers/marketplace/*.test.ts` | test | -- | `tests/orchestrators/marketplace/list.test.ts` + spy on orchestrator | role-match |
| `tests/edge/handlers/tools.test.ts` | test | -- | `tests/orchestrators/plugin/install.test.ts` (hermetic FS, mock pi) | role-match |
| `tests/edge/register.test.ts` | test | -- | `tests/orchestrators/plugin/install.test.ts` (mock pi pattern) | role-match (novel: pi as mutating spy) |
| `tests/shared/completion-cache.test.ts` | test | -- | `tests/shared/atomic-json.test.ts` + `tests/orchestrators/plugin/install.test.ts` (hermetic FS) | role-match |
| `tests/orchestrators/marketplace/{add,remove,update}.test.ts` (edit) | test | -- | existing same-file tests; add one "cache invalidated" assertion each | in-place additive |
| `tests/orchestrators/plugin/{install,uninstall}.test.ts` (edit) | test | -- | existing same-file tests; add one "cache invalidated" assertion each | in-place additive |

## Pattern Assignments

### `edge/router.ts` (router, request-response)

**Analog:** `git show features/initial:extensions/claude-marketplace/commands/router.ts`

**Port verbatim with two refinements:**

1. Replace `ctx.ui.notify(..., "error")` direct calls with `notifyUsageError(ctx, message, usageBlock)` -- BLOCK A ESLint rule forbids direct notify in `edge/`.
2. The blank-line separator between the per-line error message ("Unknown subcommand: …") and the Usage block is **explicit** in the `notifyUsageError` helper (renders `${message}\n\n${usageBlock}`); V1 used a single `\n`. RESEARCH.md §V1 Source Extracts → router.ts confirms this.

**Imports pattern (V1 verbatim modulo notify path):**
```typescript
import { notifyUsageError } from "../shared/notify.ts";
import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
```

**`SubcommandHandlers` interface (V1 verbatim):**
```typescript
export interface SubcommandHandlers {
  install: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  uninstall: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  update: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  list: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceAdd: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceRemove: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceList: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceUpdate: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceAutoupdate: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  marketplaceNoautoupdate: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
}
```

**Usage consts (V1 verbatim -- AP-3 carry-forward):**
```typescript
const TOP_LEVEL_USAGE =
  "Usage: /claude:plugin <install|uninstall|update|list|marketplace> ...\n" +
  "  install <plugin>@<marketplace> [--scope user|project]\n" +
  "  uninstall <plugin>@<marketplace> [--scope user|project]\n" +
  "  update [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]\n" +
  "  list [<marketplace>] [--scope user|project]\n" +
  "  marketplace <add|remove|list|update|autoupdate|noautoupdate> ...";

const MARKETPLACE_USAGE =
  "Usage: /claude:plugin marketplace <add|remove|list|update|autoupdate|noautoupdate> ...\n" +
  "  add <source> [--scope user|project]\n" +
  "  remove <name> [--scope user|project]   (alias: rm)\n" +
  "  list [--scope user|project]\n" +
  "  update [<name>] [--scope user|project]\n" +
  "  autoupdate [<name>] [--scope user|project]\n" +
  "  noautoupdate [<name>] [--scope user|project]";
```

**Core routing pattern (V1 verbatim modulo notify):**
```typescript
function peelToken(args: string): [string, string] {
  const trimmed = args.trimStart();
  if (trimmed === "") return ["", ""];
  const match = /\s+/.exec(trimmed);
  if (match === null) return [trimmed, ""];
  return [trimmed.slice(0, match.index), trimmed.slice(match.index + match[0].length)];
}

export async function routeClaudePlugin(
  args: string,
  handlers: SubcommandHandlers,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const [head, rest] = peelToken(args);
  if (head === "") {
    notifyUsageError(ctx, "Usage error.", TOP_LEVEL_USAGE);  // or pass message="" -- planner picks
    return;
  }
  switch (head) {
    case "install": return handlers.install(rest, ctx);
    case "uninstall": return handlers.uninstall(rest, ctx);
    case "update": return handlers.update(rest, ctx);
    case "list": return handlers.list(rest, ctx);
    case "marketplace": return routeMarketplace(rest, handlers, ctx);
    default:
      notifyUsageError(ctx, `Unknown subcommand: "${head}".`, TOP_LEVEL_USAGE);
      return;
  }
}
```

The `routeMarketplace` accepts `case "remove": case "rm":` aliasing -- TC-2 accepts `rm` in the router but does NOT surface it in completions (the `MARKETPLACE_SUBCOMMANDS` array used by completions excludes `rm`).

---

### `edge/args.ts` (parser, transform)

**Analog:** `git show features/initial:extensions/claude-marketplace/args.ts`

**Port verbatim** -- only the import of `Scope` changes (`./types.ts` → `../shared/types.ts`). See RESEARCH.md §V1 Source Extracts → args.ts (lines 524-569) for the entire body. AP-1 tokenizer + AP-2/AP-4 `--scope` validation flow with `throw new Error(...)` on missing/invalid value; the caller (`parseCommandArgs`) catches and routes through `notifyError`.

```typescript
// edge/args.ts (V1 verbatim modulo import path)
import type { Scope } from "../shared/types.ts";

export interface ParsedArgs {
  positional: string[];
  scope?: Scope;
}

export function parseArgs(args: string): ParsedArgs { /* V1 body */ }
function tokenize(input: string): string[] { /* V1 body */ }
```

---

### `edge/args-schema.ts` (parser, transform)

**Analog:** `git show features/initial:extensions/claude-marketplace/commands/_args.ts`

**Port verbatim** -- imports change to `./args.ts`, `../shared/errors.ts`, `../shared/types.ts`. Exports `PositionalSpec`, `ParsedCommandArgs`, `parseCommandArgs`. The `parseArgsOrNotify` helper catches `parseArgs` throws and forwards `errorMessage(err)` to the injected `notifyError` callback. On missing required positional, emits `schema.usage` via `notifyError` and returns `undefined`.

Key signature (RESEARCH.md lines 577-586):
```typescript
export function parseCommandArgs<const Spec extends readonly PositionalSpec[]>(
  args: string,
  schema: { positional: Spec; usage: string },
  notifyError: (message: string) => void,
): ParsedCommandArgs<Spec> | undefined;
```

---

### `edge/completions/provider.ts` (completion dispatcher, request-response)

**Analog:** `git show features/initial:extensions/claude-marketplace/index.ts` (the `getArgumentCompletions: async (prefix) => { ... }` block inside `pi.registerCommand`).

**Port the dispatcher branches** -- five branches, exact V1 logic (verified in V1 `index.ts` and reproduced in RESEARCH.md lines 680-765). Two changes:

1. Replace V1's `loadKnownMarketplaceNames()` (which read `process.cwd()` directly) with `edge/completions/data.ts` accessors that take `ctx.cwd` -- or accept the V1 behavior of `process.cwd()` per RESEARCH.md Pitfall 3 (this is the one acceptable `process.cwd()` site in Phase 6, at the registration glue layer in `register.ts`).
2. Refactor V1's `getPluginRefCompletions(mode: "available" | "installed", ...)` to `getPluginRefCompletions(mode: "install" | "uninstall" | "update", ...)` -- consume `getPluginIndex` and filter by status per D-03.

**Top-level branch (TC-1):**
```typescript
const TOP_LEVEL_SUBCOMMANDS = ["install", "uninstall", "update", "list", "marketplace"];
if (tokens.length === 0) {
  return TOP_LEVEL_SUBCOMMANDS
    .filter((s) => s.startsWith(current))
    .map((label) => ({ label, value: label + " " }));
}
```

**`--scope` value branch (TC-4) and flag-name branch (TC-3):**
```typescript
const prevToken = tokens[tokens.length - 1];
if (prevToken === "--scope") {
  return ["user", "project"]
    .filter((v) => v.startsWith(current))
    .map((v) => ({ label: v, value: `${headPrefix}${v} ` }));
}

if (current.startsWith("-")) {
  const flags: { name: string; description?: string }[] = [
    { name: "--scope", description: "Scope: user or project" },
  ];
  if (head === "list") {
    flags.push(
      { name: "--installed", description: "Show installed plugins" },
      { name: "--available", description: "Show available plugins" },
      { name: "--unavailable", description: "Show unavailable plugins" },
    );
  }
  return flags
    .filter((f) => f.name.startsWith(current))
    .map((f) => ({ label: f.name, value: `${headPrefix}${f.name} `, ...(f.description !== undefined ? { description: f.description } : {}) }));
}
```

**Nested marketplace keyword branch (TC-2):**
```typescript
const MARKETPLACE_SUBCOMMANDS = ["add", "remove", "list", "update", "autoupdate", "noautoupdate"];  // rm excluded
if (head === "marketplace" && tokens.length === 1) {
  return MARKETPLACE_SUBCOMMANDS
    .filter((s) => s.startsWith(current))
    .map((label) => ({ label, value: `marketplace ${label} ` }));
}
```

**Plugin-ref branch (TC-6, D-03 refined):**
```typescript
if (head === "install" && tokens.length === 1) {
  return getPluginRefCompletions("install", current, argumentTextPrefix, ctx, { allowMarketplaceOnly: false });
}
if (head === "uninstall" && tokens.length === 1) {
  return getPluginRefCompletions("uninstall", current, argumentTextPrefix, ctx, { allowMarketplaceOnly: false });
}
if (head === "update" && tokens.length === 1) {
  return getPluginRefCompletions("update", current, argumentTextPrefix, ctx, { allowMarketplaceOnly: true });
}
```

**No-completion sentinel:** Return `null` (NOT `[]`) at the end of the dispatcher when no completion makes sense -- the Pi-tui contract distinguishes "I have no suggestions for this position" (`null`) from "no items match the prefix" (`[]`). Verified in V1 and in `@mariozechner/pi-coding-agent` types.d.ts (RESEARCH.md line 493).

---

### `edge/completions/data.ts` (accessor, read-through)

**Analog (replaced):** `git show features/initial:extensions/claude-marketplace/completions.ts` (the four `load*` functions: `loadKnownMarketplaceNames`, `loadAvailablePluginNames`, `loadInstalledPluginNames`, `loadPluginToMarketplacesMap`).

**Port the pure helpers verbatim** -- `buildItem`, `splitCompletionInput`, `extractPositionals`, `getScopeCompletions`, `getMarketplaceCompletions`, `getPluginCompletions`. These are pure functions with no I/O; the only change is the import of `AutocompleteItem` (now re-exported via `@mariozechner/pi-coding-agent` -- verify; otherwise import directly from `@mariozechner/pi-tui`).

```typescript
// Carry-forward verbatim:
function buildItem(argumentTextPrefix: string, itemText: string, appendSpace: boolean): AutocompleteItem {
  const head = argumentTextPrefix === "" ? "" : argumentTextPrefix + " ";
  const tail = appendSpace ? " " : "";
  return { label: itemText, value: head + itemText + tail };
}

export function splitCompletionInput(input: string): { tokens: string[]; current: string } {
  if (input === "") return { tokens: [], current: "" };
  const trailingSpace = /\s$/.test(input);
  const allTokens = input.split(/\s+/).filter((t) => t !== "");
  if (trailingSpace) return { tokens: allTokens, current: "" };
  const current = allTokens[allTokens.length - 1] ?? "";
  return { tokens: allTokens.slice(0, -1), current };
}

export function extractPositionals(tokens: readonly string[]): string[] {
  const positionals: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === "--scope") { i += 2; continue; }
    if (t !== undefined) positionals.push(t);
    i++;
  }
  return positionals;
}
```

**REPLACE V1 loaders with cache-backed accessors:**

```typescript
// New shape -- replaces V1's loadKnownMarketplaceNames / loadAvailablePluginNames /
// loadInstalledPluginNames / loadPluginToMarketplacesMap.

export async function getMarketplaceNamesAcrossScopes(cwd: string): Promise<string[]> {
  const userLocations = locationsFor("user", cwd);
  const projectLocations = locationsFor("project", cwd);
  const [userNames, projectNames] = await Promise.all([
    getMarketplaceNames(userLocations, "user"),    // shared/completion-cache.ts
    getMarketplaceNames(projectLocations, "project"),
  ]);
  return [...new Set([...userNames, ...projectNames])];
}

export async function getPluginToMarketplacesMap(
  mode: "install" | "uninstall" | "update",
  cwd: string,
): Promise<Map<string, string[]>> {
  // For each scope: getMarketplaceNames → for each mp: getPluginIndex →
  // filter rows by status; build cross-marketplace map.
}
```

The status filter (D-03 corollary):
- `mode === "install"` keeps rows where `status !== "installed"` (INCLUDES `unavailable` for future --force).
- `mode === "uninstall"` keeps rows where `status === "installed"`.
- `mode === "update"` keeps rows where `status === "installed"`.

**Port `getPluginRefCompletions` from V1 completions.ts (RESEARCH.md lines 256-307)** with the data path swapped to `getPluginToMarketplacesMap`. The branching logic on `currentPrefix.indexOf("@")` is unchanged from V1.

---

### `edge/completions/normalize.ts` (utility, transform)

**Analog:** `git show features/initial:extensions/claude-marketplace/completions.ts::normalizeCompletionWhitespace` + `isClaudePluginCommandLine` + `CLAUDE_PLUGIN_LINE`.

**Port verbatim** -- all three symbols are V1 carry-forward (TC-7 locked):
```typescript
export function normalizeCompletionWhitespace(result: {
  readonly lines: readonly string[];
  readonly cursorLine: number;
  readonly cursorCol: number;
}): { lines: string[]; cursorLine: number; cursorCol: number } {
  const lines = [...result.lines];
  const line = lines[result.cursorLine] ?? "";
  if (line[result.cursorCol - 1] !== " " || line[result.cursorCol] !== " ") {
    return { lines, cursorLine: result.cursorLine, cursorCol: result.cursorCol };
  }
  let n = 1;
  while (line[result.cursorCol + n] === " ") n++;
  lines[result.cursorLine] = line.slice(0, result.cursorCol) + line.slice(result.cursorCol + n);
  return { lines, cursorLine: result.cursorLine, cursorCol: result.cursorCol };
}

const CLAUDE_PLUGIN_LINE = /^\/claude:plugin(?::\d+)?(?:\s|$)/;

export function isClaudePluginCommandLine(line: string): boolean {
  return CLAUDE_PLUGIN_LINE.test(line);
}
```

Verified in V1 `completions.ts` lines 251-288.

---

### `edge/handlers/plugin/install.ts` (handler shim, request-response)

**Analog:** `orchestrators/plugin/install.ts::InstallPluginOptions` (the callee signature) + V1 `commands/install-plugin.ts` (monolithic V1 caller -- now thin).

**Pattern (RESEARCH.md Pattern 1, lines 335-369):**
```typescript
// edge/handlers/plugin/install.ts
import { installPlugin, type InstallPluginOptions } from "../../../orchestrators/plugin/install.ts";
import { parseCommandArgs } from "../../args-schema.ts";
import { notifyError } from "../../../shared/notify.ts";

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";

const USAGE = "Usage: /claude:plugin install <plugin>@<marketplace> [--scope user|project]";

export function makeInstallHandler(pi: ExtensionAPI) {
  return async (args: string, ctx: ExtensionCommandContext): Promise<void> => {
    const parsed = parseCommandArgs(
      args,
      { positional: [{ name: "ref" }] as const, usage: USAGE },
      (msg) => notifyError(ctx, msg),
    );
    if (parsed === undefined) return;

    const atIdx = parsed.ref.indexOf("@");
    if (atIdx === -1 || atIdx === 0 || atIdx === parsed.ref.length - 1) {
      notifyError(ctx, `Invalid plugin ref "${parsed.ref}". Use <plugin>@<marketplace>.\n\n${USAGE}`);
      return;
    }
    const plugin = parsed.ref.slice(0, atIdx);
    const marketplace = parsed.ref.slice(atIdx + 1);
    const scope = parsed.scope ?? "user";  // SC-5 default

    await installPlugin({ ctx, pi, scope, cwd: ctx.cwd, marketplace, plugin });
  };
}
```

**Required interface (from `orchestrators/plugin/install.ts` lines 95-104):**
```typescript
export interface InstallPluginOptions {
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly scope: Scope;
  readonly cwd: string;
  readonly marketplace: string;
  readonly plugin: string;
}
```

`pi` is REQUIRED -- soft-dep helpers in install.ts take a non-optional `ExtensionAPI`. The handler must be a **factory** `makeInstallHandler(pi)` because it needs to close over the `pi` injected at registration time (V1 `index.ts` line 70 already uses this exact factory pattern: `install: handleInstall(pi)`).

---

### `edge/handlers/plugin/uninstall.ts` (handler shim)

**Analog:** `orchestrators/plugin/uninstall.ts` (callee).

**Same shim pattern as install.ts**, but:
- One positional: `{ name: "ref" }` -- split on `@` into `(plugin, marketplace)`.
- Calls `uninstallPlugin({ ctx, pi, scope, cwd, marketplace, plugin })`.
- The Phase 5 `uninstallPlugin` signature mirrors `installPlugin` -- verify in `orchestrators/plugin/uninstall.ts` `UninstallPluginOptions`.

USAGE: `"Usage: /claude:plugin uninstall <plugin>@<marketplace> [--scope user|project]"`.

---

### `edge/handlers/plugin/update.ts` (handler shim)

**Analog:** `orchestrators/plugin/update.ts` (callee; both `updatePlugins` and `updateSinglePlugin` exported from `orchestrators/plugin/index.ts`).

**Pattern:** Positional is optional -- the bare form `/claude:plugin update` updates all plugins in all marketplaces; `update <plugin>@<marketplace>` updates one; `update @<marketplace>` updates all in one marketplace. Per TC-6, `update` accepts the bare `@<marketplace>` form.

Handler routes to `updatePlugins({...})` from `orchestrators/plugin/update.ts`. The orchestrator decides single-vs-cascade via its own `target` field (`UpdatePluginsTarget`).

USAGE: `"Usage: /claude:plugin update [<plugin>@<marketplace> | @<marketplace>] [--scope user|project]"`.

---

### `edge/handlers/plugin/list.ts` (handler shim)

**Analog:** `orchestrators/plugin/list.ts::ListPluginsOptions` (lines 62-75 in source):
```typescript
export interface ListPluginsOptions {
  readonly ctx: ExtensionContext;
  readonly cwd: string;
  readonly scope?: Scope;
  readonly marketplace?: string;
  readonly installed?: boolean;
  readonly available?: boolean;
  readonly unavailable?: boolean;
}
```

**Pattern:** Optional `<marketplace>` positional + optional `--scope` + optional `--installed`/`--available`/`--unavailable` flags. The handler tokenizes (via `parseArgs`), then scans the positional list for the marketplace and the token list for the three boolean flags (V1's parseArgs only handles `--scope`; the three list-specific flags are post-`parseArgs` scans on the positional list).

**Reference:** V1 `commands/list.ts` (`handlePluginList`) -- the new shim mirrors its argv parsing then delegates to `listPlugins(opts)`.

USAGE: `"Usage: /claude:plugin list [<marketplace>] [--scope user|project] [--installed] [--available] [--unavailable]"`.

---

### `edge/handlers/marketplace/add.ts` (handler shim)

**Analog:** `orchestrators/marketplace/add.ts::AddMarketplaceOptions` (lines 68-78):
```typescript
export interface AddMarketplaceOptions {
  readonly ctx: ExtensionContext;
  readonly scope: Scope;
  readonly cwd: string;
  readonly rawSource: string;
  readonly gitOps?: GitOps;
}
```

**Pattern:**
```typescript
export function makeAddHandler(deps: EdgeDeps) {
  return async (args: string, ctx: ExtensionCommandContext): Promise<void> => {
    const parsed = parseCommandArgs(
      args,
      { positional: [{ name: "source" }] as const, usage: USAGE },
      (msg) => notifyError(ctx, msg),
    );
    if (parsed === undefined) return;

    await addMarketplace({
      ctx,
      scope: parsed.scope ?? "user",
      cwd: ctx.cwd,
      rawSource: parsed.source,
      gitOps: deps.gitOps,  // EdgeDeps injection (Phase 7 wires DEFAULT_GIT_OPS)
    });
  };
}
```

USAGE: `"Usage: /claude:plugin marketplace add <source> [--scope user|project]"`.

---

### `edge/handlers/marketplace/remove.ts` (handler shim)

**Analog:** `orchestrators/marketplace/remove.ts::RemoveMarketplaceOptions`.

Shim takes one positional `<name>`, calls `removeMarketplace({ ctx, scope?, cwd, name })`. Note: scope is optional here because `remove` can run cross-scope-resolve via `resolveScopeFromState` (Phase 4 D-12). Verify Phase 4 contract.

USAGE: `"Usage: /claude:plugin marketplace remove <name> [--scope user|project]"`.

---

### `edge/handlers/marketplace/list.ts` (handler shim)

**Analog:** V1 `commands/list-marketplaces.ts::handleMarketplaceList` (lines 18-49 in V1 source) + `orchestrators/marketplace/list.ts::listMarketplaces`.

**V1 verbatim shape** (port directly):
```typescript
const USAGE = "Usage: /claude:plugin marketplace list [--scope user|project]";

export async function handleMarketplaceList(
  args: string,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const parsed = parseCommandArgs(
    args,
    { positional: [] as const, usage: USAGE },
    (msg) => notifyError(ctx, msg),
  );
  if (parsed === undefined) return;

  await listMarketplaces({ ctx, scope: parsed.scope, cwd: ctx.cwd });
}
```

(The new orchestrator handles the empty-list "No marketplaces configured." message via `renderMarketplaceList`. V1 inlined it; new orchestrator already centralizes it -- shim is thinner than V1.)

---

### `edge/handlers/marketplace/update.ts` (handler shim)

**Analog:** `orchestrators/marketplace/update.ts::updateMarketplace` + `updateAllMarketplaces`.

**Pattern:** Optional `<name>` positional. Bare form → `updateAllMarketplaces({...})`; named form → `updateMarketplace({..., name})`. The orchestrator takes `pluginUpdate: PluginUpdateFn` for the cascade -- pass `deps.pluginUpdate` from `EdgeDeps`.

USAGE: `"Usage: /claude:plugin marketplace update [<name>] [--scope user|project]"`.

---

### `edge/handlers/marketplace/autoupdate.ts` (handler shim, dual-form)

**Analog:** V1 `commands/marketplace-autoupdate.ts` (which exports both `handleMarketplaceAutoupdate` and `handleMarketplaceNoautoupdate`) + `orchestrators/marketplace/autoupdate.ts::setMarketplaceAutoupdate`.

**Pattern:** Single file exposing two handler factories (mirrors Phase 4 D-01: one file, boolean parameter). Both route to `setMarketplaceAutoupdate({..., enabled: true | false})`.

```typescript
export const makeAutoupdateHandler = (enabled: boolean) =>
  async (args: string, ctx: ExtensionCommandContext): Promise<void> => {
    const parsed = parseCommandArgs(
      args,
      { positional: [{ name: "name", required: false }] as const, usage: enabled ? AUTOUPDATE_USAGE : NOAUTOUPDATE_USAGE },
      (msg) => notifyError(ctx, msg),
    );
    if (parsed === undefined) return;
    await setMarketplaceAutoupdate({ ctx, cwd: ctx.cwd, scope: parsed.scope, name: parsed.name, enabled });
  };
```

The router calls `handlers.marketplaceAutoupdate = makeAutoupdateHandler(true)` and `handlers.marketplaceNoautoupdate = makeAutoupdateHandler(false)`.

---

### `edge/handlers/tools.ts` (LLM tool registration)

**Analog:** `git show features/initial:extensions/claude-marketplace/commands/list-marketplaces.ts` (V1's `registerListMarketplacesTool` + `registerListPluginsTool`).

**Port `registerListMarketplacesTool` verbatim** -- parameters: `Type.Object({})`, body queries `listVisibleMarketplaces` and renders one line per marketplace. NOTE: V1's body uses `Object.keys(m.plugins).length` for the plugin count -- this is correct under new state schema (presence of plugin record ≡ installed, per Phase 2 D-09).

**Extend `registerListPluginsTool` parameters per D-02:**
```typescript
parameters: Type.Object({
  marketplace: Type.Optional(Type.String({ description: "Marketplace name to list plugins for" })),
  scope: Type.Optional(Type.Union(
    [Type.Literal("user"), Type.Literal("project")],
    { description: "Scope to look in" },
  )),
  installed: Type.Optional(Type.Boolean({ description: "Include installed plugins" })),
  available: Type.Optional(Type.Boolean({ description: "Include available plugins" })),
  unavailable: Type.Optional(Type.Boolean({ description: "Include uninstallable plugins" })),
}),
```

**Body refactor:** V1 reads each `plugin.installed` boolean field; new state schema has no `installed` boolean -- presence in `mp.plugins[name]` ≡ installed. The bucketing logic for "available" / "unavailable" uses `domain/resolver.ts::resolveStrict` to determine `installable`. **The cleanest path is to call `listPlugins(opts)` from `orchestrators/plugin/index.ts` and capture its return shape** -- but `listPlugins` currently emits via `notifySuccess` (no return). Open question: either (a) refactor `listPlugins` to return its `PluginListPayload` and let the tool format the text, or (b) inline the loop here (same as V1, adjusted for new state schema). Planner picks.

**Tool execute signature (verified from `@mariozechner/pi-coding-agent` types.d.ts line 353):**
```typescript
execute(
  toolCallId: string,
  params: Static<TParams>,
  signal: AbortSignal | undefined,
  onUpdate: AgentToolUpdateCallback<TDetails> | undefined,
  ctx: ExtensionContext,
): Promise<AgentToolResult<TDetails>>;
```

Return shape: `{ content: [{ type: "text", text }], details: { plugins | marketplaces } }`. V1 verbatim.

---

### `edge/types.ts` (types module)

**Analog:** `orchestrators/types.ts` (cross-orchestrator types module). Same role: cross-module types module that sits at a tier root.

**Excerpt (RESEARCH.md D-04 lines 87-94):**
```typescript
// edge/types.ts
import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import type { GitOps } from "../orchestrators/marketplace/shared.ts";
import type { PluginUpdateFn } from "../orchestrators/types.ts";

export interface EdgeDeps {
  readonly gitOps: GitOps;
  readonly pluginUpdate: PluginUpdateFn;
}

export interface SubcommandHandlers {
  // mirrors V1 shape; the router consumes this
  install: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
  // ... etc.
}
```

`GitOps` lives in `orchestrators/marketplace/shared.ts` (verified: line 79 `export interface GitOps { ... }`). `PluginUpdateFn` lives in `orchestrators/types.ts` (verified: lines 50-54).

**Import boundary:** `edge/` may import from `orchestrators/` -- verified, no ESLint diff needed (RESEARCH.md §ESLint `import-x` Current Rules).

---

### `edge/register.ts` (registration, event-driven)

**Analog:** `git show features/initial:extensions/claude-marketplace/index.ts` (V1 entrypoint).

**V1 entrypoint is monolithic** -- it imports every handler, sets up `pi.registerCommand`, `pi.on("session_start", ...)`, and `pi.on("resources_discover", ...)` in one function. The new layout splits this:
- `edge/register.ts::registerClaudePluginCommand(pi, deps)` -- slash command + session_start autocomplete wrapper. Phase 6.
- `edge/register.ts::registerClaudeMarketplaceTools(pi)` -- two `pi.registerTool` calls. Phase 6.
- `pi.on("resources_discover", ...)` -- NOT a Phase 6 concern; Phase 7's `index.ts` wires this.

**Core registration pattern (port V1 structure, split into two helpers):**

```typescript
// edge/register.ts
import { routeClaudePlugin } from "./router.ts";
import { getArgumentCompletions } from "./completions/provider.ts";
import { isClaudePluginCommandLine, normalizeCompletionWhitespace } from "./completions/normalize.ts";
import { registerListMarketplacesTool, registerListPluginsTool } from "./handlers/tools.ts";
import { makeInstallHandler } from "./handlers/plugin/install.ts";
// ... etc for every handler factory

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { EdgeDeps } from "./types.ts";

export function registerClaudePluginCommand(pi: ExtensionAPI, deps: EdgeDeps): void {
  const handlers: SubcommandHandlers = {
    install: makeInstallHandler(pi),
    uninstall: makeUninstallHandler(pi),
    update: makeUpdateHandler(pi),
    list: makeListHandler(),
    marketplaceAdd: makeAddHandler(deps),
    marketplaceRemove: makeRemoveHandler(),
    marketplaceList: handleMarketplaceList,           // shim doesn't need pi or deps
    marketplaceUpdate: makeMarketplaceUpdateHandler(deps),
    marketplaceAutoupdate: makeAutoupdateHandler(true),
    marketplaceNoautoupdate: makeAutoupdateHandler(false),
  };

  pi.registerCommand("claude:plugin", {
    description: "Manage Claude plugin marketplaces and plugins. ...",
    handler: (args, ctx) => routeClaudePlugin(args, handlers, ctx),
    getArgumentCompletions: (prefix) => getArgumentCompletions(prefix, { cwd: process.cwd() }),
    // ^^ V1 behavior of process.cwd() -- the registration-glue layer is the
    // single Phase 6 site where process.cwd() is acceptable (Pitfall 3).
  });

  // TC-7 autocomplete wrapper. Installed on every session_start (V1 verbatim).
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.addAutocompleteProvider((current) => ({
      getSuggestions: (lines, line, col, options) =>
        current.getSuggestions(lines, line, col, options),
      applyCompletion: (lines, line, col, item, prefix) => {
        const result = current.applyCompletion(lines, line, col, item, prefix);
        const original = lines[line] ?? "";
        if (!isClaudePluginCommandLine(original)) return result;
        return normalizeCompletionWhitespace(result);
      },
      shouldTriggerFileCompletion: (lines, line, col) =>
        current.shouldTriggerFileCompletion?.(lines, line, col) ?? true,
    }));
  });
}

export function registerClaudeMarketplaceTools(pi: ExtensionAPI): void {
  registerListMarketplacesTool(pi);
  registerListPluginsTool(pi);
}
```

V1 `index.ts` lines 169-191 are the exact session_start wrapper template (verified verbatim above).

---

### `shared/completion-cache.ts` (cache module, NOVEL)

**No direct analog.** Closest tier-mates: `shared/atomic-json.ts` (atomic file I/O contract) + `persistence/state-io.ts` (read + validate + rebuild pattern with TypeBox JIT validators).

**Architectural constraints (D-03 corollaries):**
- `shared/` MUST NOT import from `persistence/`, `domain/`, etc. (verified in eslint.config.js BLOCK C). The cache module accepts **paths and rebuild callbacks as parameters** -- the caller (edge or orchestrator) constructs the path via `locationsFor(...)` and passes the rebuild closure that calls `loadState` + `loadMarketplaceManifest`.

**Atomic-write pattern (from `shared/atomic-json.ts`):**
```typescript
export async function atomicWriteJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFileAtomic(filePath, JSON.stringify(value, null, 2) + "\n", { encoding: "utf8" });
}
```
The cache uses this for every cache file write.

**TypeBox schema + validator pattern (from `persistence/state-io.ts` lines 38-84):**
```typescript
const PLUGIN_INSTALL_RECORD_SCHEMA = Type.Object({ /* ... */ });
const MARKETPLACE_RECORD_SCHEMA = Type.Object({ /* ... */ });
export const STATE_SCHEMA = Type.Object({ /* ... */ });
export const STATE_VALIDATOR = Compile(STATE_SCHEMA);  // JIT at module load
```
The cache module follows this exact pattern for its two cache schemas (`MARKETPLACE_NAMES_CACHE_SCHEMA` and `PLUGIN_INDEX_CACHE_SCHEMA`) -- see RESEARCH.md TypeBox patterns section for the suggested literal shapes.

**Read-validate-rebuild pattern (from `state-io.ts::loadState` lines 119-202):**
```typescript
export async function loadState(extensionRoot: string): Promise<ExtensionState> {
  let raw: string;
  try {
    raw = await readFile(stateJsonPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return DEFAULT_STATE;
    }
    throw new Error(`Failed to read ${stateJsonPath}: ${errorMessage(err)}`, { cause: err });
  }

  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch (err) { throw new Error(...); }

  if (!STATE_VALIDATOR.Check(normalized)) {
    throw new Error(`state.json ... failed schema validation: ${firstValidationErrorDetail(normalized)}`);
  }
  return normalized;
}
```

The cache module's file-read path mirrors this -- but ENOENT and **schema-mismatch** both fall through to rebuild (D-03 corollary "cache is optimization, not authoritative"). The `state-io` pattern throws on schema mismatch; the cache pattern drops and rebuilds.

**Public surface (RESEARCH.md lines 380-410):**
```typescript
export interface PluginIndexRow {
  readonly name: string;
  readonly status: "installed" | "available" | "unavailable";
  readonly version?: string;
}

// Read API (called from edge/completions/data.ts):
export async function getMarketplaceNames(
  marketplaceNamesCachePath: string,
  scope: Scope,
  rebuild: () => Promise<string[]>,
): Promise<string[]>;

export async function getPluginIndex(
  pluginCachePath: string,
  scope: Scope,
  marketplace: string,
  rebuild: () => Promise<PluginIndexRow[]>,
): Promise<readonly PluginIndexRow[]>;

// Invalidation API (called from orchestrators post-state-commit):
export function invalidateMarketplaceNames(scope: Scope): void;
export function invalidateMarketplaceCache(scope: Scope, marketplace: string): void;
export async function dropMarketplaceCache(
  pluginCachePath: string,
  scope: Scope,
  marketplace: string,
): Promise<void>;
```

**In-memory map (D-03 / RESEARCH.md):**
```typescript
const memMarketplaceNames = new Map<string, string[]>();      // key: ${scope}
const memPluginIndex = new Map<string, { rows: PluginIndexRow[]; loadedAt: number }>();  // key: ${scope}::${marketplace}
const PLUGIN_INDEX_TTL_MS = 10 * 60 * 1000;  // D-03 10-min TTL safety net
```

**ENOENT-tolerant unlink for `dropMarketplaceCache`** -- mirrors `cleanupStaging` in `shared/fs-utils.ts` (it returns leak strings, never throws on ENOENT). The cache's `dropMarketplaceCache` catches and swallows ENOENT, returns errors on any other code so the orchestrator can `notifyWarning`.

---

### `persistence/locations.ts` extension (in-place additive)

**Analog (in-file):** existing `pluginDataDir` / `marketplaceDataDir` / `sourceCloneDir` method definitions at lines 133-163.

**Existing pattern (from same file):**
```typescript
async pluginDataDir(mp: string, plugin: string): Promise<string> {
  assertSafeName(mp, `pluginDataDir marketplace name "${mp}"`);
  assertSafeName(plugin, `pluginDataDir plugin name "${plugin}"`);
  const candidate = path.join(dataRoot, mp, plugin);
  await assertPathInside(dataRoot, candidate, `pluginDataDir(${mp}, ${plugin})`);
  return candidate;
}
```

**New helpers to add (RESEARCH.md lines 893-913):**
```typescript
// Interface additions:
readonly cacheDir: string;                              // <extensionRoot>/cache/
readonly marketplaceNamesCacheFile: string;             // <cacheDir>/marketplace-names.json
pluginCacheFile(marketplace: string): Promise<string>;  // <cacheDir>/plugins/<marketplace>.json

// Body additions inside locationsFor():
const cacheDir = path.join(extensionRoot, "cache");
const marketplaceNamesCacheFile = path.join(cacheDir, "marketplace-names.json");

// In the frozen bundle:
cacheDir,
marketplaceNamesCacheFile,

async pluginCacheFile(marketplace: string): Promise<string> {
  assertSafeName(marketplace, `pluginCacheFile marketplace name "${marketplace}"`);
  const candidate = path.join(cacheDir, "plugins", `${marketplace}.json`);
  await assertPathInside(cacheDir, candidate, `pluginCacheFile(${marketplace})`);
  return candidate;
},
```

`cacheDir` and `marketplaceNamesCacheFile` are constructed from hard-coded suffixes only (no untrusted input) -- they follow the same pattern as `dataRoot`, `sourcesDir`, `agentsStagingDir` (locations.ts lines 96-104). Only `pluginCacheFile` takes a user-controlled marketplace name and must run `assertSafeName` + `assertPathInside`.

---

### `orchestrators/marketplace/add.ts` (in-place edit -- cache invalidation)

**Insertion point:** After `withStateGuard` closes (line 108) and before `notifySuccess` (line 116). Verified in source: `let recordedName` is declared outside the guard; the guard populates it; the success notify uses it. RESEARCH.md lines 843-845 confirm the exact insertion window.

**Pattern (RESEARCH.md lines 871-879):**
```typescript
// After: await withStateGuard(...); (line 108)
// Before: notifySuccess(opts.ctx, `Added marketplace "${recordedName}" in ${opts.scope} scope.`);

try {
  invalidateMarketplaceNames(opts.scope);
  invalidateMarketplaceCache(opts.scope, recordedName);
} catch (err) {
  notifyWarning(opts.ctx, `Marketplace "${recordedName}" added; completion cache refresh deferred: ${errorMessage(err)}`);
}
```

The two `invalidate*` calls are memory-only (no I/O) and cannot throw under normal operation; the try/catch is defense-in-depth. Failure of invalidation does NOT roll back the state-committed add.

---

### `orchestrators/marketplace/remove.ts` (in-place edit -- cache invalidation)

**Insertion point:** After `withStateGuard` closes (line 148, after the `delete state.marketplaces[opts.name]` block) and before the POST-STATE cleanup loop at line 150. Verified in source above.

**Pattern:**
```typescript
// After: }); /* close of withStateGuard at line 148 */
// Before: // POST-STATE cleanup (MR-5/MR-6/MR-7).

try {
  invalidateMarketplaceNames(resolved.scope);  // or opts.scope -- check resolved scope variable name
  await dropMarketplaceCache(await locations.pluginCacheFile(opts.name), resolved.scope, opts.name);
} catch (err) {
  notifyWarning(opts.ctx, `Marketplace "${opts.name}" removed; completion cache cleanup deferred: ${errorMessage(err)}`);
}
```

`dropMarketplaceCache` does I/O (unlinks the cache file) -- this is the failure surface to guard with notify-warning.

---

### `orchestrators/marketplace/update.ts` (in-place edit -- cache invalidation)

**Insertion point:** After the inner `withStateGuard` resolves (lines ~250) and before the autoupdate cascade begins (~line 256). RESEARCH.md lines 853-855.

```typescript
try {
  invalidateMarketplaceCache(scope, name);
} catch (err) {
  notifyWarning(opts.ctx, `Marketplace "${name}" updated; completion cache refresh deferred: ${errorMessage(err)}`);
}
```

---

### `orchestrators/plugin/install.ts` (in-place edit -- cache invalidation)

**Insertion point:** After `mkdir(installCtx.pluginDataDir)` at lines 580-587 (the existing post-state-commit eager-action). RESEARCH.md lines 857-861. Verified in source above.

```typescript
// After the AS-6 mkdir try/catch (~line 587), BEFORE the AS-7 agentForeignFailures block.
try {
  invalidateMarketplaceCache(scope, marketplace);
} catch (err) {
  notifyWarning(ctx, `Plugin "${plugin}" installed; completion cache refresh deferred: ${errorMessage(err)}`);
}
```

---

### `orchestrators/plugin/uninstall.ts` (in-place edit -- cache invalidation)

**Insertion point:** After `withStateGuard` closes (~line 137) and before the post-state-commit `rm -rf` of `pluginDataDir` (~line 159). RESEARCH.md lines 863-866.

```typescript
try {
  invalidateMarketplaceCache(scope, marketplace);
} catch (err) {
  notifyWarning(ctx, `Plugin "${plugin}" uninstalled; completion cache refresh deferred: ${errorMessage(err)}`);
}
```

---

### `tests/edge/router.test.ts` (test, pure unit)

**Analog:** `tests/orchestrators/marketplace/list.test.ts` (lines 1-50, scaffolding pattern).

**Carry-forward `makeCtx()` helper (lines 19-30 of list.test.ts):**
```typescript
interface NotifyRecord { message: string; severity?: string; }

function makeCtx(): { ctx: ExtensionContext; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
  } as unknown as ExtensionContext;
  return { ctx, notifications };
}
```

**Router tests are pure-unit** -- no hermetic-home needed because the router does no I/O. Construct a `handlers: SubcommandHandlers` of spy callbacks; call `routeClaudePlugin(args, handlers, ctx)`; assert (a) which spy was invoked with what args, (b) notification record contents (Usage block on empty/unknown subcommand).

---

### `tests/edge/args.test.ts` (test, pure unit)

**Analog:** Pure unit tests on a `parseArgs` function -- no hermetic FS needed. Use plain `test()` + `assert.deepEqual` / `assert.throws` directly. Closest tier-mate: `tests/persistence/state-io.test.ts` for pure-function-with-error-paths tests.

---

### `tests/edge/args-schema.test.ts` (test, pure unit)

Same shape as `args.test.ts`. The `notifyError` callback can be a closure capturing a string array:
```typescript
const errors: string[] = [];
const result = parseCommandArgs(args, schema, (m) => errors.push(m));
```

---

### `tests/edge/completions/provider.test.ts` (test, integration with hermetic FS)

**Analog:** `tests/orchestrators/plugin/install.test.ts` (lines 1-100, full hermetic-home scaffolding).

**Carry forward `withHermeticHome` + `makeCtx` (with `pi` override)**:
```typescript
async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "completions-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;
  try {
    return await fn();
  } finally {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    await rm(hermeticHome, { recursive: true, force: true });
  }
}
```

Provider tests seed state.json (via `saveState`) + a marketplace manifest on disk, then call `getArgumentCompletions(prefix, { cwd })` and assert the returned `AutocompleteItem[]` shape.

---

### `tests/edge/completions/data.test.ts` (test, integration)

Same scaffolding as `provider.test.ts`. Exercises `getMarketplaceNamesAcrossScopes` and `getPluginToMarketplacesMap` with status filter assertions.

---

### `tests/edge/completions/normalize.test.ts` (test, pure unit)

Pure unit tests on `normalizeCompletionWhitespace` and `isClaudePluginCommandLine`. No I/O. Closest analog: any pure-function test file (e.g., `tests/shared/errors.test.ts`).

---

### `tests/edge/handlers/plugin/install.test.ts` (test, integration shim)

**Analog:** `tests/orchestrators/plugin/install.test.ts` (full hermetic-home + mocked pi).

**Shim test pattern:** Either (a) test the shim end-to-end with real `installPlugin` and assert observable side effects (mirrors install.test.ts existing pattern), OR (b) inject a mock `installPlugin` via the factory (`makeInstallHandler` takes `pi`; for tests, swap the import via `__test_seam`). Recommended: (a) -- the orchestrator's existing test coverage is exhaustive; the shim test just verifies parse-then-delegate.

Test cases:
- Missing positional → notify error with USAGE, no orchestrator call.
- Invalid `<plugin>@<marketplace>` format (no `@`, leading `@`, trailing `@`) → notify error with USAGE.
- Valid args → orchestrator called with `{ ctx, pi, scope: "user", cwd, marketplace, plugin }`.
- `--scope project` → orchestrator called with `scope: "project"`.

Same shape applies to `uninstall.test.ts`, `update.test.ts`, `list.test.ts`, and all `marketplace/*.test.ts` shim tests.

---

### `tests/edge/handlers/tools.test.ts` (test, integration with mock pi)

**Analog:** Use `pi` mock pattern from `install.test.ts` lines 54-71 (`makeCtx({ getAllTools: () => [...] })`). For tool tests, construct a `pi` that records `registerTool` calls and exposes the registered `execute` body for invocation.

```typescript
function makeMockPi(): { pi: ExtensionAPI; registered: Map<string, ToolDefinition> } {
  const registered = new Map<string, ToolDefinition>();
  const pi = {
    registerTool: (tool: ToolDefinition) => { registered.set(tool.name, tool); },
    getAllTools: () => [],
  } as unknown as ExtensionAPI;
  return { pi, registered };
}
```

Then: invoke `registerListMarketplacesTool(pi)` → look up `registered.get("claude_marketplace_list")` → call `.execute(...)` → assert return shape.

For state-dependent paths, combine with `withHermeticHome` from `install.test.ts`.

---

### `tests/edge/register.test.ts` (test, integration with mock pi as spy)

**Analog:** No exact analog -- closest is `tests/edge/handlers/tools.test.ts` mock `pi`. The `register.test.ts` adds spy capture for `pi.on("session_start", ...)`:
```typescript
function makeMockPi(): { pi: ExtensionAPI; events: { [k: string]: Function[] }; commands: Map<...>; tools: Map<...> } {
  const events: { [k: string]: Function[] } = {};
  const commands = new Map();
  const tools = new Map();
  const pi = {
    on: (event: string, handler: Function) => { (events[event] ??= []).push(handler); },
    registerCommand: (name: string, opts: any) => { commands.set(name, opts); },
    registerTool: (tool: any) => { tools.set(tool.name, tool); },
    getAllTools: () => [],
  } as unknown as ExtensionAPI;
  return { pi, events, commands, tools };
}
```

Tests:
- `registerClaudePluginCommand(pi, deps)` → `commands` has `"claude:plugin"`, `events["session_start"]` has length 1.
- Fire the session_start handler → it invokes `ctx.ui.addAutocompleteProvider` with a factory that produces a wrapper using `normalizeCompletionWhitespace`.
- `registerClaudeMarketplaceTools(pi)` → `tools` has both `"claude_marketplace_list"` and `"claude_marketplace_plugin_list"`.

---

### `tests/shared/completion-cache.test.ts` (test, mix of pure + hermetic FS)

**Analog:** `tests/shared/atomic-json.test.ts` (lines 1-68, pure-unit cache-file scaffolding with `mkdtemp` + `rm`).

**Carry-forward atomic-json test pattern (lines 17-31):**
```typescript
test("happy path: write succeeds with 2-space indent + trailing newline (AS-1)", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "aj-"));
  try {
    const file = path.join(dir, "out.json");
    await atomicWriteJson(file, { ok: true, n: 7 });
    const got = await readFile(file, "utf8");
    assert.equal(got, '{\n  "ok": true,\n  "n": 7\n}\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

For TTL tests: inject a `now: () => number` parameter into `getPluginIndex` (RESEARCH.md line 968 recommends this seam), so tests can advance the clock without depending on `node:test` `t.mock.timers` (which requires Node ≥23; Phase 6 CI may still be on Node 22.x).

For corruption tests: write a deliberately bad JSON file at the cache path; assert next read rebuilds from the injected `rebuild` callback.

Schema-version snapshot test (per RESEARCH.md): `assert.equal(MARKETPLACE_NAMES_CACHE_SCHEMA.schemaVersion.const, 1)` (or similar).

---

### Orchestrator test extensions (in-place additive)

For each of `tests/orchestrators/marketplace/{add,remove,update}.test.ts` and `tests/orchestrators/plugin/{install,uninstall}.test.ts`, add ONE new test case asserting cache invalidation fires post-state-commit. The invalidation seam:

```typescript
// Add a path injection seam: tests pass an injected invalidate spy via deps OR
// observe disk effects (cache file unlinked / file mtime changed).

// Recommended: inject the cache path via the locations bundle and observe
// the cache file's presence/contents directly. dropMarketplaceCache unlinks
// the file; invalidateMarketplaceCache is memory-only (no FS observable).

// For memory-only invalidations, the test seeds the cache memory directly
// (via a small exported test helper or by reading once before mutation),
// then asserts the next read recomputes (timing or content change).
```

For dropMarketplaceCache-style invalidation (used by `marketplace remove`), the test can pre-create the cache file in `<extensionRoot>/cache/plugins/<mp>.json` and assert it is absent after the orchestrator succeeds.

For memory-only invalidations, the simplest test asserts that a `notifyWarning` does NOT fire on the success path (no cache failure surfaced).

## Shared Patterns

### Pattern: Notify discipline (BLOCK A)

**Source:** `extensions/claude-marketplace/shared/notify.ts`

**Apply to:** Every Phase 6 file in `edge/` and the cache invalidation insertions in `orchestrators/`. Direct `ctx.ui.notify` is FORBIDDEN -- use these wrappers:

```typescript
// From shared/notify.ts (verified):
export function notifySuccess(ctx: ExtensionContext, message: string): void {
  ctx.ui.notify(message);
}

export function notifyWarning(ctx: ExtensionContext, message: string): void {
  ctx.ui.notify(message, "warning");
}

export function notifyError(ctx: ExtensionContext, message: string, cause?: unknown): void {
  const causeText = cause === undefined ? "" : `\nCause: ${errorMessage(cause)}`;
  ctx.ui.notify(`${message}${causeText}`, "error");
}

export function notifyUsageError(ctx: ExtensionContext, message: string, usageBlock: string): void {
  ctx.ui.notify(`${message}\n\n${usageBlock}`, "error");
}
```

`notifyUsageError` is the AP-3 emission path -- the blank line between message and Usage block is part of the user contract.

### Pattern: Path containment (BLOCK ?)

**Source:** `extensions/claude-marketplace/shared/path-safety.ts::assertPathInside`

**Apply to:** Every cache file path in `persistence/locations.ts` (specifically `pluginCacheFile(marketplace)`). The cacheDir and marketplaceNamesCacheFile are hard-coded suffixes (no untrusted input) so they don't need containment checks; only `pluginCacheFile` accepts the marketplace name and must run `assertSafeName` + `assertPathInside`.

```typescript
// Pattern (from existing pluginDataDir at locations.ts line 133-145):
async pluginCacheFile(marketplace: string): Promise<string> {
  assertSafeName(marketplace, `pluginCacheFile marketplace name "${marketplace}"`);
  const candidate = path.join(cacheDir, "plugins", `${marketplace}.json`);
  await assertPathInside(cacheDir, candidate, `pluginCacheFile(${marketplace})`);
  return candidate;
}
```

### Pattern: Atomic JSON write (NFR-1)

**Source:** `extensions/claude-marketplace/shared/atomic-json.ts::atomicWriteJson`

**Apply to:** Every cache file write in `shared/completion-cache.ts`. Goes through `write-file-atomic@^8` queue.

```typescript
await atomicWriteJson(cacheFilePath, { schemaVersion: 1, names: [...] });
```

### Pattern: TypeBox JIT validators at module load (D-07)

**Source:** `extensions/claude-marketplace/persistence/state-io.ts` lines 33-84

**Apply to:** `shared/completion-cache.ts` cache schemas + `edge/handlers/tools.ts` LLM tool parameter schemas (the latter is NOT compiled -- Pi compiles them; just `Type.Object({...})` inline).

```typescript
// Cache schemas (planner suggestion -- RESEARCH.md lines 1049-1069):
const MARKETPLACE_NAMES_CACHE_SCHEMA = Type.Object({
  schemaVersion: Type.Literal(1),
  names: Type.Array(Type.String()),
});
const MARKETPLACE_NAMES_VALIDATOR = Compile(MARKETPLACE_NAMES_CACHE_SCHEMA);
```

### Pattern: Test scaffolding -- hermetic HOME + makeCtx

**Source:** `tests/orchestrators/plugin/install.test.ts` lines 49-93 (and `tests/orchestrators/marketplace/list.test.ts` lines 14-55).

**Apply to:** Every Phase 6 test that touches the filesystem or invokes an orchestrator. Pure-unit tests (router, args, args-schema, normalize) do NOT need this scaffolding -- only the completions provider/data tests and shim/integration tests need it.

```typescript
async function withHermeticHome<T>(fn: () => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "edge-home-"));
  const prevHome = process.env.HOME;
  process.env.HOME = hermeticHome;
  try { return await fn(); }
  finally {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    await rm(hermeticHome, { recursive: true, force: true });
  }
}

function makeCtx(piOverrides?: { getAllTools?: () => unknown[] }): { ctx: ExtensionContext; pi: ExtensionAPI; notifications: NotifyRecord[] } {
  const notifications: NotifyRecord[] = [];
  const ctx = { ui: { notify: (m, s?) => notifications.push(s ? { message: m, severity: s } : { message: m }) } } as unknown as ExtensionContext;
  const pi = { getAllTools: piOverrides?.getAllTools ?? (() => []) } as unknown as ExtensionAPI;
  return { ctx, pi, notifications };
}
```

### Pattern: Pi mock for register / tools tests

**Source:** Composite of `tests/orchestrators/plugin/install.test.ts` (mock `pi`) + new register-test seam.

**Apply to:** `tests/edge/register.test.ts`, `tests/edge/handlers/tools.test.ts`. Construct `pi` as a recording mock with `registerTool` / `registerCommand` / `on` spies; assert what was registered and how the registered callbacks behave when invoked.

### Pattern: Cache-invalidation failure mode

**Apply to:** Each of the 5 mutating orchestrator edits.

```typescript
// Standard envelope (RESEARCH.md lines 871-879):
try {
  invalidateMarketplaceCache(scope, marketplace);  // or whichever invalidation
} catch (err) {
  notifyWarning(ctx, `<operation> succeeded; completion cache refresh deferred: ${errorMessage(err)}`);
}
```

The `invalidate*` calls are memory-only and cannot throw under normal operation. The try/catch is defense-in-depth. `dropMarketplaceCache` does I/O (unlink) -- it MUST be guarded because the cache file may be locked / permissions-denied.

## No Analog Found

Files with no close codebase match (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason | RESEARCH.md Reference |
|------|------|-----------|--------|------------------------|
| `shared/completion-cache.ts` | cache module | read-through + invalidation | Two-tier (file + memory) cache is novel for the codebase. Composite of `shared/atomic-json.ts` (atomic write) + `persistence/state-io.ts` (read+validate) patterns. | Pattern 2 (lines 373-411), TypeBox patterns (lines 1006-1072) |
| `tests/edge/register.test.ts` | test (mock pi spy) | -- | No prior test in the codebase mocks `pi.on` + `pi.registerCommand` + `pi.registerTool` together. Closest mock is `pi.getAllTools` in `install.test.ts`. | Pattern 3 (lines 415-491), Pi API contract (lines 808-835) |

## Metadata

**Analog search scope:**
- `extensions/claude-marketplace/edge/` (current state: minimal scaffold)
- `extensions/claude-marketplace/orchestrators/{plugin,marketplace}/` (Phase 4/5 outputs)
- `extensions/claude-marketplace/shared/` (Phase 1 outputs)
- `extensions/claude-marketplace/persistence/` (Phase 2 outputs)
- `tests/orchestrators/`, `tests/shared/`, `tests/persistence/`
- V1 reference: `git show features/initial:extensions/claude-marketplace/{args,index,completions}.ts` + `commands/{router,_args,list-marketplaces}.ts`

**Files scanned:** ~25 (5 V1 references, 15 current Phase 1-5 outputs, 5 test analogs)

**Pattern extraction date:** 2026-05-11
