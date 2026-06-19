# Phase 57: Schema, Component Type & Payload-Extension Tolerance - Context

**Gathered:** 2026-06-14
**Status:** Ready for planning

<domain>
## Phase Boundary

The leaf-foundation phase of v1.13. Three REQs (HOOK-01, HOOK-02, HOOK-03) deliver:

1. A new `hooks` component type in the resolver alongside `skills` / `commands` /
   `agents` / `mcpServers` — admitted as `installable: true` when declared in a plugin
   manifest, preserving the discriminated `installable: true | false` contract (NFR-7).
2. An additive per-plugin `resources.hooks` field that loads v1.12 state.json files
   cleanly (typebox lenience + `ensurePluginResources` default), with no
   `schemaVersion` bump (D-57-01 amends REQ HOOK-02).
3. A forward-compatible TypeBox schema for `hooks.json` with `additionalProperties: true`
   at every nesting level; structural parse failure flips the plugin to
   `installable=false` with `{unsupported hooks}` reason and a debug-log detail.

Phase 57 is bare admission + schema shape + persistence-layer plumbing. The four
TOOL-02 supportability conditions (regex matcher, unmapped tool, non-bucket-A event,
non-`command` handler) belong to Phase 58. Dispatch, exec, payload translation, surface,
and docs all belong to Phases 59–63.

</domain>

<decisions>
## Implementation Decisions

### Schema event-key strictness

- **D-57-02 (lenient top-level):** Hook-config TypeBox schema uses
  `Type.Record(Type.String(), HookEventArraySchema)` at the top level. Event keys
  (`SessionStart`, `PreToolUse`, etc.) are accepted as any string. Phase 58's
  TOOL-02(c) owns the bucket-A admission gate; the schema does not duplicate it.
  Rationale: REQ HOOK-03 mandates `additionalProperties: true` at every nesting level;
  Phase 51's D-09 set the project-wide lenient-on-unknown-keys precedent; a schema-level
  enum would force a rebump on every v1.14+ event-set promotion (PAYL-V2-01..07).
- The known additive-only extension set inside a hook entry
  (`statusMessage` / `once` / `async` / `shell` / `args`) is honored or silently dropped
  per `docs/research/claude-hook-config-syntax.md` § 7 (HOOK-03).
- Unknown extension field names surface debug-log only via `shared/debug-log.ts`
  (OBS-01); they NEVER trigger unavailability — strict forward-compat with Claude
  Code's tolerant parsing.

### Schema bump and migration

- **D-57-01 (REQ HOOK-02 amendment — drop the `schemaVersion` widening):**
  `STATE_SCHEMA.schemaVersion` stays `Type.Literal(1)`. The migration is purely
  additive: `hooks: Type.Array(Type.String())` is added as a required field on
  `PLUGIN_INSTALL_RECORD_SCHEMA.resources`, and `ensurePluginResources` in
  `persistence/migrate.ts` is extended with a `hooks: []` default mirroring the
  existing `agents: []` / `mcpServers: []` lines. Persistence rides the existing
  `persistMigratedState` fire-and-forget path (mutation flag → atomic write via
  `atomicWriteJson`).
  Rationale: every hook-using plugin under v1.0–v1.12 was rejected as
  UNSUPPORTED_COMPONENT_KIND, so no on-disk state.json record carries hook resources
  today. The "migration" is a no-op for every existing record. A `schemaVersion`
  bump would be signaling-only ceremony with no concrete safety win — typebox is
  lenient on missing OPTIONAL fields and on additive REQUIRED fields once the
  default-fill normalization runs first (matches the v1.0 pattern that already
  back-fills `agents: []` and `mcpServers: []`).
- v1.12 state.json files load cleanly under v1.13: the existing
  `migrateLegacyMarketplaceRecords` → `STATE_VALIDATOR.Check(normalized)` flow handles
  default-fill before validation runs. NFR-1 atomic write satisfied via the existing
  `atomicWriteJson` seam. NFR-2 `/reload` always suffices (no Pi restart needed).

### `resources.hooks` storage shape

