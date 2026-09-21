---
phase: 109-kind-inversion
plan: 02
subsystem: resolver closed sets and the reason catalog
tags: [inversion, closed-set, resolver, reasons, production]
status: complete

requires:
  - "109-01 (the five locking gates, turned red)"
provides:
  - "`workflows` in SUPPORTED_COMPONENT_KINDS and SUPPORTED_COMPONENT_PATH_KINDS, out of UNSUPPORTED_COMPONENT_KINDS and UNSUPPORTED_COMPONENT_CONVENTIONS"
  - "`componentPaths.workflows` as a REQUIRED member on all three of its spellings -- the schema, the accumulator, the initializer"
  - "the manifest `workflows` field in SUPPORTED_COMPONENT_PATH_FIELDS"
  - "a 43-member REASONS tuple with no dedicated workflows token, and no kindToReason arm for the kind"
  - "the measured enumeration of the 127 test-side widening errors, which is 109-03's work list"
affects:
  - "109-03 (the 67 TS2741 + 60 TS2322 componentPaths literal sites enumerated below)"
  - "109-04 (the 3 catalog-uat fixture payloads and probe-classifiers.test.ts:269, the 4 errors Task 2 added)"
  - "Phase 111 (bridges/workflows/discover.ts reads componentPaths.workflows -- the field now exists)"

tech-stack:
  added: []
  patterns:
    - "a closed-set move is one commit: removal and both additions together, or the kind is silently ignored in between"
    - "a compile-time completeness proof makes a two-file union edit atomic by construction"
    - "count narratives in doc comments are running arithmetic, appended never rewritten"

key-files:
  created:
    - .planning/workstreams/workflows/phases/109-kind-inversion/109-02-SUMMARY.md
  modified:
    - extensions/pi-claude-marketplace/domain/resolver.ts
    - extensions/pi-claude-marketplace/domain/components/plugin.ts
    - extensions/pi-claude-marketplace/shared/notify.ts
    - extensions/pi-claude-marketplace/shared/notify-reasons.ts
    - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
    - tests/domain/resolver.test.ts

key-decisions:
  - "The Wave 1 kind-keyed `collected` annotation in the strict resolver test was dropped in the same commit that created the field it worked around, so no dead scaffolding survives the widening"
  - "The WINV-03 derivation term names no kind, because the acceptance gate pins notify-reasons.ts to exactly one line naming the kind (the retained WDET-04 / D-106-04 term). Arithmetic that points at the preceding term satisfies both the ledger and the count"
  - "The whole-tree typecheck is knowingly left red at 131 errors, all under tests/. The plan assigns those sites to 109-03 and 109-04 and forbids fixing them here"

requirements-completed: [WINV-01, WINV-02, WINV-03]

