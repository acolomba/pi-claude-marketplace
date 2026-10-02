---
phase: 01-pi-1-0-floor-and-adapter-only-detection
plan: 04
subsystem: notifications
tags: [notifications, closed-vocabulary, soft-dep-marker, output-catalog]

requires:
  - phase: 01-pi-1-0-floor-and-adapter-only-detection
    provides: "Pi 1.0 floor (plan 01-01) and the expectSoftDepProbes helper (plan 01-02)"
provides:
  - "Reason member \"requires pi-mcp-adapter\" at the old MCP marker's union position, mirrored in UnsupportedReason"
  - "SOFT_DEP_MARKER_MCP = \"requires pi-mcp-adapter\"; softDepMarkers order stays agents, mcp, workflows"
  - "Closed MCP marker assertions: whole brace blocks, or the token followed by `,` or `}`"
  - "Catalog contract EXPECTED_UTF8_BYTES = 39_183 (260 states)"
  - "docs/output-catalog.md disabled-row sentence naming all three soft-dependency markers"
affects: [01-05, 01-06, 01-07, 01-08, notify, output-catalog]

actuals:
  tokens: 18864
  tasks: 2
  commits: 1
plan_head_before: 5821ffec30e9b2d50cf5a44a5122b6e2fd933fc1
plan_head_after: d651d6b978c999066fd10417307e0d8b978c706e

tech-stack:
  added: []
  patterns:
    - "A soft-dependency marker names the npm package the user installs"
    - "A positive marker assertion ends at `}` or `,`; a negative one checks the bare token"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
    - tests/architecture/catalog-uat/catalog-contract.test.ts
    - tests/e2e/install-soft-deps.test.ts
    - tests/orchestrators/plugin/uninstall.test.ts
    - tests/orchestrators/plugin/reinstall-flow.test.ts
    - docs/output-catalog.md
    - docs/messaging-style-guide.md

key-decisions:
  - "The MCP soft-dependency marker is {requires pi-mcp-adapter}, at the old member's Reason position; there is one MCP soft-dependency token and nothing about Pi's built-in MCP feeds it"
  - "MCP marker assertions are closed: whole brace blocks, or the token followed by `,` or `}`; the uninstall negative check tests the bare token"

patterns-established:
  - "A closed-catalog token rename edits production comments one line for one line, so contract pins stay put"

# ADET-01 is shared with plans 01-05 to 01-08, which deliver the detection change.
# This plan fixes the marker wording only, so it does not mark ADET-01 complete.
requirements-completed: []

coverage:
  - id: D1
    description: "The Reason union, the UnsupportedReason partition and SOFT_DEP_MARKER_MCP name requires pi-mcp-adapter; the closed-set gates and the catalog UAT pass with 260 states and 39183 example bytes"
    requirement: ADET-01
    verification:
      - kind: unit
        ref: "npm run typecheck && node --test <8 Task 1 suites> && npm run test:modules (tmp/p04-t1-verify.log, 7788 pass, 0 fail)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every MCP marker assertion is closed; the e2e soft-dep matrix passes on whole brace blocks"
    requirement: ADET-01
    verification:
      - kind: e2e
        ref: "PI_CM_E2E_REF=pinned node --test tests/e2e/install-soft-deps.test.ts (tmp/p04-e2e-softdeps.log, 4 pass)"
        status: pass
      - kind: other
        ref: "rg -n -F '{requires pi-mcp-adapter\"' tests and rg -n -F 'requires pi-mcp-adapter[^}]*' tests (no output)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Production comments renamed one line for one line; contracts file byte-unchanged; architecture suite green; catalog disabled-row sentence names three markers"
    requirement: ADET-01
    verification:
      - kind: unit
        ref: "npm run lint:type-members && git diff --exit-code 5821ffec -- scripts/check-unused-type-members.contracts.json && npm run test:architecture (tmp/p04-t2-verify.log, 460 pass, 0 fail)"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-10-02
status: complete
---

# Phase 1 Plan 04: MCP soft-dependency marker rename Summary

