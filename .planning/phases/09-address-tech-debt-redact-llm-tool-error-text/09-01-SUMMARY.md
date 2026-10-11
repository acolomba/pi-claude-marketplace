---
phase: 09-address-tech-debt-redact-llm-tool-error-text
plan: "01"
subsystem: edge
tags: [llm-tools, redaction, credentials, pmod-04, tc-9]

requires:
  - phase: 04-wire-schema-and-json-strategy
    provides: redactCredentials (PMOD-04) and the deferred item this plan resolves
provides:
  - Every content string both LLM tools return passes through redactCredentials
  - Neither LLM tool execute rejects; every body failure returns the redacted TC-9 error result
  - The 04/ deferred item is resolved with a pointer to the fixing commits
affects: [gsd-audit-milestone, gsd-complete-milestone, json-output]

actuals:
  tokens: 5600
  tasks: 3
  commits: 3
plan_head_before: 438f1c5c032d3697c4b20ffab7f6957b4c33486a
plan_head_after: bab73a518f8088a5d0043345ae871ef6b27097e6

tech-stack:
  added: []
  patterns:
    - "One module-private content builder (textContent) applies redaction at the tool return boundary"
    - "Each tool execute is one try { return await build...Result() } with a loadFailure catch"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/edge/handlers/tools.ts
    - tests/edge/handlers/tools.test.ts
    - .planning/phases/04-wire-schema-and-json-strategy/deferred-items.md

key-decisions:
  - "D-03 kept as written: both tools return the TC-9 shape and never throw, although Pi 0.87.1 ignores a returned isError"
  - "D-07: the deferred item reads status: resolved (not closed), because audit-open treats only resolved or acknowledged as closed"
  - "D-08: the corpus invariant is a path-scoped git diff against b30468c0, because scripts/notify-corpus.mjs no longer exists"
  - "Added the not-found-line owner case (five cases total): it is the only D-01 site whose text the LLM controls"

patterns-established:
  - "LLM tool content: build every block through textContent so a static count proves no return path skips redaction"

requirements-completed: [PMOD-04]

coverage:
  - id: D1
    description: "The marketplace list line redacts a url source's userinfo token"
    requirement: PMOD-04
    verification:
      - kind: unit
        ref: "tests/edge/handlers/tools.test.ts#redacts the credential of a url source on its marketplace line"
        status: pass
    human_judgment: false
  - id: D2
    description: "The plugin list redacts a credential in its load-failure line and in an LLM-supplied not-found marketplace name"
    requirement: PMOD-04
    verification:
      - kind: unit
        ref: "tests/edge/handlers/tools.test.ts#redacts a credential in the load failure it reports"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/tools.test.ts#redacts a credential in the marketplace name it reports as not found"
        status: pass
    human_judgment: false
  - id: D3
    description: "Neither tool rejects: a marketplace-list load failure and a marketplaceExists failure both return the redacted TC-9 error result"
    requirement: PMOD-04
    verification:
      - kind: unit
        ref: "tests/edge/handlers/tools.test.ts#returns a redacted tool error instead of throwing when the load fails"
        status: pass
      - kind: unit
        ref: "tests/edge/handlers/tools.test.ts#returns a redacted tool error instead of throwing when the marketplace lookup fails"
        status: pass
    human_judgment: false
  - id: D4
    description: "The 04/ deferred item is resolved and audit-open no longer lists it"
    verification:
      - kind: other
        ref: "node .claude/gsd-core/bin/gsd-tools.cjs query audit-open"
        status: pass
    human_judgment: false
  - id: D5
    description: "Milestone invariants hold: catalog, frozen corpus, and AUTH-09 gate unchanged; no suppression; fallow audit pass; npm run check green"
    verification:
      - kind: other
        ref: "npm run check (exit 0 at bab73a51, Node v26.11.1)"
        status: pass
      - kind: other
        ref: "npx fallow audit --base b30468c0 --format json --quiet (verdict pass)"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-10-11
