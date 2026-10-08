---
phase: 05-automatic-migration-on-reload
plan: 02
subsystem: mcp
tags: [mcp, partial-install, notices, catalog]
status: complete

requires:
  - phase: 05-automatic-migration-on-reload
    provides: notifyMcpMigration and the shared mcpConfigNoticeSections (05-01), seedLegacyMcpInstall
  - phase: 03-claude-code-tool-names-and-tool-search
    provides: classifyMcpServer, the closed translator and the {unsupported mcp} feature set
provides:
  - domain/mcp-server-features.ts unenforcedToolRules and McpUnenforcedToolRule; McpUnsupportedFeature narrowed to ten literals
  - shared/notification-dispatch.ts McpToolRulesUnenforcedNotice and the "MCP server tool rules not enforced." section
  - bridges/mcp/stage.ts per-server tool-rules-unenforced notices after the variable notices
  - foldUnstageNotices drops the notice of a removed server
  - catalog block mcp-tool-rules-unenforced, byte-locked by tests/architecture/mcp-config-notices.test.ts
  - docs/mcp-compatibility.md section "Tool permission rules"
  - tests/integration/mcp-plugin-seed.ts seedLegacyMcpInstall optional declared-server argument
affects: [05-03, 05-04, 05-05]

actuals:
  tokens: 13440
  tasks: 3
  commits: 1
plan_head_before: 5362535c25e03e35e94bbdcee09630ac225b1a65
plan_head_after: 2bbce472ad93411ffb4f9ea5dfcc184a99a70dbf

tech-stack:
  added: []
  patterns:
    - "A Claude-side restriction pi-mcp-adapter cannot enforce installs and warns through the structured StageMcpCommitResult.notices route, so every staging path and the reload migration report it"

key-files:
  created:
    - tests/integration/mcp-tool-rules.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
    - extensions/pi-claude-marketplace/domain/resolver-types.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/types.ts
    - extensions/pi-claude-marketplace/shared/notification-dispatch.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts
    - docs/output-catalog.md
    - docs/mcp-compatibility.md
    - tests/domain/mcp-server-features.test.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/shared/notification-dispatch.test.ts
    - tests/orchestrators/marketplace/shared.test.ts
    - tests/architecture/mcp-config-notices.test.ts
    - tests/integration/mcp-migration.test.ts
    - tests/integration/mcp-plugin-seed.ts

key-decisions:
  - "unenforcedToolRules re-checks the remote schema itself and returns [] for a stdio, ws or schema-rejected server, so the notice never fires for a server classifyMcpServer would not let through"
  - "The tool-rules notice keeps the migration notice at info severity when every row moved, like the variable and credential lines it sits beside"
  - "seedLegacyMcpInstall takes the plugin's declared server as an optional fourth argument, so the migration case's fresh-install oracle declares the same rule fields"

patterns-established:
  - "Tool permission field names, never tool names or policy values, reach a notice line"

requirements-completed: [AMIG-01, AMIG-03]

