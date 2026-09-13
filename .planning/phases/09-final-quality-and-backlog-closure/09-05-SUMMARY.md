---
phase: 09-final-quality-and-backlog-closure
plan: 05
subsystem: planning-records
tags: [backlog, closure, disposition, traceability]
status: complete

requires:
  - CLOSE-02 seal already flipped by 09-03
  - .planning/REQUIREMENTS.md §"Evidence and History" as the register voice
provides:
  - Eight terminal dispositions written in place, in one five-word vocabulary
  - The measured REASON-01 scope, quoted verbatim inside its own backlog entry
affects:
  - .planning/BACKLOG.md
  - .planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md

tech-stack:
  added: []
  patterns:
    - "Struck-through `## ~~ID~~ -- CLOSED` house form for shipped items only"
    - "Evidence-and-History register voice, with an explicit negative, for items that did not ship"

key-files:
  created: []
  modified:
    - .planning/BACKLOG.md
    - .planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md

key-decisions:
  - "REASON-01 is `implemented` for the terminal route only; the measurement showed BOTH of its two named cases still reach the tokens it complained about, so the entry carries a `NOT closed by the same change:` paragraph rather than a bare closure."
  - "FLOW-07 is the only one of the four whose route a requirement clause names by ID (GGAT-03); TESTQ-01 and FLOW-09 state in a sentence that their routes are assembled from clause text."
  - "The four evidence-only/deferred items take no struck-through heading — that form would overstate them — and each carries an explicit negative."

requirements-completed: [CLOSE-02]

coverage:
  - deliverable: "TESTQ-01, FLOW-09, REASON-01 and FLOW-07 closed in the house form with `implemented` verdicts and named requirement routes"
    human_judgment: false
    verification:
      - kind: command
        ref: "grep -c '^## ~~\\(TESTQ-01\\|FLOW-09\\|REASON-01\\|FLOW-07\\)' .planning/BACKLOG.md → 4"
        status: pass
      - kind: command
        ref: "grep -c 'Original report follows.' .planning/BACKLOG.md → 8 (baseline 4, +4 exactly)"
        status: pass
  - deliverable: "REASON-01's scope measured before its disposition was written, and the measurement quoted inside its own entry"
    human_judgment: false
    verification:
      - kind: command
        ref: "grep -n 'malformed' extensions/pi-claude-marketplace/shared/notification-types.ts → 3 rows, quoted verbatim in the entry"
        status: pass
  - deliverable: "COV-01 `superseded`, AGCOL-01 `evidence-only`, GAUTH-01 `deferred`, the unused-type-member todo `deferred`, none described as implemented"
    human_judgment: false
    verification:
      - kind: command
        ref: "grep -c '^## ~~\\(COV-01\\|AGCOL-01\\|GAUTH-01\\)' .planning/BACKLOG.md → 0"
        status: pass
      - kind: command
        ref: "grep -c 'deferred' .planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md → 2"
        status: pass
  - deliverable: "The requirement seal is unharmed by the backlog edits"
    human_judgment: false
    verification:
      - kind: command
        ref: "node scripts/revalidation.mjs scope-impact --check → Scope impact valid: 40 records."
        status: pass

metrics:
  duration: 24 min
  completed: 2026-09-11

actuals:
  tokens: 3300
  tasks: 2
  commits: 2
  plan_head_before: d7a7fe390c89e95698c5bbb233b6dbcce0faffe0
---

# Phase 9 Plan 5: Backlog Terminal Dispositions Summary

Eight terminal dispositions written in place — four `implemented` closures with named
requirement routes, one `superseded`, one `evidence-only`, and two `deferred` — all drawn
from the single D-09-14 vocabulary, with `REASON-01`'s scope settled by measurement before
its verdict was written rather than after.

## The eight verdicts, in order

The closure ledger (09-06) must carry these same eight words:

| item | verdict |
| --- | --- |
| `TESTQ-01` | `implemented` |
| `FLOW-09` | `implemented` |
| `REASON-01` | `implemented` (terminal route only; residual recorded) |
| `FLOW-07` | `implemented` |
| `COV-01` | `superseded` |
| `AGCOL-01` | `evidence-only` |
| `GAUTH-01` (the named prescription) | `deferred` |
| unused-type-member todo | `deferred` |

## The REASON-01 measurement — run first, and it corrects the plan's expectation

Verbatim output of
`grep -n 'malformed' extensions/pi-claude-marketplace/shared/notification-types.ts`,
run before any disposition was written:

```
44:  "malformed mcp",
45:  "malformed skill",
46:  "malformed command",
```

Three members in the `REASONS` closed set. The `{malformed <feature>}` family
`REASON-01` asked for does exist.

Then `extensions/pi-claude-marketplace/shared/probe-classifiers.ts::classifyResolverNote`
was read to establish which token each of `REASON-01`'s two named cases reaches today:

- **Inline malformed `mcpServers` → `{unsupported source}`.** The note is emitted as
  `malformed mcpServers[: detail]` (`domain/mcp-resolution.ts:34,36`).
  `classifyResolverNote` matches the FULL `malformed mcp reference` prefix *deliberately*;
  its own comment says a bare `malformed mcp` match "would also match the inline
  `malformed mcpServers` note and silently reroute it away from `unsupported source`". The
  inline note therefore falls through to the permissive catch-all.
- **Malformed `hooks.json` → `{unsupported hooks}`.** The note is emitted as
  `malformed hooks.json: <reason>` (`domain/hooks-resolution.ts:42`) and matches
  `classifyResolverNote`'s `isHooksNote` arm via
  `startsWith("malformed hooks.json:")`. There is no `malformed hooks` member in `REASONS`
  for it to reach.

**So NEITHER of the two named cases was rerouted.** The plan's step-1 branch anticipated
"covers both" or "covers only the terminal cases"; the measured answer is the second branch,
and more sharply than `09-RESEARCH.md` §5.4 framed it — the family exists and the terminal
malformed-input cases route into it, but the `narrowResolverNotes` re-audit the item asked
for was not done at all. `REASON-01`'s entry carries the grep verbatim plus a
`NOT closed by the same change:` paragraph naming both residual cases with their file:line
evidence. Research assumption A4 is confirmed in its direction and tightened in its content.

## Accomplishments

- **Four shipped items closed in the house form** (`## ~~ID: title~~ -- CLOSED`), each with
  a first paragraph naming the date and what closed it, the requirement IDs that carried it,
  and `Original report follows.` preserving the original text verbatim. The older
  parenthetical `(CLOSED)` form was not propagated.
- **`TESTQ-01` states its route as a five-row table**, mapping its own five numbered
  workstreams onto `PDEF-01..08` + `AUTH-01`, `RVAL-03`, `TREF-01..09`, the `GGAT` family,
  and `RCOV-03` — rather than asserting "the whole milestone" as a bare claim. It says in a
  sentence that the route is assembled, not stated (research assumption A2).
- **`FLOW-09` quotes the `TREF-05`, `TREF-06` and `GGAT-04` clause fragments** that make the
  match and says explicitly that the route is derived from clause text, not from a record
  that names `FLOW-09` against an ID (research assumption A3). Its `NOT closed by the same
  change:` paragraph keeps the ~94 ordinary internal helpers — the `production: true` payoff
  the item was named for — visibly open.
- **`FLOW-07` records that it is the one route a clause names by ID** (`GGAT-03`), so the
  three weaker routes read as visibly weaker.
- **`COV-01`, `AGCOL-01` and `GAUTH-01` take no struck-through heading.** Each is written in
  the `REQUIREMENTS.md` §"Evidence and History" voice — ID, its scope-change row id and
  former route in parentheses, what the claim asserted, what revalidation found, and the
  explicit negative.
- **`GAUTH-01` states the measured one-of-five wiring fact** (`NO_PROVIDER_CAUSE(host)` wired
  only into `orchestrators/marketplace/update.ts:394`) and names the four call sites that
  still surface the bare host-less token: `plugin install`, `plugin reinstall`,
  `plugin fetch`, `marketplace add`. It also records that `GAUTH-02` shipped separately, so
  the family does not read as an open pair.
- **The unused-type-member todo carries its disposition in its own file**, states its
  substance in one sentence, and says it creates no implementation work in this milestone.

## Verification results

| check | result |
| --- | --- |
| `grep -c '^## ~~\(TESTQ-01\|FLOW-09\|REASON-01\|FLOW-07\)' .planning/BACKLOG.md` | `4` |
| `grep -c '^## ~~\(COV-01\|AGCOL-01\|GAUTH-01\)' .planning/BACKLOG.md` | `0` |
| `grep -c 'Original report follows.' .planning/BACKLOG.md` | `8` (baseline `4`, +4 exactly) |
| `grep -c 'implemented' .planning/BACKLOG.md` | `6` after Task 1, `8` after Task 2 |
| `grep -c 'superseded\|evidence-only\|deferred' .planning/BACKLOG.md` | `6` |
| `grep -c 'deferred' .../2026-09-02-detect-unused-code-and-type-members.md` | `2` |
| `node scripts/revalidation.mjs scope-impact --check` | `Scope impact valid: 40 records.` |
| `SKIP=trufflehog pre-commit run --files <both files>` | all applicable hooks Passed |

