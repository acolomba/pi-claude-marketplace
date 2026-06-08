# Phase 50 -- Deferred Items

Out-of-scope discoveries logged during execution of plan 50-01. Per the
executor SCOPE BOUNDARY rule these are pre-existing failures in files NOT
touched by this plan; they are documented, not fixed.

## ✅ RESOLVED (2026-06-08, quick task 260608-npa)

The pre-existing failure below was resolved by quick task `260608-npa`: the
brittle README-prose contract test `tests/architecture/reinstall-docs.test.ts`
was removed. Its 8 PRL requirements are already covered by behavior tests
(`tests/orchestrators/plugin/reinstall.test.ts`,
`tests/edge/completions/provider.test.ts`,
`tests/edge/handlers/plugin/reinstall.test.ts`) and the reinstall output bytes
are spec-bound in `docs/output-catalog.md` via
`tests/architecture/catalog-uat.test.ts`. `PRL-01` was re-tagged onto the
handler Usage-block test. `npm run check` is now fully green (1514/1514). The
original deferral record is retained below for the audit trail.

---

## Pre-existing test failure: reinstall README documentation gap

- **Test:** `tests/architecture/reinstall-docs.test.ts` -- "PRL-01/03/04/05/13/14/15/16: README documents reinstall command forms and semantics"
- **Status:** PRE-EXISTING failure on the `features/v1.10-error-attribution` baseline (commit `f000843~1`).
- **Evidence:** `git show f000843~1:README.md | grep -c "reinstall pr-review-toolkit@claude-plugins-official"` returns `0`; the test file is byte-unchanged by this plan (`git diff f000843~1 HEAD -- tests/architecture/reinstall-docs.test.ts` is empty).
- **Cause:** `README.md` lacks the v1.1 reinstall command documentation block the test asserts. README was last touched by an unrelated docs-refresh commit (`14736e0`), not by any v1.11 / Phase-50 work.
- **Impact on this plan:** none -- this plan touches only `shared/notify.ts`, the notification catalog, and notification byte tests. The notification-grammar work is fully GREEN (catalog-uat, notify-v2, notify-grammar-invariant, cross-op-convergence, and all orchestrator/edge byte tests pass).
- **Why deferred:** unrelated to notification summary-line grammar (GRAM-01..05); fixing it would require authoring missing README reinstall documentation, a separate documentation task outside this phase's scope.
- **Suggested follow-up:** a `/gsd-quick` doc task to add the reinstall command forms + semantics block to `README.md`, or align `reinstall-docs.test.ts` to the current README surface.
