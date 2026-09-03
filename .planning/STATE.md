---
gsd_state_version: 1.0
milestone: v1.19
current_phase: 117
current_phase_name: Extension Entry and Final Gate
status: executing
stopped_at: Completed 117-09-PLAN.md
last_updated: "2026-09-03T20:10:21.846Z"
last_activity: 2026-09-03
last_activity_desc: Phase 117 execution started
state_head: c7c52d9fa100e11897d6a00f61a7d09e9a2113c8
progress:
  total_phases: 10
  completed_phases: 9
  total_plans: 220
  completed_plans: 217
milestone_name: Unit Test Refactor
---

# Project State

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-01 after Phase 113)

**Core value:** A Pi user can install a Claude plugin and load each supported
component as a working Pi artifact.

**Current focus:** Phase 117 — Extension Entry and Final Gate

## Current Position

Phase: 117 (Extension Entry and Final Gate) — EXECUTING
Next: Phase 117 (Extension Entry and Final Gate) — NOT STARTED, no phase directory yet
Plan: 10 of 12
Status: Ready to execute
verification measured every promise directly rather than reading the summaries. Its one gap — the two
D-116-01a claimants predating the amendment were pinned in their own pairs but never entered in the
ledger — is closed; all seven shortfalls are now filed as entries 15-19, 21 and 22. MOD-09 closed, the
pair total swept to 203/204, and the ROADMAP row marked Complete.

Closing gates, each run separately: typecheck 0, lint 0, fallow 0, `npm test` 5141/5141 across 295
suites, `test:integration` 31/31. Zero coverage pragmas repo-wide, zero banned casts in the phase's own
work, and all 30 edge sources mirrored — the one orphan, `tests/edge/index-handler.test.ts`, is
D-116-10's deliberate deferral to Phase 117.

The history below is the per-plan record, newest first; it is retained deliberately.

Last activity: 2026-09-03 — Phase 117 execution started

Last activity: 2026-09-03 — code-review gap closure part two: the seven findings OUTSIDE the tools.ts licence, all in test files, `git diff --quiet -- extensions/` clean at every commit. Five of the seven were this phase's own signature defect turned on its own work — a proof that cannot fail — and each was strengthened rather than deleted. WR-02: the `CATALOG_VERBS` case asserted key uniqueness (a language guarantee) and non-emptiness (a typecheck failure long before the case runs); it now pins the exported key list, in declaration order, against a hand-authored list. IN-02: the `isCatalogVerb` acceptance loop drove its input from `CATALOG_VERBS`, the same `Object.keys(CATALOG)` the guard answers from; it now iterates the same hand-authored list. The CONTROL is the measurement that matters: a coordinated removal of one verb (catalog key + union member + the drift guard's own Record row) leaves `flag-catalog-drift.test.ts` GREEN, and left the OLD derived loop green too — it simply ran one row fewer, 26 tests instead of 27. The new form reddens both cases. WR-03: the `allowMarketplaceOnly: false` case switched the mode AND the flag, landing on an empty candidate map where the result is `[]` either way; deleting the guard in `data.ts` left ALL 66 cases green. Held at the `update` mode, varying the flag alone, the same deletion reddens exactly that case. WR-06: `parseCommandArgs` iterates the SCHEMA, so a surplus positional is dropped with no diagnostic — a rule two consumer suites asserted and the producer's owner did not; the owner now carries it and the consumers keep their forwarding claim. IN-04: the offline guard came off the five pure token helpers (25 zeros that could not rise). IN-05: the HOME / PI_CODING_AGENT_DIR substitution came out of both completion `seedResolver` helpers — nothing in the import closure of `data.ts`, `provider.ts` or `completion-cache.ts` reads `process.env`, `homedir()` or `getAgentDir()`, measured by running both suites under bogus values with a positive control showing the same override moves `getAgentDir()`. IN-01: the header counted four derivations and listed five. WR-01 was NOT acted on, per instruction — but the dispatch's rebuttal is itself wrong and is reported: twelve edge suites really do install `t.mock.method(globalThis, "fetch")`, and only seven watch `https.request`. Gates run SEPARATELY: typecheck / lint / fallow 0, `npm test` 5141/5141 across 295 suites (was 5140; +1 is the new surplus-positional case), `test:integration` 31/31. All four pairs' direct-coverage gates re-measured and UNMOVED — flag-catalog 11/11 · 10/10 · 190/190, args-schema 17/17 · 2/2 · 96/96, and both D-116-01a shortfalls still exactly one branch short with lines and functions complete (data.ts 109/110, provider.ts 79/80). Report: `116-REVIEW-FIX-REPORT-2.md`.

Last activity: 2026-09-03 — code-review gap closure under D-116-15, the phase's THIRD production licence, narrowly for `edge/handlers/tools.ts`. Five findings closed, both criticals among them, no new plan and no plan-count movement. CR-01: the tool could never emit a `remote` or `partially-available` row, because `applyFilter` mapped "no filter set" onto an all-true bag, so `filtersPassive` was never true on this surface and `shouldShow`'s two union arms sat behind `opts.remote` / `opts.partial`, which the tool does not expose. Fixed by making the arms REACHABLE rather than deleting them — the module's own three-bucket contract already folds `remote` into `available` (RSTA-01) and `partially-available` into `unavailable` (USTAT-02), so the passive path now forwards NOTHING and each narrowed coarse bucket carries its fine-grained members. The unreachability knowledge 116-27's rewrite had lost is back on `projectRowStatus`, now stating the CAUSE rather than the symptom. CR-02: `pluginReasons` dropped the optional `reasons` of `disabled`, `available` and `remote` — the data-field class this phase measured twice, invisible at 100 percent branch coverage. THREE findings of our own. First, the CR-02 fix STRANDED the trailing `return undefined` (coverage fell to 103/104 branches, 580/582 lines, `411-412` uncovered); rather than pin a D-116-01a shortfall for a statement that no longer needed to exist, `pluginReasons` became a value-returning switch over the same derived `ToolPluginRow` union `pluginVersion` uses, closing the gate at branches 103/103, functions 16/16, lines 583/583. Second, that reshape gives the file a FIFTH exhaustiveness gate: D-116-14 now stands at three TS2366 and TWO TS7030, and `116-27-PLAN.md` carries an amendment saying to read every "four switches" in it as five. Third, WR-05's own reproduction does NOT reach the shape it names — `{installed: true}` makes the ORCHESTRATOR drop the row, leaving `mp.plugins` empty and taking the `(no plugins)` branch; the bare-header shape needs a row the two filters DISAGREE about, and a disabled record is that row. All four D-116-14 diagnostics re-measured and CONFIRMED unchanged in kind and text (coordinates moved only because the file grew). Eight behaviour plants, all RED on exactly their own case, all reverted; WR-04's relocation of the projection into the `try` and IN-03's redundant-conjunct removal carry no plant and are reported as unproven-by-construction rather than claimed. WR-01 left untouched as a false finding. Gates run SEPARATELY: typecheck, lint, fallow all 0; `npm test` 5140/5140 across 295 suites read from the runner's own line; integration 31/31. Full account in `116-REVIEW-FIX-REPORT.md`.

Last activity: 2026-09-03 — 116-28 rewrote the registration-glue owner and finished the phase's plan set. Every callback the module hands to Pi is now captured off the recorded registration and INVOKED: 11 runtime cases from 11 marked bodies (was 13 cases through a hand-rolled recorder), direct coverage branches 15/15, functions 9/9, lines 143/143 — up from branches 9/10 and functions 7/9, so both previously-unreached functions (the suggestion pass-through and the file-completion trigger) are covered and no D-116-01a claim arises. THREE findings. First, and the one that changes a stated fact: the plan's must_haves truth that the working directory is "captured at registration" is FALSE against the module. `process.cwd()` is evaluated INSIDE the `getArgumentCompletions` arrow (register.ts:107-108), so it is read on every completion invocation; the two-root case therefore asserts the INVOCATION-time root and Plant C (hoisting the read above `pi.registerCommand`) turned exactly that case RED. Two production comments (register.ts:18-20 and 104-106) assert the registration-time property the code does not have; no licence remains to fix them, so they are reported. Second, the plan's literal Plant 3 — "move the working-directory read from registration time into the completion callback" — has NO TARGET, because the read is already there; a zero-diff plant cannot redden anything, and the mirror was run instead. Third, a registration table is DATA and the phase's data-field warning applies: the command name, the event name, the description and both tool names are hand-authored literals matched exactly by the expectation, and only the callbacks beside them are captured, because a function has no structural comparison. Plants G and H (a different command name, a different event name) fail at the CALL SITE across 10 of 11 rows; Plant D (swapping the two tool registrations) reddens exactly one row. Eight plants, eight RED, all reverted; production is byte-identical. The edge tier is now fully mirrored and fully owned: all 30 sources under `extensions/pi-claude-marketplace/edge/` have a mirrored owner, and the one orphan test (`tests/edge/index-handler.test.ts`) is D-116-10's deliberate deferral to Phase 117. npm test 5134/5134 across 295 suites, test:integration 31/31, typecheck/lint/fallow all 0.

