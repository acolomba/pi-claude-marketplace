---
phase: 260925-ucm
plan: 01
subsystem: hooks
tags: [matcher, hooks, tool-mapping, mcp]
requires: []
provides:
  - A pipe-OR hook matcher (`Write|Edit|apply_patch`) degrades per alternative
    instead of dropping the whole matcher group
affects: [hooks, TOOL-02, MATCH-02]
actuals:
  tokens: 3289
  tasks: 3
  commits: 2
key-files:
  modified:
    - extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts
    - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
    - tests/domain/components/hooks/matcher.test.ts
    - tests/bridges/hooks/dispatch.test.ts
    - docs/hooks-compatibility.md
    - CHANGELOG.md
completed: 2026-09-26
status: complete
implementation-commit: ff9749d7
docs-commit: a2cc7d30
---

# Fix #217: hook matcher pipe-OR degrades per alternative

**`ParsedMatcher`'s `tool-set` arm now carries a generalized `toolNames: ReadonlySet<string>` holding both mapped Pi tool literals and verbatim MCP tool names, so a pipe-OR matcher keeps every alternative Pi can support instead of dropping the whole group when one alternative has no analog.**

## Performance

- **Duration:** ~41 min (first commit 22:13, last commit 22:16, gates through 02:54 UTC)
- **Tasks:** 3
- **Commits:** 2 (`ff9749d7` fix, `a2cc7d30` docs)

## Changes

