---
phase: 63-lifecycle-cascade-user-facing-surface-docs
verified: 2026-06-16T17:30:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  gaps_closed:
    - "Hook files live under <scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json (NFR-10 extension); a symlinked-escape command path is rejected at install with a notify error via fs.realpath + assertPathInside(<pluginRoot>, realpath) (LIFE-03; NFR-10)."
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
---

# Phase 63: Lifecycle Cascade, User-Facing Surface & Docs Verification Report

**Phase Goal:** Hook install/uninstall flows through the v1.12 reconcile cascade, `info <plugin>` and `(unavailable) {unsupported hooks}` rows render correctly, and a first-time reader can find and understand the hook-support story in `docs/hooks.md`.

**Verified:** 2026-06-16T17:30:00Z (re-verification after 63-08 gap closure)
**Status:** passed
**Re-verification:** Yes — after CR-01 gap closure landed in plan 63-08. Previous run (2026-06-16T15:18:09Z) was `gaps_found` 6/7; Truth #2 was FAILED on CR-01 (unsafe `readdir({recursive:true})` symlink walker). Plan 63-08 replaced the walker with a hand-rolled `lstat`-based stack walk and tightened the regression assertions; Truth #2 now VERIFIED.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Installing or uninstalling a plugin with hooks emits a NotificationMessage plugin row through the existing v1.4 cascade (no new top-level notify pattern; no new state-change tokens) and triggers the existing /reload hint cascade (LIFE-01, LIFE-02). The 5th bridge slot appears in transaction/runPhases.ts (plan/stage/unstage/discover mirrors the existing cascade shape). | VERIFIED | `install.ts:850-857` 6-element phases literal `[skillsPhase, commandsPhase, agentsPhase, hooksPhase, mcpPhase, statePhase]`; `install.ts:713-746` `hooksPhase` definition. `update.ts:1308-1337` Phase 3a commit-loop hooks slot between agents and mcp; `update.ts:855` `PHASE3_FAILURE_PHASES = ["skills","commands","agents","hooks","mcp"] as const`. `reinstall.ts:1297` `commitHooks(hooks)` between agents and mcp; `commitHooks` at `reinstall.ts:1322-1345`. `marketplace/shared.ts:374-377` `removeHookConfig` call between agents foreign-content guard and mcp unstage in `cascadeUnstagePlugin`. `tests/transaction/lifecycle-cascade.test.ts` end-to-end install→update→reinstall→uninstall integration test green; baseline `npm test` 2273 pass / 0 fail / 1 skip preserved. No new top-level notify variant; no new STATUS_TOKENS. |
| 2 | Hook files live under <scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json (NFR-10 extension); a symlinked-escape command path is rejected at install with a notify error via fs.realpath + assertPathInside(<pluginRoot>, realpath) (LIFE-03; NFR-10). | VERIFIED | Per-plugin path layout: `hookConfigPathFor(locations, plugin) = path.join(locations.hooksDir, plugin, "hooks.json")` at `stage.ts:34-36`. Write path is `atomicWriteJson` (NFR-1) gated by `assertSafeName` and `assertPathInside(hooksDir, target, ...)`. **CR-01 CLOSED in plan 63-08 (commits ba6632d test + 9c347d1 fix):** `assertNoSymlinkEscapeInHooksSubtree` (stage.ts:67-108) now uses a hand-rolled stack walk — `const stack: string[] = [hooksRoot]` loop, `readdir(dir, { withFileTypes: true })` ONE LEVEL at a time via `readEntriesOrSkip`, `lstat(linkPath)` per entry. Symlink entries are fed through `assertSymlinkEntryContained` (realpath + assertPathInside chokepoint preserved verbatim) and then `continue`-d past — never pushed onto the stack. Verified by greps: `grep "recursive: true" stage.ts` returns 0 matches in the walker (only matches are `rm({recursive:true,force:true})` at line 231 and JSDoc references to the removed pattern); `grep "lstat" stage.ts` returns 4 hits including the import at line 15 and the per-entry call at line 91; `grep "assertPathInside(pluginRoot" stage.ts` returns 2 hits (chokepoint at line 143 + JSDoc); `grep "SymlinkRefusedError" stage.ts` returns 8 hits (import + rejection class). Regression assertions in `tests/bridges/hooks/symlink-escape.test.ts` Case A (lines 50-123) now pin: (i) `subjectMatch[1] === expectedInTreePath` — rejection SUBJECT is the IN-TREE symlink path `<pluginRoot>/hooks/sub/escape` parsed from the error message via `/hooks subtree symlink (\S+)\s/`; (ii) sentinel files `sentinel-do-not-read-PROBE` and `deep-sentinel-PROBE` seeded inside `externalDir` are NEVER named in the rejection message (their presence would prove the walker descended through the symlink). All 12 hook-bridge tests (5 symlink-escape Cases A–E + 7 stage write/remove) GREEN against the rewritten walker (spot-checked via `npx tsx --test tests/bridges/hooks/{symlink-escape,stage}.test.ts` — 12 pass / 0 fail). The LIFE-03 INTENT (refuse to read outside pluginRoot) is now fully closed: the walker has no code path that issues an `fs` call against any path outside `<pluginRoot>/hooks/`. |
| 3 | The closed-set REASONS token "hooks" is renamed to "unsupported hooks" at shared/notify.ts::REASONS; every catalog-UAT fixture row (unavailable) {hooks} in docs/output-catalog.md is updated to (unavailable) {unsupported hooks} in lockstep with the source rename and the corresponding byte-equality test cases (HOOK-04 atomic catalog-UAT lockstep). | VERIFIED | This was completed in Phase 58 per D-58-01. Phase 63 confirms by scope-fence test `tests/architecture/scope-fences-63.test.ts:78-94` and source state: `shared/notify.ts:81` `"unsupported hooks"` literal in REASONS tuple; `install.ts:1573` `MANIFEST_FIELD_REASONS = new Set(["lspServers"])` does NOT contain `"hooks"`. Catalog-UAT integration verified via `npm test` green. Plan 63-07 scope-fence test pinned this invariant. |
| 4 | info <plugin> renders a hooks: line per declared hook entry (event + matcher) for installable plugins; hooks slots alphabetically between commands and mcp; unavailable plugins continue to render `components: not resolved` (SURF-01). list does NOT add a hook-count column and no standalone /claude:plugin hooks <plugin> command ships (SURF-04). | VERIFIED | `info.ts:210-230` `projectHookSummaryEntries(parsed: HooksConfig)` projection helper; `info.ts:250-268` `readHookSummaryEntries` disk re-parse seam; `info.ts:269-313` `composeResolvedComponents` hooks branch; `info.ts:299` `hooks?: readonly HookSummaryEntry[]` field in the resolved-components return type. `shared/notify.ts:2672-2679` `COMPONENT_KINDS = ["agents","commands","hooks","mcp","skills"]` 5-tuple; `appendHooksBlock` at `notify.ts:2689` emits 4-space `hooks:` header + 6-space per-entry indent. Integration tests `tests/orchestrators/plugin/info.test.ts:1304-1571` (5 new fixtures) pin: byte form, alphabetical slot between commands/mcp, unavailable contract (no hooks line), legacy 4-kind byte stability, probe-error pass-through. SURF-04 absence pinned by `tests/architecture/scope-fences-63.test.ts` (no `hooks.ts` edge handler under commands/plugin/ or edge/handlers/plugin/; no `hookCount`/`hook_count` literals in `list.ts`). |
| 5 | shared/notify.ts gains a typed HookSummary discriminated model plus a closed-set ClaudeHookEvent tuple (8 bucket-A events); all UI surfaces consume HookSummary (no string re-derivation) (SURF-02). No install-time synthesis-caveat warnings ship in v1.13 (SURF-03 reserved for v1.14+). | VERIFIED | `shared/notify.ts:186-196` `ClaudeHookEvent` 8-member literal-union; `notify.ts:198-200` `HookSummaryEntry` discriminated union; `notify.ts:202-204` `HookSummary` interface. `domain/components/hook-events.ts` `BUCKET_A_EVENTS` and `TOOL_EVENTS` carry `as const satisfies readonly ClaudeHookEvent[]` pin (single source of truth). `appendHooksBlock` reads `entry.event` and `entry.matcher` directly via `"matcher" in entry` structural discriminator (no string re-derivation). SURF-03 absence pinned by `tests/architecture/scope-fences-63.test.ts` Test 1 (zero `"lossy synthesis"` / `"<lossy synthesis>"` / `"LOSSY_SYNTHESIS"` tokens in `shared/notify.ts`). |
| 6 | A plugin declaring rewakeMessage or rewakeSummary without asyncRewake: true emits one install-time warning (no-op upstream); plugins with asyncRewake: true install normally with no warning (SURF-05). | VERIFIED | `shared/notify.ts:112` `REASONS` tuple += `"orphan rewake"`. `domain/resolver.ts:721-736` `detectOrphanRewake` helper. `resolver.ts:770-775` `applyHooksConfig` writes `partial.orphanRewake = true` only on parse-success branch. `resolver.ts:78,98` `ResolvedPlugin` (both schemas) optional `orphanRewake?: boolean`. `install.ts:1379-1381` cascade-row composition pushes `"orphan rewake"` when `installCtx.resolved.orphanRewake === true`. `PluginInstalledMessage` carries `reasons?: readonly ContentReason[]`. Catalog UAT rows at `docs/output-catalog.md` (3 grep hits for "orphan rewake") and matching byte-equality fixtures at `tests/architecture/catalog-uat.test.ts` (3 grep hits) landed atomically (commit `75871ff`). SC #6 wording specifies "one install-time warning" — the install surface is the canonical place. |
| 7 | docs/hooks.md exists, is linked from README.md's new "Hook support" section, and is written in plain English for first-time readers (plugin authors and end users) — no internal jargon, no bucket-A/D taxonomy, no REQ-IDs / phase numbers, using Claude Code's own field names verbatim. It covers: the 8 supported events with plain descriptions; 4–6 worked examples; the unsupported event groups; the Pi ↔ Claude tool-name mapping table; a "what happens to my plugin?" section; the marketplace coverage note; and cross-references to the two authority docs (SURF-06). | VERIFIED | `docs/hooks.md` exists (257 lines). `README.md:171` `## Hook support` section between `## Configuration files` (line 130) and `## /claude:plugin reference` (line 177); `README.md:175` link `[Hook support reference](docs/hooks.md)`. Jargon prohibition: grep `bucket-[A-Z]\|bucket [A-H]\|REQ-\|D-[0-9]\|<lossy synthesis>\|Pitfall \|Pattern [0-9]` returns 0; `Phase ` returns 0. All 8 BUCKET_A events present verbatim. 6 worked examples present. Two cross-refs present: `code.claude.com/docs/en/hooks` (URL) and `pi-coding-agent` (name only). Architecture-lint test `tests/docs/hooks-doc.test.ts` (8 invariants) green. IN-02 / IN-03 in original review are content-polish nits, not goal-blocking. |

