---
phase: 07-gate-integrity
fixed_at: 2026-09-10T00:00:00Z
review_path: .planning/phases/07-gate-integrity/07-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 9
skipped: 1
status: partial
---

# Phase 7: Code Review Fix Report

**Fixed at:** 2026-09-10
**Source review:** `.planning/phases/07-gate-integrity/07-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 10 (2 critical, 8 warning)
- Fixed: 9 (both critical, 7 warning) — plus `IN-02`, resolved incidentally
- Skipped: 1 (`WR-05`'s temp-root control shape; the finding itself is fixed and
  measured, the control was taken against the real tree instead)

`npm run check` exits 0. No production export was added or removed, so the
unowned-export census stays pinned at 100 with no delta.

## Fixed Issues

### CR-01: the credential-leak gate's documented bypass, open in four of six scans

**Files modified:** `tests/architecture/no-credential-leak.test.ts`
**Commit:** `a469cde6`

`fullTemplateLiteralsAfter` was wired into two scans. All six now call one
`assertNoCredentialInLiterals(rel, stripped, callSite)` helper, each keeping its
bounded regex beside it as the concatenation check. Folding the two existing
inline literal checks into the same helper also keeps the file under
`duplicates.threshold: 3`.

**Firing proof.** The bypassing string was planted as a real offender in each of
the six target files and the owning case failed each time, e.g.

```
✖ AUTH-09: platform/git-credential.ts never interpolates a password in an Error message
  AUTH-09 violation: a message template literal in .../git-credential.ts interpolates a
  credential field past a literal ) or beyond the first interpolation:
  `git credential fill failed for ${describeHost(opts)}: ${cred.password}`
