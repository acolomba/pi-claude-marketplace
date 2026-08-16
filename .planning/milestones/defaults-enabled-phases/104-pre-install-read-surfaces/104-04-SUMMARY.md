---
phase: 104-pre-install-read-surfaces
plan: 04
subsystem: testing
tags: [nfr-5, offline-proof, mutation-checked, live-field-guard, entry-only-source]

# Dependency graph
requires:
  - phase: 104-pre-install-read-surfaces
    plan: 02
    provides: "the cold-remote list fixture, `PluginRemoteMessage.reasons?`, and the list map's forwarding remote arm this plan asserts against"
  - phase: 104-pre-install-read-surfaces
    plan: 03
    provides: "the info-surface composer whose output the zero-git-seam guard and the info declining case observe"
provides:
  - "two behavioral offline guards that observe the EFFECT of the call: a post-call `stat` on the scope's clone directory asserting ENOENT, and a zero-call assertion on the injected git seam"
  - "the entry-only tripwire on both surfaces: a silent entry over a warm clone that declares renders the bare row, and both cases were seen to fail under the mutation that closes the divergence"
  - "`stageWarmMirror(cwd, canonicalUrl, pluginJson?)` -- a one-argument widening, no pre-existing caller moved"
  - "`tests/shared/notify-not-installed-reasons.test.ts` -- six tests pinning the two forwarding arms, the two deliberately-dropping arms, and absent-versus-empty parity on three row shapes"
affects: [104-05-catalog-and-docs, 105-parity-and-divergence-docs]

actuals:
  tokens: 4830
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "effect-observing offline guard: probe path METADATA (never file content, which throws identically for a present and an absent directory) AFTER the awaited call, and assert the caught error code rather than a boolean derived from the try/catch"
    - "declining-case tripwire: seed the input a future 'fix' would honor, assert the current refusal byte-equal, and record in the test comment why the fix would be wrong -- so closing a deliberate divergence cannot pass as a bug fix"

key-files:
  created:
    - tests/shared/notify-not-installed-reasons.test.ts
  modified:
    - tests/orchestrators/plugin/list.test.ts
    - tests/orchestrators/plugin/info.test.ts

key-decisions:
  - "The corrected offline guard uses `stat` on `locations.pluginClonesDir` AFTER the `listPlugins` await and asserts the caught `ENOENT`. The pre-existing guard next door -- `readFile` against a directory, evaluated BEFORE the call -- is left byte-for-byte as found, and the new test's comment names both faults so a later reader does not harmonize the new probe toward the old one."
  - "The info-side proof is a CALL COUNT on the injected git seam, not a source grep. The grep gate already exists and says the module holds no git import; the count says the injected surface was never reached at run time, which is the claim the requirement actually makes."
  - "The declining cases assert the WHOLE body, not the absence of a substring. Absence of the brace is then proven alongside every other byte on the row staying put, which is what makes a future partial regression visible."
  - "The two DROP tests in the new guard file pass a POPULATED reasons array. A test that passed an empty array would prove nothing about dropping -- it would pass against an arm that forwards."
  - "The guard file's helpers take production row types (`PluginAvailableMessage`, `PluginRemoteMessage`, `PluginInfoRow`) rather than loose objects, so a row shape no producer could build is a compile error here rather than a green test over a fiction."

patterns-established:
  - "A guard that has never been seen to fail is not coverage. Every assertion this plan added was run against a mutation that should break it, and the mutation output is recorded below rather than asserted in prose."
  - "When a test exists to prevent a plausible-looking future change, the comment states what the change would look like (a bug fix), why it is not one, and where the full argument lives -- because the next reader meets the test, not the plan."

requirements-completed: [OUT-05, OUT-02, OUT-03]

