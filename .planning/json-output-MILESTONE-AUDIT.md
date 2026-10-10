---
milestone: json-output
milestone_name: Mode-Keyed Presentation Strategies
audited: 2026-10-10
status: tech_debt
scores:
  requirements: 36/36
  phases: 7/7
  integration: 13/13 seams wired
  flows: 6/6 end-to-end flows traced
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: cross-cutting
    items:
      - "Verification reports for phases 01-06 read `stale`: each `covered_digest` was computed before later phases edited the same shared files (`notification-dispatch.ts`, `notification-grammar.ts`, `notification-resolve.ts`, `notification-types.ts`). Phase 07's verifier re-ran the whole-tree gate on the final combined tree, so the stale flag is bookkeeping, not evidence of regression. `/gsd-progress` will keep routing to `/gsd-execute-phase 01` until the digests are refreshed or the milestone is archived."
      - "Nyquist frontmatter inconsistency: `01-VALIDATION.md` and `03-VALIDATION.md` carry `nyquist_compliant: false` while their own checklists tick `nyquist_compliant: true set in frontmatter` and every mapped test row is green. The one open checkbox in 01 records that a full unit run took 404 s against a 180 s feedback target. Frontmatter is authoritative for §5.5, so both phases grade PARTIAL on paper."
      - "WINDOWS.md ledger entry 85 (phase 1, `unrun-verify`, recorded 2026-09-26) says 20 unit cases stay red until plan 01-03 realigns them. Plan 01-03 shipped; `node --test tests/orchestrators/marketplace/update.test.ts` exits 0 with zero failures on this tree. The entry is resolvable and should be closed before `/gsd-ship`."
      - "25 ledger entries are open in total. 23 belong to earlier milestones (ids 32-34 from a phase 06 live gate, 41-58 from a phase 07 coverage-producer delivery, 84 from workflows-live-uat). `/gsd-ship` blocks while any remain, so they need a fixed/waived disposition at close even though they are not this milestone's debt."
  - phase: 04-wire-schema-and-json-strategy
    items:
      - "deferred-items.md (open): the LLM plugin tool returns `Failed to load plugin list: ${errorMessage(err)}` as tool content when the payload load throws. That text goes to the LLM, not through a presentation, so `redactCredentials` never sees it. Today the thrown value is a `state.json` read error naming a file, not a credential. Out of PMOD-04 scope by design (redaction lives at resolve and presentation, never in a producer)."
      - "WINDOWS.md entry 88 (open): `composeContextBlocks` kept in `notification-dispatch.ts` because `renderMpHeader` and `composePluginLines` have no other production reader while ~110 test sites import them."
  - phase: 07-mode-refusals-real-pi-verification-and-docs
    items:
      - "DEP-07-03-01: root `package-lock.json` pins `brace-expansion@5.0.9` through `minimatch@10.2.6`; npm reports two high and one moderate denial-of-service advisories. The 0.86.1 peer-floor fixture accepts no attacker-controlled globs and runs bounded offline children, so its surface is mitigated. General root remediation is open and was out of scope for 07-03."
      - "TEST-07-06-01 / WINDOWS.md entry 89 (open, `skipped-test`): `tests/integration/skill-path-resolution.test.ts:124` skips when the optional pi-subagents resolver module is not reachable. Pre-existing skip, not introduced here; the corpus reports retain it as 10,228 tests, 10,227 passing, 1 skipped."
  - phase: integration
    items:
      - "MODE-03 in print mode: the browse refusal passes `usage: \"\"` to the `usage-error` kind so no trailing help or separator renders. Confirmed intentional by 07-01 (`Retain the required usage string; print supplies an empty string`) and pinned by `tests/shared/notification-grammar.test.ts`, but it is a special case a future renderer change could trip."
      - "Hook-origin producers (`async-rewake-summary`, `stop-override-cap`) share the `load`-origin branch of `emitPresentation`. Their kinds are in the schema and docs; the checker did not trace their call sites in `bridges/hooks/` back to the sink, so that wiring rests on phase 03's verification rather than this audit."
nyquist:
  compliant_phases: ["02", "04", "05", "06", "07"]
  partial_phases: ["01", "03"]
  not_validated_phases: []
  missing_phases: []
  overall: partial
---

# Milestone Audit: json-output — Mode-Keyed Presentation Strategies

