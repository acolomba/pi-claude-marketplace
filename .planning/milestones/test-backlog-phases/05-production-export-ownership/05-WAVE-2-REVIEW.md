---
phase: 05-production-export-ownership
reviewed: 2026-09-14T16:14:08Z
depth: standard
diff_base: 7615c965593c12e9f984e183f1b74577a719e10a
review_scope: wave-2
plans_reviewed: ["05-02", "05-06", "05-08", "05-09", "05-13"]
files_reviewed: 54
files_reviewed_list:
  - tests/architecture/markers-snapshot.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/integration/provenance-invisibility.test.ts
  - extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts
  - tests/bridges/hooks/if-field/index.test.ts
  - extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-adapters.ts
  - extensions/pi-claude-marketplace/bridges/hooks/exec-result.ts
  - tests/bridges/hooks/exec-result.test.ts
  - extensions/pi-claude-marketplace/shared/errors.ts
  - tests/shared/errors.test.ts
  - eslint.config.js
  - tests/architecture/sonar-test-rules.test.ts
  - extensions/pi-claude-marketplace/bridges/mcp/parse.ts
  - tests/bridges/mcp/parse.test.ts
  - extensions/pi-claude-marketplace/bridges/mcp/index.ts
  - tests/bridges/mcp/index.test.ts
  - tests/architecture/integration-materialization-gate.test.ts
  - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
  - tests/bridges/mcp/substitute.test.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - tests/bridges/mcp/stage.test.ts
  - tests/bridges/mcp/unstage.test.ts
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - tests/bridges/mcp/types.test.ts
  - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
  - tests/bridges/mcp/marker.test.ts
  - extensions/pi-claude-marketplace/bridges/mcp/collision-slots.ts
  - tests/bridges/mcp/collision-slots.test.ts
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - tests/platform/pi-api.test.ts
  - extensions/pi-claude-marketplace/edge/completions/data.ts
  - tests/edge/completions/data.test.ts
  - extensions/pi-claude-marketplace/edge/flag-catalog.ts
  - tests/edge/flag-catalog.test.ts
  - tests/architecture/flag-catalog-drift.test.ts
  - extensions/pi-claude-marketplace/edge/router.ts
  - tests/edge/router.test.ts
  - tests/edge/register.test.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/fetch.ts
  - tests/edge/handlers/plugin/fetch.test.ts
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - tests/edge/handlers/tools.test.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-flow.ts
  - tests/orchestrators/plugin/list-flow.test.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-orphan-fold.ts
  - tests/orchestrators/plugin/list-orphan-fold.test.ts
  - tests/architecture/gate-targets.ts
  - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
findings:
  critical: 0
  warning: 0
  info: 0
  total: 0
status: clean
integration_status: passed
---

# Phase 5: Wave 2 Code Review

**Reviewed:** 2026-09-14T16:14:08Z
**Depth:** standard, with targeted caller tracing
**Files Reviewed:** 54 paths, including two retired files
**Status:** no substantiated findings in the bounded changes

## Summary

This review covers the frozen uncommitted Wave 2 changes for plans 05-02, 05-06, 05-08, 05-09 and amended 05-13 against `7615c965`, including the parent-owned eighth type-only Sonar exception, exact census pin update and frontmatter marker re-export retirement brought forward from 05-03 into 05-02. The exact path list above is the review boundary. Project instructions, TypeScript review skills, plan requirements and assertion ledgers informed the review. CodeGraph preceded source exploration; baseline and current references were also checked for retired bindings. The earlier review is retained and extended to the final 54-path wave scope.

**Code review is complete for this wave; final gate acceptance remains pending.** The census pin and its 26-identity delta have been reviewed. Final offender/benign and shipping controls pass 53/53; the parent is running fresh aggregate native production coverage, all direct pairs and the full quality/precommit gate. `status: clean` applies to the reviewed changes; it is not a phase-completion or aggregate-coverage claim. Later Phase 5 waves remain outside this report.

## Narrative Findings (AI reviewer)

