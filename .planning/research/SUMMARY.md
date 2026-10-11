# Project Research Summary: mcp-4 (MCP 4)

**Project:** pi-claude-marketplace
**Milestone:** `mcp-4` (name label, not a version; branch `features/mcp-4`)
**Domain:** Brownfield Pi extension: Pi 1.0 floor, plugin MCP delivery through pi-mcp-adapter 5
**Researched:** 2026-10-01
**Confidence:** HIGH on facts read from shipped code and executed in scratch copies; MEDIUM on three runtime behaviors read but not observed (see Gaps)

## Executive Summary

This milestone changes where and how the MCP bridge delivers plugin servers. Today it writes marked entries into Pi's `mcp.json`. Adapter 5 translates that file and drops every adapter-only field (`directTools`, `toolPrefix`, `httpTransport`, `description`). It also reports our `_piClaudeMarketplace` marker as an "ignored setting" at every start. The recommended approach, already fixed by the operator, is to write adapter-native entries into `<scopeRoot>/mcp-adapter.json`, with upstream-parity names (`plugin:<plugin>:<server>` normalized), `directTools: "search"`, Claude-rule variable expansion, live status in `info`, and an automatic `/reload` migration. Almost all of this lands on seams that already exist: the stage/commit/unstage triplet, the MC-5 marker, the reconcile per-scope loop, and the `completionCache` injection route. Three components are genuinely new: a pure entry translator, a legacy-move step, and an event-bus status tracker.

The Pi 1.0 floor is low risk. Production code typechecks clean on Pi 1.0.0. The only breaks are 23 type errors in four test files, and the test hunks from features/mcp `74162ca6` fix them exactly. With them applied, scratch runs passed: `tsc` exit 0, unit 8529/8529, integration 67/67, e2e 14/14. No new runtime dependency is needed. The adapter is never imported (a static import turns a soft dependency into a build dependency); status comes from the string channel `pi-mcp-adapter/status/v1` on `pi.events`.

The key risks are all about shipping the entry shape once. Every shape change (name, `directTools`, escaping) invalidates the adapter's per-server state: OAuth sign-ins, project approvals, `/mcp-adapter disable` overrides, and pi-subagents `mcp:<server>` overrides are keyed by server name or definition hash. So naming, translation and variable handling must be final before migration moves a single entry, and no release may sit between delivery and migration. The other critical risks are: `mcp-adapter.json` is JSONC and must never be treated as empty and overwritten, the adapter expands values a second time with no escape in `command`/`args`/`cwd`/`url`, resolving `${VAR}` at install time would write secrets to disk, and adapter-written overlays on our names cause false collisions and get clobbered on update.

## Fixed Decisions (operator, not open)

- pi-mcp-adapter floor `>=5.0.0`; delivery by writing `<scopeRoot>/mcp-adapter.json` (not Pi `mcp.json`, not `registerMcpServer()`).
- Adapter-only detection: Pi's built-in MCP does not satisfy the soft dependency.
- pi-subagents `>=0.74.0`; Pi `>=1.0.0` (peer), dev `^1.0.0` with pi-tui `^1.0.0`.
- Bump all devDependencies; re-verify the workflow engine (3.13.1) on Pi 1.0.
- Adopt tool-search exposure (`directTools: "search"`), upstream `plugin:<plugin>:<server>` naming, `${VAR:-default}` parity, live status in `info`, automatic migration on `/reload`.

## Key Findings

### Recommended Stack (STACK.md)

Pi 1.0.0 is a drop-in for production code. No new runtime dependency: the bridge reuses `typebox`, `write-file-atomic`, `proper-lockfile`. Status uses Pi's `pi.events` bus with a locally typed, typebox-validated snapshot. Detection can use `pi.getSettings()` as an aid, but the existing probe already ignores the built-in.

**Core technologies:**

