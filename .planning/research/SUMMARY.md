# Project Research Summary

**Project:** pi-claude-marketplace successor architecture **Domain:** Pi extension bridging Claude plugin marketplaces into Pi-native artefacts **Researched:** 2026-05-09 **Confidence:** HIGH

## Executive Summary

This is a successor-architecture project, not a greenfield build. V1 already exists on `features/initial` and is functionally correct. The PRD (~100 requirements, 1068 lines) was derived directly from V1 source and serves as the authoritative spec. The successor's mandate is consolidation, hardening, and a small set of targeted enhancements -- not a redesign. Research across all four domains confirms a single dominant theme: approximately 85% of PRD requirements map to V1 patterns that should be carried forward verbatim; the remaining 15% are refinements in atomicity, module naming, and a handful of hardening gaps that V1 left as known debt.

The recommended approach is to build in dependency order -- domain-core and persistence primitives first, then bridges in parallel, then orchestrators, then the edge/presentation layer -- and to use the successor refactor as the opportunity to correct three specific V1 weaknesses that research identified as highest-impact: (1) adopt `write-file-atomic@^8` to replace V1's hand-rolled JSON atomic write and add missing `fsync` durability; (2) extract a Phase ledger primitive to replace the ~250-line nested try/catch chains in the install and update orchestrators; (3) promote ES-5 marker strings to a `MARKERS.ts` constants module so the user contract cannot drift silently. All other V1 architectural choices -- single `state.json` per scope, discriminated `installable` union at the resolver boundary, `withStateGuard` read-modify-save closure, pull-based soft-dep probing, prepare/commit/abort tri-phase staging for external sinks -- should be carried forward without change.

The three highest-impact risks are: (a) atomicity-without-durability -- `fs.rename` is atomic but not durable without `fsync` of the parent directory, a gap that `write-file-atomic` closes; (b) symlink bypass of `assertPathInside` -- the current string-level path containment check does not follow symlinks and can be escaped by a malicious plugin; (c) soft-dep contract drift -- the probe tool names (`subagent`, `mcp`) are hardcoded in this extension but owned by companion extensions, creating a silent coupling that breaks when companions rename their tools. All three have clear mitigations that belong in the foundations phase.

## Key Findings

### Recommended Stack

The V1 stack is fundamentally sound and should be carried forward almost verbatim. Every contested decision already lands on the 2026 ecosystem majority: `typebox@^1.1.38` (not the legacy `@sinclair/typebox` 0.34.x), Node >=22 with `node:test`, ESLint 10 flat config with `import-x` and `@stylistic`, and Prettier 3. The only meaningful changes are one addition and one deprecation candidate.

The single new direct dependency is `write-file-atomic@^8.0.0` -- npm CLI's own atomic-write library, purpose-built for the tmp+fsync+rename pattern V1 hand-rolls today. Its Node engine requirement (`>=22.22.2`) bumps the effective floor from 22.0 to 22.22.2, which is the current 22 LTS line and acceptable against NFR-4. The deprecation candidate is `tsx`: Node 22.18+ ships native TypeScript stripping by default, making `tsx` optional for any CI that targets `>=22.18`. Keep it only if the CI matrix needs to support Node 22.0-22.17.

**Core technologies:**

- **Node.js `>=22` (recommend `>=22.18`):** runtime -- native TS stripping at 22.18+ eliminates the `tsx` requirement; carry forward from V1
- **TypeScript `^5.9.3`:** strict-mode language -- required for the discriminated `installable` union (NFR-7); stay on 5.9.x stable over TS 6.x preview; carry forward from V1
- **`typebox@^1.1.38`:** runtime schema validation and JSON Schema generation -- JIT-compiled validators (`Schema.Compile`) on par with Ajv; already a peer dep in V1; carry forward with minor bump
- **`@mariozechner/pi-coding-agent@^0.73.1`:** Pi extension API host -- required peer dep; pin floor to `>=0.70.6` per NFR-11 (V1 declares `*`)
- **`write-file-atomic@^8.0.0`:** atomic JSON writes with fsync -- NEW; replaces hand-rolled portion of V1's `fs-utils.ts` for `state.json`, `mcp.json`, `agents-index.json`
- **`node:test` (built-in):** test framework -- stable since Node 20; carry forward from V1; no need for Vitest
- **ESLint `^10.3.0` + `typescript-eslint@^8.59.2` + flat config:** linting -- flat config is the only supported format in ESLint 10; carry forward from V1

