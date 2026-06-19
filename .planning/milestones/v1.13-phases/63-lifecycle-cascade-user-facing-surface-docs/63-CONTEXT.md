# Phase 63: Lifecycle Cascade, User-Facing Surface & Docs - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 63 ships the user-visible surface and documentation for the v1.13
Claude hook bridge (closes milestone v1.13). Phases 57-62 built the
foundation -- schema admission, supportability gate, dispatch core, sync
EXEC ladder, `if` field, and `asyncRewake` registry -- without surfacing
any of it through the user-facing seams. Phase 63 wires those seams.

Nine concrete deliverables across three threads:

**Lifecycle cascade (LIFE-01..03):**

1. **5th bridge slot.** The `bridges/hooks/` family gains a
   `prepare/commit/unstage` seam (`bridges/hooks/index.ts` exports +
   `bridges/hooks/stage.ts` new module). The install Phase array becomes
   `[skills, commands, agents, hooks, mcp, state]` per D-63-01 (hooks
   between agents and mcp; state stays last per D-01 literal-array
   discipline). Update / reinstall / uninstall orchestrators mirror the
   slot.
2. **NotificationMessage cascade integration.** Hook install/uninstall
   emits a plugin row through the existing v1.4 `NotificationMessage`
   model -- no new top-level notify pattern, no new STATUS_TOKENS, no new
   state-change tokens. Reload-hint cascade triggers via the existing
   seam (LIFE-02).
3. **Per-plugin hooks subtree containment + symlink-escape rejection.**
   The persisted hook file lives at
   `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json` (the
   `hooksDir` field added in Phase 57 / D-57-03; the directory layout was
   already declared but no write site existed). Direct atomic-write per
   D-63-02 (no staging dir) -- single tmp+rename of the
   `<plugin>/hooks.json` file. At install time, the bridge walks
   `<pluginRoot>/hooks/` recursively and rejects any symlink whose
   `fs.realpath` escapes `pluginRoot` per D-63-03.

**User-facing render surface (SURF-01..02, SURF-04, SURF-05):**

4. **`info <plugin>` `hooks:` line.** Multi-line block per D-63-04:
   `hooks:` header at 4-space indent, then one indented entry per line
   showing `event(matcher)` for tool events and bare `event` for
   non-tool events. Slots alphabetically between `commands` and `mcp`
   per the SURF-01 wording. Optional handler fields (`asyncRewake`,
   `timeout`, `if`, `args`, `shell`, `rewakeMessage`, `rewakeSummary`)
   do NOT render inline (D-63-05 -- terse).
5. **`HookSummary` typed model in `shared/notify.ts`.** Discriminated by
   event class per D-63-06: tool events carry a required `matcher`;
   non-tool events do not. Reuses Phase 58's `BUCKET_A_EVENTS` /
   `TOOL_EVENTS` tuples for the closed-set `ClaudeHookEvent` type.
   Carrier: `PluginInfoComponentsResolved.components.hooks?:
   readonly HookSummaryEntry[]` per D-63-07 -- alphabetical 5th member
   of the existing `agents`/`commands`/`mcp`/`skills` set; the
   `COMPONENT_KINDS` tuple grows from 4 to 5.
6. **`list` symmetry preservation (SURF-04).** `list` does NOT add a
   hook-count column; no standalone `/claude:plugin hooks <plugin>`
   command ships. Locked by the REQ; no implementation work in v1.13
   beyond NOT-doing.
7. **SURF-05 orphan-rewake warning.** A plugin declaring
   `rewakeMessage` or `rewakeSummary` on any handler without
   `asyncRewake: true` gets the new closed-set REASONS token
   `"orphan rewake"` per D-63-08 added to its `(installed)` plugin row.
   One row per plugin regardless of N orphan handlers. Plugins with
   `asyncRewake: true` install normally with no warning. Catalog-UAT
   row added in lockstep with the source rename (D-58-01
   atomic-supersession pattern).

**Documentation (SURF-06):**

8. **`docs/hooks.md`** -- plain-English first-time-reader doc per
   D-63-09. Section order: intro -> 8 supported events with plain
   descriptions -> 6 worked examples (all REQ candidates ship: auto-
   formatter, bash-safety net, SessionStart rule injection, prompt
   audit log, background security review, compaction snapshot) ->
   unsupported event groups with one-line reasons -> Pi<->Claude
   tool-name mapping table + currently-unmapped Claude tools -> "what
   happens to my plugin?" section -> marketplace coverage 10/13 note
   -> cross-refs to the two authority docs. Authority docs are
   upstream Claude Code hooks reference + Pi extension API docs per
   D-63-10. NO internal jargon -- no bucket-A/D taxonomy, no REQ-IDs,
   no phase numbers, no `<lossy synthesis>` markers; uses Claude
   Code's own field names verbatim (`matcher`, `if`, `asyncRewake`,
   `timeout`, `command`, `args`).
9. **README.md "Hook support" section.** New top-level section linking
   to `docs/hooks.md` so first-time readers discover the doc without
   knowing where to look. Section placement (Claude's Discretion --
   alphabetically near other component-kind docs or as a sibling of
   the existing "Configuration files" section).