coverage:
  - deliverable: "The workflows kind sits in both supported tuples and in neither unsupported structure, in one commit"
    verification:
      - kind: test
        ref: "tests/architecture/hooks-foundation.test.ts#HOOK-01 / WINV-01: SUPPORTED_COMPONENT_KINDS is the closed 5-tuple"
        status: pass
      - kind: test
        ref: "tests/architecture/hooks-foundation.test.ts#WINV-01: UNSUPPORTED_COMPONENT_KINDS does NOT contain 'workflows'"
        status: pass
      - kind: command
        ref: "git show f23d964d -- domain/resolver.ts | grep -cE '^-.*workflows' -> 2; grep -cE '^\\+.*workflows' -> 6"
        status: pass
    human_judgment: false
  - deliverable: "componentPaths.workflows exists on the schema, the accumulator and the initializer, and the strict resolver reads it directly"
    verification:
      - kind: test
        ref: "tests/domain/resolver.test.ts#WINV-01 strict: implicit-by-convention workflows/ dir -> installable with componentPaths.workflows populated"
        status: pass
      - kind: command
        ref: "npm run typecheck | grep -cE '^extensions/.*error TS' -> 0"
        status: pass
    human_judgment: false
  - deliverable: "A workflow-bearing plugin resolves installable, and a plugin carrying workflows plus a still-unsupported kind resolves partially-available naming only the other kind"
    verification:
      - kind: test
        ref: "tests/domain/resolver.test.ts#WINV-01 loose: workflows/ dir on disk -> installable, no workflows contains-note"
        status: pass
    human_judgment: true
    rationale: "The two-kind asymmetric case (workflows + themes) is measured in 109-RESEARCH and is pinned end-to-end by the catalog-uat rejection state, which is still red until 109-04 turns its fixture payload. No test in this plan asserts it."
  - deliverable: "The dedicated workflows reason is retired from all four declaration sites and every count narrative reads 43"
    verification:
      - kind: test
        ref: "tests/architecture/compat-01-no-expansion.test.ts#COMPAT-01: REASONS holds exactly its inherited members, in order"
        status: pass
      - kind: test
        ref: "tests/architecture/notify-closed-set-locks.test.ts#OUT-08: REASONS is the closed 43-entry reason set"
        status: pass
      - kind: test
        ref: "tests/shared/notify.test.ts#closed notification constants preserve exact public values"
        status: pass
      - kind: command
        ref: "grep -o '44-entry' notify.ts notify-reasons.ts | wc -l -> 0"
        status: pass
    human_judgment: false
  - deliverable: "No reworded doc comment reintroduced retired vocabulary or a planning reference"
    verification:
      - kind: test
        ref: "tests/architecture/partial-vocabulary-guard.test.ts"
        status: pass
      - kind: command
        ref: "grep -cE 'Phase [0-9]|Plan [0-9]|Wave [0-9]|Pitfall [0-9]' over all five production files -> 0 each"
        status: pass
    human_judgment: false

duration: 11 min
completed: 2026-09-04

actuals:
  tokens: 3900
  tasks: 2
  commits: 2
---

# Phase 109 Plan 02: Kind inversion production edits Summary

`workflows` crossed from the unsupported closed set into both supported tuples, and the
dedicated `{workflows}` reason that meant the opposite was retired from all four of its
declaration sites. A plugin carrying `<pluginRoot>/workflows/` now resolves `installable`,
and `componentPaths.workflows` exists.

**Duration:** 11 min (2026-09-04T23:19Z -> 2026-09-04T23:30Z)
**Tasks:** 2 of 2
**Files:** 6 modified (5 under `extensions/`, 1 test)
**Commits:** `f23d964d`, `f46beb53`

## Accomplishments

- **The move landed in one commit (`f23d964d`), as T-02-25 requires.** That commit carries
  both the `-` lines (the `UNSUPPORTED_COMPONENT_KINDS` member and the
  `UNSUPPORTED_COMPONENT_CONVENTIONS` entry) and the `+` lines (both supported tuples plus
  the three spellings of the widened field). No intermediate tree exists where the kind sits
  in neither closed set. `SUPPORTED_COMPONENT_KINDS` is now
  `["skills","commands","agents","hooks","workflows"]` (5), `SUPPORTED_COMPONENT_PATH_KINDS`
  is `["skills","commands","agents","workflows"]` (4), `UNSUPPORTED_COMPONENT_KINDS` is 7
  with the kind absent, and `UNSUPPORTED_COMPONENT_CONVENTIONS` is 5 entries with no
  workflows key.
- **The convention probe is byte-identical.** No convention constant, helper, or special case
  was added. `collectStrictComponentKind` joins `<pluginRoot>` with the kind name, so
  `<pluginRoot>/workflows` is probed by exactly the same call that probed it before. Only
  which tuple drives the loop changed, which is what WINV-01 claims literally.
- **No function body changed.** `collectStrictComponentKind`, `collectLooseComponentKind`,
  `validateComponentPath`, `addComponentPath`, `readPathOrArray` and `materializableFields`
  are all `SupportedPathKind`-typed or index through `partial.componentPaths[kind]`, so they
  widened without an edit. No `SupportedKind` alias was exported.
- **The manifest field moved bags without changing validation.** Both
  `SUPPORTED_COMPONENT_PATH_FIELDS` and `UNSUPPORTED_COMPONENT_FIELDS` are
  `Type.Optional(Type.Unknown())`, so the move is documentary at the schema layer and
  semantic at the resolver. `tests/domain/components/plugin.test.ts` stayed green.