- `@earendil-works/pi-coding-agent` peer `>=1.0.0`, dev `^1.0.0` (lock 1.0.0): host API; additive delta for every re-exported symbol.
- `@earendil-works/pi-tui` dev `^1.0.0`: keeps the type-only import in lockstep with Pi's nested copy.
- `pi-subagents` optional peer `>=0.74.0`: ships compiled `src/agents/*.js`; both peer integration tests passed 2/2 against 0.74.0 via `PI_SUBAGENTS_ROOT`.
- `pi-mcp-adapter` documented soft dependency `>=5.0.0`: reads `mcp-adapter.json`, maps `directTools: "search"` to Pi deferred tools, publishes status snapshots. Never a devDependency (ERESOLVE risk, native deps, D-98-10).
- `@quintinshaw/pi-dynamic-workflows` 3.13.1: pin in `scripts/pi.sh` only; needs a live canary re-grade on Pi 1.0.

**Critical version facts:**

- Hold `typescript` at `^6.0.3`. `typescript@7.0.2` is npm `latest` but `typescript-eslint@8.71.0` peers `<6.1.0`, and eight `scripts/*.mjs` plus two tests import the classic compiler API that TS 7 does not export. "Bump all devDeps" carries this one exception.
- `typescript-eslint` `^8.71.0` adds one error (`no-unsafe-enum-assignment`, `shared/notify-context.ts:345:30`), apparently a false positive. Plan a task.
- Other devDeps: `eslint-plugin-sonarjs ^4.2.2`, `fallow ^3.31.0` (also bump the `lint.yml` action SHA to `71369f80d099e25726ad04382f15aef14a251abc`), `prettier ^3.9.9`, `globals ^17.13.0`, `eslint-plugin-import-x ^4.17.1`. Applied together in scratch: `tsc` 0, architecture 456/456, analyzers 285/285, fallow 0, format clean.
- The adapter's optional `pi-ai` peer range stops at `^0.99.0`. It reaches Pi users only as a hard `ERESOLVE` when `pi-ai@1.x` sits at top level; `pi install` uses `--legacy-peer-deps`. Record it as an upstream gap; do not work around it.

Replaying features/mcp: all five commits apply cleanly onto HEAD, but not verbatim. Reuse the `74162ca6` test hunks only (not its package hunks), change floor literals `0.99.2` -> `1.0.0` and `0.73.1` -> `0.74.0`, regenerate the lock with `npm install`, and re-derive the two `types.d.ts` contract pins (`406:5 -> 525:5`, `414:5 -> 533:5`).

### Expected Features (FEATURES.md)

Upstream facts were read from the Claude Code 2.1.287 binary and cross-checked against docs; adapter facts from the 5.0.0 tarball.

**Must have (table stakes, all P1):**

- TS-1 delivery to `mcp-adapter.json`, with a JSONC-safe read and a grown NFR-10 write set.
- TS-2 + TS-4 upstream naming and a pinned per-server `toolPrefix`.
- TS-3 `directTools: "search"` (map `alwaysLoad: true` to `directTools: true`).
- TS-5 automatic migration on `/reload` (NFR-2, NFR-3).
- TS-6 + TS-7 variable parity: install-time `${CLAUDE_PLUGIN_ROOT}`/`DATA`/project-scope `PROJECT_DIR`; plain `${VAR}` left for the adapter at runtime; `${VAR:-d}` rewritten at install time; leading `!` escaped as `!!`; Claude's field set only (not a deep walk); missing-variable warnings.
- TS-8 collision walk following the adapter's nine sources, last-wins, overlay-aware (closes MCPSRC-01).
- TS-9 carry user adapter overrides through re-stage.
- TS-10 adapter-only detection pinned by a built-in-only negative test.
- TS-11 dependency floors.
- D-1 live adapter status in `info` (a stated milestone target).

**Should have (P2/P3):**

- D-2 hooks-bridge Claude-form tool-name mapping (cheap once G-1 is decided).
- D-3 server `description` from the manifest.
- D-4 field translation (`sse` -> `httpTransport`, `request_timeout_ms`, OAuth callback port).

**Defer:**

- D-5 PreToolUse parity through the adapter approval broker (separate hooks milestone).
- Upstream adapter requests: a `__` tool-separator mode (G-1) and `:-` support (G-2).
- Credential blanking for Pi provider keys (G-5).

**Rejected as anti-features:** `registerMcpServer()` delivery, dual-writing `mcp.json` and `mcp-adapter.json`, install-time resolution of every `${VAR}` (writes secrets to disk), `literalEnv: true` everywhere, runtime `:-` via `!printf`, pre-approving project servers, polling or connecting servers for status, importing the adapter's `./config` at runtime.