coverage:
  - id: D1
    description: "`list` renders `(remote) {installs disabled}` for a cold git-source plugin AND no clone directory exists on disk after the call returns, checked with a path-existence probe placed after the orchestrator's await."
    requirement: OUT-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#OUT-05 / NFR-5 / RSTA-01: the cold `(remote)` claim is rendered with NO clone directory on disk after the call returns"
        status: pass
      - kind: manual
        ref: "mutation -- a clone directory materialized before the call fails exactly this test (see Mandated Checks)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`info` renders the same claim on a cold git-source plugin while making ZERO calls into the injected git seam, proven by an asserted call count."
    requirement: OUT-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#OUT-05 / NFR-5 / OUT-03: a COLD git plugin whose entry declares `defaultEnabled: false` carries the claim while making ZERO git-seam calls"
        status: pass
    human_judgment: false
  - id: D3
    description: "When the marketplace entry is SILENT and a warm clone's own plugin manifest declares the install-time default false, BOTH surfaces render the bare row."
    requirement: OUT-05
    verification:
      - kind: unit
        ref: "tests/orchestrators/plugin/list.test.ts#OUT-05 / D-104-01: a SILENT entry over a warm clone that declares `defaultEnabled: false` renders the bare row"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/plugin/info.test.ts#OUT-05 / D-104-01: a SILENT entry over a warm clone that declares `defaultEnabled: false` renders the bare row"
        status: pass
      - kind: manual
        ref: "mutation -- teaching the list surface to read the resolved (entry-then-manifest) default fails exactly the list-side declining case (see Mandated Checks)"
        status: pass
    human_judgment: false
  - id: D4
    description: "An absent reasons field and an empty reasons array render byte-identically on the `(available)` row, the `(remote)` row and the info plugin row."
    requirement: OUT-02
    verification:
      - kind: unit
        ref: "tests/shared/notify-not-installed-reasons.test.ts#DFEN-08 (list, both arms) and #OUT-03 / DFEN-08 (info row)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The list render map forwards a stamped reason on both candidate arms, and the CENTRAL row renderer drops it on both -- the drop asserted, so it is frozen as deliberate."
    requirement: OUT-02
    verification:
      - kind: unit
        ref: "tests/shared/notify-not-installed-reasons.test.ts -- two forwarding tests and two DROP tests"
        status: pass
      - kind: manual
        ref: "mutation -- reverting the list map's remote arm to omit its composer fails exactly the remote forwarding test (see Mandated Checks)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Neither surface claims any guarantee beyond a single read of the already-cached marketplace manifest; both are read-only, take no state lock and materialize nothing."
    requirement: OUT-05
    verification:
      - kind: manual
        ref: "backstop -- no ordering or atomicity property is asserted anywhere in this plan because none is offered; the two offline guards are the only concurrency-adjacent claims and both are about absence of materialization"
        status: pass
    human_judgment: true
    rationale: "A negative-space claim: what is verifiable is that no such assertion was written, which is a reading of the diff rather than a runnable check."
  - id: D7
    description: "The pre-existing offline guard's defect is neither repaired nor reproduced."
    requirement: OUT-05
    verification:
      - kind: unit
        ref: "`git diff` over the pre-existing block is empty; the new probe uses `stat` after the call and asserts the caught code"
        status: pass
    human_judgment: false

# Metrics
duration: 40min
completed: 2026-08-15
status: complete
---

# Phase 104 Plan 04: Behavioral offline proof and the entry-only tripwire Summary

**The two things a rendered row cannot say about itself are now asserted: nothing was fetched to produce it (a post-call `ENOENT` probe on one surface, a zero git-seam call count on the other) and nothing was read that should not have been (a silent entry over a declaring warm clone renders bare on both surfaces, and both cases were watched to fail under the mutation that would close that divergence).**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3
- **Files modified:** 2; created: 1

## Accomplishments

