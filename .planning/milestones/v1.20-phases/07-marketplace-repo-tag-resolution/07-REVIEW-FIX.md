---
phase: 07-marketplace-repo-tag-resolution
fixed_at: 2026-09-19T23:39:01Z
review_path: .planning/phases/07-marketplace-repo-tag-resolution/07-REVIEW.md
iteration: 3
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 07: Code Review Fix Report

**Fixed at:** 2026-09-19T23:39:01Z
**Source review:** .planning/phases/07-marketplace-repo-tag-resolution/07-REVIEW.md
**Iteration:** 3

**Summary:**

- Findings in scope: 4 (all Warning; iteration 3 reported 0 Critical, so `fix_scope: critical_warning` covered all in-scope findings)
- Fixed: 4
- Skipped: 0

All 4 warnings were test-quality / comment-policy defects, not behavior bugs. Iterations 1-2's
underlying logic (WR-01 through WR-06 in earlier iterations, plus CR-01/CR-02) was independently
confirmed correct by this iteration's review and is unchanged here.

**Isolation:** fixes were made in a dedicated git worktree
(`.claude/worktrees/rf-07-1490637-1789859792`, branch `gsd-reviewfix/07-1490637`) per the
transactional worktree protocol, then fast-forwarded onto `features/manifest` and torn down
cleanly (worktree removed, temp branch deleted, recovery sentinel removed). The isolated worktree
has no `node_modules` (gitignored, as usual for a freshly created worktree), so a temporary
`node_modules` symlink into the main checkout was used ONLY to run `node --test` against the
touched files as a verification step before each commit, then removed before cleanup — no fixture
or dependency file was added to any commit.

## Fixed Issues

### WR-01: GSD plan references and removed-code narration in `install-cascade.test.ts`

**Files modified:** `tests/orchestrators/plugin/install-cascade.test.ts`
**Commit:** `187194cd`
**Applied fix:** Rewrote the three flagged comment blocks (lines ~1312, ~1444-1447, ~1596-1598) to
state present-tense facts about the current code, per `skills/typescript-comments/SKILL.md`:
dropped the archived `07-01` plan reference and the "supersedes the interim ... behaviour" /
"no longer a member of this loop" removed-code narration. Kept the durable decision anchor
`D-07-07`.

### WR-02: pre-fix narration comment in `install-flow.test.ts`

**Files modified:** `tests/orchestrators/plugin/install-flow.test.ts`
**Commit:** `2ea45451`
**Applied fix:** Rewrote the arrange comment at ~lines 3076-3081 to drop the "Before this fix,
`installPlugin` had no seam ... no fixture-free unit test could answer this constraint at all"
narration and state only the current fact: the `marketplaceTagProbe` seam is what lets the case
answer the constraint.

### WR-03: weakened whole-memo assertion in both tag-probe test files

**Files modified:** `tests/orchestrators/plugin/dependency-tag-probe.test.ts`,
`tests/orchestrators/plugin/marketplace-tag-probe.test.ts`
**Commit:** `f96ff52b`
**Applied fix:** Restored `assert.deepStrictEqual([...tagMemo], [])` in both files' "a failed
listing is never memoized" cases, replacing the single-key
`assert.strictEqual(tagMemo.has(url), false)` that passed an implementation memoizing the failure
under any other key. Verified `PLUGIN_REPO_URL` / `MARKETPLACE_ROOT` remain used elsewhere in each
file (no orphaned import).

### WR-04: message-substring error assertion and unproven leak annotation in `clone-cache.test.ts`

**Files modified:** `tests/orchestrators/plugin/clone-cache.test.ts`
**Commit:** `bfb7956a`
**Applied fix:**
1. Switched the staging-leak case's rejection predicate from
   `err instanceof Error && err.message.includes("ENOENT")` to the file's established
   `{ code: "ENOENT" }` structured-field form (matching lines 440, 478, 655, 1124).
