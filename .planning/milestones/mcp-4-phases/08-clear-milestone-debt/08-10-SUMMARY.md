---
phase: 08-clear-milestone-debt
plan: 10
subsystem: bridges-mcp
tags: [mcp, d-08-04, d-08-02, oauth, aname-07, avar-04, conformance]

requires:
  - phase: 08-clear-milestone-debt
    provides: "08-03 top-level `_piClaudeMarketplace.serverChoices` store in mcp-adapter.json"
provides:
  - "Closed table writes `auth: \"oauth\"` for a remote server whose non-empty `headers` carry no Authorization key in any case, just before `oauth` (D-08-04)"
  - "`translatedEntry` drops that `auth` when a written header value is not clean (D-08-04 operator ruling)"
  - "Classifier detail `/oauth/authServerMetadataUrl: must be a valid URL`; the table never copies an unparseable metadata URL"
  - "`SCAN_BUILTINS` placeholder `/`; parity comment on `REMOTE_TYPES`"
  - "Test support: `PiMcpAdapterConfig`, `PiMcpAdapterAuthFetch`, `supportsOAuth` on `PiMcpAdapterAuthFlow`, module names `config` and `mcp-auth-fetch`"
  - "tests/integration/mcp-adapter-entry-conformance.test.ts (D-08-02, D-08-04 against pi-mcp-adapter 5.2.0)"
affects: [08-14 docs rows for D-08-04 and the side-check table, 08-21 phase verdicts for DEBT-02/03/04]

actuals:
  tokens: 8700
  tasks: 3
  commits: 3
plan_head_before: 17b107106c0b4f9ab2fcc1f7af5f1ae4829b6e38
plan_head_after: 57182472f638432866033bcabfe966fca0be06e5

tech-stack:
  added: []
  patterns:
    - "A table-owned field the bridge withdraws after substitution, decided only from whether each referenced variable is set"

key-files:
  created:
    - tests/integration/mcp-adapter-entry-conformance.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts
    - tests/domain/mcp-server-features.test.ts
    - tests/bridges/mcp/adapter-entry.test.ts
    - tests/domain/claude-mcp-variables.test.ts
    - tests/orchestrators/plugin/install-flow.test.ts
    - tests/integration/pi-mcp-adapter-peer.ts

key-decisions:
  - "The header-cleanliness check runs on the written values after substitution, with the adapter's own reference regex; the split token counts as unclean even when the staging environment sets its variable"
  - "A non-string written header value also withdraws `auth`, because the adapter's resolver cannot read it (the resolver already marks such a server malformed, so this is defense in depth)"
  - "An unparseable metadata URL is malformed before any feature blocks, as Claude's schema rejects the config first"

requirements-completed: []

coverage:
  - id: D1
    description: "A remote server with clean non-Authorization headers gets auth: oauth before oauth; Authorization in any case, {} and no headers get none"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/domain/mcp-server-features.test.ts#D-08-04: an http server writes auth after headers and before oauth"
        status: pass
      - kind: unit
        ref: "tests/domain/mcp-server-features.test.ts#D-08-04: an http server with an AUTHORIZATION header among others writes no auth"
        status: pass
    human_judgment: false
  - id: D2
    description: "An unclean written header value withdraws auth; a clean one keeps it"
    requirement: "DEBT-04"
    verification:
      - kind: unit
        ref: "tests/bridges/mcp/adapter-entry.test.ts#D-08-04: the split token after a set reference drops auth"
        status: pass
      - kind: unit
        ref: "tests/bridges/mcp/adapter-entry.test.ts#D-08-04: a reference to a set variable keeps auth"
        status: pass
    human_judgment: false
  - id: D3
    description: "pi-mcp-adapter 5.2.0 enables OAuth for exactly the entries D-08-04 marks and loads the choice store as no server"
    requirement: "DEBT-03"
    verification:
      - kind: integration
        ref: "tests/integration/mcp-adapter-entry-conformance.test.ts#D-08-02: pi-mcp-adapter loads a user file holding a stored server choice as the user's own servers only"
        status: pass
      - kind: integration
        ref: "tests/integration/mcp-adapter-entry-conformance.test.ts#D-08-04: pi-mcp-adapter keeps OAuth for the entry written beside a clean non-Authorization header and resolves that header"
        status: pass
    human_judgment: false
  - id: D4
    description: "Unparseable authServerMetadataUrl is malformed; the scan placeholder cannot join text into a variable"
    requirement: "DEBT-02"
    verification:
      - kind: unit
        ref: "tests/domain/mcp-server-features.test.ts#ANAME-07: an authServerMetadataUrl of \"https://bad host\" that does not parse is malformed"
        status: pass
      - kind: unit
        ref: "tests/domain/claude-mcp-variables.test.ts#AVAR-04: a builtin placeholder never joins the text after it into a variable"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-10-10
