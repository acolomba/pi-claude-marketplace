---
phase: 07-gate-integrity
plan: 06
subsystem: testing
tags: [architecture-gates, composed-targets, target-registry, visitation, d-07-03, d-07-05, ggat-01]

requires:
  - phase: 07-gate-integrity
    provides: "tests/architecture/gate-targets.ts — 22 groups / 117 literal targets, and the measured literal-vs-composed census in 07-02-SUMMARY.md"
  - phase: 07-gate-integrity
    provides: "tests/architecture/source-scan.ts — the exported REPO_ROOT and the ScanReport visitation contract"
provides:
  - "the measured composed-target census across all 70 .ts files under tests/architecture/**, every site classified production or non-production with a reason"
  - "tests/architecture/hooks-lifecycle.test.ts — five named production targets and the orchestrator walk root sourced from the registry, with a per-name basename control and a non-zero walked-file assertion"
  - "six further gates carrying an explicit D-07-03 visitation assertion, each observed failing on a planted control"
  - "the measured private-REPO_ROOT count before and after, and the total unit-suite case count"
affects: [07-16, gate-integrity, architecture-gates]

actuals:
  tokens: 5900
  tasks: 3
  commits: 4
  plan_head_before: bff4ee82

tech-stack:
  added: []
  patterns:
    - "Positional registry binding plus a per-name basename control: a tuple group is destructured by position, and every read states the basename it expects, so a reordered group fails loudly instead of rebinding every local name at once"
    - "Visitation assertion sited at the vacuity, not at the top of the case: each gate asserts the specific quantity whose emptiness would make its own conclusion trivially true"

key-files:
  created: []
  modified:
    - tests/architecture/hooks-lifecycle.test.ts
    - tests/architecture/hooks-async-rewake.test.ts
    - tests/architecture/integration-materialization-gate.test.ts
    - tests/architecture/extension-version-sync.test.ts
    - tests/architecture/hooks-cap-notify.test.ts
    - tests/architecture/no-telemetry-deps.test.ts
    - tests/architecture/peer-floor.test.ts

key-decisions:
  - "A composed path is not the offence; a composed production TARGET NAME is. path.join(tmpdir(), …), path.join(pluginRoot, 'agents', 'dormant.md'), and path.join(REPO_ROOT, <full literal rel>) all stayed, because none of them hides a production target from a literal-match scan of the registry."
  - "The registry groups are `as const` tuples, so importing five targets means destructuring by position. Every read therefore states the basename it expects — reordering the group otherwise rebinds all five local names at once and every block goes on passing over the wrong file."
  - "Two of the three files Task 2 names compose no production path at all and never carried a private REPO_ROOT. Their D-07-03 obligation was met by asserting the quantity whose emptiness would green each case, not by inventing a registry import they do not need."
  - "No registry group was missing. Every target this plan needed already existed in gate-targets.ts, so nothing had to be added to a file nobody owns this wave."

requirements-completed: [GGAT-01]

coverage:
  - id: D1
    description: "Every composed production target under tests/architecture/** is measured and classified, production or non-production, with a reason"
    requirement: GGAT-01
    verification:
      - kind: other
        ref: "scanner over all 70 .ts files under tests/architecture/**; 33 files carry 350 composition sites; table recorded below"
        status: pass
    human_judgment: false
  - id: D2
    description: "hooks-lifecycle's four path.join ledger targets, its event-router target, and its walk root come from the registry"
    requirement: GGAT-01
    verification:
      - kind: command
        ref: "grep -c 'path.join(ORCH_DIR' tests/architecture/hooks-lifecycle.test.ts → 0"
        status: pass
      - kind: command
        ref: "grep -c 'import.meta.dirname' tests/architecture/hooks-lifecycle.test.ts → 0"
        status: pass
      - kind: unit
        ref: "tests/architecture/hooks-lifecycle.test.ts — 7 cases, same count as before the change"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each migrated gate proves it inspected something: a resolves-and-non-empty assertion for a named target, a non-zero count for a walk"
    requirement: GGAT-01
    verification:
      - kind: other
        ref: "six planted controls, one per new assertion, each observed failing with its own D-07-03 / D-07-05 message and then reverted"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each joined-name pattern carries a positive control per name"
    requirement: GGAT-01
    verification:
      - kind: other
        ref: "no joined-name regex exists in this plan's seven files (grep for .join(\"|\") and new RegExp( → no match); the two D-07-08 sites are in import-boundaries.test.ts, owned by 07-07. The positional-binding basename control is the equivalent per-name proof for the tuple imports this plan introduces, and was observed firing."
        status: pass
    human_judgment: false
  - id: D5
    description: "The private-REPO_ROOT count is measured before and after, and the suite is intact"
    requirement: GGAT-01
    verification:
      - kind: command
        ref: "node --test 'tests/architecture/*.test.ts' → 383 pass 0 fail; 'tests/architecture/**/*.test.ts' → 399 pass 0 fail; npm test → 5924 pass 0 fail"
        status: pass
      - kind: command
        ref: "npx eslint tests --max-warnings=0; npx prettier --check 'tests/architecture/*.ts'; npx fallow health --fail-on-issues → 0 above threshold"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-09-10
