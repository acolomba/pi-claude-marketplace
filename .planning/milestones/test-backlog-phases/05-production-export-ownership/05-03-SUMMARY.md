---
phase: 05-production-export-ownership
plan: "03"
subsystem: testing
status: complete
integration-status: pending-parent
requirements-completed: []
plan_head_before: 80705c58c34f10fb810276669fc9ae8d9915aba0
requires:
  - phase: 05-02
    provides: Independent marker consumer fixtures and retired frontmatter marker facade
provides:
  - Private agent mapping tables and scalar helpers protected by complete public output assertions
  - Private prefix and legacy markers protected by independent ownership fixtures
affects: [05-production-export-ownership]
tags: [agents, exports, native-coverage, public-contracts]
tech-stack:
  added: []
  patterns: [Public conversion and writer assertions with independent expected bytes]
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/convert.ts
    - tests/bridges/agents/convert.test.ts
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - tests/bridges/agents/frontmatter.test.ts
    - extensions/pi-claude-marketplace/bridges/agents/marker.ts
    - tests/bridges/agents/marker.test.ts
    - extensions/pi-claude-marketplace/bridges/agents/index.ts
    - tests/bridges/agents/index.test.ts
key-decisions:
  - Keep GUIDED_DROPPED_FIELDS public because stage formatAgentWarnings reads it
  - Retire private-object freeze inspections with the inaccessible export while preserving Object.freeze
  - Credit frontmatter marker facade retirement only to Wave 2
actuals:
  tasks: 2
completed: 2026-09-14
---

# Phase 5 Plan 3: Agent Export Ownership Summary

Agent conversion tables and scalar helpers are private; complete converted-agent and emitted-file assertions preserve their public behavior. The detector retains current and legacy ownership recognition with independent file fixtures.

Both owner tasks are implemented and verified. Source writes are frozen. Parent acceptance still requires the stable-wave typecheck, complete census reconciliation, aggregate production unit coverage, full pre-commit gate, and commits. EXPORT-01 remains open for the remaining owner plans.

## Task completion and commit ownership

1. Conversion/frontmatter: all existing public cases retained; table and scalar assertions migrated to public results and complete bytes. Checkout focused check passed 94/94.
2. Marker/facade: prefix and legacy values privatized; unused barrel exports removed; detector and binding/type assertions preserved as mapped below. Checkout focused check passed 22/22.

The parent explicitly owns commits and root planning-state updates for this shared-checkout wave. No task or metadata commit was made here; no commit count is claimed before parent integration. Actual token usage was not available; source diff size is not token-usage telemetry. The parent must record measured commit actuals after integrating the wave.

## Source and finding dispositions

All paths below are under `extensions/pi-claude-marketplace/bridges/agents/`.

| Old finding category | File | Name | Disposition and live caller evidence |
| --- | --- | --- | --- |
| unused_exports | convert.ts | MODEL_MAP | Private; `mapModel` still reads it on `convertAgent`'s enabled mapping path. Values and `Object.freeze` unchanged. |
| unused_exports | convert.ts | TOOL_MAP | Private; `mapToolTokens`, `mapTools`, and `omittedToolMapping` retain their same-file reads through `convertAgent`. Values and `Object.freeze` unchanged. |
| unused_exports | convert.ts | THINKING_VALUES | Private; `mapThinking` retains thinking validation and effort fallback through `convertAgent`. All six values unchanged. |
| unused_exports | frontmatter.ts | emitYamlScalar | Private; `emitGeneratedAgentFile` still uses it for descriptions. Implementation unchanged. |
| unused_exports | frontmatter.ts | sanitizeProvenanceValue | Private; writer and `pushProvenanceList` still use it for source path, original model, and provenance lists. Implementation unchanged. |
| Already retired in Wave 2 | frontmatter.ts | GENERATED_AGENT_MARKER | Removed in 080d395e during 05-02 integration. This plan updates its stale header comment only; do not count this identity again. |
| unused_exports | index.ts | GENERATED_AGENT_MARKER | Remove convenience re-export; no production caller of the facade. Defining marker export remains live for the writer. |
| unused_exports | index.ts | GENERATED_AGENT_MARKER_LEGACY | Remove convenience re-export; no production caller of the facade. Detection remains in marker.ts. |
| unused_exports | marker.ts | GENERATED_AGENT_PREFIX | Private; `isOwnedAgentFile` retains basename validation. Exact prefix and reason bytes unchanged. |
| unused_exports | marker.ts | GENERATED_AGENT_MARKER_LEGACY | Private; `isOwnedAgentFile` retains legacy detection. Exact legacy signature unchanged. |

Retained exports: `GENERATED_AGENT_MARKER` has its real writer consumer; `isOwnedAgentFile` has stage/unstage consumers. `GUIDED_DROPPED_FIELDS` remains unchanged because `stage.ts::formatAgentWarnings` reads it to suppress duplicate generic dropped-field warnings. The initial suspicion that this extra export might be test-only was corrected after tracing that production caller; no extra scope added.

No implementation or naming algorithm was restored, removed, or rewritten. Source changes are visibility and obsolete facade commentary only. Phase 3's source-name preservation and current owned migration remain untouched.

