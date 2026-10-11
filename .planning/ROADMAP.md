# Roadmap: pi-claude-marketplace

## Milestones

- **json-output** Mode-Keyed Presentation Strategies — in progress, Phases 1-7, branch `features/json`, started 2026-09-28
- **any-git-host** — completed 2026-09-30, merged to main 2026-09-30 (PR #221); [archive](milestones/ws-git-hosts-2026-10-01/milestones/any-git-host-ROADMAP.md)
- **v1.20 transitive-dependencies** — completed 2026-09-24, merged to main 2026-10-01 (PR #198); 12 phases, 55 plans, 45/45 requirements. [Archive](milestones/v1.20-ROADMAP.md), [requirements](milestones/v1.20-REQUIREMENTS.md), [audit](milestones/v1.20-MILESTONE-AUDIT.md). The private-repository credential challenge deferred at closeout passed on 2026-09-30
- **workflows-replay** — completed 2026-09-21, merged to main 2026-09-24 (PR #205); [archive](milestones/ws-workflows-2026-09-27/milestones/workflows-replay-ROADMAP.md)
- **test-backlog** — completed 2026-09-18; [archive](milestones/test-backlog-ROADMAP.md)
- **refine-unit-tests** — completed 2026-09-13; [archive](milestones/refine-unit-tests-ROADMAP.md)
- **v1.19 Unit Test Refactor** — completed 2026-09-04; [archive](milestones/v1.19-ROADMAP.md)

Earlier milestones remain in [MILESTONES.md](MILESTONES.md).

## Phases

- [x] **Phase 1: Presentation Model** — Every presentation decision is computed once, upstream of a text renderer that no longer probes state or walks `Error` objects (16 plans complete; verification passed) (completed 2026-10-01)
- [x] **Phase 2: Row Policies** — Per-verb rendering differences become a total row-policy map of data instead of string render callbacks (completed 2026-10-02)
- [x] **Phase 3: Typed Raw Surfaces** — Every raw-string output surface becomes a typed model kind, so text is a pure formatter of the model (completed 2026-10-03)
- [x] **Phase 4: Wire Schema and JSON Strategy** — A versioned typebox wire schema and a format-only JSON strategy, validated as a pure function and first consumed by the LLM tools (completed 2026-10-06)
- [x] **Phase 5: Mode-Selected JSON Sink** — `ctx.mode` selects the strategy, and `json`/`rpc` output reaches consumers through `pi.appendEntry` from every output site (completed 2026-10-07)
- [x] **Phase 6: Command-Run Contract** — Payloads carry their origin and invocation, and every command run emits a complete set of payloads, even when it throws (completed 2026-10-09)
- [x] **Phase 7: Mode Refusals, Real-Pi Verification, and Docs** — Browse and device-flow refuse clearly by mode, a real headless Pi run proves the contract, and the schema is documented (completed 2026-10-10)
- [x] **Phase 8: Address tech debt: ledger dispositions and advisory** — Give every open WINDOWS.md ledger entry a disposition and resolve the carried advisory (completed 2026-10-10)
- [x] **Phase 9: Address tech debt: redact LLM tool error text** — Close the phase 04 deferred item: the LLM plugin tool error text bypasses credential redaction (completed 2026-10-11)

Phases run in order, 1 through 9.

**Milestone invariants.** Each phase leaves `npm run check` green: fallow
boundaries and production dead-code with no new suppression, the
unused-type-member gate, and 100% coverage. Each phase also leaves the text byte
form unchanged. `docs/output-catalog.md` diffs empty, and the wire corpus
captured in Phase 1 re-diffs empty, except for PMOD-04 credential redaction.
On 2026-10-01 the user also approved replacing exactly 28 synthetic callback
test emissions during Phase 2 (25 initially, then three explicitly approved
summary-owner occurrences), with an exact before/after record. On 2026-10-02
the user approved one more, the CR-01 review fix that restores a
marketplace-miss owner's reasons, for 29 in total. Phase 2
CONTEXT.md D-07 and RESEARCH.md enumerate this exception; all production
catalog bytes and every other corpus occurrence remain fixed.
Phase 7's close-out amends one piece of catalog prose, with no fenced-block
changes. A new type member lands with its first reader. The locked decisions D1-D8 are not
re-opened.

## Phase Details

### Phase 1: Presentation Model

**Goal:** Every presentation decision for structured notifications is computed once, in a resolve step upstream of rendering. The text renderer formats that result without probing Pi state or walking `Error` objects, and its bytes do not change.
**Depends on:** Nothing (first phase)
**Requirements:** PMOD-01, PMOD-03
**Research flag:** yes. Before the first extraction plan, enumerate the per-verb soft-dep suppression table arm by arm: which arms pass hard-coded `false` flags. PITFALLS.md Pitfall 2 has only a partial list. Also inventory the named-file gates the extraction must re-point (Pitfall 9).
**Success Criteria** (what must be TRUE):

1. The first plan captures a wire-corpus baseline before the renderer changes. The baseline holds every `(message, severity)` pair, with its argument count, that `shared/notification-dispatch.ts` emits across the unit and integration suites. At phase end the corpus re-diffs empty, `docs/output-catalog.md` has an empty diff, and the catalog's byte and state counts do not move.
2. One resolve step produces severity, `needsReload`, tally, summary facts, hints, and the final reasons list. Content reasons come first, then the `{requires ...}` markers in the fixed agents, mcp, workflows order. `shared/notification-dispatch.ts` no longer calls `softDepStatus`, and the text renderer takes no probe.
3. One soft-dep probe per command invocation feeds both severity stamping and marker composition. A test whose probe answers differently on a second call shows that one snapshot drives both.
4. Failure detail reaches the renderer as a serialized `causeChain: string[]` with a `truncated` flag, plus per-phase rollback entries and manual-recovery leaks as strings. No live `Error` crosses into rendering, and the cause-chain text is byte-identical to the baseline.
5. The probe-to-marker derivation has its own owner test that states the per-verb suppression table as data. `workflows-marker-coverage` scans the new derivation site and is not deleted.

**Plans:** 16/16 plans complete, sequential (waves 1-16)

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Notify wire-corpus capture tool, negative controls, and committed baseline (D-01..D-04)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Envelope decisions (severity, summary line, needsReload, tally, no-op) resolve before the text strategy (D-09, D-10)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-03-PLAN.md — Failure detail serialized in resolve, missing-arm floor, row hints and not-added reason as ids (D-11, PMOD-03)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-04-PLAN.md — Soft-dep markers compose in resolve from per-context marker policy; SC-5 table test (D-12)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 01-05-PLAN.md — Text strategy renders resolved rows with no probe; marker-coverage gate re-pointed (D-13)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 01-06-PLAN.md — Per-invocation run object built at the command root; marketplace list and info (D-05..D-07)

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 01-07-PLAN.md — Load-pass run for the reconcile cascade; pending and the shared handler prelude take the run (D-07)

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 01-08-PLAN.md — Import composer and marketplace remove/update take the run

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 01-09-PLAN.md — Marketplace add, autoupdate, and bootstrap take the run

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 01-10-PLAN.md — Plugin install takes the run; SC-3 two-answer probe proof (D-08)

**Wave 11** *(blocked on Wave 10 completion)*
- [x] 01-11-PLAN.md — Plugin enable/disable and uninstall take the run

**Wave 12** *(blocked on Wave 11 completion)*
- [x] 01-12-PLAN.md — Plugin reinstall takes the run; the load pass carries only the run

**Wave 13** *(blocked on Wave 12 completion)*
- [x] 01-13-PLAN.md — Plugin update family and fetch take the run

**Wave 14** *(blocked on Wave 13 completion)*
- [x] 01-14-PLAN.md — Plugin list, info, and browse take the run; run-free list payload for tools

**Wave 15** *(blocked on Wave 14 completion)*
- [x] 01-15-PLAN.md — Probe-shaped test boundary retired; per-command probe model stated (D-05)

**Wave 16** *(blocked on Wave 15 completion)*
- [x] 01-16-PLAN.md — Notify family narrowed to the run; stale claims restated; phase-end gate (SC-1..SC-5)

**Cross-cutting constraints:**
- `node scripts/notify-corpus.mjs check` passes and docs/output-catalog.md has no diff from 2f173031
- Hooks get no run object (orchestrator-resolved D-07 refinement): no file under bridges/hooks/ imports notification-run.ts
- `openNotificationRun(` appears only in edge/register.ts and index.ts at the end of this plan

### Phase 2: Row Policies

**Goal:** Per-verb rendering differences are model data: a total row-policy map per command replaces the string-returning render callbacks in the orchestrators' `*.messaging.ts` files. Every known divergence renders byte for byte as before.
**Depends on:** Phase 1
**Requirements:** PMOD-02, PMOD-05
**Success Criteria** (what must be TRUE):

1. Every `CommandContext` carries a total row-policy map keyed by status. The map holds data, such as marker and content-reason switches, and keeps the `satisfies` exhaustiveness anchor. The `(row, probe, mpScope) => string` render callbacks, the central `renderPluginRow` switch, and the `dispatchRow` string fallback are deleted.
2. Each known per-command divergence has an owner test that asserts both the policy value and the rendered text. The known divergences are: `partially-installed` without markers on `plugin list`; `available` and `remote` with content reasons on `plugin list`; `uninstalled` without reasons in reconcile-applied; the two row forms of `disabled`; and pending rows that ignore the probe.
3. The direct render-arm test calls in 12 test files assert policies plus text formatting instead. Execution's AST census corrected the original 70-call estimate to 69 invocations; all are migrated. No temporary adapter survives the phase.
4. The `pending` retained-workflow-staging advisory travels as structured data (`{name, envelopeCount?}`). The text strategy composes the sentence and its indent, and the `pending` output is byte-identical to the baseline.
5. The catalog diff is empty. The wire corpus changes only the 29 synthetic test occurrences approved in Phase 2 D-07, with an exact before/after ledger; all other occurrences remain unchanged.

**Plans:** 2/2 plans complete, sequential (waves 1-2)

**Wave 1**
- [x] 02-01-PLAN.md — Row-policy migration, owner tests, and the approved synthetic corpus patch

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Pending workflow facts, edge tests, and full quality gates

### Phase 3: Typed Raw Surfaces

**Goal:** Every raw-string output surface is a typed model kind that the text strategy formats. Text output becomes a pure formatter of the model, with its bytes unchanged, before any JSON exists.
**Depends on:** Phase 2
**Requirements:** RAWS-01, RAWS-02, RAWS-03, RAWS-04, RAWS-05, TEXT-01
**Success Criteria** (what must be TRUE):

1. Usage errors and help for every verb are typed kinds: `usage-error` carries the message and the usage, and help is `usage-info`. Diagnostics are `diagnostic {header, lines[]}` kinds. Each kind routes through the one presentation path, and its text and its `ctx.ui.notify` argument count do not change.
2. The domain passes the device-flow `verificationUri` and `userCode` to a structured callback instead of a pre-formatted string, and the text strategy composes the prompt. The AUTH-09 credential-leak gate is retargeted at the new callback: the user code may appear, and the access token never does.
3. The two load-time warnings in `index.ts` ("reconcile aborted" and "plugin PATH not refreshed") are `reconcile-aborted` and `plugin-path-skipped` kinds.
4. Hook rewake summaries and the Stop-hook override-cap warning are hook kinds, distinct from command kinds, and the rewake text is carried as data. The `hooks-cap-notify` and `hooks-async-rewake` byte pins hold. The JSON `origin: hook` value that these kinds make derivable is emitted under WIRE-02 in Phase 6.
5. No output surface hands the text sink a pre-composed string. The catalog diff and the full wire-corpus diff against the Phase 1 baseline are empty.

**Plans:** 4/4 plans complete, sequential (waves 1-4)

**Wave 1**
- [x] 03-01-PLAN.md — Tracer: load-time warnings as typed kinds through one sink that structured emissions share; usage and help kinds (RAWS-04, RAWS-01)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03-02-PLAN.md — Diagnostic kind with the empty no-op in the text strategy; hook kinds carrying the bridge's cap (RAWS-02, RAWS-05)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03-03-PLAN.md — Device-flow values cross the domain as a typed kind; raw callback deleted; AUTH-09 retargeted; approved corpus ledger (RAWS-03, D-17)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 03-04-PLAN.md — Planted-violation proofs for AUTH-09 and the D-16 presentation sink; phase gate (TEXT-01, SC-5)

### Phase 4: Wire Schema and JSON Strategy

**Goal:** A versioned typebox wire schema and a JSON strategy turn every model kind into a schema-valid payload that discloses nothing the text form does not. The JSON strategy is a format-only peer of the text strategy, and it is validated as a pure function before any sink is wired.
**Depends on:** Phase 3
**Requirements:** WIRE-01, WIRE-03, WIRE-04, WIRE-05, WIRE-06, WIRE-08, WIRE-09, JOUT-02, PMOD-04, LLMT-01
**Success Criteria** (what must be TRUE):

1. Each of the 205 catalog fixtures and each raw-surface kind converts to a payload with an integer `schemaVersion` and a `kind` from one typebox union, and the payload validates against that union. A planted invalid fixture fails, and a converter body that returns `{}` turns the suite red.
2. Payload values are raw and verbatim. Status, reason, scope, and severity tokens come from the existing closed sets, with no second vocabulary. Versions and timestamps are not abbreviated. Install-scoped rows always carry `scope`. Optional fields are absent, never `null`. Empty collections are `[]`, and arrays keep model order. Plugin rows carry `id: "<name>@<marketplace>"`. Warning and error payloads carry the `summary` line, tallies are numeric, and the update no-op cascade carries `noOp`.
3. A whole-payload walk over every fixture finds no absolute path that the text form does not show, and no live `Error`. The model redacts credentials (URL userinfo and tokens), so they are absent from both text and JSON. AUTH-09 covers the JSON path. Redaction is the only difference between the text wire corpus and the Phase 1 baseline.
4. A JSON Schema file generated from the typebox source is committed and included in the npm package (`npm pack --dry-run` lists it). A test fails when the file drifts from the source.
5. Both LLM tools build their `details` from the wire schema's plugin-row and marketplace-block shapes, with verbatim status tokens: `upgradable` stays `upgradable`. Their line-format text content does not change.

**Note:** fallow production dead-code rejects a module that nothing in production imports, so an unwired JSON strategy cannot end this phase. The LLM tool surface (LLMT-01) is the strategy's first production consumer. If the tools cannot use the strategy's entry point, the structured-path sink wiring from Phase 5 moves forward into this phase.
**Plans:** 6/6 plans complete, sequential (waves 1-5, then one gap-closure plan)

**Wave 1**
- [x] 04-01-PLAN.md — Tracer: plugin LLM tool details through the presentation step, wire schema, and JSON strategy; generated schema file in the package with a drift test (LLMT-01, WIRE-09)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 04-02-PLAN.md — Marketplace LLM tool on the same path; no-op and reconcile-applied cascades presented (LLMT-01, WIRE-05)

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 04-03-PLAN.md — Info kinds presented once; raw kinds converted with one severity table; 18-kind union (WIRE-01)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 04-04-PLAN.md — Credential redaction at every serialization site; AUTH-09 covers the JSON path (PMOD-04)

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 04-05-PLAN.md — Catalog-wide schema validation and whole-payload walk with controls; phase gate (JOUT-02, WIRE-08)

**Gap closure** *(from 04-VERIFICATION.md — SC3 / PMOD-04 subject names; after 04-05)*
- [x] 04-06-PLAN.md — Redact block names, plugin row names, and the marketplace-not-added name in the model; AUTH-09 rows proven to fail without the fix (PMOD-04)

### Phase 5: Mode-Selected JSON Sink

**Goal:** In `json` and `rpc` modes, every `/claude:plugin` output reaches consumers as a `claude-plugin` session entry through `pi.appendEntry`. An exhaustive switch over `ctx.mode` makes the choice, and `tui` and `print` keep today's text.
**Depends on:** Phase 4
**Requirements:** MODE-01, MODE-02, JOUT-01, JOUT-05, TENB-01, TENB-02
**Research flag:** none for planning. The startup-emission gap that SUMMARY.md flagged is decided in requirements: accepted and documented under JDOC-02, with no timer workaround.
**Success Criteria** (what must be TRUE):

1. With `mode` set to `json` or `rpc`, every output surface is recorded as an `appendEntry("claude-plugin", payload)` call and none as a `ctx.ui.notify` call. The surfaces are cascades, info, pending, usage errors and help, diagnostics, the device-flow prompt, load-time warnings, and hook summaries. With `tui` or `print`, the catalog and wire-corpus diffs stay empty, except for redaction.
2. The strategy comes from one exhaustive switch over `ctx.mode`, read at emit time and never cached. An unknown mode given as a plain string, with no cast, raises `UnsupportedModeError` from a membership check. An ordering assertion shows that no state write happens before the error. Lifecycle handlers log the error and never rethrow it.
3. Only the dispatch module calls `appendEntry`. A planted call in any other file fails lint, following the house planted-violation pattern.
4. An `appendEntry` that throws before bind, or a stale `pi` or `ctx` after `/reload`, propagates nothing out of `resources_discover`, `session_start`, async-rewake, or the Stop-hook settle path.
5. Every test fake of the notification or extension context carries an explicit `mode` that the type requires; no `as unknown as ExtensionContext` cast hides a missing one. An in-process capture helper records every `appendEntry` payload and fails the test on a schema-invalid payload.
6. Carried from Phase 3 research: the JSON strategy keeps the text strategy's empty no-ops (empty diagnostic lines, empty rewake summary), and `bridges/hooks/settle.ts`'s Stop-cap notify gains the NFR-2 try/catch once the sink can throw.

**Plans:** 7/7 plans complete

Plans:
**Wave 1**
- [x] 05-01-PLAN.md — Registered-list tracer, required mode/sink contracts, and lint ownership

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 05-02-PLAN.md — Usage/help transport through every parser and command handler

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 05-03-PLAN.md — Diagnostic producers and exact empty-output behavior

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 05-04-PLAN.md — Device-flow prompts through all authentication carriers

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 05-05-PLAN.md — Guarded loading and session setup with independent recovery

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 05-06-PLAN.md — Async-rewake and Stop-cap failure containment

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 05-07-PLAN.md — Full catalog transport coverage and final combined-tree evidence

### Phase 6: Command-Run Contract

**Goal:** A JSON consumer can tell where each payload came from and which command run produced it. Every command run yields a complete set of payloads before the command settles, and at least one payload even when its handler throws.
**Depends on:** Phase 5
**Requirements:** WIRE-02, WIRE-07, JOUT-03, JOUT-04
**Success Criteria** (what must be TRUE):

1. Every payload carries the required fields `severity`, `needsReload`, and `origin`. Command payloads name a machine command id, so `enable` can be told apart from `install` even though both render `(installed)`. Reload-time payloads carry `origin: load`, and hook payloads carry `origin: hook`.
2. All command-origin payloads of one run share one `invocationId` from an injectable generator. Payloads of two runs carry different ids, and tests pin the ids deterministically.
3. Every command emits all of its payloads before its handler's promise settles. A test that awaits the handler sees the complete set, and nothing is emitted after it.
4. In `json` and `rpc`, an unexpected throw from any command handler becomes a typed `internal-error` payload with a redacted cause chain, so every command yields at least one payload. In `tui` and `print`, the behavior does not change.

**Plans:** 4/4 plans complete, sequential (waves 1-4)

Plans:
**Wave 1**
- [x] 06-01-PLAN.md — Required origin metadata, canonical commands, and invocation correlation

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 06-02-PLAN.md — Typed internal errors and safe cause resolution

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 06-03-PLAN.md — Command completion, reload accounting, and bounded delivery recovery

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 06-04-PLAN.md — Timing, disclosure, and preservation verification

### Phase 7: Mode Refusals, Real-Pi Verification, and Docs

**Goal:** A command that cannot work in the current mode refuses clearly instead of degrading. A real headless Pi run proves the JSON contract end to end, and the schema and its limitations are documented.
**Depends on:** Phase 6
**Requirements:** MODE-03, MODE-04, TENB-03, JDOC-01, JDOC-02, JDOC-03
**Research flag:** yes. The e2e harness pattern for a headless `pi -p --mode json --no-session --offline` run, with stdin closed, is new to this suite.
**Success Criteria** (what must be TRUE):

1. Outside `tui`, `browse` emits an error-severity payload that names `/claude:plugin list` and no longer falls back to `list`; in `tui`, `browse` does not change. In `print` mode, an operation that needs device-flow authentication fails fast with a typed error that points at `--mode json` or `tui`, and it does not poll until the code expires.
2. A real-Pi e2e test runs `pi -p --mode json --no-session --offline "/claude:plugin list"` and asserts a schema-valid `claude-plugin` entry on stdout. It pins `entry_appended` at the peer floor, and it pins that startup-emitted entries are not streamed.
3. A schema reference documents every kind and field, with a `jq` example. It states the compatibility policy: additive changes (a new optional field, kind, or closed-set member) keep `schemaVersion`, and removals, renames, and type or meaning changes bump it. It also states the verdict rule: the maximum severity over command-origin entries.
4. The documented limitations cover these points. Print mode is silent, so scripts use `--mode json`. Pi exits 0 regardless. Startup entries are not streamed in `json` or `rpc`, and RPC clients can use `get_entries`. RPC front-ends must render `claude-plugin` entries, the device-flow prompt at minimum. A slash-command-only run writes no session file.
5. The IL-2 output-channel line in AGENTS.md matches PROJECT.md (D8). Backlog MRO-01 is closed, and its two wrong claims are corrected.
6. Milestone close-out for the Phase 1 corpus tool. After the final corpus re-diff comes back empty, the three `scripts/notify-corpus*.mjs` files are deleted (Phase 1 D-01), and no file outside `.planning/` names them. The `docs/output-catalog.md` prose that says `composeReasons` appends the soft-dep markers is amended to name the resolve step, and the device-flow prose (around lines 4088-4090) that says the domain emits the prompt is amended to name the dispatch module's text strategy (Phase 3 CONTEXT). This is the milestone's one sanctioned catalog edit: prose only, no fenced block changes, and `EXPECTED_STATE_COUNT` / `EXPECTED_UTF8_BYTES` do not move.

**Plans:** 6/6 plans complete

Plans:
**Wave 1**
- [x] 07-01-PLAN.md — Mode-specific browse refusals
- [x] 07-02-PLAN.md — Typed print-mode device-flow refusal
- [x] 07-03-PLAN.md — Isolated real-Pi runtime and peer-floor verification

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 07-04-PLAN.md — JSON guide and executable shell examples

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 07-05-PLAN.md — Schema reference, limitations, and policy corrections

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 07-06-PLAN.md — Refusal corpus ledger and temporary tool retirement

### Phase 8: Address tech debt: ledger dispositions and advisory

**Goal:** Every open WINDOWS.md entry carries a `fixed` or `waived` disposition with an auditable reason, so the `/gsd-ship` broken-windows gate reads zero open, and the `brace-expansion` advisory is remediated in the root lock with the Pi-pinned residual recorded and carried.
**Depends on:** Phase 7
**Requirements:** none (closeout phase; traceability lives in WINDOWS.md and BACKLOG.md)
**Research flag:** no. Every disposition's evidence was gathered and verified during discussion and is recorded in 08-CONTEXT.md.
**Success Criteria** (what must be TRUE):

1. `gsd-tools windows status` reports `open_count: 0`. Entries 85 and 89 are `fixed`. Every waived entry carries a `[json-output]`-prefixed reason that names what retired it: #236 (`d7213bc2`) for 32-34, #202 (`0affe79e` on the test-backlog branch, squash-merged as `feb04658`) for 41-58, the BACKLOG carrier WOUT-01 for 84, and the accepted-design constraint for 88.
2. Both pi-subagents resolver tests (`tests/integration/skill-path-resolution.test.ts`, `tests/integration/provenance-invisibility.test.ts`) resolve the package root before the hermetic HOME swap. The SC-2 / AGSK-06 case runs, not skips, where the global peer is installed. CI behavior is unchanged.
3. Root `package-lock.json` pins `node_modules/brace-expansion` at >=5.0.12 with `package.json` dependencies unchanged. The only path `npm audit` still reports is under `node_modules/@earendil-works/pi-coding-agent/`. The e2e peer-floor fixture lock is byte-identical.
4. BACKLOG.md carries WOUT-01 (workflow output quality unobserved) and DEPADV-01 (nested brace-expansion pinned by Pi's shrinkwrap). DEP-07-03-01 in the phase 7 deferred items points at DEPADV-01.
5. `03-VALIDATION.md` reads `nyquist_compliant: true`. `01-VALIDATION.md` stays `false` with its contradicting checkbox unticked. `npm run check` is green with no new suppression and the text corpus unchanged.

**Plans:** 4/4 plans complete, sequential (waves 1-4), in the main checkout

Plans:
**Wave 1**
- [x] 08-01-PLAN.md — Root lock brace-expansion fix behind a package-legitimacy checkpoint

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 08-02-PLAN.md — Resolve the pi-subagents root before the hermetic HOME swap

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 08-03-PLAN.md — WOUT-01 and DEPADV-01 carriers, deferred-item pointers, and validation records

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 08-04-PLAN.md — Ledger dispositions through a dry-run-proven script, then the phase gate

### Phase 9: Address tech debt: redact LLM tool error text

**Goal:** Credentials are absent from every text the two LLM tools return to the model, and neither tool lets a thrown error reach Pi. This closes the `04/` deferred item and the milestone audit's last undecided action item (Verdict item 1).
**Requirements**: TBD
**Depends on:** Phase 8
**Research flag:** no. 09-RESEARCH.md reproduced all three leak channels hermetically on the live tree. The work traces to PMOD-04 and the audit's Verdict item 1, with no new requirement ID (09-CONTEXT.md D-07).
**Success Criteria** (what must be TRUE):

1. Every `content` string that `pi_claude_marketplace_list` and `pi_claude_marketplace_plugin_list` return passes through `redactCredentials` in one module-private builder in `edge/handlers/tools.ts`. A marketplace recorded with url source `https://user:ghp_...@git.example.com/o/r.git` lists as `https://***@git.example.com/o/r`, and a credential the LLM types into the not-found line is redacted. `details` do not change.
2. Neither tool's `execute` rejects. A failure anywhere in its body, the `marketplaceExists` lookup included, returns `{ content: [<redacted "Failed to load <plugin|marketplace> list: <message>">], isError: true, details: { marketplaces: [] } }`, and absolute paths stay in the text.
3. `tests/edge/handlers/tools.test.ts` gains five owner cases (three redaction, two no-throw), every pre-existing case passes unmodified, `tools.ts` keeps 100% direct coverage, and the AUTH-09 gate file does not change.
4. The `04/` deferred item reads `status: resolved` with a pointer to `09/` and its two fixing commits, `audit-open` no longer lists it, and REQUIREMENTS.md gains no ID.
5. `docs/output-catalog.md` and the frozen notify corpus diff empty, no suppression is added, `npm run check` exits 0, and `fallow audit` reads pass.

**Plans:** 1/1 plans complete, in the main checkout

Plans:
**Wave 1**
- [x] 09-01-PLAN.md — Redact LLM tool text, catch every tool load failure, and resolve the `04/` deferred item (PMOD-04)

## Progress

| Phase | Plans Complete | Status | Completed |
| --- | --- | --- | --- |
| 1. Presentation Model | 16/16 | Complete    | 2026-10-01 |
| 2. Row Policies | 2/2 | Complete    | 2026-10-02 |
| 3. Typed Raw Surfaces | 4/4 | Complete    | 2026-10-03 |
| 4. Wire Schema and JSON Strategy | 6/6 | Complete    | 2026-10-06 |
| 5. Mode-Selected JSON Sink | 7/7 | Complete    | 2026-10-07 |
| 6. Command-Run Contract | 4/4 | Complete    | 2026-10-09 |
| 7. Mode Refusals, Real-Pi Verification, and Docs | 6/6 | Complete    | 2026-10-10 |
| 8. Address tech debt: ledger dispositions and advisory | 4/4 | Complete    | 2026-10-10 |
| 9. Address tech debt: redact LLM tool error text | 1/1 | Complete    | 2026-10-11 |

## Carried Forward

- `PRUNE-GUARD-MR-01` remains in [BACKLOG.md](BACKLOG.md). Marketplace removal
  can leave a dependent unsatisfied; the load-time check reports that state.

Earlier carried items remain in [the archived roadmap](milestones/v1.20-ROADMAP.md)
and their current dispositions are tracked in [WINDOWS.md](WINDOWS.md).
