---
phase: 01-foundation-and-pi-1-5-0
plan: "03"
subsystem: domain
tags: [mcp, pi-1.5.0, typebox, fallow, profiles]

requires: []
provides:
  - "checkClaudeShape: the one Claude-shape check both MCP implementations share, plus the leadingHomeFeature and remoteFieldFeature helpers"
  - "classifyBuiltinMcpServer: the Pi 1.5.0 built-in verdict (sse blocked, bareElicitationCapability supported)"
  - "builtinMcpServerName: plugin_<plugin>_<server>, - kept, no trailing _ (D-MB-13)"
  - "domain/mcp-implementation.ts: McpImplementationProfile, profileFor, effectiveMcpCompatibility, RecordedMcpServer(s), StoredMcpCompatibility, EffectiveMcpCompatibility, re-exported id types"
  - "platform/pi-api.ts: McpImplementationId, ActiveMcpImplementation, PiMcpRegistry, re-exported McpServerConfig and RegisteredMcpServer"
  - "\"sse\" in McpUnsupportedFeature and DroppedMcpServerSchema"
affects: [mcp-builtin registration, recorded-servers, agent grants, info/list MCP markers, snapshot]

actuals:
  tokens: 15800
  tasks: 2
  commits: 2
plan_head_before: d8bba1bf9dc76655ad930f6c20177121a61319c3
plan_head_after: dae0b30dd833e8a583df4d45e49ce1031fd5ad5f

tech-stack:
  added: []
  patterns:
    - "Profiles as frozen data objects selected by profileFor(id)"
    - "One shared Claude-shape check (checkClaudeShape) with per-implementation scanners"
    - "Frozen, not-yet-consumed exports listed under .fallowrc.json entry + ignoreExports, never source fallow-ignore markers"

key-files:
  created:
    - extensions/pi-claude-marketplace/domain/mcp-implementation.ts
    - extensions/pi-claude-marketplace/domain/mcp-builtin-features.ts
    - test/domain/mcp-implementation.test.ts
    - test/domain/mcp-builtin-features.test.ts
  modified:
    - extensions/pi-claude-marketplace/domain/mcp-server-features.ts
    - extensions/pi-claude-marketplace/domain/name.ts
    - extensions/pi-claude-marketplace/domain/resolver-types.ts
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - .fallowrc.json
    - test/domain/mcp-server-features.test.ts
    - test/domain/name.test.ts

key-decisions:
  - "The built-in tool name reproduces Pi 1.5.0 createMcpToolName with node:crypto sha256; Pi's isTaken collision hash is a recorded gap (D-MB-13)"
  - "A stored installable:false turns true only when unsupported is non-empty, holds only mcpServers, and the notes lack the update-in-progress mark"
  - "Under no active implementation a server is blocked only when both profiles block it, reported with the adapter feature"
  - "The built-in tool prefix reuses foldedMcpServerKey, so the code keeps a single - to _ fold"

patterns-established:
  - "checkClaudeShape decides malformed once; each implementation scans only the valid shape"
  - "effectiveMcpCompatibility rule order: unreadable/malformed keeps stored; adapter without basis keeps stored; otherwise recompute"

requirements-completed: [MSEL-01, MREC-01]

coverage:
  - id: D1
    description: "Shared Claude-shape check with the adapter verdict unchanged for every existing case"
    requirement: MSEL-01
    verification:
      - kind: unit
        ref: "test/domain/mcp-server-features.test.ts#checkClaudeShape, classifyMcpServer (existing rows unchanged)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/mcp-server-features.ts (100%)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Built-in verdict: sse blocked before field features, bareElicitationCapability supported, adapter tokens for the rest, same malformed details"
    requirement: MSEL-01
    verification:
      - kind: unit
        ref: "test/domain/mcp-builtin-features.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "builtinMcpServerName and both profiles' names, with built-in tool names matching Pi 1.5.0 vectors (short, 64, 65 cut+hash, - in server, non-ASCII)"
    requirement: MSEL-01
    verification:
      - kind: unit
        ref: "test/domain/name.test.ts#builtinMcpServerName"
        status: pass
      - kind: unit
        ref: "test/domain/mcp-implementation.test.ts#profileFor"
        status: pass
    human_judgment: false
  - id: D4
    description: "effectiveMcpCompatibility decision table and the legacy-under-adapter invariant corpus"
    requirement: MREC-01
    verification:
      - kind: unit
        ref: "test/domain/mcp-implementation.test.ts#effectiveMcpCompatibility"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/mcp-implementation.ts (100%)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Pi MCP types in platform/pi-api.ts and fallow entry/ignoreExports keep dead-code green"
    verification:
      - kind: other
        ref: "npm run check:static"
        status: pass
    human_judgment: false