- **D-57-03 (`generatedName` pattern):** `resources.hooks: string[]` holds zero or one
  entry: the plugin's hooks-container-dir name (the same identity used to derive
  `<locations.hooksDir>/<name>/hooks.json`). Empty array when the plugin declares
  no hooks; single-element array when it does. The runtime reconstructs the full
  path from `<scopeRoot>` (derived from `ctx.cwd` or `PI_CODING_AGENT_DIR` at each
  invocation) — state.json never holds absolute paths, so projects relocate cleanly.
  Mirrors `skills` / `prompts` / `agents` / `mcpServers` semantics (those hold
  `generatedName` values per `orchestrators/plugin/update.ts:1029-1041`, not paths).
- Final naming convention for the hooks-dir name is Claude discretion (probable:
  the plugin id sanitized via `assertSafeName`, matching LIFE-03's path-safety
  contract in Phase 63). Planner picks the concrete derivation.
- The plugin-level routing-table rebuild in Phase 59 (DISP-02) reads from the
  resolved `hooks.json` content on every `/reload`; `resources.hooks` is the
  inventory marker, not a parsed-entry cache. No drift surface.

### Invalid `hooks/hooks.json` handling

- **D-57-04 (silent flip + debug-log):** When a plugin's `hooks/hooks.json` is JSON-
  syntactically invalid, fails the TypeBox schema shape, or omits a required field
  for a `type: "command"` entry, the plugin resolves with `installable: false` and
  reason `{unsupported hooks}` (same closed-set token Phase 58's TOOL-02 emits per
  HOOK-04). The specific parse-error detail goes to `shared/debug-log.ts` (OBS-01)
  for operator diagnosis. No notify error, no abort, no scope-wide cascade.
  Rationale: this matches today's silent-flip-on-malformed-`plugin.json` behavior.
  v1.12's CFG-03 abort-on-invalid stance does NOT generalize here — CFG-03 protects
  the scope-authority config from mass-prune; per-plugin file failure is bounded to
  one plugin.
- Required-field discipline within a hook entry (e.g., a `type: "command"` entry
  with no `command` field) is a parse-time gate that triggers the same flip.
  The planner decides whether `command` is `Type.String()` or
  `Type.Optional(Type.String())` at the schema level — pragmatically, REQUIRED is
  cleaner because absence has no useful semantics under the bucket-A-only scope.

### Claude's Discretion

- Exact file placement: research (`SUMMARY.md` § Architecture) suggested
  `domain/components/hooks.ts` for the schema + parser, mirroring
  `domain/components/{mcp,plugin}.ts`. Planner can confirm.
- Internal API split between schema definition, validator compile, and parser
  helper functions — follow `persistence/state-io.ts` (Compile + Check + Errors +
  `firstValidationErrorDetail`) as the closest analog.
- Hook-entry schema shape: required vs optional `command` for `type: "command"`
  handler; optionality of `matcher` (per MATCH-01, empty `""` matches all, but
  whether absent equates to empty-string is a parser concern that may surface
  in Phase 58).
- Mechanism for moving `"hooks"` out of `UNSUPPORTED_COMPONENT_KINDS` and into
  the supported set in `domain/resolver.ts`: planner picks whether to extend
  `SUPPORTED_COMPONENT_KINDS = ["skills","commands","agents"]` to include
  `"hooks"` or to slot it parallel to `mcpServers` (which is structured separately
  in `PartialResolution`). The right choice depends on whether `hooks` shares the
  `componentPaths: {skills,commands,agents}` typing or carries its own field.

### Reviewed Todos (not folded)

- `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`
  matched at score 0.4 via keyword "plugin". That todo is v1.12 orchestrator-
  coverage backlog (uncovered failure arms in `orchestrators/plugin/{update,
  reinstall,install}.ts` and `orchestrators/marketplace/update.ts` and
  `orchestrators/edge-deps.ts`), unrelated to v1.13 hooks-schema scope. Kept in
  the pending todos pile.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap

- `.planning/REQUIREMENTS.md` — HOOK-01..06, MATCH-01..03, TOOL-01..02,
  DISP-01..04, EXEC-01..05, PAYL-01, SURF-01..06, LIFE-01..03, OBS-01. Phase 57
  lands HOOK-01 / HOOK-02 / HOOK-03 only.
