# Phase 63: Lifecycle Cascade, User-Facing Surface & Docs - Pattern Map

**Mapped:** 2026-06-16
**Files analyzed:** 18 (new + modified)
**Analogs found:** 18 / 18

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `bridges/hooks/stage.ts` (NEW) | bridge | file-I/O (atomic write) | `bridges/mcp/stage.ts` + `bridges/mcp/unstage.ts` | role-match (single-file vs multi-file/marker) |
| `bridges/hooks/index.ts` (MOD) | barrel | re-exports | `bridges/mcp/index.ts` | exact |
| `orchestrators/plugin/install.ts` (MOD) | orchestrator | request-response (Phase ledger) | `install.ts:579-800` self | exact (extend literal-array) |
| `orchestrators/plugin/update.ts` (MOD) | orchestrator | hand-rolled cascade | `update.ts:753-784` prepare loop + Phase 3a commit loop ~1263-1295 | exact (mirror slot) |
| `orchestrators/plugin/reinstall.ts` (MOD) | orchestrator | hand-rolled parallel cascade | `reinstall.ts:1226-1254` parallel-prepare | exact (mirror slot) |
| `orchestrators/plugin/uninstall.ts` (MOD) | orchestrator | delegates to shared | (propagates through `cascadeUnstagePlugin`) | exact |
| `orchestrators/marketplace/shared.ts::cascadeUnstagePlugin` (MOD) | orchestrator helper | sequential unstage cascade | `shared.ts:316-380` self | exact (insert hooks between agents and mcp) |
| `orchestrators/plugin/info.ts::composeResolvedComponents` (MOD) | orchestrator | request-response | `info.ts:189-222` self | exact (re-parse hooks.json + return entries) |
| `domain/resolver.ts::applyHooksConfig` (MOD) | resolver | parse + flag | resolver `applyHooksConfig` site (`resolver.ts:693-712`) | exact (set `partial.orphanRewake`) |
| `shared/notify.ts` (5 seams, MOD) | shared types/renderer | type-driven render | `shared/notify.ts:72-104` REASONS + `:1041-1050` Components + `:2582-2611` renderer | exact |
| `docs/hooks.md` (NEW) | docs | reference | (no top-level docs/ doc exists yet — closest analog is `docs/messaging-style-guide.md` for tone/structure) | role-match |
| `README.md::## Hook support` (NEW section) | docs | reference | `README.md:130` `## Configuration files` + `README.md:171` `## /claude:plugin reference` | exact (heading style + placement sibling) |
| `docs/output-catalog.md` (MOD) | catalog/UAT | byte-equality fixture | existing `unsupported hooks` rows added in Phase 58 (D-58-01 supersession) | exact |
| `tests/architecture/catalog-uat.test.ts` (MOD) | test | byte-equality | existing `unsupported hooks` fixture rows | exact |
| `tests/bridges/hooks/stage.test.ts` (NEW) | test | unit | `tests/bridges/mcp/stage.test.ts` (assumed parallel) | role-match |
| `tests/bridges/hooks/symlink-escape.test.ts` (NEW) | test | unit | any existing `assertPathInside` symlink test | role-match |
| `tests/orchestrators/plugin/install.test.ts` (MOD) | test | unit | self (existing 5-phase fixture rows) | exact |
| `tests/shared/notify.test.ts` (MOD) | test | unit | self (existing `appendResolvedComponentLines` fixture) | exact |

## Pattern Assignments

### `bridges/hooks/stage.ts` (NEW — bridge, file-I/O)

**Analogs:**
- `bridges/mcp/stage.ts` (verb shape: `prepareStageMcpServers` / `commitPreparedMcp` / `abortPreparedMcp`)
- `bridges/mcp/unstage.ts` (verb shape: `unstageMcpServers`)
- `shared/atomic-json.ts::atomicWriteJson` (write mechanics)
- `shared/path-safety.ts::assertPathInside` (containment + symlink rejection)
- RESEARCH §"Pattern 4" lines 596-636 (verbatim walker example)

**Verb-naming recommendation (per RESEARCH Open Question 2):** Flatter pair `writeHookConfig` / `removeHookConfig` + private `assertNoSymlinkEscapeInHooksSubtree` helper. The 3-verb `prepareStageX` / `commitPreparedX` / `unstageX` pattern is justified only for multi-file staging.

