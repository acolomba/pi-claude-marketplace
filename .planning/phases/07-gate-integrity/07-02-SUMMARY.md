---
phase: 07-gate-integrity
plan: 02
subsystem: testing
tags: [architecture-gates, target-registry, node-test, fallow, d-07-05, ggat-01]

requires:
  - phase: 07-gate-integrity
    provides: "tests/architecture/gate-targets.ts, the registry module seeded with NETWORK_FREE_TARGETS and MISSING_TARGET_PROBES"
provides:
  - "tests/architecture/gate-targets.ts — 22 obligation-named groups holding 117 full literal repository-relative paths, plus 10 named scalar constants typed as members of their group"
  - "tests/architecture/gate-targets.test.ts — the registry's own gate: resolution, inverted-probe absence, non-emptiness, within-group duplicates, and non-composition, with the groups enumerated from the module namespace"
  - "the measured per-file census of production paths named under tests/architecture/**, split into literal and composed"
  - "the measured fact that a namespace import satisfies fallow dead-code for every export of the imported module"
affects: [07-04, 07-05, 07-06, 07-07, 07-15, 07-16, gate-integrity, architecture-gates]

actuals:
  tokens: 6200
  tasks: 2
  commits: 2
  plan_head_before: 0e146152

tech-stack:
  added: []
  patterns:
    - "Dynamic group enumeration: a gate reads Object.entries(namespace) and filters to array-valued exports, so a group added later is covered without editing the gate"
    - "Namespace import as the registry's consumer of record: it satisfies fallow dead-code for every export, which is what lets a group land before its first real consumer"
    - "Named scalar typed as (typeof GROUP)[number], so the compiler enforces that a second reference points into the group it names"

key-files:
  created:
    - tests/architecture/gate-targets.test.ts
  modified:
    - tests/architecture/gate-targets.ts

key-decisions:
  - "Task order was inverted. The gate landed first against the two groups 07-01 created; the 19 new groups landed second and were covered by the already-committed gate without a line of it changing. That is the T-07-05 mitigation demonstrated rather than asserted."
  - "ZONE_FOLDER_TARGETS holds only the eight `./`-prefixed zone strings; the eight representative modules live in ZONE_REPRESENTATIVE_TARGETS. Mixing a config-shaped directory string with a plain file path in one group would force every consumer to filter by prefix."
  - "`extensions/pi-claude-marketplace/commands/plugin` is deliberately absent from the registry. Its contract is that it does NOT resolve, and a second non-resolving group would break the resolve / must-not-resolve binary partition MISSING_TARGET_PROBES depends on."
  - "The non-composition clause reports offending line TEXT, not line numbers. stripComments collapses multi-line block comments, so a number computed after stripping would not address the file a reader opens."

patterns-established:
  - "Pattern: a gate that enumerates its subject from a module namespace instead of a name list, so omission cannot green it"
  - "Pattern: a group's doc block states what MEMBERSHIP means and names the durable ID, so a future entry can be judged against a rule rather than against the existing entries"
  - "Pattern: cross-group duplicates are legal and documented at the second site; within-group duplicates are a gate failure"

requirements-completed: [GGAT-01]

coverage:
  - id: D1
    description: "Every production path any architecture gate addresses is named once in gate-targets.ts as a full literal, grouped by obligation"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/gate-targets.test.ts#GGAT-01: every declared registry target resolves under the repository root"
        status: pass
      - kind: command
        ref: "grep -v '^\\s*[/*]' tests/architecture/gate-targets.ts | grep -c 'path\\.join\\|`\\${' → 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "The registry gate enumerates its groups dynamically, so a group added later is covered without editing it"
    requirement: GGAT-01
    verification:
      - kind: command
        ref: "grep -c 'GROUP_NAMES\\s*=\\s*\\[' tests/architecture/gate-targets.test.ts → 0"
        status: pass
      - kind: other
        ref: "19 groups added in 7d66c8fe were covered by the gate committed in 22b384fa with no change to the gate file"
        status: pass
    human_judgment: false
  - id: D3
    description: "MISSING_TARGET_PROBES is asserted not to resolve, preserving the WR-06 proof"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/gate-targets.test.ts#WR-06: every MISSING_TARGET_PROBES entry is absent from disk"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every group is non-empty and names no path twice"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/gate-targets.test.ts#D-07-05: every registry group declares at least one target"
        status: pass
      - kind: unit
        ref: "tests/architecture/gate-targets.test.ts#D-07-05: no registry group names the same path twice"
        status: pass
    human_judgment: false
  - id: D5
    description: "The registry composes no path, and the resolution clause is proved to fire on a planted non-resolving entry"
    requirement: GGAT-01
    verification:
      - kind: unit
        ref: "tests/architecture/gate-targets.test.ts#D-07-05: the registry composes no path of its own"
        status: pass
      - kind: unit
        ref: "tests/architecture/gate-targets.test.ts#the resolution clause reports an entry that does not resolve"
        status: pass
    human_judgment: false
  - id: D6
    description: "The slice holds under both complexity ceilings, all three Fallow sub-gates, ESLint, Prettier, and the whole architecture suite"
    requirement: GGAT-01
    verification:
      - kind: other
        ref: "npx fallow health/dead-code/dupes --fail-on-issues; npx eslint tests/architecture/gate-targets*.ts --max-warnings=0; npx prettier --check 'tests/architecture/*.ts'; node --test 'tests/architecture/**/*.test.ts' → 390 pass 0 fail"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-10
