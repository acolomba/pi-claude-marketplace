---
phase: 25-runtime-publish-verification
plan: 03
subsystem: edge-completions
tags:
  [
    tab-completion,
    pi-tui,
    at-precedence,
    snm-39,
    g-mil-07,
    defer-with-finding,
    root-cause,
    live-trigger,
  ]

# Dependency graph
requires:
  - phase: 25-runtime-publish-verification
    plan: 01
    provides: "SNM-37 gate -- v0.2.0 source loads via scripts/pi.sh (the version TC-6 covers); eliminates cause (a) provider code-path divergence"
  - phase: 07-edge-completions
    provides: "edge/completions/provider.ts getArgumentCompletions + data.ts getMarketplaceOnlyCompletions / getInstalledPluginToMarketplacesMap; register.ts dual completion wiring"
provides:
  - "SNM-39 (G-MIL-07 tab completion) reproduced-or-refuted: DEFER-WITH-FINDING -- our provider is correct (TC-6 GREEN); root cause is host-side @-precedence in @earendil-works/pi-tui 0.76.0, NOT our code"
  - "tests/edge/completions/provider.test.ts -- finding comment above TC-6 (:793) pinning the pi-tui getSuggestions:188 / extractAtPrefix:191,:331 / PATH_DELIMITERS:6 / slash-branch :205 interception line refs"
  - ".planning/v1.4-MILESTONE-UAT.md -- G-MIL-07 verdict recorded (root_cause / artifacts / missing / Triage row) + G-MIL-03 REFUTE cross-reference from plan 25-02"
