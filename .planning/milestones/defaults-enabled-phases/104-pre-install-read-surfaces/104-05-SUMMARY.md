---
phase: 104-pre-install-read-surfaces
plan: 05
subsystem: ui
tags: [output-catalog, byte-equality, notify, reason-tokens, defaultEnabled, docs]

# Dependency graph
requires:
  - phase: 104-pre-install-read-surfaces
    plan: 02
    provides: "the list surface's `(available)` / `(remote)` install-disabled byte forms, and the D-80-03 narrowing in source that this plan carries into the two documents"
  - phase: 104-pre-install-read-surfaces
    plan: 03
    provides: "the info surface's `(available)` install-disabled byte form, taken from the shipped test expectation rather than re-derived"
provides:
  - "`available-installs-disabled` (list section) — catalog block + fixture, byte-guarded in both directions"
  - "`remote-installs-disabled` (list section) — catalog block + fixture"
  - "`available-installs-disabled` (info section) — catalog block + fixture, flat plugin-info shape"
  - "the `emit`-override precedent for a list-surface state whose reason brace is composed by `LIST_RENDER` rather than by the central row renderer"
  - "the narrowed unfetched-git-source prose in both user-facing documents: the status-token reference row, the remote inventory block's justification, the two message-union variant comments, and the field-discipline sentence"
affects: [105-parity-and-divergence-docs]

actuals:
  tokens: 5511
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "catalog `emit` override for a surface whose user-visible bytes come from its own `CommandContext` render map rather than from `notify()`'s central row renderer — the same hook the bulk-update no-op states use, extended to a per-row reason brace"
    - "row payload declared once and shared by a fixture's `message` and its `emit` closure, so the documented payload and the emitted one cannot drift"

key-files:
  created: []
  modified:
    - docs/output-catalog.md
    - tests/architecture/catalog-uat.test.ts
    - docs/messaging-style-guide.md

key-decisions:
  - "The two list-surface states are driven through `notifyWithContext(ctx, pi, LIST_CONTEXT, rows)` via the fixture `emit` override. Driving them through `notify()` documents a brace-less row no user ever sees for a declaring entry: the central `renderPluginRow` arms for `available` / `remote` omit `composeReasons` by construction (D-104-06), while `LIST_RENDER` composes it. `emit` is the fixture type's own sanctioned hook for exactly this — output produced by the orchestrator seam rather than by the renderer."
  - "The field-discipline sentence names SIX variants, not the five the plan's action text specified. `disabled` has carried an optional reasons field since ENBL-16 / D-100-07, so a list of five would have reintroduced the same class of defect this task exists to remove."
  - "The status-token reference table repads across all 21 rows. The amended `(remote)` cell is now the widest in its column, and mdformat — the pipeline that owns markdown here — repads the column as a consequence. No prose was reflowed and the JavaScript formatter was never run over a `.md` file."

patterns-established:
  - "A byte-equality block is only shown to be under the runner once it has been seen to FAIL. All three new blocks were mutated by one character in turn, each failure naming its own state and no other."
  - "When a documented surface has two renderers, the catalog must be paired with the one the user actually reaches. Pairing with the convenient one documents a form that is never emitted."

requirements-completed: [OUT-02, OUT-03]

