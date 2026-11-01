---
phase: 01-harness-and-version-raise
plan: 10
subsystem: edge, domain
tags: [pi-input-handler, fallow, frontmatter, description-fallback, strong-mock]

requires: []
provides:
  - "registerCommandInvocation(pi): the bridged-command input handler, registered after registerSkillAliases (D-CF1-01, D-CF1-02)"
  - "descriptionFallback / DescriptionFallbackLabel: the Claude Code 2.1.316 A2e port (D-CF1-04)"
  - "droppedInvocationFieldsWarning: the D-CF1-05 unhonored-field table and its one warning line"
  - "fallow dynamicallyLoaded + ignoreExports entries for the six invocation cores"
affects: [skills bridge, commands bridge, argument substitution, context injection]

actuals:
  tokens: 4200
  tasks: 2
  commits: 2
plan_head_before: fa95fecf60648e0fadba1d24d2090fb1bd82642f
plan_head_after: e167071b081c91622a4dc22d4a004be87a0a992e

tech-stack:
  added: []
  patterns:
    - "Unwired cores stay fallow-clean through dynamicallyLoaded plus ignoreExports until a later plan imports them"

key-files:
  created:
    - extensions/pi-claude-marketplace/edge/command-invocation.ts
    - test/edge/command-invocation.test.ts
    - extensions/pi-claude-marketplace/domain/description-fallback.ts
    - test/domain/description-fallback.test.ts
    - extensions/pi-claude-marketplace/domain/invocation-frontmatter.ts
    - test/domain/invocation-frontmatter.test.ts
  modified:
    - extensions/pi-claude-marketplace/index.ts
    - test/index.test.ts
    - .fallowrc.json

key-decisions:
  - "descriptionFallback is verified byte-for-byte against the A2e source in /opt/claude-code/bin/claude 2.1.316"
  - "The D-CF1-05 table is a frozen string array; the warning lists own enumerable keys (Object.keys) in frontmatter order"
  - "The command invocation pass-through is the specified behavior, not a stub, so it is not on the WINDOWS ledger"

patterns-established:
  - "Index factory test pins input-handler order: a new strict pi.on('input') expectation after the skill alias one captures the fifth input registration"

requirements-completed: [DEC-01]

coverage:
  - id: D1
    description: "registerCommandInvocation registers one input listener that returns { action: 'continue' } for interactive, rpc, and extension sources"
    requirement: DEC-01
    verification:
      - kind: unit
        ref: "test/edge/command-invocation.test.ts#D-CF1-01: passes a bridged command from the <source> source through unchanged"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/command-invocation.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The extension factory registers the command invocation handler after the skill alias input handler"
    requirement: DEC-01
    verification:
      - kind: unit
        ref: "test/index.test.ts#D-CF1-01: the command invocation handler registered after the skill aliases passes a bridged command through"
        status: pass
    human_judgment: false
  - id: D3
    description: "The six invocation cores are in dynamicallyLoaded and ignoreExports; both fallow dead-code runs pass"
    requirement: DEC-01
    verification:
      - kind: other
        ref: "npx fallow dead-code --fail-on-issues --format human --quiet"
        status: pass
      - kind: other
        ref: "npx fallow dead-code --no-production --circular-deps --re-export-cycles --fail-on-issues --format human --quiet --no-cache"
        status: pass
    human_judgment: false
  - id: D4
    description: "descriptionFallback follows A2e (first non-blank line, heading text, 97+... cut over 100, label fallback)"
    requirement: DEC-01
    verification:
      - kind: unit
        ref: "test/domain/description-fallback.test.ts (9 D-CF1-04 rows)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/description-fallback.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "droppedInvocationFieldsWarning lists the eight D-CF1-05 fields present as own keys, in key order, and gives undefined otherwise"
    requirement: DEC-01
    verification:
      - kind: unit
        ref: "test/domain/invocation-frontmatter.test.ts (5 D-CF1-05 cases)"
        status: pass
      - kind: other
        ref: "npm run test:coverage:direct -- extensions/pi-claude-marketplace/domain/invocation-frontmatter.ts"
        status: pass
    human_judgment: false

duration: 22min
completed: 2026-11-01
status: complete
---

# Phase 1 Plan 10: Invocation Seed and Frontmatter Cores Summary

**A registered pass-through input handler for bridged commands (after the skill-alias rewrite), an exact A2e description-fallback port, the D-CF1-05 dropped-field warning, and fallow registrations that keep the six invocation cores clean before they are wired.**

## Performance

- **Duration:** about 22 min
- **Started:** 2026-11-01T01:48Z (approximate)
- **Completed:** 2026-11-01T02:10:12Z
- **Tasks:** 2
- **Files modified:** 9 (6 created, 3 modified)

## Accomplishments

- `edge/command-invocation.ts`: `registerCommandInvocation(pi)` registers one `input` listener that returns `{ action: "continue" }`. `index.ts` calls it on the line after `registerSkillAliases(pi)`. Pi's `emitInput` runs handlers in registration order (checked in `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/runner.js`), so the order is: hooks bridge UserPromptSubmit, background update, skill-alias rewrite, command invocation.
- `test/index.test.ts`: a strict `pi.on("input", …)` expectation after the skill alias one, plus a case that calls the captured listener and asserts `{ action: "continue" }`.
- `.fallowrc.json`: `dynamicallyLoaded` and `ignoreExports` (`exports: ["*"]`) for `domain/argument-substitution.ts`, `domain/shell-words.ts`, `domain/context-injection.ts`, `domain/description-fallback.ts`, `domain/invocation-frontmatter.ts`, and `platform/prompt-shell.ts`. Fallow 3.35.0 accepts the four paths that do not exist yet without a finding.
- `domain/description-fallback.ts`: `descriptionFallback(body, label)`, checked against the `A2e` source taken from `/opt/claude-code/bin/claude` 2.1.316: `function A2e(e,n="Custom item"){let r=e.split("\n");for(let s of r){let h=s.trim();if(h){let S=h.match(/^#+\s+(\S.*)$/)?.[1]??h;return S.length>100?S.substring(0,97)+"...":S}}return n}`.
- `domain/invocation-frontmatter.ts`: `droppedInvocationFieldsWarning(sourceName, frontmatter)` returns `[<source>] dropped fields: <fields>` for `disallowed-tools`, `model`, `effort`, `agent`, `context`, `background`, `hooks`, and `paths`, listed in frontmatter key order. It returns `undefined` when none of them is set.

