---
phase: 05-production-export-ownership
plan: "08"
subsystem: mcp-bridge
tags: [mcp, export-ownership, parser-retirement, public-contract-tests]
status: complete
requires:
  - phase: 05-production-export-ownership
    plan: "01"
    provides: Complete production finding census and calibrated analyzer controls
provides:
  - Retirement of the unreachable bridge parser and its exclusive types
  - Public-operation coverage of private substitution and live malformed-field errors
  - Materialization gate using the live domain resolution path
affects: [05-production-export-ownership]
tech-stack:
  added: []
  patterns: [private-same-module-helpers, public-error-contract-assertions]
key-files:
  created: []
  modified:
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
  deleted:
    - extensions/pi-claude-marketplace/bridges/mcp/parse.ts
    - tests/bridges/mcp/parse.test.ts
key-decisions:
  - Retire the bridge parser only after confirming that its sole production reference is an unused barrel re-export.
  - Preserve the live MalformedMcpServersError implementation privately and assert its observable class name and complete fields through staging and unstaging.
  - Retire the parser's three exclusive types and only their corresponding compile-time proofs as one bounded dependency cleanup.
duration: 8m
completed: 2026-09-14
plan_head_before: 7615c965593c12e9f984e183f1b74577a719e10a
actuals:
  tasks: 3
  commits: 1
---

# Phase 5 Plan 8: Production-owned MCP resolution and staging summary

The unreachable bridge parser and its exclusive types are retired; live substitution and malformed-field refusals remain covered through their public operations with exact configuration, error, byte, and state assertions.

## Completion and coordination

The three amended tasks are implemented. Source and test writes are stopped for independent review. The parent owns stable-wave census reconciliation, aggregate coverage, final precommit, commits, and root planning updates. No commits were created by this executor, and this summary remains pending verification until the parent completes those gates.

CodeGraph ran before preparation and again before repository edits. Preparation remained under `/tmp` until Plan 05-01 committed as `7615c965`. No shared configuration, census pin, other MCP concern, or root planning file was edited by this plan.

## Caller and retirement evidence

- `parseMcpServers` had only same-module calls from `resolvePluginMcpServers`.
- `resolvePluginMcpServers` had only its unused `bridges/mcp/index.ts` re-export as a production reference. Its remaining readers were the parser owner, barrel owner, and architecture materialization test. The module and its paired test were deleted together; no replacement wrapper was added.
- `deepSubstitute` remains called recursively and by `substituteAndInject` in the same module. Only export visibility changed.
- `MalformedMcpServersError` is live: `classifyMcpServers` constructs it, and both `prepareStageMcpServers` and `unstageMcpServers` call that classifier. Its class implementation and error fields remain unchanged; only export visibility changed.
- `McpServersSource`, `ResolvedMcpServers`, and `ResolvePluginMcpServersInput` had no production readers outside the removed parser and their own exclusive type relationships. Their declarations and only their corresponding type-owner proofs were removed. Stage input documentation now names the domain resolver.

Trace artifacts: `/tmp/phase5-08-codegraph.txt`, `/tmp/phase5-08-error-domain-codegraph.txt`, and `/tmp/phase5-08-execution-codegraph.txt`.

## Assertion ledger