coverage:
  - id: D1
    description: "A plugin whose remote server declares tools[].permission_policy or a non-empty toolPermissions installs without --partial, stays installable with no mcpServers in unsupported, and its written entry carries neither field"
    requirement: AMIG-01
    verification:
      - kind: integration
        ref: "tests/integration/mcp-tool-rules.test.ts#ANAME-07: a plugin whose http server declares tool permission rules installs and warns that they are not enforced"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#ANAME-07: a server with tool permission rules is written without either rule field"
        status: pass
      - kind: unit
        ref: "tests/domain/mcp-server-features.test.ts#classifyMcpServer"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every staging path reports one tool-rules-unenforced notice per server, in declared order after the variable notices, naming the server key, plugin, scope, file and fields only; no tool name or policy value reaches any notification"
    requirement: AMIG-01
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/stage.test.ts#ANAME-07: each server with tool permission rules reports one tool-rules-unenforced notice, in declared order after the variable notices"
        status: pass
      - kind: unit
        ref: "tests/domain/mcp-server-features.test.ts#unenforcedToolRules"
        status: pass
      - kind: integration
        ref: "tests/integration/mcp-tool-rules.test.ts#ANAME-07: a plugin whose http server declares tool permission rules installs and warns that they are not enforced"
        status: pass
    human_judgment: false
  - id: D3
    description: "notifyMcpConfigNotices renders the section after credentials-withheld, deduplicated and byte-equal to the catalog block; the reload migration notice carries the same line for a moved server, which matches a fresh install byte for byte"
    requirement: AMIG-03
    verification:
      - kind: unit
        ref: "tests/architecture/mcp-config-notices.test.ts"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-dispatch.test.ts#ANAME-07: tool-rules-unenforced notices send MCP server tool rules not enforced. after the credentials-withheld warning, with a line each"
        status: pass
      - kind: integration
        ref: "tests/integration/mcp-migration.test.ts#AMIG-01: a migrated plugin whose server declares tool permission rules matches a fresh install and its notice says the rules are not enforced"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every other unsupported feature still blocks; an invalid rule value stays malformed; an unstage drops the notice of a removed server"
    requirement: AMIG-01
    verification:
      - kind: unit
        ref: "tests/domain/mcp-server-features.test.ts#classifyMcpServer"
        status: pass
      - kind: unit
        ref: "tests/orchestrators/marketplace/shared.test.ts#AVAR-04 / ANAME-07: foldUnstageNotices drops the variable and tool-rule notices of the removed servers and appends the unstage's notices"
        status: pass
    human_judgment: false
  - id: D5
    description: "The warning wording and the compatibility-doc section are a closed-catalog draft for operator review"
    requirement: AMIG-03
    verification: []
    human_judgment: true
    rationale: "No test can judge whether the wording reads well to a user"

duration: 16min
completed: 2026-10-08
---

# Phase 5 Plan 02: Tool permission rules install and warn Summary

**A remote MCP server whose only gap is `tools[].permission_policy` or a non-empty `toolPermissions` now installs without `--partial`, is written without those fields, and every staging path and the `/reload` migration warn `MCP server tool rules not enforced.` with one line per server that names the fields only.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-10-08T13:54:24Z
- **Completed:** 2026-10-08T14:10:27Z
- **Tasks:** 3 (tracer, TDD test task, docs and commit)
- **Files:** 16 (1 created, 15 modified)

## Accomplishments

- `McpUnsupportedFeature` lists ten literals; `remoteFeature` stops at `headersHelper`, `oauth.xaa`, `bareElicitationCapability`. `REMOTE_SERVER_SCHEMA` still validates both rule fields, so `permission_policy: "never"` or `toolPermissions: { drop: "deny" }` stays `{malformed mcp}`.
- `unenforcedToolRules(server)` returns the rule fields of a valid `sse`/`http`/`streamable-http` server in table order, and `[]` for everything else.
- `prepareStageMcpServers` appends one `tool-rules-unenforced` notice per server after the variable notices. The notice reaches every command through `StageMcpCommitResult.notices`, and the migration through `notifyMcpMigration`.
- `notifyMcpConfigNotices` sends the new section after credentials-withheld; `foldUnstageNotices` drops it for a removed server.
- Catalog block `mcp-tool-rules-unenforced`; the `{unsupported mcp}` paragraph no longer lists the two rules; `docs/mcp-compatibility.md` drops the two table rows and gains "Tool permission rules".

## Task Commits

The plan prescribes one commit for all three tasks:

1. **Tasks 1-3: the amended table, the notice, its rendering, its fold, the tests and the docs** - `2bbce472` (feat)

**Plan metadata:** this SUMMARY with STATE.md and ROADMAP.md in the following docs commit.

## Verification