coverage:
  - id: D1
    description: "The list surface's `(available)` install-disabled row is documented and byte-guarded: `  ○ helper v1.0.0 (available) {installs disabled}`, reusing the install section's plugin name so the pre-install and post-install rows read side by side."
    requirement: OUT-02
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify() (state=available-installs-disabled, section=/claude:plugin list)"
        status: pass
      - kind: manual
        ref: "mutation check — a doubled space inside the fenced block fails the runner naming exactly this state (see Mandated Checks)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The list surface's unfetched git-source install-disabled row is documented and byte-guarded: `  ◌ git-plugin v1.2.3 (remote) {installs disabled}`, placed immediately after the existing bare-row family so the two read as one narrowed rule."
    requirement: OUT-02
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT byte-equality walk (state=remote-installs-disabled, section=/claude:plugin list)"
        status: pass
      - kind: manual
        ref: "mutation check — a trailing space inside the brace fails the runner naming exactly this state"
        status: pass
    human_judgment: false
  - id: D3
    description: "The info surface's `(available)` install-disabled row is documented and byte-guarded, stated through the reason brace the row already had — the render differs from `available-single-scope` by that brace alone."
    requirement: OUT-03
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT byte-equality walk (state=available-installs-disabled, section=/claude:plugin info <plugin>@<marketplace>)"
        status: pass
      - kind: manual
        ref: "mutation check — one letter changed inside the brace fails the runner naming exactly this state"
        status: pass
    human_judgment: false
  - id: D4
    description: "The catalog gate is satisfied in BOTH directions: no documented state lacks a fixture, and no fixture lacks a catalog annotation."
    requirement: OUT-02
    verification:
      - kind: unit
        ref: "tests/architecture/catalog-uat.test.ts#catalog UAT inverse walk: every FIXTURES (section,state) has a matching catalog annotation (no orphan/stale fixture)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The existing unfetched-row block, its fenced bytes and its fixture are unchanged; the whole of Task 1 is additive."
    requirement: OUT-02
    verification:
      - kind: unit
        ref: "`git diff` for commit e28573b7 carries exactly one deletion, the import line it replaced; the catalog diff carries none"
        status: pass
    human_judgment: false
  - id: D6
    description: "Neither user-facing document still asserts that the unfetched git-source row carries no reason brace, nor that the two amended shapes have no reasons field."
    requirement: OUT-03
    verification:
      - kind: unit
        ref: "tests/architecture/partial-vocabulary-guard.test.ts (both documents in the guarded surface) — 354 architecture tests, 0 fail"
        status: pass
    human_judgment: true
    rationale: "That an amended sentence now says the right thing is a reading judgment. The diff shape is checkable and is recorded below; the prose accuracy is not."

# Metrics
duration: 15min
completed: 2026-08-15
status: complete
---

# Phase 104 Plan 05: Catalog blocks and the narrowed bare-row rule Summary

**The three pre-install install-disabled rows are now under the catalog's byte-equality runner in both directions — each demonstrated to fail on a one-character change — and the four sentences that still asserted the absolute bare-remote rule now state the narrowed one.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2
- **Files modified:** 3 (2 documents, 1 test); 0 created

## Accomplishments

- The two list-surface rows were pairing against the WRONG renderer, and the runner caught it on the first run. `notify()`'s central `renderPluginRow` omits `composeReasons` on the `available` and `remote` arms by construction; the brace a user actually sees is composed by `LIST_RENDER`. Both fixtures now drive `notifyWithContext(ctx, pi, LIST_CONTEXT, rows)` — the same seam `listPlugins` calls — through the fixture type's existing `emit` hook. Documenting the brace-less form instead would have frozen a row no user ever sees for a declaring entry.
- All three blocks were shown to be under the runner rather than assumed to be. Each was mutated by one character in turn (a letter, a trailing space, a doubled space); each failure named its own state and no other. The outputs are recorded below.
- The carry-over from the preceding plan is closed. Three documentation sites asserted an absolute rule the code had already narrowed. All three are amended, plus a fourth the plan named — and the narrowed sentences say what is still EXCLUDED, so the narrowing cannot later be read as blanket permission.
- The existing unfetched-row block is untouched. Its fixture entry declares nothing, so its bytes were never in question; what changed is the justification underneath it, which had rested on a claim that is still true but is no longer the reason the row is bare.
- The whole of Task 1 is additive: the catalog diff has zero deletions and the test diff has exactly one, the import line it widened.

## Task Commits

1. **Task 1: three block/fixture pairs, landed together** — `e28573b7` (docs)
2. **Task 2: stop two documents asserting the superseded rule** — `2b5fbf8b` (docs)