status: complete
---

# Phase 9 Plan 01: Redact LLM Tool Text Summary

**Both LLM tools build every content block through one `redactCredentials` helper, and each execute catches every body failure into the redacted TC-9 error result, so no stored or LLM-typed credential reaches the model.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-11T04:27:21Z
- **Completed:** 2026-10-11T04:37:00Z
- **Tasks:** 3
- **Files modified:** 3
- **Base for every diff:** `b30468c0` (ledger base `438f1c5c`, which adds only planning Markdown)

## Accomplishments

- `textContent(text)` in `edge/handlers/tools.ts` is the one builder of tool `content`. It calls `redactCredentials`. All six content sites use it. Outside comments the file holds one `type: "text"` literal and one `redactCredentials(` call.
- The marketplace list line for a url source with userinfo now reads `[project] url-mp -- 0 plugin(s) -- https://***@git.example.com/o/r`.
- `buildMarketplaceListResult` and `buildPluginListResult` hold the two tool bodies. Each `execute` is `try { return await build...Result(...) } catch (error: unknown) { return loadFailure(...) }`. The `marketplaceExists` lookup is now inside the caught body.
- `loadFailure(subject, error)` builds `{ content: textContent("Failed to load <subject>: <message>"), isError: true, details: { marketplaces: [] } }`.
- `details` and absolute paths are unchanged (D-02, D-05). `presentCascade(` still appears twice. TC-9 passes unmodified with the `state.json` path in its text.
- Five owner cases were added to `tests/edge/handlers/tools.test.ts`, with no deleted or changed line.
- The `04/` deferred item reads `status: resolved` and has a `**Resolved by:**` line.

## Task Commits

1. **09-01-01: Redact every content string both LLM tools return** - `bebad4e4` (fix). Hook: `npm run check:commit` Passed.
2. **09-01-02: Catch every failure of each tool body into the redacted TC-9 error result** - `6e1f282c` (fix). Hook: `npm run check:commit` Passed.
3. **09-01-03: Resolve the deferred item** - `bab73a51` (docs). Hook: gitlint Passed; `npm run check:commit` skipped (`.planning/` is not a build input).

Each fix commit holds exactly the source-test pair, so the RED tests were not committed on their own. The plan's commit contract bundles them, and the hook measures direct coverage per staged pair.

## TDD Evidence

- **09-01-01 RED:** `# tests 39`, `# pass 36`, `# fail 3`. The three new `redacts` cases failed on `deepStrictEqual`: each actual text carried the raw `ghp_abcdefghijklmnopqrstuv` token (url line, `ftp://user:ghp_...` load failure, not-found name).
- **09-01-01 GREEN:** `# tests 39`, `# pass 39`, `# fail 0`; three passing `redacts` titles.
- **09-01-02 RED:** `# tests 41`, `# pass 39`, `# fail 2`. Both `instead of throwing` cases rejected with `state.json marketplace "list-mp" ...` and `state.json marketplace "lookup-mp" ...`, each carrying the raw `ftp://user:ghp_...` source.
- **Final owner suite:** `# tests 41`, `# pass 41`, `# fail 0`; three `redacts` and two `instead of throwing` titles pass.
- **Direct coverage:** `npm run --silent test:coverage:direct -- tests/edge/handlers/tools.test.ts` exits 0 (100% line, function, and branch).

## Phase Gate

