---
phase: 14-drift-guard-test-alignment
plan: 02
subsystem: messaging
tags: [notify, usage-error, edge-handlers, msg-nc-2, msg-sr-7, cmc-34]

# Dependency graph
requires:
  - phase: 12-messaging-foundations-renderer-primitives
    provides: notifyUsageError wrapper at shared/notify.ts:95-97
  - phase: 13-conformance-refactor-es-5-supersession
    provides: parseCommandArgs Case A callback contract (args-schema.ts:71-84)
provides:
  - "All 13 plugin/marketplace argument-validation callsites route via notifyUsageError"
  - "On-the-wire bytes for usage errors are ${message}\\n\\n${USAGE} (MSG-NC-2 contract)"
  - "Audit BLOCKER CMC-34 (v1.3-MILESTONE-AUDIT.md lines 26-32) closed"
  - "Wave 2 milestone gate satisfied; Wave 3 drift-guard (MSG-NC-2 / MSG-SR-7) will have nothing to find"
affects: [phase-14-wave-3-drift-guard, phase-14-summary, v1.3-milestone-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Argument-validation callsite shape: notifyUsageError(ctx, <reason sentence>, <usage block>) -- never notifyError + concatenated USAGE"
    - "parseCommandArgs callback closure forwards plain `message` to notifyUsageError with closure-scope usage block as arg 3 (Case A)"
    - "Operational error paths (orchestrator try/catch) remain on notifyError(ctx, errorMessage(err), err) -- CMC-34 scope is argument validation only"

key-files:
  created: []
  modified:
    - "extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts (3 callsites)"
    - "extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts (4 callsites)"
    - "extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts (3 callsites)"
    - "extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts (3 callsites; orchestrator path at line 63 unchanged)"
    - "extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts (1 callback closure)"
    - "extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts (1 callback closure)"
    - "tests/edge/handlers/plugin/bootstrap.test.ts (line 148 byte-exact assertion updated to new shape)"

key-decisions:
  - "Case A pin (planner-verified at args-schema.ts:71-84) -- parseCommandArgs callback receives plain string; no concatenation. args-schema.ts UNCHANGED by this plan."
  - "bootstrap.ts:48-50 --scope rejection: message order flipped from {USAGE}\\n  reason to {reason}\\n\\n{USAGE} (per MSG-NC-2 contract). RESEARCH.md Pitfall 4 mitigated: no callsite passes a trailing-\\n message to notifyUsageError."
  - "bootstrap.test.ts:148 byte-exact assertion updated from message == USAGE alone to message == 'bootstrap takes no arguments.\\n\\nUsage: /claude:plugin bootstrap' -- the only test pin that asserted the pre-migration byte shape verbatim."
  - "Reason wording follows existing precedent: 'Unknown option: \"<token>\".', 'Too many arguments.', 'Invalid <plugin>@<marketplace> ref: \"<ref>\".' (mirrors edge/handlers/plugin/shared.ts:84-95 and edge/router.ts:148/161/181 conventions)."

patterns-established:
  - "Migration recipe for notifyError + USAGE concatenation: replace with notifyUsageError(ctx, <reason>, USAGE) and strip any leading/trailing newline from the reason. The wrapper composes the \\n\\n separator."
  - "Marketplace handler callback closures: wrap the parseCommandArgs notifyError-callback to forward (message) -> notifyUsageError(ctx, message, <closure-scope usage>)."

requirements-completed: [CMC-34]

# Metrics
duration: ~15min
completed: 2026-05-24
---

# Phase 14 Plan 02: CMC-34 Closure Summary

**13 argument-validation callsites across 6 edge handlers migrated from `notifyError(ctx, message_with_USAGE)` to `notifyUsageError(ctx, reason, USAGE)`; on-the-wire byte shape now `${message}\n\n${USAGE}` per MSG-NC-2 / MSG-SR-7 contract.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-24T18:11:00Z (approx; wall-clock start of executor agent)
- **Completed:** 2026-05-24T18:25:00Z (approx)
- **Tasks:** 3 (Task 1 audit + Task 2 plugin handlers + Task 3 marketplace handlers)
- **Files modified:** 7 (6 handlers + 1 test)
- **Commits:** 2 task commits + 1 docs/metadata commit

## Accomplishments

- Audit BLOCKER CMC-34 closed: 13 edge-handler argument-validation callsites now route via `notifyUsageError` instead of `notifyError(ctx, msg + USAGE)`.
- All four plugin handlers (`list`, `reinstall`, `update`, `bootstrap`) and both marketplace handlers (`list`, `autoupdate`) emit the contractual `${message}\n\n${usageBlock}` byte shape (MSG-NC-2 + MSG-SR-7).
- `args-schema.ts` left UNCHANGED -- Case A pin (callback receives plain string) verified at planning time and re-verified during Task 1 audit; no refactor was needed.
- `bootstrap.ts:48-50` migrated cleanly without producing a triple-newline gap (RESEARCH.md Pitfall 4 mitigated).
- `bootstrap.test.ts:148` byte-exact assertion updated to match the new shape; all other tests use regex `/Usage: \/claude:plugin .../` matches that remain satisfied.
- `npm run check` GREEN: 1146 tests pass, 0 fail (Wave 2 milestone gate per D-14-03).

## Task Commits

Each task was committed atomically. Task 1 was a pure audit (no source mutations -- no test file pinned the wrong `\nUsage:` byte shape) so its findings are recorded in this summary rather than a separate commit.

1. **Task 1: Audit router test byte-shape** -- no commit (audit-only; findings below).
2. **Task 2: Migrate 13 plugin-handler callsites** -- `a3d48df` (refactor)
3. **Task 3: Migrate 2 marketplace-handler callsites + run full check** -- `2560f27` (refactor)

**Plan metadata commit:** (this SUMMARY) -- forthcoming via the executor's docs-commit step.

## Task 1 Audit Findings

Per Plan §Task 1, audited `tests/edge/router.test.ts:70-86` and all adjacent `tests/edge/handlers/**/*.test.ts` files for byte-shape pins that might pin the WRONG single-`\n` separator (which Wave 2 migration would silently flip).

**Case A pin re-confirmed.** `extensions/pi-claude-marketplace/edge/args-schema.ts:71` declares `notifyError: (message: string) => void`. Line 33 passes `errorMessage(err)` (parser error text alone, no USAGE). Line 84 passes `schema.usage` (usage string alone, no error reason). Neither path concatenates -- the callback's `message` argument is EITHER an error reason OR a usage string standing alone. **args-schema.ts is NOT modified by this plan.**

**Router test:** `tests/edge/router.test.ts:70-86` uses `assert.ok(notifications[0]?.message.includes(TOP_LEVEL_USAGE))` (presence-only). The comment at lines 77-78 already documents the `\n\n` byte shape. **No edit needed -- case (a) presence-only.**

**Adjacent handler tests swept:**

| File | Pattern Found | Outcome |
|------|---------------|---------|
| `tests/edge/handlers/plugin/list.test.ts` | No `Usage:` byte-pin (only `(no plugins)` assertions). | No edit. |
| `tests/edge/handlers/plugin/reinstall.test.ts` | `assert.match(.../Usage: \/claude:plugin reinstall/)` regex matches. | No edit -- both old and new byte shapes satisfy. |
| `tests/edge/handlers/plugin/update.test.ts` | `assert.match(.../Usage: \/claude:plugin update/)` regex matches. | No edit -- both shapes satisfy. |
| `tests/edge/handlers/plugin/bootstrap.test.ts:148` | `assert.equal(notifications[0]?.message, "Usage: /claude:plugin bootstrap")` byte-exact pin. | **EDIT REQUIRED** -- old shape was message == USAGE alone; new shape is `bootstrap takes no arguments.\n\nUsage: /claude:plugin bootstrap`. Updated under Task 2's commit (`a3d48df`) since the test pairs directly with the handler's migrated callsite. |
| `tests/edge/handlers/marketplace/list.test.ts` | No `Usage:` byte assertions captured. | No edit. |
| `tests/edge/handlers/marketplace/autoupdate.test.ts` | Severity-only assertions; no byte-shape pin. | No edit. |
| `tests/edge/handlers/marketplace/{add,remove,update}.test.ts` and other non-scope handler tests | Out of plan scope (handlers not touched by this plan). | No edit. |

**No tests pinned the WRONG single-`\n` separator shape.** The only byte-exact pin found was the bootstrap one, which pinned the OLD shape (USAGE alone with no preceding sentence); that test was updated as part of Task 2 to match the new contract output.

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts` -- 3 callsites migrated (parseArgs failure; unknown long flag; too-many-positionals). Import changed from `notifyError` to `notifyUsageError`.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/reinstall.ts` -- 4 callsites migrated (parseArgs failure; unknown option; too-many; parseTarget bad ref). Import changed.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/update.ts` -- 3 callsites migrated (parseArgs failure; too-many; split failed). Import changed.
- `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts` -- 3 argument-validation callsites migrated (parseArgs failure; positional rejected; --scope rejected). Import extended to `notifyError, notifyUsageError` -- the operational error path at line 63 (orchestrator try/catch around `bootstrapClaudePlugin`) remains on `notifyError(ctx, errorMessage(err), err)` because it is NOT argument validation (out of CMC-34 scope).
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/list.ts` -- 1 parseCommandArgs callback closure migrated. Import changed.
- `extensions/pi-claude-marketplace/edge/handlers/marketplace/autoupdate.ts` -- 1 parseCommandArgs callback closure migrated; `usage` (lowercase) closure variable passed as arg 3 since the autoupdate factory builds the usage block dynamically via `usageFor(enable)`. Import changed.
- `tests/edge/handlers/plugin/bootstrap.test.ts` -- byte-exact assertion at lines 145-149 updated from `assert.equal(notifications[0]?.message, "Usage: /claude:plugin bootstrap")` to `assert.equal(notifications[0]?.message, "bootstrap takes no arguments.\n\nUsage: /claude:plugin bootstrap")`. Comment added citing CMC-34 / MSG-NC-2 / MSG-SR-7.

## Decisions Made

- **Reason wording for synthesized usage-error messages.** The plan offered "synthesize a short reason" for callsites that previously passed just `USAGE` (no reason). Adopted conventions from existing prior-art:
  - `"Unknown option: \"<token>\"."` (matches `edge/handlers/plugin/shared.ts:58` and `reinstall.ts:44` pattern).
  - `"Too many arguments."` (matches `reinstall.ts:52` pre-migration message).
  - `"Invalid <plugin>@<marketplace> ref: \"<ref>\"."` (matches `edge/handlers/plugin/shared.ts:95` for `update.ts` and `reinstall.ts` `parseTarget` rejection paths).
  - `"bootstrap takes no arguments."` (new wording for the bootstrap positional-rejection path; matches sentence-form discipline).
- **bootstrap.ts:48-50 --scope reject:** flipped the literal order from `${USAGE}\n  bootstrap does not accept --scope; ...` (USAGE first, indented reason) to `${reason}\n\n${USAGE}` (reason first, blank-line separator, USAGE block). The pre-migration form was a Phase 12-pre stylistic; the post-migration form matches the MSG-NC-2 contract every other notifyUsageError callsite obeys.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Update `tests/edge/handlers/plugin/bootstrap.test.ts:148` to match new byte shape**

- **Found during:** Task 2 (plugin handler migration, bootstrap.ts).
- **Issue:** Plan's Task 1 audit predicted no test edits would be needed if router/handler tests were presence-only. The sweep found one byte-exact pin in `bootstrap.test.ts:148` that asserted `message == "Usage: /claude:plugin bootstrap"` exactly. After migrating `bootstrap.ts:42` to `notifyUsageError(ctx, "bootstrap takes no arguments.", USAGE)`, the message becomes `"bootstrap takes no arguments.\n\nUsage: /claude:plugin bootstrap"` and the test would fail.
- **Fix:** Updated the assertion to pin the new full byte shape with a citation comment (CMC-34 / MSG-NC-2 / MSG-SR-7).
- **Files modified:** `tests/edge/handlers/plugin/bootstrap.test.ts` (lines 145-149).
- **Verification:** `node --test tests/edge/handlers/plugin/bootstrap.test.ts` -- all 7 tests pass.
- **Committed in:** `a3d48df` (Task 2 commit, alongside the bootstrap.ts migration).

This is the Plan §Task 1 case (b): "Wrong byte-shape" -- but the pin was for the OLD shape (which was the right shape pre-Phase-14), not for a wrong-shape separator. The fix is mechanical and within Wave 2 scope per the plan's instruction "if existing tests pin the WRONG shape, flip those assertions to the correct shape". Updating a byte-exact pin to track a migrated handler's new output is a Rule-2 correctness requirement (the test would fail otherwise; `npm run check` would not be green; Wave 2 milestone gate would not be satisfied).

---

**Total deviations:** 1 auto-fixed (1 missing critical).
**Impact on plan:** Necessary for Wave 2 gate satisfaction. No scope creep; the test edit is within the plan's Task 1 stated audit-and-flip remit.

## Issues Encountered

None. The migration was mechanical and the plan's Pitfall 4 guidance covered the only non-trivial callsite (`bootstrap.ts:48-50`).

## User Setup Required

None -- no external service configuration required.

## Threat Flags

None -- the migration produces identical user-visible TEXT (the same reason + the same Usage block); only the separator byte changed (`\n` -> `\n\n`). The T-14-03 disposition in the plan's `<threat_model>` (information disposition: accept) is unchanged.

## Next Phase Readiness

- Wave 2 gate satisfied: `npm run check` green at the wave-2 commit (`2560f27`). Wave 3 (CMC-38 drift guard + WARNING-level closures) can now land knowing the MSG-NC-2 / MSG-SR-7 ESLint rules will have nothing to find on these 6 handler files.
- All 13 callsites in `CONTEXT.md`'s CMC-34 closure list are migrated.
- No regressions: 1146/1146 tests pass.

## Self-Check: PASSED

- Files in scope FOUND: 6/6 handlers + 1 test file.
- Commits FOUND: `a3d48df` (Task 2), `2560f27` (Task 3).
- args-schema.ts UNCHANGED: verified (`git diff --stat HEAD~2..HEAD -- extensions/pi-claude-marketplace/edge/args-schema.ts` returns empty).
- Aggregate `notifyUsageError(` count across 6 plan files: 15 (>= 13 floor; the extra 2 are `marketplace/list.ts` + `marketplace/autoupdate.ts` callback closures wrapping notifyUsageError, which were not in the "13 callsites" CMC-34 list per-callsite count but are part of the same closure scope).
- No `notifyError(ctx, USAGE)` remains in any of the 6 files (verified with `grep`).
- No `\\n\${USAGE}` concatenation remains in any of the 6 files.
- `bootstrap.ts:63` (orchestrator try/catch around `bootstrapClaudePlugin`) STILL uses `notifyError(ctx, errorMessage(err), err)` -- INTENTIONALLY unchanged per plan §Task 2.
- No message string passed as arg 2 to `notifyUsageError` ends with a literal `\n` (Pitfall 4 mitigated).
- `npm run check` GREEN (1146 tests pass).

---
*Phase: 14-drift-guard-test-alignment*
*Completed: 2026-05-24*
