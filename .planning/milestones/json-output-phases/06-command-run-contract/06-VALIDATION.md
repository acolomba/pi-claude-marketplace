---
phase: "06"
slug: command-run-contract
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-10-09"
---

# Phase 6 - Validation Strategy

The user resolved the 06-01 scope blocker on 2026-10-09 by selecting option 1
and approving a scope-only size exception for its 61-file atomic metadata
migration. All four combined-wave gates passed. Independent automated-coverage
audit found no gaps. Code review later exposed CR-01, now resolved by three
fixes and independent re-review. Security passed. Final goal verification follows.
This document refers only to the active command-run-contract phase. No archived
phase with number 06 is a dependency.

## Test infrastructure and execution contract

| Property | Value |
| --- | --- |
| Framework | Existing Node node:test, node:assert/strict, and strong-mock |
| Configuration | package.json and tsconfig.json |
| Quick feedback | Each task's exact owner command below |
| Combined wave and phase gate | `npm run check` |
| Full gate timeout | 2400 seconds; a timeout is a failure to verify |
| Measured task latency | 06-04-01 tracer: 5.99 s; 06-04-02 committed owners: 4.70 s; evidence below |
| Security | ASVS level 1; high and critical findings block |
| New packages or services | None |
| Discovery | Level 0: existing internal router/run/dispatch/schema patterns; live source checked after CodeGraph |
| Graphify | Disabled; no configuration change made |

Before source edits, read applicable project TypeScript/comment/test skills.
Every new production TypeScript module needs its mirrored direct pair.
Observe failing behavior tests locally; do not commit failing RED tests.
Task feedback uses the listed owner suites. If one command exceeds 60 seconds,
split feedback into its existing individual owner files, preserving all
assertions and the required full combined-tree gate.

Before commits, run `fallow audit --base HEAD` and
`SKIP=npm-check pre-commit run --files <changed files>`. Restage and repeat
fixers until clean. Run git commit in the foreground; the staged-input hook
runs check:commit and is not a GSD gate. Do not rebase, amend, rewrite history,
skip hooks, or put phase/milestone names in commit subjects. A failed hook
means no commit occurred.

After each combined wave, at phase completion, and at final handoff, require
`npm run check` for the combined checkout. Reuse only same-session evidence
for unchanged inputs under skills/local-verification/SKILL.md. Record command,
exit status, commit, Node version, and exact dirty inputs if applicable.
Parent owns planning commits, STATE and ROADMAP updates.

## Dependency and ownership map

| Plan | Needs | Produces | Wave | Checkpoint |
| --- | --- | --- | --- | --- |
| 06-01 | Completed Phase 5 live sink and schema | Required origin, canonical route, injected ID, explicit lifecycle roots, snapshot-only tools | 1 | None; D-01..D-10 already approved |
| 06-02 | 06-01 identity and formatter contract | Paired command boundary, paired safe error resolver, internal-error schema, direct disclosure checks | 2 | None |
| 06-03 | 06-02 error delivery and registration wiring | Outcome/reload accounting, recovery that reopens on success, terminal closure only on failed recovery | 3 | None |
| 06-04 | 06-03 complete lifetime | Delayed carrier, AUTH-09 internal-error enrollment, and full inventory evidence | 4 | None |

Shared run, dispatcher, register, and their owner tests force sequential waves.
There is no safe same-wave file or mutable-state parallelism in this plan set.
Calibration returned factor 1, sample_count 0, confidence low; plan estimates
use those values, not subjective confidence.

**06-01 blocker disposition:** Resolved by user approval of option 1 on 2026-10-09.
06-01 has a scope-only exception to the mandatory fewer-than-15-file property
for its atomic metadata migration; its manifest retains all 61 required files.
06-02 now lists 14 files, 06-03 lists 9, and 06-04 lists 8. No path was hidden
or removed from the phase's required work. The additional AUTH-09 architecture
enrollment moved from 06-02-02 to its existing owner 06-04-02; direct resolver
and converter disclosure checks remain in 06-02. Production registration is
fully wired in 06-02-01, so 06-03 adds lifetime behavior through that existing
command boundary and needs only registration tests, not another register.ts
edit. The four-wave dependency chain is unchanged.

The following source observations describe the pre-execution planning baseline;
they are not descriptions of the current implementation. Live implementation
was rechecked for 06-04 as recorded in the execution evidence below.

The approved 06-01 size exception preserves the atomic dependency constraint.
CodeGraph was consulted before targeted source lookup. The current openNotificationRun
factory has no origin argument (shared/notification-run.ts:37); toWirePayload
returns the wire union directly (shared/notification-json.ts:49-55). Both
strict envelopes lack origin (shared/notification-wire.ts:264 and :479).
Changing the required run/formatter/schema contract therefore reaches every
root, the original sink, direct pairs, and the generated schema together.

There are 23 files under tests/edge/handlers with complete
assert.deepStrictEqual(capture.entries, ...) assertions, independently of
the remaining factory, formatter, and lifecycle owners. Concrete examples
are plugin/help.test.ts:94, plugin/info.test.ts:433, and
marketplace/info.test.ts:342: their full expected payloads have no origin.
tests/edge/notification-boundary.ts:112-131 exposes the original capture;
tests/edge/json-capture.ts validates original attempts against the strict
union and retains failures. Adding origin to actual output without migrating
those expected payloads fails equality; adding it to expectations early also
fails. Weakening validation, stripping actual fields, or hiding those files
would violate the locked preservation and complete-assertion constraints.

