# Transaction — phase ledger, rollback, state guard — adversarial re-review

**Scope:** `extensions/pi-claude-marketplace/transaction/{phase-ledger,rollback,with-state-guard}.ts` and `tests/transaction/{phase-ledger,rollback,with-state-guard}.test.ts`, re-examined by mutation. Also traced every production consumer of the three modules across `extensions/` to settle export ownership.
**First-pass file:** `unit-test-findings/transaction.md`
**Clean files attacked:** 3 (`tests/transaction/rollback.test.ts`, `extensions/…/transaction/phase-ledger.ts`, `extensions/…/transaction/rollback.ts`) — plus `tests/transaction/phase-ledger.test.ts`, which the first pass praised as a model file and left with one cosmetic warning.
**Existing findings graded:** 7

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 3 |
| New WARNING (missed by first pass) | 8 |
| Existing CONFIRMED | 5 |
| Existing UNDERSTATED | 0 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 1 |
| Existing DUPLICATE-OF | 0 |

The first pass's headline judgment — "this is the strongest area reviewed so far" — is half right. `phase-ledger.test.ts` and `with-state-guard.test.ts` genuinely kill most mutations I threw at them, and I say which ones under "Still clean after attack". But the pass missed that one of the three production modules has **no production caller at all**, that the ledger's single most specific documented ordering rule is unexercised, and that the state guard's headline ST-7 ordering promise is unproven on its asynchronous arm.

## New findings — from the clean lists

### `extensions/pi-claude-marketplace/transaction/rollback.ts` (and its paired test)

- **[BLOCKER] The whole module is dead: `formatRollbackError` has zero production callers, and two doc comments claim otherwise** — `rollback.ts:59`, `phase-ledger.ts:143`, `rollback.ts:23–26`

  A repo-wide grep for `formatRollbackError` (excluding `node_modules`, `.git`, `.planning`, `.codegraph`) returns exactly seven hits: five in `tests/transaction/rollback.test.ts`, one in its own definition, and one in a prose comment in `shared/errors.ts:295`. No orchestrator, bridge, edge handler, or entry point calls it. `RollbackErrorResult` is likewise referenced only from the test.

  The live path re-implements the rule instead. `orchestrators/plugin/install.ts:1252–1271` — the sole `runPhases` consumer — inspects `result.ok`, copies `result.rollbackPartials` into a capture object, and re-throws `result.error` raw; `handleInstallThrow` (`install.ts:1858–1859`) then applies its own `err instanceof PathContainmentError` bypass and its own `capture.rollbackPartials.length > 0` partial-suppression test. So two of `formatRollbackError`'s three rules exist twice, and the third — the ES-4 `new Error(message, { cause: originalError })` wrap — exists **only** in the dead copy. `.planning/milestones/v1.3-REQUIREMENTS.md:286` still lists ES-4 as `[ ]` / "Pending", which is consistent: the requirement's only implementation was never wired up.

  Three doc comments assert callers that do not exist and must not be left in place whichever way this is resolved:
  - `phase-ledger.ts:143–145` — "callers inspect `result.ok` and (when false) call `formatRollbackError(result, result.error!)`". No caller does.
  - `rollback.ts:23–26` — "Orchestrators destructure this and forward the `rollbackPartials[]` into a `PluginFailedMessage.rollbackPartial` payload". No orchestrator destructures it; `install.ts` builds that payload from its own capture.
  - `rollback.ts:54–57` — same claim in the `@returns` prose.

  Why `fallow dead-code` does not catch it: `.fallowrc.json` sets `"production": false`, so `tests/transaction/rollback.test.ts` counts as a consumer and keeps both exports reachable. This is a concrete instance of the META-FINDINGS "gates that do not gate" class, and it generalises — see Meta-findings impact.

  **What to do (operator decision, then mechanical):** decide whether ES-4 ships. If it ships, wire `formatRollbackError` into `install.ts:1263–1270` so the ES-4 wrap and the PI-14 bypass have one implementation, and delete the duplicated `isPathContainment`/`rolledBackPartial` logic at `install.ts:1858–1859`. If it does not ship, delete `transaction/rollback.ts` and `tests/transaction/rollback.test.ts` outright and strike the three doc-comment claims above. Do not leave the module in place with the comments corrected — that just documents dead code.

- **[WARNING] No case distinguishes `formatRollbackError`'s two parameters** — `tests/transaction/rollback.test.ts:16–28, 43–55, 72–84, 100–112, 143–160`

  All five cases build `phaseRun` with `error: originalError`, i.e. the two arguments are always the same object. Mutating `rollback.ts:63` and `:72` to read `result.error` instead of `originalError` (and dropping the second parameter) leaves every case green. The two-parameter shape exists only because `RunPhasesResult.error` is optional — see the `RunPhasesResult` finding below — so this is worth a case if the module survives.

  **Fix:** in the "wraps one partial failure" case, set `phaseRun.error` to a *different* Error (`new Error("ledger-side error")`) than the `originalError` argument, and keep the existing assertions — `rollback.error.message` must be `"plugin installation failed"` and `rollback.error.cause` must be `originalError` by identity.

