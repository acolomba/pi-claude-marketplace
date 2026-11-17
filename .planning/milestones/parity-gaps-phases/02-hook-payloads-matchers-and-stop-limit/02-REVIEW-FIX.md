---
phase: 02-hook-payloads-matchers-and-stop-limit
fixed_at: 2026-11-13T13:46:01Z
review_path: .planning/phases/02-hook-payloads-matchers-and-stop-limit/02-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-11-13T13:46:01Z
**Source review:** `.planning/phases/02-hook-payloads-matchers-and-stop-limit/02-REVIEW.md`
**Iteration:** 1

**Summary:** Five findings were in scope. All five were fixed; none were skipped. The four runtime fixes change decision logic. Independent re-review replayed their counterexamples successfully; no manual verification remains (see 02-REVIEW.md).

## Fixed Issues

### CR-01: Content-only redaction is discarded when visible text stays the same

**Status:** fixed; independently verified by automated regression
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts`, `test/integration/hooks-result-boundary.test.ts`, `features/hook/tool-use.feature`
**Commits:** `087cc071` (fix), `d8930842` (behavioral regression)
**Applied fix:** A generic result is an echo only when both content and structured content equal the original. An omitted structured value now yields a patch that clears it and sanitizes details. The installed Pi runner test and an MCP scenario cover unchanged public text.

### CR-02: Glob invents the wrong absolute filename for native path aliases

**Status:** fixed; independently verified by automated regression
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/tool-result-search-shell.ts`, `test/bridges/hooks/tool-result-search-shell.test.ts`, `test/bridges/hooks/payloads/post-tool-use.test.ts`, `features/hook/tool-use.feature`
**Commit:** `af1272c8`
**Applied fix:** Glob resolves the native search root with the shared path normalizer before joining a returned filename. Tests cover home, `@`, file URL, and Unicode-space roots. A Pi scenario checks an at-prefixed native find call.

### CR-03: A malformed file-URL rewrite throws instead of retaining the original call

**Status:** fixed; independently verified by automated regression
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/tool-input.ts`, `test/bridges/hooks/tool-input.test.ts`, `test/bridges/hooks/event-adapters.test.ts`, `features/hook/tool-use.feature`
**Commit:** `58895946`
**Applied fix:** Candidate path conversion errors return an ignored value. Unit cases cover malformed escapes and remote hosts for Read and Write. A Pi scenario checks that Read runs its original call and emits one sanitized notice.

### CR-04: Case folding routes distinct custom tools through native result codecs

**Status:** fixed; independently verified by automated regression
**Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts`, `extensions/pi-claude-marketplace/bridges/hooks/tool-result-files.ts`, `extensions/pi-claude-marketplace/bridges/hooks/tool-result-search-shell.ts`, `extensions/pi-claude-marketplace/bridges/hooks/tool-output-files.ts`, `extensions/pi-claude-marketplace/bridges/hooks/tool-output-search-shell.ts`, `test/bridges/hooks/event-adapters.test.ts`, `test/bridges/hooks/payloads/post-tool-use.test.ts`, `test/bridges/hooks/tool-result-files.test.ts`, `test/bridges/hooks/tool-result-search-shell.test.ts`, `test/bridges/hooks/tool-output-files.test.ts`, `test/bridges/hooks/tool-output-search-shell.test.ts`, `features/hook/tool-use.feature`, `features/lib/hook-case-tools.ts`, `features/step_definitions/hook/tool-use.steps.ts`
**Commit:** `cf819853`
**Applied fix:** Forward and reverse result codecs select only exact lowercase native tool IDs. Custom `Bash` and `Read` stay on the generic schema, with projection and replacement tests. Native fixtures use lowercase IDs. A Pi scenario checks a custom `Bash` redaction.

### WR-01: MCP matching prose still promises the superseded prefix semantics

**Status:** fixed
**Files modified:** `docs/hooks-compatibility.md`
**Commit:** `8b5c728d`
**Applied fix:** The guide now explains unanchored MCP regex matching and when to anchor or escape a pattern. Its `if` rows describe literal identity and server-prefix rules independently.

## Verification

The source and behavioral checks ran in isolated worktree `.claude/worktrees/agent-reviewfix-02-625429-1794575796` on Node `v26.13.1`. Each source commit passed the repository's `npm run check:commit` hook, including project typecheck, lint, feature dry-run, and direct coverage for staged source-test pairs. The documentation commit passed its applicable hooks. Fallow reported no issues before each commit.

Focused owner tests passed for all modified source-test pairs. The installed Pi `ExtensionRunner` boundary suite passed all six cases. Named Cucumber scenarios passed: Glob alias (adapter, 15 steps), malformed Read URL (adapter, 16 steps), custom `Bash` (adapter, 15 steps), and unchanged-text MCP redaction (adapter and builtin, 17 steps each). `npm run check:features` passed. The orchestrator will run the full combined-tree `npm run check` gate.

---

_Fixed: 2026-11-13T13:46:01Z_
_Fixer: gsd-code-fixer_
_Iteration: 1_
