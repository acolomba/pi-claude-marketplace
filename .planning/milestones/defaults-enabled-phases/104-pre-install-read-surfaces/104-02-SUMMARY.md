---
phase: 104-pre-install-read-surfaces
plan: 02
subsystem: ui
tags: [notify, list, reason-tokens, defaultEnabled, remote-row, closed-set]

# Dependency graph
requires:
  - phase: 104-pre-install-read-surfaces
    plan: 01
    provides: "`entryDeclaresInstallDisabled`, the `installsDisabledField` conditional-spread const, and the `PluginAvailableMessage.reasons?` template this plan mirrors onto the remote shape"
provides:
  - "`PluginRemoteMessage.reasons?` — the optional reason field on the `(remote)` list/info row, with D-80-03's bare-row rule narrowed rather than reversed"
  - "the list `remote` render arm composing the row's own reasons, both soft-dep flags hard-coded false"
  - "the cold-clone early return and the `partially-available` arm both stamping the entry-derived token"
  - "two by-construction comments recording why the central row renderer and the fetch surface's remote arm still drop the field"
  - "four byte-equal list assertions: the cold-remote positive with its silent twin, the tail-order composition, both unavailable negatives, and the installed-row negative"
affects: [104-03-info-surface, 104-04-behavioral-offline-proof, 104-05-catalog-and-docs, 105-parity-and-divergence-docs]

actuals:
  tokens: 4533
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "narrowing a documented contract in one deliberate pass: every comment and doc sentence asserting the absolute form is amended in the same change that falsifies it, with the reference list enumerated up front rather than discovered incrementally"
    - "by-construction comment at a non-forwarding render arm: when a new optional field is droppable on some arms, each such arm records that its producer never stamps it, so the drop reads as correct rather than as an oversight"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts
    - tests/orchestrators/plugin/list.test.ts

key-decisions:
  - "D-104-06: the bare-`(remote)`-row rule NARROWS. The row still refuses every probe-derived reason and every soft-dependency marker — there is no materialized tree to derive either from — and admits exactly one entry-derived token, which needs no tree at all."
  - "D-104-06 (the two other arms): the central row renderer and the fetch surface's remote arm are comment-only. Their producers never stamp `reasons`, so the drop is correct by construction; forwarding would be dead plumbing."
  - "D-104-03: the `partially-available` arm composes the token into its existing REQUIRED reasons array rather than spreading the field object, and the tail position is asserted because the brace composer joins in array order with no per-row sort."
  - "D-104-03: both `unavailable` paths stay excluded, and the exclusion is asserted on both — the structural resolver arm and the probe-failure catch are two paths under one rule."

patterns-established:
  - "Cold-row proof by fixture absence: the strongest evidence that a claim is entry-derived is a row with no tree at all behind it. Seeding two cold git sources — one declaring, one silent — proves the source and the no-op parity in a single byte-equal body."
  - "Paired positive/negative placement: the new positive assertion sits directly beside the pre-existing bare-row assertion whose comment it narrows, so the two read as ONE rule rather than as two contradicting ones."

requirements-completed: [OUT-02, OUT-05]

coverage:
  - id: D1
    description: "A `/claude:plugin list` `(remote)` row renders `  ◌ delta v1.0.0 (remote) {installs disabled}` for a git-source plugin with NO clone materialized anywhere on disk."
    requirement: OUT-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#OUT-02 / OUT-05 / D-104-06: a COLD git-source entry declaring `defaultEnabled: false` carries `{installs disabled}` on its `(remote)` row; a silent cold entry stays bare"
        status: pass
    human_judgment: false
  - id: D2
    description: "A cold entry that declares nothing renders the bare row byte-identically to before the token existed — the no-op parity on the `(remote)` arm."
    requirement: OUT-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#OUT-02 / OUT-05 / D-104-06 (the `epsilon` row of the same whole-body assertion)"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#RSTA-01 / D-80-03: a not-installed git source with no clone renders bare `◌ <name> (remote)` — pre-existing, unchanged assertion"
        status: pass
    human_judgment: false
  - id: D3
    description: "On a row that already carries reasons the token appends at the TAIL: `  ⊖ zeta v1.0.0 (partially-available) {lsp, installs disabled}`."
    requirement: OUT-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#OUT-02 / D-104-03: on a `(partially-available)` row the author-declared token appends at the TAIL, after the degrade tokens"
        status: pass
    human_judgment: false
  - id: D4
    description: "Neither `(unavailable)` arm acquires the token — not the structural resolver arm, not the probe-failure catch — even when the entry declares."
    requirement: OUT-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#D-104-03: NEITHER `(unavailable)` path acquires the token"
        status: pass
      - kind: unit
        ref: "mutation check — stamping the structural arm fails exactly this test (see Mandated Checks)"
        status: pass
    human_judgment: false
  - id: D5
    description: "An installed plugin's row never acquires the token; the guarantee is the absence of an edit, not a runtime guard."
    requirement: OUT-02
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#OUT-02 / D-104-03 / D-95-02: an INSTALLED plugin's row never acquires the token"
        status: pass
    human_judgment: false
  - id: D6
    description: "The fetch surface and the central row renderer are unchanged in behavior, and each records in one line why dropping the field is correct there."
    requirement: OUT-05
    verification:
      - kind: unit
        ref: "git diff over both arms is comment-only; `node --test tests/orchestrators/plugin/fetch.test.ts` unchanged and green"
        status: pass
    human_judgment: true
    rationale: "That a comment and its code agree is a reading judgment; the diff shape is checkable, the prose accuracy is not."

