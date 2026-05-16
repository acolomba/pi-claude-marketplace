# Quick Task 260516-08j: modify agent mapping logic to omit model -- Research

**Researched:** 2026-05-16
**Domain:** Agent bridge conversion pipeline, edge-layer flag parsing
**Confidence:** HIGH

## Summary

The task adds a `--map-model` boolean flag to `plugin install` and `plugin update`. When
absent (the new default), the agent bridge omits the `model:` field from generated Pi agent
files, letting Pi choose its own default. When present, model mapping runs exactly as today.

The entire model-mapping pipeline is concentrated in three files and uses a clean
conditional-field pattern already in place. The flag introduction requires changes in four
layers: (1) the edge handlers, (2) the orchestrator option types, (3) the bridge
`prepareStagePluginAgents` input type, and (4) `convertAgent` itself. The PRD currently
specifies always-on model mapping; it must be updated to describe the opt-in default.

The args parser does NOT natively support boolean flags; the `list` handler's approach
(scan `parsed.positional` for `--` tokens after calling `parseArgs`) is the established
pattern and must be followed here.

**Primary recommendation:** Follow the `list` handler's boolean-flag pattern in both
install and update handlers; thread `mapModel: boolean` through
`InstallPluginOptions` / `UpdatePluginsOptions` -> `StageAgentsInput` ->
`convertAgent`; gate the `mapModel(raw.model)` call on the flag.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Flag parsing (`--map-model`) | Edge handlers | -- | Edge layer owns CLI arg parsing; orchestrators accept already-parsed option bags |
| `mapModel: boolean` propagation | Orchestrators (install, update) | -- | Orchestrators translate edge-layer options into bridge call parameters |
| Model-field omission | Bridge (`convert.ts`) | -- | `convertAgent` owns all field-mapping logic; omission is a mapping decision |
| PRD update | Documentation | -- | AG-7 detail and §5.2.1 command signature both need amendment |

## Standard Stack

No new dependencies. All changes are within existing TypeScript source files.

## Where Model Mapping Lives

### `bridges/agents/convert.ts` -- primary target

**`mapModel` function (lines 127-150):** Pure function; takes `raw.model: string | undefined`;
returns `{ emit: string | undefined; originalModel: string | undefined; warning: string | undefined }`.

**`convertAgent` function (lines 295-398):** Calls `mapModel(raw.model)` unconditionally at
step 2 (line 316). Passes `modelResult.emit` to `optionalModel()` (line 369) and
`modelResult.originalModel` to provenance (line 377). The `optionalModel` helper already
handles undefined cleanly -- it returns `{}` when the value is undefined, so the field is
absent from the frontmatter spread.

**Change needed:** Add `mapModel: boolean` to the `convertAgent` input bag. When
`mapModel === false`, skip the `mapModel(raw.model)` call and treat the result as
`{ emit: undefined, originalModel: undefined, warning: undefined }`. Provenance block stays
unchanged -- when model is omitted by flag, there is no `originalModel` to record.

**`MODEL_MAP` constant (lines 47-51):** Exported, part of the user contract. Tests assert
byte-for-byte equality. Do NOT modify the constant itself -- the flag only controls whether
`mapModel()` is called, not what it maps.

[VERIFIED: source read -- extensions/pi-claude-marketplace/bridges/agents/convert.ts]

### `bridges/agents/frontmatter.ts` -- no change needed

`GeneratedFrontmatterFields.model` is already `readonly model?: string` (line 137). The
emitter already guards: `if (frontmatter.model !== undefined) { lines.push(...) }` (line
190). When `convertAgent` passes `model: undefined` (via `optionalModel(undefined)` returning
`{}`), the field is absent from the spread and is not emitted. No changes needed in this
file.

[VERIFIED: source read -- extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts lines 137, 190]

### `bridges/agents/types.ts` -- `StageAgentsInput` type

`StageAgentsInput` (lines 67-78) is the input type for `prepareStagePluginAgents`. Add
`readonly mapModel?: boolean` (optional, defaults to false). `stage.ts` passes it through
to `convertAgent`.

[VERIFIED: source read -- extensions/pi-claude-marketplace/bridges/agents/types.ts]

### `bridges/agents/stage.ts` -- `prepareStagePluginAgents`

The `convertAgent` call is at line 105-112. The `input` destructuring at lines 72-80 must
include `mapModel`. Pass `mapModel: mapModel ?? false` to each `convertAgent` call.

[VERIFIED: source read -- extensions/pi-claude-marketplace/bridges/agents/stage.ts]

## Where Install/Update Options Are Declared

### `orchestrators/plugin/install.ts` -- `InstallPluginOptions`

Defined at lines 100-109. Add `readonly mapModel?: boolean`. The `agentsPhase.do` closure
(lines 381-405) calls `prepareStagePluginAgents`; pass `mapModel: opts.mapModel ?? false`.