| Original contract | Disposition and retained public assertion | Evidence |
| --- | --- | --- |
| Parser valid-map reference identity and complete map | Retired with the unreachable parser. The live architecture gate now asserts the complete `resolveStrict` result and complete MCP config. | Architecture materialization case passes |
| Parser unresolved-reference TypeError; five invalid map shapes; four invalid entry shapes; four unsafe-name errors | Exact legacy-only error contracts retire with their implementation. Current domain resolution owners already cover live validation, inline/reference resolution, malformed-state classification, and failure handling; those owners remain unchanged. | No production caller evidence; existing domain owner coverage remains part of the parent gate |
| Parser entry/manifest/standalone precedence; wrapped/unwrapped acceptance; absent, empty and ENOTDIR cases | Legacy source-tag result contracts retire with the parser. Current domain precedence and reference assertions remain in their existing owners. The architecture fixture now reaches the actual domain resolver. | Full resolved object plus materialization bytes asserted |
| Parser EISDIR code/syscall, malformed JSON cause, four invalid standalone shapes, three invalid wrapper shapes, higher-priority malformed-source refusal | Exact obsolete throw contracts retire only with the unreachable parser. Live domain resolution and scoped stage/unstage failure contracts remain. No reachable error path was deleted. | Caller trace; stage and unstage direct owners remain 100% |
| Barrel parser binding identity | Removed only the obsolete binding assertion. All seven live staging/unstaging runtime identities and existing handle type checks remain. | Barrel owner passes; index direct coverage 100% |
| Eleven direct deep-substitution cases | Every case now invokes `substituteAndInject`: complete nested object/array and original-input assertions; fresh result/args/headers; literal keys; five non-string/empty leaves; repeated/missing/unknown tokens; one-pass replacement; exact Unicode and replacement-pattern characters; literal `__proto__` own-key/prototype checks. Scalar cases now assert the whole entry record. | All 15 substitution cases pass; direct coverage 100% |
| Nested command substitution without env injection | Same expected nested payload and unchanged source, plus the complete three-variable injected environment required by the public operation. | Full returned object assertion |
| Four existing substitution/injection cases | Preserved complete project/user/URL/single-pass results, declared-env precedence, unchanged source, and freshness assertions. | Same direct owner remains 100% |
| Five malformed-field cases in stage and five in unstage | Private-constructor import/identity check replaced with `Error` inheritance and exact constructor name, error name, complete message, `mcpJsonPath`, and `valueKind`. Retained full scoped-file bytes and inode, size, mtimeNs, ctimeNs after refusal. | Both owner suites pass; both direct owners remain 100% |
| Stage prepare, replace, commit, abort, rollback, finalize contracts | All other staging tests and assertions remain unchanged, including complete results, warning lists, foreign content, output bytes and rollback state. | Stage direct coverage 431/431 lines, 19/19 functions, 89/89 branches |
| Architecture MCP-only isolation | Replaced only the obsolete resolver call and its result shape. Now asserts full installability/name/root/support/notes/component paths/default/config result; preserves full commit provenance and warnings, exact output bytes, all dormant-source positive controls, and all sibling-target absence checks. | Materialization case passes |

## Retired compile-time proof ledger

Only the parser's exclusive type contract retired:

- `McpServersSource`: four accepted source literals and one rejected nonmember literal.
- `ResolvedMcpServers`: complete source/server object; missing-source rejection; readonly source assignment rejection.
- `ResolvePluginMcpServersInput`: complete entry/manifest/root object; missing-root rejection; readonly root assignment rejection.

Every existing `RawMcpDoc`, staging input/result, provenance, preparation/replacement discriminant, unstage identity, readonly array, and unrelated readonly field proof remains. The type-only direct owner passed; strict typecheck is recorded below.

## Finding dispositions for parent reconciliation

The expected reviewed change removes these five identities from the initial census:

```text
unused_exports|extensions/pi-claude-marketplace/bridges/mcp/index.ts|resolvePluginMcpServers
unused_exports|extensions/pi-claude-marketplace/bridges/mcp/parse.ts|parseMcpServers
unused_exports|extensions/pi-claude-marketplace/bridges/mcp/parse.ts|resolvePluginMcpServers
unused_exports|extensions/pi-claude-marketplace/bridges/mcp/stage.ts|MalformedMcpServersError
unused_exports|extensions/pi-claude-marketplace/bridges/mcp/substitute.ts|deepSubstitute
```