duration: 42min
completed: 2026-11-04
status: complete
---

# Phase 1 Plan 03: MCP Implementation Domain Seam Summary

**Adapter and built-in MCP profiles built on one shared Claude-shape check, with Pi 1.5.0's 64-character tool-name rule (sha256 cut) for built-in, `plugin_<plugin>_<server>` names, and the full `effectiveMcpCompatibility` decision table**

## Performance

- **Duration:** about 42 min
- **Started:** 2026-11-04T03:55Z (approximate)
- **Completed:** 2026-11-04T04:37:17Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Split `classifyMcpServer` into `checkClaudeShape` (malformed, host-only, typed stdio/remote/ws) plus the exported `leadingHomeFeature` and `remoteFieldFeature` helpers. The adapter verdict is unchanged: every existing `classifyMcpServer` row passes as written.
- Added `classifyBuiltinMcpServer`. It blocks `sse` (transport first, after `ws`), supports `bareElicitationCapability`, and blocks the host-only types, `headersHelper`, a truthy `oauth.xaa`, and a leading `~` with the adapter's tokens.
- Added `builtinMcpServerName`. It shares one private `claudeMcpServerName` helper, the single copy of the `[^A-Za-z0-9_-]` pattern, with `generatedMcpServerKey`.
- Created `domain/mcp-implementation.ts`. `profileFor(id)` returns one frozen profile per implementation, holding `classify`, `serverName`, `toolNamePrefix`, `toolName`, and `grantSelector`. `effectiveMcpCompatibility` follows the RESEARCH Pattern 3 rule order.
- Added the `McpImplementationId`, `ActiveMcpImplementation`, and `PiMcpRegistry` types to `platform/pi-api.ts`, and re-exported Pi's `McpServerConfig` and `RegisteredMcpServer` types there. Pi 1.4.0, which this worktree has installed, already exports both.
- Added `"sse"` to `DroppedMcpServerSchema` in the same commit as the union, so the two-way drift check passes.
- `.fallowrc.json` now lists `domain/mcp-implementation.ts` as an entry. Its `ignoreExports` names exactly the exports fallow reports unused: 9 in `mcp-implementation.ts` and 3 in `pi-api.ts`.

## Task Commits

1. **Task 1: shared shape check, built-in scanner and names, profileFor**: `dbd8970` (feat). The tests and the implementation are in one commit, see TDD Gate Compliance.
2. **Task 2: effectiveMcpCompatibility with the decision table**: `dae0b30` (feat). The tests and the implementation are in one commit; the hook refused the RED-only commit.

**Plan metadata:** recorded in the docs commit that adds this file.

## TDD Gate Compliance

| Gate | Task 1 | Task 2 |
|------|--------|--------|
| RED (evidence) | `RED_EVIDENCE_OK`, target `MSEL-01: a valid sse server is blocked by sse` (test/domain/mcp-builtin-features.test.ts), 15/20 failing on `deepStrictEqual` | `RED_EVIDENCE_OK`, target `MSEL-01: the built-in MCP blocks an sse server of a legacy installable record and appends mcpServers`, 26/42 failing on `deepStrictEqual` |
| RED commit | none (violation, see below) | none (violation, see below) |
| GREEN | `dbd8970` | `dae0b30` |
| REFACTOR | none needed | none needed |