- **The reason retirement landed in one commit (`f46beb53`) across all four sites** -- the
  `REASONS` tail entry with its three-line doc comment, the `UnsupportedReason` topic-group
  member in `notify-reasons.ts`, the separately-declared `UnsupportedReason` alias member in
  `probe-classifiers.ts` (now 4 members), and the `kindToReason` arm (now two `if` statements
  and one trailing return). The tail was the only removable position: every surviving token's
  catalog index is unmoved, which is what `compat-01`'s order-sensitive `deepEqual` needs.
- **Every count narrative reads 43** -- the `notify.ts` catalog-stability sentence, both
  `notify-reasons.ts` header sentences, and the running derivation, which gained one appended
  arithmetic term below the retained `WDET-04` / `D-106-04` term rather than a rewrite.
- **Seven stale doc comments state the current mapping** -- five in `probe-classifiers.ts`
  (the shared-vocabulary block, the `ResolverNoteReason` envelope, the `narrowResolverNotes`
  axis note, the `narrowUnsupportedKinds` mapping paragraph, and the TD-3 carve-out block,
  retagged `D-90-05 / WINV-03`) and the two `notify.ts` `--partial` examples.
- **The Wave 1 workaround is gone.** `tests/domain/resolver.test.ts` no longer reads
  `componentPaths` through a kind-keyed annotation; it reads
  `resolvedPlugin.componentPaths.workflows` directly, in the same commit that created the
  field. The runtime assertion beneath it is unchanged.

## Green observations (Success Criterion 4)

Each gate below was turned red in `109-01` and is paired here with its now-green run. The
green closes the same failure `109-01-SUMMARY.md` recorded, not a different one.

| # | Gate | 109-01 red | Now |
|---|------|-----------|-----|
| 2 | `tests/architecture/compat-01-no-expansion.test.ts` | exit 1, `fail 1`, diff was a single trailing `+ 'workflows'` | exit 0, `tests 14 / pass 14 / fail 0` |
| 3 | `tests/architecture/notify-closed-set-locks.test.ts` | exit 1, `fail 1`, `44 !== 43` | exit 0, `tests 4 / pass 4 / fail 0` |
| 4 | `tests/shared/notify.test.ts` | exit 1, `fail 1` of 253, `44 !== 43` | exit 0, `tests 253 / pass 253 / fail 0` |
| 5 | `tests/architecture/hooks-foundation.test.ts` | exit 1, `fail 2` of 9: the 5-tuple pin missing `'workflows'`, and the negative mirror finding it in the unsupported list | exit 0, `tests 9 / pass 9 / fail 0` |
| 6 | `node --test --test-name-pattern="WINV-01" tests/domain/resolver.test.ts` | exit 1, `tests 2 / pass 0 / fail 2`, both `+ 'partially-available' - 'installable'` | exit 0, `tests 2 / pass 2 / fail 0` |

Gate 1, `tests/architecture/catalog-uat.test.ts`, stays red on purpose: its three fixture
`message` payloads are `109-04`'s work and were deliberately left byte-unchanged by `109-01`
(A-02). Its three sites now also appear as typecheck errors (see the Task 2 delta below).

The gate that had to stay green did: `node --test tests/architecture/partial-vocabulary-guard.test.ts`
-> exit 0, `tests 52 / pass 52 / fail 0`. Nothing reworded here reintroduced retired D-75-01
vocabulary.

Per-gate detail for the two multi-assertion runs:

```text
✔ HOOK-01 / WINV-01: SUPPORTED_COMPONENT_KINDS is the closed 5-tuple [skills,commands,agents,hooks,workflows]
✔ WINV-01: UNSUPPORTED_COMPONENT_KINDS does NOT contain 'workflows'
ℹ tests 9 / ℹ pass 9 / ℹ fail 0
```

```text
✔ WINV-01 strict: implicit-by-convention workflows/ dir -> installable with componentPaths.workflows populated
✔ WINV-01 loose: workflows/ dir on disk -> installable, no workflows contains-note
ℹ tests 2 / ℹ pass 2 / ℹ fail 0
```

## `npm run typecheck` after Task 1 -- the 109-03 work list

Zero errors under `extensions/`. **127 errors, all under `tests/`.** The command and its
header:

```text
> pi-claude-marketplace@0.18.1 typecheck
> tsc --noEmit

tests/bridges/agents/stage.test.ts(63,7): error TS2741: Property 'workflows' is missing in type '{ skills: never[]; commands: never[]; agents: never[]; }' but required in type '{ skills: string[]; commands: string[]; agents: string[]; workflows: string[]; }'.
```

The raw output is ~90 KB because each `TS2322` carries a multi-line structural explanation of
the same three literal shapes. Reproduce it in full with
`npm run typecheck 2>&1 | grep -E '^tests/.*error TS'`. What `109-03` consumes is the site
enumeration, which is complete below.

### Error shapes (all distinct message bodies, verbatim)

Five distinct `TS2741` bodies -- one per `componentPaths` literal shape:

```text
error TS2741: Property 'workflows' is missing in type '{ skills: never[]; commands: never[]; agents: never[]; }' but required in type '{ skills: string[]; commands: string[]; agents: string[]; workflows: string[]; }'.
error TS2741: Property 'workflows' is missing in type '{ skills: never[]; commands: never[]; agents: string[]; }' but required in type '{ skills: string[]; commands: string[]; agents: string[]; workflows: string[]; }'.
error TS2741: Property 'workflows' is missing in type '{ skills: never[]; commands: string[]; agents: never[]; }' but required in type '{ skills: string[]; commands: string[]; agents: string[]; workflows: string[]; }'.
error TS2741: Property 'workflows' is missing in type '{ skills: string[]; commands: never[]; agents: never[]; }' but required in type '{ skills: string[]; commands: string[]; agents: string[]; workflows: string[]; }'.
error TS2741: Property 'workflows' is missing in type '{ agents: string[]; commands: string[]; skills: string[]; }' but required in type '{ skills: string[]; commands: string[]; agents: string[]; workflows: string[]; }'.
```

Three distinct `TS2322` bodies, all of the form "not assignable to type
`MaterializablePlugin`":

```text
error TS2322: Type '{ installable: true; state: "installable"; name: string; pluginRoot: string; supported: never[]; unsupported: never[]; notes: never[]; componentPaths: { skills: never[]; commands: never[]; agents: never[]; }; mcpServers: {}; defaultEnabled: true; }' is not assignable to type 'MaterializablePlugin'.
error TS2322: Type '{ installable: true; state: "installable"; name: string; pluginRoot: string; supported: string[]; unsupported: never[]; notes: never[]; componentPaths: { skills: never[]; commands: never[]; agents: string[]; }; mcpServers: {}; defaultEnabled: true; }' is not assignable to type 'MaterializablePlugin'.
error TS2322: Type '{ installable: true; state: "installable"; name: string; pluginRoot: string; supported: string[]; unsupported: never[]; notes: never[]; componentPaths: { skills: string[]; commands: never[]; agents: never[]; }; mcpServers: {}; defaultEnabled: true; }' is not assignable to type 'MaterializablePlugin'.
```

### Complete site enumeration (127 errors)

**67 × TS2741** -- the literal that is missing the key:

| File | Lines |
|------|-------|
| `tests/bridges/agents/stage.test.ts` | 63, 106, 212, 287, 377, 487, 573, 637, 750, 886, 976, 1063, 1128, 1194, 1273, 1315, 1357, 1421, 1505, 1623, 1672, 1762, 1811, 1891, 1954, 2017, 2089, 2138, 2212, 2284, 2343 (31) |
| `tests/bridges/skills/stage.test.ts` | 63, 120, 202, 265, 351, 421, 484, 539, 601, 666, 712, 763, 828, 903, 977, 1038, 1108, 1151, 1196, 1245, 1313, 1399, 1473, 1577, 1632, 1686, 1735, 1782, 1837 (29) |
| `tests/bridges/commands/discover.test.ts` | 28 |
| `tests/bridges/commands/stage.test.ts` | 50 |
| `tests/bridges/skills/discover.test.ts` | 26 |
| `tests/orchestrators/plugin/discover-names.test.ts` | 27 |
| `tests/orchestrators/plugin/plugin-state-classifier.test.ts` | 58, 73 |
| `tests/orchestrators/plugin/shared.test.ts` | 133 |