- **[WARNING] Three assertions check the input fixture, not the function's output** — `tests/transaction/rollback.test.ts:89, 119, 169`

  Line 89 (`assert.ok(rollback.error instanceof PathContainmentError)`) asserts the class hierarchy of `shared/path-safety.ts`'s `SymlinkRefusedError`, which belongs to `tests/shared/path-safety.test.ts`. Lines 119 and 169 (`assert.deepStrictEqual(phaseRun.leaks, [...])`) assert that the *input* object is unmutated — and they do it with `leaks` values `runPhases` can never produce, because the ledger returns `leaks: []` on both arms (`phase-ledger.ts:168, 172`).

  **Fix:** delete line 89 (the `assert.strictEqual(rollback.error, originalError)` on line 88 already carries the case). Replace the `leaks` fixtures at lines 99, 138–142 with `[]` so the fixture matches what the producer can emit, and delete lines 119 and 169.

### `extensions/pi-claude-marketplace/transaction/phase-ledger.ts` (and its paired test)

- **[BLOCKER] The failing-phase-partial-first ordering is never exercised, and the case titled for it does not test it** — `tests/transaction/phase-ledger.test.ts:271` (`test('reports an ordinary failing-phase undo error before reverse failures')`)

  `phase-ledger.ts:166–167` implements the AS-4 / MSG-RP-1 rule its own comment states at line 162–163: "failing-phase partial prepends to index 0". Mutating line 167 to `[...reversePartials, failingPartial]` leaves **all 13 cases green**, because no case configures both a failing-phase undo failure and a completed-phase undo failure at once:

  | case | `forwardFailure` | `undoFailures` | partials produced |
  | --- | --- | --- | --- |
  | line 271 | `agents` | `{ agents }` | failing only |
  | line 312 | `skills` | `{ skills }` | failing only |
  | line 341 | `hooks` | `{ commands }` | reverse only |
  | line 383 | `state` | `{ skills, agents, mcp }` | reverse only |

  The case at line 271 is titled "…before reverse failures" but produces a one-element array with no reverse failure in it. The ordering *within* the reverse walk is well covered (mutating `push` to `unshift` in `rollbackExecuted` fails at line 392–397), and the *call* order own-undo-then-reverse-walk is proven by `context.operations`; it is only the array-order boundary between the two groups that is untested.

  **Fix:** add one sibling case, and rename the line-271 case to `"reports the failing-phase undo error when no completed-phase undo fails"` so its title stops promising what it does not check.

  ```ts
  test("reports the failing-phase undo failure ahead of a completed-phase undo failure", async () => {
    // arrange
    const context: LedgerContext = { operations: [], active: [] };
    const forwardError = new Error("hooks forward failed");
    const hooksUndoError = new Error("hooks undo failed");
    const commandsUndoError = new Error("commands undo failed");
    const expectedLedgerResult: RunPhasesResult = {
      ok: false,
      error: forwardError,
      rollbackPartials: [
        { phase: "hooks", msg: "hooks undo failed", cause: hooksUndoError },
        { phase: "commands", msg: "commands undo failed", cause: commandsUndoError },
      ],
      leaks: [],
    };

    // act
    const ledgerResult = await runPhases(
      createSchedule({
        forwardFailure: { phase: "hooks", error: forwardError },
        undoFailures: { hooks: hooksUndoError, commands: commandsUndoError },
      }),
      context,
    );

    // assert
    assert.deepStrictEqual(ledgerResult, expectedLedgerResult);
    assert.deepStrictEqual(context, {
      operations: [
        "do:skills", "do:commands", "do:agents", "do:hooks",
        "undo:hooks", "undo:agents", "undo:commands", "undo:skills",
      ],
      active: ["commands", "hooks"],
    });
  });
  ```

- **[WARNING] `RunPhasesResult.leaks` is speculative generality: never written, never read** — `phase-ledger.ts:72`

  `leaks` is documented at line 66 as "reserved for future cleanup-leak descriptors (AS-5); the ledger itself never populates it (orchestrators may)". No orchestrator does. A repo-wide grep for `.leaks` shows every other `leaks` in the tree belongs to the unrelated `ManualRecoveryError.leaks` mechanism (`shared/errors.ts:395`) or to local `const leaks: string[]` accumulators inside `reinstall.ts` / `clone-gc.ts` / `update.ts`. `install.ts`, the only `runPhases` consumer, never reads `result.leaks`. Every expected literal in `phase-ledger.test.ts` carries `leaks: []`, which reads as a live contract.

  **Fix:** delete the field from `RunPhasesResult`, drop `leaks: []` from both return statements (`phase-ledger.ts:168, 172`) and from the eleven expected literals in `phase-ledger.test.ts`. If AS-5 is genuinely queued, leave a one-line comment on the interface instead of a permanently-empty field.

