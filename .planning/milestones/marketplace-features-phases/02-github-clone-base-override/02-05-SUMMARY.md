---
phase: 02-github-clone-base-override
plan: 05
subsystem: lint, docs
tags: [github, env-override, eslint, local-rule, readme, changelog, phase-gate]

requires:
  - phase: 02-02
    provides: "shared/github-base-url.ts as the one seam, with the auth-host and update.ts literals removed"
  - phase: 02-03
    provides: "the typed error rethrow pattern for marketplace commands"
  - phase: 02-04
    provides: "the typed error rethrow pattern for plugin commands"
provides:
  - "local/no-github-literal: a github.com string or template literal anywhere in extensions/pi-claude-marketplace/** outside shared/github-base-url.ts fails npm run lint at its line"
  - "GITHUB_ORIGIN exported from the seam; canonicalCloneUrl builds the GitHub identity from it"
  - "README.md and README.es.md GitHub mirror sections; one CHANGELOG bullet"
  - "Phase gate: npm run check exits 0 on the combined tree"
affects: [phase verification, 10 (GitHub scenarios through the override)]

actuals:
  tokens: 4100
  tasks: 3
  commits: 2
plan_head_before: 5f199e964aeec0bbba289056de7fea46c5e9a4fa
plan_head_after: 3ff8a299cfe375f7687b1ef6826d20307532f593

tech-stack:
  added: []
  patterns:
    - "A local ESLint plugin object in eslint.config.js holds a project rule; a files-scoped block registers it and sets it to error, and a later block turns it off for the exempt file so a directive naming the rule still resolves there"
    - "A justified literal carries `// eslint-disable-next-line local/no-github-literal -- <ID>: <reason>` on the line above it"

key-files:
  created: []
  modified:
    - eslint.config.js
    - extensions/pi-claude-marketplace/shared/github-base-url.ts
    - extensions/pi-claude-marketplace/domain/clone-key.ts
    - extensions/pi-claude-marketplace/domain/source.ts
    - extensions/pi-claude-marketplace/domain/auth-registry.ts
    - tests/domain/clone-key.test.ts
    - tests/domain/source.test.ts
    - README.md
    - README.es.md
    - CHANGELOG.md

key-decisions:
  - "D-06 literal gate is a local ESLint rule, local/no-github-literal, on for the extension and turned off (not ignored) for shared/github-base-url.ts; seven per-line disables carry reasons"
  - "canonicalCloneUrl builds the GitHub identity from the exported GITHUB_ORIGIN, the same prefix gitHubWireUrl matches"
  - "The clone-key override proof is three cases, one in each entrypoint's describe, rather than one case over three entrypoints, per the unit-test rule of one describe per entrypoint"
  - "The README example uses two code blocks: an `export` line for the shell that starts Pi, and the Pi command"

patterns-established:
  - "Project-specific ESLint rules live in the LOCAL_PLUGIN constant in eslint.config.js under the `local/` namespace"

requirements-completed: [GHB-02, GHB-04, GHB-05]

coverage:
  - id: D1
    description: "A new github.com literal anywhere in the extension outside shared/github-base-url.ts fails npm run lint at its line, even in a file that carries disables; comments never match"
    requirement: GHB-02
    verification:
      - kind: other
        ref: "npm run lint from an empty ESLint cache (exit 0 on the tree); planted checks (a), (b), (c) recorded below"
        status: pass
    human_judgment: false
  - id: D2
    description: "canonicalCloneUrl, networkCloneUrl, and originMatchesSource stay in github.com terms with the override set; canonicalCloneUrl reads GITHUB_ORIGIN"
    requirement: GHB-02
    verification:
      - kind: unit
        ref: "tests/domain/clone-key.test.ts#GHB-02 / D-01: keeps the github.com identity with the override set"
        status: pass
      - kind: unit
        ref: "tests/domain/clone-key.test.ts#GHB-02 / D-01: returns the github.com URL with the override set"
        status: pass
      - kind: unit
        ref: "tests/domain/clone-key.test.ts#GHB-02 / D-01: recognizes the github.com origin with the override set"
        status: pass
    human_judgment: false
  - id: D3
    description: "sourceLogical shows a GitHub source as https://github.com/<owner>/<repo>#<ref> with the override set"
    requirement: GHB-04
    verification:
      - kind: unit
        ref: "tests/domain/source.test.ts#GHB-04: keeps github.com terms with the override set"
        status: pass
    human_judgment: false
  - id: D4
    description: "README.md and README.es.md document the variable as an advanced setting with an example, refused values, limits, and the divergence from Claude Code; CHANGELOG has one bullet"
    requirement: GHB-05
    verification:
      - kind: other
        ref: "SKIP=npm-check pre-commit run --files README.md README.es.md CHANGELOG.md"
        status: pass
    human_judgment: true
    rationale: "Clarity and the faithfulness of the Spanish translation are reader judgments that no hook asserts"
  - id: D5
    description: "The combined tree of the phase passes npm run check"
    verification:
      - kind: other
        ref: "npm run check (exit 0 on 3ff8a299, Node v26.11.1)"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-10-16