Phase 63 does NOT touch:
- The dispatcher, executor, registry, or `if` field implementations
  (Phases 59-62, complete)
- SURF-03 install-time `<lossy synthesis>` warnings -- reserved for
  v1.14+ when bucket-D events are added
- HOOK-04 closed-set REASONS rename (`"hooks"` -> `"unsupported hooks"`)
  -- landed in Phase 58 per D-58-01
- Phase 62's manual-only verifications (live `/reload` orphan reap
  across process death, end-to-end model-injection observability on
  exit-code-2, `rewakeSummary` Pi UI visibility) -- those are runtime
  verifications carried into milestone close-out, not Phase 63 design
  surface

</domain>

<decisions>
## Implementation Decisions

### Lifecycle cascade (LIFE-01..03)

- **D-63-01 (5th bridge slot position):** Install Phase array is
  `[skills, commands, agents, hooks, mcp, state]`. Hooks slot between
  agents and mcp; state stays last per the existing D-01 literal-array
  discipline (state phase is pure in-memory mutation; PRD-fixed sequence
  has state at the tail). The slot position mirrors the SURF-01
  alphabetical "hooks between commands and mcp" render order so the
  cascade-position and info-render-position are consistent. Update,
  reinstall, and uninstall orchestrators carry the same slot.
- **D-63-02 (direct atomic-write -- no staging dir):** The hooks bridge
  writes `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json`
  via single tmp+rename per the existing atomic-json pattern. No
  `hooks-staging/<uuid>/` dir. Hooks have ONE file per plugin (vs N
  skills / commands / agents), so the multi-file staging-tree pattern
  the agents bridge uses adds LoC for no real safety win. Commit =
  rename; unstage = `rm -rf` of `<hooksDir>/<plugin>/`. NFR-1 atomic;
  on rollback the file does not exist (idempotent).
- **D-63-03 (symlink-escape check -- subtree walk):** At install time,
  the bridge walks `<pluginRoot>/hooks/` recursively. For each entry
  that IS a symlink, the bridge calls `fs.realpath` and asserts the
  resolved target stays inside `pluginRoot` via the existing
  `assertPathInside` helper. The first escape triggers a notify error
  via the existing PluginFailedMessage path and the ledger unwinds.
  Catches the actual threat (plugin shipping a symlink that escapes
  pluginRoot to read `/etc/shadow` or `~/.ssh/id_rsa`) without
  per-command-string token parsing. Absolute-path commands (`/usr/bin/
  prettier`), PATH-relative tokens (`prettier`, `npx`), and
  `${CLAUDE_PLUGIN_ROOT}/...` interpolations are all safe by construction
  -- they either don't touch pluginRoot's subtree (system tools) or
  they reference symlink-clean files (caught by the walk if not).
  Upstream Claude Code's spawn cwd is `ctx.cwd` (the user's project
  cwd) per Phase 60 EXEC-01, not pluginRoot, so plugin authors use
  `${CLAUDE_PLUGIN_ROOT}/...` as the plugin-relative idiom; this idiom
  resolves to files INSIDE pluginRoot, which the walk covers.

### User-facing render surface (SURF-01, SURF-02, SURF-05)

- **D-63-04 (info `hooks:` line shape -- multi-line block):** The info
  render produces:
  ```
      hooks:
        PreToolUse(Bash)
        PreToolUse(Edit|Write)
        PostToolUse(Edit)
        SessionStart
  ```
  Per-entry on its own line at 6-space indent (4 for the `hooks:`
  header + 2 for each entry). Tool events render as
  `<event>(<matcher>)`; non-tool events render as bare `<event>`
  (no parens). Declaration order from the parsed hooks.json is
  preserved (matches Phase 60 D-60-02 dispatcher semantics). Diverges
  from the existing single-line `agents:` / `commands:` / `mcp:` /
  `skills:` kinds because hook entries carry MORE structure than name
  atoms; the multi-line format keeps long matcher patterns readable
  and scales to security-guidance-style plugins with 5+ handlers
  across 4 events.
- **D-63-05 (no inline handler-field flags):** The info render emits
  ONLY `event(matcher)`. `asyncRewake`, `timeout`, `if`, `args`,
  `shell`, `rewakeMessage`, `rewakeSummary` are NOT rendered inline
  with the entry. Plugin authors who need the details read the
  source `hooks.json`; end users who see the info row don't need the
  detail. Keeps the catalog grammar simple (no per-flag closed-set
  tokens beyond the SURF-05 orphan-rewake warning).
