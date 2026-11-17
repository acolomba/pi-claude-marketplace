---
phase: 02-hook-payloads-matchers-and-stop-limit
reviewed: 2026-11-13T13:48:54Z
depth: standard
iteration: 2
reviewed_head: d8930842
files_reviewed: 72
files_reviewed_list:
  - docs/hooks-compatibility.md
  - docs/research/claude-hook-config-syntax.md
  - docs/research/parity-gaps/hooks.md
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use-failure.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts
  - extensions/pi-claude-marketplace/bridges/hooks/payloads/pre-tool-use.ts
  - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - extensions/pi-claude-marketplace/bridges/hooks/tool-batch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/tool-input-search.ts
  - extensions/pi-claude-marketplace/bridges/hooks/tool-input.ts
  - extensions/pi-claude-marketplace/bridges/hooks/tool-output-files.ts
  - extensions/pi-claude-marketplace/bridges/hooks/tool-output-search-shell.ts
  - extensions/pi-claude-marketplace/bridges/hooks/tool-result-files.ts
  - extensions/pi-claude-marketplace/bridges/hooks/tool-result-search-shell.ts
  - extensions/pi-claude-marketplace/bridges/hooks/wire-protocol.ts
  - extensions/pi-claude-marketplace/domain/components/hook-tool-names.ts
  - extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts
  - extensions/pi-claude-marketplace/domain/components/hooks/partition.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - features/hook/async.feature
  - features/hook/matchers.feature
  - features/hook/mcp-tool-names.feature
  - features/hook/prompt-and-stop.feature
  - features/hook/tool-failure.feature
  - features/hook/tool-use.feature
  - features/lib/hook-case-tools.ts
  - features/lib/hook-files.ts
  - features/lib/hook-mcp-tool-server.ts
  - features/lib/hook-recorder.ts
  - features/lib/hook-result-observer.ts
  - features/skill/model-reads.feature
  - features/step_definitions/hook/async.steps.ts
  - features/step_definitions/hook/prompt-and-stop.steps.ts
  - features/step_definitions/hook/runs.steps.ts
  - features/step_definitions/hook/tool-use.steps.ts
  - features/support/world.ts
  - test/architecture/hook-script-cleanup.test.ts
  - test/architecture/hooks-cap-notify.test.ts
  - test/architecture/hooks-translators.test.ts
  - test/bridges/hooks/async-rewake/registry.test.ts
  - test/bridges/hooks/dispatch-exec.test.ts
  - test/bridges/hooks/dispatch.test.ts
  - test/bridges/hooks/event-adapters.test.ts
  - test/bridges/hooks/event-router.test.ts
  - test/bridges/hooks/exec-result.test.ts
  - test/bridges/hooks/payloads/post-tool-use-failure.test.ts
  - test/bridges/hooks/payloads/post-tool-use.test.ts
  - test/bridges/hooks/payloads/pre-tool-use.test.ts
  - test/bridges/hooks/runtime.test.ts
  - test/bridges/hooks/settle.test.ts
  - test/bridges/hooks/tool-batch.test.ts
  - test/bridges/hooks/tool-input-search.test.ts
  - test/bridges/hooks/tool-input.test.ts
  - test/bridges/hooks/tool-output-files.test.ts
  - test/bridges/hooks/tool-output-search-shell.test.ts
  - test/bridges/hooks/tool-result-files.test.ts
  - test/bridges/hooks/tool-result-search-shell.test.ts
  - test/bridges/hooks/wire-protocol.test.ts
  - test/domain/components/hooks.test.ts
  - test/domain/components/hooks/matcher.test.ts
  - test/domain/components/hooks/partition.test.ts
  - test/domain/hooks-resolution.test.ts
  - test/domain/plugin-resolver.test.ts
  - test/fixtures/hooks-pretooluse-matcher-mix.json
  - test/integration/hooks-result-boundary.test.ts
  - test/orchestrators/plugin/info.test.ts
  - test/orchestrators/plugin/install-flow-ledger.test.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
  necessity: 0
status: clean
---

# Phase 2: Code Review Report

**Reviewed:** 2026-11-13T13:48:54Z
**Depth:** standard
**Iteration:** 2
**Files Reviewed:** 72
**Status:** clean

## Summary

All five findings from the first review are resolved. Independent reproduction checks passed for the four runtime defects. No new defect was found in the fixes, their callers, the new fixture or the changed regression scenarios. All reviewed files meet quality standards. No issues found.

This review retains the original standard-depth inspection of the 71-file task-commit scope and adds `features/lib/hook-case-tools.ts`. Unchanged files retain the first review's analysis. The rereview inspected every change in `087cc071`, `af1272c8`, `58895946`, `cf819853`, `8b5c728d` and `d8930842`, plus necessary caller and boundary context. The six commits are contiguous after `90a2f8cb`; unrelated pi-subagents work remains excluded. Production source was read through CodeGraph and exact diffs; new and changed tests/scenarios were inspected for meaningful assertions, native event identity, downstream observer ordering and full output comparisons.

