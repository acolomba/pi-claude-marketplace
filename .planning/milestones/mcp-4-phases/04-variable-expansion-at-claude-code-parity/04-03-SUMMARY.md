---
phase: 04-variable-expansion-at-claude-code-parity
plan: 03
subsystem: mcp-bridge
tags: [mcp, credentials, deny-list, security, notices]

requires:
  - phase: 04-01
    provides: "expandClaudeValue segments/missing and the five-field substituteAndInject walk with an always-empty report.blanked"
  - phase: 04-02
    provides: "variableNotices in stage.ts and the MCP server variables not set. row in notifyMcpConfigNotices"
provides:
  - "domain/claude-credential-denylist.ts: Claude Code 2.1.291's plain (64), remote-sink (275) and base-URL (30) name sets, the NDe/ZEe name patterns and the JA credential-in-value check"
  - "expandClaudeValue(raw, fieldClass, env, builtins) with Claude's deny arm and ExpandedValue.withheld"
  - "VariableReport.blanked filled from url and headers (set names only)"
  - "McpCredentialsBlankedNotice and the MCP server credentials withheld. warning, catalog state mcp-credentials-blanked"
  - "Deny rows in tests/bridges/mcp/expansion-cases.ts (ExpansionCase.blanked)"
affects: [04-04, 04-05, 04-08, 04-09]

actuals:
  tokens: 25067
  tasks: 3
  commits: 1
plan_head_before: 4314dee7cb71978ff0b7172003621b2b27b0ffd0
plan_head_after: ad18260718c38ef95680b74e83afde96bcd68d68

tech-stack:
  added: []
  patterns:
    - "Static snapshot of an upstream table: verbatim lists in upstream order, sets built the upstream way, pinned by SHA-256 digests of the sorted names"
    - "Field class passed explicitly (plain | remote) so a forgotten remote cannot fall back to the plain arm"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/claude-credential-denylist.ts
    - tests/domain/claude-credential-denylist.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts
    - extensions/pi-claude-marketplace/bridges/mcp/substitute.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - docs/output-catalog.md
    - tests/architecture/mcp-config-notices.test.ts
    - tests/integration/mcp-variable-expansion.test.ts
    - tests/domain/claude-mcp-variables.test.ts
    - tests/bridges/mcp/substitute.test.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/bridges/mcp/expansion-cases.ts
    - tests/shared/notification-dispatch.test.ts

key-decisions:
  - "The deny-list is a verbatim 2.1.291 snapshot pinned by set digests and differential-fuzzed against the evidence code; the mode-gated sets (Gqe, Voo, Gur, tRe) are omitted"
  - "A plain-field deny-listed variable unset at install is written as the split-token literal ${NAME}, never a kept reference, so a value set later cannot reach the server"
  - "report.blanked lists only set names from url and headers; plain-field blanks and unset remote blanks add no name, as Claude warns only about a set remote sink"

patterns-established:
  - "Regex ported verbatim keeps a per-line eslint-disable naming the rule and the Claude identifier; a useless escape inside a character class is dropped only when the class is unchanged"

requirements-completed: [AVAR-05, AVAR-04]

