---
phase: 03-marketplace-add-recovers-from-its-own-leftover-clone
verified: 2026-09-28T23:05:00Z
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
  - ".planning/workstreams/git-hosts/quick/260928-tt9-fix-url-raw-identity-mismatch-and-duplic/260928-tt9-PLAN.md"
  - ".planning/workstreams/git-hosts/quick/260928-tt9-fix-url-raw-identity-mismatch-and-duplic/260928-tt9-SUMMARY.md"
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
covered_digest: "v2:sha256:8f20bf9ce29d5aaba872b1f61175fd35003ccced64f8cb9a3ec07df9ab848bdd"
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: "passed"
  previous_score: "7/7"
  gaps_closed:
    - "WR-11 (03-REVIEW-DISPOSITION.md, warning, previously `open`): a `.git/config` with two `url =` lines under `[remote \"origin\"]` was resolved by isomorphic-git's LAST value while canonical git fetches the FIRST, so a crafted two-url leftover could be recognized and removed as `origin` even though git itself would treat it as a different, foreign repository. Fixed by quick task 260928-tt9 (commit `add75890`): `listRemotes` now reads every `remote.origin.url` value via `git.getConfigAll` and reports `origin` only when there is exactly one string value; zero or two-plus values report `no-origin`, which the existing MA-13 refusal path turns into `{stale clone}`. Proven by a new named test, `MA-13 / WR-11: a leftover whose origin section names two urls refuses as stale clone`, run fresh this session and passing."
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
**Re-verification:** Yes — the prior `passed` (7/7) report, committed at `1facf708` (measured against
tree state `ab72dba0`), went stale under a code-carrying quick task, `260928-tt9`
(`.planning/workstreams/git-hosts/quick/260928-tt9-fix-url-raw-identity-mismatch-and-duplic/`),
whose commit `add75890` changed `platform/git.ts::listRemotes` — a function this phase's SC2/MA-13
must-have directly depends on — closing WR-11 (T-3-05), a warning-severity finding this phase's own
code review (`03-REVIEW.md`) had left `open`. This round independently re-reads the changed code,
re-runs the affected suites fresh, and re-measures the whole gate at the current tree.

## Scope of what changed since the prior verification (`1facf708`..HEAD)

```
git diff --stat 1facf708..HEAD -- extensions/ tests/ scripts/
 extensions/pi-claude-marketplace/domain/source.ts |  13 +++
 extensions/pi-claude-marketplace/platform/git.ts   |  50 ++++++------
 tests/domain/source.test.ts                        |  50 +++++++++++-
 tests/orchestrators/marketplace/add.test.ts         |  96 +++++++++++++++--------
 tests/platform/git.test.ts                          |  57 ++++++++++++--
 5 files changed, 204 insertions(+), 62 deletions(-)
```

Plus non-code docs: `CHANGELOG.md`, the quick task's own `260928-tt9-PLAN.md`/`-SUMMARY.md`,
`.planning/workstreams/git-hosts/STATE.md`, and (landed by a sibling verifier running in parallel,
confirmed docs-only via `git show --stat`) `02-SECURITY.md`/`03-SECURITY.md`. None of these affect
Phase 3's must-haves.

Read line-by-line, not trusted from the diffstat:

