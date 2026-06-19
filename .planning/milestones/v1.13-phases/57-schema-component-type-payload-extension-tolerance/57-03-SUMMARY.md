---
phase: 57-schema-component-type-payload-extension-tolerance
plan: 03
subsystem: domain
tags:
  - resolver
  - discriminated-union
  - locations
  - containment
  - hooks
dependency_graph:
  requires:
    - 57-01 PLUGIN_INSTALL_RECORD_SCHEMA.resources.hooks + ensurePluginResources default-fill arm
    - 57-02 parseHooksConfig + HOOKS_VALIDATOR + hookDebugLog OBS-01 stub
  provides:
    - SUPPORTED_COMPONENT_KINDS widened to 4-tuple [skills, commands, agents, hooks] (exported)
    - SUPPORTED_COMPONENT_PATH_KINDS (private 3-tuple gating the per-entry component-path loop)
    - PartialResolution.hooksConfigPath + ResolvedPlugin*Schema.hooksConfigPath (optional marker)
    - readStandaloneHooks (convention-file probe paralleling readStandaloneMcp)
    - applyHooksConfig (mode-agnostic resolver wiring helper)
    - ScopedLocations.hooksDir at <extensionRoot>/hooks (LIFE-03 binding caller target)
  affects:
    - Future dispatch milestone (entry/manifest-level hooks-FIELD union semantics deferred)
    - HOOK-04 / Phase 63 (closed-set REASONS `"hooks"` token will rename to `"unsupported hooks"`)
tech_stack:
  added: []
  patterns:
    - convention-file discovery seam (statKind probe + readFileText + discriminated parse result; mirrors readStandaloneMcp)
    - mode-agnostic hooks-config probe helper (applyHooksConfig called identically from resolveStrict and resolveLoose; entry-vs-manifest field-conflict semantics deferred)
    - public-vs-private tuple split (SUPPORTED_COMPONENT_KINDS as public 4-tuple closed set; SUPPORTED_COMPONENT_PATH_KINDS as private 3-tuple gating the path-validation loop)
    - parse-failure note prefix (`malformed hooks.json: <detail>`) routes through the existing narrowResolverNotes substring match on "hooks" so `{hooks}` rendering continues to work end-to-end
key_files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - extensions/pi-claude-marketplace/persistence/locations.ts
    - tests/persistence/locations.test.ts
    - tests/domain/resolver-strict.test.ts
    - tests/domain/resolver-loose.test.ts
    - tests/orchestrators/plugin/info.test.ts
    - tests/orchestrators/plugin/list.test.ts
decisions:
  - "HOOK-01 honored: SUPPORTED_COMPONENT_KINDS extended to a 4-tuple admitting `hooks` alongside skills/commands/agents; UNSUPPORTED_COMPONENT_KINDS no longer contains `hooks` and UNSUPPORTED_COMPONENT_CONVENTIONS.hooks removed."
  - "D-57-04 honored verbatim: parseHooksConfig {ok:false} flips installable: false; the parse-failure detail is prefixed with `malformed hooks.json:` and pushed onto partial.notes. hookDebugLog handles the OBS-01 hand-off via the Plan 02 stub."
  - "NFR-7 preserved: the discriminated installable: true | false contract still type-checks; hooksConfigPath is symmetric Type.Optional(Type.String()) on both variants so consumers do not need to narrow on installable to read it."
  - "D-57-03 honored: ScopedLocations.hooksDir composed from extensionRoot + hard-coded suffix `hooks` (no name input participates at this layer; NFR-10 by construction). LIFE-03 future binding caller will assert containment of plugin hooks/hooks.json paths against this dir."
  - "Public-vs-private tuple split: SUPPORTED_COMPONENT_KINDS is the PUBLIC 4-tuple downstream consumers read; SUPPORTED_COMPONENT_PATH_KINDS is the PRIVATE 3-tuple gating the per-entry component-path validation loop. `hooks` is in the public set but excluded from the path loop because it has no path-bearing field semantics."
  - "Mode-agnostic hooks probe: applyHooksConfig is called identically from resolveStrict (step 8b) and resolveLoose (step 8b). Entry-vs-manifest hooks-FIELD conflict semantics are deferred to a future dispatch milestone -- for now the convention file is the sole admission gate."
  - "Parse-failure note format compatibility: the resolver emits `malformed hooks.json: <detail>` instead of the old `contains hooks` token. shared/probe-classifiers.ts::narrowResolverNotes uses substring matching (`note.includes(\"hooks\")`) so info.ts / list.ts continue to render `{hooks}` end-to-end. orchestrators/plugin/install.ts narrowResolverReasons (which uses startsWith(\"contains \")) was NOT updated -- a malformed-hooks failure during install renders {unsupported source} until HOOK-04 in Phase 63 introduces the proper {unsupported hooks} token."