Last activity: 2026-09-03 — 116-25 rewrote the plugin update shim owner and CLOSED wave 5, crossing the three target forms with the flag matrix: 22 runtime cases from 9 marked bodies (was 18 cases through a hand-rolled context), direct coverage branches 22/22, functions 2/2, lines 90/90 — up from branches 20/22 and lines 85/90, so BOTH regions the plan named (update.ts:45-46, the early return after the shared map-model parse, and update.ts:51-53, the too-many-arguments rejection) are now covered and no D-116-01a claim arises. SIX findings. First, a NINTH parser/arity/flag combination: extractLocalFlag then parseMapModelArgs plus the handler's own `nonFlagPositionals.length > 1` guard. TWO and THREE references are rejected with `Too many arguments.`, but ZERO is ACCEPTED — it IS the all form — so the surplus half of the arity truth HOLDS and the lower half has NO TARGET. The arity must_haves truth is half false for a SEVENTEENTH consecutive plan. Second, `--local` is ACCEPTED — the FIFTEENTH distinct outcome and the SIXTH acceptance — and it is invisible in the notification, which is byte-identical with and without it; the sole observable difference is that the update's config write-back creates the declaration in claude-plugins.local.json instead of claude-plugins.json. This is 116-22's config-layer shape, NOT 116-24's footprint-invisible one, because update's write-back (maybeWritePluginConfigBack, orchestrators/plugin/shared.ts:1049-1079) targets ONE layer chosen by the flag rather than sweeping both. `--scope user one@alpha --local` honours BOTH selectors, so the mutually-exclusive truth is FALSE for the sixth time. Third, and the answer that made the plan's 'assert the identical outcome' rows falsifiable rather than tautological: an OMITTED scope flag is not a default here. enumerateTargets walks `explicitScope === undefined ? ["project", "user"] : [explicitScope]`, so the omitted form produces a THIRD footprint neither explicit value can — which is what makes absence provable. Plant D (delete the scope conditional spread) turned BOTH scope rows RED plus the both-selectors case, where 116-24's equivalent plant left one row green. Fourth, the Group-C negative fires, and BOTH the scope AND the cwd forwarding discriminate it — 116-19's rule on one axis and the opposite of 116-22 on the other. From ONE plant (delete the too-many-arguments guard) three outcomes: unstated cwd with no scope token gives `A plugin operation has failed. … ⊘ one (failed) {unreadable manifest} cause: The "path" argument must be of type string. Received function`, CAUGHT by the orchestrator so the emission count stays at one; `--scope user` never reaches path.join and the update COMPLETES with `A plugin operation needs attention. … ● one v1.0.0 → v3.0.0 (updated)`; the STATED-cwd variant completes the same way against the project source at v2.0.0. A separate plant on the first scan's early return produced a NEW diagnostic family for this phase: falling through the first rejection lands in the SECOND scanner's rejection, not in the workflow — `TypeError: ctx.ui.notify is not a function` at shared/notify.ts:326 via parsePositionalsWithFlags (edge/handlers/plugin/shared.ts:76). Fifth, SC-4: the https.request zero is asserted in all 22 cases and is an NFR-5 and hermeticity REGRESSION GUARD, not a discriminated measurement. Two independent fixture attempts to reach the door THROUGH this handler both left the counter at zero — a url-source marketplace because makeSyncCloneOnce (orchestrators/plugin/update.ts:293-298) no-ops for every non-github kind, and a github-source marketplace because refreshGitHubClone fails on the absent clone (`Could not find HEAD.`) before reaching the transport — so the fixture cannot reach it and no flag turns it on. An out-of-suite control confirmed the door is instrumented (a direct https.request call moves the counter 0 to 1). Sixth, the four-combination downstream matrix over a plugin whose NEW source declares an unsupported component kind: the gate-widening flag alone decides whether anything materialises and the model-mapping flag alone does NOT widen the gate, so the unsupplied model flag is proven ABSENT rather than present-and-false by the agent frontmatter omitting the field entirely. EIGHT production plants across two files (edge/handlers/plugin/update.ts, edge/handlers/shared.ts), all EIGHT RED, all reverted; both SHA-1s restored (acc5ea9d892560e68e5deeb4b2f1300690df1439, 9c42cb8b2c5c7066e962b50dbef035485c7e0320) and git diff --quiet over the five pinned production files plus tests/helpers/notification-boundary.ts exits 0. npm test 5136/5136 across 293 suites, integration 31/31

Last activity: 2026-09-03 — 116-24 rewrote the plugin uninstall shim owner, the smallest seamless handler and the first destructive verb owned through its ON-DISK FOOTPRINT: 16 runtime cases from 10 marked bodies (was 10 cases matching regular expressions through a hand-rolled context), direct coverage branches 10/10, functions 2/2, lines 42/42 — unchanged, so the thinner rewrite dropped no branch the old suite covered incidentally (T-116-24-B answered). FIVE findings. First, the shape to carry: every case, the eight rejecting ones included, compares the surviving install records of BOTH scope roots as one whole value beside the notification, and both scopes are seeded with the SAME demo@alpha record so a wrong scope shows. Second, an EIGHTH parser/arity/flag combination — extractLocalFlag then parseCommandArgs with ONE REQUIRED positional: zero IS rejected (`Missing required argument.`), but a surplus positional is DROPPED, not rejected, because parseCommandArgs iterates the SCHEMA; `demo@alpha surplus` uninstalls exactly as the bare form does. The arity truth is half false for a sixteenth consecutive plan. Third, `--local` is ACCEPTED — the FOURTEENTH distinct outcome and the fifth acceptance — and it is invisible in BOTH the notification AND the footprint on a healthy workspace, which is a step past 116-22's config-layer answer: uninstallPlugin reads opts.local in ONE place, to pick targetConfigPath for the CFG-03 precondition (uninstall.ts:543-545), and the success path then sweeps BOTH layers unconditionally (378-384). The plan's 'assert the identical outcome' rows would have been a pure tautology; the whole scope-target family was moved onto an override layer that FAILS SCHEMA VALIDATION, where supplying the flag aborts the command and omitting it completes it, with a companion case asserting that opposite outcome. `--scope user --local` is accepted with both selectors honoured, so the mutually-exclusive truth is FALSE for the fifth time. Fourth, the Group-C negative fires, the SCOPE DOES discriminate it (116-19's rule, not 116-20's exception), and ONE plant produced THREE distinct frames: with the cwd unstated the bare form dies at persistence/locations.ts:145 via the unqualified fan-out (orchestrators/plugin/shared.ts:275), `--scope project` dies at the same line via the explicit-scope arm (shared.ts:248), and `--scope user` never reaches path.join at all, runs to COMPLETION and dies on the second ctx.ui access as `ctx.ui.notify is not a function` at notify.ts:3658 via uninstall.ts:737 — the same diagnostic the STATED-cwd variant gives. Fifth, a THIRD SC-4 answer: the uninstall path can reach NO transport at all (the git door is in the import graph only because orchestrators/marketplace/shared.ts, which supplies the unstage cascade, also re-exports the git operations), so unlike 116-20 and 116-21 the fixture cannot reach it AND no input turns it on. The https.request zero is kept in every case and stated in those words as an NFR-5 REGRESSION GUARD with neither a positive control nor a reachable input; an out-of-suite control confirmed the door is instrumented. The plan's literal Plant A does not compile (two TS18048) and dies as a raw TypeError at the handler rather than at the boundary, so it was run, recorded, and then re-run in the form that reaches the workflow. Five production plants across two files (edge/handlers/plugin/uninstall.ts, edge/handlers/shared.ts), all FIVE RED, all reverted; both SHA-1s restored and git diff --quiet over the five pinned production files plus tests/helpers/notification-boundary.ts exits 0. npm test 5132/5132 across 293 suites, integration 31/31