- **[WARNING] `RunPhasesResult` models `ok` and `error` independently instead of as a discriminated union** — `phase-ledger.ts:68–73`

  Because `ok: boolean` and `error?: Error` are independent, the sole consumer has to hand-roll an unchecked narrowing: `install.ts:1276–1288` declares `FailedRunPhasesResult = RunPhasesResult & { ok: false; error: Error }` and a predicate `isFailedRunPhasesResult` that returns `!result.ok` **without checking `error !== undefined`**, then throws `result.error` at line 1270. The predicate is an assertion in type-guard clothing; its own doc comment admits it exists to "keep that producer invariant private while the shared legacy result type still models `ok` and `error` independently". The module's own doc comment at `phase-ledger.ts:145` recommends `formatRollbackError(result, result.error!)` — a non-null assertion in prose.

  This is the closed-set silent-omission class this repo has already shipped repeatedly, and it is the same argument NFR-7 makes for `domain/resolver.ts`'s `installable` union.

  **Fix:** replace `RunPhasesResult` with `type RunPhasesResult = { ok: true; rollbackPartials: readonly []; } | { ok: false; error: Error; rollbackPartials: readonly RollbackPartial[] }`, delete `FailedRunPhasesResult` and `isFailedRunPhasesResult` from `install.ts`, and narrow with a plain `if (!result.ok)`. Update the eleven expected literals in `phase-ledger.test.ts` (they already match the union arms exactly — the success cases omit `error`, the failure cases supply it — so no assertion changes are needed).

- **[WARNING] An assertion inside the test helper's `undo` callback is swallowed by the code under test** — `tests/transaction/phase-ledger.test.ts:139`

  `assert.notStrictEqual(activeIndex, -1)` runs *inside* the `undo` the ledger invokes. If it ever fires, `rollbackExecuted`'s catch turns the `AssertionError` into a `RollbackPartial` row rather than failing the case directly; the failure only re-surfaces indirectly through the `rollbackPartials` `deepStrictEqual`. It is also a standalone negative assertion, and it is redundant: the only way to reach `-1` is a double-undo, which the `context.operations` log already catches in every case.

  **Fix:** delete line 139 and let `context.active`'s `deepStrictEqual` carry it.

### `tests/transaction/with-state-guard.test.ts`

- **[BLOCKER] No `withStateGuard` case passes an asynchronous `mutate`, so the ST-7 "save after mutate" ordering is unproven** — `with-state-guard.ts:72`

  Every one of the six `withStateGuard` call sites in the test file (lines 278, 300, 307, 313, 542, 548) passes a **synchronous** closure. Mutating `with-state-guard.ts:72` from `const result = await mutate(fresh);` to `const result = mutate(fresh);` leaves all of them green: for a sync closure the two are identical, and for an async closure the returned promise is still adopted by the enclosing `async` function, so even the return value survives — only the *saved bytes* would silently miss any mutation made after the closure's first `await`.

  This mutation is invisible to branch coverage (dropping an `await` creates no branch), which is exactly why the first pass's coverage-shaped reading missed it. `withStateGuard`'s signature explicitly admits the async arm (`mutate: (state: ExtensionState) => Promise<T> | T`, line 68) and every production caller — `marketplace/update.ts:505`, `plugin/update.ts:1951`, `reconcile/backfill.ts:110` — uses it.

  **Fix:** add one case whose closure mutates *after* an `await`:

  ```ts
  test("saves the mutations an asynchronous state guard callback makes after it awaits", async (t) => {
    // arrange
    const directory = await mkdtemp(path.join(tmpdir(), "state-guard-async-mutate-"));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const locations = locationsFor("project", directory);
    const expectedStateBytes =
      '{\n  "schemaVersion": 2,\n  "marketplaces": {},\n  "lastReconciledExtensionVersion": "awaited-mutation"\n}\n';

    // act
    const callbackOutcome = await withStateGuard(locations, async (state) => {
      await Promise.resolve();
      state.lastReconciledExtensionVersion = "awaited-mutation";
      return "async committed" as const;
    });
    const stateBytes = await readFile(locations.stateJsonPath, "utf8");

    // assert
    assert.strictEqual(callbackOutcome, "async committed");
    assert.strictEqual(stateBytes, expectedStateBytes);
  });
  ```

