---
phase: 09-url-source-kind-and-https-git-stand-in
plan: "05"
subsystem: notifications
tags: [cucumber, json-output, url-source, git-http-backend, d-19]

requires:
  - phase: 09-url-source-kind-and-https-git-stand-in
    provides: plan 09-04's per-repository status arms on HttpsGitHost and the step "the git host answers {int} for the marketplace {string}"
provides:
  - The Outline "Adding a url marketplace the git host answers with a server error fails as network error" (500, 502, 503) with exact cause chains, the bare child id, and request logs
  - PluginFailedMessage.marketplaceSubject?: true, set only by failedAddRow's child row
  - A module-private rowId in notification-json.ts that keeps a marketplace-subject row's redacted name as its JSON id
  - 09-05-RED.json, the recorded failing run of the three rows on the code before the fix
  - BACKLOG ROWID-01 and the WINDOWS 98 waiver for the rows that keep <mp>@<mp>
affects: [09-06, 09-08, phase-10-github-source, ROWID-01]

actuals:
  tokens: 10780
  tasks: 2
  commits: 3

plan_head_before: 1456887da444ac6dd76440b73685daee39f5f6b1
plan_head_after: d97bc1c42b494ecbe6158ff970b1c454acf721b3

tech-stack:
  added: []
  patterns:
    - "A row whose subject is not a plugin carries an optional literal-true marker on its message type; the wire layer narrows on `\"marker\" in row` and never on a name shape"

key-files:
  created:
    - .planning/phases/09-url-source-kind-and-https-git-stand-in/09-05-RED.json
  modified:
    - features/marketplace/url-source.feature
    - extensions/pi-claude-marketplace/shared/notification-types.ts
    - extensions/pi-claude-marketplace/shared/notification-json.ts
    - extensions/pi-claude-marketplace/shared/notification-wire.ts
    - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
    - tests/shared/notification-json.test.ts
    - tests/orchestrators/marketplace/add.test.ts
    - tests/architecture/no-credential-leak.test.ts
    - docs/json-output.md
    - CHANGELOG.md
    - .planning/BACKLOG.md
    - .planning/WINDOWS.md

key-decisions:
  - "rowId narrows with `\"marketplaceSubject\" in row` alone: under exactOptionalPropertyTypes the member is present only as `true`, so a second `=== true` test would be a branch no input can reach"
  - "The github failed-add child row under the base override shares failedAddRow, so it gets the same bare id; D-19 names it as the same failed git add child row"

patterns-established:
  - "A JSON-mode orchestrator unit case mirrors the import harness: createJsonCapture, a strict inventory mock behind openNotificationRun, ctx.mode returning json once, then capture.assertValid() and verify of both mocks"

requirements-completed: [ADD-10]

