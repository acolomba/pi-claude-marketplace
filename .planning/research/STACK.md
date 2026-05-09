# Stack Research

**Domain:** Pi coding-agent extension -- Claude plugin marketplace bridge (Node CLI / extension) **Researched:** 2026-05-09 **Confidence:** HIGH (versions verified against npm registry on 2026-05-09; ecosystem patterns verified against Context7 + official docs)

______________________________________________________________________

## Executive Verdict

**The V1 stack is fundamentally sound and should be carried forward almost verbatim.** It already lands on the 2026 ecosystem majority for every contested decision: `typebox` 1.x (not the legacy `@sinclair/typebox` 0.34.x), Node ≥22 with the built-in `node:test` runner via `tsx`, ESLint 10 flat config, and Prettier 3. The only meaningful "reconsider" items are:

1. **`tsx` becomes optional**, not mandatory -- Node 22.18+ ships native TypeScript stripping by default. Keep `tsx` only if the test entrypoints depend on it; otherwise drop it.
2. **`@mariozechner/pi-coding-agent` peer dep should pin a minimum** (NFR-11 acknowledges this). V1 declares `*` with development against `^0.70.6`; `0.73.1` is current latest. Recommend pinning `>=0.70.6` (or a successor-validated floor) once the surface stabilizes.
3. **Add `write-file-atomic` v8** as an explicit dependency for the `state.json` and any other JSON file writes. V1 hand-rolls tmp+rename via `fs-utils.ts`; `write-file-atomic@8` is purpose-built for this exact pattern, requires Node ≥22.22.2 (compatible with NFR-4), and handles the fsync + concurrent-write queue that V1 currently has to manage manually inside `withStateGuard`. The hand-rolled atomic-rename code in V1 should be evaluated for replacement on a per-call-site basis (some file writes -- e.g. agent `.md` files staged into `<scope>/agents/` -- may still want the bespoke same-FS rename to stay inside containment guards).

