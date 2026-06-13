# pi-claude-marketplace

## Guidelines

### Git

- NEVER commit to the main branch.
- Branch names: `main`, `features/*`, `releases/*`. New feature branches use `features/<name>`.
- Worktrees are preferred for new feature work; create them under `.worktrees/`.
- Git commit messages: Follow the [Conventional Commits specification](https://www.conventionalcommits.org/en/v1.0.0/#specification). Titles must be at least 5 characters and no more than 72 characters. Body lines must be no more than 80 characters.
- Run `pre-commit run --all-files` (or `pre-commit run --files <changed files>`) **before** attempting `git commit`. Fix any failures, restage, and re-run until clean. Do not commit and recover from hook failures after the fact -- a failed pre-commit hook means the commit did NOT happen, so iterating with `--amend` is wrong (it would alter the previous commit).
- NEVER use `--no-verify` to skip the hooks.
- When committing from inside a worktree, prefix the commit with `SKIP=trufflehog`. The trufflehog hook's auto-updater fails to spawn child processes under the worktree sandbox even though the underlying scan succeeds; running `pre-commit run trufflehog --all-files` separately (outside `git commit`) still passes and should be done before the commit to confirm the scan is clean. Do not extend `SKIP=` to other hooks.
- When writing PR descriptions, use the `humanizer` skill if available.
- Always use `--squash` when merging PRs (`gh pr merge --squash`). The repository does not allow merge commits or rebase merges.

### Versioning

Before creating a PR, offer to bump the version in `package.json` and `sonar-project.properties`, update `package-lock.json`, and succintly record changes in `CHANGELOG.md`.

<!-- GSD:project-start source:PROJECT.md -->

## Project

`pi-claude-marketplace` is a Pi extension that gives Pi users access to Claude plugin marketplaces through a `/claude:plugin` command surface intentionally aligned with Claude Code's upstream `/plugin`. It translates Claude plugin artefacts (skills, commands, agents, MCP servers) into the equivalent Pi-native artefacts (Pi skills, Pi prompt templates, pi-subagents agents, pi-mcp-adapter MCP entries) and manages their lifecycle (install, update, uninstall, marketplace add/remove/list).

This GSD project plans a successor architecture for the V1 implementation already in this repository. The PRD at `docs/prd/pi-claude-marketplace-prd.md` (1068 lines, v1.0) is derived from the V1 source and is the authoritative specification of what the successor must deliver.

**Core Value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after `/reload`, have every supported Claude plugin component appear as a working Pi-native artefact -- atomically, recoverably, and with soft-dependency degradation that never blocks the install.

### Constraints

- **Runtime:** Node >= 20.19.0 (NFR-4)
- **Tech stack:** TypeScript strict; the resolver MUST expose discriminated `installable: true | false` so consumers cannot read `pluginRoot` from a non-installable plugin (NFR-7)
- **Pi API:** `@mariozechner/pi-coding-agent` peer dependency, currently `*` with development against `^0.70.6`; pinning a min version is a successor SHOULD (NFR-11)
- **File operations:** All disk mutations atomic (tmp + rename or atomic JSON write) -- NFR-1
- **Recovery model:** No fix may require a Pi process restart; `Run /reload` must suffice (NFR-2). All operations must be safe to retry -- idempotent or fail-clean (NFR-3)
- **Network policy:** Network is required only for GitHub-source `marketplace add` and for `update`/`marketplace update` against GitHub-source marketplaces; `install`, `list`, `uninstall`, `marketplace remove`, and path-source `marketplace add` MUST NOT touch the network (NFR-5)
- **Containment:** Refuse to write outside `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, `<scopeRoot>/mcp.json`, `<scopeRoot>/claude-plugins.json`, or `<scopeRoot>/claude-plugins.local.json` (NFR-10)
- **Quality bar:** `npm run check` must stay green -- typecheck + ESLint + Prettier + tests (NFR-6)
- **Output channel:** All user-visible messages MUST go through `ctx.ui.notify(message, severity)`; direct `process.stdout`/`process.stderr` writes forbidden in command/bridge code (IL-2). Single sanctioned `console.warn` is the load-time legacy migration save failure (IL-3)
- **No telemetry V1:** No metrics, no event sink, no analytics endpoint (IL-4)
- **English only V1:** No message catalog, no locale negotiation (IL-1)
- **Scope model:** Exactly two scopes -- `user` (Pi agent dir; defaults to `~/.pi/agent/` and honors `PI_CODING_AGENT_DIR`) and `project` (`<cwd>/.pi/`). Claude Code's `local` scope is not introduced (SC-1)

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Executive Verdict

## Recommended Stack

### Core Technologies

| Technology                        | Version                                               | Purpose                                                                                               | Why Recommended                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Node.js**                       | `>=20.19.0` (recommend `>=22.18` for native TS strip) | Runtime                                                                                               | NFR-4 mandates Node >= 20.19.0. `22.18+` enables type stripping by default (no `--experimental-strip-types` flag), which simplifies the test toolchain. **Carry forward from V1.**                                                                                                                                                                                                                                                                              |
| **TypeScript**                    | `^5.9.3` (current `5.9.3`; `6.0.2` exists as preview) | Language                                                                                              | Strict-mode TS is required by NFR-7 for the discriminated `installable: true \| false` union. Stay on 5.9.x stable rather than chasing TS 6.x preview. **Carry forward from V1.**                                                                                                                                                                                                                                                                               |
| **typebox**                       | `^1.1.38` (V1 has `^1.1.34`)                          | Runtime schema validation, JSON Schema generation, discriminated unions                               | TypeBox 1.x is the current generation; `@sinclair/typebox` 0.34.x is in LTS bug-fix-only mode through 2026. JIT-compiled validators (`Schema.Compile`) are roughly on par with Ajv and significantly faster than Zod 4 for the manifest-validation hot path used by `list`. Native `Type.Union([...], { discriminator: 'kind' })` matches the discriminated-union shape NFR-7 requires. Already a peer dep in V1. **Carry forward from V1; bump to `^1.1.38`.** |
| **@mariozechner/pi-coding-agent** | `^0.73.1` (peer dep)                                  | Pi extension API host (LLM tool registration, `resources_discover`, `session_start`, `ctx.ui.notify`) | Required peer dep -- defines the extension contract. **Carry forward from V1; pin floor to addressed-NFR-11 minimum.**                                                                                                                                                                                                                                                                                                                                          |

### Supporting Libraries

| Library                                       | Version                      | Purpose                                                                                       | When to Use                                                                                                                                                                                                                                   |
| --------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **write-file-atomic**                         | `^8.0.0`                     | Atomic `state.json` and `mcp.json` writes (tmp + fsync + rename, with concurrent-write queue) | NEW -- recommended addition. Use for every JSON write that participates in `withStateGuard`. Engines: `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` (compatible with NFR-4). Replaces the hand-rolled portion of V1's `fs-utils.ts` for JSON writes. |
| **node:fs/promises** (built-in)               | bundled with Node >= 20.19.0 | Directory operations, agent `.md` writes, staging-dir manipulation                            | Use for non-JSON file ops where `write-file-atomic` adds no value (e.g. agent markdown writes that are already inside an atomic staging-dir rename), and for `fs.rename()` of pre-staged trees (NFR-1's "tmp + rename" path).                 |
| **node:crypto** (built-in)                    | bundled with Node >= 20.19.0 | SHA-256 truncation for `hash-<12hex>` plugin versions (PI-7)                                  | Already required by the PRD §11 PI-7 hash-version contract. No external dep needed.                                                                                                                                                           |
| **node:path / node:os / node:url** (built-in) | bundled with Node >= 20.19.0 | Path containment (NFR-10), home-dir resolution, file:// URL parsing                           | All built-ins. Use `path.relative()` + startsWith check inside `assertPathInside` (V1 pattern is correct).                                                                                                                                    |

### Development Tools

| Tool                                 | Version                      | Purpose                                            | Notes                                                                                                                                                                                                                                                                          |
| ------------------------------------ | ---------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **eslint**                           | `^10.2.1` (current `10.3.0`) | Linting                                            | Flat config (`eslint.config.js`) is the only supported config style in v10. Config-file TypeScript (`.ts` extension) requires `jiti >= 2.2.0` as a transitive dep. **Carry forward from V1.**                                                                                  |
| **typescript-eslint**                | `^8.59.2`                    | TS linting rules                                   | Companion to ESLint; engines require `node: ^20.19.0 \|\| ^22.13.0 \|\| >=24` -- fits NFR-4. **Carry forward from V1.**                                                                                                                                                        |
| **@stylistic/eslint-plugin**         | `^5.10.0`                    | Stylistic rules separated from ESLint core         | Standard split since ESLint 9. **Carry forward from V1.**                                                                                                                                                                                                                      |
| **@eslint/js**                       | `^10.0.1`                    | ESLint recommended JS rules                        | Flat-config recommended preset. **Carry forward from V1.**                                                                                                                                                                                                                     |
| **eslint-plugin-import-x**           | `^4.16.2`                    | Import-order / no-cycle / extension rules          | Modern fork of `eslint-plugin-import` with first-class flat-config + ESM support. **Carry forward from V1.**                                                                                                                                                                   |
| **globals**                          | `^17.5.0` (current `17.6.0`) | Globals presets for ESLint flat config             | Required by typescript-eslint flat config. **Carry forward from V1.**                                                                                                                                                                                                          |
| **prettier**                         | `^3.6.2` (current `3.8.3`)   | Formatting                                         | Node >= 20.19.0 + ESM. **Carry forward from V1; bump to `^3.8.3`.**                                                                                                                                                                                                            |
| **tsx**                              | `^4.21.0`                    | TS loader for tests under Node 22.7-22.17 (legacy) | RECONSIDER -- on Node 22.18+ this is no longer required; `node --test` strips TS natively. Keep only if you need to support a Node range below 22.18 in CI; otherwise drop and update the `test` script to `node --test` directly (no `--import tsx`). **Reconsider from V1.** |
| **node:test** (built-in test runner) | bundled with Node >= 20.19.0 | Test framework                                     | Stable since Node 20. Snapshots stable since 23.4.0; mocking, watch mode, coverage, custom reporters all supported. V1 already uses it; no need to switch to Vitest. **Carry forward from V1.**                                                                                |

## Installation

```bash
# Runtime peer deps (declared in package.json peerDependencies)
# These are NOT installed by the extension itself -- the host (pi-coding-agent) provides them.
#
# package.json snippet:
#   "peerDependencies": {
#     "@mariozechner/pi-coding-agent": ">=0.70.6",  # pin a floor (NFR-11)
#     "typebox": "^1.1.38"
#   }

# Direct runtime dependency (NEW recommendation)

# Dev dependencies (carry forward from V1, bumped where noted)

# tsx -- only if supporting Node < 22.18 in CI:
npm install -D tsx@^4.21.0
```

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

## What NOT to Use

| Avoid                                                                            | Why                                                                                                                                                                           | Use Instead                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@sinclair/typebox` 0.34.x (legacy package name)**                             | Bug-fix-only LTS through 2026; no new features. New API surface lives in `typebox` (no scope). V1 has already migrated -- do not regress.                                     | `typebox@^1.1.38`                                                                                                                                                                                                    |
| **CommonJS (`"type": "commonjs"` or no `type`)**                                 | TypeBox 1.x is ESM-only; `@mariozechner/pi-coding-agent` is ESM; Pi extensions ship as `.ts` files transpiled/stripped to ESM. CJS would force back to TypeBox 0.34.x LTS.    | `"type": "module"` (already V1)                                                                                                                                                                                      |
| **`fs.writeFileSync` for `state.json`**                                          | Not atomic -- power loss between truncate-and-write can leave a zero-byte or partially-written file, breaking the migration path on next load. NFR-1 explicitly forbids this. | `write-file-atomic` (async) or hand-rolled tmp+`fs.rename` on the same FS                                                                                                                                            |
| **`tsx` on Node 22.18+**                                                         | Native type stripping is the default; loading `tsx` adds startup cost and a dev dep that's no longer needed. Only keep if you must run on `<22.18`.                           | `node --test "tests/**/*.test.ts"` directly                                                                                                                                                                          |
| **`.eslintrc.cjs` / legacy ESLint config**                                       | Removed in ESLint 10. Flat config is the only supported format.                                                                                                               | `eslint.config.js` (already V1)                                                                                                                                                                                      |
| **Jest**                                                                         | Forked-process model is materially slower; ESM support has been pain-point for years; no real DX advantage over Vitest *or* node:test for this project.                       | `node:test` (V1's choice -- correct)                                                                                                                                                                                 |
| **`fs-extra`**                                                                   | The features that justified it (recursive copy, JSON read/write helpers) all exist in `node:fs/promises` since Node 16. Adds a heavy dep tree for nothing.                    | `fs/promises` built-ins + `write-file-atomic` for JSON                                                                                                                                                               |
| **`semver` for hash-version comparison**                                         | The `hash-<12hex>` versions defined by PI-7 are not semver and must compare by exact-equality only. Pulling in `semver` invites accidental misuse.                            | Plain string equality + a `looksLikeHashVersion(v)` predicate                                                                                                                                                        |
| **`fs.cp({ recursive: true })` for committing staging trees across filesystems** | If staging dir and destination are on different filesystems, `rename` will EXDEV-fail. NFR-1's atomic guarantee requires same-FS.                                             | Place staging dirs on the same scope root (V1 already does -- `agents-staging/` lives under `<scope>/pi-claude-marketplace/`); for any cross-FS ops, fall back to copy-then-fsync-then-unlink, never claim atomicity |
| **Lockfile commit policy: `package-lock.json` in `.gitignore`**                  | Even for libraries, committing the lockfile gives reproducible CI and contributor environments. The lockfile is *not* published to npm, so consumers are unaffected.          | `package-lock.json` committed (V1's current state -- correct)                                                                                                                                                        |
| **Telemetry libraries (Sentry, OpenTelemetry, posthog, etc.)**                   | IL-4 explicitly forbids telemetry in V1. Don't introduce any analytics dependency.                                                                                            | None                                                                                                                                                                                                                 |
| **i18n libraries (i18next, formatjs, etc.)**                                     | IL-1 explicitly defers i18n to post-V1. The stable user-contract strings (PRD §6.12 ES-5) are English-only.                                                                   | None                                                                                                                                                                                                                 |

## Stack Patterns by Decision Point

### Pattern: Discriminated unions for `installable: true \| false` (NFR-7)

### Pattern: Atomic file writes (NFR-1)

### Pattern: Concurrent-write detection (`withStateGuard`)

### Pattern: Soft-degrade on missing companion extensions

### Pattern: Lockfile policy

## Version Compatibility Matrix

| Package                                 | Version                                         | Compatible With           | Notes                                                                                                            |
| --------------------------------------- | ----------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `node`                                  | `>=22.18` (recommended)                         | All listed deps           | `>=22.18` enables native TS strip; `>=20.19.0` (NFR-4 floor) requires `tsx` for `node --test` of `.ts` files     |
| `typebox@^1.1.38`                       | ESM-only                                        | Node >= 20.19.0           | Will not load under `"type": "commonjs"`. V1 already on `"type": "module"`                                       |
| `write-file-atomic@^8.0.0`              | engines: `^22.22.2 \|\| ^24.15.0 \|\| >=26.0.0` | Node 22.22.2+             | Bumps the V1 effective Node floor from 22.0 to 22.22.2 if adopted. Acceptable -- 22.22.x is current 22 LTS line. |
| `eslint@^10.x`                          | typescript-eslint `^8.59.2`                     | typescript `^5.9.x`       | typescript-eslint engines require `node: ^20.19.0 \|\| ^22.13.0 \|\| >=24` -- within NFR-4                       |
| `prettier@^3.8.x`                       | Node ≥14                                        | All listed deps           | No constraint                                                                                                    |
| `tsx@^4.21.0`                           | Node ≥18.4                                      | Optional after Node 22.18 | Keep if CI runs Node \<22.18                                                                                     |
| `@mariozechner/pi-coding-agent@^0.73.x` | engines: `>=20.6.0`                             | Node >= 20.19.0 (NFR-4)   | Floor is below ours -- no constraint                                                                             |

## What V1 Already Got Right (carry forward unchanged)

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

## Sources

### Authoritative (HIGH confidence)

- npm registry, queried 2026-05-09 via `npm view`:
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

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.

<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:

- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.

<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Generated by GSD on 2026-05-14T01:19:44Z. This section is managed by `generate-claude-profile` -- do not edit manually. Full profile: `.pi/gsd/USER-PROFILE.md`

### Quick Reference

- **Communication Style (terse-direct, HIGH):** Respond directly and efficiently, leading with the answer or action before adding any optional context.
- **Decision Speed (deliberate-informed, HIGH):** Present concise trade-offs and a clear recommendation, then wait for or invite a decision when the choice has meaningful consequences.
- **Explanation Depth (detailed, HIGH):** Explain the reasoning and mechanics behind changes, but keep the explanation tightly focused on the specific question.
- **Debugging Approach (hypothesis-driven, MEDIUM):** Treat debugging as a reasoning session: state the suspected root cause, validate or refute the developer's hypothesis, and show why the fix changes the failure mode.
- **UX Philosophy (backend-focused, MEDIUM):** Prioritize correct behavior, clear data flow, and maintainable implementation; keep UI work simple and functional unless the developer asks for polish.
- **Vendor Philosophy (pragmatic-fast, MEDIUM):** Choose practical, working dependencies and integration paths first, and call out risks or alternatives only when they affect correctness, maintenance, or compatibility.
- **Frustration Triggers (instruction-adherence, LOW):** Follow the stated requirement precisely, avoid unnecessary deviations, and explicitly verify that proposed changes satisfy the user's intended constraint.
- **Learning Style (guided, HIGH):** Guide the developer through unfamiliar concepts with concise explanations and concrete examples tied directly to the current code or tool.

<!-- GSD:profile-end -->
