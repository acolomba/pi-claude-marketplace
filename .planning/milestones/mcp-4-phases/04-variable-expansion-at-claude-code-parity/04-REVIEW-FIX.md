---
phase: 04-variable-expansion-at-claude-code-parity
fixed_at: 2026-10-07T22:30:00Z
review_path: .planning/phases/04-variable-expansion-at-claude-code-parity/04-REVIEW.md
iteration: 2
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-10-07T22:30:00Z
**Source review:** .planning/phases/04-variable-expansion-at-claude-code-parity/04-REVIEW.md
**Iteration:** 2 (this report covers the whole loop: iteration 1 fixed WR-01..WR-06, iteration 2 fixed WR-07)

**Summary:**

- Findings in scope: 7 across both iterations (WR-01..WR-06 in iteration 1, WR-07 in iteration 2). Fix scope is `critical_warning`, so IN-01, IN-02, IN-04, IN-05 and IN-06 are out of scope.
- Fixed: 7
- Skipped: 0

**Where verification ran:** in the main checkout of `features/mcp-4`, with no worktree, as the orchestrator directed. Each commit passed its `npm-check` pre-commit hook (`npm run check:commit`). The WR-07 commit stages test support (`tests/bridges/mcp/expansion-cases.ts`), so its hook ran direct coverage for all source-test pairs. The AVAR conformance tests ran against the real pi-mcp-adapter 5.1.0 at `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter` (52/52 pass, 0 skipped). For WR-07, I also ran the MCP bridge, MCP integration, `claude-mcp-variables`, and plugin/reconcile/import orchestrator suites with the adapter root set (3299/3299 pass), and `npm run typecheck`. The full `npm run check` did not run. The orchestrator runs it after the fix loop.

## Fixed Issues

### WR-07: A kept reference whose runtime value ends in a partial trigger lets plugin text after it pull a withheld credential into a remote header (iteration 2)

**Files modified:** `extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts`, `tests/bridges/mcp/adapter-escape.test.ts`, `tests/bridges/mcp/expansion-cases.ts`, `tests/integration/adapter-expansion-conformance.test.ts`, `docs/mcp-compatibility.md`
**Commit:** 77625e0f
**Applied fix:** This is the operator's choice, made on 2026-10-07: option 1 of the review, a split token after a kept reference. `serializeSegments` now writes `{env:PI_CLAUDE_MARKETPLACE_EMPTY}` in front of the literal run after a kept `${NAME}` when that run matches `MARKER_COMPLETION = /^(?:[\w}]|:\w)/`.

**How I derived the condition:** I read the real 5.1.0 `dist/utils.js`. Pass 1 (`/\$\{(\w+)\}/g`) inserts the value and never reads it again. Passes 2 (`/\$env:(\w+)/g`) and 3 (`/\{env:(\w+)\}/g`) read the joined text. A pass-2 or pass-3 match that crosses from the value into the following text continues there with one of `e`, `n`, `v`, `:`, a name character (`\w`), or `}`, and a `:` in it is always followed by `\w`.

The reviewer's suggested `/^(?:(?:e?n)?v)?:/` covers only `env:`, `nv:`, `v:` and `:`. It misses two real leaks:
- A value that ends in `$env:` or `{env:`, followed by plugin text that starts with a name. For example, `PI_CM_P=p{env:` with `${PI_CM_P}ANTHROPIC_API_KEY}` leaked the key.
- A value that ends in `{env:NAME`, followed by `}`.

It also guarded `:/` and a bare `:`, which can never complete a marker.

The token cannot be read into a crossing match. It starts with `{`, which is not a pass-2 continuation character. In pass 3 it can only open its own match, and pass 3 replaces it with `""` without reading its output again.

**Which common values gain a token:** `${HOST}:8080` (a `:` before a digit) and `${NAME}_x` / `${NAME}abc`. Values that are unchanged: `Bearer ${TOKEN}`, `https://${HOST}/mcp`, `${A}-${B}`, `${HOST}.example`, `${USER}:${PASSWORD}`, and a reference at the end of a field. Three existing guarded rows also gain a second token: `{env${R}:…}`, `$en${R}v:…`, and the AVAR-05 `{env${R}:ANTHROPIC_API_KEY}` row. The changed written values change the adapter definition hash of such entries (D-04-04). The phase has not shipped, so no existing entry carries the old form.

**Proof through the real adapter:**
- **Shared table:** `expansion-cases.ts` gains 6 rows: the reviewer's probe `${PSX}env:ANTHROPIC_API_KEY` with `PSX=abc$`, which now outputs `abc$env:ANTHROPIC_API_KEY`; a `url` with `p$env` + `:NAME`; `p{env:` + `NAME}`; `{env:NAME` + `}`; and the `:8080` (token) and `/mcp` (no token) common cases.
- **AVAR-05 credential sweep:** the sweep gains the forms `${PI_CM_DOLLAR}env:NAME` (`p$`) and `${PI_CM_BRACE}NAME}` (`p{env:`), for 120 runs. Against the old escape, all 8 deny-listed names leaked through both forms in `url` and `headers`, in both install states. With the fix, nothing leaks.
- **New bounded-exhaustive property:** 11 value tails (`$`, `$e`, `$en`, `$env`, `$env:`, `{`, `{e`, `{en`, `{env`, `{env:`, `{env:K`) times every sequence of up to 3 tokens from `env:`, `nv:`, `v:`, `:`, `K`, `}`, `$`, `{`, `/`, `${R}` after `${R}`. That is 12,210 checks of the adapter's `interpolateEnvVars` output against Claude's output. The old escape had mismatches, such as `${R}env:env:` with `R=$`. The fix has none.
- **Unit goldens:** `adapter-escape.test.ts` gains 9 guarded completions, 8 unguarded followers, `${A}:${B}`, a merged run after a reference, both-side guarding, and a field that starts with a name character.