**The MCP soft-dependency marker now renders `{requires pi-mcp-adapter}`. Like
`{requires pi-subagents}` and `{requires pi-dynamic-workflows}`, it names the package the
user installs. The `Reason` member keeps its union position, and every MCP marker
assertion now ends at `}` or `,`.**

## Performance

- **Duration:** about 45 min, plus the pre-commit run
- **Started:** 2026-10-02T19:07Z
- **Completed:** 2026-10-02
- **Tasks:** 2
- **Files modified:** 46 (16 production, 25 test, 5 docs)
- **Node:** v26.10.0

## Accomplishments

- `notification-types.ts:27`, `notify-reasons.ts:108` and `soft-dep.ts:35` hold
  `"requires pi-mcp-adapter"` at the same positions. The union keeps its member count and
  order: after `requires pi-subagents`, before `rollback partial`. `SOFT_DEP_MARKER_MCP`
  keeps its name and its place in the agents, mcp, workflows order. No second MCP token was
  added, and no built-in MCP input reaches the renderer (D-01-03).
- The gates were amended in place: the COMPAT-01 ordered list, `notify-closed-set-locks`,
  both expected-marker arrays and `EMITTABLE_SOFT_DEP_MARKERS` in `closed-set-enrollment`,
  and `tests/shared/notification-types.test.ts`. No gate comment explains the member, so no
  ADET-01 clause was added.
- The open-ended assertions are closed (D-01-02):
  - `tests/e2e/install-soft-deps.test.ts`: the constants are `"{requires pi-subagents}"`
    and `"{requires pi-mcp-adapter}"`. The comment above them now says that each constant
    pins a whole reasons block.
  - `tests/orchestrators/plugin/uninstall.test.ts`: the negative check asserts that
    `requires pi-mcp-adapter` is absent.
  - `tests/orchestrators/plugin/reinstall-flow.test.ts`: the regex is
    `/\{[^}]*requires pi-mcp-adapter[,}]/`.
  - A search over `tests` found no other MCP assertion that runs past the token. The
    remaining unterminated matches are exact array elements or `deepStrictEqual` operands.
- The catalog has five renamed tokens inside example blocks (lines 248, 250, 565, 1516 and
  2163). Each adds the 8 bytes of `-adapter`, so 39143 + 5 x 8 = 39183.
  `EXPECTED_UTF8_BYTES` is `39_183`, `EXPECTED_STATE_COUNT` stays 260, and the catalog
  contract passes with those values.
- IN-03 is closed. `docs/output-catalog.md:395` now names `{requires pi-subagents}`,
  `{requires pi-mcp-adapter}` and `{requires pi-dynamic-workflows}`. It says the renderer
  passes all three soft-dependency flags as `false`. Line 69 names the new token. Line 3733
  maps MCP servers to `pi-mcp-adapter`.
- The 20 comment-only production lines were renamed one line for one line. The longest
  edited line is under 100 characters. `git diff --numstat -- extensions` shows equal
  added and deleted counts for every production file.
- The style guide (lines 9, 40, 91 and the mapping-table row), the ADR, the workflows doc and
  the hooks research doc name the new token. mdformat realigned the mapping table. The
  vocabulary-guard waiver `why` names `{requires pi-mcp-adapter}`. The `list-flow.test.ts`
  comment that wraps the brace across two lines names the new token.
- No guard that greps for the retired token was added (D-01-19).

## Task Commits

The plan makes one code commit (Tasks 1 and 2 together, as the plan specifies):

1. **Tasks 1-2: MCP soft-dependency marker rename** - `d651d6b9`
   (feat: `feat(notify): name pi-mcp-adapter in the MCP soft-dep marker`)

**Plan metadata:** the docs commit that follows it (SUMMARY, STATE, ROADMAP, state.json).

The code commit SHA was fixed before the pre-commit run, as plans 01-01 and 01-03 did. The
commit object was built with `git commit-tree` from the staged tree with pinned author and
committer dates (`2026-10-02T19:20:00+0000`). `git commit` then used the same dates, index
and message.

## Verification Evidence

Focused task verification passed; full phase/PR verification pending.

- Task 1: `npm run typecheck`, the eight named suites and `npm run test:modules`:
  `T1_EXIT=0`, 7788 pass, 0 fail (`tmp/p04-t1-verify.log`).