affects: [26 (GREEN gate close)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Root-cause-first reproduce-or-refute (D-25-10): trace the candidate causes statically against the loaded source + the GLOBAL pi-tui, then confirm with a LIVE keystroke trigger; keep the conditional verdict fork"
    - "Host-boundary finding: when the gap is in a peer dependency's precedence logic, record it in-repo with exact line refs and DEFER rather than contorting our code to fight the host (D-25-10 anti-pattern)"

key-files:
  created: []
  modified:
    - "tests/edge/completions/provider.test.ts (Task 1, committed cd1b3a3 -- finding comment above TC-6)"
    - ".planning/v1.4-MILESTONE-UAT.md"
    - ".planning/STATE.md"

key-decisions:
  - "D-25-10: SNM-39 G-MIL-07 DEFER-WITH-FINDING -- cause (b) host-side @-precedence in @earendil-works/pi-tui 0.76.0; pi-tui-external, do NOT contort the provider (would degrade bare-@<mp> UX without fixing the host)"
  - "Cause (a) provider divergence ELIMINATED by the v0.2.0 source-load (SNM-37 / plan 25-01); cause (c) scope-root mismatch RULED OUT (resolver returns [@mp-a,@mp-b] against the exact sandbox state, and pi-tui intercepts before our map is consulted)"
  - "Root-caused against the GLOBAL pi-tui 0.76.0 that scripts/pi.sh execs (RESEARCH A1 re-verify), NOT the local node_modules 0.74.2 -- @-logic byte-identical across both"

patterns-established:
  - "Live keystroke trigger as the binding runtime artifact (D-25-08): user runs scripts/pi.sh --home <sandbox> --cd <empty-fixture>, the executor records the observation; no programmable keystroke harness"
  - "FILE PATHS (or nothing) on update @<TAB> CONFIRMS the cause-(b) interception (RESEARCH A2); only @<mp> candidates in BOTH sandbox and real-home would refute"

requirements-completed: [SNM-39]

# Metrics
duration: 4min
completed: 2026-05-29
---

# Phase 25 Plan 03: SNM-39 G-MIL-07 Tab-Completion DEFER-WITH-FINDING Summary

**G-MIL-07 (`/claude:plugin update @<TAB>` surfaces nothing) is DEFER-WITH-FINDING: our completion provider is correct (TC-6 GREEN, `update @` -> `["@mp-a","@mp-b"]`); the gap is host-side `@`-precedence in the GLOBAL `@earendil-works/pi-tui` 0.76.0 that `scripts/pi.sh` execs, confirmed by a LIVE keystroke trigger that surfaced file paths instead of marketplace candidates -- pi-tui-external, so it is deferred with line-level evidence rather than worked around in our code (D-25-10).**

## Performance

- **Duration:** ~4 min (Task 3 only; Tasks 1-2 completed in prior runs)
- **Started:** 2026-05-29T23:28:05Z
- **Completed:** 2026-05-29T23:40Z (approx)
- **Tasks:** 3 (Task 1 + Task 2 in prior runs; this continuation executed Task 3)
- **Files Modified:** 3 (1 test comment committed in Task 1; 2 planning docs in Task 3)

## What Was Built

- **Task 1 (prior run, committed `cd1b3a3`):** Static root-cause of the completion gap across causes (a)/(b)/(c) + a finding comment above TC-6 in `tests/edge/completions/provider.test.ts:793`. No product code changed.
- **Task 2 (prior run, LIVE checkpoint RESOLVED):** The user ran `scripts/pi.sh --home <sandbox> --cd <empty-fixture-project>`, typed `/claude:plugin update @`, pressed Tab, and reported FILE PATHS appeared (not `@<mp>` candidates) -- the binding runtime artifact.
- **Task 3 (this run, committed `bc75f6b`):** Recorded the verdicts in `.planning/v1.4-MILESTONE-UAT.md` (G-MIL-07 `root_cause`/`artifacts`/`missing`/Triage row + G-MIL-03 REFUTE cross-reference) and `.planning/STATE.md` (SNM-37 blocker RESOLVED, SNM-38/SNM-39 decisions, pi-tui upstream finding in Deferred Items).

## Root Cause (isolated)

Cause **(b)** -- host-side `@`-precedence in `@earendil-works/pi-tui`, NOT our provider. Root-caused against the **GLOBAL pi-tui 0.76.0** that `scripts/pi.sh` actually execs (bundled under pi-coding-agent 0.76.0), NOT the local `node_modules` 0.74.2 -- the `@`-logic is byte-identical across both (RESEARCH A1 re-verified at execution).

In `pi-tui dist/autocomplete.js` (0.76.0):

- `CombinedAutocompleteProvider.getSuggestions` (`:188`) checks `const atPrefix = this.extractAtPrefix(textBeforeCursor)` (`:191`) and, when truthy, routes to `getFuzzyFileSuggestions` and returns early (`:192-204`) -- **BEFORE** the slash-command branch `if (!options.force && textBeforeCursor.startsWith("/"))` (`:205`).
- `extractAtPrefix` (`:331`) splits on `findLastDelimiter` against `PATH_DELIMITERS = new Set([" ","\t",'"',"'","="])` (`:6`) -- which has **NO `@`**. So for `/claude:plugin update @` the trailing `@` token is treated as a file-mention prefix; our slash-command `getArgumentCompletions` is **never reached** for the bare-`@<mp>` token.

**Causes ruled out:**

- (a) provider code-path divergence -- **ELIMINATED**: the v1.4 runtime now source-loads v0.2.0 (the version TC-6 covers) via SNM-37 (plan 25-01).
- (c) `getInstalledPluginToMarketplacesMap` empty via scope-root mismatch -- **RULED OUT**: `getArgumentCompletions("update @")` returns `["@mp-a","@mp-b"]` against the exact sandbox state via the real `makeLocationsResolver`; and regardless, pi-tui intercepts before our resolver map (`data.ts:313`) is ever consulted for a bare `@` token.

## Live-Trigger Observation (the binding artifact)

The user ran `scripts/pi.sh --home <tmp-sandbox> --cd <empty-fixture-project>` (one installed plugin per marketplace, cwd with NO `@`-matching files), typed `/claude:plugin update @`, pressed Tab, and observed **FILE PATHS** -- not `@<mp>` marketplace candidates. Per RESEARCH A2, file paths (like "nothing") **CONFIRM** the cause-(b) interception: our provider was never reached. The D-25-05 false-refute real-`~/.pi` spot-check was **NOT triggered** (it only fires if `@<mp>` candidates had appeared in the sandbox; they did not).

## Verdict per finding

- **G-MIL-07 (SNM-39) = DEFER-WITH-FINDING (D-25-10).** Nothing to fix in our code. Fixing it in our provider would require dodging the host's `@`-precedence, degrading the documented bare-`@<mp>` UX without fixing the host interception. Recorded in-repo with exact pi-tui line refs; opening an upstream pi-tui issue is the user's call (RESEARCH Open Q2). The `<plugin>@<mp>` and bare-`<TAB>` plugin-half forms are unaffected (their token does not START with `@`).
- **G-MIL-03 (SNM-38) cross-reference = REFUTE + display-layer caveat (plan 25-02, D-25-09).** The renderer emits the catalog-conformant 0/2/4 ladder at the pre-tui `ctx.ui.notify` boundary (indents `[0,2,2,2,2,4,0,0,2]`); the observed "1/3" is a markdown/tui display-layer artifact, not a renderer deviation. Mirrored into the UAT G-MIL-03 block so both Phase-25 outcomes are recorded.

## SNM-37 operator-gated blocker resolution

The Phase 25 SNM-37 publish-step blocker (an operator action gating SNM-38/SNM-39) is marked **RESOLVED** in STATE.md. The gate was satisfied via `scripts/pi.sh` source-load (no npm publish/link, D-25-01): the runtime source-loads v0.2.0, so both SNM-38 (25-02) and SNM-39 (25-03) reproduced/refuted against the v1.4 runtime without an operator publish. Real-publish validation remains deferred (D-25-06).

## Verification

- `node --test "tests/edge/completions/provider.test.ts"` passes (TC-6 `update @` -> `["@mp-a","@mp-b"]`, GREEN) -- our provider is correct (run in Task 1).
- `npm run check` exits **0**: typecheck + ESLint + prettier + tests all green; **1141 tests pass, 0 fail** (up from 1137 at plan 25-02 close). No product code changed -- only planning docs (this plan) and a prior test comment (Task 1).
- Task 3 verify expression satisfied: `.planning/v1.4-MILESTONE-UAT.md` contains the `CombinedAutocompleteProvider` / `extractAtPrefix` / `pi-tui` refs, and the STATE.md "operator action" line is the RESOLVED wording (the original unresolved sentence is gone).

## Deviations from Plan

None - plan executed exactly as written. No deviation rules (1/2/3) triggered; no architectural escalation (Rule 4). No product/provider code was changed in any task (D-25-10 anti-pattern explicitly avoided).

## Issues Encountered

None affecting correctness. Prettier flagged the two edited planning `.md` files for formatting on the first `npm run check`; running `prettier --write` on them reflowed the YAML block scalars without altering any content (the pi-tui line refs and live-trigger observation survived verbatim, confirmed by raw `awk` inspection). The pre-commit `fix-unicode-dashes` hook passed without rewrites because the verdict text uses `--` (double hyphen) throughout, not em-dashes. All pre-commit hooks (including trufflehog and prettier) passed clean.

## Known Stubs

None. No placeholder values, no hardcoded empties, no unwired data sources. This plan recorded verdicts in planning docs; no product code was added or stubbed.

## Threat Flags

None. No new network endpoints, auth paths, file-access patterns, or schema changes were introduced. The work was read-only static analysis + a sandboxed live trigger (T-25-06 mitigated by `--home <tmp>`) + planning-doc edits. No external packages installed (T-25-SC accept; not applicable).

## User Setup Required

None - no external service configuration required. Opening an upstream `@earendil-works/pi-tui` issue for the `@`-precedence finding is optional and the user's call (RESEARCH Open Q2); the finding is recorded in-repo with exact line refs in the meantime.

## Next Phase Readiness

- SNM-39 is closed (DEFER-WITH-FINDING, recorded with binding root-cause line refs + the LIVE keystroke artifact + the TC-6 lock + finding comment).
- Both Phase-25 findings now have recorded verdicts: G-MIL-03 (SNM-38) REFUTE (25-02) and G-MIL-07 (SNM-39) DEFER-WITH-FINDING (25-03). The SNM-37 operator-gated blocker is closed.
- Phase 25 (SNM-37/38/39) is complete. Phase 26 (SNM-40, GREEN gate close) is unblocked.

## Self-Check: PASSED

- FOUND: `.planning/v1.4-MILESTONE-UAT.md` (G-MIL-07 root_cause/artifacts/missing filled; Triage row updated; G-MIL-03 cross-reference)
- FOUND: `.planning/STATE.md` (SNM-37 blocker RESOLVED; SNM-38/SNM-39 decisions; pi-tui finding in Deferred Items)
- FOUND: `tests/edge/completions/provider.test.ts` (Task 1 finding comment above TC-6)
- FOUND commit: `cd1b3a3` (Task 1 finding comment)
- FOUND commit: `bc75f6b` (Task 3 verdict record)
- FOUND: `.planning/phases/25-runtime-publish-verification/25-03-SUMMARY.md`

---

_Phase: 25-runtime-publish-verification_
_Completed: 2026-05-29_