Alternatives assessed: extracting the currently live tool projection or
routing responsibilities can reduce peripheral work, but leaves the strict
metadata cutover and its 23 exact-capture owners above the usual file limit. Optional
metadata, dual schemas, or origin inference would contradict required
explicit root metadata and the chosen strict contract. Preparatory shared
expectation builders would require a separately grounded redesign across
these tests while preserving independent complete assertions, and still
would not prove the root/schema cutover fits 14 files. No such speculative
redesign, unused scaffolding, broken intermediate commit, or corpus recapture
is authorized or planned. User approval resolves only the file-count conflict.
All tests and review gates remain required; no independent checker or test
pass is claimed. The two new modules in 06-02 still land with their first
production readers and direct pairs.

### Iteration 2: 06-02 scope warning disposition

The independent checker reports zero blockers and one WARNING,
scope_sanity/06-02: "Plans without size exception stay below10-file warning
threshold". Its 14-file count remains unchanged and the threshold is not
claimed satisfied. The warning is acceptable under revision-loop.md's
"For each WARNING: address or explain why it's acceptable" rule. The
user-approved size exception remains exclusive to 06-01.

06-02-01 joins six production/direct-test pairs: command-run, register,
notification-command-error, notification-dispatch, notification-json, and
notification-wire. The other two files are the generated schema and its
architecture test. CodeGraph confirms the current root preflight/run creation
in register.ts:140-143, dispatcher-owned append in notification-dispatch.ts:383-405,
and strict wire-union return in notification-json.ts:49-55. The architecture
test compares source and committed schema bytes and the exact kind inventory
at wire-schema.test.ts:51-117; :120-129 retains the missing-kind negative control.

The new resolver and boundary need their first production callers and direct
pairs in the same change. A shared-only error-delivery slice still needs ten
files (four pairs plus generated schema and architecture assertion), before
adding the registered root. Schema-first work leaves an unproducible member;
caller-first work lacks its supported payload. Deferring generated output or
the exact-kind assertion breaks the intermediate schema gate. A preliminary
pass-through extraction adds preparatory work; an unconsumed resolver violates
the no-unused-code constraint. Splitting by fault class, or moving task
06-02-02's tests, leaves the first complete path at 14 files. Moving work into
06-01 would misuse its metadata-only exception. No compliant smaller split
was identified within the reviewed mechanism.

The retained scope is one error path across six production modules, one new
payload kind, two tasks, and the existing 45000-token estimate. The complete
manifest, four-wave chain, direct pairs and 100% coverage, disclosure controls,
schema negatives, text exception timing, strict 3149/zero-extra corpus,
unchanged catalog, and combined-tree gates remain intact. This records the
warning rationale only; checker acceptance of this disposition and execution
evidence remain pending, with no new approval gate introduced.

## Per-task verification map

All nine task commands have passing execution evidence in their summaries.
The final combined-tree gate covers every owner through the unpaired suites
and direct coverage. Independent audit confirmed the actual assertions below.
Every task has an automated command and a sibling fails_when in its PLAN.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Automated Command | File Exists | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 06-01-01 | 01 | 1 | WIRE-02, WIRE-07 | T-06-01, T-06-02, T-06-03 | Required metadata, explicit roots, canonical identity, tool compatibility | `node --test tests/shared/notification-run.test.ts tests/shared/notification-wire.test.ts tests/shared/notification-json.test.ts tests/shared/notification-present.test.ts tests/shared/notification-dispatch.test.ts tests/edge/router.test.ts tests/edge/register.test.ts tests/edge/handlers/tools.test.ts tests/architecture/wire-schema.test.ts` | Existing | PASS; summary evidence and final combined gate |
| 06-01-02 | 01 | 1 | WIRE-02, WIRE-07 | T-06-01, T-06-02 | Aliases, invalid parents, delegation, overlapping roots | `node --test tests/edge/router.test.ts tests/edge/register.test.ts tests/index.test.ts tests/bridges/hooks/settle.test.ts tests/bridges/hooks/async-rewake/registry.test.ts` | Existing | PASS; summary evidence and final combined gate |
| 06-02-01 | 02 | 2 | JOUT-04, WIRE-02, WIRE-07 | T-06-04, T-06-05, T-06-06 | Typed command errors and correlated startup faults | `node --test tests/edge/command-run.test.ts tests/edge/register.test.ts tests/shared/notification-command-error.test.ts tests/shared/notification-dispatch.test.ts tests/shared/notification-json.test.ts tests/shared/notification-wire.test.ts tests/architecture/wire-schema.test.ts` | Two direct pairs created in task | PASS; summary evidence and final combined gate |
| 06-02-02 | 02 | 2 | JOUT-04 | T-06-04, T-06-05 | Direct bounded-cause and whole-payload disclosure checks, retained partial work | `node --test tests/shared/notification-command-error.test.ts tests/edge/command-run.test.ts tests/shared/notification-json.test.ts` | Existing plus 06-02-01 pairs | PASS; summary evidence and final combined gate |
| 06-03-01 | 03 | 3 | JOUT-03, JOUT-04, WIRE-07 | T-06-07, T-06-08, T-06-11 | Semantic outcomes, monotonic reload, closure | `node --test tests/shared/notification-run.test.ts tests/shared/notification-dispatch.test.ts tests/edge/command-run.test.ts` | Existing plus 06-02-01 pair | PASS; summary evidence and final combined gate |
| 06-03-02 | 03 | 3 | JOUT-04, JOUT-03 | T-06-08, T-06-09, T-06-10 | One recovery per append fault, successful recovery preserves later output/reload, failed recovery closes delivery, no retry/rollback | `node --test tests/shared/notification-dispatch.test.ts tests/edge/command-run.test.ts tests/orchestrators/plugin/list-flow.test.ts` | Existing plus 06-02-01 pair | PASS; summary evidence and final combined gate |
| 06-03-03 | 03 | 3 | JOUT-03, JOUT-04, WIRE-07 | T-06-06, T-06-07, T-06-09, T-06-11 | Existing root integration, valid empty outcomes, later output/reload after successful recovery | `node --test tests/edge/register.test.ts tests/edge/command-run.test.ts tests/shared/notification-dispatch.test.ts` | Existing plus 06-02-01 pair | PASS; summary evidence and final combined gate |
| 06-04-01 | 04 | 4 | WIRE-02, WIRE-07, JOUT-03, JOUT-04 | T-06-12 | Deferred auth/cascade/delegation settlement and identity | `node --test tests/edge/register.test.ts tests/orchestrators/auth-host.test.ts tests/orchestrators/marketplace/update.test.ts tests/orchestrators/plugin/enable-disable.test.ts` | Existing | PASS, exit 0; 5.99 s post-commit tracer |
| 06-04-02 | 04 | 4 | WIRE-02, WIRE-07, JOUT-03, JOUT-04 | T-06-13, T-06-14 | Full fixture inventory, strict preservation, AUTH-09 internal-error enrollment and planted disclosure controls | `node --test tests/architecture/catalog-uat/catalog-wire.test.ts tests/architecture/no-credential-leak.test.ts tests/architecture/wire-schema.test.ts` | Existing | PASS, exit 0; 95 tests, 4.70 s at task commit; combined gate passed |