Schema-validation winner is unchanged: **`typebox` 1.x stays**. Zod 4 / Valibot / ArkType are excellent libraries but offer no advantage for this project and would force a peer-dep break (V1's `package.json` declares `typebox: *` as a peer dep -- a downstream contract).

______________________________________________________________________

## Recommended Stack

### Core Technologies

| Technology                        | Version                                               | Purpose                                                                                               | Why Recommended                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js**                       | `>=22` (recommend `>=22.18` for native TS strip)      | Runtime                                                                                               | NFR-4 mandates Node ≥22. `22.18+` enables type stripping by default (no `--experimental-strip-types` flag), which simplifies the test toolchain. **Carry forward from V1.**                                                                                                                                                                                                                                                                                     |
| **TypeScript**                    | `^5.9.3` (current `5.9.3`; `6.0.2` exists as preview) | Language                                                                                              | Strict-mode TS is required by NFR-7 for the discriminated `installable: true \| false` union. Stay on 5.9.x stable rather than chasing TS 6.x preview. **Carry forward from V1.**                                                                                                                                                                                                                                                                               |
| **typebox**                       | `^1.1.38` (V1 has `^1.1.34`)                          | Runtime schema validation, JSON Schema generation, discriminated unions                               | TypeBox 1.x is the current generation; `@sinclair/typebox` 0.34.x is in LTS bug-fix-only mode through 2026. JIT-compiled validators (`Schema.Compile`) are roughly on par with Ajv and significantly faster than Zod 4 for the manifest-validation hot path used by `list`. Native `Type.Union([...], { discriminator: 'kind' })` matches the discriminated-union shape NFR-7 requires. Already a peer dep in V1. **Carry forward from V1; bump to `^1.1.38`.** |
| **@mariozechner/pi-coding-agent** | `^0.73.1` (peer dep)                                  | Pi extension API host (LLM tool registration, `resources_discover`, `session_start`, `ctx.ui.notify`) | Required peer dep -- defines the extension contract. **Carry forward from V1; pin floor to addressed-NFR-11 minimum.**                                                                                                                                                                                                                                                                                                                                          |

### Supporting Libraries

| Library                                       | Version               | Purpose                                                                                       | When to Use                                                                                                                                                                                                                                   |
| --------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **write-file-atomic**                         | `^8.0.0`              | Atomic `state.json` and `mcp.json` writes (tmp + fsync + rename, with concurrent-write queue) | NEW -- recommended addition. Use for every JSON write that participates in `withStateGuard`. Engines: `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` (compatible with NFR-4). Replaces the hand-rolled portion of V1's `fs-utils.ts` for JSON writes. |
| **node:fs/promises** (built-in)               | bundled with Node ≥22 | Directory operations, agent `.md` writes, staging-dir manipulation                            | Use for non-JSON file ops where `write-file-atomic` adds no value (e.g. agent markdown writes that are already inside an atomic staging-dir rename), and for `fs.rename()` of pre-staged trees (NFR-1's "tmp + rename" path).                 |
| **node:crypto** (built-in)                    | bundled with Node ≥22 | SHA-256 truncation for `hash-<12hex>` plugin versions (PI-7)                                  | Already required by the PRD §11 PI-7 hash-version contract. No external dep needed.                                                                                                                                                           |
| **node:path / node:os / node:url** (built-in) | bundled with Node ≥22 | Path containment (NFR-10), home-dir resolution, file:// URL parsing                           | All built-ins. Use `path.relative()` + startsWith check inside `assertPathInside` (V1 pattern is correct).                                                                                                                                    |

### Development Tools

| Tool                                 | Version                      | Purpose                                            | Notes                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ---------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **eslint**                           | `^10.2.1` (current `10.3.0`) | Linting                                            | Flat config (`eslint.config.js`) is the only supported config style in v10. Config-file TypeScript (`.ts` extension) requires `jiti >= 2.2.0` as a transitive dep. **Carry forward from V1.**                                                                                  |
| **typescript-eslint**                | `^8.59.2`                    | TS linting rules                                   | Companion to ESLint; engines require `node: ^20.19.0 \|\| ^22.13.0 \|\| >=24` -- fits NFR-4. **Carry forward from V1.**                                                                                                                                                        |
| **@stylistic/eslint-plugin**         | `^5.10.0`                    | Stylistic rules separated from ESLint core         | Standard split since ESLint 9. **Carry forward from V1.**                                                                                                                                                                                                                      |
| **@eslint/js**                       | `^10.0.1`                    | ESLint recommended JS rules                        | Flat-config recommended preset. **Carry forward from V1.**                                                                                                                                                                                                                     |
| **eslint-plugin-import-x**           | `^4.16.2`                    | Import-order / no-cycle / extension rules          | Modern fork of `eslint-plugin-import` with first-class flat-config + ESM support. **Carry forward from V1.**                                                                                                                                                                   |
| **globals**                          | `^17.5.0` (current `17.6.0`) | Globals presets for ESLint flat config             | Required by typescript-eslint flat config. **Carry forward from V1.**                                                                                                                                                                                                          |
| **prettier**                         | `^3.6.2` (current `3.8.3`)   | Formatting                                         | Node ≥22 + ESM. **Carry forward from V1; bump to `^3.8.3`.**                                                                                                                                                                                                                   |
| **tsx**                              | `^4.21.0`                    | TS loader for tests under Node 22.7-22.17 (legacy) | RECONSIDER -- on Node 22.18+ this is no longer required; `node --test` strips TS natively. Keep only if you need to support a Node range below 22.18 in CI; otherwise drop and update the `test` script to `node --test` directly (no `--import tsx`). **Reconsider from V1.** |
| **node:test** (built-in test runner) | bundled with Node ≥22        | Test framework                                     | Stable since Node 20. Snapshots stable since 23.4.0; mocking, watch mode, coverage, custom reporters all supported. V1 already uses it; no need to switch to Vitest. **Carry forward from V1.**                                                                                |

______________________________________________________________________

## Installation

```bash
# Runtime peer deps (declared in package.json peerDependencies)
# These are NOT installed by the extension itself -- the host (pi-coding-agent) provides them.
# package.json snippet:
#   "peerDependencies": {
#     "@mariozechner/pi-coding-agent": ">=0.70.6",   # pin a floor (NFR-11)
#     "typebox": "^1.1.38"
#   }

# Direct runtime dependency (NEW recommendation)
npm install write-file-atomic@^8.0.0

# Dev dependencies (carry forward from V1, bumped where noted)
npm install -D \
  typescript@^5.9.3 \
  @mariozechner/pi-coding-agent@^0.73.1 \
  typebox@^1.1.38 \
  eslint@^10.3.0 \
  @eslint/js@^10.0.1 \
  typescript-eslint@^8.59.2 \
  @stylistic/eslint-plugin@^5.10.0 \
  eslint-plugin-import-x@^4.16.2 \
  globals@^17.6.0 \
  prettier@^3.8.3
# tsx -- only if supporting Node < 22.18 in CI:
#   npm install -D tsx@^4.21.0
```

______________________________________________________________________

## Alternatives Considered

| Recommended               | Alternative                                                    | When to Use Alternative                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **typebox 1.x**           | **Zod 4.x** (`zod@^4.4.3`)                                     | If you wanted the chainable fluent API and best DX for *application* schemas (forms, request bodies). Not appropriate here: V1's `peerDependencies` already declares `typebox` as the contract, and changing it is a breaking change for downstream consumers. Zod also has materially worse runtime performance on the manifest-validation hot path. |
| **typebox 1.x**           | **Valibot 1.4.x**                                              | If bundle size were the critical constraint (Valibot is ~1.4 kB gzipped tree-shaken vs Zod 14 kB / ArkType 40 kB). Not relevant for a Node CLI extension where bundle size is irrelevant.                                                                                                                                                             |
| **typebox 1.x**           | **ArkType 2.2.x**                                              | If you wanted the absolute fastest validator (ArkType ~3-4× faster than Zod). TypeBox JIT (`Schema.Compile`) is competitive with ArkType for the schemas at play here, and ArkType's TypeScript-syntax DSL is harder to introspect for the JSON-Schema-shaped operations the parser performs (NFR-12 forward-compat parser).                          |
| **node:test (built-in)**  | **Vitest 4.1.x**                                               | If you needed a watch-mode UI, in-source testing, or rich snapshot diffing. node:test's snapshot/mock surface is sufficient for this project's test taxonomy (state migration, atomic rollback, cascade ordering). Vitest would add a ~50 MB dev dep tree for marginal DX gain.                                                                       |
| **write-file-atomic 8.x** | **Hand-rolled `fs.writeFile(tmp) → fs.rename(tmp, dest)`**     | If you need behavior the lib doesn't offer -- e.g. atomic *directory tree* commit (V1's agent-staging dir rename). Use the lib for single-file JSON writes; keep the hand-rolled tree-rename for staging directories.                                                                                                                                 |
| **write-file-atomic 8.x** | **`@npmcli/write-file-atomic`**, **`atomically`**, **`steno`** | Each is viable; `write-file-atomic` is npm CLI's own dependency, has the largest install footprint, and is the de facto standard. Use the alternatives only if you hit a specific bug (none currently known).                                                                                                                                         |
| **tsx (only if needed)**  | **ts-node**, **swc-node**, **Bun**                             | `ts-node` is functionally legacy in 2026 -- `tsx` (esbuild-backed) replaced it for speed and ESM support. Bun is irrelevant -- Pi runs on Node.                                                                                                                                                                                                       |
| **ESLint 10 flat config** | **Biome**, **dprint+oxlint**                                   | Biome bundles formatter+linter and is fast, but ESLint's plugin ecosystem (especially `typescript-eslint`'s type-aware rules and `import-x`) is materially deeper. Pi's broader ecosystem also uses ESLint.                                                                                                                                           |

