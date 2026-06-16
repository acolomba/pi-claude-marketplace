---
phase: 63-lifecycle-cascade-user-facing-surface-docs
plan: 10
subsystem: orchestrators/plugin/install
tags: [HOOK-03, LIFE-01, SURF-01, cross-surface-parity, defense-in-depth]
requires:
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts (pre-63-10 narrowResolverReasons)
  - extensions/pi-claude-marketplace/shared/probe-classifiers.ts (narrowResolverNotes -- the parity sibling)
  - extensions/pi-claude-marketplace/shared/notify.ts (REASONS closed-set already contains "unsupported hooks" from Phase 58 HOOK-04)
provides:
  - "Cross-surface REASONS parity: `narrowResolverReasons` (install cascade) now mirrors the four `hooks.json`-prefix arms already in `narrowResolverNotes` (info/list probe). Same on-disk hooks-config failure -> same `(unavailable) {unsupported hooks}` token across surfaces."
  - "Structural parity invariant pinned by `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` (6 cases: four hooks-prefix families + `contains lspServers` carve-out sanity row + generic catch-all sanity row). Future prefix-set drift on either classifier red-fails this suite."
affects:
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts (only `narrowResolverReasons` body + JSDoc; no caller-visible API change)
tech-stack:
  added: []
  patterns:
    - "Mirror-by-verbatim-prefix-set: install-side classifier uses the IDENTICAL four `startsWith` checks as the probe-side classifier. Codified in the JSDoc + parity test as a lockstep contract -- adding or renaming a prefix on one side without the other red-fails the parity suite."
key-files:
  created:
    - tests/orchestrators/plugin/cross-surface-reason-parity.test.ts
  modified:
    - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts (new arm at head of `narrowResolverReasons` loop body + JSDoc bullet 0 + sonarjs/cognitive-complexity disable comment)
decisions:
  - "Arm ordering: new arm placed FIRST in the per-reason loop (after the empty-skip continue, before the manifest-field carve-out). Required because `malformed hooks.json:` contains no `source` substring -- a later position would let it fall through to the conservative `unsupported source` fallback (the misclassification this fix exists to correct)."
  - "JSDoc additive prepend: enumerate the new arm at position `0.` rather than renumbering existing arms. Smaller diff, no churn on unchanged arms' wording. Acceptable because JSDoc is documentation, not load-bearing."
  - "sonarjs/cognitive-complexity disable comment added at the function head -- the new arm bumps the metric from 15 to 16, but the function's structure remains a flat for-loop of mutually exclusive arms (a control-flow shape that is hard to refactor into smaller helpers without obscuring the parity-with-probe-classifier contract). Established precedent in this same file (`installPlugin` at line 911) carries the same disable."
metrics:
  duration_minutes: 10
  completed_date: 2026-06-16
---

# Phase 63 Plan 10: Cross-Surface Classifier Parity Summary

**One-liner:** New arm in `narrowResolverReasons` mirrors the four `hooks.json`-prefix families already recognised by `narrowResolverNotes`, closing the cross-surface REASONS asymmetry (SURF-01) so the install cascade and info/list probe surfaces emit the SAME `(unavailable) {unsupported hooks}` token for the SAME on-disk hooks-config failure -- pinned structurally by a new cross-surface parity test.

## Status

`complete` -- both tasks landed, parity test GREEN, `npm run check` GREEN end-to-end (typecheck + lint + format + 2280 unit tests + 10 integration tests).

## What landed

**Task 1 (RED) -- `b28b0f7` `test(63-10): pin cross-surface REASONS parity for hooks.json notes`**

- Created `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` (50 lines).
- Six parity cases (four `hooks.json`-prefix families + `contains lspServers` sanity row + generic catch-all sanity row) exercise both `narrowResolverNotes` (probe) and `__test_narrowResolverReasons` (install) directly against the same note string.
- Confirmed RED on the four prefix cases pre-fix: install emitted `["unsupported source"]`, probe emitted `["unsupported hooks"]`. The two sanity rows passed GREEN today.
- The install-side test seam `__test_narrowResolverReasons` was already exported at `install.ts:1755` from prior work (Phase 58 / HOOK-04 instrumentation) -- no new seam needed.

**Task 2 (GREEN) -- `4e5adf9` `fix(63-10): mirror narrowResolverNotes hooks-prefix arm in install classifier`**

- Inserted the new arm at the head of the `for (const reason of reasons)` loop body in `narrowResolverReasons` (install.ts:1696-1709), BEFORE the existing `manifestFieldTokenFromNote` carve-out. Uses the IDENTICAL four `startsWith` checks as the probe-side classifier:
  - `"hooks.json is not valid JSON:"`
  - `"hooks.json failed schema validation:"`
  - `"unsupported hooks:"`
  - `"malformed hooks.json:"`
