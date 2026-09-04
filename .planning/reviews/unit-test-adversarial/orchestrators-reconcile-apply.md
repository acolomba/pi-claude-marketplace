# Orchestrators — reconcile apply, outcomes, plan

**Scope:** `tests/orchestrators/reconcile/{apply,apply-outcomes,plan}.test.ts` paired with
`extensions/pi-claude-marketplace/orchestrators/reconcile/{apply,apply-outcomes,plan}.ts`
**Test files reviewed:** 3
**Production modules reviewed:** 3

## Summary

This is the strongest area reviewed so far in the sweep: every case builds fresh
literals, asserts the whole public value (`assert.deepStrictEqual` on the complete
`ReconcilePlan`, on the complete rendered cascade string, on the complete outcome
object), and `plan.test.ts` never once weakens to a bucket-by-bucket or
length-only check. `plan.ts` is genuinely pure (confirmed by the grep-based
architecture gate at `tests/architecture/reconcile-planner-purity.test.ts`, which
I read as background and which is not itself part of this assignment), and
`plan.test.ts` independently backs that with a same-inputs-twice determinism case.
The reconcile-vs-import `enabled` distinction (check 3) is exercised correctly at
both the planner and the full-apply level. The two themes a fixing pass should
attack first: (1) three `switch` statements across `plan.ts` and `apply.ts` have no
`default` arm over a closed discriminated union, which is a real latent-defect
risk given the codebase's own established `assertNever` exhaustiveness idiom
elsewhere; (2) `apply.test.ts` never mocks the five orchestrators it drives
(`installPlugin`, `uninstallPlugin`, `addMarketplace`, `removeMarketplace`,
`setPluginEnabled`) — it runs them for real against a hermetic temp filesystem and
treats disk state + the single notification as the observable contract. That is a
deliberate, well-reasoned, and well-evidenced deviation from this project's
strong-mock convention for orchestrator-call public behavior (documented as
D-115-03), not an oversight, but it is worth a second look since it is currently
the *only* possible design — the five collaborators are hardcoded static imports,
not an injectable seam, so a strong-mock version of this suite cannot be written
without a production refactor.

## Unit test findings

### `tests/orchestrators/reconcile/plan.test.ts`

- **[WARNING] Placeholder variable name `result`** — every one of the 12
  `test()` cases assigns `planReconcile`'s return to `const result`. Per the
  unit-testing guideline, name the value returned by the module under test
  after its production role, not a placeholder — `planReconcile` returns a
  `ReconcilePlan`, so rename `result` to `plan` in every case (e.g. lines 112,
  138, 172, 203, 258, 294, 326-327, 370, 427, 458, 502, 560, 623).

No other findings. Every case supplies fresh `merged`/`state` literals, asserts
the complete `ReconcilePlan` object (never a subset), and the file correctly
groups all cases under one `describe("planReconcile", ...)` since the module has
exactly one export. The malformed-key, dangling-reference, source-mismatch, and
mutually-exclusive-bucket cases are well chosen and each one would fail against a
plausible wrong implementation (e.g. swapping the install/enable split, or
dropping the CR-01 source-claiming logic).

### `tests/orchestrators/reconcile/apply.test.ts`

