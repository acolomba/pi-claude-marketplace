---
phase: 63-lifecycle-cascade-user-facing-surface-docs
verified_at: 2026-06-16T22:30:00Z
status: passed
truths_passed: 11
truths_total: 11
gaps_found: 0
deferred_items: 1
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 7/7
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  scope: "Gap-closure re-verification after UAT diagnosis surfaced 3 issues + 4 gaps; plans 63-09 / 63-10 / 63-11 landed."
gaps: []
deferred:
  - truth: "Hookify@claude-plugins-official reaches `(installed)` state end-to-end at runtime against the pi-uat sandbox."
    addressed_in: "v1.14+ (PAYL-V2-04 Stop-event admission to BUCKET_A_EVENTS)"
    evidence: |
      ROADMAP.md line ~408 calls out 10/13 first-party coverage; the
      hookify entry explicitly notes `UNAVAILABLE {unsupported hooks}`
      via `TOOL-02(c) Stop`. REQUIREMENTS.md TOOL-02(c) makes the
      bucket-A 8-event set authoritative for v1.13; hookify ships
      `Stop` which is NOT a member. The 63-09-SUMMARY records this as
      "Option A taken at the user-decided checkpoint: ship wrapper
      fix, defer Stop". 63-11-SUMMARY records the runtime UAT
      result as `blocked` (terminal), not `failed` -- the diagnosed
      root causes (wrapper-format bug + classifier asymmetry) are
      both closed; the residual user-surface trip is the structural
      bucket-A supportability gate.
---

# Phase 63: Lifecycle Cascade, User-Facing Surface & Docs Verification Report

**Phase Goal:** Hook install/uninstall flows through the v1.12 reconcile cascade, `info <plugin>` and `(unavailable) {unsupported hooks}` rows render correctly, and a first-time reader can find and understand the hook-support story in `docs/hooks.md`.

