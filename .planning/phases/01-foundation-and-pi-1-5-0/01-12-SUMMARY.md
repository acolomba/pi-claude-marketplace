---
phase: 01-foundation-and-pi-1-5-0
plan: "12"
subsystem: orchestrators
tags: [mcp, state-json, install-record, resolver, legacy-read, mrec-01, mrec-02]

requires:
  - phase: 01-foundation-and-pi-1-5-0 (01-03)
    provides: "domain/mcp-implementation.ts RecordedMcpServer and the RecordedMcpServers union (recorded, re-resolved, unreadable)"
  - phase: 01-foundation-and-pi-1-5-0 (01-08)
    provides: "PluginInstallRecord optional mcpServerConfigs and mcpBundle; resolver declaredMcpServers and mcpBundle"
provides:
  - "orchestrators/mcp/recorded-servers.ts recordedMcpServers(record, reader): the one reader of mcpServerConfigs (frozen interface 3, read side)"
  - "createLegacyServersReader(source): the production legacy reader, read-only and network-free, pinned to record.resolvedSource"
  - "LegacyServers, LegacyServersReader, LegacyServersSource, LegacyServersUnreadableError, LegacyServersUnreadableReason"
  - ".fallowrc.json entry and ignoreExports for recorded-servers.ts (Phase 6 removes them)"
affects: [mcp-builtin registration, effective compatibility, agent grants, list/info MCP markers]

actuals:
  tokens: 5250
  tasks: 2
  commits: 2
plan_head_before: cdef937310286fed2bc99c57505c00db3da94bd5
plan_head_after: ac523b8

tech-stack:
  added: []
  patterns:
    - "A legacy re-resolution pins both resolver root callbacks to the recorded plugin root, so no source kind can clone or fetch"
    - "Reader refusals are one typed error with a reason discriminant; the caller folds every failure into unreadable"

key-files:
  created:
    - extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts
    - test/orchestrators/mcp/recorded-servers.test.ts
  modified:
    - .fallowrc.json

key-decisions:
  - "recordedMcpServers returns the record's own mcpServerConfigs array (no copy), as the plan says; callers must not mutate it"
  - "createLegacyServersReader takes { marketplaceName, marketplace: Pick<marketplace record, manifestPath | marketplaceRoot | source>, pluginName }"
  - "The reader's refusals throw LegacyServersUnreadableError (reason not-in-manifest | unavailable | root-mismatch), defined in the module, not in shared/errors.ts"
  - "Both root callbacks are always set; pathPluginPin is set only when the record has resolvedSha; a git record without resolvedSha passes an empty sha, which the resolver never reads"
  - "MREC-01 is not marked complete in REQUIREMENTS.md: plan 01-14 also declares it and has no SUMMARY yet"

patterns-established:
  - "Read-only re-resolution of an installed plugin: cached manifest + lookupDeclaredPlugin + resolveStrict with recorded-root callbacks + root equality check"

requirements-completed: [MREC-01]

coverage:
  - id: D1
    description: "recordedMcpServers answers recorded (field present, empty array included, reader never called), re-resolved (field absent, reader called once with the record), or unreadable (reader rejects or throws)"
    requirement: "MREC-01"
    verification:
      - kind: unit
        ref: "test/orchestrators/mcp/recorded-servers.test.ts#recordedMcpServers (5 cases)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts (branches 22/22, functions 9/9, lines 160/160)"
        status: pass
    human_judgment: false
  - id: D2
    description: "createLegacyServersReader re-resolves path, entry-only, bundle, git (with and without sha), and tag-pinned path records from the recorded root without writing, and refuses not-in-manifest, unavailable, and root-mismatch"
    requirement: "MREC-01"
    verification:
      - kind: unit
        ref: "test/orchestrators/mcp/recorded-servers.test.ts#createLegacyServersReader (9 cases)"
        status: pass
      - kind: other
        ref: "git commit hook npm run check:commit (check:static incl. ESLint BLOCK F, fallow dead-code/health/dupes, Prettier, pairing; direct coverage of the staged pair)"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-11-04
status: complete
---

# Phase 1 Plan 12: recordedMcpServers and the legacy reader Summary

