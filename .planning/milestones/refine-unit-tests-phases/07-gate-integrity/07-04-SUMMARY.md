---
phase: 07-gate-integrity
plan: 04
subsystem: testing
tags: [architecture-gates, target-registry, visitation-proof, node-test, d-07-03, d-07-05, ggat-01]

requires:
  - phase: 07-gate-integrity
    provides: "tests/architecture/gate-targets.ts — 22 obligation-named groups holding 117 literal repository-relative paths (07-02)"
  - phase: 07-gate-integrity
    provides: "tests/architecture/source-scan.ts — REPO_ROOT, stripComments, and the ScanReport visitation contract (07-01)"
provides:
  - "six architecture gates whose production targets come only from gate-targets.ts — 46 repo-relative path literals removed, 0 remaining"
  - "a per-gate D-07-03 visitation proof: non-emptiness on the declared group, a positional module-basename pin, a non-zero walked-file count, and a deep-compare of the paths actually opened against the paths declared"
  - "three vacuous 'file not yet authored' passes in no-credential-leak converted into failures"
  - "CREDENTIAL_CAPTURING_ORCHESTRATORS, replacing the planning-artifact-named PHASE_35_ORCHESTRATOR_FILES"
  - "the measured observation that the scope-fences-63.test.ts filename carries a planning-artifact suffix, and the registry gap that keeps one must-not-resolve path composed locally"
affects: [07-15, 07-16, gate-integrity, architecture-gates]

actuals:
  tokens: 18097
  tasks: 2
  commits: 2
  plan_head_before: 2e67384e8beada1955c26ff1a2f5a684a8e2b715

tech-stack:
  added: []
  patterns:
    - "Positional destructuring of a registry group, paired with a module-basename pin asserted inside an existing case, so a member reordered, added, or dropped in the registry re-aims no clause silently"
    - "Visitation by accumulation: each scanning loop pushes the path it just opened onto a `visited` array and deep-compares it against the declared subset, so a target that stops resolving drops out and fails the case instead of being skipped"
    - "An allow-list pin re-expressed as module basenames (or as paths relative to the extension root) once the full paths move to the registry — comparing an allow-list against the same group it was built from would pin nothing"

key-files:
  created: []
  modified:
    - tests/architecture/manifest-lookup-drift.test.ts
    - tests/architecture/no-credential-leak.test.ts
    - tests/architecture/config-state-write-seams.test.ts
    - tests/architecture/no-shell-out.test.ts
    - tests/architecture/disabled-state-classification.test.ts
    - tests/architecture/scope-fences-63.test.ts

key-decisions:
  - "A vacuous pass is the defect this phase exists for, so the three `assert.ok(true, '... not yet authored')` / `continue` branches in no-credential-leak became assertions that the declared target resolves. Registry membership is resolution-checked by gate-targets.test.ts, so the branches guarded a state that cannot occur while still offering a silent exit if it ever did."
  - "Each group is consumed by POSITION and the positions are pinned by module basename inside an existing case. A basename is not a repository-relative path, so the pin costs no literal, and it is the only thing that catches a permutation — a reordered group leaves every union and length check green while aiming each regex at the wrong file."
  - "The 'exactly N' allow-list pins in config-state-write-seams and no-shell-out were rewritten as basenames and extension-root-relative paths rather than deleted. Comparing the allow-list against the registry group it was built from is a tautology, and deleting the pin would have removed the silent-widening guard the plan forbids weakening."
  - "`extensions/pi-claude-marketplace/commands/plugin` stays composed locally in scope-fences-63. Its contract is that it does NOT resolve, and 07-02 measured that adding it to SCOPE_FENCE_TARGETS fails the resolution clause while adding it to MISSING_TARGET_PROBES dilutes that group's WR-06 contract. No registry group was added, per this wave's single-writer rule."

