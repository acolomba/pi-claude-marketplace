# Phase 02 — Source, Probe and Planning Audit

Status: planned, awaiting checker and implementation. This record covers the active parity-gaps phase, not archived phases with the same number. No implementation result is claimed.

## Source Coverage

| Source | Item | Plan/task coverage | Disposition |
| --- | --- | --- | --- |
| GOAL | Claude-shaped file input and reverse updates | 02-01-01..03, 02-03-01..03 | COVERED |
| GOAL | Claude-compatible matcher admission and execution | 02-08-01..03 | COVERED |
| GOAL | Eight consecutive Stop continuations | 02-09-01..03 | COVERED |
| GOAL success criteria 1–2 | Single and multi-pair edit, absolute paths, second-pair denial, Write rewrite, MCP alias | 02-01, 02-03, 02-07 | COVERED |
| GOAL success criteria 3–4 | Spaced lists, valid/invalid regex, supported info, ignored prompt/Stop matchers | 02-08 | COVERED |
| GOAL success criteria 5–6 | Eight/ninth cap, ten tool resets, translated/replaced results, original fallback and notice | 02-01, 02-03..07, 02-09 | COVERED |
| REQ | PG-HOOK-01 | 02-01..07, 02-10 | COVERED |
| REQ | PG-HOOK-03 | 02-08, 02-10 | COVERED |
| REQ | PG-HOOK-13 | 02-09, 02-10 | COVERED |
| CONTEXT | D-PG2-01: one invocation per edit pair | 02-03-01..03, 02-04 | COVERED |
| CONTEXT | D-PG2-02: all prechecks before one native batch | 02-03-01..03 | COVERED |
| CONTEXT | D-PG2-03: corresponding-pair rewrite; final targets agree; conflicts block | 02-03-01..03 | COVERED |
| CONTEXT | D-PG2-04: each result/failure hook shares the actual batch result | 02-04-01..03, 02-05-01 | COVERED |
| CONTEXT | D-PG2-05: available-field tool_response translation now | 02-05-01, 02-06-01/03, 02-07-02 | COVERED |
| CONTEXT | D-PG2-06: reverse updatedToolOutput and MCP alias now | 02-05-02/03, 02-06-02/03, 02-07-01..03 | COVERED |
| CONTEXT | D-PG2-07: only supplied facts, documented omissions, no wrappers | 02-05/06, 02-10; COVERAGE opt-outs | COVERED |
| CONTEXT | D-PG2-08: equivalent mappings and native if input | 02-01/02/03, 02-07-02 | COVERED |
| CONTEXT | D-PG2-09: unsupported rewrite uses whole original call plus notice; denial/conflict wins | 02-01-01..03, 02-02-01, 02-03-02/03 | COVERED |
| CONTEXT | D-PG2-10: exact lists, whole regex and ignored prompt/Stop matchers | 02-08-01..03 | COVERED |
| CONTEXT | D-PG2-11: eight/ninth boundary and every native-tool reset | 02-09-01..03 | COVERED |
| CONTEXT | D-PG2-12: real scenarios, fixture discretion and full green gates | Every production plan's task verification; 02-10-02; VALIDATION | COVERED |
| RESEARCH input map | Read/Edit/Write required fields, requested-path normalization, native identity, custom/MCP shape | 02-01-01/03, 02-03-01, 02-07-02 | COVERED |
| RESEARCH shell input | Seconds/milliseconds, finite positive timeout, timer ceiling, display-only description and unsupported flags | 02-01-02/03 | COVERED |
| RESEARCH search input | Glob pattern/root/limit differences; Grep content default, literal escaping, aliases, symmetry, limits and unsupported modes | 02-02-01 | COVERED |
| RESEARCH result inventory | Read text/images, Edit unified batch patch, Write actual input; unknown original metadata omitted | 02-05-01..03 | COVERED |
| RESEARCH result inventory | Glob complete paths/truncation; Grep ambiguous content/counts; Bash combined streams and PowerShell-specific schema | 02-06-01..03 | COVERED |
| RESEARCH reverse invariant | Replacement text/images/empty values; old content, structuredContent and output-derived details removed; feedback-only append preserves originals | 02-05-02/03, 02-06-02/03, 02-07-02/03 | COVERED |
| RESEARCH alias | Modern-field presence wins including falsy values; MCP-only legacy alias; inspected legacy ambiguity | 02-07-01..03, 02-10-01 | COVERED |
| RESEARCH architecture | Pure narrow codecs consumed immediately; adapter owns patch; dispatcher owns authorization and batch transaction | 02-01..07 | COVERED |
| RESEARCH batch | Stable pair/routing order, all preflight outcomes, final target equality, unsupported whole-call fallback and generation guard | 02-03-01..03, 02-04-01 | COVERED |
| RESEARCH async | Shared translators in synchronous, plain async and rewake paths; nonretroactive replies | 02-02-03, 02-04-03 | COVERED |
| RESEARCH matcher | Admission, support labels and runtime agree; canonical identity; no flags; compile once; ignored matchers checked before parsing | 02-08-01..03 | COVERED |
| RESEARCH Stop/state | Exact threshold, tool reset before early exits, distinct runtime flags, reload and stale callbacks, existing agent_settled path | 02-09-01..03 | COVERED |
| RESEARCH security | Typed candidates, own-key protection, authorization precedence, redaction, safe notices and no output-path I/O | T-02-01..26 in owning plans; tests in VALIDATION | COVERED |
| RESEARCH environment | Two real MCP profiles; PowerShell executable absent; pinned installed Pi interfaces | 02-07-02/03, 02-01/06 pure PowerShell contracts, 02-10-01 | COVERED |
| RESEARCH A1/open LS question | Current upstream schema unresolved; preserve name and native input/result shape, disclose limitation | 02-02, 02-06, 02-10; COVERAGE | COVERED as explicit limitation |
| RESEARCH validation | Owner pairing, direct coverage, real command hooks, real Pi result observation and full combined-tree gates | Every plan; 02-05-03 integration; VALIDATION | COVERED |
| RESEARCH result-contract migration | Successful Bash exact serialization and success routing; MCP envelope response assertions with Phase 1 identity/proxy coverage | 02-06-01 owns dispatch-exec.test.ts and tool-failure.feature; 02-07-02 owns mcp-tool-names.feature | COVERED in the same contract-changing task |
| RESEARCH open questions | Four planning dispositions explicitly marked RESOLVED; LS schema, legacy evidence ambiguity and absent PowerShell executable remain disclosed limits | RESEARCH Open Questions; 02-05/06/07/10 task links | COVERED without unsupported parity claims |
| RESEARCH decomposition | Suggested horizontal order is advisory; consumed vertical slices preserve green hooks | 02-01 tracer and later behavior expansions | COVERED by cohesive implementation |
| PROJECT/PATTERNS | Phase 1 MCP recovery, current event adapters, notice strategy, real fixture patterns and stale-map caution | Plan read_first/context and source-grounded tasks | COVERED |