- **[WARNING] The five driven orchestrators are exercised for real, never as
  `strong-mock` interaction mocks** — `installPlugin`, `uninstallPlugin`,
  `addMarketplace`, `removeMarketplace`, and `setPluginEnabled` calls are public
  behavior `applyReconcile` promises to drive in a fixed order with fixed
  options (`notifications: { mode: "orchestrated" }`, `applyDefaultEnabled: true`,
  the `local: true` conditional spread), which is exactly the kind of
  interaction this project's convention says belongs behind
  `mock<Port>({ exactParams: true })` + `verify()`. This suite instead calls the
  real orchestrators against a case-owned hermetic temp tree and fakes only the
  git remote (header comment at lines 1-19, decision id D-115-03). This is a
  considered design, not an oversight, and it is not vacuous: I traced two of
  the exact-argument concerns the brief calls out and both are in fact
  discriminated by the existing cases — a dropped `applyDefaultEnabled: true`
  would be caught by "DFEN-04" (line 1500, asserts `record.enabled === false`
  off a bare declaration under a default-disabled entry) and a dropped/garbled
  `local: true` would be caught by "DFEN-05" (line 1565, asserts the stamp lands
  in `claude-plugins.local.json`, not the base file); a dropped
  `notifications: { mode: "orchestrated" }` on any of the five calls would make
  that orchestrator emit its own extra `ctx.ui.notify` call, which the exact
  `.times(emissions)` sizing in `createNotificationBoundary` would fail loudly
  on. So the current design does clear the "would a wrong implementation still
  pass" bar for the cases in this file. Flagging it because it is nonetheless a
  real deviation worth a maintainers' decision: today it is the *only* possible
  design, because `apply.ts` imports the five orchestrators as static module
  bindings (see the paired production finding below) rather than through an
  injectable seam — so nobody can add a complementary strong-mock case later
  without that refactor. If the team wants to keep the current behavioral-proof
  style, say so in a comment near the five call sites; if a future need arises
  for exact-argument verification independent of a specific fixture's emergent
  disk state, extract the five orchestrators into an `ApplyReconcileOptions`-style
  `deps` bundle mirroring the existing `gitOps` injection seam.

- **[WARNING] No case pins the documented config-to-record reconciliation
  limit** — the project's architecture doc states plainly that reconcile is "a
  config-to-record reconciliation, NOT a deep diff of records against on-disk
  artifacts: an artifact deleted underneath an intact record is not detected."
  No case in this file (nor in `plan.test.ts`) demonstrates that limit as
  observable behavior. Add one case: seed a marketplace + plugin that is fully
  declared, recorded, and enabled (mirroring e.g. the "RECON-05" converged case
  at line 2277), then delete the plugin's materialized artifact directly
  (e.g. `rm` the staged `resources/skills/<name>` directory) without touching
  `state.json` or the config files, run `applyReconcile`, and assert the
  cascade stays silent (`notifications` is `[]`) and `state.json` is
  byte-identical to before. That pins the documented limit as a regression
  guard — today nothing would fail if a future change accidentally started
  scanning disk artifacts (which would also be a hidden NFR-5/network-adjacent
  scope creep for a `resources_discover`-time function) or, conversely, if a
  regression silently started treating a manually-deleted artifact as reason to
  reinstall.

I did not find any hand-rolled recorder object, `It.isAny()`, `anyTimes()`,
`verifyAll()`/`resetAll()`, or a missing `verify()` anywhere in this file — the
shared `createNotificationBoundary` helper (`tests/edge/notification-boundary.ts`,
not part of this assignment but load-bearing here) is a correct `strong-mock`
usage with `exactParams: true`, exact `.times()` counts, and an explicit
`verifyBoundary()` called as the last statement of every case. Every case builds
its own `mkdtemp` hermetic tree and tears it down in `t.after()`, no case shares
mutable state, data-driven cases (`addBatchOrders`, `uninstallFaultPositions`,
`installFaultPositions`, `enableSignalRows`) each spawn one sibling `test()` per
row via a `for` loop, and every notify assertion is a whole-string
`assert.deepStrictEqual` built as an independent literal (the file's own header
states, correctly, that no expectation calls the reconcile projection).

### Clean files

- `tests/orchestrators/reconcile/apply-outcomes.test.ts` — the module-level
  `satisfies`/`@ts-expect-error` block correctly proves the large discriminated
  union's shape without inventing runtime cases for it, every runtime export
  (`classifyOrchestratorThrow`, `classifyReadPassThrow`, `dependenciesFromInstall`,
  `MigrateConfigSaveError`, `sourceMismatchOutcomeSubject`) has its own
  `describe()` block with no nesting, data-driven error-code cases use a `for`
  loop correctly, and every assertion is `assert.strictEqual`/`deepStrictEqual`
  on the full value (including a `MigrateConfigSaveError` case that checks
  `instanceof`, `name`, `message`, `configFilePath`, `cause`, and the cause's
  `.code` together as one object, not one property at a time).

## Production code findings

### `extensions/pi-claude-marketplace/orchestrators/reconcile/plan.ts`