## Task 1 assertion ledger

| Original owner assertion | Replacement public assertion | Disposition |
| --- | --- | --- |
| MODEL_MAP exact complete object (`sonnet`, `opus`, `haiku` and their mapped strings) | Three independently enumerated `convertAgent` cases assert the complete ConvertedAgent object, mapped model line, original-model provenance, complete file bytes, and empty warning/drop arrays. Existing missing/empty/inherit/unknown model cases and complete mapped contract remain unchanged. | All mapping pairs preserved through actual emission. |
| MODEL_MAP `Object.isFrozen` | No runtime private-object inspection is retained. `Object.freeze` itself remains unchanged; the object becomes unreachable outside its owner. | Retire the exported-object mutation contract with that export. This is not claimed to be reproduced by a conversion assertion. |
| TOOL_MAP exact complete object (`Read`, `Bash`, `Edit`, `Write`, `Grep`, `Glob`, `LS`) | Seven independently enumerated `convertAgent` cases assert complete ConvertedAgent objects and exact mapped tool/file bytes. Existing explicit-empty rejection, unknown-tool rejection, omission/default narrowing, disallowed values, duplicates, and Skill cases remain unchanged. | All seven mapping pairs preserved. |
| TOOL_MAP `Object.isFrozen` | No runtime private-object inspection is retained. `Object.freeze` itself remains unchanged; the object becomes unreachable outside its owner. | Retire the exported-object mutation contract with that export; no manufactured public equivalent. |
| THINKING_VALUES exact six-entry array (`off`, `minimal`, `low`, `medium`, `high`, `xhigh`) | Six independently enumerated `convertAgent` cases assert complete ConvertedAgent objects with exact thinking/file bytes and empty warning/drop arrays. Existing invalid thinking, valid/invalid effort fallback, omission, and warning order cases remain unchanged. | All six supported values preserved; Set iteration order ceases to be externally available. |
| emitYamlScalar plain text -> unchanged scalar | `emitGeneratedAgentFile` row pins complete bytes with `description: plain description`. | Preserved. |
| emitYamlScalar matching double quotes -> outer single quotes | Writer row pins complete bytes with the literal expected `'"quoted description"'` scalar. | Preserved. |
| emitYamlScalar matching single quotes -> outer double quotes | Writer row pins complete bytes with the literal expected `"'quoted description'"` scalar. | Preserved. |
| emitYamlScalar unmatched opening double quote -> unchanged | Writer row pins complete bytes with the same unmatched opening quote. | Preserved. |
| emitYamlScalar unmatched opening single quote -> unchanged | Writer row pins complete bytes with the same unmatched opening quote. | Preserved. |
| emitYamlScalar LF and CRLF -> spaces | Writer row pins complete bytes with `first line second line third line`. | Preserved. |
| emitYamlScalar empty -> empty | Writer row pins complete bytes including the empty description field and its trailing space. | Preserved. |
| sanitizeProvenanceValue plain path -> unchanged | Writer row pins complete bytes for sourcePath, originalModel, droppedFields, droppedTools, and warnings using the independent expected path. | Preserved and expanded to all sanitizer consumers. |
| sanitizeProvenanceValue LF/CRLF injection text -> spaces | Writer row pins complete bytes with the original independently expected `agents/reviewer.md injected: field warning` on all five provenance consumers. | Preserved and expanded. |
| sanitizeProvenanceValue empty -> empty | Writer row pins complete bytes with empty scalar/list entries, including exact whitespace, at all five consumers. | Preserved and expanded. |

All existing parseFrontmatter cases are byte-for-byte preserved. Existing complete writer contracts (metadata, source injection, legends, newline framing, omitted/explicit tools, skills) are unchanged. All existing GUIDED_DROPPED_FIELDS and convertAgent tests are preserved byte-for-byte apart from formatter changes; only the three mapping-export describe groups were replaced. New expected file construction uses literal fixture fragments, not production serialization or transformed actual output.

## Task 2 assertion ledger

| Original owner assertion | Replacement public assertion | Disposition |
| --- | --- | --- |
| Exact exported GENERATED_AGENT_PREFIX string | Existing independent literal valid-prefix detection plus exact foreign-basename error retained. New cases reject a truncated prefix and the same prefix missing its terminal hyphen, with complete expected reason and unchanged file bytes. | Prefix behavior preserved through detector; private value no longer imported. |
| Exact exported GENERATED_AGENT_MARKER_LEGACY string | Existing literal legacy-only file accepted unchanged; one-byte legacy variant rejected unchanged; new truncated legacy marker rejected unchanged. | Legacy bytes preserved through detector. |
| Exact exported current marker string | Original strict equality assertion retained. | Real writer binding remains public. |
| Barrel current marker same-binding assertion | Remove with the no-caller convenience export; add type-only negative export check. Defining marker's exact string assertion and writer bytes remain. | Retired facade contract, preserved underlying marker contract. |
| Barrel legacy marker same-binding assertion | Remove with the no-caller convenience export; add type-only negative export check. Detector legacy-only, one-byte variant, and truncation cases cover the underlying behavior. | Retired facade contract, preserved underlying legacy recognition. |