# Metrics
duration: 25min
completed: 2026-08-15
status: complete
---

# Phase 104 Plan 02: The `(remote)` and `(partially-available)` arms Summary

**A git-source plugin with no clone anywhere on disk now says `{installs disabled}` on its `/claude:plugin list` row — the claim is entry-derived, so it survives having no tree to read — and a partially-available row says it after its degrade tokens, while both `(unavailable)` paths and every installed row are proven to stay clean.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-15T18:16:00Z (approx — first read)
- **Completed:** 2026-08-15T18:41:04Z
- **Tasks:** 2
- **Files modified:** 5 (4 source, 1 test); 0 created

## Accomplishments

- The phase's real argument is now executable rather than asserted in prose: the cold-remote test seeds two git sources with **no mirror staged for either**, and one row carries the brace while the other stays bare. With no tree behind either row, the claim can only have come from the marketplace entry. That is what makes the warning reachable for the user who is furthest from having run the install.
- D-80-03 was narrowed in one deliberate pass rather than opportunistically. Three source comments (the `PluginRemoteMessage` doc, the central render arm, the list render arm) and one test comment now state the narrowed rule; the research's enumerated reference list meant nothing had to be rediscovered mid-edit.
- The tail position of the token inside a multi-token brace is pinned by bytes, not left to chance. Reversing the two tokens in the expected value fails the test, which is what makes a later reordering a caught behavior change rather than a silent one.
- Both `(unavailable)` paths are covered by one assertion that names both, and the mutation check confirms it discriminates: stamping the structural arm fails exactly that test and nothing else.
- The two arms that keep dropping the field got a one-line justification each. `git diff` on `fetch.messaging.ts` is comment-only; `notify.ts` gained exactly one non-comment line, the field itself.

## Task Commits

1. **Task 1: the `(remote)` and `(partially-available)` arms carry the token** — `9131439a` (feat)
2. **Task 2: the four list-surface assertions** — `7a5c76c3` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/shared/notify.ts` — `PluginRemoteMessage` gains `readonly reasons?: readonly ContentReason[]`. Its doc's `NO reasons` clause is replaced by the narrowed paragraph: what the row still refuses (probe-derived reasons, soft-dep markers, because no tree exists to derive them from), what it admits (exactly one entry-derived token), and why the token needs no tree. Separately, the central `renderPluginRow` remote arm's D-80-03 sentence is narrowed and gains the by-construction line. **The arm's code is unchanged.**
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` — the `remote` arm gains `composeReasons(p.reasons, false, false, probe)` as its last token and drops the leading underscore on its now-used probe parameter. Both soft-dep flags stay hard-coded `false`, matching the sibling `available` arm exactly.
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — `installsDisabledField` is now spread into the cold-clone early return as well as the `installable` arm. The `partially-available` arm composes the token into its existing required array instead. One comment added at the structural `unavailable` arm stating the permanent exclusion and covering the probe-failure catch below it.
- `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts` — one comment line. No code change.
- `tests/orchestrators/plugin/list.test.ts` — four new cases (76 → 80 tests), all whole-body `assert.equal`. The pre-existing bare-remote assertion's inline comment is narrowed in place; its `assert.equal` line is byte-unchanged.

## Decisions Made

None beyond the plan — every design call was settled by CONTEXT, by research, or by the orchestrator before planning. Three judgment calls worth recording:

- **The `partially-available` fixture is a path source, not a warm mirror.** The plan's action text suggested staging a warm git mirror; its `read_first` instead said to find an existing `(partially-available)` case and reuse its fixture shape. The existing shape (`lspServers: { ls: {} }` plus an on-disk dir, from the `LIST-01 / D-67-01` case) reaches the identical code path — the arm is downstream of `resolveStrict`'s verdict, not of the source kind — with no helper widening at all. Reuse won, so `stageWarmMirror` was **not** widened and the `pluginJson?` parameter listed in the plan's artifact table was not added.
- **The `partially-available` arm calls the predicate a second time rather than reading `installsDisabledField.reasons`.** Reusing the already-computed field object would have been marginally tidier, but it would have put a fourth `installsDisabledField` occurrence in the file and broken the plan's own grep criterion of exactly three. The criterion is expressing a real intent — the field object is the *spread* idiom, and this arm is not spreading — so the second predicate call is the shape the plan asked for.
- **Case 3 asserts both unavailable paths in ONE test rather than two.** The plan allowed either. One test with one whole-body assertion covering both rows makes the shared rule visible in a single title and a single expected value; two tests would have implied two rules.

## Mandated Checks

### Mutation check — the structural `(unavailable)` exclusion (Task 2)

Stamped the token into the structural `unavailable` arm of `orchestrators/plugin/list.ts` (the same array-spread composition the `partially-available` arm uses), ran `node --test tests/orchestrators/plugin/list.test.ts`, then restored the file. **Exactly one test failed — Case 3, and only Case 3:**

```
not ok 10 - D-104-03: NEITHER `(unavailable)` path acquires the token -- not the
            structural resolver arm, not the probe-failure catch -- though both
            entries declare `defaultEnabled: false`
    +   '  ⊘ gone v1.0.0 (unavailable) {unsupported source, installs disabled}'
# tests 80
# pass 79
# fail 1
```

Two things this confirms beyond "the test fires". First, the `bad/name` row — the probe-failure catch, which the mutation did **not** touch — stayed clean in the same run, so the assertion discriminates between the two unavailable paths rather than collapsing them. Second, no other test moved, so the exclusion is not being enforced incidentally by some unrelated byte assertion. `git diff --name-only -- extensions/` was empty after the restore and the suite returned to 80/80.

## Deviations from Plan

No deviation rule (1-4) was invoked; no auto-fix was needed. Two acceptance criteria as *written* could not be satisfied literally, and in both cases the criterion's stated intent was met:

**1. The `composeReasons` grep count is 6, not the specified 5.**

The criterion reads: *"returns 5 — the import plus four arms that compose (`available`, `unavailable`, `partially-available`, `remote`)"*. The enumeration omits the `disabled` arm, which has composed reasons since ENBL-16 / D-100-07. Measured against `HEAD` before this plan, the baseline was already **5** (import + `available` + `unavailable` + `partially-available` + `disabled`), so the post-change count is **6**. The criterion's own diagnostic — *"A count of 4 means the remote arm did not gain its composer"* — is satisfied: exactly one occurrence was added, at the remote arm. This is a planner arithmetic slip against the file, not a defect in the change.

**2. Task 1 is marked `tdd="true"` but its acceptance criteria forbid touching any test file.**

Task 1's criteria require `git diff --name-only` to list exactly four files, none of them tests, and require the existing list/fetch assertions to pass **unedited**. A RED-first test could not be written inside those bounds; the plan structurally assigns all four assertions to Task 2. Executed as written — code in Task 1, assertions in Task 2 — with the acceptance criteria treated as the binding contract. Both Task 1 verification commands passed on the unedited pre-existing corpus (93/93 across list + fetch), which is the inertness evidence the tdd flag would otherwise have been buying.

## Issues Encountered

**Shared-index cross-commit with the parallel sibling — one file swept in, nothing lost.**

Task 1's commit reports **5 files changed**, not the 4 I staged. The fifth is `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` (96 insertions), owned by the concurrent 104-03 executor. The mechanism is that a git worktree has ONE index: the sibling ran `git add` on their file between my `git add` and my `git commit`, and `git commit` commits the whole index regardless of what the invoking agent staged.

Assessed and deliberately **not** "fixed":

- **Nothing was lost or corrupted.** `git diff HEAD -- .../info.ts` was empty immediately afterward, so the committed content is exactly the sibling's working-tree state. Their work is intact on the branch under my commit message.
- **The tree stayed green.** The pre-commit run for that commit typechecked and linted the whole project, and `node --test "tests/orchestrators/plugin/*.test.ts"` later passed 790/790 including their suite.
- **No recovery was attempted.** Reverting `info.ts` would have rewritten a file I do not own out of the sibling's working tree; rewriting history is forbidden outright. Per the parallel-execution brief, a sibling's file is not to be touched, reverted, or fixed.