## Files Created/Modified

- `docs/output-catalog.md` — three new `### ` blocks with their state markers and fenced byte forms (`available-installs-disabled` and `remote-installs-disabled` under the list section, `available-installs-disabled` under the info section); the status-token reference row for `(remote)` narrowed; the `remote-inventory` block's justification replaced. Its fenced bytes, its marker and its heading are byte-unchanged.
- `tests/architecture/catalog-uat.test.ts` — three fixtures, each preceded by the compressed-restatement comment the section's other fixtures carry; two module-level row constants shared by the list fixtures' `message` and `emit`; `LIST_CONTEXT` and `notifyWithContext` added to the imports.
- `docs/messaging-style-guide.md` — the two message-union variant comments for `PluginAvailableMessage` / `PluginRemoteMessage`, and the field-discipline sentence. Three changed lines, nothing else moved.

## Decisions Made

Three judgment calls, all recorded in the frontmatter and expanded here:

- **The `emit` override for the two list states.** Discussed above. Worth noting what it does NOT do: it changes no production file, and it leaves every other list-section fixture on the `notify()` path. The two new fixtures carry a comment saying why they differ, so the asymmetry reads as a fact about the two renderers rather than as an inconsistency.
- **Row payloads declared once.** Each list fixture's `message` and its `emit` closure reference the same module-level constant. A second copy would let the documented payload and the emitted one diverge with nothing to catch it, since the driver byte-pairs only what `emit` produces.
- **The plan's own placement instruction was followed literally.** State 1 sits immediately before the `remote-inventory` family and state 2 immediately after it, so both are adjacent to the family and the bare row and the declaring row read as one rule.

## Mandated Checks

### Mutation check — all three new blocks are genuinely under the runner (Task 1)

Each new fenced block was mutated by one character, the runner was run, and the edit was discarded. Every failure named exactly one state — its own:

```
[BYTE MISMATCH] section=/claude:plugin info <plugin>@<marketplace> state=available-installs-disabled
--- expected ---
  ○ chat-helper v0.5.0 (available) {installs disabIed}
--- actual ---
  ○ chat-helper v0.5.0 (available) {installs disabled}

[BYTE MISMATCH] section=/claude:plugin list state=remote-installs-disabled
--- expected ---
  ◌ git-plugin v1.2.3 (remote) {installs disabled }
--- actual ---
  ◌ git-plugin v1.2.3 (remote) {installs disabled}

[BYTE MISMATCH] section=/claude:plugin list state=available-installs-disabled
--- expected ---
  ○ helper v1.0.0 (available) {installs  disabled}
--- actual ---
  ○ helper v1.0.0 (available) {installs disabled}
```

Each run reported `catalog UAT failures (1)` — one failure, not several — so the three blocks discriminate from one another rather than being enforced collectively. All three edits were reverted and the suite returned to 6/6.

## Deviations from Plan

No deviation rule (1-4) was invoked and no auto-fix was needed. Three items where the plan as written could not be followed literally; in each case the plan's stated INTENT was met and the evidence is below.

### 1. The two list fixtures use the `emit` override rather than the plain `notify()` path

The plan's action text says to clone the `remote-inventory` fixture "adding ONLY the reasons array carrying the one token". Done exactly that way, the runner failed:

```
[BYTE MISMATCH] section=/claude:plugin list state=available-installs-disabled
--- expected ---   ○ helper v1.0.0 (available) {installs disabled}
--- actual ---     ○ helper v1.0.0 (available)
[BYTE MISMATCH] section=/claude:plugin list state=remote-installs-disabled
--- expected ---   ◌ git-plugin v1.2.3 (remote) {installs disabled}
--- actual ---     ◌ git-plugin v1.2.3 (remote)
```

The cause is a decision the preceding plan recorded deliberately: the central `renderPluginRow` arms for `available` and `remote` do not call `composeReasons`, because no producer that renders through them stamps `reasons` (D-104-06). The list surface's own `LIST_RENDER` map does. Verified directly against the seam `listPlugins` calls:

```
notifyWithContext(ctx, pi, LIST_CONTEXT, rows)
→ "● official [user] <autoupdate>\n  ○ helper v1.0.0 (available) {installs disabled}\n  ◌ git-plugin v1.2.3 (remote) {installs disabled}"
```

one `ctx.ui.notify` call, no severity argument, no headline — byte-identical to the documented blocks. The `emit` field exists on `CatalogFixture` for precisely this case and its doc comment says so: "an optional emit override for catalog states whose user-visible output is produced by the ORCHESTRATOR, not by `notify()`". The prohibition on editing production files was honoured; nothing under `extensions/` was touched by either task.

### 2. The field-discipline sentence names six variants, not five

The plan says to "extend the list to five by naming the two not-installed candidate shapes". Five would be wrong. `PluginDisabledMessage` has carried an optional reasons field since ENBL-16 / D-100-07, and the sentence's existing count of three was already stale by one before this plan touched it:

```
$ grep -c 'reasons?: readonly ContentReason\[\]' extensions/pi-claude-marketplace/shared/notify.ts
```

resolves to six plugin-message interfaces — `installed`, `updated`, `reinstalled`, `disabled`, `available`, `remote`. Writing five and silently omitting `disabled` would have reintroduced exactly the class of defect this task exists to remove. The sentence now names four transition variants and two not-installed candidate variants, preserving the transition/candidate distinction the original wording drew, and the closing clause no longer claims a totality — it points at `notify.ts` as the authority. Every acceptance criterion for the task is unaffected: the change stays inside that one sentence and no other line moved.

### 3. The status-token reference table repads

The acceptance criterion asks for "no reflow-only churn ... evidence the JavaScript formatter was not run over them". The JavaScript formatter was never run over a `.md` file, and `npm run format:check` exits 0. The catalog diff nonetheless carries 21 whitespace-only table lines: the amended `(remote)` cell is now the widest in its column (523 characters against a previous column width of 412), so mdformat — the hook that owns markdown here — repads the column. The trailing clause was trimmed once to reduce it; the plan's own prescribed wording for this sentence is ~445 characters, so no faithful version of the required sentence fits under the old width. The churn is mechanical, hook-generated, and confined to column padding; no prose line was reflowed.

---

**Total deviations:** 0 auto-fixed. 3 documented plan-vs-reality gaps, each with its intent met.
**Impact on plan:** None on scope. Item 1 is the substantive one — without it the catalog would have documented a row form the list surface never emits.

## Issues Encountered

- **`trufflehog` fails structurally in this worktree**, as CLAUDE.md documents (`failed to read index file: .../.git/index: not a directory` — `.git` is a file in a linked worktree). Handled by the sanctioned route on both commits: a `trufflehog filesystem` scan over the committed paths at `--results=verified,unknown --fail`, clean each time (0 verified, 0 unverified), then `SKIP=trufflehog` on that commit alone. No other hook was skipped; `--no-verify` was never used.
- **Shared-worktree hygiene.** A sibling executor held `orchestrators/plugin/list.ts`, `tests/orchestrators/plugin/list.test.ts`, `tests/orchestrators/plugin/info.test.ts` and `tests/shared/notify-not-installed-reasons.test.ts` modified in the tree throughout. Both commits used the pathspec form (`git commit -F <msg> -- <my paths>`), and `git show --name-only` confirms each contains exactly my files. A `npm run format:check` warning on the sibling's `notify-not-installed-reasons.test.ts` was left alone.
- Nothing else. No blocked task, no auth gate, no package install, no checkpoint.

## Known Stubs

None. All three documented states are paired with a live fixture and proven by byte equality, and each has been observed to fail.

Scope note, not a stub: the fourth positive byte form the preceding plan pinned — the degraded combination `{network unreachable, installs disabled}` — deliberately has NO catalog block. Three states were locked by CONTEXT; a fourth would exceed that. It is byte-pinned by an orchestrator-level assertion either way.

