# Phase 103: Workflow artifact materialization - Pattern Map

**Mapped:** 2026-08-15
**Files analyzed:** 11 (6 new, 5 amended)
**Analogs found:** 11 / 11

All line anchors below were read this session from
`/home/acolomba/pi-claude-marketplace/.worktrees/workflows-spike/`. Paths in
headings are relative to `extensions/pi-claude-marketplace/` unless stated.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `domain/workflow-project-key.ts` (NEW) | domain / pure derivation | transform | `domain/name.ts::generatedWorkflowName` (`name.ts:102-140`) | role-match |
| `platform/workflow-home.ts` (NEW) | platform seam | config | `platform/pi-api.ts:15` (`getAgentDir` re-export) | role-match |
| `persistence/locations.ts` (AMEND) | persistence / path bundle | config | itself — `pluginCloneDir` (`locations.ts:248-259`) + `pluginCacheFile` (`locations.ts:268-277`) | exact (in-file) |
| `bridges/workflows/types.ts` (NEW) | bridge types | — | `bridges/commands/types.ts` (whole file) | exact |
| `bridges/workflows/discover.ts` (NEW) | bridge / discovery | file-I/O | `bridges/commands/discover.ts` (whole file) | exact |
| `bridges/workflows/stage.ts` (NEW) | bridge / stage+commit | file-I/O | `bridges/commands/stage.ts:168-355` | exact |
| `bridges/workflows/unstage.ts` (NEW) | bridge / removal | file-I/O | `bridges/commands/unstage.ts` (whole file) | exact |
| `bridges/workflows/index.ts` (NEW) | barrel | — | `bridges/commands/index.ts` (whole file) | exact |
| `orchestrators/plugin/install.ts` (AMEND) | orchestrator / ledger | transactional | itself — `mcpPhase` (`install.ts:1111-1143`), phases array (`install.ts:1239-1246`) | exact (in-file) |
| `orchestrators/plugin/info.ts` (AMEND) | orchestrator / read-only | request-response | itself — `discoverComponentNames` (`info.ts:318-336`), `composeResolvedComponents` (`info.ts:677-708`) | exact (in-file) |
| `persistence/state-io.ts` + `persistence/migrate.ts` (AMEND, if `resources.workflows` lands here) | persistence / schema | CRUD | `hooks` additive-with-fill precedent (`state-io.ts:119-125`, `migrate.ts:134-139`) | exact (in-file) |

---

## Pattern Assignments

### `bridges/workflows/discover.ts` (bridge, file-I/O)

**Analog:** `bridges/commands/discover.ts` — read in full.

**File header + imports pattern** (`discover.ts:1-28`) — copy the shape, swap
the IDs. Note the type-only imports land last and `Dirent` comes from
`node:fs`:

```ts
// bridges/commands/discover.ts
//
// Bridge primitive: enumerate flat `*.md` files under each declared
// `componentPaths.commands` entry (CM-4 -- non-recursive, ignore non-md).
// ...
// Symlink discipline (D-14): refuse symlinked
// `.md` entries. We `lstat` each candidate before reading; isSymbolicLink()
// short-circuits without touching the file body. Containment of the
// commands directory itself is the resolver's job ...

import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

import { assertSafeName, generatedCommandName } from "../../domain/name.ts";

import type { DiscoveredCommand } from "./types.ts";
import type { MaterializablePlugin } from "../../domain/resolver.ts";
import type { Dirent } from "node:fs";
```

**Result shape** (`discover.ts:30-34`) — copy verbatim, rename:

```ts
/** D-07 return shape: `{ discovered, warnings }`. */
export interface DiscoverPluginCommandsResult {
  readonly discovered: readonly DiscoveredCommand[];
  readonly warnings: readonly string[];
}
```

**ENOENT/ENOTDIR graceful read** (`discover.ts:36-48`) — copy verbatim:

```ts
async function readEntriesGracefully(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;

    if (code === "ENOENT" || code === "ENOTDIR") {
      return [];
    }

    throw err;
  }
}
```