T-06-SC is the permitted phase-wide repeated supply-chain threat ID. No task
installs packages; any scope change introducing an install must first supply
the package-legitimacy audit and its required gate.

## Exact metadata and canonical routing contract

Keep schemaVersion 1 during this unreleased milestone. Required top-level
fields remain severity, needsReload, and origin. origin is a strict object:

| Root | Exact origin fields |
| --- | --- |
| Command | kind: command; commandId: nonempty canonical string; invocationId: nonempty string |
| Load | kind: load |
| Hook | kind: hook |

Identity fields live inside origin, not in duplicate top-level properties.
The TypeBox origin union rejects extras, absent fields, null, and command
fields on load/hook branches. The new internal-error kind accepts command
origin only. All existing raw/structured kinds retain their fields and
ordering. Both envelope definitions gain origin.

| Input family | Canonical commandId |
| --- | --- |
| bootstrap, install, uninstall, prune, update, fetch, reinstall, list, info, pending, enable, disable, import, browse | plugin followed by that canonical verb |
| ls | plugin list |
| Empty or whitespace-only input | plugin browse |
| Unknown top-level verb | plugin |
| marketplace with no verb or unknown verb | marketplace |
| marketplace add/remove/list/info/update/autoupdate/noautoupdate | marketplace followed by that verb |
| marketplace rm; marketplace ls | marketplace remove; marketplace list |
| help; help help; invalid help topic | plugin help |
| help marketplace; marketplace help | marketplace help |
| marketplace help with surplus arguments | marketplace help, with the existing usage-error |

help marketplace applies when the full trimmed topic is marketplace; an
unknown complete topic remains plugin help. Recognized command syntax errors
retain the recognized command identity. Nested work retains the outer
identity, including enable to install and browse to list.

## Outcome and delivery contract

Outcomes on command runs: cascade; marketplace-info; plugin-info;
marketplace-info-cascade; plugin-info-cascade; marketplace-not-added;
reconcile-pending-empty; prune-empty; prune-committed-warning; usage-error;
usage-info; internal-error.

Non-outcomes: diagnostic; device-flow-prompt; reconcile-applied-cascade;
reconcile-aborted; plugin-path-skipped; async-rewake-summary; stop-override-cap.
Independent load/hook runs never affect the command verdict. Empty cascades
and named empty results remain valid; empty diagnostic lines and empty rewake
summaries remain no-ops. Info fan-out keeps its nonempty schema constraint.

Known reload is ORed before an attempted emission; successful machine append
marks an explicit outcome. A silent or non-outcome-only normal machine return
emits internal-error with the fixed missing-result cause. Unexpected throws
append errors after prior entries. Closure follows awaited work and final
delivery; a settled/closed command cannot touch another sink, mode, or UI.

After an ordinary append failure, recovery gets one direct internal-error
attempt using the same ID and known reload. On success that error counts as
an outcome and delivery returns to open. Every later result before settlement
is still delivered using live mode and contributes outcome/reload state. A
separate later append fault gets its own one direct recovery attempt; the
recovery append itself never recurses. Only failure of the recovery append
closes delivery under D-08. Contain that failure and any opt-in logger failure,
then suppress later sink attempts and the root missing-outcome report.
Dispatch swallows transport faults before broad business catches can see
them. Business operations continue their current flow; reporting adds neither
retries nor rollback. The D-10 settled guard independently stops late callbacks.

