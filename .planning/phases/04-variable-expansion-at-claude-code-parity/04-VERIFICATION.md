---
phase: 04-variable-expansion-at-claude-code-parity
verified: 2026-10-07T23:10:00Z
status: passed
score: 5/5 must-haves verified
covered_files:
  - ".github/workflows/ci.yml"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-01-PLAN.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-01-SUMMARY.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-02-PLAN.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-02-SUMMARY.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-03-PLAN.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-03-SUMMARY.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-04-PLAN.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-04-SUMMARY.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-05-PLAN.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-05-SUMMARY.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-06-PLAN.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-06-SUMMARY.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-07-PLAN.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-07-SUMMARY.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-08-PLAN.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-08-SUMMARY.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-09-PLAN.md"
  - ".planning/phases/04-variable-expansion-at-claude-code-parity/04-09-SUMMARY.md"
  - "README.es.md"
  - "README.md"
  - "docs/mcp-compatibility.md"
  - "docs/output-catalog.md"
  - "extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/stage.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/substitute.ts"
  - "extensions/pi-claude-marketplace/bridges/mcp/types.ts"
  - "extensions/pi-claude-marketplace/domain/claude-credential-denylist.ts"
  - "extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts"
  - "extensions/pi-claude-marketplace/domain/mcp-server-features.ts"
  - "extensions/pi-claude-marketplace/domain/resolver-types.ts"
  - "extensions/pi-claude-marketplace/index.ts"
  - "extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-cascade.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-disable-cascade.ts"
  - "extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts"
  - "extensions/pi-claude-marketplace/shared/notification-dispatch.ts"
  - "extensions/pi-claude-marketplace/shared/notification-grammar.ts"
  - "extensions/pi-claude-marketplace/shared/notification-types.ts"
  - "extensions/pi-claude-marketplace/shared/session-env.ts"
  - "package-lock.json"
  - "package.json"
  - "tests/bridges/mcp/adapter-escape.test.ts"
  - "tests/integration/adapter-expansion-conformance.test.ts"
  - "tests/integration/mcp-variable-expansion.test.ts"
covered_digest: "v3:sha256:b54877a6f6eb85a34b77d59c53e972d8892e6fc0e278a389b0760e4544ae40ff"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Read the wording of the `variables-missing` notice (`MCP server variables not set.`) and the `credentials-blanked` notice (`MCP server credentials withheld.`) as rendered in docs/output-catalog.md blocks `mcp-variables-missing` and `mcp-credentials-blanked`"
    expected: "Operator accepts the closed-catalog drafts, or edits the catalog block and the renderer together (the notice gate keeps them byte-equal)"
    why_human: "User-facing message clarity is a judgment call. The bytes are pinned by a gate, so a wording change is cheap now and a breaking catalog change later"
  - test: "Read the `info` `mcp:` line state `plugin:<plugin>:<server> (unset A, B; withheld C)` in the catalog"
    expected: "Operator accepts the line shape and the words `unset` and `withheld`"
    why_human: "Same reason: draft wording in a closed catalog"
  - test: "Review the `# zizmor: ignore[adhoc-packages]` suppression on the CI step that runs `npm install ... pi-mcp-adapter@5.1.0 --ignore-scripts --omit=peer` (.github/workflows/ci.yml line 121)"
    expected: "Operator accepts a suppressed supply-chain lint on an exact-version, no-scripts, out-of-repo install, or asks for another route (a vendored fixture, a lock file)"
    why_human: "Accepting a suppressed CI security finding is a policy decision. The package itself was approved at the 04-08 checkpoint"
  - test: "Review two as-found behaviors that 04-09 recorded in tests rather than designed: the `enable` row severity when a plugin carries unset variables or withheld credentials, and the `import` row shape that carries the two warnings"
    expected: "Operator confirms both match the intended tri-state severity model and the import grammar, or files a follow-up"
    why_human: "Tests pin the current behavior; whether it is the right behavior is a design judgment, not a code defect"
---

# Phase 4: Variable expansion at Claude Code parity Verification Report

**Phase Goal:** Plugin MCP entries expand variables by Claude Code's rules, write no environment value to disk, and cannot be turned into an unintended shell command or a credential leak by the adapter's own second expansion.
**Verified:** 2026-10-07T23:10:00Z
**Status:** human_needed
**Re-verification:** No, initial verification

