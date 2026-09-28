---
phase: 03-marketplace-add-recovers-from-its-own-leftover-clone
verified: 2026-09-28T00:00:00Z
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
covered_digest: "v2:sha256:4c69a66507ee21e4e907aeabfd753ce837d5bbba0cee351f6142bf91c4d232db"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: "gaps_found"
  previous_score: "6/7"
  gaps_closed:
    - "SC2 / MA-13: a leftover whose `.git/config` declares an `origin` remote section with no `url` key now refuses with the MA-6 `{stale clone}` row in both standalone and orchestrated mode, instead of crashing raw (`TypeError`) or misclassifying as `{unparseable}` (CR-01, closed by plan 03-04, commits `24f2da2c`/`235fdc17`)."
  gaps_remaining: []
  regressions: []
---

# Phase 3: `marketplace add` recovers from its own leftover clone Verification Report

**Phase Goal:** A Pi user retrying `marketplace add` after a crash or a state rebuild succeeds when
the directory left behind is a clone of the very source being added, still gets the MA-6 refusal
when it is anything else, and is never left with a half-removed tree recorded in state — with the
milestone's whole gate surface green at its final HEAD.

**Verified:** 2026-09-28
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 03-04)

## Goal Achievement

### Observable Truths (ROADMAP Phase 3 Success Criteria, verbatim)

