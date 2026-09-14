---
status: all_fixed
phase: 01
findings_in_scope: 6
fixed: 6
skipped: 0
iteration: 1
---

# Review fixes

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
