---
gsd_state_version: "1.0"
milestone: workflows-replay
milestone_name: Workflow Bridge Replay onto main
current_phase: 116
current_phase_name: Load-time workflow convergence
current_plan: 3 of 4 executed
status: executing
stopped_at: Completed 116-03-PLAN.md
last_updated: "2026-09-09T16:15:00.000Z"
state_head: ad17e6ad1f31de304feee727f16e6f09a0fb99b2
progress:
  total_phases: 9
  completed_phases: 7
  total_plans: 36
  completed_plans: 35
  percent: 78
last_activity: 2026-09-09
last_activity_desc: Executed plan 116-03; the byte-change control run and pasted
---

# Project State

## Project Reference

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>`
and, after `/reload`, have every supported Claude plugin component appear as a
working Pi-native artifact — atomically, recoverably, and with soft-dependency
degradation that never blocks the install.

**Current focus:** Phase 116 — Load-time workflow convergence. The replay
is done: phases 109-114 re-landed the `workflows` bridge on a main that had
moved under it. What remains is the three-phase hardening milestone that closes
the gaps the bridge originally shipped with.

## Current Position

Phase: 116 — Load-time workflow convergence
Plan: 3 of 4 executed (4 plans, 3 waves, 10 tasks)
Status: Executing — wave 2 done (116-02 and 116-03); 116-04 closes the phase

Phase 115 is complete on every gate. The replay milestone (109-114) is complete
and the first of the three hardening phases has now closed behind it; 116 and 117
remain.

Phase 115 closed at 6/6 plans, a deep code review of 1 critical and 6 warnings
with all 7 fixed, goal verification 6/6, security SECURED at 30/30 threats closed
with `threats_open: 0`, and the nyquist gate validated with zero gaps. Its two
deferred items were re-measured and closed rather than carried.

Phase 114 closed the replay. It made the host workflow engine the third soft
dependency and published `docs/workflows-compatibility.md`, the contract of the
one bridge that installs executable code rather than data. Verified 7/7,
security SECURED (22/22 threats closed), nyquist validated, `npm run check`
green at 5564 unit + 34 integration tests.

Two things it settled that later phases should not re-litigate:

- **Criterion 6 is CONFIRMED; no behavior rests on an unsourced premise any
  more.** Upstream's plugin manifest does declare `workflows` as
  `string | array` — Claude Code 2.1.251's own schema calls it "Path to a
  workflows directory or .js file, relative to the plugin root", in a body
  shaped like `themes` and `outputStyles`. `SUPPORTED_COMPONENT_PATH_KINDS`
  keeps `workflows` and `tests/domain/resolver.test.ts` now carries the
  citation. Two divergences went into the doc rather than the code: upstream
  *replaces* the convention directory where this project *unions* (D-07), and
  upstream admits a `.js` file path that this bridge silently drops.
- **Every engine figure inherited from the archived phase was stale.** At 3.10.1
  `parseWorkflowScript` refuses at NINE checks, not seven, and this bridge
  replicates TWO, not one. Spike 027's own "twelve messages" contradicted its
  source and was corrected. The engine is past 1.0 (57 versions, 1.0.0 through
  3.10.1), not the "0.x" the archived context claimed.

**The pattern that has now cost this milestone five times: an enumeration is
smaller than the set it names.** Seven engine gates were nine. Five
`composeReasons` translation sites were six. Two `piWithBothLoaded` definitions
were four. Seven closed-set amendment sites were eight. Each was found by
removing something and watching what went red — never by listing. Phases
115-117 should assume their own enumerations are short until measured.

**And its companion: a guard can be green because it checks nothing.** Phase
114's code review found the new marker-coverage gate had a hand-maintained
seven-entry literal with nothing binding it to the real site set — planting an
eighth site printed `pass 1 / fail 0`. After the fix it prints `pass 1 / fail 1`.
Every gate this milestone adds gets a negative control run before it is
believed, and the transcript goes in the SUMMARY.

Carried debt, tracked not hidden: Broken Windows #34 (the compatibility doc's
engine line-number citations are ungated and will rot; `WPIN-01` is the named
future subject), and WDEP-03's live hop — installing the engine and reloading —
has no automated home on this tree, resting on Spike 027 and the structural
probe-purity gate instead.

## Progress

**Phases Complete:** 7/9 verified (Phases 109-114 replay, 115-117 hardening)
**Current Plan:** 0/4 executed

```text
[========--] 78%
```

| Phase | Name | Status |
|-------|------|--------|
| 109 | Kind inversion | Complete (5/5 plans, verified 12/12) |
| 110 | Domain and platform modules | Complete (3/3 plans, verified) |
| 111 | Workflows bridge | Complete (4/4 plans, verified) |
| 112 | Install and removal lifecycle | Complete (4/4 plans, verified) |
| 113 | Update, enable/disable, reconcile | Complete (5/5 plans, verified 9/9) |
| 114 | Degradation and documentation | Complete (5/5 plans, verified 7/7) |
| 115 | Install-time admission-gate warnings | Complete (6/6 plans, verified 6/6, secured 30/30, nyquist 0 gaps) |
| 116 | Load-time workflow convergence | 2/4 plans executed (3 waves), checker passed (hardening) |
| 117 | Measured `agent()` failure evidence | Not started (hardening) |

**Why one run covers both milestones.** GSD scopes a milestone by parsing a
`vN.N` version out of STATE's `milestone:` field
(`workstream-inventory.cjs::readCurrentMilestoneVersion`). This workstream uses
a NAME, so scoping never engages and `roadmap analyze` returns all nine phases.
That is the right order to run them in anyway — replay, then harden — so
`total_phases` is 9 rather than the replay's 6. A consequence of the same gap:
`workstream status` reports this workstream `milestone complete`, derived from
the archived `milestones/workflows-ROADMAP.md` through the legacy fallback.
`init milestone-op` reads it correctly as incomplete, and that is what
`/gsd-autonomous` uses.

**Why the numbers start at 109.** Phase numbers are per-workstream, not global:
root `v1.19` uses 106-117, `defaults-enabled` uses 101-105, and this
workstream's archived milestone uses 101-105. Only a collision *within* this
workstream would matter, and 106-108 are free here. They are left unused
anyway, because the spike branch's own records plan the hardening milestone as
"Phases 106-108" — reusing those numbers for the replay would make every such
reference ambiguous when the two branches are read side by side.

## Replay Ground Truth

What is on this branch right now, so a later session does not read the archived
101-105 records as a claim about this tree:

- **Planning artifacts:** ported. The 101-105 phase records, the archived
  requirements, and the milestone audit all describe work that exists on
  `features/workflows-spike`, not here.
- **Spike evidence:** ported and renumbered 021-026 (008-013 collided with this
  branch's existing spikes). Re-verified against engine 3.10.1 in Spike 027,
  whose own `validateMeta` message count was found wrong and corrected in
  Phase 114.
- **Production code: the replay is COMPLETE.** The domain and platform leaves
  (110), the whole of `bridges/workflows/` (111), install and removal (112), the
  remaining lifecycle verbs and read surfaces (113), and the soft-dependency
  marker plus the published contract (114) are all on this branch. Still absent
  by design: the `EXTENSION_VERSION` bump and the CHANGELOG entry, which are
  milestone-close work.
- **Behavior today:** a workflow-bearing plugin resolves `installable`, installs
  with no `--partial`, materializes its envelopes through a sixth ledger phase
  that unwinds with the rest, and renders `requires pi-dynamic-workflows` when
  the host engine is absent. `update`, `enable`, `disable` and load-time
  reconcile all treat `workflows` as first-class. The released 0.18.1 still
  behaves the #154 way.

## Accumulated Context

**Decisions carried in:**

- **Only the lax direction self-corrects.** A replicated engine gate can only
  make the bridge stricter than the engine; a spurious refusal needs an
  extension release to clear, a spurious warning costs one line. Phase 115 may
  read the six gates but must never refuse on them.

- **The determinism blocklist keeps its refusal.** It is the one replicated
  gate because it is the one whose failure the engine reports wrongly — a
  raw-text screen cannot tell a call from a mention, so a script is refused for
  a rule its comment merely names.

- **Equality is not growth.** The convergence widening keeps the strict-superset
  test and the extension-version stamp; re-materializing on every load is the
  failure WCONV-02 exists to prevent.

- **Never scan a disabled record.** The backfill re-materializes through
  reinstall, whose record write sets `enabled: true` unconditionally, so
  scanning a disabled record reverses an explicit user disable at load time.
  Widening the arm must not widen past that filter.

- **Engine claims are pinned to `@quintinshaw/pi-dynamic-workflows` 3.10.1 (Spike 027)**, and
  every claim carries its evidence grade — documented-upstream,
  runtime-measured, or source-read. An ungraded claim reads as stronger evidence
  than it is.

- **The engine is deliberately not a declared dependency.** Adding it would
  couple `npm run check` to a 0.x package with ~50 releases since May 2026 and
  no exported contract. The live-UAT scratch-install route exists precisely to
  avoid that, which is why WEVID-01 produces a HUMAN-UAT item rather than an
  automated gate.

- Host engine chosen on trust grounds: it sandboxes scripts in a
  `vm.createContext` realm. `@nicknisi/pi-workflows` is rejected —
  `runInThisContext()` plus the real `process`, all env vars, and
  `process.binding('fs')`. The reason token is `requires pi-dynamic-workflows`,
  never `requires pi-workflows` — the latter names the rejected engine.

- NFR-10 carries a writable **root** (`~/.pi/workflows/`), not a subdirectory;
  the engine honors no override, and staging must sit adjacent to the target.

**Open todos:** None yet.

**Blockers:** None.

**Evidence base:** The validation audit of Phases 101-105 (2026-08-16) — sources
and tests read, suites run, and the real admission logic driven against the
seven workflow scripts of the two Anthropic-authored plugins that carry a
`workflows/` directory (`claude-security`, `code-modernization`). All seven pass
the six unreplicated gates today, so the value of Phase 115 is in the error
message a third-party author gets, not in a live breakage. Spike findings for
the bridge itself are packaged in the `spike-findings-pi-claude-marketplace`
project skill (`references/workflows-bridge.md`), which auto-loads during
implementation.

## Session Continuity

**Last session:** 2026-09-09T15:08:57Z

**Stopped At:** Completed 116-01-PLAN.md. Three task commits (`f96143d4`,
`a42a7e04`, `507d376d`); `npm test` 5646/5646 and `npm run test:integration`
34/34. All three negative controls this plan owed were RUN and their failing
transcripts are pasted verbatim in `116-01-SUMMARY.md`.

**Resume File:** None

**Next Action:** Plans 116-02 and 116-03 are unblocked (both `depends_on:
["116-01"]`). 116-04 owns `npm run check` and the per-pair coverage runs; this
plan deliberately did not run them.

Three things this plan settled that 116-02..04 should not re-derive:

- **The widened scan is bounded to PATH sources.** `resolveRecordedPluginOffline`
  passes no clone-cache resolver, so `url` / `git-subdir` / `github` records
  resolve `unavailable` offline. Measured on the cached official marketplace: 49
  of 172 plugins are path sources. The bound is now stated in
  `scanForceInstalledBackfills`'s doc comment.
- **The CONTEXT's population claim is still unmeasured, and narrows against.**
  No plugin in either cached marketplace carries a `workflows/` component
  directory at all, so whether the Anthropic-authored workflow plugins are
  path-source could not be confirmed from this machine. `REQUIREMENTS.md`'s
  WCONV-01 prose has been corrected to say so rather than carry the claim.
- **The short-enumeration pattern recurred four more times in one plan.** The
  research's 7-site prose list was really 12; the plan's 4 projection cases were
  really 6, plus a 7th in `apply.test.ts` that only `npm test` caught. Every one
  was found by running a gate, never by re-reading a list.

**Superseded:** 2026-09-09T12:05:00Z

**Stopped At:** Phase 115 complete and marked. All six plans have SUMMARYs; the
deep code review found 1 critical and 6 warnings and all 7 were fixed; goal
verification passed 6/6; the security audit returned SECURED with 30/30 threats
closed and `threats_open: 0`; the nyquist gate validated with zero gaps. `npm run
check` is green at 5645/5645 unit and 34/34 integration.

**Next Action:** Phase 116 (Load-time workflow convergence, WCONV-01..03), then
Phase 117 (Measured `agent()` failure evidence), then the milestone lifecycle.
Resume with `/gsd-autonomous --from 116`.

Two things this session settled that later phases should not re-litigate:

- **A plugin-supplied file name could forge lines in the rendered warning block.**
  `forMessage` escaped the name inside `reason` while `softFailWarning`
  interpolated it raw one function away, and a third span (`reason` on the IO
  paths, where an errno quotes the offending path back) was missed by the review
  and caught by the fix pass. All three now route through the exported
  `forMessage`. The lesson recorded in `115-SECURITY.md`: a mitigation can be
  true of the component it names and false in the composer beside it.
- **An `accept` justified by "pre-existing and unchanged" is not a safe accept.**
  `T-115-15` reasoned exactly that way and was falsified — widening the render to
  `install` and `reinstall` is what made the unescaped span reachable from them.

Carried forward: Broken Windows **#37** (open) — `PathContainmentError`
interpolates the untrusted resolved child path raw, so escaping a caller's label
closes nothing. Measured at **15 non-constant labels across 58 call sites**, not
the 1-of-23 first recorded; that correction is the twelfth instance of this
milestone's short-enumeration pattern and the first one written by the
orchestrator rather than found in a plan.

**Superseded:** 2026-09-09T02:25:41Z

**Stopped At:** Session resumed from `HANDOFF.json`. Phase 115 is planned (6
plans, 3 waves, `4621fd24`) and the plan-checker gate has not run.
**Resume File:**
`.planning/workstreams/workflows/phases/115-install-time-admission-gate-warnings/.continue-here.md`
**Next Action:** Spawn `gsd-plan-checker` for Phase 115, then
`/gsd-autonomous --from 115`.

The two validation verbs the planner could not finish under load have now been
re-run on a quiet machine (load 0.90 against the 52-70 that hung them) and both
are clean: `frontmatter validate --schema plan` reports `valid: true` on all six
plans, and `verify plan-structure` reports `valid: true` with zero errors on all
six. A negative control was run on the first verb — `115-CONTEXT.md` against
`--schema plan` returns `valid: false` with all eight fields missing — so the
six green results are not a guard that checks nothing. Note both verbs exit 0
regardless of verdict; the `valid` field is the signal, not the exit code.

`verify plan-structure` raised ONE warning, on `115-06` only:
`[plan-criteria R4] A fallible git in a non-final pipeline stage is swallowed —
the pipeline reports the last stage's status, so a broken command reads as
clean. Capture the status first.` This is the milestone's own recurring class
and should be fixed in the plan before `115-06` executes.

Superseded next action: `/gsd-verify-work 112` — all four plans are executed and the
phase gate is green. Three stale "five kinds" statements survive OUTSIDE the six
files `112-04` was scoped to and are the closest thing the phase leaves open:
`tests/orchestrators/plugin/enable-disable.test.ts:869` (which mirrors the
comment `85b0692b` corrected in `enable-disable.ts`), `tests/live-uat/README.md`
and `docs/competitive-analysis/pi-plugins.md`. Two "five-phase" statements
survive in `docs/competitive-analysis/` for the same reason. None is matched by
the phase's own acceptance greps.

Superseded next action: `/gsd-verify-work 111` — all four plans are executed and
the phase gate is green. `111-04`'s two commits are `b524524c` (the version bump at
six sites plus the `.planning/PROJECT.md` prose site) and `a3939034` (the
install-window assertion inversion). Task 3 produced no commit, which is the
planned outcome: `pre-commit run --all-files` rewrote nothing.

Three things the next phase inherits. **The `orchestrators` fallow allow-list
still omits `"bridges-workflows"`** — nothing imports the bridge yet, so adding
it here would be unverifiable, but the first orchestrator import must add that
one string in the same change or `fallow dead-code`'s boundary sub-gate fails on
the new edge. **The two explicit bridge calls in
`tests/integration/workflow-kind-inversion.test.ts` are a placeholder for the
install-driven path**; replacing them is a small edit and the assertion beside
them does not change. And **the bump does not repair a stale record's artifacts
in this phase** — the gate opens and the re-resolution clears the reason token,
but the re-materialization runs through `reinstallPlugin`, which gains no
workflows phase until Phase 112.

`commitPreparedWorkflows`'s `onPlaced` is the caller's removal payload on every
path including each throw, while its RETURN value is a leak string rather than a
throw when only the staging cleanup failed; a caller that derives removal work
from the thrown error's type instead will unlink either a foreign file or a
previous envelope the rollback just restored.

Phase 109 remains verified 12/12 and marked complete in ROADMAP.md;
`109-VERIFICATION.md` carries the evidence. The phase's two manual-only
obligations were answered in `109-05-SUMMARY.md` §*Human-check answers* — the
Success-Criterion-4 observation sequence and the WINV-05 prose read — and the
verifier confirmed both against the tree.

**Two obligations ride into Phase 111, and both now live in ROADMAP.md**
§Phase 111 Success Criteria items 7-8 rather than only in phase-109 artifacts:
bump `EXTENSION_VERSION` in the same change that lands `bridges/workflows/`, and
invert the D-109-06 ENOENT assertion in
`tests/integration/workflow-kind-inversion.test.ts`.

**Where the work lives:** the worktree
`/home/acolomba/pi-claude-marketplace-workflows` on branch `features/workflow`.
The primary checkout (`/home/acolomba/pi-claude-marketplace`) carries none of
this workstream's planning files. The older `.worktrees/workflows-spike`
worktree on `features/workflows-spike` still exists and is reference only — the
replay reads it, never merges it. GSD tooling is gitignored and therefore absent
from a fresh worktree; this one has `gsd-core`, `agents`, `hooks`, `scripts`,
`commands/gsd-*.md` and the install state copied in from the primary checkout,
with `workstream set workflows` applied. All of it is gitignore-matched, so
`git status` stays clean. Run gsd-tools from this worktree, never from `main`.

**Executors run SEQUENTIALLY here, never in agent worktrees.** This worktree's
own `node_modules` is a real directory, but a freshly-created agent worktree has
none, so it could not run `npm run check` at all. `workflow.use_worktrees` is
`false` in `.planning/config.json` for the same reason. Force the dispatch
sentinel (`query dispatch-isolation --raw --phase N --force-isolation none`)
before every executor, reviewer and fixer dispatch — a bare call re-resolves and
re-persists `harness-worktree` as a side effect.

**Outstanding, carried deliberately:**

- **Phase 101 was never code-reviewed.** Its 23 changed files are verified 4/4
  but unreviewed — the earlier autonomous run was interrupted at that dispatch.
  Phase 102's review found two blockers in comparable code, so the gap is real.
  Resume with `/gsd-code-review 101`.

- **Release work from the `workflows` milestone is partly done.** `111-04`
  bumped `package.json`, `package-lock.json`, `EXTENSION_VERSION`,
  `tests/shared/extension-version.test.ts` and `sonar-project.properties` to
  `0.19.0` and opened a `## [0.19.0]` `CHANGELOG.md` section; later phases append
  bullets there rather than bumping again. Still open: push
  `features/workflows-spike` and open the PR — nothing is pushed yet and no PR
  exists. This milestone's phases can land on the same branch first.