status: complete
---

# Phase 7 Plan 06: Composed-Target Discoverability Summary

**Every production target name that `tests/architecture/**` used to assemble from segments now comes from the registry as a whole literal, and seven gates that could have reported success over an unread file, an unwalked directory, an unspawned process, or an unwritten fixture now each assert the one quantity whose emptiness would have made their own conclusion trivially true.**

## Performance

- **Duration:** 70 min
- **Tasks:** 3 of 3
- **Files modified:** 7 (0 created)

## Task Commits

1. **Task 1: Measure the census and re-point the largest production composer** — `2deca737` (test)
2. **Task 2: Migrate the remaining composers the census found** — `0b2b694f` (test)
3. **Task 3: Fold the last three private roots and prove the suite intact** — `5910ced5` (test)

`plan_head_before` is `bff4ee82`. `git rev-list bff4ee82..HEAD --count` reports **10**, not 4:
five executors share this working tree and this branch, so the range is contaminated by sibling
commits. The measured count for THIS plan is `git log --oneline --grep='(07-06)' | wc -l` → **3**
task commits, plus this SUMMARY commit = **4**.

## The Measured Composed-Target Census

Method: walk all `.ts` files under `tests/architecture/**` (70 files, including the `catalog-uat/`
subdirectory). Per file, over raw lines with comment lines and `import` statements excluded, record
every site that assembles a path: a `path.join` / `path.resolve`, a template literal interpolating an
identifier followed by `/`, and a name list joined into a regex alternation. **33 of 70 files carry
350 such sites.**

The classification rule the plan sets: a **production composition** produces a path under
`extensions/pi-claude-marketplace/`. Everything else — a `package.json`, a `docs/` file, a `tests/`
path, a `.planning/` fixture, an `mkdtemp` root — stays where it is.

One refinement the measurement forced, and it is the load-bearing one: **`path.join(ROOT, rel)`
where `rel` is already a whole literal repository-relative path is NOT a composed target.** That is
the sanctioned mechanic — `source-scan.ts:106` is exactly this line, and it is the module whose job
it is. The offence is a composition that produces a target NAME which appears nowhere as a literal,
because that is the only shape a literal-match scan of the registry cannot see. Stripping every
`path.join` mechanically would have deleted the mechanic along with the defect.

### Production compositions — a target name assembled from segments

