---
phase: 03-marketplace-add-recovers-from-its-own-leftover-clone
verified: 2026-09-27T00:00:00Z
status: gaps_found
score: 6/7 must-haves verified
covered_files:
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-01-PLAN.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-01-SUMMARY.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-02-PLAN.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-02-SUMMARY.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-03-PLAN.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-03-SUMMARY.md"
  - "extensions/pi-claude-marketplace/domain/source.ts"
  - "extensions/pi-claude-marketplace/orchestrators/auth-host.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts"
  - "extensions/pi-claude-marketplace/platform/git.ts"
  - "scripts/check-unused-type-members.contracts.json"
  - "tests/domain/source.test.ts"
  - "tests/e2e/import-command.test.ts"
  - "tests/edge/types.test.ts"
  - "tests/orchestrators/auth-host.test.ts"
  - "tests/orchestrators/marketplace/add.test.ts"
  - "tests/orchestrators/marketplace/shared.test.ts"
  - "tests/orchestrators/marketplace/update.test.ts"
  - "tests/orchestrators/plugin/update-preflight.test.ts"
  - "tests/platform/git-ops-contract.ts"
  - "tests/platform/git-ops-fake.test.ts"
  - "tests/platform/git-ops-fake.ts"
  - "tests/platform/git.test.ts"
