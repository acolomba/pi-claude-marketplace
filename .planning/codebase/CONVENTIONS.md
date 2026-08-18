# Coding Conventions

**Analysis Date:** 2026-08-18

## Naming Patterns

**Files:**
- `kebab-case.ts` throughout (`atomic-json.ts`, `git-failure-classifiers.ts`, `notify-context.ts`)
- Suffix conventions signal role: `*-mock.ts` (test doubles, `tests/helpers/credential-mock.ts`), `*.test.ts` (tests), `errors.ts` / `errors-bridges.ts` (typed error classes grouped by layer)

**Functions:**
- `camelCase`, verb-first (`atomicWriteJson`, `findProviderForHost`, `loadMarketplaceManifestUncached`)
- Mock factories use `makeMock*` prefix (`makeMockCredentialOps`, `makeMockGitOps`, `makeMockDeviceFlowHttp`)
- Classifier/predicate functions use `is*`/`classify*`/`looksLike*` naming

**Variables:**
- `camelCase`; `SCREAMING_SNAKE_CASE` for module-level constants (`GITHUB_PROVIDER`)

**Types:**
- `PascalCase` for interfaces, types, classes (`GitAuthProvider`, `CredentialOps`, `MockCredentialState`)
- Error classes always suffixed `Error` and always `extends Error` (see Error Handling below)

## Code Style

**Formatting:**
- Prettier config `.prettierrc.json` at repo root
  - `printWidth: 100`, `tabWidth: 2`, `trailingComma: "all"`, `useTabs: false`
- Run via `npm run format` / `npm run format:check`

**Linting:**
- ESLint 10 flat config: `eslint.config.js` at repo root (`npm run lint` runs `eslint extensions tests eslint.config.js`)
- Extends `tseslint.configs.strictTypeChecked` + `stylisticTypeChecked` (full type-aware strict linting)
- Plugins: `@stylistic`, `import-x`, `sonarjs`
- Key rules:
  - `no-console: "warn"` (console output is discouraged; see IL-2/IL-3 in project constraints)
  - `@typescript-eslint/no-unused-vars`: error, with `^_` ignore pattern for args/vars/caught errors
  - `@typescript-eslint/explicit-module-boundary-types: "error"` — all exported functions must declare return types
  - `@typescript-eslint/array-type: "off"` and `restrict-template-expressions: "off"` — deliberately not enforced (either `T[]` or `Array<T>` is fine; numeric template interpolation is fine)
  - `sonarjs/cognitive-complexity: ["error", 15]` (`eslint.config.js:77`) — turned `"off"` only for a narrow set of blocks (e.g. line 317)
  - `sonarjs/no-identical-functions`, `no-inverted-boolean-check`, `no-nested-conditional`, `no-nested-template-literals`: all error
  - `curly: ["error", "all"]` — braces always required
  - `@stylistic/padding-line-between-statements`: blank line required after every block-like statement
  - `prefer-object-has-own: "error"`
- **Extension-scoped output discipline** (`no-restricted-syntax`, `eslint.config.js:94`, scoped to `extensions/pi-claude-marketplace/**/*.ts`): forbids direct `process.stdout.write`/`process.stderr.write` calls — matches project constraint IL-2 (all user-visible output via `ctx.ui.notify`). Turned back `"off"` for a small set of exempted blocks (`eslint.config.js:145,158,172,315`), each with an inline comment explaining the exemption (e.g. the sanctioned `console.warn` selector).
- Ignored paths: `.claude/`, `.opencode/`, `.pi/`, `.planning/`, `build/`, `coverage/`, `dist/`, `node_modules/`, `tmp/`, `tests/live-uat/` (standalone `.mjs` UAT drivers excluded from typed tree)