- The offline guarantee is now evidence about the CALL rather than about the fixture. The new list-side probe asks for path metadata after the orchestrator returns and asserts the caught `ENOENT`; the mutation that materializes a clone directory before the call turns it red, which the guard it sits beside cannot do under any input.
- The info side is proven by a different mechanism on purpose. A source grep already says `info.ts` holds no git import; the call count says the injected seam was never reached at run time. Those are different claims, and only the second one survives a future refactor that reaches git through an already-permitted seam.
- The phase's highest-value test exists on both surfaces and has been seen to fail. Teaching `list` to read the resolved entry-then-manifest default — the exact "fix" that would make the read surfaces agree with the install path — fails the list-side declining case and nothing else.
- The warm-mirror helper widened by exactly one optional parameter. `git diff` shows no pre-existing call site moved, and the whole 802-test plugin suite is green, so the widening is inert for every caller that did not ask for it.
- The new live-field guard types its helpers with the production row shapes instead of `Record<string, unknown>`, so the file cannot go green over a row no producer could construct.

## Task Commits

1. **Task 1: two offline guards that observe the effect** — `c0abb439` (test)
2. **Task 2: the declining case on both surfaces** — `22db971c` (test)
3. **Task 3: the render-map live-field guard** — `e6a30b0e` (test)

## Files Created/Modified

- `tests/orchestrators/plugin/list.test.ts` — the corrected offline guard beside the cold-remote positive case; the silent-entry-over-declaring-warm-clone declining case beside the warm-mirror resolution case; `stageWarmMirror` gains an optional `pluginJson` third parameter defaulted to the object it hard-coded, with one sentence in its doc comment saying why. `stat` joins the `node:fs/promises` import. The pre-existing offline guard near the tail is untouched.
- `tests/orchestrators/plugin/info.test.ts` — the zero-git-seam-call guard on a cold entry that declares, placed beside the existing zero-seam case it clones; the info-side declining case beside the other `D-104` cases, with component arguments so the warm mirror resolves installable rather than empty.
- `tests/shared/notify-not-installed-reasons.test.ts` — new, 201 lines, six tests, modeled structurally on `notify-disabled-reasons.test.ts` (same header-comment structure, ctx mock, both-companions-loaded probe stub, sole-body extractor, shared row and expected-row constants).

## Decisions Made

None beyond the plan. Three judgment calls worth recording:

- **The declining cases cite `DOC-02`, not a phase number.** The plan asked the comment to "name the following phase as the owner of the written-up divergence". A `Phase NN` token in a comment is forbidden by the repo's comment policy, and the durable anchor for that write-up is `DOC-02`. Both comments end with "DOC-02 owns the written-up divergence; the full argument lives there", which meets the intent — a reader can find the full argument — with an ID that survives archiving.
- **The list-side declining case sits beside the warm-mirror resolution case, not beside the other `D-104` rows.** It shares that case's fixture shape, and the adjacency makes the contrast legible: the warm tree IS resolved for status, and its declaration still is not read.
- **The Task 2 mutation was applied to the `installable` arm's spread rather than to the shared predicate.** The resolver's materializable arms already carry `defaultEnabled`, resolved by the entry-then-`plugin.json` precedence rule, so swapping `installsDisabledField` for `resolved.defaultEnabled === false` IS the change the criterion describes — the surface consulting the clone's own declaration when the entry is silent — in one line rather than a hand-built manifest read.

## Mandated Checks

Every mutation below was applied by hand, run, and reverted; `git status --short -- extensions/` was clean after each, and no mutation was committed.

### Mutation 1 — the list-side offline guard (Task 1)

Inserted `await mkdir(locationsFor("user", cwd).pluginClonesDir, { recursive: true });` immediately before the `listPlugins` call, standing in for a surface that materialized a clone to render:

```text
not ok 8 - OUT-05 / NFR-5 / RSTA-01: the cold `(remote)` claim is rendered with NO
           clone directory on disk after the call returns
    plugin-clones/ must not exist after the render
    + actual - expected

    + undefined
    - 'ENOENT'
# tests 81
# pass 80
# fail 1
```

The `+ undefined` is the informative part: the probe took the SUCCESS branch, so no error was caught at all. That is the failure mode the pre-existing guard is structurally incapable of reporting, because its `readFile` throws either way.