- **[WARNING] The `proper-lockfile` options object is never asserted; four of its five fields can be mutated undetected** — `with-state-guard.ts:158–166`

  `acquireStateLock` passes `{ lockfilePath, realpath: false, retries: 0, stale: 10_000, update: 2_000 }`. Only `lockfilePath` is indirectly pinned — the `lockObservations` assertion at `with-state-guard.test.ts:165` calls `lockfile.check` with the same explicit `lockfilePath`, so dropping it fails. The other four survive:
  - `stale: 10_000 → 100` — a lock goes stale mid-install and a second process proceeds. This is precisely the cross-process state/disk drift D-06 exists to prevent, and no case notices.
  - `update: 2_000 → 60_000` — the held lock's mtime stops being refreshed inside the stale window; same failure mode.
  - `retries: 0 → 3` — contradicts the documented non-re-entrancy contract; the contention case at line 498 would still see a `StateLockHeldError`, just later.
  - `realpath: false → true` — survives on a symlink-free `tmpdir`.

  **Fix:** add one case that records the acquisition arguments and compares the whole options object against a hand-written literal:

  ```ts
  const lock = t.mock.method(lockfile, "lock", () => Promise.resolve(() => Promise.resolve()));
  await withLockedStateTransaction(locations, () => "acquired" as const, dependencies);
  assert.deepStrictEqual(
    lock.mock.calls.map((call) => call.arguments),
    [[locations.extensionRoot, {
      lockfilePath: locations.stateLockFile,
      realpath: false,
      retries: 0,
      stale: 10_000,
      update: 2_000,
    }]],
  );
  ```

- **[WARNING] Every case is project scope, so `StateLockHeldError`'s scope argument can be hardcoded undetected** — `with-state-guard.ts:119`, `with-state-guard.test.ts:96, 173, 216, 270, 298, 333, 378, 408, 453, 505, 592, 629, 665, 704, 742, 769, 803`

  All eighteen `locationsFor(...)` calls in the file pass `"project"`. Mutating line 119 to `new StateLockHeldError("project", locations.stateLockFile, { cause: err })` passes every case, including the assertion at line 571 that checks `scope: "project"`. `locations.scope` is the only place the guard reads the scope, and user scope is a live production path (`locationsFor` at `persistence/locations.ts:145` resolves it through `getAgentDir()`).

  **Fix:** add a user-scope contention case. Copy the `withHermeticHome` helper shape from `tests/orchestrators/marketplace/info.test.ts:179–206` (it saves and restores `HOME` and `PI_CODING_AGENT_DIR` in a `finally`), build `locationsFor("user", cwd)`, and assert `{ name, message, scope, lockPath }` with `scope: "user"` and the user-scope `stateLockFile`.

### All three test files

- **[WARNING] Positive `satisfies` proofs only; no `@ts-expect-error` negatives anywhere in `tests/transaction/`** — `phase-ledger.test.ts:107, 112, 278`; `rollback.test.ts:21, 25, 105, 109, 148, 157`; `with-state-guard.test.ts:108, 113, 184, 224, 344, 387, 421, 463, 515, 602, 638, 678, 716, 753, 782, 815`

  The area exports five types (`Phase<C>`, `RollbackPartial`, `RunPhasesResult`, `RollbackErrorResult`, `LockedStateTransactionDeps`) and proves each one *accepts* a valid literal. Nothing proves any of them *rejects* an invalid one, so a widening of any of those types — `msg?: string`, `phase: unknown`, an extra optional member on `LockedStateTransactionDeps` — compiles clean and the suite stays green. The sibling `tests/persistence/config-io.test.ts:16–22` shows the in-repo form: a bare `void ({ … } satisfies T);` positive followed by a `// @ts-expect-error <reason>` negative.

  **Fix:** add one negative per exported type next to its existing positive — e.g. `// @ts-expect-error a phase without a name is not a Phase` over `void ({ do: () => Promise.resolve() } satisfies Phase<LedgerContext>);`, and `// @ts-expect-error cause must be an Error, not its message` over `void ({ phase: "skills", msg: "x", cause: "x" } satisfies RollbackPartial);`.

## Export ownership census

Every export of the three paired modules, mapped to the case that owns it. "Production consumers" is from a repo-wide grep of `extensions/`.

| Module | Export | Owning case | Production consumers | Status |
| --- | --- | --- | --- | --- |
| `phase-ledger.ts` | `runPhases` | `phase-ledger.test.ts:161` + 12 more | `install.ts:1252` | owned |
| `phase-ledger.ts` | `Phase<C>` | `phase-ledger.test.ts:112, 120, 122` (`satisfies` + return annotation) | `install.ts:1243`, `enable-disable.ts` | owned, positive proof only |
| `phase-ledger.ts` | `RollbackPartial` | `phase-ledger.test.ts:278` (`satisfies`) | `install.ts:481`, `install.messaging.ts:230`, `enable-disable.ts:226` | owned, positive proof only |
| `phase-ledger.ts` | `RunPhasesResult` | `phase-ledger.test.ts:154` + 10 more (annotation) | `install.ts:1276, 1286` | owned; `.leaks` member has no consumer at all |
| `rollback.ts` | `formatRollbackError` | `rollback.test.ts:28, 55, 84, 112, 160` | **none** | **TEST-ONLY** — see BLOCKER above |
| `rollback.ts` | `RollbackErrorResult` | `rollback.test.ts:25, 52, 81, 109, 157` (`satisfies`) | **none** | **TEST-ONLY** |
| `with-state-guard.ts` | `withStateGuard` | `with-state-guard.test.ts:278, 306, 313, 542, 548` | `marketplace/update.ts:505`, `plugin/update.ts:1478, 1951`, `reconcile/backfill.ts:110` | owned; async arm untested (BLOCKER above) |
| `with-state-guard.ts` | `withLockedStateTransaction` | `with-state-guard.test.ts:118` + 14 more | `install.ts:2001`, `uninstall.ts:595`, `reinstall.ts:330`, `enable-disable.ts:728`, `update.ts:1668`, `marketplace/{add,remove,autoupdate}.ts`, `reconcile/apply.ts:117, 857`, `import/execute.ts:945` | owned |
| `with-state-guard.ts` | `LockedStateTransactionDeps` | `with-state-guard.test.ts:108, 184, 224, …` (`satisfies`, 16 sites) | `reinstall.ts:114, 215` | owned, positive proof only |
| `with-state-guard.ts` | `LockedStateTransaction` | — (never imported by the test; reached only as the inferred type of the `transaction` parameter) | `reinstall.ts:113, 880` | **incidental** — exercised, never named or `satisfies`-checked |

