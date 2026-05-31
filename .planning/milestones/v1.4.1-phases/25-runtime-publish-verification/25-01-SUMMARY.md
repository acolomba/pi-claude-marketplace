---
phase: 25-runtime-publish-verification
plan: 01
subsystem: testing
tags: [smoke-test, notify-capture, byte-form, source-load, scripts/pi.sh, snm-37]

# Dependency graph
requires:
  - phase: 22-reload-hint-discipline
    provides: "shouldEmitReloadHint -- read-only list excluded from the /reload trailer (SNM-33)"
  - phase: 23-version-display-bundle
    provides: "formatHashVersionForDisplay -> v#<7hex> hash render (SNM-35)"
  - phase: 24-grammar-consistency
    provides: "REASONS member rename lspServers -> lsp; emitted brace reads {lsp} (SNM-36)"
provides:
  - "tests/shared/snm37-behavioral-smoke.test.ts -- the D-25-04 behavioral byte-form v1.4-identity proof, inside npm run check"
  - "SNM-37 gate satisfied: v0.2.0 source loads via scripts/pi.sh; behavioral smoke proves v1.4 identity"
  - "SNM-37 requirement text + ROADMAP SC#1 + Phase-25 bullet amended to the source-load + behavioral-smoke methodology (lockstep)"
