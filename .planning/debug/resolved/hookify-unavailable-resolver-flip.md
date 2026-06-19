---
status: resolved
trigger: "hookify@claude-plugins-official is classified (unavailable) {unsupported hooks} via /claude:plugin info and (unavailable) {unsupported source} via /claude:plugin install cascade. Install never reaches the hooks-bridge slot — resolver flips installable: false earlier."
created: 2026-06-16T00:00:00Z
updated: 2026-06-19T00:00:00Z
---

> Correction (63-09 closure): the original trigger claimed hookify uses
> "ONLY bucket-A supported events". That claim was wrong -- hookify's
> upstream `hooks/hooks.json` also ships a `Stop` event arm, which is
> NOT a member of v1.13's `BUCKET_A_EVENTS` (see
> `extensions/pi-claude-marketplace/domain/components/hook-events.ts`).
> The wrapper-format wire-contract bug diagnosed in this session IS
> closed by plan 63-09 (parseHooksConfig now unwraps the upstream
> `{description?, hooks: {...}}` envelope); however, hookify will still
> flip to `(unavailable) {unsupported hooks}` at runtime via
> `checkMatcherSupportability` until `Stop` is added to
> `BUCKET_A_EVENTS`. That bucket-A extension is a v1.14+ scope item,
> not a v1.13 defect.

## Current Focus

hypothesis: CONFIRMED — HOOKS_CONFIG_SCHEMA encodes the settings.json shape (top-level event keys), but upstream Claude Code mandates the wrapped `{description, hooks: {...}}` envelope for plugin `hooks/hooks.json`. Hookify ships the wrapped form, the validator rejects it, parseHooksConfig returns `{ok:false, reason:"hooks.json failed schema validation: ..."}`, the resolver wraps as `"malformed hooks.json: ..."`, and downstream narrowers map the note to two different REASONS tokens — `{unsupported hooks}` on the `info` probe surface and `{unsupported source}` on the `install` cascade surface (because install.ts narrowResolverReasons has no hooks-prefix arm).
test: read schema + parser + resolver + classifier code; fetch upstream Claude Code SKILL.md to settle the canonical wire format; check git log for whether the schema ever had an unwrap step; check stage test fixture history
expecting: schema rejects the wrapped form; parser returns the documented reason; both classifiers exhibit the documented mismatch; upstream docs confirm wrapper is canonical for plugin hooks.json
next_action: return ROOT CAUSE FOUND (mode is find_root_cause_only — plan-phase --gaps owns the fix)

## Symptoms

expected: |
  `/claude:plugin install hookify@claude-plugins-official` resolves hookify as installable, the install cascade reaches the hooksPhase slot (Phase 63 Plan 04), writeHookConfig writes `<scopeRoot>/pi-claude-marketplace/hooks/hookify/hooks.json`, and the cascade emits `+ hookify@claude-plugins-official [user] (installed)` followed by a /reload hint.

actual: |
  `/claude:plugin info hookify@claude-plugins-official` →
      ⊘ hookify (unavailable) {unsupported hooks}
        components: not resolved
  `/claude:plugin install hookify@claude-plugins-official` →
      ⊘ hookify (unavailable) {unsupported source}
  No `tmp/pi-uat/agent/pi-claude-marketplace/hooks/hookify/` directory was created.

errors: |
  None — both surfaces report the failure as a normal closed-set REASONS tag, not as an Error/Warning notify row.

reproduction: |
  Test 3 in `.planning/phases/63-lifecycle-cascade-user-facing-surface-docs/63-UAT.md`, against `tmp/pi-uat/` sandbox with `claude-plugins-official` (source: `anthropics/claude-plugins-official`) already added. On-disk `tmp/pi-uat/agent/pi-claude-marketplace/sources/claude-plugins-official/plugins/hookify/hooks/hooks.json` uses the wrapped envelope:
      {
        "description": "Hookify plugin - User-configurable hooks ...",
        "hooks": { "PreToolUse": [...], "PostToolUse": [...], "Stop": [...], "UserPromptSubmit": [...] }
      }

