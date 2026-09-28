---
gsd_state_version: "1.0"
milestone: any-git-host
milestone_name: Any Git Host
current_phase: 3
current_phase_name: "`marketplace add` recovers from its own leftover clone"
current_plan: 4
status: "Phase 3 COMPLETE (re-verified 7/7 after gap closure 03-04). All 3 phases executed; milestone close blocked only on the Phase 1 and Phase 2 live canaries (GHCAN-01, GHCAN-02)"
stopped_at: "Phase 3 complete: gap closure 03-04 fixed CR-01, re-verification passed 7/7; WR-11 (multi-url origin) left open as a residual edge"
last_updated: "2026-09-28T03:21:28.703Z"
last_activity: 2026-09-28
last_activity_desc: "Phase 3 re-verified (passed 7/7) and marked complete"
state_head: dc3aa2004dad53900c132c6f9df489189824a499
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 10
  completed_plans: 10
  percent: 33
total_plans_in_phase: 4
---

# Project State

## Project Reference

**Core value:** A Pi user can run `/claude:plugin install <plugin>@<marketplace>` and, after
`/reload`, have every supported Claude plugin component appear as a working Pi-native artifact —
atomically, recoverably, and with soft-dependency degradation that never blocks the install.

**Current focus:** `any-git-host` reimplements the three real defects PR #153 (jstillwa) surfaced,
rather than merging that PR. A private source on any git host clones with a credential the user
already stored; an endpoint that answers only at its verbatim URL resolves; and `marketplace add`
recovers from its own leftover clone instead of demanding a manual `rm -rf`. The PR's two
Codex-layout changes are out of scope — Claude Code 2.1.274 contains zero references to
`.agents/plugins/` or `.codex-plugin/`.

## Current Position

Phase: 3 — `marketplace add` recovers from its own leftover clone — COMPLETE (4/4 plans, re-verified 7/7 on 2026-09-28)

**Phase 3 complete.** Re-verification passed 7/7: CR-01 is fixed by 03-04 and confirmed by a follow-up
code review (03-REVIEW.md; CR-01 and WR-10 recorded `fixed` in 03-REVIEW-DISPOSITION.md). That review
raised WR-11 (open): a `.git/config` with two `url` lines under `[remote "origin"]` is read by its LAST
value while git fetches from the FIRST. The verifier judged it outside SC2 because only a hand-edited
config produces it. IN-07 and IN-08 (info) are open too. Every phase is now executed; milestone close
waits only on the two live canaries (`/gsd-verify-work 1`, `/gsd-verify-work 2`).

**Gap closure EXECUTED (2026-09-28).** 03-04 landed in `24f2da2c` (fix + standalone case), `235fdc17`
(orchestrated case + real-repository table) and `26e4cfc8` (SUMMARY). `npm run check` at `235fdc17`:
`CHECK_EXIT=0`, 7369/7369 unit tests, `all files | 100.00 | 100.00 | 100.00`, 36/36 integration, 108
contract entries. Task 1 landed test and fix in one commit (the `npm-coverage-direct` pre-commit hook
rejects a deliberately red commit); RED evidence recorded in the SUMMARY. Awaiting code review and
re-verification.

**Gap closure planned (2026-09-27).** `03-04-PLAN.md` (`gap_closure: true`, wave 4, depends on 03-03)
closes CR-01: `listRemotes` returns the `origin` arm only when isomorphic-git's `url` is a string,
otherwise `no-origin`, which the existing refusal path turns into `{stale clone}`. Tests first: a
standalone and an orchestrated `add.test.ts` case over the REAL `listRemotes`, plus a real-repository
table in `git.test.ts` (fetch-only, header-only, empty `url =`). Task 3 re-runs the whole `npm run
check` with `CHECK_EXIT` captured and fences scope with `git diff --name-only f301135e..HEAD` (the
SC4 evidence from `50746b81` went stale when the origin/main merge `f301135e` touched source).
Plan checker passed with no issues. Next: `/gsd-execute-phase 3 --gaps-only --ws git-hosts`.

**One gap blocks closure (CR-01 / SC2 / MA-13).** `platform/git.ts::listRemotes` declares its `origin`
arm as `{ kind: "origin"; url: string }`, but isomorphic-git resolves `remote.<name>.url` separately
from the `[remote "<name>"]` subsection it enumerates, so a `[remote "origin"]` section carrying no
`url` key returns `{ kind: "origin", url: undefined }` — the declared type is not true. `stripGitSuffix`
then throws a raw `TypeError` that matches no typed precondition, so `classifyAddError` returns
`undefined` and `handleAddFailure`'s `if (!orchestrated) throw err` lets it escape the orchestrator
(ATTR-07 violation); orchestrated mode mislabels it `{unparseable}` instead of `{stale clone}`. Both the
reviewer and the verifier reproduced it independently against the real adapter and the real
isomorphic-git, not the test fake. Reachable through the very WR-07 crash window this phase exists to
recover from: a mid-write `.git/config` rewrite produces exactly this shape. The fake's
`ListRemotesResult` type cannot express `url: undefined`, which is why the 100%-branch gate could not
catch it (WR-10) — a missing branch, not an uncovered one. Fix: treat a present-but-url-less `origin`
as the `no-origin` arm, plus a real-filesystem test and an `add.test.ts` refusal case in both modes.
Current Plan: 4
Total Plans in Phase: 4

**Phase 3 Plan 01 (wave 1) is executed.** `platform/git.ts::listRemotes({ dir })` is the 8th `GitOps`
primitive and the only one that never throws: it reads `<dir>/.git/config` itself BEFORE calling
`git.listRemotes`, because isomorphic-git 1.42.2 resolves a missing `.git`, an unreadable
`.git/config`, and a real zero-remote repo identically to `[]`. It returns a four-arm discriminated
value (`origin` / `no-origin` / `not-a-repo` / `unreadable`), proven against real directories on disk
including a `chmod 0o000` unreadable config. `addGitClonedInGuard` step 4 is now recognize-remove-
rename: a leftover whose `origin` matches `canonicalCloneUrl(source)` (via the newly-exported
`stripGitSuffix`) is removed so the existing atomic rename can proceed (D-3-01, D-3-02); every other
arm still throws `StaleSourceCloneError` exactly as before (MA-13 unchanged), and a leftover whose
removal leaks also throws rather than renaming over a partial tree (MA-14). The leftover-removal leak
folds into the single existing `appendLeakToError` call via a new `joinLeaks` helper — the call count
stayed at 4, preserving `unwrapAddError`'s one-level unwrap contract.

