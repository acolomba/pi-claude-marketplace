---
phase: 104-workflow-lifecycle-completion
plan: 06
subsystem: shared
tags: [workflows, notify, closed-set, reason-token, host-limitation]

# Dependency graph
requires:
  - phase: 104-workflow-lifecycle-completion
    provides: the sixth cascade slot, so `dropped.workflows` names what a removal actually removed
  - phase: 104-workflow-lifecycle-completion
    provides: update's workflows handle and its recorded-inventory guard
  - phase: 104-workflow-lifecycle-completion
    provides: reinstall's workflows handle and a record naming what the run staged
provides:
  - the `stale workflow command` reason token at the tuple tail (38 -> 39)
  - an optional reasons list on the previously reasons-less uninstalled variant
  - the byte-gated `stale-workflow-command` catalog state
  - four stamping verbs and two recorded non-stamps
affects: [105]

actuals:
  tokens: 9600
  tasks: 2
  commits: 4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - A closed-set order assertion anchors on a neighbouring member, never on the tuple's end, because later tokens append past the end
    - The gate for "did a removal happen" is what the removal REPORTED, never what the record named -- the record can be wrong in the direction that produces a false warning

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
    - extensions/pi-claude-marketplace/orchestrators/types.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts
    - docs/output-catalog.md

key-decisions:
  - "The reason tuple has 39 members after this plan, with `stale workflow command` at the tail. Phase 105's WDEP-04 token appends after it; nothing in this plan moved."
  - "Only the uninstall section gained a catalog state. The other three stamping verbs are covered by the closed-set gates plus per-verb render assertions, which keeps the catalog region additively amendable for the next phase rather than rewritten."
  - "The load-time reconcile non-stamp is STRUCTURAL, not conventional: the fact never joins the orchestrated outcome unions the projection consumes, so there is nothing there to spread even by accident."
  - "The marketplace-remove child rows do not stamp either, for a different reason recorded in place: the advisory is a per-plugin fact and those rows report a marketplace-wide removal that can span many plugins, where one reload closes all of them."
  - "The token composes at the brace TAIL on the update and reinstall rows -- after orphan rewake, malformed kinds and dropped kinds -- because it names what the operation took AWAY, while the established order describes what it wrote."

patterns-established:
  - "The negative half of each verb's pair asserts the WHOLE rendered block, not the token's absence. Absence alone passes on a stray summary line, which is the exact regression a severity raise can introduce."
  - "The uninstall and disable negatives seed a record naming an envelope the cascade does NOT remove, so a gate reading the recorded inventory's length fails them. The test shape encodes the gate's rationale."

requirements-completed: [WLIF-06]

coverage:
  - id: D1
    description: "An operation that removed at least one workflow tells the operator the removed command stays registered for the session and that reload is the remedy."
    requirement: "WLIF-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/uninstall.test.ts — 'WLIF-06 an uninstall that removed a workflow warns that its command stays registered' (RED observed: severity `undefined`, no brace); byte-asserts the whole block"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/enable-disable.test.ts — 'WLIF-06: a disable that removed a workflow warns that its command stays registered' (RED observed: severity `undefined`)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The row carrying the token renders at `warning` severity -- the middle arm of the tri-state model."
    requirement: "WLIF-06"
    verification:
      - kind: unit
        ref: "all four positive cases assert `severity === 'warning'` on the Pi API argument, not only the summary line; the catalog fixture carries `expectedSeverity: 'warning'`"
        status: pass
    human_judgment: false
  - id: D3
    description: "A plugin that removed no workflows renders byte-for-byte the row it rendered before: the reasons field is ABSENT, not an empty list."
    requirement: "WLIF-06"
    verification:
      - kind: unit
        ref: "the negative half of each verb's pair byte-asserts the full block (uninstall, disable, update pure-add, reinstall clean re-stage); each seeds a case where a length-based gate would have stamped"
        status: pass
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts — the untouched `success` and `success-soft-dep-omitted` states still byte-pair; `git diff docs/output-catalog.md | grep -c '^-'` returns 1 (the diff header alone), so no catalog line was removed"
        status: pass
    human_judgment: false
  - id: D4
    description: "The four user-typed verbs stamp; the load-time projection and the marketplace-remove child rows deliberately do not, recorded as a decision."
    requirement: "WLIF-06"
    verification:
      - kind: unit
        ref: "tests/architecture/notify-stamp-coverage.test.ts — 'WLIF-06: the reconcile-applied projection never stamps the lingering-command token', with a non-vacuity assertion that the sample carries the two removal rows that WOULD stamp on their standalone counterparts"
        status: pass
      - kind: other
        ref: "comment-stripped greps: `orchestrators/reconcile/notify.ts` → 0, `orchestrators/marketplace/remove.ts` → 0; `grep -rn 'stale workflow command' orchestrators/` → exactly 4 stamp sites (uninstall, enable-disable, update-row, reinstall)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A RENAME stamps the token exactly as a deletion does; a pure ADD does not."
    requirement: "WLIF-06"
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/update.test.ts — the removal/rename case stamps, the 'only ADDED a workflow' case renders the clean row; tests/orchestrators/plugin/reinstall.test.ts — the renamed-workflow case stamps, the clean re-stage does not"
        status: pass
    human_judgment: false
  - id: D6
    description: "The gate derives from what removal or re-staging reported, never from the recorded inventory's length."
    requirement: "WLIF-06"
    verification:
      - kind: unit
        ref: "the uninstall and disable negatives both seed a record NAMING an envelope the cascade does not remove; a length-based gate stamps there and fails the byte assertion"
        status: pass
      - kind: other
        ref: "code inspection: uninstall reads `localOutcome.dropped.workflows`, disable reads `cascade.dropped.workflows`, update and reinstall compute previous-minus-staged by exact string membership"
        status: pass
    human_judgment: false
  - id: D7
    description: "Reason-tuple membership AND order stay catalog-stable: the new token appends at the tail, no existing entry moves, and the length pin advances by exactly one."
    requirement: "WLIF-06"
    verification:
      - kind: other
        ref: "`node -e` against the live tuple: length 39, tail `stale workflow command`, asserted directly rather than through a gate this change edits; COMPAT-01 order array and the length pin both green"
        status: pass
    human_judgment: false
  - id: D8
    description: "The token has a topic-group home, without which the completeness proof fails to compile."
    requirement: "WLIF-06"
    verification:
      - kind: other
        ref: "`npm run typecheck` exits 0 with the literal in `CommandPrivateReason`; the `_ReasonsCoverageProof` TS2344 is what enforces it"
        status: pass
    human_judgment: false