| File | Site | Concrete targets | Resolves today | Disposition |
|------|------|------------------|----------------|-------------|
| `hooks-lifecycle.test.ts` | `ORCH_DIR` (`:44-47`) + `path.join(ORCH_DIR, …)` (`:53-56`); `EVENT_ROUTER_PATH` (`:48-51`); `readdir(ORCH_DIR)` walk (`:307`) | `install-flow.ts`, `uninstall.ts`, `reinstall-flow.ts`, `update-swap.ts`, `bridges/hooks/event-router.ts` + one directory walk | yes (5/5) | **MIGRATED** → `HOOKS_LIFECYCLE_TARGETS`, `PLUGIN_ORCHESTRATORS_REL` |
| `import-boundaries.test.ts` | `` `${EXTENSION_ROOT}/<zone>` `` × 40 (`:67-111`); `PLUGIN_LEDGERS`/`MARKETPLACE_LEDGERS` joined into regexes (`:230,233`); `` `${ORCHESTRATORS_REL}/${subdir}` `` (`:240`); `` `${ORCHESTRATORS_REL}/plugin/${name}.ts` `` (`:267`) | 8 zone folders + 32 `from` entries + 9 ledger modules | yes | **owned by `07-07` this wave — recorded, not edited** |
| `hooks-dispatch.test.ts` | `path.join(process.cwd(), "extensions", "pi-claude-marketplace", "domain", "components", "hooks.ts")` (`:79-86`); `path.join(process.cwd(), "extensions", "pi-claude-marketplace")` (`:24`) | `domain/components/hooks.ts` + the extension-root walk | yes | **owned by `07-07`** |
| `partial-vocabulary-guard.test.ts` | `EXT_ROOT` (`:51`), `ARCH_DIR` (`:52`), `path.join(ARCH_DIR, "catalog-uat", "catalog-contract.test.ts")` (`:102`) | 2 directory walks + 1 `tests/` file | yes | **owned by `07-14`** |
| `config-state-write-seams.test.ts`, `manifest-read-seam.test.ts`, `no-shell-out.test.ts` | `EXTENSION_ROOT = path.join(REPO_ROOT, "extensions/pi-claude-marketplace")` | the extension-tree walk root | yes | **owned by `07-04` / `07-05`** |
| `no-split-01-cast-reads.test.ts` | `ORCHESTRATORS_ROOT = path.join(REPO_ROOT, "extensions/…/orchestrators")` (`:45`) | the orchestrator walk root | yes | **owned by `07-05`** |
| `scope-order-drift.test.ts` | `extensionsRoot = path.join(repoRoot, "extensions")` (`:100`, `:134`) | the extensions walk root | yes | **owned by `07-05`** |
| `no-hooks-strict-additional-properties.test.ts` | `HOOKS_TS_PATH = path.join(REPO_ROOT, "extensions/…/domain/components/hooks.ts")` (`:27`) | one module — the second argument is a whole literal, so a literal scan does see it | yes | **owned by `07-05`** |

**No production composer is left both unmigrated and unowned.** Every row above is either migrated
here or is in another plan's declared `files_modified` for this same wave. Nothing is routed to
`07-16` as unmigrated work.

### Non-production compositions — deliberate, and why they stay

| File(s) | Site | Why it is out of the registry's scope |
|---------|------|----------------------------------------|
| `source-scan.ts:106`, `temp-root-control.ts:69-80` | `path.join(scanRoot \| root, rel)` | This IS the mechanic. Joining a caller-supplied repository-relative target onto a scan root is what these two modules exist to do; the target itself arrives as a whole literal from the registry. |
| `hooks-async-rewake.test.ts` (5 sites), `integration-materialization-gate.test.ts` (17), `config-state-consistency.test.ts` (15), `revalidation.test.ts` (152) | `mkdtemp(path.join(tmpdir(), …))` and everything built beneath the resulting temp root | A fixture path has no production existence to go stale against. Forcing it into the registry would add 189 entries that can never fail the resolution clause, diluting the single scan point instead of sharpening it. |
| `extension-version-sync`, `no-telemetry-deps`, `peer-floor`, `unit-suite-glob-completeness`, `import-boundaries:133` | `package.json`, `package-lock.json` | Not extension modules. They are targets in the registry's `REPO_MANIFEST_TARGETS` sense and are now addressed through `PACKAGE_JSON_REL` / `PACKAGE_LOCK_REL`, but the join itself stays — it is root + whole literal. |
| `hooks-cap-notify`, `catalog-uat/catalog-contract`, `catalog-uat/catalog-parser`, `compat-01-no-expansion:335`, `partial-vocabulary-guard:86-87,358` | `docs/output-catalog.md`, `docs/messaging-style-guide.md`, the PRD | Documents, not production modules. Carried by `VOCABULARY_GUARD_DOC_TARGETS`; the join stays. |
| `unit-suite-glob-completeness:62-73`, `partial-vocabulary-guard:102` | `` `${TEST_ROOT}/…` `` and the `catalog-uat` join | `tests/` paths. `D-07-07` scopes the registry to production targets; a gate whose subject is the test tree is addressing itself. |
| `disabled-state-classification:86`, `manifest-lookup-drift:199`, `manifest-read-seam:48`, `scope-fences-63:128`, `import-boundaries:242`, `hooks-lifecycle` Block F | `` `${dir}/${entry.name}` `` inside a directory walk | A walk reaches a set with no fixed membership — that is the legitimate alternative to a declared list, and the registry carries the walk ROOT instead. Each such walk now needs the non-zero-count assertion, which is `D-07-03`'s half of the obligation. |
| `flag-catalog-drift:57,60` | `` `/nonexistent/${scope}/…` `` | A deliberately-unresolvable stub path inside a test double. It has no target. |
| `revalidation.test.ts` (`.planning/…` inside a temp project root) | `` `${phaseRoot}/01-REVALIDATION.json` `` and 151 siblings | Planning-artifact fixtures materialized inside `mkdtemp`. No production target. |

