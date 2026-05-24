---
status: issues_found
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 99
phase: 14-drift-guard-test-alignment
findings:
  critical: 1
  warning: 8
  info: 4
  total: 13
---

# Phase 14: Code Review Report

**Reviewed:** 2026-05-24
**Depth:** standard
**Files Reviewed:** 99
**Status:** issues_found

## Summary

Phase 14 lands a 34-rule ESLint drift-guard plugin (16 meta-assertion + 18 full-impl rules), a YAML frontmatter loader, and three architectural parity tests; it also migrates production code for CMC-16 (manual-recovery anchor wiring in `reinstall.ts`), CMC-34 (notifyUsageError migration in edge handlers), and refactors `transaction/rollback.ts` to orchestrator-owns-rendering. The bulk of the change is well-disciplined infrastructure with sensible defensive logic.

The review surfaces 1 Critical finding (a hard scope-ordering drift in `orchestrators/plugin/reinstall.ts` that contradicts both its own JSDoc and the locked MSG-GR-3 policy), 8 Warnings (rule regex over-reach, comment/code contradictions, misleading reason narrowing, code-spec inconsistencies, brittle test wiring), and 4 Info items. No security vulnerabilities or data-loss risks were detected. The lint plugin's full-impl rules are well-targeted but several use heuristic identifier-name matching (`/successSummary|cascadeSuccess|okSummary/i`) that is essentially convention-dependent and will silently miss any callsite the author chose a different name for.

## Critical

### CR-01: Bulk reinstall ordering contradicts locked MSG-GR-3 policy (user-first instead of project-first)

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts:706-708`

**Issue:** `scopeOrder` returns `user → 0, project → 1`, ordering user-before-project. The shared comparator `presentation/sort.ts::compareByNameThenScope` enforces the locked MSG-GR-3 contract **"project before user"** (returns `-1` for project, `+1` for user when name ties). The JSDoc at `reinstall.ts:455-457` explicitly claims this code uses MSG-GR-3 semantics: *"Order marketplace blocks by scope (project before user **per compareByNameThenScope**) then marketplace name."* — but the implementation orders user-first, exercising a different policy than the one cited.

Both call sites are affected:
- `sortReinstallTargets` (line 388-395): bulk-reinstall outcome iteration order
- `renderReinstallPartitionAndNotify` (line 457-464): per-marketplace cascade block ordering

The user-visible output of `/claude:plugin reinstall` therefore disagrees with `/claude:plugin list` and `/claude:plugin marketplace list` (both use compareByNameThenScope), creating an inconsistent per-scope ordering across surfaces despite §1 of the messaging style guide promising a single ordering policy.

The current test fixture at `tests/orchestrators/plugin/reinstall.test.ts:984-988` codifies the wrong order (user before project) so the bug is "tested-in" — a refactor to use `compareByNameThenScope` would have to update that fixture.

**Fix:** Replace the local `scopeOrder` helper with the canonical comparator and update the test fixture to match the project-first policy. If user-first ordering is actually intentional, update the JSDoc to delete the false "per compareByNameThenScope" claim and explain why this surface deviates.

## Warning

### WR-01: `setMarketplaceAutoupdate` comment misstates iteration order

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts:114, 174-178`

**Issue:** Line 114 sets `scopes = ["user", "project"]` (user-first). The block comment at lines 174-178 claims: *"project enumerated before user when both are iterated -- the outer `scopes` loop order"*. The comment is factually wrong: the outer loop enumerates user, then project. Same-name entries across scopes therefore tie-break user-first (because the sort comparator at line 178 sorts only by name and `Array.prototype.sort` is stable in V8). Together with CR-01 this suggests the orchestrator family was once expected to invert the iteration order but the change never landed.

**Fix:** Either change scopes to `["project", "user"]` to match the doc + MSG-GR-3, or rewrite the comment to acknowledge that this surface uses user-first ordering.