status: complete
---

# Phase 7 Plan 02: Gate Target Registry Summary

**Every production path the architecture gates address now lives in one module as 117 full literal repository-relative strings across 22 obligation-named groups, and the module's own gate enumerates those groups from its namespace — so the 19 groups added in the second commit were proved by the gate written in the first without touching a line of it.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-10T15:26:00Z
- **Completed:** 2026-09-10T16:01:00Z
- **Tasks:** 2 of 2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- Measured the census first, then wrote it. A strip-comments-then-scan over all 44 `.ts` files under `tests/architecture/` produced the per-file table below; the registry was seeded from that measurement rather than from the plan's prose.
- Grew `gate-targets.ts` from 2 groups / 27 entries to **22 groups / 117 entries**, plus 10 named scalar constants each typed as `(typeof GROUP)[number]` so the compiler enforces that the named reference points into the group it belongs to.
- Wrote `gate-targets.test.ts` with six cases covering all five behaviours the plan names, and enumerating its subject from the module namespace so a later group cannot escape the proof by omission (`T-07-05`).
- Established the ordering fact that unblocks waves 3 through 7: **a namespace import satisfies `fallow dead-code` for every export of the imported module.** That is what makes a registry group committable ahead of the gate that will really consume it — the constraint `07-01` hit three times and worked around by deferral.
- Created the three directory-root constants `07-01` deferred (`EXTENSION_ROOT_REL`, `ORCHESTRATORS_REL`, `ARCHITECTURE_DIR_REL`) plus three more roots gates spell locally, and put them inside a resolution-checked group rather than leaving them as loose strings.

## Task Commits

1. **Task 2 (executed first): Gate the registry on resolution, non-emptiness, duplicates, and non-composition** — `22b384fa` (test)
2. **Task 1 (executed second): Seed every remaining gate group from the measured census** — `7d66c8fe` (test)

The inversion is deliberate and is deviation 1 below.

## Measured Census of Production Paths Named Under `tests/architecture/**`

Method: for each of the 44 `.ts` files under `tests/architecture/`, strip block and line
comments (the same `stripComments` step every scanning clause uses, and the reason a file header
may legally name the path it guards), then extract (a) string literals that are repository-relative
production paths and (b) sites that compose one from a root constant. Import specifiers
(`../../extensions/...`) are excluded: a test must import the module it exercises, and that
specifier is resolved by the module loader, not by a gate.

**20 files name no production path at all** — they reach production only through import
specifiers. Among them: `config-state-consistency`, `markers-snapshot`, `cross-op-convergence`,
`cross-surface-reason-parity`, `flag-catalog-drift`, `hooks-async-rewake`, `hooks-foundation`,
`hooks-if-field`, `hooks-translators`, `integration-materialization-gate`,
`notify-closed-set-locks`, `notify-grammar-invariant`, `notify-producer-wire-coverage`,
`notify-stamp-coverage`, `notify-will-reload-agreement`, `revalidation`,
`no-orchestrator-network` (migrated by `07-01`), and `disabled-state-classification`'s sibling
helpers.

**24 files do.** Per file, `L` = full literal paths, `C` = composed:

| File | L | C | Composition site | Registry group now carrying them |
|------|---|---|------------------|----------------------------------|
| `gate-targets.ts` | 27 | 0 | — | itself (now 117) |
| `import-boundaries.test.ts` | 3 | 49 | `${EXTENSION_ROOT}/…` × 40; `PLUGIN_LEDGERS`/`MARKETPLACE_LEDGERS` joined into regexes and `${ORCHESTRATORS_REL}/plugin/${name}.ts` × 9 | `ZONE_FOLDER_TARGETS`, `ZONE_REPRESENTATIVE_TARGETS`, `PLUGIN_LEDGER_TARGETS`, `MARKETPLACE_LEDGER_TARGETS`, `PACKAGE_JSON_REL`, `ORCHESTRATORS_REL` |
| `no-credential-leak.test.ts` | 10 | 0 | `path.join(REPO_ROOT, …)` × 4 over named constants | `CREDENTIAL_LEAK_TARGETS` |
| `manifest-lookup-drift.test.ts` | 9 | 0 | — | `MANIFEST_LOOKUP_TARGETS` |
| `partial-vocabulary-guard.test.ts` | 7 | 3 | `EXT_ROOT`, `ARCH_DIR` walks; `path.join(ARCH_DIR, "catalog-uat", …)` | `VOCABULARY_GUARD_DOC_TARGETS`, `EXTENSION_ROOT_REL`, `ARCHITECTURE_DIR_REL` |
| `scope-fences-63.test.ts` | 6 | 0 | — | `SCOPE_FENCE_TARGETS`, `PLUGIN_EDGE_HANDLERS_REL` (one path excluded, see below) |
| `disabled-state-classification.test.ts` | 5 | 0 | — | `DISABLED_STATE_TARGETS` |
| `hooks-dispatch.test.ts` | 4 | 0 | — | `NO_CONSOLE_EXEMPT_TARGETS`, `ESLINT_CONFIG_REL` |
| `no-lifecycle-default-enabled-read.test.ts` | 4 | 0 | — | `LIFECYCLE_ENABLED_READ_TARGETS` |
| `compat-01-no-expansion.test.ts` | 4 | 0 | — | `COMPAT_NO_EXPANSION_TARGETS` (+ the two `info.ts` paths already in `NETWORK_FREE_TARGETS`) |
| `config-state-write-seams.test.ts` | 3 | 1 | `path.join(REPO_ROOT, "extensions/pi-claude-marketplace")` | `STATE_WRITE_SEAM_TARGETS`, `EXTENSION_ROOT_REL` |
| `no-shell-out.test.ts` | 3 | 1 | extension-root walk | `SHELL_OUT_EXEMPT_TARGETS`, `EXTENSION_ROOT_REL` |
| `scope-order-drift.test.ts` | 2 | 0 | leading-slash allowlist form | `SCOPE_ORDER_CANONICAL_TARGETS` |
| `hooks-lifecycle.test.ts` | 0 | 5 | `ORCH_DIR` + `path.join` × 4, plus `EVENT_ROUTER_PATH` | `HOOKS_LIFECYCLE_TARGETS`, `PLUGIN_ORCHESTRATORS_REL` |
| `reconcile-planner-purity.test.ts` | 1 | 0 | — | `RECONCILE_PURITY_TARGETS` |
| `no-hooks-strict-additional-properties.test.ts` | 1 | 0 | — | `HOOKS_SCHEMA_TARGETS` |
| `no-split-01-cast-reads.test.ts` | 1 | 1 | orchestrators-directory walk | `ORCHESTRATORS_REL` |
| `manifest-read-seam.test.ts` | 0 | 2 | extension-root walk; `` `extensions/pi-claude-marketplace/${rel}` `` offender label | `EXTENSION_ROOT_REL` |
| `hooks-cap-notify.test.ts` | 1 | 0 | — | `VOCABULARY_GUARD_DOC_TARGETS` (`docs/output-catalog.md`) |
| `extension-version-sync.test.ts` | 1 | 0 | — | `PACKAGE_JSON_REL` |
| `no-telemetry-deps.test.ts` | 1 | 0 | — | `PACKAGE_JSON_REL` |
| `peer-floor.test.ts` | 1 | 1 | `package-lock.json` join | `PACKAGE_JSON_REL`, `PACKAGE_LOCK_REL` |
| `unit-suite-glob-completeness.test.ts` | 1 | 1 | `TEST_ROOT` join | `PACKAGE_JSON_REL` |
| `source-scan.ts` / `temp-root-control.ts` | 0 | 2 | `path.join(REPO_ROOT, rel)` — the mechanic itself | none; joining a caller's target onto the root is what these modules are for |

