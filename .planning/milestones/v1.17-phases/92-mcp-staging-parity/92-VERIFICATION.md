---
phase: 92-mcp-staging-parity
verified: 2026-08-03T18:14:11Z
status: passed
score: 24/24 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 92: MCP staging parity Verification Report

**Phase Goal:** A plugin's MCP servers are written to `mcp.json` with Claude-Code-equivalent
environment delivery. At stage time the substitution set `${CLAUDE_PLUGIN_ROOT}`,
`${CLAUDE_PLUGIN_DATA}`, and — project-scope installs only — `${CLAUDE_PROJECT_DIR}` is
substituted with real install paths across every string value in each entry (D-92-01
whole-entry deep), and `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` (+ project-scope
`CLAUDE_PROJECT_DIR`) are injected into each stdio-shaped server's `env` (D-92-02),
plugin-declared keys winning. `update`/`reinstall` re-derive on every re-stage so a
plugin-root change never leaves stale paths. Atomic writes (NFR-1), containment (NFR-10).
**Verified:** 2026-08-03T18:14:11Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths — Roadmap Success Criteria

| # | Truth (roadmap SC) | Status | Evidence |
|---|-------|--------|----------|
| 1 | MENV-01: a server whose command/args/env contain the substitution vars is written to `mcp.json` with real paths; user-scope `${CLAUDE_PROJECT_DIR}` is a documented absence | ✓ VERIFIED | `substitute.ts::deepSubstitute` + `buildVarMap`; e2e test `"MENV-01 prepareStageMcpServers substitutes ${CLAUDE_PLUGIN_ROOT} and injects env end-to-end"` (stage.test.ts:127) passes; user-scope arm test `"MENV-03 user scope omits CLAUDE_PROJECT_DIR ..."` passes |
| 2 | MENV-02: every installed server's env carries CLAUDE_PLUGIN_ROOT/DATA; declared keys win | ✓ VERIFIED | `substituteAndInject`: `{ ...injected, ...declared }` (substitute.ts:120); tests `"MENV-02 stdio env carries ..."`, `"MENV-02 plugin-declared env key wins ..."` pass |
| 3 | MENV-03: project scope injects CLAUDE_PROJECT_DIR=cwd; user scope omits it, documented | ✓ VERIFIED | `buildVarMap` gates `CLAUDE_PROJECT_DIR` on `ctx.scope === "project"` using `ctx.cwd` (not `scopeRoot`); tests `"MENV-03 project scope ..."` / `"MENV-03 user scope ..."` (with `locationsFor("user", cwd)` real-scope fixture) pass |
| 4 | MENV-04: update/reinstall re-derive on every re-stage — a plugin-root change leaves no stale path | ✓ VERIFIED | All 3 lifecycle call sites (install.ts:1072-73, update.ts:1176-77, reinstall.ts:1534-35) thread freshly-resolved `pluginRoot`/`pluginData`; test `"MENV-04 re-stage with new pluginRoot leaves no stale path"` asserts the serialized doc contains no substring of the old root; idempotency and theirs-verbatim tests also pass |

