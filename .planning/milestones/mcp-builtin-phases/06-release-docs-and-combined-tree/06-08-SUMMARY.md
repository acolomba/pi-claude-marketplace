---
phase: 06-release-docs-and-combined-tree
plan: "08"
subsystem: mcp
tags: [mcp, legacy-reader, containment, nfr-10, fallow, redaction]

requires:
  - phase: 06-release-docs-and-combined-tree
    provides: "06-02 (update-swap.ts) and 06-03 (list-installed-row.ts, edge-deps.ts installed-row read) as the base the call sites build on"
provides:
  - "isPluginRootContained in orchestrators/mcp/recorded-servers.ts, the one clone-root check the legacy reader and the registration step share"
  - "LegacyServersSource.locations, passed at every source construction site"
  - "the legacy reader's `uncontained` refusal, made before any manifest or plugin file is read"
  - "the redacted `recorded MCP servers unreadable` debug line (UF-4)"
  - ".fallowrc.json with one entry and no export exemptions; LegacyServersUnreadableError and LegacyServersUnreadableReason module-private"
affects: [06-11 codebase maps (entry and suppression counts), 06-13 01-FROZEN.md]

actuals:
  tokens: 12236
  tasks: 2
  commits: 2
plan_head_before: 837a0da06a47675199e2fd8b55f0187a4d1b38cd
plan_head_after: 698a3a6961687e6327968095b6b7bb35f3195b85

tech-stack:
  added: []
  patterns:
    - "A read of a record's files goes through isPluginRootContained(record, source) with the locations of the scope whose state file holds the record"

key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts
    - extensions/pi-claude-marketplace/orchestrators/mcp/builtin-registration-step.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/mcp-verdict-read.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/list-installed-row.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/install-flow-results.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/update-swap.ts
    - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-move.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/convergence.ts
    - extensions/pi-claude-marketplace/orchestrators/reconcile/mcp-migration.ts
    - extensions/pi-claude-marketplace/orchestrators/edge-deps.ts
    - test/orchestrators/mcp/recorded-servers.test.ts
    - test/orchestrators/plugin/mcp-verdict-read.test.ts
    - .fallowrc.json

key-decisions:
  - "The moved check is exported as isPluginRootContained(record, source); the registration step calls it for its own debug line, then builds the reader with the same source, so the rule exists once (D-P6-23)"
  - "recordDegradeBaselineReader takes the locations beside the implementation; dependency-move passes context.locations"
  - "A legacy git record without resolvedSha whose root lies under plugin-clones/ is now refused by the reader, as the registration step already refused it (P6-DC-0801)"

patterns-established:
  - "LegacyServersSource is built with the locations of the scope whose state file holds the record and its marketplace record"

requirements-completed: [MREC-02]

coverage:
  - id: D1
    description: "The legacy reader refuses with `uncontained`, before it reads the manifest, a plugin root that leaves its owning clone root (symlink, `..`, malformed clone key, sha-less root in plugin-clones, path root outside its marketplace, cloned marketplace outside its checkout)"
    requirement: MREC-02
    verification:
      - kind: unit
        ref: "test/orchestrators/mcp/recorded-servers.test.ts#UF-1: refuses ... before it reads the manifest (6 rows)"
        status: pass
      - kind: unit
        ref: "test/orchestrators/mcp/recorded-servers.test.ts#UF-1: re-resolves a path record of a cloned marketplace inside its checkout"
        status: pass
    human_judgment: false
  - id: D2
    description: "recordedMcpServers and readRecordMcpVerdict read an uncontained legacy record as unreadable, so the stored verdict stands; a record with mcpServerConfigs never calls the reader"
    requirement: MREC-02
    verification:
      - kind: unit
        ref: "test/orchestrators/mcp/recorded-servers.test.ts#UF-1: reads a legacy record whose plugin root is outside its marketplace as unreadable"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/mcp-verdict-read.test.ts#UF-1: keeps the stored verdict of a git record whose plugin root is outside its clones"
        status: pass
      - kind: unit
        ref: "test/orchestrators/plugin/mcp-verdict-read.test.ts#UF-1: the degrade baseline reader reads a git record from the clone its locations name"
        status: pass
    human_judgment: false
  - id: D3
    description: "The registration step keeps its UF-1 behavior and debug line through the moved check"
    verification:
      - kind: unit
        ref: "test/orchestrators/mcp/builtin-registration-step.test.ts (UF-1 cases, unchanged)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The legacy reader's debug line holds no absolute path (UF-4)"
    verification:
      - kind: unit
        ref: "test/orchestrators/mcp/recorded-servers.test.ts#UF-4: logs a legacy reader failure that names an absolute path without the path"
        status: pass
    human_judgment: false
  - id: D5
    description: ".fallowrc.json lists only index.ts as entry and no ignoreExports; fallow dead-code and dupes pass"
    verification:
      - kind: other
        ref: "npm run fallow; npx fallow dupes --fail-on-issues"
        status: pass
    human_judgment: false