Two rows matter. `formatRollbackError` / `RollbackErrorResult` are the dead pair. `LockedStateTransaction` is a live production type whose paired test never names it: add `void ({ state: { schemaVersion: 2, marketplaces: {} }, save: () => Promise.resolve() } satisfies LockedStateTransaction);` plus a `@ts-expect-error` negative alongside the `LockedStateTransactionDeps` proofs.

## Branch census

### `phase-ledger.ts` — complete

Every branch has both arms taken. I traced all ten:

| Branch | false arm | true arm |
| --- | --- | --- |
| `runPhases` for-loop entered | `test:196` (empty schedule) | all others |
| `err instanceof Error` (`:160`) | `test:493` (string throw) | `test:171` rows |
| `failingPartial === undefined` (`:167`) | `test:271` | `test:341` |
| `phase.undo === undefined` (`:117`) | `test:271` | `test:242` |
| `undoErr instanceof PathContainmentError` (`:125`) | `test:271` | `test:437` |
| `undoErr instanceof Error` spread (`:132`) | `test:312` | `test:271` |
| `rollbackExecuted` loop entered (`:81`) | `test:38` row (skills fails first) | others |
| `!done.undo` continue (`:82`) | most | `test:213` |
| `undoErr instanceof PathContainmentError` (`:89`) | `test:341` | `test:465` |
| `undoErr instanceof Error` spread (`:101`) | `test:383` (`skills` rejects a string) | `test:341` |

No reachable-untested branches, no unreachable branches, no compiler-forced arms. The BLOCKER above is a *value*-ordering gap, not a branch gap — worth stating plainly, because a coverage-only reading of this module reports 100% and stops.

### `rollback.ts` — complete

Three return arms, all covered (`test:35`/`test:62` → containment; `test:13` → zero partials; `test:92`/`test:122` → wrap). The unreached *combination* (a `PathContainmentError` with zero partials) returns the identical value on either arm, so it is not a distinct branch.

### `with-state-guard.ts` — two uncovered arms inside `isLockHeldError` (`:172–179`)

The first pass grouped these; they are different categories and want different fixes.

- `err !== null` false arm — **compiler-forced, unreachable by the real collaborator** (D-116-01a). `typeof err === "object"` narrows `unknown` to `object | null`, and `"code" in err` does not type-check — nor run — against `null`, so the clause cannot be deleted. `proper-lockfile.lock` never rejects with `null`; reaching this arm requires the `t.mock.method` patch to reject a value the real dependency cannot produce. Do **not** add a case for it.
- `.code === "ELOCKED"` false arm (reached with `"code" in err` true) — **reachable and untested**. `proper-lockfile` rejects with errno-carrying Errors from its own `mkdir`/`stat` calls (`EPERM`, `ENOSPC`, `EACCES`), and the guard must let those through as ordinary errors rather than mistranslating them into `StateLockHeldError`.

**Fix both at once by restructuring, then adding one case.** Replace `isLockHeldError` with the two-branch form, which drops the unreachable arm entirely and reuses the codebase's existing errno predicate:

```ts
function isLockHeldError(err: unknown): boolean {
  return isErrnoException(err) && err.code === "ELOCKED";
}
```

(`isErrnoException` is already exported from `shared/errors.ts:15` and is described there as the one definition every errno-dispatching narrower keys on — this module hand-rolls a private copy of it, which is itself sibling drift.) Then add one case mirroring `"propagates an ordinary acquisition Error without loading state or entering the callback"` (`test:588`) that rejects with `Object.assign(new Error("no space left on device"), { code: "ENOSPC" })` and asserts the thrown error is that same object by identity — **not** a `StateLockHeldError`.

Every other branch in the module is covered on both arms: `deps?.loadState ?? loadState` and `deps?.saveState ?? saveState` (deps-absent at `test:246, 358, 433, 482`; deps-present throughout), `if (saved)` (`test:212`), `if (!hasPrimaryError)` in the release catch (`test:661` vs `test:765`), `primaryError instanceof Error` (`test:765` vs `test:799`), and both `toError` arms.