______________________________________________________________________

## What NOT to Use

| Avoid                                                                            | Why                                                                                                                                                                           | Use Instead                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@sinclair/typebox` 0.34.x (legacy package name)**                             | Bug-fix-only LTS through 2026; no new features. New API surface lives in `typebox` (no scope). V1 has already migrated -- do not regress.                                     | `typebox@^1.1.38`                                                                                                                                                                                                 |
| **CommonJS (`"type": "commonjs"` or no `type`)**                                 | TypeBox 1.x is ESM-only; `@mariozechner/pi-coding-agent` is ESM; Pi extensions ship as `.ts` files transpiled/stripped to ESM. CJS would force back to TypeBox 0.34.x LTS.    | `"type": "module"` (already V1)                                                                                                                                                                                   |
| **`fs.writeFileSync` for `state.json`**                                          | Not atomic -- power loss between truncate-and-write can leave a zero-byte or partially-written file, breaking the migration path on next load. NFR-1 explicitly forbids this. | `write-file-atomic` (async) or hand-rolled tmp+`fs.rename` on the same FS                                                                                                                                         |
| **`tsx` on Node 22.18+**                                                         | Native type stripping is the default; loading `tsx` adds startup cost and a dev dep that's no longer needed. Only keep if you must run on `<22.18`.                           | `node --test "tests/**/*.test.ts"` directly                                                                                                                                                                       |
| **`.eslintrc.cjs` / legacy ESLint config**                                       | Removed in ESLint 10. Flat config is the only supported format.                                                                                                               | `eslint.config.js` (already V1)                                                                                                                                                                                   |
| **Jest**                                                                         | Forked-process model is materially slower; ESM support has been pain-point for years; no real DX advantage over Vitest *or* node:test for this project.                       | `node:test` (V1's choice -- correct)                                                                                                                                                                              |
| **`fs-extra`**                                                                   | The features that justified it (recursive copy, JSON read/write helpers) all exist in `node:fs/promises` since Node 16. Adds a heavy dep tree for nothing.                    | `fs/promises` built-ins + `write-file-atomic` for JSON                                                                                                                                                            |
| **`semver` for hash-version comparison**                                         | The `hash-<12hex>` versions defined by PI-7 are not semver and must compare by exact-equality only. Pulling in `semver` invites accidental misuse.                            | Plain string equality + a `looksLikeHashVersion(v)` predicate                                                                                                                                                     |
| **`fs.cp({ recursive: true })` for committing staging trees across filesystems** | If staging dir and destination are on different filesystems, `rename` will EXDEV-fail. NFR-1's atomic guarantee requires same-FS.                                             | Place staging dirs on the same scope root (V1 already does -- `agents-staging/` lives under `<scope>/claude-marketplace/`); for any cross-FS ops, fall back to copy-then-fsync-then-unlink, never claim atomicity |
| **Lockfile commit policy: `package-lock.json` in `.gitignore`**                  | Even for libraries, committing the lockfile gives reproducible CI and contributor environments. The lockfile is *not* published to npm, so consumers are unaffected.          | `package-lock.json` committed (V1's current state -- correct)                                                                                                                                                     |
| **Telemetry libraries (Sentry, OpenTelemetry, posthog, etc.)**                   | IL-4 explicitly forbids telemetry in V1. Don't introduce any analytics dependency.                                                                                            | None                                                                                                                                                                                                              |
| **i18n libraries (i18next, formatjs, etc.)**                                     | IL-1 explicitly defers i18n to post-V1. The stable user-contract strings (PRD §6.12 ES-5) are English-only.                                                                   | None                                                                                                                                                                                                              |

______________________________________________________________________

## Stack Patterns by Decision Point

### Pattern: Discriminated unions for `installable: true \| false` (NFR-7)

**Use plain TypeScript discriminated unions, not TypeBox runtime unions, for the resolver result type.**

```typescript
// resolver result -- TS-only discriminated union (compile-time guard)
type ResolvedPlugin =
  | { installable: true;  pluginRoot: string; manifest: PluginManifest; /* ... */ }
  | { installable: false; reason: UninstallableReason; pluginRef: PluginRef; }