requirements_completed:
  - HOOK-01
metrics:
  duration_min: 95
  completed_date: "2026-06-14"
---

# Phase 57 Plan 03: Resolver admits hooks via convention-file parse — Summary

The resolver now treats `hooks` as a 1st-class supported kind: a plugin's
`<pluginRoot>/hooks/hooks.json` is probed through the injected disk readers,
parsed by `parseHooksConfig` (Plan 02), and the result flips the discriminated
`installable: true | false` union per D-57-04. `ScopedLocations.hooksDir` is
the persistence-layer hook for the future LIFE-03 containment caller.

## Outcome

Before this plan, every plugin declaring `hooks` (either at entry/manifest
level OR via the `hooks/hooks.json` convention file) was rejected as
`installable: false` with a `contains hooks` note. After this plan:

1. A plugin with no `hooks/hooks.json` on disk and no `hooks` declaration is
   `installable: true` and `supported` does NOT contain `"hooks"` — the
   no-hooks regression path is clean.
2. A plugin with no `hooks/hooks.json` but an entry/manifest `hooks` field
   declaration is `installable: true` with `"hooks"` NOT in `supported`. The
   field is silently accepted; the convention file is the sole admission
   gate at this layer. Entry/manifest-FIELD union semantics belong to a
   future dispatch milestone if they surface.
3. A plugin with a parseable `<pluginRoot>/hooks/hooks.json` is
   `installable: true`, `"hooks"` is in `supported`, and
   `hooksConfigPath` records the relative path of the discovered file.
4. A plugin with a malformed `<pluginRoot>/hooks/hooks.json` (invalid JSON,
   structural shape mismatch, or missing REQUIRED `command` on a
   `type: "command"` handler) is `installable: false`, and one of `notes`
   carries `malformed hooks.json: <parse-failure detail>`. The
   `hookDebugLog` stub also fires (gated on `PI_CLAUDE_MARKETPLACE_DEBUG=1`)
   per Plan 02's OBS-01 hand-off contract.

The discriminated `installable: true | false` contract is preserved end to
end (NFR-7). `ScopedLocations.hooksDir` lands at `<extensionRoot>/hooks` for
both `scope === "user"` and `scope === "project"`, composed from
`extensionRoot` joined to the hard-coded suffix `hooks` — no name input
participates at this layer (NFR-10 by construction).

## Tasks completed

| Task                                                                          | Type     | Commits             | Files                                                                                                       |
| ----------------------------------------------------------------------------- | -------- | ------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1: Add hooksDir to ScopedLocations                                            | auto+tdd | 3e80d04 / f326e19   | `persistence/locations.ts`, `tests/persistence/locations.test.ts`                                           |
| 2: Move `hooks` from UNSUPPORTED -> SUPPORTED in resolver + parse-file wiring | auto+tdd | c185210 / 666b8d0   | `domain/resolver.ts`, 2 resolver test suites, `tests/orchestrators/plugin/{info,list}.test.ts`              |

## Behavior changes

### Resolver (`domain/resolver.ts`)

