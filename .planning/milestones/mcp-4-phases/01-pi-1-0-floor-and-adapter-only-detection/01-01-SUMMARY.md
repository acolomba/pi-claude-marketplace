---
phase: 01-pi-1-0-floor-and-adapter-only-detection
plan: 01
subsystem: infra
tags: [dependencies, pi-floor, tooling, contracts, peer-dependencies, typescript-eslint]

requires: []
provides:
  - "Pi 1.0 floor: pi-coding-agent peer >=1.0.0, Pi and pi-tui dev ^1.0.0, lock installs 1.0.0"
  - "Optional companion peers pi-subagents >=0.74.0 and pi-mcp-adapter >=5.0.0, gated in peer-floor tests"
  - "engines.node ^22.22.2 || ^24.15.0 || >=26.0.0 in package.json, lock root, AGENTS.md, PROJECT.md and the PRD NFR-4 row"
  - "Approved devDependency bump set installed; TypeScript held at ^6.0.3"
  - "Shared Pi ToolInfo test seed tests/platform/pi-inventory-seed.ts (toolInfo, exposure direct)"
  - "String-keyed render-map read in dispatchRow; four re-derived contract pins"
affects: [01-02, 01-03, 01-05, 01-06, 01-08, pi-api, notify-context, peer-floor]

actuals:
  tokens: 18169
  tasks: 3
  commits: 1
plan_head_before: 49e09af5b4124e8d2bc7afc7067a4dcb58212a78
plan_head_after: 175b61e28ee05d4e2415da9be39505044a572395

tech-stack:
  added: []
  patterns:
    - "Pi inventory seeds live in tests/platform/pi-inventory-seed.ts and return fresh values"
    - "Optional companions are declared only as optional peers and asserted absent from the installed tree"

key-files:
  created:
    - tests/platform/pi-inventory-seed.ts
  modified:
    - package.json
    - package-lock.json
    - scripts/check-unused-type-members.contracts.json
    - extensions/pi-claude-marketplace/shared/notify-context.ts
    - tests/architecture/peer-floor.test.ts
    - tests/architecture/workflows-doc-pins.test.ts
    - tests/architecture/workflows-marker-coverage.test.ts
    - tests/edge/handlers/tools.test.ts
    - tests/orchestrators/plugin/list-flow.test.ts
    - tests/orchestrators/plugin/reinstall.messaging.test.ts
    - docs/workflows-compatibility.md
    - docs/prd/pi-claude-marketplace-prd.md
    - .github/workflows/lint.yml
    - AGENTS.md
    - .planning/PROJECT.md
    - .planning/codebase/STACK.md
    - README.md
    - README.es.md

key-decisions:
  - "Pi 1.0 floor: pi-coding-agent peer >=1.0.0 (dev ^1.0.0); pi-subagents >=0.74.0 and pi-mcp-adapter >=5.0.0 are optional peers only, never installed"
  - "dispatchRow reads the render map through a Readonly<Record<string, unknown>> view, so no-unsafe-enum-assignment is fixed in code with no rule override"
  - "One shared Pi ToolInfo seed replaces the three Pi-typed copies; the three ToolInventoryItem-typed helpers stay local to their tests"

patterns-established:
  - "Peer gates read package.json and the lock only through PACKAGE_JSON_REL / PACKAGE_LOCK_REL"

# PIFL-02 (zero-skip run) and PIFL-04 (peer-test half) complete in plan 01-03; this plan
# delivers their declaration, gate and typing halves.
requirements-completed: [PIFL-01, PIFL-03, PIFL-05, PIFL-06]

coverage:
  - id: D1
    description: "Pi 1.0.0 installed; the real Pi 1.0 CLI loads the extension"
    requirement: PIFL-01
    verification:
      - kind: e2e
        ref: "tests/e2e/pi-runtime-smoke.test.ts#real Pi runtime package bin loads the extension under isolated HOME and cwd"
        status: pass
    human_judgment: false
  - id: D2
    description: "FLOOR-01 and the WDEP-04 doc bullet state >=1.0.0"
    requirement: PIFL-01
    verification:
      - kind: unit
        ref: "node --test tests/architecture/peer-floor.test.ts tests/architecture/workflows-doc-pins.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "pi-subagents and pi-mcp-adapter optional peers declared, mirrored in the lock root, adapter absent from the installed tree"
    requirement: PIFL-03
    verification:
      - kind: unit
        ref: "tests/architecture/peer-floor.test.ts (PIFL-02 and PIFL-03 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Tree typechecks against Pi 1.0.0 types and the type-member analyzer accepts the re-derived pins"
    requirement: PIFL-04
    verification:
      - kind: other
        ref: "npm run typecheck && npm run lint:type-members"
        status: pass
    human_judgment: false
  - id: D5
    description: "Bumped tooling lints with zero errors and the same 19 warnings as the start commit"
    requirement: PIFL-05
    verification:
      - kind: other
        ref: "npm run lint (tmp/p01-lint-before.log vs tmp/p01-lint-after.log)"
        status: pass
    human_judgment: false
  - id: D6
    description: "engines.node range in package.json and lock root"
    requirement: PIFL-06
    verification:
      - kind: other
        ref: "node -p require('./package-lock.json').packages[''].engines.node"
        status: pass
    human_judgment: false
  - id: D7
    description: "README.md and README.es.md state the Pi 1.0.0 and adapter 5.0.0 floors, that built-in MCP does not satisfy the adapter requirement, and the pi-ai peer gap"
    requirement: PIFL-03
    verification:
      - kind: other
        ref: "grep -n 'pi-mcp-adapter.*5\\.0\\.0\\|pi-ai' README.md README.es.md"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-10-02