coverage:
  - id: D1
    description: "Claude Code 2.1.291 deny-list snapshot: plain 64, remote-sink 275 and base-URL 30 names matching the planning-time digests; GITHUB_TOKEN, GH_TOKEN, the MNn exemptions and the builtins are on no list"
    requirement: AVAR-05
    verification:
      - kind: unit
        ref: "tests/domain/claude-credential-denylist.test.ts#AVAR-05: holds the 64 plain names of Claude Code 2.1.291"
        status: pass
      - kind: unit
        ref: "tests/domain/claude-credential-denylist.test.ts#AVAR-05: holds the 275 remote-sink names of Claude Code 2.1.291"
        status: pass
      - kind: unit
        ref: "tests/domain/claude-credential-denylist.test.ts#AVAR-05: holds the 30 base-URL names of Claude Code 2.1.291"
        status: pass
    human_judgment: false
  - id: D2
    description: "Claude's NDe/ZEe name patterns and JA credential-in-value check ported verbatim in behavior, 100% direct branch coverage"
    requirement: AVAR-05
    verification:
      - kind: unit
        ref: "tests/domain/claude-credential-denylist.test.ts (matchesPlainNamePattern, matchesRemoteSinkNamePattern, valueCarriesCredential)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/claude-credential-denylist.ts (branches 77/77)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The rule's deny arm per field class: remote always empty and default ignored; plain empty when set, else default or literal plus missing; ANTHROPIC_API_KEY kept in stdio; GITHUB_TOKEN kept; base-URL value rule"
    requirement: AVAR-05
    verification:
      - kind: unit
        ref: "tests/domain/claude-mcp-variables.test.ts (AVAR-05 rows)"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/substitute.test.ts (EXPANSION_CASES AVAR-05 rows and report.blanked cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No deny-listed credential value reaches the staged document or a notice, and the withheld notice follows the missing-variable notice per server"
    requirement: AVAR-05
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#AVAR-05: no deny-listed credential value reaches the staged document or a notice"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#AVAR-04: a set credential withheld from a remote server reports one credentials-blanked notice after the variables-missing notice"
        status: pass
    human_judgment: false
  - id: D5
    description: "A real project install writes empty header values for a set ANTHROPIC_API_KEY, the sentinel is in neither the file nor any notification, and the last notification is the catalog-pinned withheld warning"
    requirement: AVAR-04
    verification:
      - kind: integration
        ref: "tests/integration/mcp-variable-expansion.test.ts#AVAR-05: a remote server's header never receives a set deny-listed credential, and the user is told"
        status: pass
      - kind: unit
        ref: "tests/architecture/mcp-config-notices.test.ts#AFILE-04: a credentials-blanked notice is byte-equal to the catalog's mcp-credentials-blanked block"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts (AVAR-05 rendering, dedup and order cases)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The withheld warning's wording reads well to a user (closed-catalog draft)"
    requirement: AVAR-04
    verification: []
    human_judgment: true
    rationale: "The plan marks the wording as a closed-catalog draft for operator review; tests pin the bytes, not their clarity"

duration: 24min
completed: 2026-10-07
status: complete
---

# Phase 4 Plan 03: Claude Code credential deny-list Summary

**Plugin MCP entries now get Claude Code 2.1.291's credential deny-list at install: remote-sink names (plus Claude's name patterns and its credential-in-value check for `*_BASE_URL`) are written as `""` in `url` and `headers`, Claude's own credentials and session state are written as `""` in `command`, `args` and `env` when set, and a set credential withheld from a remote server shows the `MCP server credentials withheld.` warning by name only.**

## Performance

- **Duration:** about 24 min
- **Started:** 2026-10-07T17:15:33Z
- **Completed:** 2026-10-07T17:40Z
- **Tasks:** 3 (one commit, as the plan directs)
- **Files modified:** 15 (2 created, 13 modified)

## Accomplishments

- `domain/claude-credential-denylist.ts`: verbatim copies of `X5t`, `J5t`, the ten `qur()` literals, `mqe`/`mrt`, `ANn`, `No`, `MNn`, `PNn`, `br`, `ON` and the word lists behind `tn`, `w5t`, `v5t`; sets built as Claude builds them (`PLAIN_DENIED_NAMES` 64, `REMOTE_SINK_DENIED_NAMES` 275, `CREDENTIAL_BASE_URL_NAMES` 30); `matchesPlainNamePattern` (`NDe`), `matchesRemoteSinkNamePattern` (`ZEe` with `v5t`, `Fae`, `tn`, `fn`, `hso`, `w5t`, `Uo`, `si`) and `valueCarriesCredential` (`JA` with `mi`, `sn`, `Si`, `Ei`, `hi`, `kso`, `yi`, `Ri`). Mode-gated sets are left out and the header says why.
- `domain/claude-mcp-variables.ts`: `expandClaudeValue(raw, fieldClass, env, builtins)` returns `withheld`. Remote: denied by set, pattern or base-URL value rule, always `""`, default ignored, never missing. Plain: denied by set or pattern; set gives `""`; unset gives the default or the literal `${NAME}` text plus missing.
- `bridges/mcp/substitute.ts`: `command`/`args`/`env` use `"plain"`, `url`/`headers` use `"remote"`; `report.blanked` is the deduplicated set names from `url` then `headers`.
- `bridges/mcp/stage.ts` emits a `credentials-blanked` notice after a server's `variables-missing` notice; `shared/notification-dispatch.ts` renders the `MCP server credentials withheld.` row after the variables row; `docs/output-catalog.md` has the `mcp-credentials-blanked` block, locked by the gate row.
- Case table: 15 deny rows (`ExpansionCase.blanked` added, optional, empty when absent).