**60 × TS2322** -- the assignment the same literal feeds, reported one construction later.
Only the two bulk files produce these, so they pair 1:1 with the 60 bulk `TS2741` sites:

| File | Lines |
|------|-------|
| `tests/bridges/agents/stage.test.ts` | 76, 119, 225, 300, 398, 500, 588, 650, 792, 897, 987, 1074, 1139, 1205, 1284, 1326, 1368, 1432, 1516, 1634, 1683, 1773, 1822, 1902, 1965, 2028, 2100, 2149, 2223, 2295, 2354 (31) |
| `tests/bridges/skills/stage.test.ts` | 76, 145, 220, 301, 377, 438, 506, 561, 625, 681, 723, 774, 839, 914, 988, 1049, 1119, 1162, 1207, 1256, 1324, 1410, 1484, 1588, 1643, 1697, 1746, 1793, 1848 (29) |

This confirms `109-PATTERNS.md` drift item D-2: 62 and 58 are *error* counts, not edit counts.
The measured literal sites are 31 and 29. It also confirms D-3 in reverse -- `tsc` reports
`discover-names.test.ts` once (line 27, the `readonly` parameter type); the spread at 27-31 is
what makes it compile and is invisible to this list. The 8 `deepStrictEqual` whole-arm
equality sites (D-4) are likewise invisible here: they are runtime assertions, not type errors.

### Task 2 delta -- 4 additional errors, all owned by 109-04

After the reason retirement the count is 131. The four added:

```text
tests/architecture/catalog-uat.test.ts(919,27): error TS2322
tests/architecture/catalog-uat.test.ts(1227,27): error TS2322
tests/architecture/catalog-uat.test.ts(1331,27): error TS2322
tests/shared/probe-classifiers.test.ts(269,30): error TS2322
```

The three `catalog-uat` sites are the fixture `message` payloads `109-01` left byte-unchanged
by design; `probe-classifiers.test.ts:269` is the dedicated-reason classifier assertion that
`109-04` turns into the fall-through assertion. Nothing here was fixed in this plan.

## The loose manifest-only consequence, recorded as intended

A plugin whose `.claude-plugin/plugin.json` declares `workflows` while the marketplace entry
stays silent resolved `partially-available` before this plan and resolves **`unavailable`**
after it, with the note:

```text
component declarations conflict: manifest declares "workflows" but entry does not
```

This is MM-6 applying to a newly path-bearing kind exactly as it already applies to `skills`,
`commands` and `agents`: `collectLooseComponentKind` treats a manifest-only supported-path-kind
declaration as a structural conflict, and unsupported kinds are not subject to that rule. It is
an intended effect of the kind becoming path-bearing, not a defect, and **no carve-out was
added**.

The blast radius is test-side only. `resolveLoose` has **no production consumer** -- the only
importers outside `domain/resolver.ts` are `tests/architecture/hooks-foundation.test.ts` and
the resolver's own owner test, and `domain/manifest.ts:24` mentions it only in a comment.

## The D-109-06 window is now fully open

Between this plan and Phase 111, a workflow-bearing plugin:

- resolves `installable` rather than `partially-available`,
- renders a clean `● <name> (installed)` row with no reason brace, and
- **materializes zero workflow commands**, because no bridge exists yet.

That is less honest than the pre-inversion `⊖ (partially-available) {workflows}`. It is the
accepted cost of turning the closed sets before the bridge lands. **Cut no release from this
branch before Phase 111 lands.** The window has no external surface: `ci.yml` carries no
`push` trigger on `features/**`.

## A-03 corollary: do not bump the version inside this window

Do **not** bump `EXTENSION_VERSION`, the `package.json` version, or
`sonar-project.properties` `projectVersion` until Phase 111 lands. All three stay `0.18.1`
through this phase and none was touched here.

The reason is mechanical. `orchestrators/reconcile/backfill.ts:343` runs its `supportedSetGrew`
convergence over records at `installable: false` -- exactly where a pre-inversion
`--partial`-installed workflow-bearing record sits -- but the scan is gated on
`state.lastReconciledExtensionVersion === EXTENSION_VERSION`. While the version is unchanged
the scan never runs. A bump inside this window would fire that convergence and reinstall
workflow-bearing records while no bridge exists to materialize anything for them.

