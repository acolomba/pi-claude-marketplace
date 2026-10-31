---
phase: 05-mode-selected-json-sink
plan: "01"
subsystem: notifications
tags: [typescript, json, rpc, eslint, notification-mode]
requires:
  - phase: 04-wire-schema-and-json-strategy
    provides: Resolved presentations, explicit wire DTO conversion, and wire schema
provides:
  - Live mode selection for structured notifications through the original Pi entry sink
  - Typed unsupported-mode rejection before registered command work
  - Schema-validating capture with retained output and UI failures
  - Dispatcher-only appendEntry ownership with preserved network restrictions
affects: [05-02, 05-03, 05-04, 05-05, 05-06, 05-07]
actuals:
  tokens: 39133
  tasks: 2
  commits: 2
plan_head_before: 4d17fc7d82e59284cde246dfb174c36e57926bbe
plan_head_after: 414984c60202b4f78629b0378c489cd728ff96c2
tech-stack:
  added: []
  patterns:
    - Exact runtime mode membership before command routing
    - Required original-host entry sink with live per-emission mode selection
    - Persistent test-capture failure ledger
key-files:
  created:
    - tests/edge/json-capture.ts
  modified:
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - extensions/pi-claude-marketplace/shared/errors.ts
    - extensions/pi-claude-marketplace/shared/notification-run.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/edge/register.ts
    - tests/edge/notification-boundary.ts
    - tests/edge/register.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/shared/notification-run-seeds.ts
    - tests/architecture/presentation-sink.test.ts
    - eslint.config.js
key-decisions:
  - Derive ExtensionMode from the installed ExtensionContext mode member because Pi does not export the named alias at its package root.
  - Migrate three additional cast-hidden architecture context constructors found by the required tracked-test audit.
patterns-established:
  - Capture machine entries in order and assert the retained validation ledger after callbacks settle.
  - Compose append ownership selectors into the overlapping network-free ESLint rule.
requirements-completed: ["MODE-01", "MODE-02", "JOUT-01", "TENB-01", "TENB-02"]
coverage:
  - id: D1
    description: Registered list produces complete exclusive JSON and RPC entries with live mode and original-host receiver semantics.
    requirement: MODE-01
    verification:
      - kind: unit
        ref: tests/edge/register.test.ts#registered list appends a complete cascade in json without UI access
        status: pass
      - kind: unit
        ref: tests/edge/register.test.ts#registered list appends a complete cascade in rpc without UI access
        status: pass
      - kind: unit
        ref: tests/shared/notification-dispatch.test.ts#reads a live mode getter on the same run while retaining its original snapshot
        status: pass
    human_judgment: false
  - id: D2
    description: Unsupported runtime strings and stale mode getters stop registered commands before inventory, routing, or state work.
    requirement: MODE-02
    verification:
      - kind: unit
        ref: tests/edge/register.test.ts#registered command rejects runtime modes before routing or probing
        status: pass
      - kind: unit
        ref: tests/shared/notification-run.test.ts#requireNotificationMode exact membership cases
        status: pass
      - kind: other
        ref: npm run typecheck
        status: pass
    human_judgment: false
  - id: D3
    description: Machine capture validates original values and schema while retaining duplicates and caught append or UI failures.
    requirement: TENB-01
    verification:
      - kind: unit
        ref: tests/shared/notification-dispatch.test.ts#capture ledger, invalid first/middle/last, duplicates, empty capture, and UI getter cases
        status: pass
      - kind: other
        ref: node scripts/notify-corpus.mjs check plus strict missing/extra/count assertions
        status: pass
    human_judgment: false
  - id: D4
    description: Only the dispatcher may call appendEntry and existing network-free restrictions remain enforced.
    requirement: JOUT-01
    verification:
      - kind: other
        ref: ESLint.lintText transient append and gitOps controls with effective-config comparison
        status: pass
      - kind: other
        ref: npm run lint
        status: pass
    human_judgment: false
duration: 35 min
completed: 2026-10-06
status: complete
---

# Phase 5 Plan 1: Mode-Selected JSON Sink Summary

**Structured notifications select text or schema-valid Pi session entries from the live context mode, retaining one run snapshot and the original Pi receiver.**

## Performance

- Started: 2026-10-06T18:28:59Z
- Completed: 2026-10-06T19:04:00Z
- Tasks: 2
- Production/test/config files changed: 69
- Runtime: Node v26.10.0
- Verified worktree: agent-p05-01-1791308673
- Actual tokens measure the 156530-character task diff divided by four, rounded up. The two task commits are measured before this metadata commit.