`withStateGuard`'s save-failure path has no dedicated case (the module takes no deps, unlike `withLockedStateTransaction`), but it routes through the same `withScopeLock` catch that `test:449` already covers — covered-by-equivalent-path, not a gap.

## Grading of first-pass findings

### `tests/transaction/phase-ledger.test.ts`

- **CONFIRMED** — *Undocumented compile-time-only fixture* (`SCHEDULE_TYPE_EVIDENCE`, lines 109–113). Real, and WARNING is right. **But the proposed remedy is wrong: the constant should be deleted, not commented.** `createSchedule`'s annotated return type (`: readonly Phase<LedgerContext>[]`, line 120) already forces the `{ name, do }` literal at line 146 to satisfy `Phase<LedgerContext>` — the identical compile-time proof, at the site that actually depends on it. If a standalone proof is wanted anyway, use the sibling form from `tests/persistence/config-io.test.ts:16–22`: an inline `void ({ … } satisfies Phase<LedgerContext>);` with a `@ts-expect-error` negative beneath it, not a named constant that is immediately `void`-discarded.

### `tests/transaction/with-state-guard.test.ts`

- **CONFIRMED** — *`isLockHeldError` branch coverage gap* (BLOCKER). The static trace holds: I re-derived it clause by clause and confirmed the `err !== null` and `.code === "ELOCKED"` false arms are both unreached. BLOCKER is the right severity — the repo's own `scripts/test-coverage-direct.mjs:294–302` fails a pair on `hit !== found` for branches, so this pair would go red under `npm run test:coverage:direct`. See the branch census for the correction: the two arms are *different categories* (one compiler-forced and unreachable, one genuinely reachable), and the recorded fix — "add two cases, one rejecting `null`" — would add a case for input the real collaborator cannot produce. Take the restructure instead.

- **OVERSTATED** — *No `describe()` grouping by exported entrypoint*. Both cited authorities fail. (1) The skill's wording is permissive, not mandatory: "`describe()` only one level deep, one per exported entrypoint, and **only when** the module has several" constrains where `describe()` may be used; it does not require it. (2) The claim that grouping is "this repo's own majority convention" is false — **75 of 246** unit-test files contain a `describe(`; flat top-level `test()` is the majority at 70%. A readability preference for an 830-line file is defensible, but it is a preference, not a defect, and it should not compete for fixing-pass time with the three blockers above. Recommend dropping it.

- **REFUTED** — *Hand-rolled call-log stand-ins instead of `t.mock.fn()`*. The `persistenceLog` recorders (lines 99–108, 174–184, 334–344, 410–421) are the **sanctioned** tool for what those cases promise, not a deviation from it. The skill's own instruction for cross-collaborator order is: "each promised method is replaced by a recorder pushing into one shared log, the whole log is compared." That is exactly `assert.deepStrictEqual(persistenceLog, [load, save, load])` at lines 160–164. `t.mock.fn(loadState)` and `t.mock.fn(saveState)` would produce two *separate* per-function call lists and could not express "load, then save, then load" across the two collaborators at all — the recommended change would strictly weaken the proof. META-FINDINGS itself names this file's sibling, `tests/transaction/phase-ledger.test.ts`, as the reference implementation of the shared-log pattern. The counters at lines 379–387, 411, 594–595, 667–668 are a separate matter: they observe the lock port, which *is* mock-worthy ("transaction control"), and the reason they are hand-rolled is the missing port — already the subject of the production finding below, not a second test finding.

- **CONFIRMED** — *`t.mock.method(lockfile, "lock", …)` patches a third-party singleton* (7 sites). Real, WARNING is right, and not a hermeticity break: `--test-concurrency` (`package.json:82`) is file-level, cases within a file run sequentially, and `t.mock` auto-restores per context. It is the symptom of the missing port, and it will fall out of the production fix.

### `extensions/pi-claude-marketplace/transaction/with-state-guard.ts`

- **CONFIRMED** — *Hidden `proper-lockfile` dependency with no injectable port*. WARNING is right, and I want to be explicit about why it is **not** the BLOCKER the analogous edge-handler finding is (META-FINDINGS §4). There, the missing seam forces the tests to assert another module's contract; here the tests still assert `withScopeLock`'s own behavior, just through a patched module object. The port is worth adding — and the new lock-options finding above becomes much cleaner with one — but the tests are not lying about ownership.

- **CONFIRMED** — *Undocumented top-level exports* (`LockedStateTransaction`, `LockedStateTransactionDeps`, lines 40–48). Straight style-skill violation ("every top-level export is documented"); the file's two functions both carry full JSDoc, so this is drift within one file.

## Still clean after attack

These are the mutations the area genuinely kills. The fixing pass should not spend time here.