Last activity: 2026-09-03 — 116-22 rewrote the plugin reinstall shim owner, whose distinguishing property is a TWO-STAGE flag rejection: 28 runtime cases from 14 marked bodies (was 9 cases matching substrings and regular expressions), direct coverage branches 25/25, functions 3/3, lines 100/100 — up from branches 24/25, lines 98/100 with 50-51 uncovered, so NO D-116-01a claim arises. SIX findings. First, and the one the plan hedged on: the second rejection stage IS REACHABLE, so the plan's "report the branch as unreachable" fallback did not fire. extractLocalFlag splits on /\s+/ and reads RAW characters while parseArgs's tokenizer STRIPS quotes, so a QUOTED long flag passes stage one as an ordinary word and is reassembled into a long-flag-shaped token before the handler's own loop reads it — measured on three distinct shapes ("--frobnicate", '--frobnicate', and "--"frobnicate, where only the prefix is quoted). Second, the two stages emit DIFFERENT sentences and neither family can satisfy the other: stage one (the shared scanner, empty pass-through list) emits `Unknown flag: "<tok>".` and stage two emits `Unknown option: "<tok>".` Proved in BOTH directions rather than by comparing two hand-authored literals — Plant B moves --frobnicate into the pass-through list and turns exactly the three stage-ONE rows RED with the stage-TWO sentence, Plant C deletes the stage-two branch and turns exactly the four stage-TWO rows RED with `Invalid <plugin>@<marketplace> ref:` while every stage-one row stays GREEN. Third, a SEVENTH parser/arity/flag combination: parseArgs behind extractLocalFlag plus the handler's own `refs.length > 1` guard. ZERO and ONE positional are BOTH accepted (zero is the all form, one is the marketplace or plugin form) and TWO is rejected with `Too many arguments.`, so the surplus half of the arity truth HOLDS and the lower half has NO TARGET — nothing is below zero. Fourth, `--local` is ACCEPTED — the THIRTEENTH distinct outcome — and it discriminates ONLY through the config LAYER: the notification is byte-identical with and without it, and the sole observable difference is that the write-back lands in claude-plugins.local.json instead of claude-plugins.json. A message-only suite would have called the flag inert. That also makes the mutually-exclusive-selector truth FALSE here for the fourth time: `--scope user --local` runs to completion and honours BOTH selectors. Fifth, the Group-C negative fires but the SCOPE does NOT discriminate it — 116-20's exception, not 116-19's rule. Plant D deleted the return after the too-many-arguments emission; with the cwd UNSTATED all four surplus rows died identically as `TypeError: ctx.ui.notify is not a function` at notify.ts:3660 via handleEnumerationFailure (orchestrators/plugin/reinstall.ts:649), which CATCHES the unstated-cwd ERR_INVALID_ARG_TYPE and re-emits, and `--scope user` and `--scope project` gave BYTE-IDENTICAL diagnostics; with the cwd STATED the same plant died one FRAME later at notify.ts:3658 via renderReinstallPartitionAndNotify (reinstall.messaging.ts:199). The two variants differ in the frame, not the message. Sixth, SC-4: the zero is asserted in all 28 cases watching https.request, and one case seeds a COLD git source (https://127.0.0.1:9/far.git) as the installed plugin — measured, the no-network resolver answers first with `⊘ far (failed) {source mismatch}` and the counter at zero, so the zero is not the all-path-source vacuity, but reinstall has no flag that turns materialization on and the resolver rejects a cold source before materializePluginClone is ever reached, so there is NO positive control and the zero is an NFR-5 regression guard, stated as a limit. Delegation is observed as the SET of skill directory names each scope root carries afterwards, each seeded plugin owning a differently named directory and each scope a different marketplace, so a wrong target form materializes a WRONG NAME rather than nothing. Seven production plants across THREE files (edge/handlers/plugin/reinstall.ts, edge/handlers/shared.ts, edge/args.ts), all SEVEN RED, all reverted; shared.ts and args.ts SHA-1s identical before the first plant and after the last, and git diff --quiet over the five pinned production files plus tests/helpers/notification-boundary.ts exits 0. npm test 5126/5126 across 293 suites, integration 31/31

Last activity: 2026-09-03 — 116-21 rewrote the plugin pending shim owner and pinned its D-116-01a shortfall: 15 runtime cases from 5 marked bodies (was 7 substring-matching cases), direct coverage functions 2/2, lines 100 percent, branches 9/10 — the documented shortfall, which sat at 8/9 before the rewrite, so the DENOMINATOR moved with the numerator and nothing regressed (the third instance of the phase's 'branch numbers are not a property of the source' finding). SEVEN findings. First, and the one to carry: the ZERO-PROBE half of createNotificationBoundary(n, 0) is NOT a fail-fast. hasLoadedPiSubagents and hasLoadedPiMcpAdapter each wrap pi.getAllTools() in their own try/catch (platform/pi-api.ts:129-135 and 143-155), so strong-mock's unexpected-call throw on an unstated getAllTools is SWALLOWED at the call site and the probe degrades to 'unloaded'. The zero-probe half is a POST-HOC report from verify(pi), which is why 116-20 saw `extension API.getAllTools()` listed twice at verify time rather than the workflow dying, and why a Group-C case MUST call verifyBoundary() and never rely on the workflow crashing. Measured directly with the guard deleted. Second, the Group-C negative here IS scope-discriminated — 116-19's rule fires and 116-20's exception does not: with no scope flag the fan-out reaches locationsFor('project', proxy) and the handler THROWS raw `TypeError [ERR_INVALID_ARG_TYPE]: The "path" argument must be of type string. Received function` at persistence/locations.ts:145 via orchestrators/reconcile/pending.ts:149, emitting nothing; with `--scope user` the workflow runs to COMPLETION (user scope never reads cwd), emits exactly ONE notification so the emission sizing stays satisfied, and the case is caught by the hand-authored whole-value comparison receiving `● mp [user]\n  ● p-user (will install)`, with verifyBoundary()'s zero-probe half independently reporting the two unexpected getAllTools() calls. Third, a SIXTH parser/arity/flag combination: parseArgs via withParsedArgs plus this shim's own `positional.length > 0` guard. ZERO is the accepted arity and ONE is rejected, so there is no arity one BELOW it and the lower half of the arity truth again has no target — but this is the first module in the phase whose surplus half emits TWO DIFFERENT sentences, picked from the SHAPE of the FIRST positional only: a long-flag-shaped first token takes `Unknown option: "<token>".`, anything else takes `Too many arguments.`, and a long-flag-shaped token driven SECOND behind an ordinary one takes the too-many-arguments sentence. Fourth, `--local` is REJECTED as `Unknown option: "--local".` alone and beside a scope flag — the TWELFTH distinct outcome, and the first time a --local answer has matched a sibling's exactly (116-20's plugin/list), still measured rather than carried. That also makes the mutually-exclusive-selector truth HOLD here, the third time in the phase. Fifth, SC-4: the zero is asserted in all 15 cases watching https.request, never globalThis.fetch. The fixture declares a COLD git source (`https://127.0.0.1:9/far.git`) as a PLANNED INSTALL, which resolvePendingForceInstalls routes through resolveStrict — the input this verb would need the network to resolve any further, answered `unavailable` offline with the counter at zero. But no input to this verb turns materialization on, so there is NO positive control and the zero is an NFR-5 regression guard, stated as a limit as 116-20 did; a separate out-of-suite control confirmed the door itself is instrumented (a direct https.request call moves the counter 0 to 1). Sixth, the read-only tree-listing assertion is a LIVE gate, not a vacuous negative: planting a saveState into orchestrators/reconcile/pending.ts turned all three scope rows RED on the ADDED `pi-claude-marketplace/state.json` path — it catches an added path, not a rewritten one. Seventh, the D-116-01a pin for edge/handlers/plugin/pending.ts:39 is COMPILER-FORCED: deleting the `?? ""` fallback raises TS18048 at its consumption site, proved further by a green replacement plant, a green OBSERVABLE plant that would have named a long-flag-shaped sentinel in the emission, and a brute force over 19530 argument strings that produced zero sentinel emissions while the same brute force with the index moved out of range reported it for 136 of 155 — so the probe is live. Filed as WINDOWS ledger entry 19; the pin's five directional plants (two assertion-side, three output-side) all behave. Seven production plants across two files, five RED and two deliberately GREEN, all reverted; `git diff --stat -- extensions/` empty and pending.ts's SHA-1 identical before the first plant and after the last. npm test 5109/5109 across 293 suites, integration 31/31

Last activity: 2026-09-02 — 116-20 rewrote the plugin list shim owner, the widest filter-flag family in the handler tier: 26 runtime cases from 9 marked bodies, direct coverage branches 19/19 (was 15/17), functions 2/2, lines 82/82 (was 79/82, uncovered 62-64 — the too-many-arguments rejection the old nine-case suite never drove, because every one of those cases asserted the `(no marketplaces)` empty-state sentinel and so proved nothing about any flag). FOUR findings. First, and the one to carry: the Group-C negative fires here as a CHANGED NOTIFICATION BODY, not as an emission-count failure. listPlugins wraps its whole body in a catch that turns any throw into a synthetic one-emission `(list) (failed)` row, so when the guard is deleted and the workflow runs with an unstated cwd proxy, the ERR_INVALID_ARG_TYPE from path.join never escapes — the count is still exactly one and verifyBoundary()'s emission sizing stays satisfied. What DID catch it: the hand-authored whole-value message comparison, and verifyBoundary()'s ZERO-PROBE half reporting `extension API.getAllTools()` unexpected twice. For an orchestrator that swallows its own throws the probe count is the load-bearing half of the boundary. Second, varying the SCOPE does not discriminate here either, which narrows 116-19's correction rather than repeating it: listPlugins walks BOTH scope roots regardless of opts.scope (the orphan fold needs both), so `mp other` and `mp other --scope user` produced BYTE-IDENTICAL diagnostics and only `--scope project` moved the block header. The scope discriminates only where the orchestrator's scope selection is what reaches locationsFor. Third, `--local` is REJECTED as `Unknown option: "--local".` alone and beside a scope flag — the ELEVENTH distinct --local outcome, and NOT the same rejection its rejecting siblings emit, because this shim uses the unknown-OPTION wording where fetch and plugin/info use unknown-FLAG. The arity truth is again half false: ZERO and ONE positional are both accepted, so the lower half has no target. Fourth, SC-4: the zero IS asserted in all 26 cases over a COLD git source (`https://127.0.0.1:9/far.git`, rendered `(remote)`) watching https.request rather than globalThis.fetch, so it is not the all-path-source vacuity 116-18 measured — but this verb has NO flag that turns materialization on, so there is no positive control and the zero is an NFR-5 regression guard, stated as such rather than dressed up. Five flag members classified VALUE-carrying and pinned over a fixture holding exactly one plugin per bucket; the order-independence pair was BOUNDED by a plant rather than asserted on trust. The BOOLEAN_FLAGS re-export is untouched and recorded as an observation. Five production plants, all FIVE RED, all reverted; list.ts's SHA-1 identical before the first and after the last. npm test 5101/5101 across 293 suites, integration 31/31

Last activity: 2026-09-02 — 116-19 rewrote the plugin install shim owner, the largest flag matrix in the handler tier: 23 runtime cases from 10 marked bodies, direct coverage branches 17/17 (was 16/17), functions 2/2, lines 101/101 (was 99/101). THREE findings. First, and the one to carry: omitting `cwd` on a Group-C negative is NOT universally load-bearing. locationsFor is `scope === "user" ? getAgentDir() : path.join(cwd, ".pi")`, so an unstated cwd never reaches path.join on a user-scope call — plants F1 (forwarding ctx.cwd) and F2 (a literal working directory) produced the BYTE-IDENTICAL diagnostic, `ctx.ui.notify is not a function` at orchestrators/plugin/install.ts:2390, the workflow running to completion; plant F3, differing only in scope: "project", returned the other family, ERR_INVALID_ARG_TYPE at persistence/locations.ts:145. The discriminator is the SCOPE the plant targets, not whether it forwards ctx.cwd. Second, the 116-05 data-field question answered on a real matrix: four of five members the handler hands downstream are VALUE-carrying and one — applyDefaultEnabled: true — is a data field with NO branch at all, so nothing in this repo could catch it being wrong; plant B (deleting it) leaves the record enabled:true, the declaration {} instead of {enabled:false}, and the generated agent file in place, with every gate still green. The four-combination matrix runs over one plugin that is simultaneously partially-available and carries a model-bearing agent, because that is the only fixture where both downstream booleans bite. Third, `--scope project --local` is ACCEPTED and both members honoured (the fourth acceptance among handlers reaching extractLocalFlag, the tenth distinct --local outcome), so the mutually-exclusive-rejection truth is false here; the arity truth HOLDS in both halves, the second module in the phase after 116-18. The previously-uncovered install.ts:57-59 has TWO routes, not the one the plan named: a quoted long flag claimed by the second scanner, and an unrecognised scope value caught inside the same shared parse. Eleven production plants across two files, all ELEVEN RED, all reverted; `git diff --stat -- extensions/` empty. npm test 5084/5084 across 293 suites, integration 31/31

Last activity: 2026-09-02 — 116-18 rewrote the plugin info shim owner: 18 runtime cases from 7 marked bodies, direct coverage held at branches 17/17, functions 2/2, lines 79/79. FOUR findings. First, a FIFTH parser/arity/flag combination, and the FIRST module in the phase where BOTH halves of the arity truth hold: this handler reaches parseArgs through withParsedArgs and then applies its own `nonFlagPositionals.length !== 1` guard, so zero positionals IS rejected and two or three ARE rejected, all four counts with the one `info requires exactly one <plugin>@<marketplace> argument.` sentence. Second, `--scope user --local` is REJECTED as `Unknown flag: "--local".` — the NINTH measured `--local` outcome and the second time the inherited mutually-exclusive-rejection truth has held. Third, and the finding worth carrying: the SC-4 offline proof as inherited is UNFALSIFIABLE. The precedent watches globalThis.fetch, but isomorphic-git reaches the wire through simple-get, which calls https.request and never fetch, so a global-fetch spy records zero whatever the handler does; and a path-source fixture never reaches the transport with or without the flag, so a zero asserted there is vacuous too. The claim is asserted on the ONE fixture where it can fail — a cold git-source plugin on a closed loopback port, watching https.request — where the flag-absent row records 0 and the same reference with the flag records 2. Plant C (an unconditional fetch spread) turns exactly that row RED with `2 !== 0` and leaves all three path-source delegating cases GREEN, which is the measurement that separates the two. Fourth, the plan's "the member is absent, not present as false" claim is not observable: getInfoFetchContext tests `opts.fetch !== true`, so an explicit false and an omitted member are indistinguishable; what IS observable is supplied versus omitted, and that is what the pair asserts. The Group-C negative produced a NINTH and TENTH diagnostic site: forwarding ctx.cwd dies as ERR_INVALID_ARG_TYPE at persistence/locations.ts:145 via orchestrators/plugin/info.ts:2257, and a literal working directory runs the projection to completion and dies as `ctx.ui.notify is not a function` at orchestrators/plugin/info.ts:2306. No on-disk footprint is asserted beside verifyBoundary(): this read-only surface persists nothing. No D-116-01a claim — coverage is complete in both directions. Six production plants, all SIX RED, all reverted; the file's md5 matches the pre-plant byte copy and `git diff --stat -- extensions/` is empty. npm test 5077/5077 across 293 suites, integration 31/31

Last activity: 2026-09-02 — 116-16 rewrote the fetch shim owner, the only plugin handler that exports its own parser: 21 runtime cases from 8 marked bodies across two top-level describe blocks, one per exported entrypoint, direct coverage held at branches 27/27, functions 4/4, lines 132/132. FOUR findings. First, this module calls parseArgs DIRECTLY and never reaches extractLocalFlag, which gives a FOURTH parser combination: zero positionals is an ACCEPTED arity (the all form) so nothing lies below it, and two positionals IS rejected — by the handler's own `nonFlagPositionals.length > 1` guard rather than by any parser, the first genuine surplus rejection measured on a module of this shape. Second, `--scope user --local` is REJECTED with `Unknown flag: "--local".` — the scope-target flag reaches the positional list as an ordinary token and the handler's own long-flag scan claims it. That is the EIGHTH distinct `--local` outcome in this phase and the FIRST time the inherited mutually-exclusive-rejection truth has held against a real module. Third, the delegating path runs TWO tool probes, not the four 116-15 measured: fetchPlugins emits one cascade through notifyWithContext, which runs a single soft-dependency probe reading getAllTools twice. The probe count is per-orchestrator and must be measured every time. Fourth, the Group-C negative produced a SEVENTH and EIGHTH diagnostic site: forwarding ctx.cwd dies at persistence/locations.ts:145 via orchestrators/plugin/fetch.ts:244 (fetchPlugins runs no catch around enumeration), and a literal working directory runs the sweep to completion and dies on the emission count at orchestrators/plugin/fetch.ts:194. No on-disk footprint is asserted beside verifyBoundary(): fetch persists no state, so an empty-tree assertion would pass whether or not the workflow ran. Nine production plants, all NINE RED, all reverted; git diff --stat -- extensions/ empty; no production file touched. npm test 5070/5070 across 293 suites, integration 31/31

Last activity: 2026-09-02 — 116-15 rewrote the dual-form plugin enable/disable owner: 17 runtime cases from 9 marked bodies, direct coverage branches 17/17 (was 14/16), functions 3/3, lines 87/87. FOUR findings. First, this handler parses through parseCommandArgs with ONE REQUIRED positional, so the arity truth splits: zero positionals IS rejected (`Missing required argument.`), and a surplus token is silently DROPPED — `alpha@mp beta@mp` flips alpha and leaves the seeded beta untouched, proven discriminating by a planted surplus rejection. Second, `--scope user --local` is ACCEPTED and BOTH selectors are honoured — the scope names the record, the scope-target flag names the config layer — the seventh distinct `--local` outcome measured in this phase, so the plan's mutually-exclusive-rejection truth is false here. Third, the Group-C negative produced a FIFTH and SIXTH distinct diagnostic site from the same omitted `cwd`: forwarding `ctx.cwd` dies at orchestrators/plugin/enable-disable.ts:610 inside the RESOLUTION catch (emitResolutionFailure), and a literal working directory dies at :785/:1048 in dispatchOutcome after the workflow ran to completion. Fourth, the two branches uncovered at HEAD were the `?? "user"` scope default and the non-Error arm of the catch's cause normalization, both reachable only through the handler's defense-in-depth catch; they are reached by a context that delegates every member to the shared strict boundary through a Proxy and throws on the single `cwd` read, so no Pi member is hand-rolled and `verifyBoundary()` still governs the emission. Boundary counts were measured through a counting proxy before a case was written: FOUR tool probes when delegating (the orchestrator's context cascade runs two probes), TWO on the handler's own failure conversion, ZERO on a rejection. Eleven production plants across three files, ten RED and one GREEN-by-design, all reverted; `git diff --stat -- extensions/` empty; no production file touched. npm test 5061/5061 across 291 suites, integration 31/31