No source item is missing. Deferred wrappers (HOOKRESULT-01), other phases' hook fields/events, Phase 5 continuation timing/environment configuration and Phase 1 companion adoption are exclusions with explicit reasons in COVERAGE. Research and PATTERNS are evidence, not hidden executable requirements; each contract above is written concretely in its task.

## Edge Probe Disposition

Input: /tmp/pg2-edge-coverage.json, with 13 applicable unresolved items and zero unclassified. There is no SPEC. The spec-less fallback resolves the following defensible contracts as explicit plan truths; these are planned tests, not claims of passing tests.

| Requirement/category | Explicit acceptance truth | Plan/task and test owner | Resolution |
| --- | --- | --- | --- |
| PG-HOOK-01 adjacency | Equal or adjacent pairs remain distinct in original order; final normalized targets must agree including unchanged pairs. | 02-03-01/03; tool-batch.test.ts, dispatch.test.ts and conflict scenarios | resolved / explicit |
| PG-HOOK-01 empty | Zero pairs create zero pair invocations; one creates one; malformed/null batch stays untouched for native Pi validation. | 02-03-03; tool-batch.test.ts | resolved / explicit |
| PG-HOOK-01 ordering | Pair index then existing routing order determines fold order, regardless of completion time; final accepted target per pair is compared. | 02-03-01/03 and 02-04-01; dispatch.test.ts | resolved / explicit |
| PG-HOOK-01 concurrency | Cancellation/reload during preflight or an ask cannot commit stale/partial mutation. | 02-03-03; dispatch.test.ts | resolved / explicit |
| PG-HOOK-03 adjacency | Duplicate alternatives and adjacent separators do not duplicate invocations; comma/pipe split, internal space stays literal. | 02-08-01; matcher.test.ts and matchers.feature | resolved / explicit |
| PG-HOOK-03 empty | Omitted/empty/star means all; separator-only means no tool; invalid regex drops group; null retains schema rejection. | 02-08-01/02; matcher.test.ts, partition.test.ts | resolved / explicit |
| PG-HOOK-03 encoding | Exact spelling is case-sensitive; non-list patterns use JavaScript RegExp without flags or Unicode normalization. | 02-08-02; matcher.test.ts | resolved / explicit |
| PG-HOOK-03 ordering | Stable routing and repeated matching; regex alternation remains one whole pattern. | 02-08-02; matcher.test.ts, dispatch.test.ts | resolved / explicit |
| PG-HOOK-13 boundary | 1–8 continue; 9 overrides; test adjacent 7/8/9 values. | 02-09-01; runtime.test.ts, settle.test.ts, prompt-and-stop.feature | resolved / explicit |
| PG-HOOK-13 adjacency | Consecutive equal blocking decisions count separately. | 02-09-01; runtime.test.ts | resolved / explicit |
| PG-HOOK-13 empty | Fresh runtime, empty bucket and allowed Stop consume no continuation budget. | 02-09-01; runtime.test.ts, settle.test.ts | resolved / explicit |
| PG-HOOK-13 ordering | Native tool then Stop starts at one; Stop then tool clears count; synthetic pair views do not reset separately. | 02-09-02; runtime.test.ts, dispatch.test.ts | resolved / explicit |
| PG-HOOK-13 precision | Exact bounded integer, no rounding or overflow; 0/1/7/8/9 and repeated resets. | 02-09-01/02; runtime.test.ts | resolved / explicit |

