# Phase 57: Schema, Component Type & Payload-Extension Tolerance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-14
**Phase:** 57-Schema, Component Type & Payload-Extension Tolerance
**Areas discussed:** Schema event-key strictness, v1→v2 migration timing,
`resources.hooks` storage shape, Invalid `hooks/hooks.json` handling

---

## Schema event-key strictness

| Option | Description | Selected |
|--------|-------------|----------|
| Lenient `Type.Record(Type.String(), ...)` (Recommended) | Top-level event keys accepted as any string. TOOL-02(c) in Phase 58 owns the bucket-A gate. Forward-compat-clean for v1.14+ event promotions. | ✓ |
| Strict 8-event enum | Top-level typed as `Type.Union` of 8 Literals. Schema catches typo'd event names earlier but duplicates one of TOOL-02's conditions; v1.14+ promotion forces schema-shape change. | |
| Lenient + assert at parse | Schema is lenient `Record`, but a separate parser pass emits a debug-log warning when an event key isn't bucket-A. Phase 58 still owns installability. | |

**User's choice:** Lenient `Type.Record(Type.String(), ...)`
**Notes:** Locked. TOOL-02(c) in Phase 58 is the single source of truth for the
bucket-A gate. Schema does not duplicate it.

---

## v1→v2 migration timing (recharacterized to "schemaVersion bump necessity")

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory eager, on-disk deferred (initially Recommended) | `loadState` returns v=2 ExtensionState in memory; first subsequent mutating op (already inside WLST) persists v=2 to disk. | |
| Wrap loadState's save in WLST | Tight literal reading of HOOK-02; cold `loadState` from a v=1 file does a write under the state lock. | |
| Eager fire-and-forget (Phase 51 mirror) | In-memory transform, `void persistMigratedState`, no extra lock. | |
| **Free-text pushback** | User asked: "plugins that had hooks could not be installed. so do we need a schema change in this case?" | ✓ |

**User's choice:** Free-text pushback — the entire premise of REQ HOOK-02's
`schemaVersion` widening was challenged.

**Notes:** User correctly identified that since v1.0–v1.12 rejected hook-using
plugins as `UNSUPPORTED_COMPONENT_KIND`, no existing state.json record carries
hook resources. The "migration" REQ HOOK-02 prescribes is a no-op for every
record that exists on disk. The bump would be signaling-only.

Recharacterized options were presented:

| Option | Description | Selected |
|--------|-------------|----------|
| **#1 No bump, no migration** | Add `hooks` as `Type.Optional(Type.Array(Type.String()))` on `resources`. Existing files load cleanly. No migrate.ts changes. | |
| **#2 No bump, additive migration to required field** | Add `hooks: Type.Array(Type.String())` as REQUIRED. Extend `ensurePluginResources` with `hooks: []` default mirroring `agents`/`mcpServers`. Bump-free symmetry with established v1.0 pattern. | ✓ |
| **#3 Bump for signaling only** | Both #1 and #2 functionally complete without bumping. Bump exists only for downgrade-detection. | |

**Final decision:** Option #2 — drop the `schemaVersion` bump from HOOK-02; keep
the additive `hooks: []` defaulting in `ensurePluginResources`. Captured as
D-57-01 in CONTEXT.md. REQUIREMENTS.md HOOK-02 wording amended in lockstep with
this discussion's commit.

---

## `resources.hooks` storage shape

| Option | Description | Selected |
|--------|-------------|----------|
| Absolute path to staged `hooks.json` (initially Recommended) | Single-element array per installed plugin: absolute filesystem path. | |
| Relative path under `<scopeRoot>` | Same as above but stored as relative path and re-anchored at read time. | |
| Hook entry IDs (synthetic `event:matcher:index`) | Granular per-entry tracking; introduces a drift surface vs. parsed source file. | |
| **Free-text pushback** | User asked: "why did we pick absolute paths? this makes it so that if a project is moved from a location to another. everything breaks, no?" | ✓ |

