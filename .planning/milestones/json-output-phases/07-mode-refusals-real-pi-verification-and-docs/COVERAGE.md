# Phase 7 Coverage Audit

No external API integration: changes cover existing Pi/auth mode refusals, runtime verification, documentation, and temporary test-tool retirement.

This phase adds no service, provider, OAuth flow, ORM, or AI-product capability.

All rows below describe planned coverage, not passed implementation. D-14 and the current-runtime parent probe supersede the historical open questions in RESEARCH.md. The separate 0.86.1 runtime remains an execution requirement.

## Plan and Dependency Map

| Plan | Wave | Needs | Creates / expands |
| --- | --- | --- | --- |
| 07-01 | 1 | Existing router, usage-error payload, dispatcher | Browse refusals and direct/registered evidence |
| 07-02 | 1 | Existing auth bundle, Git callbacks, operation cleanup | Typed refusal carrier, lazy admission, real operation proof |
| 07-03 | 1 | Existing Pi package resolver, schema, approved exact-floor scope | Isolated real-runtime tests, startup positive controls, floor fixture, CI |
| 07-04 | 2 | 07-01, 07-02, 07-03 final behavior/evidence | Dedicated guide, README link, executable jq snippets |
| 07-05 | 3 | 07-04 guide/test ownership; 07-03 runtime evidence | Complete reference, limitations, policy/backlog/catalog corrections |
| 07-06 | 4 | All five finished plans | Exact additions ledger, strict final corpus proof, script deletion last |

Each plan has a leading tracer and two or three tasks. There is no same-wave file overlap. Wave 1 runtime fixtures have fresh directories; the fixture install is independent of the root dependency tree. Corpus capture runs after every code/test/documentation change and outside other test runs. No STATE/ROADMAP mutation or commit belongs to this planning handoff.

## Multi-Source Audit