status: complete
---

# Phase 08 Plan 10: OAuth beside headers, metadata URL validity and adapter conformance Summary

**A remote server whose headers carry no Authorization key now keeps OAuth under pi-mcp-adapter, as it does in Claude Code 2.1.296. The closed table writes `auth: "oauth"`, and the bridge takes it back when a written header value would make the adapter refuse OAuth mode. An unparseable OAuth metadata URL is now malformed. The scan placeholder can no longer join text into a variable. A new conformance test proves the entry and the 08-03 choice store against the real pi-mcp-adapter 5.2.0.**

## Performance

- **Duration:** about 13 min (04:37Z to 04:50Z)
- **Completed:** 2026-10-10
- **Tasks:** 3/3
- **Files modified:** 9 (1 created)

## Findings closed

| Finding | Disposition | Commit |
| ------- | ----------- | ------ |
| P3 WR-02 | fixed through D-08-04: `auth: "oauth"` beside clean non-Authorization headers | 8cd7175f |
| P3 IN-02 | fixed: `translatedEntry`'s doc comment presents its two warnings as defense in depth for callers that bypass the resolver (D-03-18) | 8cd7175f |
| P3 IN-03 | fixed: an `authServerMetadataUrl` that starts with `https://` but does not parse is malformed, and the table does not copy it | 3c686fca |
| P4 IN-05 | fixed: `SCAN_BUILTINS` uses `/`, so `$${CLAUDE_PLUGIN_ROOT}{FOO}` reports no variable | 3c686fca |
| P4 IN-04 | comment added above `REMOTE_TYPES`; the finding stays wontfix | 3c686fca |

## Side check: what substitute.ts writes per header shape, and whether `auth` is written

Probed through `stampServers` on an `http` server (D-08-04 operator ruling). "Clean" follows pi-mcp-adapter's `resolveOAuthHeaders`: no reference to an unset or empty variable, and not empty after trimming. Plan 08-14 copies this into the docs.

| Declared header value | Staging env | Written value | `auth` written |
| --------------------- | ----------- | ------------- | -------------- |
| `core` (literal) | any | `core` | yes |
| `${PI_CM_SET}` | `PI_CM_SET=1` | `${PI_CM_SET}` (kept reference) | yes |
| `${PI_CM_UNSET}` | unset | `${PI_CM_UNSET}` (kept, reported missing) | no |
| `${PI_CM_UNSET:-acme}` | unset | `acme` | yes |
| `${ANTHROPIC_API_KEY}` | set | `""` (withheld credential) | no |
| `Bearer ${ANTHROPIC_API_KEY}` | set | `Bearer ` (the adapter trims it to `Bearer`) | yes |
| `${PI_CM_SET}_eu` | `PI_CM_SET=1` | `${PI_CM_SET}{env:PI_CLAUDE_MARKETPLACE_EMPTY}_eu` (split token after a reference followed by a name character) | no |
| `${PI_CM_SET}-eu` | `PI_CM_SET=1` | `${PI_CM_SET}-eu` | yes |
| `a{env:X}b` (literal trigger) | any | `a{env:{env:PI_CLAUDE_MARKETPLACE_EMPTY}X}b` | no |
| `!cmd` | any | `!!cmd` (the adapter strips one `!`) | yes |
| `  ` (blank literal) | any | `  ` | no |
| any value, with an `Authorization` key in any case | any | unchanged | no (table rule) |

The split token is written after a kept reference when the following text starts with a name character, `}`, or `:` plus a name character, and inside every literal adapter trigger. A server without `auth` keeps today's behavior: it connects without OAuth. This remainder is the Pi capability gap that plan 08-14 records in `docs/mcp-compatibility.md`.

## Task Commits

1. **Task 1: A remote server with clean non-Authorization headers keeps OAuth** - `8cd7175f` (feat). Pre-commit log: `PRECOMMIT_EXIT=0` (the first run reformatted `tests/domain/mcp-server-features.test.ts`; the rerun was clean). Hook: `npm run check:commit` Passed.
2. **Task 2: A metadata URL must parse, and the scan placeholder is safe** - `3c686fca` (fix). Pre-commit log: `PRECOMMIT_EXIT=0` after one prettier rewrite. Hook: `npm run check:commit` Passed.
3. **Task 3: The adapter accepts the store member and the OAuth entry** - `57182472` (test). Pre-commit log: `PRECOMMIT_EXIT=0`. Hook: `npm run check:commit` Passed. The commit stages shared test support, so the hook ran every pair.