**Registry groups needed but absent: none.** Every group this plan imported already existed
(`HOOKS_LIFECYCLE_TARGETS`, `PLUGIN_ORCHESTRATORS_REL`, `PACKAGE_JSON_REL`, `PACKAGE_LOCK_REL`,
`VOCABULARY_GUARD_DOC_TARGETS`). Nothing had to be added to `gate-targets.ts`, which no plan owns
this wave.

## What Each Gate Now Proves

`D-07-03` says visitation is proved separately from firing. The productive reading turned out to be:
**assert the specific quantity whose emptiness would make this case's own conclusion trivially true.**
That quantity is different in every file, which is why a single copied assertion would have been
theatre.

| File | The vacuity | The assertion added |
|------|-------------|---------------------|
| `hooks-lifecycle.test.ts` | Blocks A–E match patterns against a source string; an empty read matches nothing and every block passes | `readTargetSource` fails on a zero-length read, per target |
| `hooks-lifecycle.test.ts` Block F | `readdir` over an emptied or moved directory yields no files, and "no file broke the invariant" is trivially true | non-zero walked `.ts` count naming `D-07-03` |
| `extension-version-sync.test.ts` | a manifest with no `version` compares `undefined` against a stale constant | the manifest must declare a string `version` |
| `hooks-async-rewake.test.ts` × 3 | lane parity and epoch isolation both read `processes.calls`; an empty harness satisfies every one of them | the spawn count is pinned (2, 2, and 1) before any conclusion is drawn |
| `integration-materialization-gate.test.ts` | "MCP-only staging materialized no agent, command, or skill" is trivially true if the fixture never wrote one | the three dormant source artifacts must exist before the sibling-absence claim |
| `hooks-cap-notify.test.ts` | an empty fenced block makes the byte-equality pin a comparison against `""` | the extracted catalog block must be non-empty |
| `no-telemetry-deps.test.ts` | every dependency section is optional, so a renamed section yields an empty map and an empty offender list | the merged dependency map must be non-empty |
| `peer-floor.test.ts` | a manifest that stopped declaring the peer surfaces as a lock desync rather than as the missing declaration | the manifest range is asserted present, naming its own cause |

### The positive control per name

`D-07-08`'s worked example — a name list joined into a regex — **has no site in this plan's seven
files.** Measured: `grep -n 'join("|")\|new RegExp(' ` over all seven returns nothing. Both such
sites live in `import-boundaries.test.ts:230,233`, which `07-07` owns this wave.

The equivalent hazard this plan *did* introduce is positional: the registry groups are `as const`
tuples, so importing five targets means `const [A, B, C, D, E] = GROUP`. Reordering the group
rebinds every local name at once while every block keeps passing over the wrong file — the same
"drifted from its name list while still reporting success" failure `D-07-08` names, arriving through
a different door. So every read states the basename it expects and asserts it:
`readTargetSource(INSTALL_REL, "install-flow.ts")`, and the same in `hooks-cap-notify` for
`OUTPUT_CATALOG_REL`.

## Negative Controls Observed

Every assertion added by this plan was watched failing on a planted control, then reverted. Each
control failed the intended case ONLY, so the clauses discriminate.