## Accomplishments

- Registered list callbacks traverse the real router, list operation, presentation, and converter to emit independently expected JSON/RPC cascade entries without UI access.
- NotificationContext requires a plain-string mode. Exact membership rejects empty, padded, case-changed, Unicode-lookalike, and unknown modes before command work. A throwing mode getter also prevents work.
- NotificationRun retains the original Pi host as its required entry sink and still probes inventory exactly three times. The dispatcher reads mode at each emission; tui/print preserve text bytes and arity while json/rpc append once.
- Raw helpers retain their planned transitional signatures and text path. They validate mode immediately before nonempty delivery; empty output reads no mode.
- JSON capture retains ordered duplicate entries, original-value/schema failures, and UI getter attempts until explicit assertValid. Strict context factories use exact per-path mode-read counts.
- Ownership selectors cover all 274 tracked production files, exempt only the dispatcher, and preserve tests/scripts exemptions and all existing network-free selectors.

## Task Commits

1. **Task 1: Registered-list tracer and required contracts** — `ccb25e51fc190f033f25c6cd679c1098f50bec5a` — `feat: select structured notification transport from live mode`
2. **Task 2: Append ownership lint enforcement** — `414984c60202b4f78629b0378c489cd728ff96c2` — `chore: enforce notification entry ownership in lint rules`

The metadata commit contains this summary, validation observations, and the original RED evidence. Neither task commit deletes tracked files. STATE.md and ROADMAP.md remain parent-owned and unchanged.

## Files Created/Modified

- `platform/pi-api.ts`, `shared/errors.ts`, and `shared/notification-run.ts`: required mode, typed error, exact validator, and original-host sink.
- `shared/notification-dispatch.ts`, `edge/register.ts`: per-emission transport choice and command-root guard.
- `tests/edge/json-capture.ts`: original-payload capture, schema validation, and retained failures.
- Owner tests, strict notification boundary, catalog harness, run seeds, and affected context factories: explicit modes and sink contracts without changing text output.
- `tests/architecture/presentation-sink.test.ts`: retained provenance, placement, and literal constraints for the guarded raw path and transport literal.
- `eslint.config.js`: append ownership composed with the network-free rule.

## Verification

All final checks below exited 0 on Node v26.10.0. Production, tests, dependencies, and configuration were unchanged between the verified head and summary authoring.

| Check | Observed result |
| --- | --- |
| `node --test tests/shared/errors.test.ts tests/platform/pi-api.test.ts tests/shared/notification-run.test.ts tests/shared/notification-dispatch.test.ts tests/edge/register.test.ts tests/edge/handlers/tools.test.ts tests/architecture/presentation-sink.test.ts` | Committed tracer rerun: 593 passed, 43 suites, zero failures/skips |
| Extended owner run including `tests/index.test.ts` | 615 passed |
| Additional architecture-constructor and skill-aliases owner run | 25 passed |
| `npm run test:coverage:direct -- extensions/pi-claude-marketplace/shared/errors.ts extensions/pi-claude-marketplace/platform/pi-api.ts extensions/pi-claude-marketplace/shared/notification-run.ts extensions/pi-claude-marketplace/shared/notification-dispatch.ts extensions/pi-claude-marketplace/edge/register.ts` | All five pairs reach 100% direct coverage |
| `SKIP=npm-check pre-commit run --files <task files>` | Passed after formatter changes were restaged and rechecked |
| `fallow audit --base 4d17fc7d82e59284cde246dfb174c36e57926bbe` and task-2 audit against `ccb25e51` | No changed-file issues |
| Both foreground `git commit` hooks | Passed `npm run check:commit`; shared test-support changes triggered every pair for task 1 |
| `npm run typecheck`, `npm run lint`, Fallow, formatting, and pairing inside hooks/full gate | Passed |
| ESLint effective configurations | Seven representative paths retain every original syntax selector; all 274 production paths enforce ownership except the dispatcher |
| ESLint in-memory controls | Direct, optional member, computed-string, and optional-method append calls rejected at planted lines in both shared/notify-reasons.ts and domain/dependency-closure.ts; eight expected JOUT-01 findings |
| Existing network control | Planted gitOps identifier still triggers NFR-5; clean subjects and real dispatcher have no ownership findings |
| `npm run check` at `414984c60202b4f78629b0378c489cd728ff96c2` | Passed static, unpaired, integration, and all direct coverage; merged LCOV has 264 records |
| `node scripts/notify-corpus.mjs check` | 3149 baseline entries present, 0 extra; zero missing/extra per-file records |
| Strict corpus assertions against complete saved stdout via stdin | Passed exact success-line and empty missing/extra-list assertions |
| `git diff --exit-code 26cb0056 -- docs/output-catalog.md` | Empty diff |
| `gsd-tools.cjs check tdd-red-evidence .../05-01-RED.json --raw` | RED_EVIDENCE_OK |