| Source | ID | Item | Plan / task | Status |
| --- | --- | --- | --- | --- |
| GOAL | Goal | Clear mode refusal, real headless JSON proof, schema and limits documented | 07-01 through 07-06 | COVERED |
| GOAL | SC1 | Non-tui browse refusal; lazy print device-flow refusal; tui unchanged | 07-01, 07-02 | COVERED |
| GOAL | SC2 | Required headless command, exact peer floor, entry_appended, startup gap | 07-03 | COVERED |
| GOAL | SC3 | All kinds/fields, jq, version policy, maximum command severity | 07-04, 07-05-01 | COVERED |
| GOAL | SC4 | Print/exit/startup/RPC/persistence limitations | 07-03, 07-05-02 | COVERED |
| GOAL | SC5 | IL-2 and MRO-01 corrections | 07-05-03 | COVERED |
| GOAL | SC6 | Frozen catalog topics, strict corpus under D-14, delete three scripts last | 07-05-03, 07-06 | COVERED |
| REQ | MODE-03 | Refuse browse outside tui instead of listing | 07-01 | COVERED |
| REQ | MODE-04 | Typed print auth failure before polling | 07-02 | COVERED |
| REQ | TENB-03 | Real Pi JSON contract at peer floor with startup control | 07-03 | COVERED |
| REQ | JDOC-01 | Complete schema reference and jq verdict policy | 07-04, 07-05-01 | COVERED |
| REQ | JDOC-02 | All transport/process/persistence limits | 07-03, 07-04-02, 07-05-02 | COVERED |
| REQ | JDOC-03 | IL-2 policy amendment and MRO-01 closeout | 07-05-03 | COVERED |
| CONTEXT | D-01 | Exact mode-specific browse refusal naming list; tui preserved | 07-01-01/02 | COVERED |
| CONTEXT | D-02 | Exact auth remedy, typed error, lazy fail-fast, stored credentials | 07-02-01/02 | COVERED |
| CONTEXT | D-03 | JSON/RPC usage help; focused print refusal | 07-01-01/02 | COVERED |
| CONTEXT | D-04 | docs/json-output.md and README link only | 07-04-01 | COVERED |
| CONTEXT | D-05 | Runnable example/result first; limits later | 07-04-01, 07-05-01/02 | COVERED |
| CONTEXT | D-06 | Common envelope once; every kind/field; compatibility; maximum severity | 07-04-02, 07-05-01 | COVERED |
| CONTEXT | D-07 | Separate small jq tasks for rows/severity/reload | 07-04-01/02 | COVERED |
| CONTEXT | D-08 | Errors fail; warnings display without failing; example policy only | 07-04-02 | COVERED |
| CONTEXT | D-09 | Exact missing-outcome failure; prompts/diagnostics insufficient | 07-04-02 | COVERED |
| CONTEXT | D-10 | Earlier results plus final error; completed changes and reload retained | 07-04-02 | COVERED |
| CONTEXT | D-11 | Closed stdin, isolated fixture, exact 0.86.1 floor, real stdout/startup | 07-03 | COVERED |
| CONTEXT | D-12 | All limits, single recovery attempt, no operation retry/rollback promise; correlation separate | 07-05-02 | COVERED |
| CONTEXT | D-13 | Policy/backlog/catalog edits and deletion after strict comparison | 07-05-03, 07-06 | COVERED |
| CONTEXT | D-14 | Preserve old 3149 exactly; ledger refusal-only additions before amendment; zero extras | 07-06-01/02/03 | COVERED |
| RESEARCH | R1 | Reuse usage-error payload without new schema kind | 07-01 | COVERED |
| RESEARCH | R2 / A1 | Empty-usage rendering preserves ordinary bytes and required wire field | 07-01-02 | COVERED |
| RESEARCH | R3 | Explicit, empty, whitespace browse registration and command identity | 07-01-02 | COVERED |
| RESEARCH | R4 / A2 | Shared error type; narrow callback rethrow; unrelated errors cancel | 07-02-01 | COVERED |
| RESEARCH | R5 / A3 | Real adapter and operation prove propagation; retain cleanup/cause | 07-02-01/02 | COVERED |
| RESEARCH | R6 | Fill and memo reuse precede live-mode guard; host/no-network rules retained | 07-02-02 | COVERED |
| RESEARCH | R7 | Subprocess isolation, EOF, separate streams, finite deadlines, spawn-error checks | 07-03-01 | COVERED |
| RESEARCH | R8 | Exact-floor package cannot fall through resolver to current install; CI selects both | 07-03-02/03 | COVERED |
| RESEARCH | R9 / A4 | Startup memory presence and later stream control; RPC get_entries | 07-03-01/03 | COVERED |
| RESEARCH | R10 | Persistence-enabled slash-only case separate from --no-session | 07-03-01/03 | COVERED |
| RESEARCH | R11 / A5 | Strict tool pass is weaker than zero-extra policy; D-14 resolves conflict | 07-06 | COVERED |
| RESEARCH | R12 | Frozen catalog fenced blocks and actual 260/39143 locks | 07-05-03, 07-06 | COVERED |
| RESEARCH | R13 / A6 | Execute actual guide snippets and derive recursive schema inventory | 07-04, 07-05-01 | COVERED |
| RESEARCH | R14 | Empty/warning/error/partial/mixed-origin/unknown/malformed example matrix | 07-04-02 | COVERED |
| RESEARCH | R15 | Sole dispatcher sink; test-only validation; no timer replay or dual emission | 07-01, 07-03, 07-05 | COVERED |
| RESEARCH | R16 / A7 | Credential disclosure, ambient secrets, false success, lost cleanup threats | T-07-03 through T-07-15 | COVERED |
| RESEARCH | R17 | All tracked references audited and full gate after deletion-only commit | 07-06-03 | COVERED |
| RESEARCH | R18 | Owner-test pairing, caller tracing, full combined-tree GSD gates | All PLAN execution contexts and verification sections | COVERED |

A3's larger explicit-result auth channel is a contingent alternative, not an additional feature. The chosen narrow typed path is tested through the real adapter and final operation; a failure cannot be declared complete using mock-only evidence. A5's old decision request is resolved by D-14. The current-install subprocess question is resolved by the parent's successful 0.87.1 probe and is not reopened.

## Supplied Edge-Probe Projection

Source: /tmp/json-output-plan7-edges.json. No SPEC supplied either section. Every classified row has a concrete explicit criterion in the named plan's must_haves.truths. Unclassified rows remain flagged assumptions, as required; none is auto-dismissed.