covered_digest: "v2:sha256:79a0811eefe59b1f04094bfc53fd5ec7732d240be41c22b15996acd8ffba1f9c"
behavior_unverified: 0
overrides_applied: 0
gaps:
  - truth: "SC2 / MA-13: a leftover tree that is not a git clone, is unreadable, or whose origin names a different URL still refuses with the MA-6 {stale clone} row; recognition never widens into overwriting a directory the extension did not create."
    status: failed
    reason: >
      CR-01 (open, critical, from 03-REVIEW.md) is confirmed against the real code and the real
      isomorphic-git in node_modules, independently of the reviewer's report. `platform/git.ts::listRemotes`
      declares its `origin` arm as `{ kind: "origin"; url: string }`, but isomorphic-git's `_listRemotes`
      (node_modules/isomorphic-git/index.cjs:13043-13053) enumerates `[remote "<name>"]` subsections and
      resolves `remote.<name>.url` separately — a `[remote "origin"]` section with no `url` key yields
      `{ remote: "origin" }` with `url` absent, so the wrapper returns `{ kind: "origin", url: undefined }`,
      violating its own declared type. I reproduced this directly: built a real `.git/config` on disk
      holding `[remote "origin"]` with only a `fetch` line, called the real (non-faked) `listRemotes`, and
      got `{"kind":"origin"} url typeof: undefined`; feeding that into `add.ts`'s
      `stripGitSuffix(remotes.url)` (the exact call `recognizeLeftover` makes at add.ts:725) throws
      `TypeError: Cannot read properties of undefined (reading 'endsWith')`.

      Traced the consequence through the real `classifyAddError`/`handleAddFailure` code (not inferred):
      a raw `TypeError` matches none of `classifyAddError`'s `instanceof` checks and carries no `.code`,
      so it classifies as `undefined`. In standalone mode `handleAddFailure` executes
      `if (!orchestrated) { throw err; }` — the raw `TypeError` escapes past the orchestrator, which is
      exactly what the project's own ATTR-07 "no raw error escapes" discipline (named throughout this
      phase's plans) forbids. In orchestrated mode the same error is silently returned as
      `{ status: "failed", reason: "unparseable", ... }` instead of `{ status: "failed", reason: "stale clone" }`.

      This is reachable from the phase's own motivating scenario, not a contrived shape: isomorphic-git's
      clone writes `remote.origin.url` via `GitConfigManager.save`, which rewrites the whole config file;
      a crash or short write during that exact rewrite — the WR-07 crash window this phase exists to let
      users retry through — produces precisely this truncated shape. WR-10 (open, warning) independently
      confirms no test in `tests/platform/git.test.ts` or `tests/orchestrators/marketplace/add.test.ts`
      exercises a `[remote "origin"]` section with no `url` key; I confirmed this absence directly by
      grep against both files. The 100%-branch coverage gate cannot catch this because the missing
      behavior is a missing branch (an unhandled type-contract violation), not an uncovered one.

      Weighed against SC2: a leftover with this exact shape is neither "not a git clone" (it has a
      `.git`, readable), nor "unreadable" (the config read succeeds), nor cleanly "an origin naming a
      different URL" (there is no url to compare) — it is a fourth, unhandled shape that SC2's
      guarantee implicitly must cover ("recognition never widens... still refuses with the MA-6
      {stale clone} row"), and today it does neither: it crashes raw (standalone) or misclassifies as
      unparseable (orchestrated). This is a genuine gap in this phase's own goal, not a pre-existing or
      out-of-scope defect: `listRemotes` and the `recognizeLeftover` branch are both artifacts this
      phase created in Wave 1, and the missing-url shape is a direct near-miss of the exact edge-probe
      row (MA-13 / encoding: "an origin that is not an https:// URL at all... fails the byte comparison
      and refuses; it is never re-parsed as a source and never crashes the add") this phase's own
      must-haves promised and did not fully deliver — the promise held for a garbage *string* but not
      for an absent one.
    artifacts:
      - path: "extensions/pi-claude-marketplace/platform/git.ts"
        issue: "listRemotes:366-368 returns { kind: \"origin\", url: origin.url } without checking that origin.url is actually a string; isomorphic-git can and does return { remote: \"origin\" } with url absent for a truncated/racing .git/config write."
      - path: "extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts"
        issue: "recognizeLeftover (~line 725) calls stripGitSuffix(remotes.url) on the origin arm with no defensive check, so an undefined url throws a raw TypeError that escapes classifyAddError's instanceof/code ladder entirely."
      - path: "tests/platform/git.test.ts"
        issue: "the listRemotes describe block (4 cases) has no case for a [remote \"origin\"] section with no url key (WR-10, open) — confirmed absent by grep."
      - path: "tests/orchestrators/marketplace/add.test.ts"
        issue: "the MA-13 refusal table drives listRemotes entirely through createGitOpsFake's canned listRemotesResult, which is typed ListRemotesResult and therefore cannot express url: undefined at all — the fake's type safety hides the real adapter's type violation."
    missing:
      - "platform/git.ts::listRemotes must treat a present origin subsection with an absent/non-string url as a non-recognizable tree (e.g. return { kind: \"no-origin\" }) rather than returning a value that violates its own declared ListRemotesResult type."
      - "A real-filesystem test in tests/platform/git.test.ts asserting this exact .git/config shape (a hand-written [remote \"origin\"] section with a fetch line and no url line) resolves to a safe arm, not a crash."
      - "An add.test.ts case proving that this leftover shape still refuses as {stale clone} through addMarketplace end to end, in both standalone and orchestrated mode, rather than escaping as a raw TypeError or misclassifying as {unparseable}."
human_verification: []
---

# Phase 3: `marketplace add` recovers from its own leftover clone Verification Report

**Phase Goal:** A Pi user retrying `marketplace add` after a crash or a state rebuild succeeds when
the directory left behind is a clone of the very source being added, still gets the MA-6 refusal
when it is anything else, and is never left with a half-removed tree recorded in state — with the
milestone's whole gate surface green at its final HEAD.

**Verified:** 2026-09-27
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Phase 3 Success Criteria, verbatim)

| # | Truth (SC) | Status | Evidence |
|---|------------|--------|----------|
| 1 | SC1 — `marketplace add` succeeds when `sources/<name>/` holds a leftover clone whose `origin` is the source being added; no manual delete needed for the WR-07 crash window or a state rebuild | ✓ VERIFIED | `tests/orchestrators/marketplace/add.test.ts` MA-12 case (plan 01) runs through the real parser/orchestrator/GitOps seam: leftover marker file gone, fresh manifest present at `finalDir`, state records the entry. `node --test tests/platform/git.test.ts` re-run: 36/36 pass. |
| 2 | SC2 — a leftover that is not a git clone, is unreadable, or whose `origin` names a different URL still refuses with the MA-6 `{stale clone}` row; recognition never widens into overwriting a directory the extension did not create | ✗ FAILED | CR-01 (independently reproduced below) — a leftover whose `.git/config` holds a `[remote "origin"]` section with no `url` key is neither cleanly refused nor left alone: it crashes with a raw `TypeError` (standalone mode) or misclassifies as `{unparseable}` (orchestrated mode) instead of refusing as `{stale clone}`. See Gaps below. |
| 3 | SC3 — a recognized leftover that cannot be fully removed fails as stale with the cleanup leak appended (MA-9 discipline), and state records no destination for the partially-removed tree | ✓ VERIFIED | `tests/orchestrators/marketplace/add.test.ts` MA-14 single-fault and double-fault cases (plan 02): `loadState(...)` asserted to hold no entry; double fault classifies through exactly one `Error.cause` level with both leak texts and one `" (additionally: "` marker. `node scripts/test-coverage-direct.mjs .../add.ts` — branches 143/143 per 03-02-SUMMARY.md. |
| 4 | SC4 — every type member this milestone introduced is read by production code or recorded in the contracts file, and `npm run check` passes whole at the milestone's final HEAD | ✓ VERIFIED | `node -e '...contracts.json...length'` → `108` (spot-checked directly). `git diff --name-only 50746b81..HEAD -- ':!.planning/'` is empty, so the plan-03 executor's `CHECK_EXIT=0` run (7354/7354 unit, 36/36 integration, `all files 100.00/100.00/100.00`, 108 contracts/4 exceptions, 7/7 negative controls) still describes this source tree; not re-run per the gate-evidence note, spot-checked via grep/git-log instead. |
| 5 | SC5 — the marketplace autoupdate cascade is settled (fixed): a private plugin source refreshes from the user's credential helper instead of cloning authless, on any host | ✓ VERIFIED | `grep -n "ctx?:" auth-host.ts` shows both `buildAuthForHost` and `buildCloneAuth` widened; `grep -n "provider === undefined \|\| ctx === undefined"` confirms the widened guard. `update-preflight.ts` has zero `buildBundle` occurrences and 3 unconditional `auth: authBundle` properties. `update-flow.ts` pins (`834:42`, `915:42`) confirmed unchanged in `contracts.json`, and `git log` shows no commit touching that file in this phase. |
| 6 | SC6 — Phase 1's and Phase 2's live canaries are carried forward with reasons/resume commands, never marked passed on link-by-link evidence | ✓ VERIFIED | `grep -n "gsd-verify-work 1\|gsd-verify-work 2" ROADMAP.md` finds both; `grep -n "GHCAN-01\|GHCAN-02" BACKLOG.md` finds both entries; STATE.md § Deferred Verification retains both rows. Neither `01-VERIFICATION.md` nor `02-UAT.md` was touched by this phase (confirmed via `git log` — no commits to those paths since Phase 3 began). |
| 7 | SC7 — `PROJECT.md`'s D-79-03 row rationale is amended to match the code; its OUTCOME (a recorded 2026-07-11 user checkpoint) is untouched | ✓ VERIFIED | `grep -n "D-79-03" PROJECT.md` → exactly 2 occurrences (the row + the untouched dated narrative). The row's rationale now reads "...the plugin failure grammar has no cause-chain trailer slot that renders on the subject row, per `install.messaging.ts`..." (matches the code), and the OUTCOME clause ("Marketplace add and plugin install/reinstall show the bare `(failed) {authentication required}` row; only `update`'s cause-carrying child row appends...") is the same text ROADMAP.md's SC7 quotes verbatim, i.e., unrevisited. |

**Score:** 6/7 truths verified (0 present-but-behavior-unverified)

### CR-01 — independently reproduced

Built a real, non-faked `.git/config` on disk:

```
[core]
	repositoryformatversion = 0
[remote "origin"]
	fetch = +refs/heads/*:refs/remotes/origin/*
```

Called the actual `platform/git.ts::listRemotes` (not the test fake) against it:

```
listRemotes -> {"kind":"origin"} url typeof: undefined
THROWS: TypeError Cannot read properties of undefined (reading 'endsWith')
```

Confirmed the isomorphic-git internals the reviewer cited at
`node_modules/isomorphic-git/index.cjs:13043-13053` — `_listRemotes` enumerates `config.getSubsections('remote')`
and resolves each remote's `url` as a separate, independently-absent lookup, exactly as CR-01 describes.
Confirmed the escape path by reading `classifyAddError` (add.ts:265-300) and `handleAddFailure`
(add.ts:496-533) directly: a bare `TypeError` matches no `instanceof` arm and has no `.code`, so
`classifyAddError` returns `undefined`, and `handleAddFailure`'s `if (!orchestrated) { throw err; }`
re-throws it raw in standalone mode; in orchestrated mode it becomes `{ reason: "unparseable" }`.

**Verdict: CR-01 is a GAP in this phase's own goal, not a separate defect to file.** It is reachable
through the exact WR-07 crash-window scenario this phase exists to make recoverable (isomorphic-git's
own `GitConfigManager.save` rewrites the whole config file on clone, and an interruption mid-rewrite
produces this shape), it sits entirely inside artifacts this phase created (`listRemotes`,
`recognizeLeftover`), and it breaks SC2's explicit guarantee that recognition "still refuses with the
MA-6 `{stale clone}` row" for anything it cannot positively confirm as the same source. The WR-10
finding (no test for this shape) is the direct cause: the 100%-branch gate cannot catch a missing
branch, only an uncovered one, so `npm run check` being green does not — and cannot — attest to this
truth.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/platform/git.ts::listRemotes` | 4-arm discriminated, own fs probe before isomorphic-git, never throws | ⚠️ VERIFIED WITH DEFECT | Never throws (confirmed) and the fs-probe-first design is correctly implemented and tested for 3 of 4 arms plus the origin-with-url arm — but its `origin` arm's declared type (`url: string`) is falsifiable at runtime (CR-01), and the consuming code assumes the type holds. |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts::GitOps` | 8th member `listRemotes`, wired through `DEFAULT_GIT_OPS` | ✓ VERIFIED | `grep -c 'defaultGit\.'` inside `DEFAULT_GIT_OPS` block = 8 (re-confirmed via 03-01-SUMMARY's own acceptance-criteria grep, spot-checked structurally). |
| `extensions/pi-claude-marketplace/domain/source.ts::stripGitSuffix` | exported leaf, byte comparison, no case folding | ✓ VERIFIED | `grep -c 'export function stripGitSuffix'` = 1; direct tests in `tests/domain/source.test.ts` per 03-01-SUMMARY. |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts::recognizeLeftover` / `addGitClonedInGuard` | recognize-remove-rename branch, single-level leak fold | ⚠️ VERIFIED WITH DEFECT | `appendLeakToError(` count 4 (unchanged), `cleanupStaging(` count 5, exhaustive switch with no `default` — all confirmed. The `origin` arm's `stripGitSuffix(remotes.url)` call has no defensive check against CR-01's falsified type. |
| `extensions/pi-claude-marketplace/orchestrators/auth-host.ts::buildAuthForHost`/`buildCloneAuth` | `ctx` optional, graceful Device-Flow decline | ✓ VERIFIED | `ctx?: NotificationContext` confirmed at both sites; widened guard `provider === undefined \|\| ctx === undefined` confirmed. |
| `extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` | local `buildBundle` deleted, `buildCloneAuth` called directly, 3 unconditional `auth:` spreads | ✓ VERIFIED | `buildBundle` occurrences = 0; `auth: authBundle` occurrences = 3. |
| `scripts/check-unused-type-members.contracts.json` | 108 entries, 4 exceptions, `update-flow.ts` pins unmoved | ✓ VERIFIED | `contracts.length` = 108; the two `update-flow.ts` ids (`834:42`, `915:42`) present unchanged. |
| Planning docs (ROADMAP/STATE/BACKLOG/PROJECT) | SC6/SC7 carry-forward and amendment | ✓ VERIFIED | See SC6/SC7 rows above. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `add.ts::recognizeLeftover` | `gitOps.listRemotes(...)` | the sole production caller | ✓ WIRED | `grep -c 'gitOps.listRemotes('` (comment-filtered) in `add.ts` = 1, matching the plan's own acceptance criterion; `npm run fallow` (per plan-03's gate run) reported no dead-code finding. |
| `add.ts::recognizeLeftover` | `domain/clone-key.ts::canonicalCloneUrl` + `domain/source.ts::stripGitSuffix` | the identity comparison, orchestrator-tier only | ✓ WIRED | Both imports present on existing single-line import statements; `platform/git.ts` still imports zero `domain` modules (`grep -c 'from "../../domain'` = 0), preserving the `.fallowrc.json` zone boundary. |
| `add.ts` bottom `catch` (`!stagedAtFinal`) | `joinLeaks` → single `appendLeakToError` call | MA-14 single-level `Error.cause` contract | ✓ WIRED | `appendLeakToError(` count unchanged at 4 (pre/post); MA-14 double-fault test (plan 02) is the direct behavioral proof this link holds and that a two-level chain was NOT introduced. |
| `update-preflight.ts::makeUpdateCloneProbe` | `auth-host.ts::buildCloneAuth` | the cascade's auth attachment | ✓ WIRED | `grep -c 'buildCloneAuth'` in `update-preflight.ts` ≥ 4 (import + 3 call sites), confirmed. |
| The `.git/config` on disk | `platform/git.ts::listRemotes`'s `origin` arm | the removal decision | ⚠️ PARTIAL | Wired and functioning for a well-formed `.git/config`; NOT safe for a `.git/config` whose `origin` subsection lacks a `url` key (CR-01) — the link silently carries an `undefined` past a type boundary into a destructive-decision branch. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `listRemotes` — all declared arms pass against real fixtures | `node --test tests/platform/git.test.ts` | `tests 36`, `pass 36`, `fail 0` (re-run this session) | ✓ PASS |
| CR-01's missing-`url` shape crashes the real (non-faked) code | custom repro script against a hand-written `.git/config`, this session | `THROWS: TypeError Cannot read properties of undefined (reading 'endsWith')` | ✗ FAIL (confirms the gap) |
| No production/test file introduced a debt marker | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across the 6 touched production files | no matches | ✓ PASS |
| Requirement/type-member counts match plan claims | `grep -c` on `appendLeakToError(`, `cleanupStaging(`, `gitOps.listRemotes(`, `stripGitSuffix` export, `GIT_OPS_CASE_NAMES` entries, `contracts.length` | 4 / 5 / 1 / 1 / 13 / 108 — all match SUMMARY claims exactly | ✓ PASS |
| No source changed since the plan-03 executor's `CHECK_EXIT=0` run | `git diff --name-only 50746b81..HEAD -- ':!.planning/'` | empty | ✓ PASS (gate evidence still describes this tree; full suite not re-run per instructions) |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| MA-12 | 03-01, 03-02 | same-origin leftover recovers | ✓ SATISFIED | MA-12 end-to-end case, MA-8-precedence case |
| MA-13 | 03-01, 03-02 | foreign/unreadable/mismatched leftover still refuses | ⚠️ PARTIALLY SATISFIED | 8 of 9 near-miss/refusal shapes proven by behavior; the missing-`url`-key shape (CR-01) is unhandled and untested (WR-10) |
| MA-14 | 03-01, 03-02 | unremovable leftover fails as stale, no state entry | ✓ SATISFIED | single-fault + double-fault cases, `loadState` assertions |
| GATE-01 | 03-03 | type members read/pinned; whole-check green | ✓ SATISFIED | 108 contracts/4 exceptions confirmed; `CHECK_EXIT=0` evidence still valid (no source diff since) |

No orphaned requirements found: `grep -E "Phase 3"` against REQUIREMENTS.md returns exactly MA-12/MA-13/MA-14/GATE-01, all four of which appear in at least one plan's `requirements:` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | none found (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` scan across all 6 touched production files) | — | — |

No debt-marker gate violation. The 17 findings from `03-REVIEW.md` (1 critical, 10 warning, 6 info, all still `open` per `03-REVIEW-DISPOSITION.md`) are the substantive quality signal for this phase; CR-01 is escalated into the gap above per this report's own independent verification. WR-02 through WR-09 and IN-01 through IN-06 are real but non-blocking maintainability/diagnosability findings (stale doc comments, positional-parameter style, a discarded leak message on the standalone notify path, a corroboration gap on same-origin leftovers already accepted by D-3-02, a symlink asymmetry, vacuous root-run permission tests) — none of them falsifies a ROADMAP success criterion the way CR-01 does, and none is escalated as a gap here.

### Human Verification Required

None. All ROADMAP success criteria are either programmatically verified or programmatically falsified (CR-01); no item requires subjective/runtime human judgment to resolve. SC6's two live canaries are explicitly OUT OF SCOPE for this phase's own completion (ROADMAP: "Neither is closable on this machine... Both block milestone close only, not any phase's completion") and are correctly carried forward rather than closed here — that is what SC6 asked for, and it is done.

### Gaps Summary

One BLOCKER: CR-01 (independently reproduced against the real, non-faked code and the real
isomorphic-git library) breaks SC2/MA-13's refusal guarantee for a `.git/config` whose `origin`
subsection has no `url` key — a shape directly reachable from the WR-07 crash window this phase
exists to recover from. The fix the reviewer proposed (treat a present-but-url-less origin as
`no-origin` at the `platform/git.ts::listRemotes` boundary, so the type contract `add.ts` relies on
is actually true) is narrow, additive, and reuses the already-tested `StaleSourceCloneError` refusal
path — no new mechanism is required, only a stricter guard on an existing one, plus the paired test
(WR-10) that would have caught this before code review.

Everything else this phase set out to do — the MA-12 success path, the MA-14 leak discipline, the
autoupdate-cascade fix (SC5), the two canary carry-forwards (SC6), the D-79-03 rationale amendment
(SC7), and the whole-gate-green measurement (SC4/GATE-01) — is verified against the actual codebase,
not merely against SUMMARY.md's claims about it.

---

_Verified: 2026-09-27_
_Verifier: Claude (gsd-verifier)_