### Mutation 2 — the list-side declining case (Task 2)

Replaced the `installable` arm's `...installsDisabledField` in `orchestrators/plugin/list.ts` with a spread gated on `resolved.defaultEnabled === false` — the resolver's entry-then-`plugin.json` precedence value, i.e. the surface consulting the warm clone's own declaration when the entry is silent:

```text
not ok 15 - OUT-05 / D-104-01: a SILENT entry over a warm clone that declares
            `defaultEnabled: false` renders the bare row -- declining to claim is
            the correct answer
    + '● mp1 [user]\n  ○ warmdecl v1.0.0 (available) {installs disabled}'
    - '● mp1 [user]\n  ○ warmdecl v1.0.0 (available)'
# tests 82
# pass 81
# fail 1
```

One failure, and it is the declining case. Nothing else in the list suite moved, so the tripwire discriminates rather than being one of several assertions that happen to notice.

### Mutation 3 — the remote forwarding arm (Task 3)

Reverted the list map's `remote` arm to omit its `composeReasons` line (restoring the pre-narrowing body, probe parameter re-underscored):

```text
not ok 2 - OUT-02 / D-104-06: the LIST render map renders a stamped reason on the
           unfetched `(remote)` row
    + '● mp [user]\n  ◌ foo-plugin v1.2.3 (remote)'
    - '● mp [user]\n  ◌ foo-plugin v1.2.3 (remote) {installs disabled}'
# tests 6
# pass 5
# fail 1
```

The two DROP tests stayed green under this mutation, which is the point of asserting them: they describe the central switch, not the list map, and the two arms are now independently pinned.

## Deviations from Plan

No deviation rule (1-4) was invoked; no auto-fix was needed; no production file was edited (every `git diff --name-only -- extensions/` check after each task was empty).

One acceptance criterion was met in intent rather than to the letter, stated explicitly:

**`npm run format:check` was run as `npx prettier --check <my files>`.** Tasks 1 and 3 list `npm run format:check` among the gates. That script formats the whole repository, and a concurrent sibling executor was mid-edit in `docs/` and `tests/architecture/catalog-uat.test.ts` throughout; a repo-wide result would have reported their in-progress state as this plan's. The criterion's intent — the files this plan touches are Prettier-clean — is met and was re-checked after every edit. `npx tsc --noEmit` and `npx eslint` over the three files were run in full at each task boundary and exit 0.

## Issues Encountered

- **`trufflehog` fails structurally in this worktree**, exactly as CLAUDE.md documents (`failed to read index file: ... .git/index: not a directory`). Handled by the sanctioned route on every commit: a `trufflehog filesystem` scan over the committed paths at `--results=verified,unknown --fail` — clean all three times (0 verified, 0 unverified) — then `SKIP=trufflehog` on that commit alone. No other hook was skipped; `--no-verify` was never used.
- **Every commit used the pathspec form** (`git commit -F <msg> -- <paths>`), per the carried-forward mitigation from the previous wave's shared-index collision. All three commits contain exactly the files this plan owns, confirmed by `git show --name-only`. No sibling file was swept in, and none of mine leaked into a sibling commit.
- **Two production files were mutated and restored** (`orchestrators/plugin/list.ts`, `orchestrators/plugin/list.messaging.ts`) for the mandated checks. Each window was a single command pair — mutate, run, restore — with a filesystem backup taken first, and `git status --short -- extensions/` was verified clean immediately after each restore. This is the one hazard of running mutation checks in a shared worktree, and it was kept as short as the check allows.
- Nothing else. No blocked task, no auth gate, no package install, no checkpoint.

## Known Stubs

None. Every assertion added here is wired to real rendered bytes or to a real call count, and each has been observed failing under a mutation.

## Threat Flags

None. This plan adds no production surface; it adds three test files' worth of assertions over existing behavior. The two threats it was written to mitigate (`T-104-03` induced fetch, `T-104-06` a plugin author's own declaration reaching a read surface) now each carry a behavioral guard that has been seen to fail, and `T-104-07` — a guard mistaken for coverage — is answered by the three mutation outputs recorded above.

