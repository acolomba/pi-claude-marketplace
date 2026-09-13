---
audit_acknowledged:
  milestone: refine-unit-tests
  at: 2026-09-13
  status: unknown
---

# Quick Task 260907-qqo: PowerShell `if`-field rule prefix Summary

**Upstream's `PowerShell(<command-glob>)` permission-rule prefix now compiles and fires on Pi `powershell` events — with alias canonicalization on both sides, case-insensitive matching, a PowerShell-native compound splitter, and a tool-name guard that stops `Bash(...)` and `PowerShell(...)` rules cross-firing.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- A `PowerShell(Get-ChildItem *)` rule fires on a `powershell` event for `Get-ChildItem`, `gci`, `ls`, and `dir`, in any casing, and does not fire on `Remove-Item`.
- Alias canonicalization runs on BOTH sides — the rule's head at compile time (`compilePowerShellRule`) and the runtime head at match time (`powerShellSubcommandFires`) — which is what makes the alias-to-canonical and canonical-to-alias directions both work.
- Closed a latent cross-fire: `Bash(...)` and `PowerShell(...)` both read `input.command`, so both arms now check `event.toolName` against their own `piEvents` set first. Before this, a `Bash(git *)` rule would have fired on a `powershell` event carrying `git status`.
- The PowerShell parser encodes the three language facts that separate it from `bash.ts`: a backtick escapes rather than substitutes, a doubled quote escapes rather than closes, and a bare `&` is the call operator rather than a separator.
- The full gate is green end to end, and all three touched modules reach 100% direct line, branch, and function coverage.

## Task Commits

1. **Task 1: Fire a PowerShell rule end-to-end, and stop Bash rules cross-firing** — `e901432b` (feat)
2. **Task 2: Pin the PowerShell truth tables to complete direct coverage** — `ed0bf623` (test)
3. **Task 3: Correct the compatibility doc and run the full gate** — `ae06d27f` (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/bridges/hooks/if-field/powershell.ts` — new: the verbatim upstream alias table, the head canonicalizer, `compilePowerShellRule`, the escape-aware quote cursor and compound splitter, `$(...)` recursion, and `powerShellSubcommandFires`.
- `extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts` — added `CompiledPowerShellGlob` and `compilePowerShellGlob`; extracted `normalizeCommandPattern` and `matchCommandGlob` as the shared parts both command-glob compilers call.
- `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts` — sixth `IfPredicate` arm, the `PowerShell` compile branch, `piEvents` on the `bash` arm, and the shared `commandArmFires` dispatch body.
- `extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts` — the `PowerShell` row in its locked position.
- `tests/bridges/hooks/if-field/powershell.test.ts` — new: 29 cases across the three exported entrypoints.
- `tests/bridges/hooks/if-field/glob.test.ts` — a `compilePowerShellGlob` describe block.
- `tests/bridges/hooks/if-field/index.test.ts` — the sixth arm's type evidence, compile row, dispatch row, cross-fire table, compile-throw fall-open, and recursion-cap fail-open.
- `tests/domain/components/hook-if-targets.test.ts` — the `PowerShell` row and the extended key-order tuple.
- `docs/hooks-compatibility.md` — `PowerShell(...)` moved to a supported row, the `powershell` tool-name row, the PowerShell mechanic rows, and the per-shell split of the interpolation fail-open row.

## Decisions Made

- **`CompiledPowerShellGlob` stays its own exported interface.** The plan authorized collapsing it to `export type CompiledPowerShellGlob = CompiledBashGlob` IF fallow `dupes` flagged the two declarations as a clone. It did not — a full `npm run fallow` run (real exit code 0, verified without a pipe) reported no clone group naming `glob.ts`, `powershell.ts`, or `index.ts` — so the primary choice held and no `ignoredClones` entry was added.
- **The alias table lives in `powershell.ts`.** `glob.ts` stays a language-agnostic matching engine; the only language-specific thing it gained is the case fold and a PowerShell command-name-only regex.
- **`separatorEnd` returns an index rather than a `{start, end}` record.** The Bash sibling's `SeparatorMatch` interface would have been a near-identical second declaration; returning `-1`-or-index says the same thing in less surface.
- **The compile-throw fall-open technique transferred.** The Bash precedent's `String.prototype.endsWith` mock works unchanged for the PowerShell branch, so no unreachable input had to be invented and no coverage shortfall needed recording.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extracted the shared command-arm dispatch body**

- **Found during:** Task 1
- **Issue:** Adding the `powershell` arm to `ifFires` as a sibling block (as the plan's action text described) pushed the function to cognitive complexity 25, tripping `sonarjs/cognitive-complexity: 15`. `npm run lint` failed, blocking the task commit.
- **Fix:** Extracted the guard/extract/parse/match sequence both command arms share into a `commandArmFires(arm, event)` helper taking a `CommandArm` collaborator record (`piEvents`, `shell` label, `parse`, `fires`). Each arm is now a single call. This also removes what would have been a near-identical 20-line duplicate between the two arms.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts`
- **Verification:** `npm run lint` clean; `index.ts` direct coverage 100% (branches 73/73, functions 13/13).
- **Committed in:** `e901432b` (Task 1 commit)

**2. [Rule 1 - Bug] Corrected stale comments the change falsified**

- **Found during:** Tasks 1 and 3
- **Issue:** Beyond the counts and lists the plan enumerated, three more places described code that no longer stands: `matchTokens`'s doc comment pointed at `matchBashGlob` (renamed to `matchCommandGlob`), `extractToolName`'s comment claimed only the `path-tool` arm checks `piEvents` membership, and the doc's "Silent fall-open" bullet plus its `$(...)`-backticks row asserted backtick uncertainty as a general `if`-field fact — untrue on the PowerShell path, where a backtick is an escape.
- **Fix:** Restated each as a present-tense fact about the current code, and split the doc's interpolation row per shell.
- **Files modified:** `extensions/pi-claude-marketplace/bridges/hooks/if-field/glob.ts`, `extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts`, `docs/hooks-compatibility.md`
- **Verification:** Comment-policy grep for planning refs and narration of removed code is clean; `npm run check` green.
- **Committed in:** `e901432b` and `ae06d27f`

**3. [Rule 2 - Missing Critical] Added a `Cd(...)` fall-open row to the partition test**

- **Found during:** Task 2
- **Issue:** The doc now claims `Cd(...)` specifically still falls open, but no test pinned that — the existing `Grep(src/**)` row covers the same branch without naming `Cd`.
- **Fix:** Added a `Cd(/tmp)` row to the unknown-prefix partition table so the documented claim has a test that fails if `Cd` is ever added to the supported set.
- **Files modified:** `tests/bridges/hooks/if-field/index.test.ts`
- **Verification:** Suite green; the doc row and the test row now say the same thing.
- **Committed in:** `ed0bf623`

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 missing critical)
**Impact on plan:** All three were necessary — one to pass the lint gate, one to satisfy the comment policy, one to back a documented claim with a test. No scope creep; the plan's out-of-scope list (version bump, `process.platform`, pwsh subprocess, new deps, `Cd`/`WebFetch`/`Agent` support) was respected.