**Containment idiom to replicate (`shared/path-safety.ts:77-101`, quoted RESEARCH Example 3):**
```typescript
export async function assertPathInside(parent: string, child: string, label: string): Promise<void>
// D-14 refuses ALL symlinks in the parent->child path
// D-15 single chokepoint; D-16 walks every parent segment
```

**Subtree walk skeleton to copy (RESEARCH §Pattern 4):**
```typescript
const hooksRoot = path.join(pluginRoot, "hooks");
const entries = await readdir(hooksRoot, { recursive: true, withFileTypes: true });
for (const entry of entries) {
  if (!entry.isSymbolicLink()) continue;
  const linkPath = path.join(entry.parentPath ?? hooksRoot, entry.name);
  const resolved = await realpath(linkPath);
  await assertPathInside(pluginRoot, resolved, `hooks subtree symlink ${linkPath}`);
}
```

**Atomic write pattern:** `await atomicWriteJson(<hooksDir>/<plugin>/hooks.json, parsedValue)`. Wrap parent path via `assertSafeName(plugin, ...)` + `path.join(locations.hooksDir, plugin, "hooks.json")`. Single helper `hookConfigPathFor(locations, plugin)` consumed BOTH by writer AND by existing `install.ts:340` hydrate read (RESEARCH Pitfall 11).

**Unstage pattern (D-63-02):** `rm -rf <hooksDir>/<plugin>/` via `fs.rm(path, { recursive: true, force: true })`. Idempotent.

---

### `bridges/hooks/index.ts` (MOD — barrel)

**Analog:** `bridges/mcp/index.ts` (full file, 39 lines). Match the comment block + `export {…} from "./stage.ts"` and `export type { … } from "./types.ts"` shape:
```typescript
export {
  abortPreparedMcp,
  commitPreparedMcp,
  // ...
  prepareStageMcpServers,
} from "./stage.ts";
export { unstageMcpServers } from "./unstage.ts";
```

Add the new `writeHookConfig` / `removeHookConfig` exports without re-exporting any private helper.

---

### `orchestrators/plugin/install.ts` — **5th cascade slot (Site #1 of 4)**

**Analog (self, install.ts:794-800):**
```typescript
const phases: readonly Phase<InstallCtx>[] = [
  skillsPhase,
  commandsPhase,
  agentsPhase,
  mcpPhase,
  statePhase,
];
```
**After (RESEARCH Example 1):** insert `hooksPhase` BEFORE `mcpPhase` (4th literal-array slot, between agents and mcp).

`hooksPhase.do` body (RESEARCH §Pattern 1 lines 487-507): symlink-walk gate → if `c.resolved.hooksConfigPath === undefined` return; → `atomicWriteJson(hookConfigPathFor(locations, plugin), parsedValue)` → set `c.hooksFileWritten = true`. `.undo` removes the dir if `hooksFileWritten`.

**Existing post-state-commit cache hydrate at `install.ts:331-361, 1020` (`addInstalledPluginHooksToCache`) is unchanged** — the new write site closes the loop the hydrate already expects.

**Orphan-rewake row composition:** install row composition reads `resolved.orphanRewake` (set in resolver, see below) and pushes `"orphan rewake"` into `reasons[]`.

---

### `orchestrators/plugin/update.ts` — **5th cascade slot (Site #2 of 4)**

**Analog (self, update.ts:753-784 prepare loop):**
```typescript
handles.skills = await prepareStageSkills({...});
handles.commands = await prepareStageCommands({...});
handles.agents = await prepareStagePluginAgents({...});
handles.mcp = await prepareStageMcpServers({...});
```
Hand-rolled (NOT `runPhases`). Phase 63 inserts `handles.hooks = await writeHookConfig({...})` (or staged equivalent) between `agents` and `mcp`. Also mirror in the Phase 3a commit loop at `update.ts:~1263-1295` (RESEARCH Pitfall 1 directs planner to grep `prepareStage` in update.ts).

---

### `orchestrators/plugin/reinstall.ts` — **5th cascade slot (Site #3 of 4)**

**Analog (self, reinstall.ts:1226-1254):**
```typescript
handles.skills    = await prepareStageSkills({...});      // line 1226
handles.commands  = await prepareStageCommands({...});     // line 1235
handles.agents    = await prepareStagePluginAgents({...}); // line 1244
handles.mcp       = await prepareStageMcpServers({...});   // line 1254
```
Insert `handles.hooks = await writeHookConfig({...})` between `agents` and `mcp`. Mirror the rollback path symmetrically.