**D-14 symlink refusal predicate** (`discover.ts:50-57`) — the shape to copy;
the suffix test becomes a case-insensitive `WORKFLOW_SCRIPT_EXTENSIONS.some(...)`
(the tuple is exported at `domain/workflow-script.ts:293`):

```ts
async function isCommandFile(dir: string, entry: Dirent): Promise<boolean> {
  if (entry.name.startsWith(".") || !entry.isFile() || !entry.name.endsWith(".md")) {
    return false;
  }

  const stat = await lstat(path.join(dir, entry.name));
  return !stat.isSymbolicLink();
}
```

**Main loop: multi-dir walk, deterministic sort, first-wins dedup**
(`discover.ts:67-120`):

```ts
export async function discoverPluginCommands(input: {
  pluginName: string;
  resolved: MaterializablePlugin;
}): Promise<DiscoverPluginCommandsResult> {
  const commandsDirs = input.resolved.componentPaths.commands;

  const seenByGenerated = new Map<string, DiscoveredCommand>();
  const warnings: string[] = [];

  for (const commandsRel of commandsDirs) {
    const commandsDir = path.isAbsolute(commandsRel)
      ? commandsRel
      : path.resolve(input.resolved.pluginRoot, commandsRel);

    const entries = await readEntriesGracefully(commandsDir);

    // Deterministic ordering for stable warning messages and test assertions.
    const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of sorted) {
      const full = path.join(commandsDir, entry.name);
      if (!(await isCommandFile(commandsDir, entry))) {
        continue;
      }

      const sourceName = entry.name.slice(0, -3);
      assertSafeName(sourceName, `command source name in ${commandsDir}`);   // <-- DO NOT COPY
      const generatedName = generatedCommandName(input.pluginName, sourceName);

      // D-07 first-wins dedup by generated command name.
      if (seenByGenerated.has(generatedName)) {
        warnings.push(duplicateWarning(sourceName, commandsDir, generatedName));
        continue;
      }

      seenByGenerated.set(generatedName, { sourceName, generatedName, commandFile: full });
    }
  }

  return {
    discovered: Object.freeze([...seenByGenerated.values()]),
    warnings: Object.freeze(warnings),
  };
}
```

**The four mandatory divergences from this analog** (RESEARCH Pattern 2):

1. `entry.name.slice(0, -3)` + `assertSafeName(sourceName, ...)` at
   `discover.ts:98-99` must **not** be copied. `admitWorkflowScript` takes the
   raw `fileName` (`domain/workflow-script.ts:124-128`) and routes an unsafe
   name into a per-file `refused` verdict instead of throwing.
2. Discovery must `readFile` each candidate (the name lives in `meta.name`) and
   carry the bytes forward so `stage` does not re-read — the commands analog
   re-reads at `stage.ts:218`.
3. Dedup key is the verdict's `generatedName`, but
   `assertNoWorkflowNameCollisions` runs over the **full verdict array before**
   dedup (`domain/workflow-script.ts:190`).
4. A `readFile` failure is a `warnings[]` entry, never a throw (WBRG-03).

**Warning-message builder** (`discover.ts:59-65`) — copy the template-string
shape for the duplicate case; add sibling builders for read-failure and for the
`skipped`/`refused` verdict arms.

---

### `bridges/workflows/stage.ts` (bridge, file-I/O)

**Analog:** `bridges/commands/stage.ts`.

**Imports pattern** (`stage.ts:23-53`) — note `randomUUID` from `node:crypto`,
the leak helpers from `shared/errors.ts`, and `cleanupStaging` from
`shared/fs-utils.ts`:

```ts
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { assertSafeName } from "../../domain/name.ts";
import { appendLeakToError, appendLeaks, errorMessage, ManualRecoveryError } from "../../shared/errors.ts";
import { cleanupStaging, pathExists, removeOrphanIfPresent, rollbackReplacementCommon } from "../../shared/fs-utils.ts";
import { assertPathInside } from "../../shared/path-safety.ts";

import { discoverPluginCommands } from "./discover.ts";
```