**Totals:** 89 full literal production paths and **68 composed references** across 24 files.
The composed count is the number `D-07-05` exists for: a literal-match stale-path scan reads
none of them.

`07-16-PLAN.md` should compare against this table. Two entries in it are expected to stay
composed forever — `source-scan.ts` and `temp-root-control.ts` join a caller-supplied
repository-relative target onto the scan root, which is the mechanic itself and not a target
declaration.

## Negative Controls Observed

Both required controls were performed against the committed gate and reverted:

1. **Non-resolving entry appended to a real group.** Adding
   `extensions/pi-claude-marketplace/orchestrators/plugin/control-does-not-exist.ts` to
   `NETWORK_FREE_TARGETS` failed exactly one case —
   `GGAT-01: every declared registry target resolves under the repository root` — with
   `actual: [ 'NETWORK_FREE_TARGETS: extensions/pi-claude-marketplace/orchestrators/plugin/control-does-not-exist.ts' ]`.
   The other five stayed green, so the clause discriminates. Restored; 6 pass, 0 fail.
2. **A real group emptied.** Replacing `NETWORK_FREE_TARGETS`'s 23 entries with `[]` failed
   exactly one case — `D-07-05: every registry group declares at least one target` — with the
   `these registry groups are empty, so every gate importing one inspects nothing and reports
   success over zero targets` message. Restored; 6 pass, 0 fail.

## Final Counts

- `gate-targets.ts`: **22 array groups, 117 entries**, plus 10 named scalars. 21 groups resolve;
  `MISSING_TARGET_PROBES` (4) deliberately does not.
- Largest groups: `NETWORK_FREE_TARGETS` 23, `CREDENTIAL_LEAK_TARGETS` 10,
  `MANIFEST_LOOKUP_TARGETS` 9, `ZONE_FOLDER_TARGETS` 8, `ZONE_REPRESENTATIVE_TARGETS` 8.
- Plan-named counts confirmed: `PLUGIN_LEDGER_TARGETS` = 5, `MARKETPLACE_LEDGER_TARGETS` = 4,
  `NO_CONSOLE_EXEMPT_TARGETS` = the exact three strings the criterion names.
- `tests/architecture/gate-targets.test.ts`: 6 passing cases, 0 failing.
- Whole architecture suite: **390 passing, 0 failing.**
- `npx fallow health --fail-on-issues`: `0 above threshold · 12706 analyzed`.
- `npx fallow dead-code --fail-on-issues`: no issues. `npx fallow dupes`: exit 0, and the new
  module appears in no clone group.
- Non-composition verify: `grep -v '^\s*[/*]' tests/architecture/gate-targets.ts | grep -c
  'path\.join\|` + "`" + `\${'` prints **0**.
- Dynamic-enumeration verify: `grep -c "GROUP_NAMES\s*=\s*\[" tests/architecture/gate-targets.test.ts`
  prints **0**.

## Decisions Made

- **The gate landed before the data it gates.** `07-01` measured that an unconsumed
  `export const` under `tests/architecture/` makes `fallow dead-code` exit 1, and deferred three
  constants because of it. Rather than inherit that deferral, the ordering was inverted: the gate
  shipped first against the two groups that already existed, and its namespace import then served
  as the consumer of record for all 19 groups added next. The side effect is the strongest
  evidence this plan produces for `T-07-05` — 19 groups became covered by a gate whose file did
  not change.
- **Cross-group duplicates are legal; within-group duplicates are not.** `docs/output-catalog.md`
  is a member of both `VOCABULARY_GUARD_DOC_TARGETS` and `COMPAT_NO_EXPANSION_TARGETS`, and the
  second site says why: the two obligations are independent and either could be retired without
  the other. The duplicate clause is therefore scoped within a group, which is also the only
  scope where a duplicate causes real harm — it makes a gate's visitation report disagree with
  its declared list.