## The CHANGELOG entry is left intact deliberately

`CHANGELOG.md` lines 5-7 sit under the released `## [0.18.1] - 2026-08-29` heading and
describe what that version actually shipped. Rewriting them would silently restate history for
a published release. The inversion belongs in the next version's entry, which is release work
the STATE.md outstanding list already carries. `CHANGELOG.md` is not under `docs/`, so WINV-05
does not reach it.

## Deviations from Plan

### 1. [Rule 1 - Bug] Task 1 acceptance criterion `grep -c 'SupportedKind'` cannot print 2

- **Found during:** Task 1 acceptance verification
- **Issue:** the criterion expects `grep -c 'SupportedKind' domain/resolver.ts` to print `2`,
  "only the pre-existing `SupportedPathKind` declaration and its use". The literal pattern
  `SupportedKind` is not a substring of `SupportedPathKind` (the `Path` sits between
  `Supported` and `Kind`) nor of `UnsupportedKind` (lower-case `s`). The command printed `0`
  at `HEAD` before this plan and prints `0` after it.
- **Fix:** none needed in code. The criterion's intent -- no new `SupportedKind` alias is
  exported -- is satisfied and verified two ways: `grep -c 'SupportedKind'` is `0`, and
  `fallow dead-code` reports no unused export.
- **Files modified:** none
- **Verification:** `git show HEAD:extensions/pi-claude-marketplace/domain/resolver.ts | grep -c 'SupportedKind'` -> `0` (pre-change baseline); post-change -> `0`
- **Commit:** n/a

### 2. [Rule 1 - Bug] Task 2 acceptance criterion `grep -c 'WDET-04 / D-106-04'` cannot print 1

- **Found during:** Task 2 acceptance verification
- **Issue:** the criterion expects the retained prior derivation term to be found by a
  single-line grep for `WDET-04 / D-106-04`. That anchor has always been wrapped across a line
  break in the header comment (`... reasons (41 to 43). WDET-04 /` then
  `* D-106-04 appended ...`). The command printed `0` at `HEAD` before this plan.
- **Fix:** none needed. The criterion's intent -- the prior term survives the append -- is
  satisfied: `grep -c 'WDET-04'` is `1`, `grep -c 'D-106-04'` is `1`, and the sentence
  `D-106-04 appended the dedicated \`workflows\` reason (43 to 44).` is intact with the new
  `WINV-03 / D-109-01 reverses that term (44 to 43).` appended after it.
- **Files modified:** none
- **Verification:** `git show HEAD~1:...notify-reasons.ts | grep -c 'WDET-04 / D-106-04'` -> `0` (pre-change baseline)
- **Commit:** n/a

### 3. [Rule 3 - Blocker] The `WINV-03` derivation term names no kind

- **Found during:** Task 2
- **Issue:** the plan asks for a derivation sentence recording `-1` and the `44 to 43`
  transition, while the acceptance gate requires `grep -c -i 'workflow' notify-reasons.ts` to
  print exactly `1` -- the retained `WDET-04 / D-106-04` line. A new sentence naming the kind
  would make it `2`.
- **Fix:** the appended term reads `WINV-03 / D-109-01 reverses that term (44 to 43).` and
  points at the preceding sentence rather than repeating the kind name. It stays strictly
  arithmetic, which is what makes it survive the comment policy's ban on narrating removed
  code.
- **Files modified:** `extensions/pi-claude-marketplace/shared/notify-reasons.ts`
- **Verification:** `grep -c -i 'workflow'` -> `1`; `grep -c 'WINV-03'` -> `1`;
  `node --test tests/architecture/partial-vocabulary-guard.test.ts` -> `pass 52 / fail 0`
- **Commit:** `f46beb53`

### 4. [Rule 2 - Missing critical] The Wave 1 annotation was removed here, not left for a later plan

- **Found during:** Task 1
- **Issue:** `109-01` added
  `const collected: Readonly<Record<string, readonly string[] | undefined>> = resolvedPlugin.componentPaths;`
  purely because `componentPaths.workflows` did not exist and `TS2339` blocked its commit. Its
  own SUMMARY marks it not load-bearing and hands the removal to this plan.