### Observable Truths — Plan-level must_haves (92-01, 92-02)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | D-92-01 whole-entry deep substitution (command/args/env/cwd/headers/url, any nesting) | ✓ VERIFIED | `deepSubstitute` recurses arrays/objects generically; substitute.test.ts asserts nested `cwd`/`headers`/`nested.deep` all substituted |
| 6 | Adjacency: two adjacent tokens each resolve once; a value containing another var's token is not re-expanded (T-03-01) | ✓ VERIFIED | Single-pass alternation regex + function replacer (substitute.ts:36-44); substitute.test.ts adjacency/cross-variable tests pass |
| 7 | Empty/non-string leaves handled (empty string, empty array, number/bool/null pass through; empty servers map noop) | ✓ VERIFIED | `deepSubstitute` type-branches on string/array/object/else; substitute.test.ts + existing AS-8 noop test (stage.test.ts) pass |
| 8 | Literal insertion: `$`/`{`/`}`/backslash/unicode preserved, no `$n` pattern expansion | ✓ VERIFIED | Function replacer (not string-literal replacement) guarantees literal insertion; substitute.test.ts encoding tests pass |
| 9 | Key + array order preserved through the walk | ✓ VERIFIED | `deepSubstitute` rebuilds via `Object.entries` iteration order + `Array.prototype.map`; substitute.test.ts ordering test passes |
| 10 | Non-object server entry still becomes `{}` + marker, no substitution attempted | ✓ VERIFIED | `stampServers`'s existing type-guard (stage.ts:161-164) preserved; unaffected pre-existing test still passes |
| 11 | `StageMcpInput` carries `pluginRoot`/`pluginData`; all 3 lifecycle sites thread them (MENV-04 seam) | ✓ VERIFIED | types.ts:61,63 required fields; `npx tsc --noEmit` green (forces all 3 call sites); grep confirms threading in install/update/reinstall.ts |
| 12 | Declared env key colliding with an injected key wins, appearing once | ✓ VERIFIED | `{ ...injected, ...declared }` spread order; test `"MENV-02 plugin-declared env key wins over injected default"` passes |
| 13 | Empty/malformed env (`{}`, non-object) both receive injected keys; injection targets stdio only | ✓ VERIFIED | `isPlainObject(substituted.env) ? substituted.env : {}` (substitute.ts:118); test `"MENV-02 stdio entry without env gains injected keys; malformed env treated as absent"` passes |
| 14 | Injected env keys written in deterministic order (ROOT, DATA, then PROJECT_DIR for project scope), declared spread last | ✓ VERIFIED | `injected` object literal order (substitute.ts:113-117); ordering assertion in stage.test.ts passes |
| 15 | D-92-02: url/http/sse entry (no `command`) keeps declared env untouched, never gains a synthesized env; substitution still applies | ✓ VERIFIED | Gate `typeof substituted.command !== "string"` returns early (substitute.ts:109-111); tests `"D-92-02 url-type entry ..."` (both variants) pass |
| 16 | User-scope install omits `CLAUDE_PROJECT_DIR` entirely — token passes through, no env key injected | ✓ VERIFIED | `buildVarMap` omits the map key for user scope; token falls through `map.get(name) ?? whole`; test asserts `"CLAUDE_PROJECT_DIR" in env` is false |
| 17 | In project scope, `CLAUDE_PROJECT_DIR` injected after `CLAUDE_PLUGIN_ROOT`/`DATA` | ✓ VERIFIED | Object literal spread order in `injected` (substitute.ts:113-117); ordering test passes |
| 18 | Re-staging with a changed pluginRoot writes new paths, no substring of the prior root survives | ✓ VERIFIED | Test `"MENV-04 re-stage with new pluginRoot leaves no stale path"` asserts `JSON.stringify` excludes the old-root substring |
| 19 | Re-staging with the SAME pluginRoot is idempotent (byte-identical output, no double-substitution) | ✓ VERIFIED | Test `"MENV-04 re-stage with same pluginRoot is idempotent"` asserts byte-identical serialized docs; substitution always runs on source servers (never mcp.json read-back) — confirmed by code read (`stampServers(servers, ...)` where `servers` = `input.servers`, never `existing`) |
| 20 | Foreign (theirs) entries survive a re-stage verbatim, gain no injected env | ✓ VERIFIED | `partitionExistingServers` merges `theirs` verbatim via `safeSet` (no transform applied); test `"MENV-04 re-stage preserves foreign (theirs) entries verbatim"` passes |
| 21 | Object keys never substituted — only string values | ✓ VERIFIED | `deepSubstitute` copies keys via `Object.entries` iteration, only recursing values; substitute.test.ts `"WR-01 a literal __proto__ key survives ..."` and a dedicated key-immutability test both confirm |
| 22 | `_piClaudeMarketplace` marker never walked/substituted; stamped after the transform | ✓ VERIFIED | `stampServers` calls `substituteAndInject(entryObj, subCtx)` BEFORE spreading `[CLAUDE_MARKETPLACE_MARKER_KEY]: marker` (stage.ts:161-168) |
| 23 | `shared/vars.ts::substituteClaudeVars` not extended/reused for MCP substitution | ✓ VERIFIED | `git diff` / `grep` confirms `shared/vars.ts` untouched by this phase; `substitute.ts` is a wholly separate bridge-local module |
| 24 | Backstop — concurrency: single atomic commit path unchanged, substitution pure/in-memory before commit, no new interleaving surface | ✓ VERIFIED (evidence-backed backstop) | `shared/atomic-json.ts` has zero commits/diffs since phase start; `commitPreparedMcp` still issues exactly one `atomicWriteJson` call (stage.ts:273); `substituteAndInject`/`deepSubstitute` are pure functions producing an in-memory `_nextDoc` consumed only by that single write — no new write surface introduced |