**Mitigation applied from Task 2 onward:** commit with an explicit pathspec — `git commit -F <msg> -- <path>` — which commits the working-tree content of the named paths and ignores the rest of the index. Task 2's commit contains exactly one file, confirmed by `git show --name-only`. **Any future executor sharing a worktree should use the pathspec form for every commit**; `git add` followed by a bare `git commit` is not safe against a concurrent stager.

The only consequence for the sibling is bookkeeping: their SUMMARY may attribute `info.ts` to a commit hash that is mine (`9131439a`) rather than theirs (`28c4eda6`).

**The `trufflehog` pre-commit hook fails structurally in this worktree**, exactly as CLAUDE.md documents (`failed to read index file: .../.git/index: not a directory`). Handled by the sanctioned route: a `trufflehog filesystem` scan over the committed paths at `--results=verified,unknown --fail` before each commit — clean both times (0 verified, 0 unverified) — then `SKIP=trufflehog` on that commit alone. Every other hook passed on every commit. No `--no-verify` anywhere.

Nothing else. No blocked task, no auth gate, no package install, no checkpoint.

## Known Stubs

None. Every path this plan added is wired to a real data source and proven by a byte-level assertion.

Scope notes, not stubs:

- The `info` surface is still untouched by this plan — it is the concurrent sibling's work (104-03), not unfinished work left here.
- The catalog blocks in `docs/output-catalog.md` and the two doc prose sentences that state D-80-03's absolute form (`docs/output-catalog.md:144` and `:380`, plus `docs/messaging-style-guide.md:41-42`) are **not** amended here. This plan's file list does not include them; the phase's later plans own the documentation half. Until then the two docs assert an absolute bare-remote rule the code has narrowed — worth flagging to whoever picks up the doc sweep, because that is exactly the "comment contradicting the code" failure this plan spent Task 1 avoiding in source.

## Verification Run

| Command | Result |
|---|---|
| `node --test tests/orchestrators/plugin/list.test.ts` | 80/80 pass (76 before this plan; +4) |
| `node --test tests/orchestrators/plugin/list.test.ts tests/orchestrators/plugin/fetch.test.ts` (Task 1) | 93/93 pass, no existing assertion edited |
| `node --test "tests/shared/**/*.test.ts"` | 338/338 pass |
| `node --test "tests/orchestrators/plugin/*.test.ts"` | 790/790 pass, 0 fail, 0 skip |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run format:check` | exit 0 |

`npm test` and `npm run check` were deliberately NOT run: the sibling executor was mid-edit in the shared worktree throughout, so a full-suite result would have reported their in-progress state as this plan's. The phase-boundary gates belong to `104-04` / `104-05`.

Acceptance-criteria greps, all measured after the change:

| Check | Expected | Actual |
|---|---|---|
| `composeReasons` in `list.messaging.ts`, comments excluded | 5 (see Deviations) | 6 — baseline 5, exactly one added at the remote arm |
| `_probe` in `list.messaging.ts`, comments excluded | 0 | 0 |
| `installsDisabledField` in `list.ts`, comments excluded | 3 | 3 (declaration + 2 spreads) |
| `fetch.messaging.ts` diff | comment-only | comment-only |
| `notify.ts` non-comment added lines | 1 | 1 (`readonly reasons?: readonly ContentReason[];`) |
| Task 2 `git diff --name-only -- extensions/` | empty | empty |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

Ready. What the later plans inherit:

- Every list-surface arm is decided and pinned. `104-04`'s behavioral offline proof can assert against the cold-remote fixture in this file (two cold git sources, no mirror staged) rather than building its own.
- `PluginRemoteMessage.reasons?` is live and its doc carries the narrowed rule, so the info surface can rely on the shape without re-litigating D-80-03.
- The documentation half of the narrowing is outstanding and enumerated in Known Stubs above. The catalog carries a byte-equality runner, so the new `remote-installs-disabled` row form is currently undocumented and therefore unguarded at the catalog layer — that gap closes when the catalog blocks land.
- The carried item from the tracer stands unchanged: the pre-existing NFR-5 behavioral guard near this file's tail (`readFile` on a directory) proves nothing and was left alone under the surgical-changes rule.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/shared/notify.ts` — FOUND (`PluginRemoteMessage` carries `reasons?`)
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts` — FOUND (remote arm composes)
- `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` — FOUND (`installsDisabledField` ×3)
- `extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts` — FOUND (comment-only diff)
- `tests/orchestrators/plugin/list.test.ts` — FOUND (`installs disabled` present, 80 tests)
- Commit `9131439a` — FOUND
- Commit `7a5c76c3` — FOUND
- `tests/orchestrators/plugin/info.test.ts` — NOT committed by this plan (sibling-owned, left modified in the working tree)

---
*Phase: 104-pre-install-read-surfaces*
*Completed: 2026-08-15*