- **The bare planning-artifact token claim against
  `tests/orchestrators/reconcile/backfill.test.ts` is CLOSED, and it was
  stale.** The token was real at `c695bdab3` (`// Pitfall 4 / D-68-03: …`) but
  the file was rewritten since; a grep for the whole forbidden token class now
  returns nothing. What the file actually carried was an orphaned doc comment,
  separated from `seededScopeTree` when a sibling helper was inserted between
  them. That has been moved back onto its function. Re-measured and recorded in
  `116-02-SUMMARY.md`.

- **The `node_modules` cleanup hazard does not apply on this worktree.** It did
  on `.worktrees/workflows-spike`, where `node_modules` was a symlink ignored
  only via a local `.git/info/exclude` and had to be removed before
  `gsd-cleanup` would pass its worktree_dirty check. Here it is a real
  directory ignored by the committed `.gitignore:67`, and this worktree's
  exclude file is empty — verified 2026-09-04. Re-check before running
  `gsd-cleanup` from any other worktree.

- **Four residual risks accepted in the `workflows` milestone**, recorded so they
  are not rediscovered as new defects: the commit double-fault branch (restore
  failure during rollback) has no automated test; a narrow `update` double fault
  can persist a record over-claiming a foreign name; the two re-stage-window
  tests are POSIX-only and SKIP as root, so container CI skips them silently;
  and `unplaceWorkflows` failures surface only as leak strings on the
  manual-recovery message.