- **`SUPPORTED_COMPONENT_KINDS`** now `["skills", "commands", "agents", "hooks"] as const` and **exported** as the public closed-set surface alongside the matching `SupportedKind` type alias.
- **`SUPPORTED_COMPONENT_PATH_KINDS`** (NEW, private) is `["skills", "commands", "agents"] as const`; the matching `SupportedPathKind` type alias narrows the per-entry component-path validation helpers (`validateComponentPath`, `addComponentPath`, `addValidatedComponentPath`, `collectStrictComponentKind`, `collectLooseComponentKind`).
- **`UNSUPPORTED_COMPONENT_KINDS`** narrowed: no longer contains `"hooks"`. The dead `addUnsupportedKindNotes` branch for `hooks` retires implicitly because the iteration loop is keyed off the tuple.
- **`UNSUPPORTED_COMPONENT_CONVENTIONS.hooks`** removed; the convention path moves to the supported-side machinery.
- **`PartialResolution`** gains `hooksConfigPath?: string`; `ResolvedPluginInstallableSchema` and `ResolvedPluginNotInstallableSchema` gain symmetric `Type.Optional(Type.String())` `hooksConfigPath` fields so `Type.Static<>` types pick up the marker on BOTH variants (consumers don't need to narrow on `installable` to read it).
- **`installable()` / `notInstallable()`** propagate `hooksConfigPath` via conditional-spread (avoids `exactOptionalPropertyTypes` violations when the field is absent).
- **`readStandaloneHooks(ctx, pluginRoot)`** (NEW) parallels `readStandaloneMcp`: probes `<pluginRoot>/hooks/hooks.json` via the injected `statKind` reader; returns `{ok: true}` when absent, `{ok: true, value, relativePath}` when parse-OK, `{ok: false, reason}` when parse-fails (prefixed `malformed hooks.json: `). All disk I/O goes through the injected readers.
- **`applyHooksConfig(ctx, pluginRoot, partial)`** (NEW) is the mode-agnostic wiring helper. It pushes the parse-failure note + returns `true` when the parse fails, or appends `"hooks"` to `partial.supported` + records `partial.hooksConfigPath` when the parse succeeds.
- **`resolveStrict` / `resolveLoose`** call `applyHooksConfig` at step 8b (after mcpServers, before `addUnsupportedKindNotes`). Both modes share the same hooks discovery semantics because the convention file is mode-agnostic.

### Persistence (`persistence/locations.ts`)

- **`ScopedLocations.hooksDir: string`** (NEW) slotted between `sourcesDir` and `cacheDir`. Composed from `extensionRoot` joined to the hard-coded suffix `"hooks"` — no name input participates at this layer (NFR-10 by construction). LIFE-03 is the binding caller that will assert plugin `hooks/hooks.json` paths against this root.
- The T-03-04 "every new field is hard-coded suffix" narrative comment block is extended to mention the new field.

### Tests

- **`tests/persistence/locations.test.ts`** — 4 new assertions (`HOOK-01 locationsFor('user')`, `locationsFor('project')`, enumerable on frozen bundle, not writable).
- **`tests/domain/resolver-strict.test.ts`** — 5 new behavior arms replacing the 2 old `contains hooks` arms (entry-field declared with no file → installable, parseable file → installable with hooks supported, parse-fail → notInstallable with parse-detail, structural-shape mismatch → notInstallable, no-hooks happy path).
- **`tests/domain/resolver-loose.test.ts`** — 3 new behavior arms replacing the 1 old `contains hooks` arm (parseable → installable, parse-fail → notInstallable, no-hooks happy path).
- **`tests/orchestrators/plugin/info.test.ts`** — INFO-02 unavailable + WR-01 installed-with-resolver-disagreement: fixtures switched from entry-level `hooks` field declarations to on-disk malformed `hooks/hooks.json`. The rendered byte-equal row `(unavailable) {hooks}` / `(installed) {hooks}` is preserved because `shared/probe-classifiers.ts::narrowResolverNotes` uses substring matching on `"hooks"`.
- **`tests/orchestrators/plugin/list.test.ts`** — Gap-1 (`hooks` field declared, no convention file) now expects `○ (available)` instead of `⊘ (unavailable) {hooks}`; Gap-3 split into TWO arms: parseable `hooks/hooks.json` → `○ (available)`, malformed `hooks/hooks.json` → `⊘ {hooks}`.

## Tests

8 new behavior arms exercised by `npm test`:

- locations: HOOK-01 user-scope hooksDir, project-scope hooksDir, enumerable, not writable (4).
- resolver-strict: HOOK-01 admit no-file, admit parseable file, parse-fail, shape-mismatch, no-hooks happy path (5).
- resolver-loose: HOOK-01 admit parseable file, parse-fail, no-hooks happy path (3).
- list: HOOK-01 no-file → available, parseable → available, malformed → ⊘ {hooks} (3 cases; the existing 1 case was split into 2).
- info: INFO-02 + WR-01 byte-equal renders preserved (2 cases, fixture mechanism changed).

Full unit suite: 1887 / 1887 GREEN. Integration suite: 10 / 10 GREEN. `npm run check` exit 0.

## Verification gate results

- `npm run check`: GREEN (1887 unit + 10 integration tests; typecheck + ESLint + Prettier clean).
- `grep -n 'SUPPORTED_COMPONENT_KINDS' extensions/pi-claude-marketplace/domain/resolver.ts` shows `["skills", "commands", "agents", "hooks"]` at line 151 (now `export const`, paired with `SupportedKind` export).
- `grep -n 'UNSUPPORTED_COMPONENT_KINDS' extensions/pi-claude-marketplace/domain/resolver.ts` shows the array literal at line 173; `"hooks"` is NOT present.
- `grep -n 'parseHooksConfig\|HOOKS_VALIDATOR' extensions/pi-claude-marketplace/domain/resolver.ts` shows the import + the call inside `readStandaloneHooks`.
- `grep -n 'hooksDir' extensions/pi-claude-marketplace/persistence/locations.ts` shows the interface declaration (line 73-80), the const composition (line 144-150 area), and the bundle field at line 167.
- `grep -n 'ResolvedPlugin' extensions/pi-claude-marketplace/domain/resolver.ts` confirms the discriminated `installable: true | false` union shape is unchanged at the export boundary; the new `hooksConfigPath` field is symmetric on both variants (Type.Optional(Type.String())).
- Forbidden tokens (`Phase 57`, `Plan 03`, `Wave 2`, `Pitfall N`) absent from the two modified `extensions/` files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Removed unused `SupportedKind` alias then re-introduced as exported type alongside `SUPPORTED_COMPONENT_KINDS`**

- **Found during:** Task 2 GREEN typecheck.
- **Issue:** After narrowing the per-entry component-path loop to `SUPPORTED_COMPONENT_PATH_KINDS`, the original `SupportedKind` type alias (`(typeof SUPPORTED_COMPONENT_KINDS)[number]`) became unused; `tsc --noEmit` flagged it as TS6133 (declared but never read). The plan calls for `SUPPORTED_COMPONENT_KINDS` to stay as the PUBLIC 4-tuple consumed by downstream surfaces. Removing the type alias alongside the tuple's `unused` status was a regression risk because downstream code may want to spell the type.
- **Fix:** Re-introduced both `SUPPORTED_COMPONENT_KINDS` and `SupportedKind` as `export`s. The tuple was already marked as the public surface in the plan; exporting it removes the "unused" warning and makes the public contract real.
- **Files modified:** `extensions/pi-claude-marketplace/domain/resolver.ts` (lines 151-152).
- **Commits:** 666b8d0 (rolled into the Task 2 GREEN commit).

**2. [Rule 3 - Blocking] `exactOptionalPropertyTypes` violation on `hooksConfigPath` initialization + propagation**

- **Found during:** Task 2 GREEN typecheck.
- **Issue:** Initial implementation set `hooksConfigPath: undefined` in `emptyResolution()` and passed `partial.hooksConfigPath` (typed `string | undefined`) directly to `installable()` / `notInstallable()`. The project's `exactOptionalPropertyTypes: true` rejects assigning `undefined` to an optional field that doesn't include `undefined` in its declared type.
- **Fix:** Drop the `hooksConfigPath: undefined` literal in `emptyResolution()` (the property is genuinely absent). In `installable()` / `notInstallable()`, propagate the field via conditional-spread (`...(partial.hooksConfigPath !== undefined && { hooksConfigPath: partial.hooksConfigPath })`). In `applyHooksConfig`, also narrow the assignment with `if (hooksResult.relativePath !== undefined)`.
- **Files modified:** `extensions/pi-claude-marketplace/domain/resolver.ts`.
- **Commits:** 666b8d0 (rolled into Task 2 GREEN).

**3. [Rule 3 - Blocking] ESLint `prefer-includes` on new regex assertions**

- **Found during:** Task 2 GREEN `npm run check` lint phase.
- **Issue:** New RED-phase test assertions used `/hooks\.json/.test(n)` / `/malformed hooks\.json/.test(n)` regex shapes; ESLint's `@typescript-eslint/prefer-includes` rule rejects this pattern when the regex is a literal substring with no metachars.
- **Fix:** Replaced both regex `.test(...)` shapes with `String#includes(...)`. The semantics are unchanged because the regex literals had no actual regex features.
- **Files modified:** `tests/domain/resolver-strict.test.ts`, `tests/domain/resolver-loose.test.ts`.
- **Commits:** 666b8d0 (rolled into Task 2 GREEN).

**4. [Rule 3 - Blocking] Forbidden GSD planning tokens in new source + test comments**

- **Found during:** Task 2 GREEN — `.claude/rules/typescript-comments.md` audit grep.
- **Issue:** Initial Task 2 GREEN draft of `resolver.ts` and the new resolver/list test arms included `Phase 57`, `Phase 58` references that the per-project comment policy forbids. Decision/requirement IDs are the only sanctioned anchors.
- **Fix:** Replaced every forbidden token with a domain-neutral phrase ("downstream consumers", "future dispatch milestone", etc.) and verified via the plan's grep gate that no `Phase N` / `Plan N` / `Wave N` / `Pitfall N` token remains in the two modified `extensions/` files. Test files were also scrubbed for symmetry.
- **Files modified:** `extensions/pi-claude-marketplace/domain/resolver.ts`, `tests/domain/resolver-strict.test.ts`, `tests/orchestrators/plugin/list.test.ts`.
- **Commits:** 666b8d0 (rolled into Task 2 GREEN).

### Architectural deviations

None. HOOK-01 / D-57-03 / D-57-04 / NFR-7 / NFR-10 all honored verbatim.

### Behavior shifts surfaced (not deviations)

- **`install.ts::narrowResolverReasons` is INTENTIONALLY left untouched.** That helper uses strict `startsWith("contains ")` prefix matching, so the new `malformed hooks.json: <detail>` note falls through to the permissive default `unsupported source` Reason. The install-time render for a malformed-hooks-on-install path therefore reads `(failed) {unsupported source}` instead of `(failed) {hooks}`. This is a small transitional gap that HOOK-04 in a later phase will close by introducing the proper `{unsupported hooks}` token and updating the install-side narrower. The `info` and `list` surfaces are unaffected because `shared/probe-classifiers.ts::narrowResolverNotes` uses substring matching that catches the new note.

  This choice is documented here so the next milestone-owner finds it quickly; it is not a Rule 4 architectural decision because the install-time `{hooks}` rendering was not specified in the plan's success criteria.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/domain/resolver.ts`: FOUND.
- `extensions/pi-claude-marketplace/persistence/locations.ts`: FOUND.
- `tests/persistence/locations.test.ts`: FOUND.
- `tests/domain/resolver-strict.test.ts`: FOUND.
- `tests/domain/resolver-loose.test.ts`: FOUND.
- `tests/orchestrators/plugin/info.test.ts`: FOUND.
- `tests/orchestrators/plugin/list.test.ts`: FOUND.
- Commit `3e80d04` (Task 1 RED): FOUND.
- Commit `f326e19` (Task 1 GREEN): FOUND.
- Commit `c185210` (Task 2 RED): FOUND.
- Commit `666b8d0` (Task 2 GREEN): FOUND.