- **`tests/transaction/phase-ledger.test.ts`** — kills, verified case by case: reversing the reverse-walk (`executed.slice()` without `.reverse()`); `partials.push` → `unshift`; calling `rollbackExecuted` before `invokeFailingPhaseUndo` (the TR-02 own-undo-first order, caught by the `operations` log in all six `FORWARD_FAILURE_CASES` rows); `executed.push(phase)` moved before `await phase.do(ctx)` (double-undo shows in the log); dropping the `undoErr instanceof Error` guard so `cause` becomes `undefined` instead of absent (`assert.deepStrictEqual` distinguishes an own key set to `undefined` from an absent one — I verified this on the installed Node); rebuilding an equivalent `Error` instead of preserving the original (`assert.strictEqual` identity checks at lines 191, 298, 367, 416–417, 458, 486); swallowing the `PathContainmentError` re-throw; adding `error: undefined` to the success result; changing any `msg` or `phase` string. Branch coverage is complete on both arms of all ten branches.
- **`tests/transaction/with-state-guard.test.ts`** — kills: passing `locations.stateJsonPath` instead of `locations.extensionRoot` to `loadState`/`saveState`; ignoring `deps.loadState`/`deps.saveState` and using the module imports; saving before mutating; calling `saveState` after a callback throw; leaving the lock held (every case ends with `lockfile.check(...) === false` plus a real retry that succeeds); dropping `cause` from `StateLockHeldError`; swapping its `scope`/`lockPath` arguments; changing one word of the dual-failure chain message; wrapping the release error as the cause instead of the primary error; letting a second `tx.save()` through. The contention case (line 498) is a genuinely strong piece of work: it proves real cross-`withStateGuard`/`withLockedStateTransaction` exclusion with controlled promises and an `AbortSignal`-bounded wait, with no sleep, no second process, and a deterministic release.
- **`tests/transaction/rollback.test.ts`** — kills: dropping `{ cause: originalError }` from the wrap; returning the original error unwrapped when partials exist; returning `result.rollbackPartials` instead of `[]` on the containment arm; off-by-one on the `length === 0` guard; copying the partials array instead of aliasing it (lines 118, 166 pin identity). One caveat on that last one: pinning `rollback.rollbackPartials === rollbackPartials` also locks out a defensive copy, so if the module survives the dead-code decision, decide deliberately whether aliasing is the contract.

## Not covered

- I ran no test, no coverage report, and no lint — per the brief. The branch census is a static trace; the two `isLockHeldError` arms and the ten `phase-ledger.ts` branches were derived by reading, and the `deepStrictEqual` semantics I relied on (Error `cause` compared, Error subclass compared, an own key set to `undefined` distinguished from an absent key) were confirmed with a throwaway `node -e` that touched nothing in the repo.
- I did not review `tests/integration/transaction-lifecycle-cascade.test.ts`, which exercises this area end to end and is outside the sweep's glob. If it contains a case combining a failing-phase undo failure with a reverse undo failure, the BLOCKER on ledger ordering would be partly covered there — but at the wrong tier, and the unit case is still owed.
- Whether ES-4 should ship is an operator decision, not a review finding. I recorded the evidence on both sides and stopped.

## Meta-findings impact

### New cross-cutting evidence

**1. `production: false` in `.fallowrc.json` makes the dead-code gate blind to any production module whose only consumer is its own paired test.** `transaction/rollback.ts` is the proof: 75 lines of production code, two exports, zero production callers, a 174-line test file, and a green `fallow dead-code` run. The repo's memory note "fallow production:false is deliberate" is about FLOW-06 and `includeEntryExports`, and I am not proposing to flip it — the point is that *the pairing rule and the dead-code gate interact badly*. Every module in this repo has a paired test by construction (`scripts/check-corresponding-tests.mjs`, gated in `npm run check`), so **every** production module is reachable from the test graph, and `fallow dead-code` can only ever report module-level death for something with no test — which the pairing gate forbids. The two gates cancel each other out at module granularity.

  **Check every other area for the same shape**, mechanically: for each production module, grep `extensions/` for its exports excluding its own directory. Areas most likely to hold another instance are the ones with helper-shaped leaf modules — `shared/`, `domain/components/`, `orchestrators/*/shared.ts`, and the `bridges/*/` helper files. The cheap durable fix is a `fallow dead-code --production` probe run (or an equivalent script) reported separately from the gate, so a module that only its test keeps alive is visible without changing the gate's semantics.

**2. Doc comments that name a caller are unreliable across the repo, in both directions, and this area has three in one place.** `phase-ledger.ts:143` tells readers that callers call `formatRollbackError`; `rollback.ts:23–26` and `:54–57` tell readers orchestrators destructure `RollbackErrorResult`. All three are false. META-FINDINGS already records the reset-hook comment that falsely claimed production-lifecycle use and the completion-cache comment that honestly admitted none. This is the third and fourth instance and it is the same failure mode: **a comment that asserts a call-graph fact is a claim nobody re-checks when the caller changes.** Suggest a sweep rule for the fixing pass: any comment naming a specific calling function or module gets its claim grepped, and a false one is a finding regardless of area.