**User's choice:** Free-text pushback — the initial Recommended option was
fundamentally wrong about the existing project pattern.

**Notes:** Investigation of `orchestrators/plugin/update.ts:1029-1041` revealed
that `resources.{skills,prompts,agents,mcpServers}` hold `generatedName` values,
not paths. Runtime reconstructs full paths via `<scopeRoot>` (derived from
`ctx.cwd` or `PI_CODING_AGENT_DIR` at each invocation) + the `locations` module.
The whole project relocates cleanly because state.json holds identities, not
paths.

Recharacterized options were presented:

| Option | Description | Selected |
|--------|-------------|----------|
| **Yes — generatedName pattern** (Recommended) | `resources.hooks: string[]` holds zero or one entry: the plugin's hooks-container-dir name. Runtime reconstructs `<locations.hooksDir>/<name>/hooks.json`. | ✓ |
| Filename literal `["hooks.json"]` | Always exactly `["hooks.json"]` when hooks present, `[]` when absent. The plugin id is implicit. Breaks the 'each string identifies an artifact' invariant. | |

**Final decision:** `generatedName` pattern — single-element array holding the
plugin's hooks-dir name. Captured as D-57-03 in CONTEXT.md.

---

## Invalid `hooks/hooks.json` handling

| Option | Description | Selected |
|--------|-------------|----------|
| Silent flip + debug-log (Recommended) | Plugin flips to `installable=false` with `{unsupported hooks}` reason. Parse-error detail goes to `shared/debug-log.ts` (OBS-01). Mirrors how malformed `plugin.json` is handled today. | ✓ |
| Flip + loud notify error | Same flip-to-unavailable PLUS a notify error at install time. Louder, but asymmetric with existing manifest-malformation handling. | |
| Mirror CFG-03 partial (discriminated load result) | `loadHooksConfig(path)` returns `{status: 'absent'|'invalid'|'valid', ...}`. Heaviest pattern. | |

**User's choice:** Silent flip + debug-log
**Notes:** Captured as D-57-04 in CONTEXT.md. CFG-03 abort-on-invalid does not
generalize — that pattern protects scope-authority config from mass-prune;
per-plugin file failure is bounded to one plugin. The discriminated-load-result
shape (option 3) is deferred to Phase 58 if it improves the TOOL-02 gate code.

---

## Claude's Discretion

- Exact file placement for the schema (`domain/components/hooks.ts` is the
  research-suggested target; planner can confirm).
- Internal API split between schema definition, validator compile, and parser
  helpers — mirror `persistence/state-io.ts`.
- Hook-entry schema shape: required vs optional `command` for `type: "command"`
  handler; whether the `matcher` field is `Type.Optional(Type.String())` vs
  `Type.String()` (empty-string match-all is required either way per MATCH-01).
- Mechanism for moving `"hooks"` out of `UNSUPPORTED_COMPONENT_KINDS` into the
  supported set in `domain/resolver.ts` — whether to extend
  `SUPPORTED_COMPONENT_KINDS` or slot hooks parallel to `mcpServers`.
- Final naming convention for the hooks-dir `generatedName` (likely the plugin
  id sanitized via `assertSafeName` per LIFE-03's path-safety contract).

## Deferred Ideas

- Per-plugin hooks-config DSL extensions beyond Claude Code (permanent
  anti-feature per PROJECT.md "Out of Scope").
- Stricter event-key validation at schema level (revisit in v1.14+ if forward-
  compat tolerance causes friction).
- Discriminated `loadHooksConfig` result — Phase 58 may revisit when wiring
  TOOL-02 to parser output.
- `schemaVersion: Literal(1) | Literal(2)` downgrade-detection — not v1.13;
  revisit when a future milestone introduces a genuine semantic break.

### Reviewed Todos (not folded)

- `2026-06-12-coverage-sweep-test-rare-failure-arms-in-update-reinstall-in.md`
  — v1.12 orchestrator-coverage backlog; matched at score 0.4 via keyword
  "plugin"; unrelated to v1.13 hooks-schema scope. Remains in `pending/`.