### Architecture Approach (ARCHITECTURE.md)

Keep the MCP bridge's prepare/commit/abort triplet, replacement handles and MC-5 marker (byte-stable). Use the file location as the version discriminator: entries in legacy `mcp.json` are untranslated, entries in `mcp-adapter.json` are translated, so the translator runs exactly once per move with no persisted flag (COMPAT-01 forbids a new persisted key). The migration runs as a sibling reconcile step shaped like `backfill.ts`, with its own `withStateGuard`, before `applyPlan` in each scope.

**Major components:**

1. `bridges/mcp/adapter-doc.ts` (new): JSONC-tolerant read, `mcpServers` vs `mcp-servers` key alias, refuse-not-replace on unparseable input, preserves every foreign key.
2. `bridges/mcp/adapter-entry.ts` (new): one pure translator shared by stage and migrate (name, expansion/escape, `directTools: "search"`, `toolPrefix`); marker stamped by the caller.
3. `bridges/mcp/migrate.ts` + `orchestrators/reconcile/mcp-migration.ts` (new): bridge does the two-file move with snapshot rollback and returns a rename map; the orchestrator writes `state.json` through `withStateGuard`/`tx.save`.
4. `platform/mcp-status.ts` (new): consumer-owned typebox mirror of the status snapshot, created in `index.ts` and injected through `EdgeDeps` (like `completionCache`) into `orchestrators/plugin/info.ts`.
5. `domain/name.ts::generatedMcpServerName` (new): the single name builder, used by the translator, `info`, the status join and hook mapping.
6. Modified: `persistence/locations.ts` (`mcpAdapterJsonPath`; `mcpJsonPath` becomes legacy read + sweep), `stage.ts` / `unstage.ts` (adapter target, sweep both files), `collision-slots.ts` (nine-source, last-wins), `substitute.ts`, `prune-rollback.ts` (snapshot the new file), `platform/pi-api.ts` (adapter-only probe), notification types, grammar and `docs/output-catalog.md`.

Key patterns: overlay-aware ownership partition (an entry with no `command`/`url`/`socket` is an overlay, not a collision); marker-keyed unstage (survives the rename); injected event source, never a module global; names minted in `domain/` only. The NFR-10 write set grows rather than swaps: `mcp-adapter.json` is added and `mcp.json` stays for the sweep.

### Critical Pitfalls (PITFALLS.md)

1. **JSONC wipe.** The adapter accepts comments, trailing commas and a BOM; today's `readScopedDoc` reads such a file as malformed and replaces it, destroying `settings`, `imports`, `claudePlugins` and hand-written servers. Parse with the adapter's grammar and refuse (typed error) on unparseable input. Also write into whichever of `mcpServers` / `mcp-servers` exists, or the user's servers vanish.
2. **Half-migrated duplicates and two-`/reload` convergence.** Add to `mcp-adapter.json` first, then remove from `mcp.json`; make the pass a content-keyed fixed point; do not hang it on the backfill gate (it stamps unconditionally, so a partial failure never retries). Pi emits `session_start` before `resources_discover`, so the adapter reads config before our write: the first `/reload` still runs the old entries and the migration notice must carry the reload hint. Inject a fault between the two writes in tests.
3. **Rename orphans per-server state.** OAuth tokens, project approvals (hash of the whole entry), `/mcp-adapter disable` overrides, `allowedServers` and pi-subagents `mcp:<server>` overrides all key on the name or definition. Rename once; the migration notice lists `old -> new`; never touch cache, keyring or approval files (NFR-10); write only when bytes change.
4. **Second expansion by the adapter.** `command`, `args`, `cwd` and `url` have no escape; `env`/`headers`/`bearerToken` escape only `!` via `!!`. Build a per-field matrix and test it against the pinned adapter's real functions, not a re-typed copy. Warn where no escape exists; do not claim parity.
5. **Secrets and the credential deny-list.** Never persist an environment value; apply Claude's deny-list (`ANTHROPIC_API_KEY` etc.) in `url` and `headers` and test it as a security control. This phase needs a threat model.
6. **Overlays on our names.** `/mcp-adapter disable` and the panel write stubs and copies into the files we now own; they cause false collisions and are reverted by whole-entry replacement on update. Overlay rule in the walk plus a closed carry-forward field list.
7. Also load-bearing: normalized names can still collide (`-` vs `_` folding), exceed 64 characters (unmeasured on Pi 1.0), and miss hook matchers; detection should add a `pi.getCommands()` `mcp-adapter` arm because `/mcp` ownership is no longer a signal; status is push-only and lazy servers rest at `cached`/`not-connected`; features/mcp fixes must be re-implemented, not cherry-picked (pins are line:col and merge-fragile; pi-subagents tests skip silently without `PI_SUBAGENTS_ROOT`).

