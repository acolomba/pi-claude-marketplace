# Coding Conventions

**Analysis Date:** 2026-08-18

## Naming Patterns

**Files:**

- `kebab-case.ts` throughout (`atomic-json.ts`, `git-failure-classifiers.ts`, `notify-context.ts`)
- Suffix conventions signal role: `*-fake.ts` (reusable concern-owned test doubles, such as `tests/platform/git-ops-fake.ts`), `*.test.ts` (tests), `errors.ts` / `errors-bridges.ts` (typed error classes grouped by layer)

**Functions:**

- `camelCase`, verb-first (`atomicWriteJson`, `findProviderForHost`, `loadMarketplaceManifestUncached`)
- Local configurable doubles use production-role factory names (`createCredentialOps`, `createGitOps`, `createDeviceFlowHttp`); reusable concern-owned abstractions retain explicit `create*Fake` names (`createCredentialOpsFake`, `createGitOpsFake`, `createDeviceFlowFake`)
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

- ESLint 10 flat config: `eslint.config.js` at repo root (`npm run lint` runs `eslint extensions tests scripts eslint.config.js --max-warnings 0` with a content cache, so any warning fails it)
- Extends `tseslint.configs.strictTypeChecked` + `stylisticTypeChecked` (full type-aware strict linting)
- Plugins: `@stylistic`, `import-x`, `sonarjs`
- Key rules:
  - `no-console: "warn"` (console output is discouraged; see IL-2/IL-3 in project constraints), and off for `extensions/pi-claude-marketplace/**`, where the fallow rule pack bans console calls
  - `@typescript-eslint/no-unused-vars`: error, with `^_` ignore pattern for args/vars/caught errors
  - `@typescript-eslint/explicit-module-boundary-types: "error"` — all exported functions must declare return types
  - `@typescript-eslint/array-type: "off"` and `restrict-template-expressions: "off"` — deliberately not enforced (either `T[]` or `Array<T>` is fine; numeric template interpolation is fine)
  - `sonarjs/cognitive-complexity: ["error", 15]` (`eslint.config.js:77`) — turned `"off"` only for a narrow set of blocks (e.g. line 317)
  - `sonarjs/no-identical-functions`, `no-inverted-boolean-check`, `no-nested-conditional`, `no-nested-template-literals`: all error
  - `curly: ["error", "all"]` — braces always required
  - `@stylistic/padding-line-between-statements`: blank line required after every block-like statement
  - `prefer-object-has-own: "error"`
- **Sonar rules have separate production and test policies.** The production block spreads `sonarjs.configs.recommended.rules` over `extensions/pi-claude-marketplace/**/*.ts`, then reasserts the cognitive-complexity ceiling of 15. Spread the rules rather than extending the preset: the preset redeclares the plugin and has no file scope. Tests additionally enable `assertions-in-tests`, `no-empty-test-file`, and `no-trivial-assertions` at error. Seven exact type-only owners are exempt only from `no-empty-test-file`; their compiler proofs remain required. Five explained call-site exceptions preserve strict-mock verification and dynamic contract assertions that Sonar cannot follow. The [measured test policy](../phases/02-sonar-rules-for-tests/02-SONAR-POLICY.md) records all remaining cluster dispositions; the full recommended preset is not enabled for tests.
- **Extension-scoped output discipline** lives in the fallow rule pack (`rule-packs/architecture.json`, see the Fallow section): `no-stdio`, `no-console` with its two companion rules, and `notify-chokepoint` (IL-2/IL-3). Inside the extension, ESLint sets `no-restricted-syntax` and `no-restricted-imports` only in BLOCK F, the NFR-5 rule.
- Ignored paths: `.claude/`, `.opencode/`, `.pi/`, `.planning/`, `build/`, `coverage/`, `dist/`, `node_modules/`, `tmp/`, `tests/live-uat/` (standalone `.mjs` UAT drivers excluded from typed tree)

**Fallow (whole-graph static analysis) — a second, independent complexity/duplication/dead-code gate:**