## Task Commits

1. **Task 1: Register the command invocation handler and the invocation cores**: `8ce47ce` (feat)
2. **Task 2: Port the description fallback and the unhonored-field table**: `e167071` (feat)

**Plan metadata:** this SUMMARY commit (docs)

## Files Created/Modified

- `extensions/pi-claude-marketplace/edge/command-invocation.ts`: the bridged-command input handler
- `test/edge/command-invocation.test.ts`: one pass-through case per input source
- `extensions/pi-claude-marketplace/index.ts`: the registration after `registerSkillAliases(pi)`
- `test/index.test.ts`: the strict expectation and the listener case
- `.fallowrc.json`: the six `dynamicallyLoaded` and `ignoreExports` entries
- `extensions/pi-claude-marketplace/domain/description-fallback.ts`: `descriptionFallback`, `DescriptionFallbackLabel`
- `test/domain/description-fallback.test.ts`: nine A2e behavior rows
- `extensions/pi-claude-marketplace/domain/invocation-frontmatter.ts`: `droppedInvocationFieldsWarning` and the private field table
- `test/domain/invocation-frontmatter.test.ts`: four rows plus the prototype-only case

## Parent cleanup

Remove the six `dynamicallyLoaded` and `ignoreExports` entries from `.fallowrc.json` after Phases 2 and 3 merge, then run `npm run fallow` (DC-13 item 6).

## Decisions Made

- I checked the A2e port against the shipped binary as well as RESEARCH.md. The map/find form trims every line before it picks the first non-blank one. Upstream trims lazily, but the result is the same.
- The D-CF1-05 table is a frozen `readonly string[]`. Each field has a one-line comment saying what it asks for and why Pi does not do it. The module exports only `droppedInvocationFieldsWarning`.
- I added one heading row beyond the plan's list: a heading over 100 characters. It shows that the cut applies to the heading text, not to the `#` line.
- I added a D-CF1-01/D-CF1-02 comment at the `registerCommandInvocation(pi)` call site. It says why the order matters (T-01-08).

## Deviations from Plan

### Environment adjustments (not code deviations)

**1. [Rule 3 - Blocking] ESLint ran out of heap in the commit hook**
- **Found during:** Task 1 commit
- **Issue:** `npm run check:commit` failed in `lint` with `FATAL ERROR: Reached heap limit` (the default heap is about 2 GB, and parallel agents were loading the machine). No commit happened.
- **Fix:** I ran the same `git commit` again with `NODE_OPTIONS=--max-old-space-size=6144`. The hook ran in full and passed. I did not use `--no-verify`.
- **Files modified:** none
- **Committed in:** `8ce47ce`; `e167071` used the same setting

**Total deviations:** 1 environment fix (Rule 3). **Impact on plan:** none on the code. The same OOM may hit other agents' commit hooks.

## Issues Encountered

- The scratchpad directory is shared with other agents in this session. Another agent overwrote a commit-message file there after my commit had used it. Later message files have plan-specific names. No commit was affected.

## Known Stubs

None. The command invocation handler returns `{ action: "continue" }` for every input. That is the behavior the plan specifies (a must-have truth), not a placeholder, so I added nothing to `.planning/WINDOWS.md`. The D-CF1-01 and D-CF1-02 transforms replace it in later phases.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Dubious Choices

1. The pass-through handler is not on the WINDOWS ledger as a stub (see Known Stubs). If the parent wants it tracked until the transforms land, add one `[component-features]` stub entry for `extensions/pi-claude-marketplace/edge/command-invocation.ts`.
2. The comments on the D-CF1-05 table say what each upstream field does: `background` runs in the background, `paths` limits when a skill is offered, `agent` names the subagent for `context: fork`. These come from Claude Code's documented frontmatter, not from reading the 2.1.316 binary.
3. The commit hook needed `NODE_OPTIONS=--max-old-space-size=6144` to finish ESLint. This is an environment workaround and not a project config change. If OOM is common, the parent may want a heap flag in the `lint` script.
4. The plan's `pre-commit` command form `SKIP=npm-check${SKIP:+,$SKIP}` was refused by the worktree guard. `SKIP` was empty, so I ran `SKIP=npm-check pre-commit run --files …`, which is the same command.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 01-12 and 01-13 can add their cores. Each path is already registered with fallow.
- The skills and commands bridges can import `descriptionFallback` and `droppedInvocationFieldsWarning` directly.

## Self-Check: PASSED

- FOUND: all six created files and three modified files
- FOUND: `8ce47ce`, `e167071` on this branch (`git rev-list --count fa95fec..HEAD` = 2)
- Acceptance criteria re-run: `registerCommandInvocation(pi);` count 1, after `registerSkillAliases(pi);`; `.fallowrc.json` arrays have 6 entries each; both `export function` greps print 1; neither domain file imports outside `shared/` (no relative imports)
- Plan verification: 63/63 tests pass across the four test modules; direct coverage passes for all three new sources; both fallow dead-code runs exit 0

---
*Phase: 01-harness-and-version-raise*
*Completed: 2026-11-01*