## Implications for Roadmap

The four files agree on one dependency spine, with differences only in granularity. ARCHITECTURE.md gives six phases (floor+detect, adapter-file foundation, translation, migration, status, close-out). PITFALLS.md splits the same work into eight concerns (FLOOR, DETECT, DELIVER, NAME, VARS, MIGRATE, STATUS, DOCS) and adds the hard ordering rule that MIGRATE follows NAME and VARS with no release between DELIVER and MIGRATE. FEATURES.md puts the floor first (everything needs the Pi 1.0 deferred-tool path) and D-2/D-3/D-4 after validation. The reconciled structure below keeps ARCHITECTURE's six phases, merges DETECT into the floor phase (same file, `pi-api.ts`, pins move once), and keeps NAME and VARS together as the translation phase with an explicit measurement/spike step up front.

### Phase 1: Pi 1.0 floor and adapter-only detection

**Rationale:** Moves contract pins, peer gates and floor literals that every later phase touches; detection lives in `platform/pi-api.ts`, so the pins move once.
**Delivers:** Pi `>=1.0.0`, pi-subagents `>=0.74.0`, all devDeps (TypeScript held), `typescript-eslint` rule resolution, re-implemented features/mcp fixes at the 1.0 floor, `scripts/pi.sh` pins (adapter 5.0.0, pi-subagents 0.74.0, engine 3.13.1), workflow-engine and Stop canaries re-run on Pi 1.0, fallow action SHA, adapter-only `hasLoadedPiMcpAdapter` (exclude `builtin:` sources; consider a `pi.getCommands()` `mcp-adapter` arm), documented adapter floor and the `pi-ai` upstream gap.
**Addresses:** TS-10, TS-11.
**Avoids:** Pitfalls 10, 12, 13 (zero-skip pi-subagents floor run via `PI_SUBAGENTS_ROOT`; re-derived pins; sandboxed `PI_CODING_AGENT_DIR`).

### Phase 2: Adapter-file foundation

**Rationale:** Highest-risk core; it must be correct before entry content changes so failures stay attributable.
**Delivers:** `mcpAdapterJsonPath`; `adapter-doc.ts`; stage/unstage retarget with a legacy sweep of own entries in both files; overlay-aware partition and carry-forward of user fields; nine-source last-wins collision walk (closes MCPSRC-01); prune-rollback snapshot of the new file; NFR-10 text and all gate-referenced paths updated.
**Addresses:** TS-1, TS-8, TS-9.
**Avoids:** Pitfalls 1, 2, 3.

### Phase 3: Entry translation (naming, search, variables)

**Rationale:** Fixes what "translated" means before migration bakes it into users' files; a second rewrite costs users a second round of re-approvals and re-sign-ins.
**Delivers:** `generatedMcpServerName` and `adapter-entry.ts`; `directTools: "search"` and pinned `toolPrefix`; `${VAR:-default}` parity, `!!` escaping, per-field matrix, missing-variable warnings, credential deny-list (closes MENVX-01, ENVLIT-01); `info` manifest arm mapped through the name builder; ENVDOC-01 doc rewrite.
**Addresses:** TS-2, TS-3, TS-4, TS-6, TS-7, optionally D-2/D-3/D-4.
**Avoids:** Pitfalls 6 (rename once), 7, 8, 9.

### Phase 4: Automatic migration on `/reload`