- **`platform/git.ts::listRemotes`** (WR-11 / T-3-05, this phase's own scope): replaced the
  single-value `git.listRemotes({ fs, dir })` read (which isomorphic-git resolves to the *last*
  `url =` line under a `[remote "origin"]` section) with `git.getConfigAll({ fs, dir, path:
  "remote.origin.url" })`, which returns every value across every origin section in file order.
  The function now reports `{ kind: "origin", url }` only when `urls.length === 1 &&
  typeof url === "string"`; zero or two-or-more values report `no-origin`. This closes the exact
  gap the code review flagged: git fetches from the *first* `url =` line, so a hand-authored or
  crafted `.git/config` with two `url` lines used to be silently accepted (and its directory
  removed and replaced) using isomorphic-git's last-value read, even though real git would clone
  from a different (possibly foreign) URL. A side effect, noted honestly in the SUMMARY and
  confirmed by a new test row, is that a capitalized `[Remote "origin"]` section is now recognized
  as git itself reads it (this also resolves the previously-open IN-07 finding, which flagged the
  superseded inline comment).
- **`domain/source.ts::urlObjectSource`** (T-2-10, orthogonal — this is Phase 2 surface: the url
  object-source parser's `raw`-vs-`url` identity gate, MURL-08/MURL-09 territory): now rejects a
  `url`-kind object source as `unknown` when its `raw`'s parse-time identity does not equal `url`'s
  identity (e.g. `raw: "https://host/o/r.git.git"` against `url: "https://host/o/r"`). Read in
  full: this changes only which malformed manifest inputs are admitted as a `url`-kind
  `ParsedSource` at parse time; it does not touch `stripGitSuffix` (confirmed: zero hits for
  `stripGitSuffix` in this diff, and the function's own body is byte-unchanged), and it runs
  strictly *before* `orchestrators/marketplace/add.ts::recognizeLeftover` is ever reached — a
  source that already made it into `recognizeLeftover` was already accepted under the *new*,
  stricter gate, so `stripGitSuffix(remotes.url) !== canonicalCloneUrl(source)`'s comparison
  (`add.ts:725`) is fed the identical `canonicalCloneUrl(source)` value it always was for every
  input that reaches it. `add.ts` itself has a byte-empty diff since `1facf708`, confirming no
  production code in Phase 3's own file changed. The fresh full run of `MA-12: a leftover clone
  whose origin names the same source recovers` (the one test this could plausibly regress) passes
  (see Behavioral Spot-Checks).
- **Test files**: `tests/domain/source.test.ts` (+50 lines, 5 new `URL_OBJECT_GATE_CASES` rows for
  T-2-10, Phase 2 surface), `tests/platform/git.test.ts` (+57 lines, 4 new `ORIGIN_SECTION_SHAPES`
  rows: foreign-first, foreign-second, two-sections, capitalized-`Remote`), and
  `tests/orchestrators/marketplace/add.test.ts` (+96 lines: `arrangeLeftoverWithoutOriginUrl`
  generalized to `arrangeLeftoverWithOriginConfig`, and the single ATTR-07 test replaced by a
  table-driven `LEFTOVER_ORIGIN_CONFIGS` loop covering both the pre-existing url-less case and the
  new two-url WR-11 case).
- **`scripts/check-unused-type-members.contracts.json`**: byte-unchanged (`git diff --quiet
  1facf708..HEAD` on this file exits clean; re-confirmed this session by direct JSON parse: still
  108 entries, zero of which name `platform/git.ts`, so the line-shift inside `git.ts` from the
  `getConfigAll` rewrite created no pin-drift risk).
- **Every other file this phase's must-haves depend on is byte-unchanged since `1facf708`**:
  `orchestrators/marketplace/add.ts`, `orchestrators/marketplace/shared.ts`,
  `orchestrators/auth-host.ts`, `orchestrators/plugin/update-preflight.ts`, `PROJECT.md`,
  `ROADMAP.md`, `.planning/BACKLOG.md`, and every test file in the covered-files list not named
  above — confirmed this session via individual `git diff --name-only 1facf708..HEAD -- <file>`
  checks, all returning empty.

**Conclusion of the scope read:** the only production-code change bearing on this phase's own
scope is the WR-11 fix in `listRemotes`, which is exactly what SC2/MA-13 depends on and which
closes an open, honestly-disclosed gap rather than introducing a new risk. The `domain/source.ts`
change is real but orthogonal (Phase 2's url-source identity gate) and does not alter
`recognizeLeftover`'s comparison for any input that reaches it, confirmed both by direct code
reading and by a fresh passing run of the MA-12 recovery test.

## Goal Achievement

### Observable Truths (ROADMAP Phase 3 Success Criteria, verbatim)

| # | Truth (SC) | Status | Evidence |
|---|------------|--------|----------|
| 1 | SC1 — `marketplace add` succeeds when `sources/<name>/` holds a leftover clone whose `origin` is the source being added; no manual delete needed | ✓ VERIFIED | `orchestrators/marketplace/add.ts` is byte-unchanged since the prior verification (`git diff --name-only 1facf708..HEAD` empty). Fresh, targeted run this session: `✔ MA-12: a leftover clone whose origin names the same source recovers` (291/291 pass across `tests/{platform/git,orchestrators/marketplace/add,domain/source}.test.ts`, 0 fail). |
| 2 | SC2 — a leftover that is not a git clone, is unreadable, or whose `origin` names a different URL still refuses with the MA-6 `{stale clone}` row; recognition never widens into overwriting a directory the extension did not create | ✓ VERIFIED — **gap closed this round** | `listRemotes` changed specifically to close WR-11: it now reads every `remote.origin.url` value via `git.getConfigAll` and reports `origin` only for exactly one string value; a two-url leftover — previously silently recognized and removed via isomorphic-git's last-value read, even though real git fetches from the first — now reports `no-origin` and refuses. Fresh this session: all 9 pre-existing MA-13 refusal-table rows, the ATTR-07 url-less case, the RECON-03 orchestrated case, and the **new** `MA-13 / WR-11: a leftover whose origin section names two urls refuses as stale clone` case all pass (0 fail). `test:coverage:direct` re-measured fresh this session: `platform/git.ts` branches 66/66, functions 16/16, lines 509/509 (100%); `domain/source.ts` branches 191/191, functions 33/33, lines 744/744 (100%); `orchestrators/marketplace/add.ts` branches 142/142, functions 16/16, lines 996/996 (100%). |
| 3 | SC3 — a recognized leftover that cannot be fully removed fails as stale with the cleanup leak appended, and state records no destination for the partially-removed tree | ✓ VERIFIED | `add.ts`'s leak-append path (`joinLeaks`/`appendLeakToError`) is byte-unchanged. Both MA-14 cases pass fresh this session: `✔ MA-14: an unremovable recognized leftover fails as stale, with the leak appended and no recorded destination` and `✔ MA-14 double fault: leftover removal AND staging cleanup both leak; still stale clone through one Error.cause level`. |
| 4 | SC4 — every type member this milestone introduced is read by production code or recorded in the contracts file, and `npm run check` passes whole at the milestone's final HEAD | ✓ VERIFIED (re-measured this round, targeted — see gate note below) | Per the task's explicit instruction, the full `npm run check` was **not** re-run by this verifier (sibling verifiers run in parallel against the same tree). Evidence instead: (a) the quick task's own gate run, captured in scratchpad `check.log`, shows `CHECK_EXIT=0` at the post-`add75890` tree (7396/7396 unit tests pass, `all files \| 100.00 \| 100.00 \| 100.00`, 36/36 integration, `lint:type-members` 4 exceptions, 7/7 negative controls) and `git diff --stat add75890..HEAD -- extensions tests scripts package.json` is empty, confirming no code changed after that gate ran; (b) this verifier independently re-ran, standalone, at the current HEAD: `npx tsc --noEmit` (exit 0), targeted `eslint --max-warnings=0` on the 5 changed files (exit 0), `node scripts/check-unused-type-members.mjs` (same 4 exceptions, "passed"), `node scripts/test-coverage-direct.mjs --base 1facf708` (all 3 changed-pair files at 100% branches/functions/lines), a targeted `node --test` of the 3 affected suites (291/291 pass), and `npx fallow audit --format json --quiet --explain --gate-marker agent` (`verdict: "pass"`, exit 0, `dead_code_issues: 0`, run fresh at the current HEAD `0aeb92d2`, `changed_files_count: 107`). `git status --porcelain` clean throughout. |
| 5 | SC5 — the marketplace autoupdate cascade authenticates rather than cloning authless, on any host | ✓ VERIFIED (carried, regression re-confirmed) | `orchestrators/auth-host.ts` and `orchestrators/plugin/update-preflight.ts` are both byte-unchanged since the prior verification (empty diff `1facf708..HEAD` on both files). No code in this round's diff touches either file. |
| 6 | SC6 — Phase 1's and Phase 2's live canaries are carried forward with reasons/resume commands, never marked passed on link-by-link evidence — now CLOSED against a local stand-in, honestly distinguished from a hosted-forge run | ✓ VERIFIED (carried) | `.planning/BACKLOG.md` and `ROADMAP.md` are both byte-unchanged since `1facf708` (confirmed by empty `git diff --name-only`); the prior round's closure evidence stands unmodified. |
| 7 | SC7 — `PROJECT.md`'s D-79-03 row rationale is amended to match the code; its OUTCOME is untouched | ✓ VERIFIED (carried, regression re-confirmed) | `git diff --name-only 1facf708..HEAD -- PROJECT.md` is empty — unedited since the prior verification confirmed the amendment. |

**Score:** 7/7 truths verified (0 present-but-behavior-unverified)

### Advisory (New Scope, Unevidenced)

None. The only new-scope Step 7 candidate this round's diff could raise is the `domain/source.ts`
T-2-10 change; it was read in full, confirmed non-interfering with any of this phase's must-haves
(see Scope section above), and is itself accompanied by deterministic evidence (5 new passing
test rows, RED-then-GREEN evidence recorded in the quick task's own SUMMARY). Nothing in this
round's own reading of the diff produced an unevidenced finding.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extensions/pi-claude-marketplace/platform/git.ts::listRemotes` | 4-arm discriminated, own fs probe before isomorphic-git, never throws, `origin` arm carries a real string url from exactly one config value (WR-11) | ✓ VERIFIED | Read directly at its current location: body rewritten this round to read `git.getConfigAll({ fs, dir, path: "remote.origin.url" })` and require `urls.length === 1`. 100% direct coverage re-confirmed fresh this session (`test:coverage:direct.mjs --base 1facf708`). |
| `extensions/pi-claude-marketplace/domain/source.ts::urlObjectSource` | Not a Phase 3 artifact — Phase 2 surface (T-2-10); confirmed non-interfering | ✓ VERIFIED (out of scope, confirmed non-interfering) | Read in full; the new raw-vs-url identity gate runs before `recognizeLeftover` and does not change `canonicalCloneUrl`/`stripGitSuffix` behavior for any source that reaches Phase 3's own code. |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts::recognizeLeftover` | recognize-remove-rename branch, single-level leak fold | ✓ VERIFIED | Byte-unchanged since `1facf708` (empty diff). |
| `tests/orchestrators/marketplace/add.test.ts` | end-to-end refusal proof, both modes, through the real adapter, now including the two-url WR-11 case | ✓ VERIFIED | `arrangeLeftoverWithoutOriginUrl` generalized to `arrangeLeftoverWithOriginConfig`; the new `LEFTOVER_ORIGIN_CONFIGS` table drives both the pre-existing url-less case and the new `MA-13 / WR-11` two-url case through the real (non-faked) `listRemotes`. All pass fresh this session. |
| `tests/platform/git.test.ts` | real-repository platform-tier proof of every `origin`-section shape, now including two-url (both orders), duplicate-section, and capitalized-section rows | ✓ VERIFIED | `ORIGIN_SECTION_SHAPES` table grew from 3 to 7 rows this round; each row now also asserts `git.getConfigAll`'s raw output alongside the wrapper result. All 7 rows pass fresh this session. |
| `scripts/check-unused-type-members.contracts.json` | 108 entries, 4 exceptions, unmoved | ✓ VERIFIED | Re-confirmed via direct JSON parse (108 entries, 0 referencing `platform/git.ts`) and a fresh `node scripts/check-unused-type-members.mjs` run this session (identical 4 exceptions). |
| Planning docs (ROADMAP/BACKLOG/PROJECT, SC6/SC7) | carry-forward and amendment preserved | ✓ VERIFIED (carried) | All three byte-unchanged since `1facf708` (empty diffs). |
| `03-REVIEW-DISPOSITION.md` WR-11 entry | tracks the code-review finding this quick task fixes | ⚠️ Stale disposition file, not a phase blocker | Still reads `disposition: open` on disk — the disposition file itself was not updated by the quick task (it is not one of the quick task's `key-files`). This VERIFICATION.md's `re_verification.gaps_closed` records the fix; the disposition file's own staleness is a housekeeping item, not a must-have failure (WR-11 was `warning` severity, non-blocking, and its fix is independently proven by the passing named test above). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| The `.git/config` on disk (every `remote.origin.url` value, in file order) | `platform/git.ts::listRemotes`'s `origin`/`no-origin` arms | `git.getConfigAll` (replacing the single-value `git.listRemotes` read) | ✓ WIRED (rewired this round, WR-11 fix) | Re-confirmed by the fresh 100%-coverage measurement and the fresh pass of all 7 `ORIGIN_SECTION_SHAPES` rows, including the two new two-url rows and the capitalized-section row. |
| `add.ts::recognizeLeftover` | `gitOps.listRemotes(...)` | the sole production caller | ✓ WIRED (carried) | `add.ts` unedited since the prior verification; the caller-side comparison (`stripGitSuffix(remotes.url) !== canonicalCloneUrl(source)`) is unchanged and receives the corrected `no-origin`/`origin` discrimination from the rewritten callee. |
| `tests/orchestrators/marketplace/add.test.ts`'s `LEFTOVER_ORIGIN_CONFIGS` cases (including the new WR-11 row) | the real (non-faked) `platform/git.ts::listRemotes` | `arrangeLeftoverWithOriginConfig`'s `gitOps` spread | ✓ WIRED | Confirmed passing this session; the two-url case reaches the real adapter, not a canned fake value. |
| `domain/source.ts::urlObjectSource`'s new raw/url identity gate | `orchestrators/marketplace/add.ts::recognizeLeftover` | `parsePluginSource` -> `canonicalCloneUrl`/`stripGitSuffix` | ✓ WIRED (confirmed non-interfering) | Traced the full call chain: the gate runs strictly before `recognizeLeftover`, and for every input that passes the gate, `canonicalCloneUrl(source)`'s value is unaffected by this round's change. |

### Data-Flow Trace (Level 4)

Not applicable in the UI-rendering sense (this is a CLI/backend phase, no rendered dynamic values).
The equivalent trace — "does every `remote.origin.url` value on disk actually reach the
removal decision, not a partial or stale read" — is exactly what the WR-11 fix repairs and what the
Key Link table above re-confirms with fresh evidence.

### Behavioral Spot-Checks

Full `npm run check` was **not** re-run by this verifier per the task's explicit instruction
(sibling verifiers run in parallel against the same tree). Evidence is instead the quick task's own
captured gate run (`check.log`, `CHECK_EXIT=0`, matching the current tree per an empty
`add75890..HEAD` code diff) plus this verifier's own fresh, targeted commands:

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| MA-12 recovery still passes | `node --test tests/platform/git.test.ts tests/orchestrators/marketplace/add.test.ts tests/domain/source.test.ts` (this session) | `✔ MA-12: a leftover clone whose origin names the same source recovers` | ✓ PASS |
| All 9 pre-existing MA-13 refusal-table rows + ATTR-07 + RECON-03 still pass | same run | all named, 0 fail | ✓ PASS |
| **New** WR-11 two-url refusal case passes | same run | `✔ MA-13 / WR-11: a leftover whose origin section names two urls refuses as stale clone` | ✓ PASS |
| Both MA-14 leak cases still pass | same run | 2 named lines, 0 fail | ✓ PASS |
| New `ORIGIN_SECTION_SHAPES` rows (foreign-first, foreign-second, two-sections, capitalized) pass | same run | 4 new named lines pass, plus 3 pre-existing rows | ✓ PASS |
| Whole targeted run is green | same run | `tests 291, pass 291, fail 0` | ✓ PASS |
| `platform/git.ts`, `domain/source.ts`, `orchestrators/marketplace/add.ts` hold 100% direct coverage after the changes | `node scripts/test-coverage-direct.mjs --base 1facf708` (this session) | all 3 files: branches/functions/lines at 100% | ✓ PASS |
| `scripts/check-unused-type-members.contracts.json` still holds 108 entries, 4 exceptions | `node scripts/check-unused-type-members.mjs` (this session) | same 4 named exceptions | ✓ PASS |
| `tsc --noEmit` clean on the whole tree | `npx tsc --noEmit` (this session) | exit 0 | ✓ PASS |
| `eslint --max-warnings=0` clean on the 5 changed files | `npx eslint <5 files>` (this session) | exit 0 | ✓ PASS |
| `npx fallow audit` verdict, run standalone by this verifier at current HEAD | `npx fallow audit --format json --quiet --explain --gate-marker agent` | `{"verdict":"pass", exit 0, head_sha:"0aeb92d2"}` | ✓ PASS |
| No debt markers in any of the 5 files this round's code diff touched | `grep -n -E "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` | no matches | ✓ PASS |
| Working tree clean after this verifier's own commands | `git status --porcelain` | empty | ✓ PASS |
| Quick task's own full gate (captured, not re-run) | scratchpad `check.log` | `CHECK_EXIT=0`; 7396/7396 unit; `all files \| 100.00 \| 100.00 \| 100.00`; 36/36 integration | ✓ PASS (captured evidence, code-diff-confirmed current) |

### Probe Execution

SKIPPED (no probes declared for this phase — no `scripts/*/tests/probe-*.sh` referenced by any
PLAN/SUMMARY/VERIFICATION artifact, and this is not a migration/CLI-tooling phase).

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| MA-12 | 03-01, 03-02 (carried) | same-origin leftover recovers | ✓ SATISFIED | Re-run green fresh this session; `add.ts` byte-unchanged since prior verification. |
| MA-13 | 03-01, 03-02, 03-04, 260928-tt9 (this round) | foreign/unreadable/mismatched/url-less/**multi-valued (WR-11)** leftover still refuses | ✓ SATISFIED | All 9 refusal-table shapes, the url-less gap-closure shape, and the **new two-url WR-11 shape** re-run green fresh this session. |
| MA-14 | 03-01, 03-02 (carried) | unremovable leftover fails as stale, no state entry | ✓ SATISFIED | Both cases re-run green fresh this session; leak path byte-unchanged. |
| GATE-01 | 03-03, 03-04, 260928-tt9 (this round) | type members read/pinned; whole-check green, measured fresh on the final tree | ✓ SATISFIED | Quick task's captured gate run: `CHECK_EXIT=0`, 7396/7396 unit, 100/100/100 coverage, 36/36 integration, 108 contracts/4 exceptions — confirmed current via empty `add75890..HEAD` code diff; this verifier's own fresh, targeted re-checks (tsc, eslint, type-members, direct coverage, fallow audit, targeted test run) all pass at the actual current HEAD. |

No orphaned requirements: `grep -n "Phase 3" REQUIREMENTS.md` returns exactly MA-12/MA-13/MA-14/GATE-01,
all four `[x]` and all four present in at least one plan's `requirements:` frontmatter (03-01 through 03-04).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` in any of the 5 files this round's code diff touched (re-scanned this session) | — | — |

**WR-11 — CLOSED this round.** The prior round's carried warning ("a `.git/config` with two
`url =` lines under `[remote "origin"]` is resolved by isomorphic-git's LAST value; canonical git
uses the FIRST — a crafted two-url leftover could therefore be recognized and removed even though
git itself would treat the tree's effective origin as a different, foreign repository") is fixed
by this round's diff: `listRemotes` now refuses (`no-origin`) on any origin with zero or two-plus
`url` values, closing the gap. Proven by the new named test
`MA-13 / WR-11: a leftover whose origin section names two urls refuses as stale clone`
(passing fresh this session) and by direct coverage on the rewritten function (100%). This
disposition is not yet reflected in `03-REVIEW-DISPOSITION.md` on disk (still shows
`disposition: open`) — flagged as a housekeeping item under Required Artifacts above, not a gap.

No new anti-pattern findings surfaced by this round's own review of the intervening diff. IN-07
(the superseded inline-comment framing WR-11's own fix text used to carry) is also resolved as a
side effect — the new paragraph in `listRemotes`'s doc comment no longer uses the flagged framing.
IN-08 and the other carried findings in `03-REVIEW-DISPOSITION.md` are untouched by this round's
diff (no file bearing on them changed) and remain exactly as previously disposed.

### Human Verification Required

None. Every ROADMAP success criterion is either freshly re-measured this round (SC2/MA-13, the
WR-11 fix) or confirmed unchanged by direct diff inspection plus a fresh targeted test/coverage/
lint/audit pass (SC1, SC3, SC5, SC6, SC7), with SC4/GATE-01 evidenced by the quick task's own
captured whole-gate run plus this verifier's own fresh targeted re-checks of every gate component
touched by the diff.

### Gaps Summary

No gaps. The prior round's `passed (7/7)` verdict is re-confirmed at the current HEAD, not merely
re-stated: this round independently read the entire diff between the two verification points
(`1facf708`..HEAD, five production/test files, +204/-62 lines net on the code side), confirmed the
only Phase-3-owned change is the WR-11 fix in `listRemotes` (a genuine, deliberate closure of a
previously-open, honestly-disclosed warning from this phase's own code review), confirmed the
`domain/source.ts` change is Phase 2 surface that does not alter Phase 3's own recognition logic
for any input that reaches it, and re-ran every test/coverage/lint/audit check the diff could
plausibly affect, fresh, at the current tree — all green.

**WR-11 disposition update:** the finding that the prior verification round carried as an open,
non-blocking residual ("a multi-valued `remote.origin.url` is read as its LAST value... a
crafted two-url leftover was accepted and removed") is now **fixed** in the code, proven by a
passing named test. `03-REVIEW-DISPOSITION.md` on disk was not updated by the quick task (it does
not name that file in its `key-files`) and still shows `disposition: open` — this is a stale
housekeeping record, not a re-opened gap; this VERIFICATION.md's own frontmatter
(`re_verification.gaps_closed`) is the authoritative record of the closure for this phase.

---

_Verified: 2026-09-28_
_Verifier: Claude (gsd-verifier)_