| # | Control planted | Result |
|---|-----------------|--------|
| 1 | `HOOKS_LIFECYCLE_TARGETS` destructured with the first two names swapped, as a reordered group would produce | 2 of 7 fail: `D-07-05: this block pins install-flow.ts, but the registry target bound to it is …/uninstall.ts` and its mirror. Other 5 green. |
| 2 | `PLUGIN_ORCHESTRATORS_REL` swapped for `docs` (a directory with no `.ts` files) | 1 of 7 fails: `D-07-03: walked extensions/pi-claude-marketplace/orchestrators/plugin and found no .ts files, so this block inspected nothing` |
| 3 | the parsed manifest replaced by one carrying no `version` | 1 of 2 fails: `D-07-03: package.json declares no version, so this gate compared nothing` |
| 4 | `processes.calls` emptied after the pre-reload spawn | 1 of 3 fails: `D-07-03: no pre-reload child was spawned, so the epoch-isolation claim below holds over nothing` |
| 5 | the fixture's `writeFile` of `agents/dormant.md` removed | 1 of 1 fails: `D-07-03: the plugin source is missing a dormant artifact, so the sibling-absence assertion inspects nothing` |
| 6 | `VOCABULARY_GUARD_DOC_TARGETS` destructured at index 1 instead of 0 | 1 of 3 fails: `D-07-05: this gate reads the output catalog, but the registry target bound to it is docs/messaging-style-guide.md` |
| 7 | all four dependency sections dropped from the merge | 1 of 1 fails: `D-07-03: package.json yielded no dependencies, so this ban scanned nothing` |
| 8 | the manifest peer key renamed so the lookup misses | 1 of 2 fails: `D-07-03: package.json declares no peerDependencies["@earendil-works/pi-coding-agent"], so there is nothing to compare the lock against` |

## Measured Counts

**Case counts.** `hooks-lifecycle.test.ts` reported **7 pass / 0 fail** before the change and **7
pass / 0 fail** after — unchanged, as the acceptance criterion requires. No case was added, removed,
renamed, or skipped anywhere in this plan; all seven files hold their original case counts.

| Suite | Result |
|-------|--------|
| `node --test "tests/architecture/*.test.ts"` | **383 pass, 0 fail** |
| `node --test "tests/architecture/**/*.test.ts"` (includes `catalog-uat/`) | **399 pass, 0 fail** |
| `npm test` (whole unit suite) | **5924 pass, 299 suites, 0 fail** |
| `npx fallow health --fail-on-issues` | `0 above threshold · 12744 analyzed · maintainability 91.9` |
| `npx eslint tests --max-warnings=0` | clean |
| `npx prettier --check "tests/architecture/*.ts"` | clean |

`07-02` recorded 390 for `tests/architecture/**/*.test.ts`; it is 399 now. The delta is sibling work
landing in this shared tree during this session, not a case this plan added.

**Private root derivations.** `07-RESEARCH.md` §2 measured 16 `REPO_ROOT = path.resolve` derivations
plus two `import.meta.dirname` roots and one `process.cwd()` root. Measured at the start of this
plan over `tests/architecture/**` (which the research figure did not include — the two `catalog-uat/`
files sit one level deeper): **18** files with `REPO_ROOT = path.resolve`, **2** local `repoRoot`
derivations, **2** `import.meta.dirname` roots (both in `hooks-lifecycle.test.ts`), **3**
`process.cwd()` roots (all in `hooks-dispatch.test.ts`).

Measured after this plan's three commits: **8** files with `REPO_ROOT = path.resolve`. This plan
removed four of them (`extension-version-sync`, `hooks-cap-notify`, `no-telemetry-deps`,
`peer-floor`) and both `import.meta.dirname` roots. The other six removals are concurrent sibling
work in the same tree — the after-count is a whole-directory measurement on a branch five executors
are writing to, so attribute the delta by file, not by the total.

The eight that remain, each with the reason it still carries one:

| File | Why it still has a private root | Owner |
|------|--------------------------------|-------|
| `catalog-uat/catalog-contract.test.ts` | one directory deeper, so its `../../..` derivation differs from the shared `REPO_ROOT`; unowned this wave | — |
| `catalog-uat/catalog-parser.test.ts` | same | — |
| `config-state-write-seams.test.ts` | mid-migration | `07-04` |
| `disabled-state-classification.test.ts` | mid-migration | `07-04` |
| `no-credential-leak.test.ts` | mid-migration | `07-04` |
| `no-shell-out.test.ts` | mid-migration | `07-04` |
| `partial-vocabulary-guard.test.ts` | mid-migration | `07-14` |
| `unit-suite-glob-completeness.test.ts` | its subject is the `tests/` tree and `package.json`, not production; unowned this wave | — |