Required recovery witnesses in 06-03-02/03: failed original append, successful
recovery error, delivered later outcome with needsReload true, then a later
throw's delivered internal-error retaining true, all with one invocation ID
before settlement. Also cover two separate append faults each recovered
successfully and a subsequent delivered outcome. The terminal counterexample
fails the original and recovery append and permits no further attempt, even
when the logger throws. More than two total attempts is valid after successful
recovery; a recursive recovery or any attempt after failed recovery is invalid.

## Resolved research seams and remaining assumptions

| Item | Source evidence and planning resolution | Tasks |
| --- | --- | --- |
| A1 broad catches | listPlugins wraps its success notification and emits another cascade in catch. Contain append exceptions inside dispatch; never send transport sentinels through business catches. | 06-03-02 |
| A2 reload on failed append | A resolved result may describe completed changes even when append fails. OR needsReload before attempt; preserve earlier true values and retain state. | 06-03-01/02 |
| A3 asynchronous work | Edge handlers await/return operations; browse awaits custom UI and delegates; list-flow then projections are joined by Promise.all; auth-host awaits initiateDeviceFlow, which returns runPollLoop after synchronous onDeviceCode. No detached producer was found in these seams. Add controlled delay/late-callback evidence. | 06-04-01 |
| A4 feedback timings | Suggested owner suites exist; new pair commands run after their creation. Runtime remains unmeasured until execution. | All tasks |
| A5 ASVS | Use locally configured level 1/high blocking; no claim about external ASVS edition/control numbers. | Threat registers |
| A6 runtime state | Change only in-memory runs and generated schema; no persisted-data rewrite, migration, service, or OS configuration. | 06-01-01 |
| ID generator throws | Try primary allocator once; a trusted total recovery allocator mints the error invocation ID. No route/probe follows generator failure. Recovery allocation is separately injectable for deterministic tests. | 06-02-01, 06-03-03 |
| Inventory throws | Allocate identity and command state first; error delivery accepts the original sink and identity without fabricating soft-dependency data. Do not probe again. | 06-02-01, 06-03-03 |
| Tool callers | Both tools only need snapshot presentation and marketplace-block projection. They receive neither a fourth wire origin nor command completion rules. | 06-01-01 |
| Original sink | Preserve receiver semantics; do not detach appendEntry or forward through a new sink. | 06-01-01, 06-03-02 |
| Invalidated mode | Initial unsupported/stale access keeps synchronous preflight failure. If the getter becomes unusable later, there is no supported live mode to select; report the mode-contract failure, never use cached mode or claim delivered output. | 06-02-01, 06-03-03 |
| Total recovery allocator | Nonempty unique ID output and a functioning total recovery allocator are explicit trusted-port assumptions. If the latter fails, surface an invariant failure rather than call it successful delivery. | 06-02-01 |

**Requirement reconciliation:** the roadmap's unconditional delivery wording
is narrowed only by the approved D-08 sink-failure limit for supported
machine-mode commands. Existing unsupported/stale-mode preflight failures
remain outside the supported command contract under D-10. Mid-command loss of
a readable supported mode and failure of the trusted recovery allocator are
flagged contract assumptions, not additional accepted successful-delivery
exceptions. If the independent checker interprets JOUT-04 as requiring output
even with these unusable host/identity ports, return that exact conflict to
the parent; do not silently use a cached mode or claim a payload was sent.

## Spec-less edge coverage

No SPEC exists. All 12 supplied unresolved probe rows have explicit planned
acceptance criteria from locked context and source evidence; none is dismissed
or silently dropped. “Resolved” here means the edge's expected behavior is
specified; implementation verification remains pending. All rows are authored
as plain must_haves.truths in the named plan.

| Requirement | Category | Status / verification | Acceptance criterion | Plan truth / task |
| --- | --- | --- | --- | --- |
| WIRE-02 | adjacency | resolved / explicit | Equal adjacent emissions remain distinct with correct root attribution. | 06-01 / 06-01-02 |
| WIRE-02 | empty | resolved / explicit | Bare input is plugin browse; valid empty collections persist; missing/null origin is rejected. | 06-01 / 06-01-01 |
| WIRE-02 | ordering | resolved / explicit | Metadata preserves emitted and model-array order without sorting or merging. | 06-01 / 06-01-02 |
| WIRE-07 | adjacency | resolved / explicit | Same command in two invocations has different IDs; repeated entries in one have one ID. | 06-01 / 06-01-02 |
| WIRE-07 | empty | resolved / explicit | Bare/invalid commands allocate nonempty IDs; load/hook has no command ID. | 06-01 / 06-01-01 |
| WIRE-07 | ordering | resolved / explicit | Interleaving preserves each run's identity and append order. | 06-01 / 06-01-02 |
| JOUT-03 | adjacency | resolved / explicit | Back-to-back/interleaved roots settle after their own final append attempt. | 06-03 / 06-03-03 |
| JOUT-03 | empty | resolved / explicit | Empty results complete; silent/empty-diagnostic/prompt-only runs emit missing-result error. | 06-03 / 06-03-01 |
| JOUT-03 | ordering | resolved / explicit | Awaited work precedes finalization; late retained callbacks append nothing. | 06-03 / 06-03-01; 06-04-01 |
| JOUT-04 | adjacency | resolved / explicit | Equal earlier outcomes are retained; a later throw appends one correlated error. | 06-02 / 06-02-01 |
| JOUT-04 | empty | resolved / explicit | Null/undefined throws have a fixed nonempty safe cause. | 06-02 / 06-02-02 |
| JOUT-04 | ordering | resolved / explicit | Partial output precedes error; failure delivery completes before settlement, bounded by D-08. | 06-02 / 06-02-01; 06-03-02 |