**Score:** 7/7 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `extensions/pi-claude-marketplace/shared/notify.ts` | ClaudeHookEvent / HookSummaryEntry / HookSummary + components.hooks? + 5-tuple COMPONENT_KINDS + hooks renderer arm + REASONS += "orphan rewake" + PluginInstalledMessage.reasons? | VERIFIED | All 4 type exports + 5-tuple at line 2672 + `appendHooksBlock` at line 2689 + REASONS `"orphan rewake"` at line 112 + reasons threading in renderer arm. |
| `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` | writeHookConfig + removeHookConfig + assertNoSymlinkEscapeInHooksSubtree (lstat-based stack walk) + hookConfigPathFor | VERIFIED | `hookConfigPathFor` at 34-36; `assertNoSymlinkEscapeInHooksSubtree` at 67-108 (hand-rolled stack walk, `lstat` per entry, NO `recursive: true`); `readEntriesOrSkip` at 114-125 (ENOENT/ENOTDIR clean continue); `assertSymlinkEntryContained` at 140-162 (realpath + assertPathInside chokepoint + SymlinkRefusedError translation); `writeHookConfig` at 195-206; `removeHookConfig` at 222-234. **CR-01 closed** — walker provably never enumerates outside `<pluginRoot>/hooks/`. |
| `extensions/pi-claude-marketplace/bridges/hooks/index.ts` | barrel re-exports of writeHookConfig + removeHookConfig | VERIFIED | Line 27 `export { writeHookConfig, removeHookConfig } from "./stage.ts";`. |
| `extensions/pi-claude-marketplace/domain/resolver.ts` | detectOrphanRewake helper + partial.orphanRewake assignment in applyHooksConfig + ResolvedPlugin.orphanRewake?: boolean field | VERIFIED | `detectOrphanRewake` at 721-736; `applyHooksConfig` writes `partial.orphanRewake` at 770-775; schemas carry `orphanRewake: Type.Optional(Type.Boolean())` at lines 78 + 98. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | hooksPhase Phase<InstallCtx>; 6-element phases array; orphan-rewake reason wiring; InstallCtx.hooksFileWritten flag | VERIFIED | `hooksPhase` at 713-746; phases array at 850-857; orphan-rewake guard at 1379-1381. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update.ts` | 5th cascade slot in Phase 3a commit loop; PHASE3_FAILURE_PHASES += "hooks"; finalize gating | VERIFIED | Phase 3a slot at 1308-1337; `PHASE3_FAILURE_PHASES` at 855. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` | 5th cascade slot in hand-rolled parallel-prepare/commit | VERIFIED | `commitHooks` at 1322-1345; called at 1297. |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` | cascadeUnstagePlugin hooks unstage between agents and mcp; UnstageOutcome.dropped.hooks field | VERIFIED | `UnstageOutcome.dropped.hooks` at 302; `removeHookConfig` call at 374-377. WR-02 (advisory, unchanged from prior review) flags that `dropped.hooks` is unconditionally populated — non-goal-blocking. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` | composeResolvedComponents hooks branch; projectHookSummaryEntries projection helper | VERIFIED | `projectHookSummaryEntries` at 210-230; `readHookSummaryEntries` at 250-268; `composeResolvedComponents` hooks branch at 269-313. |
| `docs/hooks.md` | first-time-reader hook-support doc (≥150 lines per plan; jargon-free; all 8 events + 6 examples + 2 cross-refs) | VERIFIED | 257 lines; zero internal-jargon tokens; all 8 events + 6 examples + both cross-refs. |
| `README.md` | new ## Hook support section linking to docs/hooks.md | VERIFIED | Line 171 `## Hook support`, line 175 markdown link. |
| `docs/output-catalog.md` | (installed) {orphan rewake} rows for SURF-05 + "unsupported hooks" rows from Phase 58 | VERIFIED | 3 grep hits for "orphan rewake"; "unsupported hooks" rows present. |
| `tests/transaction/lifecycle-cascade.test.ts` | install→update→reinstall→uninstall integration with hooks-declaring plugin | VERIFIED | 273-line integration test; green as part of `npm test` (2273 pass / 0 fail / 1 skip baseline preserved per 63-08-SUMMARY.md). |
| `tests/bridges/hooks/stage.test.ts` | write + remove + idempotent unstage coverage + schema-valid HOOKS_VALUE | VERIFIED | 7 tests green. WR-05 closed in plan 63-08: `HOOKS_VALUE = { PreToolUse: [{ matcher: "Bash", hooks: [...] }] }` (schema-valid top-level shape, parity with `cascade.test.ts:166`). |
| `tests/bridges/hooks/symlink-escape.test.ts` | Cases A–E + tightened in-tree-subject + sentinel-absence assertions | VERIFIED | 5 cases green (12 total when combined with stage.test.ts; spot-checked via `npx tsx --test`). Case A now asserts (i) `subjectMatch[1] === expectedInTreePath` (rejection SUBJECT is the in-tree symlink path), (ii) sentinel filenames `sentinel-do-not-read-PROBE` and `deep-sentinel-PROBE` never surface in the error message (walker provably never enumerates the external tree). WR-05 closed: `HOOKS_VALUE = {}` schema-valid empty record. |
| `tests/architecture/scope-fences-63.test.ts` | SURF-03 absence + SURF-04 non-additions + HOOK-04 prior-completion | VERIFIED | 5 invariant tests green. |
| `tests/docs/hooks-doc.test.ts` | jargon-leak + 8-event coverage + cross-ref + README-link | VERIFIED | 8 invariant tests green. |
| `tests/architecture/catalog-uat.test.ts` | byte-equality fixtures for (installed) {orphan rewake} rows | VERIFIED | 3 grep hits for "orphan rewake"; full catalog UAT green. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `shared/notify.ts` | `domain/components/hook-events.ts` | type re-export of BUCKET_A_EVENTS / TOOL_EVENTS tuples (via `as const satisfies readonly ClaudeHookEvent[]` pin) | WIRED | Producer-side satisfies pin enforces drift detection at typecheck time. |
| `bridges/hooks/stage.ts` | `shared/path-safety.ts` | assertPathInside call per symlink entry + write-target containment | WIRED | `assertPathInside(pluginRoot, resolved, ...)` chokepoint at line 143; `assertPathInside(locations.hooksDir, target, ...)` at write site. SymlinkRefusedError / PathContainmentError translation block preserved at 140-162. |
| `bridges/hooks/stage.ts` | `node:fs/promises` | `lstat` per entry — distinguishes symlink from real dir without following it | WIRED | Import at line 15; call at line 91. |
| `bridges/hooks/stage.ts` | `shared/atomic-json.ts` | atomicWriteJson call for hooks.json | WIRED | 1 call site at line 203 (NFR-1). |
| `bridges/hooks/stage.ts` | `domain/name.ts` | assertSafeName guard on plugin name before path.join | WIRED | 2 call sites (`writeHookConfig` + `removeHookConfig`). |
| `orchestrators/plugin/install.ts` | `bridges/hooks/stage.ts` | hooksPhase.do calls writeHookConfig; .undo calls removeHookConfig | WIRED | Imports + calls at hooksPhase definition. |
| `orchestrators/marketplace/shared.ts` | `bridges/hooks/stage.ts` | cascadeUnstagePlugin calls removeHookConfig | WIRED | Call at line 376. |
| `orchestrators/plugin/install.ts` | `domain/resolver.ts` | reads resolved.orphanRewake | WIRED | Guard at 1379. |
| `orchestrators/plugin/info.ts` | `domain/components/hooks.ts` | parseHooksConfig re-parse of hooks.json | WIRED | Import at line 20; call inside `readHookSummaryEntries` at line 262. |
| `README.md` | `docs/hooks.md` | markdown link [Hook support reference](docs/hooks.md) | WIRED | Line 175. |
| `docs/hooks.md` | `code.claude.com/docs/en/hooks` | Further reading bullet (URL) | WIRED | 1 grep hit. |
| `docs/hooks.md` | `@mariozechner/pi-coding-agent` | Further reading bullet (package name) | WIRED | 1 grep hit. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `composeResolvedComponents` hooks branch | `components.hooks?: readonly HookSummaryEntry[]` | `readHookSummaryEntries(pluginRoot, resolved.hooksConfigPath)` reads `<pluginRoot>/<hooksConfigPath>` and projects via `projectHookSummaryEntries(parsed.value)` | YES — chain reads on-disk bytes through the validator | FLOWING |
| `appendHooksBlock` rendering | `entries[i].event`, `entries[i].matcher` | Read directly via `"matcher" in entry` discriminator from `PluginInfoComponentsResolved.components.hooks` | YES — no string re-derivation | FLOWING |
| `installCtx.resolved.orphanRewake` | `partial.orphanRewake = true` when `detectOrphanRewake(hooksResult.value)` returns true | `applyHooksConfig` reads `<pluginRoot>/<hooksConfigPath>` and invokes the detector | YES — actual hooks.json bytes feed the boolean | FLOWING |
| Install cascade row `reasons[]` | Push `"orphan rewake"` when `installCtx.resolved.orphanRewake === true` | Resolver chain feeds the install message construction | YES — wired through composeReasons | FLOWING |
| `<scopeRoot>/.../hooks/<plugin>/hooks.json` on-disk artefact | `hooksValue` arg to `atomicWriteJson` | Each cascade site re-reads + re-parses `<pluginRoot>/<hooksConfigPath>` then calls `writeHookConfig` | YES — bytes round-trip from plugin source to scope-root artefact | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Hook-bridge tests pass after CR-01 fix | `npx tsx --test tests/bridges/hooks/symlink-escape.test.ts tests/bridges/hooks/stage.test.ts` | 12 pass / 0 fail / 0 skipped (5 symlink-escape Cases A–E + 7 stage write/remove) | PASS |
| CR-01 walker shape verified | `grep -n "recursive: true" extensions/pi-claude-marketplace/bridges/hooks/stage.ts` | 0 matches in walker; only `rm(..., {recursive:true,force:true})` at line 231 + JSDoc references | PASS |
| `lstat` per entry wired | `grep -n "lstat" extensions/pi-claude-marketplace/bridges/hooks/stage.ts` | 4 hits: import at 15, JSDoc at 46, comment at 87, call at 91 | PASS |
| Containment chokepoint preserved | `grep -n "assertPathInside(pluginRoot" extensions/pi-claude-marketplace/bridges/hooks/stage.ts` | 2 hits: chokepoint call at 143 + JSDoc reference at 51 | PASS |
| Rejection class preserved | `grep -c "SymlinkRefusedError" extensions/pi-claude-marketplace/bridges/hooks/stage.ts` | 8 hits (import + rejection class + translation block + JSDoc) | PASS |
| WR-05 fixture wrapper removed | `grep -n "hooks: {" tests/bridges/hooks/{stage,symlink-escape}.test.ts` | 0 matches (the `{hooks:{...}}` wrapper is gone from both files) | PASS |
| Schema-valid HOOKS_VALUE in stage.test.ts | `grep -n "PreToolUse" tests/bridges/hooks/stage.test.ts` | 1 match (schema-valid shape in place) | PASS |
| In-tree subject assertion wired | `grep -nE "expectedInTreePath\|subjectMatch" tests/bridges/hooks/symlink-escape.test.ts` | 4 matches (rejection SUBJECT pinned to in-tree path) | PASS |
| Full test suite baseline preserved | `npm run check` (per 63-08 SUMMARY commit 9c347d1 + reviewer re-review 9c3e0c6) | 2273 unit pass / 10 integration pass / 1 skip / 0 fail | PASS |
| 63-08 commits present on branch | `git log --oneline -5` | `ba6632d test(63-08): tighten LIFE-03 walker regression assertions` + `9c347d1 fix(63-08): replace recursive readdir with lstat-based stack walk` | PASS |