## Threat Flags

None. No new network, file or auth surface. The documented byte forms hold only frozen closed-set literals and fixture-supplied names; no third-party string is interpolated into a token (T-104-01, disposition `accept`, unchanged). T-104-08 and T-104-09 are both mitigated as the plan specified — the first by three block/fixture pairs whose guard was demonstrated rather than assumed, the second by four sentence corrections that name what is still excluded.

## Verification Run

| Command | Result |
|---|---|
| `node --test tests/architecture/catalog-uat.test.ts` | 6/6 pass |
| `node --test "tests/architecture/**/*.test.ts"` | 354 tests, 353 pass, 0 fail, 1 skip (pre-existing) |
| `npm run typecheck` | exit 0 |
| `npx eslint tests/architecture/catalog-uat.test.ts` | exit 0 |
| `npm run format:check` | exit 0 for my files (one warning on a sibling-owned file mid-edit) |
| `pre-commit run --files <my paths>` | all hooks pass except the structurally-broken `trufflehog` |

`npm test` and `npm run check` were deliberately NOT run: a sibling executor was mid-edit in the shared worktree throughout, so a full-suite result would report their in-progress state as this plan's. The phase-boundary gate belongs to the orchestrator.

## Acceptance Criteria Evidence

| Criterion | Expected | Actual |
|---|---|---|
| `grep -c 'catalog-state: available-installs-disabled' docs/output-catalog.md` | 2 | 2 |
| `grep -c 'catalog-state: remote-installs-disabled' docs/output-catalog.md` | 1 | 1 |
| `grep -c 'available-installs-disabled' tests/architecture/catalog-uat.test.ts` | 2 | 2 |
| `grep -c 'remote-installs-disabled' tests/architecture/catalog-uat.test.ts` | 1 | 1 |
| Existing unfetched-row block + fixture unchanged | unchanged | catalog diff has 0 deletions; test diff has 1 (the widened import line) |
| `git diff --name-only -- extensions/` for both tasks | empty | empty — both commits carry only my files |
| Task 2 diff shape | 2 variant comment lines + 1 field-discipline sentence | 3 changed lines in the style guide, nothing else moved |
| Task 2 catalog diff touches only prose | no fenced or marker line | 1 prose line + the mechanical table repad (see Deviations) |
| `npm run format:check` | exit 0 | exit 0 |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Ready. What the parity-and-divergence documentation inherits:

- Every documented pre-install install-disabled row is now byte-guarded, so a later change to any of the three forms breaks a named test rather than drifting the contract silently.
- Both user-facing documents state the narrowed rule, and each says what is still excluded. A later reader cannot take the narrowing as permission to put probe-derived or soft-dependency-derived reasons on an unfetched row.
- The `emit` precedent is now established for a per-row reason brace, not just for a cascade headline. Any future catalog state on a surface whose brace is composed by its own `CommandContext` should follow it, and the two new fixtures carry the comment explaining when that applies.
- One asymmetry remains and is deliberate: the central `renderPluginRow` arms for `available` / `remote` still drop `reasons`. Their comments say the drop is correct by construction. If a producer ever renders a declaring row through THAT path, the comment stops being true and the arm needs the composer — the catalog will not catch it, because the catalog now pairs those states with the other renderer.

## Self-Check: PASSED

- `docs/output-catalog.md` — FOUND (3 new state markers, narrowed token row and block prose)
- `tests/architecture/catalog-uat.test.ts` — FOUND (3 new fixture keys, 6/6 tests pass)
- `docs/messaging-style-guide.md` — FOUND (both variant comments and the field-discipline sentence amended)
- Commit `e28573b7` — FOUND
- Commit `2b5fbf8b` — FOUND
- `extensions/` — absent from both commits' file lists

---
*Phase: 104-pre-install-read-surfaces*
*Completed: 2026-08-15*