**What NOT to use:** `@sinclair/typebox` 0.34.x (LTS-only legacy name), CJS (`"type": "commonjs"`), `fs.writeFileSync` for state.json, `semver` for hash-version comparison, `fs-extra`, Jest, `neverthrow`/`fp-ts` for a Result-type system, any telemetry or i18n library.

### Expected Features

~85% of PRD requirements are table stakes -- without them, users familiar with `npm`, `brew`, or Claude Code's own `/plugin` will conclude the extension is broken. The remaining ~15% are genuine differentiators where this extension leads over upstream Claude Code `/plugin`. Research identified 10 behavioral gaps needing explicit decisions before phase planning (documented in FEATURES.md), of which the most consequential are Gap 3 (custom component-path arrays should supplement defaults, not replace them -- a correctness bug vs. upstream spec) and Gap 1 (cross-marketplace plugin name collision handling).

**Must have (table stakes) -- PRD sections 5 and 6 in full:**

- `marketplace add/remove/list/update/autoupdate` lifecycle, including atomic clone-then-rename and non-fast-forward refusal
- `install/uninstall/update` plugin lifecycle with 4-phase atomic staging and phase-ordered rollback
- All four bridges: skills (`resources/skills/`), commands (`resources/prompts/`), agents (`<scope>/agents/` with index), MCP servers (`mcp.json` merge with marker)
- Discriminated `installable: true | false` resolver; manifest schema with strict/non-strict mode
- `withStateGuard`, `state.json` schemaVersion 1, legacy migration, concurrency detection
- `assertPathInside` containment on every name-derived path; `PathContainmentError` propagation
- Tab completion for subcommands, `--scope` values, and `plugin@marketplace` tokens
- Soft-dep degradation: install proceeds when `pi-subagents`/`pi-mcp-adapter` is unloaded; stable warning + reload hint emitted
- Stable ES-5 marker strings; single `ctx.ui.notify` output channel; `Error.cause` chains

**Should have (differentiators vs. upstream Claude Code `/plugin`):**