Starting hypothesis was that the goal was missed. Every roadmap criterion was checked against code and a live probe, not against the SUMMARY files. No gap was found. The status is `human_needed` only because four operator-review items on user-facing wording and a CI suppression are still open. They are not defects.

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` and, in project scope, `${CLAUDE_PROJECT_DIR}` expand at install in Claude's five fields only (AVAR-01) | VERIFIED | `bridges/mcp/substitute.ts` `writtenField` expands `command`, `args[]`, `env` values, `url`, `headers` values only. `oauth` goes through `serializeLiteral`, keys and other fields pass unchanged, and the `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` env values are literal. Live probe: `${CLAUDE_PLUGIN_ROOT}/bin/x` gave `/p/root/bin/x`, `--a=${CLAUDE_PROJECT_DIR}` gave `--a=/proj`, `${CLAUDE_PLUGIN_DATA}` in a url gave `/p/data`. User scope keeps the reference (`claude-mcp-variables.ts` `segmentFor`). `applyMcpAdapterEnv` sets `CLAUDE_PROJECT_DIR` in Pi's process at load (`index.ts:70`) and on each `session_start` (`index.ts:225`). `integration/mcp-variable-expansion.test.ts` runs the project-scope case through the real install. |
| 2 | `${VAR:-default}` resolves at install with Claude's rule (empty counts as set); plain `${VAR}` stays for the adapter; no resolved environment value reaches a written entry, fixture or test output (AVAR-02) | VERIFIED | `expandClaudeValue` returns segments that hold names only. A set variable stays a `ref`, and only an unset one with a default becomes text. Live probe with `SET=SECRETVAL`, `ANTHROPIC_API_KEY=sk-SENTINEL`, `EMPTY=""`: output holds `${SET}`, `${EMPTY}`, `dflt` for the unset default, and neither sentinel appears. The install-level integration test asserts the same on the written `mcp-adapter.json` and on every notification. |
| 3 | A leading `!` in a value the adapter would run is written `!!`; adapter-only syntax is escaped; a conformance test runs every case through the pinned adapter's real functions; MENVX-01 and ENVLIT-01 closed (AVAR-03) | VERIFIED | `adapter-escape.ts` `serializeSegments` doubles a leading `!` for `env` and `headers` (probe: `!cmd ${SET}` gave `!!cmd ${SET}`, and `CLAUDE_PLUGIN_ROOT: "!x"` gave `!!x`). Literal `$env:`, `{env:` and `${NAME}` get the `{env:PI_CLAUDE_MARKETPLACE_EMPTY}` split token (probe confirmed). Boundary guards cover a partial trigger before a kept reference and plugin text after one (WR-07, commit 77625e0f). Leading `~` in `command`/`args` makes the plugin `partially-available` with `{unsupported mcp}` (`mcp-server-features.ts`; `mcp-home-path-partial.test.ts` passes). Conformance run by me: `PI_MCP_ADAPTER_ROOT=/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter`, 52 pass, 0 skip, 0 fail; with `PI_MCP_ADAPTER_ROOT=/nonexistent` the run exits 1. CI installs `pi-mcp-adapter@5.1.0 --ignore-scripts` (ci.yml:121). BACKLOG.md heads for MENVX-01 (line 2495) and ENVLIT-01 (line 1706) carry `CLOSED`. |
| 4 | A referenced variable that is unset with no default produces a missing-variable warning at install (AVAR-04) | VERIFIED | Probe report: `missing: ["UNSET"]` while `${UNSET2:-dflt}` and set variables are not listed. `stage.ts` builds `variables-missing` notices per server, and `notifyMcpConfigNotices` renders them after the rows. Callers wired: install-flow, update-flow, reinstall-flow, enable-disable, import/execute, reconcile/apply. The integration test covers install, update, reinstall and enable. `import/execute.test.ts:1997` and `reconcile/apply.test.ts:6206` cover import and `/reload`. WR-03 fix: `orchestrators/marketplace/shared.ts:366-387` drops these notices for a server that a rollback removed. |
| 5 | A `url`/`headers` value that references `ANTHROPIC_API_KEY` or another deny-listed variable does not receive the credential, with a security test (AVAR-05) | VERIFIED | `isDenied` in `claude-mcp-variables.ts` uses the remote-sink set (275 names), name patterns and the base-URL credential rule. `deniedSegment` always writes `""` for a remote field, even with a default. Probe: `Bearer ${ANTHROPIC_API_KEY}` gave `Bearer `, `https://h/${ANTHROPIC_API_KEY:-d}/...` gave `https://h/` plus `/`, and the report lists `blanked: ["ANTHROPIC_API_KEY"]`. `ANTHROPIC_API_KEY` in a stdio env value stays `${ANTHROPIC_API_KEY}`, which matches Claude 2.1.291. Snapshot digests are pinned. The conformance suite feeds sentinels through the adapter's real `resolveCommandSecret` and `resolveServerUrl` and finds none in the output. `mcp-variable-expansion.test.ts:117` is the install-level security test. |

**Score:** 5/5 roadmap truths verified. 0 present but behavior-unverified.

Plan-level truths from the nine PLAN files were also spot-checked and hold. Examples: the stdio env injected is exactly `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` and declared keys (probe); a cwd with `$env:`/`{env:` or a partial tail is not exported and any prior `CLAUDE_PROJECT_DIR` is removed (`session-env.ts:111-121`); the reserved empty variable is set before the cwd read (WR-06); the peer range is `>=5.1.0 <6` (`package.json:61`).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `domain/claude-mcp-variables.ts` (315 lines) | Claude's rule and the scan used by `info` | VERIFIED | Substantive and wired from `substitute.ts` and `orchestrators/plugin/info.ts` |
| `domain/claude-credential-denylist.ts` (631 lines) | Version-pinned deny-list | VERIFIED | Imported by the variable rule |
| `bridges/mcp/adapter-escape.ts` | Adapter encoding | VERIFIED | Imported by `substitute.ts`; exercised by the real adapter in the conformance test |
| `bridges/mcp/substitute.ts`, `adapter-entry.ts`, `stage.ts` | Field walk, entry builder, notices | VERIFIED | Chain `stage.ts` to `adapter-entry.ts` (line 106) to `substitute.ts`. The env comes from `process.env` at `stage.ts:380` |
| `shared/session-env.ts`, `index.ts` | Process-level variables | VERIFIED | `applyMcpAdapterEnvFrom` is called at load and on `session_start` |
| `domain/mcp-server-features.ts` | Leading `~` partial classifier | VERIFIED | Called by `mcp-resolution.ts:40` |
| `shared/notification-dispatch.ts` and related | Two notice kinds | VERIFIED | Kinds and renderers present; catalog blocks `mcp-variables-missing` and `mcp-credentials-blanked` in `docs/output-catalog.md` |
| `tests/integration/adapter-expansion-conformance.test.ts` | Real-adapter proof | VERIFIED | 52 pass, 0 skip |
| `docs/mcp-compatibility.md`, READMEs | Documentation | VERIFIED | Present with the variable rules and residuals (14 matches for the key terms) |

### Key Link Verification

| From | To | Via | Status |
|------|----|-----|--------|
| `stage.ts` | `substituteAndInject` | `adapter-entry.ts:106` | WIRED |
| `substitute.ts` | `expandClaudeValue`, `serializeSegments` | direct imports | WIRED |
| `stage.ts` notices | each staging verb | `notifyMcpConfigNotices` in install, update, reinstall, enable, import, reconcile | WIRED |
| `info.ts` | `scanClaudeServerVariables` | `info.ts:1019`, env defaults to `process.env` | WIRED |
| `index.ts` | `applyMcpAdapterEnv` | load and `session_start` | WIRED |
| `adapter-escape.ts` | `ADAPTER_EMPTY_ENV` | import from `session-env.ts` | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data | Source | Real data | Status |
|----------|------|--------|-----------|--------|
| `stage.ts` env for expansion | `input.env ?? process.env` | Pi's process | Yes, read-only, names only are written | FLOWING |
| `info.ts` variable lists | env injected into the command, `process.env` in production | Pi's process | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Escape, expansion, deny-list, report, no value leak | `node` probe of `substituteAndInject` (stdio and http cases) | Output as listed under truths 1, 2, 3 and 5 | PASS |
| Conformance through the real adapter 5.1.0 | `PI_MCP_ADAPTER_ROOT=... node --test --test-reporter=tap tests/integration/adapter-expansion-conformance.test.ts` | 52 pass, 0 skipped | PASS |
| Conformance with a bad root fails | same with `PI_MCP_ADAPTER_ROOT=/nonexistent` | exit 1 | PASS |
| Phase unit and integration files (variables, deny-list, features, escape, substitute, entry, session-env, variable-expansion, home-path) | `node --test` on those 9 files | 439 pass, 0 fail, 0 skip | PASS |
| WR-03, index, info, peer-floor and notice gates | `node --test` on 5 files | 323 pass, 0 fail, 0 skip | PASS |
| Full gate | Reused: `npm run check` exit 0 on 1629bac1 (not re-run) | exit 0 | PASS (reused) |

### Probe Execution

SKIPPED. No `probe-*.sh` is declared by the phase plans, and none was found for it. The conformance test plays that role and was run above.

### Requirements Coverage

Every ID in the plan frontmatter maps to a REQUIREMENTS.md entry, and no ID that REQUIREMENTS.md maps to Phase 4 is missing from the plans (no orphans). The plans declare AVAR-01..05 across 04-01 to 04-09. REQUIREMENTS.md lists AVAR-01 to AVAR-05 as `Phase 4 | Complete` (lines 187-191).

| Requirement | Source plans | Status | Evidence |
|-------------|--------------|--------|----------|
| AVAR-01 | 04-01, 04-02, 04-05 | SATISFIED | Truth 1 |
| AVAR-02 | 04-01, 04-02 | SATISFIED | Truth 2 |
| AVAR-03 | 04-01, 04-04, 04-05, 04-06, 04-08, 04-09 | SATISFIED | Truth 3 |
| AVAR-04 | 04-02, 04-03, 04-07, 04-09 | SATISFIED | Truth 4 |
| AVAR-05 | 04-03, 04-07, 04-08 | SATISFIED | Truth 5 |

REQUIREMENTS.md words AVAR-05 as `url` and `headers` only. The code goes further and also blanks set plain-list credentials in stdio fields, which matches Claude Code. This is a superset, not a contradiction.

### Anti-Patterns Found

No `TBD`, `FIXME` or `XXX` marker in the 64 non-planning files changed by the phase. No stub or hollow wiring found. The code review loop ended at iteration 3 with 0 critical and 0 warning findings. Seven warnings (WR-01..07) are fixed. Nine info findings remain open: IN-01 (CI conformance install has no lockfile), IN-02, IN-03, IN-04, IN-05, IN-06, IN-07, IN-08 and IN-09. Each is a robustness, test-coverage or docs-wording note, and none breaks a truth above. Two deserve a later look. IN-05 lets `info` list a variable as unset where the real expansion has none, which is display-only. IN-01 lets the adapter's transitive dependencies float in CI. The security register (`04-SECURITY.md`) shows 29 threats, 29 closed, 0 open, with residuals AR-04-01 to AR-04-06 accepted and documented.

### Human Verification Required

1. **Notice wording** (`variables-missing`, `credentials-blanked`). Test: read the two catalog blocks. Expected: accept or edit together with the renderer. Why human: message clarity.
2. **`info` line wording** (`(unset A, B; withheld C)`). Expected: accept the shape. Why human: draft catalog wording.
3. **CI `# zizmor: ignore[adhoc-packages]`**. Expected: accept the suppression for an exact-pinned, `--ignore-scripts`, out-of-repo install. Why human: security policy call.
4. **As-found `enable` severity and `import` row shape** recorded by 04-09 tests. Expected: confirm they are intended. Why human: design judgment.

These came from the operator's own list. They sit under rule 2 of the status tree (any human item gives `human_needed`) because wording and a suppressed CI finding are not machine-checkable. If the operator accepts them, the phase is `passed` with no further code work.

### Gaps Summary

None. All five roadmap truths hold in code, a live probe and a real-adapter conformance run. The phase goal is achieved. The only open work is the operator's acceptance of the four review items above and the nine open info findings, which the operator may triage or defer.

---

_Verified: 2026-10-07T23:10:00Z_
_Verifier: Claude (gsd-verifier)_

## Human Verification Result

Operator review on 2026-10-07 (asked inline during `/gsd-autonomous --from 4 --interactive`):

1. Notice wording (`variables-missing`, `credentials-blanked`): accepted as written.
2. The `info` `mcp:` line `(unset …; withheld …)`: accepted as written.
3. The CI `# zizmor: ignore[adhoc-packages]` suppression: kept (exact version pin, `--ignore-scripts`, out-of-repo install; PIFL-03 keeps the peer out of every lockfile).
4. The as-found `enable` row severity and `import` row shape: accepted for this phase and filed as BACKLOG `MCPROW-01`.

Status set to `passed`.
