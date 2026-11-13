---
phase: 02-hook-payloads-matchers-and-stop-limit
reviewed: 2026-11-13T13:14:05Z
depth: standard
files_reviewed: 71
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
  critical: 4
  warning: 1
  info: 0
  total: 5
  necessity: 0
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-11-13T13:14:05Z
**Depth:** standard
**Files Reviewed:** 71
**Status:** issues_found

## Summary

Four blocking defects affect successful-result redaction, Glob path provenance, malformed rewrite fallback, and native versus custom tool identity. One warning identifies stale compatibility guidance.

Scope is the explicit 71-file union of the phase's 42 task commits in the supplied evaluation-scope record. Production modules were read in full; tests, feature scenarios, fixtures and documentation were reviewed through their phase-specific changes and necessary surrounding helper/caller context, as agreed with the orchestrator. Per-file history confirmed no unrelated interleaved commit touched these paths between their first and last task changes. The unrelated pi-subagents upgrade was excluded. CodeGraph supplied initial source/call-path orientation; direct source reads and the installed Pi runner/tool implementations supplied boundary evidence.

The review considered the phase context, plan contracts and summaries, including the accepted original-call fallback, exact projected echoes, partial available-fact results, LS exception, modern-field presence rule, native regex semantics and fixed Stop cap. It does not reopen those decisions. The necessity rubric was read; no provable necessity finding was identified.

Focused executable reproductions confirmed CR-01 through CR-04. CR-01 exercised the actual installed Pi ExtensionRunner and inspected a subsequent handler's event. No full suite was rerun; the orchestrator owns the final combined-tree gate. Earlier passing checks and the security audit do not cover the counterexamples below.

## Structural Findings (fallow)

The supplied normalized substrate contains **zero** findings: unused exports 0, unused files 0, duplicate groups 0, circular dependencies 0.

The raw audit reports `warn`, with 59 complexity findings, maximum cyclomatic complexity 19, zero dead-code issues and zero duplication groups. Its audit scope is broader than this review's exact task-file union. Scoped warnings were inspected in context, including the input validators, result parsers and edit preflight. Complexity/estimated coverage warnings alone do not establish an additional correctness defect; no structural finding is promoted into the narrative counts.

## Narrative Findings (AI reviewer)

### Critical Issues

### CR-01: Content-only redaction is discarded when visible text stays the same

**Classification:** BLOCKER
**File:** `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:258-263`
**Related evidence:** `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:266-271`; installed Pi `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js:900-950`.

**Issue:** The generic/MCP no-op check treats an omitted replacement `structuredContent` as equivalent to any original structured value. A hook can return the same public content while deliberately removing a secret-bearing structured result. The adapter returns `undefined`, so Pi preserves both the secret and old output-bearing details. This is a changed output envelope, not the accepted exact-echo case.

**Reproduction:** Original MCP event has `content: [{type: "text", text: "public"}]`, `structuredContent: {secret: "SYNTHETIC_SECRET"}`, and details containing the same marker. Return `updatedToolOutput: {content: [{type: "text", text: "public"}]}`. A downstream handler under the installed Pi ExtensionRunner still observes the original secret in both carriers. Pi would clear structured content if the adapter returned the content-only patch, and the adapter's normal patch already sanitizes details.

**Fix:** Require full semantic equality of content and structured content before treating a generic replacement as an echo. In particular, omission of a previously present structured value must produce a patch with replacement content and sanitized details. Preserve the exact full-envelope echo behavior. Add an actual-runner regression where public text remains unchanged and only structured data is removed.

### CR-02: Glob invents the wrong absolute filename for native path aliases

**Classification:** BLOCKER
**File:** `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/bridges/hooks/tool-result-search-shell.ts:84-85`
**Related evidence:** `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/bridges/hooks/tool-input.ts:22-38`; installed Pi `node_modules/@earendil-works/pi-coding-agent/dist/core/tools/find.js:65`.

**Issue:** Glob resolves the native request's search root with plain `path.resolve`, whereas Pi resolves it with `resolveToCwd`, including home expansion, leading `@`, file URLs and Unicode-space normalization. The emitted absolute filename can therefore name a different location from the file actually found. Hooks receive fabricated path provenance despite the available-facts contract.

**Reproduction:** For cwd `/workspace`, native `find` input `{path: "~/docs", pattern: "*.txt"}` and a single returned `a.txt`, the projector emits `{filenames: ["/workspace/~/docs/a.txt"], numFiles: 1}`. Pi searches the user's home `docs` directory instead. The same mismatch applies to other supported path aliases.