## Verify results (final lines)

- Task 1: `node --test tests/domain/mcp-server-features.test.ts tests/bridges/mcp/adapter-entry.test.ts tests/bridges/mcp/stage.test.ts`: `ℹ pass 257 / ℹ fail 0`. `npm run test:coverage:direct -- …/mcp-server-features.ts …/adapter-entry.ts` exited 0.
- Task 2: `node --test tests/domain/mcp-server-features.test.ts tests/domain/claude-mcp-variables.test.ts tests/domain/plugin-resolver.test.ts`: `ℹ pass 352 / ℹ fail 0`. `npm run test:coverage:direct -- …/mcp-server-features.ts …/claude-mcp-variables.ts` exited 0. Wider: substitute, adapter-entry, adapter-expansion-conformance, info and mcp-resolution tests, `ℹ fail 0`.
- Task 3: `tmp/p8-10-conformance.log` ends `# tests 58 / # pass 58 / # fail 0 / # skipped 0 / CONFORMANCE_EXIT=0`; the verify command exited 0.
- Without `PI_MCP_ADAPTER_ROOT`, the three new cases report `# SKIP PI_MCP_ADAPTER_ROOT is not set` (`# skipped 3`).
- `npx fallow audit --base "$(git merge-base origin/main HEAD)"` after each task and after the last commit: verdict `pass`, `duplication_introduced: 0`, `complexity_introduced: 0`, `dead_code_introduced: 0`.
- I did not run `npm run check`. The orchestrator runs it at the wave boundary. Node v26.11.1.

## TDD evidence

- Task 1 RED: the new and changed rows against the old sources gave `ℹ pass 146 / ℹ fail 8` (the table rows, both order pins, the hostile entry and the two "keeps auth" bridge rows). The "drops auth" rows passed before and after, as intended, since the old code wrote no `auth`.
- Task 2 RED: `ℹ pass 164 / ℹ fail 7` (four metadata-URL table and verdict rows, the headersHelper order row, and both scan rows).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated a pinned install expectation outside the plan's file list**
- **Found during:** Task 1 (wide test run)
- **Issue:** `tests/orchestrators/plugin/install-flow.test.ts` pins the exact `mcp-adapter.json` bytes for an sse server with `headers: { "X-Team": "core" }`. That entry now gains `auth: "oauth"`.
- **Fix:** Added `"auth": "oauth"` after `"httpTransport": "sse"` and tagged the title with D-08-04.
- **Files modified:** tests/orchestrators/plugin/install-flow.test.ts
- **Commit:** 8cd7175f

**2. Bridge rows beyond the plan's list**
- Added three rows to the D-08-04 bridge cases: a blank literal value, a non-string value, and the split token with the staging environment setting `PI_CLAUDE_MARKETPLACE_EMPTY`. Each one discriminates one clause of the predicate.

**3. Unclean conformance case also asserts the adapter refuses the header**
- The D-08-04 unclean case asserts that `resolveOAuthHeaders` throws a `TypeError` for the written header. This shows why the entry withholds `auth`.

**4. D-08-02 conformance case at user scope, as planned**
- `loadMcpConfig(undefined, cwd).mcpServers` deep-equals `{ mine: { command: "my-server" } }` under the hermetic `HOME` and `PI_CODING_AGENT_DIR`. No other source added servers, so the fallback assertion was not needed.

**5. Requirements not marked complete**
- DEBT-02, DEBT-03 and DEBT-04 cover the whole phase. Plan 08-21 owns their verdicts.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

Mitigations: T-08-22 (the Authorization test lower-cases each key; rows for `Authorization`, `authorization` and `AUTHORIZATION`; the hostile-entry case keeps none of the plugin's own `auth`). T-08-23 (unclean header rows withdraw `auth`; the conformance case shows the adapter refuses such a header and keeps OAuth off). T-08-24 (the predicate reads only whether a variable is set and non-empty; written values and reports are unchanged). T-08-25 (`URL.canParse` in both the classifier and `oauthField`).

## Self-Check: PASSED

- All nine files exist, and commits 8cd7175f, 3c686fca and 57182472 are ancestors of HEAD.