**Audited:** 2026-10-10
**Branch:** `features/json` at `70b4c7e3`
**Status:** `tech_debt` — all 36 requirements satisfied, every seam wired, no
blockers. Accumulated deferred items and 25 open ledger entries need a
disposition before the close.

## Definition of Done

A JSON consumer running Pi in `json` or `rpc` mode receives every
`/claude:plugin` output as a schema-valid `claude-plugin` session entry through
`pi.appendEntry`, with the same severity, markers, reasons, and redaction the
text form shows, while `tui` and `print` keep today's text byte for byte. Each
command run is attributable by origin and invocation id, yields a complete
payload set even when its handler throws, and refuses clearly in a mode it
cannot serve.

**Met.** Phase 01 moved every presentation decision into one resolve step;
phase 02 turned per-verb render callbacks into row-policy data; phase 03 typed
the eight raw surfaces; phase 04 added the versioned typebox wire schema, the
pure JSON strategy, credential redaction, and the generated
`schema/claude-plugin.schema.json`; phase 05 wired the exhaustive `ctx.mode`
switch to `pi.appendEntry`; phase 06 added origin and invocation ids, settle
ordering, and throw recovery; phase 07 added the browse and print device-flow
refusals, a real headless Pi e2e test at the 0.86.1 peer floor, and
`docs/json-output.md`. The text corpus check retained all 3,149 original
samples plus the one ledgered print refusal with zero extras.

## Requirements Coverage (3-source cross-reference)

Sources: `REQUIREMENTS.md` traceability table and checkboxes;
`NN-VERIFICATION.md` requirement tables; `requirements-completed` frontmatter
across the 45 SUMMARY files. All three agree for every ID.

| Requirement | Phase | REQUIREMENTS.md | VERIFICATION.md | SUMMARY frontmatter | Status |
| --- | --- | --- | --- | --- | --- |
| PMOD-01, PMOD-03 | 1 | `[x]` Complete | 01 passed | 01 | satisfied |
| PMOD-02, PMOD-05 | 2 | `[x]` Complete | 02 passed | 02 | satisfied |
| PMOD-04 | 4 | `[x]` Complete | 04 passed (re-verification closed the SC3 gap) | 04 | satisfied |
| TEXT-01 | 3 | `[x]` Complete | 03 passed | 03 | satisfied |
| RAWS-01 .. RAWS-05 | 3 | `[x]` Complete | 03 passed | 03 | satisfied |
| WIRE-01, 03, 04, 05, 06, 08, 09 | 4 | `[x]` Complete | 04 passed | 04 | satisfied |
| WIRE-02, WIRE-07 | 6 | `[x]` Complete | 06 passed (also cited by 04) | 06 | satisfied |
| JOUT-02, LLMT-01 | 4 | `[x]` Complete | 04 passed | 04 | satisfied |
| JOUT-01, JOUT-05, MODE-01, MODE-02, TENB-01, TENB-02 | 5 | `[x]` Complete | 05 passed (re-verification closed A-05-01) | 05 | satisfied |
| JOUT-03, JOUT-04 | 6 | `[x]` Complete | 06 passed | 06 | satisfied |
| MODE-03, MODE-04, TENB-03, JDOC-01 .. JDOC-03 | 7 | `[x]` Complete | 07 passed, 7/7 human reviews passed in 07-UAT.md | 07 | satisfied |

**36/36 satisfied. No orphans:** every ID in the traceability table appears in
at least one VERIFICATION.md table and one SUMMARY frontmatter list.

Four IDs the integration checker left open were closed by direct inspection:

- **MODE-04** requires a typed fail-fast error pointing at `--mode json` or
  interactive Pi, not a payload. `orchestrators/auth-host.ts:192-194` throws
  `DeviceFlowUnavailableError` before `initiateDeviceFlow`;
  `platform/git-auth-callbacks.ts:211` rethrows it unwrapped; the message in
  `shared/errors.ts:4-11` names both remedies.
  `tests/integration/auth-e2e.test.ts` asserts the exact message under
  `mode: "print"` with zero device HTTP, as does
  `tests/orchestrators/auth-host.test.ts:151-154`.
- **LLMT-01**: both tools in `edge/handlers/tools.ts` build `details` through
  `toWireMarketplaces(presentCascade(...).marketplaces)` and keep each row's
  verbatim status; only the line-format text keeps the `[installed]`
  projection, as the requirement specifies. `tests/edge/handlers/tools.test.ts`
  pins an `upgradable` row with `id: "alpha@upgradable-mp"` in the details.
