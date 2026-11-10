---
phase: 02-async-hooks
reviewed: 2026-11-08
depth: standard
status: clean (after one fix)
mode: inline (the orchestrator, following .claude/agents/gsd-code-reviewer.md; P2-DC-19)
files_reviewed:
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/registry.ts
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/rewake-text.ts
  - extensions/pi-claude-marketplace/bridges/hooks/async-rewake/async-answer.ts
  - extensions/pi-claude-marketplace/bridges/hooks/runtime.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch-exec.ts
  - extensions/pi-claude-marketplace/bridges/hooks/dispatch.ts
  - extensions/pi-claude-marketplace/bridges/hooks/settle.ts
  - extensions/pi-claude-marketplace/bridges/hooks/event-router.ts
  - extensions/pi-claude-marketplace/bridges/hooks/timeout.ts
  - features/step_definitions/hook/async.steps.ts
findings:
  critical: 0
  warning: 1 (fixed)
  info: 4
---

# Phase 2 Code Review

Reviewed the product and step diff of the phase (commits 7d753478, f565af80, 5c2ab122, 23c2786e) for correctness, error containment, security, and project rules. No critical or warning finding.

## Warning (fixed)

- **WR-01 (event-router.ts, session_start wrapper).** The project reap ran after the hydrate's try/catch, so a context the hydrate could not read (no `cwd`, no trust record) reached `reapProjectOrphans` with an undefined directory; with no trust recorded, `isProjectTrusted(undefined)` read true and `locationsFor` threw, which skipped the SessionStart dispatch. Found by the phase gate (`test/integration/hooks-dispatch-end-to-end.test.ts` HOOK-E2E-04). Fixed in e2839ec3 by moving the reap inside the hydrate's try.

## Info

- **IN-01 (registry.ts, `wakeOnExitTwo`).** `runtime.recordRewake()` runs before `pi.sendMessage`; if the send throws, the Stop flag stays set until the user's next input although no turn was woken. Harmless: the flag only changes the next Stop payload's `stop_hook_active`, and a failed send is already debug-logged. Left as is.
- **IN-02 (registry.ts, plain lane).** A plain async child ended by a signal or the timeout ladder still has its collected stdout read for an answer. Upstream behavior for that case was not checked (02-02 SUMMARY dubious choice). Left as is.
- **IN-03 (event-router.ts, `reapProjectOrphans`).** Runs on every `session_start`, so a new session in a live Pi stops the earlier session's project-scope async hooks (P2-DC-11, BACKLOG question ASYNCNEWSESSION-01). The owned-row skip protects the current load's own children.
- **IN-04 (dispatch.ts).** `collectBucketOutcomes` and the composite fold now hold the same one-line `runHooks(... executor(...))` call; fallow dupes does not flag it, and merging them would reshape a shared function.

Security: hook stdout and stderr reach only the model as `display: false` custom messages, as upstream; the answer parser wraps every `JSON.parse` in try/catch; the project reap runs only for a trusted project and kills only processes whose `/proc/<pid>/environ` holds the recorded dispatch marker.