- **Fix:** dropped the annotation and restored the direct
  `resolvedPlugin.componentPaths.workflows` read, in the same commit that created the field.
  The runtime assertion is unchanged.
- **Files modified:** `tests/domain/resolver.test.ts`
- **Verification:** `node --test --test-name-pattern="WINV-01" tests/domain/resolver.test.ts`
  -> `tests 2 / pass 2 / fail 0`; `npm run typecheck` reports no error in that file
- **Commit:** `f23d964d`

### 5. [Rule 3 - Blocker] The whole-tree `npm run typecheck` is left red

- **Found during:** both tasks
- **Issue:** `.pre-commit-config.yaml` runs `npm-typecheck` over the whole project, and CLAUDE.md
  requires `pre-commit` to pass before a commit. This plan's production change necessarily
  breaks 131 test-side sites that the plan assigns to `109-03` and `109-04` and explicitly
  forbids fixing here ("do not fix them here").
- **Fix:** the commits were made with the red whole-tree typecheck recorded rather than by
  absorbing another plan's scope or by suppressing a hook. `--no-verify` was never used and
  `SKIP=` was never extended past `trufflehog`. Every other gate was run and is green:
  `eslint --max-warnings=0` (exit 0), `prettier --check` over the repo (clean),
  `npm run fallow` (exit 0), and a `trufflehog filesystem` scan over the changed paths
  (`verified_secrets: 0, unverified_secrets: 0`, exit 0). No `pre-commit` hook is installed in
  the shared git dir, so no commit was made by bypassing a failing hook.
- **Files modified:** none
- **Verification:** `npm run typecheck | grep -cE '^extensions/.*error TS'` -> `0`; the 131
  test-side errors are enumerated above and are `109-03`/`109-04`'s work list
- **Commit:** n/a

**Total deviations:** 5 (2 × Rule 1 unsatisfiable acceptance commands, 2 × Rule 3 blockers,
1 × Rule 2 cleanup). **Impact:** none on the deliverable. No gate was weakened, no scope was
absorbed from another plan, and no production behavior differs from what the plan specified.

## Authentication Gates

None.

## Known Stubs

None. No placeholder, no hardcoded empty value, and no `TODO` was introduced. The absence of a
workflows bridge is not a stub in this plan's files: it is the D-109-06 window recorded above,
and Phase 111 owns it.

## Threat Flags

None. The change adds no network endpoint, no auth path, and no new file access. T-109-02 is
satisfied by construction: a declared workflows path now routes through the same
`validateComponentPath` / `assertPathInside` NFR-10 chokepoint as `skills`, which is a strict
improvement over the pre-inversion state where the path was never validated.

## Issues Encountered

The whole-tree `npm run typecheck` and `npm test` stay red until `109-03` and `109-04` land.
That is by plan design, is enumerated above, and is not a defect. Nothing else.

## Next Phase Readiness

Ready for `109-03`, which owns the 67 `TS2741` + 60 `TS2322` `componentPaths` literal sites
enumerated above (60 of them in the two bulk files), plus the 8 invisible `deepStrictEqual`
whole-arm sites `tsc` cannot see. `109-04` then owns the 3 `catalog-uat` fixture payloads and
`probe-classifiers.test.ts:269`.

## Self-Check: PASSED

- `.planning/workstreams/workflows/phases/109-kind-inversion/109-02-SUMMARY.md` -- FOUND
- All 6 modified files present -- FOUND
- `f23d964d` feat(109-02): admit workflows as a supported component kind -- FOUND
- `f46beb53` refactor(109-02): retire the dedicated workflows reason token -- FOUND
- `git show f23d964d --stat` names BOTH `domain/resolver.ts` and `domain/components/plugin.ts` -- PASS
- `git show f46beb53 --name-only` names all three `shared/` files -- PASS
- `npm run typecheck` production errors: 0 -- PASS
- All five `109-01` gates green, `partial-vocabulary-guard` green -- PASS
- `EXTENSION_VERSION`, `package.json` version, `sonar-project.properties` unchanged at `0.18.1` -- PASS
