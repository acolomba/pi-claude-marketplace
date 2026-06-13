---
quick_task: 260612-bcs-fix-pr-51-five-agent-review-findings
sub_plan: 03
commit: 01e294e
status: complete
byte_contract: byte-neutral (no docs/output-catalog.md edit)
requirements_closed:
  - I6
  - S4
  - S6
  - Y7
---

# Sub-plan 03 closure: reconcile-apply classification + small silent-failure cleanup

One atomic Conventional Commit (`01e294e`) on `features/v1.12-config-files`,
byte-neutral on existing catalog fixtures, `npm run check` GREEN,
catalog-uat byte gate GREEN with NO `docs/output-catalog.md` edit.

## Findings closed

- **I6** -- `reconcile/apply.ts::classifyOrchestratorThrow` extended with an
  instanceof ladder that recovers `StateLockHeldError -> "lock held"` and
  `PluginShapeError -> kind-mapped catalog tokens` before falling through
  to `narrowProbeError`. The kind mapping:
  - `not-in-manifest` -> `"not in manifest"`
  - `already-installed` -> `"already installed"`
  - `not-installable` / `no-longer-installable` -> `"no longer installable"`
    (mirrors `import/execute.ts::importWarningReason("uninstallable")` so
    the cross-surface reason for the same shape kind stays identical).

  Pre-fix every typed throw flattened to the misleading `{unreadable}`
  fallback. Exported the helper for direct unit-test exercise of the
  closed-set mapping; the four sub-cases plus the generic-Error sanity
  floor are pinned in `tests/orchestrators/reconcile/apply.test.ts`.

- **S4** -- `synthesizeUndeclaredMarketplaceSource`'s `undefined` return
  overloads two semantically distinct arms (benign already-declared vs.
  dangerous no-string-`source.raw`). Added decision-anchored comments
  referencing `CONTEXT.md S4` at the function definition
  (`plugin/shared.ts`) AND at both call sites in `install.ts` and
  `enable-disable.ts` (two call sites in enable-disable.ts; the second
  cross-references the first). The comment records the deliberate
  fall-through and flags the follow-up (widen the helper's return to a
  discriminated `{kind: "already-declared" | "synthesized" | "unsynthesizable"}`
  so callers can route the dangerous arm to a `(failed)` row instead).

  Chose the comment path over the row-surface path because surfacing
  requires plumbing a new typed outcome through two orchestrator paths
  (install + enable-disable), which exceeds the sub-plan's atomic-commit
  scope. The plan's `<task>` block explicitly allowed the comment path
  as the fallback when the surface path is structurally infeasible.

- **S6** -- The three non-toggle orchestrated loops in `apply.ts`
  (`applyMarketplaceRemoves`, `applyMarketplaceAdds`,
  `applyPluginUninstalls`) previously silent-`continue`d on
  `result === undefined`, dropping the row from the cascade and hiding a
  producer-contract violation. Each silent continue is now replaced with
  a fail-loud failed-outcome push (`mp-remove-failed` / `mp-add-failed` /
  `plugin-uninstall-failed`) whose reason is derived from
  `classifyOrchestratorThrow(new Error("<orch> returned no outcome in orchestrated mode"))`,
  carrying the verbatim `"returned no outcome in orchestrated mode"`
  wording from `import/execute.ts:613` so the three loops converge with
  the import path. The synthetic Error falls through to
  `narrowProbeError` -> `"unreadable"`, a closed-set catalog token.

  The fourth (toggle) loop in `applyPluginToggles` stays on the silent
  continue per the plan's explicit scope carve-out -- it will converge
  on the same wording when sub-plan 05 lands Y3
  (`setPluginEnabled` overload).

- **Y7** -- `index.ts:31` swapped from `(err as Error).message` to the
  shared `errorMessage(err)` helper. Now a non-Error throw (e.g. a
  literal string) renders `reconcile aborted: <stringified>` instead of
  `reconcile aborted: undefined`. Added the `errorMessage` import from
  `shared/errors.ts`.

## Byte / catalog discipline

- `tests/architecture/catalog-uat.test.ts` GREEN.
- No `docs/output-catalog.md` edits in this commit.
- Existing test fixtures don't trigger the new failure paths
  (orchestrated mode always returns an outcome in current callees; no
  PluginShapeError / StateLockHeldError is currently produced by any
  test that calls `applyReconcile` end-to-end), so all rendered byte
  forms on the existing fixtures stay identical. The new closed-set
  reasons (`"not in manifest"`, `"already installed"`,
  `"no longer installable"`, `"lock held"`) are all pre-existing
  catalog members.

## Deviations

- **`classifyOrchestratorThrow` exported** -- the helper was
  module-private. Exported to enable direct unit-test coverage of the
  closed-set mapping (the integration test for "config declares a
  plugin absent from manifest" would require seeding the
  `installPlugin` outcome's `error` field, which is not reachable
  through `apply.ts`'s `gitOps` injection seam). Plan's I6 done
  criterion accepted the unit-test path -- the export is a minimal,
  isolated API surface change with no behavior impact.

- **S4 chose comment path over surface path** -- documented above. The
  test pin asserts the `CONTEXT.md S4` anchor is present at every call
  site by reading the source file with `node:fs/promises::readFile`.
  This is a static-source pin, weaker than a behavior pin, but it
  prevents the decision-anchored comment from being silently deleted
  in a future refactor.

- **S6 / Y7 test pins are static-source greps** -- the S6 test asserts
  the `"returned no outcome in orchestrated mode"` wording appears at
  least three times in `apply.ts` (extended to `>= 3` so sub-plan 05's
  Y3 fix can move the count to 4 without breaking this test). The Y7
  test asserts `index.ts` contains the new expression and does NOT
  retain the pre-fix cast. Both pins are deterministic and cheap; a
  full behavior pin for Y7 would require driving a non-Error throw
  through `applyReconcile`'s top-level catch, which has no clean
  injection seam.

## Verification

- `npm run check` GREEN (typecheck + lint + format + tests + integration
  all GREEN; full check exit 0).
- `pre-commit run --files <changed>` GREEN (no `SKIP=trufflehog` needed
  since this commit runs on the main working tree, not a worktree).
- 4 new tests added to `tests/orchestrators/reconcile/apply.test.ts`
  (I6, S6, S4, Y7); all 15 tests in the file pass.

## Out of scope (left for other plans)

- Y3 `setPluginEnabled` overload + the fourth toggle-loop fail-loud
  fix in `applyPluginToggles` (sub-plan 05).
- Y1 / Y2 / Y4 / Y5 / Y6 type cuts (sub-plans 04 / 05).
- D1..D11 comment/docs cleanup (sub-plan 07).
- Helper-return widen for `synthesizeUndeclaredMarketplaceSource`
  flagged by the S4 comment (future PR -- requires plumbing a new
  outcome shape through install + enable-disable).