The plan's inline switch pushed `addGitClonedInGuard`'s cognitive complexity to 18 against fallow's
threshold of 15; extracted into a `recognizeLeftover()` helper (Rule 1 deviation) that keeps the same
exhaustive four-arm switch with no `default`. A sixth hand-enumerated `GitOps` literal neither
03-CONTEXT.md nor 03-VALIDATION.md predicted — `tests/orchestrators/marketplace/update.test.ts::
makeForbiddenGitOps` — needed the same one-line stub as its five predicted siblings. Two
`check-unused-type-members.contracts.json` pins at `add.ts:545` shifted to `add.ts:565` (the new
helper functions land above them); remapped in place, entry count unchanged at 108. GATE-01's
unused-type-member gate additionally flagged `GitOps.listRemotes.opts.dir` as unread until the test
fake's `listRemotes` accepted (and read, via `void`) its `dir` parameter instead of dropping it.

**Measured, not predicted: the exact `add.ts` branches still uncovered at this plan's boundary** (for
plan 02): `joinLeaks()`'s both-defined and b-undefined join arms; `recognizeLeftover()`'s
origin-but-mismatched throw; `addGitClonedInGuard()`'s MA-14 leftover-removal-leaked throw. The
no-origin/not-a-repo/unreadable refusal arms are ALREADY covered by the pre-existing MA-6/WR-07
tests. `npm run check` stays red at this plan's boundary by design (`test:coverage:unit` does not
reach 100%); this is a phase-boundary obligation, not a plan-boundary one, per the Phase 2 precedent.

**Phase 3 is discussed; four decisions are locked.** Recognition compares the leftover's `origin`
against `canonicalCloneUrl(source)` — the identity, not the wire form, because identity is
`.git`-insensitive and D-2-05 just made it a fixed point (D-3-01). A recognized leftover is removed
and the fresh staging clone renamed in, so a partial tree from the crash window cannot leak into
installed state (D-3-02). The new `GitOps.listRemotes` returns a discriminated value rather than
throwing, so "foreign tree" stays distinguishable from "could not look" (D-3-03) — it will be the
only seam member that does not throw. The autoupdate cascade is to be FIXED, not filed (D-3-04):
`buildAuthForHost` requires a `ctx` its no-provider arm never reads, which is what makes the fix
narrow.

Recognition stays at the existing refusal site by necessity, not choice: `finalDir` derives from the
staged manifest's own name, so a retry still pays one clone to learn it could have reused.

**Planning found more than the research did, and measured rather than recalled.** Three files beyond
the obvious two build a `GitOps` value by enumerating every member, so the eighth breaks
`tests/edge/types.test.ts`, `tests/orchestrators/marketplace/shared.test.ts` and
`tests/e2e/import-command.test.ts` — the last is easiest to miss, because `tsconfig.json` includes
`tests/**/*.ts` so it fails `npx tsc --noEmit` even though no suite in `npm run check` runs it. Two
more catches: the fake must NOT gain a `listRemotes` call ledger (`git-ops-fake.test.ts` deep-equals
the whole `state.calls` object), and once SC5's `buildBundle` always returns a bundle, three
`authBundle !== undefined` spreads in `update-preflight.ts` acquire unreachable false arms that would
fail the 100%-branch gate unless made unconditional in the same edit.

**The MA-12 idempotency probe was corrected during planning.** A second `marketplace add` hits MA-8
(`{duplicate name}`) at step 3, BEFORE recognition at step 4 — so "run add twice" is a duplicate-name
failure, not the retry this phase delivers. The truth is written as the no-state-entry retry, with an
explicit MA-8-precedence case so it cannot be misread.

**The mid-phase red plan 01 declared is now closed.** `test:coverage:unit` did not reach 100%
branches at plan 01's boundary; plan 01 named the exact uncovered branches and forbade reaching
green by collapsing an arm or adding a coverage pin. `npm run check` green is a phase-boundary
obligation, not a plan-boundary one — the precedent Phase 2 set.

**Phase 3 Plan 02 (wave 2) is executed.** Every MA-13 refusal arm plan 01 left unproven is now
asserted by behaviour through `addMarketplace`, table-driven over one `ListRemotesResult` row per
arm: origin mismatch, prefix-adjacent (the whole-string-equality guard), case-differing (byte
comparison, no folding, D-3-01), ssh-form, garbage, and empty-string origin, plus the `no-origin`
and `unreadable` arms. Each case asserts the `{stale clone}` reason, the derived-name subject, and
the marker file surviving on disk. The pre-existing `MA-6 / ATTR-07` not-a-repo case is confirmed
byte-unchanged. A new case proves MA-8's duplicate-name check runs before recognition: a matching
leftover plus an existing state entry still renders `{duplicate name}`, not `{stale clone}`.
MA-14's single- and double-fault cases prove an unremovable recognized leftover fails as stale with
the leak appended and no recorded destination, and that a double fault (both the leftover-removal
leak and the staging-cleanup leak) still classifies through exactly one `Error.cause` level — the
case that fails if the two leaks were ever chained through two `appendLeakToError` calls instead of
joined into one. `npm run test:coverage:unit` now reports `all files | 100.00 | 100.00 | 100.00`.
No production file was touched (`git diff --name-only -- extensions/` is empty across both commits).