- Emits the closed-set REASONS token `"unsupported hooks"` (already in the union via Phase 58 HOOK-04 rename; no type-system change required).
- JSDoc updated to enumerate the new arm at position `0.`, citing HOOK-03 / LIFE-01 / SURF-01 and the sibling classifier file.
- `sonarjs/cognitive-complexity` disable comment added at the function head (precedent: `installPlugin` at install.ts:911).

## Verification

- `npx tsx --test tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` -- all 6 cases PASS post-fix (RED -> GREEN transition confirmed at the `b28b0f7` -> `4e5adf9` boundary).
- `npm run check` GREEN end-to-end: typecheck + ESLint + Prettier + 2280 unit tests + 10 integration tests. No pre-existing test required updating -- no production caller emits a `hooks.json:`-prefixed note that previously relied on the `unsupported source` fallback.
- `grep -c 'startsWith("hooks.json' extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` returns 2 (matching the probe-side classifier's 2; the other two of the four prefix tokens are `"unsupported hooks:"` and `"malformed hooks.json:"`, whose `startsWith` checks don't carry the literal `hooks.json` substring as a prefix match). Both classifiers carry the SAME four-prefix set verbatim -- verified by direct inspection.
- Last two commits on `features/v1.13-hook-bridge` are `test(63-10): ...` -> `fix(63-10): ...` in that order, per the plan's verification spec.

## Why this matters (defense-in-depth narrative)

Plan 63-09 fixed the proximate wrapper-vs-settings parser bug in `parseHooksConfig`: real-world plugins (hookify and any sibling that ships the `{description, hooks: {...}}` envelope) now install cleanly and never exercise the install-side classifier asymmetry. The cross-surface drift would have been invisible for the production plugin set after 63-09 lands.

But the structural gap remained. Any future malformed `hooks.json` -- JSON syntax error in a hand-authored plugin, schema mismatch on a new event/matcher combination, unsupported handler shape -- would re-surface the SAME on-disk condition with TWO different `(unavailable) {<reason>}` tokens depending on which command the user runs (`info` / `list` -> `unsupported hooks`; `install` -> `unsupported source`). That is exactly the cross-surface inconsistency the SURF-01 invariant ("same plugin -> same reason across surfaces") forbids.

The fix is small (one new arm in one classifier function). The contribution is the structural parity contract: the cross-surface parity test mechanically pins that any future prefix added or renamed on either classifier MUST land on both, in lockstep. Future regressions in either direction red-fail the suite.

## Threat coverage closure

The plan's threat register identified two STRIDE rows:

- **T-63-10-DRIFT** (Information Disclosure, mitigate) -- mitigated: the new arm closes the prefix-family drift; the parity test pins the contract structurally. Any future drift on either classifier red-fails the suite.
- **T-63-10-FALLTHROUGH** (Tampering, accept) -- accepted per plan: a hypothetical note like `"hooks.json failed schema validation: /source: ..."` matches BOTH the new arm and the existing `source`-includes arm. The new arm's earlier position + `continue` short-circuit ensures it emits `"unsupported hooks"`; the `source` substring later in the message never reaches the lower arm. The `hooks.json:` prefix is more specific than a `source` substring elsewhere in the message, so this disambiguation is the desired outcome.

## Deviations from plan

- **Test seam already exported.** The plan's Task 1 step 1-2 prescribed adding `export { narrowResolverReasons as __test_narrowResolverReasons };` to `install.ts`. The seam was already exported at line 1755 (likely from prior phase work; the existing `install.test.ts` at line 15 already imports it). No-op; Task 1 created only the test file. Documented in the Task 1 commit body.
- **sonarjs/cognitive-complexity disable added** -- not in the plan spec, but required because the new arm bumped the metric from 15 to 16. Follows the established precedent at `installPlugin` (install.ts:911) in the same file. The function's structure remains a flat for-loop of mutually exclusive arms; refactoring into smaller helpers would obscure the parity-with-probe-classifier contract.

## Cross-references

- **Plan 63-09** (sibling wave-1 plan): fixes the proximate wrapper-vs-settings parser bug. Independent of 63-10 (different files, different concerns); landed first.
- **Plan 63-11** (runtime UAT, wave 2): runs the runtime UAT against the pi-uat sandbox after both wave-1 plans land. The parity arm here is defense-in-depth and is not exercised by the production plugin set after 63-09 -- 63-11 verifies the runtime flow end-to-end.
- **Phase 58 HOOK-04 rename:** added `"unsupported hooks"` to the closed-set `REASONS` union at `shared/notify.ts:81`. No type-system change needed in 63-10; TypeScript narrows correctly on the new `out.push("unsupported hooks")` call.

## Self-Check: PASSED

- `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` exists.
- `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` carries the new arm (lines 1696-1709 region).
- Commit `b28b0f7` (`test(63-10): ...`) present in `git log`.
- Commit `4e5adf9` (`fix(63-10): ...`) present in `git log`.
- All 6 parity-test cases GREEN; `npm run check` GREEN end-to-end.
