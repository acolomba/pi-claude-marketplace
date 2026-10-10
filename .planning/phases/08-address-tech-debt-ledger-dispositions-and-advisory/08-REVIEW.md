---
phase: 08-address-tech-debt-ledger-dispositions-and-advisory
reviewed: 2026-10-10T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - package-lock.json
  - tests/integration/provenance-invisibility.test.ts
  - tests/integration/skill-path-resolution.test.ts
findings:
  critical: 0
  warning: 1
  info: 4
  total: 5
status: issues_found
---

# Phase 08: Code Review Report

**Reviewed:** 2026-10-10
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Structural Findings (fallow)

The structural pre-pass (`FALLOW-normalized.json`) reports 16 `duplicate_block` findings, 0 unused exports, 0 unused files, and 0 circular dependencies, all repo-wide. None of the 16 duplicate blocks is in the three reviewed files. All of them are in files this phase did not change, so none is attributed to this phase. The executor's phase-scoped `fallow audit --base a876e321` returned `pass` with 0 clone groups.

## Narrative Findings (AI reviewer)

## Summary

The phase changes two things. It bumps the root `node_modules/brace-expansion` lock entry from 5.0.9 to 5.0.12. It also moves the pi-subagents root lookup ahead of the hermetic HOME swap in two integration tests.

What I verified:

- The 5.0.12 integrity hash matches `npm view brace-expansion@5.0.12 dist.integrity`. Its `balanced-match ^4.0.2` dependency is satisfied by the locked 4.0.4, and `npm ls --package-lock-only` resolves the tree.
- The HOME-ordering fix is real. On this machine, `~/.npmrc` sets `prefix=/home/acolomba/.npm-global`. With HOME repointed, `npm root -g` resolves to `/home/linuxbrew/.linuxbrew/lib/node_modules`, where pi-subagents is not installed, so the old order skipped silently.
- Both tests now run and pass locally: `node --test` reports 2 pass and 0 skipped.

No blockers. The main remaining risk is the one that hid the original bug: any load failure becomes `t.skip`, even when the operator explicitly opted in.

## Warnings

### WR-01: A load failure skips the test instead of failing it, even with an explicit `PI_SUBAGENTS_ROOT` opt-in

**File:** `tests/integration/skill-path-resolution.test.ts:65-69, 96-121, 135-138`; `tests/integration/provenance-invisibility.test.ts:56-60, 86-113, 121-124`

**Issue:** This phase fixed a defect that showed up only as a silent skip. Because `npm root -g` ran after the HOME swap, the SC-2 test reported `skipped` with no failure. The tests still turn every failure into `t.skip`: a missing `src/`, a failed `cp`, a moved module, a 5 s `npm root -g` timeout, or an import that throws. This includes the case where the operator set `PI_SUBAGENTS_ROOT` on purpose. The `catch {}` on the dynamic import also hides real breakage, such as an upstream file that Node's type stripping cannot handle. The test then stops checking without any signal. This is the "green run that checked nothing" class, and the HOME regression proved it can happen. The change is pre-existing, but it directly affects how reliable these tests are, and this phase's fix does nothing to stop the same thing happening again.

**Fix:** Skip only when the peer is genuinely absent and no one asked for it. Fail loudly when someone asked for it:

```ts
const explicit = process.env.PI_SUBAGENTS_ROOT !== undefined;
const skillsModule = await loadPiSubagentsSkillsModule(piSubagentsRoot, tmpRoot);
if (!skillsModule) {
  if (explicit) {
    assert.fail(`PI_SUBAGENTS_ROOT=${piSubagentsRoot} is set but the resolver module did not load`);
  }
  t.skip("pi-subagents resolver module not reachable in this environment");
  return;
}
```

Also return or rethrow the import error when the module file exists, instead of mapping it to `undefined`. A file that is present but cannot be imported is a regression, not an absent peer.

## Info

### IN-01: The two test files repeat the same helpers, and the HOME-ordering reason is documented in only one of them

**File:** `tests/integration/provenance-invisibility.test.ts:56-114, 117`; `tests/integration/skill-path-resolution.test.ts:65-122, 125-127`

**Issue:** `resolvePiSubagentsPackageRoot` and the copy-then-import loader are near-identical in both files. This phase had to make the same signature change twice. The reason for running the lookup before the HOME swap (the comment at `skill-path-resolution.test.ts:125-126`) appears only in the SC-2 test. `provenance-invisibility.test.ts:117` moved the call with no explanation. That file does not swap HOME today, so if someone later adds `createHermeticEnvironment` there and puts the lookup after it, the silent-skip bug comes back. Fallow does not flag this pair.

**Fix:** Move `resolvePiSubagentsPackageRoot` and a generic `loadPiSubagentsModule(packageRoot, scratchRoot, relPath)` into one shared test-support module, such as `tests/integration/pi-subagents-peer.ts`. Put the HOME-ordering comment there, next to the function.

### IN-02: The ordering comment overstates where npm gets its global prefix

**File:** `tests/integration/skill-path-resolution.test.ts:125-126`

**Issue:** "npm reads its global prefix from ~/.npmrc" is true only when the user config sets `prefix`, as it does on this machine. By default, npm derives the prefix from the node executable path, and `NPM_CONFIG_PREFIX` overrides both. The ordering is still correct. The comment just reads as a universal rule.

**Fix:** "npm may read its global prefix from ~/.npmrc, so the lookup runs before the hermetic environment repoints HOME."

### IN-03: The local `node_modules` does not match the bumped lock, so the local green check ran against 5.0.9

**File:** `package-lock.json:3634-3637`

**Issue:** The lock now pins the root `brace-expansion` to 5.0.12. But `npm ls brace-expansion` in this worktree still shows 5.0.9 under `eslint-plugin-import-x > minimatch`. The local `npm run check` cited for a12dfa16 therefore did not run against the bumped package. Only CI's `npm ci` will. This is a patch release with the same dependency, so the risk is low. Still, the local evidence does not prove the bump.

**Fix:** Run `npm ci` in the worktree and rerun `npm run check` before calling the bump verified locally.

### IN-04: A high-severity advisory remains on the nested Pi copy (known, tracked as DEPADV-01)

**File:** `package-lock.json:1307-1310`

**Issue:** `npm audit --package-lock-only` still reports 1 high-severity vulnerability: `brace-expansion` 4.0.0-5.0.11 (GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p) at `node_modules/@earendil-works/pi-coding-agent/node_modules/brace-expansion@5.0.9`. The phase plan leaves this on purpose. The copy comes from Pi's shrinkwrap, it is dev-only, and it is tracked as DEPADV-01. It is not a defect of this phase. Do not read the phase as making `npm audit` clean.

**Fix:** None here. Resolve it through DEPADV-01 when the Pi peer floor moves to a release whose shrinkwrap carries 5.0.12 or later.

---

_Reviewed: 2026-10-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
