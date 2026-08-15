---
phase: 104-pre-install-read-surfaces
plan: 03
subsystem: ui
tags: [notify, info, reason-tokens, defaultEnabled, row-composer, total-map]

# Dependency graph
requires:
  - phase: 104-pre-install-read-surfaces
    plan: 01
    provides: "`entryDeclaresInstallDisabled(entry)` — the exported one-parameter domain predicate this surface consumes unchanged"
  - phase: 102-install-surface
    provides: "the `installs disabled` reason token, reused with zero closed-set growth"
provides:
  - "`applyInstallDisabledRowShape(row, entry)` — the module-private post-hoc row composer applied at the single not-installed consumer in `info.ts`"
  - "`INSTALL_DISABLED_ROW_STATUSES` — the total status map pinned `as const satisfies Record<PluginInfoRow[\"status\"], boolean>`, making a ninth info status a compile error at this site"
  - "eight info-surface byte-equal assertions: four positive rows, four negative rows, every one pinning severity as absent"
affects: [104-04-behavioral-offline-proof, 104-05-catalog-and-docs, 105-parity-and-divergence-docs]

actuals:
  tokens: 5074
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "total-map status gate: where a runtime membership set would let a future union member inherit a default silently, an `as const satisfies Record<Union, boolean>` turns the omission into a compile error at the deciding site"
    - "one composer at the single consumer beats threading a flag through many producers when the deciding datum is in scope only at the consumer"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - tests/orchestrators/plugin/info.test.ts

key-decisions:
  - "D-104-05: the claim is applied ONCE at the single not-installed consumer, never at the eight return sites across five builders — three of those builders never receive the entry, so a threading approach could not reach them without five signature edits and would still silently miss a sixth builder added later"
  - "D-104-05: the status gate is a TOTAL map, not a `ReadonlySet`. Verified by hand: removing one key produces two compile errors (TS1360 + TS7053), so a ninth info status cannot slip past silently"
  - "D-104-04: a degraded `(remote)` row carries both the read failure and the author-declared token in one brace, failure first — the two facts answer different questions and neither suppresses the other"
  - "The info row shape and the info renderer were NOT edited: `PluginInfoRowBase` already declares the optional reasons field and `renderPluginInfo` already composes it for every info status"

patterns-established:
  - "Line-by-line render comparison as a grammar proof: to show a fact is stated through an existing brace rather than a new body line, assert equal line counts, deep-equal non-row lines, and a row line differing by the brace alone. Two separate byte assertions do not state that claim."
  - "A negative test seeds the input that WOULD trigger the behavior. A negative whose fixture declares nothing proves nothing."

requirements-completed: [OUT-03, OUT-05]

coverage:
  - id: D1
    description: "A `/claude:plugin info` `(available)` row carries `{installs disabled}` when the marketplace entry declares the install-time default false."
    requirement: OUT-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#OUT-03 / D-104-05: an entry declaring `defaultEnabled: false` puts `{installs disabled}` on its `(available)` info row, and a declared-true entry differs by exactly that brace"
        status: pass
    human_judgment: false
  - id: D2
    description: "The fact is stated through the row's existing reason brace, never through a new body line — the declaring and declared-true renders differ by exactly one brace and zero lines."
    requirement: OUT-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts — the line-count + deep-equal + row-line comparison inside the `(available)` case"
        status: pass
    human_judgment: false
  - id: D3
    description: "A COLD `(remote)` row carries the token with no tree materialized anywhere, so the claim can only have come from the marketplace entry."
    requirement: OUT-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#OUT-03 / OUT-05 / D-104-06: a COLD `(remote)` row whose entry declares `defaultEnabled: false` carries `{installs disabled}` with no tree materialized anywhere"
        status: pass
    human_judgment: false
  - id: D4
    description: "A degraded `(remote)` row reporting a read failure carries BOTH facts in one brace, failure first and author-declared cause last."
    requirement: OUT-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#OUT-05 / D-104-04: a degraded `(remote)` row reporting a read failure carries BOTH facts in one brace, failure first"
        status: pass
    human_judgment: false
  - id: D5
    description: "`(unavailable)`, `(installed)`, `(partially-installed)` and `(disabled)` info rows stay byte-identical against an entry that DOES declare the install-time default false."
    requirement: OUT-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts — the four `never acquires `installs disabled`` cases"
        status: pass
    human_judgment: false
  - id: D6
    description: "The composer's status gate is total over the info row's eight-member status union: a ninth status is a compile error at this site, not a silent omission."
    requirement: OUT-03
    verification:
      - kind: manual
        ref: "hand mutation — removed `partially-installed` from the map; `tsc` emitted TS1360 + TS7053 naming the missing property; key restored"
        status: pass
    human_judgment: false
  - id: D7
    description: "The status map demonstrably gates a row that reaches the composer."
    requirement: OUT-03
    verification:
      - kind: manual
        ref: "hand mutation — flipped `unavailable` to `true`; the `(unavailable)` negative failed with `{unsupported source, installs disabled}`; key restored"
        status: pass
    human_judgment: false
  - id: D8
    description: "Adding this reason does not move the info surface off informational severity."
    requirement: OUT-03
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts — every one of the eight new cases asserts the sole notification's severity is absent"
        status: pass
    human_judgment: false