- **All five `VALIDATION.md` files for Phases 101-105 are `status: draft`**, so
  Nyquist reads NOT-VALIDATED. A coverage TODO, not a compliance failure —
  `/gsd-validate-phase 101..105` closes it if wanted.

- **One open question for the operator:** `README.es.md` reads
  `Workflows (flujos de trabajo).` (parallel to the existing `Hooks (ganchos).`).
  Flip to `Flujos de trabajo (workflows).` if preferred — the link text changes
  with it.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| — | — | — | — |
| Phase 109 P01 | 22 min | 3 tasks | 7 files |
| Phase 109 P02 | 11 min | 2 tasks | 6 files |
| Phase 109 P03 | 12 min | 2 tasks | 8 files |
| Phase 109 P04 | 14 min | 3 tasks | 5 files |
| Phase 109 P05 | 15 min | 2 tasks | 1 file |
| Phase 110 P01 | 21 min | 2 tasks | 4 files |
| Phase 110 P02 | 22 min | 2 tasks | 4 files |
| Phase 110 P03 | 47 min | 3 tasks | 4 files |
| Phase 111 P01 | 35 min | 2 tasks | 5 files |
| Phase 111 P02 | 62 min | 3 tasks | 7 files |
| Phase 111 P03 | 35 min | 3 tasks | 4 files |
| Phase 111 P04 | 34 min | 3 tasks | 8 files |
| Phase 112 P01 | 70 min | 3 tasks | 51 files |
| Phase 112 P02 | 40 min | 3 tasks | 8 files |
| Phase 112 P04 | 42 min | 3 tasks | 9 files |
| Phase 116 P01 | 36 min | 3 tasks | 13 files |