2. Added a new case, `"materializeMarketplaceTagClone: a checkout failure that also fails to
   clean up staging carries the leak annotation (MA-9)"`, which denies write permission on the
   staging directory's parent (via `chmod`, the same real-filesystem technique already used in
   `tests/orchestrators/plugin/fetch.test.ts`) so `cleanupStaging`'s own `rm` fails, forcing
   `appendLeakToError`'s wrapping branch instead of its pass-through branch, and asserts the
   rejected message carries the `(additionally: failed to clean up marketplace tag clone staging
   at ...: EACCES...)` suffix and that `.cause` is the original checkout error.

   This closes the gap the review named precisely: on the existing case alone (cleanup succeeds,
   leak undefined), `appendLeakToError(err, undefined)` returns `err` unchanged, so a fix that
   "moved the cp inside the try but forgot appendLeakToError" would be behaviorally
   indistinguishable and the existing case could not have caught it. The new case can only pass
   when the wrap actually executes.

   **Negative-control proof (not committed, run and reverted before committing):** temporarily
   changed the production catch block in
   `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts` from
   `throw appendLeakToError(err, leak)` to `throw err` (dropping the leak annotation), re-ran
   `node --test tests/orchestrators/plugin/clone-cache.test.ts`: exactly the new case failed
   (`'checkout failed'` did not match the `(additionally: ...)` pattern), all 61 other cases
   stayed green. Restored the production file via `git diff --stat` verifying zero remaining
   delta, then re-ran the full file to confirm 62/62 green again before committing.

## Skipped Issues

None — all 4 in-scope findings were fixed.

## Verification performed

Run in the main checkout (`/home/acolomba/src/pi-claude-marketplace-manifest`, branch
`features/manifest`) after the worktree fast-forward, since the isolated fix worktree had no
`node_modules` to run the project's gates:

| Command | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0 |
| `npx eslint <all .ts changed 371d8269..HEAD>` | exit 0 |
| `npx prettier --check <all files changed 371d8269..HEAD>` | "All matched files use Prettier code style!", exit 0 |
| `npm test` | **6,722 pass / 0 fail** (331 suites), exit 0 (up from 6,721 — the new WR-04 case) |
| `npm run test:coverage:direct` | exit 0 — "3 pinned shortfall(s) matched ... exactly" (unchanged from iteration 3's review) |
| `npm run test:integration` | 36 pass / 0 fail, exit 0 |
| `npm run test:corresponding` | "Corresponding-test gate passed.", exit 0 |
| `npx fallow dead-code` | exit 0, "No issues found" |
| `npx fallow dupes` | exit 0 (1,148 pre-existing lines / 42 files, unchanged; none in touched files) |
| `npx fallow health` | exit 0, "0 above threshold", maintainability 91.7 (unchanged) |

Also ran the four touched test files directly (`install-cascade.test.ts`, `install-flow.test.ts`,
`dependency-tag-probe.test.ts`, `marketplace-tag-probe.test.ts`, `clone-cache.test.ts`) both inside
the isolated fix worktree (via a temporary `node_modules` symlink, removed before cleanup) and
again in the main checkout after fast-forward — all green in both locations.

## Iteration-3 closure ledger

| Iteration 3 finding | Status |
| --- | --- |
| WR-01 — stale `07-01` plan refs / removed-code narration in `install-cascade.test.ts` | **fixed**, `187194cd` |
| WR-02 — `Before this fix, ...` narration in `install-flow.test.ts` | **fixed**, `2ea45451` |
| WR-03 — weakened whole-memo assertion in both tag-probe test files | **fixed**, `f96ff52b` |
| WR-04 — message-substring assertion + unproven leak annotation in `clone-cache.test.ts` | **fixed**, `bfb7956a` |
| IN-01 through IN-06 | out of `critical_warning` fix scope; left for a future pass |

---

_Fixed: 2026-09-19T23:39:01Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
