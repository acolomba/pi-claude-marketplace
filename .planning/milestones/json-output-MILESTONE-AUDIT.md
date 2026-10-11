---
milestone: json-output
milestone_name: Mode-Keyed Presentation Strategies
audited: 2026-10-11
re_audit_of: 1c823370
status: tech_debt
scores:
  requirements: 36/36
  phases: 9/9
  integration: 15/15 seams wired
  flows: 8/8 end-to-end flows traced
gaps:
  requirements: []
  integration: []
  flows: []
tech_debt:
  - phase: 09-address-tech-debt-redact-llm-tool-error-text
    items:
      - "Open user choice (D-03, recorded): Pi 0.87.1 ignores a returned `isError`, so a failed LLM tool call reaches the model as redacted text without Pi's error flag. Throwing a redacted Error instead would set the flag; D-03 kept the TC-9 return shape."
      - "Code review IN-01 (info, open): the marketplace-lookup failure test reuses the payload-failure fixture, so it cannot show which call threw."
      - "Code review IN-02 (info, open): `loadFailure` labels any failure in the tool body \"Failed to load ... list\", which is narrower than what the catch covers."
  - phase: 01-presentation-model
    items:
      - "Nyquist PARTIAL by accepted decision (08 D-11): `01-VALIDATION.md` keeps `nyquist_compliant: false` because a full unit run took 404 s against a 180 s feedback target. Every mapped test row is green."
  - phase: cross-cutting
    items:
      - "VERIFICATION digests for phases 01-07 read `stale` (08 D-12): later phases edited files those reports cover. Every report still says `passed`; `npm run check` is green at bab73a51 and only `.planning/` changed after it."
      - "DEPADV-01 (carried in BACKLOG.md; 07/ deferred item DEP-07-03-01): the nested `@earendil-works/pi-coding-agent/node_modules/brace-expansion@5.0.9` stays pinned by Pi's shrinkwrap."
      - "DEF-08-04-01 (upstream tooling, out of scope): `gsd-tools windows status --pick` fails when stdout is a pipe. `/gsd-ship` reads `--raw` and is unaffected."
  - phase: integration
    items:
      - "MODE-03 print-mode browse refusal passes `usage: \"\"` to `usage-error`; intentional and pinned by `tests/shared/notification-grammar.test.ts`. A future renderer change could trip it."
nyquist:
  compliant_phases: ["02", "03", "04", "05", "06", "07", "08", "09"]
  partial_phases: ["01"]
  not_validated_phases: []
  missing_phases: []
  overall: partial
---

# Milestone Audit: json-output — Mode-Keyed Presentation Strategies

**Audited:** 2026-10-11 (re-audit after Phase 09)
**Branch:** `features/json` at `02845c22`
**Prior audit:** `1c823370` (after Phase 08), status `tech_debt`
**Status:** `tech_debt`, no blockers. All 36 requirements are satisfied,
every seam is wired, the WINDOWS.md ledger reads zero open, and the prior
audit's last undecided action item is closed. What remains is accepted by a
recorded decision or carried.

## What changed since the prior audit

Phase 09 closed the prior audit's only open action (Verdict item 1):

| Prior action | Outcome |
| --- | --- |
| 1. Decide the phase 04 deferred item (LLM tool error text outside redaction) | Fixed in code and marked `status: resolved` in `04-.../deferred-items.md`, pointing at `09/` and commits `bebad4e4`, `6e1f282c`. `audit-open` no longer lists it. |

Phase 09 went further than the item asked (D-01): every string both LLM tools
return passes through one `textContent` helper that calls `redactCredentials`.
That closed a confirmed leak the item did not name: the marketplace-list tool
printed a url source's userinfo token. Neither tool lets a thrown error reach
Pi any more (D-03).

Code outside `.planning/` changed in two files only:
`extensions/pi-claude-marketplace/edge/handlers/tools.ts` and
`tests/edge/handlers/tools.test.ts` (+5 owner cases, 0 lines deleted).
`docs/output-catalog.md`, the frozen notify corpus, `schema/`, and the AUTH-09
gate are byte-identical.

Ledger: `open 0 / waived 50 / fixed 39 / total 89` (unchanged).

## Requirements Coverage (3-source cross-reference)

Unchanged. `REQUIREMENTS.md` ticks all 36 IDs; every ID appears in a `passed`
VERIFICATION.md table and in SUMMARY `requirements-completed` frontmatter.
Phase 09 adds no ID by decision (D-07) and traces to PMOD-04; its
VERIFICATION.md accounts for PMOD-04 against REQUIREMENTS.md.