Equality: **13 applicable = 13 resolved explicit + 0 flagged assumptions**. Backstop-only dispositions: 0. Unclassified: 0. Every acceptance truth is present in must_haves.truths of 02-03, 02-08 or 02-09. LS evidence uncertainty is separately retained above; it is not silently used to dismiss a probe.

## Prohibition Recall and Precision

The adversarial question was applied separately to all three requirements: “What could this feature silently become that the author would not want, but the spec does not forbid?” Recall deliberately produced ten candidates per requirement. Precision then separated routine correctness, already explicit locked constraints and canon security. No new bespoke values constraint survives; no descriptor-less prohibition is invented.

| Requirement | Raw candidates and precision disposition |
| --- | --- |
| PG-HOOK-01 | Routine: omit a pair; mutate before all checks; accept conflicting targets; change timeout units; let completion timing choose outcome. Already explicit: silent fallback (D-PG2-09); fabricated result facts (D-PG2-07); capture wrappers (D-PG2-07 deferred). Canon referral: prototype pollution (T-02-01); retained sensitive output/notice leakage (T-02-02/12/15/19). |
| PG-HOOK-03 | Routine: split regex at pipe; add anchors; change case flags; throw on invalid pattern; split internal spaces; duplicate a hook; normalize Unicode. Already explicit: report a valid regex unsupported; reject prompt/Stop matcher text (D-PG2-10). Canon referral: adversarial RegExp denial of service (T-02-22). |
| PG-HOOK-13 | Routine: off-by-one threshold; count empty outcomes; round a counter; reset only matching tool hooks; reset each synthetic pair; accept stale lifecycle completion; share counts between runtimes. Already explicit: move agent_settled timing; introduce a new cap environment knob (D-PG2-11 excludes both). Canon referral: runaway continuation denial of service (T-02-24). |