# Metrics
duration: 55min
completed: 2026-08-15
status: complete
---

# Phase 104 Plan 06: The lingering workflow command Summary

**A removal that took a workflow now says so on its own row -- the removed command stays registered and runnable until reload, because the host exposes no unregister call -- and it says so only when a workflow was actually removed.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 2
- **Commits:** 4
- **Files modified:** 21 (0 created)

## Accomplishments

- **The fact has somewhere to live.** `stale workflow command` is the 39th member of the closed reason set, appended at the tail with the four artifacts a token needs: a topic-group home (or the completeness proof will not compile), a place in the order-pinned membership array, an advanced length pin, and a byte-gated catalog state with a paired fixture.
- **The uninstalled variant can carry a reason now.** It was one of the deliberately reasons-less render variants, and both render arms -- the central switch and uninstall's own render map -- hard-coded an absent list. Both thread `p.reasons` now while both soft-dependency flags stay hard-coded `false`, so MSG-SD-3 stays structural rather than becoming a convention.
- **A new catalog state, never an edit of the existing one.** `warning` severity makes `notify()` prepend a summary line, so the warning form is not a variation of the `success` block's bytes. The diff over `docs/output-catalog.md` removes no line at all.
- **The gate is what the removal reported.** Uninstall and disable read `dropped.workflows` off the cascade outcome; update and reinstall compute previous-names minus staged-names by exact string membership. That gate naturally covers a rename (which retires the old command exactly as a deletion does) and naturally excludes a pure addition, and it never asks the record how many workflows it named -- a record can name envelopes the cascade failed to remove.
- **Both non-stamps are recorded where the next reader will look.** The reconcile projection carries the decision and its rationale (a load-time cascade is not visible in the host interface, so a token stamped there is a message nobody reads), and the omission is structural: the fact never joins the orchestrated outcome unions that projection consumes. The `marketplace remove` child rows carry a different rationale in place: the advisory is per-plugin, those rows are marketplace-wide, and one reload closes all of them.

## Task Commits

1. **Task 1 RED — the three closed-set gates** — `59914ca3` (test)
2. **Task 1 GREEN — the token, the widened variant, the catalog state** — `6e473bb7` (feat)
3. **Task 2 RED — a positive/negative pair per verb, plus the projection guard** — `f0e1e3f4` (test)
4. **Task 2 GREEN — four stamping verbs, two recorded non-stamps** — `9a02e95d` (feat)

## Files Created/Modified

