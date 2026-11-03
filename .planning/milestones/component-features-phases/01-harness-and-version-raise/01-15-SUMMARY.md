---
phase: 01-harness-and-version-raise
plan: 15
subsystem: infra
tags: [pi, version-raise, e2e, pi-api, docs, pi-mcp-adapter, pi-subagents, pi-dynamic-workflows]

requires: []
provides:
  - Exact Pi 1.4.0 e2e peer-floor fixture; resolvePeerFloor asserts 1.4.0
  - "`ThinkingLevel` and `InputSource` type aliases on the frozen Pi boundary (platform/pi-api.ts)"
  - Companion pins 7.0.0 / 0.84.0 / 3.15.0 in scripts/pi.sh and the operator-run canaries
  - README, README.es, CHANGELOG, AGENTS.md, STACK.md, and the MCP / workflow / env-var docs naming the new floors
affects: [02-skills, 03-slash-commands, 05-hooks, 06-mcp-servers, 07-workflows]

actuals:
  tokens: 35000   # chars/4 over the realized diff (141830 chars, of which ~100k is the regenerated fixture lock)
  tasks: 3
  commits: 3
plan_head_before: fa95fecf60648e0fadba1d24d2090fb1bd82642f
plan_head_after: 7eda9ce7a8dd4b32b47bc74d4be4de8f1361e387

tech-stack:
  added: []
  patterns:
    - "Pi types the component phases need are derived on the NFR-11 boundary from root-exported peer types (no new peer import), each proven with a `Same<>` pair plus a `@ts-expect-error` negative."

key-files:
  created: []
  modified:
    - test/e2e/pi-peer-floor/package.json
    - test/e2e/pi-peer-floor/package-lock.json
    - test/e2e/pi-json-output.test.ts
    - extensions/pi-claude-marketplace/platform/pi-api.ts
    - test/platform/pi-api.test.ts
    - extensions/pi-claude-marketplace/platform/workflow-home.ts
    - scripts/pi.sh
    - test/live-uat/mcp-adapter-canary.mjs
    - test/live-uat/workflow-storage-canary.mjs
    - README.md
    - README.es.md
    - CHANGELOG.md
    - AGENTS.md
    - .planning/codebase/STACK.md
    - docs/mcp-compatibility.md
    - docs/workflows-compatibility.md
    - docs/env-vars.md
    - test/live-uat/README.md

key-decisions:
  - "ThinkingLevel and InputSource carry inline `fallow-ignore-next-line unused-type` markers: no Phase 1 production code consumes them, and fallow's production dead-code gate fails an unused type export."
  - "docs/env-vars.md line 164 keeps its 5.2.0 measurement and adds that the resolveEnv call site was re-read in 7.0.0, because only that path was re-checked, not the whole paragraph."
  - "workflow-home.ts keeps its 'releases before 3.14.0 ignore the variable' sentence (still true); only the provenance line names 3.15.0."

patterns-established:
  - "Frozen Pi boundary: export a Pi type before its consumer exists, with a fallow unused-type marker that names NFR-11 and the decision that will consume it."

requirements-completed: [VER-01, VER-03, VER-06]

coverage:
  - id: D1
    description: "A real Pi at exactly 1.4.0 runs the extension, and its JSON output validates against the published payload schema."
    requirement: VER-01
    verification:
      - kind: e2e
        ref: "PI_CM_E2E_REF=pinned node --test test/e2e/pi-json-output.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "ThinkingLevel and InputSource exported from platform/pi-api.ts and proven equal to the peer's own types."
    verification:
      - kind: unit
        ref: "node --test test/platform/pi-api.test.ts; npm run test:coverage:direct -- extensions/pi-claude-marketplace/platform/pi-api.ts; npm run typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "README.md / README.es.md, CHANGELOG.md, AGENTS.md, STACK.md, and the compatibility docs name the new floors; READMEs stay in sync."
    requirement: VER-06
    verification:
      - kind: other
        ref: "Task 3 <verify> greps plus SKIP=npm-check pre-commit run --files <docs>"
        status: pass
    human_judgment: true
    rationale: "Wording quality of the README and CHANGELOG lines and the Spanish translation are reader judgments that the greps do not assert."

duration: 41min
completed: 2026-11-01
status: complete
---

# Phase 1 Plan 15: Pi 1.4.0 floor fixture, Pi type aliases, and version docs Summary