### Probe Execution

No probe scripts declared by PLANs or SUMMARYs; the project has no `scripts/*/tests/probe-*.sh` paths. Probe execution skipped: phase relies on `node --test` runner + targeted unit/integration tests, not probe scripts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| LIFE-01 | 63-04-PLAN.md | Hooks bridge slots into existing 4-bridge cascade as 5th component | SATISFIED | install.ts 6-element phases + update.ts Phase 3a slot + reinstall.ts commitHooks + cascadeUnstagePlugin slot; `tests/transaction/lifecycle-cascade.test.ts` integration |
| LIFE-02 | 63-04-PLAN.md | Hook install/uninstall emits NotificationMessage plugin row through v1.4 cascade + reload-hint cascade | SATISFIED | Install + uninstall fixtures in `lifecycle-cascade.test.ts` assert row emission + reload-hint trailer; no new top-level notify pattern; no new STATUS_TOKENS introduced |
| LIFE-03 | 63-02-PLAN.md (gap closed in 63-08-PLAN.md) | Hooks subtree contained at <scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json; symlinked-escape command path rejected | SATISFIED | Container layout correct; assertSafeName + assertPathInside enforced; walker now uses hand-rolled lstat-based stack walk (CR-01 closed in plan 63-08); rejection contract `SymlinkRefusedError` + `assertPathInside(pluginRoot, realpath, ...)` preserved verbatim; regression assertions pin rejection SUBJECT is the in-tree path and external-tree contents never surface in error message. |
| SURF-01 | 63-05-PLAN.md | info <plugin> renders multi-line hooks: block per declared entry, between commands and mcp | SATISFIED | composeResolvedComponents hooks branch + projection helper + read seam + integration tests |
| SURF-02 | 63-01-PLAN.md | HookSummary typed model + ClaudeHookEvent closed-set tuple; all UI surfaces consume HookSummary | SATISFIED | ClaudeHookEvent + HookSummaryEntry + HookSummary in shared/notify.ts; satisfies-pin in domain/components/hook-events.ts |
| SURF-03 | 63-07-PLAN.md | No install-time synthesis-caveat warnings in v1.13 (reserved for v1.14+) | SATISFIED | `tests/architecture/scope-fences-63.test.ts` Test 1 pins zero "lossy synthesis" tokens |
| SURF-04 | 63-07-PLAN.md | list does NOT add hook-count column; no standalone /claude:plugin hooks command | SATISFIED | `tests/architecture/scope-fences-63.test.ts` Tests 2+3 pin absence |
| SURF-05 | 63-03-PLAN.md | One install-time warning when rewakeMessage / rewakeSummary declared without asyncRewake: true | SATISFIED | REASONS += "orphan rewake"; detectOrphanRewake helper; resolver-side flag; install.ts row composition; catalog rows + UAT fixtures landed atomically |
| SURF-06 | 63-06-PLAN.md | docs/hooks.md exists, linked from README, plain English first-time-reader doc | SATISFIED | docs/hooks.md (257 lines); README ## Hook support; tests/docs/hooks-doc.test.ts pins 8 invariants |
| HOOK-04 | (Phase 58, confirmed by Plan 63-07) | "hooks" REASONS rename to "unsupported hooks" (already shipped) | SATISFIED | scope-fences-63 Tests 4+5 pin "unsupported hooks" presence in REASONS and "hooks" absence in MANIFEST_FIELD_REASONS |