The existing alphabet property (462,790 values) still passes.

**Docs:** `docs/mcp-compatibility.md` describes both guards and names the common values that do and do not gain the token. The run-time-value divergence item now also covers two references whose values join (`${A}:${B}` with `A` ending in `$env`). That is the remaining residual: every character in it comes from the user's environment, and none comes from plugin text.
**Status:** fixed: requires human verification (escape logic). The orchestrator owns the 04-SECURITY.md update.

### WR-01: The `CLAUDE_PROJECT_DIR` export guard misses a cwd that ends with a partial trigger (iteration 1)

**Files modified:** `extensions/pi-claude-marketplace/shared/session-env.ts`, `extensions/pi-claude-marketplace/index.ts`, `tests/shared/session-env.test.ts`, `tests/integration/adapter-expansion-conformance.test.ts`, `docs/mcp-compatibility.md`
**Commit:** 31a7ae35
**Applied fix:** `applyMcpAdapterEnv` also refuses a cwd that ends in `$`, `{`, `$e`, `$en`, `$env`, `{e`, `{en` or `{env` (`PARTIAL_MARKER_TAIL = /[${](?:e(?:nv?)?)?$/`), as well as one that holds `$env:` or `{env:`. A conformance test runs the real session export and `resolveCommandSecret` for each of the 8 tails. The general form of this join, after any kept reference, was the iteration-1 residual. WR-07 now closes it at the escape level. The cwd guard stays because it is still correct and still pinned.

### WR-02: The leading-`~` classifier misses a leading reference that expands to empty (iteration 1)

**Files modified:** `docs/mcp-compatibility.md`
**Commit:** 44640cce
**Applied fix:** I chose the reviewer's second option: keep the divergence and document all three forms (`${X:-}~/a`, `${MISSING}~/a`, `${OTEL_X}~/a`). The classifier is unchanged. The iteration-2 review accepted this. Note from the reviewer: the AR-04-03 / T-04-13 register in `04-SECURITY.md` names only the first form and a runtime `~/` value.
**Status:** fixed: requires human verification.

### WR-03: Variable notices are emitted for entries that a rollback or a disabled landing removed (iteration 1)

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts`, `extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts`, `tests/orchestrators/marketplace/shared.test.ts`, `tests/orchestrators/plugin/install-cascade.test.ts`, `tests/orchestrators/plugin/install-disable-cascade.test.ts`, `tests/orchestrators/plugin/install-flow.test.ts`, `tests/orchestrators/plugin/enable-disable.test.ts`, `docs/output-catalog.md`
**Commit:** 2c2166c6
**Applied fix:** `foldUnstageNotices` drops the `variables-missing` and `credentials-blanked` notices of servers that the unstage removed, matched by `(scope, generated server key)`. It is called from the install-cascade member undo, the enable-cascade undo, and the install-flow disabled landing. The iteration-2 review confirmed the fix and found no other path in this class.
**Status:** fixed: requires human verification (notice-routing logic).

### WR-04: "Not set" guidance is wrong for a deny-listed plain-field name (iteration 1)

**Files modified:** `extensions/pi-claude-marketplace/shared/notification-dispatch.ts`, `docs/output-catalog.md`, `tests/shared/notification-dispatch.test.ts`, `tests/integration/mcp-variable-expansion.test.ts`, `tests/orchestrators/import/execute.test.ts`, `tests/orchestrators/reconcile/apply.test.ts`
**Commit:** 27acffbc
**Applied fix:** This is a closed-catalog amendment. The line now says "uses environment variables that were not set at install". It no longer promises a runtime read.
**Status:** fixed: requires human verification (closed-catalog wording).

### WR-05: Skipping the `CLAUDE_PROJECT_DIR` export leaves a stale or inherited value in place (iteration 1)

**Files modified:** `extensions/pi-claude-marketplace/shared/session-env.ts`, `extensions/pi-claude-marketplace/index.ts`, `tests/shared/session-env.test.ts`, `tests/index.test.ts`, `docs/mcp-compatibility.md`
**Commit:** 3c0d5a7c
**Applied fix:** The skip path deletes `CLAUDE_PROJECT_DIR` from `process.env`. The throwing-cwd case that is still open is IN-06, which is out of scope.

### WR-06: The reserved empty variable is not reset when the cwd read throws (iteration 1)

**Files modified:** `extensions/pi-claude-marketplace/shared/session-env.ts`, `extensions/pi-claude-marketplace/index.ts`, `tests/shared/session-env.test.ts`, `tests/index.test.ts`, `tests/integration/adapter-expansion-conformance.test.ts`
**Commit:** 45ed0fea
**Applied fix:** `applyMcpAdapterEnv(readCwd)` sets `PI_CLAUDE_MARKETPLACE_EMPTY` to `""` before it calls the reader. A throw still propagates to `index.ts`, which debug-logs it (NFR-2).

---

_Fixed: 2026-10-07T22:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