coverage:
  - id: D1
    description: "A url add answered 500, 502, or 503 fails as network error in one error cascade (Some operations have failed.), with one failed child row whose id is https://{git host}/acme/tools.git, cause chain <status> on https://{git host}/acme/tools.git, HTTP Error: <status> <phrase>, cause truncated false, and the log GET /acme/tools.git/info/refs?service=git-upload-pack <status>"
    requirement: ADD-10
    verification:
      - kind: e2e
        ref: "features/marketplace/url-source.feature#Adding a url marketplace the git host answers with a server error fails as network error"
        status: pass
    human_judgment: false
  - id: D2
    description: "toWirePayload gives a failed row that carries marketplaceSubject its name alone as the id; an unmarked failed row named like its block keeps <name>@<block>"
    requirement: ADD-10
    verification:
      - kind: unit
        ref: "tests/shared/notification-json.test.ts#gives a failed row whose subject is a marketplace its name alone as the id"
        status: pass
      - kind: unit
        ref: "tests/shared/notification-json.test.ts#appends the block name to a failed row named like its block without the marketplace marker"
        status: pass
    human_judgment: false
  - id: D3
    description: "addMarketplace in json mode, clone answered 503, appends one schema-valid claude-plugin payload whose child row id is the source as typed"
    requirement: ADD-10
    verification:
      - kind: unit
        ref: "tests/orchestrators/marketplace/add.test.ts#ADD-10: a failed git add's JSON child row takes the source as typed as its id"
        status: pass
    human_judgment: false
  - id: D4
    description: "Planted URL userinfo in a marketplace-subject row appears in neither the presentation, the JSON payload, nor the text"
    verification:
      - kind: unit
        ref: "tests/architecture/no-credential-leak.test.ts#AUTH-09 / PMOD-04: neither strategy shows a credential planted in the id of a failed row whose subject is a marketplace"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every other row id is unchanged: the whole cucumber suite passes, including the tools@tools and zeta@zeta cells of marketplaceFailureRows"
    verification:
      - kind: e2e
        ref: "npm run test:cucumber (324 scenarios, 324 passed)"
        status: pass
    human_judgment: false
  - id: D6
    description: "docs/json-output.md and CHANGELOG [Unreleased] state the new id; BACKLOG ROWID-01 carries the <mp>@<mp> rows; WINDOWS 98 is waived to it"
    verification:
      - kind: unit
        ref: "tests/architecture/json-output-docs.test.ts"
        status: pass
      - kind: other
        ref: "node .claude/gsd-core/bin/gsd-tools.cjs windows status (entry 98 waived, reason names ROWID-01)"
        status: pass
    human_judgment: false

duration: 11min
completed: 2026-10-21
status: complete
---

# Phase 9 Plan 05: Bare JSON id for a failed git add row Summary

**A url `marketplace add` answered 500, 502, or 503 is pinned as `network error` with its exact cause chain and request log. The child row of a failed git add now has the source as typed as its JSON id (`https://{git host}/acme/tools.git`), not `<url>@<url>`, through a `marketplaceSubject` marker that only `failedAddRow` sets. The change was shown red first through a real Pi. Every other row id is unchanged.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-21T04:06:47Z
- **Completed:** 2026-10-21T04:17:49Z
- **Tasks:** 2
- **Files modified:** 12, plus the new `09-05-RED.json`

## Accomplishments

- `features/marketplace/url-source.feature`: the 5xx Outline (three Examples rows). The file now has 9 scenarios.
- `notification-types.ts`: `PluginFailedMessage.marketplaceSubject?: true`, with an ADD-10 JSDoc.
- `notification-json.ts`: `wireRow` takes its id from a module-private `rowId(row, mp)`. That function returns the row name when the row carries `marketplaceSubject` or when the name holds `@`, and `<name>@<block>` otherwise. The name is the one `resolveRows` already redacted.
- `add.ts`: `failedAddRow`'s child row (`fetchedRow`) sets `marketplaceSubject: true`. The bare-row arm does not change.
- `notification-wire.ts`: the PLUGIN_ROW JSDoc names all three id forms. The schema does not change.
- Unit cases: two in `notification-json.test.ts`, one json-mode case in `add.test.ts`, and one probe row in `no-credential-leak.test.ts`.
- `docs/json-output.md`, `CHANGELOG.md` (one new top bullet, 14 in `[Unreleased]`), BACKLOG `ROWID-01`, and the WINDOWS 98 waiver.

## Task Commits

1. **Task 1: Give the failed git add child row its source as the JSON id, test-first** - `750badaa` (fix)
2. **Task 2: Document the id, record the change, and carry the remaining marketplace-level ids** - `ccf9106e` (docs: json-output and CHANGELOG), `d97bc1c4` (docs(planning): BACKLOG and WINDOWS)

**Plan metadata:** the `docs(planning)` commit that adds this SUMMARY and `09-05-RED.json`.

## RED evidence

**Cucumber (recorded in `09-05-RED.json`):** the Outline ran against HEAD `1456887d`, before any production edit. `notification-json.ts` at that commit contains no `marketplaceSubject`.

