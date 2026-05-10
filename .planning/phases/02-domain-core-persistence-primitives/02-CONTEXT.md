# Phase 2: Domain Core & Persistence Primitives - Context

**Gathered:** 2026-05-09 **Status:** Ready for planning

## Phase Boundary

A typed, I/O-light foundation for source parsing, manifest schemas, plugin resolution, naming, state shapes, transaction semantics, and the Phase ledger primitive that install/update will reuse. Phase 2 owns 39 v1 REQ-IDs (NFR-7, NFR-12, SP-1..7, SC-1..4, SC-7, MM-1..7, PR-1..6, RN-1..2, ST-1..9) and produces:

- `domain/{source,manifest,resolver,name,version}.ts` -- pure logic, JSON validators, discriminated unions
- `persistence/{state-schema,state-io,locations}.ts` -- branded `ScopedLocations`, atomic state.json load/save, legacy migration
- `transaction/{state-guard,phase,rollback}.ts` -- `withStateGuard`, `runPhases`, `(rollback partial: …)` aggregation

This phase ends with `npm run check` green, every Phase 2 module typed end-to-end, and the foundation in place for Phase 3 to start writing bridges against `domain/resolver.ts`'s discriminated `installable` union.

## Implementation Decisions

### Phase Ledger Primitive (transaction/)