Note `reinstall.ts:1117-1122` already opens `hooks.json` for post-state-commit hydrate; that path is unchanged.

---

### `orchestrators/plugin/uninstall.ts` — **5th cascade slot (Site #4 of 4) via shared**

Delegates to `cascadeUnstagePlugin`. No direct edit; the change lands in `orchestrators/marketplace/shared.ts`.

---

### `orchestrators/marketplace/shared.ts::cascadeUnstagePlugin` — sequential unstage cascade

**Analog (self, shared.ts:316-380, quoted):**
```typescript
const skillsResult = await unstagePluginSkills({...});       // line 330
dropped.skills = [...skillsResult.removedNames];
const cmdResult = await unstagePluginCommands({...});         // line 336
dropped.commands = [...cmdResult.removedNames];
const agentsResult = await unstagePluginAgents({...});        // line 342
dropped.agents = [...agentsResult.removedNames];
// (agents foreign-content guard at 349-364)
const mcpResult = await unstageMcpServers({...});             // line 366
dropped.mcpServers = [...mcpResult.removedNames];
```

**Phase 63 insertion (between agents foreign-content guard at line 365 and mcp at line 366):**
```typescript
const hooksResult = await removeHookConfig({ locations, pluginName: plugin });
dropped.hooks = [...hooksResult.removed];   // exact field shape per bridge return
```

**`UnstageOutcome.dropped` shape grows (shared.ts:289-301):** add `readonly hooks: readonly string[];` between `agents` and `mcpServers` (declaration order matches cascade order). Update both `Object.freeze` blocks (success + failure return paths at 373-389).

---

### `orchestrators/plugin/info.ts::composeResolvedComponents` (lines 189-222) — re-parse hooks.json

**Analog (self, lines 189-222 quoted above):** the function already discovers component names per kind. Phase 63 adds a hooks branch:

```typescript
// NEW conditional branch -- only when resolved.hooksConfigPath !== undefined
let hooks: readonly HookSummaryEntry[] | undefined;
if (resolved.hooksConfigPath !== undefined) {
  const raw = await readFile(path.join(pluginRoot, resolved.hooksConfigPath), "utf8");
  const parsed = parseHooksConfig(raw);   // existing domain helper
  if (parsed.ok) {
    hooks = projectHookSummaryEntries(parsed.value);   // new local helper
  }
  // ENOENT / parse failure: classify via narrowProbeError ladder per RESEARCH Pitfall 6
}

return {
  ...(agents.length > 0 && { agents }),
  ...(commands.length > 0 && { commands }),
  ...(hooks !== undefined && hooks.length > 0 && { hooks }),
  ...(mcp.length > 0 && { mcp }),
  ...(skills.length > 0 && { skills }),
};
```
**Critical:** the function signature's resolved-arg type must grow `readonly hooksConfigPath?: string;` so the orchestrator can pass it through. Return-type union grows `hooks?: readonly HookSummaryEntry[]`.

---

### `domain/resolver.ts::applyHooksConfig` (lines ~693-712) — orphan-rewake detection

**Analog (RESEARCH Example 6, recommended seam):**
```typescript
function detectOrphanRewake(parsed: HooksConfig): boolean {
  for (const groups of Object.values(parsed)) {
    for (const group of groups) {
      for (const handler of group.hooks) {
        const hasRewakeField =
          handler.rewakeMessage !== undefined || handler.rewakeSummary !== undefined;
        const asyncRewakeTrue = handler.asyncRewake === true;
        if (hasRewakeField && !asyncRewakeTrue) return true;
      }
    }
  }
  return false;
}
```
After `applyHooksConfig` sets `partial.hooksConfigPath`, also set `partial.orphanRewake = detectOrphanRewake(hooksResult.value)`. `ResolvedPlugin` interface grows `readonly orphanRewake?: boolean` (alphabetical placement).

---

### `shared/notify.ts` — 5 distinct seams

#### Seam 1: `REASONS` tuple (line 72-104)

**Analog (self, verbatim quoted above):** add `"orphan rewake"` as the LAST tuple member (after `"not added"`), per RESEARCH Example 2.

#### Seam 2: `ClaudeHookEvent` + `HookSummaryEntry` + `HookSummary` exports