| # | Truth (SC) | Status | Evidence |
|---|------------|--------|----------|
| 1 | SC1 — `marketplace add` succeeds when `sources/<name>/` holds a leftover clone whose `origin` is the source being added; no manual delete needed for the WR-07 crash window or a state rebuild | ✓ VERIFIED (carried, regression check) | Re-ran `node --test tests/orchestrators/marketplace/add.test.ts` this session: `MA-12: a leftover clone whose origin names the same source recovers` passes (81/81 total). `git diff --name-only 50746b81..HEAD -- extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` is empty — the recovery code path is byte-unchanged since the prior verification round. |
| 2 | SC2 — a leftover that is not a git clone, is unreadable, or whose `origin` names a different URL still refuses with the MA-6 `{stale clone}` row; recognition never widens into overwriting a directory the extension did not create | ✓ VERIFIED (gap closed) | See "Gap closure verification" below. The CR-01 crash and the `{unparseable}` misclassification are both eliminated; the url-less leftover now refuses as `{stale clone}` in both modes, proven end to end through the real (non-faked) adapter. A residual finding (WR-11) is discussed separately and judged not to falsify this truth — see "WR-11" section. |
| 3 | SC3 — a recognized leftover that cannot be fully removed fails as stale with the cleanup leak appended (MA-9 discipline), and state records no destination for the partially-removed tree | ✓ VERIFIED (carried, regression check) | Both MA-14 cases (`MA-14: an unremovable recognized leftover fails as stale...` and `MA-14 double fault: ...`) re-ran green this session. `add.ts`'s `joinLeaks`/`appendLeakToError`/bottom catch are untouched by plan 03-04 (confirmed: `git diff --numstat f301135e..HEAD -- extensions/` touches only `platform/git.ts`). |
| 4 | SC4 — every type member this milestone introduced is read by production code or recorded in the contracts file, and `npm run check` passes whole at the milestone's final HEAD | ✓ VERIFIED (gate re-measured) | `scripts/check-unused-type-members.contracts.json` holds exactly 108 entries (re-confirmed this session via direct JSON parse). `npm run lint:type-members` re-run fresh this session: `TYPE_MEMBERS_EXIT=0`, same 4 recorded exceptions. `npx tsc --noEmit` and `npx eslint` on all 3 plan-03-04 files: exit 0. `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/platform/git.ts`: branches 47/47, functions 11/11, lines 394/394. `git diff --name-only 235fdc17..HEAD -- ':!.planning/'` is empty, so 03-04-SUMMARY's fresh whole-gate run (`CHECK_EXIT=0`, 7369/7369 unit, `all files 100.00/100.00/100.00`, 36/36 integration, taken ON commit `235fdc17`) still describes the current tree; only three subsequent commits exist and all three are docs-only (`git log --oneline 235fdc17..HEAD -- ':!.planning/'` is empty). |
| 5 | SC5 — the marketplace autoupdate cascade is settled: a private plugin source refreshes from the user's credential helper instead of cloning authless, on any host | ✓ VERIFIED (carried, regression check) | `git diff --name-only 50746b81..HEAD -- extensions/pi-claude-marketplace/orchestrators/auth-host.ts extensions/pi-claude-marketplace/orchestrators/plugin/update-preflight.ts` is empty — untouched since the prior verification confirmed `ctx?:` widening and the 3 unconditional `auth:` spreads. |
| 6 | SC6 — Phase 1's and Phase 2's live canaries are carried forward with reasons/resume commands, never marked passed on link-by-link evidence | ✓ VERIFIED (carried, regression check) | `grep -n "GHCAN-01\|GHCAN-02"` still finds both in STATE.md/BACKLOG.md/ROADMAP.md. `git log --oneline` for `phases/01-.../` and `phases/02-.../` shows no commits since the prior verification (last touches were `dd4fefb4`/`9ddd9360`/`4d530bfb`, all pre-dating Phase 3's gap-closure work) — neither canary was silently closed. |
| 7 | SC7 — `PROJECT.md`'s D-79-03 row rationale is amended to match the code; its OUTCOME is untouched | ✓ VERIFIED (carried, regression check) | `git diff --name-only 50746b81..HEAD -- PROJECT.md` is empty — unedited since the prior verification confirmed the amendment. |

**Score:** 7/7 truths verified (0 present-but-behavior-unverified)

### Gap closure verification (SC2 / MA-13, CR-01)

Independently re-derived this session, not taken on SUMMARY's word:

1. **Code inspection.** `extensions/pi-claude-marketplace/platform/git.ts:362-379` (`listRemotes`)
   now reads the origin's `url` into a `const url: unknown`, and returns the `origin` arm only when
   `typeof url === "string"`; every other case (no `origin` entry, or an `origin` entry whose parsed
   value is not a string) returns `{ kind: "no-origin" }`, which `recognizeLeftover` (`add.ts`,
   unedited) already routes to the `StaleSourceCloneError` refusal arm. `add.ts` itself has zero
   diff since the pre-gap-closure baseline (`f301135e`) — the fix is confined to the one platform
   module that talks to isomorphic-git, exactly as D-3-03 requires.
2. **Targeted test runs (this session, not from SUMMARY).**
   - `node --test tests/orchestrators/marketplace/add.test.ts` → `ADD_EXIT=0`, 81/81 pass, including
     both new cases: `✔ MA-13 / ATTR-07: a leftover whose origin section names no url refuses as
     stale clone` (standalone) and `✔ MA-13 / RECON-03: orchestrated mode reports a leftover whose
     origin section names no url as stale clone` (orchestrated).
   - `node --test tests/platform/git.test.ts` → `GIT_TEST_EXIT=0`, 39/39 pass, including the three
     new `ORIGIN_SECTION_SHAPES` rows: `reports no-origin for an origin section with a fetch line
     but no url`, `reports no-origin for an origin section with no keys`, `reports the empty url of
     an origin section whose url value is empty` (the last one pins that an empty string is still a
     string and stays on the `origin` arm, refused instead by `add.ts`'s byte comparison — D-3-01's
     single refusal site is preserved).
   - `npx tsc --noEmit` → exit 0. `npx eslint` on the 3 touched files → exit 0 (no
     `no-unnecessary-condition`/`prefer-optional-chain`/`different-types-comparison` violations, i.e.
     the guard is a genuine `typeof` narrowing from `unknown`, not a comparison against the library's
     declared-but-false `string` type).
   - `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/platform/git.ts` →
     branches 47/47, functions 11/11, lines 394/394 — the new branch is exercised by a named case,
     not merely by the coverage figure (GATE-01's own "a missing branch is proven by a named case"
     truth).
3. **No regression.** Both carried MA-13 refusal-table cases (ssh-form, garbage, empty-string,
   case-differing, prefix-adjacent, no-origin, unreadable) and both MA-14 leak cases still pass, and
   `git diff --numstat f301135e..HEAD -- tests/orchestrators/marketplace/add.test.ts` shows 0
   deletions (additions only) — no pre-existing case was altered to make the new one pass.

**Verdict: the CR-01 gap is closed.** The url-less leftover shape that previously crashed raw
(standalone) or misclassified as `{unparseable}` (orchestrated) now refuses cleanly as `{stale
clone}` in both modes, through the real (non-faked) adapter, with the leftover's `.git/config` bytes
left unchanged and no state entry recorded (`MA-13 / ATTR-07`'s and `MA-13 / RECON-03`'s assertions,
independently re-run above).

### WR-11 — reasoned as a residual, non-blocking finding (not a gap)

The gap-closure code review (`03-REVIEW.md`) raised a new warning after the CR-01 fix landed: when a
`.git/config`'s `[remote "origin"]` section carries **two** `url` lines, isomorphic-git's
`GitConfig.get` resolves the config value as the **last** one, while real git's own
`remote get-url`/effective fetch behavior resolves the **first** one. A leftover whose first url is
foreign but whose second (last) url happens to byte-equal the canonical url of the source being
added would therefore be recognized as a matching leftover and removed by `recognizeLeftover`, even
though git itself would treat that tree's origin as the foreign, first URL. I independently read
`03-REVIEW.md`'s reproduction (a real `.git/config` with two `url` lines, real `git remote get-url`
output, and the real `listRemotes` result) and confirmed the current code (`git.ts:362-379`) still
uses `git.listRemotes` (last-value-wins) rather than the reviewer's suggested `getConfigAll`-based
"refuse on ambiguity" fix — this finding is unaddressed in the code, and `03-REVIEW-DISPOSITION.md`
correctly records it `open`.