**`recordedMcpServers` reads a record's `mcpServerConfigs` as stored, or re-resolves a pre-field record read-only through `createLegacyServersReader` (cached `marketplace.json` + `resolveStrict` pinned to `record.resolvedSource`), and answers `unreadable` on any reader failure.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-11-04T07:35:33Z
- **Completed:** 2026-11-04T07:49:22Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Frozen interface 3, read side: `recordedMcpServers(record, reader)` in `orchestrators/mcp/recorded-servers.ts`. A present field (an empty array included) answers `recorded` and never calls the reader. An absent field answers `re-resolved` from the reader. A reader that rejects or throws answers `unreadable`, so `effectiveMcpCompatibility` keeps the stored verdict.
- Production legacy reader `createLegacyServersReader(source)`. It loads the cached manifest with `loadMarketplaceManifest`, looks the plugin up with `lookupDeclaredPlugin`, and runs `resolveStrict` with `resolveGitPluginRoot` and `resolvePathPluginRoot` both answering `{ kind: "materialized", pluginRoot: record.resolvedSource }`. `pathPluginPin` is set when the record has `resolvedSha`. It returns `declaredMcpServers` in D-CF6-01 merge order and `bundle` from `mcpBundle`. It throws when the manifest no longer lists the plugin, when the re-resolution is unavailable, and when the re-resolved root differs from the record.
- No git import and no `gitOps` name (ESLint BLOCK F passes). The git-source case snapshots the whole temp tree before and after and finds it unchanged.
- `.fallowrc.json`: the module is an `entry`, and its seven exports are in `ignoreExports`. These are exactly the names `fallow dead-code` reported without them.

## Task Commits

1. **Task 1: recordedMcpServers over a recorded field, a legacy reader, and a failing reader**: `ebdd1ab` (feat, tests and implementation together)
2. **Task 2: The production legacy reader, read-only from the recorded plugin root**: `ac523b8` (feat, tests and implementation together)

**Plan metadata:** the docs commit that follows this SUMMARY.

## TDD Gate Compliance

There are no RED-only `test(...)` commits. Both tasks committed tests and implementation together in one `feat(mcp)` commit (precedent P1-DC-28):

- A RED-only commit attempt for Task 1 reached the commit hook. The hook's `check:commit` refused it, first on a typecheck error (`thenThrow` does not exist on strong-mock promise stubs; the case now uses a plain throwing stub). With that fixed, the hook would refuse the commit on the failing tests, because it runs direct coverage of the staged pair. `--no-verify` and `test.skip` are forbidden.
- Commit scopes are `feat(mcp)`, not `feat(01-12)`, because the project bans plan IDs in titles and scopes. The tdd.md log grep (`^test\(01-12\)`) therefore finds nothing.

RED evidence, captured from the real runs before each GREEN:

- **Task 1 RED:** the source was a stub that always answered `unreadable`. Command: `node --test --test-reporter=tap test/orchestrators/mcp/recorded-servers.test.ts`, exit 1, 5 of 5 failing. Target: "MREC-01: returns the recorded servers and bundle without calling the legacy reader". Classifier: `RED_EVIDENCE_OK` (target_test_failed). Semantic assessment: the target ran and failed on its `deepStrictEqual`: it expected `kind: recorded` with servers [a, b] and got `kind: unreadable`. Not a load, syntax, or fixture fault. The rejecting-reader case failed in `verify(reader)` (expectation unmet). The throwing-reader case then used a strong-mock `thenThrow`; after the switch to a plain stub, it passes against that stub.
- **Task 2 RED:** the stub reader always resolved `{ servers: [], bundle: false }`. Same command, exit 1, 9 of 14 failing (all 9 reader cases; the 5 Task 1 cases passed). Target: "MREC-02: re-resolves a path-source plugin's .mcp.json and plugin.json servers in merge order". Classifier: `RED_EVIDENCE_OK`. Semantic assessment: the target failed on its `deepStrictEqual` (actual `servers: []` against alpha, beta, gamma), and the refusal cases failed because nothing rejected.
- **GREEN:** 14 of 14 pass. Direct coverage is 100% (branches 22/22, functions 9/9, lines 160/160).
- **REFACTOR:** none.

## Files Created/Modified

- `extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts`: `recordedMcpServers`, `createLegacyServersReader`, `LegacyServersUnreadableError`, and the `LegacyServers*` types.
- `test/orchestrators/mcp/recorded-servers.test.ts`: 14 cases. The legacy reader cases use real temp directories for the marketplace and plugin files.
- `.fallowrc.json`: the `entry` line and the `ignoreExports` block for recorded-servers.ts.

## Decisions Made