status: complete
---

# Phase 1 Plan 01: Pi 1.0 floor and toolchain refresh Summary

**The extension now peers on Pi `>=1.0.0` and installs Pi 1.0.0. It declares pi-subagents
`>=0.74.0` and pi-mcp-adapter `>=5.0.0` as optional peers and sets the Node range to
`^22.22.2 || ^24.15.0 || >=26.0.0`. The approved tooling set is installed with TypeScript held
at `^6.0.3`. One commit carries all of this, together with the string-keyed render read and
the four re-derived pins.**

## Performance

- **Duration:** about 30 min of edits, plus the full pre-commit run
- **Started:** 2026-10-02T16:05:21Z
- **Completed:** 2026-10-02
- **Tasks:** 3
- **Files modified:** 19 (18 modified, 1 created)
- **Node:** v26.10.0

## Accomplishments

- Pi 1.0.0 and pi-tui 1.0.0 are installed. The tree typechecks against the 1.0.0 types, and the
  real Pi 1.0 CLI loads the extension (`tests/e2e/pi-runtime-smoke.test.ts` passes).
- `tests/platform/pi-inventory-seed.ts` exports `toolInfo(name)` with `exposure: "direct"`. It
  replaces the three Pi `ToolInfo` copies. `tests/edge/handlers/tools.test.ts` types the tool
  context as `ExtensionToolContext`.
- `dispatchRow` reads the render map through a `Readonly<Record<string, unknown>>` view. The
  `as Status` key cast is gone, and no lint rule is disabled.
- The peer gates cover the pi-subagents floor, the optional pi-mcp-adapter peer, the adapter's
  absence from dependencies, devDependencies and the lock, and the lock-root mirror.
- The floor documentation is updated in AGENTS.md, PROJECT.md, STACK.md, the PRD NFR-4 row,
  `docs/workflows-compatibility.md`, README.md and README.es.md. The fallow action pin is now
  v3.31.0.

## Task Commits

The plan makes one code commit (Tasks 1-3 together; any commit that touches package.json runs
the full check):

1. **Tasks 1-3: Pi 1.0 floor, tooling bump, floor docs** - `175b61e2` (build:
   `build: require Pi 1.0 and raise the companion floors`)

**Plan metadata:** the docs commit that follows it (SUMMARY, STATE, ROADMAP, REQUIREMENTS).

The code commit SHA was fixed before the pre-commit run. The orchestrator requires one hook run
over the code and tracking files together. So the commit object was built with
`git commit-tree` and pinned author and committer dates, and `git commit` then used the same
dates and index. The self-check below confirms that HEAD~1 of the docs commit is this SHA.

## Verification Evidence

Focused task verification passed. The pre-commit run selected full scope (`npm run check` plus
`test:coverage:direct:all`) because package.json changed.

- Task 1 verify (`npm run typecheck && npm run lint:type-members && node --test
  peer-floor, workflows-doc-pins, e2e/pi-runtime-smoke`): `T1_EXIT=0`, 7/7 pass.
- Task 2 verify (`npm run lint && npm run lint:type-members && node --test peer-floor,
  fallow-production-mode, shared/notify-context` + action-pin grep): `T2_EXIT=0`, 44/44 pass,
  grep count 1.
- Full pre-commit (`TMPDIR=/var/tmp/mcp4-exec SKIP=trufflehog pre-commit run --files <all
  changed paths>`, log `tmp/p01-precommit.log`): `PRECOMMIT_EXIT=0`.
- Lint warnings: 19 at the start commit (`0 errors, 19 warnings`) and 19 with the bumped
  tooling. The warning lines are identical (`diff` of the two logs is empty). All 19 are unused
  `no-await-in-loop` disable directives.

### Measured pin lines

Grep of the installed `node_modules/@earendil-works/pi-coding-agent/dist/core/extensions/types.d.ts`:

- `525:    type: "resources_discover";` so `pi-api.ts:100:3` upstream is `types.d.ts:525:5`
- `533:    themePaths?: string[];` (inside `interface ResourcesDiscoverResult`, line 530) so
  `pi-api.ts:108:3` upstream is `types.d.ts:533:5`
- `notify-context.ts` line 346 after Prettier:
  `const arm = render[row.status] as RenderFn<Extract<Msg, { status: Status }>> | undefined;`.
  The `id` moves to `346:61` (`status`) and the `filter` to `346:46` (`Extract`).
- `git diff --numstat` on the contracts file: `4 4`.

### `npm outdated` (after the bump)