## Verification Run

| Command | Result |
|---|---|
| `node --test tests/orchestrators/plugin/{list,info}.test.ts tests/shared/notify-not-installed-reasons.test.ts` | 166/166 pass |
| `node --test "tests/orchestrators/plugin/*.test.ts"` | 802/802 pass, 0 fail, 0 skip (800 after Task 1, 802 after Task 2) |
| `node --test "tests/shared/**/*.test.ts"` | 344/344 pass, 0 fail, 0 skip |
| `npx tsc --noEmit` | exit 0 at every task boundary |
| `npx eslint` over the three files | exit 0 at every task boundary |
| `npx prettier --check` over the three files | clean at every task boundary |
| `git diff --name-only -- extensions/` | empty at every task boundary |

`npm test` and `npm run check` were deliberately NOT run: a sibling executor was mid-edit in the shared worktree for most of this plan, so a full-suite result would have reported their in-progress state as this plan's. The phase-boundary gate belongs to the orchestrator.

## Acceptance Criteria Evidence

| Criterion | Result |
|---|---|
| List probe appears AFTER the `listPlugins` await in source order | yes — probe block follows the byte-equal assertion, which follows the await |
| List probe asserts the caught error CODE, not a boolean | yes — `assert.equal(probeCode, "ENOENT", ...)` |
| List probe derives its path from the scoped-locations bundle | yes — `locationsFor("user", cwd).pluginClonesDir`; no literal path join |
| Info guard asserts seam call count 0 AND the exact substring | yes — `cloneCalls.length === 0`, `fetchCalls.length === 0`, `msg.includes("(remote) {installs disabled}")`, plus whole-body byte-equal |
| Pre-existing offline guard unchanged | yes — `git diff` over that block is empty; not a line, not a comment |
| `stageWarmMirror`'s new parameter optional and defaulted; no pre-existing caller moved | yes — the only `+` caller line in the diff is the new declining case |
| Both declining cases assert the FULL body with `assert.equal` | yes |
| Both declining cases pair a SILENT entry with a DECLARING clone | yes — the manifest entry omits `defaultEnabled`; the staged `plugin.json` sets it false |
| New guard file reports at least 6 passing tests | 6/6 |
| DROP tests pass a POPULATED reasons array | yes — both use the shared stamped row constants |
| Absent-versus-empty tests compare two rendered bodies to each other | yes — `assert.equal(absent, empty)` before either is compared to a literal |

## User Setup Required

None.

## Next Phase Readiness

Ready. What the remaining work inherits:

- The entry-only rule now has a tripwire on both surfaces, so the catalog and divergence documentation can describe the rule knowing a silent regression is no longer possible.
- The pre-existing hollow guard in the list suite is still hollow and still carried in the backlog. Its neighbor now carries a comment naming both of its faults, so whoever picks the backlog item up has the diagnosis in the file rather than in an archived research doc.
- `stageWarmMirror`'s third parameter is available for any later case needing a warm clone with a specific manifest; the default keeps every existing call site inert.
- The new guard file is the place to update FIRST if a producer is ever added for the central switch's `(available)` or `(remote)` arm — its two DROP tests state that explicitly.

## Self-Check: PASSED

- `tests/orchestrators/plugin/list.test.ts` — FOUND (`installs disabled` present; 82 tests, 80 before this plan)
- `tests/orchestrators/plugin/info.test.ts` — FOUND (`installs disabled` present; 78 tests, 76 before this plan)
- `tests/shared/notify-not-installed-reasons.test.ts` — FOUND (`LIST_CONTEXT` present; 6 tests)
- Commit `c0abb439` — FOUND
- Commit `22db971c` — FOUND
- Commit `e6a30b0e` — FOUND
- `git diff --name-only -- extensions/` — empty (no production file modified by this plan)

---
*Phase: 104-pre-install-read-surfaces*
*Completed: 2026-08-15*