- **TENB-01**: `tests/edge/json-capture.ts` records every `appendEntry` call,
  asserts the `claude-plugin` type, rejects non-JSON values, and validates each
  payload with `PAYLOAD_VALIDATOR.Check`; 23 test files consume it.
- **TENB-02**: all 17 remaining `as unknown as ExtensionContext` casts in
  `tests/` carry an explicit `mode` in the object literal.

## Phase Verification

| Phase | Plans | Verification | Score | Human resolution |
| --- | --- | --- | --- | --- |
| 01 presentation-model | 16/16 | passed (2026-10-01), now `stale` | 5/5 | PMOD-01 and PMOD-03 prohibitions passed in 01-UAT; one override accepted by the user for the post-merge corpus re-baseline |
| 02 row-policies | 2/2 | passed (2026-10-02), now `stale` | 5/5 | none required |
| 03 typed-raw-surfaces | 4/4 | passed (2026-10-03), now `stale` | 11/11 | none required |
| 04 wire-schema-and-json-strategy | 6/6 | passed (2026-10-06), now `stale` | 5/5 | re-verified from 4/5; five prohibitions human-confirmed 2026-10-06 |
| 05 mode-selected-json-sink | 7/7 | passed (2026-10-07), now `stale` | 6/6 | re-verified from 5/6; P-05-01 and P-05-02 accepted in 05-UAT |
| 06 command-run-contract | 4/4 | passed (2026-10-09), now `stale` | 15/15 | two judgment prohibitions accepted in 06-UAT |
| 07 mode-refusals-real-pi-verification-and-docs | 6/6 | passed (2026-10-10) | 31/35 automated, 7/7 human reviews passed | H1-H7 resolved by explicit user responses in 07-UAT (status `complete`) |