Phase 103 needs only `cleanupStaging` from `fs-utils` — `pathExists`,
`removeOrphanIfPresent` and `rollbackReplacementCommon` belong to the
`replacePrepared*` reinstall surface, which is Phase 104.

**Core `prepareStage*` ordering** (`stage.ts:168-287`). The five steps —
discover → collision assert → materialization gate → staging root → per-file
write — are the contract:

```ts
export async function prepareStageCommands(
  input: StageCommandsInput,
): Promise<PreparedCommandsStaging> {
  const { locations, pluginName, pluginRoot, pluginDataDir, resolved, cwd } = input;
  const previousNames = input.previousCommandNames ?? [];
  const { discovered, warnings: discoverWarnings } = await discoverPluginCommands({
    pluginName,
    resolved,
  });

  assertNoCommandCollisions(discovered);        // workflows: assertNoWorkflowNameCollisions(verdicts)

  // Materialization gate (symmetry with skills bridge).
  if (discovered.length === 0 && previousNames.length === 0) {
    return {
      kind: "noop",
      result: {
        stagedNames: Object.freeze<string[]>([]),
        recorded: Object.freeze<StagedCommandRecord[]>([]),
        warnings: Object.freeze([...discoverWarnings]),
        degraded: Object.freeze<CommandDegradeRecord[]>([]),
      },
    };
  }

  const stagingRoot = path.join(locations.commandsStagingDir, randomUUID());
  await mkdir(stagingRoot, { recursive: true });
  await assertPathInside(locations.commandsStagingDir, stagingRoot, "commands staging root");

  const renamePairs: { from: string; to: string }[] = [];
  const stagedNames: string[] = [];

  try {
    for (const command of discovered) {
      assertSafeName(command.generatedName, "generated command name");
      const stagedFile = path.join(stagingRoot, command.generatedName + ".md");
      await assertPathInside(stagingRoot, stagedFile, "staged command file");

      const targetFile = path.join(locations.promptsTargetDir, command.generatedName + ".md");
      await assertPathInside(locations.promptsTargetDir, targetFile, "target command file");

      let content = await readFile(command.commandFile, "utf8");
      // ... kind-specific transform ...
      await writeFile(stagedFile, content, "utf8");

      renamePairs.push({ from: stagedFile, to: targetFile });
      stagedNames.push(command.generatedName);
    }
  } catch (err) {
    throw appendLeakToError(err, await cleanupStaging(stagingRoot, "commands staging directory"));
  }
  // ... returns { kind: "staged", locations, stagingRoot, result, _previousNames, _renamePairs }
}
```

Workflow deltas inside the loop: `stagingRoot` derives from
`locations.workflowsStagingDir`; `targetFile` comes from
`await locations.workflowArtifactPath(generatedName)` (which does its own
`assertPathInside`, so do not recompute the join); the file suffix is `.json`;
the body is `JSON.stringify({name, ...(description !== undefined && {description}), script}, null, 2) + "\n"`
built from the already-read source bytes rather than a second `readFile`.

**Commit + reverse-walk rollback** (`stage.ts:300-355`) — lift verbatim, swap
`.md` → `.json` and `promptsTargetDir` → the saved dir:

```ts
export async function commitPreparedCommands(
  prepared: PreparedCommandsStaging,
): Promise<string | undefined> {
  if (prepared.kind === "noop") {
    return undefined;
  }

  for (const name of prepared._previousNames) {
    const target = path.join(prepared.locations.promptsTargetDir, name + ".md");
    await assertPathInside(prepared.locations.promptsTargetDir, target, "previous command file");

    try {
      await unlink(target);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
  }

  const completedRenames: { from: string; to: string }[] = [];
  try {
    await mkdir(prepared.locations.promptsTargetDir, { recursive: true });
    for (const pair of prepared._renamePairs) {
      await rename(pair.from, pair.to);
      completedRenames.push(pair);
    }
  } catch (err) {
    const rollbackLeaks: string[] = [];
    for (const pair of [...completedRenames].reverse()) {
      try {
        await rename(pair.to, pair.from);
      } catch (rollbackErr) {
        rollbackLeaks.push(
          `failed to roll back command rename ${pair.to} -> ${pair.from}: ${errorMessage(rollbackErr)}`,
        );
      }
    }

    throw appendLeaks(err, [
      ...rollbackLeaks,
      await cleanupStaging(prepared.stagingRoot, "commands staging directory"),
    ]);
  }

  return cleanupStaging(prepared.stagingRoot, "commands staging directory");
}
```