- **Named scalars are typed as group members.** `EXTENSION_ROOT_REL` and the nine others are
  declared `(typeof DIRECTORY_ROOT_TARGETS)[number]` / `(typeof REPO_MANIFEST_TARGETS)[number]`,
  copying `07-01`'s `NETWORK_FREE_CONTROL_TARGET` form. Assigning a path the group does not name
  stops compiling, so the named constant cannot drift away from the resolution-checked group —
  which is what gives a loose root string the same coverage as an array entry.
- **Group names carry the obligation, not the consuming file.** `NO_CONSOLE_EXEMPT_TARGETS`, not
  `HOOKS_DISPATCH_TARGETS`. `07-05`'s effective-config gate and the surviving `hooks-dispatch`
  clause are two consumers of one obligation, and a file-named group would have forced the second
  consumer to either import a misleading name or declare a second copy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Task order inverted — the gate was written and committed before the registry groups**

- **Found during:** planning the first commit, before any file was written
- **Issue:** The plan orders Task 1 (add ~19 exported groups) before Task 2 (write the gate that
  consumes them). `07-01` measured that a single unconsumed `export const` under
  `tests/architecture/` makes `fallow dead-code` report `● Unused exports (1)` and exit 1, and
  `npm-fallow` is a pre-commit hook matching `tests/.*\.ts`. A Task-1-first commit would have
  carried 19 unconsumed exports and could not have been committed at all.
- **Fix:** Measured the exact rule first with a throwaway two-export module plus a namespace-import
  consumer: `npx fallow dead-code --fail-on-issues` printed `✓ No issues found` and exited 0, so a
  namespace import satisfies dead-code for every export of the imported module. The gate
  (`gate-targets.test.ts`, which imports `* as registry`) was therefore committed first against the
  two groups `07-01` created, and the 19 new groups were committed second. Both commits are green
  under all three Fallow sub-gates.
- **Files modified:** none beyond the two the plan declares; only which commit carries which file
  changed.
- **Verification:** `22b384fa` and `7d66c8fe` each passed `SKIP=trufflehog pre-commit run --files`
  with `npm fallow` green.
- **Committed in:** `22b384fa`, `7d66c8fe`

**2. [Rule 3 - Blocker] `ZONE_FOLDER_TARGETS` split into two groups**

- **Found during:** Task 1
- **Issue:** The plan puts the eight `./extensions/pi-claude-marketplace/<folder>` zone strings and
  "one real representative `.ts` file per folder" in one group. The zone strings carry a leading
  `./` because that is how the ESLint `no-restricted-paths` `target` field spells them; the
  representative files do not. A single mixed group forces every consumer to filter by prefix to
  find the half it wants, and a consumer that forgot would compare a config value against a file
  path.
- **Fix:** `ZONE_FOLDER_TARGETS` holds the eight `./`-prefixed strings and
  `ZONE_REPRESENTATIVE_TARGETS` holds the eight modules, in the same folder order. Both are
  resolution-checked, and the acceptance criterion naming `ZONE_FOLDER_TARGETS` is still satisfied.
- **Files modified:** `tests/architecture/gate-targets.ts`
- **Verification:** both groups resolve; 6 pass, 0 fail.
- **Committed in:** `7d66c8fe`

**3. [Rule 3 - Blocker] `extensions/pi-claude-marketplace/commands/plugin` excluded from the registry**

- **Found during:** Task 1
- **Issue:** `scope-fences-63.test.ts:45` names that directory as `PLUGIN_COMMANDS_DIR_REL`, so the
  census picks it up. Measured: it does not exist, and it is not supposed to — the gate asserts its
  ABSENCE against a historical layout. Adding it to `SCOPE_FENCE_TARGETS` would have failed the
  resolution clause; adding a second must-not-resolve group would have broken the binary partition
  the gate's `MUST_NOT_RESOLVE_GROUP` constant depends on, and diluted `MISSING_TARGET_PROBES`'s
  documented `WR-06` contract with an unrelated member.
- **Fix:** Excluded, with the reason recorded in `SCOPE_FENCE_TARGETS`'s doc block so a later reader
  does not re-add it. Recorded here and in the census table so `07-16-PLAN.md` can account for it.
- **Files modified:** `tests/architecture/gate-targets.ts`
- **Verification:** `[ -e extensions/pi-claude-marketplace/commands/plugin ]` → false; all other 117
  entries resolve.
- **Committed in:** `7d66c8fe`

**4. [Rule 1 - Stale premise] The three directory-root constants the plan says "already exist from `07-01`" did not exist**