**Judgment: this does not falsify SC2 for the purposes of this phase's completion.** Reasoning:

- SC2's guarantee is scoped to the recovery scenario this phase builds: the WR-07 crash window and a
  state rebuild. Neither can produce a multi-valued `origin.url`. isomorphic-git's own config writer
  (`GitConfigManager.save`) serializes the whole file from one parsed value per key on every clone;
  an interrupted rewrite can leave a config truncated or absent, but it cannot leave two *different*
  `url` lines under the same section, because no code path in this codebase (or in isomorphic-git's
  own write path) ever emits a second one. The shape the reviewer built required hand-authoring the
  config directly — the parenthetical in this verification's own instructions names exactly that
  caveat ("requires a hand-edited multi-url config the extension never writes"), and it holds: I
  confirmed `git.ts` and `add.ts` contain no code path that writes more than one `url` value per
  remote.
- The directory in question (`<scopeRoot>/pi-claude-marketplace/sources/<name>/`) is
  extension-owned and extension-populated (NFR-10 containment). An actor with the local filesystem
  write access needed to hand-author a two-`url` config inside it already has the access needed to
  replace its contents directly — tricking recognition into a remove-then-reclone does not gain such
  an actor anything a direct write would not already give them, and arguably works against them
  (their planted directory gets replaced with the legitimate clone).
  This differs from the CR-01 shape, which is the direct byproduct of the extension's own ordinary,
  attacker-free clone-then-crash sequence.
  - This filesystem-access framing is a supporting observation on exploitability, not the basis for
    the "reachable from crash" verdict above, which follows from the write-path analysis alone.
- The finding's own severity, assigned by the phase's code reviewer, is `warning` — the same tier as
  WR-01 through WR-09, which the prior verification round already classified as non-blocking
  maintainability/diagnosability findings distinct from CR-01's `critical` tier. WR-11 does not carry
  the same "reachable from this phase's own recovery mechanism" property that made CR-01 a genuine
  gap.