- Task 2: `npm run format`, `npm run lint:type-members`,
  `git diff --exit-code 5821ffec -- scripts/check-unused-type-members.contracts.json`
  (`CONTRACTS_UNCHANGED`) and `npm run test:architecture`: `T2_EXIT=0`, 460 pass, 0 fail
  (`tmp/p04-t2-verify.log`).
- E2E soft-dep matrix: `PI_CM_E2E_REF=pinned node --test tests/e2e/install-soft-deps.test.ts`:
  `E2E_EXIT=0`, 4 pass (`tmp/p04-e2e-softdeps.log`). This passes on the closed constants,
  so each matrix row carries its marker alone.
- Acceptance greps, all clean:
  - `rg -n 'requires pi-mcp([^-]|$)' extensions docs tests --glob '!tests/live-uat/**'`:
    no output.
  - `rg -n -F '{requires pi-mcp-adapter"' tests` and
    `rg -n -F 'requires pi-mcp-adapter[^}]*' tests`: no output.
  - `rg -n 'pi-mcp-adapter-adapter' .`: no output.
  - `rg -n '`pi-mcp`' docs/output-catalog.md`: no output.
  - `rg -n 'passes both soft-dependency flags' docs/output-catalog.md`: no output.
  - `grep -c 'all three soft-dependency flags' docs/output-catalog.md`: 1.
  - `"requires pi-mcp-adapter"` appears once in each of `notification-types.ts`,
    `notify-reasons.ts` and `soft-dep.ts`.
- The staged file set equals the plan's `files_modified` list (46 paths).

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notification-types.ts`,
  `shared/notify-reasons.ts`, `shared/concerns/soft-dep.ts` - the renamed member and
  marker constant (ADET-01)
- 13 further production files - comment-only token renames, one line for one line
- `tests/architecture/*` (5 files) - closed-set gates, the catalog byte total and the
  vocabulary waiver text
- `tests/e2e/install-soft-deps.test.ts`, `tests/orchestrators/**` (15 files),
  `tests/shared/**` (4 files) - expected strings renamed; three assertions closed
- `docs/output-catalog.md`, `docs/messaging-style-guide.md`,
  `docs/adr/v2-001-structured-notify.md`, `docs/workflows-compatibility.md`,
  `docs/research/claude-hooks-vs-pi-events.md` - token renamed; IN-03 sentence rewritten

## Decisions Made

- The e2e constants pin whole reasons blocks. The plan gives that form for the MCP
  constant, and the agents constant follows it. The matrix passes, so `code-simplifier`
  and `context7` each carry exactly one marker.
- Step 4's ADET-01 clause applies only to a gate comment that explains the member. None of
  the four gates has one, so none was added.

## Deviations from Plan

None - plan executed exactly as written.

`tests/platform/pi-api.test.ts:322` still has the fixture `source: "pi-mcp"`. This is a
tool `sourceInfo.source` value, not a marker token, and the acceptance regex does not
match it. It stays unchanged.

## Issues Encountered

The state verbs left two STATE.md fields stale: `last_activity_desc` and the Current
Position "Last activity" line both named 01-03. Both were set by hand to this plan.
REQUIREMENTS.md is unchanged, because this plan marks no requirement complete.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The marker wording is final, so plan 01-05 writes its detection tests against
  `{requires pi-mcp-adapter}`.
- ADET-01 stays open until plans 01-05 to 01-08 land.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

- T-01-SC: accepted. This plan installs no package.
- T-01-06: mitigated. Positive MCP marker checks end at `}` or `,`, and the acceptance greps
  find no unclosed constant and no regex that runs past the token.

## Self-Check: PASSED

- The modified files exist. No file was created except this SUMMARY.
- The code commit `d651d6b9` is the commit-tree object built from the staged tree.
  `git commit` makes it HEAD only if the pre-commit run over the 46 code paths and the
  tracking files ends with `PRECOMMIT_EXIT=0` (`tmp/p04-precommit.log`). A failed hook
  means no commit.
- `scripts/check-unused-type-members.contracts.json` is byte-unchanged since `5821ffec`.