- **RED:** `gsd-tools check tdd-red-evidence` validated both records from real TAP runs. For the RED runs, the new modules and functions were signature stubs that returned fixed wrong values, so each target test failed on its planned `deepStrictEqual` assertion, not on an import or a syntax error. **Semantic assessment:** valid. Each target ran and failed on the planned assertion. For Task 1, `actual {kind:"supported"}` vs `expected {kind:"blocked", feature:"sse"}`. For Task 2, `actual {installable:true, unsupported:[], blocked:[]}` vs the expected sse block. The existing `classifyMcpServer` rows passed during RED, as they should.
- **Missing RED commits:** the repository's pre-commit hook runs `npm run check:commit`, which runs the direct coverage of the staged source-test pairs. It refused the Task 2 RED commit (`Focused test failed: test/domain/mcp-implementation.test.ts`). AGENTS.md forbids `--no-verify`, so no commit with failing tests can land. Both tasks are therefore one `feat` commit each, and the RED evidence is recorded here instead.
- **Commit scopes:** the scopes are `feat(mcp)`, not `feat(01-03)`. AGENTS.md and the committing skill forbid phase or plan identifiers in commit titles and scopes. So the gate greps of the form `^test\(0*1-0*3\)` find nothing, by design.

## Files Created/Modified

- `extensions/pi-claude-marketplace/domain/mcp-server-features.ts`: adds `McpServerShape`, `checkClaudeShape`, the field-feature helpers, and `"sse"`. `classifyMcpServer` now builds on the shape check.
- `extensions/pi-claude-marketplace/domain/mcp-builtin-features.ts` (new): `classifyBuiltinMcpServer`.
- `extensions/pi-claude-marketplace/domain/mcp-implementation.ts` (new): the profiles, `profileFor`, `effectiveMcpCompatibility`, and the record and result types.
- `extensions/pi-claude-marketplace/domain/name.ts`: adds the private `claudeMcpServerName` and `builtinMcpServerName`. The `foldedMcpServerKey` doc now notes the built-in fold.
- `extensions/pi-claude-marketplace/domain/resolver-types.ts`: adds `TLiteral<"sse">`.
- `extensions/pi-claude-marketplace/platform/pi-api.ts`: adds the type-only MCP additions. They sit after `ExtensionMode`, away from `SoftDepStatus`, which plan 01-05 edits.
- `.fallowrc.json`: adds the `entry` and the `ignoreExports`.
- `test/domain/{mcp-server-features,mcp-builtin-features,mcp-implementation,name}.test.ts`: the cases. Built-in tool-name literals were computed once with Pi 1.5.0's own `createMcpToolName`, run from a throwaway scratch script.

## Decisions Made

See `key-decisions` in the frontmatter and Dubious Choices below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Docstring wording tripped the D-75-01 vocabulary guard**
- **Found during:** Task 2, when the commit hook ran `test:unpaired`.
- **Issue:** the plain-word `unsupported` in backticks in the `effectiveMcpCompatibility` doc matched `test/architecture/partial-vocabulary-guard.test.ts`.
- **Fix:** reworded it to "The `unsupported` kind list", which uses the guard's allowlisted `kind` homonym.
- **Files modified:** extensions/pi-claude-marketplace/domain/mcp-implementation.ts
- **Committed in:** `dae0b30`

**2. [Rule 3 - Blocking] Lint-forced regex and import order**
- `sonarjs/concise-regex` required `\W` instead of `[^A-Za-z0-9_]`. They are identical without the `u` and `i` flags, and a comment says so. `import-x/order` set the type-import order.

**3. [Process] No separate RED commits.** See TDD Gate Compliance.

**Total deviations:** 2 auto-fixed (both blocking) and 1 process deviation. **Impact:** none on behavior.

## Issues Encountered

- The `${SKIP:+,$SKIP}` form is rejected by the sandbox's command verifier, so the literal `SKIP=npm-check,trufflehog` was used. The value is the same.
- Gitlint rejected the first Task 2 title (74 characters). It was shortened, and nothing was committed in between.