- **D-01 (Phase ledger API shape):** `transaction/phase.ts` exports a pure async function `runPhases<C>(phases: readonly Phase<C>[], ctx: C): Promise<RunPhasesResult>`. `Phase<C>` is `{ name: string; do: (c: C) => Promise<void>; undo?: (c: C) => Promise<void> }`. `RunPhasesResult` is a structured `{ ok: boolean; error?: Error; rollbackPartials: { phase, msg }[]; leaks: string[] }`. The `Phase[]` array is a literal `const` at every orchestrator call site (grep-able order -- explicit anti-pattern guard against architecture-research's warning about implicit ordering). No coordinator class, no builder DSL.
- **D-02 (Ledger × StateGuard composition):** `withStateGuard` wraps `runPhases` (outer guard, inner ledger). `withStateGuard(scope, async (state) => { await runPhases(buildPhases(state), {...ctx, state}); })`. The state-fresh snapshot is threaded into the ledger context; the terminal `'state'` phase mutates the snapshot; the guard saves on closure return. Concurrent-install detection (ST-8/9) lives at the guard's save boundary, not in the ledger. Single ownership of state lifecycle.
- **D-03 (Marker formatting + leak append):** `transaction/rollback.ts` owns ES-5 `(rollback partial: [<phase>] <msg>; …)` assembly via `formatRollbackError(result, originalError)` and `appendLeaks(err, leaks)`. Imports `ROLLBACK_PARTIAL` from `shared/markers.ts` (Phase 1 D-08). `transaction/phase.ts` stays purely about ordering + undo wiring; rollback.ts is the single chokepoint for the user-visible marker string. Drift is caught in one place.

### TypeBox Schemas & Resolver Split (domain/)

- **D-04 (Resolver split):** `domain/resolver.ts` exports two distinct functions, `resolveStrict(entry, ctx): ResolvedPlugin` (MM-5 union semantics) and `resolveLoose(entry, ctx): ResolvedPlugin` (MM-6/MM-7 entry-only). Caller picks based on `marketplace.json`'s top-level `strict` field (default true per MM-5). No flag-based runtime branching -- each resolver is straight-line code with its own fixture set. `ResolvedPlugin` is the discriminated `{installable: true, pluginRoot, ...} | {installable: false, notes, ...}` union locked by NFR-7; consumers cannot read `pluginRoot` from the non-installable variant.
- **D-05 (Schema location):** `domain/manifest.ts` owns TypeBox schemas + `Static<>` types + JIT-compiled validators. `domain/source.ts` owns the hand-written `ParsedSource` discriminated union. `domain/resolver.ts` consumes both. `domain/name.ts` owns generated-name helpers (`<plugin>-<skill>`, `<plugin>:<command>`, `claude-marketplace-<plugin>-<agent>`) plus `assertSafeName` (RN-1, RN-2). `domain/version.ts` owns `computeHashVersion` + the walk-filter constants.
- **D-06 (Source parser strategy):** Hand-written `parsePluginSource(input: unknown): ParsedSource` in `domain/source.ts`. TypeBox is NOT used for source-string parsing -- character-level work (slash counting, tilde detection, hash-fragment splitting, browser-paste `/tree/<ref>` rejection per SP-2/3) reads cleaner as conditional code than nested TypeBox unions. `ParsedSource` is `{kind:'path'|'github'|'unknown', raw: string, …}`; SP-7 preserved by `raw` field carrying the verbatim user input. Factory functions `pathSource(raw)` / `githubSource(raw)` (SP-6) wrap parse + validate-or-throw.
- **D-07 (TypeBox JIT timing):** Validators built at module-load via `TypeCompiler.Compile(SCHEMA)` and exported next to the schema (`MARKETPLACE_VALIDATOR`, `PLUGIN_MANIFEST_VALIDATOR`). Compilation cost paid once during extension boot. No lazy/per-call patterns. Easiest mental model -- compiled validator is just another export.
- **D-08 (Unknown source kind):** Forward-compat tail surfaces as `{kind:'unknown', raw, reason: string}` discriminated branch in `ParsedSource`. Non-relative string sources become `{kind:'unknown', reason:'non-relative string source ...'}` per MM-4 (NOT `kind:'github'`). NFR-12 satisfied -- adding new source kinds in the future is additive, not breaking.

### State Shape & Cross-Plugin Semantics (persistence/, Gaps 1+4)

- **D-09 (state.json keying -- Gap 1 resolution):** State shape per scope is `{schemaVersion: 1, marketplaces: {<mp>: {…, plugins: {<plugin>: {…}}}}}`. Plugin install records nest under the marketplace they belong to. PI-5 ("already installed") matches the `(marketplace, plugin)` tuple -- two same-named plugins from different marketplaces can coexist in state. PI-6 (cross-plugin resource-name conflicts) is the guard that catches actual collisions; it runs BEFORE any disk write per RN-3. Marketplace-remove cascade finds plugins under the marketplace's own record, which the shape supports natively. Resolves the previously-blocking `Behavioral Gap 1`.
- **D-10 (Cross-scope policy -- Gap 4 resolution):** Independent per-scope state. `install` does NOT read the other scope's `state.json`; no cross-scope check; no warning. Pi's existing scope layering (project shadows user for agents/MCP/skills/commands) handles runtime behavior. Users can intentionally have different versions per scope (team-shared via project, personal via user). `list` (no flags) shows both scopes grouped per ML-1. Resolves the previously-blocking `Behavioral Gap 4`.

### Hash Version Contract (Gap 7)

- **D-11 (Hash content normalization):** `computeHashVersion(pluginRoot)` normalizes each file's bytes before hashing: leading UTF-8 BOM (`\xEF\xBB\xBF`) stripped, every `\r\n` collapsed to `\n` (no isolated-CR handling -- matches git's autocrlf=input behavior). Hash inputs become OS-independent. PI-7 contract refined: `hash-<12hex>` = SHA-256-over-walk-of-normalized-bytes, with the algorithm AND normalization rules locked by snapshot test in `tests/domain/version.test.ts`. Resolves the previously-blocking `Behavioral Gap 7`.
- **D-12 (Walk filter list):** Recursive walk skips `.git/`, `node_modules/`, `.DS_Store`. Filter list captured as `HASH_WALK_SKIP` const (frozen array) in `domain/version.ts` and exercised by the snapshot fixture. Conservative -- adds new entries only when a real reproducibility issue surfaces. Path bytes go into the SHA verbatim before each file's normalized contents (so a rename invalidates the hash).

### Claude's Discretion

The user said "Recommended" on every option here, signing off on Claude's structural call. Captured for downstream agents:

- **D-01 (ledger function vs class):** Claude chose pure function -- pattern-research warned against implicit phase ordering; literal-array call sites are the strongest mitigation.
- **D-04 (resolver split):** Claude chose two distinct functions -- strict-only and loose-only paths can't drift if they don't share code.
- **D-06 (source parser):** Claude chose hand-written -- the parsing problem is character-level, TypeBox is for shape-validating already-parsed JSON.
- **D-07 (JIT timing):** Claude chose top-level -- startup cost is microseconds; lazy guards are runtime branches that buy nothing.
- **D-09 (state shape):** Claude chose per-marketplace nesting -- matches V1's known shape (ST-2) and lets PI-6's existing guard do the collision work.
- **D-11 (hash normalization):** Claude chose CRLF→LF + BOM strip -- git autocrlf=input is the de facto standard and most plugins are git-tracked.

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Primary spec (PRD)