```text
Package         Current  Wanted  Latest  Location                     Depended by
isomorphic-git   1.42.2  1.42.6  1.42.6  node_modules/isomorphic-git  pi-claude-marketplace-mcp-4
pi-subagents    MISSING  0.74.0  0.74.0  -                            pi-claude-marketplace-mcp-4
typescript        6.0.3   6.0.3   7.0.2  node_modules/typescript      pi-claude-marketplace-mcp-4
```

- `typescript` is held on purpose (typescript-eslint 8.71 peers `<6.1.0`).
- `pi-subagents MISSING` is the optional peer, which is never installed into this repository.
- `isomorphic-git` is a runtime **dependency**, so it is not in the D-01-21 devDependency set.
  An in-range patch, 1.42.6, exists. It was not installed. The operator decides whether to
  install it.
- No devDependency shows a release newer than the D-01-21 set.

### `npm view <pkg>@<ver> scripts` (T-01-SC)

None of the eight approved packages declares a `preinstall`, `install` or `postinstall`
script: pi-coding-agent 1.0.0, pi-tui 1.0.0, typescript-eslint 8.71.0, eslint-plugin-sonarjs
4.2.2, fallow 3.31.0, prettier 3.9.9, globals 17.13.0, eslint-plugin-import-x 4.17.1. Each
installed version was confirmed from its `node_modules/<pkg>/package.json`.

## Files Created/Modified

- `tests/platform/pi-inventory-seed.ts` - shared Pi `ToolInfo` seed (PIFL-04)
- `package.json`, `package-lock.json` - Pi floor, companion peers, engines, devDependency set
- `scripts/check-unused-type-members.contracts.json` - four re-derived pins
- `extensions/pi-claude-marketplace/shared/notify-context.ts` - string-keyed render read
- `tests/architecture/peer-floor.test.ts` - FLOOR-01 at `>=1.0.0`, PIFL-02 and PIFL-03 gates
- `tests/architecture/workflows-doc-pins.test.ts`, `docs/workflows-compatibility.md` - floor `>=1.0.0`
- `tests/architecture/workflows-marker-coverage.test.ts`, `tests/orchestrators/plugin/list-flow.test.ts`,
  `tests/orchestrators/plugin/reinstall.messaging.test.ts` - import the shared seed
- `tests/edge/handlers/tools.test.ts` - `ExtensionToolContext`
- `.github/workflows/lint.yml` - fallow action v3.31.0
- `AGENTS.md`, `.planning/PROJECT.md`, `.planning/codebase/STACK.md`,
  `docs/prd/pi-claude-marketplace-prd.md` - Node range and Pi API floor
- `README.md`, `README.es.md` - Pi 1.0.0, adapter 5.0.0, built-in MCP sentence, pi-ai peer gap

## Decisions Made

- The three `ToolInventoryItem`-typed `toolInfo` helpers stay local. They are in
  `install-flow.test.ts`, `enable-disable.test.ts` and `reinstall-flow.test.ts`. They return
  the project's own port, not Pi's `ToolInfo`, so a Pi `ToolInfo` change does not touch them.
  The plan's action names only the three Pi-typed copies.
- STACK.md also gets the pi-subagents peer floor and a pi-mcp-adapter optional-peer line,
  because this plan changes both literals.

## Deviations from Plan

### Acceptance-criterion refinement

**1. [Rule 3 - Blocking criterion] `rg -l "function toolInfo" tests` lists three more files**
- **Found during:** Task 1 acceptance check
- **Issue:** The grep also matches the three `ToolInventoryItem`-typed helpers. They are not
  Pi `ToolInfo` copies. PATTERNS.md lists them as separate variants, and the action step names
  only the three Pi-typed files.
- **Fix:** No code change. The precise check
  `rg -l 'function toolInfo\(name: string\): ToolInfo\b' tests` lists only
  `tests/platform/pi-inventory-seed.ts`.
- **Files modified:** none

### Out-of-scope observations (not fixed)

- `npm audit` reports 1 high-severity finding in `brace-expansion` 5.0.9. That version is
  already locked at the start commit `49e09af5`, so this plan did not introduce it.
- npm 11 warns that four transitive packages have install scripts that `allowScripts` does not
  cover, so npm did not run them: `unrs-resolver`, `@google/genai`, `esbuild` and
  `protobufjs`. No gate depended on them, and `npm run check` passed.

**Total deviations:** 1 (acceptance-criterion refinement). **Impact:** none on the delivered
behavior.

## Issues Encountered

None.

## Next Phase Readiness

- Later plans in this phase must leave the four pins in
  `scripts/check-unused-type-members.contracts.json` unchanged.
- PIFL-02's zero-skip run against pi-subagents 0.74.0 and PIFL-04's peer-test half are plan
  01-03's job. REQUIREMENTS.md keeps both pending. `requirements.mark-complete` marked all six
  IDs from this plan's frontmatter, and PIFL-02 and PIFL-04 were then set back to pending by
  hand.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- `tests/platform/pi-inventory-seed.ts` exists.
- Code commit `175b61e2` exists, and it is HEAD~1 of the docs commit.
