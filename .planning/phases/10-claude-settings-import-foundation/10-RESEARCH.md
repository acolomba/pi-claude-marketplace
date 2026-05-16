# Phase 10: Claude Settings Import Foundation - Research

**Researched:** 2026-05-13
**Domain:** Claude Code settings import planning, pure TypeScript parsing/merge helpers, Pi marketplace-source planning
**Confidence:** HIGH for repository patterns and locked Phase 10 decisions; MEDIUM for exact upstream Claude settings source shape beyond the user-approved `enabledPlugins` and `extraKnownMarketplaces` fields

<user_constraints>
## User Constraints (from CONTEXT.md)

### Settings Discovery Paths

- **D-01:** Use standard Claude Code settings paths, while respecting Claude Code's `CLAUDE_CONFIG_DIR` override for the user settings home when it is set:
  - User scope default: `~/.claude/settings.json` plus `~/.claude/settings.local.json`
  - User scope with `CLAUDE_CONFIG_DIR=/path/to/dir`: `/path/to/dir/settings.json` plus `/path/to/dir/settings.local.json`
  - Project scope: `<cwd>/.claude/settings.json` plus `<cwd>/.claude/settings.local.json`
- **D-02:** Missing settings files are treated as empty settings for that scope.
- **D-03:** Phase 10 should remain pure/testable; planners should add a path resolver seam that accepts an explicit Claude config dir/env override for tests. Production semantics are the standard paths above plus `CLAUDE_CONFIG_DIR` for the user settings home.

### Merge Semantics

- **D-04:** Merge base and local settings with shallow object merge for the known sections Phase 10 consumes.
- **D-05:** For `enabledPlugins`, merge entries by plugin-ref key; local values override base values. This allows `settings.local.json` to disable a base-enabled plugin by setting the same key to `false` while preserving unrelated base entries.
- **D-06:** For `extraKnownMarketplaces`, merge entries by marketplace name; local values override base values. Do not deep-merge nested marketplace source objects.

### Malformed Settings Policy

- **D-07:** Use warn-and-continue wherever possible. Valid refs in valid portions of settings should still produce import-plan actions even when unrelated entries are malformed.
- **D-08:** Malformed JSON in one settings file records a diagnostic for that scope instead of crashing the process. Other files/scopes continue to be processed.
- **D-09:** Malformed `enabledPlugins` keys are reported and skipped without blocking valid refs.
- **D-10:** `enabledPlugins` entries whose merged value is exactly boolean `true` are imported. Boolean `false` is silent/normal and means disabled. Non-boolean values are warnings and are not imported.

### Marketplace Source Mapping

- **D-11:** Claude Code's built-in `claude-plugins-official` marketplace maps to Pi source `anthropics/claude-plugins-official` when missing from the target Pi scope.
- **D-12:** For non-official marketplaces, map only source shapes that match Pi-supported marketplace source patterns:
  - Claude `directory` source -> Pi path-source marketplace add input
  - Claude `github.repo` source -> Pi GitHub-source marketplace add input
- **D-13:** Unsupported or missing `extraKnownMarketplaces` source info records a warning. Plugin refs depending on that missing/unmappable marketplace become unavailable/skipped in the import plan rather than blocking unrelated valid refs.
- **D-14:** Do not attempt broad parsing of arbitrary source-looking values in Phase 10; unsupported Claude source shapes are outside the supported Pi marketplace source contract for v1.2.

### Scope Carry-Forward

- **D-15:** Carry forward milestone decision D-26: `/claude:plugin import` with omitted `--scope` processes both user and project Claude settings and maps them to matching Pi scopes. Explicit `--scope user|project` narrows to one matching scope.
- **D-16:** Claude `local` scope remains out of scope; Phase 10 must not introduce a third Pi scope.

### the agent's Discretion

- Exact diagnostic object shape/naming, as long as malformed JSON, malformed refs, non-boolean values, and unmappable marketplace sources are distinguishable for Phase 11 warning presentation.
- Exact module/file names for the pure foundation, as long as import boundaries are respected and downstream orchestration can consume the plan without re-reading settings.
- Whether test seams are root-path injection, filesystem abstraction, or explicit file-content inputs; production path semantics are locked by D-01.