started: |
  Discovered 2026-06-16 during UAT for Phase 63 (lifecycle-cascade-user-facing-surface-docs). The hooks-bridge surface was introduced in Phase 63; the parser schema dates to Phase 57.

## Eliminated

(none — the primary hypothesis was confirmed without elimination loops)

## Evidence

- timestamp: 2026-06-16T00:00:00Z
  checked: extensions/pi-claude-marketplace/domain/components/hooks.ts:178-193
  found: HOOKS_EVENT_ARRAY_SCHEMA = Type.Array(HOOK_ENTRY_SCHEMA). HOOKS_CONFIG_SCHEMA = Type.Record(Type.String(), HOOK_EVENT_ARRAY_SCHEMA). The schema EXPECTS the top-level keys to be event names mapping to arrays — no wrapper envelope. HOOK_ENTRY_SCHEMA requires `hooks: Array(HOOK_HANDLER_SCHEMA)` on each group. Comment block at line 13 cites D-57-02 as the rationale: "the top-level shape is Type.Record(Type.String(), ...)". The schema's structural shape is a deliberate design choice attributed to D-57-02.
  implication: The validator cannot accept the wrapped wire form. Against hookify's hooks.json, validation at the root sees keys `["description", "hooks"]`; `description` is a string, not an array of HOOK_ENTRY_SCHEMA, so the validator immediately trips on `/description` with a "expected array" message.

- timestamp: 2026-06-16T00:00:00Z
  checked: extensions/pi-claude-marketplace/domain/components/hooks.ts:273-320 (parseHooksConfig)
  found: parseHooksConfig calls JSON.parse, then HOOKS_VALIDATOR.Check(parsed) directly with NO unwrapping. On Check() failure it returns `{ok:false, reason: "hooks.json failed schema validation: <instancePath>: <message>"}`. No alternative parse path for the wrapped form exists anywhere in the file.
  implication: Hookify's wire bytes flow JSON.parse OK → HOOKS_VALIDATOR.Check fails → the discriminated `{ok:false, reason}` arm fires.

- timestamp: 2026-06-16T00:00:00Z
  checked: extensions/pi-claude-marketplace/domain/resolver.ts:669-705 (readStandaloneHooks) + 750-779 (applyHooksConfig)
  found: readStandaloneHooks reads the file, then wraps the parseHooksConfig failure as `{ok:false, reason: "malformed hooks.json: " + parsed.reason}`. applyHooksConfig pushes that reason into `partial.notes` and returns `dirty=true`, flipping the resolution to notInstallable.
  implication: For a plugin whose hooks.json validates fine (i.e. uses the settings shape), this works. For a plugin shipping the upstream wrapper shape (i.e. every real Claude plugin), the resolver always flips installable:false with the note `"malformed hooks.json: hooks.json failed schema validation: <root>: <typebox-message>"`.

- timestamp: 2026-06-16T00:00:00Z
  checked: extensions/pi-claude-marketplace/shared/probe-classifiers.ts:87-123 (narrowResolverNotes — read-only probe path used by `/claude:plugin info` and `/claude:plugin list`)
  found: Matches `note.startsWith("malformed hooks.json:")` → emits `"unsupported hooks"`. Also matches `"hooks.json is not valid JSON:"`, `"hooks.json failed schema validation:"`, `"unsupported hooks:"`.
  implication: Probe surface (`/claude:plugin info`) classifies the failure as `{unsupported hooks}` — matches the recorder's first observation precisely. The label is misleading: hookify's hooks ARE supported (bucket-A events, command handlers, plain matchers); the parser just doesn't understand the wrapper format. The token reads as "this plugin uses something we can't support" rather than the truthful "we can't parse this file format".