**The e2e peer-floor fixture now runs a real Pi 1.4.0, `platform/pi-api.ts` exports `ThinkingLevel` and `InputSource` for the D-CF1-01 invocation handlers, and every document, script, and canary that states a requirement names Pi 1.4.0, pi-subagents 0.84.0, pi-mcp-adapter 7.0.0 (7.x), and engine 3.15.0 (3.x).**

## Performance

- **Duration:** about 41 min
- **Started:** 2026-11-01T01:48Z (approximate)
- **Completed:** 2026-11-01T02:29:07Z
- **Tasks:** 3
- **Files modified:** 18

## Accomplishments

- The pinned peer-floor test passes 8/8 on `@earendil-works/pi-coding-agent` 1.4.0 (VER-01, VER-03).
- Two Pi type aliases with `Same<>` proofs and `@ts-expect-error` negatives. 100% direct coverage of `pi-api.ts`.
- Version lines updated in 9 documents, `scripts/pi.sh`, and the two canaries. Dated measurement statements keep the version that was measured.

## Task Commits

1. **Task 1: Prove the Pi 1.4.0 floor with the exact-version e2e fixture** - `8b191cb` (see Deviation 1: the commit carries the wrong message)
2. **Task 2: Export the Pi types and move the companion pins** - `5c0df6b` (feat)
3. **Task 3: Name the new versions in the README, the CHANGELOG, and the docs** - `7eda9ce` (docs)

## Red run of the floor (Task 1, step 1)

With the old 1.0.0 fixture installed (`npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts`) and both `resolvePeerFloor` assertions changed to `"1.4.0"`, `PI_CM_E2E_REF=pinned node --test test/e2e/pi-json-output.test.ts` exited 1: `# tests 8`, `# pass 4`, `# fail 4`. Each of the four peer-floor tests failed on `'1.0.0' !== '1.4.0'` (expected `1.4.0`, actual `1.0.0`). After the fixture regeneration, the same command passed 8/8. The new lock resolves all 121 packages from `https://registry.npmjs.org/` with integrity hashes. `@earendil-works/pi-coding-agent` has no install script (`npm view` scripts list has no `preinstall`/`install`/`postinstall`), and both installs used `--ignore-scripts` (T-01-04, T-01-SC).

## RED evidence for the type aliases (Task 2)

Before the aliases existed, `npx tsc --noEmit` reported `TS2694 ... has no exported member 'ThinkingLevel'` at `test/platform/pi-api.test.ts:136` and the same for `'InputSource'` at line 142. After the aliases: 53/53 tests pass, typecheck is clean (no unused `@ts-expect-error`), and direct coverage is 100%.

## Pi event types the component phases name

| Event | Phase that subscribes | Boundary type | Already exported? |
| --- | --- | --- | --- |
| `session_start` with reasons `new`, `fork`, `reload` | Hooks (5) | `SessionStartEvent` (reason union `"startup" \| "reload" \| "new" \| "resume" \| "fork"`) | Yes |
| `session_compact` | Hooks (5) | `SessionCompactEvent` | Yes |
| `session_shutdown` | Hooks (5) | `SessionShutdownEvent` | Yes |
| `input` | Skills (2), Commands (3) | `InputEvent`, `InputEventResult` | Yes |

No event type was missing. D-CF1-10, D-CF1-11, and D-CF1-12 need no new type. The only additions are `ThinkingLevel` (`ReturnType<ExtensionAPI["getThinkingLevel"]>`) and `InputSource` (`InputEvent["source"]`). The worktree's Pi is still 1.3.0 because plan 01-01 raises it in parallel. Per the research, both aliases are identical on 1.3.0 and 1.4.0. The 1.3.0 `types.d.ts` has `InputSource = "interactive" | "rpc" | "extension"`, and pi-agent-core has `ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max"`.

## Engine 3.15.0 storage-root check

`npm pack @quintinshaw/pi-dynamic-workflows@3.15.0` was extracted in a fresh scratch directory outside the repository, and only read. `src/workflow-paths.ts` `workflowHomeDir()` still returns `join(getAgentDir(), "workflows")` when `process.env.PI_CODING_AGENT_DIR` is truthy, and `join(homedir(), ".pi/workflows")` otherwise. The rule did not change, so the `workflow-home.ts` comment names 3.15.0. Nothing to report for Phase 7. The 3.15.0 metadata also peers on `@earendil-works/pi-coding-agent >=0.80.8` and `@earendil-works/pi-tui >=0.80.6`, and the `docs/workflows-compatibility.md` line 192 edit cites this. Its `pi.extensions` entry is `extensions/workflow.ts`, as STACK.md now says. pi-mcp-adapter 7.0.0 keeps `./index.ts` as its `pi.extensions` entry, so the canary's entry check still holds.

