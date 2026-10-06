---
quick_id: 261001-mlt
status: complete
description: Schedule focused task gates and full combined verification
---

# Verification scheduling

Returned to `features/ci-check-efficiency` and committed the policy in
`d9b672b96e9bd36e3284f78baaaf1bca8e9b2a52`. The disposable refactor and its
records remain on `features/build-check-trial`; they were not merged.

The experiment's standalone changed check and commit hook both invoked the
same focused checks. Their similar 198.64-second and 201.34-second timings were
expected: they were measured separately for comparison. Normal work should use
owner tests during edits, then let the required pre-commit run supply the focused
task evidence instead of deliberately invoking the same check twice.

## Changes

The project verification skill now permits ordinary quick tasks, individual plan
tasks, and review fixes to complete with task-wide focused evidence. Their
summaries must identify that scope and state that full phase/PR verification is
pending. An explicit task base remains necessary after committing when earlier
evidence cannot be reused; a clean HEAD comparison does not verify committed
code. Multi-commit tasks must account for the whole task and later changes that
invalidate earlier results.

Full checks remain required at GSD's combined post-merge/phase gates and final
PR/release handoff. Shared inputs and uncertain selection retain the existing
full fallback. Repeated full checks can reuse only valid same-session evidence
over unchanged inputs. The selector's full-completion reminder refers to these
combined/handoff boundaries.

AGENTS.md, CONTRIBUTING.md, and the TypeScript writing, unit-review, and style-
review skills now share that scheduling policy. Reviewers can use applicable
writer or hook evidence instead of automatically repeating broad commands.
No executable script, CI workflow, dependency, GSD configuration, or installed
GSD file changed. The remaining expensive combined-wave gates are intentionally
preserved; this change removes routine per-task full runs.

## Verification

All four edited skills passed skill-creator validation. GSD queries confirmed
that planner, executor, and verifier roles receive the project verification
skill, and `workflow.test_command` remains `npm run check`.

The real changed-file preview selected scope `none` and no build commands for
this documentation-only diff. All required pre-commit hooks passed in 16.94
seconds, including formatting, Markdown checks, security hooks, and the changed
selector. Logs: `/tmp/pi-cm-gate-policy-hooks.log` and
`/tmp/pi-cm-gate-policy-selection.json`.

Policy review covered single-commit ordinary work, committed changes with an
empty HEAD comparison, multi-commit task coverage, shared-input fallback,
combined-tree/handoff gates, and failed or stale results. This was an instruction
review, not a new automated runtime test. No full build was run or claimed for
this documentation-only task.

The pre-commit Fallow audit exited 0 with verdict `warn`, retaining the two
existing CLI duplication groups and reporting no dead-code or complexity
findings. Required hooks and the audit also run before the separate GSD record
commit.

## PR handoff

[PR #234](https://github.com/acolomba/pi-claude-marketplace/pull/234) contains
the four completed optimization quick tasks. There is no active milestone to
audit or close. Both disposable trials remain on their own branches.
Version stays 0.19.2 at the user's request, with an Unreleased changelog entry.

Full verification passed on Node 24.21.0 with `TEST_CONCURRENCY=4` through
`pre-commit run --files CHANGELOG.md .github/workflows/ci.yml .github/workflows/publish.yml`.
All hooks passed, including `npm run check` and
`npm run test:coverage:direct:all`. The run took 1,487.03 seconds and measured
all 251 pairs. The unit LCOV report has 100% line, function, and branch coverage.
The package dry run passed. The Fallow audit exited 0 with verdict `warn`, with
no dead-code or complexity findings and the two previously reviewed clone groups.

The verified tree was committed as
`b8e5594688d9423d76f7530d08b2bfb9a8d12a71`. The hook log is
`/tmp/pi-cm-pr-final-hooks.log`; the retained pre-commit diff is
`/tmp/pi-cm-pr-verified.patch`. This shipping record changes planning Markdown
only, so it reuses the same full evidence and runs the required document hooks.
GitHub workflow results remain pending at this handoff.

## Threat Flags

None -- no security-relevant surface outside the plan's threat model was
introduced. Focused verification is labelled honestly, mandatory hooks and
full fallbacks remain enabled, and combined-tree and handoff checks retain
the full gate. No persistent result cache or hook bypass was added.