Edge equality: 12 surfaced = 12 authored truths + 0 unresolved edge assumptions.
No backstop marker is needed; the expected behavior is explicit.

## Spec-less prohibition recall

Recall considered correlation turning into tracking, hidden identity reuse,
alias disclosure, root confusion, retries, rollback claims, fake success,
discarded partial results, hidden delivery loss, extra output channels,
credential disclosure, late callbacks, dropped tests, and ordering changes.
Precision drops routine implementation correctness into the edge tests and
security threats. Credential/path disclosure is canon security: covered by
the threat register, AUTH-09, and gsd-secure-phase; no duplicate prohibition
is minted for it.

Two bespoke intent constraints survive. Both were passed through the runtime
projectProhibitions serializer and copied as descriptor-less unresolved
must_haves.prohibitions entries:

| Source | Statement | Carrier | Disposition |
| --- | --- | --- | --- |
| WIRE-07 / privacy | MUST NOT turn invocation correlation into persistent user or cross-command tracking or telemetry. | 06-01 must_haves.prohibitions | flagged-unverified |
| JOUT-04 / transparency | MUST NOT present an internal error or delivery failure as proof that completed changes were rolled back. | 06-02 must_haves.prohibitions | flagged-unverified |

Prohibition equality: 2 kept = 2 authored + 0 silent drops. No check descriptor
was invented. A behavioral test can support review but cannot silently turn
these descriptor-less items into a verified prohibition. Parent/verifier must
surface both flags at handoff.

## Multi-source coverage audit

COVERED means assigned to an executable task, not implemented or verified.

| Source | ID | Feature or constraint | Plan / task | Status |
| --- | --- | --- | --- | --- |
| GOAL | SC-1 | Consumer identifies every payload root and outer command | 06-01-01/02 | COVERED |
| GOAL | SC-2 | One injectable identity per invocation; distinct runs | 06-01-01/02 | COVERED |
| GOAL | SC-3 | Complete ordered output before settlement | 06-03-01/03, 06-04-01 | COVERED |
| GOAL | SC-4 | Typed redacted throw output; unchanged text; D-08 limit | 06-02, 06-03-02, 06-04-02 | COVERED |
| REQ | WIRE-02 | Required severity, needsReload, origin, command ID | 06-01, 06-04-02 | COVERED |
| REQ | WIRE-07 | Injected per-command invocation correlation | 06-01, 06-02-01, 06-04-01 | COVERED |
| REQ | JOUT-03 | Command output complete before promise settles | 06-03, 06-04-01 | COVERED |
| REQ | JOUT-04 | Redacted internal-error in json/rpc; text unchanged | 06-02, 06-03, 06-04-02 | COVERED |
| CONTEXT | D-01 | Canonical aliases only | 06-01-01/02 | COVERED |
| CONTEXT | D-02 | Invalid commands retain recognized parent | 06-01-01/02 | COVERED |
| CONTEXT | D-03 | Outer identity through delegation; bare browse | 06-01-01/02, 06-04-01 | COVERED |
| CONTEXT | D-04 | Both marketplace-help spellings | 06-01-01/02 | COVERED |
| CONTEXT | D-05 | Typed empty outcomes; missing-result error | 06-03-01/03 | COVERED |
| CONTEXT | D-06 | Prompts/diagnostics excluded; help/usage valid | 06-03-01/03 | COVERED |
| CONTEXT | D-07 | Partial entries retained; same ID and reload | 06-02-01/02, 06-03-01/02 | COVERED |
| CONTEXT | D-08 | One recovery per append fault; success preserves later output/reload; only failed recovery suppresses; safe log; no retry/rollback | 06-03-02/03 | COVERED |
| CONTEXT | D-09 | All roots, required metadata, injectable IDs | 06-01, 06-02-01 | COVERED |
| CONTEXT | D-10 | Awaited completion, resolved errors, text/mode containment | 06-01..06-04 | COVERED |
| RESEARCH | Roles | Edge selects routes/owns lifetime; shared resolves/delivers | 06-01-01, 06-02-01, 06-03-01 | COVERED |
| RESEARCH | Preflight | Synchronous unsupported/stale-mode refusal before work | 06-01-02, 06-03-03 | COVERED |
| RESEARCH | Root ownership | Original sink and one snapshot; load/hooks separate | 06-01-01/02 | COVERED |
| RESEARCH | Factory compatibility | Tool callers project blocks without command lifetime | 06-01-01 | COVERED |
| RESEARCH | Schema | Both envelopes strict; generated document and controls | 06-01-01, 06-02-01, 06-04-02 | COVERED |
| RESEARCH | Outcome inventory | All existing kinds classified; empty fan-out constraints | 06-03-01/03 | COVERED |
| RESEARCH | A1 / A2 | Catch-safe delivery, monotonic reload before attempts | 06-03-01/02 | COVERED |
| RESEARCH | A3 | Returned/awaited operations plus late-use guard and evidence | 06-03-01, 06-04-01 | COVERED |
| RESEARCH | Setup faults | Generator/inventory errors correlated without rerun | 06-02-01, 06-03-03 | COVERED |
| RESEARCH | Cause handling | Existing depth/redaction, nullish/hostile safe causes, architecture disclosure enrollment | 06-02-01/02, 06-04-02 | COVERED |
| RESEARCH | Capture discipline | Exact payloads, retained invalid attempts, UI trap | 06-01-01, 06-04-02 | COVERED |
| RESEARCH | Preservation | 3149/0 corpus, catalog base 26cb0056, live mode | All plans; 06-04-02 | COVERED |
| RESEARCH | Quality | Direct pairs, full combined-tree gates, no new dependency | All plans | COVERED |
| RESEARCH | A4 / A5 / A6 | Measured timings pending, local security rigor, no migration | All plans and this validation contract | COVERED |