// Consumer code is exhaustively narrowed:
function install(plugin: ResolvedPlugin) {
  if (!plugin.installable) {
    notify(plugin.reason)         // OK: reason exists on the false branch
    // plugin.pluginRoot          // ERROR: does not exist on the false branch
    return
  }
  copy(plugin.pluginRoot, dest)   // OK: pluginRoot exists on the true branch
}

// Exhaustiveness assertion:
function assertNever(x: never): never { throw new Error(`unhandled: ${x as any}`) }
```

**Use TypeBox `Type.Union([...], { discriminator: 'kind' })` only for the runtime parsers** (manifest schema, marketplace.json, state.json), where you need both runtime validation and JSON-Schema output:

```typescript
import { Type } from 'typebox'

const GithubSource = Type.Object({
  kind: Type.Literal('github'),
  owner: Type.String(),
  repo: Type.String(),
  ref: Type.Optional(Type.String()),
})
const PathSource = Type.Object({
  kind: Type.Literal('path'),
  path: Type.String(),
})
const UnknownSource = Type.Object({
  kind: Type.Literal('unknown'),
  reason: Type.String(),
})
export const MarketplaceSource = Type.Union(
  [GithubSource, PathSource, UnknownSource],
  { discriminator: 'kind' },
)
```

The `discriminator` option emits JSON Schema 2020-12 `oneOf` (not `anyOf`), which is the correct semantics for a tagged union and gives you better error messages from `Schema.Errors()`.

### Pattern: Atomic file writes (NFR-1)

**Single-file JSON (state.json, mcp.json, agents-index.json):** use `write-file-atomic`.

```typescript
import { writeFile } from 'write-file-atomic'

