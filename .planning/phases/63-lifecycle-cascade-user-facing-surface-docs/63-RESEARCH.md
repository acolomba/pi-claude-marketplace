# Phase 63: Lifecycle Cascade, User-Facing Surface & Docs - Research

**Researched:** 2026-06-16
**Domain:** Bridge cascade integration + user-facing render surface + plain-English documentation
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Lifecycle cascade (LIFE-01..03):**

- **D-63-01 (5th bridge slot position):** Install Phase array is
  `[skills, commands, agents, hooks, mcp, state]`. Hooks slot between
  agents and mcp; state stays last per the existing D-01 literal-array
  discipline (state phase is pure in-memory mutation; PRD-fixed sequence
  has state at the tail). Slot position aligns with the SURF-01
  alphabetical render order so cascade-position and info-render-position
  are consistent. Update, reinstall, and uninstall orchestrators carry
  the same slot.
- **D-63-02 (direct atomic-write -- no staging dir):** The hooks bridge
  writes `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json`
  via single tmp+rename per the existing atomic-json pattern. Hooks have
  ONE file per plugin (vs N skills/commands/agents) -- the multi-file
  staging-tree pattern the agents bridge uses adds LoC for no real safety
  win. Commit = rename; unstage = `rm -rf` of `<hooksDir>/<plugin>/`.
  NFR-1 atomic; on rollback the file does not exist (idempotent).
- **D-63-03 (symlink-escape check -- subtree walk):** At install time
  the bridge walks `<pluginRoot>/hooks/` recursively. For each symlink
  entry, the bridge calls `fs.realpath` and asserts the resolved target
  stays inside `pluginRoot` via the existing `assertPathInside` helper.
  The first escape triggers a notify error via the existing
  PluginFailedMessage path and the ledger unwinds. Catches the actual
  threat (plugin shipping a symlinked-escape bundled script) without
  per-command-string token parsing. Absolute-path commands
  (`/usr/bin/prettier`), PATH-relative tokens (`prettier`, `npx`), and
  `${CLAUDE_PLUGIN_ROOT}/...` interpolations are all safe by
  construction.

**User-facing render surface (SURF-01, SURF-02, SURF-04, SURF-05):**

- **D-63-04 (info `hooks:` line shape -- multi-line block):** The info
  render produces:
  ```
      hooks:
        PreToolUse(Bash)
        PreToolUse(Edit|Write)
        PostToolUse(Edit)
        SessionStart
  ```
  Per-entry on its own line at 6-space indent (4 for `hooks:` header +
  2 for each entry). Tool events render as `<event>(<matcher>)`;
  non-tool events render as bare `<event>` (no parens). Declaration
  order from the parsed hooks.json is preserved.
- **D-63-05 (no inline handler-field flags):** The info render emits
  ONLY `event(matcher)`. `asyncRewake`, `timeout`, `if`, `args`,
  `shell`, `rewakeMessage`, `rewakeSummary` are NOT rendered inline
  with the entry.
- **D-63-06 (HookSummaryEntry discriminated by event class):**
  ```ts
  export type ClaudeHookEvent = (typeof BUCKET_A_EVENTS)[number];
  type HookSummaryEntry =
    | { event: ToolEvent; matcher: string }
    | { event: Exclude<ClaudeHookEvent, ToolEvent> };
  export interface HookSummary { readonly entries: readonly HookSummaryEntry[]; }
  ```
  Reuses Phase 58's `BUCKET_A_EVENTS` / `TOOL_EVENTS` tuples. Tool
  events statically REQUIRE a matcher; non-tool events statically
  CANNOT carry one. `assertNever` arm in the render switch pins
  exhaustiveness per NFR-7.
- **D-63-07 (carrier seam -- extend `components.hooks`):** The
  orchestrator passes the typed `HookSummary` entries into
  `PluginInfoComponentsResolved.components.hooks?: readonly HookSummaryEntry[]`
  -- a new optional sibling field on the existing components object.
  The renderer's `COMPONENT_KINDS` 4-tuple `["agents", "commands", "mcp", "skills"]`
  becomes a 5-tuple `["agents", "commands", "hooks", "mcp", "skills"]`
  (alphabetical). The `appendResolvedComponentLines` loop body switches
  on `kind === "hooks"` for the multi-line block format; every other
  kind keeps the existing single-line comma-join path.
- **D-63-08 (SURF-05 token wording -- `"orphan rewake"`):** New
  REASONS member is the literal string `"orphan rewake"`. Renders as
  `(installed) {orphan rewake}` per the existing reasons brace
  composition. One token added to the closed-set REASONS tuple, atomic
  with the catalog-UAT row addition per the D-58-01 atomic-supersession
  pattern. Detection: if any handler has `rewakeMessage` or
  `rewakeSummary` non-undefined AND `asyncRewake` is not `=== true`,
  the plugin gets the token. One row per plugin regardless of N orphan
  handlers.

**Documentation (SURF-06):**

- **D-63-09 (docs/hooks.md section ordering -- events-first):**
  1. Intro (one paragraph)
  2. Table of 8 supported events with plain-English descriptions
  3. 6 worked examples (all REQ candidates)
  4. Unsupported event groups with one-line reasons each
  5. Pi<->Claude tool-name mapping table + currently-unmapped Claude tools
  6. "What happens to my plugin?" section
  7. Marketplace coverage 10/13 note
  8. Cross-refs to the two authority docs
- **D-63-10 (authority docs cross-referenced):**
  - `code.claude.com/docs/en/hooks` (upstream field reference)
  - Pi extension API docs (peer-dep `@mariozechner/pi-coding-agent` --
    the published API reference)
- **D-63-11 (worked examples shipping -- all 6 REQ candidates):**
  Auto-formatter, bash-safety net, SessionStart rule injection, prompt
  audit log, background security review, compaction snapshot.

### Claude's Discretion

- Stage / commit / unstage function signatures (mcp-bridge verb pattern
  vs flatter `writeHookConfig` / `removeHookConfig`).
- `HookSummary` TypeBox runtime schema -- NOT added in v1.13
  (compile-time type only).
- Per-plugin hooks-subtree walk implementation (`fs.readdir({recursive})`
  vs hand-rolled).
- Orphan-rewake detection site -- resolver vs install orchestrator.
- README.md "Hook support" section placement (alphabetical near
  component-kind docs vs sibling of "Configuration files").
- Per-event description wording in docs/hooks.md (plain English).
- Per-worked-example doc length (~15-30 lines each).
- catalog-UAT row landing -- atomic with REASONS token addition per
  D-58-01.

### Deferred Ideas (OUT OF SCOPE)

- **SURF-03** install-time `<lossy synthesis>` warnings (v1.14+ bucket-D)
- Standalone `/claude:plugin hooks <plugin>` command (perma-deferred
  per SURF-04)
- `list` hook-count column (perma-deferred per SURF-04)
- Per-handler info render flags `[async]` / `[timeout: 30s]` (v1.14+)
- `HookSummary` runtime schema validator (v1.14+)
- Cross-plugin orphan-rewake aggregation (v1.14+)
- Hook author scaffolder (v1.14+)
- i18n for docs/hooks.md (IL-1, post-v1.x)
- In-line catalog cross-link from docs/hooks.md to output-catalog.md
  (v1.14+)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID      | Description                                                                                                                                                            | Research Support                                                                                                                                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LIFE-01 | 5th bridge slot in cascade (plan/stage/unstage/discover mirrors existing shape); install/uninstall/update/reinstall orchestrators add the hooks phase row.             | Standard Stack §"Phase ledger"; Architecture §"5-slot Phase literal-array discipline"; Code Examples §1 (install.ts:579-800 verbatim shape).                                                                                  |
| LIFE-02 | Hook install/uninstall emits a plugin row through the existing v1.4 `NotificationMessage` model; existing reload-hint cascade triggers; NO new top-level notify pattern. | Standard Stack §"shared/notify.ts"; Architecture §"Single-notify-per-orchestrator (RECON-04 / IL-2)"; Code Examples §2 (state-phase resources.hooks already added in Phase 57).                                                |
| LIFE-03 | `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json` containment; `fs.realpath` + `assertPathInside(<pluginRoot>, realpath)` rejects symlinked escapes at install. | Standard Stack §"shared/path-safety.ts"; Code Examples §3 (assertPathInside verbatim); Common Pitfalls §"assertPathInside already refuses ALL symlinks (D-14) -- LIFE-03 walk is the deeper layer, not a replacement". |
| SURF-01 | `info <plugin>` renders multi-line `hooks:` block between `commands` and `mcp`; unavailable plugins still render `components: not resolved`.                            | Standard Stack §"orchestrators/plugin/info.ts"; Architecture §"PluginInfoMessage discriminated union"; Code Examples §4 (info.ts:189-222 + notify.ts:2582-2611 verbatim).                                                      |
| SURF-02 | `HookSummary` discriminated model + `ClaudeHookEvent` closed-set tuple in `shared/notify.ts`; all UI surfaces consume `HookSummary` (no string re-derivation).          | Standard Stack §"discriminated-union exhaustiveness"; Code Examples §5 (BUCKET_A_EVENTS + TOOL_EVENTS verbatim).                                                                                                               |
| SURF-03 | NOT in v1.13 (reserved for v1.14+ bucket-D promotion); planner must NOT ship synthesis-caveat warnings.                                                                | Don't Hand-Roll §"synthesis-caveat warning"; Deferred Ideas (perma-deferred for v1.13).                                                                                                                                       |
| SURF-04 | `list` does NOT add a hook-count column; NO standalone `/claude:plugin hooks <plugin>` command.                                                                        | Don't Hand-Roll §"new top-level commands"; Architecture §"explicit non-additions".                                                                                                                                            |
| SURF-05 | One install-time warning when `rewakeMessage` or `rewakeSummary` declared without `asyncRewake: true`. Plugins with `asyncRewake: true` install normally with no warning. | Standard Stack §"REASONS closed-set tuple"; Architecture §"D-58-01 atomic-supersession (closed-set REASONS + catalog-UAT lockstep)"; Code Examples §6 (orphan-rewake detection).                                              |
| SURF-06 | `docs/hooks.md` exists, linked from README.md, plain-English first-time-reader doc (no internal jargon, no REQ-IDs, no phase numbers).                                 | Architecture §"docs/hooks.md content blueprint"; Common Pitfalls §"jargon leakage"; Code Examples §7 (`README.md` existing top-level sections).                                                                                |

</phase_requirements>

## Summary

Phase 63 is the v1.13 closeout phase. It does NOT introduce new
architectural patterns -- every seam it touches already exists. The
work is a coordinated extension across six existing surfaces:

1. **Cascade-slot extension** (LIFE-01): the existing 5-element Phase
   literal-array `[skillsPhase, commandsPhase, agentsPhase, mcpPhase, statePhase]`
   in `orchestrators/plugin/install.ts:794-800` becomes a 6-element
   array `[skillsPhase, commandsPhase, agentsPhase, hooksPhase, mcpPhase, statePhase]`.
   The hand-rolled cascade in `update.ts` / `reinstall.ts` mirror this
   gain. `cascadeUnstagePlugin` in
   `orchestrators/marketplace/shared.ts:316-380` gains a hooks unstage
   call between agents and mcp.
2. **Bridge implementation** (LIFE-02 / LIFE-03): new
   `bridges/hooks/stage.ts` exports stage/commit/unstage. Writes
   `<hooksDir>/<plugin>/hooks.json` via existing `atomicWriteJson`
   from `shared/atomic-json.ts`. At stage time, walks
   `<pluginRoot>/hooks/` recursively and rejects any symlink whose
   `fs.realpath` escapes `pluginRoot` via existing
   `assertPathInside(pluginRoot, realpath, label)` from
   `shared/path-safety.ts`. The existing `addInstalledPluginHooksToCache`
   in `install.ts:331-361` already runs AFTER the new stage write
   succeeds (the post-state-commit hydrate path) -- Phase 63 does NOT
   re-implement cache wiring.