**Verified:** 2026-06-16T22:30:00Z (gap-closure re-verification after 63-09 / 63-10 / 63-11 landed)
**Status:** passed-with-deferrals
**Re-verification:** Yes — third pass for Phase 63.
- Pass 1 (2026-06-16T15:18:09Z): `gaps_found` 6/7 — CR-01 blocker on LIFE-03 walker.
- Pass 2 (2026-06-16T17:30:00Z): `passed` 7/7 — CR-01 closed by plan 63-08.
- Pass 3 (THIS RUN): `passed-with-deferrals` — UAT diagnosed 3 issues + 4 gaps; plans 63-09 / 63-10 / 63-11 close them with one structural deferral (hookify's `Stop` arm requires v1.14+ bucket-A promotion).

## Re-verification Scope

The UAT loop on phase 63 (recorded in `63-UAT.md`) ran 7 runtime tests against the `pi-uat` sandbox and surfaced 3 issues + 4 root-cause gaps. The gaps were converted to three gap-closure plans:

- **63-09** (Wave 1, blocker): wrapper-vs-settings parser fix in `parseHooksConfig`. Inverts the WR-05 fixture flip; pins the upstream wire format via a verbatim hookify fixture.
- **63-10** (Wave 1, defense-in-depth): cross-surface classifier parity — `install.ts::narrowResolverReasons` now mirrors the four `hooks.json`-prefix arms already in `shared/probe-classifiers.ts::narrowResolverNotes`.
- **63-11** (Wave 2, cosmetic + UAT closure): Hooks bullet in README `## Features`; runtime UAT verdict capture; UAT status transition from `diagnosed` to `resolved`.

This re-verification confirms:
1. The 7 truths from the prior verification pass still hold (no regressions from the wrapper-arm change in `parseHooksConfig`, the install-side classifier addition, or the WR-05 fixture revert).
2. The 4 new truths introduced by the gap-closure plans are observably true in the codebase (with one structural deferral on hookify itself).
3. `npm run check` baseline preserved (2280 unit pass / 1 skip / 0 fail + 10 integration pass / 0 fail — bumped from 2273 baseline by the new parser pin test and parity test).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Installing or uninstalling a plugin with hooks emits a NotificationMessage plugin row through the existing v1.4 cascade (no new top-level notify pattern; no new state-change tokens) and triggers the existing /reload hint cascade (LIFE-01, LIFE-02). The 5th bridge slot appears in transaction/runPhases.ts. | VERIFIED — **regression-checked** | Carried forward from Pass 2 — verified intact. `install.ts:850-857` 6-element phases array unchanged; `hooksPhase` definition unchanged. `update.ts` Phase 3a slot unchanged; `PHASE3_FAILURE_PHASES` 5-tuple unchanged. `reinstall.ts::commitHooks` unchanged. `cascadeUnstagePlugin` hooks unstage call unchanged. `tests/transaction/lifecycle-cascade.test.ts` 273-line integration test green in `npm run check` (10/10 integration pass). The 63-09 fixture revert (`v1Hooks` / `v2Hooks` flipped back to wrapper form + `.hooks` unwrap on 3 `deepEqual` sites) did NOT regress this truth — the integration test passes verbatim. |
| 2 | Hook files live under `<scopeRoot>/pi-claude-marketplace/hooks/<plugin>/hooks.json` (NFR-10 extension); a symlinked-escape command path is rejected at install with a notify error via fs.realpath + assertPathInside(<pluginRoot>, realpath) (LIFE-03; NFR-10). | VERIFIED — **regression-checked** | Carried forward from Pass 2. `hookConfigPathFor` at `stage.ts:34-36` unchanged. `assertNoSymlinkEscapeInHooksSubtree` hand-rolled stack walk at `stage.ts:67-108` unchanged (63-08 fix preserved across 63-09 / 63-10 / 63-11 — no commits in this wave touched `bridges/hooks/`). Runtime UAT test 6 in `63-UAT.md` (symlink-escape rejection) reports `pass` with the rejection subject naming the in-tree symlink path verbatim and the externalDir sentinels never surfacing in the error message. WR-01 (mid-walk ENOENT race) and WR-02 (helper drift) remain open as advisory items per `63-REVIEW.md`. |
| 3 | The closed-set REASONS token "hooks" is renamed to "unsupported hooks" at shared/notify.ts::REASONS; catalog-UAT fixtures updated (HOOK-04 atomic lockstep). | VERIFIED — **regression-checked** | Carried forward from Pass 2. `shared/notify.ts` REASONS tuple still carries `"unsupported hooks"`; `MANIFEST_FIELD_REASONS` does NOT carry `"hooks"`. `tests/architecture/scope-fences-63.test.ts` Tests 4+5 green via `npm run check`. |
| 4 | info <plugin> renders a hooks: line per declared hook entry for installable plugins; hooks slots alphabetically between commands and mcp; unavailable plugins continue to render `components: not resolved` (SURF-01). list does NOT add a hook-count column; no standalone `/claude:plugin hooks <plugin>` command ships (SURF-04). | VERIFIED — **regression-checked** | Carried forward from Pass 2. `info.ts:210-230` `projectHookSummaryEntries` projection helper unchanged. `info.ts:250-268` `readHookSummaryEntries` re-parse seam consumes `parseHooksConfig` — the wrapper-arm addition is transparent at this call site because `parseHooksConfig` returns the UNWRAPPED inner record under both arms (verified in `hooks.ts:352-355` `candidate` derivation + `:387` `value: candidate`). Existing `tests/orchestrators/plugin/info.test.ts:1304-1571` 5 fixtures green via `npm run check`. The unavailable-fallthrough contract is exactly what hookify exercises at runtime under Option A (UAT test 4: `(unavailable)` → `components: not resolved`). |
| 5 | shared/notify.ts gains a typed HookSummary discriminated model plus a closed-set ClaudeHookEvent tuple (8 bucket-A events); all UI surfaces consume HookSummary (SURF-02). No install-time synthesis-caveat warnings ship in v1.13 (SURF-03 reserved for v1.14+). | VERIFIED — **regression-checked** | Carried forward from Pass 2. `shared/notify.ts:186-196` ClaudeHookEvent literal-union unchanged; `:198-200` HookSummaryEntry discriminated union unchanged; `:202-204` HookSummary interface unchanged. `domain/components/hook-events.ts:37-46` BUCKET_A_EVENTS 8-tuple unchanged (still 8 members; `Stop` NOT included — Option A deferral observably true here). `tests/architecture/scope-fences-63.test.ts` Test 1 (no `"lossy synthesis"` tokens) green. |
| 6 | A plugin declaring rewakeMessage or rewakeSummary without asyncRewake: true emits one install-time warning (SURF-05). | VERIFIED — **regression-checked** | Carried forward from Pass 2. `shared/notify.ts` REASONS tuple still carries `"orphan rewake"`. `domain/resolver.ts::detectOrphanRewake` helper + `applyHooksConfig` partial.orphanRewake assignment unchanged. `install.ts:1379-1381` cascade-row composition guard unchanged. `tests/architecture/catalog-uat.test.ts` byte-equality fixtures green via `npm run check`. |
| 7 | docs/hooks.md exists, is linked from README.md's new `## Hook support` section, jargon-free for first-time readers (SURF-06). | VERIFIED — **regression-checked** | Carried forward from Pass 2. `docs/hooks.md` 257 lines, zero internal-jargon tokens. `README.md:171` `## Hook support` section unchanged; `:175` markdown link unchanged. `tests/docs/hooks-doc.test.ts` 8 invariants green via `npm run check`. PLUS new 63-11 addition: `README.md:28` `- Hooks. See [Hook support reference](docs/hooks.md).` bullet now lands in the `## Features` list — confirmed via direct file read (lines 21-31). |
| 8 | `parseHooksConfig` accepts BOTH wire shapes: the upstream PLUGIN-format wrapper `{description?, hooks: {...}}` per Claude Code `plugin-dev/skills/hook-development/SKILL.md`, AND the bare settings-format `{<event>: [...]}` shape (backward-compat). [63-09 truth #1+#2] | VERIFIED | `extensions/pi-claude-marketplace/domain/components/hooks.ts:114-125` `isPluginWrapper(v)` private predicate landed verbatim per spec: `typeof v === "object" && v !== null && !Array.isArray(v) && Object.hasOwn(v, "hooks") && (inner is plain non-null non-array object)`. `:352-355` `candidate` derivation at parser head: `const candidate: unknown = isPluginWrapper(parsed) ? (parsed as { hooks: unknown }).hooks : parsed;`. Validator at `:356` consumes `candidate`. Supportability + ifMap consumers (`:370`, `:385`) also consume `candidate`. Success-arm `value: candidate` at `:387` — downstream callers (resolver, info.ts projection, bridge writeHookConfig) see the unwrapped inner record under both arms. JSDoc cites SKILL.md at 5 sites (lines 31, 102, 229, 311, 350). |
| 9 | After the parser change, `parseHooksConfig` on a verbatim hookify wire fixture returns `{ok: true, value: <unwrapped record>}` — pins the wrapper-detection arm against real upstream bytes. [63-09 truth #3+#5] | VERIFIED (with documented Option A slim) | `tests/fixtures/hookify-hooks.json` (38 lines) carries a wrapper-form fixture: top-level `description` field + `hooks: { PreToolUse, PostToolUse, UserPromptSubmit }`. The `Stop` arm is intentionally SLIMMED out per Option A (would otherwise trip `(c) non-bucket-A event: Stop` at the supportability gate BEFORE the wrapper-acceptance verdict could land — masking the wire-format question this test pins). `tests/domain/components/hooks.test.ts` wrapper-pin test asserts `result.ok === true` and presence of the three bucket-A event keys in `result.value`. Per `npx tsx --test tests/domain/components/hooks.test.ts`: 42 pass / 0 fail. Slim documented in 63-09-SUMMARY commit `714a6d4`. |
| 10 | `install.ts::narrowResolverReasons` mirrors the four `hooks.json`-prefix family that `shared/probe-classifiers.ts::narrowResolverNotes` already handles, emitting the SAME `"unsupported hooks"` token; new arm positioned BEFORE the existing `reason.includes("source")` arm so `malformed hooks.json:` doesn't fall through to `"unsupported source"`. [63-10 truth #1+#2+#5] | VERIFIED | `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:1702-1718` carries the new arm at the head of the per-reason loop body, after the empty-skip continue (line 1698) and BEFORE the manifest-field carve-out (line 1722). Four `startsWith` checks at lines 1711-1714: `"hooks.json is not valid JSON:"`, `"hooks.json failed schema validation:"`, `"unsupported hooks:"`, `"malformed hooks.json:"` — identical to `shared/probe-classifiers.ts:93-97`. Emits `out.push("unsupported hooks")` + `continue`. All other arms (manifest-field carve-out, source-includes, errno-substring fallbacks, conservative `unsupported source` default) preserved unchanged at lines 1722-1746. Comment cites HOOK-03 / LIFE-01 / SURF-01 + the sibling classifier file (no GSD planning artefacts per `.claude/rules/typescript-comments.md`). `eslint-disable-next-line sonarjs/cognitive-complexity` at line 1694 follows the precedent at `installPlugin` (IN-01 in `63-REVIEW.md`). |
| 11 | Cross-surface parity is pinned structurally by a new test asserting `narrowResolverReasons` and `narrowResolverNotes` emit the SAME closed-set token for the SAME resolver-emitted note across 6 representative cases. [63-10 truth #3+#4] | VERIFIED | `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` (2.2 KB) exists with 6 parity cases: 4 `hooks.json`-prefix families → `"unsupported hooks"` + `contains lspServers` → `"lsp"` + generic catch-all → `"unsupported source"`. Test uses `__test_narrowResolverReasons` test-seam export (already exported in install.ts pre-63-10 from prior Phase 58 / HOOK-04 instrumentation per 63-10-SUMMARY). Runs via `npx tsx --test tests/orchestrators/plugin/cross-surface-reason-parity.test.ts`: 6 pass / 0 fail (verified inline). Future prefix-set drift on either classifier would red-fail this suite. |

**Score:** 11/11 truths verified (7 carried-forward from Pass 2 regression-checked + 4 new from gap-closure plans). 1 deferred item: hookify itself reaching `(installed)` requires v1.14+ Stop-event admission to BUCKET_A_EVENTS — not a verification failure, this is **roadmapped** in REQUIREMENTS.md (TOOL-02(c)) + ROADMAP.md (PAYL-V2-04) + 63-09-SUMMARY (Option A user-decided checkpoint).

### Deferred Items

Items not yet met but explicitly addressed in a later milestone (v1.14+) with a documented decision trail.

| # | Item | Addressed In | Evidence |
| --- | ---- | ------------ | -------- |
| 1 | Hookify@claude-plugins-official reaches `(installed)` state end-to-end at runtime against the pi-uat sandbox. | v1.14+ (PAYL-V2-04 Stop-event admission to BUCKET_A_EVENTS) | (a) `REQUIREMENTS.md` TOOL-02(c) closed-set lists bucket-A as 8 events; `Stop` is bucket-D. (b) `REQUIREMENTS.md` first-party coverage table lists hookify under `UNAVAILABLE {unsupported hooks}` with `TOOL-02(c) Stop`. (c) `ROADMAP.md` v1.14+ block explicitly cites PAYL-V2-04 (Stop synthesis with engineered safeguards) as the unblocker. (d) `63-09-SUMMARY.md` "Deferred" section documents Option A user-decided checkpoint: ship the wrapper fix, defer Stop. (e) `63-UAT.md` records tests 3/4/5 as terminal `blocked` (NOT `failed`) — the diagnosed root causes (wrapper-format bug + cross-surface classifier asymmetry) are both closed; the residual user-surface trip is the structural bucket-A supportability gate. (f) The runtime evidence in `63-UAT.md` test 3 confirms: no notify Error/Warning rows; cross-surface classification is now consistent (`(unavailable) {unsupported hooks}` on both `info` and install cascade); 63-09 + 63-10 both land correctly at runtime. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `extensions/pi-claude-marketplace/domain/components/hooks.ts` | Two-arm parseHooksConfig: wrapper-detection step + existing validation; isPluginWrapper(v) private predicate; JSDoc citing SKILL.md | VERIFIED | `isPluginWrapper` at lines 114-125 (private, type-narrowing predicate). `candidate` derivation at 352-355. All downstream calls consume `candidate`. JSDoc cites SKILL.md at 5 sites. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | narrowResolverReasons new arm at head of loop matching four hooks.json prefixes; emits "unsupported hooks"; placed before manifest-field + source-includes arms | VERIFIED | New arm at lines 1702-1718. Four startsWith checks verbatim with probe-side classifier. Ordering: after empty-skip continue, before manifestFieldTokenFromNote. Test seam `__test_narrowResolverReasons` exported (pre-existing). |
| `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` | Reference implementation — narrowResolverNotes already carries the four hooks.json prefix arms (no change in this wave) | VERIFIED | Lines 87-101: 4 startsWith checks for `hooks.json is not valid JSON:`, `hooks.json failed schema validation:`, `unsupported hooks:`, `malformed hooks.json:` → emits `"unsupported hooks"`. Untouched by 63-09/10/11. |
| `tests/fixtures/hookify-hooks.json` | Verbatim hookify wire bytes (slimmed to bucket-A keys; Stop arm omitted per Option A) | VERIFIED | 38 lines. Top-level `description` + `hooks: { PreToolUse, PostToolUse, UserPromptSubmit }`. Stop omitted. Wrapper shape preserved verbatim. |
| `tests/domain/components/hooks.test.ts` | New parser-level wire-format pin test asserting parseHooksConfig returns {ok:true} on hookify fixture | VERIFIED | 42 tests total; wrapper-pin test verifies success arm + presence of 3 bucket-A event keys in result.value. The existing 41 tests cover the bare-shape backward-compat arm. All 42 pass. |
| `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` | 6 parity cases: 4 hooks-prefix families + lspServers sanity + generic catch-all sanity | VERIFIED | 2.2 KB. All 6 cases green via direct test invocation. |
| `tests/bridges/hooks/stage.test.ts` | HOOKS_VALUE flipped from bare shape (WR-05 form) BACK to wrapper form per upstream SKILL.md; 5 writeHookConfig calls pass HOOKS_VALUE.hooks; 1 deepEqual compares against HOOKS_VALUE.hooks | VERIFIED | 7 tests green via spot-check. WR-05 fixture revert per 63-09 plan task 3 (commit 02bb8ba). |
| `tests/orchestrators/marketplace/cascade.test.ts` | Line 166 seed JSON literal restored to wrapper form | VERIFIED | Per 63-09-SUMMARY commit 02bb8ba; no downstream consumer assertion adjustment needed at this site. Test passes as part of `npm run check`. |
| `tests/transaction/lifecycle-cascade.test.ts` | v1Hooks + v2Hooks restored to wrapper form; 3 deepEqual assertions adjusted to compare against .hooks | VERIFIED | Integration test (10/10 integration pass via `npm run check`). |
| `README.md` | New `- Hooks. See [Hook support reference](docs/hooks.md).` bullet in `## Features` list, alphabetical slot between Agents and MCP servers | VERIFIED | Confirmed via direct file read: line 28. Slotted between Agents (line 27) and MCP servers (line 29). Markdown link target matches `## Hook support` section's link at line 175. |
| `.planning/phases/63-lifecycle-cascade-user-facing-surface-docs/63-UAT.md` | Status transitioned diagnosed → resolved; tests 3/4/5 result transitioned issue → blocked (terminal); gap entries annotated with closed:/closed_by:/deferred_to:; reported: → reported_pre_fix: for lineage | VERIFIED | Frontmatter status: `resolved`, previous_status: `"diagnosed"`. Tests 3/4/5 carry `result: blocked` + evidence + reason + closed_by + deferred_to. `reported_pre_fix:` preserves the user-reported narrative. Summary: passed: 4, blocked: 3, issues: 0. |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `domain/components/hooks.ts` (parseHooksConfig) | `domain/resolver.ts` (readStandaloneHooks at 699) | parser callsite — wrapper unwrapped at parse time; resolver sees unwrapped value as before | WIRED | Pattern: `parseHooksConfig(` present at resolver.ts:699. Untouched by 63-09/10/11; downstream consumer of the unwrapped value. |
| `domain/components/hooks.ts` (parseHooksConfig) | `orchestrators/plugin/info.ts` (readHookSummaryEntries at 262) | parser callsite — info.ts projection arm consumes parsed.value which is the bare-event-keys record (invariant preserved by wrapper-arm) | WIRED | Pattern: `parseHooksConfig(` present at info.ts:262. The Truth #4 carried-forward regression check confirms info.ts continues to render the hooks-block contract because the parser's success-arm `value` shape is unchanged. |
| `domain/components/hooks.ts` (parseHooksConfig) | `bridges/hooks/stage.ts` (writeHookConfig) | bridge writes the parser's `value` (the unwrapped inner record) verbatim to disk | WIRED | Per Truth #1 regression check: integration test green; the bridge stage-write path round-trips the unwrapped record. |
| `orchestrators/plugin/install.ts` (narrowResolverReasons) | `shared/probe-classifiers.ts` (narrowResolverNotes) | mirror-by-verbatim-prefix-set classifier contract pinned by cross-surface parity test | WIRED | Pattern: `startsWith("hooks.json` in both files (install.ts: 2 hits; probe-classifiers: 2 hits — same 2 prefixes that start with literal `hooks.json` substring; the other 2 of the 4-prefix set are `"unsupported hooks:"` + `"malformed hooks.json:"` whose startsWith checks don't begin with the literal `hooks.json` substring). Mirror is exact at the prefix-set level — verified by direct inspection. |
| `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` | `install.ts::__test_narrowResolverReasons` | test imports the install-side test-seam export to exercise both classifiers symmetrically | WIRED | Confirmed via `npx tsx --test`: 6 pass / 0 fail. |
| `tests/domain/components/hooks.test.ts` | `tests/fixtures/hookify-hooks.json` | `readFile` on verbatim upstream-derived fixture (slimmed to bucket-A keys) | WIRED | Confirmed via 42-test pass. |
| `README.md:28` | `docs/hooks.md` | markdown link [Hook support reference](docs/hooks.md) | WIRED | Link target verified; same target as existing link at README.md:175. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `parseHooksConfig` (wrapper-arm) | `candidate: unknown` | Derived from `isPluginWrapper(parsed) ? (parsed as { hooks }).hooks : parsed` after JSON.parse on input bytes | YES — bytes flow from input through structural discriminator to validator | FLOWING |
| `parseHooksConfig` success-arm return | `value: candidate as HooksConfig` | The validated unwrapped record (either inner of wrapper or the bare top-level keys) | YES — consumers (resolver, info.ts projection, bridge writeHookConfig) consume the unwrapped record under BOTH arms | FLOWING |
| `narrowResolverReasons` new arm | `out: ContentReason[] += "unsupported hooks"` | Driven by 4 `startsWith` checks on each `reason` string from `reasons: readonly string[]` parameter | YES — closed-set REASONS token from the union at `shared/notify.ts:81`; the dedup-via-Set pass at line ~1748 preserves first-seen order | FLOWING |
| Cross-surface parity test | `probeOut` + `installOut` arrays | Both classifier functions invoked directly with the same input note | YES — 6 cases exercised; all green | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full `npm run check` baseline preserved | `npm run check` | 2280 unit pass / 1 skip / 0 fail + 10 integration pass / 0 fail (was 2273 pre-63-09; +1 parser pin test, +6 parity test cases = +7 net additions) | PASS |
| Hookify wire-format pin test passes | `npx tsx --test tests/domain/components/hooks.test.ts` | 42 pass / 0 fail (including the new wrapper-pin test) | PASS |
| Cross-surface parity test passes | `npx tsx --test tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` | 6 pass / 0 fail | PASS |
| Hook bridge tests (LIFE-03 regression) | `npx tsx --test tests/bridges/hooks/symlink-escape.test.ts tests/bridges/hooks/stage.test.ts` | 12 pass / 0 fail | PASS |
| Parser wrapper-arm landed | `grep -n "isPluginWrapper\|candidate" extensions/pi-claude-marketplace/domain/components/hooks.ts` | `isPluginWrapper` private predicate at 114; `candidate` derivation at 352-355; consumed at 356, 357, 370, 385, 387 | PASS |
| Install classifier hooks-prefix arm landed | `grep -n "hooks.json is not valid JSON\|hooks.json failed schema validation\|unsupported hooks:\|malformed hooks.json" extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | 4 startsWith checks at lines 1711-1714 | PASS |
| Probe classifier (untouched) carries reference prefix set | `grep -n "startsWith(\"hooks.json\|unsupported hooks:\|malformed hooks.json" extensions/pi-claude-marketplace/shared/probe-classifiers.ts` | 4 startsWith checks at lines 94-97 | PASS |
| Hookify fixture slimmed correctly | `cat tests/fixtures/hookify-hooks.json | grep -c "Stop"` | 0 (slim verified — no Stop arm) | PASS |
| Hookify fixture preserves wrapper shape | `head -3 tests/fixtures/hookify-hooks.json` | `{ "description": "...", "hooks": { ... }` — wrapper present | PASS |
| README Hooks bullet present | `grep -n "Hook support reference" README.md` | Line 28 (Features bullet) + line 175 (Hook support section heading link) | PASS |
| 63-09/10/11 commits present | `git log --oneline -20` | b78956b, 714a6d4, 5fa5543, 02bb8ba, 2fbb15d (63-09); b28b0f7, 4e5adf9 (63-10); 7967ea8, 939574d (63-11) — all on `features/v1.13-hook-bridge` | PASS |
| UAT status transitioned to terminal | `head -20 .planning/phases/63-.../63-UAT.md` | `status: resolved`, `previous_status: "diagnosed"`, summary `passed: 4 / blocked: 3 / issues: 0` | PASS |
| BUCKET_A_EVENTS still 8 members (Option A surface) | `grep -A10 "BUCKET_A_EVENTS = \[" extensions/pi-claude-marketplace/domain/components/hook-events.ts` | 8-tuple verbatim: SessionStart / UserPromptSubmit / PreToolUse / PostToolUse / PostToolUseFailure / PreCompact / PostCompact / SessionEnd. Stop NOT included. | PASS (deferral surface) |

### Probe Execution

No probe scripts declared by PLANs or SUMMARYs; the project has no `scripts/*/tests/probe-*.sh` paths. Probe execution skipped: phase relies on `node --test` runner + targeted unit/integration tests + a human-verified runtime UAT recipe (63-11 Task 2 human-verify checkpoint).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| LIFE-01 | 63-04 (Pass 2) + 63-09 + 63-10 | Hooks bridge slots into existing cascade as 5th component | SATISFIED | Carried forward from Pass 2; the new wrapper-arm + classifier-parity arm do NOT alter the cascade slot count or ordering. |
| LIFE-02 | 63-04 (Pass 2) | NotificationMessage plugin row + reload-hint cascade | SATISFIED | Carried forward; integration test green. |
| LIFE-03 | 63-02 + 63-08 (Pass 2) | <pluginRoot>/hooks/ symlink-escape walker rejection | SATISFIED | Carried forward; UAT test 6 (runtime symlink-escape) reports `pass`. WR-01 + WR-02 advisory items remain open as hardening backlog. |
| SURF-01 | 63-05 (Pass 2) + 63-09 + 63-10 | info <plugin> hooks block + cross-surface parity | SATISFIED | Carried forward; cross-surface parity arm added by 63-10 closes the SURF-01 "same plugin → same reason across surfaces" invariant structurally. |
| SURF-02 | 63-01 (Pass 2) | HookSummary + ClaudeHookEvent | SATISFIED | Carried forward; ClaudeHookEvent literal-union unchanged. |
| SURF-03 | 63-07 (Pass 2) | No install-time synthesis-caveat warnings in v1.13 | SATISFIED | Carried forward; scope-fence test green. |
| SURF-04 | 63-07 (Pass 2) | No hook-count column on list; no /claude:plugin hooks command | SATISFIED | Carried forward; scope-fence test green. |
| SURF-05 | 63-03 (Pass 2) | Orphan-rewake install-time warning | SATISFIED | Carried forward; catalog-UAT fixtures green. |
| SURF-06 | 63-06 (Pass 2) + 63-11 | docs/hooks.md + README link + Features list bullet | SATISFIED | docs/hooks.md untouched; README `## Hook support` section untouched; NEW: README `## Features` bullet added at line 28 via 63-11 (commit 7967ea8). |
| HOOK-03 | 63-09 | parseHooksConfig accepts upstream wrapper shape per SKILL.md (additive: also accepts bare shape for backward-compat) | SATISFIED | isPluginWrapper + candidate derivation + 5-site SKILL.md JSDoc citation. The HOOK-03 "additionalProperties: true at every nesting level" invariant is preserved (schema untouched). |
| HOOK-04 | (Phase 58, confirmed by Plan 63-07) | "hooks" → "unsupported hooks" REASONS rename | SATISFIED | Carried forward; scope-fence test green. |

No orphaned requirements. All phase-declared requirement IDs (LIFE-01..03, SURF-01..06, HOOK-03, HOOK-04) are accounted for. The 63-09 plan frontmatter cited [LIFE-01, LIFE-02, SURF-01, HOOK-03] and 63-10 cited [LIFE-01, SURF-01] — all covered. The 63-11 plan cited [SURF-06] — covered via the README Features bullet addition.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `extensions/pi-claude-marketplace/domain/components/hooks.ts` | 114-125 (isPluginWrapper) | Silent-drop of sibling top-level event keys when wrapper-detection unwraps a mixed-shape config (e.g. `{description, hooks: {...}, SessionStart: [...]}` would silently discard the outer SessionStart arm) | Warning (CR-01 in 63-REVIEW.md gap-closure section) | Loud-failure pattern violation (D-58-06). Risk is low (no real upstream authoring pattern produces mixed-shape configs per SKILL.md). Fix is either (a) tighten the predicate to also reject extra top-level keys outside `{description, hooks}`, or (b) extend JSDoc to call out the silent-drop case explicitly. Non-goal-blocking; deferred to a post-v1.13 hardening sweep. |
| `git log --format=%s 4e5adf9` | Commit title | 77-char Conventional Commits title exceeds CLAUDE.md's 72-char policy | Warning (CR-02 in 63-REVIEW.md gap-closure section) | Process deviation only. Title is `fix(63-10): mirror narrowResolverNotes hooks-prefix arm in install classifier`. The pre-commit hook either does not enforce title length or did not gate. Non-goal-blocking; suggested rewrite captured in REVIEW for future commits. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | 1697, 1715 + `domain/components/hooks.ts` | Tight string-coupling between install/probe classifiers and parser's reason strings (4 prefix tokens duplicated across 4 files; parity test pins consumer-consumer parity, NOT emitter-consumer parity) | Warning (CR-03 in 63-REVIEW.md gap-closure section) | If a future hooks.ts rename of `"hooks.json failed schema validation:"` lands, BOTH classifier sites silently demote to `"unsupported source"` AND the parity test stays GREEN (both classifiers stay synchronized in their now-dead arms). Fix: extract the 4 prefix tokens to a single exported constant array. Non-goal-blocking; deferred to a post-v1.13 hardening sweep alongside IN-01 (helper extraction). |
| `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` | 91 | Mid-walk ENOENT race between readdir and lstat | Warning (WR-01 from Pass 2; carried forward unchanged) | Concurrent FS sweep during install could surface as `(failed) {rollback partial}` instead of clean skip. Non-goal-blocking. |
| `extensions/pi-claude-marketplace/bridges/hooks/stage.ts` | 164-170 | readSymlinkTargetSafe duplicates shared helper | Warning (WR-02 from Pass 2; carried forward unchanged) | Single-source-of-truth drift. Non-goal-blocking. |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` | 374-377 | dropped.hooks always-populated | Warning (carried forward from prior pre-CR-01 review) | Cascade contract still holds because removeHookConfig is idempotent. Non-goal-blocking. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts:713-746`; `reinstall.ts:1322-1345`; `update.ts:1308-1337` | each hooks phase | Re-parse `<pluginRoot>/<hooksConfigPath>` from disk; TOCTOU window | Warning (carried forward) | Non-goal-blocking. |
| `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` | 18-37 | Parity-test coverage correct but minimal — missing near-miss prefix case + multi-reason case | Info (IN-02 in 63-REVIEW.md gap-closure section) | Add 1-2 adversarial cases to tighten the structural contract. Non-goal-blocking. |
| `tests/domain/components/hooks.test.ts` | 586-624 | Wrapper-pin test missing negative assertion that `description` is unwrapped out (currently the test would still pass if parseHooksConfig was a no-op identity function on the wrapper-shaped input) | Info (IN-03 in 63-REVIEW.md gap-closure section) | Add `assert.equal("description" in result.value, false)` to confirm the wrapper-unwrap actually happened. One-line addition. Non-goal-blocking. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` | 1694 | `eslint-disable-next-line sonarjs/cognitive-complexity` added at narrowResolverReasons (15→16 complexity bump) | Info (IN-01 in 63-REVIEW.md gap-closure section) | Acceptable per the established precedent at installPlugin (line 911 in the same file). Defer to a future cleanup alongside CR-03 helper extraction. |
| `docs/hooks.md:230`, `docs/hooks.md:207-214` | doc wording | "Currently unmapped Claude tools" + "These last five events" count statements | Info (IN-02 / IN-03 from prior reviews, unchanged) | Doc accuracy nits. Non-goal-blocking. |

No new BLOCKERs introduced by the gap-closure plans. The three new Warnings (CR-01 silent-drop, CR-02 commit-title length, CR-03 string-coupling) and three new Info items (IN-01 / IN-02 / IN-03) are all advisory and align with the project's pragmatic-fast vendor philosophy + Option A scope discipline.

**Debt-marker scan:** zero TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER tokens introduced by the 63-09/10/11 commits. Verified via `grep -rE "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER" extensions/pi-claude-marketplace/domain/components/hooks.ts extensions/pi-claude-marketplace/orchestrators/plugin/install.ts tests/domain/components/hooks.test.ts tests/orchestrators/plugin/cross-surface-reason-parity.test.ts tests/fixtures/hookify-hooks.json` returns no matches.

### Human Verification Required

None pending. The runtime UAT recipes (63-UAT.md tests 3/4/5) were exercised at the 63-11 Task 2 human-verify checkpoint. The terminal `blocked` verdict on those tests reflects the structural Option A deferral, not a defect — the diagnosed root causes (wrapper-format wire-contract bug + cross-surface classifier asymmetry) are both closed at runtime and pinned structurally by the new test surfaces. UAT test 6 (symlink-escape) reports runtime `pass`. UAT tests 1, 2, 7 already passed pre-gap-closure.

### Gaps Summary

**Goal achievement: VERIFIED 11/11 (with one structural deferral).**

All 7 truths from the prior Pass 2 verification are preserved unchanged — the gap-closure plans did not regress the cascade slot wiring (LIFE-01/02), the LIFE-03 walker contract, the SURF-01 info-block contract, the SURF-02 typed-model contract, the SURF-03/04 scope-fence contracts, the SURF-05 orphan-rewake warning, or the SURF-06 docs surface.

The 4 new truths introduced by 63-09 (truths #8, #9) and 63-10 (truths #10, #11) all land observably true in the codebase:
- The wrapper-arm in `parseHooksConfig` correctly accepts BOTH wire shapes (upstream PLUGIN wrapper + bare SETTINGS) per the SKILL.md authority cited at 5 JSDoc sites.
- The hookify wire-format fixture pins the wrapper-detection arm against real upstream bytes (slimmed to bucket-A keys per Option A).
- The install-side classifier mirrors the four `hooks.json`-prefix arms from the probe-side classifier verbatim, emitting the same closed-set `"unsupported hooks"` token.
- The cross-surface parity test structurally pins the contract — any future prefix-set drift on either classifier red-fails the suite.

**One deferred item:** hookify itself reaching `(installed)` state end-to-end at runtime. This is **roadmapped, not improvised**:
- REQUIREMENTS.md TOOL-02(c) explicitly closes bucket-A to 8 events; `Stop` is not a member.
- REQUIREMENTS.md first-party coverage table lists hookify as `UNAVAILABLE {unsupported hooks}` via `TOOL-02(c) Stop`.
- ROADMAP.md cites PAYL-V2-04 (v1.14+) as the Stop-event unblocker.
- 63-09-SUMMARY records the Option A user-decided checkpoint: ship wrapper fix, defer Stop.
- 63-UAT.md tests 3/4/5 are recorded as terminal `blocked` (not `failed`) — the UAT loop has closed honestly.

The cosmetic README Features bullet (63-11) lands verbatim. The runtime UAT confirms: no notify Error/Warning rows; cross-surface classification is consistent (`(unavailable) {unsupported hooks}` on both surfaces); the wrapper-format fix and parity arm both land correctly at runtime; the residual trip is the structural bucket-A supportability gate.

`npm run check` baseline preserved: 2280 unit pass / 1 skip / 0 fail + 10 integration pass / 0 fail. Bumped from 2273 by the new parser pin test (+1) and the new parity test cases (+6).

The phase is ready for v1.13 milestone close-out (developer's call: `mvp-phase complete` / `gsd-cleanup` / npm publish per project discipline).

---

_Re-verified: 2026-06-16T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Previous passes: 2026-06-16T15:18:09Z (gaps_found 6/7) → 2026-06-16T17:30:00Z (passed 7/7) → THIS RUN (passed-with-deferrals 11/11; 1 deferred to v1.14+ PAYL-V2-04)_
