# Phase 6 source and edge coverage audit

All four source categories are covered. Remote runtime activation stays in Phases 9/10; their Examples still bind here. No cross-repository skill port, upstream command redesign, new API integration, or package installation is planned.

## Source coverage

| Source | ID | Outcome or constraint | Plan/tasks | Status |
| --- | --- | --- | --- | --- |
| GOAL | Phase 6 | Named/bare refresh, autoupdate, local failures, and exact external-file reread | 06-01 through 06-04 | COVERED |
| GOAL | SC1 | No-op/changed source-kind rows, local runtime proof | 06-02 Task 1 | COVERED |
| GOAL | SC2 | Version, membership, dropped-plugin, and no-op cascades | 06-03 Tasks 1–3 | COVERED |
| GOAL | SC3 | Bare, empty, and named-missing results | 06-04 Tasks 1–2 | COVERED |
| GOAL | SC4 | Invalid and vanished local sources | 06-02 Task 3 | COVERED |
| GOAL | SC5 | External-file red/green regression and exact info source | 06-01 Tasks 1–2 | COVERED |
| REQ | FIX-01 | Original external manifest reread and info identity | 06-01 Tasks 1–3 | COVERED |
| REQ | UPD-01 | Unchanged manifest is up-to-date | 06-02 Task 1 | COVERED |
| REQ | UPD-02 | Changed manifest is updated without plugin rows when off | 06-02 Task 1 | COVERED |
| REQ | UPD-03 | Autoupdate off retains installed versions | 06-03 Task 1 | COVERED |
| REQ | UPD-04 | Autoupdate installs offered version visible in new session | 06-03 Task 1 | COVERED |
| REQ | UPD-05 | Unchanged autoupdate is up-to-date | 06-03 Task 2 | COVERED |
| REQ | UPD-06 | Newly offered plugin remains uninstalled | 06-03 Task 2 | COVERED |
| REQ | UPD-07 | Bare update covers scopes in defined order | 06-04 Tasks 1–2 | COVERED |
| REQ | UPD-08 | Empty bare update reports no marketplaces | 06-04 Task 2 | COVERED |
| REQ | UPD-09 | Named absent marketplace fails with/without scope | 06-04 Task 2 | COVERED |
| REQ | UPD-10 | Invalid local manifest fails cleanly | 06-02 Task 3 | COVERED |
| REQ | UPD-13 | Dropped installed plugin remains with warning | 06-03 Task 2 | COVERED |
| REQ | UPD-14 | Vanished local directory reports source missing | 06-02 Task 3 | COVERED |
| CONTEXT | D-01 | Exact resolved file info, directory info unchanged | 06-01 Task 2 | COVERED |
| CONTEXT | D-02 | Original source only; missing file retained, no decoy fallback/copy | 06-01 Task 1; 06-02 Task 3 | COVERED |
| CONTEXT | D-03 | Real-Pi rewritten-file red before fix plus normal paired coverage | 06-01 Tasks 1–3 | COVERED |
| CONTEXT | D-04 | Parsed equality ignores whitespace/object order | 06-01 Task 1; 06-02 Task 1 | COVERED |
| CONTEXT | D-05 | Unknown fields participate before normalization | 06-01 Task 1; 06-02 Task 2 | COVERED |
| CONTEXT | D-06 | Array order remains significant | 06-01 Task 1; 06-02 Task 2 | COVERED |
| CONTEXT | D-07 | Invalid refresh retains state and can be repaired | 06-01 Task 3; 06-02 Task 3 | COVERED |
| CONTEXT | D-08 | Installed-record order and independent plugin failures | 06-03 Task 3 | COVERED |
| CONTEXT | D-09 | Dropped plugin retained/enabled; new offer not installed | 06-03 Task 2 | COVERED |
| CONTEXT | D-10 | Successful marketplace remains updated despite child failure | 06-03 Task 3 | COVERED |
| CONTEXT | D-11 | Project-first, insertion order within each scope | 06-04 Task 1 | COVERED |
| CONTEXT | D-12 | Ordinary marketplace failure does not stop bare run | 06-04 Task 2 | COVERED |
| CONTEXT | D-13 | Each notice immediately follows its producer | 06-04 Task 1 | COVERED |
| RESEARCH | baseline | Persist old successful content; do not compare two current reads | 06-01 Tasks 1, 3 | COVERED |
| RESEARCH | legacy | Local missing baseline reports changed once; git retains pre-fetch fallback | 06-01 Tasks 1, 3 | COVERED |
| RESEARCH | validation | One domain read seam, complete raw comparison plus normalized resolver view | 06-01 Task 1; 06-02 Task 2 | COVERED |
| RESEARCH | atomicity | Add seed; successful refresh/save only; failed save/invalid source leave durable state | 06-01 Tasks 1, 3; 06-02 Task 3 | COVERED |
| RESEARCH | identity | Resolve local input against add context; raw spelling retained; independent root | 06-01 Tasks 1–2 | COVERED |
| RESEARCH | cache | Size-distinct rewrites, negative-cache repair, no sleep/cache redesign | 06-01 Task 1; 06-02 Tasks 1–3 | COVERED |
| RESEARCH | comparison | Built-in two-argument isDeepStrictEqual, no dependency or custom sorter | 06-01 Task 1 | COVERED |
| RESEARCH | output | Complete envelopes/rows; recognize exactly rowless MCP notice | 06-04 Task 1 | COVERED |
| RESEARCH | cascade | Keep no-op collapse, installed snapshot, locks, exceptional config rethrow | 06-03 Tasks 1–3; 06-04 Task 2 | COVERED |
| RESEARCH | Cucumber | External-file feature, vertical steps, source-kind dispatch, remote binding | 06-01 Task 1; all later plans | COVERED |
| RESEARCH | verification | Every owner pair 100% direct; real Pi; full combined-tree gates | Every plan verification section | COVERED |
| RESEARCH | environment | Startup restriction is not product red; use bounded execution mode | 06-01 verification | COVERED |
| RESEARCH | security | Containment, offline local operations, atomic/retryable state, selected transport | All four threat models and owner tests | COVERED |
| RESEARCH | summary | Required Threat Flags in every eventual summary | Every plan output section | COVERED |