**Abort** (`stage.ts:361-369`) — three-line noop-guard + `cleanupStaging`; copy
as-is.

**Do NOT use `shared/atomic-json.ts`** — its own header (lines 15-18) scopes it
to `withStateGuard` participants. Atomicity here comes from the `rename`.

---

### `bridges/workflows/unstage.ts` (bridge, file-I/O)

**Analog:** `bridges/commands/unstage.ts` — the whole file is 43 lines and is
the template. Copy verbatim; the only change is the path composer
(`await input.locations.workflowArtifactPath(name)` instead of the inline join)
and the `.json` suffix:

```ts
export async function unstagePluginCommands(
  input: UnstageCommandsInput,
): Promise<UnstageCommandsResult> {
  const removed: string[] = [];

  for (const name of input.previousCommandNames) {
    const target = path.join(input.locations.promptsTargetDir, name + ".md");
    await assertPathInside(input.locations.promptsTargetDir, target, "command to unstage");

    try {
      await unlink(target);
      removed.push(name);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
      // ENOENT: the previously-staged file is already gone ... Idempotent.
    }
  }

  return {
    removedNames: Object.freeze(removed),
    warnings: Object.freeze<string[]>([]),
  };
}
```

---

### `bridges/workflows/types.ts` (bridge types)

**Analog:** `bridges/commands/types.ts` — copy the discriminated-union shape and
the underscore-field convention.

**Prepared-staging union** (`types.ts:84-104`):

```ts
/** Discriminated union -- `kind: "noop" | "staged"`. */
export type PreparedCommandsStaging = PreparedCommandsNoop | PreparedCommandsStaged;

export interface PreparedCommandsNoop {
  readonly kind: "noop";
  readonly result: StageCommandsCommitResult;
}

export interface PreparedCommandsStaged {
  readonly kind: "staged";
  readonly locations: ScopedLocations;
  /** Absolute path: `<extensionRoot>/commands-staging/<uuid>/`. */
  readonly stagingRoot: string;
  readonly result: StageCommandsCommitResult;
  /** Bridge-internal -- previous names to remove on commit (re-stage path). */
  readonly _previousNames: readonly string[];
  /** Bridge-internal -- per-file rename pairs applied at commit. */
  readonly _renamePairs: readonly { from: string; to: string }[];
}
```

**Input bundle** (`types.ts:32-51`) and **unstage input/result**
(`types.ts:119-129`) are the other two shapes to mirror:

```ts
export interface UnstageCommandsInput {
  readonly locations: ScopedLocations;
  readonly previousCommandNames: readonly string[];
}

export interface UnstageCommandsResult {
  readonly removedNames: readonly string[];
  readonly warnings: readonly string[];
}
```

`DiscoveredWorkflow` replaces `DiscoveredCommand` (`types.ts:23-30`) and must
carry `{ verdict, scriptFile, source }` — the source bytes are what make one
read serve both `install` and `info`.

---

### `bridges/workflows/index.ts` (barrel)

**Analog:** `bridges/commands/index.ts` — copy verbatim including the header
that explains why the underscore fields are withheld:

```ts
// bridges/commands/index.ts -- barrel re-export.
//
// The bridge-internal underscore-prefixed fields on PreparedCommandsStaged
// ... are intentionally NOT re-exported here ...

export { discoverPluginCommands } from "./discover.ts";
export {
  abortPreparedCommands,
  assertNoCommandCollisions,
  commitPreparedCommands,
  ...
} from "./stage.ts";
export { unstagePluginCommands } from "./unstage.ts";

export type { ... } from "./types.ts";
```