Excluded correctly: Phase 7 browse/device-flow mode refusals, real-Pi e2e,
public schema/limitation documentation, policy wording and catalog prose
closeout. No deferred context idea is implemented.

## Preservation and combined-tree commands

Use these inherited root-relative commands, without recapture:

```bash
npm run check
set -o pipefail; node scripts/notify-corpus.mjs check 2>&1 | node --input-type=module -e 'import assert from "node:assert/strict"; import fs from "node:fs"; const lines = fs.readFileSync(0, "utf8").split(String.fromCharCode(10)); assert.deepStrictEqual(lines.filter((line) => line.startsWith("missing in ") || line.startsWith("extra in ")), []); assert.ok(lines.includes("Notify corpus check passed: 3149 baseline entries present, 0 extra.")); console.log("Corpus: 3149 present, 0 extra");'
git diff --exit-code 26cb0056 -- docs/output-catalog.md
```

A bare corpus-tool pass is insufficient because it can retain extra entries.
Existing tests cannot silently lose corpus occurrences. Added tests should
use JSON/RPC or pure, noncapturing assertion/formatter seams. Do not change
existing text tests' mode or capture participation merely to balance counts.

## Wave 0 and artifacts

No new test framework or external setup is required. 06-01-01 extends seeds
with deterministic origin and preserves capture validation. 06-02-01 creates
the new direct pairs before verifying their new production modules:

- extensions/pi-claude-marketplace/edge/command-run.ts and tests/edge/command-run.test.ts
- extensions/pi-claude-marketplace/shared/notification-command-error.ts and tests/shared/notification-command-error.test.ts

Other produced artifacts: regenerated schema/claude-plugin.schema.json,
updated existing source/owner tests, completed 06-VALIDATION.md, and
06-01-SUMMARY.md through 06-04-SUMMARY.md. Every SUMMARY must include
`## Threat Flags`, even when the answer is None. No unused intermediate
production module or export is permitted.

## Validation sign-off

- [x] All nine tasks have explicit automated verification and fails_when.
- [x] Task IDs and phase-unique threat references are assigned.
- [x] All four requirement IDs appear in plan requirements.
- [x] All ten locked decisions appear in plan must_haves.
- [x] All 12 edge probes and both kept prohibitions are carried.
- [x] No watch flags, new packages, or external setup are planned.
- [x] User approved the scope-only 61-file size exception for 06-01 (option 1, 2026-10-09).
- [x] Independent checker accepted the reviewed plans and documented scope dispositions.
- [x] Owner commands pass with timings in the committed summaries.
- [x] New source-test pairs reach 100% direct coverage in the final combined gate.
- [x] Strict text corpus and catalog checks pass for the isolated 06-04 tree; combined-tree confirmation remains parent-owned.
- [x] All combined-wave gates pass; final unchanged phase inputs share the fourth-wave result.
- [x] CR-01 regression coverage passes. Independent review and T-06-04/T-06-14 reassessment passed.
- [x] Descriptor-less prohibition flags are surfaced to parent/verifier; both remain flagged-unverified.
- [x] Independent validation audit found all nine tasks covered; nyquist_compliant is true.

**Approval:** User decisions and the scope-only 06-01 size exception approved
(option 1, 2026-10-09); independent checker review and combined-tree validation passed. Local execution
evidence follows. Security, code review, and goal verification remain separate
gates; the two descriptor-less prohibitions remain flagged-unverified.

## Plan 06-04 execution evidence

All checks here ran in the isolated `agent-p06-04-1791578940` worktree with
Node `v26.11.0`. No dependency, source, schema, catalog, or corpus file changed.
The only executable changes are the seven declared test files. The parent
owns STATE, state.json, ROADMAP, config, final phase verification, and the
combined-tree `npm run check`; no local hook is substituted for that gate.

### Live prerequisite and carrier inspection

Read 06-01, 06-02, and 06-03 summaries before implementation and checked their
live source after CodeGraph lookup. Prior task heads are
`885418551e9607150e2f575d5ea8a339d30c1468`,
`bdad631968ddf629a6cc8bec122a3655581ff427`, and
`0a26ee89acb4f577471d1b70bf2a33400ba61dd4`. Their recorded owner checks and
parent merge checks are historical evidence, not reused checks for this tree.