```

The pre-fix bounded regex answers `false` on that same line, measured directly.
The unmutated tree passes all eight cases (benign control). Every plant was
restored from a copy; `git status` on `extensions/` is clean.

### CR-02: `pairsForChangedPaths` half-threaded its injected root

**Files modified:** `scripts/test-coverage-direct.mjs`,
`scripts/test-coverage-direct.negative.mjs`
**Commit:** `c0241c82`

The root now reaches `pairForPath`, `toProjectPath`, `isStructuralSupplement`,
`pairabilityRefusal` and `isPairablePath`. Two latent traps were handled while
threading: `modulePaths.map(pairForPath)` would have passed the array index as
the root, and `changed.paths.filter(isPairablePath)` the same, so both are now
explicit arrows.

**Firing proof.** A new harness state builds a fixture repository carrying a real
`domain/probe.ts` + `tests/domain/probe.test.ts` pair *and* a real structural
supplement (`probe-fake.test.ts` with its fake and contract), changes both on a
feature branch, and asserts the pair is named and the supplement is skipped.
Re-planting the module-level root in either helper reproduces the reviewer's
throw against it:

```
Error: Missing source-test pair member: extensions/pi-claude-marketplace/domain/probe.ts
```

### WR-01: the `Dependency` tripwire the header claimed

**Files modified:** `tests/architecture/closed-set-enrollment.test.ts`
**Commit:** `d6da77cf`

Added the reverse-direction `Exclude` proof (`AssertNever`), spelled in the test
because `Dependency` has no runtime tuple, plus a runtime arity pin on
`softDepMarkers`. The header now describes the two instruments it has rather
than one it did not.

**Firing proof.** Adding `"hooks"` to the union, leaving `softDepMarkers`
untouched, makes `npx tsc --noEmit` report
`error TS2344: Type '"hooks"' does not satisfy the constraint 'never'` at the
proof. Typecheck is a member of `npm run check`.

Deliberately *not* done: giving `Dependency` a runtime `DEPENDENCIES` tuple. That
adds a production export, which moves the census pin, and the compile-time proof
already makes the claim true.

### WR-02: basename pins replaced by subpath pins

**Files modified:** `tests/architecture/no-credential-leak.test.ts`,
`tests/architecture/config-state-write-seams.test.ts`
**Commit:** `a5650558`

Both now use `no-shell-out.ts`'s `path.relative(EXTENSION_ROOT_REL, rel)` form.

**Firing proof.** Repointing `persistence/migrate.ts` at
`orchestrators/migrate.ts` in each group fails both pins; the basename
comparison they replace answers equal on the same edit (measured).

### WR-03: the dispositions gate now parses the answering row

**Files modified:** `tests/architecture/unowned-exports-census.test.ts`
**Commit:** `8516b205`

The check requires a record row carrying the id in its leading cell, a status of
`closed` / `open` / `deferred`, a named closer, and non-empty evidence. Row
anchoring also removes the `OPEF-F01` / `OPEFR-F007` aliasing hazard.

The failure message was corrected to what is actually checked ("evidence"), not
"a command run this cycle" — one current row records evidence in prose with no
command, and asserting a command would have been a new contract, not a fix.

**Firing proof.** Two controls: an id demoted to a bare prose line, and a row
with its evidence cell emptied. Both fail; the unmutated record passes. The
first form of this fix used `\s*` between cells and let the empty-evidence row
borrow the next row's text — the control caught it, and every cell is now
spelled without `\s`.

### WR-04: `registryGroups()`'s path-list invariant is now checked

**Files modified:** `tests/architecture/gate-targets.test.ts`
**Commit:** `6593c4ab`

A shape clause runs before any `stat`: each entry is an optional `./` plus a real
top-level directory, or a bare root-level file with a known extension, and no
entry carries a `..` segment.

Took the reviewer's minimal option, not the nominal `RepoPath` type: a branded
path type reaches every registry entry and every consumer, which is a design
change rather than a fix.

**Firing proof.** A planted rule-id array export is named by the new clause
(before the resolution clause reports it as a missing file), and an entry
repointed at `extensions/../../etc/passwd` is refused.

### WR-05: the `scope-order: justified` waiver is pinned

**Files modified:** `tests/architecture/scope-order-drift.test.ts`
**Commit:** `46f2af8b`

Added the census case pinning the waived population at 0, fed by the same walk
the two drift scans use so the two readings cannot disagree about coverage.

**Firing proof, measured against a real module.** An offender planted without the
marker fails the literal scan and leaves the census green; the same offender
carrying the marker passes the literal scan (the hatch works — this is what was
never exercised) and fails the census instead; the restored tree passes all
three.

### WR-06: `fixtureGit` no longer masks a launch failure

**Files modified:** `scripts/test-coverage-direct.negative.mjs`
**Commit:** `c0241c82` (same commit as CR-02 — the new fixture case depends on it)

Mirrors `gitLines`: `run.error` first, then a defensively typed `run.stderr`.

### WR-07: `temp-root-control.ts` checks the containment it claims

**Files modified:** `tests/architecture/temp-root-control.ts`
**Commit:** `8945958f`

`materializeTargets` and `appendToCopy` route through `insideRoot`, which uses
the same `path.relative` idiom as `shared/path-safety.ts::assertPathInside`
(NFR-10). The refusal happens before the real file is read, so an escaping
target names the containment rule rather than an ENOENT. `appendToCopy` now
creates the destination's directory chain (the finding's secondary point).

**Firing proof.** Probed directly: `../escape.ts` and
`extensions/../../escape.ts` are refused through `materializeTargets`,
`plantOffender` and `plantBenignNearMiss`, while a registry-owned path
materializes and plants as before. No meta-test was added — the unit-testing
rules exempt test support from meta-tests, and `tests/architecture/` is a
non-corresponding root.

### WR-08: one scan base for the remaining seven gates

**Files modified:** `tests/architecture/no-shell-out.test.ts`,
`unowned-exports-census.test.ts`, `partial-vocabulary-guard.test.ts`,
`disabled-state-classification.test.ts`, `unit-suite-glob-completeness.test.ts`
(plus the two in `a5650558`)
**Commit:** `1708de79`

Each local `REPO_ROOT` is replaced by the shared import, and the now-unused
`fileURLToPath` dropped — except in `partial-vocabulary-guard.test.ts`, which
still needs it to name itself.

### IN-02 (out of scope, resolved incidentally)

`walkTsFiles`'s unused `repoRoot` parameter went with the `WR-05` refactor, since
both call sites were being folded into the shared line scan anyway. Commit
`46f2af8b`.

## Skipped Issues

### WR-05's temp-root control (partial skip; the finding itself is fixed)

**File:** `tests/architecture/scope-order-drift.test.ts`
**Reason:** the review asked for a `withTempRoot` case planting the literal with
and without the marker. That needs the two scans to take an injected root *and* a
non-canonical production target to plant into — and every production path this
gate may name must come from the registry (`D-07-05` / `D-07-06`), while a new
registry group naming an already-listed file fails the meta-gate's
duplicate-path clause. Choosing a new registry target for a control is a design
decision, not a fix. The hatch's behaviour is measured either way, by
plant-and-restore against a real module (recorded above): waived offender passes
the scan and fails the census, unwaived offender fails the scan.

### Info findings (IN-01, IN-03) — out of the given scope

`IN-01` (the bare `--all` arm) and `IN-03` (`presentSeams` proving occurrence
rather than declaration shape) were not addressed; the brief scoped this run to
the blockers and warnings. `IN-02` was resolved only because it sat inside a
function `WR-05` was already rewriting.

### Deliberately untouched, per the brief

The four items the review's own scope notes route elsewhere (`CONVENTIONS.md`'s
stale `fallow-ignore` count, the `shared/concerns/hooks.ts:20-24` satisfies
claim, `PROJECT.md`'s never-written `no-legacy-markers.test.ts`,
`markers-snapshot.test.ts`'s retained agents-bridge pins) and the
`pre-commit --all-files` unicode-dash failure.

---

_Fixed: 2026-09-10_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