- timestamp: 2026-06-16T00:00:00Z
  checked: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1689-1736 (narrowResolverReasons — install-cascade path used by `/claude:plugin install`)
  found: This is a SEPARATE classifier from probe-classifiers.ts. Its arms:
    1. manifest-field carve-out `"contains lspServers"` → `"lsp"`
    2. `reason.includes("source")` → `"unsupported source"`
    3. errno substrings (EACCES/EPERM/ENOENT/ENOTDIR/SyntaxError) → those tokens
    4. fallback: `"unsupported source"`
  It has NO arm for the `"malformed hooks.json:"` / `"hooks.json failed schema validation:"` / `"unsupported hooks:"` / `"hooks.json is not valid JSON:"` prefix family. The note `"malformed hooks.json: ..."` does not include `"source"`, so it falls through to the conservative fallback `"unsupported source"`.
  implication: The install cascade surfaces the SAME on-disk condition with a DIFFERENT reason than the probe surfaces. This is a cross-surface classifier-parity gap on top of the schema-shape root cause. Matches the recorder's second observation precisely.

- timestamp: 2026-06-16T00:00:00Z
  checked: Upstream Claude Code SKILL.md (`anthropics/claude-code:plugins/plugin-dev/skills/hook-development/SKILL.md`, fetched via raw.githubusercontent.com)
  found: Verbatim quote (section "Hook Configuration Formats"):
    "For plugin hooks in `hooks/hooks.json`, use **wrapper format**:
       { 'description': 'Brief explanation of hooks (optional)', 'hooks': { 'PreToolUse': [...], ... } }
     Key points:
     - description field is optional
     - hooks field is REQUIRED wrapper containing actual hook events
     - This is the **plugin-specific format**"
    "For user settings in `.claude/settings.json`, use **direct format**:
       { 'PreToolUse': [...], 'Stop': [...], ... }
     Key points:
     - No wrapper - events directly at top level
     - No description field
     - This is the **settings format**"
  implication: Upstream Anthropic specifies TWO distinct formats. The wrapper form is the REQUIRED canonical shape for plugin hooks.json (which is exactly what resolver.ts:675 reads: `path.join(pluginRoot, "hooks", "hooks.json")`). The direct form is the settings.json shape and is NOT applicable to plugin files. The HOOKS_CONFIG_SCHEMA in this codebase encodes the settings-format shape and applies it to plugin files — a wire-contract mismatch.

- timestamp: 2026-06-16T00:00:00Z
  checked: git log --follow on extensions/pi-claude-marketplace/domain/components/hooks.ts
  found: HOOKS_CONFIG_SCHEMA was introduced in commit 43aad1e ("feat(57-02): add HOOKS_CONFIG_SCHEMA + HOOKS_VALIDATOR") with the comment "Lenient top-level event keys per D-57-02 (Type.Record(Type.String(), ...))". No commit ever introduced or removed an unwrap step.
  implication: This is an original-implementation bug from Phase 57, not a regression. D-57-02 anchored the schema to the settings shape from the start. Phase 63 (the lifecycle-cascade surface) inherits the gap and surfaces it on every real plugin.

- timestamp: 2026-06-16T00:00:00Z
  checked: tests/bridges/hooks/stage.test.ts:40-42 + git show ba6632d
  found: HOOKS_VALUE fixture is `{PreToolUse: [{matcher:"Bash", hooks:[{type:"command", command:"echo hi"}]}]}` — the unwrapped form. The WR-05 comment at line 37-39 says verbatim: "schema-valid top-level-event-keys shape (parity with `cascade.test.ts` and `lifecycle-cascade.test.ts`). HOOKS_CONFIG_SCHEMA is a Record<string, HookEventArray>, NOT a wrapper object." Commit ba6632d (2026-06-16) explicitly switched this fixture FROM the wrapped form TO the unwrapped form to make the test align with the schema.
  implication: The full Phase 63 unit-test suite uses fixtures that mirror the (wrong) schema rather than the (canonical) wire format. The schema-shape bug is invisible to the unit-test suite and only emerges against real upstream plugins. This is the reason Phase 63 passed 7/7 verification but failed the first runtime probe.

