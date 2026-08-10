---
created: 2026-08-09
resolves_phase: "98"
source: 97-REVIEW.md IN-07
---

# The orchestrated install outcome drops `orphanRewake`, so the load-time cascade never renders `{orphan rewake}` for a fresh install

`installPlugin`'s standalone row reads `installCtx.resolved.orphanRewake`
directly and pushes the `{orphan rewake}` token (SURF-05 / D-63-08). The
orchestrated `InstallPluginOutcome` it returns does NOT carry that flag — it
carries `degradedKinds` only — so `reconcile/apply.ts` has nothing to thread and
`reconcile/notify.ts::installedRowFromOutcome` composes its reasons from
`degradedKinds` alone.

Result: a plugin with an orphan companion field (`rewakeMessage` /
`rewakeSummary` declared on a handler without `asyncRewake: true`) renders
`(installed) {orphan rewake}` when installed by the standalone verb, and a bare
`(installed)` when installed by the load-time reconcile cascade. The config bug
is silently dropped on exactly the surface the user did not type a command for.

This is the INVERSE of the enable-arm asymmetry: the enable arm now carries all
three degradation signals (dropped kinds, orphan rewake, malformed kinds) on
both the standalone and orchestrated paths, so the reconcile cascade currently
reports `{orphan rewake}` for a **re-enable** but not for a **fresh install** of
the same plugin. Two sibling arms of one cascade disagree about whether the
signal is worth reporting.

## Why deferred

Pre-existing on the install arm — it predates the enable-arm work entirely and
was not created by it. The enable-arm fix only made the inconsistency visible by
closing the same gap on the other side.

Fixing it means widening the install outcome contract and its projection, which
is install-surface scope, not the disabled-state classification repair the fix
loop was scoped and capped to. Doing it inside that loop would have added an
unreviewed contract change to a set of findings already at its iteration cap.

Low severity: the token is advisory (it reports a plugin-authoring bug, not a
failed operation) and the standalone verb — the surface a user actually invokes
to install — already reports it correctly.

## Where it lands

Two small threading changes plus a projection read:

1. `orchestrators/plugin/install.ts` — add `orphanRewake?: boolean` to the
   returned `InstallPluginOutcome`, set from `installCtx.resolved.orphanRewake`
   beside the existing `degradedKinds` derivation (same site, ~`:1856`). Omit
   when false so a clean install's outcome shape is unchanged.
2. `orchestrators/reconcile/apply-outcomes.ts` — add the matching optional field
   to `PluginInstalledOutcome`, documented against SURF-05 / D-63-08 exactly as
   `degradedKinds` is documented against WARN-01 / D-86-03.
3. `orchestrators/reconcile/apply.ts` — thread it through the install arm's
   outcome construction.
4. `orchestrators/reconcile/notify.ts::installedRowFromOutcome` — push the
   `orphan rewake` token AHEAD of the malformed tokens, matching the emit order
   `install.ts` and `enabledRowFromOutcome` both use (orphan rewake, malformed
   per kind, dropped kinds).

Severity is unaffected: `orphan rewake` does not move the severity channel on
any surface (only malformed kinds and the soft-dep probe do), so the
`degradedKinds.length > 0 ? "warning" : "info"` rule stays as written.

Consider whether `EnableDegradationSignals` (exported from
`orchestrators/plugin/enable-disable.ts`) should be widened into a shared
`LedgerDegradationSignals` shape that BOTH the install and enable outcomes
inherit. That is what would make this class of asymmetry a compile error instead
of a review finding — the enable arm already gets that protection, the install
arm does not.

Needs: a row assertion in `tests/orchestrators/reconcile/notify.test.ts` (the
enable-arm equivalent already exists and can be mirrored), and an end-to-end
assertion in `tests/orchestrators/reconcile/apply.test.ts` if a hooks fixture
with an orphan companion field is cheap to seed there. No new catalog state is
needed — `success-with-orphan-rewake` in `docs/output-catalog.md` already pins
the rendered form; this only makes a second surface reach it.