Last activity: 2026-09-02 — 116-17 moved the import suite from tests/edge/handlers/ to its mirrored path and rewrote it as the phase's one literal exact-argument owner: every delegating case states the COMPLETE options bag (context, Pi handle, working directory, selected scopes, git port) in a strong-mock `when()` with no wildcard matcher. 8 runtime cases from 6 marked bodies; direct coverage branches 11/12, lines and functions complete. THREE findings. First, the plan's move-and-rewrite-in-one-commit rule and its own "git status shows a rename" acceptance criterion are mutually exclusive: a total rewrite shares nothing with the original, so git detects no rename even at -M10%. Split into a pure move (91% similar, rename recorded, tree green) then the rewrite, per the orchestrator's explicit "commit the move so git log --follow keeps the file's history" — --follow now reaches back to f1855ecf, the commit that added the import command. Second, the git-port forward pins the port's MEMBERS, not the container: a `{ ...deps.gitOps }` spread plant stayed GREEN because strong-mock compares the bag structurally, while wrapping one method turned all three delegating cases RED. The header states the narrowed claim. Third, this handler parses raw arguments with parseArgs rather than parseCommandArgs, so unlike all six marketplace siblings it DOES reject a surplus positional — and `--local` is an ordinary token that lands on positional and is rejected there, making the "mutually exclusive scope selectors" case a positional rejection, not a scope diagnostic. A NEW D-116-01a pin: the String(err) arm at edge/handlers/plugin/import.ts:31, COMPILER-FORCED by the unknown-typed catch binding, proved by a plant that stayed GREEN plus a brute force over 3,615 argument strings that produced 521 throws and zero non-Error values, planted in both directions (two assertion-side, three output-side, all five FAIL; control PASS), and filed as WINDOWS.md entry 18. Seven production plants, five RED and two GREEN-by-design, all reverted; no production file touched. Measured baseline correction: npm test was 5049/5049 before this plan, not the 5041 the handoff recorded; it is 5052/5052 now

Last activity: 2026-09-02 — 116-14 rewrote the bootstrap shim owner: 10 runtime cases from 6 marked bodies, direct coverage branches 8/8, functions 2/2, lines 88/88. FOUR findings. First, the injected git port is proven by the clone recorder, and two GREEN plants bound that claim — a re-boxed port AND a port with one member wrapped around a delegating call both stay green, so a recorder-based forward proof is measurably WEAKER than 116-17's structural when() comparison, which goes red on the wrapped member. The claim is stated as "carried out by the injected implementation". Second, this handler calls parseArgs, so like plugin/import.ts and unlike all six marketplace siblings it rejects a surplus positional, has no arity below the accepted zero, and takes --local as an ordinary positional token. Third, the plan's guard-order input (an unrecognised scope value with NO positional) pins no ordering, because the positional guard never applies to it; two inputs that satisfy two guards at once were added instead — `--scope user --local` proves the positional guard precedes the scope guard, `extra --scope nope` proves the parse failure precedes both. Fourth, the branch DENOMINATOR moved from 11/11 to 8/8 while both readings are complete, re-measured in both directions by restoring the HEAD suite: 8 is exactly the structural count (four binary branches times two sides), so T-116-07-B's "a thinner rewrite can drop a branch" did not occur. Four production plants, two RED and two GREEN-by-design, all reverted; no production file touched. npm test 5054/5054 across 291 suites, integration 31/31

Progress: [████████░░] 80%

Two hundred three of 204 source-test pairs are complete. The one that remains is the extension
entry point, which Phase 117 owns.
Retired Phase 106 and 107 artifacts are history only and provide no completion
evidence.

## Performance Metrics

**Velocity:**

- Total plans completed: 152
- Average recorded duration: 11.9 min
- Total recorded execution time: 30 hr 1 min

**By Phase:**

| Phase                           | Plans | Total           | Avg/Plan          |
| ------------------------------- | ----: | --------------- | ----------------- |
| 108. Domain and Platform        |    23 | 10h 58m         | 28.6 min          |
| 109. Shared Contracts           |    19 | 3h 19m          | 10.5 min          |
| 110                             |    12 | -               | -                 |
| 111. Non-Hook Component Bridges |    31 | -               | -                 |
| 112. Hook Runtime               |    31 | 7h 58m          | 15.4 min          |
| 113. Orchestrator Support       |    35 | 7h 46m recorded | 16.6 min recorded |

**Recent Trend:** 35 Phase 113 plans completed with all direct owner, review, validation, verification, security, and clean-repository gates green.
**Per-Plan Metrics:**