- `.planning/ROADMAP.md` — Phase 57 goal + 4 success criteria; Phases 58–63
  boundaries (Phase 57 deliberately does NOT land MATCH/TOOL/DISP/EXEC/PAYL/SURF/
  LIFE/OBS work).
- `.planning/PROJECT.md` § "Current Milestone: v1.13 Claude Hook Bridge" — locked
  scope-cut (bucket-A only); strict-supportability stance at PLUGIN level.

### v1.13 research (advisory; scope-mismatch caveat applies)

- `.planning/research/SUMMARY.md` — synthesis with scope-mismatch caveat at the
  top: any reference to FileChanged (bucket B), bucket-D events, soft-dep
  Subagent events is now v1.14+ (PAYL-V2-01..07). The 9-phase ordering in the
  doc was for the original 16-event scope; v1.13's 7-phase roadmap supersedes.
- `.planning/research/ARCHITECTURE.md` — component placement (`domain/components/
  hooks.ts`); state-split detail; build order.
- `.planning/research/PITFALLS.md` — Pitfall 7 (strict TypeBox rejects extensions
  if `additionalProperties: false` slips in); Pitfall 9 (schema bump cross-version
  concurrency — partially moot under D-57-01's no-bump path); Pitfall 22 (missing
  hooks.json tolerance).
- `.planning/research/STACK.md` — version pins. Note: `chokidar@^5` runtime dep
  is deferred to v1.14+ (PAYL-V2-01) and is NOT introduced in Phase 57.

### Prior phase decisions

- `.planning/milestones/v1.12-phases/51-config-schema-persistence-state-split/51-CONTEXT.md`
  — D-09 (lenient unknown keys, project-wide); D-15 (discriminated load result +
  `assertNever` convention); D-12 / D-13 (legacy-field migration pattern);
  D-19 (notify routing discipline). Phase 57 reuses these patterns; do not
  re-litigate.

### Authority sources (cross-reference only — read end-to-end is not required for Phase 57)

- `docs/research/claude-hooks-vs-pi-events.md` — event taxonomy, bucket
  assignments, marketplace audit. Phase 57's schema accepts any event name; the
  bucket-A gate lives in Phase 58 / TOOL-02.
- `docs/research/claude-hook-config-syntax.md` — full Claude Code hook config
  field reference. Read § 7 for the known additive-only extension set
  (`statusMessage` / `once` / `async` / `shell` / `args`) and the IMPLEMENT /
  TOLERATE / ESCALATE verdicts that informed HOOK-03.

### Codebase templates (mirror these patterns)

- `extensions/pi-claude-marketplace/persistence/state-io.ts` — STATE_SCHEMA +
  Compile validator + `loadState`/`saveState` + `firstValidationErrorDetail`;
  direct template for the hook-config schema's compile + check pattern.
  PLUGIN_INSTALL_RECORD_SCHEMA at lines 39–56 is the schema Phase 57 extends
  (add `hooks: Type.Array(Type.String())`).
- `extensions/pi-claude-marketplace/persistence/migrate.ts` — `ensurePluginResources`
  at lines 89–122 is the function Phase 57 extends with the `hooks: []` default
  (mirror the existing `agents` / `mcpServers` defaults at lines 111–119).
  `persistMigratedState` is the existing fire-and-forget atomic-write seam.
- `extensions/pi-claude-marketplace/domain/resolver.ts` — `SUPPORTED_COMPONENT_KINDS`
  at line 126 (gains `"hooks"`); `UNSUPPORTED_COMPONENT_KINDS` at line 138
  (loses `"hooks"`); `UNSUPPORTED_COMPONENT_CONVENTIONS.hooks` at line 156
  (discovery path `hooks/hooks.json` already wired — moves to the supported
  registry). `PartialResolution` interface at line 165 may need a `hooks` field
  parallel to `componentPaths.{skills,commands,agents}` or to `mcpServers`.