**Fallow (whole-graph static analysis) — a second, independent complexity/duplication/dead-code gate:**
- `.fallowrc.json` at repo root; entry point `extensions/pi-claude-marketplace/index.ts`; `production: false`
- `npm run fallow` runs three sub-gates in sequence, each `--fail-on-issues`: `fallow dead-code`, `fallow health`, `fallow dupes`
- `npm run check` is `typecheck && lint && fallow && format:check && test && test:integration` — **fallow is a mandatory member of the check chain, not an optional extra.** Always mention it when describing "the gate."
- `health` thresholds: `maxCyclomatic: 20`, `maxCognitive: 15`, `maxUnitSize: 60`, `maxCrap: 0`. **This is a second, independently-computed cognitive-complexity ceiling layered on top of ESLint's `sonarjs/cognitive-complexity: 15`** — the two tools use different algorithms and do not agree on a given function's score. A function can pass one and fail the other; both gates must be satisfied. Currently there are **zero** `health.thresholdOverrides` entries in `.fallowrc.json` — no function has an approved exception.
- `boundaries.zones` (13 zones: entry, edge, orchestrators, bridges-agents, bridges-commands, bridges-mcp, bridges-skills, bridges-hooks, domain, transaction, persistence, platform, shared) is a **finer-grained** architecture-boundary gate than ESLint's `import-x/no-restricted-paths` (which only distinguishes the coarser `bridges` as one zone). It is the only mechanism that forbids one bridge kind from importing a sibling bridge kind (e.g. `bridges-skills` importing `bridges-agents`).
- `boundaries.calls.forbidden` also re-enforces the `process.stdout.*`/`process.stderr.*` ban per zone, independently of the ESLint `no-restricted-syntax` rule.
- `duplicates.threshold: 3`; `duplicates.ignoredClones` currently holds exactly two entries (`dup:cc950b18:2`, `dup:6d8c002d:2`) — both retained clones live in `tests/live-uat/manifest-absence-canary.mjs` and `tests/live-uat/stop-canary.mjs`, and each is justified with an inline comment header in **both** files (fallow's `ignoredClones` is typed `string[]`, so the per-clone justification cannot live in the JSON and lives in the source instead). **Fingerprint keys are content-addressed (`dup:<hash>`) and stable; do not use the index-suffixed `dup:<hash>-NN` form anywhere — it is not stable across runs.**
- Dead-code suppressions: exactly **9** `fallow-ignore` markers exist repo-wide as of this analysis (verify with `grep -a -rn "fallow-ignore" extensions/ tests/`), all scoped to `unused-type`/`unused-export`/`private-type-leak`/`unused-file` — never to complexity or duplication. Two live in `tests/live-uat/*.mjs` (whole-file `fallow-ignore-file unused-file`, marking the standalone operator-run UAT drivers as intentionally unreachable from the import graph); the remaining seven are `fallow-ignore-next-line` markers on compile-time proof/pin types in `extensions/pi-claude-marketplace/{shared/notify-reasons.ts, domain/resolver.ts, orchestrators/marketplace/{add,remove}.messaging.ts}` whose only purpose is to satisfy `noUnusedLocals`/`no-unused-vars` for a TypeScript type-level assertion that no runtime code ever imports.
- `npm run fallow:audit` gates PRs on newly-introduced findings only (delta mode), distinct from the full `npm run fallow` gate used locally and in `npm run check`.
- **A gate wants a test that plants the violation, not one that reads the config.** `import-x/no-cycle` (the ESLint half of the circular-import gate) was configured-but-inert for a period while a test that merely re-read the rule config from `eslint.config.js` stayed green. `tests/architecture/import-boundaries.test.ts` and `tests/architecture/no-orchestrator-network.test.ts` now verify by **planting**: they either scan real source files for forbidden import/call tokens (`assertNoForbiddenSurface`, `tests/helpers/source-scan.ts`) or programmatically load the flat config and assert its zones match an independently-maintained expected matrix — never a bare "the rule object exists" check. Apply this pattern to any new architectural gate: prove the rule actually fires on a real (or planted) violation, not just that its configuration is present.

## Import Organization

**Order (enforced by `import-x/order`):**
1. `builtin` (node:*)
2. `external` (npm packages)
3. `internal`
4. `parent`
5. `sibling`
6. `index`
7. `object`
8. `type` (type-only imports last)

- `newlines-between: "always"` — blank line between each group
- `alphabetize: { order: "asc", caseInsensitive: true }` within each group
- Type-only imports (`import type { ... }`) are grouped separately and placed last — see `tests/shared/atomic-json.test.ts` and `tests/helpers/credential-mock.ts` for the pattern:
  ```ts
  import assert from "node:assert/strict";
  import test from "node:test";

  import { atomicWriteJson } from "../../extensions/pi-claude-marketplace/shared/atomic-json.ts";
  ```
- Test files import production modules with explicit `.ts` extensions (ESM-native resolution, no build step for tests)
- Test-helper mocks use **type-only** imports of production types to avoid pulling runtime code into pure-mock files (see the header comment in `tests/helpers/credential-mock.ts`: "Type-only import for CredentialOps so the helper file does not import the production module at runtime")

**Path Aliases:**
- None detected — imports use relative paths (`../../extensions/pi-claude-marketplace/...`)

## Error Handling

**Pattern: typed error classes, one per failure mode**

All domain errors live in `extensions/pi-claude-marketplace/shared/errors.ts` (bridge-specific errors in `errors-bridges.ts`, path errors in `path-safety.ts`). Every error:
- `extends Error`
- Sets `this.name = "<ClassName>"` in the constructor (so `error.name` matches the class name even after minification/transpilation)
- Carries typed, readonly public fields for structured data callers need (never encode structured data only in the message string)
- Has a doc comment citing the requirement/decision ID it implements (e.g. `MA-6`, `D-48-A`, `ATTR-07`)

Example (`extensions/pi-claude-marketplace/shared/errors.ts:140`):
```ts
export class StaleSourceCloneError extends Error {
  readonly absPath: string;
  readonly mpName?: string;
  constructor(absPath: string, mpName?: string) {
    super(`stale source clone at ${absPath}`);
    this.name = "StaleSourceCloneError";
    this.absPath = absPath;
    if (mpName !== undefined) {
      this.mpName = mpName;
    }
  }
}
```

Errors that wrap an underlying cause pass `{ cause }` through the `Error` constructor's second argument rather than swallowing or re-stringifying it (`MarketplaceUpdateError`, `extensions/pi-claude-marketplace/shared/errors.ts:180`).

**Discrimination:** callers narrow on `instanceof`, never on message substring matching or `error.name` string comparison (per the `InvalidMarketplaceManifestError` doc comment at `extensions/pi-claude-marketplace/shared/errors.ts:189`, which explicitly replaced legacy `SyntaxError`/substring-matched failures with a typed class).

**Optional fields:** constructors accept `opts?: { cause?: unknown; retryHint?: string }`-shaped option bags for errors with more than 2 optional fields, rather than long positional parameter lists.

## Logging

**Framework:** No logging library. `console.warn` is the single sanctioned exception (load-time legacy-migration save failure per project constraint IL-3); `no-console` is `"warn"` at lint level everywhere else.

**User-visible output:** All output goes through `ctx.ui.notify(message, severity)` (`extensions/pi-claude-marketplace/shared/notify.ts`, `notify-context.ts`, `notify-reasons.ts`). Direct `process.stdout`/`process.stderr` writes are forbidden inside `extensions/pi-claude-marketplace/**` by **two independent gates**: the ESLint `no-restricted-syntax` rule and fallow's `boundaries.calls.forbidden` per-zone rule (see Fallow section above).

## Comments

**When to Comment:**
- Non-obvious "why", not "what" — see `.claude/rules/typescript-comments.md`
- Comments and test titles cite durable spec IDs (`D-NN`, `NFR-N`, `PRL-NN`, `MA-N`, `ATTR-NN`, etc.) as traceability anchors, not GSD process artifacts (no `Phase NN`, `Plan NN`, `Wave N`, `Pitfall N` references — these rot as planning docs are archived)
- File-level or class-level JSDoc-style block comments explain rationale, cross-references to sibling files, and behavior contracts (see `tests/helpers/credential-mock.ts` header, and `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts` header describing why the module exists where it does and the import invariant that keeps a cycle from reforming)

**JSDoc/TSDoc:**
- Used selectively above exported classes/functions with non-obvious behavior; not required on every export
- Format: `/** ... */` block above the declaration, often citing the implementing requirement ID inline

## Function Design

**Size:** Bounded by **two independently-computed complexity gates**: ESLint's `sonarjs/cognitive-complexity: 15` and fallow's `health.maxCognitive: 15` / `health.maxCyclomatic: 20` / `health.maxUnitSize: 60`. The two tools disagree on a given function's cognitive-complexity score (different algorithms), so a function must pass both independently — do not treat a green ESLint run as proof fallow will also be green, or vice versa. Keep functions small and flat; avoid nested conditionals (`sonarjs/no-nested-conditional` is also an ESLint error).

**Parameters:** Prefer explicit positional parameters for 1-3 required values; switch to an `opts` object for anything with optional/named fields (see `MarketplaceUpdateError` constructor above).

**Return Values:** All exported functions must have explicit return type annotations (`@typescript-eslint/explicit-module-boundary-types: "error"`).

**Dependency injection over test-only seams:** when a function needs to be testable against a side-effecting dependency (subprocess spawn, git ops, credential store), pass that dependency in as a parameter — making it part of the function's public interface — rather than exposing a `_setXForTest`-style module-global seam that reaches inside the module from a test. If testing a unit is hard without such a seam, treat that difficulty as a signal the dependency wants to be an explicit collaborator (its own module/interface), not a reason to punch a test-only hole in the production module. `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts` is the worked example of extracting shared state into its own leaf module specifically so the modules that need it can take it as an explicit import rather than reaching into a hub module's internals; the same principle applies to `makeMockGitOps`/`makeMockCredentialOps`-style factories throughout `tests/helpers/`, which are injected as constructor/function arguments (never patched onto a shared global) — see `tests/helpers/credential-mock.ts` ("buildAuthCallbacks tests inject this mock the same way add/update tests inject makeMockGitOps").

## Module Design

**Directory layers** under `extensions/pi-claude-marketplace/`: `domain/`, `orchestrators/`, `bridges/`, `edge/`, `platform/`, `persistence/`, `transaction/`, `shared/` (see ARCHITECTURE.md/STRUCTURE.md for layering rules).

**Exports:** Named exports only observed — no default exports in sampled files.

**Barrel Files:** Barrels exist per bridge kind (`bridges/<kind>/index.ts`, plus the aggregate `bridges/index.ts`) and under `orchestrators/{import,marketplace,plugin}/`. The layer-level barrels (`domain/`, `edge/`, `orchestrators/`, `persistence/`, `transaction/`) were removed as unreachable from the extension entry point. Barrels are not universally used across every directory (check per-directory before assuming one exists).

---

*Convention analysis: 2026-08-18*