# Metrics
duration: 33min
completed: 2026-08-15
status: complete
---

# Phase 104 Plan 03: Info surface — the pre-install claim Summary

**`/claude:plugin info` now says `{installs disabled}` in the reason brace its not-installed rows already had, applied once at the single consumer where all eight not-installed return sites converge, gated by a total status map that turns a future ninth info status into a compile error rather than a silent omission.**

## Performance

- **Duration:** ~33 min
- **Tasks:** 3
- **Files modified:** 2 (1 source, 1 test) — no file created

## Accomplishments

- The info surface gained the claim for the cost the research predicted: one module-private composer, one module-private constant, one call-site wrap. Neither the info row shape nor the info renderer was touched, because both already carried and composed an optional reasons field for every info status.
- The composer sits at the FUNNEL, so it cannot miss an arm. Eight not-installed return sites across five builders — three of which never receive the marketplace entry — all pass through the one `buildBlock` statement where `entry` is in scope.
- The total-map choice was not asserted, it was demonstrated twice. Removing a key fails the compile; flipping the `unavailable` key fails a test. Both outputs are recorded below.
- All four positive byte forms were predicted correctly from RESEARCH's probed output and passed on the first run — no expectation was pinned by copying whatever the code happened to emit.
- Every one of the eight new cases pins the severity as absent, which is the in-test proof that naming an author's intent does not move the surface off informational severity.

## Task Commits