**Export census delta (for `07-15`):** this plan added **zero** exported symbols and removed
**zero**. Every helper it introduced — `readTargetSource` (`hooks-lifecycle.test.ts:64`) — is
module-local, and `readNonCommentLines` (`:89`) changed signature without changing visibility. No
`export` keyword was added or removed in any of the seven files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Stale premise] Two of Task 2's three files compose no production path and never had a private `REPO_ROOT`**

- **Found during:** Task 1's census, before any Task 2 edit
- **Issue:** Task 2's action text instructs "replace the composition with a registry import" and its
  acceptance criterion asserts `grep -c "REPO_ROOT = path.resolve"` returns 0 for
  `hooks-async-rewake.test.ts` and `integration-materialization-gate.test.ts`. The census measured
  that neither file has ever carried a private root or named a production path — `07-02`'s own
  census had already listed both under "20 files name no production path at all". Their only
  compositions are `mkdtemp` roots and paths built beneath them, which the plan's own classification
  rule keeps out of the registry.
- **Fix:** The `grep` criterion is satisfied as-is (both return 0). Rather than manufacture a
  registry import neither file needs, the D-07-03 obligation was met on its merits: both are
  behavioural gates whose conclusions are vacuous over an empty harness, so each now pins the spawn
  or fixture count that its own conclusion depends on. `integration-materialization-gate`'s case is
  the sharper one — "MCP-only staging materialized no agent, command, or skill" was passing without
  ever checking that the source offered any of the three to skip.
- **Files modified:** `tests/architecture/hooks-async-rewake.test.ts`,
  `tests/architecture/integration-materialization-gate.test.ts`
- **Verification:** controls 4 and 5 above; 6 pass / 0 fail after revert.
- **Committed in:** `0b2b694f`

**2. [Rule 2 - Missing critical] A positional registry binding needed a per-name control the plan did not anticipate**

- **Found during:** Task 1
- **Issue:** `HOOKS_LIFECYCLE_TARGETS` is a five-element `as const` tuple. Importing five named
  targets from it means destructuring by position. The registry's own established alternative — a
  named scalar typed `(typeof GROUP)[number]` — re-spells the whole literal at the use site, which
  is exactly what `D-07-06`'s meta-gate will treat as an offender when it lands. So positional
  destructuring is the only shape available, and it silently rebinds all five local names if the
  group is ever reordered. Every block would keep passing, over the wrong file.
- **Fix:** `readTargetSource(rel, expectedBasename)` asserts the basename before reading, and each
  block names the module it claims to pin. One helper, so no clone-threshold pressure. Applied again
  in `hooks-cap-notify.test.ts` for the same reason.
- **Files modified:** `tests/architecture/hooks-lifecycle.test.ts`,
  `tests/architecture/hooks-cap-notify.test.ts`
- **Verification:** controls 1 and 6 above.
- **Committed in:** `2deca737`, `5910ced5`

**3. [Rule 3 - Blocker] A planning-artifact reference in a comment being edited**

- **Found during:** Task 1
- **Issue:** `hooks-lifecycle.test.ts` Block F carried "the four files wired in this phase", a
  planning-artifact reference forbidden by `.claude/rules/typescript-comments.md`, on a line directly
  adjacent to the new walked-count assertion.
- **Fix:** Reworded to "the four wired lifecycle verbs", which states the same fact about the current
  code. No other comment was touched.
- **Files modified:** `tests/architecture/hooks-lifecycle.test.ts`
- **Verification:** `npx eslint`, `npx prettier --check` clean; the vocabulary guard passes in the
  383-case run.
- **Committed in:** `2deca737`

---

**Total deviations:** 3 auto-fixed (1 × Rule 1 stale premise, 1 × Rule 2 missing critical, 1 × Rule 3
blocker). **Impact:** No assertion, pattern, or failure message was weakened; every edit either added
an assertion or replaced a locally-spelled path with a registry import. No case count changed. No
scope creep: seven files touched, exactly the seven declared.

## Issues Encountered