3. **info `hooks:` line** (SURF-01 / SURF-02 / SURF-07): the
   `PluginInfoComponentsResolved.components` interface
   (`shared/notify.ts:1041-1050`) gains `hooks?: readonly HookSummaryEntry[]`.
   The `COMPONENT_KINDS` 4-tuple becomes 5-tuple (alphabetical:
   agents, commands, hooks, mcp, skills). The
   `appendResolvedComponentLines` loop (`shared/notify.ts:2597-2612`)
   grows a `kind === "hooks"` arm emitting the multi-line block.
4. **`HookSummary` discriminated model** (SURF-02): new exports in
   `shared/notify.ts` -- `ClaudeHookEvent` (re-export of
   `(typeof BUCKET_A_EVENTS)[number]` from
   `domain/components/hook-events.ts`), `HookSummaryEntry` discriminated
   by `event: ToolEvent` (carries `matcher: string`) vs
   `event: Exclude<ClaudeHookEvent, ToolEvent>` (no matcher), and
   `HookSummary` interface wrapping `readonly HookSummaryEntry[]`.
5. **`orphan rewake` REASON** (SURF-05): one new member added to the
   `REASONS` closed-set tuple (`shared/notify.ts:72-104`). The
   detection seam is Claude's Discretion (resolver vs install
   orchestrator). The token addition lands in lockstep with new
   `docs/output-catalog.md` row(s) + `tests/architecture/catalog-uat.test.ts`
   fixture(s) per D-58-01.
6. **docs/hooks.md + README.md section** (SURF-06): new doc file +
   new `## Hook support` top-level section in README.md. Plain-English
   first-time-reader content. Two cross-refs: upstream
   `code.claude.com/docs/en/hooks` and the peer-dep
   `@mariozechner/pi-coding-agent` API docs.

**Primary recommendation:** Plan as a single phase with 5-6 sequential
plans (foundation -> bridge -> orchestrator wiring -> render seam ->
warning token -> docs). Each plan touches a distinct file family with
narrow byte-equality blast radius; the catalog-UAT lockstep MUST be
the LAST atomic landing per plan that introduces a new REASONS token
or new render shape (D-58-01 atomic-supersession). The phase contains
ZERO architecturally novel work -- every helper, validator, atomic-write
helper, containment guard, discriminated-union renderer, and
closed-set token mechanism it consumes already exists and is exercised
by previous milestones.

## Architectural Responsibility Map

| Capability                                | Primary Tier                       | Secondary Tier                  | Rationale                                                                                                                                                                  |
| ----------------------------------------- | ---------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cascade slot ordering                     | Orchestrator (plugin/install.ts)   | Transaction (phase-ledger.ts)   | D-01 literal-array discipline; PRD-fixed sequence is part of the type.                                                                                                     |
| Hook file write (atomic)                  | Bridge (bridges/hooks/stage.ts)    | Shared (shared/atomic-json.ts)  | Reuses existing `atomicWriteJson` (write-file-atomic@^8). Bridge owns the staging verb; shared owns the tmp+rename+fsync mechanics.                                       |
| Containment + symlink-escape rejection    | Bridge (bridges/hooks/stage.ts)    | Shared (shared/path-safety.ts)  | `assertPathInside` is the single chokepoint (D-15). Bridge calls it after `fs.realpath` on each subtree entry.                                                            |
| Cache hydrate post-write                  | Orchestrator (plugin/install.ts)   | Bridge (bridges/hooks/event-router.ts) | Existing `addInstalledPluginHooksToCache` (`install.ts:331-361`) already runs post-state-commit; no changes needed.                                                |
| Render: `hooks:` block in info            | Shared (shared/notify.ts)          | Orchestrator (plugin/info.ts)   | Renderer owns line format; orchestrator owns the typed payload (`HookSummary` entries from parsed `hooks.json`).                                                          |
| `HookSummary` type + closed-set events    | Shared (shared/notify.ts)          | Domain (domain/components/hook-events.ts) | Type lives on the message-type boundary so all UI surfaces consume the same shape. Closed-set tuple imported from existing domain module.                       |
| `orphan rewake` REASONS token + detection | Shared (shared/notify.ts) + Orchestrator (plugin/install.ts OR domain/resolver.ts) | Test (catalog-UAT fixture)      | Closed-set token addition lands in shared; detection seam is Claude's Discretion (orchestrator keeps resolver pure; resolver placement keeps install lean).                |
| docs/hooks.md + README.md link            | Docs (docs/hooks.md, README.md)    | --                              | Pure documentation; no code seam.                                                                                                                                          |
| Catalog UAT lockstep                      | Docs (docs/output-catalog.md)      | Test (tests/architecture/catalog-uat.test.ts) | D-58-01 atomic-supersession: source token addition + catalog row + byte-equality fixture land in one commit.                                                |

## Standard Stack