## Task Commits

The plan ships as one commit.

1. **Task 1: tracer, a set deny-listed credential in a remote header is withheld and reported** - `ad182607`
2. **Task 2: base-URL value rule and the version-pinned snapshot test** - `ad182607`
3. **Task 3: per-field deny rows, the security test, the commit** - `ad182607` (feat)

Tracer gate: `workflow.auto_advance` is false, `workflow.human_verify_mode` is the default `end-of-phase`, and the tracer `<verify>` is automated-only, so it was re-run (exit 0) and execution expanded with no checkpoint.

## Verification

Node v26.10.0. All commands from the repo root.

| Command | Exit | Notes |
|---|---|---|
| Task 1: `mkdir -p /var/tmp/mcp4-p4-03 && npm run typecheck && node --test tests/architecture/mcp-config-notices.test.ts tests/domain/claude-mcp-variables.test.ts && TMPDIR=/var/tmp/mcp4-p4-03 node --test tests/integration/mcp-variable-expansion.test.ts` | 0 | 46 pass; 2 pass; no `error TS` |
| Task 2: `... npm run typecheck && node --test tests/domain/claude-credential-denylist.test.ts && TMPDIR=/var/tmp/mcp4-p4-03 npm run test:coverage:direct -- .../claude-credential-denylist.ts` | 0 | 112 pass; branches 77/77, functions 21/21, lines 631/631 |
| Task 3 verify 1: `npm run typecheck && node --test <4 owner files> && npm run test:coverage:direct -- <5 sources>` | 0 | rerun on `ad182607` (plus the deny-list test file): 521 pass; 100% direct coverage for all five sources |
| Task 3 verify 2: `npm run test:modules && npm run test:architecture && npm run test:integration && test "$(tail -n 1 tmp/p4-03-precommit.log)" = PRECOMMIT_EXIT=0 && git log -1 --format=%s` | 0 | run on `ad182607`; printed `feat(mcp): withhold Claude Code's deny-listed credentials` |
| `npx fallow audit --base 4314dee7` | 0 | No issues in 15 changed files; one inherited clone group in `notification-dispatch.ts` (585-595 / 631-641, untouched code) excluded by the gate |
| `npx fallow dead-code` | 0 | No issues; every deny-list export has a production consumer |
| D-04 ID check on `git diff 4314dee7..HEAD -- extensions tests` | 0 | no `D-04-NN` added |

- Pre-commit log `tmp/p4-03-precommit.log` ends with `PRECOMMIT_EXIT=0`. The first run failed `detect-private-key` on a test row (see Deviations); the second run was clean with no fixer rewrites.
- Commit `ad182607` hook: `npm run check:commit....Passed` (all pairs, because `tests/bridges/mcp/expansion-cases.ts` is staged test support); gitlint Passed.
- Other suites: none needed a fix (`test:modules`, `test:architecture`, `test:integration` all exit 0).