---

### `persistence/locations.ts` (persistence, config) — AMEND

**Analog:** the file itself. Two in-file patterns to copy.

**Field declaration + doc-comment style** (`locations.ts:73-89`) — every new
scalar member gets a doc comment naming the literal path and the requirement ID:

```ts
  /**
   * `<extensionRoot>/plugin-clones/` -- D-77-03 / NFR-10 source-addressed
   * plugin-clone cache root. Sibling of `sourcesDir` / `sources-staging` /
   * `cacheDir`; same-FS with `sources-staging/` so tmp+rename stays atomic
   * (NFR-1). Hard-coded suffix on `extensionRoot`; no name input participates
   * at this layer.
   */
  readonly pluginClonesDir: string;
```

**Name-bearing chokepoint method** (`locations.ts:248-259`) — `workflowArtifactPath`
copies this shape exactly (`assertSafeName` → `path.join` → `assertPathInside`):

```ts
    async pluginCloneDir(key: string): Promise<string> {
      // SC-7 / D-15 / NFR-10 / D-77-03: mirror the sourceCloneDir chokepoint
      // exactly. ... gate through assertSafeName for symmetry and
      // defense-in-depth before path.join, then assertPathInside on the
      // resulting leaf against pluginClonesDir.
      assertSafeName(key, `pluginCloneDir clone key "${key}"`);
      const candidate = path.join(pluginClonesDir, key);
      await assertPathInside(pluginClonesDir, candidate, `pluginCloneDir(${key})`);
      return candidate;
    },
```

The suffixed-leaf variant is `pluginCacheFile` (`locations.ts:268-277`), which
is closer still because it appends a `.json` extension:

```ts
    async pluginCacheFile(marketplace: string): Promise<string> {
      assertSafeName(marketplace, `pluginCacheFile marketplace name "${marketplace}"`);
      const candidate = path.join(cacheDir, "plugins", `${marketplace}.json`);
      await assertPathInside(cacheDir, candidate, `pluginCacheFile(${marketplace})`);
      return candidate;
    },
```

**Factory-body construction** (`locations.ts:144-181`) — the new bases are added
here. `scopeRoot` branches on scope at line 145; the workflows saved dir is the
first member that branches on scope for a **non-`scopeRoot`** base:

```ts
export function locationsFor(scope: Scope, cwd: string): ScopedLocations {
  const scopeRoot = scope === "user" ? getAgentDir() : path.join(cwd, ".pi");

  const extensionRoot = path.join(scopeRoot, "pi-claude-marketplace");
  ...
  const pluginClonesDir = path.join(extensionRoot, "plugin-clones");
```

**The comment that must be extended** (`locations.ts:182-191`) — it currently
asserts every field is a hard-coded suffix, which the project key is not:

```ts
  // T-03-04 disposition: every new field above (including hooksDir per
  // HOOK-01 / D-57-03) is constructed from `extensionRoot` joined to a
  // HARD-CODED suffix; no untrusted name components participate. ...
  // We do not call assertPathInside here because (a) it is async and
  // locationsFor is sync (callers like loadState/saveState rely on the
  // sync shape), and (b) the suffix-only construction makes a containment
  // escape impossible at this layer.
```

The amendment must state why the derived project key is still escape-proof (the
sanitizer's `[a-z0-9._-]` class plus the `^-+|-+$` strip and `|| "project"`
fallback make `.` and `..` unreachable).

**Frozen-bundle registration** (`locations.ts:192-214`) — new members are added
to the `Object.freeze({...})` literal in the same order as the interface.

---

### `domain/workflow-project-key.ts` (domain, transform) — NEW

**Analog:** `domain/name.ts:102-140` — a pure exported function plus a private
helper, with the load-bearing rule transcribed into the doc comment:

```ts
export function generatedWorkflowName(plugin: string, source: string): string {
  const generated = generatedColonName(plugin, source);
  assertSafeSavedWorkflowName(generated);
  return generated;
}

/**
 * WNAM-06 / SC-4: the two clauses of the host engine's saved-workflow-name rule
 * that RN-2 does not carry. The engine's rule reads:
 *
 *     name.length > 0 && ...
 */
function assertSafeSavedWorkflowName(name: string): void {
```

Copy that discipline: transcribe the engine's `sanitizePathSegment` /
`workflowProjectKey` source into the header, then state the two load-bearing
orderings (dash-strip before slice; `resolve()` before `basename()`). Imports
are `node:crypto` + `node:path` only — `domain/` may import `shared/` and
`platform/` and nothing else (ESLint BLOCK C).

---

### `platform/workflow-home.ts` (platform seam, config) — NEW

**Analog:** `platform/pi-api.ts:15` — the one-line `getAgentDir` re-export that
`locations.ts:19,145` consumes as its single import site:

```ts
export { getAgentDir } from "@earendil-works/pi-coding-agent";
```

Position is the pattern, not the body: one function, one import site
(`persistence/locations.ts`). The new module imports **no** Pi package, so
ESLint BLOCK E (only `pi-api.ts` may import `@earendil-works/pi-coding-agent`)
is not engaged. Module-level mutable override precedent is
`shared/completion-cache.ts`.

---

### `orchestrators/plugin/install.ts` (orchestrator, transactional) — AMEND

**Analog:** the file itself, four anchors.

**1. `InstallCtx` fields** (`install.ts:388-409`) — add `workflowsPrep?` beside
the other prep handles and `stagedWorkflowNames` beside the other name arrays:

```ts
  // Prep handles populated by each phase.do before that phase's commit.
  // Each phase.undo reads the matching handle to call the bridge unstage*
  // primitive. The matching handle is undefined when the phase did not run.
  skillsPrep?: PreparedSkillsStaging;
  commandsPrep?: PreparedCommandsStaging;
  agentsPrep?: PreparedAgentsStaging;
  mcpPrep?: PreparedMcpStaging;
  ...
  // Names captured for PluginInstallRecord.resources and reload-hint composition.
  stagedSkillNames: readonly string[];
  stagedCommandNames: readonly string[];
  stagedAgentNames: readonly string[];
  stagedMcpServerNames: readonly string[];
  // Aggregated soft warnings from the bridges (e.g. agents bridge cleanup leaks).
  bridgeWarnings: string[];
```

**2. The phase object** (`install.ts:1111-1143`) — `mcpPhase` is the exact
structural model: prep handle assigned on `c` before commit, names harvested
from the commit result, warnings pushed to `bridgeWarnings`, undo gated on the
prep handle being defined:

```ts
  const mcpPhase: Phase<InstallCtx> = {
    name: "mcp",
    do: async (c) => {
      const prep = await prepareStageMcpServers({ ... });
      c.mcpPrep = prep;
      const result = await commitPreparedMcp(prep);
      c.stagedMcpServerNames = result.recorded.map((r) => r.generatedName);
      // MCP staging soft warnings ... ride the same bridgeWarnings channel
      // as the other bridges' leak strings instead of being dropped.
      c.bridgeWarnings.push(...result.warnings);
    },
    undo: async (c) => {
      if (c.mcpPrep === undefined) {
        return;
      }

      await unstageMcpServers({
        locations: c.locations,
        marketplaceName: c.marketplace,
        pluginName: c.plugin,
      });
    },
  };
```

**3. The literal phases array** (`install.ts:1235-1246`) — append one element
between `mcpPhase` and `statePhase`; the header comment's declared sequence must
be updated in the same edit:

```ts
  // D-01 literal-array; order is part of the contract -- never refactor
  // to a dynamic builder. D-63-01: hooks slot lands between agents and mcp.
  // The PRD-fixed sequence is
  // [skills, commands, agents, hooks, mcp, state].
  const phases: readonly Phase<InstallCtx>[] = [
    skillsPhase,
    commandsPhase,
    agentsPhase,
    hooksPhase,
    mcpPhase,
    statePhase,
  ];
```

