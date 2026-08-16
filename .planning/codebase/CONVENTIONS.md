# Coding Conventions

**Analysis Date:** 2026-08-07

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
- Prettier config `.prettierrc` at repo root
  - `printWidth: 100`, `tabWidth: 2`, `trailingComma: "all"`, `useTabs: false`
- Run via `npm run format` / `npm run format:check`

**Linting:**
- ESLint 10 flat config: `eslint.config.js` at repo root
- Extends `tseslint.configs.strictTypeChecked` + `stylisticTypeChecked` (full type-aware strict linting)
- Plugins: `@stylistic`, `import-x`, `sonarjs`
- Key rules:
  - `no-console: "warn"` (console output is discouraged; see IL-2/IL-3 in project constraints)
  - `@typescript-eslint/no-unused-vars`: error, with `^_` ignore pattern for args/vars/caught errors
  - `@typescript-eslint/explicit-module-boundary-types: "error"` — all exported functions must declare return types
  - `@typescript-eslint/array-type: "off"` and `restrict-template-expressions: "off"` — deliberately not enforced (either `T[]` or `Array<T>` is fine; numeric template interpolation is fine)
  - `sonarjs/cognitive-complexity: ["error", 15]`
  - `sonarjs/no-identical-functions`, `no-inverted-boolean-check`, `no-nested-conditional`, `no-nested-template-literals`: all error
  - `curly: ["error", "all"]` — braces always required
  - `@stylistic/padding-line-between-statements`: blank line required after every block-like statement
  - `prefer-object-has-own: "error"`
- **Extension-scoped output discipline** (block for `extensions/pi-claude-marketplace/**/*.ts`): `no-restricted-syntax` forbids direct `process.stdout.write`/`process.stderr.write` calls — matches project constraint IL-2 (all user-visible output via `ctx.ui.notify`)
- Ignored paths: `.claude/`, `.opencode/`, `.pi/`, `.planning/`, `build/`, `coverage/`, `dist/`, `node_modules/`, `tmp/`, `tests/live-uat/` (standalone `.mjs` UAT drivers excluded from typed tree)

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
- Test-helper mocks use **type-only** imports of production types to avoid pulling runtime code into pure-mock files (see comment in `tests/helpers/credential-mock.ts`)

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

**User-visible output:** All output goes through `ctx.ui.notify(message, severity)` (`extensions/pi-claude-marketplace/shared/notify.ts`, `notify-context.ts`, `notify-reasons.ts`). Direct `process.stdout`/`process.stderr` writes are lint-forbidden inside `extensions/pi-claude-marketplace/**`.

## Comments

**When to Comment:**
- Non-obvious "why", not "what" — see `.claude/rules/typescript-comments.md`
- Comments and test titles cite durable spec IDs (`D-NN`, `NFR-N`, `PRL-NN`, `MA-N`, `ATTR-NN`, etc.) as traceability anchors, not GSD process artifacts (no `Phase NN`, `Plan NN`, `Wave N`, `Pitfall N` references — these rot as planning docs are archived)
- File-level or class-level JSDoc-style block comments explain rationale, cross-references to sibling files, and behavior contracts (see `tests/helpers/credential-mock.ts` header)

**JSDoc/TSDoc:**
- Used selectively above exported classes/functions with non-obvious behavior; not required on every export
- Format: `/** ... */` block above the declaration, often citing the implementing requirement ID inline

## Function Design

**Size:** Bounded implicitly by `sonarjs/cognitive-complexity: 15` (lint error above that threshold) — keep functions small and flat; avoid nested conditionals (`sonarjs/no-nested-conditional` is also an error).

**Parameters:** Prefer explicit positional parameters for 1-3 required values; switch to an `opts` object for anything with optional/named fields (see `MarketplaceUpdateError` constructor above).

**Return Values:** All exported functions must have explicit return type annotations (`@typescript-eslint/explicit-module-boundary-types: "error"`).

## Module Design

**Directory layers** under `extensions/pi-claude-marketplace/`: `domain/`, `orchestrators/`, `bridges/`, `edge/`, `platform/`, `persistence/`, `transaction/`, `shared/` (see ARCHITECTURE.md/STRUCTURE.md for layering rules).

**Exports:** Named exports only observed — no default exports in sampled files.

**Barrel Files:** Barrels exist per bridge kind (`bridges/<kind>/index.ts`, plus the aggregate `bridges/index.ts`) and under `orchestrators/{import,marketplace,plugin}/`. The layer-level barrels (`domain/`, `edge/`, `orchestrators/`, `persistence/`, `transaction/`) were removed as unreachable from the extension entry point. Barrels are not universally used across every directory (check per-directory before assuming one exists).

---

*Convention analysis: 2026-08-07*