status: complete
---

# Phase 2 Plan 05: Literal Gate, Docs, and Phase Gate Summary

**`local/no-github-literal` fails lint on any github.com string or template literal outside `shared/github-base-url.ts` (seven justified per-line disables remain), `canonicalCloneUrl` now builds identities from the seam's exported `GITHUB_ORIGIN`, README.md and README.es.md document `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` as an advanced mirror setting that Claude Code lacks, and `npm run check` passes on the combined phase tree.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-16T01:31:00Z
- **Completed:** 2026-10-16T01:45:02Z
- **Tasks:** 3
- **Files modified:** 10

## Accomplishments

- GHB-02 / D-06: a local ESLint rule, `local/no-github-literal`, reports a `Literal` string or a `TemplateElement` that contains `github.com` (case-insensitive) anywhere in `extensions/pi-claude-marketplace/**/*.ts`. A later block turns it off for `shared/github-base-url.ts`. Seven disables carry reasons: three in `domain/auth-registry.ts` (Device Flow host match and two endpoints), four in `domain/source.ts` (parser host check, two reason texts, the `sourceLogical` display string).
- D-01: `GITHUB_ORIGIN` is exported from the seam, and `canonicalCloneUrl` builds the GitHub arm from it. The value is the same, so the clone keys do not change (the existing clone-key cases pass).
- GHB-02 / GHB-04: new cases prove that the identity, the wire URL from `networkCloneUrl`, origin matching, and `sourceLogical` stay in github.com terms with the variable set.
- GHB-05 / D-04: `## GitHub mirror` in README.md and `## Espejo de GitHub` in README.es.md, both directly before the command reference, and one `[Unreleased]` CHANGELOG bullet.
- Phase gate: `npm run check` exits 0 on the combined tree.

## Task Commits

1. **Task 1: Fail lint on a new github.com literal outside the seam** - `08c71eb5` (build). Commit hook: `npm run check:commit` Passed.
2. **Task 2: Document the variable as an advanced setting and a divergence from Claude Code** - `3ff8a299` (docs). Commit hook: all hooks passed; `npm run check:commit` Skipped (no build input staged).
3. **Task 3: Pass the phase gate on the combined tree** - no commit (the gate found no defect).

**Plan metadata:** recorded in the docs commit that adds this SUMMARY.

## Files Created/Modified

- `eslint.config.js` - `GITHUB_LITERAL` and the `LOCAL_PLUGIN` constant with rule `no-github-literal`; a block that enables `local/no-github-literal` for the extension (after BLOCK F) and a later block that turns it off for the seam.
- `extensions/pi-claude-marketplace/shared/github-base-url.ts` - exports `GITHUB_ORIGIN` with JSDoc.
- `extensions/pi-claude-marketplace/domain/clone-key.ts` - imports `GITHUB_ORIGIN`; `canonicalCloneUrl`'s github arm is `${GITHUB_ORIGIN}/${owner}/${repo}`.
- `extensions/pi-claude-marketplace/domain/auth-registry.ts` - three justified disables.
- `extensions/pi-claude-marketplace/domain/source.ts` - four justified disables.
- `tests/domain/clone-key.test.ts` - three override cases, one per entrypoint describe.
- `tests/domain/source.test.ts` - one override case in `describe("sourceLogical")`.
- `README.md`, `README.es.md` - the GitHub mirror section.
- `CHANGELOG.md` - one bullet under `## [Unreleased]`.

## RED / GREEN evidence (Task 1, `tdd="true"`)

`workflow.tdd_mode` is false and the plan is `type: execute`, so the plan-level TDD gate does not apply. Task 1 still followed test-first order:

- The four override cases were written first and ran green before any production change (197/197 pass). This is expected: 02-01 and 02-02 already keep identity and display in github.com terms, so these cases guard the `GITHUB_ORIGIN` refactor instead of driving new behavior. To show that they discriminate, `canonicalCloneUrl` was mutated by hand to wrap its result in `gitHubWireUrl(...)`. Two cases then failed (`keeps the github.com identity with the override set` and `returns the github.com URL with the override set`), and the file was restored. The `originMatchesSource` case guards that function's own parse; the mutation did not reach it.
- The lint rule's RED: before the rule existed, a planted `export const PLANTED_GITHUB_LITERAL = "https://github.com/planted/literal";` in `orchestrators/plugin/info.ts` passed `npx eslint --no-cache` with exit 0. After the rule, the same plant fails (check (a) below).

## Planted lint checks (not committed)

Each was planted by hand, linted, and reverted. `git status --short` afterwards showed only the planned task files.