| Plan          | Duration | Tasks   | Files   |
| ------------- | -------- | ------- | ------- |
| Phase 116 P19 | 45 min   | 1 tasks | 1 files |
| Phase 116 P15 | 40 min   | 1 tasks | 1 files |
| Phase 116 P14 | 45 min   | 1 tasks | 1 files |
| Phase 108 P01 | 10 min   | 2 tasks | 1 files |
| Phase 108 P06 | 18 min   | 3 tasks | 7 files |
| Phase 108 P08 | 13 min   | 2 tasks | 1 files |
| Phase 108 P09 | 15 min   | 2 tasks | 1 files |
| Phase 108 P10 | 12 min   | 2 tasks | 1 files |
| Phase 108 P11 | 14 min   | 2 tasks | 1 files |
| Phase 108 P13 | 14 min   | 2 tasks | 1 files |
| Phase 108 P14 | 10 min   | 2 tasks | 1 files |
| Phase 108 P15 | 10 min   | 2 tasks | 1 files |
| Phase 108 P16 | 16 min   | 2 tasks | 1 files |
| Phase 108 P17 | 26 min   | 2 tasks | 1 files |
| Phase 108 P19 | 28 min   | 3 tasks | 5 files |
| Phase 108 P20 | 12 min   | 2 tasks | 1 files |
| Phase 108 P18 | 43 min   | 3 tasks | 8 files |
| Phase 108 P21 | 3h 40m   | 3 tasks | 9 files |
| Phase 108 P12 | 27 min   | 3 tasks | 5 files |
| Phase 108 P22 | 42 min   | 3 tasks | 8 files |
| Phase 108 P02 | 20 min   | 3 tasks | 7 files |
| Phase 108 P03 | 19 min   | 3 tasks | 8 files |
| Phase 108 P04 | 22 min   | 3 tasks | 5 files |
| Phase 108 P05 | 20 min   | 3 tasks | 8 files |
| Phase 108 P07 | 27 min   | 3 tasks | 9 files |
| Phase 108 P23 | 20 min   | 3 tasks | 5 files |
| Phase 109 P01 | 7 min    | 2 tasks | 1 files |
| Phase 109 P02 | 10 min   | 2 tasks | 1 files |
| Phase 109 P03 | 12 min   | 2 tasks | 1 files |
| Phase 109 P04 | 7 min    | 2 tasks | 1 files |
| Phase 109 P05 | 5 min    | 2 tasks | 1 files |
| Phase 109 P06 | 7 min    | 2 tasks | 1 files |
| Phase 109 P07 | 16min    | 2 tasks | 1 files |
| Phase 109 P08 | 6min     | 2 tasks | 1 files |
| Phase 109 P09 | 19 min   | 2 tasks | 2 files |
| Phase 109 P10 | 9 min    | 2 tasks | 1 files |
| Phase 109 P11 | 6 min    | 2 tasks | 1 files |
| Phase 109 P12 | 12 min   | 2 tasks | 1 files |
| Phase 109 P13 | 6 min    | 2 tasks | 1 files |
| Phase 109 P14 | 40 min   | 3 tasks | 9 files |
| Phase 109 P15 | 6 min    | 2 tasks | 1 files |
| Phase 109 P16 | 9 min    | 2 tasks | 1 files |
| Phase 109 P17 | 11 min   | 2 tasks | 1 files |
| Phase 109 P18 | 4 min    | 2 tasks | 1 files |
| Phase 109 P19 | 7 min    | 2 tasks | 1 files |
| Phase 110 P02 | 11 min   | 2 tasks | 1 files |
| Phase 110 P06 | 7 min    | 2 tasks | 1 files |
| Phase 110 P11 | 7 min    | 2 tasks | 1 files |
| Phase 110 P01 | 8min     | 2 tasks | 1 files |
| Phase 110 P03 | 11 min   | 2 tasks | 1 files |
| Phase 110 P05 | 10 min   | 2 tasks | 1 files |
| Phase 110 P08 | 10min    | 2 tasks | 2 files |
| Phase 110 P10 | 9 min    | 2 tasks | 1 files |
| Phase 110 P04 | 11 min   | 2 tasks | 1 files |
| Phase 110 P07 | 16 min   | 2 tasks | 2 files |
| Phase 110 P09 | 19 min   | 2 tasks | 3 files |
| Phase 110 P12 | 17 min   | 2 tasks | 1 files |
| Phase 111 P01 | 14 min   | 2 tasks | 2 files |
| Phase 111 P02 | 10 min   | 2 tasks | 1 files |
| Phase 112 P01 | 14 min   | 2 tasks | 1 files |
| Phase 112 P03 | 9 min    | 2 tasks | 1 files |
| Phase 112 P08 | 8 min    | 2 tasks | 1 files |
| Phase 112 P09 | 9 min    | 2 tasks | 1 files |
| Phase 112 P10 | 14 min   | 2 tasks | 1 files |
| Phase 112 P12 | 12 min   | 2 tasks | 1 files |
| Phase 112 P15 | 6 min    | 2 tasks | 1 files |
| Phase 112 P16 | 7 min    | 2 tasks | 1 files |
| Phase 112 P17 | 7 min    | 2 tasks | 1 files |
| Phase 112 P18 | 3 min    | 2 tasks | 1 files |
| Phase 112 P19 | 5 min    | 2 tasks | 1 files |
| Phase 112 P20 | 5 min    | 2 tasks | 1 files |
| Phase 112 P21 | 8 min    | 2 tasks | 1 files |
| Phase 112 P22 | 20 min   | 2 tasks | 1 files |
| Phase 112 P23 | 10 min   | 2 tasks | 1 files |
| Phase 112 P24 | 10 min   | 2 tasks | 1 files |
| Phase 112 P27 | 19 min   | 2 tasks | 1 files |
| Phase 112 P28 | 28 min   | 2 tasks | 3 files |
| Phase 112 P29 | 13 min   | 2 tasks | 1 files |
| Phase 112 P30 | 17 min   | 2 tasks | 1 files |
| Phase 112 P31 | 17 min   | 2 tasks | 1 files |
| Phase 112 P11 | 14 min   | 2 tasks | 2 files |
| Phase 112 P13 | 20 min   | 2 tasks | 2 files |
| Phase 112 P25 | 12 min   | 2 tasks | 1 files |
| Phase 112 P02 | 45 min   | 2 tasks | 3 files |
| Phase 112 P06 | 26 min   | 2 tasks | 3 files |
| Phase 112 P04 | 33 min   | 2 tasks | 3 files |
| Phase 112 P05 | 18 min   | 2 tasks | 2 files |
| Phase 112 P26 | 19 min   | 2 tasks | 2 files |
| Phase 112 P07 | 34 min   | 2 tasks | 3 files |
| Phase 112 P14 | 16 min   | 2 tasks | 1 file  |
| Phase 115 P02 | 96 min | 3 tasks | 2 files |
| Phase 115 P05 | 90min | 3 tasks | 5 files |
| Phase 116 P00 | 35 min | 2 tasks | 5 files |
| Phase 116 P01 | 25 min | 1 tasks | 1 files |
| Phase 116 P02 | 20 min | 1 tasks | 1 files |
| Phase 116 P04 | 25 min | 1 tasks | 1 files |
| Phase 116 P06 | 65 min | 1 tasks | 3 files |
| Phase 116 P30 | 40 min | 1 tasks | 1 files |
| Phase 116 P12 | 45 min | 1 tasks | 1 files |
| Phase 116 P23 | 50 min | 1 tasks | 1 files |
| Phase 116 P26 | 45 min | 1 tasks | 1 files |
| Phase 116 P27 | 70 min | 2 tasks | 2 files |
| Phase 116 P29 | 20 min | 1 tasks | 1 files |
| Phase 116 P03 | 45 min | 1 tasks | 1 files |
| Phase 116 P10 | 45 min | 1 tasks | 1 files |
| Phase 116 P13 | 50 min | 1 tasks | 1 files |
| Phase 116 P07 | 35 min | 1 tasks | 1 files |
| Phase 116 P11 | 35 min | 1 tasks | 1 files |
| Phase 116 P05 | 30 min | 1 tasks | 1 files |
| Phase 116 P17 | 40 min | 2 tasks | 1 files |
| Phase 116 P28 | 30 min | 1 tasks | 1 files |
| Phase 117 P01 | 11 min | 1 tasks | 1 files |
| Phase 117 P02 | 15 min | 2 tasks | 10 files |
| Phase 117 P03 | 16 min | 1 tasks | 27 files |
| Phase 117 P04 | 22 min | 2 tasks | 2 files |
| Phase 117 P05 | 9 min | 1 tasks | 2 files |
| Phase 117 P06 | 13 min | 1 tasks | 2 files |
| Phase 117 P07 | 28 min | 2 tasks | 17 files |
| Phase 117 P08 | 22 min | 2 tasks | 4 files |
| Phase 117 P09 | 13 min | 1 tasks | 2 files |

## Accumulated Context

### Decisions

Decisions are logged in the PROJECT.md Key Decisions table.