[VERIFIED: source read -- extensions/pi-claude-marketplace/orchestrators/plugin/install.ts]

### `orchestrators/plugin/update.ts` -- `UpdatePluginsOptions`

Defined at lines 125-134. Add `readonly mapModel?: boolean`. The `prepareUpdateHandles`
function (lines 416-467) calls `prepareStagePluginAgents` at lines 445-453; pass
`mapModel: args.mapModel ?? false`. `ThreePhaseArgs` (lines 281-303) must also carry
`readonly mapModel?: boolean` so `prepareUpdateHandles` can read it. The top-level
`updatePlugins` function passes `opts.mapModel` into each `runThreePhaseUpdate` call;
`updateSinglePlugin` does NOT accept a flag (cascade path -- it re-installs from stored
state without user interaction, so it always uses the current default of omit).

[VERIFIED: source read -- extensions/pi-claude-marketplace/orchestrators/plugin/update.ts]

## CLI Handler/Router Files

### `edge/handlers/plugin/install.ts` -- needs boolean flag parsing

Current handler (lines 1-44) delegates to `parseRequiredPluginMarketplaceRef` which calls
`parseCommandArgs`. The `parseCommandArgs` + `parseArgs` pipeline only understands `--scope`;
it does NOT support boolean flags.

**Pattern to follow:** `edge/handlers/plugin/list.ts` (lines 26-71). Call `parseArgs(args)`
directly, scan `parsed.positional` for `--map-model`, collect non-flag tokens, then call
`splitPluginMarketplaceRef` on the positional ref. The `list` handler uses a `BOOLEAN_FLAGS`
set and a `for (const token of parsed.positional)` loop. Replicate that pattern.

**Required changes:**
- Replace `parseRequiredPluginMarketplaceRef` with direct `parseArgs` + manual scanning
- Set `mapModel = true` when `--map-model` appears in positionals
- Pass `mapModel` to `installPlugin`
- Update USAGE string to include `[--map-model]`

[VERIFIED: source read -- extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts, edge/handlers/plugin/list.ts]

### `edge/handlers/plugin/update.ts` -- needs boolean flag parsing

Current handler (lines 1-65) already calls `parseCommandArgs` directly (not via
`parseRequiredPluginMarketplaceRef`). It uses the `positional` schema `[{ name: "ref",
required: false }]`. This schema approach passes the positional through cleanly, but the
`parseCommandArgs` wrapper will NOT surface `--map-model` (it only knows `--scope`).

**Pattern to follow:** Same `list` handler approach -- switch to raw `parseArgs`, then scan
positionals for `--map-model` and the optional `ref` token (non-`--` positionals only).
Alternatively, follow the simpler approach: call `parseCommandArgs` first for `--scope`, then
separately scan `parsed.ref` and any remaining positionals for the flag.

Actually the cleanest approach: switch to raw `parseArgs` (as `list` does) and scan
positionals manually. The update handler's positional logic is slightly more complex (it
needs to detect `@mp` vs `pl@mp` vs bare), but the scanning loop is the same.

Pass `mapModel` to `updatePlugins`.
Update USAGE string to include `[--map-model]`.

[VERIFIED: source read -- extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts]

### `edge/args.ts` -- no change to parser itself

`parseArgs` only recognizes `--scope` as a special flag; everything else lands in
`positional[]`. Boolean flags like `--map-model` therefore arrive in `positional` and must
be extracted by the handler (the established pattern). No changes to `args.ts` or
`args-schema.ts`.

[VERIFIED: source read -- extensions/pi-claude-marketplace/edge/args.ts]

## PRD Changes Required

### AG-7 detail (line 417 of PRD)

Current text:
```
- `model:` -- `sonnet` → `anthropic/claude-sonnet-4-6`, `opus` → `anthropic/claude-opus-4-7`,
  `haiku` → `anthropic/claude-haiku-4-5`. `inherit` → omit + record `originalModel`.
  Unknown → omit + warn.
```

New text must describe: by default (without `--map-model`), the `model:` field is omitted
entirely from the generated Pi agent file regardless of the source value. With `--map-model`,
the existing mapping table applies. This preserves the existing `inherit` / unknown-omit
behavior within the `--map-model` path.

### §5.2.1 install command signature (line 245 of PRD)

Update heading from:
`install <plugin>@<marketplace> [--scope user|project]`
to:
`install <plugin>@<marketplace> [--scope user|project] [--map-model]`

A new PI-18 (or amendment to AG-7) should specify: "Without `--map-model`, the generated
agent file MUST omit the `model:` field; Pi chooses its own default model."

### §5.2.3 update command signature (line 280 of PRD)

Update heading and add same `[--map-model]` flag description.