See `key-decisions` in the frontmatter. Each one a reviewer might reverse is also in Dubious Choices.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Typed refusal error and three extra reader cases**
- **Found during:** Task 2
- **Issue:** The plan says only "throw". The project's cases rule asks for errors asserted by class and structured fields. A bare `Error` cannot tell the three refusals apart, and a refusal test would pass for any thrown bug. Three branches also had no behavior bullet: the `resolvedSha ?? ""` fallback, the tag-pinned path arm, and the git-without-sha arm.
- **Fix:** Exported `LegacyServersUnreadableError` with `reason`, `plugin`, and `marketplace`. Added cases for a git record without `resolvedSha` and for a tag-pinned path record (D-07-06).
- **Files modified:** recorded-servers.ts, recorded-servers.test.ts, .fallowrc.json
- **Verification:** Direct coverage 100%. fallow dead-code clean with the extra ignoreExports names.
- **Committed in:** `ac523b8`

---

**Total deviations:** 1 auto-fixed (Rule 2).
**Impact on plan:** It adds one exported class and one type to the frozen file's surface. No scope creep beyond the module.

## Issues Encountered

- strong-mock promise stubs have no `thenThrow`. The synchronous-throw case uses a plain typed stub function.
- gitlint refused a 75-character title once. The retry used a shorter title.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-01-26 is mitigated as planned: the module has no git import, the root callbacks answer the recorded root, and a test asserts the temp tree is unchanged after a git-source read. T-01-27 is mitigated by reusing `resolveStrict`/`resolveStrictMcp` containment plus the root-equality refusal.

## Dubious Choices

- **(Medium) Tests and implementation committed together per task, with no RED-only commit.** Alternatives: a RED commit with `--no-verify` or `test.skip`, both forbidden; or a RED commit retried until the hook passes it, which cannot happen because `check:commit` runs the staged pair's tests. Why: P1-DC-28 precedent. A RED commit attempt for Task 1 was refused by the hook (typecheck first). RED evidence for both tasks was classified `RED_EVIDENCE_OK` before GREEN.
- **(Low) `LegacyServersUnreadableError` lives in recorded-servers.ts, not in `shared/errors.ts`.** Alternatives: add it to `shared/errors.ts`, the convention's home for typed errors, which is outside `files_modified` and shared with parallel plans; or throw a plain `Error`, which tests cannot tell apart. Why: only this module throws it and only `recordedMcpServers` catches it. It adds two names to `ignoreExports`.
- **(Low) A legacy git record without `resolvedSha` passes `resolvedSha: ""` in the synthetic `materialized` result.** Alternatives: answer `not-cached`, so such a record reads as `unreadable`. Why: the resolver reads only `pluginRoot` from that result, and the recorded root still holds the files install read.
- **(Low) `LegacyServersSource.marketplace` is a `Pick` of the marketplace record (`manifestPath`, `marketplaceRoot`, `source`), not the whole record.** Alternatives: the whole `ExtensionState` marketplace record, as the plan worded it. Why: a full record still satisfies the Pick, so callers pass the record itself. The frozen signature asks only for what the reader reads.
- **(Low) The root check is strict string equality with `record.resolvedSource`.** Alternatives: compare `path.resolve` or `realpath` forms. Why: install writes `resolved.pluginRoot` into `resolvedSource`, so the same resolution gives the same string. A record whose marketplace moved reads as `unreadable`, the safe arm.
- **(Low) `.fallowrc.json` edited (entry plus a seven-name `ignoreExports` block).** Plan 01-11 may also edit this file. The change touches only this module's lines. The orchestrator resolves the merge.
- **(Low) `npm run check:static` was not run separately before each commit.** Alternatives: run it by hand, then commit (the commit hook runs it again). Why: in this worktree the hook ran `check:commit` in full each time (check:static plus direct coverage of the staged pair) and passed on both commits. The committing skill says not to run the same checks right before the hook.
- **(Low) MREC-01 is not marked complete in REQUIREMENTS.md.** Plan 01-14 also declares it and has no SUMMARY, so the shared-ID gate would hold it anyway.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 (built-in registration) and Phase 3 (verdicts) can call `recordedMcpServers(record, createLegacyServersReader({ marketplaceName, marketplace, pluginName }))`.
- Phase 6 removes the `entry` and `ignoreExports` lines once a production module imports the file.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts
- FOUND: test/orchestrators/mcp/recorded-servers.test.ts
- FOUND: ebdd1ab, ac523b8 (ancestors of HEAD)
- Acceptance: `export async function recordedMcpServers` count 1; `recorded-servers.ts` in .fallowrc.json count 2; `export function createLegacyServersReader` count 1; no `platform/git` or `gitOps` in the module.

---
*Phase: 01-foundation-and-pi-1-5-0*
*Completed: 2026-11-04*