- Each executable plan and implementation commit owns one source-test pair.
- Runtime tests use separate lowercase `// arrange`, `// act`, and `// assert` phases.
- Lowercase `// act & assert` is reserved for one `assert.throws()` or `assert.rejects()` expression.
- Type-only evidence stays module-scoped and uses `satisfies` or `@ts-expect-error` without fake runtime phases.
- Retained commits and HEAD triage labels do not close a pair.
- [Phase 110]: Kept agents-index-schema.ts byte-identical because its compiled validators expose the complete public contract.
- [Phase 110]: Agents-index schema evidence uses independent literals plus module-scope satisfies and targeted @ts-expect-error checks.
- [Phase 110]: Kept locations.ts byte-identical because its public seams expose the complete contract.
- [Phase 110]: Locations evidence uses complete bundles and adjacent safe-path probes with platform-aware separators.
- [Phase 110]: Kept rollback.ts byte-identical because its public formatter exposes every bypass and wrapping branch.
- [Phase 110]: Rollback evidence compares whole structured results before pinning original cause and raw partial identities.
- [Phase 110]: Kept agents-index-io.ts byte-identical because its public load and save functions expose every real branch.
- [Phase 110]: Agents-index I/O evidence uses case-owned literal documents, complete loaded values, structured failures, and exact stored bytes.
- [Phase 110]: Kept config-io.ts byte-identical because its public loader, validator, predicate, and saver expose every real branch.
- [Phase 110]: Config I/O evidence uses independent literal documents, complete load results, and unchanged bytes across validation and containment failures.
- [Phase 110]: Kept config-write-back.ts byte-identical because its five public operations expose every real write-back branch.
- [Phase 110]: Config write-back evidence uses independent complete JSON bytes for patches, deletes, cascades, omitted batch arms, and absent-entry creation.
- [Phase 110]: Refined MigrationResult.marketplaces to object-valued rows while preserving migration runtime logic and exports.
- [Phase 110]: Kept invalid plugin rows unfilled so the downstream state schema remains the rejection boundary instead of silently coercing corrupt values.
- [Phase 110]: Migration evidence uses complete independent results, exact fixed-point replay, and complete warning and filesystem effects.
- [Phase 110]: Kept phase-ledger.ts byte-identical because runPhases exposes every compensation and error branch through its public contract.
- [Phase 110]: Phase-ledger evidence uses the literal skills, commands, agents, hooks, mcp, state order with complete logs, results, causes, leaks, and final context.
- [Phase 110]: Kept config-merge.ts byte-identical because its two public functions expose every real merge and load branch.
- [Phase 110]: Used independent complete reducer values and all nine base/local status pairs to keep provenance and fallback behavior explicit.
- [Phase 110]: Narrowed buildConfigFromState with an inline intersection return type so existing exports stay unchanged while marketplace and plugin records become statically present.
- [Phase 110]: Removed only the redundant entry-count fallbacks and left migration runtime ordering, stored bytes, and result arms unchanged.
- [Phase 110]: Used independent complete state and config values plus exact bytes and metadata to prove first-run replay without sleeps or shared fixtures.
- [Phase 110]: Removed the redundant post-migration marketplace guard and assertion because Plan 110-08 guarantees object-valued MigrationResult rows.
- [Phase 110]: State migration persistence uses a pre-registered case-local filesystem watcher and exact file metadata to prove no-write replay without sleeps or polling.
- [Phase 110]: Kept with-state-guard.ts byte-identical because its public state operations and lockfile collaborator expose every real lifecycle branch.
- [Phase 110]: Used entered and release promises to prove real lock contention without sleeps, polling, elapsed-time checks, or platform skips.
- [Phase 110]: Used the existing loadState and saveState dependency seam for deterministic persistence failures and case-local proper-lockfile method restoration for acquisition and release failures.
- [Phase 111]: Every mirrored owner uses complete case-local inputs and independent expected outcomes; shared fixtures were removed after their last legitimate consumer.
- [Phase 111]: Supplemental suites remain only for genuine cross-module behavior, and all 31 direct owner gates pass at complete line, branch, and function coverage.
- [Phase 111]: MCP provenance markers require own outer and identity properties, rejecting inherited marker, plugin, and marketplace values.
- [Phase 111]: Two provably unreachable private skills-stage fallbacks were removed without adding a test-only seam, export, pragma, or behavior change.
- [Phase 112]: Kept pid-table.ts byte-for-byte unchanged and covered every branch through its public filesystem contract.
- [Phase 112]: Used a case-owned _shared regular-file boundary for deterministic filesystem failures without a test seam.
- [Phase 112]: Kept ring-buffer.ts byte-for-byte unchanged and proved every byte boundary through its public API.
- [Phase 112]: RingBuffer evidence uses fresh case-local byte inputs and independent complete text/truncation outcomes.
- [Phase 112]: Kept exec-result.ts byte-for-byte unchanged because its exported type and assertNever function expose the complete contract.
- [Phase 112]: Kept all HookExecResult positive and negative type evidence at module scope, with runtime execution only for assertNever.
- [Phase 112]: Proved allow, deny, and ask inline without introducing a new permission type export.
- [Phase 112]: Kept exec-timer.ts byte-for-byte unchanged because its public timer ladder exposes every scheduling branch.
- [Phase 112]: Observed exact handles, unref calls, clears, and pending state through the current TestContext fake timers only.
- [Phase 112]: Kept hook-env.ts byte-for-byte unchanged because prepareHookEnv exposes every environment branch through its public contract.
- [Phase 112]: Hook environment evidence preserves inherited-key non-interference while proving case-local remote-key absence and exact process restoration.
- [Phase 112]: Kept glob.ts byte-for-byte unchanged because its public compiled Bash and path objects expose every matching and defensive branch.
- [Phase 112]: Glob owner evidence uses complete independent metadata and named outcome maps for command boundaries, six anchors, normalization, containment, and globstar behavior.
- [Phase 112]: Covered defensive sparse and unknown compiled metadata through exported objects with Reflect, without casts, test seams, or production surface changes.
- [Phase 112]: Kept post-compact.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: Replaced the incomplete double assertion with complete SessionCompactEvent values checked by satisfies.
- [Phase 112]: Treated empty strings as valid context values and did not fabricate an out-of-contract null case.
- [Phase 112]: Kept post-tool-use-failure.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: PostToolUseFailure owner evidence uses complete ToolResultEvent values, independent whole envelopes, and nested identity and non-mutation assertions.
- [Phase 112]: Kept malformed process output in Plan 112-04 and left the translator supplemental suite unchanged.
- [Phase 112]: Kept post-tool-use.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: Replaced PostToolUse double assertions and shared context with complete case-local values checked by satisfies.
- [Phase 112]: Kept malformed PostToolUse process output in Plan 112-04 and left the translator supplemental suite unchanged.
- [Phase 112]: Kept pre-compact.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: Replaced the PreCompact double assertion and shared context with complete case-local values checked by satisfies.
- [Phase 112]: Treated empty strings as valid PreCompact context values and did not add an unsupported null context case.
- [Phase 112]: Kept pre-tool-use.ts byte-for-byte unchanged because translate exposes the complete payload contract.
- [Phase 112]: PreToolUse evidence uses independent built-in and custom six-key envelopes with nested identity and non-mutation checks.
- [Phase 112]: Kept malformed PreToolUse input in Plan 112-04 and left the translator supplemental suite unchanged.
- [Phase 112]: Kept session-end.ts byte-for-byte unchanged because translate exposes the complete SessionEnd payload contract through its public signature.
- [Phase 112]: Used one explicit case per shutdown reason plus a dedicated empty-context case, with input-only target session files omitted from exact five-key envelopes.
- [Phase 112]: Kept malformed SessionEnd input in Plan 112-04 and left the supplemental translator suite unchanged.
- [Phase 112]: Kept session-start.ts byte-for-byte unchanged because translate exposes the complete payload contract through its public signature.
- [Phase 112]: SessionStart evidence uses independent whole envelopes for every source branch and accepted empty context values.
- [Phase 112]: Kept stop-failure.ts byte-for-byte unchanged because its public translator and classifier expose the complete contract.
- [Phase 112]: Used explicit sibling cases for classifier precedence and status partitions instead of a shared table or test seam.
- [Phase 112]: Kept object and cause wrapping in Plan 112-27 instead of expanding the StopFailure owner scope.
- [Phase 112]: Kept stop.ts byte-for-byte unchanged because its public translator exposes the complete contract.
- [Phase 112]: Used separate case-local values and whole six-key expectations for active, inactive, and empty-text Stop partitions.
- [Phase 112]: Kept Stop re-entry and observer behavior in Plan 112-26 instead of widening the direct payload owner.
- [Phase 112]: Kept user-prompt-submit.ts byte-for-byte unchanged because its public translator exposes the complete contract.
- [Phase 112]: UserPromptSubmit evidence uses separate case-local values and whole five-key expectations for ordinary, multi-line, empty, and multi-byte prompts.
- [Phase 112]: Kept malformed process-output behavior in Plan 112-04 instead of widening the direct payload owner.
- [Phase 112]: Preserved spawn planning while the security gate strengthened oversized serialization to a strict final 256 KiB UTF-8 bound.
- [Phase 112]: Treated defined args, including an empty array, as exec form with shell disabled; absent args retain shell-form behavior.
- [Phase 112]: Made the truncation marker authoritative without mutating object, primitive, or array inputs and bounded the final UTF-8 output, including metadata, to 256 KiB.
- [Phase 112]: Removed only the private stage stack-pop undefined guard after live CodeGraph proof established that its guarded state is unreachable.
- [Phase 112]: Retained readSymlinkTargetSafe as a reachable TOCTOU defense and proved it through restored Node filesystem bindings without a production seam.
- [Phase 112]: Absorbed the symlink supplemental's unique containment evidence into the stage owner before deleting the duplicate carrier.
- [Phase 112]: Kept timeout.ts byte-for-byte unchanged because resolveTimeoutSeconds exposes every validation, default, and diagnostic branch through its public contract.
- [Phase 112]: Preserved every finite positive value exactly, including fractional and large values, while rejecting zero, negative, nonnumeric, and nonfinite declarations.
- [Phase 112]: Kept scheduling, timer clamping, cancellation, and races in Plan 112-09 instead of widening this pure validation owner.
- [Phase 112]: Kept translation-context.ts byte-for-byte unchanged because buildTranslationContext exposes the complete snapshot and fallback contract through its public result.
- [Phase 112]: Used real case-owned file-backed and in-memory SessionManager instances with independently authored whole-context expectations.
- [Phase 112]: Kept translation-context readonly evidence at module scope and preserved its internal-only barrel scope.
- [Phase 112]: Kept wire-protocol.ts byte-for-byte unchanged because parseHookStdout exposes every live exit, JSON-shape, precedence, mutation, and no-op branch through its public result.
- [Phase 112]: Proved semantic diagnostics by category, hook destination, relevant detail, and outcome while separately asserting that reporting never throws.
- [Phase 112]: Kept every wire case independent and explicit instead of generalizing the mutation contract through a table or shared oracle.
- [Phase 112]: Restored documented stable first-seen Bash candidate deduplication with only a Set spread after direct evidence exposed the missing behavior. — The Rule 1 fix satisfies the public contract without adding an export, symbol, seam, helper, or parser restructuring.
- [Phase 112]: Bash if-field evidence uses complete literal commands and independently authored ordered results without invoking a shell. — Direct parser and matcher calls prove syntax, wrapper, recursion, fail-open, and specificity behavior without executing untrusted command text.
- [Phase 112]: Left the hooks-if-field supplemental file unchanged so Plan 112-13 remains its only final carrier. — The Bash owner absorbs the unique leaf evidence while avoiding a competing shared-file edit.
- [Phase 112]: Kept if-field/index.ts byte-for-byte unchanged because its public composition exports expose every required compile and evaluation partition.
- [Phase 112]: Retained only the unique parseHooksConfig side-map-to-RoutingEntry chain, including exact predicate object identity and declaration order.
- [Phase 112]: Kept the exact five predicate arms and all re-export evidence module-scoped without widening production metadata or adding a test seam.
- [Phase 112]: Kept routing-state.ts byte-for-byte unchanged because its public operations expose every required state transition and reset effect.
- [Phase 112]: Used only public lifecycle operations for routing-state setup, observation, and cleanup, without a private-state reader or test-only reset export.
- [Phase 112]: Left the additional-context supplemental unchanged because Plan 112-07 is its sole deletion carrier and Plan 112-13 owns the unique parser chain.
- [Phase 112]: Removed the two CodeGraph-confirmed registry test readers and obsolete promise-tracking cell without adding another observer or test seam.
- [Phase 112]: Retained fire-and-forget PID persistence on async child exit and error, observing rewrites through public filesystem and shutdown effects.
- [Phase 112]: Restricted the async-rewake supplemental to two cross-lane environment-parity cases and one routing-epoch reload case.
- [Phase 112]: Proved default orphan probes behind a mocked process.kill signal-0 boundary and used injected probes for all orphan safety partitions.
- [Phase 112]: Removed the legacy adaptObservationResult export after CodeGraph and historical call-site proof found no production caller.
- [Phase 112]: Consolidated every direct adapter contract and the duplicate architecture suite into the mirrored event-adapters owner.
- [Phase 112]: Left the mixed SessionStart additional-context supplemental unchanged for Plan 112-07 to remove after dependent evidence is absorbed.
- [Phase 112]: Kept dispatch-exec.ts byte-for-byte unchanged because dispatchHookExec exposes the complete process, stream, stdin, timer, parse, and delegation contract.
- [Phase 112]: Used synchronous child stdin and direct stdout/stderr descriptor writes to remove the portable fixture fast-exit race without sleeps or production changes.
- [Phase 112]: Consolidated all single-module execution evidence in the dispatch-exec owner and deleted hooks-exec.test.ts.
- [Phase 112]: Retained only translator-module completeness and shared built-in/custom tool-name mapping in hooks-translators.test.ts.
- [Phase 112]: Used a live failing diagnostic sink to prove the outer async delegation catch while preserving never-throw noop behavior.
- [Phase 112]: Kept dispatch.ts byte-for-byte unchanged because its public collection and composite-handler exports expose every reducer and adaptation partition through an injected executor.
- [Phase 112]: Consolidated all single-module reducer evidence in the mirrored dispatch owner, then deleted hooks-reducer.test.ts.
- [Phase 112]: Kept hooks-dispatch.test.ts byte-for-byte unchanged as the locked repository-wide static carrier for Plan 112-07.
- [Phase 112]: Used only public routing lifecycle operations for case-local state setup and cleanup, without a private state reader, reset seam, or shared oracle.
- [Phase 112]: Removed settleCacheSnapshot and loopProtectionState after live CodeGraph proof showed no production callers, without adding a replacement introspection seam.
- [Phase 112]: Proved settle state only through public lifecycle handlers, executor events, sent messages, notifications, and fresh follow-up calls.
- [Phase 112]: Kept StopFailure observation-only: matching noop, block, mutate, and stop results run in declaration order and are all discarded.
- [Phase 112]: Alphabetized inventories and presentation expectations while preserving exact production declaration and registration order where order is contractual.
- [Phase 112]: Kept event-router.ts byte-for-byte unchanged because its public cache, hydration, rebuild, handler, and registration operations expose the complete lifecycle contract.
- [Phase 112]: Split in-memory and persisted child fixtures across user and project cleanup surfaces so exit persistence cannot race the orphan tracer.
- [Phase 112]: Alphabetized the hook-barrel runtime identity and compiler-negative inventories while leaving production export declarations unchanged.
- [Phase 113]: Completed all 35 mirrored owners; 33 executable sources reached 971/971 branches, 216/216 functions, and 7,941/7,941 lines, while both type-only owners passed compiler contracts.
- [Phase 113]: Kept runtime tests on separate lowercase `// arrange`, `// act`, and `// assert` phases and kept presentation-only inventories alphabetical.
- [Phase 113]: Preserved caller, scope, reason, and lifecycle order wherever sequence carries behavior.
- [Phase 113]: Proved presenter structure and exact rendered bytes, including severity, dependency, omission, tally, trailer, and reload partitions.
- [Phase 113]: Proved classifiers, discovery, clone helpers, probes, scope fan-out, import planning, and reconcile planning through complete case-local values.
- [Phase 113]: Kept read-only support paths offline through fail-fast fakes and architecture prohibitions; all mutable state and collaborators are case-owned.
- [Phase 113]: Absorbed single-module evidence into mirrored owners and removed seven redundant supplemental suites without losing their unique contracts.
- [Phase 113]: Removed one unreachable closed-union presenter default instead of fabricating an impossible test value.
- [Phase 113]: Restored shipped barrel and interface exports after review showed aggregate dead-code cleanup had narrowed public contracts.
- [Phase 113]: Replaced passive-value mocks and every broad `anyTimes()` expectation with fresh typed data and exact, explicitly verified interaction doubles.
- [Phase 115]: Removed five structurally unreachable arms from the import cascade after a caller trace, narrowing two private types so a wrong token is a compile error rather than a runtime signal.
- [Phase 115]: Deleted the last c8 ignore in the extensions tree by running the entrypoint twice with no dependency bundle, so the production default state loader's own answer is what changes the second outcome.
- [Phase 115]: A defensive guard can be reached and still not be discriminating; the repair builder's undeclared-source guard is redundant with the already-declared merge check and is reported rather than removed.
- [Phase 115]: D-115-10 delivered: the three reconcile producers carry the mode-discriminated overload, so a dropped cascade row is a gate failure rather than a silent continue.
- [Phase 115]: Removed the marketplace-add, plugin-install and plugin-toggle catch clauses as unreachable; kept and proved the removal and uninstall clauses with a competing-writer race.
- [Phase 115]: Deleted all eight source-text pins outright; none encoded a rule that is not already gated by its own owner, so nothing was re-homed under tests/architecture/.
- [Phase 116]: strong-mock times(0) is inert, so the notification boundary omits the expectation entirely when a count is 0
- [Phase 116]: The args-schema owner records onError with a plain closure asserted as a whole array, never as an interaction mock — The module promise is its return value; a declared callback parameter is not a port, so its call count proves nothing the result does not
- [Phase 116]: The tokenizer-failure cases declare a required positional the input satisfies, so an undefined result can only mean the early return fired — It proves the short-circuit through the public result instead of observing an internal call, and a plant that removed the short-circuit turned all three cases RED
- [Phase 116]: The direct-coverage branch denominator is a property of the suite, not of the source: edge/args.ts measures branches 28/29 under its rewritten owner where it measured 25/26 under the old one, with the same single uncovered branch — V8 emits a block range only when that block's execution count diverges from the enclosing range, so a guard whose false arm is never taken is collapsed and never enters the lcov denominator at all. Covering the false arm raises BRH and BRF together. Diffing BRDA records between the two suites over the same source shows three new ranges (args.ts:46, :75, :84) and no lost ones. Consequence: a full-line coverage verdict pin cannot be authored before the rewrite that strengthens the suite. D-116-01a's recorded number for edge/args.ts is superseded by measurement and the three other claimants (116-26, 116-21, 116-17) carry the same exposure. Operator ratification required; nothing was edited.
- [Phase 116]: 116-06: deleted the unreachable optional-description branch in completionFlagEntries by making FlagEntry.description required, rather than adding a coverage exception; the exported return type is unchanged
- [Phase 116]: 116-06: where an architecture gate already pins a data table exactly, the mirrored owner proves the derivation shape (filter, order, key presence, exclusion) and asserts nothing about the table contents
- [Phase 116]: 116-30: the type-only owner pins EdgeDeps required-versus-optional split only; enumerating the member set or asserting the export surface would restate what the compiler and fallow dead-code already enforce
- [Phase 116]: 116-30: a clean tsc is itself proof that every ts-expect-error in a file binds, because an unattached directive raises TS2578; the moved-marker plant showed the multi-line satisfies diagnostic landing on the closing line
- [Phase 116]: The closed-over-API case builds two distinct Pi values instead of one shared value: a same-instance case only repeats the delegation case and cannot discriminate.
- [Phase 116]: 116-23: a double for a generic export derives from an instantiation-expression type query (Parameters<typeof fn<Chosen>>[N]); the uninstantiated form collapses the type parameter to unknown and loses the exact-argument match
- [Phase 116]: 116-23: input tokens that the module under test derives from another module are hand-authored literals, not read back from that module; feeding the derivation back in is tautological and cannot fail
- [Phase 116]: 116-26: a whitespace row set must separate the two claims it looks like one of — dropping empty tokens and splitting on a whitespace CLASS are independent, and a spaces-only row pins neither because /\s+/ is greedy
- [Phase 116]: 116-26: a D-116-01a pair pins the shortfall identity (one uncovered branch, the exact uncovered line set) and records the measured branch numbers as an observation; the denominator tracks suite strength, so a number pin cannot be authored before the rewrite it gates
- [Phase 116]: 116-27: all four tools.ts switches are gated — three by TS2366 because their return type excludes undefined, and the version reader by TS7030 because noImplicitReturns makes the end of a default-less switch reachable once an arm goes missing; research's "compiles clean" premise is disproved
- [Phase 116]: 116-27: an unreachable switch arm is removed by giving the function its producer's row union, derived from the producer's return type rather than named or hand-excluded; re-adding a removed arm raises TS2678, which is the control that proves the removal was forced
- [Phase 116]: 116-27: a defensive narrowing copied from a shared helper is a branch the local pair can never reach; calling the helper removes it without a cast, a behavior change, or a coverage exception
- [Phase 116]: 116-27: a mock for a generic method restates that member as a property, because reading a method as a value is an unbound-method lint error; the shared notification boundary cannot serve a registerTool capture for that reason
- [Phase 116]: 116-29: the two subcommand vocabularies deliberately overlap on list, ls, info and update, so "no marketplace name is also handled by the top level" is false; the anti-shadowing promise is carried instead by proving the shared token reaches a different handler member per dispatch
- [Phase 116]: 116-29: alias identity is one case with one expectation at a definite count of 2, driven once by the alias and once by the canonical name; two separate cases prove two dispatches, not one identity
- [Phase 116]: 116-29: a "no duplicate entries" claim cannot be written by deduplicating the exported constant and comparing it back — that is an expectation transformed from an actual; comparing the export against the hand-authored row table that serves it catches the same defect
- [Phase 116]: 116-24: a destructive seamless verb is owned through its FOOTPRINT — every case, rejections included, compares the surviving install records of both scope roots as one whole value beside the notification; a notification-only proof of an uninstall passes while proving nothing about whether state changed
- [Phase 116]: 116-24: `parseCommandArgs` with ONE REQUIRED positional rejects zero but DROPS a surplus, because it iterates the schema rather than the input; the arity truth's lower half holds and its surplus half does not
- [Phase 116]: 116-24: `uninstallPlugin` reads `opts.local` only to pick the CFG-03 precondition target and then sweeps BOTH config layers unconditionally, so the scope-target flag is invisible in the message AND in the footprint on a healthy workspace; the discriminating fixture is an override layer that FAILS SCHEMA VALIDATION, where supplying the flag aborts the command and omitting it completes it
- [Phase 116]: 116-24: one Group-C plant can yield three distinct frames on a single module when the scope selection is what reaches `locationsFor` — a user-scope call never calls `path.join`, so it runs to completion and is caught by the emission count instead of by an ERR_INVALID_ARG_TYPE
- [Phase 116]: 116-24: an offline zero needs BOTH reachability questions answered; where the module can reach no transport at all, the zero is an NFR-5 regression guard with neither a positive control nor a reachable input, and must be labelled as one rather than presented as a measurement
- [Phase 116]: 116-03: the `--partial` option is not an install/update-only narrowing — it SHIFTS the install candidate set (drops `remote`, admits `partially-available`) and narrows uninstall, reinstall, enable and disable identically to update, because it is threaded into the same shared installed-inventory helper
- [Phase 116]: 116-03: `tests/architecture/scope-order-drift.test.ts` walks `extensions/` only, so a hand-authored scope literal in a test file is not gated; four existing test files already carry one
- [Phase 116]: 116-03: a counter exposed on a returned interface must be declared `readonly f: () => number`, not `f(): number` — a method signature makes every destructuring site an unbound-method lint error even though the value is a closure
- [Phase 116]: 116-03: `data.ts:188`'s `allTokens.at(-1) ?? ""` fallback is a fifth D-116-01a-class unreachable branch, outside the four-claimant list; proved unreachable by construction, by a 65,536-code-point probe, and by a plant that stayed green, and left at 109/110 rather than pinned or excepted
- [Phase 116]: 116-10: an EMPTY positional schema does not reject a surplus token — `parseCommandArgs` iterates the SCHEMA, not the input, so every extra token is dropped and the handler still delegates; the phase-wide `must_haves` truth that both out-of-range arities are "rejected with a usage error" is false for a zero-positional handler
- [Phase 116]: 116-10: `marketplace/list.ts` never calls `extractLocalFlag`, so the scope-target flag reaches the tokenizer as a positional and is swallowed; supplying it beside `--scope` is accepted, not rejected, and the phase-wide mutually-exclusive-selectors truth has no target on this handler
- [Phase 116]: 116-10: the Group-C negative fires on the FIRST unstated boundary read, not on the emission count — a handler that forwards `ctx.cwd` dies in `path.join` on strong-mock's pending-call proxy before it can emit, so the G5 excerpt's stated "second `ctx.ui` access past its `times(1)` count" mechanism is only the fallback for handlers that read no `cwd`
- [Phase 116]: 116-10: a Group-C rejecting case seeds BOTH scopes so the workflow it must not reach would have rows to emit; an unseeded tree makes the negative weaker because the unreached workflow would emit only the empty-state sentinel
- [Phase 116]: The marketplace update handler's usage-string collapse arm is unreachable through its exports, so the pair stands at branches 11/12 and the shortfall is reported, not pinned or excepted — parseCommandArgs passes the usage string to the callback only for a REQUIRED positional; this schema declares its sole positional optional. Proven by construction, by a 170-shape brute force, by a plant that stayed GREEN, and by an inverted-condition plant that went RED. 116-13 is not a D-116-01a claimant and both production licences are spent, so the reversible default applies. Identity: BRDA:41,11,0,0 in the pair's own lcov.
- [Phase 116]: An injected port forwarded from two call sites needs one plant per site; a single-site plant leaves the sibling arm's claim unproven — Removing the all-marketplaces arm's pluginUpdate forward left both named-marketplace rows GREEN; removing the single-marketplace arm's forward left the bare and scope-narrowed cases GREEN. Applies to 116-07, 116-14 and 116-17, the remaining injected-port owners.
- [Phase 116]: 116-07: the marketplace add owner proves the injected git port by driving a url source on a provider-less host and comparing the whole clone recorder, with the randomUUID staging leaf replaced by a token only under the expected scope root
- [Phase 116]: 116-07: scope and the scope-target flag are proven as an on-disk footprint (which scope root holds state.json, and whether the write-back landed in claude-plugins.json or claude-plugins.local.json) because the edge tier has no injection point against the options bag
- [Phase 116]: 116-14: a RECORDER-based port-forward proof is weaker than a structural exact-argument `when()` — a re-boxed port AND a port with one member wrapped around a delegating call both stay GREEN under a recorder, while 116-17's `when()` goes RED on the wrapped member; only replacing the implementation goes RED under both, so the claim states that the operation is carried out by the injected implementation
- [Phase 116]: 116-14: a guard order is only pinnable with an input that satisfies TWO guards at once — the plan's unrecognised-scope-with-no-positional input passes under any order, while `--scope user --local` proves the positional guard precedes the scope guard and `extra --scope nope` proves the parse failure precedes both
- [Phase 116]: 116-14: `plugin/bootstrap.ts` calls `parseArgs`, the second handler measured to do so, and answers all three inherited questions like `plugin/import.ts` rather than like the marketplace tier — a surplus positional IS rejected, there is no arity below the accepted zero, and `--local` lands on positional
- [Phase 116]: 116-14: a github-source workflow cannot be driven through a bare `createGitOpsFake` — the GitHub provider attaches a credential bundle whose functions are not structured-clonable and the fake's recorder clones every call, so the port must drop that downstream-owned bundle while still delegating every operation to the fake
- [Phase 117]: The unit-suite glob control lands before the amendment it guards, so the later glob change must turn it RED and back GREEN rather than tune it to agree
- [Phase 117]: 117-02: a support-module relocation ships as ONE commit carrying the `git mv` and its consumer import rewrites — a pure-move commit leaves the consumers importing a path that no longer exists, so it cannot typecheck, and git still reports the rename at 96 to 98 percent
- [Phase 117]: 117-02: ESLint and Prettier disagree on the shape of a shortened import — `eslint --fix` split the two integration children's import onto four lines and `prettier --check` then failed, because the shorter sibling specifier let the statement fit one 94-character line; run both, never either alone
- [Phase 117]: 117-03: shortening an import specifier re-sorts it INSIDE the parent group, not only across groups — the boundary move reddened `import-x/order` in six suites where the plan predicted two, so the ordering must be read off ESLint rather than reasoned about
- [Phase 117]: 117-03: a 100 percent rename reading is only evidence once the consumer edits are confirmed staged — the identical number was false in 117-02, produced by an aborted `git add`, so cross-check it against `md5sum` and `git log --follow`
- [Phase 117]: D-117-04a: both orphan supplements relocate to tests/architecture/ rather than fold into a mirrored owner, because each spans several production modules and none of them owns it — The correspondence gate exempts the architecture root structurally (nonCorrespondingRoots), so the relocation needed no gate change and no exemption entry -- which is what keeps the SUITE-04 ban on name-keyed opt-outs intact
- [Phase 117]: D-117-04b: each move is one commit carrying the move plus its specifier fix, not a move commit and a rewrite commit — A pure-move commit would leave the reason-parity suite importing a path one level too deep, so it would not typecheck; git still recorded the rename at 95 percent, and the materialization-gate move at 100 percent
- [Phase 117]: The device-flow prompt supplement folds into tests/domain/github-auth.test.ts as one case, not two: its ordering case restated the owner existing reports-denied-authorization row, so the surviving case pins the catalog byte form on the denied poll and carries both claims at once.
- [Phase 117]: The folded case builds its transport with createDeviceFlowFake while the credential and notify ports stay strong-mocks, because the house role table makes notifying a mock and a third copy of the owner mock-DeviceFlowHttp arrange block would have risked the fallow dupes threshold of 3.
- [Phase 117]: 117-06: plant at the granularity the case claims — deleting the whole production step fails the case on its returned outcome, so it cannot prove an on-disk read is load-bearing — The plan's literal plant removed the cascade's hooks slot and the merged case failed on dropped.hooks, not on the readdir; deleting only the rm inside removeHookConfig left the outcome correct and failed exactly one case in the suite, on the disk read
- [Phase 117]: The seed's own three production specifiers gained a climb because its new home is one directory deeper; no consumer rewrite reveals that, only reading the module does.
- [Phase 117]: The helpers glob alternative was removed for honesty, not function: both globs match the same 248 paths with and without it, and the 117-01 completeness control is the independent proof.
- [Phase 117]: Shortening an import specifier re-sorts it inside the parent group with no predictable direction: 13 handler suites moved a line, the mirror image of 117-03's effect.
- [Phase 117]: The extension entry pair asserts two notifications for an unreadable install state, not one: the reconcile renders its own failure cascade for the same file before the plugin-PATH warning, and the legacy filtered assertion concealed it. — Measured on this tree; the whole two-element notification list is now compared.
- [Phase 117]: Both entry-pair fixtures use a schema violation rather than a syntax error, because the reconcile renders the runtime JSON parser text into a user-visible message and that text is not part of any contract. — Keeps the whole-value cascade comparisons stable across Node versions; this tree runs v26.7.0 while CI pins 24.
- [Phase 117]: Barrel-proxy ownership is named as its own gate verdict, proxy-owned, split from wrong-import and decided from the import graph the gate already builds. — D-117-21 gives the verdict its spelling; the split needs no name list, registry or exemption entry, and both sides are planted in the control.