Status (historical, Phase 2 closure): Phase 2 verified — 9/9
must-haves, all 5 ROADMAP success criteria, all 5 plan prohibitions, `npm run check` at
`CHECK_EXIT=0`. Its live smart-HTTP canary is deferred to the operator alongside Phase 1's (see
Deferred Verification).
Last activity: 2026-09-27 — Phase 3 wave 3 of 3 executed; the milestone-closing obligations are
done and the whole gate surface is green at the phase's final HEAD

**Phase 3 Plan 03 (wave 3) is executed, and Phase 3's three plans are all complete.**
`buildAuthForHost`'s and `buildCloneAuth`'s `ctx` parameters become optional; the early-return
guard widens from `provider === undefined` to `provider === undefined || ctx === undefined`, so
the autoupdate cascade — which calls through `update-preflight.ts` with no `ctx` at all — now
attaches a host-bound auth bundle on every host instead of cloning authless, and a registry host
with no `ctx` declines the Device Flow gracefully rather than crashing on `makeRawNotifyFn(undefined)`.
The provider-found arm is untouched, so both registry hosts behave exactly as before whenever a
real `ctx` is present. `update-preflight.ts`'s local `buildBundle` closure — the actual defect,
which returned `undefined` when `auth.ctx === undefined` — is deleted outright; both clone-cache
arms call `buildCloneAuth` directly and their three conditional `auth` spreads become unconditional
properties. `update-flow.ts` is untouched, confirmed empty by `git diff --name-only`; its two
contract pins are unmoved. One preflight pin below the edit (`update-preflight.ts:349:63`,
`StaticPreflightRowOptions.fromVersion`) is remapped to `342:63` (a -7 line net delta), re-derived
on the formatted tree rather than predicted by arithmetic; the two pins above the edit are confirmed
unchanged. Both live canaries (Phase 1's private-repo clone, Phase 2's verbatim-only smart-HTTP
server) are carried forward in STATE.md (this section, above), `ROADMAP.md` § Milestone-wide
constraints, and two new `BACKLOG.md` entries (GHCAN-01, GHCAN-02) — neither is attempted, neither
is marked passed. `PROJECT.md`'s D-79-03 row rationale is rewritten to name the plugin failure
grammar's missing cause-chain trailer slot (`install.messaging.ts`) instead of the now-false
"no `onAuth` callback registered" claim; its OUTCOME sentences are byte-unchanged. `npm run format`
ran first (no rewrite produced) and the whole `npm run check` then ran green in one command:
`CHECK_EXIT=0`, 7354/7354 unit tests pass with `all files | 100.00 | 100.00 | 100.00`, 36/36
integration tests pass, `lint:type-members` holds the same 4 pre-existing exceptions with 108
contract entries, and both coverage-pin surfaces are unchanged. All four Phase 3 requirements
(MA-12, MA-13, MA-14, GATE-01) are now marked Complete in REQUIREMENTS.md — all 10 v1 requirements
across all 3 phases are Complete. Phase 3 has had no code review and no verification yet.

**Phase 2 took three code-review iterations, and the second one earned its keep.** The first fix
pass closed all 8 findings and went green — while silently moving the parse-time cache identity,
because it reordered `stripSlashAndFragment` and `stripUrlDecorations` inherited the change through
a shared call edge. The re-review caught it by running the pre-phase parser side by side with HEAD.
The repair restructured the seam into separately-named compositions with no call edge between them,
so a wire-side correction can no longer reach the identity; two negative controls prove the
decoupling rather than asserting it. The review also closed a scheme-gate hole that predated the
phase: object-form `url` sources reached `gitOps.clone` without the `https://`-only check, and the
phase had made the attacker-controllable `raw` field the one that reaches the network.

**D-2-05 is an operator decision, not a discovered fact.** Measuring the repair showed pre-phase
contradicted *itself* on one input shape: a `url` typed with a trailing slash immediately before a
`#<ref>` parsed to `.../o/r/` on first parse but recomputed `.../o/r` on every reload, so `add`
stored one `plugin-clones/<hash>` and every later operation missed it — orphaning the directory
permanently. Byte-identity with pre-phase and add/reload agreement are therefore mutually
exclusive. The operator chose to normalize both paths to `.../o/r`, making the identity a fixed
point (`FIXED_POINT_VIOLATIONS=0`). The accepted cost is one re-clone for that input class on first
use after upgrade. `02-01-PLAN.md`'s `canonicalCloneUrl` must_have is amended, not deleted, to name
the exception and cite D-2-05 — so a later reader sees an accepted amendment, not a failed
must-have. The scoping was checked, not assumed: every other input of every source kind keeps its
pre-phase identity byte-for-byte, and `https://github.com/o/r/#main` is still rejected.

**Phase 2 is planned: three plans, three waves, sequential by necessity.** Plan 01 (wave 1) lands
`networkCloneUrl` and an extracted `stripSlashAndFragment` in `domain/`, wires the `marketplace add`
seam, and proves it end to end against a git port that admits only the verbatim URL. Plan 02 (wave 2)
threads a required `networkUrl` through the three `clone-cache.ts` seam sites and their nine callers.
Plan 03 (wave 3) discharges RESEARCH assumption A1 with a residual suite audit, fixes the docstrings
that still teach the retired rule, and owns the phase-boundary `npm run check`. The waves cannot run
in parallel: the required `networkUrl` field makes each seam edit atomic with its callers, and the
`contracts.json` pins are line:col, so ROADMAP already mandates one edit at a time.

**Mid-phase red is planned, not accidental.** After plan 02 task 1 the test tree does not typecheck —
30 literal-construction sites lack the new required field — and after plan 02 the flow, bootstrap,
reconcile, register, integration and `marketplace update` suites are red because their allowlists
still admit only the suffixed form. Both plans state this and forbid restoring a `.git` suffix to
reach green. Plan 03 closes it.

**Planning surfaced three gate exposures RESEARCH.md had missed**, all now planned: `fallow`
dead-code would have gone red had `networkCloneUrl` stripped `ensureGitSuffix` of its last production
consumer (the github arm is locked to `ensureGitSuffix(canonicalCloneUrl(source))`);
`addGitClonedInGuard`'s `cloneUrl` parameter becomes dead and is removed with both call-site passes;
and four `check-unused-type-members.contracts.json` coordinates shift under prettier and need an
in-place line remap. A fourth Wave 0 gap was recorded: five wire-URL sites are template literals and
were invisible to the `.git"` grep that sized RESEARCH's blast radius.