- **D-63-06 (HookSummaryEntry discriminated by event class):** Type
  shape in `shared/notify.ts`:
  ```ts
  export type ClaudeHookEvent = (typeof BUCKET_A_EVENTS)[number];
  type HookSummaryEntry =
    | { event: ToolEvent; matcher: string }
    | { event: Exclude<ClaudeHookEvent, ToolEvent> };
  export interface HookSummary {
    readonly entries: readonly HookSummaryEntry[];
  }
  ```
  Reuses Phase 58's `BUCKET_A_EVENTS` / `TOOL_EVENTS` tuples. Tool
  events statically REQUIRE a matcher; non-tool events statically
  CANNOT carry one. assertNever arm in the render switch pins
  exhaustiveness per NFR-7. Eliminates the v1.3 string-API failure
  mode (re-derivation at render time) the v1.4 type-driven refactor
  closed -- the render reads `entry.event` + maybe `entry.matcher`
  directly, no `if (typeof matcher === "string")` runtime guard.
- **D-63-07 (carrier seam -- extend `components.hooks`):** The
  orchestrator passes the typed `HookSummary` into
  `PluginInfoMessage.plugin.components.hooks?: readonly
  HookSummaryEntry[]` -- a new optional sibling field on the existing
  `PluginInfoComponentsResolved.components` object. The renderer's
  `COMPONENT_KINDS` 4-tuple `["agents", "commands", "mcp", "skills"]`
  becomes a 5-tuple `["agents", "commands", "hooks", "mcp", "skills"]`
  (alphabetical). The `appendResolvedComponentLines` loop body
  switches on `kind === "hooks"` for the multi-line block format;
  every other kind keeps the existing single-line comma-join path.
  Single renderer seam, single message-type extension, structural
  exhaustiveness via the literal-tuple length.
- **D-63-08 (SURF-05 token wording -- `"orphan rewake"`):** The new
  REASONS member is the literal string `"orphan rewake"`. Renders as
  `(installed) {orphan rewake}` per the existing reasons brace
  composition. "Orphan" signals the field has no companion (the parent
  `asyncRewake: true` is missing); "rewake" names the family the
  orphan field belongs to (`asyncRewake`/`rewakeMessage`/`rewakeSummary`
  -- the family upstream calls "rewake" in the Command-hook-fields
  reference). One token added to the closed-set REASONS tuple, atomic
  with the catalog-UAT row addition per the D-58-01 atomic-supersession
  pattern. Detection seam: the resolver walks parsed handler entries;
  if any handler has `rewakeMessage` or `rewakeSummary` non-undefined
  AND `asyncRewake` is not `=== true`, the plugin gets the token.
  One row per plugin regardless of N orphan handlers (the existing
  REASONS render dedupes naturally).

### Documentation (SURF-06)

