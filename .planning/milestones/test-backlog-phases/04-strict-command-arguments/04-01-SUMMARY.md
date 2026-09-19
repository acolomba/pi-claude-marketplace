---
phase: 04-strict-command-arguments
plan: 01
subsystem: edge
status: complete
requirements-completed: []
completed: 2026-09-14
plan_head_before: 08fe8e65
actuals:
  commits: 1
---

# Strict public arguments

The shared schema now rejects unknown long flags and excess positionals. The
existing tokenizer returns original source spans, so removing a local flag keeps
quoted text intact and leaves an invalid scope value in place for its diagnostic.
Unquoted whitespace uses one shared definition; the prior shared scanner already
accepted tabs. No backslash escape grammar was added.

The registered command matrix covers all 19 canonical verbs and three aliases.
Every case checks the complete notification, an untouched temporary tree, and
strict context/registrar boundaries. The old tests that promised ignored surplus
arguments now require rejection. Existing valid-shape tests remain.

Unifying tokenization made reinstall's second unknown-flag loop unreachable.
Removed that loop and retained every quoted-flag rejection with the canonical
upstream diagnostic and unchanged filesystem/configuration assertions. Bootstrap's
obsolete schema comment was corrected.

Focused parser/public-handler verification: 206 tests passed. Direct owners:
args 98/98 lines, 3/3 functions, 29/29 branches; schema 106/106, 3/3, 22/22;
shared scanner 92/92, 3/3, 15/15; reinstall handler 93/93, 3/3, 21/21.
Typecheck passed. Full phase verification follows the stable integrated run.

Execution scope expanded to the plugin shared owner, reinstall source/owner, and
bootstrap comment because the live shared parser changed their reachable paths.
No test assertion or coverage threshold was relaxed.

## Evidence

Logs: `/tmp/test-backlog-args-public-green.log`,
`/tmp/test-backlog-args-direct.log`, `/tmp/test-backlog-marketplace-green.log`,
`/tmp/test-backlog-marketplace-cascade-green.log`, `/tmp/test-backlog-catalog.log`,
`/tmp/test-backlog-local-direct.log`, `/tmp/test-backlog-local-direct-recheck.log`,
`/tmp/test-backlog-phase34-typecheck.log`.

Committed in `a8ef0dac` with the other coordinated Phase 4 plans. Independent goal verification passed 7/7.

Final verification passed on 2026-09-14: 6,267/6,267 unit tests, 32/32 integration tests, and clean pre-commit checks including lint, typecheck, formatting, Fallow and changed direct pairs. All 227 production LCOV records retain exact coverage: 63,374/63,374 lines, 1,851/1,851 functions and 9,145/9,145 branches. Workflow, correspondence and direct-coverage negative controls also pass. The two unrelated direct shortfall pins remain unchanged.

Evidence: `/tmp/test-backlog-phase34-unit-final.log`, `/tmp/test-backlog-phase34-integration.log`, `/tmp/test-backlog-phase34-precommit-final.log`, and the phase VERIFICATION.md report. Earlier checkpoints above remain historical measurements.

## Review repair

Independent review found that empty quoted arguments disappeared during tokenization. The tokenizer now preserves source spans even when decoded text is empty. Explicit empty/blank optional operands fail instead of becoming a bulk operation. Real registered-command tests cover both quote forms as surplus arguments across all 22 spellings, plus empty scope values on all 21 scope-taking spellings. Reinstall and marketplace update owners verify no operation effects for supplied empty targets. The original review reproduction passed after repair; final combined gates are recorded in verification. Two legacy enable/disable and uninstall cases now assert surplus rejection, full unchanged state, and no runtime-context reads.