The phase's settled contracts remain unchanged: available-fact projections, whole-original-call fallback for rejected rewrites, exact full-result echoes, native case-sensitive identities, modern MCP field presence, LS exception, JavaScript regex behavior and eight Stop continuations. The necessity rubric remains applicable; no provable necessity defect was found.

The fix report's generic “requires human verification” labels are resolved by the concrete source analysis and executable regressions below. No manual verification remains for these five findings. The orchestrator still owns the final full combined-tree `npm run check`; this review did not run that gate.

## Structural Findings (fallow)

The supplied normalized substrate contains zero unused exports, unused files, duplicate groups or circular dependencies. Its raw pre-fix audit reports `warn` for complexity/estimated coverage, with maximum cyclomatic complexity 19, zero dead-code issues and zero duplication groups. Those scoped warnings were assessed in the first review and did not establish separate defects.

The substrate predates the six fixes and is not represented as a fresh audit. The fix report records clean fallow checks and passing normal commit hooks for the fixes. The small changes add no new codec abstraction or cyclic dependency: the search projector now consumes the existing path normalizer, and the new fixture has an explicit live scenario consumer.

## Narrative Findings (AI reviewer)

No open BLOCKER or WARNING findings.

### Previous findings verified as resolved

| Previous finding | Current source evidence | Independent verification and retained regression coverage |
| --- | --- | --- |
| CR-01: Same-text content-only redaction retained structured data | `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:258-270` now compares both content and structured content for equality. Omission of an existing structured value produces the sanitized patch. | Replayed the original synthetic-secret example through the installed Pi ExtensionRunner and a downstream handler. Public text stayed identical, structured content disappeared, and only safe server/tool details remained. An exact full-envelope echo still returned no patch. Reran `test/integration/hooks-result-boundary.test.ts` successfully. The new shared MCP scenario asserts complete handler/model records under both profiles; the fix report records both passing. |
| CR-02: Glob reported the wrong absolute path for native aliases | `extensions/pi-claude-marketplace/bridges/hooks/tool-result-search-shell.ts:87-90` uses `requestedPath` before resolving the returned filename. | Replayed home, at-prefix, file-URL and Unicode-space roots; all four produced the expected native search location. Reviewed the new owner and payload cases and the live at-prefixed native-find scenario. Existing ambiguous-display and truncation omissions remain before path projection. |
| CR-03: Malformed file-URL rewrite escaped as an exception | `extensions/pi-claude-marketplace/bridges/hooks/tool-input.ts:156-166` contains candidate normalization errors and returns the existing ignored-value outcome. | Replayed malformed percent escapes and remote file-URL hosts for both Read and Write: no exception, no input mutation, and the original call remained intact. Reran the malformed-file-URL adapter cases, which assert one complete sanitized notification and the unchanged input. The live Read scenario checks the original result and rejection notice; deny/stop precedence remains upstream of mutation. |
| CR-04: Case folding selected native codecs for custom tools | `extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:244-250`, `tool-result-files.ts:176-178`, `tool-result-search-shell.ts:131-139`, `tool-output-files.ts:229-235` and `tool-output-search-shell.ts:197-214` use exact native IDs. | Replayed custom `Bash` and `Read` events: each retained its structured schema, accepted a generic content replacement and cleared output details. Reviewed all corrected lowercase native fixtures and custom identity cases. The new `hook-case-tools.ts` fixture and live custom-Bash scenario assert actual hook input, schema, model response and downstream redaction. |
| WR-01: Compatibility prose promised superseded MCP prefix semantics | `docs/hooks-compatibility.md:173-175` describes unanchored regexes and anchoring/escaping; its `if` rows at lines 198-199 independently describe literal and server-prefix identity. | Compared the wording with `domain/components/hooks/matcher.ts:61-65` and `domain/components/hooks/builtin-mcp-tool-names.ts:120-153`. The contradictory string-prefix matcher claim and misleading equivalence with `if` predicates are removed. |

### Verification performed during this rereview

- Independent assertion-based replay of all four original counterexamples, including the actual installed Pi runner for same-text redaction, four path aliases, malformed URLs on both file tools, and both custom case variants: passed.
- `node --import ./test/platform/isolated-pi-home.ts --test test/integration/hooks-result-boundary.test.ts`: passed.
- `node --import ./test/platform/isolated-pi-home.ts --test --test-name-pattern='malformed file URL' test/bridges/hooks/event-adapters.test.ts`: passed.
- Inspected all six fix commits, their changed test regions, the new fixture and complete new/modified scenario assertions. No source or test files were changed by this review.

The fixer separately reports passing owner/direct-coverage checks, normal commit hooks, feature validation, and named Cucumber scenarios for native Glob, malformed Read, custom Bash, and same-text MCP under adapter and builtin. Those reported runs supplement the independent checks above; they are not a substitute for the orchestrator's final gate.

---

_Reviewer: gsd-code-reviewer_
_Depth: standard; automatic rereview iteration 2_