### Pending Todos

None for roadmap creation.

### Blockers/Concerns

- Phase 117 must measure the Node 24 all-pair duration before adding concurrency.
- `gsd-tools query phase.complete` cannot write the root planning files while
  workstream mode is active, and neither existing workstream holds v1.19 —
  `defaults-enabled` is a finished milestone at phase 105 and `milestone` is v1.18
  at phase 100. Phase 114's ROADMAP and STATE transition was therefore applied by
  hand. Phases 115 through 117 and milestone close will hit the same wall until the
  stale workstream directories are retired or v1.19 is given its own workstream.

## Deferred Items

| Category | Item | Status | Deferred At | Milestone |
| -------- | ---- | ------ | ----------- | --------- |
| Tooling | Detect unused code and unused type members — no gate reports a type member nothing reads (measured: typecheck, lint, and fallow all pass with one planted) | Pending | Phase 116 discussion | v1.19 |

## Session Continuity

**Stopped at:** Completed 117-09-PLAN.md

**Resume file:** None
twelve plans. Read `117-CONTEXT.md` (decisions D-117-01..21) and `117-RESEARCH.md` (measured, 1310
lines) beside them.

**Read beside it:** `.planning/phases/116-edge-surface/.continue-here.md` — phase 116's handoff. Its
BLOCKING CONSTRAINTS, findings table, tooling defects and commit recipe all still apply to Phase 117;
only its per-plan wave list is spent.