**Rationale:** Needs the final translator, since the file-location-as-discriminator pattern applies it exactly once per move.
**Delivers:** `bridges/mcp/migrate.ts`; `reconcile/mcp-migration.ts` (own lock, called first per scope, before `applyPlan`); record renames in `state.json`; add-then-remove ordering; orphan and panel-copy handling; migration notice listing `old -> new`, re-sign-in and re-approval hints, and the reload trailer.
**Addresses:** TS-5.
**Avoids:** Pitfalls 3 (panel copies), 4, 5, 6.

### Phase 5: Live status in `info`

**Rationale:** Independent of migration; needs only final names. Can run in parallel with Phase 4.
**Delivers:** `platform/mcp-status.ts` created in the factory and injected through `EdgeDeps`; `info` join; amended notification vocabulary and `docs/output-catalog.md`; explicit "unknown" before the first snapshot and after the empty shutdown snapshot; lazy resting states rendered as normal.
**Addresses:** D-1.
**Avoids:** Pitfall 11.

### Phase 6: Close-out and live proof

**Rationale:** Unit tests prove we wrote the file; only a real adapter 5 proves it accepts it.
**Delivers:** README and docs (NFR-10, hooks-compatibility claim, exclusive mode, `--mcp-config`, `MCP_DIRECT_TOOLS`, project-trust prompts), live UAT in a sandboxed agent dir (adapter reads our file; seeded legacy migration with reload counting; `info` shows `connected`/`cached`; `tool_search` finds search tools with `builtin:tool-search` loaded), CHANGELOG, version-bump offer.

### Phase Ordering Rationale

- Floor first because it moves pins every later phase touches and gates the deferred-tool path.
- Foundation before translation so file-handling failures are not confused with content failures.
- Translation before migration because migration must not run until the entry shape is final (name, `directTools`, escaping all change approval hashes and OAuth keys). Ship Phases 2 to 4 in one release.
- Status after final names, parallel with migration.
- Extract into `adapter-doc.ts` and `adapter-entry.ts` up front: `stage.ts` (436 lines) sits near the fallow `maxUnitSize: 60` / cognitive-15 ceilings.

### Research Flags

Needs deeper research during planning:

- **Phase 3:** Claude Code normalization and expansion rules, the escape matrix against the pinned adapter, the 64-character tool-name behavior on Pi 1.0, the G-1 tool-name decision. Needs a measurement step and a threat model (secrets, deny-list).
- **Phase 2:** the overlay carry-forward field list and the comment-preservation question.
- **Phase 4:** the one-reload lag, orphan handling and panel-copy reconciliation, a fault-injection design.

Standard patterns (skip research-phase):

- **Phase 1:** mechanical; STACK.md has measured commands and a per-commit change table.
- **Phase 5:** established injected-collaborator and closed-catalog amendment patterns.
- **Phase 6:** docs and UAT recipe; the live-canary scratch-engine route is known.

## Open Decisions for Requirements

Not decided; each needs an operator or planning decision. Recommendation noted where the research gives one.