The corpus run reported 8629 passed, zero failed, and one existing optional pi-subagents resolver test skipped because the external resolver module was unavailable. This plan added no skip. No planted lint subject or permanent lint-control test was written to the repository.

## TDD Gate Compliance

- **RED:** The named registered-json-list test executed and failed on its whole-entry assertion: no appended entry versus the expected cascade. The previous dispatcher attempted UI delivery; the capture retained that attempt. The unchanged complete TAP report and structured semantic assessment are embedded in `05-01-RED.json`. The machine classifier returned RED_EVIDENCE_OK before implementation and again at closeout.
- **GREEN:** Required mode/sink contracts, the root guard, and the private live selector made the registered JSON/RPC callbacks emit complete entries. Owner tests and full coverage passed.
- **REFACTOR:** No separate refactor commit was needed.
- **Authorized commit adjustment:** RED was observed locally; green tests and implementation were committed together because repository hooks reject failing commits. Conventional task titles omit phase scopes under the explicit project override.

## Decisions Made

- Derive the upstream mode union through `ExtensionContext["mode"]` at the existing Pi boundary. The installed package declares ExtensionMode internally but does not re-export that alias from its root.
- Extend the context migration to three older architecture suites identified by the mandatory tracked-tree audit; their existing casts otherwise conceal missing modes.

## Deviations from Plan

1. **[Rule 3 - Blocking] Upstream mode alias export.** Task 1 typecheck proved that the proposed root re-export is unavailable. `platform/pi-api.ts` derives the same installed union from ExtensionContext instead; its compile-time union contract and the full gate pass. Commit: `ccb25e51`.
2. **[Rule 2 - Missing critical migration] Cast-hidden architecture contexts.** The tracked-test audit found contexts outside the enumerated file list in `tests/architecture/config-state-consistency.test.ts`, `notify-grammar-invariant.test.ts`, and `notify-will-reload-agreement.test.ts`. Added explicit tui modes, retaining existing output and assertions. Their owner checks, all-pair hook, full gate, and corpus pass. Commit: `ccb25e51`.
3. **[Rule 3 - Verification tooling] Native piped-reader abort.** The original strict corpus pipeline terminated with `*** buffer overflow detected ***` and exit 134 in its Node stdin reader. A one-byte stdin probe passed. Reran the unchanged corpus command into a regular log (exit 0), then applied the identical strict assertion program with that log as stdin (exit 0). No source, runtime, dependency, or safeguard change was made.

**Total deviations:** Three resolved: one required migration and two blockers. Production scope remains the planned mode/sink boundary; only necessary context fixes extend the file list.

## Issues Encountered

- Initial sandboxed Node test-process isolation did not provide valid RED evidence; the subsequent supported TAP run produced the classified assertion failure before implementation.
- The first task commit attempt failed on a void-arrow lint rule. The second passed static checks but found the remaining `{ ui }` recording context without mode. Both were corrected and restaged; the third attempt passed all hooks. No failed attempt created a commit, and no hook was disabled.
- Fallow audit printed a warning about a package entry under the TypeScript cache, then exited 0 with no changed-file issues. The repository Fallow gate also passed.
- The runtime's `evaluation-scope --plan 05-01` query matches phase-scoped commit subjects and therefore returns no matches under the project's required titles. The phase-directory query reads the exact task hashes from this summary instead; both commits were also verified as ancestors of HEAD. No runtime or history was changed.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

Ready for plan 05-02. Raw usage, diagnostic, authentication, and lifecycle families retain their planned transitional behavior and still require later migrations. Real-Pi verification and mode refusals remain later work. A-05-01/A-05-02 assumptions and P-05-01/P-05-02 prohibitions remain unclassified or unverified; these tests do not resolve them.

## Self-Check: PASSED

- The capture helper and RED artifacts exist.
- Both exact task commits are ancestors of the worktree head; the measured task-commit count is two.
- Task acceptance checks, the complete handoff gate, exact corpus comparison, and unchanged catalog all pass.
- No new stubs, skipped tests, dependencies, or source outside the required migration remain.
- Shared STATE.md and ROADMAP.md are unchanged.