[VERIFIED: source read -- docs/prd/pi-claude-marketplace-prd.md lines 245, 280, 415-417]

## VALIDATION.md Changes Required

The `.planning/VALIDATION.md` file does not exist at the project root; the planning system
tracks phase-level validation files. The quick task CONTEXT.md notes to update VALIDATION.md
"if any CMP requirement coverage changes."

The `--map-model` change does NOT affect any CMP-1..CMP-8 requirement (scope rules,
marketplace visibility). It amends AG-7 coverage. If the phase-level validation files for
Phase 3 (`03-VALIDATION.md`) track AG-7, that file should note the new opt-in default.
The only new testable assertion is AG-7's model-omission default.

[VERIFIED: searched .planning/ for VALIDATION.md -- no project-root VALIDATION.md found]

## Architecture Patterns

### Pattern: Boolean flag extraction (established)

The `list` handler establishes the boolean-flag pattern for this codebase:

```typescript
// Source: extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts lines 29-54
let parsed;
try {
  parsed = parseArgs(args);
} catch (err) {
  notifyError(ctx, errorMessage(err));
  return;
}

let mapModel = false;
const nonFlagPositionals: string[] = [];
for (const token of parsed.positional) {
  if (token === "--map-model") {
    mapModel = true;
  } else if (token.startsWith("--")) {
    notifyError(ctx, USAGE);
    return;
  } else {
    nonFlagPositionals.push(token);
  }
}
```

[VERIFIED: source read -- extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts]

### Pattern: Optional field via spread (established)

`optionalModel` in `convert.ts` already handles optional field emission:

```typescript
// Source: extensions/pi-claude-marketplace/bridges/agents/convert.ts line 400-402
function optionalModel(model: string | undefined): { model?: string } {
  return model === undefined ? {} : { model };
}
```

When the `--map-model` flag is absent, `convertAgent` passes `undefined` to `optionalModel`,
producing `{}`, and the field is absent from the generated frontmatter. No new helper needed.

[VERIFIED: source read -- extensions/pi-claude-marketplace/bridges/agents/convert.ts]

### Anti-Patterns to Avoid

- **Do not add `--map-model` support to `parseArgs`/`parseCommandArgs`:** Those are shared
  primitives. Boolean flags are command-specific and belong in handler scanning loops.
- **Do not set `mapModel` to a default of `true` anywhere in the stack:** The flag is
  opt-in; any layer that omits the flag propagation must default to `false`.
- **Do not modify `MODEL_MAP`:** The constant is a user contract asserted byte-for-byte by
  tests. The flag only gates whether `mapModel()` is called.
- **Do not add `mapModel` to `updateSinglePlugin`'s cascade signature:** The cascade path
  (`updateSinglePlugin: PluginUpdateFn`) is invoked by the marketplace autoupdate cascade
  without user interaction; model-mapping is an interactive install-time preference and must
  not flow into the cascade. The cascade always uses the default (omit).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Boolean flag detection | Custom tokenizer | Scan `parsed.positional` after `parseArgs()` (established pattern) |
| Conditional field in frontmatter | New helper | Existing `optionalModel()` in `convert.ts` |

## Common Pitfalls

### Pitfall 1: Forgetting the update handler cascade path

**What goes wrong:** `updatePlugins` and `updateSinglePlugin` are separate entrypoints.
Passing `mapModel` only to `updatePlugins` leaves `updateSinglePlugin` always using the
flag's default (false/omit). This is actually correct behavior -- but the developer might
try to pass it through and hit a type error since `PluginUpdateFn` has a fixed signature.

**How to avoid:** Do NOT add `mapModel` to `updateSinglePlugin` or `PluginUpdateFn`. The
cascade path intentionally always omits model (the new default). Document this explicitly.

### Pitfall 2: `prepareUpdateHandles` does not receive `mapModel` via `ThreePhaseArgs`

**What goes wrong:** `prepareUpdateHandles` is called with `args: ThreePhaseArgs`.
If `mapModel` is not added to `ThreePhaseArgs`, `prepareUpdateHandles` cannot pass it to
`prepareStagePluginAgents`.

**How to avoid:** Add `readonly mapModel?: boolean` to `ThreePhaseArgs` and thread it
through. Verify `runThreePhaseUpdate` passes `opts.mapModel` when constructing its
`ThreePhaseArgs` call.

### Pitfall 3: install handler still using `parseRequiredPluginMarketplaceRef`

**What goes wrong:** `parseRequiredPluginMarketplaceRef` calls `parseCommandArgs` which
routes unknown `--` flags through as positionals -- but it only has `{ name: "ref" }` in the
positional schema, so a second positional (`--map-model`) would silently be ignored or cause
a "too many positionals" error depending on validation.

**How to avoid:** Switch the install handler to the `list` handler pattern: call `parseArgs`
directly, scan positionals manually, then call `splitPluginMarketplaceRef` on the ref token.