## Issues Encountered

- **TruffleHog's pre-commit hook cannot run in this worktree.** `.git` is a file here (`gitdir: .../worktrees/pi-claude-marketplace-powershell`), so the hook's git-mode scan aborts on `.git/index: not a directory`. This is the structural failure CLAUDE.md documents. Each commit was preceded by the sanctioned filesystem scan over exactly the paths being committed, with the stricter `--results=verified,unknown --fail`; all three scans reported `verified_secrets: 0, unverified_secrets: 0` and exit 0. Commits used `SKIP=trufflehog` and no other skip.
- **A piped `npm run fallow | tail` reported exit 0 while fallow's own status was unread.** Caught before acting on it; re-run redirected to a file with the real exit code captured (`FALLOW_EXIT=0`). Every gate result recorded here comes from an unpiped run.
- **Prettier reformatted two test files.** Detected by `format:check` before committing, applied with `prettier --write`, and re-verified — not left for a hook to rewrite mid-commit.

## Verification

`npm run check` green end to end (`CHECK_EXIT=0`): typecheck, lint, all three fallow sub-gates, `format:check`, `test:corresponding`, `test:corresponding:negative`, `test:coverage:direct:negative`, 5276 unit tests, 31 integration tests — 0 failures.

Direct coverage, complete with no shortfall and no coverage exception:

| Module | Branches | Functions | Lines |
| --- | --- | --- | --- |
| `if-field/powershell.ts` | 79/79 | 13/13 | 513/513 |
| `if-field/glob.ts` | 88/88 | 15/15 | 559/559 |
| `if-field/index.ts` | 73/73 | 13/13 | 538/538 |

`tests/architecture/hooks-if-field.test.ts` and `tests/bridges/hooks/dispatch.test.ts` pass unedited, as the plan predicted. No `process.platform` read exists on any touched path.

## Known Stubs

None. The scan for hardcoded empty values, placeholder text, and unwired data sources across the created and modified files found nothing.

## Threat Flags

None. The plan's threat register (`T-qqo-01` through `T-qqo-05`) is fully addressed: the depth cap is pinned at its exact boundary, no regex is compiled from user input, the cross-fire mitigation is pinned in both directions, and the alias table was transcribed verbatim and reviewed against the captured artifact. No new network endpoint, auth path, file access, or schema surface was introduced.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The `if`-field prefix set is now `Bash | PowerShell | Read | Edit | Write`. `Cd(...)`, `WebFetch(...)`, `Agent(...)`, parameter matching, and tool-name wildcards still fall open, unchanged and still documented as such.
- The `commandArmFires` seam is the place any third command-bearing prefix would attach.
- No version bump, `CHANGELOG.md`, or `sonar-project.properties` update was made — deliberately out of scope, so those remain to do before a release.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/bridges/hooks/if-field/powershell.ts` — FOUND
- `tests/bridges/hooks/if-field/powershell.test.ts` — FOUND
- Commit `e901432b` — FOUND
- Commit `ed0bf623` — FOUND
- Commit `ae06d27f` — FOUND
- Commit count measured from the ledger: `git rev-list --count 3d6498de..HEAD` = 3, matching the `actuals.commits` field
- No file deletions across the three commits

---

*Quick task: 260907-qqo*
*Completed: 2026-09-07*