**4. The state record's `resources` literal** (`install.ts:1202-1217`) — if
`resources.workflows` lands in this phase, it is added here alongside the
`hooks` arm, whose comment shows the required rationale density:

```ts
        resources: {
          skills: [...c.stagedSkillNames],
          prompts: [...c.stagedCommandNames],
          agents: [...c.stagedAgentNames],
          mcpServers: [...c.stagedMcpServerNames],
          // HOOK-02 / D-57-01: additive required field. ...
          hooks: c.resolved.hooksConfigPath === undefined ? [] : [c.plugin],
        },
```

`statePhase` carries **no** `undo` by design (`install.ts:1229-1233`), which is
why a `statePhase` throw is the only live path that exercises the workflows
phase's `undo`.

---

### `orchestrators/plugin/info.ts` (orchestrator, read-only) — AMEND

**Analog:** the file itself.

**The `.js`-only strip to replace** (`info.ts:275-291`):

```ts
function nameFromEntry(
  entry: { name: string; isDirectory(): boolean; isFile(): boolean },
  kind: "skills" | "commands" | "agents" | "workflows",
): string | undefined {
  if (kind === "skills") {
    return entry.isDirectory() ? entry.name : undefined;
  }

  // commands + agents: `.md` files; workflows: `.js` files (WFLW-01). ...
  const suffix = kind === "workflows" ? ".js" : ".md";
  return entry.isFile() && entry.name.endsWith(suffix)
    ? entry.name.slice(0, -suffix.length)
    : undefined;
}
```

**Sort contract the bridge path must reproduce** (`info.ts:318-336`) — the
renderer assumes pre-sorted input:

```ts
async function discoverComponentNames(
  pluginRoot: string,
  componentDirs: readonly string[],
  kind: "skills" | "commands" | "agents" | "workflows",
): Promise<readonly string[]> {
  const names = new Set<string>();
  ...
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
```

**The call site to swap** (`info.ts:677-708`) — note `composeResolvedComponents`
has no plugin name today; the `resolved` bag is the parameter to widen:

```ts
async function composeResolvedComponents(
  pluginRoot: string,
  resolved: {
    readonly componentPaths: {
      readonly skills: readonly string[];
      readonly commands: readonly string[];
      readonly agents: readonly string[];
      readonly workflows: readonly string[];
    };
    readonly mcpServers: Record<string, unknown>;
    readonly hooksConfigPath?: string;
  },
): Promise<{ ... }> {
  ...
  const workflows = await discoverComponentNames(
    pluginRoot,
    resolved.componentPaths.workflows,
    "workflows",
  );
```

The bridge-backed replacement must be wrapped in try/catch —
`admitWorkflowScript` throws on an unsafe plugin name at
`domain/workflow-script.ts:129` — falling back to the existing
`discoverComponentNames(..., "workflows")` behavior.

---

### `persistence/state-io.ts` + `persistence/migrate.ts` (persistence, CRUD) — AMEND (conditional)

**Analog:** the `hooks` additive-with-fill precedent, in-file.

**Schema member** (`state-io.ts:119-125`) — a new required array joins the
literal; the doc block at `state-io.ts:63-72` is where the migration note goes:

```ts
  resources: Type.Object({
    skills: Type.Array(Type.String()),
    prompts: Type.Array(Type.String()),
    agents: Type.Array(Type.String()),
    mcpServers: Type.Array(Type.String()),
    hooks: Type.Array(Type.String()),
  }),
```

**Default-fill that must run before validation** (`migrate.ts:134-139`) — copy
this arm exactly:

```ts
    // HOOK-02 / D-57-01: additive default-fill for the new required
    // `resources.hooks` field. Mirrors the agents / mcpServers arms
    // above; STATE_VALIDATOR.Check would reject a record missing this
    // field, so the default-fill MUST run before validation.
    if (resources.hooks === undefined) {
      resources.hooks = [];
      mutated = true;
    }
```

---