- **D-63-09 (docs/hooks.md section ordering -- events-first):** Reader
  flow:
  1. Intro -- one-paragraph "what hooks are" plus the Pi-vs-Claude
     execution-model note (cwd=CLAUDE_PROJECT_DIR, `${CLAUDE_PLUGIN_ROOT}`
     interpolation is the plugin-relative idiom)
  2. Table of 8 supported events with one-paragraph plain-English
     descriptions (PreToolUse, PostToolUse, PostToolUseFailure,
     SessionStart, SessionEnd, PreCompact, PostCompact,
     UserPromptSubmit)
  3. 6 worked examples per D-63-11 (all REQ candidates)
  4. Unsupported event groups with one-line reasons each (the
     bucket-B/C/D/E groups from Phase 58, expressed in plain English
     -- "Stop / StopFailure: no Pi analog" etc.)
  5. Pi<->Claude tool-name mapping table + currently-unmapped Claude
     tools (from `domain/components/hook-tool-names.ts`)
  6. "What happens to my plugin?" section -- per-plugin decision tree
     ("if your plugin only uses bucket-A events ... if it uses Stop
     ... if it uses `asyncRewake` ...")
  7. Marketplace coverage 10/13 note
  8. Cross-refs to the two authority docs per D-63-10
- **D-63-10 (authority docs cross-referenced):**
  - **`code.claude.com/docs/en/hooks`** -- upstream's authoritative
    field reference and Command-hook-fields table; readers wanting
    exhaustive per-field detail (precedence rules, full
    `if`-permission-rule grammar, etc.) go there.
  - **Pi extension API docs** (peer-dep `@mariozechner/pi-coding-agent`
    -- the published API reference, NOT this repo's docs) -- readers
    wanting to understand how hooks integrate with the Pi runtime
    (what events the host emits, what `pi.sendMessage` does, what
    `ctx.ui.notify` does) go there. Plugin authors building
    `asyncRewake` hooks particularly benefit (the
    "Re-evaluating after..." injection model is a Pi-side concept).
- **D-63-11 (worked examples shipping -- all 6 REQ candidates):**
  - Auto-formatter (PostToolUse on Edit/Write -> prettier/eslint)
  - Bash-safety net (PreToolUse on Bash -> deny via exit code 2)
  - SessionStart rule injection (SessionStart -> stdout becomes
    context)
  - Prompt audit log (UserPromptSubmit -> append to log file)
  - Background security review (PostToolUse on Edit with
    `asyncRewake: true` + `rewakeMessage` + exit code 2 -> wake-up)
  - Compaction snapshot (PreCompact -> dump state to file)

### Claude's Discretion

- **Stage / commit / unstage function signatures.** Single-file
  hooks bridge -- planner picks whether `stage.ts` exports
  `prepareStageHook` / `commitPreparedHook` / `unstageHook` (matching
  the mcp bridge's verb pattern) or a flatter
  `writeHookConfig` / `removeHookConfig` pair. Either works for the
  Phase ledger's `do` / `undo` contract.
- **HOOKS_SUMMARY_SCHEMA TypeBox shape.** The user-facing
  `HookSummary` discriminated union (D-63-06) is a TypeScript type;
  there is no runtime schema validator needed (the orchestrator
  builds it from already-validated parsed hooks.json via the existing
  `HOOKS_VALIDATOR`). Planner skips adding a typebox compile site
  unless a separate ingest path emerges.
- **Per-plugin hooks-subtree walk implementation.** Planner picks
  recursion strategy: `fs.readdir({withFileTypes: true, recursive:
  true})` (Node 20.13+ -- check engines floor) vs hand-rolled
  recursion. Either is fine; the FS surface is bounded to one
  pluginRoot/hooks/ tree per install.
- **Orphan-rewake detection site -- resolver vs install
  orchestrator.** The resolver already parses hooks.json and admits
  the field family (Phase 57 schema, Phase 62 schema admission).
  Planner can colocate the orphan-rewake check in the resolver (so
  the parsed `ResolvedPlugin.hooksConfig?` carries an
  `orphanRewake: boolean` flag) OR in the install orchestrator (so
  install walks the parsed config and decides). Resolver placement
  keeps the install orchestrator lean; install placement keeps the
  resolver pure (no install-time semantics). Planner picks based on
  which seam already exposes the parsed config to the install row
  composition path.
- **README.md "Hook support" section placement.** Likely alphabetical
  near other component-kind docs or as a sibling of the existing
  "Configuration files" section. Planner picks based on the current
  README.md section index. One-line link is enough; the doc itself
  carries the detail.
- **Per-event description wording in docs/hooks.md.** Plain English
  for first-time readers per REQ. Planner / writer picks the exact
  wording. NO bucket-A/D taxonomy, NO REQ-IDs, NO `<lossy synthesis>`
  markers (which don't apply in v1.13 anyway -- SURF-03 is deferred).
- **Per-example doc real-estate.** Each worked example is ~15-30
  lines (intro + hooks.json snippet + "what it does"). Six examples
  at the doc's mid-length is acceptable; planner / writer trims if
  a single section bloats.
- **catalog-UAT row landing pattern.** The new `(installed) {orphan
  rewake}` row goes into `docs/output-catalog.md` and the
  byte-equality test fixture in lockstep with the REASONS token
  addition. Planner ensures atomicity per D-58-01 (the source token
  add and the catalog row add land in the SAME commit).
- **Phase 62 carry-forward manual-only verifications.** Three runtime
  observations to confirm during phase 63 verification:
  (1) live `/reload` orphan reap across process death (kill bridge
  parent, restart Pi, confirm orphan PIDs SIGKILLed),
  (2) end-to-end model-injection observability on exit-code-2 (run
  asyncRewake fixture, observe model context inclusion),
  (3) `rewakeSummary` Pi UI visibility (run asyncRewake fixture with
  rewakeSummary set, observe ctx.ui.notify surface).
  These do NOT influence Phase 63 design decisions; they are runtime
  UAT items the verification step closes.

### Reviewed Todos

- **`.planning/todos/2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`**
  (score 0.6 from `cross_reference_todos`) -- post-PR-51 coverage
  sweep on `update.ts` / `reinstall.ts` / `install.ts` /
  `marketplace/update.ts` / `import/execute.ts` failure arms. Phase
  63 mechanically touches install / update / reinstall / uninstall
  to add the 5th cascade slot, but the coverage sweep is its own
  testing-focused concern (not Phase 63 scope). Folded into the
  deferred section so a future testing-targeted phase / sweep can
  pick it up. NOT folded into Phase 63 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` -- LIFE-01..03 (cascade integration +
  containment), SURF-01..02 (info render + typed model), SURF-04
  (`list` and standalone-command non-additions), SURF-05 (orphan-rewake
  warning), SURF-06 (docs/hooks.md). HOOK-04 (REASONS rename) is
  CLOSED in Phase 58 per D-58-01 and is no longer Phase 63 scope.
- `.planning/ROADMAP.md` Phase 63 entry -- goal + 7 success criteria
  + dependency on Phase 62 + UI hint marker.
- `.planning/PROJECT.md` "Current Milestone: v1.13 Claude Hook Bridge"
  -- locked scope (bucket-A only); 10/13 marketplace coverage; the
  user-facing surface lessons from v1.4 / v1.5 carried forward
  (NotificationMessage type-driven model, single-notify-per-orchestrator,
  catalog-UAT atomicity).

### Prior phase decisions (Phases 57-62 -- foundation)

- `.planning/phases/57-schema-component-type-payload-extension-tolerance/57-CONTEXT.md`
  -- D-57-02 (lenient schema; HOOK-03 tolerance: 3 orphan-rewake
  fields admitted at the schema layer), D-57-03 (`hooksDir` field
  added to `persistence/locations.ts` -- Phase 63 is the binding
  caller via D-63-02), D-57-04 (discriminated parse result;
  `{ ok: false, reason }` surfaces through the `{unsupported hooks}`
  reason).
- `.planning/phases/58-matcher-parser-tool-name-mapping-supportability-gate/58-CONTEXT.md`
  -- D-58-01 atomic-supersession pattern (closed-set REASONS token
  additions and catalog-UAT fixture rows land in the SAME commit;
  applied verbatim to D-63-08 orphan-rewake token + catalog row).
  Phase 58 also locked `BUCKET_A_EVENTS` / `TOOL_EVENTS` /
  `NON_TOOL_EVENT_FIELDS` / `NON_TOOL_EVENT_CLOSED_SETS` tuples in
  `domain/components/hook-events.ts` -- Phase 63 reuses these for
  `ClaudeHookEvent` per D-63-06.
- `.planning/phases/59-bridge-dispatch-core-debug-seam/59-CONTEXT.md`
  -- D-59-02 (bridge-owned in-memory cache + `addInstalledPluginHooks
  ToCache` already exists at install time; Phase 63 wires the
  on-disk write that the existing hydrate path expects), D-59-05
  (`shared/debug-log.ts` is the runtime debug seam; no new sink).
- `.planning/phases/60-hook-execution-payload-translators-env-vars/60-CONTEXT.md`
  -- D-60-01 (`HookExecResult` discriminated union -- Phase 63 does
  not extend), D-60-02 (declaration order preserved -- Phase 63's
  info render preserves the same), D-60-06 (`_shared` data dir mkdir-p
  at factory time -- precedent for any per-scope hooks-area
  mkdir-p Phase 63 needs).
- `.planning/phases/61-if-field-permission-rule-matcher/61-CONTEXT.md`
  -- D-61-02 fail-open contract is precedent for Phase 63's
  "no inline flags" stance (D-63-05 -- the info render does NOT
  surface the `if` field's bypass / fail-open semantics; runtime
  semantics live in the dispatcher, not the render).
- `.planning/phases/62-asyncrewake-registry-background-spawn/62-CONTEXT.md`
  -- Phase 62 admits `asyncRewake`/`rewakeMessage`/`rewakeSummary` at
  the schema layer and wires the spawn registry. Phase 63's D-63-08
  SURF-05 warning fires when `rewakeMessage`/`rewakeSummary` are
  declared WITHOUT `asyncRewake: true` -- the orphan-subordinate-
  fields case Phase 62 silently ignored at runtime.

### Authority sources (read fresh at planning time)

- **`code.claude.com/docs/en/hooks`** -- upstream Claude Code hooks
  reference. Sections: Hook event reference (the 8 bucket-A events),
  Command-hook-fields table (`type`, `command`, `matcher`, `if`,
  `timeout`, `asyncRewake`, `rewakeMessage`, `rewakeSummary`,
  `shell`, `args`), Environment variables, Hook output / exit codes.
  Cross-referenced from docs/hooks.md per D-63-10.
- `docs/research/claude-hook-config-syntax.md` -- the project's
  audited Field-by-field reference. Section 5 Hook environment +
  envvar contract; section 7 per-field implementability decisions;
  section 13 asyncRewake deep-dive (the SURF-05 warning's correctness
  hinges on the upstream's "no-op when asyncRewake is absent"
  contract that section codifies).
- `docs/research/claude-hooks-vs-pi-events.md` -- Pi-vs-Claude event
  taxonomy and tool-name-mapping audit. Provides the
  `currently-unmapped Claude tools` set for docs/hooks.md.
- `docs/prd/pi-claude-marketplace-prd.md` Section "Messaging & UX" --
  v1.4 NotificationMessage type-driven model + catalog-UAT atomicity
  + REASONS closed-set discipline; binding for D-63-08 token
  addition.
- `docs/messaging-style-guide.md` -- closed-set token grammar (every
  REASONS token must be plain English, lowercase, no punctuation,
  read as a noun-phrase fitting the `{reason}` brace). `"orphan
  rewake"` D-63-08 conforms.

### Peer dep (Pi extension API)

- `node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/
  types.d.ts` -- `ExtensionContext.ui.notify` signature (already used
  in Phase 60-62; SURF-05 does not introduce new notify call sites
  per D-63-08). `ExtensionContext.sendMessage` shape (Phase 62's
  `asyncRewake` injection seam -- referenced from docs/hooks.md per
  D-63-10).

### Codebase landing sites

- `extensions/pi-claude-marketplace/bridges/hooks/` -- NEW siblings
  `stage.ts` + `unstage.ts` + extended `index.ts` exports; `stage.ts`
  hosts the symlink-walk helper per D-63-03.
- `extensions/pi-claude-marketplace/persistence/locations.ts` --
  `hooksDir` field already exists (Phase 57 D-57-03); no schema
  change.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
  -- `phases` literal-array gains the 5th hooks slot per D-63-01;
  install row composition queries the parsed config for orphan-rewake
  detection per D-63-08.
- `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`
  + `.../update.ts` + `.../reinstall.ts` -- each gains the 5th
  cascade slot mirror per D-63-01.
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` --
  per-plugin info builder produces the new
  `components.hooks?: readonly HookSummaryEntry[]` payload per D-63-07.
- `extensions/pi-claude-marketplace/shared/notify.ts` --
  - REASONS tuple gains `"orphan rewake"` per D-63-08.
  - `ClaudeHookEvent` type re-exports `(typeof BUCKET_A_EVENTS)
    [number]` per D-63-06.
  - `HookSummaryEntry` discriminated union + `HookSummary` interface
    per D-63-06.
  - `PluginInfoComponentsResolved.components` gains optional
    `hooks?: readonly HookSummaryEntry[]` field per D-63-07.
  - `COMPONENT_KINDS` 4-tuple -> 5-tuple per D-63-07.
  - `appendResolvedComponentLines` body grows a `kind === "hooks"`
    arm that emits the multi-line block per D-63-04 / D-63-05.
- `extensions/pi-claude-marketplace/domain/components/hook-events.ts`
  -- consumed; no changes (the 8-event tuple + closed-sets locked in
  Phase 58).
- `docs/hooks.md` -- NEW. The user-facing first-time-reader doc per
  D-63-09 / D-63-11 with structure per D-63-09 and cross-refs per
  D-63-10.
- `README.md` -- NEW "Hook support" section linking to
  `docs/hooks.md`. Section placement is Claude's Discretion.
- `docs/output-catalog.md` -- NEW `(installed) {orphan rewake}` row
  in lockstep with REASONS token addition per D-58-01 / D-63-08.
- `tests/catalog/byte-equality.test.ts` (or equivalent UAT fixture
  file) -- new fixture row for the SURF-05 warning per D-63-08;
  lockstep with the catalog source.
- `tests/bridges/hooks/` -- new tests for the staging behavior +
  symlink-escape walk per D-63-02 / D-63-03.
- `tests/orchestrators/plugin/install.test.ts` -- 5th cascade slot
  exercised; orphan-rewake fixture row pinned per D-63-08.
- `tests/shared/notify.test.ts` -- multi-line `hooks:` block render
  pinned per D-63-04; HookSummary discriminator exhaustiveness pinned
  per D-63-06.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`persistence/locations.ts` `hooksDir`** -- already declared at
  `<extensionRoot>/hooks` per Phase 57 D-57-03. Phase 63 is the
  binding caller (D-63-02) -- write site lands here.
- **`shared/atomic-json.ts` (or equivalent atomic-write helper)** --
  the existing tmp+rename + fsync pattern used by `state.json` /
  `mcp.json` / `agents-index.json` writes. Hooks bridge writes
  `<plugin>/hooks.json` via the same helper per D-63-02.
- **`shared/path-safety.ts` `assertPathInside`** -- existing
  containment helper. Phase 63 calls it inside the symlink-escape
  walk per D-63-03.
- **`shared/notify.ts` `REASONS` closed-set tuple** -- gains the
  `"orphan rewake"` token per D-63-08; existing `composeReasons` /
  `pluginRowFormatter` paths render the new token without any code
  change beyond the tuple addition.
- **`shared/notify.ts` `appendResolvedComponentLines`** -- existing
  rendering helper. Phase 63 grows the per-kind switch with the
  `kind === "hooks"` arm per D-63-04.
- **`shared/notify.ts` `COMPONENT_KINDS` 4-tuple** -- grows to a
  5-tuple per D-63-07; the literal-tuple length enforces the renderer
  doesn't silently omit the new kind (Phase 56 / D-56-* pattern).
- **`domain/components/hook-events.ts` `BUCKET_A_EVENTS` /
  `TOOL_EVENTS` tuples** -- typed source-of-truth for SURF-02's
  `ClaudeHookEvent` per D-63-06. Phase 63 re-exports without
  modification.
- **`bridges/hooks/event-router.ts` hydrate path** -- already reads
  `<hooksDir>/<plugin>/hooks.json` at factory time per Phase 59
  D-59-02; the write site Phase 63 introduces closes the loop
  (install writes -> /reload hydrate reads).
- **`orchestrators/plugin/install.ts` `addInstalledPluginHooksToCache`
  call** (line 1019) -- existing in-memory cache + routing-table
  rebuild. Phase 63's staged file write happens BEFORE this call so
  the cache and the on-disk file are coherent post-install.
- **`v1.4 NotificationMessage` / `PluginInfoMessage`** -- typed
  user-facing message family. Phase 63 extends the
  `PluginInfoComponentsResolved.components` shape per D-63-07 without
  introducing a new top-level message variant.

### Established Patterns

- **5-slot Phase literal-array discipline (D-01).** The install /
  update / reinstall / uninstall Phase arrays are hand-written
  literal arrays so the PRD-fixed sequence is part of the type. D-63-01
  preserves this; the array grows by one slot, not by a dynamic
  builder.
- **Discriminated `installable: true | false` + `assertNever`
  exhaustiveness** (NFR-7). Phase 63's `HookSummaryEntry` discriminated
  union (D-63-06) follows the same exhaustiveness pattern; the render
  switch's default arm hits `assertNever`.
- **D-58-01 atomic-supersession (closed-set REASONS + catalog-UAT
  lockstep).** Phase 63's D-63-08 orphan-rewake token addition lands
  in the same commit as the catalog row + the byte-equality test
  fixture; the source rename and the catalog row are never out of
  step.
- **Single-notify-per-orchestrator (RECON-04 / IL-2).** Phase 63 binds
  ZERO new `ctx.ui.notify` call sites. The SURF-05 warning rides the
  existing PluginNotificationMessage cascade per D-63-08; the
  install/uninstall NotificationMessage row carries the new
  `(installed) {orphan rewake}` reason naturally.
- **NFR-1 atomic-write.** Phase 63's hooks-file write uses tmp+rename
  per D-63-02; the existing `atomic-json.ts` helper covers the
  per-write side. Containment guard `assertPathInside(hooksDir,
  <plugin>/hooks.json)` matches the WRITE-site pattern.
- **NFR-2 `/reload` always suffices.** Phase 63 introduces NO
  process-restart recovery path; on a failed write, the
  partially-rolled-back install leaves the file absent (or unchanged
  in update); the next /reload's hydrate succeeds against the
  rolled-back state.
- **NFR-3 idempotent / fail-clean.** The hooks-file write is fully
  derivable from the plugin's source `hooks.json`; rewriting it on
  every install / update is safe. The symlink-escape walk is read-only
  -- failing it on a second attempt produces the same diagnostic.
- **NFR-10 containment-by-construction.** `hooksDir` is composed via
  `path.join(extensionRoot, "hooks")` -- no name input participates
  at the locations layer. The bridge's per-plugin file path is
  `path.join(hooksDir, assertSafeName(plugin), "hooks.json")`.

### Integration Points

- `bridges/hooks/index.ts` -- exports for `prepareStageHook` /
  `commitPreparedHook` / `unstageHook` (or flatter `writeHookConfig`
  / `removeHookConfig` -- Claude's Discretion).
- `bridges/hooks/stage.ts` -- NEW. Hosts the symlink-walk helper per
  D-63-03 + the file-write helper per D-63-02.
- `orchestrators/plugin/install.ts` -- `phases` literal-array gains
  the hooks slot per D-63-01; install row composition queries the
  parsed config for orphan-rewake detection per D-63-08.
- `orchestrators/plugin/update.ts` + `.../reinstall.ts` +
  `.../uninstall.ts` -- each gains the 5th cascade slot mirror per
  D-63-01.
- `orchestrators/plugin/info.ts` -- produces the
  `components.hooks?: readonly HookSummaryEntry[]` payload per
  D-63-07.
- `shared/notify.ts` -- 5 separate seams per D-63-04 / D-63-06 /
  D-63-07 / D-63-08:
  - REASONS tuple += `"orphan rewake"`.
  - `ClaudeHookEvent` + `HookSummaryEntry` + `HookSummary` exports.
  - `PluginInfoComponentsResolved.components.hooks?` field.
  - `COMPONENT_KINDS` 4-tuple -> 5-tuple.
  - `appendResolvedComponentLines` `kind === "hooks"` arm.
- `docs/hooks.md` + `README.md` -- new doc + new section per D-63-09
  / D-63-10 / D-63-11.

### Phase 63 does NOT touch

- The dispatcher / executor / `if`-field / registry implementations
  (Phases 59-62, complete)
- The catalog-UAT framework itself (only adds one new row per
  D-63-08)
- HOOK-04 REASONS rename (`"hooks"` -> `"unsupported hooks"`) --
  closed in Phase 58 per D-58-01
- SURF-03 `<lossy synthesis>` install-time warnings -- reserved for
  v1.14+ when bucket-D events are added (PAYL-V2-02..06)
- Any new sanctioned `node:child_process` site (the
  `no-shell-out.test.ts` 3-site whitelist stays at THREE)
- `state.json` / `agents-index.json` / `mcp.json` schemas (the only
  state surface Phase 63 touches is the `resources.hooks: [plugin]`
  field already added in Phase 57 D-57-01)

</code_context>

<specifics>
## Specific Ideas

- The user grounded the LIFE-03 symlink-escape decision in upstream
  semantics: `cwd = CLAUDE_PROJECT_DIR` (not pluginRoot), absolute
  paths allowed, `$PATH` applies. The REQ wording
  ("`assertPathInside(<pluginRoot>, realpath)`") reads more naturally
  as a subtree walk over `pluginRoot/hooks/` than as a per-command-
  string token parse. The chosen subtree-walk approach (D-63-03)
  matches the real threat model (plugin shipping a symlinked-escape
  bundled script) without rejecting legitimate system-tool references.
- The user picked the multi-line info render (D-63-04) over the
  single-line comma-join used by skills/commands/agents/mcp because
  hook entries carry more structure than name atoms and matcher
  patterns can be long. The 6-space indent (4 for `hooks:` header +
  2 per entry) is consistent with the existing 4-space-indent
  per-kind rendering.
- The user picked NO inline handler-field flags (D-63-05) over
  surfacing `[async]` markers or full
  `{timeout, if, async}` braces. Plugin authors who need details
  read the source; the info row stays terse. This locks the catalog
  grammar -- no new closed-set tokens for handler-field flags in
  v1.13.
- The user picked discriminated-by-event-class for `HookSummaryEntry`
  (D-63-06) because the v1.4 type-driven NotificationMessage
  refactor explicitly cited "no string re-derivation at render time"
  as the regression to prevent. The discriminator pins it
  structurally.
- The user picked extending `components.hooks?` (D-63-07) over a
  separate `hookSummary?` sibling field because the SURF-01 wording
  ("hooks slots alphabetically between commands and mcp")
  semantically implies hooks IS a 5th component kind in the
  rendering model, not a parallel surface.
- The user picked the per-plugin row token (D-63-08) over a separate
  notify() call because RECON-04 / IL-2 forbids second notify
  emissions per orchestrator invocation -- the v1.3 string-API
  failure mode the v1.4 model fixed.
- The user picked `"orphan rewake"` (D-63-08) after clarifying what
  "orphan" signals -- a field whose required companion is absent.
  The word `"rewake"` names the upstream Command-hook-fields family.
- The user picked events-first ordering (D-63-09) over use-cases-
  first because the two target readers (plugin author + CLI-user
  seeing `{unsupported hooks}`) both benefit from a reference-style
  reading order; the unsupported-events section + the "what happens
  to my plugin?" section serve the CLI-user diagnostic path via TOC.
- The user picked all 6 worked examples shipping (D-63-11) over the
  4-or-5-example trim because the doc's value compounds with breadth;
  each example covers a distinct pattern (PreToolUse, PostToolUse,
  SessionStart, UserPromptSubmit, asyncRewake, PreCompact) and the
  marginal ~25 doc lines for the niche PreCompact example is
  acceptable.
- The user picked upstream Claude Code hooks reference + Pi extension
  API docs (D-63-10) as the two authority cross-refs. The Pi
  extension API docs choice anchors plugin authors building
  `asyncRewake` hooks in the host runtime's actual injection model.

</specifics>

<deferred>
## Deferred Ideas

- **SURF-03 install-time `<lossy synthesis>` warnings** -- reserved for
  v1.14+ when bucket-D events are promoted (PAYL-V2-02..PAYL-V2-06).
  Phase 63 does NOT ship any synthesis-caveat tokens; the
  `<lossy synthesis>` marker family is not introduced in v1.13.
- **Standalone `/claude:plugin hooks <plugin>` command** -- SURF-04
  forbids this in v1.13 (info already covers the hooks surface).
  v1.14+ may revisit if hook authoring becomes a primary use case;
  for v1.13 it's a perma-deferral.
- **`list` hook-count column** -- SURF-04 forbids. Same v1.14+
  consideration; same v1.13 perma-deferral.
- **Per-handler info render flags (`[async]`, `[timeout: 30s]`)** --
  D-63-05 omits inline. v1.14+ may add if plugin authors signal a
  need; for v1.13 the terse format ships.
- **`HookSummary` runtime schema validator** -- Phase 63 does NOT
  add a typebox compile site for the user-facing `HookSummary` type.
  v1.14+ may add if `HookSummary` becomes an ingest surface
  (currently it's compiler-only -- produced by the orchestrator,
  consumed by the renderer).
- **Cross-plugin orphan-rewake aggregation** -- if two plugins ship
  orphan-rewake hooks, each gets its own `(installed) {orphan
  rewake}` row. v1.14+ may aggregate at the cascade summary level;
  v1.13 keeps per-plugin emission.
- **Hook author tooling / scaffolder** -- "pi-claude-marketplace
  init-hooks" scaffolder that emits a starter `hooks.json` based on
  the chosen events. Out of v1.13 scope.
- **i18n for docs/hooks.md** -- IL-1 defers i18n to post-v1.x.
  English-only.
- **In-line catalog cross-link from docs/hooks.md to the
  output-catalog.md row** -- the (unavailable) {unsupported hooks}
  row could be linked from the docs/hooks.md "what happens to my
  plugin?" section. Defer to v1.14+ if readers report navigation
  pain.
- **Phase 62 carry-forward manual-only verifications** -- not
  deferred to a future phase; tracked as Phase 63 verification UAT
  items (see Claude's Discretion above). Listed here for cross-ref
  audit only.

### Reviewed Todos (not folded)

- **`.planning/todos/2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`**
  -- post-PR-51 SonarCloud coverage sweep on the mutating
  orchestrators (update.ts 87.9%, reinstall.ts 93.1%, install.ts
  93.4%, marketplace/update.ts 93.7%, import/execute.ts 94.1%,
  edge-deps.ts 49.7%). The sweep mechanically overlaps Phase 63's
  5th-cascade-slot touch but is its own testing-focused concern.
  Future testing-phase candidate; carries forward to next milestone
  triage.

</deferred>

---

*Phase: 63-Lifecycle Cascade, User-Facing Surface & Docs*
*Context gathered: 2026-06-16*