### Core
| Library / Module                              | Version             | Purpose                                                                              | Why Standard                                                                                                     |
| --------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `write-file-atomic` (via `shared/atomic-json.ts`) | `^8.0.0` (already a runtime dep) | Tmp+rename+fsync for `<plugin>/hooks.json`                                                                  | NFR-1 atomic-write; already used by `state.json` / `mcp.json` / `agents-index.json` writes.                       |
| `node:fs/promises` (built-in)                 | Node >= 22.22.2     | Subtree walk via `readdir({recursive:true, withFileTypes:true})`; `realpath` resolution | Built-in; no dep added. `readdir({recursive:true})` requires Node 20.13+ (we're on 22.22.2 floor per write-file-atomic). |
| `node:path` (built-in)                        | bundled             | `path.join` for `<hooksDir>/<plugin>/hooks.json` composition                          | Built-in.                                                                                                        |
| `typebox` (existing dep)                      | `^1.1.38`           | NOT used for `HookSummary` (compile-time type only per Claude's Discretion)            | Already a runtime peer dep; deliberately NOT extended in v1.13.                                                  |

### Supporting
| Module / Helper                              | Already Exists?       | Purpose                                                                                                                                                                                                | When to Use                                                                                                                                                                                |
| -------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `atomicWriteJson` (`shared/atomic-json.ts:24`) | YES                   | `await atomicWriteJson(filePath, value)` -- mkdir-p parent, write-file-atomic with fsync                                                                                                              | Hooks bridge's `commitHook` verb writes `<plugin>/hooks.json` via this.                                                                                                                    |
| `assertPathInside` (`shared/path-safety.ts:77`) | YES                   | Walks every parent segment, refuses ALL symlinks (`SymlinkRefusedError`)                                                                                                                              | Hooks bridge calls it inside the subtree walk AFTER `fs.realpath` resolves each symlink entry.                                                                                             |
| `assertSafeName` (`shared/fs-utils.ts`)      | YES                   | Refuses `/`, `\`, `.`, `..`, ASCII control chars in name inputs                                                                                                                                       | Hooks bridge calls it on the plugin name before joining to `hooksDir`.                                                                                                                     |
| `BUCKET_A_EVENTS` + `TOOL_EVENTS` (`domain/components/hook-events.ts:35-64`) | YES                   | Closed-set tuples for `ClaudeHookEvent` discriminator                                                                                                                                                  | `shared/notify.ts` re-exports `(typeof BUCKET_A_EVENTS)[number]` as `ClaudeHookEvent`.                                                                                                     |
| `parseHooksConfig` (`domain/components/hooks.ts:273-320`) | YES                   | JSON.parse + HOOKS_VALIDATOR.Check + supportability gate + optional if-predicate map                                                                                                                  | Hooks bridge re-uses this to validate the parsed config before staging; install orchestrator's `addInstalledPluginHooksToCache` already calls it on hydrate.                              |
| `notify` (`shared/notify.ts`)                | YES                   | The IL-2 single chokepoint; all user-visible messages route through it                                                                                                                                 | Phase 63 binds ZERO new `notify` call sites -- new tokens ride existing PluginNotificationMessage cascade.                                                                                  |
| `errorMessage` (`shared/errors.ts`)          | YES                   | Extract `.message` from unknown errors                                                                                                                                                                 | If new diagnostic strings are needed in the orphan-rewake or symlink-escape paths.                                                                                                          |
| `assertNever` (`shared/errors.ts`)           | YES                   | NFR-7 exhaustiveness check                                                                                                                                                                              | Default arm of `HookSummaryEntry` discriminator switch; default arm of `kind === "hooks"` switch in `appendResolvedComponentLines` (already present pattern).                              |
| Phase ledger `runPhases` (`transaction/index.ts`) | YES                   | Runs `[Phase<C>]` array with do/undo unwind                                                                                                                                                            | `install.ts` uses this; `update.ts` / `reinstall.ts` use a HAND-ROLLED 3-phase swap and NOT runPhases (D-03 heterogeneous-undo precedent). Planner MUST mirror the slot in BOTH styles.    |

### Alternatives Considered
| Instead of                              | Could Use                                                | Why standard wins                                                                                                                                            |
| --------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mirror agents bridge two-phase commit   | `bridges/hooks/<staging-uuid>/hooks.json` + tree rename  | Hooks have ONE file per plugin (vs N agents). Multi-file staging adds LoC for no real safety win (D-63-02 user choice).                                  |
| Per-command-string token parse + realpath | Walk `pluginRoot/hooks/` subtree                       | Per-command parse misses transitive `source ./helper.sh` from inside scripts. Subtree walk catches the actual threat (bundled symlinked-escape script).  |
| Single-line `hooks:` comma-join         | Multi-line block `hooks:\n  event(matcher)\n  ...`     | Hook entries carry more structure than name atoms; long matcher patterns become unreadable in single-line form (D-63-04 user choice).                    |
| Standalone `notify` call for SURF-05    | New REASONS token on existing install cascade row      | RECON-04 / IL-2: single notify per orchestrator. The v1.3 string-API failure mode the v1.4 model fixed.                                                  |
| `node:fs realpath` synchronous          | `fs.promises.realpath` (async)                          | Whole codebase is async; sync FS in an async context blocks the event loop.                                                                              |
| TypeBox runtime schema for HookSummary  | Compile-time TypeScript type only                       | The orchestrator builds `HookSummary` from already-validated parsed `hooks.json` -- there is no separate ingest path. Adding a validator is dead code.    |

**Installation:** No new runtime deps. All consumed helpers already exist.

**Version verification (already in package.json — verified 2026-06-16):**
```bash
npm view write-file-atomic version   # 8.0.0 (installed)
npm view typebox version             # 1.1.38 (installed)
npm view @mariozechner/pi-coding-agent version  # 0.73.1+ (installed)
node --version                       # v22.22.2 (>= 22.22.2 NFR floor)
```

## Package Legitimacy Audit

> **Not required for this phase.** Phase 63 adds ZERO new external
> packages. All work consumes existing helpers from already-installed
> deps. No `npm install` step lands in this phase.

| Package           | Already Installed?     | Verdict | Disposition         |
| ----------------- | ----------------------- | ------- | ------------------- |
| write-file-atomic | YES (v8.0.0)           | OK      | Reused unchanged    |
| typebox           | YES (v1.1.38)          | OK      | NOT extended in v1.13 (Claude's Discretion) |
| @mariozechner/pi-coding-agent | YES (peer ^0.73.1)         | OK      | No version change   |

## Architecture Patterns

### System Architecture Diagram

```
                         ┌────────────────────────────────┐
                         │ /claude:plugin install <p>@<m> │
                         └──────────────┬─────────────────┘
                                        ▼
                  ┌──────────────────────────────────────────┐
                  │   orchestrators/plugin/install.ts        │
                  │   installPlugin -> runInstallLedger      │
                  │                                          │
                  │   resolveStrict (already discovers       │
                  │   hooks/hooks.json via                   │
                  │   readStandaloneHooks)                   │
                  └──────────────┬───────────────────────────┘
                                 │
                                 ▼
       ┌─────────────────────────────────────────────────────────┐
       │   runPhases([                                            │
       │     skillsPhase,                                         │
       │     commandsPhase,                                       │
       │     agentsPhase,                                         │
       │     hooksPhase,         <-- NEW 5th slot (LIFE-01)       │
       │     mcpPhase,                                            │
       │     statePhase                                           │
       │   ], ctx)                                                │
       └─────────────────────────────────────────────────────────┘
                                 │
                                 ▼
        ┌──────────────────────────────────────────────────┐
        │   hooksPhase.do:                                  │
        │     1. walkHooksSubtree(pluginRoot/hooks/)        │
        │        - readdir({recursive:true})                │
        │        - per symlink: fs.realpath + assertPathInside  │
        │        - throws SymlinkRefusedError on escape     │
        │     2. parseHooksConfig (re-validate)             │
        │     3. atomicWriteJson(                           │
        │          <hooksDir>/<plugin>/hooks.json, raw)     │
        │   hooksPhase.undo:                                │
        │     rm -rf <hooksDir>/<plugin>/                   │
        └──────────────────────────────────────────────────┘
                                 │
                                 ▼
        ┌──────────────────────────────────────────────────┐
        │   statePhase.do (UNCHANGED):                      │
        │     resources.hooks = c.resolved.hooksConfigPath  │
        │                       !== undefined ? [c.plugin]  │
        │                       : []                        │
        │   (already added in Phase 57 / D-57-01)           │
        └──────────────────────────────────────────────────┘
                                 │
                                 ▼
        ┌──────────────────────────────────────────────────┐
        │   POST-STATE-COMMIT (UNCHANGED):                  │
        │     addInstalledPluginHooksToCache               │
        │     (install.ts:331-361 already reads & parses   │
        │     the just-written hooks.json into the bridge's │
        │     in-memory cache; routing tables rebuild)      │
        └──────────────────────────────────────────────────┘
                                 │
                                 ▼
        ┌──────────────────────────────────────────────────┐
        │   notify(ctx, pi, NotificationMessage with        │
        │     marketplaces:[{ plugins:[                     │
        │       { state: "installed",                       │
        │         reasons?: ["orphan rewake"] }   <-- SURF-05 │
        │     ]}])                                          │
        │   -> existing v1.4 cascade -> reload-hint trailer │
        └──────────────────────────────────────────────────┘

                       SEPARATE READ-ONLY SURFACE
                       --------------------------
                  /claude:plugin info <p>@<m>
                                 │
                                 ▼
        ┌──────────────────────────────────────────────────┐
        │   orchestrators/plugin/info.ts                    │
        │   buildBlock(...) -> PluginInfoMessage            │
        │     plugin.components.hooks?: HookSummaryEntry[] │ <-- NEW (SURF-01)
        └──────────────┬───────────────────────────────────┘
                       ▼
        ┌──────────────────────────────────────────────────┐
        │   shared/notify.ts                                │
        │     COMPONENT_KINDS = [agents, commands,          │
        │       "hooks", mcp, skills]   <-- 5-tuple         │
        │     appendResolvedComponentLines switches on      │
        │     kind === "hooks" -> multi-line block          │
        │     (D-63-04):                                    │
        │         hooks:                                    │
        │           PreToolUse(Bash)                        │
        │           PostToolUse(Edit)                       │
        │           SessionStart                            │
        └──────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
extensions/pi-claude-marketplace/
├── bridges/
│   └── hooks/
│       ├── stage.ts                 # NEW -- walk + atomic write + unstage
│       ├── index.ts                 # MODIFIED -- export stage/commit/unstage verbs
│       └── (existing dispatch/event-router/etc. UNCHANGED)
├── orchestrators/
│   ├── plugin/
│   │   ├── install.ts               # MODIFIED -- add hooksPhase to literal-array
│   │   ├── update.ts                # MODIFIED -- mirror slot in hand-rolled 3-phase swap
│   │   ├── reinstall.ts             # MODIFIED -- mirror slot in hand-rolled cascade
│   │   ├── uninstall.ts             # MODIFIED -- mirror slot via cascadeUnstagePlugin
│   │   └── info.ts                  # MODIFIED -- emit components.hooks payload
│   └── marketplace/
│       └── shared.ts                # MODIFIED -- cascadeUnstagePlugin gains hooks unstage call
├── shared/
│   └── notify.ts                    # MODIFIED -- 5 distinct seams (see Integration Points)
└── domain/
    └── components/
        └── hook-events.ts           # UNCHANGED -- already locks BUCKET_A_EVENTS / TOOL_EVENTS

docs/
├── hooks.md                         # NEW -- first-time-reader doc
└── output-catalog.md                # MODIFIED -- new (installed) {orphan rewake} row(s)

tests/
├── bridges/hooks/
│   ├── stage.test.ts                # NEW
│   └── symlink-escape.test.ts       # NEW
├── orchestrators/plugin/
│   ├── install.test.ts              # MODIFIED -- 5th slot, orphan-rewake fixture
│   └── info.test.ts                 # MODIFIED -- multi-line hooks: block fixture
├── shared/
│   └── notify.test.ts               # MODIFIED -- hooks: block + HookSummary discriminator
└── architecture/
    └── catalog-uat.test.ts          # MODIFIED -- new (installed) {orphan rewake} row(s)

README.md                            # MODIFIED -- new ## Hook support section
```

### Pattern 1: D-01 Literal-Array Phase Discipline (LIFE-01)

**What:** The install/update/reinstall/uninstall orchestrators
hand-write the cascade as a literal array of `Phase<C>` values; never
a dynamic builder. The PRD-fixed sequence is part of the TYPE.

**When to use:** Adding a slot to the cascade. The 4-slot
`[skills, commands, agents, mcp]` order becomes 5-slot
`[skills, commands, agents, hooks, mcp]` -- hooks slots BEFORE mcp
(not after) per D-63-01 (alphabetical info-render symmetry; state stays
last per state-is-pure-in-memory-tail convention).

**Example (verbatim from `install.ts:577-800`):**
```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:577-800
const skillsPhase: Phase<InstallCtx> = {
  name: "skills",
  do: async (c) => { /* prepareStageSkills + commitPreparedSkills */ },
  undo: async (c) => { /* unstagePluginSkills if commit succeeded */ },
};

// ... (commandsPhase, agentsPhase same shape)

const mcpPhase: Phase<InstallCtx> = { name: "mcp", do: ..., undo: ... };

const statePhase: Phase<InstallCtx> = {
  name: "state",
  do: async (c) => {
    /* ... existing in-memory mutation ... */
    mpInner.plugins[c.plugin] = {
      version: c.version,
      resources: {
        skills: [...c.stagedSkillNames],
        prompts: [...c.stagedCommandNames],
        agents: [...c.stagedAgentNames],
        mcpServers: [...c.stagedMcpServerNames],
        hooks: c.resolved.hooksConfigPath !== undefined ? [c.plugin] : [],
      },
      // ...
    };
  },
  // undo intentionally absent (mutation discarded on guard unwind)
};

// D-01 literal-array; order is part of the contract -- never refactor
// to a dynamic builder. The PRD-fixed sequence is
// [skills, commands, agents, mcp, state].
const phases: readonly Phase<InstallCtx>[] = [
  skillsPhase,
  commandsPhase,
  agentsPhase,
  mcpPhase,
  statePhase,
];
```

**Phase 63 transformation:**
```typescript
const hooksPhase: Phase<InstallCtx> = {
  name: "hooks",
  do: async (c) => {
    // 1. Walk pluginRoot/hooks/ -- reject symlink-escapes
    await assertNoSymlinkEscape(c.resolved.pluginRoot);
    // 2. Re-parse hooks.json from disk (defensive; resolver already did)
    //    -- skipped if c.resolved.hooksConfigPath === undefined (no hooks)
    if (c.resolved.hooksConfigPath === undefined) return;
    // 3. Atomic write <hooksDir>/<plugin>/hooks.json
    const hooksFilePath = path.join(
      c.locations.hooksDir, c.plugin, "hooks.json"
    );
    await atomicWriteJson(hooksFilePath, parsedHooksValue);
    c.hooksFileWritten = true;
  },
  undo: async (c) => {
    if (!c.hooksFileWritten) return;
    await rm(path.join(c.locations.hooksDir, c.plugin), { recursive: true, force: true });
  },
};

const phases: readonly Phase<InstallCtx>[] = [
  skillsPhase,
  commandsPhase,
  agentsPhase,
  hooksPhase,       // <-- 4th position (between agents and mcp)
  mcpPhase,
  statePhase,
];
```

### Pattern 2: Discriminated `HookSummaryEntry` (SURF-02)

**What:** A discriminated union keyed on `event` class -- tool events
statically require a `matcher`; non-tool events statically cannot
carry one. The default arm hits `assertNever` per NFR-7.

**When to use:** Defining the typed `HookSummary` payload that flows
from orchestrator (info.ts) -> message-type (PluginInfoMessage) ->
renderer (`appendResolvedComponentLines` `kind === "hooks"` arm).

**Example:**
```typescript
// Source: D-63-06 / domain/components/hook-events.ts:35-64
// In shared/notify.ts:
import { BUCKET_A_EVENTS, TOOL_EVENTS, type BucketAEvent, type ToolEvent }
  from "../domain/components/hook-events.ts";

export type ClaudeHookEvent = BucketAEvent;

export type HookSummaryEntry =
  | { readonly event: ToolEvent; readonly matcher: string }
  | { readonly event: Exclude<ClaudeHookEvent, ToolEvent> };

export interface HookSummary {
  readonly entries: readonly HookSummaryEntry[];
}

// Renderer arm in appendResolvedComponentLines (NEW):
function appendHooksBlock(
  lines: string[],
  entries: readonly HookSummaryEntry[],
): void {
  if (entries.length === 0) return;
  lines.push("    hooks:");
  for (const entry of entries) {
    if ("matcher" in entry) {
      // ToolEvent arm
      lines.push(`      ${entry.event}(${entry.matcher})`);
    } else {
      // Non-tool-event arm (assertNever discriminator pinned by the type)
      lines.push(`      ${entry.event}`);
    }
  }
}
```

### Pattern 3: D-58-01 Atomic Catalog-UAT Lockstep (SURF-05)

**What:** Closed-set REASONS token additions and catalog-UAT fixture
rows land in the SAME COMMIT. The source rename and the catalog row
are never out of step.

**When to use:** Adding `"orphan rewake"` to the REASONS tuple.

**Example:**
```typescript
// Source: shared/notify.ts:72-104 (verbatim, will be extended)
export const REASONS = [
  "up-to-date",
  "not found",
  // ...
  "not added",
  "orphan rewake",  // <-- NEW token (SURF-05 / D-63-08)
] as const;
```

**Lockstep landing:**
1. Source: `shared/notify.ts` -- new tuple member
2. Catalog: `docs/output-catalog.md` -- new `(installed) {orphan rewake}` row(s)
3. Fixture: `tests/architecture/catalog-uat.test.ts` -- byte-equality row(s)
4. Detection: `domain/resolver.ts` OR `orchestrators/plugin/install.ts`
   -- pick one site per Claude's Discretion

ALL FOUR land in the SAME commit. The byte-equality test will fail in
isolation if any are missing.

### Pattern 4: `assertPathInside` Subtree Walk (LIFE-03)

**What:** The existing `assertPathInside` already refuses ALL symlinks
in the path FROM `parent` DOWN TO `child` (D-14 / D-16). For LIFE-03
we need to ADD a recursive walk over `<pluginRoot>/hooks/` content
(not just the leaf path) so a symlink BURIED INSIDE the subtree is
caught BEFORE the bridge writes anything.

**When to use:** Inside `hooksPhase.do` before any disk write to the
hooks-bridge area.

**Example:**
```typescript
// NEW in bridges/hooks/stage.ts (or co-located helper):
import { readdir, realpath } from "node:fs/promises";
import path from "node:path";

import { assertPathInside } from "../../shared/path-safety.ts";

export async function assertNoSymlinkEscapeInHooksSubtree(
  pluginRoot: string,
): Promise<void> {
  const hooksRoot = path.join(pluginRoot, "hooks");
  let entries;
  try {
    entries = await readdir(hooksRoot, { recursive: true, withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return; // No hooks subtree -- nothing to check.
    throw err;
  }

  for (const entry of entries) {
    if (!entry.isSymbolicLink()) continue;
    const linkPath = path.join(entry.parentPath ?? hooksRoot, entry.name);
    const resolved = await realpath(linkPath);
    // Throws SymlinkRefusedError if the resolved target escapes pluginRoot.
    // Inherits PathContainmentError so PI-14 handling propagates.
    await assertPathInside(pluginRoot, resolved, `hooks subtree symlink ${linkPath}`);
  }
}
```

**Note:** `assertPathInside` will itself throw `SymlinkRefusedError`
when walking from `pluginRoot` to `resolved` if any intermediate
segment is a symlink. The combination of (a) catching symlinks at
container creation via the walk + (b) `assertPathInside`'s
parent-segment check on the resolved target gives belt-and-suspenders
coverage matching D-63-03.

### Component Responsibilities

| File                                                              | Responsibility                                                                                 | Phase 63 Change                                                                                                                                                  |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bridges/hooks/stage.ts`                                          | Atomic write `<plugin>/hooks.json`; symlink-escape subtree walk; unstage `<plugin>/` directory | NEW file. Hosts `stageHook` / `commitHook` / `unstageHook` (or `writeHookConfig` / `removeHookConfig` -- Claude's Discretion).                                  |
| `bridges/hooks/index.ts`                                          | Public re-exports for stage/commit/unstage                                                     | MODIFIED -- add new exports.                                                                                                                                     |
| `orchestrators/plugin/install.ts`                                 | 6-element phase array; post-state-commit hydrate                                               | MODIFIED -- add `hooksPhase` between `agentsPhase` and `mcpPhase` in `phases: readonly Phase<InstallCtx>[]` (lines 794-800). Compose `HookSummary` for cascade row IF orphan-rewake detection lives here. |
| `orchestrators/plugin/update.ts`                                  | 3-phase HAND-ROLLED swap (D-03)                                                                | MODIFIED -- mirror slot in the prepare loop (lines 753-784) and the Phase 3a commit loop (lines 1263-1295). NOT runPhases.                                       |
| `orchestrators/plugin/reinstall.ts`                               | Cascade in hand-rolled prepare path                                                            | MODIFIED -- mirror slot in `handles.skills`/`commands`/`agents`/`mcp` parallel pattern (lines 1226-1254).                                                         |
| `orchestrators/plugin/uninstall.ts`                               | Delegates to `cascadeUnstagePlugin`                                                            | MODIFIED -- no direct code change in this file; the change propagates through `cascadeUnstagePlugin`.                                                            |
| `orchestrators/marketplace/shared.ts`                             | Hosts `cascadeUnstagePlugin` (D-02 hand-rolled per-plugin cascade)                              | MODIFIED -- add `unstagePluginHooks` call between agents and mcp (lines 316-380). The `UnstageOutcome.dropped` shape grows a `hooks` field.                       |
| `orchestrators/plugin/info.ts`                                    | Builds `PluginInfoMessage` per scope                                                           | MODIFIED -- `composeResolvedComponents` returns `hooks?: readonly HookSummaryEntry[]` derived from re-parsing `<pluginRoot>/hooks/hooks.json` (path source only). |
| `shared/notify.ts`                                                | Single source of truth for message types + renderer + REASONS                                  | MODIFIED -- 5 distinct seams: (1) REASONS tuple += "orphan rewake"; (2) `ClaudeHookEvent` re-export; (3) `HookSummaryEntry` + `HookSummary`; (4) `components.hooks?` field; (5) `COMPONENT_KINDS` 4-tuple -> 5-tuple + `appendResolvedComponentLines` arm. |
| `domain/components/hook-events.ts`                                | Closed-set tuples for bucket-A events                                                          | UNCHANGED -- re-exported by notify.ts.                                                                                                                           |
| `domain/components/hooks.ts`                                      | `parseHooksConfig` + HOOKS_VALIDATOR                                                            | UNCHANGED -- re-used by stage.ts and info.ts.                                                                                                                    |
| `domain/resolver.ts`                                              | Discovers `hooks/hooks.json`; sets `partial.hooksConfigPath`                                    | MODIFIED IF orphan-rewake detection lives here (Claude's Discretion). Adds an `orphanRewake: boolean` flag on `partial`/`ResolvedPlugin`.                         |
| `shared/atomic-json.ts`                                           | `atomicWriteJson(filePath, value)`                                                              | UNCHANGED -- re-used by stage.ts.                                                                                                                                |
| `shared/path-safety.ts`                                           | `assertPathInside` + `SymlinkRefusedError`                                                      | UNCHANGED -- re-used by stage.ts's subtree walker.                                                                                                                |
| `persistence/locations.ts`                                        | `hooksDir` field already declared (D-57-03)                                                     | UNCHANGED.                                                                                                                                                       |
| `docs/hooks.md`                                                   | First-time-reader doc                                                                          | NEW.                                                                                                                                                             |
| `docs/output-catalog.md`                                          | Authoritative catalog of every renderable row                                                  | MODIFIED -- new `(installed) {orphan rewake}` row(s) per SURF-05.                                                                                                 |
| `README.md`                                                       | Project landing doc                                                                            | MODIFIED -- new `## Hook support` top-level section linking to `docs/hooks.md`.                                                                                  |
| `tests/architecture/catalog-uat.test.ts`                          | Byte-equality catalog conformance gate                                                         | MODIFIED -- new fixture(s) for the SURF-05 row.                                                                                                                  |

### Anti-Patterns to Avoid

- **Refactoring the literal Phase array to a dynamic builder.** The
  D-01 / PRD-fixed sequence is encoded in the TYPE. A dynamic builder
  removes the compile-time gate that catches "I forgot to add hooks to
  the uninstall cascade" -- a class of bug Phase 56's `COMPONENT_KINDS`
  literal-tuple-length pattern was explicitly introduced to prevent.
- **Adding a second `notify` call site for SURF-05.** RECON-04 / IL-2
  forbid this. The orphan-rewake row token rides the existing cascade.
- **Surfacing handler-field detail in `info` (asyncRewake, timeout,
  if, args).** D-63-05 explicitly omits these. Plugin authors read
  source `hooks.json`; end users don't need them.
- **Wrapping `read` I/O failures with `malformed hooks.json:` prefix.**
  WR-02 (D-58 review) reverted this -- I/O errors now propagate so
  `narrowProbeError` emits the truthful `{permission denied}` /
  `{unreadable}` Reason.
- **Mirroring the agents-bridge two-phase commit for a single-file
  artifact.** Hooks have ONE file per plugin. The staging-tree pattern
  adds LoC without safety benefit (D-63-02 user choice).
- **Mixing internal jargon into `docs/hooks.md`.** No `bucket-A`,
  `bucket-D`, `REQ-IDs`, `phase numbers`, `<lossy synthesis>` markers,
  `Pitfall N` references, or `D-XX-NN` decision IDs in the doc.
- **Inserting a `Pitfall N` or `Phase XX` reference in any comment or
  test title.** See `.claude/rules/typescript-comments.md` -- code
  comments record `what`/`why`, not GSD process history. Decision IDs
  (`D-63-01`, `LIFE-01`, etc.) are allowed as traceability anchors.
- **Re-deriving hook event strings inside the renderer at render
  time.** The v1.3 string-API failure mode that the v1.4 type-driven
  refactor closed. Use `HookSummaryEntry.event` directly.

## Don't Hand-Roll

| Problem                                          | Don't Build                                          | Use Instead                                                                                              | Why                                                                                                                                                                                                |
| ------------------------------------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Atomic JSON write                                | Hand-rolled `fs.writeFile(tmp) + fs.rename`         | `atomicWriteJson` from `shared/atomic-json.ts`                                                           | Already wraps `write-file-atomic` with fsync + concurrent-write queue; consumes mkdir-p; the existing pattern across state.json/mcp.json/agents-index.json.                                       |
| Path containment + symlink rejection             | Per-bridge containment helper                       | `assertPathInside(parent, child, label)` from `shared/path-safety.ts`                                    | D-15 single chokepoint; D-14 refuses all symlinks; throws `SymlinkRefusedError` (subclass of `PathContainmentError`) so PI-14 instanceof handling propagates automatically.                       |
| Closed-set REASONS token rendering               | Per-token rendering branch                           | `composeReasons(reasons, false, false, probe)`                                                          | Existing helper already emits `{reason}` brace + multi-reason comma-join; the `"orphan rewake"` token wires through it with zero code change beyond the tuple addition.                          |
| Hook config parsing                              | Re-implement JSON schema check                       | `parseHooksConfig` from `domain/components/hooks.ts`                                                    | Identical validator + supportability gate + `if`-predicate compile already used by resolver and post-state-commit hydrate path. Skipping the existing parser would diverge from D-58-03.         |
| Bridge cache hydrate post-write                  | Re-invent in-memory cache wiring                     | `addInstalledPluginHooksToCache` (`install.ts:331-361`) already runs post-state-commit                  | Existing helper reads the just-written hooks.json and populates the bridge's parsed-config cache; routing tables rebuild without `/reload` (NFR-2).                                              |
| Plugin name safety                               | Custom name sanitizer                                | `assertSafeName(name, label)` from `shared/fs-utils.ts`                                                  | Rejects `/`, `\`, `.`, `..`, ASCII control chars before composing `<hooksDir>/<plugin>/hooks.json`.                                                                                              |
| `info` per-kind rendering                        | New per-kind branch outside renderer                | Extend `appendResolvedComponentLines` (`shared/notify.ts:2597-2612`) with a `kind === "hooks"` arm    | Single seam already enumerates `COMPONENT_KINDS`; the tuple-length-derived type check enforces exhaustiveness. Adding a parallel renderer creates two sources of truth.                          |
| Synthesis-caveat install warning (SURF-03)       | `<lossy synthesis>` install-time marker family       | NOTHING -- this REQ is explicitly deferred to v1.14+                                                    | Bucket-A events have no documented loss modes. The REQ-slot exists in REQUIREMENTS.md but DOES NOT ship in v1.13.                                                                                |
| Standalone `/claude:plugin hooks <plugin>` cmd  | New top-level command + edge handler                | `info <plugin>` already surfaces hooks                                                                  | SURF-04 explicitly forbids. Symmetry with the four existing component types -- each plugin line stays terse.                                                                                     |
| `list` hook-count column                         | New column on list output                            | NOTHING -- omit                                                                                          | SURF-04 explicitly forbids. Symmetry with the four existing component types.                                                                                                                     |
| HookSummary runtime validator                    | TypeBox runtime schema                               | TypeScript type only                                                                                    | The orchestrator builds `HookSummary` from already-validated parsed `hooks.json`. There is no separate ingest path. Runtime validator would be dead code.                                       |
| Multi-line `hooks:` block per-line emission      | Direct string concat                                 | `lines.push(...)` -- matches existing renderer pattern                                                  | The renderer already accumulates `lines: string[]` and joins at the end; the multi-line arm matches the established style.                                                                       |

**Key insight:** Phase 63 is almost entirely a coordinated extension
across existing seams. Every helper, validator, atomic-write helper,
containment guard, discriminated-union renderer, and closed-set token
mechanism it consumes already exists and is exercised by previous
milestones. The only NET-NEW machinery is the `bridges/hooks/stage.ts`
file (with `assertNoSymlinkEscapeInHooksSubtree` + atomic write +
unstage verb). Everything else is an addition to an existing literal,
an additional renderer arm, an additional message-type field, or a
documentation file.

## Runtime State Inventory

> Phase 63 introduces NEW disk state (`<hooksDir>/<plugin>/hooks.json`)
> via a new bridge stage path. This section documents what other
> runtime state surfaces this affects.

| Category                    | Items Found                                                                                                                                                                                                            | Action Required                                                                                                                                                                                              |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stored data                 | `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json` -- net-new file written by Phase 63's stage.ts. Already in NFR-10 containment scope per `persistence/locations.ts:81 hooksDir`.                          | New code edit -- bridge writes the file via `atomicWriteJson`. No data migration needed (no prior Phase wrote this file; the resolver's `hooksConfigPath` was non-binding until now).                       |
| Stored data                 | `state.json::marketplaces.<mp>.plugins.<plugin>.resources.hooks: string[]` -- already populated by `statePhase` in `install.ts:776` per Phase 57 D-57-01.                                                              | None -- existing seam already writes the inventory entry.                                                                                                                                                    |
| Live service config         | None.                                                                                                                                                                                                                  | None -- v1.13 is local-only; no external service registration.                                                                                                                                               |
| OS-registered state         | None.                                                                                                                                                                                                                  | None -- no OS-level registration in scope.                                                                                                                                                                   |
| Secrets/env vars            | None.                                                                                                                                                                                                                  | None -- no env-var contract changes. `CLAUDE_PROJECT_DIR` and `${CLAUDE_PLUGIN_ROOT}` are documented in docs/hooks.md but ALREADY honored by Phase 60's exec layer.                                          |
| Build artifacts             | None.                                                                                                                                                                                                                  | None -- no compiled binary or installed-package artifact embeds the new state.                                                                                                                               |
| In-memory caches            | `bridges/hooks/event-router.ts` parsed-config cache -- already hydrated by `addInstalledPluginHooksToCache` (`install.ts:331-361`).                                                                                    | None for stored-state; the post-state-commit hydrate is the EXISTING seam that closes the install->disk->cache loop. Phase 63's new stage.ts write makes the existing read site finally have something to read. |
| Catalog UAT fixtures        | `docs/output-catalog.md` rows referenced by `tests/architecture/catalog-uat.test.ts` byte-equality.                                                                                                                    | Code edit -- new `(installed) {orphan rewake}` rows added in lockstep with REASONS token addition per D-58-01.                                                                                              |

## Common Pitfalls

### Pitfall 1: Updating only `install.ts` and missing the hand-rolled cascades

**What goes wrong:** Planner adds `hooksPhase` to `install.ts:794-800`
but forgets that `update.ts` (line 753-784 prepare loop + line 1263-1295
Phase 3a commit loop) and `reinstall.ts` (line 1226-1254 parallel
prepare) use a HAND-ROLLED cascade -- NOT runPhases. The 5th slot
exists for install only; update/reinstall lose hooks data on every
re-install.

**Why it happens:** Three distinct cascade implementations:
- `install.ts` uses `runPhases([...])` (transaction primitive)
- `update.ts` uses hand-rolled 3-phase swap (D-03 / D-02 heterogeneous-undo)
- `reinstall.ts` uses hand-rolled parallel-prepare cascade
- `uninstall.ts` delegates to `cascadeUnstagePlugin` (in
  `orchestrators/marketplace/shared.ts:316-380`)

**How to avoid:** Plan tasks PER-FILE, not per-flow. Add hooks slot to
ALL FOUR sites in lockstep:
1. `orchestrators/plugin/install.ts` (literal-array)
2. `orchestrators/plugin/update.ts` (prepare loop + Phase 3a)
3. `orchestrators/plugin/reinstall.ts` (parallel-prepare)
4. `orchestrators/marketplace/shared.ts` `cascadeUnstagePlugin` (uninstall + update recovery + reinstall recovery)

**Warning signs:** Integration test exercising "install plugin with hooks
-> update plugin -> hooks.json absent from <hooksDir>" passes locally but
fails in CI. Or a manual `/reload` after update silently drops hook
routing.

### Pitfall 2: assertPathInside already refuses ALL symlinks

**What goes wrong:** Planner assumes LIFE-03 needs to ADD symlink
rejection. In fact `assertPathInside` (D-14 / D-16) ALREADY refuses
any symlink in any segment from `parent` down to `child`. The LIFE-03
walk is the DEEPER layer (a symlink BURIED inside the subtree, where
`assertPathInside` would never be called).

**Why it happens:** The REQ wording says
"`assertPathInside(<pluginRoot>, realpath)`" which implies adding the
check at install time. The check IS there for the install-side write
(stage.ts writes `<hooksDir>/<plugin>/hooks.json` and must
`assertPathInside(hooksDir, <leaf>)`). What's NEW is the SUBTREE WALK
over `<pluginRoot>/hooks/` to catch buried symlinks BEFORE the bridge
ever touches the file.

**How to avoid:** Two distinct check sites:
1. **Write-side containment (existing pattern):**
   `assertPathInside(hooksDir, "<plugin>/hooks.json", "...")` on the
   write target inside stage.ts (NFR-10).
2. **Read-side subtree walk (NEW):** Iterate
   `readdir(<pluginRoot>/hooks/, {recursive:true, withFileTypes:true})`,
   `fs.realpath` each symlink entry, `assertPathInside(pluginRoot, realpath, ...)`
   for each one.

**Warning signs:** A test fixture that ships a symlink inside
`hooks/` pointing to `/etc/shadow` is silently accepted because the
write-side check only verified the leaf path -- never opened the
subtree.

### Pitfall 3: HOOK-04 is already done

**What goes wrong:** Planner adds the `"hooks"` -> `"unsupported hooks"`
REASONS rename to Phase 63 scope, then discovers it's already in the
`REASONS` tuple at `shared/notify.ts:81` (added in Phase 58 per D-58-01).
The catalog already uses the renamed token (`docs/output-catalog.md:182, 301, 534, 750, 1144`).

**Why it happens:** The Phase 63 success criteria mention HOOK-04 in
the historical context. CONTEXT.md is explicit: HOOK-04 closed in
Phase 58.

**How to avoid:** Treat HOOK-04 as DONE. The only REASONS-tuple change
this phase makes is ADDING `"orphan rewake"` (SURF-05 / D-63-08).

**Warning signs:** A task in the plan reads "rename `hooks` to
`unsupported hooks` in REASONS tuple". Stop -- it's already renamed.

### Pitfall 4: SURF-03 must NOT ship

**What goes wrong:** Planner reads "SURF-03 install-time `<lossy
synthesis>` warnings" and tries to ship the marker family. SURF-03 is
the REQ-slot reserved for v1.14+ bucket-D events; v1.13 ships ZERO
synthesis-caveat warnings.

**Why it happens:** REQ-IDs in the phase scope can include
"reserved" / "deferred" entries that look superficially actionable.

**How to avoid:** SURF-03's only "action" in Phase 63 is to verify
that NOTHING related to `<lossy synthesis>` markers ships. The phase
plan MUST NOT introduce any LOSSY_SYNTHESIS-style closed-set token,
any markdown carve-out for synthesis caveats, or any docs/hooks.md
language that implies synthesis warnings are coming.

**Warning signs:** Plan task adds a new closed-set token starting with
`lossy` or `synthesis`. Plan task introduces a new install-arm warning
emission outside the orphan-rewake row.

### Pitfall 5: Re-deriving hook strings in the renderer at render time

**What goes wrong:** Renderer arm in `appendResolvedComponentLines`
takes a `readonly HooksConfig` object (raw schema) and re-derives
event names + matcher strings inline. This was the v1.3 string-API
failure mode the v1.4 type-driven NotificationMessage refactor closed.

**Why it happens:** It's tempting to pass the raw parsed object since
the orchestrator already has it.

**How to avoid:** The renderer consumes `readonly HookSummaryEntry[]`
ONLY. The orchestrator (info.ts) does the schema -> `HookSummaryEntry`
projection ONCE at message construction. The discriminator `event:
ToolEvent | Exclude<ClaudeHookEvent, ToolEvent>` makes the renderer's
switch statically exhaustive; default arm hits `assertNever`.

**Warning signs:** Test fixture asserts the renderer accepts a
`HooksConfig` instead of a `HookSummary`. Or: rendered output for the
same fixture diverges between two parallel call sites (info.ts and
install.ts cascade row).

### Pitfall 6: Forgetting that info.ts must re-parse hooks.json from disk

**What goes wrong:** info.ts wants to render `HookSummaryEntry[]` but
the resolver discards `parsedHooksConfig.value` -- it only saves
`partial.hooksConfigPath` (`domain/resolver.ts:707`). So info.ts must
re-open `<pluginRoot>/hooks/hooks.json`, re-parse it via
`parseHooksConfig`, and project to `HookSummaryEntry[]`.

**Why it happens:** The resolver is read-only and discards the parsed
value to avoid carrying large payloads through `ResolvedPlugin`.

**How to avoid:** info.ts's `composeResolvedComponents` (which already
opens disk for skills/commands/agents) gains a parallel branch:
- If `resolved.hooksConfigPath !== undefined`: read & parse the file,
  project entries to `HookSummaryEntry[]`, return as
  `components.hooks`.
- ENOENT / parse failure on info-time read -> classify via
  `narrowProbeError` (same ladder as the other component-kind probes)
  and surface as the `(installed) {permission denied}` /
  `(installed) {unreadable}` row form.

**Warning signs:** info.ts compiles but the rendered output for a
plugin with hooks shows `hooks: <empty>` or no `hooks:` line.

### Pitfall 7: `components.hooks` field ordering in `composeResolvedComponents`

**What goes wrong:** Planner adds `hooks` to the components-object
return shape but the object literal places it at the wrong position --
e.g. between `mcp` and `skills` alphabetically wrong, or at the end
violating the `COMPONENT_KINDS` 5-tuple ordering pre-condition.

**Why it happens:** The renderer iterates `COMPONENT_KINDS` to extract
keys in order; the object literal itself does NOT enforce key order.

**How to avoid:** The 5-tuple is the authoritative order: `["agents",
"commands", "hooks", "mcp", "skills"]`. The object literal at the
return site can list keys in any order (TypeScript permits it); the
renderer reads via `components[kind]` for each `kind of COMPONENT_KINDS`.

**Warning signs:** Rendered output shows hooks AFTER skills, or
between mcp and skills. Test fixture mismatch on the byte-equality
gate.

### Pitfall 8: catalog-UAT atomic-supersession violated

**What goes wrong:** Plan splits the SURF-05 work into TWO commits:
(1) source change adding `"orphan rewake"` to REASONS, (2) catalog
update + fixture update. CI between the two commits goes RED.

**Why it happens:** Plans naturally separate "source work" from
"docs work".

**How to avoid:** Per D-58-01, the SURF-05 task BUNDLES the source
addition + catalog row + byte-equality fixture into ONE commit. The
plan task description MUST make this constraint explicit.

**Warning signs:** Two separate commits in the same plan touching
REASONS tuple and `docs/output-catalog.md`. Or: `npm run check`
between commits fails the architecture/catalog-uat test.

### Pitfall 9: docs/hooks.md leaks internal jargon

**What goes wrong:** Doc references "bucket A", "REQ-IDs", phase
numbers, `<lossy synthesis>` markers, decision IDs (D-63-09).

**Why it happens:** Phase 63 research and CONTEXT.md is heavily
jargon-laden; copying language verbatim leaks it into the doc.

**How to avoid:** Use Claude Code's own field names verbatim
(`matcher`, `if`, `asyncRewake`, `timeout`, `command`, `args`). Use
plain English for descriptions ("runs before a tool call", not "bucket-A
PreToolUse"). Cross-refs point to `code.claude.com/docs/en/hooks` and
the Pi extension API docs ONLY -- never to REQUIREMENTS.md, PROJECT.md,
or any `.planning/*` artefact.

**Warning signs:** Grep `docs/hooks.md` for `bucket`, `REQ-`, `Phase`,
`D-`, `<lossy synthesis>` -- all should return zero matches.

### Pitfall 10: README.md "Hook support" section heading style mismatch

**What goes wrong:** New section uses heading style inconsistent with
existing top-level sections (e.g. `# Hook support` instead of `## Hook
support`, or buries it inside a `<details>` block).

**Why it happens:** No existing convention is loaded into context.

**How to avoid:** Existing README.md uses `## Section Name` for
top-level (already-present headings: `## Features`, `## Prerequisites`,
`## Usage`, `## Configuration files`, `` ## `/claude:plugin` reference ``,
`## Contributing`, `## AI disclaimer`, `## License`). Match this style.
Placement is Claude's Discretion -- recommended near `## Configuration
files` (around line 130) since it's a sibling concept for plugin
authors.

**Warning signs:** README.md grep shows `^## Hook support` matches at
the wrong indentation level or inside a `<details>` block.

### Pitfall 11: Mismatched `<plugin>/hooks.json` file path between write and hydrate

**What goes wrong:** stage.ts writes
`<hooksDir>/<plugin>/hooks.json` but the existing
`addInstalledPluginHooksToCache` hydrate path
(`install.ts:331-361`) reads from a different path (e.g.
`<hooksDir>/<plugin>.json`).

**Why it happens:** Two distinct file-path constructions in two files.

**How to avoid:** ONE helper in stage.ts (e.g.
`hookConfigPathFor(locations, plugin)`) that BOTH the writer (stage.ts)
AND the hydrate reader (install.ts:340 `readFile(hooksJsonPath, "utf8")`)
consume. The write path is the source of truth.

**Warning signs:** Integration test "install plugin with hooks then
read cache" returns empty cache despite successful install.

### Pitfall 12: Detection seam choice changes test surfaces

**What goes wrong:** Planner picks "resolver" for orphan-rewake
detection but writes tests against `install.ts` cascade row composition
(or vice versa). When the planner flips the choice mid-execution, the
test suite no longer matches.

**Why it happens:** The two detection sites (resolver vs install
orchestrator) are interchangeable for correctness but have very
different test seams.

**How to avoid:** Lock the choice in the FIRST plan task (Wave 0
foundation). Document it in PHASE.md or the foundation task's
description: "Orphan-rewake detection lives in `<file>::<function>`
because <reason>".

**Warning signs:** Plan has tasks referencing both `domain/resolver.ts`
and `orchestrators/plugin/install.ts` for orphan-rewake detection.

## Code Examples

### Example 1: `install.ts` phase array (verbatim 794-800 -> 6-element)

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:577-800
// EXISTING:
const phases: readonly Phase<InstallCtx>[] = [
  skillsPhase,
  commandsPhase,
  agentsPhase,
  mcpPhase,
  statePhase,
];

// AFTER Phase 63:
const phases: readonly Phase<InstallCtx>[] = [
  skillsPhase,
  commandsPhase,
  agentsPhase,
  hooksPhase,      // <-- D-63-01 (between agents and mcp)
  mcpPhase,
  statePhase,
];
```

### Example 2: REASONS tuple verbatim (`shared/notify.ts:72-104`)

```typescript
// Source: extensions/pi-claude-marketplace/shared/notify.ts:72-104
// HOOK-04 already done in Phase 58 -- "unsupported hooks" present at line 81
export const REASONS = [
  "up-to-date",
  "not found",
  "already installed",
  "not installed",
  "not in manifest",
  "invalid manifest",
  "no longer installable",
  "unsupported source",
  "unsupported hooks",        // <-- already present (Phase 58 / D-58-01)
  "lsp",
  // ... (omitted lines)
  "not added",
  "orphan rewake",            // <-- ADD HERE (SURF-05 / D-63-08)
] as const;
```

### Example 3: `assertPathInside` verbatim (`shared/path-safety.ts:77-101`)

```typescript
// Source: extensions/pi-claude-marketplace/shared/path-safety.ts:77-101
// D-14: refuse all symlinks (PRD doesn't specify symlink behavior).
// D-15: single chokepoint -- every PS-1 callsite uses this function.
// D-16: walk every parent component, not just the leaf.
export async function assertPathInside(
  parent: string,
  child: string,
  label: string,
): Promise<void> {
  if (!isPathInside(parent, child)) {
    throw new PathContainmentError(parent, child, label);
  }

  const relative = path.relative(parent, child);
  const segments = relative === "" ? [] : relative.split(path.sep);

  let current = parent;
  for (const segment of segments) {
    current = path.join(current, segment);
    const canContinue = await assertNoSymlinkSegment(parent, child, label, current);
    if (!canContinue) return;
  }
}
```

### Example 4: existing render loop (`shared/notify.ts:2582-2611`)

```typescript
// Source: extensions/pi-claude-marketplace/shared/notify.ts:2582-2611
// EXISTING:
type ComponentKind = keyof PluginInfoComponentsResolved["components"];
const COMPONENT_KINDS: readonly [ComponentKind, ComponentKind, ComponentKind, ComponentKind] = [
  "agents",
  "commands",
  "mcp",
  "skills",
];

function appendResolvedComponentLines(
  lines: string[],
  components: PluginInfoComponentsResolved["components"],
  dependencies: readonly string[] | undefined,
): void {
  for (const kind of COMPONENT_KINDS) {
    const names = components[kind];
    if (names !== undefined && names.length > 0) {
      lines.push(`    ${kind}: ${names.join(", ")}`);
    }
  }

  if (dependencies !== undefined && dependencies.length > 0) {
    lines.push(`    dependencies: ${dependencies.join(", ")}`);
  }
}

// AFTER Phase 63:
const COMPONENT_KINDS: readonly [
  ComponentKind, ComponentKind, ComponentKind, ComponentKind, ComponentKind
] = ["agents", "commands", "hooks", "mcp", "skills"];

function appendResolvedComponentLines(
  lines: string[],
  components: PluginInfoComponentsResolved["components"],
  dependencies: readonly string[] | undefined,
): void {
  for (const kind of COMPONENT_KINDS) {
    if (kind === "hooks") {
      // D-63-04 multi-line block: header + per-entry indented lines.
      const entries = components.hooks;
      if (entries !== undefined && entries.length > 0) {
        lines.push("    hooks:");
        for (const entry of entries) {
          // ToolEvent arm carries matcher; non-tool arm is bare event.
          if ("matcher" in entry) {
            lines.push(`      ${entry.event}(${entry.matcher})`);
          } else {
            lines.push(`      ${entry.event}`);
          }
        }
      }
      continue;
    }

    // Existing single-line comma-join path for other kinds.
    const names = components[kind];
    if (names !== undefined && names.length > 0) {
      lines.push(`    ${kind}: ${names.join(", ")}`);
    }
  }

  if (dependencies !== undefined && dependencies.length > 0) {
    lines.push(`    dependencies: ${dependencies.join(", ")}`);
  }
}
```

### Example 5: `BUCKET_A_EVENTS` + `TOOL_EVENTS` verbatim (`domain/components/hook-events.ts:35-64`)

```typescript
// Source: extensions/pi-claude-marketplace/domain/components/hook-events.ts:35-64
// Phase 58 locked these tuples. Phase 63 re-exports via shared/notify.ts.
export const BUCKET_A_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PreCompact",
  "PostCompact",
  "SessionEnd",
] as const;

export type BucketAEvent = (typeof BUCKET_A_EVENTS)[number];

export const TOOL_EVENTS = ["PreToolUse", "PostToolUse", "PostToolUseFailure"] as const;

export type ToolEvent = (typeof TOOL_EVENTS)[number];
```

### Example 6: Orphan-rewake detection (Claude's Discretion -- recommended seam: resolver)

```typescript
// PROPOSED for domain/resolver.ts (recommended: resolver-side keeps install.ts lean)
// After `applyHooksConfig`'s success branch sets partial.hooksConfigPath,
// scan handlers and set partial.orphanRewake = true if any handler has
// rewakeMessage or rewakeSummary non-undefined AND asyncRewake !== true.

function detectOrphanRewake(parsed: HooksConfig): boolean {
  for (const groups of Object.values(parsed)) {
    for (const group of groups) {
      for (const handler of group.hooks) {
        const hasRewakeField =
          handler.rewakeMessage !== undefined || handler.rewakeSummary !== undefined;
        const asyncRewakeTrue = handler.asyncRewake === true;
        if (hasRewakeField && !asyncRewakeTrue) {
          return true; // One handler is enough -- per-plugin row, not per-handler.
        }
      }
    }
  }
  return false;
}

// In install.ts cascade row composition (orphan-rewake threads into the
// `(installed)` row's reasons array):
if (resolved.orphanRewake === true) {
  reasons.push("orphan rewake");
}
```

### Example 7: README.md existing structure (`README.md:21-369`)

```markdown
## Features            <-- existing line 21
## Prerequisites       <-- existing line 32
## Usage               <-- existing line 38
  ### Name mapping     <-- nested
  ### Scoping
## Configuration files  <-- existing line 130 (recommended placement nearby)
  ### Local configuration files
  ### Gitignore convention
## /claude:plugin reference  <-- existing line 171
  ### Marketplace
  ### Plugin
  ### Bootstrap
  ### Import
## Hook support        <-- NEW (Phase 63 / SURF-06)
## Contributing
## AI disclaimer
## License
```

### Example 8: docs/hooks.md content blueprint (SURF-06 / D-63-09)

```markdown
# Hook support

Hooks let a Claude Code plugin observe and react to events in the
Claude Code session -- a tool call, the start of a session, the
submission of a user prompt, and so on. When you install a Claude Code
plugin that ships a `hooks/hooks.json` file in this Pi marketplace,
pi-claude-marketplace translates each hook into a Pi event subscription
so the hook fires under Pi the same way it would under Claude Code.

This document describes which hook events work in v1.13, which do not,
and what to expect when you install a plugin that ships hooks.

## How hooks run under Pi

[one paragraph: cwd=CLAUDE_PROJECT_DIR (user's project), absolute
paths allowed, ${CLAUDE_PLUGIN_ROOT} interpolation, $PATH applies]

## Supported events

| Event               | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `SessionStart`      | Fires when a Pi session starts. ...                      |
| `UserPromptSubmit`  | Fires when the user submits a prompt. ...                |
| `PreToolUse`        | Fires before a tool call is made. ...                    |
| `PostToolUse`       | Fires after a tool call completes successfully. ...      |
| `PostToolUseFailure`| Fires after a tool call fails. ...                       |
| `PreCompact`        | Fires before the session is compacted. ...               |
| `PostCompact`       | Fires after the session is compacted. ...                |
| `SessionEnd`        | Fires when the Pi session ends. ...                      |

## Worked examples

### Auto-formatter
[15-30 lines: `hooks.json` snippet + plain English description]

### Bash-safety net
[15-30 lines: ...]

### Session-start rule injection
[15-30 lines: ...]

### Prompt audit log
[15-30 lines: ...]

### Background security review
[15-30 lines: includes asyncRewake + rewakeMessage]

### Compaction snapshot
[15-30 lines: ...]

## Unsupported events

The following Claude Code hook events are not supported in v1.13:

- `Stop`, `StopFailure`: no Pi analog. ...
- `Notification`: ...
- `PreCompact` / `PostCompact` with specific triggers: ...
- ... (rest of bucket B/C/D/E groups in plain English; no jargon)

## Tool name mapping

[Pi <-> Claude Code tool name table from
`domain/components/hook-tool-names.ts` + a "currently unmapped
Claude tools" subsection]

## What happens to my plugin?

[Decision tree: "If your plugin uses only events in the Supported
list, your plugin's hooks will fire under Pi. If your plugin uses ...
your plugin will install with `{unsupported hooks}` and its hooks
will not fire ..."]

## Marketplace coverage

In the bundled marketplace, 10 of 13 plugins install with hooks
fully supported under v1.13. The remaining 3 ship hooks that target
unsupported events and install with `(unavailable) {unsupported hooks}`.

## Further reading

- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks) --
  upstream's authoritative field reference (precedence rules, full
  `if`-permission-rule grammar, etc.)
- Pi extension API docs (via `@mariozechner/pi-coding-agent`) -- how
  hooks integrate with the Pi runtime (event emission, `pi.sendMessage`,
  `ctx.ui.notify`)
```

## State of the Art

| Old Approach                                | Current Approach                                            | When Changed   | Impact                                                                                                                                                |
| ------------------------------------------- | ----------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct `process.stdout` / `console.log`    | `ctx.ui.notify(message, severity)` via single chokepoint    | v1.0 (IL-2)    | Phase 63 binds ZERO new `notify` call sites.                                                                                                          |
| Hand-rolled `fs.writeFile(tmp) + rename`   | `atomicWriteJson(filePath, value)` via `write-file-atomic`  | v1.0 (NFR-1)   | Phase 63 stage.ts uses the existing helper.                                                                                                           |
| String-based hook event matching            | Closed-set tuples + discriminated-union typing               | Phase 58       | Phase 63 re-exports `BUCKET_A_EVENTS` / `TOOL_EVENTS` for `ClaudeHookEvent` typing.                                                                  |
| Per-bridge containment helpers              | `assertPathInside` single chokepoint (D-15)                 | v1.0           | Phase 63 stage.ts uses the existing helper INSIDE the new subtree walk.                                                                              |
| `process.stdout` test output                | `node --test` + byte-equality fixtures + catalog-UAT       | Phase 14       | Phase 63 must land catalog rows + byte-equality fixtures atomically per D-58-01.                                                                     |
| String API for message construction         | Type-driven `NotificationMessage` discriminated union       | v1.4           | Phase 63 extends `PluginInfoComponentsResolved.components` shape without adding a new top-level message variant.                                     |
| TypeBox 0.34.x (legacy package)             | TypeBox 1.x (`typebox` package, no `@sinclair` scope)        | v1.0           | Phase 63 deliberately does NOT add a TypeBox runtime schema for `HookSummary` (Claude's Discretion: compile-time type only).                          |
| Node 22.x tsx-loaded TS tests               | Node 22.18+ native TS strip                                  | v1.0+ (dev)    | Tests run via `node --test "tests/**/*.test.ts"` directly. No tsx loader needed for Phase 63 tests.                                                  |

**Deprecated/outdated:**
- HOOK-04 REASONS rename (`"hooks"` -> `"unsupported hooks"`) -- DONE
  in Phase 58 per D-58-01. Phase 63 does NOT re-implement.
- Old `process.stderr` debug-log writes -- replaced by
  `shared/debug-log.ts` `hookDebugLog` (Phase 59 D-59-05).
- Pre-v1.4 string-based renderer -- replaced by type-driven
  `NotificationMessage` discriminated union (v1.4).

## Assumptions Log

| #   | Claim                                                                                                                                                                 | Section                              | Risk if Wrong                                                                                                  |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| A1  | The phase ledger's `Phase<C>.do` / `.undo` contract is unchanged in v1.13 (Phase 62 did not modify the primitive)                                                       | Pattern 1                            | hooksPhase implementation needs different shape; minor refactor in stage.ts.                                  |
| A2  | `cascadeUnstagePlugin` in `orchestrators/marketplace/shared.ts:316-380` is the sole shared cleanup helper used by uninstall + update/reinstall recovery               | Component Responsibilities           | Planner adds the unstage call to the wrong file; integration test catches it.                                |
| A3  | `addInstalledPluginHooksToCache` post-state-commit hydrate (`install.ts:331-361`) works unchanged once stage.ts writes the file                                       | System Architecture Diagram          | Hydrate path expects a different filename; integration test catches via routing-table emptiness.             |
| A4  | The 10/13 marketplace coverage number in CONTEXT.md / docs/hooks.md is accurate as of 2026-06-16                                                                       | docs/hooks.md content blueprint      | Doc states wrong number. Verify against the actual marketplace plugin set before writing docs/hooks.md.       |
| A5  | The README.md `## Hook support` section placement (near `## Configuration files`) matches the user's intent                                                            | Pitfall 10                           | Section ends up in a less-discoverable position; user feedback during verification. Claude's Discretion anyway. |
| A6  | The 6 worked examples in `docs/hooks.md` can each fit in 15-30 lines without losing accuracy                                                                            | docs/hooks.md content blueprint      | Doc bloat; trim to 4-5 examples if necessary -- but D-63-11 says all 6 must ship.                            |
| A7  | The Pi extension API docs published by `@mariozechner/pi-coding-agent` are stable enough to cross-reference in user-facing docs                                       | Sources / docs/hooks.md              | Cross-ref breaks if peer-dep doc URLs move. Use the package name + a path indication rather than a direct URL. |
| A8  | The "what happens to my plugin?" decision-tree section in docs/hooks.md can be written without referencing internal jargon                                              | docs/hooks.md content blueprint      | Doc leaks jargon; verification step grep catches it.                                                          |

## Open Questions

1. **Orphan-rewake detection site -- resolver or install orchestrator?**
   - What we know: Both are correct architecturally. Resolver placement keeps install lean; install placement keeps the resolver pure.
   - What's unclear: Which seam already exposes the parsed config to the install row composition path most cleanly.
   - Recommendation: Resolver side. `applyHooksConfig` (`domain/resolver.ts:693-712`) already has `hooksResult.value` (the parsed config) in scope. Adding `partial.orphanRewake: boolean` is a 5-line change; install.ts cascade row composition reads `resolved.orphanRewake` once. Locking this choice in the foundation plan task removes ambiguity.

2. **Hooks bridge verb naming -- mcp-bridge-style or flatter?**
   - What we know: Both work. mcp-style: `prepareStageHook` / `commitPreparedHook` / `unstageHook`. Flatter: `writeHookConfig` / `removeHookConfig`.
   - What's unclear: The single-file bridge's lower complexity may not justify the 3-verb pattern.
   - Recommendation: Flatter pair (`writeHookConfig` + `removeHookConfig`) plus a private `assertNoSymlinkEscapeInHooksSubtree` helper. The 3-verb pattern is justified by multi-file staging (agents, skills, commands); hooks have ONE file per plugin. Document the choice in stage.ts's module preamble.

3. **`info.ts` info-time hooks.json re-parse failure classification.**
   - What we know: The probe-classifier ladder (`narrowProbeError`) already classifies EACCES / ENOENT / SyntaxError into closed-set REASONS.
   - What's unclear: A SyntaxError on info-time read SHOULD surface as `(installed) {unparseable}` (existing REASON), but could be confused with the install-time `{unsupported hooks}` REASON used elsewhere for the same file.
   - Recommendation: Re-use the existing `narrowProbeError` ladder unchanged. The info-time read is at the SAME file path the resolver / install-time hydrate already classify; consistency wins over per-surface specialization.

4. **Should the new `hooks` field on `PluginInfoComponentsResolved.components` use `HookSummary` or `readonly HookSummaryEntry[]`?**
   - What we know: D-63-07 says `hooks?: readonly HookSummaryEntry[]`. D-63-06 also defines a `HookSummary` interface wrapping `readonly HookSummaryEntry[]`.
   - What's unclear: Whether the wrapper interface adds value at the component-payload boundary.
   - Recommendation: Pass the raw `readonly HookSummaryEntry[]` (D-63-07 wording is binding). The `HookSummary` interface stays as an EXPORT for downstream consumers (per D-63-06 wording) but is not the carrier type at the message-payload boundary.

## Environment Availability

| Dependency                              | Required By                                                  | Available    | Version       | Fallback                                  |
| --------------------------------------- | ------------------------------------------------------------ | ------------ | ------------- | ----------------------------------------- |
| Node.js >= 22.22.2                      | NFR-4 + write-file-atomic@^8 engines floor                   | ✓ (v22.22.2) | v22.22.2      | --                                        |
| `write-file-atomic` (runtime dep)       | atomicWriteJson via stage.ts                                 | ✓            | 8.0.0         | --                                        |
| `typebox` (runtime peer dep)            | HOOKS_VALIDATOR (existing) -- NOT extended in v1.13          | ✓            | 1.1.38        | --                                        |
| `@mariozechner/pi-coding-agent`         | ExtensionContext / ExtensionAPI types -- NOT extended         | ✓            | ^0.73.1        | --                                        |
| `node --test`                           | All unit + integration tests                                 | ✓ (built-in) | bundled        | --                                        |
| Pre-commit hooks (project-level)        | Commits in this phase                                        | ✓            | configured     | `SKIP=trufflehog` from worktree (see ~/.claude memory) |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property            | Value                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Framework           | Node built-in `node:test` + assert (no Vitest, no Jest)                                                              |
| Config file         | None (node --test convention; glob in package.json `scripts.test`)                                                   |
| Quick run command   | `npm test -- --test-name-pattern="<pattern>"` for targeted; `node --test tests/<path>/<file>.test.ts` for one file. |
| Full suite command  | `npm run check` (typecheck + lint + format:check + unit tests + integration tests)                                   |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                                              | Test Type   | Automated Command                                                                                                     | File Exists? |
| ------- | ----------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------- | ------------ |
| LIFE-01 | 5th slot present in install.ts phases array                                                            | unit        | `node --test tests/orchestrators/plugin/install.test.ts`                                                              | ✅ (modify)   |
| LIFE-01 | 5th slot present in update.ts hand-rolled cascade                                                      | unit        | `node --test tests/orchestrators/plugin/update.test.ts`                                                                | ✅ (modify)   |
| LIFE-01 | 5th slot present in reinstall.ts hand-rolled cascade                                                   | unit        | `node --test tests/orchestrators/plugin/reinstall.test.ts`                                                             | ✅ (modify)   |
| LIFE-01 | cascadeUnstagePlugin includes hooks unstage between agents and mcp                                     | unit        | `node --test tests/orchestrators/marketplace/shared.test.ts` (or similar -- the shared.ts test file)                  | ❌ verify path |
| LIFE-02 | Install with hooks emits NotificationMessage plugin row + triggers reload-hint                         | unit        | `node --test tests/orchestrators/plugin/install.test.ts` -- fixture asserts the cascade row + reload-hint trailer    | ✅ (modify)   |
| LIFE-02 | Uninstall with hooks emits NotificationMessage plugin row + triggers reload-hint                       | unit        | `node --test tests/orchestrators/plugin/uninstall.test.ts`                                                            | ✅ (modify)   |
| LIFE-03 | Symlink inside `<pluginRoot>/hooks/` pointing outside pluginRoot is rejected at install                | unit        | `node --test tests/bridges/hooks/symlink-escape.test.ts` (NEW)                                                       | ❌ Wave 0     |
| LIFE-03 | `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json` file exists after successful install     | integration | `node --test tests/integration/<...hooks-write...>.test.ts` (NEW)                                                    | ❌ Wave 0     |
| SURF-01 | info renders multi-line `hooks:` block between commands and mcp                                       | unit        | `node --test tests/orchestrators/plugin/info.test.ts`                                                                  | ✅ (modify)   |
| SURF-01 | unavailable plugin still renders `components: not resolved` (no hooks block)                          | unit        | `node --test tests/orchestrators/plugin/info.test.ts`                                                                  | ✅ (modify)   |
| SURF-02 | HookSummaryEntry discriminator exhaustiveness (assertNever default arm)                                | unit        | `node --test tests/shared/notify.test.ts`                                                                              | ✅ (modify)   |
| SURF-02 | ClaudeHookEvent re-exports BUCKET_A_EVENTS                                                              | unit        | `node --test tests/shared/notify.test.ts`                                                                              | ✅ (modify)   |
| SURF-03 | NO synthesis-caveat warnings ship                                                                       | unit        | grep `<lossy synthesis>` returns zero matches in `shared/notify.ts`                                                  | ✅ (verify)   |
| SURF-04 | `list` output has no hook-count column                                                                  | unit        | `node --test tests/orchestrators/plugin/list.test.ts` -- byte-equality fixture stays unchanged                       | ✅ (verify)   |
| SURF-04 | No `/claude:plugin hooks <plugin>` command surface                                                      | unit        | grep `commands/plugin/hooks` returns zero results in repo                                                              | --           |
| SURF-05 | Plugin with `rewakeMessage` without `asyncRewake: true` -> `(installed) {orphan rewake}` row           | unit        | `node --test tests/orchestrators/plugin/install.test.ts` -- new fixture                                              | ✅ (modify)   |
| SURF-05 | Plugin with `asyncRewake: true` installs normally with no `{orphan rewake}` reason                     | unit        | `node --test tests/orchestrators/plugin/install.test.ts` -- new fixture                                              | ✅ (modify)   |
| SURF-05 | "orphan rewake" appears in REASONS tuple                                                                | unit        | `node --test tests/shared/notify.test.ts` (or dedicated REASONS test)                                                 | ✅ (verify)   |
| SURF-05 | catalog-UAT byte-equality fixture for `(installed) {orphan rewake}` row                                | unit        | `node --test tests/architecture/catalog-uat.test.ts`                                                                  | ✅ (modify)   |
| SURF-06 | `docs/hooks.md` file exists                                                                             | unit        | architecture/lint test -- `fs.access('docs/hooks.md')`                                                                | ❌ Wave 0     |
| SURF-06 | README.md links to docs/hooks.md                                                                       | unit        | architecture/lint test -- README.md grep for `docs/hooks.md`                                                          | ❌ Wave 0     |
| SURF-06 | docs/hooks.md does NOT contain internal jargon                                                          | unit        | architecture/lint test -- grep for `bucket-A`, `bucket-D`, `REQ-`, `Phase `, `D-`, `<lossy synthesis>` returns zero  | ❌ Wave 0     |
| SURF-06 | docs/hooks.md contains all 8 supported events                                                          | unit        | architecture/lint test -- grep for each of `SessionStart`, `UserPromptSubmit`, etc.                                  | ❌ Wave 0     |
| SURF-06 | docs/hooks.md cross-references the two authority docs                                                   | unit        | architecture/lint test -- grep for `code.claude.com/docs/en/hooks` AND `pi-coding-agent`                              | ❌ Wave 0     |

### Sampling Rate

- **Per task commit:** Pattern-targeted `node --test --test-name-pattern="<task pattern>" tests/<area>/**/*.test.ts` (under 30s)
- **Per wave merge:** `npm test` (full unit suite)
- **Phase gate:** `npm run check` GREEN before `/gsd-verify-work` (typecheck + lint + format:check + unit + integration)

### Wave 0 Gaps

- [ ] `tests/bridges/hooks/symlink-escape.test.ts` -- covers LIFE-03 symlink rejection
- [ ] `tests/bridges/hooks/stage.test.ts` -- covers LIFE-01 / LIFE-03 stage write + unstage
- [ ] `tests/integration/<...hooks-end-to-end...>.test.ts` -- covers LIFE-01 / LIFE-02 install->disk->cache->/reload loop (filename to be chosen per existing convention)
- [ ] `docs/hooks.md` -- file does not yet exist
- [ ] Architecture lint test for docs/hooks.md presence + jargon-leak + cross-refs + 8-event coverage -- recommended location: `tests/architecture/docs-hooks.test.ts` (NEW)
- [ ] README.md `## Hook support` section -- does not yet exist (Wave covers writing it; lint test verifies link)

*(No framework install needed -- node:test is the established framework. No new test runner.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category                | Applies | Standard Control                                                                                                                                                                          |
| ---------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication            | no      | No auth surface in scope.                                                                                                                                                                |
| V3 Session Management        | no      | No session state in scope.                                                                                                                                                               |
| V4 Access Control            | yes     | NFR-10 containment: refuse writes outside `<scopeRoot>/pi-claude-marketplace/hooks/`. `assertPathInside` is the chokepoint.                                                              |
| V5 Input Validation          | yes     | `HOOKS_VALIDATOR.Check` (existing) validates `hooks.json` schema before stage.ts writes. `parseHooksConfig` runs supportability gate (TOOL-02) before admission.                       |
| V6 Cryptography              | no      | No cryptographic surface in scope.                                                                                                                                                       |
| V8 Data Protection           | yes     | Atomic write via `write-file-atomic` ensures partial-write states are not observable (NFR-1). Power-loss between truncate-and-write cannot leave a zero-byte / partially-written file. |
| V12 File and Resources       | yes     | Symlink-escape rejection via `fs.realpath` + `assertPathInside` (LIFE-03). Plugin name sanitization via `assertSafeName` before path composition (NFR-10).                              |
| V14 Configuration            | yes     | No new environment variables introduced. `${CLAUDE_PLUGIN_ROOT}` interpolation in hook command paths is documented in docs/hooks.md and ALREADY honored by Phase 60's exec layer.       |

### Known Threat Patterns for Pi extension stack

| Pattern                                                                  | STRIDE         | Standard Mitigation                                                                                                                                                                                |
| ------------------------------------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Symlink-escape via plugin-shipped symlink in `<pluginRoot>/hooks/`        | Tampering      | LIFE-03: subtree walk + `fs.realpath` + `assertPathInside(pluginRoot, realpath)`. Existing `SymlinkRefusedError` propagates through PI-14 cause-chain.                                            |
| Path traversal via plugin name with `..` separator                        | Tampering      | `assertSafeName(plugin, label)` rejects `/`, `\`, `.`, `..`, ASCII control chars BEFORE `path.join(hooksDir, plugin, ...)`.                                                                       |
| TOCTOU between symlink-check and atomic write                             | Tampering      | Residual risk acknowledged in `path-safety.ts:71-75` comment. Threat model is "careless or malicious plugin author", not "concurrent in-process attacker". Acceptable for v1.13.                  |
| Partial-write of `<plugin>/hooks.json` corrupting state                   | Tampering      | `write-file-atomic` (via `atomicWriteJson`) writes to tmp + fsyncs + renames atomically + fsyncs parent dir. Power loss leaves either old file or new file -- never a half-written one.         |
| JSON injection in hooks.json producing unexpected handler                 | Tampering      | `HOOKS_VALIDATOR.Check` (typebox JIT) rejects any unexpected schema shape; supportability gate (TOOL-02) flips plugin to `(unavailable) {unsupported hooks}` rather than admitting the handler.   |
| Plugin shipping orphan `rewakeMessage` without `asyncRewake: true`        | Information disclosure (mild) | SURF-05 warning surfaces the config bug so the plugin author can fix it. Upstream Claude Code treats the orphan field as no-op (no security impact).                                                |
| Doc link to wrong upstream URL leaks user to attacker-controlled domain    | Spoofing       | Cross-refs in docs/hooks.md hard-code `code.claude.com/docs/en/hooks` (Claude's official domain) and reference the peer-dep package by name (not by URL). Architecture lint test verifies.       |

## Sources

### Primary (HIGH confidence)

- `extensions/pi-claude-marketplace/shared/notify.ts` (lines 72-104, 1041-1062, 2570-2700) -- REASONS tuple, PluginInfoComponentsResolved interface, COMPONENT_KINDS, appendResolvedComponentLines, renderPluginInfo. [VERIFIED: codebase grep+read]
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (lines 320-400, 577-800, 1010-1030) -- addInstalledPluginHooksToCache, the 5 Phase<InstallCtx> definitions, the phases literal-array, post-state-commit hydrate call. [VERIFIED: codebase grep+read]
- `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` (lines 280-380) -- cascadeUnstagePlugin, UnstageOutcome shape. [VERIFIED: codebase grep+read]
- `extensions/pi-claude-marketplace/shared/path-safety.ts` (lines 1-147) -- assertPathInside, SymlinkRefusedError, isPathInside. [VERIFIED: codebase grep+read]
- `extensions/pi-claude-marketplace/shared/atomic-json.ts` (lines 1-31) -- atomicWriteJson + write-file-atomic wrapper. [VERIFIED: codebase grep+read]
- `extensions/pi-claude-marketplace/domain/components/hook-events.ts` (lines 35-145) -- BUCKET_A_EVENTS, BucketAEvent, TOOL_EVENTS, ToolEvent, NON_TOOL_EVENT_FIELDS, NON_TOOL_EVENT_CLOSED_SETS. [VERIFIED: codebase grep+read]
- `extensions/pi-claude-marketplace/domain/components/hooks.ts` (lines 100-320) -- HookHandlerEntry, HOOKS_VALIDATOR, parseHooksConfig, HookConfigParseResult. [VERIFIED: codebase grep+read]
- `extensions/pi-claude-marketplace/domain/resolver.ts` (lines 600-720) -- readStandaloneHooks, applyHooksConfig, partial.hooksConfigPath assignment. [VERIFIED: codebase grep+read]
- `extensions/pi-claude-marketplace/persistence/locations.ts` (lines 70-200) -- hooksDir field, locationsFor factory. [VERIFIED: codebase grep+read]
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` (lines 1-220) -- info-side message construction, composeResolvedComponents shape. [VERIFIED: codebase grep+read]
- `.planning/REQUIREMENTS.md` (lines 28, 70-92, 208-216) -- HOOK-06 / SURF-01..06 / LIFE-01..03 full wording + status tracker. [VERIFIED: codebase grep+read]
- `.planning/ROADMAP.md` (lines 365-388) -- Phase 63 entry, goal, success criteria, dependency on Phase 62. [VERIFIED: codebase grep+read]
- `.planning/STATE.md` (lines 1-30, 142+) -- Phase 62 complete (current position), v1.13 milestone 86% complete. [VERIFIED: codebase grep+read]
- `.planning/phases/63-lifecycle-cascade-user-facing-surface-docs/63-CONTEXT.md` (full file) -- locked decisions D-63-01..11, Claude's Discretion areas, deferred ideas. [VERIFIED: codebase read]
- `.planning/phases/63-lifecycle-cascade-user-facing-surface-docs/63-DISCUSSION-LOG.md` (full file) -- alternatives considered, user rationale. [VERIFIED: codebase read]
- `docs/output-catalog.md` (lines 59, 136, 182, 301, 534, 750, 1144) -- HOOK-04 `"unsupported hooks"` renderings already present (Phase 58 closure). [VERIFIED: codebase grep]
- `README.md` (lines 21-369) -- existing top-level section headings (`## Features` etc.). [VERIFIED: codebase grep]
- `.claude/rules/typescript-comments.md` (full file) -- forbidden comment patterns (Phase N, Pitfall N, milestone references). [VERIFIED: in-conversation rule injection]
- `package.json` (engines, scripts, deps) -- Node >=20.19.0 floor, `node --test` runner, no tsx in critical path. [VERIFIED: codebase read]

### Secondary (MEDIUM confidence)

- `.planning/phases/57-schema-component-type-payload-extension-tolerance/57-CONTEXT.md` -- referenced via cross-ref in 63-CONTEXT.md for D-57-01 (`resources.hooks`) + D-57-03 (`hooksDir`) + D-57-04 (discriminated parse result). Confirmed by the `hooksDir` field at `persistence/locations.ts:81` and the `resources.hooks: c.resolved.hooksConfigPath !== undefined ? [c.plugin] : []` assignment at `install.ts:776`. [CITED: 63-CONTEXT.md canonical_refs]
- `.planning/phases/58-matcher-parser-tool-name-mapping-supportability-gate/58-CONTEXT.md` -- D-58-01 atomic-supersession pattern. Confirmed by `REASONS` tuple containing `"unsupported hooks"` (already added) + the catalog-UAT rows. [CITED: 63-CONTEXT.md canonical_refs]
- Upstream Claude Code hooks reference at `code.claude.com/docs/en/hooks` -- the 8-event names match exactly the `BUCKET_A_EVENTS` tuple. [ASSUMED based on cross-ref in CONTEXT.md; not fetched in this session]
- `@mariozechner/pi-coding-agent` peer-dep API surface (`ExtensionContext.ui.notify`, `ExtensionAPI`, `pi.sendMessage`) -- already used elsewhere in the codebase. [CITED: codebase grep of `ctx.ui.notify` + `pi.sendMessage` call sites]

### Tertiary (LOW confidence)

- Per-plugin marketplace coverage `10/13` -- claimed in CONTEXT.md and ROADMAP.md. Not independently verified in this research session. Recommend a sanity-check during docs/hooks.md writing. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- every helper, validator, and pattern verified by direct codebase read.
- Architecture: HIGH -- 5 distinct seams in `shared/notify.ts` verified; 6-element phase array shape proved by direct line-quoted excerpt; cascade-uninstall chokepoint at `cascadeUnstagePlugin` verified.
- Pitfalls: HIGH -- 12 pitfalls drawn from codebase evidence (distinct cascade implementations in 3 files; `assertPathInside` already refuses symlinks; HOOK-04 already done; D-58-01 atomic-supersession is the binding pattern; render-time string re-derivation banned).
- Docs requirements: HIGH for jargon-leak constraints (project rule loaded); MEDIUM for marketplace coverage count (`10/13`) -- recommend verification during docs/hooks.md writing.
- Security domain: HIGH -- threat model is well-codified in path-safety.ts comment block + REQUIREMENTS.md NFR-10.

**Research date:** 2026-06-16
**Valid until:** 2026-06-23 (7 days -- fast-moving phase; Phase 62 just closed)