1. **Task 1: composer + total status map + call-site wrap** — landed in `9131439a` (see Deviations — a shared-index collision put it under the sibling's commit)
2. **Task 2: the four positive info rows** — `28c4eda6` (test)
3. **Task 3: the four negative info rows** — `f86ece1f` (test)

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — `entryDeclaresInstallDisabled` added to the existing multi-line resolver import (the barrel untouched); `INSTALL_DISABLED_ROW_STATUSES` and `applyInstallDisabledRowShape` added immediately below the sibling `applyDisabledRowShape` they are modeled on; `buildBlock`'s final statement wraps the not-installed row. No builder signature changed; no other line touched.
- `tests/orchestrators/plugin/info.test.ts` — two commented sections, eight cases: `(available)` paired with its declared-true twin plus the line-by-line grammar proof, cold `(remote)`, `(partially-available)`, the degraded combined form, and the four negatives.

## Decisions Made

None beyond the plan. Two judgment calls worth recording:

- **Comment placement.** The map and composer went immediately AFTER `applyDisabledRowShape` rather than before `DISABLED_ROW_REASONS`, so the two post-hoc row shapes read as an adjacent pair and the "sibling" cross-references in both doc comments are literally adjacent.
- **The `false`-key grouping in the doc comment.** The plan's wording called the four non-`unavailable` false keys "installed-record statuses". `failed` is not an installation record — it is arm (a)'s manifest-read failure and arm (b)'s not-in-manifest verdict. The comment says so accurately rather than repeating the plan's shorthand: three record statuses plus one block-could-not-be-built status, all four sharing the property that they never describe a pending install.

## Mandated Checks

### Compile-error check — the total map is total (Task 1)

Removed `"partially-installed": false,` by hand and ran `npx tsc --noEmit`. **Two** errors, both naming the missing key:

```
info.ts(1045,12): error TS1360: Type '{ readonly available: true; ... }' does not satisfy
the expected type 'Record<"installed" | "available" | "unavailable" | "failed" | "disabled"
| "partially-installed" | "partially-available" | "remote", boolean>'.
  Property '"partially-installed"' is missing in type ... but required in type ...

info.ts(1088,48): error TS7053: Element implicitly has an 'any' type because expression of
type '"installed" | ... | "remote"' can't be used to index type '{ readonly available: true; ... }'.
  Property 'partially-installed' does not exist on type ...
```

The second error is the stronger one: the composer's own indexing breaks, so the gate cannot be left half-updated. Key restored; `tsc` exit 0.

### Mutation check — the map gates something (Task 3)

The plan's literal instruction was to flip the `disabled` key to `true` and watch the `(disabled)` negative fail. **It does not fail, and it cannot** — the plan's own prose explains why in the same task: the composer is applied at the not-installed consumer alone, so no installed-bucket row ever reaches the map. Run and recorded rather than skipped: with `disabled: true`, all 76 tests still pass. That is not a hole in the test, it is a second confirmation of the structural claim the three record negatives assert.

The mutation that DOES exercise the map is `unavailable`, the one false key on a row that reaches the composer:

```
not ok 73 - OUT-03 / D-104-03: an `(unavailable)` row never acquires `installs disabled`, however the entry declares
    Expected values to be strictly equal:
    + actual - expected
      '● mp [user] <no autoupdate>\n' +
    +   '  ⊘ remote v1.0.0 (unavailable) {unsupported source, installs disabled}\n' +
    -   '  ⊘ remote v1.0.0 (unavailable) {unsupported source}\n' +
```

Key restored; 76/76 green. Both mutations were reverted from disk and `git status --short -- extensions/` was clean afterward.

### Mutation check — the tail order is real (Task 2)

Swapped the two tokens in the `(partially-available)` expectation to `{installs disabled, lsp}`. Test 71 failed. Restored. The tail position is asserted, not assumed.

## Deviations from Plan

### 1. [Rule 3 — shared-index collision] Task 1's commit was absorbed by the sibling executor's commit

- **Found during:** Task 1's commit step.
- **Issue:** This plan ran in the SHARED worktree alongside plan 104-02, so the two executors share one git index. `info.ts` was staged, then a multi-minute `pre-commit` run followed, and during that window the sibling ran `git commit` — which commits the whole index. My staged file went into `9131439a feat(list): say when an unfetched plugin would install disabled`.
- **Impact:** Content only, not correctness. `git diff HEAD -- .../info.ts` is empty and the committed blob carries all four occurrences of the two new symbols, so the branch state is exactly right; only the commit attribution is blended. Task 1 has no commit of its own.
- **Fix:** None applied. Separating it would require rewriting history, which CLAUDE.md forbids outright. Documented here instead.
- **Prevented for Tasks 2 and 3:** the order was inverted — `pre-commit run --files <path>` FIRST against the working tree, then `git add && git commit` back-to-back in one shell invocation. Both landed as clean single-file commits (`28c4eda6`, `f86ece1f`).
- **Carry-forward:** any future plan executed with `isolation: none` beside a live sibling should never leave a file staged across a long-running command.

### 2. [Documentation] The plan's Task 3 mutation instruction could not bite

Recorded above under Mandated Checks rather than silently substituted. The plan asked for a `disabled`-key mutation that cannot fail a test; both that mutation and the meaningful `unavailable` one were run, and both results are reported.

## Issues Encountered

- **`trufflehog` fails structurally in this worktree**, exactly as CLAUDE.md documents (`failed to read index file: ... .git/index: not a directory` — `.git` is a file in a linked worktree). Handled by the sanctioned route on every commit: a `trufflehog filesystem` scan over the committed path at `--results=verified,unknown --fail` (clean each time — 0 verified, 0 unverified), then `SKIP=trufflehog` on that commit alone. No other hook was skipped; `--no-verify` was never used.
- **One phantom `npm lint` failure** ("files were modified by this hook") on the first pre-commit run, caused by the sibling writing to the tree mid-run. Re-ran; passed. Not chased, per the shared-tree expectations.
- Nothing else. No blocked task, no auth gate, no package install.

## Known Stubs

None. Every path added is wired to a real data source and pinned by a byte-level assertion.

Scope note, not a stub: the behavioral zero-git-seam-call proof for the info surface and the `docs/output-catalog.md` blocks are the later plans' work by design (`104-04` and `104-05`), not unfinished work left here.

## Threat Flags

None. The only third-party value read is `entry.defaultEnabled`, already validated as a boolean by `PLUGIN_ENTRY_VALIDATOR` before any read, compared strictly against one literal, and rendered as a frozen closed-set token — never interpolated content. No new network, file, or auth surface.

## Verification Run

| Command | Result |
|---|---|
| `node --test tests/orchestrators/plugin/info.test.ts` | 76/76 pass (68 before this plan) |
| `node --test "tests/architecture/**/*.test.ts"` | 354 tests, 353 pass, 0 fail, 1 skip (pre-existing) |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint` (both touched files) | exit 0 |
| `npx prettier --check` (both touched files) | exit 0 |

`npm test` and `npm run check` were deliberately NOT run: a sibling executor was mid-edit in the same tree for most of this plan, so a full run would have reported their in-progress state. The phase-boundary gates belong to `104-04` / `104-05`.

## Acceptance Criteria Evidence

| Criterion | Result |
|---|---|
| `grep -c 'applyInstallDisabledRowShape'` (comments stripped) | `2` — the declaration and exactly one call |
| `grep -c 'INSTALL_DISABLED_ROW_STATUSES'` (comments stripped) | `2` — the declaration and its single use |
| `grep -cE 'PLUGIN_MANIFEST_VALIDATOR\|loadPluginManifest'` (comments stripped) | `0` — no plugin-local manifest is read to answer this |
| `extensions/.../shared/notify.ts` among MY changed files | no — neither row shape nor renderer edited |
| Existing assertions edited | none — every pre-existing fixture's entry declares nothing, so every pre-existing row stayed byte-identical |
| Tasks 2 and 3 touched `extensions/` | no — both diffs are test-only |

## User Setup Required

None.

## Next Phase Readiness

Ready. What the later plans inherit:

- The composer is module-private and unexported. Nothing outside `info.ts` observes it except through rendered bytes, so `104-04`'s behavioral offline proof can assert on output alone.
- The four positive byte forms are now pinned in-repo, so `104-05`'s catalog blocks can be copied from the test expectations rather than re-derived: `  ○ dis v1.0.0 (available) {installs disabled}`, `  ◌ gplug v1.0.0 (remote) {installs disabled}`, `  ⊖ lspplug v1.0.0 (partially-available) {lsp, installs disabled}`, and `  ◌ gplug v1.0.0 (remote) {network unreachable, installs disabled}`.
- The fourth form (the D-104-04 combination) is NOT among the three catalog blocks CONTEXT named. It is byte-pinned by a test either way; whether it also earns a catalog block is `104-05`'s call.
- A ninth info status added by any later phase will fail to compile at `INSTALL_DISABLED_ROW_STATUSES` with a message naming the missing key. That is intended, and the fix is to decide the new status's answer explicitly rather than to widen the type.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` — FOUND (2 non-comment occurrences of each new symbol)
- `tests/orchestrators/plugin/info.test.ts` — FOUND (76 tests, up from 68)
- Commit `9131439a` — FOUND (carries Task 1's `info.ts` content; `git diff HEAD` empty for that file)
- Commit `28c4eda6` — FOUND
- Commit `f86ece1f` — FOUND
- `extensions/pi-claude-marketplace/shared/notify.ts` — absent from my commits' file lists (sibling-owned, untouched by me)

---
*Phase: 104-pre-install-read-surfaces*
*Completed: 2026-08-15*