- **[BLOCKER] `switch (match)` has no `default` arm** — `lines 184-208`. `match`
  is `SamePlannedSourceResult` (`domain/source.ts`), a closed 3-member literal
  union whose own doc comment claims "the compiler forces every caller to
  switch on the discriminant explicitly." That claim is false at this call
  site: the switch is used for its side effects inside a `for` loop (`continue`
  in every arm), so TypeScript does not require exhaustiveness here, and a
  future 4th member would silently fall through the switch doing nothing —
  the marketplace entry would be treated as neither added, mismatched, nor
  confirmed-steady, which is exactly the "config↔state divergence" this
  module's own header says it must never silently drop. Fix: add
  `default: { const _exhaustive: never = match; continue; }` — this needs no
  new import (so it does not touch the DIFF-01 purity gate) and will fail to
  compile the moment `SamePlannedSourceResult` gains a member nobody updated
  this switch for.

### `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts`

- **[BLOCKER] `switch (m.cause)` in `applySourceMismatches` has no `default`
  arm** — `lines 625-659`. Same defect class as the `plan.ts` finding above:
  `m.cause` is the closed 4-member `PlannedSourceMismatch["cause"]` union: a
  future 5th cause would be silently dropped from the outcome stream and never
  rendered on the cascade at all. Fix:
  `default: { const _exhaustive: never = m.cause; break; }`.

- **[WARNING] The five driven orchestrators are hardcoded static imports, not
  an injectable dependency bundle** — `lines 59-63`
  (`addMarketplace`/`removeMarketplace`/`setPluginEnabled`/`installPlugin`/
  `uninstallPlugin`). This is what forecloses the strong-mock interaction test
  discussed under the paired `apply.test.ts` finding above. `gitOps` is already
  threaded through `ApplyReconcileOptions` as an optional injection seam for
  exactly this reason (types.ts, "D-12 injection seam"); if exact-argument
  interaction verification is wanted later, extend that same pattern to the
  five orchestrators (a `deps?: { installPlugin, uninstallPlugin, addMarketplace,
  removeMarketplace, setPluginEnabled }` member defaulting to the real
  functions) rather than adding a test-only seam.

### `extensions/pi-claude-marketplace/orchestrators/reconcile/apply-outcomes.ts`

- **[WARNING] `switch (err.shape.kind)` has no `default` arm** — `line 383`.
  Less severe than the two BLOCKER instances above because every arm
  explicitly `return`s and the function has a real fallback statement
  immediately after the switch (`return narrowProbeError(err);`, line 394), so
  a future 5th `PluginShapeError` kind would still get a truthful (if generic)
  classification rather than being silently dropped. Still, write the fallback
  as `default: return narrowProbeError(err);` inside the switch — this matches
  the Google style guide's "every switch has a default group, last" rule and
  the codebase's own `assertNever`-style exhaustiveness convention used
  elsewhere (`bridges/hooks/exec-result.ts`), and removes the need for a reader
  to notice that the post-switch line is actually load-bearing.

- **[WARNING] Misleading JSDoc on `classifyOrchestratorThrow`** — `lines
  372-373`: "Exported for direct unit-test exercise of the closed-set mapping
  (the function is otherwise module-private)." This is not accurate: the
  function is imported and called by `orchestrators/reconcile/apply.ts` and
  `orchestrators/reconcile/backfill.ts` (both production modules), so the
  export is required regardless of testing. Fix: drop the sentence, or replace
  it with the true reason (shared by the two ledger-adjacent callers).

### Clean files

- No further production findings beyond the above; naming, JSDoc coverage
  (every exported symbol is documented), optional-field style (`?:`, never
  `| undefined`), and error-handling discipline (`{ cause }` threading,
  `instanceof` narrowing, no bare throws) are all sound across all three files.

## Not covered

- Per the diagnostic-review brief, I did not run `node --test`, `npm run
  test:coverage:direct`, or `npm run check` — the assignment explicitly
  prohibits running build/test/lint commands during this sweep. All findings
  above come from reading, not from a red toolchain run.
- I read `tests/architecture/reconcile-planner-purity.test.ts` and
  `tests/edge/notification-boundary.ts` only as background to answer the
  brief's specific checks (purity gate, notify-boundary mocking pattern); they
  are owned by other areas of the sweep and I did not review them for their
  own findings.