Last session: 2026-09-03T20:10:08.249Z

**Next: Phase 117 (Extension Entry and Final Gate) — PLANNED, ready to execute.** Twelve plans in
six waves: `1:[01-06] 2:[07] 3:[08] 4:[09,10] 5:[11] 6:[12]`. Plan-checker passed after one revision.
Continue with `/gsd-execute-phase 117`.

Plan counts here are MEASURED, not carried: 220 total and 208 complete, counted by `find` over
`1??-??-{PLAN,SUMMARY}.md`. The prior 208/206 was stale on both halves — `total_plans` had never
absorbed phase 117, and `completed_plans` carried the known `state.record-metric` drift. Every phase
108-116 has a SUMMARY for every PLAN.

### What Phase 117 inherits

- **One pair remains**: the extension entry point. The ROADMAP shows 1 plan; the pair total is 203/204.
- **`tests/edge/index-handler.test.ts` is an ORPHAN by design** — D-116-10 deferred it here. It is the
  only unmirrored test in the edge tier, and it holds the 7 `as any` / `as unknown as` casts that are
  absent from every one of phase 116's own 30 pairs.
- **A blocker recorded before phase 116 began:** Phase 117 must MEASURE the Node 24 all-pair duration
  before adding concurrency.
- **17 open Broken Windows entries**, 8 from phase 116. Seven of those are D-116-01a coverage
  shortfalls (15-19, 21, 22) — argued, pinned, and closable only by a production rewrite. Entry 20 is
  different: two production comments in `edge/register.ts` (18-20 and 104-106) assert a
  registration-time `process.cwd()` capture the code does not make; `process.cwd()` is evaluated inside
  the completion arrow, so it is read per invocation. No licence remained to fix them in 116.
- **`BOOLEAN_FLAGS` is still re-exported from `edge/handlers/plugin/list.ts`** solely for
  `tests/architecture/flag-catalog-drift.test.ts`. Recorded as an observation for the phase that owns
  the repository-wide gates.
- **`tests/orchestrators/edge-deps.test.ts` still watches `globalThis.fetch`** — the precedent that
  spread the wrong door across twelve edge suites. It sits outside the edge tier so phase 116 left it;
  the git transport reaches the wire through `simple-get` → `https.request`, and `globalThis.fetch` has
  exactly one production caller (`domain/github-auth.ts`'s device flow, correctly watched by
  `tests/domain/github-auth.test.ts`).

### Two open operator decisions

1. **The tool's `available` / `unavailable` parameter DESCRIPTIONS** now admit a bucket their wording
   does not mention, after D-116-15's CR-01 fix made the `remote` and `partially-available` arms
   reachable. Changing them alters the LLM-facing contract and the pinned registration schema, which
   the fixer judged past its licence. Left for a deliberate decision.
2. **REQUIREMENTS.md status drift.** MOD-07 (Phase 114) still reads `Pending` despite that phase being
   verified complete, and the per-pair Status column lapsed at Phase 110 — roughly 115 rows across
   phases 110-114. Phase 116 swept only what it owned (MOD-09). Bookkeeping fix or milestone-audit
   item, your call.

### Standing environment debts — all still true

- **`npm run check` NEVER runs the tests.** `format:check` fails on the operator's pre-existing
  untracked files and short-circuits before `test`. Run `npm run typecheck`, `npm run lint`,
  `npm run fallow`, `npm test` and `npm run test:integration` SEPARATELY, checking each exit code.
- **Git hooks are not installed in this checkout** — a successful commit is not evidence hooks passed.
  Use the operator-approved recipe: filesystem trufflehog, per-file `prettier --check`, then
  `SKIP=trufflehog,npm-format-check pre-commit run --files <explicit paths>`.
- **This is a linked worktree**, so trufflehog needs the filesystem route.
- **This shell does not word-split**, and backticks inside `git commit -m` execute — use `git commit -F`.
- **`workflow.use_worktrees=false`**, so executors run sequentially on the shared tree, one at a time.
- **`phase.complete` cannot write the root planning files** under workstream mode — neither workstream
  holds v1.19 — so every phase transition is hand-applied. 114, 115 and 116 all were.
- **`roadmap.update-plan-progress` mangles ROADMAP.md every single time** (31 for 31 in phase 116):
  hand-edit instead. ROADMAP carries the plan count in TWO places that drift independently.
- **`state.record-metric` double-increments `completed_plans`**; `state.update-progress` writes nothing;
  `state.advance-plan` increments without appending the plan id.
- **NEVER name a non-plan artifact `*-SUMMARY.md`** — that glob is counted as a plan summary by
  `find-phase`, `phase-plan-index` and `progress.bar`, and it silently inflates the phase count.