1. **G-1 exact tool-name form.** Adapter `mcp` mode yields `mcp__<server>_<tool>` (single underscore); Claude yields `mcp__<server>__<tool>`. Option A (recommended by FEATURES): clean key plus hooks-bridge mapping of the known generated server names (D-2) plus an upstream adapter request. Option B (noted in ARCHITECTURE): a trailing-underscore server key (`plugin_<p>_<s>_`) with `toolPrefix: "mcp"` for exact names with no translation layer, at the cost of a trailing `_` on every adapter surface and reliance on an undocumented `formatToolName` quirk. Decide before Phase 3: changing names twice costs two sets of re-sign-ins. Needs `claude-code-compat-research` to confirm the Claude plugin tool form (MEDIUM in ARCHITECTURE).
2. **Lifecycle (G-9).** Claude keeps plugin servers connected for the session; the adapter defaults to `lazy` with a 10-minute idle shutdown. Choose `keep-alive` (closest to upstream), leave unset (silent divergence), or per-server. Ask the user.
3. **`${VAR:-default}` timing (G-2).** Install-time rewrite at stage (FEATURES/ARCHITECTURE recommendation; value frozen until reinstall or update), versus PITFALLS' variant of re-rendering at reconcile time (tracks env at `/reload` granularity but rewrites the file when env changes, invalidating project approval hashes, and flips between terminals with different env). Also decide how missing `${VAR}` (adapter gives `""`, Claude keeps literal) and user-scope `${CLAUDE_PROJECT_DIR}` (G-12: adapter expands the leftover literal to `""`; T-92-06 assumed literal) are handled.
4. **Overlay fields preserved on re-stage.** At least `disabled`; candidates `includeTools`, `excludeTools`, `approveTools`, `lifecycle`, `idleTimeout`, `requestTimeoutMs`, `searchKeywords`, `debug`; `directTools` and `toolPrefix` only if they differ from what we last wrote (needs recording of stamped values). Keep the set closed (optional-field silent-omission class), record a decision ID, pin against the adapter's `ServerEntry`. Also whether to drop the whole entry on unstage (recommended) and leave unmarked overlays alone.
5. **Orphan legacy entries.** A marked `mcp.json` entry with no owning record in that scope: leave in place with a warning (recommended: a moved orphan is unremovable by any lifecycle op) or move.
6. **Optional peerDependency for the adapter.** `pi-mcp-adapter >=5.0.0` as an optional peer plus README (STACK recommendation, pi-subagents precedent, machine-readable floor), or README-only (if D-98-10 is read as covering peers; then add a doc-pin test).
7. **`engines.node` floor.** Still `>=20.19.0` (NFR-4), but Pi (`>=22.19.0`) and `write-file-atomic@8` already make it unreachable. Raising it touches NFR-4; not milestone scope by default.
8. **typescript-eslint new-rule error.** `no-unsafe-enum-assignment` fires once at `shared/notify-context.ts:345:30`. Fix in code, or disable in `eslint.config.js` with an inline justification, before the bump lands.
9. **TypeScript held at `^6.0.3`.** Confirm the exception to "bump all devDeps". Revisit when typescript-eslint admits 7.x and the compiler-API scripts move.
10. **Reload ordering (G-13, Pitfall 5).** Writes from `resources_discover` reach the adapter one reload late. Recommended: accept two-step convergence, put the reload hint in the migration notice, count reloads in UAT. The alternative (migrate in the extension factory) has no `ctx`, no notify and no stable order, and needs a spike.
11. **Migration announcement.** Silent (RECON-05 style) or one notice listing renames, re-sign-ins (OAuth keyed by name) and project re-approval. Research recommends announcing.
12. **Comment handling on rewrite.** Our writer and the adapter's own both drop JSONC comments. Warn once, or add a comment-preserving editor (`jsonc-parser`, a new runtime dependency). Also whether to keep a sibling `.bak` before the first write to a file we did not create.
13. **Migration source.** Re-stage from the cached plugin source (offline, NFR-5-safe, recommended default) versus in-place transform; the verbatim move only when the clone is gone.
14. **Detection depth.** Add a `pi.getCommands()` `mcp-adapter` arm and handle `disableProxyTool` and fork installs (Pitfall 10), or keep the tool-name and source probe with the built-in negative test only.
15. **Scope of P2/P3 features.** D-2 hooks mapping (depends on item 1), D-3 `description`, D-4 field translation (`sse`, timeouts, OAuth callback port; warn for `ws` and `headersHelper`): in or out of mcp-4.
16. **Tool names over 64 characters (G-11).** Measure on Pi 1.0 before Phase 3 planning; decide warn, refuse or ignore.
17. **`_meta["anthropic/alwaysLoad"]` per tool (G-6), credential blanking (G-5), project-trust re-prompts (G-10).** Likely document-only; confirm.
18. **Containment through symlinked config files.** `write-file-atomic` follows `realpath`; decide whether the NFR-10 check runs on the real path.
19. **Scope of ported review findings from features/mcp.** IN-03 (seed `toolInfo` fixture), IN-04, IN-05 (RPC harness) and the open Stop-canary findings: deliberate scope or deferred.
20. **Spike directory.** Rename or relocate the features/mcp spike dir named after the abandoned milestone (and its README paths) when re-applying `4f82096f`.
21. **When `mcp.json` leaves the NFR-10 write set.** Later milestone, after the migration window.

## Confidence Assessment