## Decisions

_Recorded per phase as the milestone proceeds._

- [Phase 109]: The closed-set move is one commit, never two. T-02-25 warns that a kind in neither closed set is silently ignored, so the removal from `UNSUPPORTED_COMPONENT_KINDS` and the additions to both supported tuples landed together in `f23d964d`. — A tidier two-commit split would have published an intermediate tree carrying the exact defect the security note exists to prevent.
- [Phase 109]: The install-level window test composes the host engine's storage root by hand (`path.join(HOME, ".pi", "workflows")`) rather than adding a `locations` getter for it. — That getter is Phase 110's deliverable; adding it here would be an unused export `fallow dead-code` would flag, and a boundary widening the assertion does not need.
- [Phase 110]: The relocation seam was deleted outright rather than reshaped into a `homeDir` parameter. — `os.homedir()` re-reads `HOME` on every call and caches nothing, so `HOME` plus `t.after()` restoration is a working replacement; threading a home directory through every Phase 111 call site that does not otherwise need one would be a worse contract for a hazard the research measured absent.
- [Phase 110]: The header sentence defending the seam was replaced, not merely orphaned. — A comment arguing for a mechanism you just deleted, from a premise measured false, is worse than no comment.
- [Phase 110]: The relative-path parity case pins the working directory with `process.chdir("/")` instead of taking the spike's split pin. — The split pin computes half its expectation with production code; a pinned cwd makes the same row a transcribed literal that is deterministic on any machine.
- [Phase 111]: WPTH-03 is read as SPLIT across two phases rather than re-proved at the composition site. — The derivation half closed in Phase 110 with a mutation-sensitive literal parity table; this plan owes only that the derived key lands as the middle segment of `workflowsSavedDir`, and a second copy of those literals here would give one derivation two sources of truth.
- [Phase 111]: The WPTH-02 writing-half case passes a distinct temp directory as the `cwd` ARGUMENT instead of relocating `process.cwd()` as planned. — Nothing in `locationsFor`'s call graph reads the process global; `cwd` is a parameter, so mutating `process.cwd()` would prove nothing about the input the code consumes and the case would pass for a cwd-derived implementation too.
- [Phase 111]: The two `path.basename` failure injectors in the marketplace-add owner test were scoped to the config path rather than moving `locationsFor` inside `addMarketplace`'s try block. — The port made `locationsFor` traverse `path.basename`, and `addMarketplace` calls it one line before the try, so an unconditional process-wide throw escaped the normalizer under test. The normalizer was never broken and `locationsFor` cannot throw in production; changing an orchestrator's error contract to accommodate a test injector would have been the wrong repair.
- [Phase 111]: That repair landed as its own commit placed BEFORE the tracer commit. — It is green both with and without the port, so ordering it first is what lets the tracer commit carry exactly its two planned paths and still leave `npm test` green, instead of trading one verification clause for the other.
- [Phase 111]: WPTH-05 is pinned by a cross-configuration invariant, not by a rename-fails-EXDEV assertion. — Whether two roots share a filesystem is a property of the machine, so a same-filesystem box records success as an expected result; two bundles under one `HOME` with differing `PI_CODING_AGENT_DIR` and differing project directories fail on exactly the refactor that reintroduces EXDEV.
- [Phase 110]: WPTH-02 is recorded as carried forward rather than completed. — Phase 110 writes nothing, so it can prove only the home-derivation negative; the "never written" guarantee belongs to the Phase 111 modules that write.
- [Phase 110]: The ported `assertSafeSavedWorkflowName` was completed to all six engine clauses rather than the gap being recorded and carried to the admission-gate hardening phase. — The wrapper is new code the port itself introduces, so completing it makes the bridge match the engine EXACTLY rather than exceed it; the alternative was a workflow whose author put a space in `meta.name` installing and never running, with no signal.
- [Phase 110]: The docblock sentence claiming `assertSafeName` already enforced the separator/NUL screening was replaced, not annotated. — It was measured false against engine 3.10.1 for a plain space and the whole `\p{Cf}` category; a comment arguing a false premise is worse than none.
- [Phase 110]: `CrossPluginConflictError`'s reference-identity assertion was INVERTED for `WorkflowNameCollisionError` rather than copied as `110-PATTERNS.md` instructs. — The analog assigns its argument array directly; this class assigns `Object.freeze([...collisions])`, so the owner test pins `notStrictEqual` + `Object.isFrozen` + a post-construction push into the caller's array, which is what proves the copy defensive rather than incidental.
- [Phase 110]: The dependency, the module and its owner test landed as ONE commit of four paths. — `fallow dead-code` reports `unused-dependency` for a declared-but-unimported package and `unused-export` for a module no test imports, and both the `npm-fallow` hook and `npm run check` scan the whole working tree, so every intermediate split publishes a red tree.
- [Phase 110]: Verdicts are asserted through a projection that drops `reason`. — `reason` is the only field that changes when wording is edited, and discriminating a verdict by message text is the exact failure the literal-tagged union exists to remove; the projection plus one `deepStrictEqual` plus `satisfies` pins the discriminant at run time and the arm at compile time.
- [Phase 110]: Two coverage gaps the research did not predict were closed by adding public-behaviour cases, never a suppression directive. — The restructure changed which arms the case set reaches (Assumptions Log A2 warned of exactly this), leaving `metaPropertyKey`'s computed-key early return and `stemFallbackVerdict`'s refusal arm uncovered; reading the reported LCOV lines and adding one case each took the pair to 105/105 branches.
- [Phase 110]: WNAM-03 is recorded as carried forward rather than completed. — Phase 110 delivers the `skipped`/`no-meta` classification but emits nothing to a user and installs nothing, so the requirement's warning and not-installed halves belong to Phase 111.
- [Phase 110]: No parse size or depth cap was added (T-110-17, accepted). — The host engine has none either, and a cap stricter than the engine's would refuse a script the engine accepts; only the lax direction self-corrects across engine upgrades. Recorded as a Phase 115 candidate.
- [Phase 111]: The criterion-4 row is emitted from `verdictWarning` in the discovery module, reusing `softFailWarning` with a fourth outcome phrase (`was installed but will not run`). — It is the single verdict-to-warning mapping in the bridge, staging already re-exports discovery's warnings unchanged, and the read-only surfaces that consume the same discovery pass get the row for free; emitting from staging would add a second warning-composing site and reach neither.
- [Phase 111]: The row's reason names the missing NAME and states the description as the engine's OTHER requirement, never as a second observed absence. — Both measured stem-fallback shapes carry a description, so a row claiming otherwise would be a false statement about the file, which is worse than no row.
- [Phase 111]: The case-fold dedup case plants two REAL directories differing only in case rather than declaring one directory under two spellings. — On a case-sensitive filesystem the plan's shape leaves the second directory non-existent, `readdir` returns nothing, and the case passes whether or not the key is folded; it would have covered the darwin arm while asserting nothing about it.
- [Phase 111]: The three permission-mutating cases share ONE `t.after()` between the restoring `chmod` and the tree removal. — `node:test` runs after-hooks in registration order, so a removal registered by a shared root helper runs before the restoring chmod and fails with `EACCES`, turning two green assertions into two red cases whose summary line looks like a broken assertion.
- [Phase 111]: The CR-01 restore-failure branch is driven by a composer override carrying a SIDE EFFECT, not by a composer returning two different paths. — `displacePreviousTargets` resolves each previous name once and the restore loop replays the captured pair, so "resolve differently on the displacement read and on the restore read" is unbuildable; what the seam does reach is ordering, and resolving the second previous name after the first has been displaced is the one moment the freed target can be turned into something a restore cannot rename back onto.
- [Phase 111]: The fully-successful-reversal case asserts the ABSENCE of a leak suffix rather than its presence. — A reversal that left nothing placed and a staging cleanup that succeeded produce no leak at all, so asserting one would require an implementation that reports a leak falsely; the absence is exactly what separates that case from the failed-reversal case beside it.
- [Phase 111]: Four measured branch gaps in `stage.ts` were closed by adding three public-behaviour cases, never a suppression directive. — The noop case now plants a no-`meta` script instead of a non-script file, and two rollback cases were added (a non-ENOENT displacement failure, and a re-stage whose restore succeeds); the module went from 53/57 to 61/61 branches.
- [Phase 111]: The staging-side first-wins dedup is reported as unreachable through the public API rather than force-covered. — Discovery dedups by absolute source path and the collision assert rejects any two records sharing a generated name, so no input makes `seen.has(...)` true; V8 records the expression as evaluated, the module still reports 61/61, and the guard stands as defence in depth.
- [Phase 109]: A negative assertion is only trusted after a non-vacuity probe. Before accepting the green `ENOENT` assertion, `resolveStrict` was driven against the identical fixture shape and returned `installable` with `workflows` in `supported`. — Without that check the assertion passes just as happily for a plugin carrying no `workflows/` directory at all, and would pin nothing.
- [Phase 111]: The version moves to `0.19.0`, a MINOR bump, and it is the only bump of the milestone. — Every `0.x.0` heading in this changelog introduces new user-visible capability and a sixth component kind is capability; a patch bump would force a second bump later and a renamed section, and later phases append bullets under the heading created here.
- [Phase 111]: The install-window assertion was inverted against two EXPLICIT bridge calls through the barrel rather than deferred to the install-driven path. — No orchestrator calls the bridge until Phase 112, so the criterion could not be met by wiring; the explicit drive makes the assertion true today and Phase 112 replaces the two calls without the assertion inverting again.
- [Phase 111]: The fixture's script body was changed from a default export to a named `meta` export. — The real admission rule classifies a default export `skipped`/`no-meta`, so no envelope was written in any phase and the inverted assertion would have been red forever; a negative control restoring the old body confirmed the case goes red.
- [Phase 111]: The precondition's COMMENT was rewritten while its three assertions stayed byte-identical. — It named an ENOENT assertion the inversion deletes, and the failure mode it described inverts too; the project's comment policy forbids narrating code that no longer exists, and the guard the plan protects is the assertions, not the prose above them.
- [Phase 109]: D-109-01/D-109-05 executed as a red slice: the five locking gates and the published byte contract were turned to the post-inversion reading BEFORE any production edit, and each was observed failing against unmodified code. — Success Criterion 4 asks for a red-then-green pair. With production edited first the renderer prints whatever the fixture hands it, both halves agree, and the observed red never happens.