This is a real, correctly-identified divergence between isomorphic-git's config resolution and
git's own semantics, and it is worth hardening defensively (the reviewer's `getConfigAll`-based fix
is narrow and additive). It is **recommended for a BACKLOG entry** so it is not lost, but it is not
being treated as a gap blocking this phase's closure, for the reasons above. If the maintainer
weighs the residual risk differently, this section provides the evidence needed to reopen it as a
gap.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/platform/git.ts::listRemotes` | 4-arm discriminated, own fs probe before isomorphic-git, never throws, `origin` arm carries a real string url | ✓ VERIFIED | The `origin` arm's declared type (`url: string`) is now enforced at runtime via `typeof url === "string"` narrowing from `unknown`; CR-01's falsifiable-type defect is closed. 100% direct coverage (branches 47/47, functions 11/11, lines 394/394), re-measured this session. |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts::recognizeLeftover` | recognize-remove-rename branch, single-level leak fold | ✓ VERIFIED | Unedited since `f301135e` (confirmed via empty diff); its existing refusal arm now receives a type-honest `no-origin` for the url-less shape instead of a value that violated its own contract. |
| `tests/orchestrators/marketplace/add.test.ts` | end-to-end refusal proof, both modes, through the real adapter | ✓ VERIFIED | `MA-13 / ATTR-07` (standalone) and `MA-13 / RECON-03` (orchestrated) both compose the real, non-faked `listRemotes` into the fake-clone `GitOps` seam, against a hand-written `.git/config` — not the fake's typed canned value, which cannot express this shape. Both pass; both were observed failing pre-fix (RED evidence recorded in 03-04-SUMMARY, independently corroborated by 03-REVIEW.md's own pre-fix re-run). |
| `tests/platform/git.test.ts` | real-repository platform-tier proof of both truncation shapes plus the empty-url boundary | ✓ VERIFIED | `ORIGIN_SECTION_SHAPES` (3 rows) run against `createGitTestRepository`-backed real repositories; each row asserts the library's own output before the wrapper's, proving the fixture reproduces the named shape. |
| `scripts/check-unused-type-members.contracts.json` | 108 entries, 4 exceptions, unmoved | ✓ VERIFIED | Re-confirmed via direct JSON parse and a fresh `npm run lint:type-members` run this session. |
| Planning docs (ROADMAP/STATE/BACKLOG/PROJECT, SC6/SC7) | carry-forward and amendment preserved | ✓ VERIFIED (carried) | No diff since the prior verification round. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| The `.git/config` on disk | `platform/git.ts::listRemotes`'s `origin` arm | the removal decision | ✓ WIRED (gap closed) | Now safe for a `.git/config` whose `origin` subsection lacks a `url` key (`typeof` guard); safe for an empty-string url (stays on the `origin` arm, refused by the caller's byte comparison, D-3-01 preserved). **Not** safe for a two-`url`-line section (WR-11, judged residual/non-blocking above). |
| `add.ts::recognizeLeftover` | `gitOps.listRemotes(...)` | the sole production caller | ✓ WIRED (carried) | `add.ts` unedited; link unchanged since prior verification. |
| `tests/orchestrators/marketplace/add.test.ts`'s new cases | the real (non-faked) `platform/git.ts::listRemotes` | `arrangeLeftoverWithoutOriginUrl`'s `gitOps` spread | ✓ WIRED | Confirmed by reading the helper and by the fact both new cases were observed to fail pre-fix and pass post-fix — a fake-fixture-only case could not have shown that distinction. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Both new MA-13 refusal cases pass | `node --test tests/orchestrators/marketplace/add.test.ts` (this session) | `ADD_EXIT=0`, 81/81, both new cases on `✔` lines | ✓ PASS |
| Both new platform truncation rows + the empty-url boundary row pass | `node --test tests/platform/git.test.ts` (this session) | `GIT_TEST_EXIT=0`, 39/39, all three rows on `✔` lines | ✓ PASS |
| `platform/git.ts` still typechecks and lints clean | `npx tsc --noEmit`; `npx eslint extensions/.../git.ts tests/.../add.test.ts tests/platform/git.test.ts` | both exit 0 | ✓ PASS |
| `platform/git.ts` holds 100% direct coverage | `node scripts/test-coverage-direct.mjs extensions/pi-claude-marketplace/platform/git.ts` | `DIRECT_GIT_EXIT=0`, branches 47/47, functions 11/11, lines 394/394 | ✓ PASS |
| `scripts/check-unused-type-members.contracts.json` still holds 108 entries, 4 exceptions | `npm run lint:type-members` (this session) | `TYPE_MEMBERS_EXIT=0`, same 4 named exceptions | ✓ PASS |
| No source changed since the 03-04 executor's fresh `CHECK_EXIT=0` run (commit `235fdc17`) | `git diff --name-only 235fdc17..HEAD -- ':!.planning/'` | empty | ✓ PASS (whole-gate evidence still describes this tree; full suite not re-run per instructions, corroborated by the targeted re-runs above) |
| No debt markers in the 3 gap-closure files | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` | no matches | ✓ PASS |
| Working tree is clean | `git status --porcelain` | only the untracked, expected `.planning/workstreams/git-hosts/milestone.lock` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| MA-12 | 03-01, 03-02 (carried) | same-origin leftover recovers | ✓ SATISFIED | MA-12 case re-run green this session; `add.ts` byte-unchanged since prior verification. |
| MA-13 | 03-01, 03-02, 03-04 | foreign/unreadable/mismatched/url-less leftover still refuses | ✓ SATISFIED | All 9 refusal-table shapes plus the url-less shape (both modes) pass; the sole gap (CR-01) is closed. |
| MA-14 | 03-01, 03-02 (carried) | unremovable leftover fails as stale, no state entry | ✓ SATISFIED | Both cases re-run green this session; leak path byte-unchanged since prior verification. |
| GATE-01 | 03-03, 03-04 | type members read/pinned; whole-check green, measured fresh on the final committed tree | ✓ SATISFIED | 108 contracts/4 exceptions re-confirmed; `lint:type-members`, `tsc`, `eslint`, and direct coverage re-run green this session; the SUMMARY's fresh whole-`npm run check` (`CHECK_EXIT=0` at `235fdc17`) still describes the current tree (empty diff, docs-only commits since). |

No orphaned requirements: `grep -n "Phase 3" REQUIREMENTS.md` returns exactly MA-12/MA-13/MA-14/GATE-01, all four `[x]` and all four present in at least one plan's `requirements:` frontmatter (03-01 through 03-04).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` in the 3 gap-closure files (re-scanned this session) | — | — |
| `extensions/pi-claude-marketplace/platform/git.ts:376-377` | 376 | IN-07 (open, info): the inline comment retains the banned "X, not Y" framing the reviewer flagged | Info | Non-blocking style nit; does not affect behavior or the gate. |
| `tests/orchestrators/marketplace/add.test.ts:701-728` | — | IN-08 (open, info): the orchestrated url-less case does not assert `loadState` stays empty, unlike its standalone sibling | Info | Non-blocking test-completeness gap; the plan's own `<behavior>` spec for this case did not require the state assertion, and no code path in `add.ts` writes state on any refusal branch, so this is a coverage-of-assertions nit, not a functional gap. |
| `extensions/pi-claude-marketplace/platform/git.ts` (multi-url config resolution) | :362-379 | WR-11 (open, warning): reasoned above as residual/non-blocking, not a gate blocker | Warning (advisory) | See "WR-11" section — recommended for a BACKLOG entry, not blocking this phase. |