## Dependency and ownership graph

| Plan | Needs | Creates | Checkpoint | Wave |
| --- | --- | --- | --- | --- |
| 06-01 | Existing Phase 1 harness and Phase 5 info assertions | Raw comparison document, durable baseline, exact-source regression/projection | No | 1 |
| 06-02 | 06-01 exact-path fixture and baseline | Semantic/failure coverage and safe source-loss fixture | No | 2 |
| 06-03 | 06-02 semantic/failure contract and update vertical | Installed version/membership/order/failure proof | No | 3 |
| 06-04 | 06-03 successful cascade and fixture APIs | Complete bare-update/notice/empty/miss proof | No | 4 |

Shared update.ts/update.test.ts, update.feature, publication fixture, and update-step ownership forces this order. There is no same-wave shared-file or mutable-resource coupling. Within each plan, tasks extend the working source-refresh path. The orchestrator explicitly approved the first tracer's thirteen-file atomic-correctness exception; every later task names at most five modified files. No phase scope was reduced.

Discovery level: 0 for implementation selection. Existing code/patterns and the completed Phase 6 research establish the stack, Node comparator semantics, upstream identity contract, and real-Pi failure. CodeGraph confirmed callers before planning. Graphify is disabled. Calibration returned factor 1, sample_count 0, confidence low. There is no new package or external integration to research.

## Spec-less edge lift

The input probe surfaced 22 items: 15 classified edges and seven unclassified items. Exactly 10 edges become explicit frontmatter truths, five concurrency edges use flat `{ statement, verification: backstop }` truth entries, and seven unclassified items remain flagged assumptions in their owning plans. Backstops require evidence; absent evidence means human_needed/insufficient_spec at verification, never silent success.

| Requirement | Edge | Disposition | Authored location |
| --- | --- | --- | --- |
| FIX-01 | idempotency | resolved / explicit | 06-01 truths; Task 3 |
| FIX-01 | concurrency | resolved / backstop | 06-01 structured truth; Task 3 |
| UPD-01 | unclassified | unresolved / flagged assumption | 06-02 flagged assumptions |
| UPD-02 | unclassified | unresolved / flagged assumption | 06-02 flagged assumptions |
| UPD-03 | idempotency | resolved / explicit | 06-03 truths; Task 1 |
| UPD-03 | concurrency | resolved / backstop | 06-03 structured truth; Tasks 1, 3 |
| UPD-04 | idempotency | resolved / explicit | 06-03 truths; Task 1 |
| UPD-04 | concurrency | resolved / backstop | 06-03 structured truth; Tasks 1, 3 |
| UPD-05 | unclassified | unresolved / flagged assumption | 06-03 flagged assumptions |
| UPD-06 | unclassified | unresolved / flagged assumption | 06-03 flagged assumptions |
| UPD-07 | adjacency | resolved / explicit | 06-04 truths; Task 1 |
| UPD-07 | empty | resolved / explicit | 06-04 truths; Task 2 |
| UPD-07 | ordering | resolved / explicit | 06-04 truths; Task 1 |
| UPD-07 | idempotency | resolved / explicit | 06-04 truths; Task 1 |
| UPD-07 | concurrency | resolved / backstop | 06-04 structured truth; Task 2 |
| UPD-08 | idempotency | resolved / explicit | 06-04 truths; Task 2 |
| UPD-08 | concurrency | resolved / backstop | 06-04 structured truth; Task 2 |
| UPD-09 | empty | resolved / explicit | 06-04 truths; Task 2 |
| UPD-09 | encoding | resolved / explicit | 06-04 truths; Task 2 |
| UPD-10 | unclassified | unresolved / flagged assumption | 06-02 flagged assumptions |
| UPD-13 | unclassified | unresolved / flagged assumption | 06-03 flagged assumptions |
| UPD-14 | unclassified | unresolved / flagged assumption | 06-02 flagged assumptions |

No-silent-drop equality: **22 = 10 explicit + 5 backstop + 7 flagged assumptions**. All 13 ordinary requirements are covered independently of the probe's incomplete classification. Concurrency backstops preserve the current transaction contracts; they add no command-wide serializability promise.

Prohibition recall retained zero bespoke values/safety/ethics prohibitions after precision filtering. Canon containment/path-traversal concerns are carried by T-06-01/T-06-03/T-06-08 and the source/write-boundary checks, not minted as new prohibitions. Prohibition equality: **0 = 0 authored + 0 flagged**.

Assumption-delta detector: no detected delta. Schema detector: no ORM/schema integration. No external API integration: MCP scenarios stage existing local configuration and do not run a vendor service or protocol client.

## Execution choices and limits

- The additive serialized baseline is an internal, removable comparison field. Legacy local data cannot reveal historic contents, so the first successful legacy refresh is conservatively changed; this is explicit agent discretion, with tests.
- File sources retain their exact source file; plugin root calculation keeps the established layout semantics. The phase does not redesign relative plugin resolution for arbitrary new layouts.
- The cache's existing same-size/same-mtime limitation remains outside scope. Every fixture rewrite is size-distinct; tests do not claim stronger cache invalidation.
- Existing special handling for invalid GitHub-base configuration remains. D-08/D-12 continuation applies to ordinary failures.
- Finalized plans are returned uncommitted to the orchestrator for checker review and commit, as requested.