**Score:** 24/24 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/bridges/mcp/substitute.ts` | Bridge-local deep-substitution + env-injection engine | ✓ VERIFIED | Exports `McpSubstitutionContext`, `deepSubstitute`, `substituteAndInject`; substantive (122 lines), wired into `stage.ts` |
| `extensions/pi-claude-marketplace/bridges/mcp/safe-set.ts` | `__proto__`-safe key-copy helper (review fix) | ✓ VERIFIED | New file; used by `substitute.ts`, `stage.ts` (2 sites), `unstage.ts` |
| `extensions/pi-claude-marketplace/bridges/mcp/types.ts` | `StageMcpInput.pluginRoot`/`pluginData` required fields | ✓ VERIFIED | Lines 61, 63 |
| `extensions/pi-claude-marketplace/bridges/mcp/stage.ts` | `stampServers` takes `subCtx`; calls `substituteAndInject` pre-marker | ✓ VERIFIED | Lines 149-172, 220-226 |
| `extensions/pi-claude-marketplace/orchestrators/plugin/{install,update,reinstall}.ts` | Thread `pluginRoot`/`pluginData` at the `prepareStageMcpServers` call site | ✓ VERIFIED | install.ts:1072-73, update.ts:1176-77, reinstall.ts:1534-35 |
| `tests/bridges/mcp/substitute.test.ts` | Pure-walker unit suite | ✓ VERIFIED | 15+ tests, all pass |
| `tests/bridges/mcp/stage.test.ts` | e2e tracer + MENV-02/03/04 coverage | ✓ VERIFIED | Extended to 30+ MCP-specific tests (48 combined with substitute.test.ts in this run), all pass |
| `extensions/pi-claude-marketplace/bridges/mcp/unstage.ts` | WR-01 `safeSet` consolidation (review fix, out-of-plan-scope but same subsystem) | ✓ VERIFIED | `safeSet` routed at line 89; regression test in `tests/bridges/mcp/unstage.test.ts` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `stampServers` | `substituteAndInject` → `deepSubstitute` | Marker stamped after the transform | ✓ WIRED | stage.ts:161-168 — substitution runs first, marker spread last |
| `prepareStageMcpServers` | `McpSubstitutionContext` | Derived from `input.pluginRoot`/`pluginData`/`locations.scope`/`input.cwd` | ✓ WIRED | stage.ts:220-225 |
| `install.ts` / `update.ts` / `reinstall.ts` | `StageMcpInput.pluginRoot` + `pluginData` | Direct field pass at call site | ✓ WIRED | Confirmed at all 3 call sites; `npx tsc --noEmit` green (compile-enforced) |
| `prepareStageMcpServers` | Source `servers` (never mcp.json read-back) | `stampServers(servers, ...)` operates on `input.servers`, not `existing` | ✓ WIRED | stage.ts:194 / 226 — `existing` (from `readScopedDoc`) feeds only the ours/theirs partition, never the substitution input |

### Behavioral Spot-Checks / Test Execution

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full MCP bridge unit suite | `node --test tests/bridges/mcp/substitute.test.ts tests/bridges/mcp/stage.test.ts` | 48 pass, 0 fail | ✓ PASS |
| Unstage regression (WR-01 fix) | `node --test tests/bridges/mcp/unstage.test.ts` | 8 pass, 0 fail | ✓ PASS |
| Typecheck (proves all 3 call sites threaded) | `cd extensions/pi-claude-marketplace && npx tsc --noEmit` | clean, no output | ✓ PASS |
| Full workspace check | `npm run typecheck && npm run lint && npm run format:check && npm test` | 3210 pass / 0 fail / 1 skip; lint + format clean | ✓ PASS |
| Integration suite | `npm run test:integration` | 16 pass / 2 fail | ⚠️ 2 pre-existing, unrelated failures (see below) |

**Integration-suite failure detail:** `tests/integration/provenance-invisibility.test.ts` and
`tests/integration/skill-path-resolution.test.ts` fail locally — both resolve the optional
`pi-subagents` peer via `npm root -g` and depend on the globally-installed package version.
Both files predate this phase (last touched in commit `58c7aa2a`, an agents/skills provenance
change unrelated to MCP staging) and concern pi-subagents' own frontmatter/skill-path
resolution, not `bridges/mcp/*`. This matches a previously-recorded environment issue
(stale global `pi-subagents` peer) and is not a regression introduced by Phase 92 — confirmed
by reading both files (no MCP/substitution code path is exercised) and by the file history
predating this phase's commits.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| MENV-01 | 92-01 | Deep whole-entry substitution to real install paths | ✓ SATISFIED | `substitute.ts`, e2e tracer test |
| MENV-02 | 92-02 | env carries CLAUDE_PLUGIN_ROOT/DATA; declared wins | ✓ SATISFIED | Injection tests, `{ ...injected, ...declared }` |
| MENV-03 | 92-02 | Project scope injects CLAUDE_PROJECT_DIR=cwd; user scope documented absence | ✓ SATISFIED | Scope-arm tests |
| MENV-04 | 92-02 | update/reinstall re-derive; no stale path | ✓ SATISFIED | Re-derivation/idempotency/theirs tests, threaded call sites |

No orphaned requirements — REQUIREMENTS.md maps exactly MENV-01..04 to Phase 92, and all four
appear in the plans' `requirements` frontmatter. (REQUIREMENTS.md's tracking table still shows
these rows as "Pending" — this is milestone-close bookkeeping not yet updated, not a code gap.)

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None found (no TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER/stub markers in any phase-modified MCP bridge file) | — | — |

Code review (`92-REVIEW.md`) converged to `status: clean` after 3 iterations; the one WARNING
(WR-01, a `__proto__`-key data-loss defect on the unstage path, adjacent to but outside this
phase's plan scope) was fixed in commit `022b782d` with a regression test, confirmed present in
`unstage.ts`/`unstage.test.ts` above. The two remaining INFO items (non-object `env` silent
coercion; a docstring wording nit) are explicitly intentional/non-blocking per the review.

### Human Verification Required

None. `92-VALIDATION.md` declares every phase behavior automatable (no manual-only rows), and
all must-haves — including the MENV-04 concurrency backstop — are confirmed by direct code
evidence or passing tests.

### Gaps Summary

No gaps. All roadmap success criteria (MENV-01..04) and all plan-level must-haves (truths,
artifacts, key links, prohibitions, and the concurrency backstop) are verified against the
actual codebase at HEAD, including the post-SUMMARY review-fix commits
(5a408484, 35ba7cc7, 022b782d) that consolidated the `__proto__`-safety fix across all four
parsed-key assignment sites in the MCP bridge (`deepSubstitute`, `partitionExistingServers`,
`stampServers`, `unstageMcpServers`). `npm run check`'s two integration-test failures are a
documented, pre-existing, environment-only issue (stale global `pi-subagents` peer) in files
unrelated to MCP staging, last touched by a commit that predates this phase.

---

_Verified: 2026-08-03T18:14:11Z_
_Verifier: Claude (gsd-verifier)_