No orphaned requirements — all phase-declared requirement IDs are covered.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` | 91 | Per-entry `lstat` followed by per-entry `realpath` inside `assertSymlinkEntryContained` with no ENOENT/ENOTDIR translation — mid-walk concurrent removal between `readdir` and `lstat` (or `lstat` and `realpath`) would propagate an unhandled `ENOENT` through `writeHookConfig` | Warning (WR-01 in 63-REVIEW.md post-rewrite) | Race surface: a concurrent FS sweep during install would surface as `(failed) {rollback partial}` instead of a clean skip. Idempotency (NFR-3) is technically preserved (the user can retry) but the failure-classification is misleading. Non-goal-blocking; recommend follow-up to mirror `readEntriesOrSkip`'s ENOENT/ENOTDIR translation around `lstat` + `realpath` in a future hardening sweep. |
| `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` | 164-170 | `readSymlinkTargetSafe` duplicates near-identical helper in `shared/path-safety.ts:139` (`readSymlinkTarget`) with diverging placeholder strings (`<unreadable>` vs target-fallback) | Warning (WR-02 in 63-REVIEW.md post-rewrite) | Single-source-of-truth drift; future tightening of the shared helper's placeholder format would not propagate. Non-goal-blocking; recommend exporting and reusing the shared helper. |
| `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` | 140-162 | `assertSymlinkEntryContained` translation block from bare `PathContainmentError` to `SymlinkRefusedError` is load-bearing on macOS (`/var/folders` → `/private/var/folders` resolution) but the translation path is not directly covered by a test — `assert.rejects(..., err => err instanceof SymlinkRefusedError)` asserts the OUTCOME, not the BRANCH | Info (IN-01 in 63-REVIEW.md post-rewrite) | A future refactor of `assertPathInside` that drops the `PathContainmentError` throw would silently make this block dead code. Non-goal-blocking; recommend optional unit test for the branch contract. |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` | 374-377 | `dropped.hooks = [hooksResult.removed]` runs unconditionally on every plugin regardless of whether hooks were staged | Warning (WR-02 from prior pre-CR-01 review, unchanged) | `dropped.hooks` is always-populated; diverges from sibling fields; cascade contract still holds because `removeHookConfig` is idempotent. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:713-746`; `reinstall.ts:1322-1345`; `update.ts:1308-1337` | each hooks phase | Re-parse `<pluginRoot>/<hooksConfigPath>` from disk because resolver discards parsed value; on re-parse failure throws `hooks.json re-parse failed: <reason>` surfacing as `(failed) {rollback partial}` | Warning (WR-01 from prior pre-CR-01 review, unchanged) | TOCTOU window between resolver validation and ledger commit. |
| `extensions/pi-claude-marketplace/domain/resolver.ts:721-736` | `detectOrphanRewake` predicate | Strict-equality against `unknown` schema field | Warning (WR-03 from prior review, unchanged) | False positive on string `"true"`. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:260`; `domain/resolver.ts:697` | `cwd: process.cwd()` instead of `opts.cwd` | Both construct ifCtx with process-global cwd; mitigated by `skipIfMap: true` | Warning (WR-04 from prior review, unchanged) | Forward-compat hazard. |
| `docs/hooks.md:230` | "Currently unmapped Claude tools" wording | Implies partial pipe-OR support that v1.13 explicitly does not provide | Info (IN-02 from prior review, unchanged) | Doc accuracy nit. |
| `docs/hooks.md:207-214` | "These last five events" count statement vs 4 group entries | Counting ambiguity | Info (IN-03 from prior review, unchanged) | Minor wording mismatch. |