- `.fallowrc.json` at repo root; entry point `extensions/pi-claude-marketplace/index.ts`; `production: false`
- `npm run fallow` first runs `fallow rule-pack test` and fails on a rule-pack `WARN` (see the `rulePacks` bullet), then runs four sub-gates in sequence, each `--fail-on-issues`: `fallow dead-code`, `fallow dead-code --no-production --circular-deps --re-export-cycles`, `fallow health`, `fallow dupes`. The second dead-code run exists because `production.deadCode` scopes the first one to the production entry graph, which leaves a cycle under `tests/` or `scripts/` reported by nothing; it stays filtered to the two cycle classes because a bare `--no-production` run also re-reads the production-mode suppressions as stale
- `npm run check` is `check:static` (`typecheck`, `lint`, `lint:workflows`, `fallow`, `format:check`, and `test:corresponding`, run in parallel by `scripts/run-parallel.mjs`), then `test:unpaired`, `test:integration`, and `test:coverage:direct:all` — **fallow is a mandatory member of the check chain, not an optional extra.** Always mention it when describing "the gate." The pre-commit hook runs `check:commit`: `check:static`, `test:unpaired`, and direct coverage for the staged pairs only.
- `health` thresholds: `maxCyclomatic: 20`, `maxCognitive: 15`, `maxCrap: 0`. **`maxCrap: 0` means CRAP is OFF, not maximally strict** -- delete the line and fallow falls back to its own default of 30, scores CRAP from a `static_estimated` coverage model, and reports 950 findings on a clean tree (measured on fallow 3.27.0). It must stay. **This is a second, independently-computed cognitive-complexity ceiling layered on top of ESLint's `sonarjs/cognitive-complexity: 15`** — the two tools use different algorithms and do not agree on a given function's score. A function can pass one and fail the other; both gates must be satisfied. Currently there are **zero** `health.thresholdOverrides` entries in `.fallowrc.json` — no function has an approved exception.
- `boundaries.zones` (14 zones: entry, edge, orchestrators, bridges-agents, bridges-commands, bridges-mcp, bridges-skills, bridges-hooks, bridges-workflows, domain, transaction, persistence, platform, shared) is a **finer-grained** architecture-boundary gate than ESLint's `import-x/no-restricted-paths` (which only distinguishes the coarser `bridges` as one zone). It is the only mechanism that forbids one bridge kind from importing a sibling bridge kind (e.g. `bridges-skills` importing `bridges-agents`).
- `rulePacks` loads `rule-packs/architecture.json`. Its rules cover `extensions/pi-claude-marketplace/**` only and report as `policy-violation`, an error, in the first `fallow dead-code` run: `no-stdio` (IL-2, no exemption); `no-console` (IL-2), which leaves out `persistence/migrate.ts` and `shared/debug-log.ts`, whose companion rules `migrate-console-warn-only` (IL-3) and `debug-log-console-error-only` (OBS-01) ban every other console method there; `notify-chokepoint` (IL-2, all but `shared/notification-dispatch.ts`); `pi-peer-chokepoint` (NFR-11, all but `platform/pi-api.ts`); `isomorphic-git-chokepoint` (D-13, all but `platform/git.ts`); `proper-lockfile-chokepoint` (D-06, all but `transaction/with-state-guard.ts`); `write-file-atomic-chokepoint` (NFR-1, all but `shared/atomic-json.ts` and three rollback paths that restore saved bytes: `bridges/agents/stage.ts`, `bridges/mcp/stage.ts`, `orchestrators/plugin/prune-rollback.ts`); `no-network-modules` (IL-4 / NFR-5, no exemption); and `fetch-chokepoint` (IL-4 / NFR-5, `fetch` and `globalThis.fetch`, all but `domain/github-auth.ts`). Measured on fallow 3.27.0: `banned-import` sees static imports, re-exports, and `import("x").T` type references, but not a dynamic `import()`. `banned-call` sees call sites only, follows import aliases, and reports one finding per callee per file. A rule whose `files` globs match no analyzed file only logs a `WARN` and passes, so `npm run fallow` first runs `fallow rule-pack test` and fails on any `WARN` line that names a rule pack. That check reads fallow's message text: after a fallow upgrade, point one companion rule at a missing file and confirm that `npm run fallow` fails.
- `duplicates.threshold: 3`; `duplicates.ignoredClones` currently holds exactly one entry (`dup:cc950b18:2`) — the retained clone lives in `tests/live-uat/manifest-absence-canary.mjs` and `tests/live-uat/stop-canary.mjs`, and it is justified with an inline comment header in **both** files (fallow's `ignoredClones` is typed `string[]`, so the per-clone justification cannot live in the JSON and lives in the source instead). **Fingerprint keys are content-addressed (`dup:<hash>`) and stable; do not use the index-suffixed `dup:<hash>-NN` form anywhere — it is not stable across runs.**
- Suppressions: exactly **11** `fallow-ignore` markers exist repo-wide as of this analysis (verify with `rg -n "fallow-ignore" extensions tests scripts`). Ten are scoped to `unused-type`/`unused-export`/`private-type-leak`/`unused-file`: two standalone operator-run UAT drivers, seven compile-time proof/pin types, and one published compatibility type. The remaining marker is a temporary, function-scoped complexity exception on `validateScopeChangeStructure` in `scripts/revalidation.mjs`; its inline comment records the removal target. No duplication finding is suppressed.
- The Lint workflow's `fallow-audit` job gates pull requests on newly introduced findings only. It installs the npm dependencies first, and it fails on a `warn` verdict (a clone group the change adds) or a degraded analysis as well as on `fail`. It is distinct from the full `npm run fallow` gate.
- **A gate's run over the real tree is its only committed proof.** Do not commit negative controls or planted-violation tests for a gate; `npm run check` is the only full verdict. The D-11 ledger-import rule and the NFR-5 network-free rule are ESLint rules that report at the offending line: BLOCK C in `eslint.config.js` carries the layer and ledger zones (`PLUGIN_LEDGERS`, `MARKETPLACE_LEDGERS`), and BLOCK F carries the default-deny network-free rules over every `orchestrators/` and `domain/` module outside `NETWORK_SEAMS`.

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
- Type-only imports (`import type { ... }`) are grouped separately and placed last — see `tests/shared/atomic-json.test.ts` and `tests/platform/git-ops-fake.ts` for the pattern:
  ```ts
  import assert from "node:assert/strict";
  import test from "node:test";

  import { atomicWriteJson } from "../../extensions/pi-claude-marketplace/shared/atomic-json.ts";
  ```
- Test files import production modules with explicit `.ts` extensions (ESM-native resolution, no build step for tests)
- Reusable test fakes use **type-only** imports when they need only production contracts, which avoids pulling production modules into pure support files (see `tests/platform/git-ops-fake.ts`)

**Path Aliases:**

- None detected — imports use relative paths (`../../extensions/pi-claude-marketplace/...`)

## Error Handling

**Pattern: typed error classes, one per failure mode**

All domain errors live in `extensions/pi-claude-marketplace/shared/errors.ts` (bridge-specific errors in `errors-bridges.ts`, path errors in `path-safety.ts`). Every error:

- `extends Error`
- Sets `this.name = "<ClassName>"` in the constructor (so `error.name` matches the class name even after minification/transpilation)
- Carries typed, readonly public fields for structured data callers need (never encode structured data only in the message string)
- Has a doc comment citing the requirement/decision ID it implements (e.g. `MA-6`, `D-48-A`, `ATTR-07`)

Example (`extensions/pi-claude-marketplace/shared/errors.ts`, `StaleSourceCloneError`):

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

Errors that wrap an underlying cause pass `{ cause }` through the `Error` constructor's second argument rather than swallowing or re-stringifying it (`MarketplaceUpdateError`, `extensions/pi-claude-marketplace/shared/errors.ts`).

**Discrimination:** callers narrow on `instanceof`, never on message substring matching or `error.name` string comparison (per the `InvalidMarketplaceManifestError` doc comment in `extensions/pi-claude-marketplace/shared/errors.ts`, which explicitly replaced legacy `SyntaxError`/substring-matched failures with a typed class).

**Optional fields:** constructors accept `opts?: { cause?: unknown; retryHint?: string }`-shaped option bags for errors with more than 2 optional fields, rather than long positional parameter lists.

## Logging

**Framework:** No logging library. Inside the extension, the fallow rule `architecture/no-console` bans every `console.*` call except two: the `console.warn` for a load-time legacy-migration save failure in `persistence/migrate.ts` (IL-3) and the env-gated `console.error` in `shared/debug-log.ts` (OBS-01). Companion rules hold each of those files to its one method. Elsewhere, `no-console` is `"warn"` for `scripts/` and `eslint.config.js` (tests turn it off), and a warning fails `npm run lint`.

**User-visible output:** All output goes through `ctx.ui.notify(message, severity)` inside `extensions/pi-claude-marketplace/shared/notification-dispatch.ts` — the sole sanctioned call site — fed by `notification-types.ts`, `notification-grammar.ts`, `notification-summary.ts`, `notify-context.ts`, and `notify-reasons.ts`. Direct `process.stdout`/`process.stderr` calls are forbidden inside `extensions/pi-claude-marketplace/**` by one gate, the fallow rule `architecture/no-stdio`, which has no exemption. A direct `ctx.ui.notify` call outside `shared/notification-dispatch.ts` trips `architecture/notify-chokepoint`.

## Comments

**When to Comment:**

- Non-obvious "why", not "what" — see `.claude/rules/typescript-comments.md`
- Comments and test titles cite durable spec IDs (`D-NN`, `NFR-N`, `PRL-NN`, `MA-N`, `ATTR-NN`, etc.) as traceability anchors, not GSD process artifacts (no `Phase NN`, `Plan NN`, `Wave N`, `Pitfall N` references — these rot as planning docs are archived)
- File-level or class-level JSDoc-style block comments explain rationale, cross-references to sibling files, and behavior contracts (see `tests/platform/git-ops-fake.ts`, and `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts` describing why the module exists where it does and the import invariant that keeps a cycle from reforming)

**JSDoc/TSDoc:**

- Used selectively above exported classes/functions with non-obvious behavior; not required on every export
- Format: `/** ... */` block above the declaration, often citing the implementing requirement ID inline

## Function Design

**Size:** Bounded by **two independently-computed complexity gates**: ESLint's `sonarjs/cognitive-complexity: 15` and fallow's `health.maxCognitive: 15` / `health.maxCyclomatic: 20`. The two tools disagree on a given function's cognitive-complexity score (different algorithms), so a function must pass both independently — do not treat a green ESLint run as proof fallow will also be green, or vice versa. Keep functions small and flat; avoid nested conditionals (`sonarjs/no-nested-conditional` is also an ESLint error).

**Parameters:** Prefer explicit positional parameters for 1-3 required values; switch to an `opts` object for anything with optional/named fields (see `MarketplaceUpdateError` constructor above).

**Return Values:** All exported functions must have explicit return type annotations (`@typescript-eslint/explicit-module-boundary-types: "error"`).

**Dependency injection over test-only seams:** when a function needs to be testable against a side-effecting dependency (subprocess spawn, git ops, credential store), pass that dependency in as a parameter — making it part of the function's public interface — rather than exposing a `_setXForTest`-style module-global seam that reaches inside the module from a test. If testing a unit is hard without such a seam, treat that difficulty as a signal the dependency wants to be an explicit collaborator (its own module/interface), not a reason to punch a test-only hole in the production module. `extensions/pi-claude-marketplace/bridges/hooks/routing-state.ts` is the worked example of extracting shared state into its own leaf module specifically so the modules that need it can take it as an explicit import rather than reaching into a hub module's internals; the same principle applies to role-named local factories such as `createGitOps` and reusable concern-owned abstractions such as `createGitOpsFake`, which are passed as constructor or function arguments and never patched onto a shared global.

## Module Design

**Directory layers** under `extensions/pi-claude-marketplace/`: `domain/`, `orchestrators/`, `bridges/`, `edge/`, `platform/`, `persistence/`, `transaction/`, `shared/` (see ARCHITECTURE.md/STRUCTURE.md for layering rules).

**Exports:** Named exports only observed — no default exports in sampled files.

**Barrel Files:** Barrels exist per bridge kind (`bridges/<kind>/index.ts`, all five) and at `orchestrators/import/index.ts`. The aggregate `bridges/index.ts`, the `orchestrators/{marketplace,plugin}/` barrels, and the layer-level barrels (`domain/`, `edge/`, `orchestrators/`, `persistence/`, `transaction/`) were all removed as unreachable from the extension entry point. Barrels are not universally used across every directory (check per-directory before assuming one exists).

---

_Convention analysis: 2026-08-18_