The first three retire with their unreachable concern. The last two become private behind real production operations. Removing the parser would orphan its three exclusive types; those declarations are retired in this same change rather than creating new unused-type debt. No whole-tree census was run while concurrent source writers were active, and the shared pin was not edited. The parent must confirm the combined wave delta on the stable tree.

## Verification

- `node --test tests/bridges/mcp/index.test.ts tests/architecture/integration-materialization-gate.test.ts tests/bridges/mcp/substitute.test.ts tests/bridges/mcp/stage.test.ts tests/bridges/mcp/unstage.test.ts tests/bridges/mcp/types.test.ts`: **73/73 passed**, zero skipped/cancelled/todo. Log: `/tmp/phase5-08-focused.log`.
- Temporary preparation, against the original live production implementations: **65/65 passed** across substitution, stage, unstage and materialization. This demonstrated that assertion migration preserves current behavior before export removal. Log: `/tmp/phase5-08-preparation-focused.log`.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/mcp/index.ts`: **19/19 lines, 0/0 functions, 1/1 branches**.
- The same direct command for `substitute.ts`: **122/122 lines, 7/7 functions, 26/26 branches**.
- The same direct command for `stage.ts`: **431/431 lines, 19/19 functions, 89/89 branches**.
- The same direct command for `unstage.ts`: **106/106 lines, 1/1 functions, 22/22 branches**.
- The same direct command for `types.ts`: **type-only owner passed**.
- Direct logs: `/tmp/phase5-08-direct-{index,substitute,stage,unstage,types}.log`. An initial combined-path invocation was rejected by the script's single-path CLI contract without running tests; the individual commands above all exited zero.
- `npm run typecheck`: passed with no diagnostics; `/tmp/phase5-08-typecheck.log`.
- Scoped ESLint found only an architecture import-order issue; it was fixed and the final scoped check passed. All ten surviving owned files are lint clean. Logs: `/tmp/phase5-08-eslint.log`, `/tmp/phase5-08-eslint-architecture-final.log`.
- Prettier completed on all ten surviving owned files; scoped `git diff --check` passed.
- Stable-wave complete census, aggregate production coverage, complete check and commits remain parent coordinated.

## Deviations from plan

**Live error class retained privately.** The original conditional retirement assumption did not hold after caller revalidation: the malformed-field error is thrown on both live bridge paths. Its implementation remains, and the amended plan records the exact public failure assertion mapping. No behavior or field was removed.

**Bounded orphan-type task added.** The parent approved `types.ts` and its paired type test as a third task with two files. Removing the exclusive parser also removes its private-in-purpose source vocabulary and input/output contract. This expands the coherent source/test scope from ten to twelve files while keeping each task within five files. Every retired proof is listed above.

## Self-Check: PASSED

All ten surviving source/test files and the amended plan exist; both retired parser files are absent. Focused tests and all five direct owner checks passed. The source diff changes no live implementation beyond export visibility and removes only the unreachable parser and its exclusive types. No stub, skipped test, coverage exclusion, threshold change, test-only production export, or new dependency was introduced. Parent integration and commits remain explicit pending work.


## Final parent acceptance

Completed in `080d395e` with the five-plan stable wave. The earlier pending integration statements record executor handoff status and are superseded by this acceptance. The final complete census is 85 findings: exactly 26 reviewed initial findings removed, with no additions. The early frontmatter facade retirement accounts for the change from the intermediate 86-finding snapshot. All 53 analyzer/census controls pass. Native unit tests pass 6,230/6,230, with production coverage exactly 63,120/63,120 lines, 1,848/1,848 functions and 9,099/9,099 branches across 225 emitted modules. All 233 direct pairs pass; the two pre-existing shortfalls match their unchanged pins. The complete pre-commit gate passes and independent review reports no findings across all 54 changed paths. See [wave verification](05-WAVE-2-VERIFICATION.md) for logs, limits and assertion preservation. EXPORT-01 and EXPORT-02 remain open for later plans.