The original CR-01 Blocker on `stage.ts:59` (`readdir({recursive:true})`) is RESOLVED — plan 63-08 commits `ba6632d` + `9c347d1` replaced the walker. The post-rewrite re-review (`63-REVIEW.md` 2026-06-16) filed 2 new advisory Warnings (WR-01 ENOENT race, WR-02 helper drift) and 1 Info (IN-01 translation branch coverage) — all advisory, not goal-blocking. The Warnings/Info from the prior pre-CR-01 review (WR-01-old, WR-02-old, WR-03, WR-04, IN-02, IN-03) remain open as hardening backlog items.

### Gaps Summary

**Goal achievement: VERIFIED 7/7.** The CR-01 blocker from the initial verification is closed by plan 63-08. The walker in `assertNoSymlinkEscapeInHooksSubtree` (stage.ts:67-108) is now a hand-rolled `lstat`-classified stack walk that provably never enumerates paths outside `<pluginRoot>/hooks/`. The LIFE-03 rejection contract is preserved verbatim (`SymlinkRefusedError` raised; `fs.realpath` + `assertPathInside(pluginRoot, realpath, ...)` containment chokepoint at line 143). The Case A regression test now actively pins both halves of the CR-01 claim: (i) the rejection SUBJECT is parsed from the error message and asserted equal to the in-tree symlink path, (ii) sentinel filenames seeded inside the external target are asserted NEVER to surface in the rejection message — proving the walker never enumerated the external tree.

