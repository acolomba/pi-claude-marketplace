---
phase: 03-marketplace-add-recovers-from-its-own-leftover-clone
verified: 2026-09-28T21:12:00Z
status: passed
score: 7/7 must-haves verified
covered_files:
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-01-PLAN.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-01-SUMMARY.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-02-PLAN.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-02-SUMMARY.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-03-PLAN.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-03-SUMMARY.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-04-PLAN.md"
  - ".planning/workstreams/git-hosts/phases/03-marketplace-add-recovers-from-its-own-leftover-clone/03-04-SUMMARY.md"
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
covered_digest: "v2:sha256:0cc9842877d40138dfdffea1169ce8c759cc1bf1dd70fe8f7cee9f3a14bf2377"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: "passed"
  previous_score: "7/7"
  gaps_closed: []
  gaps_remaining: []
  regressions: []
advisory: []
---

# Phase 3: `marketplace add` recovers from its own leftover clone Verification Report

**Phase Goal:** A Pi user retrying `marketplace add` after a crash or a state rebuild succeeds when
the directory left behind is a clone of the very source being added, still gets the MA-6 refusal
when it is anything else, and is never left with a half-removed tree recorded in state — with the
milestone's whole gate surface green at its final HEAD.

**Verified:** 2026-09-28
**Status:** passed
**Re-verification:** Yes — the prior `passed` (7/7) report at `2f194da8` went stale because
`covered_files` changed under it after it was written: Phase 1's gap-closure plan (`01-04`,
commits `96c9eb13`/`c9c21446`) landed a module-private redirect-following `HttpClient` inside
`extensions/pi-claude-marketplace/platform/git.ts` (+115/-12 lines), plus a new test file
`a2db444e` (`tests/platform/git.test.ts`, +544 lines), plus doc-only commits. This round
independently re-reads the changed code this phase's must-haves depend on and re-measures the
whole gate at the current HEAD (`ab72dba0`) rather than trusting the prior narrative.

## Scope of what changed since the prior verification (`2f194da8`..`ab72dba0`)

```
git diff --stat 2f194da8..HEAD -- extensions/ tests/ scripts/
 extensions/pi-claude-marketplace/orchestrators/auth-host.ts       |   9 +-
 extensions/pi-claude-marketplace/platform/git-auth-callbacks.ts   |  10 +-
 extensions/pi-claude-marketplace/platform/git.ts                  | 115 ++-
 tests/platform/git.test.ts                                        | 544 +++++++++++++++++++++
 4 files changed, 666 insertions(+), 12 deletions(-)
```

Read line-by-line, not trusted from the diffstat:

- **`platform/git.ts`**: the new code (lines ~164-268) replaces the raw
  `isomorphic-git/http/node` client with a module-private `HttpClient` that sends every hop with
  `followRedirects: false` and follows redirects itself, dropping `authorization`/`cookie` headers
  on any hop whose origin (scheme+host+port) differs from the original request's. This is Phase 1's
  GAUTH-06 concern (redirect-credential-leak), **entirely orthogonal to Phase 3's `listRemotes`**.
  `listRemotes` itself (now at lines 471-489, shifted down by the insertion but otherwise
  byte-identical to the version this phase's prior verification measured) does its own
  `fs.promises.readFile` probe and a `git.listRemotes({ fs, dir })` call — it touches no HTTP
  surface. Confirmed by grep: the only 3 call sites of the new `http` constant are `clone`,
  `fetch`, and the `resolveRemoteRef`/`listServerRefs` call — all pre-existing call sites, same
  shape, now backed by the wrapped client.
- **`platform/git-auth-callbacks.ts`** and **`orchestrators/auth-host.ts`**: comment-only changes
  (rewording a docstring paragraph to describe the new redirect guard instead of `simple-get`'s
  own). No executable-code diff in either file.
- **`tests/platform/git.test.ts`**: 544 new lines, all new `GAUTH-06` redirect-guard cases (proven
  in the fresh full run below). The pre-existing `ORIGIN_SECTION_SHAPES` describe block (Phase 3's
  own MA-13 gap-closure proof) is unmoved and still passes.
- **`scripts/check-unused-type-members.contracts.json`**: `git diff --stat` shows no change. Zero
  entries in the file reference `platform/git.ts` (confirmed by direct grep), so the line-shift
  inside `git.ts` created no pin-drift risk for this phase's gate.
- **Every other file this phase's must-haves depend on is byte-unchanged**: `domain/source.ts`,
  `orchestrators/marketplace/add.ts`, `orchestrators/marketplace/shared.ts`,
  `orchestrators/plugin/update-preflight.ts`, `PROJECT.md`, and all of
  `tests/{domain/source,e2e/import-command,edge/types,orchestrators/marketplace/{add,shared,update},
  orchestrators/plugin/update-preflight,platform/git-ops-{contract,fake,fake.test}}.test.ts`
  — every one of these returned an empty `git diff --name-only 2f194da8..HEAD -- <file>`.

**Conclusion of the scope read:** the intervening commits touch Phase 1's redirect-credential
concern only. Phase 3's own production surface (`listRemotes`, `recognizeLeftover`, the SC5 cascade
fix, and the SC7 doc amendment) is untouched. What genuinely needs re-measurement is SC4 (the whole
gate, at the new HEAD) and a fresh confirmation that `listRemotes`'s 100%-direct-coverage claim
still holds now that the file around it grew — both are re-measured below, not assumed.

## Goal Achievement

### Observable Truths (ROADMAP Phase 3 Success Criteria, verbatim)