## CHANGELOG PR number (request for the parent)

The new `[Unreleased]` top line ends without a PR number because the milestone pull request does not exist yet. When it opens, append ` (#NNN)` after the final period of `The extension now needs Pi 1.4.0 or newer, and each companion extension now needs its latest release.`

## Decisions Made

- The InputSource proof cites D-CF1-01, because the invocation handlers of D-CF1-01 filter on the source. The plan's interface note names "the invocation handlers' source filter".
- `docs/env-vars.md` line 3 now names 7.0.0. It points at the MCP compatibility "Variables" section, which the plan 01-01 conformance test re-proves on 7.0.0. Line 164 keeps 5.2.0 and adds that the `resolveEnv` call site was re-read in 7.0.0. `resolveEnv` still copies `process.env` and then resolves declared values through `resolveCommandSecretsRecord`, and `resolveCommandSecret` keeps the `!`/`!!` rules. Two parts are new in 7.0.0. A built-in agent plugin's `env` is now literal, and `args` and `cwd` gained literal branches for built-in agent plugins. This extension writes neither.
- `docs/mcp-compatibility.md` lines 7 and 435 and every other dated measurement stay as written. Phase 6 re-measures them on 7.x (FG-30).
- `docs/workflows-compatibility.md` line 200 adds one sentence, "This extension declares 3.15.0 as its lowest supported engine version.", so the reader knows why 3.15.0 is named. The existing 3.14.0 fix and `PI_CODING_AGENT_DIR` sentences stay, because they are still true.
- The canary scratch prefix was renamed from `/var/tmp/mcp-adapter-520` to `/var/tmp/mcp-adapter-700`, in the canary hint and in the live-UAT README run commands, so the prefix matches the version.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The fallow production dead-code gate rejected the two new type exports**
- **Found during:** Task 2 commit hook
- **Issue:** `fallow dead-code` reported `ThinkingLevel` and `InputSource` as unused type exports. No Phase 1 production module consumes them, and no other phase-1 plan names them.
- **Fix:** Each alias got a `// fallow-ignore-next-line unused-type -- NFR-11: ...` marker. The `bridges/hooks/async-rewake/registry.ts` precedent puts the marker the same way.
- **Files modified:** extensions/pi-claude-marketplace/platform/pi-api.ts
- **Verification:** `npm run fallow` exit 0. The commit hook passed.
- **Committed in:** 5c0df6b

**2. [Rule 3 - Blocking] Environment: the commit hook fails as root on chmod-based tests, and ESLint ran out of heap on a cold cache**
- **Found during:** Task 1 commit hook
- **Issue:** The staged fixture lock and the `test/live-uat/` files are test support, so the hook runs every source-test pair. This session runs as root, which ignores file modes. `test/bridges/agents/stage.test.ts` ("index persistence failure rolls back ...") and `test/bridges/agents/discover.test.ts` ("rejects an unreadable markdown entry ...") then fail with "Missing expected rejection". The failures predate this plan, and the plan does not touch those files. The first hook run also hit an ESLint `JavaScript heap out of memory` on a cold cache.
- **Fix:** `NODE_OPTIONS=--max-old-space-size=6144 npm run lint` warmed the ESLint cache once (exit 0). Each commit ran as `env npm_config_script_shell=<scratch>/nodac-sh git commit -F <msg>`. The wrapper runs every npm script under `setpriv --bounding-set=-dac_override,-dac_read_search /bin/sh`, so the hook's checks see file modes the way a non-root user does. The hook ran in full every time. No `--no-verify`, no `SKIP` of npm-check at commit time.
- **Verification:** both suites pass 45/45 without DAC override. All three commit hooks passed.