The post-rewrite re-review filed 2 advisory Warnings (WR-01 ENOENT mid-walk race, WR-02 helper drift between `readSymlinkTargetSafe` and `shared/path-safety.ts`) plus 1 Info (IN-01 translation branch coverage). None of these prevent the phase goal as written; they are quality/robustness concerns suitable for a future hardening sweep. Combined with the previously-noted advisory findings (WR-01-old TOCTOU, WR-02-old always-populated `dropped.hooks`, WR-03 strict-equality, WR-04 cwd resolution, IN-02 / IN-03 docs polish), the v1.13 ship can carry these forward into post-release hardening.

### Human Verification Required

None — all behavioral claims are testable programmatically and the targeted runtime checks executed:

- Spot-checked hook-bridge tests via `npx tsx --test tests/bridges/hooks/{symlink-escape,stage}.test.ts`: 12 pass / 0 fail / 0 skipped.
- Grep-confirmed walker shape (`recursive: true` removed from walker; `lstat` per entry wired; `assertPathInside(pluginRoot, ...)` chokepoint preserved; `SymlinkRefusedError` class preserved).
- Grep-confirmed test assertions (`expectedInTreePath` / `subjectMatch` rejection-subject pin; `sentinel-do-not-read-PROBE` / `deep-sentinel-PROBE` absence pins).
- Grep-confirmed WR-05 fixture wrapper removal.
- 63-08 SUMMARY documents `npm run check` GREEN end-to-end (2273 unit / 10 integration / 1 skip / 0 fail; commit 9c347d1) — Phase 63 baseline preserved per `feedback-no-redundant-check-reruns` (no need to re-run the full suite when the executor's run was green and the focused tests confirm the gap-closure delta).

The visible install→hooks→reload golden path was exercised end-to-end by `tests/transaction/lifecycle-cascade.test.ts` (273 lines, integration); operator UAT was not flagged as needed during the original Phase 63 verification and the gap-closure delta is purely a defensive-walker tightening with no user-visible surface change.

---

_Re-verified: 2026-06-16T17:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Previous: 2026-06-16T15:18:09Z (gaps_found 6/7) — Truth #2 CR-01 closed by plan 63-08_