- `npm run check`: exit 0 at HEAD `bab73a518f8088a5d0043345ae871ef6b27097e6`, Node `v26.11.1`, run unpiped (output redirected to a scratch file), about 91 s.
- `npx fallow audit --base b30468c0 --format json --quiet`: verdict `pass` (0 dead-code issues, 0 complexity findings, 0 clone groups).
- D-08 diff check: `git diff --exit-code b30468c0 -- docs/output-catalog.md .planning/phases/01-presentation-model/notify-corpus/ tests/architecture/no-credential-leak.test.ts` exits 0.
- Scope check: the only committed changes outside `.planning/` since `b30468c0` are `tools.ts` and `tools.test.ts`.
- Suppression check: no added line under `extensions/` or `tests/` carries `fallow-ignore`, `eslint-disable`, `@ts-expect-error`, `@ts-ignore`, or `node:coverage`.
- `tools.test.ts` against `b30468c0`: 175 added lines, 0 deleted.
- `query audit-open`: prints its Open Artifact Audit header and lists 2 unresolved deferred items (07/ and 08/). The `04/` item is gone.

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/handlers/tools.ts` - `ListToolResult`, `textContent`, `loadFailure`, and the two extracted `build...Result` bodies; header paragraphs for PMOD-04 and TC-9.
- `tests/edge/handlers/tools.test.ts` - `FTP_SOURCE_WITH_TOKEN`, `seedUrlSourceMarketplace`, and five owner cases.
- `.planning/phases/04-wire-schema-and-json-strategy/deferred-items.md` - `status: resolved` and the `**Resolved by:**` pointer to `09/`, `bebad4e4`, and `6e1f282c`.

## Decisions Made

The orchestrator's four recorded resolutions, followed as written:

1. **D-03 kept as written.** Both tools return the TC-9 shape and never throw. **Pi 0.87.1 ignores a returned `isError`:** `executePreparedToolCall` marks every resolved execute as not an error (09-RESEARCH.md F3). The model reads the redacted text but sees no error flag. Throwing a redacted `Error` would carry Pi's error flag instead. This is left for the user to choose later (09-RESEARCH.md Open Question 1). No code comment claims that Pi marks the result as an error.
2. **D-07 deviation:** the status word is `resolved`, not `closed`. GSD's audit-open treats only `resolved` or `acknowledged` as closed, so `closed` would keep the item listed. The pointer line names `09/`. No REQUIREMENTS.md ID was added.
3. **D-08 deviation:** `scripts/notify-corpus.mjs` no longer exists (commit `0a11761d`). The corpus invariant is the path-scoped `git diff --exit-code b30468c0` over `docs/output-catalog.md` and the frozen notify corpus.
4. **Added case:** the optional not-found-line case is included. It is the only D-01 site whose text the LLM controls, which makes five owner cases.

Planner choices kept: one module-private builder (`textContent`) instead of a call at each return site; the two failure cases use the credential-bearing ftp fixture, so each also proves redaction on its own throw path.

## Deviations from Plan

None - plan executed exactly as written. (The D-07 and D-08 deviations from 09-CONTEXT.md above were recorded in the plan before execution.)

## Issues Encountered

- **Pre-existing case-count drift (not edited):** the `installNetworkCounter` JSDoc in `tests/edge/handlers/tools.test.ts` says a planted `https.request` call turns "28 of this suite's 53 cases red". The suite ran 36 cases at `b30468c0` and runs 41 now. This drift predates the change and is outside its scope.
- Flagged assumption 09-RESEARCH.md A1 remains uninspected: Pi 0.86.1 (the peer floor) is assumed to relay tool results as 0.87.1 does. Redaction is correct either way; only the meaning of `isError: true` could differ.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase complete. Next step: `/gsd-audit-milestone` to re-audit per D-07, then `/gsd-complete-milestone`.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/edge/handlers/tools.ts
- FOUND: tests/edge/handlers/tools.test.ts
- FOUND: .planning/phases/04-wire-schema-and-json-strategy/deferred-items.md
- FOUND: bebad4e4, 6e1f282c, bab73a51 (ancestors of HEAD)
- All acceptance criteria of 09-01-01, 09-01-02, and 09-01-03 re-ran green.

---
*Phase: 09-address-tech-debt-redact-llm-tool-error-text*
*Completed: 2026-10-11*