### Deferred Ideas

None - discussion stayed within the Phase 10 foundation scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Planning Implication |
|----|-------------|----------------------|
| IMP-04 | Read `settings.json` and `settings.local.json`; local overrides base. | Build settings-path discovery, JSON read diagnostics, and shallow merge helpers before ref extraction. |
| IMP-05 | Only merged `enabledPlugins` entries exactly equal to `true` import. | Ref extraction must distinguish `false` (silent) from non-boolean (warning). |
| IMP-06 | Parse `plugin@marketplace` refs and report malformed keys without aborting valid imports. | Use a strict one-`@` parser with diagnostics and skip invalid keys. |
| IMP-07 | Map missing `claude-plugins-official` to `anthropics/claude-plugins-official`. | Marketplace-source planning must have an official special case independent of `extraKnownMarketplaces`. |
| IMP-08 | Map non-official `extraKnownMarketplaces` directory and `github.repo` sources. | Marketplace-source planning should emit add-source inputs compatible with existing source parsing and warn on unsupported shapes. |
</phase_requirements>

## Project Constraints (from CLAUDE.md / project context)

- Use TypeScript strict and existing repository style: ESM imports with `.ts` extensions, `node:test`, Prettier formatting, and `npm run check` as the phase quality bar.
- All user-visible command output ultimately routes through `ctx.ui.notify`; Phase 10 should not print. It returns diagnostics for Phase 11 to render.
- No telemetry and no network in Phase 10. Import planning is pure/local filesystem only and must not call marketplace add/update/install.
- Scope model remains exactly `Scope = "user" | "project"` from `extensions/pi-claude-marketplace/shared/types.ts`.

## Summary

Phase 10 should create a small pure foundation under `extensions/pi-claude-marketplace/orchestrators/import/` rather than adding edge routing or mutating orchestrators. This keeps the Phase 11 command handler simple: it can call one import-plan builder, then delegate missing marketplace adds and plugin installs to existing Phase 4/5 orchestration.

The safest decomposition is:

1. **Settings discovery and merge**: path resolver seam, missing-file-as-empty behavior, malformed-JSON diagnostics, shallow merge for `enabledPlugins` and `extraKnownMarketplaces`.
2. **Enabled ref extraction**: strict `plugin@marketplace` parser, exact-boolean-true filtering, warnings for malformed refs and non-boolean values.
3. **Marketplace source and import-plan builder**: official built-in mapping, `directory` and `github.repo` mapping from merged `extraKnownMarketplaces`, per-scope plan grouping, and both-scope duplication tests.

## Standard Stack

| Component | Use | Notes |
|-----------|-----|-------|
| `node:fs/promises` | Read optional Claude settings files. | Use async read seams; `ENOENT` becomes empty, other read/parse issues become diagnostics. |
| `node:path` and `node:os` | Resolve `~/.claude`, `CLAUDE_CONFIG_DIR`, and project `.claude`. | Keep production path semantics in one resolver function. |
| Existing `Scope` type | User/project planning. | Do not introduce Claude `local`. |
| Existing `parsePluginSource` / `pathSource` / `githubSource` contracts | Validate or shape marketplace add inputs. | Phase 10 should produce existing marketplace-add source strings, not new source kinds. |
| `node:test` | Unit tests. | Add focused tests under `tests/orchestrators/import/`. |

## Architecture Patterns

### Recommended module layout

```text
extensions/pi-claude-marketplace/orchestrators/import/
├── index.ts             # barrel for Phase 11 consumers
├── types.ts             # ImportPlan, diagnostics, Claude settings shapes, refs
├── settings.ts          # path resolution, optional JSON reads, shallow merge
├── refs.ts              # enabledPlugins exact-true extraction + ref parser
└── marketplaces.ts      # official/extraKnownMarketplaces source planning

tests/orchestrators/import/
├── settings.test.ts
├── refs.test.ts
└── marketplaces.test.ts
```

### Pattern 1: Diagnostics as data

