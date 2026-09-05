---
phase: 02-containment-and-input-safety
reviewed: 2026-09-05T23:04:19Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - extensions/pi-claude-marketplace/bridges/mcp/types.ts
  - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
  - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
  - extensions/pi-claude-marketplace/shared/path-safety.ts
  - extensions/pi-claude-marketplace/index.ts
  - tests/bridges/mcp/types.test.ts
  - tests/bridges/mcp/stage.test.ts
  - tests/bridges/mcp/unstage.test.ts
  - tests/shared/path-safety.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/bridges/commands/stage.test.ts
  - tests/persistence/locations.test.ts
  - tests/index.test.ts
findings:
  critical: 2
  warning: 0
  info: 0
  total: 2
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-09-05T23:04:19Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

The malformed-MCP classifier and root discovery catch are correctly placed in the reviewed implementation, and the focused owner suites pass. Two defects still block shipment: the lexical traversal gate is incomplete on Windows, and the new recovery regression depends on Unix permission enforcement that privileged runners bypass.

Verification performed:

- The focused eight-file Phase 02 test command passed.
- All eight direct source-test coverage commands passed at 100% lines, branches, and functions for their selected owner.
- `npm run check` passed typecheck, repository lint, and Fallow, then stopped at formatting solely because Prettier scans the unrelated untracked `.mcp.json`; that user-owned file was not reviewed or modified.

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: Windows forward slashes bypass the lexical traversal guard

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/extensions/pi-claude-marketplace/shared/path-safety.ts:67-68`

**Issue:** `hasLexicalTraversal` splits only on `path.sep`. On Windows, `path.sep` is `\\`, but Node's Windows path implementation also accepts `/` as a separator. A child such as `C:\\root/a/../b` therefore produces no `".."` element from `child.split(path.sep)`, while Windows normalization collapses it to `C:\\root\\b`. The subsequent normalized containment check and component walk accept the path, so the promised raw lexical-traversal refusal is bypassed for a supported path spelling. The new owner regression constructs its child only with `path.sep`, so it cannot catch the alternate-separator case on Windows.

**Fix:** Tokenize both Windows separators when running with Windows path semantics, while continuing to treat backslash as an ordinary filename character on POSIX. Add a Windows regression covering both accepted separator spellings.

```typescript
function hasLexicalTraversal(child: string): boolean {
  const segments = path.sep === "\\" ? child.split(/[\\/]/u) : child.split("/");
  return segments.includes("..");
}
```

The regression matrix should use both `\\` and `/` on Windows and prove that each spelling throws `LexicalTraversalError` before the checked path can be used.

#### CR-02: Recovery test relies on permission bits that privileged runners ignore

**Classification:** BLOCKER
**File:** `/home/acolomba/pi-claude-marketplace-refine-unit-tests/tests/index.test.ts:668-669`

**Issue:** The only trigger for the first-call discovery failure is `chmod(skillPath, 0o000)`. A privileged process (including common root-owned container jobs) can still enumerate and read that directory. Under such a runner the first callback succeeds and the test fails before exercising the fallback, making the Phase 02 gate environment-dependent. Windows ACL behavior also does not guarantee that POSIX mode `000` makes the directory unreadable. This is a test reliability defect in the sole two-invocation recovery proof for PDEF-04.

**Fix:** Drive the aggregation-stage failure through deterministic case-owned input rather than permission enforcement. This suite already has an event proxy that can refuse a selected `cwd` read; use it to refuse the fourth read (inside the aggregation `try`), then invoke the same captured callback with an ordinary event for recovery.

```typescript
const refused = eventRefusingCwdRead(discoverEvent(scope.cwd), CWD_READS_PER_DISCOVER);

const failedDiscovery = await discover(refused.event, ctx);
assert.deepStrictEqual(failedDiscovery, EMPTY_DISCOVERY);
assert.strictEqual(refused.refused(), true);
assert.strictEqual(refused.readCount(), CWD_READS_PER_DISCOVER);

const recoveredDiscovery = await discover(discoverEvent(scope.cwd), ctx);
assert.deepStrictEqual(recoveredDiscovery, expectedDiscovery);
```

Keep the existing exact reconcile/PATH state assertions around both calls so the replacement continues to prove preserved partial state and same-callback recovery.

---

_Reviewed: 2026-09-05T23:04:19Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