## Shared Patterns

### Path containment (NFR-10 / SC-7)

**Source:** `shared/path-safety.ts:77-101`
**Apply to:** every path composition in `bridges/workflows/*` and every new
`locations.ts` method.

```ts
export async function assertPathInside(
  parent: string,
  child: string,
  label: string,
): Promise<void> {
```

The boundary is an **argument** — there is no global root registry. "NFR-10
learns a new root" means new hard-coded bases on the bundle plus one
`assertPathInside`-guarded method, exactly as `pluginCloneDir` does.

### Staging cleanup and leak accumulation

**Source:** `shared/fs-utils.ts:38-50`
**Apply to:** `bridges/workflows/stage.ts` (prepare catch, commit catch, abort).

```ts
export async function cleanupStaging(dir: string, label: string): Promise<string | undefined> {
  try {
    await rm(dir, { recursive: true, force: true });
    return undefined;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return undefined;
    }

    return `failed to clean up ${label} at ${dir}: ${errorMessage(err)}`;
  }
}
```

Pair with `appendLeakToError(err, leak)` on the prepare path
(`bridges/commands/stage.ts:262`) and `appendLeaks(err, leaks[])` on the commit
path (`bridges/commands/stage.ts:348-351`), both from `shared/errors.ts`.

### ENOENT-tolerant unlink (NFR-3 idempotence)

**Source:** `bridges/commands/unstage.ts:25-35` and `stage.ts:313-319`
**Apply to:** `unstagePluginWorkflows` and the previous-name removal in
`commitPreparedWorkflows`.

```ts
    try {
      await unlink(target);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        throw err;
      }
    }
```

### `Object.freeze` on every returned collection

**Source:** `bridges/commands/discover.ts:116-119`, `stage.ts:276-283`,
`unstage.ts:38-41`
**Apply to:** every `bridges/workflows/*` return value.

### Typed errors

**Source:** `shared/errors.ts` / `shared/errors-bridges.ts` — `extends Error`,
`this.name = "<ClassName>"` in the constructor, readonly structured fields, doc
comment citing the requirement ID. `WorkflowNameCollision` already exists in
`shared/errors.ts` (imported at `domain/workflow-script.ts:32`), so Phase 103
likely adds no new error class.

### Comment discipline

**Source:** `.claude/rules/typescript-comments.md`
**Apply to:** every new file. Cite `WBRG-01`, `WPTH-05`, `D-14`, `NFR-10`,
`SC-7`; never `Phase 103`, `Plan NN`, `Wave N`, bare `Pitfall N`/`Pattern N`.

---

## No Analog Found

None. Every file in this phase has a same-role, same-data-flow analog in the
repository. Two files have a partial-analog caveat the planner should carry:

| File | Caveat |
|------|--------|
| `platform/workflow-home.ts` | `pi-api.ts:15` supplies the *position* (single import site, platform layer) but not the body — there is no existing module-level relocation seam in `platform/`; the mutable-override precedent is `shared/completion-cache.ts`, a different layer. |
| `bridges/workflows/stage.ts` | The commands analog covers every aspect except the staging **location**. No existing bridge stages outside `<extensionRoot>`, so the "staging root is a sibling of the target" property has no in-repo precedent and needs its own test. |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/{bridges,domain,persistence,platform,orchestrators,shared}/`
**Files read this session:** `bridges/commands/{discover,stage,unstage,types,index}.ts`,
`persistence/{locations.ts, state-io.ts (schema block), migrate.ts (fill block)}`,
`orchestrators/plugin/install.ts` (ctx / mcpPhase / statePhase / phases array),
`orchestrators/plugin/info.ts` (nameFromEntry / discoverComponentNames /
composeResolvedComponents), `domain/workflow-script.ts` (verdict union +
`admitWorkflowScript`), `domain/name.ts` (`generatedWorkflowName`),
`shared/fs-utils.ts` (`cleanupStaging`), `platform/pi-api.ts` (`getAgentDir`)
**Pattern extraction date:** 2026-08-15