// Inside withStateGuard -- caller has already verified mtime hasn't drifted.
await writeFile(stateJsonPath, JSON.stringify(state, null, 2), {
  encoding: 'utf8',
  fsync: true,           // default; explicit for clarity
  // chown / mode left default -- never inherit ownership from a privileged tmp file
})
```

**Multi-file staging dirs (agents-staging/, staging/skills/, staging/prompts/):** keep V1's pattern -- write everything into `agents-staging/`, then `fs.rename()` the whole directory onto its final name. `fs.rename` on the same filesystem is atomic per POSIX. Containment-check the destination with `assertPathInside` *before* rename.

### Pattern: Concurrent-write detection (`withStateGuard`)

V1's pattern (read state, capture mtime, run mutator, re-read-and-compare-mtime-before-commit) is the right approach for this project's concurrency model (cooperating extension instances, not a true multi-writer database). Keep it. Optionally, `write-file-atomic`'s built-in serialization queue gives you a second line of defense within a single process -- but it does NOT replace mtime-guarding, which protects against *cross-process* races (PRD §6.9 + acceptance test "withStateGuard sees writes that landed between caller's read and the closure").

### Pattern: Soft-degrade on missing companion extensions

Pure runtime probe via `pi.getAllTools()` -- no schema dep needed. V1's pattern is correct (see PRD §9.3). Stable warning strings live in a single module (`presentation/reload-hint.ts` or similar) so ES-5 contract strings can never drift.

### Pattern: Lockfile policy

**Commit `package-lock.json`** even though this package is published to npm. The lockfile is automatically excluded from the published tarball (it's in npm's default ignore list), so consumers are unaffected, while contributors and CI get reproducible installs. **Do NOT publish `package-lock.json` via `files`** in package.json.

______________________________________________________________________

## Version Compatibility Matrix

| Package                                 | Version                                         | Compatible With           | Notes                                                                                                            |
| --------------------------------------- | ----------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `node`                                  | `>=22.18` (recommended)                         | All listed deps           | `>=22.18` enables native TS strip; `>=22` (NFR-4 floor) requires `tsx` for `node --test` of `.ts` files          |
| `typebox@^1.1.38`                       | ESM-only                                        | Node ≥22                  | Will not load under `"type": "commonjs"`. V1 already on `"type": "module"`                                       |
| `write-file-atomic@^8.0.0`              | engines: `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` | Node 22.22.2+             | Bumps the V1 effective Node floor from 22.0 to 22.22.2 if adopted. Acceptable -- 22.22.x is current 22 LTS line. |
| `eslint@^10.x`                          | typescript-eslint `^8.59.2`                     | typescript `^5.9.x`       | typescript-eslint engines require `node: ^20.19.0 \|\| ^22.13.0 \|\| >=24` -- within NFR-4                       |
| `prettier@^3.8.x`                       | Node ≥14                                        | All listed deps           | No constraint                                                                                                    |
| `tsx@^4.21.0`                           | Node ≥18.4                                      | Optional after Node 22.18 | Keep if CI runs Node \<22.18                                                                                     |
| `@mariozechner/pi-coding-agent@^0.73.x` | engines: `>=20.6.0`                             | Node ≥22 (NFR-4)          | Floor is below ours -- no constraint                                                                             |

______________________________________________________________________

## What V1 Already Got Right (carry forward unchanged)

1. **`"type": "module"` + ESM-only** -- required by TypeBox 1.x and aligned with the rest of the Node ecosystem in 2026.
2. **`typebox: *` peer dep** (vs. depending on a specific version) -- correct: the host already brings TypeBox in, and pinning would cause version-conflict resolution headaches for users.
3. **`@mariozechner/pi-coding-agent` as peer dep** (not direct dep) -- correct: the host *is* the runtime. NFR-11 just notes the floor should be pinned, not that the relationship type should change.
4. **`node --import tsx --test`** -- was correct under Node ≤22.17; reconsider only because the toolchain has moved on.
5. **`npm run check = typecheck && lint && format:check && test`** quality gate -- exactly the right composition; no changes needed (NFR-6).
6. **Hand-rolled tmp+rename for staging directories** -- `write-file-atomic` is a single-file API; the directory-rename pattern V1 uses is the only correct approach for atomic multi-file commits.
7. **Eslint flat config with `import-x` + `@stylistic`** -- current 2026 standard.

______________________________________________________________________

## What V1 Should Reconsider

| V1 choice                                             | Successor recommendation                                                         | Reason                                                                                                                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `peerDependencies.@mariozechner/pi-coding-agent: "*"` | `">=0.70.6"` (or successor-floor TBD)                                            | NFR-11 already flags this. Pin the floor once the surface stabilizes. Unpinned `*` allows installs against breaking-change majors.                            |
| `tsx` as a hard dev dep                               | Drop if Node 22.18+ baseline; otherwise keep but document why                    | Native TS strip removes the need. Smaller dev tree, faster `npm install`.                                                                                     |
| Hand-rolled JSON atomic write inside `fs-utils.ts`    | Adopt `write-file-atomic@^8` for `state.json` / `mcp.json` / `agents-index.json` | Off-the-shelf, audited, handles fsync + concurrent-write queue. Reduces V1 code to maintain. Keep V1's tree-rename code for staging dirs (different problem). |
| `typebox: ^1.1.34` (V1 dev)                           | `^1.1.38`                                                                        | Routine bump; same minor line, no API changes.                                                                                                                |
| `prettier: ^3.6.2`                                    | `^3.8.3`                                                                         | Routine bump; no breaking changes in 3.x.                                                                                                                     |
| `globals: ^17.5.0`                                    | `^17.6.0`                                                                        | Routine bump.                                                                                                                                                 |
| Keep CJS-compatible code paths "just in case"         | Commit fully to ESM-only                                                         | TypeBox 1.x forces this anyway; ESM-only simplifies the build matrix.                                                                                         |

______________________________________________________________________

## Sources

### Authoritative (HIGH confidence)

- npm registry, queried 2026-05-09 via `npm view`:
  - `typebox@1.1.38` (released 2026-05-06)
  - `@sinclair/typebox@0.34.49` (released 2026-03-28; LTS bug-fix-only line)
  - `vitest@4.1.5` (released 2026-05-05; not adopted but verified)
  - `write-file-atomic@8.0.0` -- engines `^22.22.2 || ^24.15.0 || >=26.0.0`
  - `zod@4.4.3` / `valibot@1.4.0` / `arktype@2.2.0` (verified for comparison)
  - `eslint@10.3.0`, `typescript-eslint@8.59.2`, `prettier@3.8.3`, `tsx@4.21.0`, `globals@17.6.0`
  - `@mariozechner/pi-coding-agent@0.73.1` (engines `>=20.6.0`; updated 2026-05-07)
- Context7 `/sinclairzx81/typebox` -- verified TypeBox 1.x JIT compile API (`Schema.Compile`), `Type.Union([...], { discriminator })`, ESM-only, JSON Schema 2020-12 output.
- Context7 `/vitest-dev/vitest` -- verified Node 22.18+ native TS strip is now the default, no `--experimental-strip-types` required.
- Context7 `/microsoft/typescript` -- verified discriminated-union exhaustiveness via `assertNever(x: never)` is the canonical pattern.
- Official Node.js docs -- [nodejs.org/api/test.html](https://nodejs.org/api/test.html) -- confirmed node:test stable since 20, snapshots stable since 23.4.0, mocking + watch mode + coverage all supported.
- Official Node.js docs -- [nodejs.org/api/typescript.html](https://nodejs.org/api/typescript.html) -- confirmed type stripping default in Node 22.18+ / 23.6+; `--experimental-strip-types` removed in Node 26.
- Official ESLint docs -- [eslint.org/docs/latest/use/configure/configuration-files](https://eslint.org/docs/latest/use/configure/configuration-files) -- flat config is the only supported format in v10.
- TypeBox repo migration notes -- confirmed `@sinclair/typebox` 0.34 → `typebox` 1.0 package rename, 0.x in bug-fix-only LTS through 2026.
- npm write-file-atomic -- [github.com/npm/write-file-atomic](https://github.com/npm/write-file-atomic) -- confirmed Promise-native API, fsync-by-default, concurrent-write serialization queue.

### Cross-referencing (MEDIUM confidence -- used for ecosystem signal, not load-bearing claims)

- Schema-validation benchmarks ([schemabenchmarks.dev](https://schemabenchmarks.dev), [valibot.dev/guides/comparison](https://valibot.dev/guides/comparison)) -- TypeBox JIT competitive with ArkType; both ~3-4× faster than Zod 4.
- ["Should You Use Node's Built-In Test Runner in 2026?" comparison roundups](https://www.pkgpulse.com/blog/node-test-vs-vitest-vs-jest-native-test-runner-2026) -- context only; primary source is Node official docs above.
- npm docs -- [package-lock.json](https://docs.npmjs.com/cli/v9/configuring-npm/package-lock-json/) -- lockfile commit policy.
- val.town blog post ["Zod is amazing. Here's why we're also using TypeBox"](https://blog.val.town/blog/typebox/) -- secondary support for TypeBox-for-validation choice.

______________________________________________________________________

*Stack research for: Pi extension bridging Claude plugin marketplaces* *Researched: 2026-05-09*