- `docs/prd/pi-claude-marketplace-prd.md` -- V1 PRD; authoritative spec for the successor
- `docs/prd/pi-claude-marketplace-prd.md` §5.2.1 -- PI-1..15 install rules; PI-5 + PI-6 referenced by D-09
- `docs/prd/pi-claude-marketplace-prd.md` §6.1 -- SP-1..7 source parsing rules; D-06, D-08 implement
- `docs/prd/pi-claude-marketplace-prd.md` §6.2 -- SC-1..7 scopes; SC-3 brand for `ScopedLocations`
- `docs/prd/pi-claude-marketplace-prd.md` §6.3 -- MM-1..7 manifest schema; D-04, D-07 implement
- `docs/prd/pi-claude-marketplace-prd.md` §6.4 -- PR-1..6 resolver; NFR-7 discriminated union
- `docs/prd/pi-claude-marketplace-prd.md` §6.5 -- RN-1..2 naming + `assertSafeName`
- `docs/prd/pi-claude-marketplace-prd.md` §6.9 -- ST-1..9 state persistence; D-02, D-09 implement
- `docs/prd/pi-claude-marketplace-prd.md` §6.11 -- AS-1, AS-4, AS-5 atomic staging primitives (Phase 1 owns AS-1/4/5; Phase 2's `runPhases` uses them)
- `docs/prd/pi-claude-marketplace-prd.md` §6.12 -- ES-5 marker `(rollback partial: …)` is the user contract D-03 emits
- `docs/prd/pi-claude-marketplace-prd.md` §10 -- NFR-7 (discriminated union) and NFR-12 (forward-compat parser)
- `docs/prd/pi-claude-marketplace-prd.md` §11 -- V1 deferrals; Behavioral Gaps 1, 4, 7 resolved here

### Project planning

- `.planning/PROJECT.md` -- Project context; will gain Key Decisions for D-09/D-10/D-11 (Gap 1, 4, 7 resolutions) at phase transition
- `.planning/REQUIREMENTS.md` -- All 200 v1 REQ-IDs; Phase 2 owns the 39 listed under § "Per-phase counts"
- `.planning/ROADMAP.md` -- Phase 2 goal + 5 success criteria (lines 54-63)
- `.planning/STATE.md` -- Blockers list will shrink: Gap 1, 4, 7 are resolved by this CONTEXT

### Phase 1 carry-forward (consumed by Phase 2)

- `.planning/phases/01-foundations-toolchain/01-CONTEXT.md` -- D-01..D-21 from Phase 1 (ledger imports markers/notify/atomic-json from Phase 1 outputs)
- `.planning/phases/01-foundations-toolchain/01-SUMMARY.md` -- what Phase 1 actually shipped (the 9-folder skeleton + atomic-IO foundation)
- `.planning/phases/01-foundations-toolchain/01-VERIFICATION.md` -- Phase 1 SC coverage; criteria 1-3 directly enable Phase 2

### Research foundation

- `.planning/research/ARCHITECTURE.md` §"Pattern 4" -- Phase ledger primitive design (literal-array discipline against implicit ordering)
- `.planning/research/ARCHITECTURE.md` lines 39, 81, 151, 183, 257-263 -- ledger framing
- `.planning/research/STACK.md` -- TypeBox 1.x JIT (`Schema.Compile` ≈ Ajv perf), discriminated unions via `Type.Union([...], {discriminator})`
- `.planning/research/PITFALLS.md` -- Pitfall 5 (schema downgrade), 8 (union drift), 13 (hash drift); D-07/D-08/D-11 mitigate
- `.planning/research/SUMMARY.md` -- Phase ledger lands in Phase 2 (transaction primitive); state shape carry forward; hash filter snapshot test

### Library docs (planner should pull current versions)

- `typebox` 1.1.38+ -- `Type.Union([...], {discriminator})`, `TypeCompiler.Compile`, `Static<>` (D-04, D-07)
- `node:crypto` -- `createHash('sha256')` for D-11
- `node:fs/promises` `readdir({withFileTypes:true})` -- for D-12 walk
- `@mariozechner/pi-coding-agent` `dist/core/extensions/types.d.ts` -- `ExtensionAPI` shape (state guard does not need pi but the broader phase context consumers do)

## Existing Code Insights

### Reusable Assets (Phase 1 outputs)

- **`extensions/claude-marketplace/shared/atomic-json.ts`** -- `atomicWriteJson(filePath, value)` is the JSON-write primitive Phase 2's `state-io.ts` uses for state.json saves (NFR-1, AS-1, ST-1).
- **`extensions/claude-marketplace/shared/markers.ts`** -- Exports `ROLLBACK_PARTIAL` (and the four other ES-5 strings); `transaction/rollback.ts` (D-03) imports from here. Snapshot test infrastructure (`tests/architecture/markers-snapshot.test.ts`) is already wired.
- **`extensions/claude-marketplace/shared/errors.ts`** -- `PathContainmentError` (and `SymlinkRefusedError` subclass) exist; Phase 2 adds new error types here (`ConcurrentInstallError`, `ManifestParseError`, `ResolverError` as needed). `Error.cause` chaining infra (ES-4) already in place.
- **`extensions/claude-marketplace/shared/notify.ts`** -- `notifySuccess/notifyWarning/notifyError(ctx, msg, cause?)` (D-07 from Phase 1). All Phase 2 user-visible messages (e.g., legacy migration save failure per IL-3, ST-4) route through these. The single sanctioned `console.warn` for IL-3 will be the `migrateLegacyMarketplaceRecords` callsite -- wrap with `eslint-disable-next-line` per Phase 1 D-06.
- **`extensions/claude-marketplace/shared/path-safety.ts`** -- `assertPathInside(parent, child)` with symlink refusal (Phase 1 D-14..D-17). Every `persistence/locations.ts` path computation routes through here (PS-1..PS-5).
- **`extensions/claude-marketplace/platform/git.ts`** -- isomorphic-git wrapper (Phase 1 D-18..D-20). Phase 2 does not use git directly; orchestrators in Phase 4 do. Phase 2 only consumes `ParsedSource` + `ResolvedPlugin` from `domain/`.
- **`extensions/claude-marketplace/{transaction,domain,persistence}/index.ts`** -- Empty placeholders scaffolded by Phase 1 D-12; Phase 2 fills with the modules above. README.md exists in each folder describing allowed imports.

### Established Patterns (carry forward unchanged)

- **TypeScript strict + ESM** -- `package.json` `"type": "module"`, `tsconfig.json` strict, `node --test "tests/**/*.test.ts"` for native TS strip on Node 24.
- **9-folder import boundaries** -- `eslint.config.js` enforces `domain/` and `shared/` MUST NOT import upward. Phase 2's modules respect this: `domain/` imports only from `shared/`; `transaction/` imports from `domain/` + `shared/`; `persistence/` imports from `domain/` + `shared/`.
- **PRD-as-snapshot-fixture (Phase 1 D-09)** -- `tests/helpers/prd-extract.ts` exists. Phase 2's marker-emission tests (rollback strings) reuse this; the hash version snapshot test (D-11/D-12) uses a separate fixture-based snapshot since PRD doesn't enumerate the walk filter list.
- **`npm run check` pipeline** -- `typecheck && lint && format:check && test` MUST stay green per NFR-6.
- **Pre-commit hook chain** -- unicode-dash + smartquote + mdformat + markdownlint-cli2. Phase 2 source files (TypeScript, no Markdown other than READMEs) mostly avoid em-dash hooks; planning Markdown follows existing dash convention.

### Integration Points

- **`runPhases<C>` ctx parameter** -- Each orchestrator (Phase 5 install/update/uninstall) defines its own `InstallCtx`/`UpdateCtx`/`UninstallCtx` type; Phase 2's `runPhases` is generic over `C`. Phase 2 does NOT define those orchestrator-specific contexts; it stops at `Phase<C>` and the structured result.
- **`withStateGuard(scope, fn)` API** -- Loads fresh state, hands snapshot to `fn`, saves only on no-throw. Concurrent install/uninstall/update detection lives here (ST-8, ST-9). Composes with `runPhases` per D-02.
- **`ScopedLocations` brand (SC-3)** -- `persistence/locations.ts` exports a typed bundle (brand symbol) so hand-crafted shapes mixing scopes don't type-check. Every name-derived path inside that bundle has been `assertPathInside`-checked at construction time.
- **Legacy state migration (ST-4, ST-5, IL-3)** -- `persistence/state-io.ts` reads state.json, normalizes legacy records (missing `manifestPath`/`marketplaceRoot`, missing `resources.agents`/`resources.mcpServers`), persists asynchronously best-effort. The single sanctioned `console.warn` lives here (one ESLint-disable comment).

## Specific Ideas

- **Phase ledger snapshot test** -- Beyond the `(rollback partial: …)` marker test, add `tests/transaction/phase.test.ts` that exercises a 4-phase ledger where phase 3 throws and verifies (a) phases 1+2's `undo` ran in reverse order, (b) `RunPhasesResult.rollbackPartials` lists every undo failure with phase name + msg, (c) leak descriptors thread through.
- **Resolver fixture taxonomy** -- Mirror the PRD §6.1 reject/accept cases as separate test files: `tests/domain/source.spec.ts` for parser, `tests/domain/resolver-strict.spec.ts` and `resolver-loose.spec.ts` for the two resolvers (D-04). Each PRD case maps 1:1 to a test name so REQ-ID coverage is grep-able.
- **State migration fixture set** -- Capture a corpus of legacy state.json shapes (V1 pre-schemaVersion, missing-fields variants) as `tests/persistence/fixtures/legacy/*.json`. Each fixture asserts the post-migration shape AND that `console.warn` did NOT fire (since these legacy reads succeed). The IL-3 console.warn case has a dedicated test that mocks `atomicWriteJson` to fail.
- **Hash-stability fixture** -- `tests/domain/fixtures/hash-stability/` ships a tiny plugin tree containing CRLF, LF, BOM-prefixed, no-BOM files plus `.git/HEAD` and `.DS_Store` markers. The snapshot asserts the precomputed `hash-<12hex>` value AND that adding/removing `.git/HEAD` doesn't change it.
- **`@ts-expect-error` test for NFR-7** -- `tests/domain/resolver.types.test.ts` includes a non-runtime block that attempts to read `pluginRoot` from a non-installable variant; TypeScript MUST reject it. Exercises Roadmap Phase 2 success criterion 1.

## Deferred Ideas

- **Schema-version v2 migration path** -- `state.json` is locked at `schemaVersion: 1` for v1. When v2 ships (post-milestone), `withStateGuard` will need a version-floor check (Pitfall 5 mitigation). Tracked here so the next migration can add the check without rediscovering the requirement.
- **Cross-scope shadowing warning (rejected from D-10)** -- User chose the no-warning option; if real-world usage shows users are surprised, the warning could be added behind a future `--strict-isolation` flag. Not Phase 2.
- **TypeBox JSON Schema 2020-12 export** -- TypeBox can emit JSON Schema for downstream consumers (e.g., a `marketplace.json` editor with autocomplete). Not a Phase 2 deliverable; tracked as a possible v2 ergonomics improvement (NFR-8 / EVOL-* family).
- **Manifest-mtime caching (NFR-8 BACKLOG)** -- Listed in REQUIREMENTS.md `v2 Requirements`. Phase 2's `domain/manifest.ts` parser is the seam where this would be added; the design intentionally keeps `parseMarketplace` pure so caching is a wrapper layer above it. Phase 7 owns the actual implementation.
- **Schema-version increment enforcement** -- The single sanctioned `console.warn` (IL-3) covers the migration-save failure case but doesn't currently enforce that schemaVersion increments are explicit. Audit-time concern, not Phase 2 work.
- **`marketplaces` map being empty vs undefined** -- Initial-load case where no marketplaces have ever been added. State-io should treat missing/empty/undefined consistently (default to empty object, never throw); a small invariant test plus the existing `state-schema.ts` will cover. Folded into Phase 2 plan but not a separate decision.

______________________________________________________________________

*Phase: 2-Domain Core & Persistence Primitives* *Context gathered: 2026-05-09*