**Analog source tuples (`domain/components/hook-events.ts:35-64`, RESEARCH Example 5):**
```typescript
export const BUCKET_A_EVENTS = ["SessionStart", "UserPromptSubmit", ...] as const;
export type BucketAEvent = (typeof BUCKET_A_EVENTS)[number];
export const TOOL_EVENTS = ["PreToolUse", "PostToolUse", "PostToolUseFailure"] as const;
export type ToolEvent = (typeof TOOL_EVENTS)[number];
```

**New exports in notify.ts (RESEARCH §Pattern 2):**
```typescript
import { BUCKET_A_EVENTS, TOOL_EVENTS, type BucketAEvent, type ToolEvent }
  from "../domain/components/hook-events.ts";

export type ClaudeHookEvent = BucketAEvent;

export type HookSummaryEntry =
  | { readonly event: ToolEvent; readonly matcher: string }
  | { readonly event: Exclude<ClaudeHookEvent, ToolEvent> };

export interface HookSummary { readonly entries: readonly HookSummaryEntry[]; }
```

#### Seam 3: `PluginInfoComponentsResolved.components.hooks?` (line 1041-1050)

**Analog (self, verbatim):**
```typescript
interface PluginInfoComponentsResolved {
  readonly componentsResolved: true;
  readonly components: {
    readonly agents?: readonly string[];
    readonly commands?: readonly string[];
    readonly mcp?: readonly string[];
    readonly skills?: readonly string[];
  };
  readonly dependencies?: readonly string[];
}
```
**Phase 63:** insert `readonly hooks?: readonly HookSummaryEntry[];` alphabetically (between `commands` and `mcp`).

#### Seam 4 + 5: `COMPONENT_KINDS` 4-tuple → 5-tuple + renderer arm (lines 2582-2612)

**Analog (self, quoted above + RESEARCH Example 4 verbatim transformation).** Tuple becomes:
```typescript
const COMPONENT_KINDS: readonly [
  ComponentKind, ComponentKind, ComponentKind, ComponentKind, ComponentKind
] = ["agents", "commands", "hooks", "mcp", "skills"];
```
Renderer body grows a `kind === "hooks"` `continue`-arm emitting multi-line block (D-63-04 / RESEARCH Example 4 lines 1112-1127):
```typescript
if (kind === "hooks") {
  const entries = components.hooks;
  if (entries !== undefined && entries.length > 0) {
    lines.push("    hooks:");
    for (const entry of entries) {
      if ("matcher" in entry) {
        lines.push(`      ${entry.event}(${entry.matcher})`);
      } else {
        lines.push(`      ${entry.event}`);
      }
    }
  }
  continue;
}
// existing single-line path for other kinds
```