- Tracer verify: `npm run typecheck` and `node --test tests/integration/mcp-tool-rules.test.ts`: 1/1 pass, re-run before expansion (tracer gate passed, interactive end-of-phase mode, automated-only verify).
- Task 2: owner files 496/496 pass; `npm run test:coverage:direct` for `mcp-server-features.ts`, `resolver-types.ts`, `stage.ts`, `notification-dispatch.ts`, `orchestrators/marketplace/shared.ts`: exit 0 (100%).
- Task 3: `mcp-config-notices`, `mcp-migration`, `mcp-tool-rules`: 23/23 pass. `TMPDIR=/var/tmp/mcp4-p5-02 npm run test:modules`: exit 0. `npm run test:architecture`: exit 0. `npm run test:integration`: exit 0. These ran before `npm run format`, which then reformatted only `tests/domain/mcp-server-features.test.ts`; the commit hook re-ran that file's pair and the architecture suite.
- `npm run fallow`: exit 0 (no unused export for `unenforcedToolRules`, `McpUnenforcedToolRule`, `McpToolRulesUnenforcedNotice`). `npx fallow audit --base 5362535c`: no issues in the 16 changed files (one inherited clone group in `notification-dispatch.ts` excluded by the gate, as in 05-01).
- `PRECOMMIT_EXIT=0` (`tmp/p5-02-precommit.log`, last line).
- Commit hook: `npm run check:commit` Passed on `2bbce472` (all pairs, because `tests/integration/mcp-plugin-seed.ts` is staged test support). Node v26.11.0.
- Plan verification greps: no `D-05-NN` in the added lines of `extensions` and `tests`; `McpUnsupportedFeature` has 10 members; every acceptance grep of Tasks 1-3 passes.

Focused task verification passed; full phase/PR verification pending.

## Other suites fixed

None. No suite outside the plan's files named the two old features.

## Decisions Made

- `unenforcedToolRules` runs the remote schema check itself, so it never reports a rule on a server that `classifyMcpServer` calls malformed.
- The migration notice stays `info` when every row moved, even with a tool-rules line, as it does with a variable or credential line.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `seedLegacyMcpInstall` could not declare a server with rules**
- **Found during:** Task 3 (the migration case)
- **Issue:** The helper always seeds the default stdio server, so the fresh-install oracle and the re-staged server could not carry the rule fields the case needs.
- **Fix:** An optional fourth `server` argument, passed through to `seedMcpPlugin`. Existing callers are unchanged.
- **Files modified:** `tests/integration/mcp-plugin-seed.ts` (not in the plan's `files_modified`)
- **Commit:** 2bbce472

**2. [Test design] Two malformed rows and a ws row added**
- **Found during:** Task 2
- **Issue:** No case pinned that an invalid `toolPermissions` value is malformed, and no case covered the `type` check of `unenforcedToolRules` for a remote-looking `ws` server.
- **Fix:** `classifyMcpServer` rows for an invalid `permission_policy` and an invalid `toolPermissions` value; an `unenforcedToolRules` row for a `ws` server.
- **Commit:** 2bbce472

**3. [Test design] No separate noop-stage case**
- **Found during:** Task 2
- **Issue:** A noop stage has no servers (an unreadable file with servers refuses), so `toolRuleNotices` never runs on that path. The existing `AVAR-04: a noop stage reports no variables-missing notice` case already asserts the whole notice list is `[]`.
- **Fix:** No duplicate case; a stage case for servers without rules (an empty `toolPermissions`, a stdio server carrying `toolPermissions`) asserts no notice instead.

**4. [Test design] The "every kind" dispatch case gained the new kind**
- **Found during:** Task 2
- **Issue:** `AFILE-04: notices of every kind send one warning per kind in section order` would no longer cover every kind.
- **Fix:** The case now lists a `tool-rules-unenforced` notice first and expects its warning last.
- **Commit:** 2bbce472

**Total deviations:** 4 (1 blocking test-support fix, 3 test-structure adjustments). **Impact:** none on the plan's contract.

## TDD Note

Task 2 is `tdd="true"`, but the plan's tracer (Task 1) wrote the implementation first and the plan prescribes one commit, so no failing-test commit precedes it. `workflow.tdd_mode` is off, so no gate applies.

## Issues Encountered

- The warning wording and the compatibility-doc section are a closed-catalog draft for operator review.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None.

## Next Phase Readiness

Ready for 05-03. AMIG-01 and AMIG-03 stay open while sibling plans that also declare them have no SUMMARY.

## Self-Check: PASSED

- FOUND: tests/integration/mcp-tool-rules.test.ts
- FOUND: commit 2bbce472 is an ancestor of HEAD
- Acceptance criteria of Tasks 1-3 re-run: all pass