patterns-established:
  - "Pattern: prove the visitation assertion by planting a shortened read set and a reordered basename pin, observing the exact failure message, then restoring — twelve controls run this way, all reverted"
  - "Pattern: a walk-based gate counts the files it walked and asserts the count is non-zero; a list-based gate accumulates what it opened and deep-compares"

requirements-completed: [GGAT-01]

coverage:
  - id: D1
    description: "Six gates address production targets only through gate-targets.ts — 46 repo-relative path literals fall to 0"
    requirement: GGAT-01
    verification:
      - kind: command
        ref: "comment-stripped scan for /[\"'`](\\.\\/)?extensions\\/pi-claude-marketplace/ over the six files → 10/10/7/7/6/6 before, 0/0/0/0/0/0 after"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each gate asserts its declared group (or its directory walk) is non-empty, naming D-07-03"
    requirement: GGAT-01
    verification:
      - kind: command
        ref: "grep -c D-07-03 over the six files → 6, 11, 4, 2, 6, 6"
        status: pass
      - kind: unit
        ref: "tests/architecture/config-state-write-seams.test.ts#SPLIT-02: only saveConfig writes claude-plugins.json / claude-plugins.local.json"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each visitation assertion was observed failing against a planted shortened or reordered target list, then restored"
    requirement: GGAT-01
    verification:
      - kind: other
        ref: "12 negative controls; each failed exactly the intended case with the intended message; each file re-run green after restore (see Negative Controls Observed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No assertion, pattern or failure message was weakened by the move — every gate reports the same case count as before"
    requirement: GGAT-01
    verification:
      - kind: command
        ref: "node --test per file → 4/8/5/2/11/5 before and after; the six together 35 before and after"
        status: pass
    human_judgment: false
  - id: D5
    description: "PHASE_35_ORCHESTRATOR_FILES no longer names a planning artifact"
    requirement: GGAT-01
    verification:
      - kind: command
        ref: "grep -c PHASE_35 tests/architecture/no-credential-leak.test.ts → 0; CREDENTIAL_CAPTURING_ORCHESTRATORS referenced at every former site"
        status: pass
    human_judgment: false
  - id: D6
    description: "The slice holds under both complexity ceilings, ESLint, Prettier, the typechecker and the whole architecture suite"
    requirement: GGAT-01
    verification:
      - kind: other
        ref: "npm run typecheck; npx eslint tests/architecture --max-warnings=0; npx fallow health --fail-on-issues → '0 above threshold · 12739 analyzed'; npx fallow dupes → exit 0; npx prettier --check 'tests/architecture/*.ts' (own files clean); node --test 'tests/architecture/*.test.ts' → 380 pass 0 fail"
        status: pass
    human_judgment: false

duration: 55min
completed: 2026-09-10
status: complete
---

# Phase 7 Plan 04: Registry Re-point and Visitation Proof for Six Gates Summary

**Forty-six repository-relative production path literals left six architecture gates for the registry, and each gate gained the half that actually closes the defect: a proof of what it opened, deep-compared against what it declared — including three scans in `no-credential-leak.test.ts` that would have passed vacuously over files that had stopped resolving.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-09-10T17:05:00Z
- **Completed:** 2026-09-10T18:00:00Z
- **Tasks:** 2 of 2
- **Files modified:** 6 (0 created, 6 modified)

## Task Commits

1. **Task 1: Re-point the manifest-lookup, credential-leak, and config-write-seam gates** — `26c27fd5` (test)
2. **Task 2: Re-point the shell-out, disabled-state, and scope-fence gates** — `9d5389b2` (test)

## Per-File Literal Counts