| # | Truth (SC) | Status | Evidence |
|---|------------|--------|----------|
| 1 | SC1 — `marketplace add` succeeds when `sources/<name>/` holds a leftover clone whose `origin` is the source being added; no manual delete needed | ✓ VERIFIED | `orchestrators/marketplace/add.ts` and `shared.ts` are byte-unchanged since the prior verification (`git diff --name-only 2f194da8..HEAD` empty for both). Fresh full-suite run this session: `✔ MA-12: a leftover clone whose origin names the same source recovers` (check4.log:5381), part of a 7386/7386-pass run. |
| 2 | SC2 — a leftover that is not a git clone, is unreadable, or whose `origin` names a different URL still refuses with the MA-6 `{stale clone}` row; recognition never widens into overwriting a directory the extension did not create | ✓ VERIFIED | `listRemotes` (the only production code this truth depends on) is byte-identical to the version the prior verification proved — confirmed by reading its current body (lines 471-489) side-by-side with the diff, which shows zero lines changed inside the function itself, only a location shift from unrelated code inserted above it. All 9 refusal-table cases plus the CR-01 gap-closure cases (`MA-13 / ATTR-07`, `MA-13 / RECON-03`) pass fresh this session (check4.log:5382-5391). Direct coverage on `platform/git.ts` re-measured at 100.00/100.00/100.00 in this run's `test:coverage:unit` report (check4.log:9684, file row confirmed present). WR-11 (see Anti-Patterns) remains a reasoned, non-blocking residual — unaffected by this round's diff, since it concerns `listRemotes`, which did not change. |
| 3 | SC3 — a recognized leftover that cannot be fully removed fails as stale with the cleanup leak appended, and state records no destination for the partially-removed tree | ✓ VERIFIED | `add.ts`'s leak-append path (`joinLeaks`/`appendLeakToError`) is byte-unchanged (empty diff `2f194da8..HEAD`). Both MA-14 cases pass fresh this session: `✔ MA-14: an unremovable recognized leftover fails as stale...` and `✔ MA-14 double fault: ...` (check4.log:5393-5394). |
| 4 | SC4 — every type member this milestone introduced is read by production code or recorded in the contracts file, and `npm run check` passes whole at the milestone's final HEAD | ✓ VERIFIED (gate re-measured, fresh, this HEAD) | `npm run check` run in full by this verifier from a clean tree at HEAD `ab72dba0`: `CHECK_EXIT=0`. `test:coverage:unit`: 7386/7386 pass, 0 fail, `all files \| 100.00 \| 100.00 \| 100.00` (empty uncovered-lines cell on every row under `extensions/`, including `platform/git.ts`). `test:integration`: 36/36 pass. `lint:type-members`: "Unused type member gate passed with 4 recorded exception(s)" — same 4 exceptions as before, `scripts/check-unused-type-members.contracts.json` re-confirmed at exactly 108 entries via direct JSON parse (zero of which name `platform/git.ts`, so the line-shift inside that file created no pin drift). `lint:type-members:negative`: "Unused type member negative controls passed (7 of 7)". `npx fallow audit --format json --quiet --explain --gate-marker agent` run standalone by this verifier: `verdict: "pass"`, exit 0, `dead_code_issues: 0`, `circular_dependencies: 0`, `boundary_violations: 0` (fallow's own `dupes`/`health` glyphs print a cosmetic `✗` on an otherwise-passing tree — a documented, known display quirk; the gate's actual verdict and exit code are what were checked, per this project's own "trust the exit code, not the glyph" discipline). `git status --porcelain` after the full run: clean (no side effects from verification). |
| 5 | SC5 — the marketplace autoupdate cascade authenticates rather than cloning authless, on any host | ✓ VERIFIED (carried, regression re-confirmed) | `orchestrators/auth-host.ts`'s executable code and `orchestrators/plugin/update-preflight.ts` are both byte-unchanged since the prior verification (the only diff in `auth-host.ts` is a comment rewording of the redirect-guard paragraph). Fresh full-suite run this session shows the SC5 cases passing: `✔ resolves the stored-credential cause for an unregistered host with no notification context`, `✔ D-3-04: github.com with no notification context declines the Device Flow gracefully instead of crashing`, `✔ D-3-04: returns a bundle bound to the resolved host when ctx is omitted` (check4.log:5234-5242), and `✔ D-3-04: authenticates the autoupdate cascade against github.com with no notification context` (check4.log:7157). |
| 6 | SC6 — Phase 1's and Phase 2's live canaries are carried forward with reasons/resume commands, never marked passed on link-by-link evidence — now CLOSED against a local stand-in, honestly distinguished from a hosted-forge run | ✓ VERIFIED | `01-UAT.md` (16/16 pass, including test 16's cross-origin POST-redirect case added by the Phase 1 gap closure this round's diff is about) and `02-UAT.md` (1/1 pass) both record closure against real local smart-HTTP servers, not a hosted forge. `.planning/BACKLOG.md`'s `GHCAN-01`/`GHCAN-02` entries (read in full) honestly state "Status (2026-09-28): closed against a local stand-in... A run against a hosted forge... is still unexercised; keep this entry only if that distinction matters." STATE.md carries the same distinction. This matches the instruction's "closed or explicitly carried" bar with the caveat recorded honestly. |
| 7 | SC7 — `PROJECT.md`'s D-79-03 row rationale is amended to match the code; its OUTCOME is untouched | ✓ VERIFIED (carried, regression re-confirmed) | `git diff --name-only 2f194da8..HEAD -- PROJECT.md` is empty — unedited since the prior verification confirmed the amendment. |

**Score:** 7/7 truths verified (0 present-but-behavior-unverified)

### Advisory (New Scope, Unevidenced)