duration: 33min
completed: 2026-11-05
status: complete
---

# Phase 6 Plan 08: Contained Legacy MCP Reader and Fallow Cleanup Summary

**The legacy MCP reader now refuses (`uncontained`), before it reads any file, a record whose plugin root leaves its `plugin-clones/<key>/` entry or marketplace root. It uses the check moved from the registration step, with the record's scope locations threaded through all ten source sites. Its debug line is path-redacted, and `.fallowrc.json` has one entry and no export exemptions.**

## Performance

- **Duration:** about 33 min
- **Started:** 2026-11-05T01:07Z
- **Completed:** 2026-11-05T01:40Z
- **Tasks:** 2 of 2
- **Files modified:** 14

## Accomplishments

- `CLONE_KEY`, `cloneKeyOf`, `isPathMarketplace`, and `owningRoot` moved from `builtin-registration-step.ts` into `recorded-servers.ts`. `isContained` became the exported `isPluginRootContained(record, source)`. Nothing was copied, and `fallow dupes` is clean.
- `LegacyServersSource` gains a required `locations: ScopedLocations`. `LegacyServersUnreadableReason` gains `"uncontained"`. `createLegacyServersReader` refuses with it before `loadMarketplaceManifest`.
- The registration step keeps its `its plugin root is outside its sources` debug line by calling the moved check first. It then builds the reader with `{ ...source, locations }`.
- `recordedMcpServers` passes its `recorded MCP servers unreadable: ...` line through `redactAbsolutePaths` (UF-4).
- `.fallowrc.json`: `entry` is `["extensions/pi-claude-marketplace/index.ts"]` and the `ignoreExports` key is gone. `LegacyServersUnreadableError` and `LegacyServersUnreadableReason` are module-private. `StoredMcpCompatibility` and `LegacyServers` stay exported, and fallow does not report them.

## Task Commits

1. **Task 1 (tracer): contain the legacy reader to the record's clone root.** Commit `41bc6ae` (fix). Tracer gate: the run is end-of-phase with an automated-only `<verify>`. Every `<automated>` command was re-run and passed. Tracer verified end to end, so Task 2 went ahead.
2. **Task 2: redact the log line and drop the frozen-module export exemptions.** Commit `698a3a6` (chore).

The hook refuses a commit with a failing staged test, so each task's tests and code went into one commit. The RED runs are recorded below.

## Locations passed per call site (Task 1, step 3)

| Site | Locations passed | Why they are the record's scope |
|------|------------------|---------------------------------|
| `plugin/mcp-verdict-read.ts` `recordDegradeBaselineReader(active, locations)` | the new `locations` parameter | the caller names the scope of the records it reads |
| `plugin/dependency-move.ts` `moveArgs` | `context.locations` | the same context gives `scope: context.scope` and `locations: context.locations` to the move whose record the baseline reads |
| `plugin/info.ts` `readInstalledRecord` (block builder) | `locations` (`locationsFor(scope, cwd)`, built once per block) | `mpRecord` comes from `scope`'s state file |
| `plugin/list-installed-row.ts` `composeInstalledListRow` | `locationsFor(options.pluginScope, options.cwd)` | list-flow documents `mpRecord` as the marketplace record from `<pluginScope>`'s state, and the orphan fold passes `pluginScope: "project"` with the project's record |
| `plugin/install-flow-results.ts` `promoteDependencyRecord` | `args.locations` | `install-flow-ledger.ts` passes the `state` and `locations` of one transaction together |
| `plugin/install-flow-results.ts` `declareInstalledPlugin` | `args.locations` | same caller, same pair |
| `plugin/update-swap.ts` `partialDegradeOf` | `args.locations` | `preflight.state` is the locked state of `args.scope`, and `args.locations` is that scope's |
| `reconcile/convergence.ts` `recordMove` | `input.locations` | the convergence input carries one scope's state view and its locations |
| `reconcile/mcp-migration.ts` `ownerAction` | the `locations` parameter | `ownerActions(input, locations, tx.state, owners)` passes the state locked under those locations |
| `edge-deps.ts` `classifyInstalledPluginRow` | `locationsFor(scope, cwd)` | the caller loaded `mp` from `locationsFor(scope, cwd).extensionRoot` |
| `mcp/builtin-registration-step.ts` `recordRegistrations` | its `locations` (`locationsFor(scope, session.cwd)`) | `scopeRegistrations` loads the state from those locations |