- **`matcher.ts`:** `parseMatcher` now classifies each `|`-split alternative independently: a `CLAUDE_TO_PI_TOOL_NAMES` key or an `isMcpLiteral` string joins `toolNames`; anything else is discarded, with only the first discarded alternative remembered. The matcher only degrades to `{kind:"unmapped", token}` when `toolNames` ends up empty. The `mcp-literal` `ParsedMatcher` arm is deleted; MCP tool names now live in the same `toolNames` set as mapped Pi tools.
- **`dispatch.ts`:** `matcherFiresOnToolEvent` drops the `case "mcp-literal"` arm and reads `matcher.toolNames.has(toolName)` with no cast (the old code needed `as never` to query a `ReadonlySet<PiToolName>` with a plain `string`; a `ReadonlySet<string>` needs none).
- **Tests:** `matcher.test.ts` renamed `piTools` to `toolNames`, flipped the four MCP-literal rows and the one-unsafe-character row to the `tool-set` representation, rewrote the `Edit|mcp__server__tool|Write` row to assert all three alternatives survive, and added four new rows: `Write|Edit|apply_patch` (issue #217's own matcher), `Edit|Write|MultiEdit`, `apply_patch|mcp__server__tool`, and `apply_patch|MultiEdit` (the only row exercising a second discard, asserting `{kind:"unmapped", token:"apply_patch"}`). `dispatch.test.ts` renamed the projected `piTools` field to `toolNames` at the four call sites; the `mcp__catalog__fetch` / `mcp__catalog__publish` dispatch-outcome test at line ~1102 was left unedited and stayed green, proving the fold preserved MCP dispatch.
- **`docs/hooks-compatibility.md`:** replaced the stale "Tool name mapping" closing paragraph. It no longer claims a pipe-OR matcher drops the whole group on any unmapped alternative, and no longer claims `mcp__*` matchers are unsupported. It now states an `mcp__<server>__<tool>` matcher is supported, a tool with no Pi analog drops only from its own matcher's alternative list (`Edit|Write|MultiEdit` keeps running on `Edit` and `Write`), only a matcher left with no supported alternative drops the group (`MultiEdit` alone), and that matcher compatibility is not payload compatibility. The third-party-plugin parenthetical naming `security-guidance` was dropped rather than re-measured.
- **`CHANGELOG.md`:** one `## [Unreleased]` bullet crediting `@fank` for reporting `#217`, no version bump.

## Task Commits

1. **Task 1 (TDD, tracer): degrade a pipe-OR matcher per alternative and fold `mcp-literal` into `tool-set`** - `ff9749d7` (fix) — tests written first, observed RED against unmodified `matcher.ts`, then `matcher.ts` and `dispatch.ts` implemented and observed GREEN.
2. **Task 2: correct the compatibility doc paragraph and add the changelog entry** - `a2cc7d30` (docs)
3. **Task 3: run the full gate chain and the per-module coverage check** - no commit (verification only; no gate rewrote a tracked file, so no follow-up commit was needed)

## Verification

- **RED observed:** `node --test tests/domain/components/hooks/matcher.test.ts tests/bridges/hooks/dispatch.test.ts` against unmodified production code failed exactly the four new/flipped rows (`Write|Edit|apply_patch`, `Edit|Write|MultiEdit`, `apply_patch|mcp__server__tool`, and the unsafe-character row), before any production edit.
- **GREEN after implementation:** the same six suites named in the plan's `<verify>` (`matcher.test.ts`, `partition.test.ts`, `dispatch.test.ts`, `event-router.test.ts`, `settle.test.ts`, `plugin-resolver.test.ts`) — 307 tests, 0 failures.
- **Untouchable suites confirmed unedited:** `tests/domain/components/hooks/partition.test.ts` and `tests/domain/plugin-resolver.test.ts` are absent from the `ff9749d7` diff (`git show --name-only` returned nothing for those two paths) and both passed with no edit, proving the `unmapped-tool` degradation path (a single-token `MultiEdit` matcher still drops with `cond:"unmapped-tool"`) survived the fold.
- **Grep gates:** `grep -rn 'piTools' --include=*.ts extensions/ tests/` and the residual `mcp-literal` grep (excluding the unrelated `if-field`/`settle.test.ts`/`hooks-if-field` union) both returned RC=1 (no matches).
- **`npm run typecheck`:** exit 0.
- **`npm run check`:** `CHECK_RC=0`. 7218/7218 unit tests passed across 296 suites; 36/36 integration tests passed. The `fallow` step's `0 above threshold` (glyph `✗`, verdict pass) and pre-existing 1.4% duplication figure were read as the plan warned, not inferred from a glyph.
- **`npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts`:** 100% (branches 24/24, functions 2/2, lines 79/79). `M_RC=0`. No suppression directive, no coverage pin.
- **`npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts`:** 100% (branches 66/66, functions 12/12, lines 507/507). `D_RC=0`. No suppression directive, no coverage pin.
- **`SKIP=trufflehog pre-commit run --all-files`:** `PC_RC=0`. Every hook passed; the only skip was `TruffleHog`, which always fails inside this git worktree per the environment notes.
- **`git status --short`** after every commit and after the full gate chain showed only the three pre-existing unrelated entries (`.claude/settings.json`, `.codex/config.toml`, `.mcp.json`) — no gate rewrote a tracked file, so no follow-up formatting commit was needed.
- **Commit scope:** `git show --name-only --format= ff9749d7` listed exactly the four Task 1 files; `git show --name-only --format= a2cc7d30` listed exactly the two Task 2 files; `git show --name-only --format= a2cc7d30 -- package.json package-lock.json sonar-project.properties extensions/pi-claude-marketplace/shared/extension-version.ts` returned nothing (no version bump).
- HEAD stayed on `features/issue-217` throughout; no commit was amended.

## Decisions Made

None - followed the plan as specified. The `firstDiscarded` empty-string sentinel, the classification order (match-all, then `SAFE_MATCHER_CHARS`, then per-alternative split), and the doc paragraph's five-point structure all match the plan's `<action>` sections exactly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. `npm run check` and `pre-commit run --all-files` both exceeded the default foreground timeout as the plan's "Runtime budget" note predicted; both were run to completion via a backgrounded shell plus a background polling wait on their logged exit-code markers, per the plan's instruction not to shorten either run.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. `T-217-01` through `T-217-04` are the mitigations this change implements (verified by the unchanged `regex` rows, the `apply_patch|MultiEdit` -> `unmapped` row, and the untouched `partition.test.ts` / `plugin-resolver.test.ts` suites respectively); `T-217-SC` does not apply, no package was installed.

## Next Phase Readiness

- Issue #217 is closed by this change: a `PreToolUse` hook whose matcher is `Write|Edit|apply_patch` now fires on Pi `write` and `edit`.
- Nothing else in this workstream depends on this fix; `features/issue-217` carries exactly these two commits on top of the tip that existed before this task ran.

## Self-Check: PASSED

- All six files in `key-files.modified` exist on disk (`FOUND` for each).
- Both commit hashes (`ff9749d7`, `a2cc7d30`) resolve via `git log --oneline --all`.

---

*Quick task: 260925-ucm*
*Completed: 2026-09-26*