- Command: `npm run --silent test:cucumber -- features/marketplace/url-source.feature --parallel 1 --name '^Adding a url marketplace the git host answers with a server error fails as network error$' --format summary --format junit:<scratchpad>/09-05-red.xml`
- Exit 1. Result: `3 scenarios (3 failed)`, `24 steps (18 passed, 3 skipped, 3 failed)`. Run started at 2026-10-21T04:07:14.578Z, and the report was modified at 2026-10-21T04:07:19.476Z. Node v26.11.1.
- Each row (#1.1 = 500, #1.2 = 502, #1.3 = 503) passed `the result has these fields` and failed at `the result lists these plugins`, on the `id` cell alone. The actual id was `https://{git host}/acme/tools.git@https://{git host}/acme/tools.git`, and the expected id was `https://{git host}/acme/tools.git`. There was no Pi start error and no undefined step. The cells after the id were hidden in the diff, so the green run confirms the rest: once only the id changed, all three rows passed with the same cause chain and request log.
- `gsd-tools check tdd-red-evidence`: `RED_EVIDENCE_OK` for each of the three testcase names, each checked from its own temporary copy. Each copy was deleted afterwards, and no copy is left in the phase directory.

**Unit cases before the fix** (`node --test` strips types, so the new member was ignored at runtime):

| Case | Before the fix |
| --- | --- |
| `notification-json.test.ts` "gives a failed row whose subject is a marketplace its name alone as the id" | failed, only on `id` (`…tools.git@https://git.example/acme/tools.git` vs `…tools.git`) |
| `notification-json.test.ts` "appends the block name to a failed row named like its block without the marketplace marker" | passed (it pins the unmarked rule, which the fix keeps) |
| `add.test.ts` "ADD-10: a failed git add's JSON child row takes the source as typed as its id" | failed, only on `id` (`https://gitlab.example.com/team/flaky-mp@https://gitlab.example.com/team/flaky-mp`) |
| `no-credential-leak.test.ts` "...the id of a failed row whose subject is a marketplace" | passed (the name is redacted either way, as the plan expected) |

The plan said "the two id cases … fail". In fact, only the marked case failed. The unmarked case is the scope guard and passes on both sides of the fix.

## Verification evidence

Environment: Node v26.11.1, git version 2.55.0, cucumber-js 13.3.0.

| Stage | Command | Exit | Result |
| --- | --- | --- | --- |
| Task 1 | `npm run typecheck`; `npx eslint` (7 changed `.ts` files) | 0, 0 | clean |
| Task 1 | `npm run test:cucumber -- features/marketplace/url-source.feature --parallel 1` | 0 | `9 scenarios (9 passed)`, `73 steps (73 passed)` |
| Task 1 | `node --test` over `notification-json`, `add`, `no-credential-leak`, `catalog-wire`, `catalog-contract`, `wire-schema` | 0 | `ℹ tests 416`, `ℹ pass 416`, `ℹ fail 0` |
| Task 1 | `npm run test:coverage:direct -- notification-json.ts add.ts notification-types.ts` | 0 | no coverage shortfall reported |
| Task 1 | `npm run test:cucumber` | 0 | `324 scenarios (324 passed)`, `2946 steps (2946 passed)`, seed 255810 |
| Task 1 | `SKIP=npm-check pre-commit run --files` (8 files), then the commit hook (`npm run check:commit` Passed) | 0, 0 | `750badaa` |
| Task 2 | `SKIP=npm-check pre-commit run --files docs/json-output.md CHANGELOG.md` | 1, then 0 | mdformat realigned the plugin-row table on the first pass, and the second pass was clean |
| Task 2 | `node --test tests/architecture/json-output-docs.test.ts` | 0 | `ℹ tests 117`, `ℹ pass 117`, `ℹ fail 0` |
| Task 2 | `node .claude/gsd-core/bin/gsd-tools.cjs windows status` | 0 | entry 98 `"status": "waived"`, reason names `ROWID-01`; `open_count` 3 |
| Task 2 | commit hooks | 0, 0 | `ccf9106e`, `d97bc1c4` |

Acceptance checks:

- `rg -c marketplaceSubject` printed 1 for each of `notification-types.ts`, `notification-json.ts`, and `add.ts`.
- `rg -n marketplaceSubject orchestrators/marketplace/shared.ts` printed nothing.
- `git diff --quiet 72cb280f -- schema/claude-plugin.schema.json docs/output-catalog.md` exited 0.
- `grep -c tools@tools features/marketplace/remove.feature` printed 4.
- `grep -c 'source as typed' docs/json-output.md` printed 1.
- The CHANGELOG `[Unreleased]` bullet count is 14 (13 before).
- `grep -c '^## ROWID-01' .planning/BACKLOG.md` printed 1.
- `git status --short` printed only the untracked `09-05-RED.json` after each task commit.

Other pinned `<mp>@<mp>` values found by search are all `marketplaceFailureRows` rows that stay out of scope: `tests/edge/register.test.ts` `demo@demo` (marketplace info) and `tests/orchestrators/marketplace/update.test.ts` `zeta@zeta`. Both pass unchanged.

## Files Created/Modified

- `features/marketplace/url-source.feature` - the 5xx Outline
- `extensions/pi-claude-marketplace/shared/notification-types.ts` - `marketplaceSubject` on `PluginFailedMessage`
- `extensions/pi-claude-marketplace/shared/notification-json.ts` - `rowId` and the `wireRow` JSDoc
- `extensions/pi-claude-marketplace/shared/notification-wire.ts` - PLUGIN_ROW JSDoc
- `extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` - the marker on `failedAddRow`'s child row
- `tests/shared/notification-json.test.ts`, `tests/orchestrators/marketplace/add.test.ts`, `tests/architecture/no-credential-leak.test.ts` - the new cases
- `docs/json-output.md`, `CHANGELOG.md` - the documented id
- `.planning/BACKLOG.md`, `.planning/WINDOWS.md` - ROWID-01 and the waiver of entry 98
- `.planning/phases/09-url-source-kind-and-https-git-stand-in/09-05-RED.json` - the RED record

## Decisions Made

- `rowId` checks `"marketplaceSubject" in row` with no extra `=== true`. The type is `?: true` under `exactOptionalPropertyTypes`, so the key is present only as `true`. The extra test would add a branch that no input can reach.
- The json-mode `add.test.ts` case sizes its strict mocks to measured reads: `ctx.mode` once, `getAllTools` three times, and `getCommands` once. It verifies both mocks after the payload assertion.

## Deviations from Plan

None - plan executed exactly as written. The plan expected both new `notification-json` id cases to fail before the fix. Only the marked one did, because the unmarked one pins behavior the fix keeps (see RED evidence). This is a correction to the plan's prediction, not a code change.

## Issues Encountered

- The cucumber assertion diff hides the cells after the id behind "Skipped lines". So the RED record's semantic assessment relies on the green run to show that the id was the only difference.

## Flagged assumptions (carried from the plan)

- `HTTP Error: <status> <phrase>` takes its phrase from the stand-in's Node (`http.STATUS_CODES`). It was measured on Node 26.11.1 here. Node 24 (CI) is assumed to give the same phrases.
- The github failed-add child row under the base override (Phase 10) uses the same builder, so it gets the same bare id.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 09-06 can reuse the status and drop arms for UPD-11. A failed `marketplace update` row still uses `marketplaceFailureRows` and keeps `<mp>@<mp>` (ROWID-01).
- The orchestrator still owes the post-wave `npm run check` on the combined tree (AGENTS.md, Build verification). This executor ran `check:commit` through the hook on each commit, plus the commands above.

## Self-Check: PASSED

- FOUND: features/marketplace/url-source.feature, extensions/pi-claude-marketplace/shared/notification-json.ts, .planning/phases/09-url-source-kind-and-https-git-stand-in/09-05-RED.json
- FOUND: 750badaa, ccf9106e, d97bc1c4 are ancestors of HEAD
- No temporary RED copy is left in the phase directory
- All `<acceptance_criteria>` and `<verify>` commands passed on the committed tree

---
*Phase: 09-url-source-kind-and-https-git-stand-in*
*Completed: 2026-10-21*