## Files Created/Modified

- `orchestrators/mcp/recorded-servers.ts`: the moved containment check, `locations` on the source, the `uncontained` refusal, the redacted debug line, and the module-private error and reason.
- `orchestrators/mcp/builtin-registration-step.ts`: the moved code is removed. The step calls `isPluginRootContained`, and the `frozen` adjective is dropped from its header.
- `orchestrators/plugin/mcp-verdict-read.ts`: `recordDegradeBaselineReader(active, locations)`, plus documentation.
- The other eight production files: one `locations` member (or argument) at each source site.
- `test/orchestrators/mcp/recorded-servers.test.ts`: a hermetic `ScopedLocations` fixture, valid clone and mirror keys for the git and tag-pinned cases, six `uncontained` rows, a contained cloned-marketplace case, two `recordedMcpServers` UF-1 cases, the UF-4 redaction case, and refusals asserted as `{ name: "LegacyServersUnreadableError", reason, plugin, marketplace }` without the class import.
- `test/orchestrators/plugin/mcp-verdict-read.test.ts`: a hermetic fixture with `locations`, the uncontained verdict case, and a case for the baseline reader's locations.
- `.fallowrc.json`: one entry, no `ignoreExports`.

No test file changed beyond the frontmatter list. `test/orchestrators/mcp/builtin-registration-step.test.ts` is in the plan's list but did not change: its UF-1 cases pass as written.

## Decisions Made

See key-decisions above and the Dubious Choices below.

## Deviations from Plan

None in production scope. One process deviation is recorded as P6-DC-0806: the commit hooks ran without the nondac script-shell prefix.

## Issues Encountered

- The first form of the verdict-read UF-1 case used a path record outside its marketplace. It passed at HEAD, because the root-mismatch refusal already made it unreadable, so it did not discriminate. It was rewritten as a git-source record, whose root callback answers the recorded root, so only containment can refuse it. It then went RED.
- The first `check:static` run failed `format:check` on two files. `prettier --write` fixed them, and the commit hook's `check:commit` passed.

## Red proofs