**Phase 2 turned out not to need the retry it was scoped around.** Research against the Claude Code
2.1.274 binary settled it: the marketplace source parser appends `.git` only for `github.com`
(`ho`/`Fs`) and `gitlab.com` (`fio`/`dio`) `owner/repo` paths, and its add dispatcher passes a `git`
source's URL through to the clone untouched. Its `{source:"url"}` kind is not a clone at all — it
fetches a hosted `marketplace.json`. So our unconditional `ensureGitSuffix` on the network path IS
the defect, and not appending is the fix (D-2-01). `networkCloneUrl(source)` lands in
`domain/clone-key.ts` beside `canonicalCloneUrl` with the same three-kind switch, introducing no type
member and so no `contracts.json` pin (D-2-03). MURL-09 is re-aimed as a no-second-attempt assertion
rather than retired (D-2-04), ROADMAP SC3 becomes a call count of exactly one, and SC4 drops as
vacuous. The one accepted regression: a suffix-less URL against a host serving only `/repo.git`
stops working (D-2-02).

**Phase 1 verification is still open.** `01-VERIFICATION.md` stands at `status: human_needed` with
5/5 must-haves verified — everything provable offline is closed, including the real-credential-helper
link via the scoped canary at `130d68a9`. What remains is one end-to-end clone of a real private repo
on a non-registry host, which needs an operator PAT and a configured helper. The manager projection
reports Phase 1 as `stale` rather than `human_needed`; that is the `covered_files` self-stale class
(the report lists REQUIREMENTS/ROADMAP, which this commit just edited), not a new gap. This blocks
milestone close, not Phase 2.

Plan 01 landed wave 1: `buildAuthForHost` returns a `GitAuthBundle` for every https host, so
`credentialOps.fill(host)` is reached off the two-host registry; `NO_PROVIDER_CAUSE` and
`isAuthChallengeError` are retired and the `update.ts` cause attachment is re-aimed at
`classifyGitTransportFailure` gated on `!hasDeviceFlowProvider(host)`.

Plan 02 landed wave 2, the mitigation for the surface wave 1 widened: `buildAuthCallbacks.onAuth`
compares `new URL(url).host` against the bundle's bound `host` and returns `{ cancel: true }` on a
difference, before `credentialOps.fill` is called, so a foreign URL causes no helper query at all
(GAUTH-06, D-1-03). The `url` parameter is load-bearing and named accordingly. The refusal is
proven twice — at the factory (`credentialOps.calls` empty) and at the transport
(`UserCanceledError`, no `Authorization` header on any recorded request).