| Requirement | Phase | Status |
| --- | --- | --- |
| PMOD-01, PMOD-03 | 1 | satisfied |
| PMOD-02, PMOD-05 | 2 | satisfied |
| TEXT-01, RAWS-01 .. RAWS-05 | 3 | satisfied |
| PMOD-04, WIRE-01, 03, 04, 05, 06, 08, 09, JOUT-02, LLMT-01 | 4 (PMOD-04 extended to LLM tool text in 9) | satisfied |
| JOUT-01, JOUT-05, MODE-01, MODE-02, TENB-01, TENB-02 | 5 | satisfied |
| WIRE-02, WIRE-07, JOUT-03, JOUT-04 | 6 | satisfied |
| MODE-03, MODE-04, TENB-03, JDOC-01 .. JDOC-03 | 7 | satisfied |

**36/36 satisfied. No orphans.**

## Phase Verification

| Phase | Plans | Verification | Score |
| --- | --- | --- | --- |
| 01 presentation-model | 16/16 | passed, digest `stale` (D-12) | 5/5 |
| 02 row-policies | 2/2 | passed, digest `stale` (D-12) | 5/5 |
| 03 typed-raw-surfaces | 4/4 | passed, digest `stale` (D-12) | 11/11 |
| 04 wire-schema-and-json-strategy | 6/6 | passed, digest `stale` (D-12) | 5/5 |
| 05 mode-selected-json-sink | 7/7 | passed, digest `stale` (D-12) | 6/6 |
| 06 command-run-contract | 4/4 | passed, digest `stale` (D-12) | 15/15 |
| 07 mode-refusals-real-pi-verification-and-docs | 6/6 | passed, digest `stale` (D-12) | 31/35 automated, 7/7 human |
| 08 address-tech-debt-ledger-dispositions-and-advisory | 4/4 | passed | 5/5 |
| 09 address-tech-debt-redact-llm-tool-error-text | 1/1 | passed (2026-10-11) | 5/5 |

No phase reports `gaps_found`; none lacks a VERIFICATION.md. Phase 09 also
carries SECURITY.md (7/7 threats closed, `threats_open: 0`), a clean-of-blockers
code review (0 critical, 0 warning, 2 info), and a validated VALIDATION.md.

## Cross-Phase Integration

Checker: `gsd-integration-checker` (sonnet), read-only, at `02845c22`.
`node --test tests/edge/handlers/tools.test.ts tests/edge/register.test.ts`:
299 pass, 0 fail. `npm run typecheck` exits 0.

| Seam | Status | Evidence |
| --- | --- | --- |
| LLM tools → wire details (LLMT-01) | wired | both builders still `openNotificationSnapshot` → `presentCascade` → `toWireMarketplaces`; `details` shape unchanged; details tests pass |
| LLM tool content → `redactCredentials` (PMOD-04) | wired | one `type: "text"` literal, inside `textContent` (`tools.ts:103`); all six content sites route through it |
| Tool registration (`edge/register.ts`) | wired | not in the diff; `registerClaudeMarketplaceTools` still registers both tools |
| Tool error path | wired | each `execute` is one `try { return await ... }` whose catch returns `loadFailure`; no snapshot or sink side effect on failure |
| The other prior seams (incl. both hook seams) | wired | byte-identical outside `tools.ts` since `09ae5ea2` |

### End-to-end flows

| Flow | Status |
| --- | --- |
| 8 flows from the prior audit | complete, unaffected (they do not use `tools.ts`) |
| LLM marketplace-list and plugin-list tools (registerTool → execute → builder → wire chain; failure → redacted `isError` result) | complete, test-proven |

## Nyquist Coverage

| Phase | `status` | `nyquist_compliant` | Grade |
| --- | --- | --- | --- |
| 01 | validated | false | PARTIAL (accepted, D-11: 404 s run vs 180 s target) |
| 02 - 09 | validated | true | COMPLIANT |

## Quality Gate

`npm run check` exit 0 at `bab73a51` (Phase 09 gate, Node v26.11.1, run
unpiped). Commits after it touch `.planning/` only; the integration checker's
`npm run typecheck` is clean at `02845c22`. `npx fallow audit --base b30468c0`
verdict `pass`.

## Verdict

`tech_debt`, no blockers, no undecided action items. Every remaining item is
accepted by a recorded decision (D-03, D-11, D-12), carried (DEPADV-01), out
of scope (DEF-08-04-01), or an info-level review note (IN-01, IN-02). One
choice is left open for the user without blocking completion: whether the LLM
tools should throw a redacted Error instead of returning `isError: true`, so
that Pi 0.87.1 flags the result as an error (D-03).

The milestone is ready for `/gsd-complete-milestone`.
