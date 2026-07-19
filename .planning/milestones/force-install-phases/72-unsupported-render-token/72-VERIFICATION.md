---
phase: 72-unsupported-render-token
verified: 2026-06-29T02:31:03Z
status: passed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:

  - test: "Run `/claude:plugin list --unsupported` against the official marketplace after `/reload` in a live Pi TUI"
    expected: "Rows render `⊖ hookify (unsupported)` and `⊖ clangd-lsp (unsupported) {lsp}`; the U+2296 circled-minus glyph displays correctly (distinct from `⊘`/`◉`) in the terminal font; structural-unavailable plugins still show `⊘ … (unavailable)`"
    why_human: "Live TUI glyph rendering against real marketplace data cannot be asserted by the automated suite (byte-exact tests verify the string contains ⊖, but not the terminal/font visual presentation). Deferred manual-only per 72-VALIDATION.md."
---

# Phase 72: Unsupported Render Token Verification Report

**Phase Goal:** A not-installed plugin that resolves `unsupported` (force-installable: has unsupported components but no structural defect) renders a distinct `(unsupported)` status token with a dedicated `⊖` glyph in `list` and `info`, instead of collapsing into the `(unavailable)` / `⊘` render shared with structurally-unavailable plugins. Structurally-`unavailable` plugins keep `(unavailable)` / `⊘`. The `--unsupported` / `--unavailable` list filters stay unaffected.
**Verified:** 2026-06-29T02:31:03Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1 | A not-installed plugin resolving `unsupported` renders `⊖ <name> (unsupported) {…}` in list | ✓ VERIFIED | `list.ts:541-555` `availableRowMessage` `case "unsupported"` emits `status: "unsupported"` with `narrowUnsupportedKinds(resolved.unsupported)`; `notify.ts:2065-2074` `renderPluginRow` case returns `ICON_UNSUPPORTED` + `"(unsupported)"`; `list.messaging.ts:125-131` command-local arm clones the same byte form; list.test.ts assertions pass (npm test 2498/0) |
| 2 | The same not-installed `unsupported` plugin renders `⊖ … (unsupported)` in info, byte-consistent with list | ✓ VERIFIED | `info.ts:970-995` `buildNotInstalledPathRow` derives `status: resolved.state === "unsupported" ? "unsupported" : "unavailable"`; `notify.ts:2933-2936` `pluginInfoStatusGlyph` case returns `ICON_UNSUPPORTED`; info.test.ts assertions pass |
| 3 | A structurally-`unavailable` plugin still renders `⊘ … (unavailable)` in both list and info | ✓ VERIFIED | `list.ts:556-569` `unavailable` arm + `catch (probeErr)` keep `status: "unavailable"`; `info.ts:990,1000,1036,1049` non-path short-circuit + probe-error catch + malformed rows stay `"unavailable"`; `notify.ts:2937-2940` `unavailable`/`failed` → `ICON_UNINSTALLABLE` |
| 4 | LSP-only and hooks-only not-installed plugins both flip to `⊖ (unsupported)` (split follows resolver state, not the reason brace) | ✓ VERIFIED | Split keys on `switch (resolved.state)` in both producers (list.ts:530, info.ts:990); resolver.ts unmodified (lspServers ∈ UNSUPPORTED_COMPONENT_KINDS → `unsupported`); list.test.ts `lspServers → ⊖ {lsp}` and hooks-only `⊖ {unsupported hooks}` tests pass |
| 5 | `--unsupported` / `--unavailable` filters still partition on the pre-collapse resolver bucket (unchanged behavior) | ✓ VERIFIED | `git diff ec4af3c2~1..81896838` on list.ts shows the only changes to `FilterBucket`/`shouldShow` region are comment-only; `classifyManifestEntry` is imported from `plugin-state-classifier.ts` (not redefined) and untouched; filter tests pass |
| 6 | `npm run check` is green | ✓ VERIFIED | Ran independently: **exit code 0**. All five stages executed (typecheck → lint → format:check → test → test:integration). Unit: 2498 pass / 0 fail / 2 skipped. Integration: 16 pass / 0 fail |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `shared/notify.ts` | ICON_UNSUPPORTED glyph, PluginUnsupportedMessage variant, "unsupported" in STATUS_TOKENS + PLUGIN_STATUSES, renderer cases | ✓ VERIFIED | `ICON_UNSUPPORTED = "⊖"` (line 1430, U+2296), distinct from `ICON_UNINSTALLABLE = "⊘"` (1396) and `ICON_FORCE_INSTALLED = "◉"` (1418); `STATUS_TOKENS` line 234, `PLUGIN_STATUSES` line 416; `PluginUnsupportedMessage` interface line 709 added to union line 908; render arms 2065, 2933 |
| `tests/architecture/notify-closed-set-locks.test.ts` | Tripwire bumped to STATUS_TOKENS=23, PLUGIN_STATUSES=18 | ✓ VERIFIED | Asserts `STATUS_TOKENS.length === 23` (line 39), `PLUGIN_STATUSES.length === 18` (47), `REASONS.length === 32` (30), `MARKETPLACE_STATUSES.length === 7` (51); passes |
| `tests/shared/notify-v2.test.ts` | Byte-exact `⊖ … (unsupported)` renderer case | ✓ VERIFIED | File contains literal `⊖` and `(unsupported)`; test passes |
| `orchestrators/plugin/list.ts` | `availableRowMessage` unsupported arm emits `status: "unsupported"` | ✓ VERIFIED | Lines 541-555; switch on `resolved.state` |
| `orchestrators/plugin/info.ts` | not-installed PATH-source row status derived from `resolved.state` | ✓ VERIFIED | `buildNotInstalledPathRow` line 990 |
| `edge/handlers/tools.ts` | `projectRowStatus` handles `case "unsupported"` | ✓ VERIFIED | Lines 177-181, returns `"unavailable"` |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `list.ts` | `notify.ts PluginUnsupportedMessage` | `availableRowMessage` emits `status: "unsupported"` with `narrowUnsupportedKinds(resolved.unsupported)` | ✓ WIRED | list.ts:547-549 |
| `info.ts` | `notify.ts PluginUnsupportedMessage` | not-installed row status from `resolved.state` | ✓ WIRED | info.ts:990 |
| `notify.ts renderPluginRow` | `ICON_UNSUPPORTED` | `case "unsupported"` returns ⊖ + (unsupported) | ✓ WIRED | notify.ts:2065-2074 |
| `list.messaging.ts LIST_RENDER` | `ICON_UNSUPPORTED` | command-local `unsupported` render arm (deviation #2) | ✓ WIRED | list.messaging.ts:125-131; `"unsupported"` in `LIST_STATUSES` (53) |

### Extra Exhaustive Switches (SUMMARY deviation #1 — verified compile-handle the new case)

| Switch | Location | Handles "unsupported" | Status |
| ------ | -------- | --------------------- | ------ |
| `projectRowStatus` | tools.ts:177 | → "unavailable" | ✓ |
| `pluginScopeOrFallback` | tools.ts:337 | carve-out (no scope) | ✓ |
| `pluginVersion` | tools.ts:387 | carries optional version | ✓ |
| `pluginReasons` (if) | tools.ts:364 | surfaces reason braces | ✓ |
| `sortPluginsInBlock` scopeOf | list.ts:1019 | → marketplaceScope | ✓ |

All confirmed present in source AND compile-enforced — `npm run typecheck` (no-default / `assertNever` exhaustive switches) passes with exit 0, which is the authoritative proof that every arm handles the new union member.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| USTAT-01 | 72-01-PLAN | Distinct `(unsupported)` / `⊖` render token in list + info; structural keeps `(unavailable)` / `⊘`; split follows resolver state | ✓ SATISFIED | Truths 1-4; byte-exact tests green |
| USTAT-02 | 72-01-PLAN | `STATUS_TOKENS` gains `"unsupported"` (tripwire bumped); braces preserved via `narrowUnsupportedKinds`; filters unchanged; catalog/golden fixtures byte-exact | ✓ SATISFIED | Truths 5-6; tripwire 23/18/32/7; catalog-uat green |

Both IDs declared in PLAN frontmatter `requirements: [USTAT-01, USTAT-02]` and present in REQUIREMENTS.md (lines 89-90). No orphaned requirements. Note: REQUIREMENTS.md status table (lines 150-151) still marks both as "Pending" — this is the phase-closeout tracking table, updated at milestone closeout, not a code gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `orchestrators/plugin/info.ts` | 320 | Literal NUL byte (`\x00`) embedded in a template literal used as a dedup-key field separator (`` `${drop.event}\0${matcher ?? ""}` ``) | ℹ️ Info | Makes the file binary to `grep`/`rg` (returns false-empty / "binary file matches"). **Pre-existing — introduced in phase 71 (commit 804eeeb1), NOT phase 72.** Compiles fine (NUL is a valid string char) and behaves correctly as a separator. Out of scope for phase 72; flagged for a future cleanup to use the `\0` escape or a printable separator (e.g. `\x1f`). |

No debt markers (TBD/FIXME/XXX) or stub patterns introduced by phase 72. The phase 72 commit range modified only the 14 declared files plus `list.messaging.ts` (deviation #2); `domain/resolver.ts` and `shared/probe-classifiers.ts` confirmed unmodified.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full quality gate | `npm run check` | exit 0; 2498+16 tests pass, 0 fail | ✓ PASS |
| Closed-set tripwire | (within npm test) STATUS_TOKENS=23, PLUGIN_STATUSES=18, REASONS=32, MARKETPLACE_STATUSES=7 | all assert pass | ✓ PASS |
| Byte-exact `⊖` renderer | (within npm test) notify-v2 unsupported arm | pass | ✓ PASS |
| Tool projection | (within npm test) `projectRowStatus("unsupported") === "unavailable"` | pass | ✓ PASS |

### Human Verification Required

#### 1. Real-marketplace visual confirmation of the `⊖` glyph

**Test:** Run `/claude:plugin list --unsupported` against the official marketplace after `/reload` in a live Pi TUI.
**Expected:** Rows render `⊖ hookify (unsupported)` and `⊖ clangd-lsp (unsupported) {lsp}`; the U+2296 circled-minus glyph displays correctly in the terminal font and is visually distinct from `⊘` (unavailable) and `◉` (force-installed); structurally-unavailable plugins still show `⊘ … (unavailable)`.
**Why human:** Live TUI glyph rendering against real marketplace data cannot be asserted by the automated suite — byte-exact tests prove the emitted string contains the `⊖` codepoint, but not that the terminal/font presents it correctly. Deferred manual-only per 72-VALIDATION.md "Manual-Only Verifications".

### Gaps Summary

No gaps. All 6 must-have truths are VERIFIED in the live tree and `npm run check` is green end-to-end (independently re-run, exit 0). The phase goal — a distinct `⊖ (unsupported)` render token de-collapsed from `⊘ (unavailable)` on both the `list` and `info` surfaces, split by `resolved.state`, with filters and resolver untouched — is observably achieved in the codebase.

Status is `human_needed` (not `passed`) solely because the phase carries one planner-deferred manual-only item: a live-TUI visual confirmation of the glyph against the real marketplace. This is a visual-presentation check that is genuinely outside the automated suite; the code-level goal is fully verified.

One informational anti-pattern (a pre-existing phase-71 NUL byte in info.ts:320) was noted but is out of scope for this phase and does not affect goal achievement.

---

_Verified: 2026-06-29T02:31:03Z_
_Verifier: Claude (gsd-verifier)_