| Run | Command | Exit | Counts | Verdict |
|-----|---------|------|--------|---------|
| Task 1 RED (tests on 837a0da code) | `node --test --test-reporter=tap test/orchestrators/mcp/recorded-servers.test.ts test/orchestrators/plugin/mcp-verdict-read.test.ts` | 1 | 40 tests, 32 pass, 8 fail; every failure `ERR_ASSERTION` (`testCodeFailure`) | the 6 `UF-1: refuses ... before it reads the manifest` rows (rejection was the manifest's ENOENT, not `LegacyServersUnreadableError`), `UF-1: reads a legacy record ... as unreadable` (log named `root-mismatch`, not `uncontained`), and `UF-1: keeps the stored verdict of a git record ...` (re-resolved instead of unreadable) |
| Task 1 classifier | `gsd-tools check tdd-red-evidence` on the recorded-servers.test.ts TAP (25 tests, 7 fail), target `UF-1: refuses a git record under the plugin clones whose clone key is malformed before it reads the manifest` | - | - | `RED_EVIDENCE_OK` (`target_test_failed`) |
| Task 2 RED (test on 41bc6ae code) | `node --test --test-reporter=tap test/orchestrators/mcp/recorded-servers.test.ts` | 1 | 26 tests, 25 pass, 1 fail (`ERR_ASSERTION`) | target `UF-4: logs a legacy reader failure that names an absolute path without the path`: the actual line held `/home/someone/.pi/agent/.../marketplace.json`, the expected line `'marketplace.json'`. Classifier `RED_EVIDENCE_OK` |

Semantic assessment: each target ran and failed on its planned assertion: the refusal reason, the log text, or the verdict shape. No load, syntax, or fixture fault occurred. The two refusal-form cases written for Task 2 (`{ name, reason }`) pass before and after, because they only re-express existing assertions.

## Fallow traces

Before the unexport, with the old config (frozen-module entries plus `ignoreExports`):

```
$ npx fallow dead-code --trace extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts:LegacyServersUnreadableError
  UNUSED LegacyServersUnreadableError in extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts
  File: reachable (entry point)
  Namespace: value
  Reason: No internal references, but file is an entry point (export is externally accessible)

$ npx fallow dead-code --trace extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts:LegacyServersUnreadableReason
  UNUSED LegacyServersUnreadableReason in extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts
  File: reachable (entry point)
  Namespace: type
  Reason: No internal references, but file is an entry point (export is externally accessible)

$ npx fallow dead-code --trace extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts:LegacyServers
  UNUSED LegacyServers in extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts
  File: reachable (entry point)
  Namespace: type
  Reason: No internal references, but file is an entry point (export is externally accessible)

$ npx fallow dead-code --trace extensions/pi-claude-marketplace/domain/mcp-implementation.ts:StoredMcpCompatibility
  UNUSED StoredMcpCompatibility in extensions/pi-claude-marketplace/domain/mcp-implementation.ts
  File: reachable (entry point)
  Namespace: type
  Reason: No internal references, but file is an entry point (export is externally accessible)
```

`npx fallow dead-code` after the `.fallowrc.json` edit, before the unexport (exit 1):

```
● Unused exports (1)
  extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts
    :110 LegacyServersUnreadableError
● Unused type exports (1)
  extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts
    :103 LegacyServersUnreadableReason
✗ 1 export · 1 type (0.39s)
  2 issues · 15 suppressed · 0 stale suppressions
```

After the unexport (exit 0): `✓ No issues found (0.57s)`. As the research predicted, fallow reported no other export, so no further `export` or symbol was removed. `StoredMcpCompatibility` and `LegacyServers` stay exported, because exported signatures use them (D-P6-21).

## Parent lines (owned) and their outcome

| Parent line | Outcome | Commit |
|-------------|---------|--------|
| 01-14 "Phase 6, fallow" (config half) | Applied: both frozen-module `entry` lines and every `ignoreExports` entry are removed. The CONVENTIONS/STACK/ARCHITECTURE entry counts are left to plan 06-11. | `698a3a6` |
| 01-14 "Frozen files" (`features/lib/mcp-implementation.ts` exemption) | Confirmed absent at base 837a0da (removed in 13ce40a); no change needed | none |
| 02-01 line 4 / 02-08 item 8 (`recorded-servers.ts` entry and its consumed names) | Applied | `698a3a6` |
| 03-09 ".fallowrc.json" (keep `StoredMcpCompatibility`, `LegacyServers`, `LegacyServersUnreadable*`) | Superseded by D-P6-08/D-P6-21: no exemption is kept. The two unused names became module-private, and the other two need no exemption. | `698a3a6` |
| 04-06 item 10 (drop `ActiveMcpImplementation`) | Applied (the whole `mcp-implementation.ts` exemption is gone) | `698a3a6` |
| 03-09 addendum: containment check on the legacy reader's root (UF-1, 01-SECURITY.md) | Applied: `assertPathInside` against the owning clone root, through the moved check | `41bc6ae` |
| D-P6-10 UF-1 | Applied | `41bc6ae` |
| D-P6-10 UF-4 | Applied | `698a3a6` |

## Checks

| Command | Exit | Duration | Tree | Counts |
|---------|------|----------|------|--------|
| Task 1 RED (see Red proofs) | 1 | about 3 s | 837a0da + new tests | 40 / 32 pass / 8 fail |
| Owner tests, the 11 files of Task 1's `<verify>` (test-reporter) | 0 | about 25 s | Task 1 tree before commit | quiet reporter |
| `npm run test:coverage:direct -- <5 pairs>` | 0 | about 1 min | Task 1 tree | recorded-servers.ts 45/45 branches, 13/13 functions, 289/289 lines; all 5 pairs at 100% |
| `npm run test:integration` | 0 | about 4 min | Task 1 tree | passed |
| `npm run lint` (warm) | 0 | - | Task 1 tree | 0 warnings |
| `npm run check:static` | 1 | about 52 s | Task 1 tree | format:check failed on 2 files, so `prettier --write` was run; all other checks passed |
| `node --test "test/orchestrators/**/*.test.ts"` | 0 | 92 s | Task 1 tree | passed |
| `node --test test/index.test.ts` + edge/bridges/domain/persistence/shared/platform/transaction | 0 | 63 s | Task 1 tree | passed |
| commit hook `npm run check:commit` | 0 | - | `41bc6ae` | passed |
| Task 2 RED (see Red proofs) | 1 | about 2 s | 41bc6ae + new test | 26 / 25 pass / 1 fail |
| `npx fallow dead-code` after the config edit | 1 | 0.4 s | Task 2 tree | 2 issues (the expected two) |
| `npx fallow dead-code` after the unexport | 0 | 0.6 s | Task 2 tree | no issues |
| config check (`node -e ...`) and `npm run fallow` | 0 | about 30 s | Task 2 tree | passed |
| `npx fallow dupes --fail-on-issues` | 0 | 0.15 s | Task 2 tree | no duplication |
| `npm run test:coverage:direct -- recorded-servers.ts` | 0 | about 10 s | Task 2 tree | 26 pass; 45/45 branches, 13/13 functions, 295/295 lines |
| `npm run check:static` | 0 | about 60 s | Task 2 tree | typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features passed |
| commit hook `npm run check:commit` | 0 | - | `698a3a6` | passed |
| Owner tests, the 11 files (TAP) | 0 | 20 s | `698a3a6` | 965 tests, 965 pass, 0 fail |

No cucumber scenario was run: the plan's `<verify>` names none, and the parent's wave gate runs both profiles. The scenarios that strip `mcpServerConfigs` (`features/lib/mcp-builtin-earlier-record.ts`) keep the records' real install roots, which lie inside their clone roots.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Window records

None.

## Dubious Choices

**P6-DC-0801 (Low).** A legacy git record without `resolvedSha` whose root lies under `plugin-clones/` is now refused by the legacy reader as `uncontained`, so its verdict reads keep the stored verdict. Before this plan the reader re-resolved such a record, and its test "re-resolves a git-source record without a recorded sha from its recorded root" pinned that. The test now places the sha-less root inside the marketplace root, and the old shape is one of the `uncontained` rows. Alternative: let `cloneKeyOf` own a sha-less root under `plugin-clones/`. That would change the registration step's UF-1 case "a record without a commit whose root lies in the plugin clones registers nothing", which the plan says must pass unchanged, and it would weaken D-PL2-23's rule that only a record with a commit is owned by a clone. Chosen: one rule for both paths (D-P6-23).

**P6-DC-0802 (Low).** The exported check is named `isPluginRootContained` and takes `(record, source)`, the order the plan's wording gives. Alternatives: keep the private name `isContained`, or take `(source, record)` like `recordedRootContext`. The new name says what is contained.

**P6-DC-0803 (Low).** The registration step builds the reader's source as `{ ...source, locations }`, which also carries its `record` member, and a legacy record's containment is checked twice: once by the step for its own debug line, once by the reader. Alternatives: build a narrow four-member object, or skip the step's check for legacy records. That would lose the step's `outside its sources` line for them, and the plan requires the line. The second check only lstats a few segments.

**P6-DC-0804 (Low).** The refusal assertions use inline `{ name: "LegacyServersUnreadableError", reason, plugin: "p1", marketplace: "mp" }` objects instead of the plan's `{ name, reason }`, so they also pin the error's public `plugin` and `marketplace` fields that `unreadableAs` used to check. There is no replacement helper. Alternative: the plan's two-field form, which is weaker.

**P6-DC-0805 (Low).** In `edge-deps.ts`, `classifyInstalledPluginRow` computes `locationsFor(scope, cwd)` itself. It does not take the caller's `locations` as an eighth parameter. `locationsFor` is pure and gives the same value. Alternative: thread the caller's object.

**P6-DC-0806 (Low).** Both commits ran plain `git commit`. The hook's `npm run check:commit` therefore ran without the `npm_config_script_shell=.../nondac-sh` prefix that the environment section asks for on every commit whose hook runs npm scripts. The hook passed both times. `check:static`, `test:integration`, and direct coverage were also run by hand with the prefix. If a permission test passes only under root's DAC override, the parent's wave gate (with the wrapper) is the authoritative run.

**P6-DC-0807 (Low).** The header of `orchestrators/plugin/mcp-verdict-read.ts` still calls `recordedMcpServers` and `effectiveMcpCompatibility` "frozen", although this plan changed `recorded-servers.ts`. It was left as is to keep the diff to the plan's changes. The step's "frozen legacy reader" wording was the only one fixed, because that file's header changed anyway. Alternative: a comment-only change in Task 1. A later docs pass (06-13's 01-FROZEN.md work) can reword it.

## Next Phase Readiness

- Plan 06-11 updates the codebase maps: `.fallowrc.json` now has one `entry` and no `ignoreExports`, so the CONVENTIONS.md "Frozen exports a later phase consumes" bullet and the entry lists in STACK.md and ARCHITECTURE.md are stale.
- No blockers.

## Self-Check: PASSED

- Found: `extensions/pi-claude-marketplace/orchestrators/mcp/recorded-servers.ts` (`"uncontained"` x2, `function owningRoot` x1, `redactAbsolutePaths` x2, `^class LegacyServersUnreadableError` x1, `^type LegacyServersUnreadableReason` x1)
- Found: `builtin-registration-step.ts` has no `async function owningRoot` (0); `mcp-verdict-read.ts` names `locations` (5); the test names `name: "LegacyServersUnreadableError"` (5)
- Found: commits `41bc6ae` and `698a3a6` on this branch, both after `837a0da`