- [Phase 112]: Both partial-cascade fold tests were observed RED against the unmodified folds before either filter line landed, then re-proven by deleting the lines again. — Neither site is compile-forced: both read the `dropped` bundle structurally, so a six-axis argument satisfies a five- and a four-axis parameter with no error. A fold test written after its line proves only that it compiles.
- [Phase 112]: The hand-rolled marketplace fold's pre-existing `hooks` omission was left in place, and the new case asserts the persisted record STILL names the dropped hook. — The divergence predates this work and is filed as `CASCADEAX-01`; pinning it as deliberate is what stops a later reader repairing it silently as an unrelated behavior change.
- [Phase 112]: The workflows unstage throw is placed AFTER `dropped.workflows` is assigned. — A cascade that fails part-way must still report the envelopes it did remove, and the partial-failure return is the only channel that carries them.
- [Phase 112]: The planned containment-refusal case for the cascade was dropped rather than written. — `assertSafeName` throws a plain `Error` for a path separator, so such a name lands in the bridge's per-name failure array, not as `PathContainmentError`; the containment class is already pinned at the install ledger where `assertPathInside` is actually reachable.
- [Phase 112]: `createProjectScope` and `projectCase` relocate `HOME` rather than a new per-case helper being added. — `workflowsSavedDir` is rooted at `os.homedir()` and honors no override, so every cascade test now reaches the real user's saved workflows unless the bundle is built after the assignment.

## Operator Next Steps

- Verify Phase 111 with `/gsd-verify-work 111` — all 4 plans are executed
- Phase 109 is complete and verified 12/12; 110-114 run in order, each
  depending on the one before it
- The hardening phases 115, 116 and 117 are mutually independent; the order
  above is execution order, not a dependency chain (they were renumbered from
  the spike branch's 106-108)
- Phase 117's canary run needs a disposable scratch install of
  `@quintinshaw/pi-dynamic-workflows` — it can be primed at any point in the
  milestone