No actionable correctness, security or assertion-strength regression was substantiated in the reviewed wave.

### Review evidence

- **05-02:** The five lifecycle owners replace the generated-name prefix with independently authored identical bytes. Their result, state, warning, inventory, rollback and retry assertions remain. The provenance integration test changes the marker import to its defining module. Architecture cases retain the current exact marker value and exercise both persisted formats, wrong basenames and near-match refusals through the public reader, comparing complete reader results and unchanged document bytes.
- **05-02 final facade closure:** `frontmatter.ts` removes only its unused `GENERATED_AGENT_MARKER` re-export and the adjacent explanatory comment. Its canonical import from `marker.ts` and the writer's exact interpolation remain unchanged. The frontmatter owner never imported the removed binding; the already-reviewed provenance integration import uses its canonical owner. No assertion or emitted byte changes accompany this closure. Bringing this specific 05-03 retirement forward closes the shipping gate's orphaned-export finding without creating a replacement export.
- **05-06:** The retired predicate-facade bindings have no production importer through that facade; the real implementation owners remain. The retained predicate type proof still covers the complete union. All eight hook exhaustiveness call sites now provide their established JSON diagnostic to the shared helper. The default `Unexpected value: ...` diagnostic remains for existing shared consumers. Shared error tests preserve exact constructor, name, message and absent cause. The hook outcome owner retains nine positive and five negative compiler checks, with no decorative runtime case. The Sonar exception names only that eighth file and leaves the other assertion rules enabled; its positive and negative controls pass.
- **05-08:** Baseline references confirm the deleted MCP parser had only its own internal calls and an unused production barrel re-export. Its three exclusive types have no remaining live consumer. The domain resolver supplies the actual staging path. The new architecture resolution assertion compares the complete result and preserves configuration bytes, provenance, dormant-source controls and sibling-target absence. Public substitution cases retain nested values, literal keys, unchanged source, fresh nodes, one-pass behavior, replacement characters and `__proto__` own-key/prototype assertions. The live malformed-field error remains private; stage and unstage retain complete error fields, class-name checks, file bytes and filesystem metadata after refusal.
- **05-09:** Marker cases exercise exact, different and reversed identities and inherited-field refusal through `isOwnedBy`. Collision tests use independent expected paths and distinguish every precedence level, including repeated reads. Retiring the direct freeze assertion is consistent with removing access to the private slot list. Peer inventory and accessor/discovery failure fixtures now assert both fields of the public dependency status; the removed cases duplicate the same failure input and result.
- **05-13 completion and dispatch:** Public completion assertions preserve full labels/replacements, trailing-space behavior, candidate status policy, ordering, target scope, cache reuse and exact resolver-error identity. The ambiguous-name case checks both marketplace-half suggestions, preserving the original map's membership/order assertion. The retired catalog constant has no production reader; independent nineteen-verb inventories, public lookups, type completeness and router reconciliation retain the drift checks and twenty-two accepted spellings. Router usage cases retain independent complete text, severity and zero dispatch; all registered-command argument matrices remain unchanged. Six fetch success shapes remain observable through complete seeded handler notifications. Nine parser refusal fixtures now drive the public handler and retain full diagnostics with strict zero-probe/no-cwd-access boundaries.
- **05-13 list producer and tools:** The loader's installed and available row constructors produce precisely the nine declared statuses. Its failed marketplace headers still have empty plugin lists, while the separate `listPlugins` catch still constructs a failed plugin notification. The narrowed loader return therefore does not remove a reachable failed row. Orphan folding retains its five-status runtime filter and output order; generic block ordering preserves the caller's subtype without changing runtime sorting. Exact-union and negative compiler proofs cover the nine loader statuses, ten impossible notification statuses and narrowed fold/order outputs. The eleven existing registered-tool version fixtures cover all nine live statuses with complete text/details, versions/reasons and zero-network assertions. Retiring the ten helper-only refusal branches is consistent with this producer boundary, while tool load-error handling and list failure notifications remain. The final public return spells the existing public `Exclude<ListMsg, ...>` contract directly; no private `PayloadListMsg` alias escapes it, and the two orphaned helper types remain private.