affects: [25-02 (SNM-38 G-MIL-03), 25-03 (SNM-39 G-MIL-07), 26 (GREEN gate close)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Notify-boundary byte capture: drive notify(ctx, pi, message) through a mock.fn() ctx; assert the pre-tui string (D-25-09)"
    - "Behavioral byte-form smoke as v1.4-identity proof, stronger than pi --version under -e source-load (D-25-04)"

key-files:
  created:
    - "tests/shared/snm37-behavioral-smoke.test.ts"
    - ".planning/phases/25-runtime-publish-verification/deferred-items.md"
  modified:
    - ".planning/REQUIREMENTS.md"
    - ".planning/ROADMAP.md"

key-decisions:
  - "D-25-01/02: source-load via scripts/pi.sh --home <tmp> --cd <fixture>; no npm publish / npm link"
  - "D-25-04: v1.4 identity proven by behavioral byte-form smoke, not pi --version (moot under -e source-load)"
  - "D-25-06: real-publish / packaged-artifact (release-tarball) validation explicitly DEFERRED (recorded, not skipped)"
  - "D-25-03: SNM-37 text + ROADMAP SC#1 + Phase-25 bullet amended in lockstep (mirrors D-23-01 / D-24-03)"

patterns-established:
  - "Pre-tui notify capture: byte forms asserted at ctx.ui.notify, never on post-markdown bytes"
  - "v1.4-identity smoke lives in tests/shared/ (inside npm run check), never tests/e2e/ (excluded)"

requirements-completed: [SNM-37]

# Metrics
duration: 14min
completed: 2026-05-29
---

# Phase 25 Plan 01: Runtime Source-Load Gate + Behavioral Byte-Form Smoke Summary

**SNM-37 gate satisfied: v0.2.0 source-loads into a Pi runtime via `scripts/pi.sh` (sandbox home, no npm publish/link), and a new `tests/shared/` behavioral smoke proves v1.4 identity at the pre-tui notify boundary (no `/reload` trailer, `v#<7hex>`, `{lsp}` not `{lspServers}`).**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-29 (execution)
- **Completed:** 2026-05-29
- **Tasks:** 3
- **Files modified:** 4 (1 test created, 1 deferred-items created, 2 docs amended)

## Accomplishments

- **Task 1 -- source-load delivery confirmed (no source change):** The existing load-only e2e smoke `tests/e2e/pi-runtime-smoke.test.ts` ("real Pi runtime package bin loads the extension under isolated HOME and cwd") PASSES -- the v0.2.0 extension loads via the `pi` bin under an isolated HOME/cwd. No `npm publish` or `npm link` invoked anywhere.
- **Task 2 -- behavioral byte-form smoke created:** `tests/shared/snm37-behavioral-smoke.test.ts` drives the real `notify(ctx, pi, message)` rendering through a `mock.fn()` ctx and asserts the three v1.4 byte forms at the pre-tui boundary. It lives in `tests/shared/` (inside `npm run check`), not `tests/e2e/` (excluded from the GREEN gate -- RESEARCH Pitfall 3).
- **Task 3 -- lockstep amendment:** SNM-37 text (`.planning/REQUIREMENTS.md`), ROADMAP SC#1 (`.planning/ROADMAP.md:476`), and the Phase-25 ROADMAP bullet (`:96`) all amended from the old "publish to npm / npm-link + `pi --version`" methodology to "source-load via `scripts/pi.sh` (sandbox home) + behavioral byte-form smoke," with the D-25-06 real-publish deferral noted.
- `npm run check` exits 0 (1133 tests pass, typecheck + ESLint + Prettier clean) -- the new smoke is inside the gate with no regressions.

## Delivery command shape (recorded per acceptance criteria)

The SNM-37 source-load delivery mechanism (D-25-01/D-25-02):

```
scripts/pi.sh --home <tmp> --cd <fixture-project>
```

`scripts/pi.sh` execs the **global** `pi` (bare `exec pi`, RESEARCH Pitfall 4) with `--no-extensions --no-skills --no-prompt-templates` and three `-e` source paths: the project extension (`extensions/pi-claude-marketplace/index.ts`) plus the `pi-mcp-adapter` and `pi-subagents` companions (bootstrapped via `ensure_global_package`). `--home <tmp>` maps to `PI_CODING_AGENT_DIR=<tmp>/agent` + `PI_CODING_AGENT_SESSION_DIR=<tmp>/sessions`, isolating the sandbox from the real `~/.pi`. The interactive `scripts/pi.sh` TTY session was NOT launched in this plan (Pitfall 5); the binding v1.4-identity proof is the in-process behavioral smoke (Task 2), and the live interactive session is reserved for the SNM-39 G-MIL-07 keystroke (plan 25-03, D-25-08).

## Runtime versions re-verified at execution time (RESEARCH A1)

No drift from research; matches RESEARCH §Standard Stack exactly:

| Component | Version | Location |
|-----------|---------|----------|
| global `pi` (`@earendil-works/pi-coding-agent`) | **0.76.0** | `~/.npm-global/bin/pi` |
| `@earendil-works/pi-tui` (under global pi) | **0.76.0** | (bundled under global pi-coding-agent) |
| `pi-mcp-adapter` (companion) | **2.6.1** | global (present) |
| `pi-subagents` (companion) | **0.24.3** | global (present) |

`scripts/pi.sh` resolves the bare `pi` to the global 0.76.0 install; both companions are already globally present (`ensure_global_package` is a no-op). This is the exact runtime the SNM-38/SNM-39 reproductions will exercise.

## Real-publish validation -- DEFERRED (D-25-06, recorded not silently skipped)

Real `npm publish` / packaged-artifact (release-tarball) validation is explicitly **deferred**. `scripts/pi.sh` does not exercise the `files:` tarball (`package.json` `files: [CHANGELOG.md, LICENSE, README.md, extensions/pi-claude-marketplace/**]`) or a real `npm install`. SNM-37 is reproduction-enablement, not a release gate; real publish-validation belongs to an actual release effort, out of v1.4.1 scope. This deferral is recorded both here and in the smoke test's header comment.

## Task Commits

All three tasks committed together in **ONE lockstep commit** per the plan body (mirroring the Phase 23 D-23-01 / Phase 24 D-24-03 in-lockstep amendment precedent): Task 1 produced no file change (verification only), Task 2 created the smoke test, Task 3 amended REQUIREMENTS.md + ROADMAP.md.

1. **Tasks 1+2+3 (lockstep):** `a458c7d` (test) -- behavioral smoke + lockstep SNM-37 / SC#1 / Phase-25-bullet amendments

**Plan metadata:** (docs: complete plan -- the final metadata commit carrying this SUMMARY + STATE.md + ROADMAP.md tracking)

## Files Created/Modified

- `tests/shared/snm37-behavioral-smoke.test.ts` (created) -- behavioral byte-form smoke; drives `notify()` through a `mock.fn()` ctx, asserts no `/reload` trailer (SNM-33), `v#<7hex>` (SNM-35), `{lsp}` not `{lspServers}` (SNM-36) at the pre-tui boundary.
- `.planning/REQUIREMENTS.md` (modified) -- SNM-37 methodology amended to `scripts/pi.sh` source-load + behavioral smoke; old "published to npm or npm-linked" + `pi --version` removed; D-25-06 deferral noted; purpose (gating SNM-38/39) unchanged.
- `.planning/ROADMAP.md` (modified) -- SC#1 (`:476`) + Phase-25 bullet (`:96`) `pi --version` half replaced with the behavioral byte-form smoke wording.
- `.planning/phases/25-runtime-publish-verification/deferred-items.md` (created) -- logs the 3 pre-existing out-of-scope `tests/e2e/import-command.test.ts` failures.

## Decisions Made

None beyond the locked D-25-* decisions applied as specified (D-25-01/02 delivery, D-25-04 behavioral proof, D-25-06 deferral, D-25-03 lockstep amendment).

## Deviations from Plan

None - plan executed exactly as written.

(Fixture construction used the locked Option 1 "pure `NotificationMessage` data" path; fixture shape combines `single-mp-mixed` (installed/available mix + `{hooks, lsp}` reason brace) with a `hash-version-list` row (`v#2ea95f8`) plus a second marketplace so each marketplace carries >=1 installed plugin -- all within the locked minimums and Claude's discretion.)

## Issues Encountered

- **Out-of-scope e2e failures (NOT fixed; logged):** `npm run test:e2e` surfaced 3 pre-existing failures in `tests/e2e/import-command.test.ts` (the `import` summary regex expects a `Claude plugin import summary` header the current v2 output no longer emits). These are unrelated to SNM-37, exist on the untouched baseline, and are in `tests/e2e/**` (excluded from `npm run check`). Per the SCOPE BOUNDARY rule they were logged to `deferred-items.md`, not fixed. The SNM-37-relevant test 13 (the runtime source-load smoke) PASSES.
- **Prettier formatting on the new test:** the first `npm run check` pass flagged the new test file for formatting; ran `prettier --write` and re-ran -- `npm run check` then exited 0. (Routine; not a deviation.)

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **This plan is the GATE for SNM-38 (plan 25-02) and SNM-39 (plan 25-03).** With the v0.2.0 source confirmed loadable via `scripts/pi.sh` and the behavioral smoke proving the v1.4 code paths execute, both reproduction plans can now run against the confirmed v1.4 runtime.
- SNM-38 (G-MIL-03 indent) is fully automatable (byte-capture at `ctx.ui.notify`); SNM-39 (G-MIL-07 completion) ends in a live interactive `scripts/pi.sh` keystroke escalation (D-25-08), exercising the same global pi-tui 0.76.0 confirmed above.
- No blockers. The new smoke is inside the `npm run check` GREEN bar feeding Phase 26.

## Self-Check: PASSED

- FOUND: `tests/shared/snm37-behavioral-smoke.test.ts`
- FOUND: `.planning/phases/25-runtime-publish-verification/25-01-SUMMARY.md`
- FOUND: `.planning/phases/25-runtime-publish-verification/deferred-items.md`
- FOUND commit: `a458c7d`

---
*Phase: 25-runtime-publish-verification*
*Completed: 2026-05-29*