- **Found during:** Task 1
- **Issue:** The plan's action text states `EXTENSION_ROOT_REL`, `ORCHESTRATORS_REL`, and
  `ARCHITECTURE_DIR_REL` "already exist from `07-01`". They do not — `07-01` deviation 2 deferred
  all three to their first consumer for the fallow reason above.
- **Fix:** Created here, along with three further roots the census found gates spelling locally
  (`PLUGIN_ORCHESTRATORS_REL`, `HOOKS_BRIDGE_REL`, `PLUGIN_EDGE_HANDLERS_REL`). All six are members
  of `DIRECTORY_ROOT_TARGETS`, so they are resolution-checked rather than loose strings, which is
  strictly better than the plan's shape.
- **Files modified:** `tests/architecture/gate-targets.ts`
- **Verification:** all six resolve; the resolution clause covers them via the group.
- **Committed in:** `7d66c8fe`

---

**Total deviations:** 4 auto-fixed (3 × Rule 3 - blocking issue, 1 × Rule 1 - stale premise).
**Impact on plan:** No scope creep and no weakened assertion. Deviation 1 changes only which of
two adjacent commits carries which file, and turns a constraint into this plan's clearest piece of
evidence. Deviations 2 and 4 make the registry's shape stricter than the plan's wording, not looser.
Deviation 3 removes one path from the registry and records why in two places.

## Issues Encountered

**Sibling typecheck noise on the shared tree.** Six agents run concurrently in this checkout.
`npm run typecheck` reported 7 `TS2554` errors in `tests/orchestrators/plugin/reinstall-flow.test.ts`
and `reinstall-replace.test.ts` mid-run — the sibling plan removing `__operations` and `__deps`
(`D-07-18`), not this plan's files. Re-run after ~2 minutes: clean. Both pre-commit runs reported
`files were modified by this hook` against whole-repo hooks (`npm lint` once, `npm typecheck` once)
for the same reason; both runs exited 0 and neither hook rewrote either of this plan's files
(`git status` showed only the intended modification each time). No sibling file was edited.

**The `WINDOWS.md` ledger still cannot be appended to.** `07-01` recorded that
`gsd-tools windows append` refuses with a table-versus-fenced-JSON desync on rows 30 and 9. That
condition is unchanged and predates both plans. This plan produced no stub, no skipped test, and no
unrun `<verify>`, so nothing was owed to the ledger beyond the four deviations above, which are
recorded here. The desync still wants reconciling before the ship gate reads it.

**`npx fallow dupes` reports 879 duplicated lines across 38 files** versus the 873 / 38 `07-01`
recorded. The delta is sibling work landing in the same tree; the exit code is 0, the threshold is
unchanged, and neither file this plan touches appears in a clone group.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The registry is complete and self-checking. What later plans in this phase need to know:

- **Import your targets, do not spell them.** Every group is named for its obligation, so the
  right import usually already exists. The census table above maps every gate file to the group
  now carrying its paths.
- **A new group is free to add.** The gate enumerates from the namespace, so adding a group needs
  no edit to `gate-targets.test.ts` — but the group must be non-empty, duplicate-free within
  itself, and every entry must resolve.
- **A namespace import satisfies `fallow dead-code`.** Measured this session. A registry group can
  therefore land in a commit before the gate that really consumes it, which removes the ordering
  constraint `07-01` worked around three times.
- **`D-07-06` is still open.** The self-hosting meta-gate — a production path named anywhere under
  `tests/architecture/**` outside the registry is an offender — lands in `07-16-PLAN.md`. Until it
  does, the 68 composed references the census counted stay invisible to a literal-match scan, and
  the registry's completeness is a fact about today rather than an enforced property. The census
  table is the baseline it should be measured against.

---
*Phase: 07-gate-integrity*
*Completed: 2026-09-10*

## Self-Check: PASSED

- `tests/architecture/gate-targets.test.ts` — present on disk.
- `tests/architecture/gate-targets.ts` — present on disk, 22 groups / 117 entries.
- `.planning/phases/07-gate-integrity/07-02-SUMMARY.md` — present on disk.
- `22b384fa`, `7d66c8fe` — both reachable in `git log --oneline --all`.
- `.planning/STATE.md` and `.planning/ROADMAP.md` — untouched; the orchestrator owns those writes.