### Pitfall 4: `knownSkills` is optional but `mapModel` must propagate reliably

**What goes wrong:** `StageAgentsInput.knownSkills` is already `readonly knownSkills?:
readonly string[]` (optional). Making `mapModel` optional with `?` is consistent, but callers
must not forget to pass it. The orchestrator's `prepareStagePluginAgents` calls in install
and update both need `mapModel: opts.mapModel ?? false` (or `args.mapModel ?? false`).

**How to avoid:** Treat the undefined-default as explicit -- always pass `mapModel:
someValue ?? false` at the call site rather than relying on undefined propagation.

## Test Strategy

### `tests/bridges/agents/convert.test.ts`

Add tests:
- `convertAgent without --map-model omits model field` -- pass `mapModel: false` (or omit),
  verify `out.fileContent` does NOT contain `model:` even when source has `model: "sonnet"`.
- `convertAgent with --map-model maps model 'sonnet'` -- pass `mapModel: true`, verify
  existing behavior unchanged.
- Existing tests for model mapping (`AG-7 convertAgent maps model 'sonnet' ...`) must be
  updated to pass `mapModel: true` (or their assertions will fail once the default changes).

### `tests/edge/handlers/plugin/install.test.ts`

Add test: `shim :: --map-model flag is parsed and passed to orchestrator` -- verify the flag
does not cause a USAGE error and reaches the orchestrator (observable via the downstream
orchestrator error message as in the existing scope tests).

### `tests/edge/handlers/plugin/update.test.ts`

Add analogous `--map-model` shim test.

### `tests/orchestrators/plugin/install.test.ts`

Check whether existing orchestrator tests call `prepareStagePluginAgents` via the bridge;
if so, they may need `mapModel: false` in their call bag (or it will default correctly if
optional).

## Open Questions

1. **Should `--map-model` be reflected in the completion provider?**
   - What we know: TC-3 says "whenever the cursor sits at a token starting with `-`, completion
     MUST surface `--scope`". The list handler also surfaces `--installed / --available /
     --unavailable` in completions.
   - What's unclear: whether `--map-model` should appear as a completion suggestion for
     `install` and `update`.
   - Recommendation: Yes, add `--map-model` to the install and update completion suggestion
     sets for consistency with the `--installed` pattern. CONTEXT.md is silent on this; treat
     as Claude's discretion (low-risk addition).

2. **Does the provenance comment need a `modelOmittedByFlag` note?**
   - What we know: The provenance HTML comment currently records `originalModel` when the
     source had one. If the flag is absent, no model mapping occurs, so there is no
     `originalModel` to record.
   - Recommendation: No special provenance note needed. The absence of `model:` in the
     frontmatter is self-documenting. Adding a `modelOmittedByFlag: true` provenance field
     would complicate the marker format for minimal benefit.

## Sources

### Primary (HIGH confidence)

- Source code read: `extensions/pi-claude-marketplace/bridges/agents/convert.ts` -- model
  mapping pipeline, `mapModel` function, `convertAgent`, `optionalModel` helper
- Source code read: `extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` --
  `GeneratedFrontmatterFields.model?: string`, conditional emit guard
- Source code read: `extensions/pi-claude-marketplace/bridges/agents/types.ts` --
  `StageAgentsInput`, `ConvertedAgent`
- Source code read: `extensions/pi-claude-marketplace/bridges/agents/stage.ts` --
  `prepareStagePluginAgents`, `convertAgent` call site
- Source code read: `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` --
  `InstallPluginOptions`, agents phase call to `prepareStagePluginAgents`
- Source code read: `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` --
  `UpdatePluginsOptions`, `ThreePhaseArgs`, `prepareUpdateHandles`, `updateSinglePlugin`
- Source code read: `extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts` --
  current handler pattern using `parseRequiredPluginMarketplaceRef`
- Source code read: `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts` --
  current handler using `parseCommandArgs`
- Source code read: `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` --
  boolean flag pattern (`BOOLEAN_FLAGS`, positional scan loop)
- Source code read: `extensions/pi-claude-marketplace/edge/args.ts` -- tokenizer, `--scope`
  is the only specially handled flag
- Source code read: `docs/prd/pi-claude-marketplace-prd.md` -- AG-7 detail (line 417),
  §5.2.1 install (lines 245-265), §5.2.3 update (line 280)

## Metadata

**Confidence breakdown:**
- Model mapping location: HIGH -- code read directly
- Flag parsing pattern: HIGH -- `list` handler is the established pattern in this codebase
- PRD amendment scope: HIGH -- AG-7 detail and command signatures identified precisely
- Test strategy: HIGH -- existing test file locations confirmed, assertions clear

**Research date:** 2026-05-16
**Valid until:** Until any of the four primary source files are modified