No phase reports `gaps_found`. No phase lacks a VERIFICATION.md. The `stale`
flag on 01-06 is a digest mismatch caused by later phases editing the shared
notification modules; phase 07's E7 evidence is a fresh `timeout 2400 npm run
check` on the final combined tree at `bfd0d2db` (exit 0, Node v26.11.1, 266
direct coverage records). Only `.planning/` files changed between `bfd0d2db`
and `70b4c7e3`.

## Cross-Phase Integration

Checker: `gsd-integration-checker` (sonnet), read-only code trace plus
`npm run typecheck`. 11 of 13 seams verified by the checker; the remaining two
(LLMT-01 tool details, TENB-01/02 test seams) verified above.

| Seam | Status | Evidence |
| --- | --- | --- |
| 01 → 04 resolved model feeds the wire mapping | wired | `emitPresentation` in `shared/notification-dispatch.ts` resolves, then calls `toWirePayload(presentation, run.origin)`; structured kinds via `presentCascade`, raw kinds via `resolveRawSurface` |
| 01 → 04 cause chain and redaction | wired | `resolveRawSurface` routes message, reason, header, and lines through `redactCredentials`; `internal-error` carries `cause{causeChain, truncated}` |
| 02 → 01 row policies into emitters | wired | `emitContextCascade` and `emitUpdateNoOpCascade` take a `RowPolicyMap` into `presentCascade` |
| 03 → 04 every raw kind resolved and mapped | wired | `RAW_SURFACE_SEVERITY` covers all 8 raw kinds under `satisfies Record<RawSurface["kind"], ...>`; schema has 19 `kind` consts; docs have 19 matching sections |
| 04 → 05 mode-selected transport | wired | `switch (requireNotificationMode(ctx.mode))` with `tui`/`print` → `ctx.ui.notify` and `json`/`rpc` → `pi.appendEntry("claude-plugin", payload)`; `requireNotificationMode` (`shared/notification-run.ts:13-18`) throws `UnsupportedModeError`; the same guard sits in `edge/register.ts`, `index.ts`, `bridges/hooks/event-router.ts`, `bridges/hooks/settle.ts` |
| 05 → 06 appendEntry failure handling | wired | `appendCommand` falls back to one recovery payload, then to `hookDebugLog` |
| 06 → 05 command run wraps every command | wired | `edge/register.ts` calls `runCommand(pi, ctx, route.commandId, ...)` with `createInvocationId`; `edge/command-run.ts` sets `origin = {kind: "command", commandId, invocationId}` |
| 06 → 05 outcome-less settle | wired | `executeCommand` emits `internal-error` "Command returned without an outcome." when json/rpc finishes with `!hasOutcome` |
| 07 → 05 browse refusal | wired | `edge/handlers/plugin/browse.ts:137-143` calls `notifyUsageError` when `mode !== "tui"`; `usage-error` severity is `error` |
| 07 → 03 print-mode device-flow refusal | wired | see MODE-04 above |
| 04 → LLM tools | wired | see LLMT-01 above |
| 05 → tests capture and fakes | wired | see TENB-01 and TENB-02 above |
| 07 → e2e and docs | wired | `tests/e2e/json-output-runtime.ts` plus `tests/e2e/pi-json-output.test.ts` cover `json` (`-p`) and `rpc`; `docs/json-output.md` documents all 19 kinds and the versioning policy; `AGENTS.md:67` IL-2 names both transports |

### End-to-end flows

| Flow | Status | Path |
| --- | --- | --- |
| `/claude:plugin install x@y` in json mode | complete | `register.ts` → `runCommand` (origin, invocation id) → `emitPresentation` → `toWirePayload` → `appendCommand` → `appendEntry("claude-plugin", ...)` |
| Handler throw in rpc mode | complete | `executeCommand` catch → `notifyCommandError` → `resolveCommandError` → `internal-error` payload appended; tui/print rethrow the original |
| Usage error in print mode | complete | `notifyUsageError` → `emitPresentation` print branch → `formatRawSurface` → `deliver` → `ctx.ui.notify` |
| Browse in json mode | complete | `browse.ts:137-143` → `notifyUsageError` → `usage-error` payload with the run's origin |
| Device-flow prompt in print mode | complete | `auth-host.ts:192` throws before any prompt; typed error reaches the command-error path with the fixed remedy |
| Reconcile aborted in json mode | complete | `index.ts` opens `openNotificationRun(pi, {kind: "load"})`; `notifyReconcileAborted` → `emitLoadSurface` → `emitPresentation` → `appendEntry(run.entrySink, payload)` |

**6/6 flows complete. No integration gaps.**

## Nyquist Coverage

| Phase | VALIDATION.md | `status` | `nyquist_compliant` | Grade |
| --- | --- | --- | --- | --- |
| 01 | exists | validated | false (checklist says true) | PARTIAL |
| 02 | exists | validated | true | COMPLIANT |
| 03 | exists | validated | false (checklist says true) | PARTIAL |
| 04 | exists | validated | true | COMPLIANT |
| 05 | exists | validated | true | COMPLIANT |
| 06 | exists | validated | true | COMPLIANT |
| 07 | exists | validated | true | COMPLIANT |

Both PARTIAL grades are frontmatter drift, not coverage gaps: every mapped test
row in 01 and 03 is green and the checklists tick the compliant box. Phase 01's
only open item is the 404 s full-run latency against a 180 s target. Running
`/gsd-validate-phase 01` and `/gsd-validate-phase 03` would reconcile the
frontmatter; the audit does not call it.

## Quality Gate

`timeout 2400 npm run check` exit 0 on the final combined tree at `bfd0d2db`
(phase 07 evidence E7, Node v26.11.1): typecheck, ESLint, workflow lint,
Fallow, Prettier, source/test pairing, unpaired tests, integration tests, and
266 direct source/test coverage records. The strict corpus comparison at the
same commit reports 3,149 originals plus one ledgered refusal and zero extras.
Commits after `bfd0d2db` touch `.planning/` only.

## Verdict

`tech_debt`. All 36 requirements are satisfied with three agreeing sources,
all 13 seams and 6 flows are wired in live code, and the whole-tree gate is
green at the last code change. Before `/gsd-complete-milestone` and
`/gsd-ship`:

1. Close WINDOWS.md entry 85 as fixed (its test file passes).
2. Give entries 88 and 89 a fixed or waived disposition; both are documented
   above.
3. Disposition the 23 inherited open entries (32-34, 41-58, 84); `/gsd-ship`
   blocks on them regardless of which milestone recorded them.
4. Decide whether the two `deferred-items.md` records (04 tool error text
   outside redaction, 07 brace-expansion advisory) move to BACKLOG.md.
5. Optionally reconcile the 01 and 03 VALIDATION frontmatter.