Per-entry vocabulary audit (every `## ` section split and each of the five words counted):

| entry | words found |
| --- | --- |
| `REASON-01` | `implemented` ×1 |
| `FLOW-09` | `implemented` ×1 |
| `TESTQ-01` | `implemented` ×1 |
| `FLOW-07` | `implemented` ×2 — see the caveat below |
| `COV-01` | `superseded` ×1 |
| `AGCOL-01` | `evidence-only` ×1, `implemented` ×1 (inside "It is not implemented.") |
| `GAUTH-01` | `deferred` ×3, `implemented` ×1 (inside "It is not implemented,") |

**The `FLOW-07` caveat, stated rather than hidden.** Its verdict word appears once. The
second occurrence is the phrase "independently implemented gates" in the entry's ORIGINAL
text, preserved verbatim under `Original report follows.` as the plan requires. A verbatim
preservation requirement and an exactly-one-occurrence grep cannot both be satisfied when the
original text already contains the word; verbatim preservation wins, and the second occurrence
is history, not a verdict. Task 2's criterion — that `grep -c 'implemented'` grows only
through the phrase `not implemented` — held exactly: 6 → 8, both additions being
`It is not implemented`.

## Deviations from Plan

**1. [Rule 2 — record correctness] Commit scopes are semantic, not `{phase}-{plan}`**

- **Found during:** Task 1, at commit time
- **Issue:** The executor's default commit protocol prescribes
  `{type}({phase}-{plan}):`, which `CLAUDE.md` forbids ("Avoid GSD milestone/phases
  mentions" in commit messages).
- **Fix:** Both commits use `docs(backlog): …`. CLAUDE.md takes precedence over the
  generic protocol.
- **Commits:** `fada3a78`, `36a7a9e7`

**2. [Rule 3 — blocking] `gsd-tools query state.update-progress` not run**

- **Found during:** close-out
- **Issue:** The verb corrupts this workstream's progress frontmatter; all four prior waves
  hit it.
- **Fix:** `STATE.md` hand-edited (`completed_plans` 208 → 209; `percent` stays `44`, being
  phase-weighted at 4/9; `stopped_at`, `state_head`, Current Position narrative updated) and
  verified by diff. Only `roadmap.update-plan-progress` was called.

**3. [Rule 3 — blocking] `requirements.mark-complete` deliberately not run**

- **Found during:** close-out
- **Issue:** `CLOSE-02` already reads `Complete` across all three sealed carriers — 09-03
  flipped it. Re-running the verb risks touching a sealed carrier for no gain.
- **Fix:** Skipped; `node scripts/revalidation.mjs scope-impact --check` re-run after both
  task commits and still prints `Scope impact valid: 40 records.`

**Total deviations:** 3 auto-fixed (1 record correctness, 2 blocking). **Impact:** none on
the artifacts; all three are close-out mechanics.

## Known Stubs

None. This plan writes records only; it creates no code and no placeholder.

## Threat Flags

None. No file outside `.planning/` was modified; no network, auth, or filesystem surface was
touched.

## Issues Encountered

None.

## Next

Ready for `09-06`. The closure ledger must carry the same eight verdict words listed above,
in the same vocabulary, plus the two caveats D-09-16 and D-09-17 name. One item belongs in
its caveat set that is NOT in this plan's scope and NOT in the windows ledger: `WINDOWS.md`
entry 30's `resolved_at` had to stay `null`, because the rendered table's cell is empty and
the drift guard compares rendered output byte-for-byte, so populating it re-creates the
drift. Its description carries the date instead.

## Self-Check: PASSED

- `.planning/BACKLOG.md` — present, modified, committed in `fada3a78` and `36a7a9e7`.
- `.planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md` — present,
  modified, committed in `36a7a9e7`.
- `git log --oneline` shows both commit hashes on `features/refine-unit-tests`.
- All `<acceptance_criteria>` from both tasks re-run and passing (table above).
- Plan-level `<verification>` re-run: four entries with one verdict each, `REASON-01`'s grep
  quoted in its own entry, zero struck-through headings on the three evidence-only entries,
  and `scope-impact --check` at `Scope impact valid: 40 records.`