- Atomic 3-phase update (prepare -> state-guard swap -> physical replace) -- upstream has known cache/update bugs (#17361, #29071)
- Cross-plugin AND cross-marketplace conflict guards at install time -- upstream does not guard cross-marketplace
- Forward-compatible `marketplace.json` parser (unknown source kinds -> `{ kind: "unknown" }`, not a throw)
- Generated-marker provenance guard (AG-5/PU-7) -- refuses to remove agent files lacking both basename prefix AND HTML-comment marker
- Reload hint emitted ONLY when resources actually change -- suppressed on no-op operations

**Fix in successor (Gap 3 -- correctness bug vs. upstream spec):**

- Custom component-path arrays must supplement defaults, not replace them -- current V1 behavior contradicts upstream Claude spec; fix in Phase 5

**Defer (v1.1 post-successor):**

- `info` subcommand (highest value deferred item; ~1 week of work; all mature ecosystems have it)
- `--dry-run` for install/update/uninstall (requires plan/execute split)
- JSON output mode (requires stable schema design)
- `min-release-age` supply-chain hardening (wait for Anthropic ecosystem signals)

**Permanent anti-features (never build):**

- Mutating LLM tools for install/update/remove (prompt-injection security risk)
- Automatic dependency resolution (no standardized Claude plugin dependency schema)
- Managed/allowlist/blocklist policies (no Pi-side org policy primitive)

### Architecture Approach

The V1 architecture is fundamentally sound and should be preserved in shape. The successor refactor renames modules for clarity and enforces seam boundaries that V1 leaves implicit. The key structural change is splitting V1's mixed `commands/` + feature directories into a named `edge/` layer (thin transport: router, completions, args, per-subcommand handlers) and `orchestrators/` (use cases with full business logic). This makes the edge/orchestrator boundary enforceable in lint rules. Everything else -- `bridges/`, `domain/`, `transaction/`, `persistence/`, `presentation/`, `shared/` -- maps directly from V1's existing module groupings with names tightened.

**Major components:**

1. **Edge layer (`edge/`)** -- parse `/claude:plugin <sub>...`, return tab completions, answer `resources_discover`; thin handlers with no I/O beyond `pathExists`; no Pi API imports below this layer except through `platform/`
2. **Feature orchestrators (`orchestrators/`)** -- one pure async function per use case (`installPlugin`, `updatePlugin`, `removeMarketplace`, ...); own ordering, error wrapping, severity composition, reload-hint assembly
3. **Transaction coordinator (`transaction/`)** -- `withStateGuard` (carry forward verbatim from V1) + new Phase ledger primitive (`phase.ts`) replacing hand-rolled try/catch chains + `RollbackFailure` aggregation
4. **Resource bridges (`bridges/skills|prompts|agents|mcp`)** -- per-component-class staging with prepare/commit/abort (agents, mcp) or stage/move (skills, prompts); each bridge owns its tmp dir, marker discipline, and unstage path; no shared abstract `Bridge` supertype
5. **Domain core (`domain/`)** -- pure logic: resolver emitting discriminated `ResolvedPlugin` union, manifest parser, source parser, name/version validation; no I/O; independently unit-testable
6. **Persistence layer (`persistence/`)** -- `state.json` single-file per scope, `agents-index.json`, atomic IO helpers; all writes via `write-file-atomic` or tmp+rename; ENOENT swallowed at read
7. **Platform boundary (`platform/pi-api.ts`)** -- NEW: thin wrapper around `pi.getAllTools()`, `pi.on(...)`, `pi.registerCommand(...)`; makes orchestrators testable without a live Pi instance

**Patterns to carry forward verbatim:**

- Discriminated `installable: true | false` union at resolver boundary (NFR-7)
- `withStateGuard` read-modify-save closure (ST-7); only callsite for `saveState`
- Prepare/commit/abort tri-phase staging for external sinks (agents, mcp)
- Branded `ScopedLocations` phantom-type object (zero runtime cost; prevents scope-pair bugs)
- Pull-based soft-dep probing via `pi.getAllTools()` at decision time (Pi API has no push event for tool load)
- `Error` + `Error.cause` chain model (no `neverthrow`; hybrid discriminated-union-at-boundaries + throws-elsewhere is correct for this codebase)

**Patterns to refactor in successor:**

- Replace hand-rolled JSON atomic write in `fs-utils.ts` with `write-file-atomic` for `state.json`/`mcp.json`/`agents-index.json`
- Replace nested try/catch chains in `install.ts`/`update.ts` with Phase ledger primitive (~60 LOC replacing ~250 LOC)
- Pull ES-5 marker strings from inline literals into a single `presentation/markers.ts` constants module
- Add `platform/pi-api.ts` wrapper for testability

### Critical Pitfalls

Research identified 15 pitfalls. The top 5 by combined impact and likelihood:

1. **Atomicity without durability (Pitfall 2)** -- `fs.rename` is atomic at the syscall level but the rename is not durable across a kernel crash without `fsync(parent_dir_fd)` after the rename. V1's hand-rolled atomic write lacks this. Mitigation: adopt `write-file-atomic@^8` for all JSON writes (it fsyncs by default); document that staging-dir renames also need parent fsync. Address in foundations phase.

2. **Symlink bypass of `assertPathInside` (Pitfall 10)** -- The current string-level containment check (`path.resolve(child).startsWith(path.resolve(parent) + sep)`) passes for a symlink pointing outside the scope root. A malicious plugin placing a symlink in its component tree can write to arbitrary paths. Mitigation: walk parent directories with `fs.lstat`, check `isSymbolicLink()`, reject if symlink target escapes scope root. Address in path safety phase.

3. **Soft-dep probe name drift (Pitfall 3)** -- Probe tool names (`subagent`, `mcp`) are hardcoded in this extension but owned by companion extensions. A companion rename silently breaks warning suppression or triggers false positives. Mitigation: document the probe contract in a versioned `companionExtensionContract.ts`; add integration test against real companion binaries. Address in soft-dep probing phase.

4. **Cross-device rename breaking atomicity contract (Pitfall 1)** -- `fs.rename(tmpPath, destPath)` returns `EXDEV` when `tmpPath` and `destPath` live on different filesystems (macOS APFS firmlinks, Docker bind mounts, `/tmp` as tmpfs). Naive `EXDEV` fallback via `copyFile + unlink` silently downgrades from atomic to non-atomic. Mitigation: always derive `tmpDir` from destination's parent; treat `EXDEV` as a misconfiguration error, never fall back silently. Address in foundations phase alongside atomic ops.

5. **ES-5 marker string drift (Pitfall 4)** -- The foreign-content guard (AG-5) depends on a verbatim HTML-comment marker in agent files. A refactor that touches the marker string (e.g., adding version info) invalidates every existing install -- uninstall begins refusing to remove its own files. Mitigation: promote markers to `MARKERS.ts` constants with a snapshot test asserting verbatim PRD text; lint rule banning inline occurrences. Address in agents bridge phase.

Additional high-priority pitfalls to plan for: state schema mid-flight downgrade (Pitfall 5; add schema-version floor check to `withStateGuard`), cross-target race between `marketplace remove` and concurrent `install` (Pitfall 6; verify parent marketplace exists at commit time), update phase-3 partial failure leaving mismatched state/disk (Pitfall 12; aggregate phase-3a failures before starting phase-3b).

## Implications for Roadmap

All research converges on a single build order: dependency-graph inside-out, domain core first, bridges in parallel after primitives are solid, orchestrators after bridges, thin edge and integration last. The Phase ledger primitive and `write-file-atomic` adoption belong in foundations -- they are used by every subsequent phase and retrofitting them later would require touching every callsite.

### Phase 1: Foundations and Toolchain

**Rationale:** Every subsequent phase depends on atomic IO primitives, path safety, ESM module baseline, and ESLint discipline. Fixing these before any feature code means they propagate correctly rather than being retrofitted. Pitfalls 1, 2, 9, and 15 all belong here. **Delivers:** `write-file-atomic` adopted; `assertPathInside` extended with symlink-walk; ESLint `no-console: error` + custom rule banning `process.stdout/stderr.write` in command/bridge dirs; `MARKERS.ts` constants module; `platform/pi-api.ts` testability wrapper; Node 22/24/26 CI matrix; ESM-only baseline with `paths.ts` helper replacing `__dirname` **Addresses:** NFR-1 (atomic writes), NFR-10 (containment), IL-2/IL-3 (output channel discipline), ES-5 (marker stability) **Avoids:** Pitfalls 1 (EXDEV), 2 (fsync durability), 9 (ESM traps), 15 (notify discipline) **Research flag:** Standard patterns -- no additional research needed

### Phase 2: Domain Core and Persistence Primitives

**Rationale:** Pure logic and persistence shapes have no I/O dependencies and can be exhaustively unit-tested without a Pi instance. Establishing them first gives every bridge and orchestrator a stable typed foundation. The Phase ledger primitive belongs here as a transaction primitive used by install and update orchestrators. **Delivers:** `domain/resolver.ts` (discriminated `ResolvedPlugin` union), `domain/manifest.ts` (TypeBox schemas for `marketplace.json`/`plugin.json` with discriminated source union), `domain/source.ts`, `domain/name.ts`, `domain/version.ts` (SHA-256 12-hex content hash with filter list snapshot-tested); `persistence/state-schema.ts`, `persistence/state-io.ts` (load + legacy migration), `persistence/locations.ts` (branded `ScopedLocations`), `persistence/atomic.ts`; `transaction/state-guard.ts` (carry verbatim), `transaction/phase.ts` (NEW Phase ledger), `transaction/rollback.ts`, `transaction/leaks.ts` **Addresses:** NFR-7 (discriminated union), ST-1/ST-4/ST-7/ST-8/ST-9 (state persistence and migration), PI-7 (hash version), SC-3 (branded locations) **Avoids:** Pitfalls 5 (schema downgrade -- add version floor to `withStateGuard`), 8 (union drift -- runtime schema validation at JSON boundaries), 13 (hash drift -- snapshot test) **Research flag:** Standard patterns -- no additional research needed

### Phase 3: Resource Bridges (Skills, Commands, Agents, MCP)

**Rationale:** Bridges are independently buildable and testable after domain + persistence primitives exist. Skills and commands (stage/move into extension's own tree) are simpler and can ship first; agents and MCP (prepare/commit/abort into external sinks) are more complex and carry the bulk of the pitfall surface. All four can be built in parallel within the phase. **Delivers:** `bridges/skills/` (stage + discover), `bridges/prompts/` (stage + discover), `bridges/agents/` (prepare/commit/abort, agents-index.json with corruption tolerance, frontmatter conversion, `GENERATED_AGENT_MARKER` from `MARKERS.ts`), `bridges/mcp/` (prepare/commit/abort, `_claudeMarketplace` marker, four-slot collision check centralized in `MCP_COLLISION_SLOTS` constant) **Addresses:** SK-1 to SK-5, CM-1 to CM-4, AG-1 to AG-12, MC-1 to MC-8 **Avoids:** Pitfalls 4 (marker drift), 10 (symlink containment -- `fs.cp({ verbatimSymlinks: true })` with post-copy walk), 11 (MCP slot miss -- single `MCP_COLLISION_SLOTS` constant) **Research flag:** Standard patterns -- bridge logic is fully specified in PRD sections 5.5-5.8; no additional research needed

### Phase 4: Marketplace Orchestrators

**Rationale:** Marketplace lifecycle (`add`/`remove`/`list`/`update`/`autoupdate`) is a prerequisite for plugin lifecycle (`install` reads marketplace from state). Marketplace operations are simpler (no cross-bridge phase ledger) and should ship and be tested first. **Delivers:** `orchestrators/marketplace/add.ts`, `remove.ts` (cascade with aggregated failures per MR-3), `list.ts`, `update.ts` (manifest refresh + optional plugin cascade), `autoupdate.ts`; `presentation/cascade.ts`, `presentation/marketplace-list.ts` **Addresses:** MA-1 to MA-11, MR-1 to MR-8, ML-1 to ML-4, MU-1 to MU-7 **Avoids:** Pitfall 6 (cross-target race -- `marketplace remove` marks `removing: true` in state before cascade; `install` checks at commit) **Research flag:** Standard patterns -- PRD section 5.1 fully specifies the cascade behavior; Behavioral Gap 2 (cascade ordering on partial failure) resolved as Option A (continue + collect)

### Phase 5: Plugin Orchestrators (Install, Uninstall, Update)

**Rationale:** Plugin lifecycle orchestrators exercise the full Phase ledger and all four bridges together. This is the highest-complexity phase and should build on confirmed working bridges and marketplace state. **Delivers:** `orchestrators/plugin/install.ts` (4-phase: skills/prompts -> agents -> mcp -> state commit, using Phase ledger), `orchestrators/plugin/uninstall.ts`, `orchestrators/plugin/update.ts` (3-phase: prepare -> state-guard swap -> physical replace); `presentation/soft-dep.ts` (extract probe + warning composition), `presentation/reload-hint.ts` (carry forward; probe at call time) **Addresses:** PI-1 to PI-15, PU-1 to PU-7, PUP-1 to PUP-9 **Avoids:** Pitfalls 3 (soft-dep drift -- versioned `companionExtensionContract.ts`), 6 (concurrent install/marketplace-remove -- parent-marketplace existence check at commit), 12 (update phase-3 partial -- aggregate 3a failures before starting 3b) **Research flag:** Standard patterns -- PRD sections 8.3/8.4 state machines and acceptance criteria are fully specified; Gap 3 (component-path supplement vs. replace) resolved as Option B (fix to supplement)

### Phase 6: Edge Layer, Argument Parsing, and Tab Completion

**Rationale:** The edge layer is thin glue (parse -> dispatch -> format output). Tab completion is table stakes for the Pi command surface (TC-1 to TC-9) but has no bearing on correctness of underlying operations. Shipping it after orchestrators means completions can be tested against real state shapes. **Delivers:** `edge/router.ts`, `edge/args.ts`, `edge/completions.ts`, `edge/handlers/` (one file per subcommand), `presentation/error-format.ts` (formatErrorWithCauses depth 5); all `Usage:` blocks; `--scope` validation; quoted-arg handling; fish-style space normalization **Addresses:** AP-1 to AP-4, TC-1 to TC-9, SP-1 to SP-7 **Avoids:** Pitfall 15 (notify discipline -- edge handlers go through typed `notify` wrapper; custom ESLint rule already in place from Phase 1) **Research flag:** Standard patterns -- no additional research needed

### Phase 7: Integration, End-to-End Tests, and Pi Wiring

**Rationale:** `index.ts` and `platform/pi-api.ts` are the last things wired because they have the narrowest surface area and the broadest test dependency. The live integration test against `anthropics/claude-plugins-official` belongs here with proper pinned-SHA-vs-floating-main CI strategy. **Delivers:** `index.ts` (Pi entrypoint: registers `/claude:plugin` command + `resources_discover`); `platform/pi-api.ts` wired to real Pi; live integration test suite (pinned SHA for PR CI, floating main for nightly); multi-process concurrency test for `withStateGuard`; Node 22/24/26 compatibility confirmation **Addresses:** NFR-2 (no restart required), NFR-3 (idempotent retry), NFR-5 (network policy), NFR-11 (peer dep floor), PRD section 12 acceptance tests **Avoids:** Pitfall 7 (live test fragility -- pinned SHA + failure-mode classification in CI output), Pitfall 6 (multi-process race -- real concurrent-process integration test) **Research flag:** May need targeted verification of `resources_discover` event contract and `pi.registerCommand` surface in `@mariozechner/pi-coding-agent@^0.73.1` vs. the `^0.70.6` version V1 was developed against

### Phase Ordering Rationale

- Dependency direction drives order: `domain/` has no I/O deps; `persistence/` deps on `domain/`; `bridges/` dep on `persistence/` + `domain/`; `orchestrators/` dep on `bridges/` + `transaction/`; `edge/` dep on `orchestrators/`. Inside-out builds mean each phase has a complete typed foundation to build on.
- Marketplace orchestrators before plugin orchestrators because `install <plugin>@<marketplace>` requires a marketplace record in state. Getting marketplace lifecycle correct first prevents the most common developer mistake (testing install before the prerequisite state exists).
- The Phase ledger primitive lands in Phase 2 (domain/persistence) not Phase 5 (install/update) because it is a transaction primitive -- analogous to `withStateGuard` -- that install and update orchestrators will import. Retrofitting it after orchestrators are written would require touching them twice.
- Edge and tab completion land last (Phase 6) because they are pure delivery surface. Moving them earlier would create pressure to lock orchestrator APIs before they are stable.
- Pitfall mitigations are assigned to the earliest phase where they are buildable: EXDEV and fsync durability in Phase 1 (affect every subsequent phase's staging code), symlink containment in Phase 1 (wraps the same `assertPathInside` that all bridges use), marker stability in Phase 1 (the `MARKERS.ts` module is imported by the agents bridge in Phase 3).

### Research Flags

Needs research during planning:

- **Phase 7:** Verify `resources_discover` event contract and `pi.registerCommand` surface in `@mariozechner/pi-coding-agent@^0.73.1` vs `^0.70.6`. The V1 was developed against 0.70.6; 0.73.1 is current. Low probability of breaking change but worth a targeted read of the types.d.ts diff before wiring `index.ts`.

Standard patterns (skip research phase):

- **Phases 1-6:** All patterns are fully specified in the PRD, validated against V1 source, and corroborated by architecture research. No novel integration problems.

Behavioral gaps needing explicit resolution in REQUIREMENTS.md before planning:

- Gap 1 (cross-marketplace plugin name handling) -- recommended: Option A (both install; conflict guard catches skill-name clash at install time)
- Gap 2 (cascade ordering on partial failure) -- recommended: Option A (continue + collect, consistent with MR-3)
- Gap 3 (component-path supplement vs. replace) -- recommended: Option B (fix to supplement; mark as "behavior corrected vs. V1" in changelog)
- Gaps 4-10 -- lower impact; document recommended resolutions in REQUIREMENTS.md as spec clarifications

## Confidence Assessment

| Area         | Confidence                                                  | Notes                                                                                                                                                                                |
| ------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stack        | HIGH                                                        | Versions verified against npm registry 2026-05-09; Node 22 native TS strip confirmed via official docs; `write-file-atomic@^8` engine constraint verified                            |
| Features     | HIGH for table stakes / MEDIUM for post-V1 predictions      | PRD-grounded for all V1 features; post-V1 roadmap items validated against Claude Code issues and adjacent ecosystems but prediction-grounded                                         |
| Architecture | HIGH for V1 carry-forward / MEDIUM for successor divergence | V1 source read directly from `features/initial`; Pi API surface verified against `pi-coding-agent` types.d.ts; Phase ledger pattern extrapolated from V1 pain points                 |
| Pitfalls     | HIGH for V1-derived / MEDIUM for APFS/Node 22 specific      | V1 pitfalls grounded in PRD sections 6.9-6.12; EXDEV/fsync pitfalls corroborated by Node.js issue tracker and write-file-atomic docs; symlink check grounded in Node.js `fs.cp` docs |

**Overall confidence:** HIGH

### Gaps to Address

- **`resources_discover` contract in 0.73.1 vs 0.70.6:** Verify during Phase 7 planning by reading `@mariozechner/pi-coding-agent@^0.73.1` types.d.ts diff. If the event signature changed, `index.ts` wiring will need adjustment.
- **Behavioral Gaps 1-3 (cross-marketplace name, cascade ordering, component-path supplement):** Must be resolved as explicit decisions before Phase 4 and Phase 5 requirements documents are written. Recommendations above are research-grounded but need owner sign-off.
- **`write-file-atomic@^8` Node floor (22.22.2):** Bumps the effective Node floor from 22.0 to 22.22.2. If CI must run on earlier 22.x patch releases, the staging-dir rename code must continue to be used for JSON writes as well, losing the fsync durability gain. Confirm CI Node version range before adopting.
- **Concurrency at multi-process level:** `withStateGuard` handles in-process and cooperative inter-process via mtime check; it does NOT handle adversarial concurrent writes. If Pi ever gains true parallel-shell support on the same scope, `proper-lockfile` should be slotted under `withStateGuard`. Not a V1 concern but flag for the architecture decision log.

## Sources

### Primary (HIGH confidence)

- npm registry queried 2026-05-09: `typebox@1.1.38`, `write-file-atomic@8.0.0`, `eslint@10.3.0`, `typescript-eslint@8.59.2`, `prettier@3.8.3`, `@mariozechner/pi-coding-agent@0.73.1`, `tsx@4.21.0`, `globals@17.6.0`
- V1 source (`features/initial` branch): `index.ts`, `commands/router.ts`, `transaction/state-guard.ts`, `plugin/install.ts`, `plugin/update.ts`, `agent/stage.ts`, `mcp/stage.ts`, `location/index.ts`, `errors.ts`, `presentation/reload-hint.ts` -- empirical basis for carry-forward recommendations
- PRD `docs/prd/pi-claude-marketplace-prd.md` v1.0 (1068 lines) -- authoritative spec; sections 5 (vertical features), 6 (horizontal concerns), 8.3/8.4 (state machines), 9 (architecture diagrams), 11 (out-of-scope), 12 (acceptance tests)
- `.planning/PROJECT.md` -- constraints, decisions, successor scope
- Pi `ExtensionAPI` surface: `node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/types.d.ts` -- confirmed `getAllTools()`, `on(event, ...)` events list; no `extension_loaded` or `tool_registered` push event
- Official Node.js docs: `nodejs.org/api/test.html` (node:test stable since 20), `nodejs.org/api/typescript.html` (native TS strip default in 22.18+), `nodejs.org/api/fs.html` (`fs.cp` symlink options)
- Official ESLint docs: flat config is only supported format in v10
- Context7 `/sinclairzx81/typebox` -- TypeBox 1.x JIT compile API, `Type.Union([...], { discriminator })`, ESM-only, JSON Schema 2020-12 output

### Secondary (MEDIUM confidence)

- Claude Code GitHub issues: #17361 (update cache bug), #29071 (non-fast-forward update), #40351 (APFS firmlink rename failure) -- referenced to justify differentiators and EXDEV pitfall
- `npm/write-file-atomic` GitHub -- fsync-by-default semantics, concurrent-write serialization queue
- Node.js issue tracker #19077 -- `fs.rename()` EXDEV cross-device behavior
- Claude Code plugin docs: `code.claude.com/docs/en/discover-plugins`, `code.claude.com/docs/en/plugin-marketplaces` -- marketplace schema, plugin entry fields
- `anthropics/claude-plugins-official` -- reference marketplace; 101 plugins as of March 2026
- VS Code issues/docs -- listing failure mode (#182675), enterprise extension management
- Homebrew docs -- tap model, untap cascade behavior
- Spring 2026 OSS hardening (npm/pnpm `min-release-age`) -- supply-chain context for deferred features

### Tertiary (LOW confidence -- for ecosystem signal only)

- Schema-validation benchmarks (`schemabenchmarks.dev`) -- TypeBox JIT competitive with ArkType; used to support keeping TypeBox over alternatives
- Marketplace inventory survey (Build to Launch, March 2026) -- agents increasingly central to Claude plugins; used to justify agents bridge priority
- Saga pattern literature (microservices.io, DZone) -- local-saga framing for Phase ledger; structural argument transfers despite distributed-system context of original

______________________________________________________________________

*Research completed: 2026-05-09* *Ready for roadmap: yes*
