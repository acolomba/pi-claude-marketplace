---
phase: 06-live-mcp-status-in-info
reviewed: 2026-10-09T00:00:00Z
depth: standard
iteration: 2
files_reviewed: 4
files_reviewed_list:
  - extensions/pi-claude-marketplace/platform/mcp-status.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts
  - tests/platform/mcp-status.test.ts
  - tests/orchestrators/plugin/info-mcp-status.test.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
---

# Phase 6: Code Review Report (iteration 2)

**Reviewed:** 2026-10-09
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found (Info only)

## Narrative Findings (AI reviewer)

## Summary

This is a narrow re-review of the WR-01 seam: fix commit 03a4104e and the four
files it touched. The working tree has no changes to these files since that
commit.

**WR-01 is resolved.** `readSnapshot` (`platform/mcp-status.ts:79-96`) now
reads each server's `name` and `status` once into `unknown` locals after the
validator check. It checks each copy with `typeof` and stores only the copy.
A value that is not a string voids the whole snapshot. The `typeof` check does
not call `toString`, so the object from the iteration-1 reproduction (or one
whose `toString` throws) cannot reach `Object.hasOwn` or the token table. The
new tests replay the iteration-1 attack (a status or name that becomes an
object, and a status whose second read throws) and expect `"no-snapshot"`.
According to the fix report, the object cases fail on the pre-fix source.

**Checked the fix for new defects on the same seam. None found:**

- **Legitimate adapter payloads.** A plain-data snapshot returns the same
  strings on the second read. So no valid payload is rejected. A frozen
  payload with extra fields at the top level and in each server reads
  `cached` (scratch probe). Extra fields still pass, because `Type.Object` is
  not closed.
- **Empty-list / shutdown rule.** The rule changed from
  `payload.servers.length === 0` to `statuses.size === 0`. For an array that
  passed the check, the two are the same. Duplicate names make the map
  smaller, but a non-empty list always gives at least one entry. Probes:
  `{version:1, servers:[]}` reads `no-snapshot`. A later duplicate with an
  unknown status reads `unrecognized`, so the "later entry wins" rule still
  holds. The existing empty-list and shutdown cases (test file lines 139 and
  179) pass.
- **A getter on `servers` itself.** The code still reads `servers` again after
  the check. The typebox `Check` reads it more than once as well: a probe whose
  second read returned an iterable made the check itself fail. But every value
  a later read can return either throws inside the handler's `try` (`5`,
  `[null]`) or goes through the per-field `typeof` check. Probes that swap
  `servers` after the first read to `5`, `[null]`, `[1]`, `"ab"`, `[]`,
  `[{status:{}}]`, or a custom iterable all read `no-snapshot`. A swap to
  other well-formed strings reads that status (`failed`). The emitter could
  publish that same payload directly, so this is not wrong behavior. Only
  strings reach the map, so the closed-set contract holds.
- **`statusToken`.** The new `Object.hasOwn` check only adds a fallback. For
  the seven known statuses the output is the same as before.

Both paired test files pass (72/72, with a temporary HOME,
PI_CODING_AGENT_DIR and TMPDIR).

## Info

### IN-01: `statusToken`'s own-key fallback guards an input that the types and the only reader both rule out

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info-mcp-status.ts:55-59`; `tests/orchestrators/plugin/info-mcp-status.test.ts:391-406`
**Issue:** After the earlier checks, `answer` is already narrowed to
`McpServerRuntimeStatus`. The only production reader returns a known status
only after `isRuntimeStatus`, which also uses `Object.hasOwn`. So the new
`"status unknown"` branch runs only when a reader breaks its type. The tests
can reach it only through `answer as McpServerRuntimeStatus`. This is defense
in depth. The project guideline "no error handling for impossible scenarios"
argues against it. It has no effect on behavior.
**Fix:** Optional. Keep it as a deliberate seam guard (its comment already
says so), or revert to `return RUNTIME_STATUS_TOKENS[answer];` and drop the
three cast-based tests. The reader-side guard in `mcp-status.ts` is the real
WR-01 fix.

### IN-02: The ASTAT-02 comment says "each field is read once after the check", but `servers` is read again

**File:** `extensions/pi-claude-marketplace/platform/mcp-status.ts:75-78, 85`
**Issue:** `name` and `status` are read once. `payload.servers` is read again
by the `for…of` after the validator has already read it. This is safe: every
element is checked with `typeof`, and a throw is caught. But a later reader
could take the comment to mean that the whole payload is read once.
**Fix:** Optional wording change, for example: "Each server's `name` and
`status` is read once after the check, and each copy is checked again, so
whatever a later read of `servers` returns, only strings are stored."

---

_Reviewed: 2026-10-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