**Fix:** Normalize the requested search root with the same native path semantics used by the file-input translation, then resolve the returned relative filename beneath it. Pass the required home value explicitly at the pure boundary or follow the existing file-result boundary pattern. Add tests for home, at-prefix and file-URL roots and a native-find boundary case; preserve the existing ambiguous-display omissions.

### CR-03: A malformed file-URL rewrite throws instead of retaining the original call

**Classification:** BLOCKER
**File:** `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/bridges/hooks/tool-input.ts:156`
**Related evidence:** `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/bridges/hooks/tool-input.ts:34-35`; `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:318-332`; installed Pi `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js:954-970`.

**Issue:** Read/Write rewrite validation invokes `requestedPath` without containing conversion errors. `fileURLToPath` throws for malformed percent escapes and unsupported file-URL forms. The rejection escapes the adapter and Pi's tool-call handler chain instead of yielding the required unchanged original call plus sanitized rejection notice. A valid native operation is consequently interrupted by malformed hook data.

**Reproduction:** Pass a mutation with `updatedInput: {file_path: "file:///tmp/%ZZ"}` to `adaptToolCallResult` for native `read` input `{path: "original.txt"}`. The promise rejects with `URIError: URI malformed`. The `ignored` arm and notice are never reached. The same path conversion is used for Write.

**Fix:** Catch path-normalization failures at the candidate-validation boundary and return `{kind: "ignored", category: "value"}`. Preserve deny/stop precedence and do not disclose the supplied URL in notices. Add Read and Write regressions for malformed percent escapes and rejected file-URL hosts/forms, including a dispatcher or live-hook test proving the original operation runs and one sanitized notice is emitted.

### CR-04: Case folding routes distinct custom tools through native result codecs

**Classification:** BLOCKER
**File:** `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts:244-250`
**Related evidence:** `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/bridges/hooks/tool-result-files.ts:176-178`; `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/bridges/hooks/tool-result-search-shell.ts:127-135`; `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/bridges/hooks/tool-output-files.ts:229-235`; `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/bridges/hooks/tool-output-search-shell.ts:197-214`; `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/bridges/hooks/payloads/post-tool-use.ts:47-64`.

**Issue:** Native Pi tool identities are exact lowercase names; a custom tool named `Bash` or `Read` is a distinct tool. Input translation deliberately preserves that distinction, as required by plan 02-01. The new result projectors and reverse renderers call `toLowerCase()`, wrongly selecting native codecs for those custom tools. This changes their hook-visible schema and rejects otherwise valid custom result replacements, including redactions.

**Reproduction:** A custom `Bash` event with input `{query: "hello"}`, public text and a custom structured object projects to `{interrupted: false, structuredContent: [the text blocks]}` instead of retaining the custom object. Returning the valid custom replacement `{content: [{type: "text", text: "redacted"}]}` yields no patch because the shell validator rejects it. The original result remains visible.

**Fix:** Select native result codecs only for exact native tool names throughout forward and reverse dispatch. Keep custom case variants on the existing generic schema path. Correct tests that use capitalized Claude names to stand in for native result events, and add distinct custom `Bash`/`Read` tests for projection and successful output replacement.

### Warnings

### WR-01: MCP matching prose still promises the superseded prefix semantics

**Classification:** WARNING
**File:** `/home/acolomba/src/pi-claude-marketplace-gaps/docs/hooks-compatibility.md:173`
**Related evidence:** `/home/acolomba/src/pi-claude-marketplace-gaps/docs/hooks-compatibility.md:148`; `/home/acolomba/src/pi-claude-marketplace-gaps/docs/hooks-compatibility.md:197`; `/home/acolomba/src/pi-claude-marketplace-gaps/extensions/pi-claude-marketplace/domain/components/hooks/matcher.ts:61-65`.

**Issue:** The updated matcher table correctly says `mcp__<server>__.*` is an unanchored JavaScript regex and can match a longer server containing `__`. The tool-name mapping prose still says it is a string-prefix check and that built-in MCP compares the server to the registered name. The `if` table also describes its separate prefix behavior by referring to the matcher behavior, which has now changed. A hook author following the old prose can assume a narrower selection than the actual matcher provides.

**Fix:** Update the remaining prose to the current regex semantics, including anchoring/escaping implications where relevant. Describe MCP `if` predicates independently according to their unchanged identity rules, rather than equating them with regex matchers. Retain the literal-name recovery limitations.

---

_Reviewer: gsd-code-reviewer_
_Depth: standard_