| Requirement / category | Disposition | Projection / behavior |
| --- | --- | --- |
| MODE-03 / adjacency | resolved, explicit | 07-01: repeated commands retain separate invocation IDs |
| MODE-03 / empty | resolved, explicit | 07-01: empty/whitespace select browse with exact refusal |
| MODE-03 / encoding | resolved, explicit | 07-01: exact mode/message tokens; old strict mode admission |
| MODE-03 / ordering | resolved, explicit | 07-01: argument check first; one command outcome |
| MODE-04 / unclassified | unresolved | 07-02 flagged assumption; full lazy/auth/cleanup matrix still mandatory |
| TENB-03 / adjacency | resolved, explicit | 07-03: distinguish startup and later command entries |
| TENB-03 / empty | resolved, explicit | 07-03: valid empty cascade versus invalid empty stream |
| TENB-03 / ordering | resolved, explicit | 07-03: startup memory before later stream; startup not replayed |
| JDOC-01 / boundary | resolved, explicit | 07-04: info/warning/error exit thresholds |
| JDOC-01 / adjacency | resolved, explicit | 07-04: equal commandId does not merge distinct invocations |
| JDOC-01 / empty | resolved, explicit | 07-04: exact missing-outcome failure versus empty inventory |
| JDOC-01 / ordering | resolved, explicit | 07-04: preserve earlier results, max severity, OR reload |
| JDOC-01 / precision | resolved, explicit | 07-04: closed severity order, boolean reload, unknown kinds conservative |
| JDOC-02 / boundary | resolved, explicit | 07-05: persistence and startup subscription boundaries |
| JDOC-02 / empty | resolved, explicit | 07-05: silence/zero exit do not certify success |
| JDOC-02 / encoding | resolved, explicit | 07-05: entry.data/native tokens separate from frozen text |
| JDOC-02 / precision | resolved, explicit | 07-05: process versus command verdict and exact version rules |
| JDOC-02 / concurrency | resolved, explicit | 07-05: invocation isolation and bounded delivery recovery |
| JDOC-03 / unclassified | unresolved | 07-05 flagged assumption; bounded corrections remain mandatory |

Equality check: 19 surfaced = 17 explicit truths + 2 flagged assumptions.
There are no backstop rows or silent drops.

## Prohibition Recall and Projection

The adversarial pass covered all six requirements: silent fallback, coercive auth,
credential exposure, operator-environment leakage, fabricated runtime success,
missing-outcome success, misleading rollback/retry promises, cross-run tracking,
corpus rewriting, and hidden scope growth were considered. Routine correctness
items map to the edge assertions and task matrices. Credential disclosure,
containment, and injection are canonical security concerns and map to the
STRIDE register and existing security checks rather than duplicate prohibitions.

Three bespoke transparency/privacy constraints survive precision filtering:

| Item | Plan | Projection |
| --- | --- | --- |
| Guidance cannot certify success from silence/prompts/diagnostics | 07-04 | resolved / judgment, descriptor-less |
| Per-command correlation cannot become cross-session tracking or credential collection | 07-03 | resolved / judgment, descriptor-less |
| Closeout cannot conceal regressions or claim unexecuted runtime proof | 07-06 | resolved / judgment, descriptor-less |

The canonical projectProhibitions function from the active GSD probe-core library
was called with these three statements. Its returned statement/status/verification
objects were used in must_haves.prohibitions. No check_kind, check_target,
check_rule, violation fixture, or clean fixture was invented. These project to
flagged-unverified judgments pending verification, not automatic green results.
Equality check: 3 kept = 3 authored; none dismissed.

## Capability Contributions and Scope Decisions

- API coverage: the phase-only deterministic scan returned detected:false.
  The declaration above also records why terms in plan descriptions do not
  represent a new API integration. The final combined-plan scan also returned
  detected:false with no signals.
- Assumption delta: detected:true for "also" and "optional" in the existing
  compatibility description. 07-05 records no-change: command invocation remains
  primary, and this phase documents existing policy instead of changing field identity.
- Schema push: no ORM paths or database work; no schema-push task applies.
- Security: ASVS level 1, blocking threshold high. Unique threat IDs T-07-01
  through T-07-19; only the reserved T-07-SC repeats.
- AI-product work: none. No AI-SPEC or evaluation work is introduced.
- Reversibility: local code/docs/ledger/tool retirement are reversible, with
  original blobs retained. Every locked decision is already approved.
- Package authorization: D-11 explicitly covers isolated 0.86.1 provisioning.
  The user clarified that the age-only SUS finding on this trusted existing peer
  is not a new permission gate. Keep audit facts, pin identity/integrity, and disable
  lifecycle scripts. No redundant checkpoint remains.
- Discovery: supplied research/patterns plus caller tracing establish existing
  implementation seams. Remaining runtime uncertainty is an executable test task,
  not a reason to reduce scope or restart research.
- Estimates: calibration factor 1, sample_count 0, confidence low. Raw and
  calibrated estimates are equal. Plans have two or three tasks, each with at
  most five modified files.
- Verification: task owners provide feedback; npm run check remains the mandatory
  combined-wave/phase/merge/handoff gate. Every SUMMARY includes Threat Flags.

## Planning Validation

All six plans pass the owner CLI frontmatter schema and plan-structure checks
with zero errors and zero warnings. The final task-contract check covers all 15
tasks: read_first, action, acceptance_criteria, automated, fails_when, and done.
Each plan starts with a tracer. Four dependency-ordered waves have no same-wave
file overlap. All six requirements, six roadmap criteria, and D-01 through D-14
have explicit coverage above. The phase-directory diff whitespace check passes.
These are planning checks; the exact-floor runtime proof and implementation
gates remain pending execution.