**3. [Process] Task 1's commit carries the wrong message**
- **Found during:** Task 1 commit
- **Issue:** I wrote the commit message to `<scratchpad>/msg1.txt`. The scratchpad is shared across the session's parallel agents, and the plan 01-01 agent overwrote the same file name before my `git commit -F`. Commit `8b191cb` therefore reads `build(deps): raise Pi to 1.4.0 and the companion floors` with 01-01's body. It contains only this plan's three Task 1 files (`test/e2e/pi-json-output.test.ts`, `test/e2e/pi-peer-floor/package.json`, `test/e2e/pi-peer-floor/package-lock.json`). Its intended message was `test(e2e): prove the Pi 1.4.0 floor with an exact-version fixture`.
- **Fix:** None possible without `--amend` or a history rewrite, which the project forbids. Later messages moved to a private `<scratchpad>/agent-01-15/` directory. The squash merge of the milestone PR replaces the message.
- **Committed in:** 8b191cb

**4. [Process] TDD RED was not committed separately**
- **Found during:** Task 2
- **Issue:** The RED state is a typecheck failure, and the commit hook runs typecheck, so a `test(...)` RED commit cannot pass the hook. `workflow.tdd_mode` is false.
- **Fix:** RED was recorded above, and the test and implementation went in one commit.

---

**Total deviations:** 2 auto-fixed blocking issues, 2 process deviations.
**Impact on plan:** No scope creep. Deviation 3 affects only one commit message.

## Issues Encountered

- `CONVENTIONS.md` says exactly 41 `fallow-ignore` markers exist. This plan adds two (43). `CONVENTIONS.md` is not in this plan's file list, so the orchestrator owns that doc fix after the wave merges, together with any markers that other plans add.
- `test/live-uat/mcp-adapter-canary.mjs` still refuses only a Pi below 1.0.0 (line 317), and `test/live-uat/README.md` M0 says the same. The plan did not ask to raise that operator-run check, and I left it.

## Known Stubs

None.

## Threat Flags

None. This plan added no security-relevant surface outside the plan's `<threat_model>`. The fixture install used `--ignore-scripts`, and the lock records registry integrity hashes (T-01-04, T-01-SC).

## Dubious Choices

1. I ran each commit with `npm_config_script_shell` pointing at a wrapper that drops root's DAC override for npm scripts, because the commit hook's chmod-based tests fail as root. The hook still ran in full. A reviewer may prefer a repository-level fix instead.
2. `8b191cb` carries plan 01-01's commit message because of a shared-scratchpad file collision (Deviation 3). It was not amended.
3. The two `fallow-ignore-next-line unused-type` markers on `ThinkingLevel` and `InputSource` were not in the plan. The alternative was to consume the types now in `edge/skill-aliases.ts`, which is outside this plan's files and conflicts with the component phases.
4. `docs/env-vars.md` line 164 keeps the 5.2.0 measurement and adds a partial 7.0.0 re-read note. It does not move the whole paragraph to 7.0.0.
5. `docs/env-vars.md` line 3 moves to 7.0.0 on the strength of plan 01-01's conformance test, which runs in parallel and which I did not see pass.
6. The canary scratch prefix was renamed `mcp-adapter-520` to `mcp-adapter-700`. This is cosmetic and was not asked for.
7. `workflow-home.ts` line 15 was not changed, although the plan says "lines 6 and 15". Its statement about releases before 3.14.0 is still true.
8. The CHANGELOG top line has no PR number yet. The parent appends it.

## User Setup Required

None.

## Next Phase Readiness

- The component phases can import `ThinkingLevel` and `InputSource` from `platform/pi-api.ts`. Every Pi event type they subscribe to is already exported.
- After the merge with plan 01-01, the root `node_modules` Pi becomes 1.4.0. Re-run `npm run check` on the combined tree at the wave gate.

## Self-Check: PASSED

- All 18 modified files exist (`git show --stat` on the three commits).
- Commits 8b191cb, 5c0df6b, and 7eda9ce are ancestors of HEAD.
- Task acceptance criteria were re-run: the fixture dependency is `1.4.0`, `"1.4.0"` appears twice in pi-json-output.test.ts, both alias exports exist (2), the pi.sh pins exist (3), `ADAPTER_VERSION = "7.0.0"` exists (1), the README count greps return 1, the negative grep prints nothing, `>=1.4.0` appears once in AGENTS.md, CHANGELOG.md has a `1.4.0` line under `[Unreleased]`, `Use engine 3.15.0` appears once, and docs/workflows-compatibility.md lines 36-52 are byte-identical to the base.

---
*Phase: 01-harness-and-version-raise*
*Completed: 2026-11-01*