Evidence comparison method (Task 2 step 4): a scratch script read `04-EVIDENCE-claude-2.1.291.txt` with the `###` header lines removed, captured each Claude array literal (`X5t`, `J5t`, `mrt`, `mqe`, `ANn`, `No`, `MNn`, `PNn`, `br`, `ON`, `mn`, `Sn`, `En`, `hn`, `gn`, `Nn`, `bn`, `ut`, and the ten `qur()` literals between `...Gur().filter(...)` and `...mqe]`), tokenized string literals and `...spread` names, and compared the token sequence with the matching module array (spreads mapped back to Claude's identifiers). All 19 lists are equal. Separately, the evidence code for `JA`, `ZEe` and `NDe` (lines 22-64, with a stub `ne`) was evaluated in a `vm` context and fuzzed against the port: 300,000 generated values and 300,000 generated names, 0 mismatches.

Focused task verification passed; full phase/PR verification pending.

## Decisions Made

- `isDenied(fieldClass, upper, value)` and `deniedSegment(...)` hold the deny arm, so `segmentFor` stays under both cognitive-complexity ceilings. The value lookup is shared (`valueOf`), own-property and exact-case; membership uses the uppercase name.
- `variableNotices` builds both notice kinds per server with `flatMap`, so a server's withheld notice always directly follows its missing notice.
- The JA port keeps Claude's evaluation order and splits it into named predicates (`isTokenShaped`, `isHostPortPath`, `authorityCarriesCredential`, `schemeAuthorityCarriesCredential`, `bareUserinfoCarriesCredential`, `tokenPatternMatches`). Two forms avoid branches no input can reach under `noUncheckedIndexedAccess`: `text.charAt(i)` for Claude's `n[s-1] ?? ""`, and a destructuring default for the regex group `r[2]`. `value.slice(0, 8192)` replaces Claude's length ternary with identical results.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `detect-private-key` hook flagged a PEM header test row**
- **Found during:** Task 3 (pre-commit)
- **Issue:** the row used an RSA private-key PEM header, which is on the hook's fixed list of real key headers.
- **Fix:** the row uses a `TEST` label in place of `RSA`, which Claude's `kso` (`[A-Z ]*` label) still matches and the hook does not list.
- **Files modified:** tests/domain/claude-credential-denylist.test.ts
- **Verification:** the row passes; the pre-commit rerun ended `PRECOMMIT_EXIT=0`.
- **Committed in:** ad182607

**2. [Rule 2 - Missing coverage] A non-string `command` arm**
- **Found during:** Task 3 (direct coverage of `substitute.ts`, branches 50/51)
- **Issue:** `command` and `url` now pass different field classes, so they no longer share one case; the non-string `command` arm had no row.
- **Fix:** the existing unexpected-type case adds `command: 7`.
- **Files modified:** tests/bridges/mcp/substitute.test.ts
- **Committed in:** ad182607

**3. [Rule 1 - Doc accuracy] `bridges/mcp/types.ts` notices comment**
- **Found during:** Task 1
- **Issue:** the `notices` doc named only the per-server variable notices; the order now includes `credentials-blanked` after `variables-missing`. File not in `files_modified`.
- **Fix:** one sentence added to the doc comment.
- **Committed in:** ad182607

**4. [Lint] Verbatim regexes**
- Directives name the rule each regex trips: `sonarjs/regex-complexity` (`Ei`, `hi`, `Si`, `Ri`), `sonarjs/concise-regex` (`Uo`, `v5t`, `mi`, `TOKEN_VALUE`, `BEARER_OR_BASIC_VALUE`), and `sonarjs/duplicates-in-character-class` (`AUTHORIZATION_VALUE`, the `i`-flag class Claude wrote). Escapes dropped inside character classes only (`\[` in `Si`, `\/` in `yi` and the JA token patterns); each class is unchanged.

**5. [Process] TDD order for Task 2**
- The `valueCarriesCredential` port and base-URL set were written before `tests/domain/claude-credential-denylist.test.ts`, so no RED run was recorded. The plan ships one commit and `workflow.tdd_mode` is false. The differential fuzz against Claude's own code (above) stands in as the independent check.

**6. [Test support] `ExpansionCase.blanked`**
- An optional field (empty when absent), following the existing optional `scope`, so the 24 earlier rows stay unchanged and the table loop asserts `blanked` for every row.

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 missing coverage, 1 doc accuracy) plus 3 recorded process and lint notes. **Impact:** no scope change; behavior matches the plan.

## Issues Encountered

- `gsd-tools query state.*` rewrote `.planning/state.json`; it was restored with `git checkout`, as the plan's executor rules require. The verbs left `last_activity_desc` and `Last activity:` naming 04-02, which were corrected by hand.

## Known Stubs

None. WINDOWS.md entry #88 (`report.blanked` always empty) is marked fixed by this plan.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-04-06 and T-04-07 are mitigated and pinned by the deny rows, the stage sentinel case and the integration case; T-04-08 by the three digests and the evidence comparison; T-04-11 by the names-only notice and the no-sentinel assertions in the stage, integration and dispatch cases. T-04-09 and T-04-10 stay accepted as the plan records.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 04-04 and later plans. 04-08's conformance test can feed the 15 deny rows through the real adapter; the plain unset row leaves the variable unset in `runtimeEnv`, as the plan directs. 04-09 proves the withheld warning through update, reinstall, enable and the cascades.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/domain/claude-credential-denylist.ts, tests/domain/claude-credential-denylist.test.ts
- FOUND: commit ad182607 on HEAD