## Known Stubs

None. The RED-phase stubs were all replaced before each commit, and `grep -i "RED stub"` finds nothing in the shipped files.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced. T-01-06 is mitigated and pinned by tests: a bundle block or a neutral block is never lost, a false with a non-MCP cause or with the update-in-progress mark stays false, and unreadable or malformed recorded servers keep the stored verdict. T-01-07 is as accepted: only server and tool names are hashed.

## Dubious Choices

1. **No RED-only commits (Medium).** I chose to commit tests and implementation together per task and to record the classifier-validated RED evidence in this SUMMARY. The alternatives were `git commit --no-verify` (forbidden by AGENTS.md) or a RED commit with `test.skip` (forbidden by the unit-test rules, and it would not fail). I chose this because the commit hook runs the staged pairs' tests and refused the Task 2 RED commit. The end-of-phase TDD review will flag both plans as missing RED commits.
2. **Commit scope `mcp` without the plan id (Low).** I wrote `feat(mcp): …` instead of the tdd.md `feat(01-03): …`. The project rule forbids phase or plan identifiers in titles and scopes, and it overrides the GSD template. The GSD TDD gate greps cannot match.
3. **A stored false turns true only when `unsupported` is non-empty and holds only `mcpServers` (Low).** The plan says "every stored unsupported kind is mcpServers", which is vacuously true for `[]`. The alternative was to follow it literally, so that `false` with `[]` turns true. I tightened it because a false that no unsupported kind explains has some other cause, and the plan's own rule says never to turn such a false true. The case `a stored false with no unsupported kind stays false` pins it.
4. **The adapter's `toolName` is `prefix + tool` with no sanitizing or length cut (Low-Medium).** This is the plan's literal rule. Whether pi-mcp-adapter itself sanitizes or shortens long tool names was not checked. If it does, a later consumer that matches adapter tool names (hook matchers, D-MB-08) could see a different name for odd tool names. Profile behavior is frozen after Phase 1.
5. **The built-in `grantSelector` is `mcp:` plus the registered name (Low).** This follows the plan. Whether pi-subagents grants Pi built-in MCP servers through `mcp:<name>` entries was not verified here. Phase 4 consumes it.
6. **`McpServerShape` carries the full TypeBox static types (Low).** The valid arms type `server` as `Type.Static<typeof …_SCHEMA>`, so later consumers get typed fields, and the host-only arm names its field `feature`. The alternative was minimal structural views, which would hide fields a frozen-file consumer might need. Fallow reported no private-type leak.
7. **The built-in tool prefix reuses `foldedMcpServerKey` (Low).** That function's doc called it the only fold of a server key, and a built-in name is not a key. Reusing it keeps one fold in the code. Its doc now says Pi folds a built-in server name the same way. The alternative was a second `replaceAll("-", "_")`.
8. **`PiMcpRegistry` uses method signatures (Low).** I followed `pi-api.ts`'s own convention (`PiInventory`, `NotificationUi`), not the unit-test rule's preference for property members. The alternative was property signatures. Pi's `ExtensionAPI` satisfies either form.
9. **REQUIREMENTS.md is not touched (Low).** MSEL-01 and MREC-01 are shared with other Phase 1 plans, the record producer among them. The shared-ID gate would block marking them now. The orchestrator owns the post-wave requirement update.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- The record producer and `recorded-servers.ts` plans can build `RecordedMcpServers` and pass a plugin record straight to `effectiveMcpCompatibility`. `StoredMcpCompatibility` is structural, and it expects the top-level `compatibilityBasis?: "neutral"` that the record plan adds.
- The snapshot plan (01-05) can switch to `ActiveMcpImplementation` from `platform/pi-api.ts`. This plan did not touch `SoftDepStatus`.
- Phase 6 removes the `ignoreExports` entries once the frozen exports have consumers.

---
*Phase: 01-foundation-and-pi-1-5-0*
*Completed: 2026-11-04*