| Area         | Confidence    | Notes                                                                                                                                                                                                                    |
| ------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stack        | HIGH          | Versions read from the registry; compatibility executed in scratch copies of HEAD (tsc, unit, integration, e2e, fallow, eslint). Live canaries on Pi 1.0 not yet run.                                                   |
| Features     | HIGH / MEDIUM | Upstream and adapter behavior read first-hand from the Claude Code 2.1.287 binary and the adapter tarball. Ordering race and design recommendations are MEDIUM. Docs corroborate but the research seam rates WebFetch LOW. |
| Architecture | HIGH / MEDIUM | Seams, gates and adapter behavior read from the repo and tarballs. Hooks/agents naming ripple is MEDIUM until G-1 is decided.                                                                                           |
| Pitfalls     | HIGH / MEDIUM | Adapter and Pi behavior read from source; runtime behaviors not observed (below).                                                                                                                                        |

**Overall confidence:** HIGH for the floor, delivery and the migration design; MEDIUM for naming parity and reload timing.

### Gaps to Address

- **Tool-name length on Pi 1.0 (MEDIUM):** whether Pi truncates or a provider rejects names over 64 characters is unverified. Measure with a long fixture before Phase 3 planning.
- **One-reload lag (MEDIUM):** read in source (`session_start` before `resources_discover`; adapter loads config at factory and in init) but not observed. Prove in live UAT by counting reloads.
- **Claude plugin tool-name form (MEDIUM):** `mcp__plugin_<p>_<s>__<tool>` is corroborated by the binary and docs but flagged unverified in ARCHITECTURE; confirm with `claude-code-compat-research` before settling G-1.
- **`directTools: "search"` under `scripts/pi.sh`:** `--no-extensions` removes `builtin:tool-search` on Pi 0.99+; confirm on 1.0.
- **Adapter fuzzy proxy lookup of Claude-form names:** unverified.
- **Live canaries not run:** the Stop canary and the workflow-engine canary on Pi 1.0 need a live session with the stub provider; ledger 84 (engine subagents get no tools) is still unexplained.
- **Non-test adapter auth store in headless CI:** whether `PI_MCP_ADAPTER_TEST_AUTH_STORE=memory` is needed outside tests was not checked.
- **Concurrent writer:** the adapter rewrites `mcp-adapter.json` with tmp+rename and no shared lock, leaving a lost-update window; keep the read-modify-write span short or document it.

## Sources

### Primary (HIGH confidence)

- npm registry metadata for every package named in STACK.md (2026-10-01/02).
- Unpacked tarballs: `@earendil-works/pi-coding-agent@1.0.0`, `pi-mcp-adapter@4.0.0` and `5.0.0` (docs, `config.ts`, `utils.ts`, `types.ts`, `server-manager.ts`, `index.ts`, `mcp-status.ts`), `pi-subagents@0.74.0`, `@quintinshaw/pi-dynamic-workflows@3.13.0/3.13.1`.
- Scratch copies of HEAD `8b6ac3bc` with Pi 1.0.0 and all bumps: typecheck, unit, integration, e2e, architecture, analyzers, fallow, prettier, eslint, `lint:type-members`.
- Claude Code 2.1.287 binary (naming, expansion pipeline, variable grammar, schemas).
- Repo files and `.planning/BACKLOG.md` (MCPSRC-01, ENVLIT-01, MENVX-01, ENVDOC-01, CFGDIR-01); features/mcp commits `74162ca6`, `5b1d8ef6`, `dac3a245`, `69e0870a`, `4f82096f` and its phase records.

### Secondary (MEDIUM confidence)

- code.claude.com/docs/en/mcp and `/plugins-reference` via WebFetch: corroborate the binary on tool search, expansion fields, credential deny-list and tool naming.
- npm 11.19.1 `--package-lock-only` resolution experiments for the `pi-ai` peer gap.

### Tertiary (LOW confidence)

- None relied on without a primary corroboration.

Detail lives in `.planning/research/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md` and `PITFALLS.md`.

---

*Research completed: 2026-10-01*
*Ready for roadmap: yes, after the operator settles Open Decisions 1 to 3 (naming form, lifecycle, `:-` timing), which gate Phase 3*