- `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts:1029-1041` —
  shows the `generatedName` storage pattern across the 4 existing resource types
  (the authoritative reference for D-57-03's no-absolute-paths discipline).
- `extensions/pi-claude-marketplace/domain/components/{mcp,plugin}.ts` —
  parallel siblings; `domain/components/hooks.ts` (Phase 57 NEW) sits here.
- `extensions/pi-claude-marketplace/shared/atomic-json.ts` — `atomicWriteJson`,
  the NFR-1 sanctioned JSON write path (any save Phase 57 touches goes through
  this, indirectly via the existing `persistMigratedState`).

### Messaging contract (binds the eventual `{unsupported hooks}` row in Phase 63 — Phase 57 does not emit)

- `docs/messaging-style-guide.md` — locked grammar, closed sets. Phase 57 does
  not introduce new REASONS members; `{unsupported hooks}` is the HOOK-04 rename
  in Phase 63.
- `docs/output-catalog.md` — per-command byte forms. Phase 57 has no new catalog
  entries. The `(unavailable) {unsupported hooks}` byte form lands with HOOK-04
  in Phase 63.
- `extensions/pi-claude-marketplace/shared/notify.ts` — structured
  `NotificationMessage` + `emitWithSummary` seam (GRAM-01..05). Phase 57 binds
  zero new emissions; install-time `{unsupported hooks}` flips come via the
  existing resolver-unavailable cascade.

### Background

- `docs/prd/pi-claude-marketplace-prd.md` — NFR-1 / NFR-2 / NFR-3 / NFR-5 /
  NFR-7 / NFR-10 / NFR-12 are all directly load-bearing for Phase 57's schema /
  migration / discriminated-installable contract.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`STATE_SCHEMA` + `Compile(STATE_SCHEMA)` + `STATE_VALIDATOR.Check()` +
  `firstValidationErrorDetail()` pattern** (`persistence/state-io.ts`) — copy
  wholesale for the hook-config schema. typebox 1.x discriminator usage is
  identical.
- **`ensurePluginResources(mp)`** (`persistence/migrate.ts:89-122`) — the
  function Phase 57 extends. Add `hooks: []` default in the same block as the
  existing `agents` / `mcpServers` defaults at lines 111–119. The function
  returns `mutated: boolean`; the existing fire-and-forget save path picks up
  the new mutation automatically.
- **`migrateLegacyMarketplaceRecords(parsed, extensionRoot, scrubAutoupdate)`**
  (`persistence/migrate.ts:143-190`) — calls `ensurePluginResources` per-marketplace
  per-plugin; no code change needed here once the helper picks up `hooks`.
- **`atomicWriteJson`** (`shared/atomic-json.ts`) — NFR-1 sanctioned JSON write
  path. Reached via the existing `persistMigratedState`.
- **`UNSUPPORTED_COMPONENT_CONVENTIONS.hooks`** (`domain/resolver.ts:156`) — the
  discovery convention `[{relativePath: "hooks/hooks.json", kind: "file"}]` is
  already wired. Phase 57 moves the `"hooks"` key from `UNSUPPORTED_COMPONENT_KINDS`
  (line 138) to `SUPPORTED_COMPONENT_KINDS` (line 126) or to a parallel
  hooks-specific resolver field.

### Established Patterns

- **Discriminated `installable: true | false`** with `assertNever` exhaustiveness
  (NFR-7, D-15 from Phase 51) — Phase 57's resolver admission preserves this.
  A plugin with parseable `hooks.json` resolves `installable: true`; with
  malformed `hooks.json` resolves `installable: false` (D-57-04).
- **Lenient typebox** — `additionalProperties: true` is the default in typebox
  object schemas; D-09 from Phase 51 makes the project-wide lenient-on-unknown-
  keys discipline explicit. Phase 57's HOOK-03 inherits this directly.
- **`generatedName`-based persistence** (`orchestrators/plugin/update.ts:1029-1041`)
  — state.json never holds absolute paths; runtime derives paths from
  `<scopeRoot>` + the `locations` module. Phase 57's `resources.hooks` follows
  this discipline (D-57-03).
- **Fire-and-forget legacy migration persist** (`persistence/migrate.ts:193+`,
  IL-3 sanctioned `console.warn`) — Phase 57 reuses; the new `hooks: []` default
  rides the same `void persistMigratedState(...)` call.
- **`assertPathInside` containment** (`shared/path-safety.ts`, NFR-10) — Phase
  63's LIFE-03 is the binding caller, but Phase 57's locations addition
  (`hooksDir` per scope) needs to land in `persistence/locations.ts` so LIFE-03
  has a target.

### Integration Points

- `persistence/state-io.ts` — PLUGIN_INSTALL_RECORD_SCHEMA's `resources` gains
  `hooks: Type.Array(Type.String())`.
- `persistence/migrate.ts` — `ensurePluginResources` gains `hooks: []` default.
- `persistence/locations.ts` — gains `hooksDir` (per-scope) under
  `<scopeRoot>/pi-claude-marketplace/hooks/`; needed both by D-57-03 (runtime
  path reconstruction) and by Phase 63 LIFE-03 (containment caller). The
  `locations` module is the single source of truth for scope-derived paths.
- `domain/resolver.ts` — `"hooks"` moves out of `UNSUPPORTED_COMPONENT_KINDS`
  (line 138) and into the supported set. `UNSUPPORTED_COMPONENT_CONVENTIONS.hooks`
  may need to move to a parallel `SUPPORTED_COMPONENT_CONVENTIONS` or stay where
  it is and be re-keyed. `PartialResolution` gains a hooks field; the
  `notInstallable` / `installable` builders carry it through.
- `domain/components/hooks.ts` (NEW) — TypeBox schema for `hooks.json` shape;
  Compile validator; parser helper(s); discriminated `HookConfigLoadResult`
  if D-57-04's deferred-discriminated-result option from Phase 58 lands.
- Phase 57 does NOT touch `bridges/`, `orchestrators/`, `shared/notify.ts`,
  `shared/debug-log.ts`, or `index.ts`. Those wire-ups are Phases 58–63.

</code_context>

<specifics>
## Specific Ideas

- The user explicitly rejected the `schemaVersion` widening as ceremony for a
  no-op migration (the v1.0–v1.12 rejection of hook-using plugins means no
  existing state.json record carries hook resources to "migrate"). REQ HOOK-02
  is amended in lockstep with this CONTEXT.md commit — see D-57-01.
- The user explicitly corrected the initial absolute-path recommendation for
  `resources.hooks`. The project's discipline is `generatedName` values, not
  paths — relocation-safe state.json. Do not regress.
- Schema-level lenient top-level (`Type.Record(Type.String(),...)`) is locked.
  Do not duplicate Phase 58's bucket-A gate at the schema layer.
- Invalid `hooks/hooks.json` follows the existing silent-flip-on-malformed-
  manifest pattern, NOT the v1.12 CFG-03 abort pattern (which protects scope-
  authority files from mass-prune; not applicable per-plugin).

</specifics>

<deferred>
## Deferred Ideas

- **Per-plugin hooks-config DSL extensions beyond Claude Code's contract** —
  permanent anti-feature (PROJECT.md "Out of Scope"). Bridge fidelity is the
  value prop.
- **Stricter event-key validation at schema level** (Type.Union of 8 Literals)
  — revisit if v1.14+ forward-compat tolerance causes friction. Today's
  lenient stance is locked.
- **Discriminated `loadHooksConfig` result with `{status: absent|invalid|valid}`**
  — natural extension when Phase 58 wires TOOL-02 to the parser output. Phase
  57 implements the simpler in-line "parse fails → flip installable=false" path
  per D-57-04; Phase 58 can promote to the discriminated shape if it improves
  the TOOL-02 gate code.
- **`schemaVersion: Literal(1) | Literal(2)` downgrade-detection** — never
  load-bearing for v1.13 backward compat (no existing data needs migrating).
  Revisit when a future milestone introduces a genuine semantic break that
  needs hard refusal under older binaries. Not v1.13.

### Reviewed Todos (not folded)

- `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`
  — v1.12 orchestrator-coverage backlog; out of v1.13 scope. Pending todo
  remains in the queue for a future milestone.

</deferred>

---

*Phase: 57-Schema, Component Type & Payload-Extension Tolerance*
*Context gathered: 2026-06-14*