All eight remaining runtime barrel binding assertions and every original type proof remain. Every original marker public behavior case remains, including ENOENT success and unchanged directory, foreign basename before read, current/legacy acceptance and unchanged bytes, marker-free/one-byte variants/malformed bytes rejection, and EISDIR class/code/syscall plus unchanged directory. Four new marker cases add both prefix truncations and both signature truncations.


## Checkout verification

All commands below ran with real native Node execution outside the restricted sandbox, after applying the approved files. No import-failure or whole-file-only pass is counted as successful test discovery.

| Check | Result | Log |
| --- | --- | --- |
| `node --test tests/bridges/agents/convert.test.ts tests/bridges/agents/frontmatter.test.ts` | Exit 0; 94 tests, 4 suites; no failures/skips/todos | `/tmp/agent-export-prep/checkout-task1.log` |
| `node --test tests/bridges/agents/marker.test.ts tests/bridges/agents/index.test.ts` | Exit 0; 22 tests, 8 suites; no failures/skips/todos | `/tmp/agent-export-prep/checkout-task2.log` |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/convert.ts` | Exit 0; branches 117/117, functions 23/23, lines 717/717 | `/tmp/agent-export-prep/checkout-direct-convert.log` |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts` | Exit 0; branches 104/104, functions 19/19, lines 638/638 | `/tmp/agent-export-prep/checkout-direct-frontmatter.log` |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/marker.ts` | Exit 0; branches 11/11, functions 1/1, lines 86/86 | `/tmp/agent-export-prep/checkout-direct-marker.log` |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/bridges/agents/index.ts` | Exit 0; branches 1/1, functions 0/0, lines 22/22 | `/tmp/agent-export-prep/checkout-direct-index.log` |
| Installed ESLint on the eight exact source/owner files | Exit 0; no findings | `/tmp/agent-export-prep/checkout-eslint.log` |
| `git diff --check` for the owner directories | Exit 0 | Command output clean |

The earlier preparation-only run also passed 116/116 in an isolated temporary copy and measured 100% native line/function/branch coverage for every pair. The checkout direct instrument results above supersede those preparation measurements. No existing coverage pin, exclusion, analyzer configuration, or threshold was changed.

## Finding delta for parent reconciliation

Nine expected unused-export identities disappear from this plan: three in convert, two scalar helpers in frontmatter, two marker facade bindings in index, and two private detector constants in marker. The tenth original plan identity, frontmatter's current-marker facade, was already removed in Wave 2 and is not a new delta. No census was run while other owners were writing; parent must verify the complete stable report before accepting these dispositions.

## Deviations and sequencing

- Parent requested a temporary preparation stage followed by a coordinated apply. Seven files matched preparation baselines byte-for-byte; frontmatter differed only by the explicitly authorized Wave 2 facade retirement. That exact delta was validated before applying.
- Frontmatter marker facade removal moved to 05-02 because migrating its last test consumer exposed a shipping Fallow finding. This plan only updates the stale header and privatizes its two remaining helpers.
- Both tasks preserve existing behavior. Replacement public-output assertions already passed the existing implementation during preparation. No intentionally failing runtime assertion, RED commit, or fabricated RED evidence is claimed.
- Obsolete exported-object freeze and facade-binding assertions are explicitly retired with the removed public access, as mapped above. Actual freeze implementations and underlying behavior remain unchanged.
- Per parent ownership, typecheck and integrated quality/census/aggregate runs wait for writer freeze; no concurrent whole-tree report or shared pin write was attempted.

## Remaining integration work

Parent must review this assertion ledger, run typecheck to validate the new negative barrel type checks, reconcile the nine exact identities with the stable census, verify aggregate production unit coverage remains exactly 100%, run the complete pre-commit gate, commit the approved wave, and record commit metrics and root planning state. These are pending integration checks, not claimed passes.

## Self-Check: PASSED

All eight declared files exist. Each prepared baseline was validated before applying, and the checkout source changes stay inside those eight owner paths. All four source/test pairs pass the repository's exact direct instrument; both task commands discover their intended cases. No implementation stub, skipped test, new network/auth/filesystem trust boundary, production exclusion, test-only seam, or new dependency was introduced. No commit is asserted because the parent reserved commit ownership.



## Final parent acceptance

Completed in `6a463603` with the five-plan stable wave. Earlier pending statements record executor handoff and are superseded by this acceptance. All 6,238 unit tests pass; each of 225 emitted production modules retains exact 100% coverage, totaling 62,680/62,680 lines, 1,835/1,835 functions and 9,065/9,065 branches. All 234 direct pairs pass, including nine type-only owners and the two unchanged existing pins. The complete census moves from 85 to 57 through exactly 28 reviewed removals, with zero additions; all 43 analyzer/census controls and fifteen Sonar controls pass. Independent review reports zero findings across the 56-file scope. Full mandatory pre-commit passes. See [wave verification](05-WAVE-3-VERIFICATION.md) for evidence and limits. Remaining export plans keep EXPORT-01 and EXPORT-02 open.