- timestamp: 2026-06-16T00:00:00Z
  checked: `ls tmp/pi-uat/agent/pi-claude-marketplace/`
  found: No `hooks/` subdirectory exists. The agent dir contains `agents-index.json`, `agents-staging/`, `cache/`, `commands-staging/`, `data/`, `resources/`, `skills-staging/`, `sources/`, `sources-staging/`, `state.json` — but no `hooks/`.
  implication: The hooks-bridge slot (Phase 63 Plan 04 cascade phase) never ran for hookify. The resolver flipped installable:false BEFORE the install cascade reached the phase. Confirms the bug is upstream of the bridge, in the parser/schema layer.

- timestamp: 2026-06-16T00:00:00Z
  checked: extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:700-738 (hooksPhase) + bridges/hooks/stage.ts:195-206 (writeHookConfig)
  found: When the parse succeeds, writeHookConfig writes parsed.value verbatim (no transformation) to `<hooksDir>/<plugin>/hooks.json`. The cache-hydrate / dispatch path consumes this same shape downstream. So the schema-shape is BOTH the read contract (validates plugin hooks.json) AND the write contract (defines what gets written to the bridge dir).
  implication: Out of scope for diagnosis, but informs the fix: a "preprocess: unwrap then validate" patch in parseHooksConfig is the minimal-blast-radius fix — it does not require changing the writer contract or the bridge cache-hydrate shape. The unwrap can be conditional: if `parsed` has the shape `{description?: string, hooks: object, ...}`, treat `parsed.hooks` as the inner config; otherwise fall through to the current behavior (so a user-settings-style file in a plugin dir still rejects, preserving the distinction the upstream spec draws). The downstream `writeHookConfig` then continues to emit the settings-format on disk, which is what Pi's hook-router expects on hydrate.

## Resolution

root_cause: |
  `HOOKS_CONFIG_SCHEMA` in `extensions/pi-claude-marketplace/domain/components/hooks.ts:185` encodes the upstream Claude Code SETTINGS-FORMAT shape (`Type.Record(Type.String(), Type.Array(HOOK_ENTRY_SCHEMA))` — bare top-level event keys) but is applied to plugin `hooks/hooks.json` files, which the upstream Claude Code spec REQUIRES to use the PLUGIN-FORMAT WRAPPER `{description?: string, hooks: {<event>: [...], ...}}`. The two are documented as distinct formats in the official hook-development SKILL.md. `parseHooksConfig` (hooks.ts:288) calls `HOOKS_VALIDATOR.Check(parsed)` directly with no unwrap step, so every real upstream plugin (hookify ships the wrapper form, and the marketplace contains many more) fails validation at `/description: expected array`. The failure flows out as the note `"malformed hooks.json: hooks.json failed schema validation: /description: ..."`, the resolver flips installable:false BEFORE the install cascade reaches the Phase 63 hooks-bridge slot, and two downstream narrowers map the note to two different (both misleading) REASONS tokens:
    - `narrowResolverNotes` (shared/probe-classifiers.ts:87-123) → `{unsupported hooks}` on the `/claude:plugin info` and `/claude:plugin list` surfaces (truthful prefix match, but misleading label — the hooks themselves are entirely bucket-A supported).
    - `narrowResolverReasons` (orchestrators/plugin/install.ts:1689-1736) → `{unsupported source}` on the `/claude:plugin install` cascade surface, because this classifier has no arm for the `hooks.json` prefix family and falls through to the conservative fallback.
  This is an original-implementation bug from Phase 57 (commit 43aad1e), invisible to the unit-test suite because the test fixtures (e.g. `HOOKS_VALUE` in tests/bridges/hooks/stage.test.ts) were authored to match the (wrong) schema rather than the (canonical upstream) wire format. Phase 63's hooks-bridge cascade slot is never reached for any real plugin shipping the wrapper form.

fix: ""
verification: ""
files_changed: []