- `shared/notify.ts` — the tail token with its host-limitation comment; the `39-entry` correction and the command-private list; `PluginUninstalledMessage.reasons?` with the byte-neutrality contract; the central `uninstalled` render arm; the module doc's reasons-less/reasons-bearing split, recounted from the interface declarations (6 / 13, five of them optional) rather than from the previous, already-stale numbers.
- `shared/notify-reasons.ts` — the token in `CommandPrivateReason`; both header count sentences and the bump narration; the shared-topic doc's command-private enumeration.
- `orchestrators/plugin/uninstall.messaging.ts` — the command-local `uninstalled` arm threading `p.reasons`.
- `orchestrators/plugin/uninstall.ts` — a hoisted `removedWorkflow` set from the cascade outcome; the success row's reasons spread and severity; a note on the orchestrated arm stating why the fact does not join that union.
- `orchestrators/plugin/enable-disable.ts` — `staleWorkflowCommand` on the internal `fresh` sentinel (not on the exported outcome); the disable branch's derivation; a new `freshDisableRow` composer; a note on the orchestrated projection's spread list.
- `orchestrators/plugin/update.ts` + `update-row.ts` + `orchestrators/types.ts` — the retired-name computation off `preflight.record`, the outcome field, and the row composer's tail token plus a shared `raisedSeverity` helper covering the two axes that move the channel.
- `orchestrators/plugin/reinstall.ts` — the retired-name computation off `oldRecord`, the outcome field, and the reinstalled row's tail token and raise.
- `orchestrators/reconcile/notify.ts`, `orchestrators/marketplace/remove.ts` — comment-only: the two recorded non-stamps.
- `docs/output-catalog.md` — the `stale-workflow-command` state and three prose paragraphs (the host limitation and remedy; the severity and gate rationale; the three verbs covered without catalog states of their own, and the two surfaces that do not stamp).
- Tests — the three gate updates, the catalog fixture, four positive/negative pairs, the projection guard, and the re-anchored malformed-token order assertion.

## Decisions Made

- **The catalog fixture carries no `label` / `cardinality`.** The plan's action sentence, written from the reinstall analog, lists "the command's summary count line" in the block. Uninstall emits neither field -- it is a single-target op, and `notifyWithContext` renders the trailing tally only for `cardinality: "plural"` -- so a tally line in the block would have described output the verb cannot produce. The fixture mirrors what uninstall actually emits, verified by rendering it before writing the block.
- **The token composes at the brace tail on update and reinstall.** The established emit order (orphan rewake, malformed kinds, dropped kinds) describes what an operation WROTE. This token describes what it took away, so it sits after all three rather than being interleaved.
- **`raisedSeverity` is a named helper, not two inline ternaries.** Both update row forms need the same two-axis raise, and the orphan-rewake axis deliberately does not participate -- a fact worth stating once in a doc comment rather than twice in an expression.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A pre-existing order assertion anchored on the tuple's END, so any tail append breaks it**