**Sibling noise on the shared tree, as briefed.** Five executors write this checkout concurrently.
`npm run typecheck` reported 15 `TS1128`/`TS1135`/`TS1472` parse errors in
`tests/orchestrators/plugin/reinstall-flow.test.ts` mid-edit (owned by `07-10`/`07-12`), and
`SKIP=trufflehog pre-commit run --files` reported `npm lint` / `npm format check` failures naming
`tests/orchestrators/plugin/reinstall-flow.test.ts` and `tests/architecture/scope-fences-63.test.ts`
(owned by `07-04`). No sibling file was edited. Each was re-run after a wait until the whole-repo
hooks reported `Passed` for all four; every commit in this plan was made against a clean
`SKIP=trufflehog pre-commit run --files <own files>`. One `npm lint` run reported
`files were modified by this hook` while ESLint itself printed nothing and `npm run lint` exited 0
whole-repo — that is pre-commit detecting a sibling's write inside the hook window, not a finding.

**`WINDOWS.md` still cannot be appended to.** `07-01` and `07-02` both recorded that
`gsd-tools windows append` refuses on a table-versus-fenced-JSON desync. Unchanged. This plan
produced no stub, no skipped test, no `test.only`/`test.skip`/`test.todo`, no coverage-ignore
directive, and no `fallow-ignore` marker, and left no `<verify>` unrun, so nothing was owed to the
ledger beyond the three deviations recorded above.

## Known Stubs

None. Every file this plan touched was scanned for hardcoded empty returns, placeholder text, and
skip markers; nothing was introduced and nothing was left behind.

## Next Phase Readiness

What `07-16` needs from this plan:

- **The census table above is the baseline the meta-gate is measured against.** Every composition
  site under `tests/architecture/**` is in it, classified, with the owning plan named for the rows
  this plan did not edit.
- **No production composer is unowned.** Every remaining one is in `07-07`'s, `07-04`'s, `07-05`'s,
  or `07-14`'s declared file set for this same wave. If any of those does not land, its row above is
  where `07-16` finds it.
- **The meta-gate needs six documented allowances, not one class.** `MISSING_TARGET_PROBES`'
  four fixtures (already known), plus: `source-scan.ts` and `temp-root-control.ts` joining a
  caller's target onto a root; the `mkdtemp` fixture families in `revalidation`,
  `config-state-consistency`, `hooks-async-rewake`, and `integration-materialization-gate`; the two
  `catalog-uat/` files whose depth forces a different root derivation; `flag-catalog-drift`'s
  deliberately-unresolvable `/nonexistent/` stub; and `unit-suite-glob-completeness`, whose subject
  is the test tree itself.
- **`path.join` is not the offence and must not be the meta-gate's pattern.** 350 sites match it;
  fewer than 20 of them hide a production target name. A meta-gate keyed on `path.join` would fire
  on the mechanic it depends on. The discriminating question is whether the composition produces a
  target NAME under `extensions/pi-claude-marketplace/` that appears nowhere as a whole literal.

---
*Phase: 07-gate-integrity*
*Completed: 2026-09-10*

## Self-Check: PASSED

- All seven declared files present on disk and modified: `hooks-lifecycle.test.ts`,
  `hooks-async-rewake.test.ts`, `integration-materialization-gate.test.ts`,
  `extension-version-sync.test.ts`, `hooks-cap-notify.test.ts`, `no-telemetry-deps.test.ts`,
  `peer-floor.test.ts`.
- `2deca737`, `0b2b694f`, `5910ced5` — all three reachable in `git log --oneline --all`.
- `grep -c "path.join(ORCH_DIR" tests/architecture/hooks-lifecycle.test.ts` → 0.
- `grep -c "import.meta.dirname" tests/architecture/hooks-lifecycle.test.ts` → 0.
- `grep -c "REPO_ROOT = path.resolve"` → 0 in each of the six non-`hooks-lifecycle` files.
- `node --test "tests/architecture/*.test.ts"` → 383 pass, 0 fail. `npm test` → 5924 pass, 0 fail.
- `.planning/STATE.md`, `.planning/ROADMAP.md`, `eslint.config.js`,
  `tests/architecture/import-boundaries.test.ts`, `tests/architecture/gate-targets.ts` — all
  untouched by this plan (`git log --oneline --grep='(07-06)' --name-only` names only the seven).