**3. A module can hold 100% branch coverage and still lose a whole ordering contract.** `phase-ledger.ts` has both arms of all ten of its branches taken, and the AS-4 prepend-to-index-0 rule at line 167 survives inversion. Likewise, dropping the `await` at `with-state-guard.ts:72` creates no branch and no uncovered line. Both are *value* and *ordering* mutations, invisible to LCOV. Since the sweep's coverage discussion is framed around `test:coverage:direct` numbers, this is worth stating in META-FINDINGS directly: **a green direct-coverage run is not evidence that combinations, orderings, or `await` placement are tested.** Areas that assemble ordered outputs from two sources — `shared/notify.ts`'s line composers, `orchestrators/reconcile/plan.ts`'s bucket partitioning, `bridges/agents/index-mutation.ts` — should be checked for the same shape: is there a case where *both* contributing sources are non-empty at once?

### Corrections to META-FINDINGS.md

**Correction 1 — "Direct per-pair coverage was never measured … Running the direct-coverage gate is a distinct, still-outstanding task."** (Known gaps, last bullet.) Half right, and the accurate version changes the remedy. The tooling exists and it is strict: `scripts/test-coverage-direct.mjs:279–306` (`assertCompleteCoverage`) fails a pair when `hit !== found` for lines, functions **and** branches, with a `type-only` escape for modules that emit no JS. `npm run check` (`package.json:76`) runs `test:corresponding`, `test:corresponding:negative` and `test:coverage:direct:negative` — the pairing gate and the coverage script's own *negative control* — but **not** `test:coverage:direct` or `test:coverage:direct:all`. `.pre-commit-config.yaml` has no coverage hook either (its local hooks are `npm-lint`, `npm-format-check`, `npm-typecheck`, `npm-fallow`).

  So: the reason gaps like `isLockHeldError` survive is a **gating omission, not a missing tool**, and the fix is a one-line change (`npm run test:coverage:direct` on changed pairs as a pre-commit hook, and/or `test:coverage:direct:all` in a CI job) rather than a manual measurement campaign. This also belongs under "Gates that do not gate" as a sixth instance, and it is arguably the highest-leverage one there: it is the only gate that would have found the transaction branch gap automatically. Note the corollary for sequencing — turning it on will go red on every pair that currently has a gap, so it wants its own workstream.

**Correction 2 — "Cross-collaborator order proof via one shared log | `tests/transaction/phase-ledger.test.ts`" (Patterns to propagate).** Confirmed and worth *widening*: `tests/transaction/with-state-guard.test.ts:97–108, 160–164` applies the same pattern to two injected persistence collaborators, and the first-pass reviewer filed that application as a WARNING recommending `t.mock.fn()` instead. Adding the second exemplar to the table would stop a future pass from mistaking the pattern for a hand-rolled double. The reference row should read: `tests/transaction/phase-ledger.test.ts` (order across ledger phases) and `tests/transaction/with-state-guard.test.ts` (order across injected collaborators).

**Correction 3 — the master tally.** `transaction.md` is listed as "1 BLOCKER, 6 WARNING". It is 1 BLOCKER + 6 WARNING as written, so the count stands; this pass adds 3 BLOCKER + 8 WARNING and refutes one of the six warnings and downgrades another, so the area's post-adversarial position is roughly 4 BLOCKER + 12 WARNING. Flagging it because the refreshed audit will want the delta, not the original number.

### Confirmations

- **"Clean verdicts are not reliable"** (Provenance). Independently confirmed and quantified for this area: 3 files were on the clean lists, and attacking them produced 2 of my 3 new BLOCKERs. The strongest single finding — a dead production module with a lying doc comment — was in a file the first pass declared clean in *both* sections (production and test).
- **"Per-area severity is not globally calibrated."** Confirmed from a second angle. The first pass rated this area's missing-injection-port finding a WARNING; `edge-handlers-marketplace.md` rated the structurally similar edge-handler finding a BLOCKER. Having now read both descriptions, I think **both severities are correct** and the difference is real rather than calibration drift: the edge handlers' missing seam forces their tests to assert *another module's* contract, while the state guard's missing port only forces an awkward double for its *own* contract. That distinction — does the missing seam cause an ownership violation, or only an inelegant double? — is a usable calibration rule for the consolidation pass.
- **"The dominant shape: sibling drift."** Confirmed with two fresh instances inside a three-module directory: `with-state-guard.ts:172–179` hand-rolls a private copy of `isErrnoException`, which `shared/errors.ts:15` exists to be the single definition of ("One definition, shared by every errno-dispatching narrower in the codebase instead of each keeping a private copy" — its own doc comment); and `tests/transaction/`'s three files carry sixteen-plus positive `satisfies` proofs and not one `@ts-expect-error` negative, where the sibling `tests/persistence/config-io.test.ts:16–22` pairs each positive with a negative.