- **(a)** A string literal appended to `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`, then `npx eslint --no-cache extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`: exit 1.

  ```text
  3227:39  error  GHB-02: a github.com literal belongs in shared/github-base-url.ts. Disable this line with a reason only at a parser host comparison, user-facing reason text, the github.com display string, or a Device Flow endpoint  local/no-github-literal
  ✖ 1 problem (1 error, 0 warnings)
  ```

- **(b)** A template literal ``export const PLANTED_GITHUB_LITERAL = `https://github.com/${"planted"}/literal`;`` appended to `extensions/pi-claude-marketplace/domain/source.ts`, which carries four disables, then `npx eslint --no-cache extensions/pi-claude-marketplace/domain/source.ts`: exit 1, with `789:39 error GHB-02: ... local/no-github-literal`. (The plant also tripped `@typescript-eslint/no-unnecessary-template-expression` at 789:59, which is unrelated to the gate.)

- **(c)** A comment `// A planted comment that mentions https://github.com/planted/literal.` appended to `extensions/pi-claude-marketplace/domain/clone-key.ts`, then `npx eslint --no-cache extensions/pi-claude-marketplace/domain/clone-key.ts`: exit 0, no report.

## Verification

- `rm -rf node_modules/.cache/eslint && npm run lint`: exit 0, no warning (so no unused disable directive).
- `node --test tests/domain/clone-key.test.ts tests/domain/source.test.ts tests/shared/github-base-url.test.ts`: 238 pass, 0 fail.
- `npm run test:coverage:direct --` for `domain/clone-key.ts`, `domain/source.ts`, `shared/github-base-url.ts`, `domain/auth-registry.ts`: each exit 0.
- Acceptance greps: `no-github-literal` in eslint.config.js 3; disables 3 in auth-registry.ts, 4 in source.ts, 7 total under `extensions/`; `GITHUB_ORIGIN` 2 in clone-key.ts; `export const GITHUB_ORIGIN` 1.
- Task 2: `SKIP=npm-check pre-commit run --files README.md README.es.md CHANGELOG.md` exit 0 (mdformat and markdownlint-cli2 passed). `## GitHub mirror` sits directly before `## Command reference`. The variable appears twice in each README, `git credential approve` once in each, and the code blocks of the two sections are byte-identical. The Unreleased section names the variable once.

## Phase gate

- **Command:** `npm run check`, in the foreground, output to a log file, exit status captured directly.
- **Exit status:** 0
- **Commit:** `3ff8a299cfe375f7687b1ef6826d20307532f593` (clean tree)
- **Node:** v26.11.1
- **Scope:** the combined tree of phase 02 (plans 02-01 to 02-05) on `features/cucumber-behavioral-tests`.
- **Time:** 2026-10-16T01:43:06Z to 01:44:44Z.
- **Steps:** typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, and check:features passed. Then test:unpaired, test:integration, test:cucumber (26 scenarios, 206 steps passed), and direct coverage for all pairs (`Merged LCOV: coverage/direct.lcov (280 records)`).
- The existing catalog and notification tests passed unchanged. The new texts appear only when the variable is set (D-10) or invalid (D-08), and no catalog fixture sets it, so no text lock changed.
- `git status --short` after the gate showed nothing outside `.planning/`.

## Decisions Made

- The clone-key override proof is three cases, one in each entrypoint's `describe`, rather than one case that asserts three entrypoints. The typescript-unit-tests rule keeps one top-level `describe` per entrypoint.
- The README example uses two code blocks, an `export` line for the shell that starts Pi and then the Pi command, because one block would mix a shell line with a Pi command.
- The CHANGELOG bullet is one sentence of 24 words: "GitHub sources clone and fetch from another https git host, such as a mirror, when you set `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`, a setting that Claude Code lacks." The PR step appends `(#N)`.

## Deviations from Plan

None that changed behavior or scope. The two layout choices above (three cases instead of one, two README code blocks) keep the plan's assertions and content.

**Total deviations:** 0 auto-fixed. **Impact:** none.

## Issues Encountered

- README.es.md already differed from README.md before this phase: it lacks the GitLab marketplace paragraph and its note under `### Mercado`, and its `--local` paragraph says something different. This is outside the plan's scope, so it was not fixed. It is logged as WINDOWS entry 93 (`[marketplace-features]`, kind `deviation`, open).

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All five plans of phase 02 have summaries, and the combined tree passes `npm run check`. The phase is ready for verification.
- Phase 10 can drive GitHub scenarios through `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL`.

## Self-Check: PASSED

- FOUND: eslint.config.js, README.md, README.es.md, CHANGELOG.md
- FOUND: 08c71eb5, 3ff8a299 (both ancestors of HEAD)
- No task commit deleted a file.

---
*Phase: 02-github-clone-base-override*
*Completed: 2026-10-16*