No debt-marker gate violation. WR-01 through WR-09 and IN-01 through IN-06 remain open per
`03-REVIEW-DISPOSITION.md`, carried unchanged from the prior verification round (that round already
judged none of them falsifies a ROADMAP success criterion); this round adds no new evidence against
that judgment and does not re-open them.

### Human Verification Required

None. Every ROADMAP success criterion is either programmatically verified or, in SC2's case,
programmatically verified with a reasoned, evidence-backed disposition of the one residual finding
(WR-11) that could plausibly bear on it. SC6's two live canaries remain explicitly out of scope for
phase completion (carried forward per ROADMAP's own instruction) and are not re-litigated here.

### Gaps Summary

No gaps remain. The prior round's sole gap — SC2 / MA-13, CR-01 (a url-less `origin` section
crashing or misclassifying `marketplace add`) — is closed by plan 03-04 and independently
re-confirmed in this session through direct code inspection, fresh targeted test runs (not taken from
SUMMARY.md), and fresh toolchain re-runs (`tsc`, `eslint`, direct coverage, `lint:type-members`). No
regression was found in any of the six previously-verified truths (SC1, SC3, SC4, SC5, SC6, SC7): the
gap-closure plan touched exactly three files (`platform/git.ts`, `tests/orchestrators/marketplace/add.test.ts`,
`tests/platform/git.test.ts`), and every file underlying the other six truths is byte-unchanged since
the prior verification's baseline.

One residual finding (WR-11, a multi-valued `origin.url` config resolved by last-value instead of
git's first-value semantics) surfaced during the gap-closure code review and remains unaddressed in
the code. It is reasoned above, with evidence, as **not** falsifying SC2 for this phase's completion
— it requires a hand-authored config shape that no code path in this codebase or in isomorphic-git's
own write path ever produces, so it cannot arise from the crash-window or state-rebuild scenarios
SC2 is written to cover. It is recommended for a BACKLOG entry so the maintainer can weigh the
residual risk on their own terms; this report's evidence is sufficient to reopen it as a gap if that
judgment differs from the one made here.

---

_Verified: 2026-09-28_
_Verifier: Claude (gsd-verifier)_