### WR-02: `narrowCascadeFailure` maps permission errors to `"not in manifest"` reason

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts:149-172`

**Issue:** When `cascadeUnstagePlugin` fails with `EACCES` or `"permission denied"`, the helper returns the Reason `"not in manifest"`. The inline comment even acknowledges the mismatch: *"No closed-set Reason for permission errors today -- map to the most general failure reason."* User sees `⊘ <plugin> [<scope>] (failed) {not in manifest}` when the actual failure is a file-permission error — operator cannot distinguish a missing manifest entry from a file-permission rejection.

**Fix:** Either (a) add a closed-set Reason like `"permission denied"` to `shared/grammar/reasons.ts` (drift test will enforce parity), or (b) map permission errors to `"unreadable"` (already in REASONS) which is semantically closer than `"not in manifest"`.

### WR-03: `msg-cc-1-cause-chain` regex catches false-positives in `else if` chains

**File:** `tests/lint-rules/msg-cc-1-cause-chain.js:24`

**Issue:** `CAUSE_PREFIX_RE = /\bcause:\s/i` matches any string literal containing the substring `cause: ` (case-insensitive). Any future caller that writes (e.g.) a unit-test fixture string `"Probable cause: stale state"` in extension code will trip the rule with a false-positive.

**Fix:** Anchor the regex to the start of the string (`/^cause:\s/i`) so it only matches the trailer-style prefix.

### WR-04: `msg-rh-1-reload-hint` regex matches `/reload` followed by any character

**File:** `tests/lint-rules/msg-rh-1-reload-hint.js:25`

**Issue:** `RELOAD_HINT_RE = /\/reload(?:\s+to\b)?/` will future-falsely-trip on any extension code that contains literals like `"see /reload-help.md"`, `"/reload-quickly"`, or even legitimate prose mentioning `/reload-foo`.

**Fix:** Add a word boundary: `/\/reload\b/`.

### WR-05: `msg-sr-4-cascade-success` / `msg-sr-5-cascade-warning` rely on convention-only identifier names

**File:** `tests/lint-rules/msg-sr-4-cascade-success.js:46`, `tests/lint-rules/msg-sr-5-cascade-warning.js:41`

**Issue:** Both rules detect cascade-summary routing via identifier-name heuristics: `/(?:successSummary|cascadeSuccess|okSummary)/i` and `/(?:warningSummary|cascadeWarning|partialSummary)/i`. The orchestrators reviewed (`reinstall.ts:471-478`, `remove.ts:342`) all destructure `{ message, severity } = cascadeSummary(...)` and the destructured `message` identifier does NOT match the hard-coded heuristic set — so the rule will not catch real drift on the current codebase, only the planted RuleTester fixtures.

**Fix:** Either document the limit in the rule's `meta.docs` or widen detection by tracking variable bindings from `cascadeSummary` calls within the same function.

### WR-06: `msg-sr-6-no-cascade-error` does not detect destructured cascade routing

**File:** `tests/lint-rules/msg-sr-6-no-cascade-error.js:29`

**Issue:** Same root cause as WR-05. A destructured `const { message } = cascadeSummary(...)` followed by `notifyError(ctx, message)` is NOT detected because `message` doesn't match the cascade name pattern.

**Fix:** Either widen the identifier name patterns or note in `meta.docs` that the rule catches the direct-call pattern only.

### WR-07: `parseStyleGuideFrontmatter` reads arbitrary keys from `unknown` YAML output

**File:** `tests/lint-rules/lib/frontmatter.js:58-72`

**Issue:** `parseYaml(match[1])` returns `unknown`. The code does `parsed[key]` directly with only a `typeof !== "object"` guard (which permits Arrays). The loader is the binding contract for the entire drift-guard suite and benefits from strict validation.

**Fix:** Use `Object.hasOwn(parsed, key)` and assert `Array.isArray(value) && value.every(x => typeof x === "string")`.

### WR-08: `msg-nc-2-usage-separator` and `msg-sr-7-usage-error-routing` traverse non-`+` BinaryExpressions

**File:** `tests/lint-rules/msg-nc-2-usage-separator.js:71`, `tests/lint-rules/msg-sr-7-usage-error-routing.js:41`

**Issue:** Both helpers recurse through `BinaryExpression` without checking `operator === "+"`. A future `notifyError(ctx, msg === USAGE)` callsite could false-positive depending on literal text composition. Today no such callsite exists, so it's latent.

**Fix:** Constrain recursion to string-concatenation: `if (node.type === "BinaryExpression" && node.operator === "+")`.

## Info

### IN-01: `findManualRecoveryError` depth-bound test asserts unreachable at depth 5

**File:** `tests/orchestrators/plugin/reinstall.test.ts:1250-1263` (and `reinstall.ts:1122-1137`)

**Issue:** The depth-5 walker visits depths 0..4 (loop condition `depth < 5`). The MRE at "depth 5 from l0" is unreachable, exactly as the test asserts. But the JSDoc says *"stop at 5 hops"* — slightly imprecise; the walker stops AT 5 visits (4 hops).

**Fix:** Reword the JSDoc to "stop after 5 visits (4 hops)".

### IN-02: `expandTildePath` only handles `~` and `~/` prefixes, not `~user/`

**File:** `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts:305-311`

**Issue:** Shell tilde expansion supports `~user/path`; `expandTildePath` only handles `~` and `~/...`. A user typing `~alice/repo` will hit `stat("~alice/repo")` → ENOENT.

**Fix:** Add a one-line note that `~user/` is unsupported, or use `os.userInfo()` and parse the prefix.

### IN-03: `msg-sd-2-soft-dep-predicate` regex matches `requires pi-mcpx`

**File:** `tests/lint-rules/msg-sd-2-soft-dep-predicate.js:28`

**Issue:** `PREDICATE_RE = /requires pi-(?:subagents|mcp)/` matches `"requires pi-mcpx-adapter"` (no `\b` after `mcp`).

**Fix:** Add a word boundary: `/requires pi-(?:subagents|mcp)\b/`.

### IN-04: `composeRollbackPartialChildren` blindly trusts caller-provided `phase` field

**File:** `extensions/pi-claude-marketplace/presentation/rollback-partial.ts:100-106`

**Issue:** The composer interpolates `p.phase` into the output line. The structural contract on `RollbackPartialInput.phase` is just `readonly phase: string` with no character restrictions; any future caller could break the catalog form silently by passing `]` or newline characters.

**Fix:** Either narrow the type to a closed literal-union or add an assertion in the composer.

---

## Next Steps

Run `/gsd:code-review 14 --fix` to auto-apply fixes (Critical + Warning by default). CR-01 in particular warrants attention before milestone close — it's a contract violation against locked MSG-GR-3 policy.

The 1 Critical is a real correctness issue (user-visible output ordering disagrees with rest of codebase). The 8 Warnings are mostly defensive hardening (regex over-reach, comment drift, missing closed-set Reason). The 4 Info items are documentation precision and latent fragility.