Return diagnostics like `{ severity: "warning" | "error", scope, code, message, path?, ref?, marketplace? }` from pure helpers. Do not notify, log, throw for malformed user settings unless the code encounters an unexpected programmer error. This preserves D-07 through D-10 and leaves Phase 11 in charge of `ctx.ui.notify`.

### Pattern 2: Known-section shallow merge only

Treat raw Claude settings as `Record<string, unknown>`, extract only `enabledPlugins` and `extraKnownMarketplaces` when they are plain objects, and merge these maps with local-over-base. Do not preserve or inspect unrelated Claude settings fields.

### Pattern 3: Strict import refs

`plugin@marketplace` parsing should require exactly one `@` and non-empty trimmed halves. It should not accept `@marketplace`, `plugin@`, `plugin@@mp`, or strings with slash/path semantics. Downstream existing safe-name checks can still validate names later.

### Pattern 4: Marketplace add source strings, not mutations

The Phase 10 output should say that scope `user` needs marketplace `claude-plugins-official` from source `anthropics/claude-plugins-official`, or marketplace `private` from source `/path/to/mp` / `owner/repo`. It should not call `addMarketplace`, clone, read marketplace manifests, or install plugins.

## Don't Hand-Roll

- Do not duplicate Phase 4 marketplace-add behavior, state locking, clone logic, or duplicate handling in Phase 10.
- Do not duplicate Phase 5 plugin-install behavior, resolver availability handling, soft-dependency warnings, or reload hints in Phase 10.
- Do not add broad best-effort parsing for unsupported Claude marketplace source shapes; warn and skip per D-13/D-14.
- Do not introduce a Claude `local` Pi scope.

## Common Pitfalls

| Pitfall | Prevention in Plans |
|---------|---------------------|
| Treating `"true"`, `1`, or `{}` as enabled. | Tests assert only boolean `true` produces enabled refs; non-boolean values produce diagnostics. |
| Making malformed JSON fatal for all scopes. | Settings read returns diagnostics per file and continues with other files/scopes. |
| Deep-merging nested marketplace source objects. | Plan tests prove local marketplace object replaces the base object by name. |
| Forgetting `CLAUDE_CONFIG_DIR`. | Path resolver tests cover default user paths and override user paths. |
| Accidentally performing network or state mutation. | Plans keep code under pure `orchestrators/import` helpers and use only local file reads. |
| Collapsing duplicate enabled plugin across scopes. | Plan builder returns one action per matching Pi scope; tests cover user+project duplication. |

## Validation Architecture

Phase 10 validation should be all automated unit tests plus the normal repository quality gate.

- Framework: Node built-in `node:test`.
- Quick commands:
  - `npm test -- tests/orchestrators/import/settings.test.ts`
  - `npm test -- tests/orchestrators/import/refs.test.ts`
  - `npm test -- tests/orchestrators/import/marketplaces.test.ts`
- Full phase gate: `npm run check`.
- No manual-only validation is required because Phase 10 has no UI and no mutation side effects.

## Code Examples

```typescript
export interface ClaudeSettingsPaths {
  readonly basePath: string;
  readonly localPath: string;
}

export interface ImportDiagnostic {
  readonly severity: "warning" | "error";
  readonly scope: Scope;
  readonly code:
    | "malformed-json"
    | "malformed-plugin-ref"
    | "non-boolean-enabled-plugin"
    | "unmappable-marketplace-source";
  readonly message: string;
}

export interface EnabledPluginRef {
  readonly plugin: string;
  readonly marketplace: string;
  readonly raw: string;
}
```

```typescript
// Local-over-base known-section merge shape.
const mergedEnabledPlugins = {
  ...base.enabledPlugins,
  ...local.enabledPlugins,
};
```

## Open Questions / Assumptions

- Assume `extraKnownMarketplaces` entries may use a source shape containing `directory` or `github.repo`; plans should keep shape guards narrow and tests should document accepted forms.
- Assume Phase 11 can decide whether an already-present marketplace is missing by reading existing Pi state; Phase 10 can either accept a state snapshot or simply produce desired marketplace requirements. The plan chooses a pure desired-state output so Phase 11 can handle idempotency with existing orchestrators.