None. This round's own reading of the intervening diff (Phase 1's redirect-credential guard) found
no new finding bearing on Phase 3's must-haves — the change is orthogonal (a different production
concern, in the same file, that Phase 3's `listRemotes` does not share any code path with). WR-11,
the one open finding that does bear on Phase 3's scope, is a carried-forward item from the prior
round's code review (`03-REVIEW.md`), not new to this round, and is addressed under Anti-Patterns
below rather than here.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/platform/git.ts::listRemotes` | 4-arm discriminated, own fs probe before isomorphic-git, never throws, `origin` arm carries a real string url | ✓ VERIFIED | Read directly at its current location (lines 471-489): byte-identical body to the version the prior verification round proved, only its line offset moved (now sits below the new, unrelated `HttpClient` code). 100% direct coverage re-confirmed in this session's fresh `test:coverage:unit` run. |
| `extensions/pi-claude-marketplace/platform/git.ts::http` (module-private redirect-following client) | Not a Phase 3 artifact — Phase 1 gap-closure (G-01-4) | ✓ VERIFIED (out of scope, confirmed non-interfering) | Reviewed to confirm it shares no code path with `listRemotes` (which never imports or calls `http`) and does not touch any of the 3 pre-existing `http`-consuming call sites' shapes (`clone`, `fetch`, `listServerRefs`) beyond swapping the underlying implementation. |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts::recognizeLeftover` | recognize-remove-rename branch, single-level leak fold | ✓ VERIFIED | Byte-unchanged since `2f194da8` (empty diff). |
| `tests/orchestrators/marketplace/add.test.ts` | end-to-end refusal proof, both modes, through the real adapter | ✓ VERIFIED | Byte-unchanged since `2f194da8`; all cases including `MA-13 / ATTR-07` and `MA-13 / RECON-03` pass fresh in this session's run. |
| `tests/platform/git.test.ts` | real-repository platform-tier proof of both truncation shapes plus the empty-url boundary; now also carries the Phase 1 redirect-guard suite | ✓ VERIFIED | `ORIGIN_SECTION_SHAPES` (Phase 3's own rows) confirmed present and passing (check4.log:8076-8078), unmoved and unedited by the intervening diff. The file's +544 new lines are entirely the Phase-1-owned `GAUTH-06` redirect cases (confirmed passing, check4.log:8037-8069) — no interference with Phase 3's rows. |
| `scripts/check-unused-type-members.contracts.json` | 108 entries, 4 exceptions, unmoved | ✓ VERIFIED | Re-confirmed via direct JSON parse (108 entries) and a fresh `npm run lint:type-members` run this session (4 exceptions, same identities). Zero entries reference `platform/git.ts`, so the file's line-shift created no drift risk. |
| Planning docs (ROADMAP/STATE/BACKLOG/PROJECT, SC6/SC7) | carry-forward and amendment preserved | ✓ VERIFIED (carried) | `PROJECT.md` unchanged; ROADMAP/STATE/BACKLOG all show the SC6 canary-closure updates layered on top of the original carry-forward text, read in full above. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| The `.git/config` on disk | `platform/git.ts::listRemotes`'s `origin` arm | the removal decision | ✓ WIRED | Unchanged code, unchanged behavior — re-confirmed by the fresh 100%-coverage measurement and the fresh pass of all `ORIGIN_SECTION_SHAPES` rows. |
| `add.ts::recognizeLeftover` | `gitOps.listRemotes(...)` | the sole production caller | ✓ WIRED (carried) | `add.ts` unedited since the prior verification; link unchanged. |
| `platform/git.ts`'s 3 `http`-consuming call sites (`clone`, `fetch`, `listServerRefs`) | the new module-private redirect-following client | direct assignment (`const http: HttpClient = { request: requestWithinOrigin }`) | ✓ WIRED (Phase 1 concern, confirmed non-regressive for Phase 3) | Grepped: exactly 3 consumers, same call shape as before the diff, only the underlying implementation object changed. No new call site added, none removed. |
| `tests/orchestrators/marketplace/add.test.ts`'s gap-closure cases | the real (non-faked) `platform/git.ts::listRemotes` | `arrangeLeftoverWithoutOriginUrl`'s `gitOps` spread | ✓ WIRED | Unchanged since prior verification; re-confirmed passing this session. |

### Data-Flow Trace (Level 4)

Not applicable in the UI-rendering sense (this is a CLI/backend phase, no rendered dynamic values).
The equivalent trace for this phase — "does the `origin` url on disk actually reach the removal
decision, not a static stub" — is covered by the Key Link table above and was already fully proven
in the prior verification round; this round confirms the code path is unchanged.

### Behavioral Spot-Checks

Rather than a handful of quick spot-checks, this round ran the **full** `npm run check` fresh
against the current HEAD (per the task's explicit SC4 instruction), which is strictly stronger
evidence than a spot-check subset. Individual named-test results extracted from that run:

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| MA-12 recovery still passes | full suite (`npm run check`, this session) | `✔ MA-12: a leftover clone whose origin names the same source recovers` | ✓ PASS |
| All 9 MA-13 refusal-table rows + both gap-closure cases still pass | full suite (this session) | 11 named `✔ MA-13...` lines, 0 fail (check4.log:5382-5391) | ✓ PASS |
| MA-8 precedence still holds | full suite (this session) | `✔ MA-8: a matching leftover still yields (failed) {duplicate name}, not {stale clone}` | ✓ PASS |
| Both MA-14 leak cases still pass | full suite (this session) | 2 named `✔ MA-14...` lines | ✓ PASS |
| SC5 cascade cases still pass | full suite (this session) | 4 named `✔ D-3-04...`/stored-credential lines (check4.log:5234-5242, 7157) | ✓ PASS |
| `ORIGIN_SECTION_SHAPES` (Phase 3's platform-tier proof) still passes | full suite (this session) | 3 named `✔ reports...` lines (check4.log:8076-8078) | ✓ PASS |
| Phase 1's redirect-credential guard (the actual diff since prior verification) does not regress anything Phase 3 depends on | full suite (this session) | 16 named `✔ GAUTH-06...` lines, all pass, 0 interaction with `listRemotes` | ✓ PASS |
| `platform/git.ts` holds 100% direct coverage after the redirect-client insertion | `test:coverage:unit` (this session, part of full run) | `git.ts \| 100.00 \| 100.00 \| 100.00` | ✓ PASS |
| `scripts/check-unused-type-members.contracts.json` still holds 108 entries, 4 exceptions | `npm run lint:type-members` (this session, part of full run) | same 4 named exceptions, 108-entry count confirmed by direct JSON parse | ✓ PASS |
| `npm run check` exits 0 as a whole, at this HEAD | `npm run check > check4.log 2>&1; echo "CHECK_EXIT=$?"` (never piped) | `CHECK_EXIT=0` | ✓ PASS |
| `npx fallow audit` verdict, run standalone by this verifier | `npx fallow audit --format json --quiet --explain --gate-marker agent` | `{"verdict":"pass", exit 0}` | ✓ PASS |
| No debt markers in any of this phase's 18 covered production/test files | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` over the full covered-files list | no matches | ✓ PASS |
| Working tree clean after the full verification run | `git status --porcelain` | empty | ✓ PASS |

### Probe Execution

SKIPPED (no probes declared for this phase — no `scripts/*/tests/probe-*.sh` referenced by any
PLAN/SUMMARY/VERIFICATION artifact, and this is not a migration/CLI-tooling phase).

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| MA-12 | 03-01, 03-02 (carried) | same-origin leftover recovers | ✓ SATISFIED | Re-run green fresh this session; `add.ts` byte-unchanged since prior verification. |
| MA-13 | 03-01, 03-02, 03-04 | foreign/unreadable/mismatched/url-less leftover still refuses | ✓ SATISFIED | All 9 refusal-table shapes plus the url-less gap-closure shape (both modes) re-run green fresh this session. |
| MA-14 | 03-01, 03-02 (carried) | unremovable leftover fails as stale, no state entry | ✓ SATISFIED | Both cases re-run green fresh this session; leak path byte-unchanged. |
| GATE-01 | 03-03, 03-04 | type members read/pinned; whole-check green, measured fresh on the final tree | ✓ SATISFIED | `npm run check` re-run in full this session at HEAD `ab72dba0`: `CHECK_EXIT=0`, 7386/7386 unit, 100/100/100 coverage, 36/36 integration, 108 contracts/4 exceptions, `fallow audit` verdict `pass`. |

No orphaned requirements: `grep -n "Phase 3" REQUIREMENTS.md` returns exactly MA-12/MA-13/MA-14/GATE-01,
all four `[x]` and all four present in at least one plan's `requirements:` frontmatter (03-01 through 03-04).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` in any of the 18 covered production/test files (re-scanned this session) | — | — |
| `extensions/pi-claude-marketplace/platform/git.ts` (multi-url `origin` config resolution) | `listRemotes`, ~lines 471-489 (unchanged location content) | WR-11 (open, warning, carried from `03-REVIEW.md`): a `.git/config` with two `url =` lines under `[remote "origin"]` is resolved by isomorphic-git's LAST value; canonical git uses the FIRST. A hand-authored two-url config could therefore be recognized and removed even though git itself would treat the tree's effective origin as a different, foreign repository. | Warning (advisory, non-blocking) | Unaffected by the intervening diff — `listRemotes` did not change. Re-confirmed still valid: the reasoning that this shape cannot arise from the WR-07 crash window or a state rebuild (no code path in this codebase or in isomorphic-git's own config writer ever emits a second `url` line per section) still holds, because the writer path (`GitConfigManager.save`) is unchanged. Still recommended for a BACKLOG entry; not treated as a phase-blocking gap. |

No new anti-pattern findings surfaced by this round's own review of the intervening diff
(Phase 1's redirect-credential guard in `platform/git.ts`/`git-auth-callbacks.ts`): the new code is
documented inline with a full JSDoc rationale, has 100% direct coverage, and shares no code path
with anything Phase 3's must-haves depend on. WR-01 through WR-10 (fixed) and IN-01 through IN-08
remain exactly as disposed in `03-REVIEW-DISPOSITION.md`, carried unchanged; none falsifies a
ROADMAP success criterion, and this round adds no new evidence against that judgment.

### Human Verification Required

None. Every ROADMAP success criterion is either freshly re-measured (SC4) or confirmed unchanged
by direct diff inspection plus a fresh full-suite pass (SC1, SC2, SC3, SC5, SC7), or independently
confirmed via the UAT/BACKLOG artifacts (SC6). WR-11 is a reasoned, evidence-backed residual
finding, not a human-verification item — the reasoning is unaffected by this round's diff and was
already judged non-blocking in the prior round.

### Gaps Summary

No gaps. The prior round's `passed (7/7)` verdict is re-confirmed at the current HEAD (`ab72dba0`),
not merely re-stated: this round independently read the entire diff between the two HEADs
(`2f194da8`..`ab72dba0`, four files, +666/-12 lines), confirmed it is Phase 1's redirect-credential
guard and shares no code path with any of Phase 3's must-haves, and re-measured the one truth that
genuinely depends on "whole tree, right now" evidence (SC4/GATE-01) with a fresh, from-scratch
`npm run check` run (`CHECK_EXIT=0`, 7386/7386 unit tests, 100.00/100.00/100.00 coverage including
`platform/git.ts`, 36/36 integration tests, 108 contract entries with the same 4 exceptions, 7/7
negative controls) plus a standalone `fallow audit` run (`verdict: pass`). No regression was found
in any of the six other previously-verified truths.

WR-11 (a multi-valued `origin.url` config resolved by last-value instead of git's first-value
semantics) remains open and unaddressed in the code, exactly as in the prior round. It is not a
gap for the reasons re-confirmed above (residual, non-reachable from this phase's own recovery
scenarios, `warning` severity, recommended for a BACKLOG entry).

---

_Verified: 2026-09-28_
_Verifier: Claude (gsd-verifier)_