Plan 03 landed wave 3 and closed all 20 deliberately-red cases. Each one asserted that the
extension does NOT reach the credential helper on a host the provider registry does not claim;
each now asserts that it does, pinned to the bundle's bound host BY VALUE rather than by key
presence. The two edge suites reduce the recorded bundle to `{ host }` through `describeClone` and
the new `describeFetch`, so the host stays inside the byte-locked deep-equality comparison. Both
flow cases keep their empty-`credentialOps.calls` assertion: a bundle is attached, and nothing is
consulted until the server issues a challenge (PROV-02's surviving half).

**The gate is green at the phase boundary.** `npm run check` exits 0 (`CHECK_EXIT=0`) at
`d5762e0d`: 7261 tests, 7261 pass, 0 fail, `all files | 100.00 | 100.00 | 100.00` with an empty
uncovered-lines cell on every row under `extensions/`, and `fallow` at `FALLOW_EXIT=0`. Phase 2 was
planned from there with `--skip-ui`; Phase 1's verification canary remains deferred to the operator.

**Phase 2 Plan 01 (wave 1) is executed.** `networkCloneUrl(source)` lands in `domain/clone-key.ts`
beside `canonicalCloneUrl`: a 3-arm switch where only the `github` arm appends `.git` (via
`ensureGitSuffix`, keeping that helper's last production consumer alive against `fallow`'s
dead-code gate); the `url` arm derives from `source.raw` so a user-typed `.git` survives to the
wire; `git-subdir` uses `source.url` verbatim. `domain/source.ts` gained `stripSlashAndFragment`,
the `.git`-preserving half of the parse-time strip; `stripUrlDecorations` is now a thin wrapper
adding the `.git` strip on top, behavior-identical to before. `addGitClonedInGuard` derives its
clone url from `args.source` instead of a pre-computed `cloneUrl`, which is now dead and removed
from the args type and both call sites. MURL-09 is pinned as exactly-one-attempt with the sent URL
asserted by value on the success path and on three failure paths (404, 401, and the accepted D-2-02
refusal where a suffix-only host now genuinely fails, naming the URL that was sent). 200 tests
green across the four touched test files, 100% direct coverage on all three touched production
files, `npx tsc --noEmit` / `npm run lint` / `npm run format:check` / `npm run fallow` all exit 0.
Two `check-unused-type-members.contracts.json` pins were remapped from line 539 to 540 (the new
`domain/clone-key.ts` import shifts everything below it by one line) — anticipated by the plan's
own remap contingency, not a surprise. Plans 02-03 remain: plan 02 threads the same derivation
through the three `clone-cache.ts` seam sites and their nine callers; plan 03 owns the residual
suite audit and the phase-boundary `npm run check`.

**Phase 2 Plan 02 (wave 2) is executed.** `materializePluginClone` and
`materializeOrRefreshPluginMirror` in `orchestrators/plugin/clone-cache.ts` gained a REQUIRED
`networkUrl: string` field (no `?`, no default) and stopped deriving a wire url internally;
`resolvePluginPin` now derives its wire url via `networkCloneUrl(source)` instead of
`ensureGitSuffix`, unchanged signature and return type. All nine caller sites across
`install-clone-probe.ts`, `reinstall-clone-probe.ts`, `fetch.ts`, `info.ts`, and
`update-preflight.ts` thread `networkUrl` from the source they already hold. Four
`check-unused-type-members.contracts.json` pins shifted under the new import lines in `info.ts`
(1351→1352) and `update-preflight.ts` (137→138, 138→139, 346→349 — the last by 3 lines, not 1,
because two production edits inside the same file land above it); entry count unchanged at 108.
The direct seam suite (`clone-cache.test.ts`, read in full at 1575 lines) was rewritten from "the
seam appends a suffix" to "the seam forwards what it was handed and keys the disk off the other
value": all 29 literal-construction sites gained the field, six wire-url expectations were
rewritten to the verbatim D-2-03 form, three test titles that still promised the retired
suffix-everywhere rule were retitled from MURL-01 to MURL-08, and a first-ever MURL-09
exactly-one-attempt-plus-identity guard was added for all three seams (success case: count 1 and
the sent url by value; failure case: an injected 404/401/404 whose `message`/`code`/
`data.statusCode` survive unchanged with no retry). `fetch.test.ts`'s owner suite dropped the
suffix from seven of eight wire constants and both template-built allowlists (an A1-class gap a
plain `.git"` grep never caught); `info.test.ts` needed zero edits, since its allowlist already
admits both forms and its assertions never check a recorded URL value. All six touched production
modules hold 100% direct coverage with no new pin row; 270 tests pass across the six touched
seam/owner suites. Empirically confirmed RED at plan end (by design, not regression):
`install-flow.test.ts` (12/157 fail), `update-flow.test.ts` (16/171 fail), and
`tests/integration/marketplace-add-seed-mirrors.test.ts` (5/6 fail) — a narrower set than
ROADMAP/STATE's phase-level prediction, which additionally named bootstrap/reconcile/register/
marketplace-update; those four suites were spot-checked and confirmed GREEN this session. Plan 03
owns closing the confirmed-red set and running the phase-boundary `npm run check` to establish the
authoritative full list.

**Phase 2 Plan 03 (wave 3) is executed, and the phase is complete.** The three plugin flow suites
(`install-flow`, `update-flow`, `reinstall-flow` — the third was empirically red too, 5/139, though
not separately reported by plan 02) had their remote allowlists narrowed to admit exactly the
D-2-01 wire form per fixture's PARSED `source.kind`: every failure traced to
`createGitOpsFake.requireRemote()` blocking a now-verbatim URL, not a stale recorded value, so
narrowing the allowlist (plus fixing two template-built wire expectations at
`install-flow.test.ts:7207,7277`) brought all three suites fully green. RESEARCH.md's assumption
A1 is discharged by classification, not left open: `tests/integration/marketplace-add-seed-mirrors.test.ts`'s
allowlist admitted BOTH `REPO_URL` and its suffixed twin — narrowed to `[REPO_URL]` alone, with
its five by-value clone-url expectations changed to match, the phase's sole integration-tier proof
of the verbatim wire form. Every other candidate RESEARCH.md and the plan's own read set named
(the bootstrap/register family and `reconcile/apply.test.ts`'s two non-empty allowlists, all
resolving through an `owner/repo` shorthand that always parses to `github` kind; the
empty-allowlist fakes in `reconcile/apply.test.ts`'s remaining cases, `backfill.test.ts`, and
`import/execute.test.ts`; `marketplace/update.test.ts`'s `onAuth` callback argument;
`list-flow.test.ts`'s manifest-string fixtures; `tools.test.ts`'s preserve-the-user's-own-suffix
fixture; `platform/git.test.ts` and `git-auth-callbacks.test.ts`'s raw port/callback constants) was
confirmed unaffected by running, not by reasoning. `domain/source.ts::ensureGitSuffix`'s docstring
— which argued the suffix is host-agnostic on purpose and cited a gitlab.com `422`-redirect
observation, the exact inverse of D-2-02 — is rewritten to name `networkCloneUrl` as the only
caller and state D-2-02's accepted trade-off in its shipped direction; `platform/git.ts`'s
`CloneOptions.url` docstring is rewritten to name the derivation in prose only (no import added;
`platform/` may not import `domain/`). `npm run check` exits 0 at the phase's final HEAD
(`d06b6325`): 7286/7286 unit tests pass with `all files | 100.00 | 100.00 | 100.00` over
`extensions/**`, 36/36 integration tests pass, `lint:type-members` holds the same 4 pre-existing
exceptions with 108 contract entries, and both coverage-pin files are unchanged.

## Deferred Verification

| Phase | State | Resume |
|-------|-------|--------|
| 1 | verification_deferred_human | /gsd-verify-work 1 |
| 2 | verification_deferred_human | /gsd-verify-work 2 |

The phase number above is `1`, matching the `number` field `init.manager` emits — that is the
projection `discover_phases` filters against. The phase directory is `01-private-repos-on-any-git-host`;
the zero-padded form is a directory-naming convention, not the queue key.

Phase 1's only outstanding verification item is the live canary: one end-to-end clone of a real
private repo on a non-registry host, which needs operator credentials this machine does not have.
The scoped-canary commit (`130d68a9`) already closed the helper-subprocess link with a negative
control. Deferred so autonomous runs can proceed through phases 2 and 3; milestone close stays
blocked until this is resolved. This item survives Phase 3's completion unchanged; it blocks
milestone close only, not Phase 3 or any phase after it.

Phase 2's single outstanding item is the same class: one `marketplace add` against a REAL
smart-HTTP server that answers only at the verbatim path and 404s the `.git` form, plus a later
`resolveRemoteRef` against it. Every phase test proves the URL that is SENT through the offline
`createGitOpsFake`; none exercises a real HTTP round trip. Recorded in `02-UAT.md`. Deferred by
operator decision on 2026-09-27 so the run could proceed to Phase 3. Both canaries block
milestone close only, not Phase 3. This item likewise survives Phase 3's completion unchanged;
both are also carried forward in `.planning/workstreams/git-hosts/ROADMAP.md` § Milestone-wide
constraints and filed in `.planning/BACKLOG.md` (GHCAN-01, GHCAN-02) for visibility after this
workstream's documents are archived.

## Progress

**Phases Complete:** 0 / 3
**Current Plan:** 3

```
Phase 1  [==========]  plans complete (3/3)
Phase 2  [==========]  verified 9/9, live canary deferred
Phase 3  [==========]  4/4 executed; gap closure awaiting re-verification
```

| Phase | Name | Requirements | Status |
|-------|------|--------------|--------|
| 1 | Private repos on any git host | GAUTH-03, GAUTH-04, GAUTH-05, GAUTH-06 | Plans complete (3/3), awaiting verification |
| 2 | Endpoints that answer only at the verbatim URL | MURL-08, MURL-09 | Verified 9/9, live canary deferred |
| 3 | `marketplace add` recovers from its own leftover clone | MA-12, MA-13, MA-14, GATE-01 | 4/4 executed; gap closure awaiting code review and re-verification |

## Accumulated Context

### Decisions

- **D-2-05 (operator, 2026-09-27): the `url` cache identity is a FIXED POINT.** A trailing slash
  immediately before a `#<ref>` is normalized away, so `https://host/o/r/#main` and
  `https://host/o/r.git/#main` both have the identity `https://host/o/r` on first parse and on every
  reload. This deliberately overrides the byte-identity-with-pre-phase gate that two earlier review
  passes held, because pre-phase disagreed with itself on that shape and orphaned the clone
  directory. Cost: one re-clone for that input class. The wire form is unaffected — `.../o/r.git/#main`
  still SENDS `.../o/r.git` (D-2-01/D-2-03 separation intact).
- **The `url` identity, the `url` wire form and the `github` identity are three separate
  compositions** in `domain/source.ts` (`stripUrlDecorations`, `stripSlashAndFragment`,
  `stripGitHubUrlDecorations`) sharing only leaf primitives, with no call edge between them. They are
  deliberately NOT collapsed even where two currently agree on ordering: a shared helper is what let
  a wire-side fix move the cache identity once already.

- **Phase numbering restarts at 1.** `git-hosts` is a fresh workstream with zero prior phases. The
  repo's shared counter runs to Phase 117 on other workstreams; it does not apply here.
- **Milestone label is a name, not a version.** `any-git-host` follows the `url-source` /
  `force-install` / `workflows` precedent: concurrent workstreams cannot share a global version
  sequence.
- **Three phases, one per defect.** The three defects are independent in behavior but share two
  files (`platform/git.ts`, the `GitOps` seam in `orchestrators/marketplace/shared.ts`), so the
  phases run in sequence rather than in parallel.
- **GAUTH-06 stays in Phase 1 with GAUTH-03.** GAUTH-03 retires the `undefined`-for-no-provider
  refusal that currently stands in as the cross-host leak guard (PROV-04 / T-79-04). Its real
  replacement — a host check inside `onAuth`, which today ignores its `url` argument — must land in
  the same phase, or the milestone opens a window in which a credential bound to one host can
  follow a redirect to another.
- **GATE-01 is mapped to Phase 3** because that is where it is finally measured, but the gate
  surface is a milestone-wide constraint recorded in ROADMAP.md § Milestone-wide constraints and
  must be green at every phase boundary.
- **No new hostname literal in `domain/auth-registry.ts`.** Per-host descriptors for self-hosted
  instances are explicitly out of scope; GAUTH-03 is what makes them unnecessary.
- **Cause-line wording (plan 01):** `no credential stored for ${host}; add one with git credential
  approve`. The host is interpolated once, the command is named literally, and no credential field
  appears (AUTH-09).
- **`NO_PROVIDER_CAUSE` had no residual case** and was retired outright (D-1-04). Authentication is
  now attempted on every host through the credential helper, so "no auth provider is registered for
  {host}" is false everywhere.
- **The `update.ts` guard reuses `classifyGitTransportFailure`** rather than a second hand-rolled
  duck-type: it already folds `HttpError` 401/403 and `UserCanceledError` into one reason, and the
  real failure on an empty helper is `UserCanceledError`, which the old guard could never match.
- **`onAuth` compares `new URL(url).host` against the bundle's bound `host`** and cancels before
  `credentialOps.fill` is called, so a URL on another host causes no helper query at all. The
  `url` parameter is load-bearing and named `url`; `onAuthFailure` keeps its unused `_url`
  because the credential it evicts has already been sent (GAUTH-06, D-1-03).
- **Phase 2 Plan 01: `networkCloneUrl`'s `url` arm reads `source.raw`, never `source.url`.** The
  parse-time-stripped identity form would silently discard a user-typed trailing `.git`; `raw` is
  the string the `https://`-only admission gate already accepted, so no new scheme can enter there.
- **Phase 2 Plan 01: `ALLOWED_MARKETPLACE_REMOTES` is narrowed per `source.kind`, not per hostname
  string.** `https://GitHub.com/acme/mp` (case-sensitive github prefix check) and
  `https://gitlab.com/team/mp` (no gitlab.com literal in this parser) are both `url` kind and both
  drop the `.git` suffix despite the host names looking github/gitlab-adjacent.
- **Edge bundle expectations use the reduced-token shape.** `describeClone` and the new
  `describeFetch` replace a recorded `auth` bundle with `{ host }`, so the bound host stays inside
  the byte-locked deep-equality comparison and a bundle bound to the wrong host fails the suite. A
  bundle carries three closures, so a literal expectation cannot spell it; the host is the field a
  wrong binding would get wrong (T-01-11).
- **`fetch.test.ts::requiredAuth` stays.** It narrows `args.auth` read off the clone-cache seam,
  whose parameter type is still `auth?: GitAuthBundle` because
  `plugin/update-preflight.ts::buildBundle` returns `undefined` when it has no `ctx`. The narrow is
  real, not dead — the same fact keeps `clone-cache.test.ts:538` legitimately asserting an absent
  bundle.
- **Phase 2 Plan 02: `networkUrl` is required on both materialize arg types, never optional or
  defaulted to `cloneUrl`.** A default would compile clean at every un-updated call site and send
  the identity url to a host that needs the suffix; the compiler naming all 39 construction sites
  (9 production, 30 test) is the only completeness guard that scales.
- **Phase 2 Plan 02: the two pass-through-proof cases pass a DIFFERING `cloneUrl`/`wireUrl` pair
  via named locals, not repeated literals.** This is what makes the file-wide
  `gitlab.example.com/o/r.git` count land on exactly 3 (2 locals + 1 allowlist entry) rather than
  5, and is the assertion shape that proves the seam forwards the caller's wire url instead of
  re-deriving it.
- **Phase 2 Plan 02: `info.test.ts` was left untouched, deliberately.** Its `ALLOWED_INFO_REMOTES`
  already admits both suffixed and unsuffixed forms per host, and every one of its assertions is a
  call-count check rather than a recorded-url-value check, so D-2-03's wire-form change is
  invisible to that file's existing suite.
- **Phase 2 Plan 03: every flow-suite failure was a blocked-remote artifact, not a stale value
  expectation.** `createGitOpsFake.requireRemote()` runs before an injected `cloneError` is thrown,
  so an allowlist still admitting only the suffixed form silently produced downstream sha/version
  mismatches (a fallback-to-recorded-state shape) rather than a visible `blocked unplanned remote`
  line in most failing cases. Narrowing the allowlist alone brought `install-flow`, `update-flow`,
  and `reinstall-flow` to green with zero additional by-value assertion edits beyond the two
  template-built expectations the plan already named.
- **Phase 2 Plan 03: classification follows the PARSED source kind, never the declared kind or the
  hostname text.** A `github.com` URL declared `source: "url"` in a manifest still parses to
  `github` kind (`domain/source.ts::urlObjectSource` funnels any `https://github.com/...` URL
  through the github parser, D-76-02) — this is why two `install-flow.test.ts` allowlist entries
  declared as `url`-kind manifest entries keep their `.git` suffix.
- **Phase 2 Plan 03: the bootstrap/register family and `reconcile/apply.test.ts`'s two non-empty
  allowlists all resolve through an `owner/repo` shorthand string**
  (`anthropics/claude-plugins-official`, `acme/remote`, `acme/proj`, `acme/user`), which always
  parses to `github` kind regardless of context — confirmed green with no edit, not assumed.
- **Phase 3 Plan 01: `recognizeLeftover()` extracted from `addGitClonedInGuard` to hold fallow's
  cognitive-complexity gate (Rule 1 deviation, not in the plan text).** The inline switch pushed
  complexity to 18 against the 15 threshold; the helper keeps the exhaustive four-arm switch (no
  `default`) so `switch-exhaustiveness-check` still catches a future fifth `ListRemotesResult` arm.
- **Phase 3 Plan 01: the leftover-removal leak and the staging-cleanup leak join into ONE string
  via a new `joinLeaks()` helper** before the single pre-existing `appendLeakToError` call, so
  `unwrapAddError`'s one-level `Error.cause` unwrap contract stays intact (MA-14). No second
  `appendLeakToError` call was added; the count stayed at 4.
- **Phase 3 Plan 01: `tests/orchestrators/marketplace/update.test.ts::makeForbiddenGitOps`
  is a sixth hand-enumerated `GitOps` literal 03-CONTEXT.md/03-VALIDATION.md did not predict** —
  found via `npx tsc --noEmit`, fixed with the same rejecting-stub pattern as its five siblings.
- [Phase 03]: Phase 3 Plan 02: marketplace add's standalone notify() row carries no cause/leak text by design (MpFailed has reasons/severity/plugins only), so both MA-14 cases call addMarketplace twice -- once standalone for the rendered {stale clone} row + subject, once orchestrated for outcome.cause's leak text.
- [Phase 03]: Phase 3 Plan 02: the double-fault MA-14 case must restore sources-staging/ to 0o755 between its two addMarketplace calls -- the first call's onClone leaves it read-only permanently, so an un-restored second call's own fixture-copy mkdir fails before recognition ever runs, misclassifying the whole case as {unparseable}.
- [Phase 03]: Phase 3 Plan 03 (SC5): buildAuthForHost/buildCloneAuth's ctx becomes optional rather than threading a ctx through the cascade -- the guard widens to `provider === undefined || ctx === undefined`, reusing the existing no-provider decline arm verbatim, so the provider-found arm (and both registry hosts) stay byte-identical whenever a real ctx is present.
- [Phase 03]: Phase 3 Plan 03: update-preflight.ts's local buildBundle closure is deleted outright, not kept as a thinner wrapper -- once buildCloneAuth always returns a bundle, the local copy differs from the shared helper only in an early-undefined-return that is now unreachable.
- [Phase 03]: Phase 3 Plan 03 (SC7): PROJECT.md's D-79-03 rationale clause is rewritten to cite the plugin failure grammar's missing cause-chain trailer slot (install.messaging.ts), replacing the now-false "no onAuth callback registered" claim; the row's OUTCOME and the table's Outcome column are untouched.
- [Phase 03]: Phase 3 Plan 03 (SC6): both live canaries are recorded in three places for three different post-close readers -- STATE.md's existing Deferred Verification paragraphs, a new ROADMAP.md subsection, and two new BACKLOG.md entries (GHCAN-01, GHCAN-02) -- rather than in only one.

### Source-review facts carried into planning

- `orchestrators/auth-host.ts::buildAuthForHost` returns `GitAuthBundle | undefined` and consults
  `domain/auth-registry.ts::findProviderForHost`, which holds only `GITHUB_PROVIDER` (github.com)
  and `GITLAB_PROVIDER` (gitlab.com), both RFC-8628 Device Flow descriptors.
- `undefined` means `platform/git.ts::clone|fetch|resolveRemoteRef` never call
  `platform/git-auth-callbacks.ts::buildAuthCallbacks`, so `credentialOps.fill(host)` — the
  `git credential fill` shell-out — is never consulted. That is the GAUTH-03 defect.
- `buildAuthCallbacks.onAuth(_url)` already consults `fill(opts.host)` first and only falls through
  to `onAuthRequired()` on a miss. The fix is to always return a bundle and let the registry gate
  only the Device Flow closure — not to add a host descriptor.
- `clone` and `resolveRemoteRef` receive URLs callers already passed through
  `domain/source.ts::ensureGitSuffix`; some smart-HTTP servers answer only at the verbatim path and
  404 the `.git` form (MURL-08).
- `orchestrators/marketplace/add.ts::addGitClonedInGuard` throws `StaleSourceCloneError` whenever
  `sources/<name>/` exists (MA-6), with no way to tell a leftover clone of the same source from a
  foreign tree. Recognizing "same source" needs a new `GitOps.listRemotes` seam in
  `orchestrators/marketplace/shared.ts` and `platform/git.ts`.

### Open TODOs

- Plan Phases 2 and 3 with `--skip-ui`: the `ui_safety_gate` keyword scan false-positives on this
  project's domain vocabulary (`form`, `component`, `view`). No phase in this milestone is a UI
  phase.
- ~~Phase 3 must amend `PROJECT.md`'s D-79-03 row.~~ CLOSED by 03-03: the rationale clause now
  cites the plugin failure grammar's missing cause-chain trailer slot
  (`orchestrators/plugin/install.messaging.ts`); the OUTCOME is untouched.
- A live end-to-end clone of a private repo on a non-registry host, against the operator's own
  credential helper, is untested by design (cases run offline with no credentials) and needs human
  UAT. Recorded as deliverable D4 in `01-01-SUMMARY.md`, and as D5 in `01-02-SUMMARY.md` for the
  host-mismatch refusal against a real remote.

### Blockers

None.

## Session Continuity

**Last session:** 2026-09-28T03:21:28.000Z

**Stopped At:** Phase 3 complete (re-verified 7/7 after gap closure 03-04).

**Resume File:** None — all four Phase 3 plans have SUMMARYs.

**Next Action:** run the two carried live canaries (`/gsd-verify-work 1 --ws git-hosts`,
`/gsd-verify-work 2 --ws git-hosts`), then milestone close. Optionally fix WR-11 (read
`remote.origin.url` with `getConfigAll`, refuse unless exactly one url) before closing.

### What this run completed

- **Phase 2: verified 9/9, live canary deferred.** Three plans executed, then a 3-iteration code
  review loop. Iteration 1 fixed 8 findings and introduced a regression — it moved the parse-time
  cache identity. Iteration 2 caught it. Iteration 3 restructured the `domain/source.ts` seam into
  separately-named compositions with no call edge between them, so a wire-side fix can no longer
  reach the identity. Two operator decisions followed: D-2-05 (the `url` identity is a fixed point,
  chosen over byte-parity because pre-phase contradicted itself and orphaned the clone directory),
  and deferral of the live smart-HTTP canary.
- **Phase 3: discussed, planned, all 3 waves executed.** D-3-01..D-3-04 locked; 3 plans, 3 waves;
  plan-checker passed with zero issues. Wave 2 closed the 100%-branch gate wave 1 declared red.
  Wave 3 fixed the autoupdate cascade (`ctx` optional on `buildAuthForHost`/`buildCloneAuth`),
  carried both live canaries forward, corrected the D-79-03 rationale, and closed the
  phase-boundary `npm run check` green.

### Steps SKIPPED — read before assuming this phase is closable

- **Phase 3 has had no code review and no verification.** Phase 2's review found 2 Criticals on its
  first pass and 2 more after the fix; do not skip this.
- **The two live canaries (GHCAN-01, GHCAN-02) are NOT closable on this machine.** Both are recorded
  in this file (§ Deferred Verification, above), in `ROADMAP.md` § Milestone-wide constraints, and
  in `BACKLOG.md`. They block milestone close only, not Phase 3's own completion.

### Environment debts

- **The isolation sentinel is consumed per dispatch.** `dispatch-isolation --force-isolation none`
  must be re-run immediately before EVERY executor dispatch. Wave 1 succeeded; wave 2's dispatch was
  then refused by the agent-isolation guard because the sentinel had reset. Never verify it with a
  bare call. (Wave 3 of this phase ran sequentially on the main checkout per its own plan note, so
  this did not apply to it.)
- Both live canaries (Phase 1's private-repo clone, Phase 2's verbatim-only smart-HTTP endpoint) stay
  deferred and block MILESTONE CLOSE only, not any phase. Neither is closable on this machine.
- Phase 2's six Info code-review findings (IN-01..IN-06) remain open by scope decision — see
  `02-REVIEW-DISPOSITION.md`, which is the reconciled record; `02-REVIEW.md`'s own
  `status: issues_found` is stale for the Critical/Warning set.
- A `pre-commit npm-lint` hook reported a spurious "files were modified by this hook" failure once
  during this plan's Task 1 re-verification, caused by Task 2's concurrent edits to PROJECT.md/
  ROADMAP.md/STATE.md/BACKLOG.md racing the same pre-commit run. A standalone `eslint` run and a
  third `pre-commit` run on a quiet tree both confirmed clean; no code was affected. See
  `03-03-SUMMARY.md` § Issues Encountered.

## Performance Metrics

| Plan | Duration | Tasks | Files |
|------|----------|-------|-------|
| Phase 01 P02 | 22min | 2 tasks | 3 files |
| Phase 01 P03 | 41min | 2 tasks | 11 files |
| Phase 02 P01 | 95min | 3 tasks | 8 files |
| Phase 02 P02 | 165min | 3 tasks | 10 files |
| Phase 02 P03 | 51min | 3 tasks | 6 files |
| Phase 03 P01 | 55min | 2 tasks | 15 files |
| Phase 03 P02 | ~45min | 2 tasks | 1 files |
| Phase 03 P03 | ~210min | 3 tasks | 9 files |
