---
quick_id: 261001-jwu
status: complete
description: Optimize local checks and GSD verification
---

# Faster local checks and GSD verification

Implemented in `462f3f249790aa86669f834452e4ebdce6d56fdc` on
`features/ci-check-efficiency`. No production behavior or dependencies changed.

TypeScript uses its incremental cache, and Prettier uses its content cache.
The module, architecture, and analyzer suites have separate commands; a discovery
test verifies that they partition the complete unit suite without omissions or
overlap. Full typed ESLint remains uncached.

`check:changed` includes staged, unstaged, renamed, deleted, and untracked paths,
with an optional base and preview mode. Paired edits select their direct coverage
and transitive production consumers, including re-exports and type imports.
Shared support, configuration, tooling, missing pairs, removals, and uncertain
imports broaden to the full check and all-pair coverage. E2E test edits also run
the pinned E2E command. Global Fallow remains in focused feedback.

Local npm hooks now use that selector. CI skips the replacement hook because its
existing full check and direct-coverage jobs own those checks. Obsolete assertions
about removed hooks and their orphaned reader were removed. The separate Sonar
workflow remains intact.

The project verification skill is assigned to GSD planner, executor, debugger,
code-fixer, and verifier roles. It requests focused task checks, full completion
verification, and reuse only of same-session evidence for exactly unchanged
inputs. GSD's full-check timeout is 2,400 seconds. No installed GSD internals,
persistent success cache, or custom capability plugin was added.

## Verification

The full pre-commit run over all implementation files exited 0 on Node 24.21.0
with `TEST_CONCURRENCY=4`. Its changed-check hook selected and passed the complete
`npm run check`, followed by `npm run test:coverage:direct:all`. This verifies
type checking, full lint, workflow and pairing controls, changed-selector
controls, Fallow, formatting, 7,441 unit tests with 100% aggregate line/branch/
function coverage, 36 integration tests, member analysis and its controls, and
all 251 direct-coverage pairs against the existing coverage policy and pins.

The entire hook run took 1,415.65 seconds (23.6 minutes); all-pair coverage took
132.2 seconds. The log is `/tmp/pi-cm-local-full-hooks.log`. The exact tracked
diff and untracked implementation contents were retained under
`/tmp/pi-cm-local-verified-inputs` and compared unchanged before committing.
The implementation commit is the verified reference. Subsequent changes record
these results in planning Markdown and correct the skill's example git pathspec
to exclude root-level planning Markdown as well as nested files. The corrected
command was exercised against this diff. Executable inputs remain unchanged;
the final documentation hooks verify these prose-only changes.

Cold incremental type checking took 39.73 seconds, and the warm run took 8.23
seconds. A temporary type-error probe was rejected in 8.4 seconds; the check
passed after the probe was removed. Warm full formatting took 6.61 seconds.
A real focused run, selecting `tests/domain/name.test.ts` through the planner
and runner, passed in 29.45 seconds. A source-edit preview for `domain/name.ts`
selected 129 consumer tests. These are local measurements, not CI timings.

Temporary-repository controls verified transitive and cyclic imports, type-only
references, literal and computed dynamic imports, missing owners, broad fallback,
staged/worktree differences, renames, deletions, untracked spaces/newlines,
explicit bases, git failures, and subprocess exit/signal propagation. A real
multi-path direct-coverage run passed and deduplicated source/owner inputs.
Skill validation, GSD skill injection, and the configured timeout also passed.

The pre-commit Fallow audit exited 0 with verdict `warn`: no dead-code or
complexity findings, one inherited duplicate, and one new eight-line CLI error
handler duplicate. The ordinary full Fallow gate passed. The short CLI wrapper
was retained rather than introducing a helper solely to remove this warning.

## Limitations

Focused checks are feedback, not completion evidence. Full architecture,
integration, typed lint, and member checks remain mandatory at completion.
Unknown inputs intentionally take the expensive full path. GSD evidence reuse
is a project instruction with exact-input requirements, not an automatic cache.
No GitHub workflow run, push, or PR was performed in this task.

## Threat Flags

None -- no security-relevant surface outside the plan's threat model was
introduced. Commands use argument arrays, git paths remain NUL-delimited,
selection uncertainty broadens checks, and failed or signaled children stop
execution. Security hooks and global completion gates remain enabled.