The router supplies canonical command IDs; registration performs synchronous
mode preflight before opening the command boundary. The boundary awaits its
handler and settles in finally. Update/import/browse handlers await or return
delegated promises. Auth-host awaits initiateDeviceFlow, whose synchronous
device-code callback precedes its returned polling promise. Marketplace update
awaits each child and emits the aggregate through the supplied outer run.
Enable awaits the install ledger before emitting its aggregate. No queue,
timer, task registry, or production lifecycle mechanism was added.

Dispatcher inspection confirms D-08: a successful recovery returns delivery
to open; only a failed recovery closes it. Existing recovery and original
text-exception tests remain unchanged.

### Current task evidence and exact inputs

- 06-04-01: the exact owner command in the table passed after commit
  `f3e5d1df03ed49515b3d7dc6ed532d1c5b9c2c2e`, exit 0, 5.991 seconds,
  four owner files, no failures or skips. Log: `/tmp/0604-tracer.log`.
  Normal hooks passed static checks, unpaired tests, and direct coverage for
  the four staged pairs. The first hook attempt found eight import/spacing
  lint errors; they were fixed before the successful commit.
- 06-04-02: the exact owner command in the table passed, exit 0, 95 tests,
  zero skips, 4.798 seconds. Log: `/tmp/0604-task2-formatted.log`.
  Inputs were the task-one commit plus the exact retained diff
  `/tmp/0604-task2-verified.diff`, SHA-256
  `df3ea92e9aedae6a0193ed8e71e54656e0f8755eac92cb3848ad3f0c34fc9839`.
  The diff contains the three architecture test files; no untracked executable
  input was added. Final task commit SHA and hook results are in 06-04-SUMMARY.md.
- Final clean reference: task 06-04-02 committed as
  `8a0d27805faf8382502790e0941b4655a6865643`. Its normal check:commit hook
  passed, after a clean Fallow audit and fixer pass. The exact owner command
  passed again on that commit, exit 0, 95 tests, zero skips, 4.704 seconds.
  Log: `/tmp/0604-task2-final.log`. Only planning Markdown changed afterward.
- Local RED controls were observed against the existing implementation by
  temporarily disabling missing-outcome finalization and removing the
  internal-error origin. Both named targets failed the intended complete
  payload assertion, and both real TAP records passed RED_EVIDENCE_OK.
  Records: `tmp/06-04-01-red.json` and `tmp/06-04-02-red.json`.
  Both mutations were restored; only passing tests are committed.

### Requirement, decision, edge, and threat evidence

| Contract | Concrete evidence added or retained |
| --- | --- |
| WIRE-02 / D-09 | All 260 catalog tuples and eight raw samples retain traversal and controls, with explicit producing roots in conversion and JSON/RPC dispatch; the separate internal error completes all 19 kinds. Removing origin, severity, or needsReload fails every retained fixture. |
| WIRE-07 / D-03, D-09 | Delayed enable/install and marketplace cascade retain outer identity; overlapping identical imports settle independently from load/hook emissions. Missing commandId/invocationId negatives fail every command fixture. Shared diagnostics exercise both command and load roots. |
| JOUT-03 / D-05, D-06, D-10 | Exact prompt/outcome/settlement logs cover delayed success, typed error, missing outcome, and throw. Deferred device-code/token polling blocks authentication completion. Retained callbacks emit nothing after root settlement. |
| JOUT-04 / D-07, D-08 | Earlier reload-bearing output survives a delayed throw. Recovery-caught malformed attempts remain visible to capture.assertValid. AUTH-09 checks resolved, converted, and delivered errors across all payload strings, with credential, POSIX, Windows, bare UNC, and both file-URL controls. |
| D-01, D-02, D-04 | Prior canonical alias, invalid-parent, bare browse, and marketplace-help witnesses remain in the live router/register suites; no routing source changed. |
| All 12 spec-less edges | Prior tests and authored truths above remain; new ordered/deferred/late-callback tests extend the ordering and empty-result evidence. None was removed or silently resolved by a command declaration. |
| T-06-12 | Controlled promises and full ordered logs prove real carrier completion and late callback suppression. Every test-owned promise is released and awaited. |
| T-06-13 | Original inventory and negative controls are retained; strict preservation evidence is recorded below. No fixture or corpus recapture. |
| T-06-14 | Full payload capture validation, retained malformed attempts, required metadata negatives, and actual internal-error disclosure controls pass. |
| T-06-SC | No package installation or dependency change. |

Both descriptor-less prohibitions above remain **flagged-unverified**:
correlation must not become persistent tracking/telemetry, and an internal
error must not imply rollback. Parent/verifier judgment is still required.

### Preservation and parent-owned gates

The strict corpus producer runs sequentially with large hooks, with
`TEST_CONCURRENCY=4`. Its unchanged output is saved to a file and checked for
both the exact 3149/zero-extra completion line and absence of missing/extra
lines. This uses the inherited assertions with file-backed input, as in the
prior plans, rather than weakening the strict check or recapturing data.
The producer passed with exit 0 in 142.66 seconds: 9385 tests, zero failures,
one inherited skip, and `Notify corpus check passed: 3149 baseline entries
present, 0 extra.` The separate strict assertions passed with exit 0 and no
missing/extra lines. Log: `/tmp/0604-corpus.log`; timing:
`/tmp/0604-corpus-time.log`. Inputs were the same task-one commit and retained
three-file diff above; an exact diff comparison confirmed the tests had not
changed. No skipped test was introduced.

