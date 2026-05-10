# Phase 2: Domain Core & Persistence Primitives - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents. Decisions are captured in 02-CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 2-Domain Core & Persistence Primitives
**Areas discussed:** Phase ledger API shape; TypeBox schema + strict-mode resolver layout; Cross-marketplace + cross-scope plugin semantics (Gaps 1+4); Hash content normalization (Gap 7)

______________________________________________________________________

## Phase Ledger API Shape

### Q1: How should the Phase ledger primitive expose itself in transaction/phase.ts?

| Option | Description | Selected |
|--------|-------------|----------|
| Pure async function `runPhases(phases, ctx)` | Stateless: caller passes a literal `Phase[]` const array; runPhases executes in order, calls undo() in reverse on failure, returns structured `{ok, error?, rollbackPartials, leaks}`. Caller composes the ES-5 marker. | ✓ |
| Coordinator class with `add()`+`run()` | Stateful: orchestrator imperatively adds phases. Phase order becomes implicit (add-call sites scattered). Architecture-research warned against this. | |
| Inline-functional builder `phase()` chain | Saga-DSL feel. More API surface, less greppable than literal array. | |

**User's choice:** Pure async function `runPhases(phases, ctx)` (Recommended)
**Notes:** Locks `Phase<C>` interface and `RunPhasesResult` typed result. Phase[] array is a literal const at every call site (grep-able order -- anti-pattern guard against architecture-research's warning).

### Q2: How should runPhases compose with withStateGuard (ST-7's read-fresh-then-save-or-throw closure)?

| Option | Description | Selected |
|--------|-------------|----------|
| withStateGuard wraps runPhases | Outer guard, inner ledger. State-fresh snapshot threaded into ctx; terminal 'state' phase mutates snapshot; guard saves on closure return. Concurrent-install detection (ST-8/9) at guard save boundary. | ✓ |
| runPhases wraps withStateGuard inside terminal phase | Non-state phases run without snapshot; pre-commit phases that need state context (PI-6 conflict guard) can't see a guard-fresh snapshot -- TOCTOU window. | |
| Independent -- orchestrator picks per-call | More flexible but no canonical pattern; risk of drift between orchestrators. | |

**User's choice:** withStateGuard wraps runPhases (Recommended)
**Notes:** Single ownership of state lifecycle. ST-8 / ST-9 (concurrent install/update detection) live at the guard's save boundary, not in the ledger.

### Q3: Where does the (rollback partial: ...) ES-5 marker get assembled, and how do AS-5/AS-6 cleanup leaks compose with it?

| Option | Description | Selected |
|--------|-------------|----------|
| transaction/rollback.ts owns formatting + leak append | Sibling to phase.ts. Imports `ROLLBACK_PARTIAL` from shared/markers.ts; assembles marker via `formatRollbackError(result, originalError)`; appends leaks via `appendLeaks(err, leaks)`. Single chokepoint catches drift. | ✓ |
| phase.ts builds the error itself | Couples transaction primitive to presentation marker; same surface needs to know about leak descriptors. | |
| Orchestrator builds it inline | Maximum flexibility but invites drift between install/update marker strings -- exactly what markers.ts (Phase 1 D-08) was created to prevent. | |

**User's choice:** transaction/rollback.ts owns formatting + leak append (Recommended)
**Notes:** phase.ts stays purely about ordering + undo wiring; rollback.ts is the single chokepoint for the user-visible marker string.

______________________________________________________________________

## TypeBox Schema + Strict-Mode Resolver Layout

### Q1: Should the strict-true and strict-false resolvers be two distinct exported functions or a single resolver with a flag?

| Option | Description | Selected |
|--------|-------------|----------|
| Two distinct resolvers | `resolveStrict(entry, ctx)` and `resolveLoose(entry, ctx)` in domain/resolver.ts. Each is straight-line code; per-resolver fixture set; TypeScript can't lose track of which mode produced a given ResolvedPlugin. | ✓ |
| Single resolver with `strict` flag | One function, runtime branches on flag. Risk: every conditional branch is a type-check seam where strict-only and loose-only paths can drift. | |
| Method on a Resolver class | Adds object-shape that buys nothing over a function -- no shared state to maintain. | |

**User's choice:** Two distinct resolvers (Recommended)
**Notes:** Caller picks per `marketplace.json`'s top-level `strict` field (default true per MM-5). Shared helpers (component-decl detection, source classification) live as private utilities in domain/.

### Q2: Should the source parser use TypeBox or stay hand-written?

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-written parser, TypeBox JSON-only | domain/source.ts: `parsePluginSource(input): ParsedSource` discriminated union `{kind:'path'\|'github'\|'unknown', ...}`. Character-level work reads cleaner as conditional code. SP-7 preserved by `raw` field. | ✓ |
| TypeBox `Type.Union` with discriminator for source too | Single TypeBox surface across manifest + sources. Awkward -- parser still needs character-level logic; TypeBox would only validate the parsed shape, doubling surface. | |
| Mixed: TypeBox for object-form, hand-written for string-form | Two parser code-paths producing the same union. Risk: divergence. | |

**User's choice:** Hand-written parser, TypeBox for JSON only (Recommended)
**Notes:** SP-6 boundary validation captured via factory functions `pathSource(raw)` / `githubSource(raw)` that wrap parse + validate-or-throw.

### Q3: When should TypeBox validators be JIT-compiled?

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level at module load | `const MARKETPLACE_VALIDATOR = TypeCompiler.Compile(MarketplaceJsonSchema)` next to schema export. Compilation runs once during boot. Easiest mental model. | ✓ |
| Lazy on first call | `getMarketplaceValidator()` builds and caches on first invocation. Adds null-check branching on every call; no real benefit unless module imported but never used. | |
| Per-call (no caching) | Slow, never sensible. Listed for completeness. | |

**User's choice:** Top-level at module load (Recommended)
**Notes:** Validators exported alongside schemas (e.g., `MARKETPLACE_VALIDATOR`, `PLUGIN_MANIFEST_VALIDATOR` consts).

______________________________________________________________________

## Cross-Marketplace + Cross-Scope Plugin Semantics (Gaps 1+4)

### Q1: How should state.json key plugin install records, and what does PI-5 ("already installed") match against?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-marketplace nesting; PI-5 matches (marketplace, plugin) | state.json: `{marketplaces: {mp1: {plugins: {acme: ...}}, mp2: {plugins: {acme: ...}}}}`. PI-5 fires only on same-tuple match; PI-6 catches actual resource-name collisions. Matches V1 ST-2 shape. | ✓ |
| Flat plugins map; PI-5 matches plugin name only | `{plugins: {acme: {...}}}`. Forces one-plugin-name-per-scope. Breaks marketplace-bounded model. | |
| Per-marketplace nesting; PI-5 matches across marketplaces | Hybrid with cross-marketplace scan. Same UX as flat with per-marketplace storage. Harder to test. | |

**User's choice:** Per-marketplace nesting; PI-5 matches (marketplace, plugin) (Recommended)
**Notes:** Resolves Behavioral Gap 1 (cross-marketplace plugin name handling). Two same-named plugins from different marketplaces can coexist in state; PI-6's existing cross-plugin resource-name conflict guard runs BEFORE any disk write per RN-3.

### Q2: If `acme@mp1` is installed in user scope and the user runs `install acme@mp2 --scope project`, should anything check the other scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Independent scopes; no cross-scope check | install operates on targeted scope only. Pi's existing scope layering (project shadows user) handles runtime. State per-scope-independent. Lets users intentionally have different versions per scope. | ✓ |
| Block cross-scope conflicts at install time | install acme@mp2 --scope project fails because acme already in user scope. Forces strict isolation; conflict-error UX is opaque. | |
| Allow but warn loudly when shadowing detected | Honest about Pi's runtime but adds cross-scope I/O on every install; warning fires on every legitimate dual-scope install too. | |

**User's choice:** Independent scopes; no cross-scope check (Recommended)
**Notes:** Resolves Behavioral Gap 4 (simultaneous-scope install semantics). `list` (no flags) shows both scopes grouped per ML-1 so the user can still see what's in each.

______________________________________________________________________

## Hash Content Normalization (Gap 7)

### Q1: How should the recursive-walk SHA-256 normalize file contents before hashing?

| Option | Description | Selected |
|--------|-------------|----------|
| Normalize: CRLF→LF + strip UTF-8 BOM | Each file's bytes pass through a normalizer: leading `\xEF\xBB\xBF` stripped, every `\r\n` collapsed to `\n`. Hash inputs OS-independent. Documented as part of PI-7 contract. Matches git autocrlf=input. | ✓ |
| Hash bytes verbatim | Simplest. Cross-OS reproducibility lost; CRLF-tracked plugins differ on Windows vs Linux. Update cascade would oscillate for any plugin lacking explicit version. | |
| Refuse to hash on BOM/CRLF presence | Forces clean upstream but rejects legitimate Windows-authored plugins. UX-hostile. | |

**User's choice:** Normalize: CRLF→LF + strip UTF-8 BOM (Recommended)
**Notes:** Resolves Behavioral Gap 7 (hash version stability across encoding). PI-7 contract refined: `hash-<12hex>` = SHA-256-over-walk-of-normalized-bytes. Snapshot test in `tests/domain/version.test.ts` locks both algorithm AND normalization rules.

### Q2: Which paths should the recursive walk skip when computing the hash?

| Option | Description | Selected |
|--------|-------------|----------|
| Skip .git/, node_modules/, .DS_Store | Minimum viable filter. Filter list as `HASH_WALK_SKIP` const exercised by snapshot fixture. Conservative -- adds new entries only when a real reproducibility issue surfaces. | ✓ |
| Skip .git/ only | Maximum strictness. node_modules churn would invalidate hash on every npm install. Footgun. | |
| Skip .git/, node_modules/, plus all dotfiles | Hides legitimate plugin config (.eslintrc.json, .github/). Too aggressive. | |

**User's choice:** Skip .git/, node_modules/, .DS_Store (Recommended)
**Notes:** Path bytes go into the SHA verbatim before each file's normalized contents (so a rename invalidates the hash). Filter list exposed as a frozen `HASH_WALK_SKIP` array in domain/version.ts.

______________________________________________________________________

## Claude's Discretion

User selected "Recommended" on every option -- Claude's structural calls were ratified in each case. See 02-CONTEXT.md "Claude's Discretion" section for the per-decision rationales.

## Deferred Ideas

- Schema-version v2 migration path (Pitfall 5 mitigation post-milestone)
- Cross-scope shadowing warning (rejected option from Q2 in Gap 4 area; could revisit behind a `--strict-isolation` flag if real-world usage demands)
- TypeBox JSON Schema 2020-12 export for downstream consumers (e.g., marketplace.json editor autocomplete)
- Manifest-mtime caching (NFR-8 BACKLOG; Phase 7 owns)
- Schema-version increment enforcement (audit-time concern, not Phase 2)