The comment block at notify.ts:2575-2581 explaining the tuple-length contract MUST be updated from "4 entries" to "5 entries" (and the comment's "5th key" example becomes "6th key").

---

### `docs/hooks.md` (NEW — first-time-reader doc)

**Analogs:**
- `docs/messaging-style-guide.md` — closest existing top-level docs file for tone/voice baseline (plain prose, no jargon).
- Structure blueprint: **RESEARCH Example 8 (lines 1218-1307) is the binding template.** Headings:
  ```
  # Hook support
  ## How hooks run under Pi
  ## Supported events           (table of 8 events)
  ## Worked examples            (6 H3 subsections per D-63-11)
  ## Unsupported events
  ## Tool name mapping
  ## What happens to my plugin?
  ## Marketplace coverage
  ## Further reading
  ```

**Jargon guard (RESEARCH Pitfall 9):** grep the finished doc for `bucket`, `REQ-`, `Phase `, `D-`, `<lossy synthesis>`, `Pitfall`, `Pattern N` — all must return zero. Use Claude Code's verbatim field names only (`matcher`, `if`, `asyncRewake`, `timeout`, `command`, `args`).

**Cross-refs (D-63-10):** end-of-doc bullet list:
- `https://code.claude.com/docs/en/hooks`
- Pi extension API docs via `@mariozechner/pi-coding-agent` (name only, no URL per RESEARCH Assumption A7)

---

### `README.md` — NEW `## Hook support` section

**Analog (README.md existing top-level headings, verified via grep):**
```
## Features          (line 21)
## Prerequisites     (line 32)
## Usage             (line 38)
## Configuration files  (line 130)   <-- recommended sibling for placement
## /claude:plugin reference  (line 171)
## Contributing     (line 357)
## AI disclaimer    (line 361)
## License          (line 369)
```

**Voice template — quote from `## Configuration files` (README.md:130-139):**
> ## Configuration files
>
> Each scope stores its declarative marketplace and plugin configuration in `claude-plugins.json` under the scope root.
> ...

**Phase 63 `## Hook support` shape (one short paragraph + link, RESEARCH Example 7):**
```markdown
## Hook support

Claude Code plugins can ship hook handlers that fire on session events
and tool calls. This marketplace translates those hooks into Pi event
subscriptions so they run under Pi the same way they would under Claude
Code.

See [Hook support reference](docs/hooks.md) for the supported events,
worked examples, and a per-plugin compatibility guide.
```

**Heading style:** `## Hook support` (`##` not `#`; no `<details>` wrapper). Place AFTER `## Configuration files` and BEFORE `## /claude:plugin reference` (RESEARCH Pitfall 10 recommendation).

---

### `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` — atomic supersession

**Analog:** the Phase 58 `unsupported hooks` landing (D-58-01). Catalog rows for `unsupported hooks` already exist at lines 59, 136, 182, 301, 534, 750, 1144 — Phase 63 mirrors the same multi-row pattern for `orphan rewake`. The byte-equality fixture in `tests/architecture/catalog-uat.test.ts` adds the corresponding `(installed) {orphan rewake}` row(s).

**Lockstep constraint (Pitfall 8):** the REASONS tuple addition (Seam 1), `docs/output-catalog.md` rows, and the catalog-UAT fixture rows ALL land in the SAME commit. The byte-equality test fails in isolation otherwise.

## Shared Patterns

### Atomic JSON write
**Source:** `shared/atomic-json.ts::atomicWriteJson` (already wraps `write-file-atomic@^8` with fsync + concurrent-write queue).
**Apply to:** `bridges/hooks/stage.ts::writeHookConfig`.

### Path containment + symlink rejection
**Source:** `shared/path-safety.ts::assertPathInside` (lines 77-101, quoted RESEARCH Example 3).
**Apply to:** `bridges/hooks/stage.ts` (twice — once on write target containment within `hooksDir`; once per symlink entry in the subtree walk against `pluginRoot`).

### Closed-set REASONS rendering
**Source:** `shared/notify.ts::composeReasons` (existing; renders `{reason1, reason2}` brace composition).
**Apply to:** zero new code — the `"orphan rewake"` token rides the existing path; tuple addition alone wires it through.

### Discriminated-union exhaustiveness
**Source:** `shared/errors.ts::assertNever` + project D-01 / NFR-7 idiom.
**Apply to:** `HookSummaryEntry` switch in the renderer arm (the `"matcher" in entry` predicate is structurally exhaustive; no explicit `assertNever` needed because the union has only two arms and both render).

### Plugin-name safety
**Source:** `shared/fs-utils.ts::assertSafeName`.
**Apply to:** `bridges/hooks/stage.ts` before composing `<hooksDir>/<plugin>/hooks.json`.

### Single-notify-per-orchestrator (RECON-04 / IL-2)
**Source:** existing v1.4 NotificationMessage cascade (Phase 63 binds ZERO new `notify` call sites; the `orphan rewake` reason rides the install-cascade row).

### D-58-01 atomic-supersession (REASONS + catalog + fixture in one commit)
**Apply to:** the SURF-05 token landing.

## No Analog Found

| File | Role | Reason | Fallback |
|------|------|--------|----------|
| `docs/hooks.md` | first-time-reader narrative doc | No existing top-level docs/ doc has the "8-event reference + 6 worked examples + decision tree" shape | Use RESEARCH Example 8 as the binding template; tone-match `docs/messaging-style-guide.md`. |
| `tests/bridges/hooks/symlink-escape.test.ts` | unit (subtree walker) | No prior symlink-escape walker test; the existing `assertPathInside` tests cover only the leaf check | Build fixture: write `<tmpdir>/plugin/hooks/escape -> /etc` symlink, assert `writeHookConfig` rejects with `SymlinkRefusedError` (instance check). |

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/bridges/`, `extensions/pi-claude-marketplace/orchestrators/`, `extensions/pi-claude-marketplace/shared/`, `extensions/pi-claude-marketplace/domain/`, `docs/`, `README.md`.
**Files scanned:** ~20 via Read; ~30 via Grep landmark probes.
**Pattern extraction date:** 2026-06-16