Counts: **30 recalled = 19 routine + 7 already explicit + 4 canon referrals**. Canon threats belong to the plans' STRIDE register, tests, ESLint where applicable and gsd-secure-phase; they are not minted as bespoke prohibitions. Retained applicable prohibition equality: **0 = 0 authored + 0 flagged-unverified**. No judgment-only intent constraint was hidden or treated as tested.

## Ordered Capability Contributions

Applied /tmp/pg2-planner-contributions.md in its given order:

1. API coverage: detector is positive; COVERAGE.md enumerates the bounded external protocol surface, integrations and reasoned omissions.
2. Assumption delta: detector found plural/fallback/second-case cues. 02-03 records the identity decision: the original native call stays primary; pair index is subordinate; dispatcher becomes a preflight transaction. No new execution identity or accepted debt.
3. Schema push: no Payload/Prisma/Drizzle/Supabase/TypeORM schema paths occur in scope or ownership lists. No database schema task applies.
4. Security: ASVS level 1, high severity blocking threshold, all plans have a threat model. T-02-01..26 are phase-unique; T-02-SC is the reserved repeated dependency gate. No package installation is planned. Mutation and disclosure mitigations have named owner/integration/behavioral checks.

Frontend detector is false, so there is no UI specification. This is hook protocol translation, not a new AI application framework integration.

## Decomposition, Ownership and Gates

Ten plans, 29 tasks, nine waves. Wave 2 runs 02-02 and 02-08 with disjoint files. Shared dispatch, payload, adapter and fixture owners force later waves; dependencies include the Stop reset before batch dispatch expands. All plans contain 2–3 tasks, at most 15 files including owner tests/fixtures/docs, and calibrated estimates from 16k to 65k tokens (factor 1; zero historical samples; confidence low). No plan exceeds 100k.

The leading 02-01 production tracer spans the real hook process, translated input, reverse adapter, native identity and file outcome. Larger coupled tasks have recorded sizing exceptions so parser/types/consumer and source/test changes remain green together. In particular 02-07-01 is the approved six-file contract group; 02-06-01 includes its two exact Bash expectation migrations in a seven-file task, and 02-07-02 includes the MCP response migration in a six-file task. These local decomposition choices do not waive plan limits, direct coverage, commit hooks or combined-tree gates. No unused codec scaffold is committed alone.

Revision 1 addresses three checker blockers without changing task count, dependency edges or waves. 02-06 now owns 11 files and is estimated at 50k tokens. 02-07 remains at 15 files by replacing unnecessary observer ownership with mcp-tool-names.feature: 02-05-03 already creates an unfiltered observer for every actual result. Both contract-changing tasks run the affected exact assertions before their commit, and the four research questions have explicit planning dispositions. No product change or commit was made during revision.

Existing paths were checked with git ls-files. VALIDATION lists every new path and its creation task before verification references it. Source/test pairs remain paired. Every automated task command immediately has an observable fails_when. New scenarios are created alongside behavior; PowerShell live execution is not claimed.

One-way plugin-visible contracts were already accepted in D-PG2-01..11; reversibility annotations preserve that fact without reopening decisions. No new approval checkpoint is introduced. Parent owns checker and commits; these planning artifacts remain uncommitted until that review.