`git diff --exit-code 26cb0056 -- docs/output-catalog.md` passed with exit 0
and an empty diff. No catalog or corpus baseline was changed or recaptured.

The final producer rerun on clean task commit
`8a0d27805faf8382502790e0941b4655a6865643` also passed: exit 0, 142.62 seconds,
9385 tests, 9384 passing, one inherited skip, zero failures. The strict
3149/zero-extra and no-missing/no-extra assertions passed again, as did the
catalog comparison. Final logs: `/tmp/0604-corpus-final.log` and
`/tmp/0604-corpus-final-time.log`. The executable diff from that commit remains
empty; subsequent validation and summary edits are planning Markdown only.

Combined-wave `npm run check`, final phase verification, and full threat review
remain pending for the parent. This document does not promote those gates or
nyquist_compliant from the local task and hook results.

## Independent validation findings

On 2026-10-09, the Nyquist auditor inspected the live implementation and tests
and found all nine tasks COVERED with zero PARTIAL or MISSING cases. No test
was generated or rerun for this audit. WIRE-02 maps to 06-01 and 06-04-02;
WIRE-07 to 06-01 and 06-04-01; JOUT-03 to 06-03 and 06-04-01; JOUT-04 to
06-02, 06-03 and 06-04-02. Concrete assertions include register.test.ts:454,
812, 997, 1199, 1312 and 1430; router.test.ts:307; command-run.test.ts:79,
483 and 744; notification-dispatch.test.ts:222 and 431;
notification-command-error.test.ts:6; catalog-wire.test.ts:419;
no-credential-leak.test.ts:1064; and auth-host.test.ts:126.

The parent ran `npm run check` on clean merged commit
`f8e2a3889501d13634e1ff2d0ccd368df6f5d274` with Node `v26.11.0`: exit 0,
including integration tests and 100% direct coverage for all 266 pairs.
Log: `/tmp/json-output-wave06-04-check.log`. The executable diff from that
commit is empty and no untracked executable inputs exist. The final corpus
evidence above remains applicable because only planning Markdown changed.

Construction-failure tests inject an escaping constructor failure; production
inventory probes retain their caught-error degradation. Unusable live mode
and a broken trusted recovery allocator remain host-contract failures. D-08
allows one recovery per independent ordinary append fault; successful recovery
reopens delivery. Failed recovery closes delivery without guaranteeing output.
Neither descriptor-less prohibition is promoted by this coverage audit.

## Validation Audit 2026-10-09

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

## Review-discovered coverage gap

CR-01 exposed untested absolute paths with spaces/Unicode and colon-prefixed
diagnostics. Earlier coverage and gate results remain historical evidence;
The gap is now resolved. Independent expected-payload regressions pass,
and the final reviewer confirmed CR-01 closure.

## Final remediation and regression evidence

CR-01 was one coverage gap, resolved without an accepted risk. Direct tests
now cover nine path roots, twelve directory variants, and four quoting
choices. Complete expected payloads cover JSON and RPC command delivery.
Both disclosure helpers compare complete independently expected cause
chains. Fresh planted partial disclosures fail those checks.

The five focused owner suites passed 1198 tests, with zero failures or skips.
Log: `/tmp/cr01-iter3-focused.log`. These extend tasks 06-02-01/02 and
06-04-02 under JOUT-04 and T-06-04/T-06-14. The other task coverage remains
unchanged. All nine tasks remain COVERED. No validation gap remains.

The parent ran `npm run check` on clean executable inputs at
`045f53cd5060082c5df6371853338f6765cd1c2d`, Node `v26.11.0`: exit 0.
Log: `/tmp/json-output-cr01-iter3-check.log`. All 266 direct pairs passed.
This result supersedes earlier gates for the changed error resolver.
The regression inventory contains 130 test paths from phases 1 through 5.
The full gate includes those owners, architecture suites, and integration
suites. Its configured and normalized command is `npm run check`.
No executable input changed after this result.

The strict corpus at the same source commit passed: 3149 entries, zero
extras, 10089 passing tests, zero failures, and one inherited skip.
Log: `/tmp/cr01-iter3-corpus.log`. The catalog and frozen corpus remain
unchanged from `26cb0056`. No baseline was recaptured.

Independent code review is clean. Independent security reassessment closes
all fifteen declared threats. The fix workflow still requires developer
confirmation of the redaction logic before goal verification. The two
prohibition flags remain unresolved for the final verifier.

## Validation Audit 2026-10-09

| Metric | Count |
|---|---|
| Gaps found | 1 |
| Resolved | 1 |
| Escalated | 0 |

## Developer confirmation

On 2026-10-09, the user selected option 1, "Accept and continue verification."
The accepted machine-error behavior replaces local paths with `[path]` and
ambiguous affected causes with `Command failure details omitted.`. Text
output remains unchanged. This resolves the redaction confirmation required
by the fix workflow. It does not resolve the two prohibition flags or claim
native Windows filesystem execution.