Method: strip block and line comments, then count string literals matching
`^["'`](\./)?extensions/pi-claude-marketplace`. Header prose that names a guarded path in
rationale is legal and is what the comment-stripping step exists for.

| File | Literals before | Literals after | Cases before | Cases after |
|------|-----------------|----------------|--------------|-------------|
| `manifest-lookup-drift.test.ts` | 10 | 0 | 4 | 4 |
| `no-credential-leak.test.ts` | 10 | 0 | 8 | 8 |
| `config-state-write-seams.test.ts` | 7 | 0 | 5 | 5 |
| `no-shell-out.test.ts` | 7 | 0 | 2 | 2 |
| `disabled-state-classification.test.ts` | 6 | 0 | 6 | 6 |
| `scope-fences-63.test.ts` | 6 | 0 | 5 | 5 |
| **Total** | **46** | **0** | **35** | **35** |

`disabled-state-classification.test.ts` registers 11 cases in total; 6 is the count above because
the other 5 are the runtime truth-table cases, which the plan does not address and which were not
touched. The per-file `node --test` counts confirm every file is unchanged: 4, 8, 5, 2, 11, 5.

**Whole architecture suite:** 372 passing at plan start, 380 passing at plan end, 0 failing at
both points. The six files this plan owns contribute 35 cases before and after; the +8 is entirely
sibling work landing in the shared tree during this plan, 5 of it the new
`tests/architecture/eslint-effective-config.test.ts`.

## Registry Groups Consumed

| File | Group(s) imported | Shape of consumption |
|------|-------------------|----------------------|
| `manifest-lookup-drift.test.ts` | `MANIFEST_LOOKUP_TARGETS` (9), `EXTENSION_ROOT_REL` | positional: definition site, 3 absence-judging surfaces, 5 non-absence lookups |
| `no-credential-leak.test.ts` | `CREDENTIAL_LEAK_TARGETS` (10) | positional: 3 state-write, 3 credential handlers, 2 provider, 2 orchestrator |
| `config-state-write-seams.test.ts` | `STATE_WRITE_SEAM_TARGETS` (3), `EXTENSION_ROOT_REL` | positional: 2 state writers, 1 config writer |
| `no-shell-out.test.ts` | `SHELL_OUT_EXEMPT_TARGETS` (3), `EXTENSION_ROOT_REL` | whole group as the whitelist |
| `disabled-state-classification.test.ts` | `DISABLED_STATE_TARGETS` (5), `EXTENSION_ROOT_REL` | positional: definition site, then 4 consuming sites |
| `scope-fences-63.test.ts` | `SCOPE_FENCE_TARGETS` (4), `PLUGIN_EDGE_HANDLERS_REL`, `EXTENSION_ROOT_REL` | positional: vocabulary owner, then 3 surfaces |

No registry group was added, removed, or edited. `tests/architecture/gate-targets.ts` is untouched
by both commits.

## Exports Added or Removed

**None.** All six files are `*.test.ts` modules with zero `export` statements before and after
(`git show HEAD~2:<file> | grep -c '^export '` and the same over the working tree both return 0 for
every file). Plan `07-15`'s unowned-export census has no delta to attribute to this plan.

## Negative Controls Observed

Twelve controls, each planted locally, run, and reverted. Every one failed exactly the case it was
aimed at and no other, and every file re-ran green after restore.

| # | File | Planted defect | Case that failed |
|---|------|----------------|------------------|
| 1 | `manifest-lookup-drift` | absence-surface read set sliced to 2 of 3 | "the clause must have opened every declared absence-judging surface" |
| 2 | `manifest-lookup-drift` | `list-flow.ts` / `info.ts` swapped in the basename pin | "aimed by POSITION in MANIFEST_LOOKUP_TARGETS" |
| 3 | `no-credential-leak` | state-write read set sliced to 2 of 3 | "must have opened every declared state-write path" |
| 4 | `no-credential-leak` | `git-credential.ts` / `github-auth.ts` swapped in the pin | "aimed by POSITION in CREDENTIAL_LEAK_TARGETS" |
| 5 | `no-credential-leak` | provider read set sliced to 1 of 2 | "must have opened every declared provider file" |
| 6 | `no-credential-leak` | orchestrator read set sliced to 1 of 2 | "must have opened both credential-capturing orchestrators" |
| 7 | `config-state-write-seams` | walk root pointed at an empty directory | both walk cases: "found no .ts files" |
| 8 | `config-state-write-seams` | `config-io.ts` drifted into the state allow-list | both 'exactly N' pins **and** the state walk, which then flagged `migrate.ts` |
| 9 | `no-shell-out` | walk root pointed at an empty directory | "found no .ts files" |
| 10 | `no-shell-out` | whitelist sliced to 2 of 3 | both cases: the walk flagged `git-credential.ts`, the pin flagged the missing entry |
| 11 | `disabled-state-classification` | consuming-site read set sliced to 3 of 4; separately, walk root renamed; separately, basename pin reordered | three separate runs, one failing case each |
| 12 | `scope-fences-63` | list-surface renamed away; separately, basename pin reordered; separately, edge-handler directory renamed away | three separate runs, one failing case each |

**One control did not fire and was replaced.** Swapping `STATE_IO_REL` with `MIGRATE_REL` in
`config-state-write-seams` left all 5 cases green — correctly, since the two are interchangeable
members of the same allow-list and nothing is aimed at either individually. Control 8 above is the
corrected form: moving `config-io.ts` into the state allow-list is the real drift, and it failed
three cases at once. Recording this because a control that passes proves the control was wrong, not
the gate.

## The Renamed Constant

`PHASE_35_ORCHESTRATOR_FILES` → **`CREDENTIAL_CAPTURING_ORCHESTRATORS`**, in
`tests/architecture/no-credential-leak.test.ts`. The name now states the obligation: these are the
marketplace verbs that construct the Device Flow `onAuthRequired` closure and therefore capture
`credentialOps` by reference. `grep -c PHASE_35` over the file returns 0, and every former
reference site (the loop in the WR-02 case) points at the new name. The case title, which already
named `orchestrators/marketplace/{add,update}.ts` in prose, is unchanged.

## The `scope-fences-63.test.ts` Filename Observation

**The `63` suffix names a planning artifact, not a requirement.** The requirements this gate
actually carries are `SURF-03`, `SURF-04`, `HOOK-04`, and `D-58-01` — none of them numbered 63. The
suffix reads as a phase number and rots exactly the way `.claude/rules/typescript-comments.md` says
a `Phase NN` comment does, with the additional cost that a filename is referenced by other gates,
by the SUMMARY corpus, and by the `unit-suite-glob-completeness` gate.

**Not renamed here, deliberately.** The plan forbids it, and a rename would move a path that other
artifacts address — the same class of breakage this phase exists to prevent. Triage candidates, if
a later plan takes it: `scope-fences.test.ts` (the obligation, unqualified) or
`surf-scope-fences.test.ts` (the requirement family). Whoever takes it must also sweep the
`.planning/` corpus for the old name.

## Registry Gap Declared for `07-16`

One repository-relative production path is still assembled locally, in `scope-fences-63.test.ts`:

```
`${EXTENSION_ROOT_REL}/commands/plugin`
```

**What was needed:** a registry group for **historical paths whose contract is that they do NOT
resolve, scoped to a gate's own absence assertion** — distinct from `MISSING_TARGET_PROBES`, whose
documented `WR-06` contract is fixtures for the shared scan mechanic's own gate. `07-02` measured
both alternatives and rejected them: adding the path to `SCOPE_FENCE_TARGETS` fails the resolution
clause, and adding it to `MISSING_TARGET_PROBES` breaks the resolve / must-not-resolve binary
partition that group's gate depends on and dilutes its contract with an unrelated member.

**What was used instead:** the closest existing constant, `EXTENSION_ROOT_REL`, with the local
fragment `/commands/plugin` and a doc block stating why it is composed. Per this wave's rule, no
group was added to `gate-targets.ts`. `07-16`'s self-hosting meta-gate (`D-07-06`) will see this
composition and must either carry an exemption for it or land the group above. The census in
`07-02-SUMMARY.md` counted this path under `scope-fences-63.test.ts`'s 6 literals; it is now the
one composed reference that file holds, and its total literal count is 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Three vacuous passes in `no-credential-leak.test.ts` converted into failures**

- **Found during:** Task 1
- **Issue:** Two cases returned early with `assert.ok(true, "... not yet authored; gate inactive until the file exists")` when their target was absent, and two loops carried `if (!exists) { continue; }`. That is precisely the "reports success while addressing targets that no longer resolve" failure this phase exists to close — a rename of `platform/git-credential.ts` would have greened the AUTH-09 Error-interpolation gate over zero inspected bytes. The plan's action text does not name these branches; its `<prohibitions>` forbid weakening an assertion, and `D-07-03` requires the opposite of what the branches do.
- **Fix:** The single-file cases now assert the declared target resolves before reading it, naming `D-07-03` and the group. The two loops read unconditionally and deep-compare a `visited` accumulator against the declared subset. No pattern, no regex, and no violation message changed; the case count is unchanged at 8.
- **Files modified:** `tests/architecture/no-credential-leak.test.ts`
- **Verification:** controls 3, 5 and 6 above; 8 pass 0 fail after restore.
- **Committed in:** `26c27fd5`

**2. [Rule 3 - Blocker] The two 'exactly N' allow-list pins had to be re-expressed, not re-pointed**

- **Found during:** Task 1 (`config-state-write-seams`), repeated in Task 2 (`no-shell-out`)
- **Issue:** Both gates pin their allow-list against a literal array so a silent widening fails in CI. Re-pointing BOTH the allow-list and its pin at the same registry group makes the pin compare a value to itself — green forever, pinning nothing. Deleting the pin is forbidden by the plan's prohibitions.
- **Fix:** The pins now compare module basenames (`config-state-write-seams`) and paths relative to the extension root (`no-shell-out`), which are not repository-relative production paths and so cost no literal. Each carries a comment saying why the expectation is spelled that way. Control 8 confirms the state/config pins still fire on a real widening; control 10 confirms the shell-out pin still fires on a shrunk whitelist.
- **Files modified:** `tests/architecture/config-state-write-seams.test.ts`, `tests/architecture/no-shell-out.test.ts`
- **Verification:** controls 8 and 10 above.
- **Committed in:** `26c27fd5`, `9d5389b2`

**3. [Rule 3 - Blocker] The module-specifier distinction was recorded on a file this plan owns**

- **Found during:** Task 2
- **Issue:** The plan asks for the "a module specifier is not a gate target" comment to be recorded on `config-state-consistency.test.ts`. That file is not in this plan's `files_modified`, and this plan runs concurrently with four siblings on one working tree, where editing an unowned file is the failure mode the wave's isolation rule exists to prevent.
- **Fix:** Recorded on `tests/architecture/disabled-state-classification.test.ts` instead, directly above the one `import ... from "../../extensions/..."` statement among this plan's six files — the exact place a reader wonders. The comment states the rule in general terms and names why a gate reaching production only through `await import(...)` needs no registry import at all, which covers `config-state-consistency.test.ts` without touching it.
- **Files modified:** `tests/architecture/disabled-state-classification.test.ts`
- **Verification:** `npx eslint tests/architecture --max-warnings=0` clean; the comment names no phase, plan, wave, or task number.
- **Committed in:** `9d5389b2`

**4. [Rule 1 - Stale premise] `ESCAPING_TWIN_SPELLINGS` holds no path members**

- **Found during:** Task 2
- **Issue:** The plan's action text says to replace "the path members of `ESCAPING_TWIN_SPELLINGS`" in `disabled-state-classification.test.ts`. That constant holds `{ label, line, pattern }` triples — regex spellings and their planted twin lines. It carries no path.
- **Fix:** No-op, and the file's 6 literals still fell to 0: they were `EXTENSION_SOURCE_ROOT` (1), `PREDICATE_DEFINITION_SITE` (1), and `FORMER_DEFINITION_SITES` (4), all of which moved to the registry.
- **Files modified:** none beyond the plan's own list.
- **Verification:** literal count 6 → 0 for that file.
- **Committed in:** `9d5389b2`

---

**Total deviations:** 4 auto-fixed (2 × Rule 3 - blocking issue, 1 × Rule 2 - missing critical, 1 × Rule 1 - stale premise).
**Impact on plan:** No scope creep and no weakened assertion. Deviations 1 and 2 make the gates
strictly stronger than the plan's wording — one converts a vacuous pass into a failure, the other
keeps a pin load-bearing that a literal reading of "re-point it at the registry" would have made
vacuous. Deviation 3 relocates a comment to a file this plan owns. Deviation 4 is a no-op.

## Issues Encountered

**Sibling noise on the shared tree, twice, in the same shape `07-02` recorded.** Both
`SKIP=trufflehog pre-commit run --files` runs reported `npm format check ... files were modified by
this hook`, and the first also reported it for `npm typecheck`. Both hooks are `pass_filenames:
false` and scan the whole repository; each printed its own success (`All matched files use Prettier
code style!`, `tsc --noEmit` silent) while a sibling wrote to a file during the run. Neither hook
rewrote any of this plan's six files — verified by re-running `node --test` and the literal scan
after each hook run, both unchanged. No sibling file was edited.

**`import-boundaries.test.ts` failed `prettier --check` mid-run.** That file belongs to a sibling
plan this wave. Left alone; it is not in this plan's `files_modified`.

**A sibling's staged path appeared in the shared index.** `git diff --name-only --cached` showed
`tests/fixtures/bad-imports/edge-imports-bridges.ts` staged alongside this plan's files before the
Task 2 commit. The commit was made with an explicit pathspec (`git commit -F - -- <three files>`),
which commits only the named paths and leaves the sibling's staged entry in the index untouched.
`git show --stat` confirms both commits carry exactly three files each.

**The `WINDOWS.md` ledger still cannot be appended to.** `gsd-tools windows append` refuses with
the same table-versus-fenced-JSON desync on rows 30 and 9 that `07-01` and `07-02` both recorded.
The attempt was made for deviation-class entry (the composed `commands/plugin` path) and rejected;
that entry is recorded under "Registry Gap Declared for `07-16`" above instead. This plan produced
no stub, no skipped test, and no unrun `<verify>`, so nothing else was owed to the ledger. The
desync predates this plan and still wants reconciling before the ship gate reads it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **`07-15` (unowned-export census):** zero delta from this plan. All six files are `*.test.ts`
  modules with no `export` statements before or after.
- **`07-16` (self-hosting meta-gate, `D-07-06`):** the `07-02` census listed 46 literals across
  these six files; all 46 are gone. One composed reference remains —
  `` `${EXTENSION_ROOT_REL}/commands/plugin` `` in `scope-fences-63.test.ts` — and it needs either
  an exemption or the must-not-resolve group described above. The `scope-fences-63.test.ts`
  filename observation is also `07-16`'s to triage if anyone takes it.
- **Whoever adds a member to one of the six groups consumed here:** every one of them is consumed
  by POSITION, and every consuming gate pins the module basenames in registry order. Appending a
  member fails that pin loudly, which is the intent — the pin is the thing that stops an addition
  from silently re-aiming a regex. Update the pin in the same commit.

---
*Phase: 07-gate-integrity*
*Completed: 2026-09-10*

## Self-Check: PASSED

- All six modified files present on disk with 0 repo-relative production path literals.
- `26c27fd5` and `9d5389b2` both reachable in `git log --oneline --all`; each carries exactly the
  three files its task declares.
- `.planning/phases/07-gate-integrity/07-04-SUMMARY.md` — present on disk.
- `tests/architecture/gate-targets.ts`, `eslint.config.js`, `.planning/STATE.md` and
  `.planning/ROADMAP.md` — untouched by both commits.
- `node --test "tests/architecture/*.test.ts"` → 380 pass, 0 fail.