- **Found during:** Task 2 verification (`npm run check`)
- **Issue:** `tests/shared/notify-v2.test.ts` asserted `REASONS.slice(-3)` equals `["malformed mcp", "malformed skill", "malformed command"]`. Its stated intent is that the two per-kind tokens sit immediately after `malformed mcp` and that `malformed mcp` keeps its position -- an invariant about a contiguous triple, not about distance from the end. Appending at the tail (which the tuple's own doc comment mandates) breaks the assertion without touching what it means to protect.
- **Fix:** re-anchored on `indexOf("malformed mcp")` and a three-element slice from there, with a comment stating why the end is not the anchor. Phase 105's own tail append will not trip it.
- **Files modified:** `tests/shared/notify-v2.test.ts`
- **Commit:** `9a02e95d`

**2. [Rule 3 - Blocking] `composeOutcomeRow` crossed the cognitive-complexity ceiling**

- **Found during:** Task 2 verification (`npm run lint`)
- **Issue:** adding the disable arm's reason spread and severity ternary took the switch from 15 to 19, over the project's `sonarjs/cognitive-complexity` ceiling of 15 (an error, not a warning).
- **Fix:** extracted `freshDisableRow`, mirroring the `freshEnableRow` extraction that already exists in the same file for the same reason. No disable directive was added.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`
- **Commit:** `9a02e95d`

**3. [Rule 3 - Blocking] The uninstall spread needed the closure-narrowing escape the file already uses**

- **Found during:** Task 2 GREEN (`npm run typecheck`, then `npm run lint`)
- **Issue:** `removedWorkflow` is assigned inside the `withLockedStateTransaction` closure, so TS narrows it to the literal `false` and `...(removedWorkflow && {...})` is TS2698 (a spread of a non-object). The same file already carries this trap for `alreadyGone`.
- **Fix:** derive a `readonly ContentReason[]` first and gate both the spread and the severity on `reasons.length > 0`, with the file's existing `no-unnecessary-condition` disable comment and its verbatim rationale on the one remaining narrowed branch.
- **Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.ts`
- **Commit:** `9a02e95d`

### Plan Statements Corrected

**4. [Acceptance-criterion wording] The stamp-site grep counts 4 only because the update composer is shared**

The criterion expects `grep -rn 'stale workflow command' orchestrators/` to return 4 for "exactly the four user-typed verbs' stamp sites". It does return 4 -- but the update site lives in `update-row.ts`, the leaf composer shared by the manual update cascade AND the marketplace autoupdate cascade. Both surfaces therefore stamp, which is correct (both are reachable from a user-typed command and both render a row the operator reads), and it means the count is 4 sites over five reachable surfaces rather than one site per surface.

**5. [Doc-comment count] The reasons-less/reasons-bearing split was stale by more than the two entries the plan expected**

The plan says the module doc's split is "already stale for two entries". Recounting from the interface declarations gives 7 reasons-less / 12 reasons-bearing BEFORE this change against a documented 9 / 10, and 6 / 13 after. The corrected sentence also names the five arms whose field is optional, where the old text named two.

## Issues Encountered

None beyond the deviations above.

## Verification

- `npm run check` exits 0 — typecheck, ESLint, Prettier, the unit suite (3653 tests, 0 fail, 1 pre-existing non-Linux skip) and the integration suite (18/18).
- RED was observed before GREEN on both tasks. Task 1: three gates red (COMPAT-01 order array, the 39 length pin, and the catalog inverse walk flagging the fixture as an orphan). Task 2: one red per verb, each on the severity or the brace, while every negative case passed from the start — which is the point of the pairs.
- `node --test` per suite after GREEN: uninstall 48/48, enable-disable 46/46, reinstall 91/91, update 107/107, catalog-uat + closed-set + COMPAT-01 24/24, notify-stamp-coverage 4/4.
- The tuple is asserted directly, not through a gate this change edits: `node -e "... REASONS.length === 39 && REASONS.at(-1) === 'stale workflow command'"` exits 0.
- `grep -c 'catalog-state: stale-workflow-command' docs/output-catalog.md` → 1. `git diff docs/output-catalog.md | grep -c '^-'` → 1, the diff header alone, so the existing uninstall success block lost no line.
- `grep -rniE '37-entry|38-entry' extensions/pi-claude-marketplace/shared/` → 0.
- Comment-stripped greps: `orchestrators/reconcile/notify.ts` and `orchestrators/marketplace/remove.ts` both → 0 for `workflow command`; `grep -rn 'stale workflow command' orchestrators/` → 4 (uninstall, enable-disable, update-row, reinstall).
- `npx eslint` on the changed source files — zero errors, including `sonarjs/cognitive-complexity`; the only disable directive added is the pre-existing closure-narrowing one, with its rationale.
- No line added by this plan cites a GSD process artifact: `git diff a9d68aa7..HEAD -- extensions tests | grep '^+' | grep -inE 'phase [0-9]|plan [0-9]|wave [0-9]|task [0-9]|milestone|pitfall [0-9]|pattern [0-9]'` returns nothing. The anchors used are `WLIF-06`, `NFR-2`, `UAT-02`, `MSG-SD-3`, `ENBL-18`, `NREG-01`, `OUT-08`, `WARN-01` and `D-03`/`D-06`.
- `STATE.md` and `ROADMAP.md` were not staged or modified by this plan. `STATE.md` carries an unrelated working-tree modification owned by the orchestrator, unchanged since before this plan started.

## Known Stubs

None.

## Threat Flags

None. The token is a fixed closed-set literal with no interpolation, so T-104-06-03 (path leakage through a rendered row) stays inapplicable; T-104-06-01 and T-104-06-02 are mitigated by the gate and the paired byte assertions; T-104-06-04 is addressed by asserting the tuple length and tail directly rather than only through the gates this change edits. No dependency manifest was touched (T-104-06-SC).

## User Setup Required

None.

## Self-Check: PASSED

All five key files exist on disk; all four task commits resolve in `git log`.

## Notes for the next phase

- **The reason tuple has 39 members. Phase 105's WDEP-04 token appends at the tail, after `stale workflow command`.** The four artifacts to touch are unchanged: the tuple (plus its count sentence), `CommandPrivateReason` or the appropriate topic group (plus both header count sentences), the COMPAT-01 order array, and the length pin with its title and comment ladder.
- **The catalog's uninstall section is additively amendable.** This plan added one state as a sibling and removed nothing; a second additive amendment lands cleanly.
- **The malformed-token order assertion in `tests/shared/notify-v2.test.ts` is now anchored on `malformed mcp`, not on the tuple's end,** so a further tail append does not trip it.