### Census reconciliation

The reviewer compared both current pins in `tests/architecture/gate-targets.ts` with `/tmp/test-backlog-wave2-census.json`: `PRODUCTION_FINDING_CENSUS` exactly equals the report's finding objects, and `UNOWNED_EXPORT_CENSUS` exactly equals its per-path unused-export inventory. An independent comparison with the baseline pin confirms **111 to 85 identities: 26 removed, zero added**. Unused types, files and class-member categories are unchanged. The only changes are 25 unused-export removals and the duplicate `assertNever` group.

Every removal maps to reviewed source changes: the frontmatter marker facade (05-02); eight predicate facade exports plus the duplicate helper group (05-06); five MCP parser/substitution/error exports (05-08); four ownership/collision/peer helpers (05-09); and seven completion/catalog/fetch/tool/router exports (05-13). The additional final identity is exactly `unused_exports|extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts|GENERATED_AGENT_MARKER`. The intermediate private-type and orphan-type defects described in 05-13 are absent from the frozen source and final report; they are not counted as extra baseline removals. No analyzer category, parser guard or exception was relaxed in the census registry change.

### Verification and limits

The reviewer independently ran the following focused selection: architecture markers, MCP materialization, Sonar rule controls, hook predicate facade, hook outcome types, shared errors, MCP barrel/substitution/stage/unstage/types/marker/collision slots, and Pi API. It passed **252/252 reported tests**, with **0 failures, cancellations or skips**. Type-only owner files contribute runner entries rather than runtime test cases. Log: `/tmp/05-wave2-review-focused.log`.

The initial sandbox invocation reported only fourteen file-level entries and was discarded as execution evidence. The approved normal Node execution path discovered the actual cases. The reviewer also ran `npm run typecheck` through that path; it passed with no diagnostics. Scoped `git diff --check` passed.

Executor evidence was inspected separately from the independent run: the 05-02 owner log records 538 passing cases; MCP direct-owner logs and the 05-09 direct log report exact 100% line/function/branch hits for their owners, with the MCP types owner reported as type-only. The 05-06 summary records focused execution and exact direct-owner counts. The final 05-13 summary and logs record focused batches of 200, 210 and 130 passing checks, with no failures or skips. Its seven direct owners report exact 100% line/function/branch coverage; final completion, fetch, tool and loader closure logs were inspected, including the 631/631, 132/132, 533/533 and 802/802 line counts respectively. Its final strict typecheck and scoped lint passed. These measurements do not establish the combined wave's aggregate baseline. The reviewer did not duplicate the parent's in-progress whole-tree checks; those results must be recorded before final acceptance.

No source files, shared configuration, census pins or root planning state were changed by this reviewer. No commit was created.

### Final facade repair verification

The parent identified the orphaned frontmatter re-export in the first shipping-control run (52/53); the initial aggregate run failed its corresponding census case. Those results are superseded by the source repair and fresh validation. The reviewer inspected `/tmp/test-backlog-wave2-controls-final.log`, which reports **53/53 passing controls** with zero failures or skips, and `/tmp/test-backlog-wave2-frontmatter-direct.log`, which reports exact **639/639 lines, 19/19 functions and 104/104 branches**. Fresh full native unit, all-pairs and precommit runs are still parent-owned; their pending status is not treated as an implementation defect or a successful final gate.

---

_Reviewer: gsd-code-reviewer_
_Scope: Wave 2; plans 05-02, 05-06, 05-08, 05-09 and 05-13; final parent gates pending_


## Parent integration completion

The subsequent stable-wave gates passed: 6,230 unit tests with exact 100% production line/function/branch coverage, 233 direct pairs with unchanged pins, 53 controls, and complete pre-commit. The missing blank-line correction is token-equivalent and passed the clean rerun. The detailed results are recorded in 05-WAVE-2-VERIFICATION.md. The independent review scope and zero-findings verdict above remain unchanged.
