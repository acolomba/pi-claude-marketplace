---
status: all_fixed
phase: 01
fixed_at: 2026-09-14T15:51:05Z
review_path: .planning/phases/01-manifest-read-fidelity/01-REVIEW.md
findings_in_scope: 2
fixed: 2
skipped: 0
iteration: 1
---

# Phase 1: Code Review Fix Report

This pass fixes CR-03 and CR-04 from review commit `e1f60099` under
`critical_warning` scope. Both findings have separate commits. No finding
was skipped. The earlier fix report is retained below as historical evidence;
its counts describe the earlier tree, not the merged revision verified here.

## Fixed issues

### CR-03: Info reads non-file manifest candidates

**Status:** fixed: requires human verification (logic-change reporting rule).
**Commit:** `4053f227`
**Files modified:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`,
`tests/orchestrators/plugin/info.test.ts`,
`tests/architecture/manifest-read-agreement.test.ts`.

Info checks file kind before reading manifest bytes. Non-files, ENOENT and
ENOTDIR permit fallback; other failures stop the walk. The optional
`PluginInfoReader.isRegularFile` capability permits stat-failure injection
while preserving existing two-method readers through the Node stat adapter.
The three readers retain their independent I/O and error contracts.

Real filesystem tests cover a device candidate through `os.devNull`, a
directory candidate and a non-directory wrapper. Each reader selects the bare
manifest in those cases. Direct info tests also cover EACCES, ELOOP and a
non-errno stat failure, with a forbidden bare declaration that would change
the public result if selected.

### CR-04: Unusable-manifest cases mask wrong info fallback

**Status:** fixed.
**Commit:** `b64f0b98`
**Files modified:** `tests/orchestrators/plugin/info.test.ts`,
`tests/architecture/manifest-read-agreement.test.ts`.

Malformed JSON and ELOOP agreement cases now give the forbidden bare sibling
an invalid dependency declaration. Incorrect selection produces an
`invalid manifest` notification before the resolver can mask it. The direct
malformed and non-object manifest cases use the same discriminating setup and
assert complete notification bytes.

An executed negative control changed only `readOwnManifestDependencies` to
continue after unusable or unparseable candidates. All four selected tests
failed: the two architecture cases and the two direct info cases. The
architecture failures retained resolver state `unavailable` and version
`1.0.0`; only info changed to `invalid manifest` with unresolved components.
The committed production file was restored with `git checkout`, verified
byte-identical to HEAD, and all 177 focused tests passed again.

## Coverage measurement prerequisite

**Commit:** `b84d7061`
**File modified:** `scripts/test-coverage-direct.pin.json`.

The required hook found a stale measurement after the earlier command-file
deduplication fix. That fix removed `duplicateFileWarning` and replaced its
warning block with an early Set-based skip: 17 fewer source lines and one
fewer covered branch. The measured totals changed from branches 55/56 and
lines 412/414 to branches 54/55 and lines 395/397.

The uncovered code remains exactly the existing BC-019 narrowing arm around
`CommandNameError`, now at branch 277 and lines 278–279. The deficit remains
one branch and two lines. This refresh changes no coverage allowance and
preserves every other pin entry. Its exact-file hooks and filesystem secret
scan passed before the separate prerequisite commit.

## Verification

All checks ran in the existing linked checkout at
`/home/acolomba/src/pi-claude-marketplace-manifest` on `features/manifest`.
`workflow.use_worktrees=false` was honored; no additional fixer worktree was
created. Git-dependent hooks and the full check ran with authorized access
after the sandbox denied a Git subprocess with EPERM.

- `node --test --test-isolation=none tests/orchestrators/plugin/info.test.ts tests/architecture/manifest-read-agreement.test.ts`: 177 passed, zero failed or skipped, before and after the negative control.
- `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`: 396/396 branches, 79/79 functions and 2831/2831 lines. The final changed-pair hook passed too.
- `npm run check`: exit 0; 6,124 unit tests and 32 integration tests passed, zero failed, cancelled or skipped. TypeScript, ESLint, workflow gates, Fallow, Prettier, corresponding-test gates and their negative controls passed.
- Exact-path pre-commit checks passed for both fixes and the prerequisite. CR-03's initial coverage failure was resolved by the pin repair; its formerly failing hook then passed. CR-04's complete hook run passed.
- `SKIP=trufflehog` was used only under the linked-checkout rule. Equivalent filesystem scans of every committed path found zero verified or unverified secrets.
- Modified sections were reread, and `git diff --check` passed. No production mutation from the negative control remains.

Execution logs: `/tmp/phase1-cr03-targeted.log`,
`/tmp/phase1-info-coverage.log`, `/tmp/phase1-cr03-hooks.log`,
`/tmp/phase1-cr03-coverage-hook.log`, `/tmp/phase1-pin-hooks.log`,
`/tmp/phase1-cr04-negative.log`, `/tmp/phase1-cr04-restored.log`,
`/tmp/phase1-cr04-hooks.log`, `/tmp/phase1-fix-check.log`, and the matching
`/tmp/phase1-*-secrets.log` files. These temporary logs support this run;
the commands and outcomes above remain in the report.

The installed GSD commit helper has a 30-second timeout, shorter than the
required hooks. The parent authorized exact-path Git commits after hooks
passed. No hook was bypassed beyond the documented trufflehog substitution.
This report is intentionally uncommitted for the orchestrator to finalize.
Unrelated configuration, state and sibling-owned review artifacts were preserved.

## Historical review fixes

Scope: CR-01, CR-02, WR-02, WR-03 (length bounds; keep compound ranges),
WR-04 and WR-05. WR-01 was implemented earlier under D-01-35 and is preserved.
Run inline under the Codex skill adapter; no subagents or extra worktrees.

## Workstream repair

GSD detected workstream mode solely because three old workstream directories
remained. All described shipped milestones, not the active v1.20 milestone.
Archived with the supported workstream.complete operation to:

- `.planning/milestones/ws-defaults-enabled-2026-09-14`
- `.planning/milestones/ws-milestone-2026-09-14`
- `.planning/milestones/ws-workflows-detection-2026-09-14`

The 32 tracked files match their original git blobs byte-for-byte.
The contents remain recoverable in those directories. Historical verification
debt remains open. `query init.progress` succeeds in flat mode and reports
v1.20, Phase 1, four executed plans and missing phase verification.

## Execution plan

1. CR-01 and WR-04: deduplicate physical command files and simplify skill-directory tracking.
2. CR-02 and WR-05: classify manifest stat errors and add real cross-reader failure cases.
3. WR-02 and WR-03: validate substituted marketplace names and bound rendered fields.
4. Run negative controls, corresponding direct coverage, full checks and focused re-review.
5. Update review/handoff records. Commit only after required hooks pass; keep
   `.planning/config.json` and unrelated existing changes uncommitted.

## Fix outcomes

| Finding | Outcome | Evidence |
| --- | --- | --- |
| CR-01 | Commands retain the first discovery of each physical file. Distinct-file name collisions still warn. | Direct command tests and the resolver-to-command overlap test |
| CR-02 | Missing paths, non-directory parents and non-file candidates permit fallback. Other stat failures stop the walk without escaping the resolver. | Resolver errno tests and real filesystem agreement tests |
| WR-02 | The caller-supplied marketplace passes the same token rule as declared marketplace names. Failure rejects the entire declaration. | `info` test with an invalid declaring marketplace and mixed explicit/implicit dependencies |
| WR-03 | Names and marketplaces allow at most 256 characters. Version text allows 64. SHA text retains its 7–40 hexadecimal bound. | Maximum-length and over-limit cases for all four fields |
| WR-04 | Skill directory membership uses a Set. Each path resolves once per discovery attempt. | Direct skill tests, including parent-first discovery of the same skill |
| WR-05 | Three readers use the same tree for malformed JSON, a non-directory wrapper and a stat-blocking symlink loop. | Seven agreement tests through public entry points |

WR-03 retains compound ranges with spaces and pipes, as the operator required.
The bounds are a local display safeguard, not a claim about upstream length limits.
WR-01 retains the upstream rejection policy from quick task `260914-aer`.

## Test evidence

The earlier negative controls reproduced command double-installation, reader
disagreement, invalid marketplace substitution and acceptance of oversized fields.
The new tests fail against those earlier implementations and pass with the fixes.
The agreement tests use real files without injected reader dependencies.
A symlink loop supplies a stat failure without root-user or Windows permission skips.
The resolver also has direct EACCES, ELOOP and non-errno failure cases.

All eight affected source modules pass standalone direct coverage:

| Module | Branches | Functions and lines |
| --- | --- | --- |
| commands/discover | 57/57 | 100% |
| skills/discover | 36/36 | 100% |
| domain/dependencies | 40/40 | 100% |
| domain/manifest | 24/24 | 100% |
| domain/manifest-path | 100% | 100% |
| domain/resolver | 280/280 | 100% |
| plugin/info | 383/383 | 100% |
| plugin/shared | 176/176 | 100% |

`npm run check` passed with 5,408 unit tests and 31 integration tests.
No tests failed or skipped. TypeScript, ESLint, Fallow, Prettier and the
corresponding-test checks passed, including their negative controls.
The required pre-commit hooks passed for the code, archive and planning files.
The filesystem secret scan found zero verified or unverified secrets.
Only the linked-worktree `trufflehog` hook used its documented substitute.

## Commits

| Commit | Scope |
| --- | --- |
| `092f30cd` | Archive the three stale workstreams without content changes |
| `b6e67d61` | CR-01 command file deduplication and overlap regression tests |
| `1d872fa9` | WR-04 skill directory Set and parent-first regression test |
| `de4a9424` | CR-02, WR-02, WR-03, WR-05 and the earlier WR-01 implementation |

The dependency parser and its consumers share a changed result contract.
Those coupled fixes share one commit to keep that contract consistent.
The command and skill fixes have separate commits.
The final documentation commit contains this report and the current handoff.

## Focused re-review

The TypeScript style and unit-testing skills guided this pass.
No test-only export, coverage exclusion or skipped test supports these fixes.
The new token helper serves both the parser and the production display boundary.
The common manifest policy lives beside MANIFEST_CANDIDATES.
The readers retain their separate error results under D-01-06.
The changes preserve installed records, healthy marketplace entries and raw disk bytes.

The Fallow duplicate-code report does not fail the configured gate.
The full command continued past that report. This pass does not suppress clone
groups or alter duplication thresholds.

## Remaining work

Phase verification remains open. `$gsd-execute-phase 1` resumes at those gates
without rerunning the four plans with summaries. ROADMAP criterion 3 still
requires human judgment about real-plugin evidence versus fixture evidence.
The original Info findings remain outside this pass. IN-03's comment correction
already accompanies WR-01. Versioning and CHANGELOG work remain pre-PR tasks.

The user-approved `.mcp.json` formatting changes whitespace only.
That file, GSD configuration and unrelated changes remain uncommitted.
