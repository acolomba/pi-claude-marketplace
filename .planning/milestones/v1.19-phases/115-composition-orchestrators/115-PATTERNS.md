# Phase 115: Composition Orchestrators - Pattern Map

**Mapped:** 2026-09-01
**Files analyzed:** 8 source-test pairs (7 existing owner tests, 1 new file)
**Analogs found:** 8 / 8

> **Read this first.** The seven existing owner tests under
> `tests/orchestrators/{edge-deps,import/execute,plugin/bootstrap,reconcile/*}.test.ts`
> are **not** the pattern. They are the subject of the rewrite: zero of their 160 cases
> carry the mandated lowercase phase markers, and they lean on 409 `assert.equal` +
> 187 `assert.ok` against 82 whole-value comparisons. Every pattern below is cited from a
> **completed** Phase 113 or Phase 114 owner that passed the contract. Copy those.

---

## File Classification

| Pair | New/Modified test file | Subject shape | Data flow | Closest compliant analog | Match |
|-----:|------------------------|---------------|-----------|--------------------------|-------|
| P115-01 | `tests/orchestrators/edge-deps.test.ts` | wiring module: a factory returning a 4-method read-only resolver | request-response, read-only FS | `tests/orchestrators/plugin/plugin-state-classifier.test.ts` (row table, independent expectation) + `tests/orchestrators/auth-host.test.ts` (multi-entrypoint `describe`) | role-match |
| P115-02 | `tests/orchestrators/import/execute.test.ts` | cascade aggregator over an injected `ImportDeps` bundle | batch / transform, injected collaborators | `tests/orchestrators/marketplace/add.test.ts` (composition orchestrator, notification cardinality) + the rule's own reference case for the `mock<Port>` + `verify` shape | role-match |
| P115-03 | `tests/orchestrators/import/index.test.ts` **(new)** | re-export barrel | none (binding identity) | `tests/bridges/skills/index.test.ts` | **exact** |
| P115-04 | `tests/orchestrators/plugin/bootstrap.test.ts` | real-composition onboarding over an on-disk tree | file-I/O, real composition | `tests/orchestrators/plugin/uninstall.test.ts` (retry proof: two calls, tree inventory, byte pins) | **exact** |
| P115-05 | `tests/orchestrators/reconcile/apply.test.ts` | real-composition cascade, 15 outcome kinds, continuation | file-I/O + batch, real composition | `tests/orchestrators/plugin/uninstall.test.ts` (on-disk ledger) + `tests/orchestrators/marketplace/shared.test.ts:560-592` (ordered data-row matrix) | role-match |
| P115-06 | `tests/orchestrators/reconcile/backfill.test.ts` | version-gated scan + real re-materialize | file-I/O, real composition | `tests/orchestrators/plugin/uninstall.test.ts` (same on-disk regime, smaller) | role-match |
| P115-07 | `tests/orchestrators/reconcile/notify.test.ts` | pure projection of `PerEntryOutcome[]` / `ReconcilePlan[]` | transform, no I/O | `tests/orchestrators/reconcile/plan.test.ts` | **exact** |
| P115-08 | `tests/orchestrators/reconcile/pending.test.ts` | read config + state, delegate the projection, mutate nothing | file-I/O read-only | `tests/orchestrators/plugin/list.test.ts` (no-mutation byte snapshot + whole notification array) | **exact** |

All analog paths above are git-tracked source (`git ls-files` confirms
`tests/orchestrators/plugin/scope-tree-inventory.ts` and every other cited file). No path
here is a gitignored install mirror.

---

## Shared Patterns

These five idioms apply across multiple pairs. Copy them once, per suite.

### S1 — Case-owned temporary scope, torn down through `t.after()`

**Source:** `tests/orchestrators/marketplace/shared.test.ts:188-197` and `:199-227`
**Apply to:** P115-01, P115-04, P115-05, P115-06, P115-08 (every filesystem-backed case)

```ts
async function createProjectScope(
  t: TestContext,
  label: string,
): Promise<{ readonly cwd: string; readonly locations: ScopedLocations }> {
  const cwd = await mkdtemp(path.join(tmpdir(), `marketplace-shared-${label}-`));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const locations = locationsFor("project", cwd);
  await mkdir(locations.extensionRoot, { recursive: true });
  return { cwd, locations };
}
```

The user-scope variant registers the `HOME` restore in the **same** `t.after()`
(`shared.test.ts:208-220`):

```ts
const homeExisted = Object.hasOwn(process.env, "HOME");
const previousHome = process.env.HOME;
t.after(async () => {
  if (homeExisted) { process.env.HOME = previousHome; } else { delete process.env.HOME; }
  await rm(cwd, { recursive: true, force: true });
  await rm(home, { recursive: true, force: true });
});
process.env.HOME = home;
```

This is what the seven suites' `finally`-only `withHermeticHome` wrappers must become. Keep
the existing `delete process.env.PI_CODING_AGENT_DIR` line (SC-1 — `getAgentDir()` reads
that variable **before** `homedir()`, so a CI env that sets it defeats a hermetic `HOME`);
`shared.test.ts` omits it only because its cases never reach `getAgentDir`. The composition
is: `createHermeticScopes`'s `t.after()` shape **plus** the existing agent-dir clear.

### S2 — Notification capture as a whole-value array, with a verified boundary

**Source:** `tests/orchestrators/marketplace/add.test.ts:173-201` (multi-notification counter
form) and `tests/orchestrators/marketplace/shared.test.ts:240-266` (single-expectation form)
**Apply to:** every pair that reaches `notify()` — P115-02, P115-04, P115-05, P115-06, P115-08

```ts
// add.test.ts:173-201
interface NotifyRecord { message: string; severity?: string; }
type NotificationSeverity = Parameters<ExtensionContext["ui"]["notify"]>[1];
type NotificationUi = Omit<ExtensionContext["ui"], "notify"> & {
  readonly notify: (message: string, severity?: NotificationSeverity) => void;
};

function makeCtx(expectedNotifications = 1) {
  const notifications: NotifyRecord[] = [];
  const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
  const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
  const ui = mock<NotificationUi>({ exactParams: true, name: "notification UI" });
  when(() => ctx.ui).thenReturn(ui).times(expectedNotifications);
  when(() => pi.getAllTools()).thenReturn([]).times(expectedNotifications * 2);
  when(() => ui.notify).thenReturn((message, severity) => {
    notifications.push(severity === undefined ? { message } : { message, severity });
    /* verify(ctx); verify(pi); verify(ui); on the last expected call */
  }).times(expectedNotifications);
  return { ctx, pi, notifications };
}
```

Assert the captured array as one whole value, then verify the boundary
(`tests/orchestrators/plugin/list.test.ts:2303-2312`):

```ts
assert.deepStrictEqual(notifications, [
  { message: "● mp1 [user]\n  ◉ plug v1.0.0 (partially-installed) {lsp}" },
]);
verify(ctx);
verify(pi);
verify(ui);
```

`expectedNotifications = 0` is the offline/silence proof: a mock with no stated expectation
throws on the first unpromised call, which is how "zero outcomes → silent" is proved.

### S3 — `createGitOpsFake` at the network edge, with `allowedRemoteUrls` as the fail-fast

**Source:** `tests/orchestrators/marketplace/add.test.ts:104-170`
**Apply to:** P115-01 (currently has **no** fail-fast fake — D-18 gap), P115-02, P115-04,
P115-05, P115-06

```ts
const ALLOWED_MARKETPLACE_REMOTES = [
  "https://github.com/anthropics/claude-plugins-official.git",
] as const;

function makeMockGitOps(initial: GitOpsAdapterOptions = {}) {
  const git = createGitOpsFake({
    boundary: "memory",
    allowedRemoteUrls: ALLOWED_MARKETPLACE_REMOTES,
    ...(initial.fixtureSourceDir === undefined
      ? {}
      : { cloneFixture: { boundary: "local" as const, sourceDir: initial.fixtureSourceDir } }),
  });
  const gitOps: GitOps = {
    ...git.gitOps,
    async clone(options) {
      await git.gitOps.clone(options);
      if (Object.hasOwn(initial, "cloneThrows")) { throw initial.cloneThrows; }
    },
  };
  return { gitOps, state: { get cloneCalls() { return git.state.calls.clone; } } };
}
```

`cloneThrows` is also the provoker for `apply.ts`'s `mp-add-failed` typed arm (P115-05).
An empty `allowedRemoteUrls` list makes any unexpected remote a hard failure — that is the
D-18 offline proof, not the absence of a network call.

### S4 — Independently authored expected value

**Source:** `tests/orchestrators/plugin/plugin-state-classifier.test.ts:95-186` (the row
table) and `:187-201` (the loop that emits one sibling case per row)
**Apply to:** all eight pairs; **mandatory** for the P115-01 bucketizer rewrite

```ts
const installedCases: readonly InstalledCase[] = [
  {
    name: "marks an enabled clean record with a partial newer candidate partially upgradable",
    persisted: () => installedRecord(true, true, []),
    candidate: () => ({ upgradable: true, resolved: partiallyAvailableResolution("partial-candidate") }),
    status: "partially-upgradable",   // <- literal, not a call to the classifier
  },
  // ...
];

describe("classifyInstalledRecord", () => {
  for (const { name, persisted, candidate, status } of installedCases) {
    test(name, () => {
      // arrange
      const persistedRecord = persisted();
      const upgradeCandidate = candidate();
      const expectedStatus = status;

      // act
      const installedStatus = classifyInstalledRecord(persistedRecord, upgradeCandidate);

      // assert
      assert.strictEqual(installedStatus, expectedStatus);
    });
  }
});
```

Two things to copy: the `status` column is a **literal**, and the row factories are
`() =>` thunks so each case gets a fresh value. Note also that this file is the **owner** of
`classifyInstalledRecord` / `classifyManifestEntry`. Under D-20 that is the single oracle
for those functions — which is exactly why `edge-deps.test.ts` may not re-call them to build
its own expectation.

### S5 — Tree inventory as a mutation ledger

**Source:** `tests/orchestrators/plugin/scope-tree-inventory.ts` (whole file, 53 lines);
consumed at `tests/orchestrators/plugin/uninstall.test.ts:35, 2970, 3032-3050`
**Apply to:** P115-04, P115-05, P115-06 (**reuse it**); see the caveat for P115-08

```ts
// uninstall.test.ts:3032-3050 — the complete relative inventory as one literal
assert.deepStrictEqual(await retryTree(locations.scopeRoot), [
  "agents/",
  "claude-plugins.json",
  "mcp.json",
  "pi-claude-marketplace/",
  "pi-claude-marketplace/agents-index.json",
  "pi-claude-marketplace/hooks/",
  "pi-claude-marketplace/resources/",
  "pi-claude-marketplace/resources/prompts/",
  "pi-claude-marketplace/resources/skills/",
  "pi-claude-marketplace/state.json",
]);
assert.equal(await readFile(locations.configJsonPath, "utf8"), configBytes);
assert.deepStrictEqual(JSON.parse(await readFile(locations.mcpJsonPath, "utf8")), { mcpServers: {} });
```

**Should the reconcile and import pairs reuse it? Yes for the three mutation pairs, no for
the read-only pair.**

- `retryTree` is already a concern-local shared module under `tests/orchestrators/plugin/`,
  not a generic `tests/helpers/` dumping ground, so importing it from
  `tests/orchestrators/reconcile/*.test.ts` as `../plugin/scope-tree-inventory.ts` does not
  violate SUITE-02. It answers exactly the question P115-04/05/06 ask: *which paths did this
  orchestrator create or remove under one scope root*. Its `.state-lock` exclusion and its
  module-load-bound `readdir` (lines 11-19) are both load-bearing for the lock-held and
  mocked-`readdir` cases those pairs need. **Reuse it and widen its header comment** from
  "the install, reinstall, and uninstall retry proofs" to name the reconcile and bootstrap
  owners too — do not fork a second copy.
- `retryTree` records **paths only**, so it cannot prove *no bytes changed*. P115-08
  (`pending.ts` mutates nothing) and P115-01 need a byte-level pin. Four file-local
  `snapshotTree` copies already exist for that
  (`tests/orchestrators/plugin/list.test.ts:133-152`, plus `plugin/fetch.test.ts`,
  `marketplace/list.test.ts`, `marketplace/info.test.ts`), each recording
  `{ path, type, bytes: base64 }`. With `fallow dupes` at `threshold: 3` a fifth copy is a
  real gate risk. **Recommendation for P115-08 and P115-01:** use `retryTree` for the path
  inventory and add explicit `readFile` byte equality on the two files that carry the
  contract (`state.json`, `claude-plugins.json`), which is the composition
  `uninstall.test.ts:3032-3050` already uses. Do not create a new shared byte-snapshot
  module.

---

## Pattern Assignments

### P115-01 — `orchestrators/edge-deps.ts` (wiring module, read-only request-response)

**Closest analog:** `tests/orchestrators/plugin/plugin-state-classifier.test.ts`
**Why:** `makeLocationsResolver`'s only interesting contract is a **status bucketization**
over the same `PluginIndexRow["status"]` vocabulary that this file owns. The analog shows
how that vocabulary is proved with an independently authored literal table — which is the
one thing the current `edge-deps.test.ts` gets wrong. `tests/orchestrators/auth-host.test.ts`
is the secondary analog for file **shape**: it is the repository's cleanest small
multi-entrypoint owner (`describe("hostFromCloneUrl")` at `auth-host.test.ts:18`, one
`mock<ExtensionContext>` per case at `:77, :95, :130`). `edge-deps.ts` has one exported
entrypoint, so its cases stay at top level; but the resolver returns four methods, and one
top-level `describe()` per *public operation reached through the export*
(`marketplaceNamesCachePath`, `pluginIndexCachePath`, `loadStateForScope`,
`loadManifestForMarketplace`) is permitted and is the clearer organization.

**Copy:** S1, S3 (this suite has **no** fail-fast git fake today — that is the D-18 gap),
S4, S5-byte-pin variant.

**Idioms to copy — the row table replacing the derived case:**

```ts
// pattern from plugin-state-classifier.test.ts:95-201, retargeted at the resolver
const bucketizerCases: readonly {
  readonly name: string;
  readonly fixture: () => MarketplaceFixture;
  readonly rows: readonly PluginIndexRow[];   // COMPLETE, literal, hand-written
}[] = [ /* ... */ ];

for (const { name, fixture, rows } of bucketizerCases) {
  test(name, async (t) => {
    // arrange
    const { cwd } = await createHermeticProjectScope(t, "bucketizer");
    await layoutFixtureMarketplace(cwd, "parity-mp", fixture());
    const resolver = makeLocationsResolver(cwd);
    const expectedRows = rows;

    // act
    const indexRows = await resolver.loadManifestForMarketplace("project", "parity-mp");

    // assert
    assert.deepStrictEqual(indexRows, expectedRows);
  });
}
```

**Whole-value assertion to copy** (replaces 40 `assert.equal` + 13 `assert.ok`):
`tests/orchestrators/plugin/list.test.ts:2303-2312` — one `deepStrictEqual` on the complete
row array, not `statusByName.get("avail")` probes.

---

### P115-02 — `orchestrators/import/execute.ts` (cascade aggregator, injected collaborators)

**Closest analog:** `tests/orchestrators/marketplace/add.test.ts`
**Why:** it is the completed composition orchestrator whose contract is *what the composed
call reports and commits*, and it is the file the research already identifies as the source
of the canonical `ctx` recipe. It is **not** an exact analog on one axis: no completed owner
in this repository injects a `Deps` bundle (`grep "mock<.*Deps"` over `tests/` returns
nothing). For the collaborator-injection half, the template is the rule's own reference case
(`.claude/rules/typescript-unit-testing.md:60-85`) combined with the `mock<Port>` +
`when()` + `verify()` discipline demonstrated at
`tests/orchestrators/auth-host.test.ts:159-170`. Say so in the plan rather than pretending an
analog exists.

**Copy:** S1, S2, S3 (only for the no-`deps` D-115-04 cases), S4.

**Double-selection rule for the matrix (D-115-08).** Choose per case, not per file:

- The case's promise is only *what the composition reports* → the collaborator is a **stub**
  (a plain typed object checked with `satisfies ImportDeps`). Do not assert its call count.
- The case's promise is *which collaborator ran, with which scope, in which order* → it is a
  **mock**: `mock<ImportDeps["addMarketplace"]>({ exactParams: true, name: "add marketplace" })`,
  every allowed call stated with exact arguments, `verify()` last.
- Ordering across two collaborators needs one shared log, because `strong-mock` does not
  check cross-mock order. The in-repo precedent for an ordered-call assertion is
  `tests/orchestrators/marketplace/shared.test.ts:585-591`:

```ts
assert.deepStrictEqual(calls.map((call) => call.operation), expectedCalls);
```

**Data-row matrix idiom** (for the 46-49 cells), from `shared.test.ts:560-592`:

```ts
} satisfies readonly {
  readonly title: string;
  readonly scenario: GitScenario;
  readonly expectedCalls: readonly GitCall["operation"][];
}[]) {
  test(`refreshGitHubClone stops at ${title}`, async () => {
    // arrange
    // act
    // assert
  });
}
```

The `satisfies readonly {...}[]` tail on the row array is the type-discipline detail to
copy — it makes a missing or misspelled cell a compile error rather than a silent skip.

---

### P115-03 — `orchestrators/import/index.ts` (barrel) — **new file**

**Closest analog:** `tests/bridges/skills/index.test.ts` — **exact**. The repository *does*
prove barrels, and this is the canonical instance.

**Structure to copy verbatim** (`tests/bridges/skills/index.test.ts:87-98`), one top-level
`describe()` per runtime binding:

```ts
describe("abortPreparedSkills", () => {
  test("re-exports the defining binding", () => {
    // arrange
    const expectedAbortPreparedSkills = definingAbortPreparedSkills;

    // act
    const skillsAbortPreparedSkills = abortPreparedSkills;

    // assert
    assert.strictEqual(skillsAbortPreparedSkills, expectedAbortPreparedSkills);
  });
});
```

**Import shape** (`skills/index.test.ts:4-23`): each symbol is imported twice — once through
the barrel, once as `defining<Name>` from its defining module. After the D-115-01 prune the
barrel has exactly one runtime binding, so this file is one `describe` with one case.

**Type re-exports and the closed export set** (`skills/index.test.ts:35-85`) — this is the
part that makes the barrel test more than a tautology, and P115-03 must copy it:

```ts
type Same<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;
type ImportRuntimeExport = keyof typeof import(".../orchestrators/import/index.ts");

void (true satisfies Same<BarrelClaudeImportExecutionResult, DefiningClaudeImportExecutionResult>);
void (true satisfies Same<ImportRuntimeExport, "importClaudeSettings">);

void ({ /* complete literal */ } satisfies BarrelClaudeImportExecutionResult);
// @ts-expect-error an import execution result always carries its diagnostics array
void ({ addedMarketplaces: [] } satisfies BarrelClaudeImportExecutionResult);
// @ts-expect-error the barrel does not re-export the plan builder after the prune
void (true satisfies Same<ImportBarrel.buildClaudeImportPlan, never>);
```

The `Same<ImportRuntimeExport, "importClaudeSettings">` line is what proves the **prune**:
adding a re-export back breaks type-checking. The `@ts-expect-error` negatives on the seven
pruned symbols are the D-115-01 evidence.

**Coverage note:** a re-export-only barrel does produce an LCOV record and passes the direct
gate (`bridges/skills/index.ts` → `branches 1/1, functions 0/0, lines 22/22`).

---

### P115-04 — `orchestrators/plugin/bootstrap.ts` (real composition, on-disk)

**Closest analog:** `tests/orchestrators/plugin/uninstall.test.ts` — **exact** on the axis
that matters. Its "retry proof" cases are the freshest hardened work in the repository
(Phase 114, commit `3331d23d`) and they are structurally identical to what success
criterion 4 asks bootstrap for: **call the orchestrator twice in one case, pin the tree
after each call, and pin the notification log across both.**

**Copy:** S1, S2, S3, S5 (`retryTree` reuse).

**The two-call idiom** (`uninstall.test.ts:2937-3052`, condensed):

```ts
test("...", async (t) => {
  // arrange
  const { cwd, locations } = await createHermeticUserScope(t, "bootstrap-idempotent");
  const { ctx, pi, notifications } = makeCtx(3);
  const { gitOps, state: gitState } = makeMockGitOps({ fixtureSourceDir: fixtureClaudePluginsOfficial() });

  // act
  await bootstrapClaudePlugin({ ctx, pi, cwd, gitOps });
  const firstTree = await retryTree(locations.scopeRoot);
  const stateAfterFirst = await readFile(locations.stateJsonPath, "utf8");
  await bootstrapClaudePlugin({ ctx, pi, cwd, gitOps });

  // assert
  assert.deepStrictEqual(notifications, [
    { message: "● claude-plugins-official [user] (added)" },
    { message: "● claude-plugins-official [user] <autoupdate>" },
    { message: "● claude-plugins-official [user] <autoupdate> {already autoupdate}" },
  ]);
  assert.strictEqual(await readFile(locations.stateJsonPath, "utf8"), stateAfterFirst);
  assert.deepStrictEqual(await retryTree(locations.scopeRoot), firstTree);
  assert.strictEqual(gitState.cloneCalls.length, 2);
});
```

The `firstTree` / `assert.deepStrictEqual(await retryTree(...), firstTree)` pairing is
`uninstall.test.ts:3753` / `:3809` verbatim — that is how "converged, nothing further
changed" is expressed without re-deriving anything from production.

**Do not copy from `uninstall.test.ts`:** its `makeCtx` at `:77-95` uses
`{ ui: { notify } } as ExtensionContext`. That is a Phase-114 residue. Use the S2 recipe.

---

### P115-05 — `orchestrators/reconcile/apply.ts` (real composition, 15 outcome kinds)

**Closest analog:** `tests/orchestrators/plugin/uninstall.test.ts` for the on-disk regime
(S1 + S5 + byte pins), and `tests/orchestrators/marketplace/shared.test.ts:560-592` for the
D-115-07 matrix shape. There is no single owner in the repository that is both a
real-composition cascade *and* an exhaustive outcome matrix — P115-05 is the largest pair in
the phase and legitimately combines two analogs.

**Copy:** S1, S2, S3 (`cloneThrows` provokes `mp-add-failed`), S4, S5.

**Complete-aggregate assertion** — D-115-07 requires every cell to assert the whole result,
not its own row. The idiom is `uninstall.test.ts:2988-3050`: one `deepStrictEqual` per public
surface, all of them, in one `// assert` block —

```ts
// assert
assert.deepStrictEqual(retryOutcomeShape(first), { /* complete outcome */ });
assert.deepStrictEqual(second, { name: "hello", status: "uninstalled", version: "0.0.1" });
assert.deepStrictEqual(notifications, []);
assert.deepStrictEqual(firstRecord?.resources, { /* complete */ });
assert.deepStrictEqual(firstSchedule, [ /* complete ordered log */ ]);
assert.deepStrictEqual(firstTree, [ /* complete inventory */ ]);
assert.equal(await readFile(locations.configJsonPath, "utf8"), configBytes);
```

`firstSchedule` / `secondSchedule` (`uninstall.test.ts:2946-2949`, asserted at `:3012-3030`)
is also the D-115-09 continuation idiom: one shared ordered log, compared as a complete
array, proves *which entries ran after the failing one and in what order*. Build the
three-entry batches (fault in position 1, then position 2) around exactly that log.

**Failure provocation without a seam** (D-115-03 forbids injecting into `apply.ts`): shape
the **inputs on disk** — a malformed `claude-plugins.local.json`, an unparseable
`state.json`, a pre-held `.state-lock`, a marketplace `source` string `parsePluginSource`
rejects, `makeMockGitOps({ cloneThrows })`, an unwritable directory.

---

### P115-06 — `orchestrators/reconcile/backfill.ts` (scan + gated re-materialize)

**Closest analog:** `tests/orchestrators/plugin/uninstall.test.ts` again — same on-disk
regime, same version-stamp/record vocabulary, smaller surface. Six branches short, all
reachable, no production change.

**Copy:** S1, S2, S3, S5.

**Record seed factory to copy** (`uninstall.test.ts:99-113`) — this replaces the nine
`as unknown as` doubles:

```ts
function makePluginRecord(resources: Partial<PluginRecord["resources"]> = {}): PluginRecord {
  return {
    version: "0.0.1",
    resolvedSource: "/tmp",
    compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
    resources: {
      skills: resources.skills ?? [],
      prompts: resources.prompts ?? [],
      agents: resources.agents ?? [],
      mcpServers: resources.mcpServers ?? [],
      hooks: resources.hooks ?? [],
    },
    enabled: true,
    installedAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}
```

A hand-built typed literal with fixed timestamps is the whole answer: no cast, no
`Partial<T>` widening, and the fixed `installedAt` keeps the record byte-comparable.

---

### P115-07 — `orchestrators/reconcile/notify.ts` (pure projection)

**Closest analog:** `tests/orchestrators/reconcile/plan.test.ts` — **exact**. Same directory,
same layer, same regime: a pure function of literal inputs, asserted with one whole-value
`deepStrictEqual`. Its own header states the contract this pair needs
(`plan.test.ts:1-4`): "Every case supplies fresh complete config/state inputs and asserts
the complete public plan."

**Copy:** S4 only. **No filesystem, no git fake, no `ctx`** — `buildReconcileAppliedCascade`
takes a `PerEntryOutcome[]` and returns a message. This is the highest
coverage-per-effort work in the phase.

**Case shape** (`plan.test.ts:96-120`):

```ts
describe("planReconcile", () => {
  test("claims an alternate recorded name after skipping declared and different-source records", () => {
    // arrange
    const merged = mergedConfig({ /* complete */ });
    const state = stateWith({ /* complete */ });

    // act
    const result = planReconcile(merged, state, "project");

    // assert
    assert.deepStrictEqual(result, { /* the COMPLETE plan, literal */ });
  });
});
```

Two deviations in the analog to **not** copy: `plan.test.ts:110` names the value `result`
(the rules forbid `result`; use `plan`, `cascade`, `message`), and it builds `merged` by
calling the real `mergeScopeConfigs` — legal there because `mergeScopeConfigs` is an *input
producer*, not the module under test, but it is a habit that becomes a TEST-01 violation the
moment the produced value is used as the *expectation*.

**Seed-factory shape to copy** (`plan.test.ts:26-93`): `marketplaceRecord()`,
`pluginRecord()`, `stateWith()` — functions returning fresh values, spread-copying their
inputs (`plugins: { ...plugins }`) so no case shares mutable state.

**D-115-05 absorption:** transplant the two cases from
`tests/orchestrators/reconcile/notify-projection-edge.test.ts:20-42` verbatim (they are
already in compliant AAA form — the only file in the phase that is), upgrading `deepEqual`
to `deepStrictEqual`. Absorption and deletion are **one commit**.

---

### P115-08 — `orchestrators/reconcile/pending.ts` (read-only advisory)

**Closest analog:** `tests/orchestrators/plugin/list.test.ts` — **exact**. Same contract
shape: read state and config across scopes, mutate nothing, emit one notification. It is the
repository's canonical **no-mutation proof**.

**Copy:** S1, S2, S5-byte-pin variant.

**The no-mutation idiom** (`list.test.ts:2294-2310`) — snapshot before, act, compare the
whole snapshot after:

```ts
const workspaceBefore = { cwd: await snapshotTree(cwd), home: await snapshotTree(home) };
const { ctx, pi, notifications, ui } = makeCtx();

// act
await listPlugins({ ctx, pi, cwd, scope: "user" });

// assert
assert.deepStrictEqual(notifications, [
  { message: "● mp1 [user]\n  ◉ plug v1.0.0 (partially-installed) {lsp}" },
]);
assert.deepStrictEqual(
  { cwd: await snapshotTree(cwd), home: await snapshotTree(home) },
  workspaceBefore,
);
verify(ctx);
verify(pi);
verify(ui);
```

`snapshotTree` (`list.test.ts:133-152`) records `{ path, type, bytes: base64 }` per entry.
Per S5, **do not add a fifth copy** of it: use `retryTree` for the path inventory plus
explicit `readFile` byte equality on `state.json` and `claude-plugins.json`, which is the
composition already used at `uninstall.test.ts:3032-3050`. That keeps the byte-level promise
without pushing `fallow dupes` past its `threshold: 3`.

**The two stderr `console.warn` lines** the `MIG-01` cases emit are production's sanctioned
IL-3 legacy-migration warning. Decide in the plan whether to assert them or arrange the
fixture away from them. Do not silence `console`.

---

## Anti-Patterns Present in the Current Seven Files

Each must be removed, not translated. The three the research already named are listed first.

| # | Anti-pattern | Location(s) | Why it fails | Replacement |
|--:|--------------|-------------|--------------|-------------|
| A1 | Reads production **source text** and `assert.match`es against comments | `apply.test.ts:1106, 1127, 1131, 1135, 1276, 1300, 1323, 1802` (8 cases); worst is the `S10` case at `:1317` asserting a *comment block* exists above a cast | Tests the wrong module (7 of 8 targets are not `apply.ts`), asserts prose, breaks on any refactor. Violates OWN-02, CASE-02, TEST-01 | Delete. If one encodes a durable architectural rule, re-home it in `tests/architecture/` as a **planting** test per `.planning/codebase/CONVENTIONS.md` |
| A2 | Expected value derived by calling the same production classifiers the module calls | `edge-deps.test.ts:573-635`; its own comment at `:582-585` admits it ("re-derive … by calling the SAME shared classifier") | A wrong classifier passes. TEST-01 | S4's literal row table. The classifier oracle belongs to `plugin-state-classifier.test.ts` (D-20 single oracle) |
| A3 | Case titles carrying `PR #51` and naming implementation shapes | `apply.test.ts:794, 859, 1022, 1095, 1116, 1159, 1169, 1263, 1317, 1401, 1545, 1678, 1730, 1795` (14) | Independently non-compliant with CASE-02 regardless of the PR-reference question — e.g. `"the three non-toggle orchestrated loops in apply.ts adopt the fail-loud … pattern"` names a code shape, not a behavior | Rewrite as public-behavior sentences. Keep the `S6`/`S8`/`Y3` decision anchors in **comments**, and leave production comments alone |
| A4 | **Module-scope, never-restored `process.env` mutation at import time** | `execute.test.ts:15` — `process.env.PI_CODING_AGENT_DIR = mkdtempSync(...)` executed between the node builtins and the production imports | A process global mutated at module load, restored nowhere, with a `mkdtemp` root never removed. Breaks the "restore through the test context" rule, leaks a temp dir per run, and makes the file order-dependent. It also splits the import block, violating `import-x/order` | S1: per-case `t.after()`-registered hermetic scope. The comment at `:10-14` explains *why* the guard exists — that need is real and S1 satisfies it per case |
| A5 | **File-wide ESLint suppression** | `execute.test.ts:1` — `/* eslint-disable @typescript-eslint/require-await */` | Blanket, unexplained, whole-file. Every other suppression in `tests/orchestrators/` is a single `eslint-disable-next-line` with an inline justification (`add.test.ts:674, 1447, 1500, 1563`; `update.test.ts:413`) | Remove it. Async stubs that need no `await` should be `() => Promise.resolve(x)`, or take a narrow justified `-next-line` |
| A6 | **Process-wide `mock` tracker imported from `node:test`** | `pending.test.ts:26` and `backfill.test.ts:26` — `import test, { mock } from "node:test"` | Explicitly forbidden: "Do not import the process-wide Node mock tracker (`mock` from `node:test`); use the context's `t.mock`." State leaks across cases | `t.mock.fn()` / `t.mock.method()` from the case context, or `strong-mock`'s `mock` for interaction mocks (S2) |
| A7 | **Module-scope shared double built with a double assertion** | `backfill.test.ts:56` and `pending.test.ts:41` — `const STUB_PI = { getAllTools: () => [] } as unknown as ExtensionAPI;` | Shared mutable-adjacent module scope plus `as unknown as`, which is the exact cast the type-discipline rule forbids. 34 such sites across the seven files | S2's `mock<ExtensionAPI>({ exactParams: true, name: "extension API" })` created inside each case |
| A8 | **`finally`-only env restore and leaked temp roots** | `edge-deps.test.ts:42-66` (`withHermeticProjectScope` — restores `HOME` in `finally`, and its `cleanup: () => Promise.resolve()` at `:52` never removes either `mkdtemp` root); the same `finally` shape in `execute.test.ts:1184-1204`, `bootstrap.test.ts:119-…`, `pending.test.ts:44-…`. **Zero `t.after()` calls exist in all seven files** | Cleanup must be registered through the test context; a leaked tmp root per case accumulates across the suite | S1 |
| A9 | Piecemeal `assert.equal` / `assert.ok` where the whole value is the promise | 409 + 187 sites across the seven files; representative: `edge-deps.test.ts:560-563` probing `statusByName.get("avail")` one key at a time; `add.test.ts:257-263`'s `assert.ok(recorded)` + `assert.equal(recorded.scope, ...)` shows even a completed owner carries residue — do not treat it as precedent | An existence or single-property assertion passes for the wrong value | One `assert.deepStrictEqual` per public surface (S2, S5, P115-07's shape) |
| A10 | Mid-case narrative comments splitting the AAA phases | `add.test.ts:250, 257, 265` (the completed analog itself), `edge-deps.test.ts:561-562`, `apply.test.ts` throughout | "Do not add other comments to a case unless the setup is not obvious." A comment between `// act` and `// assert` hides which phase a statement belongs to | Move the rationale into the case title or a single comment above `// arrange` |
| A11 | Work-session narrative in a file header | `bootstrap.test.ts:29-32` — "The plan's pre-execution claim that clone is never invoked on the idempotent path was inconsistent with the existing add design; this test follows the actual behavior rather than the pre-execution claim." | SUITE-03: "Source and test files contain no migration notes, relocation history, or work-session comments" | Delete the narrative; keep the durable fact (WR-05 / the github-source clone-before-name-check ordering) as a one-line comment on the case that depends on it |
| A12 | Row loops **inside** a single case | 15 `for (const …)` sites across the seven files | A loop inside one case stops at the first failing row and hides the rest | S4: the `for` loop wraps `test()`, one sibling case per row, with the row interpolated into the title |
| A13 | Placeholder value names | `notify.test.ts` — 41 `const msg` / `const result` sites; `apply.test.ts` — 4 | The rules forbid `result`, `data`, `value`, `subject`, `sut`, bare `actual` | Production-role names: `cascade`, `message`, `plan`, `indexRows` |
| A14 | Cross-owner production import used as an expectation source | `edge-deps.test.ts:20` imports `availableRowMessage` from `orchestrators/plugin/list.ts` and calls it at `:749` | Reaches into another pair's production surface to build evidence; `list.ts` has its own owner (D-20) | Assert `edge-deps`'s own returned rows as literals; leave the list row rendering to `plugin/list.test.ts` |

---

## No Analog Found

None. Every one of the eight pairs has at least a role-match analog among completed Phase
113/114 owners. Two gaps are worth naming explicitly so the planner does not go looking:

| Gap | Status |
|-----|--------|
| A completed owner that injects a `Deps` bundle through `strong-mock` (P115-02) | **Does not exist** — `grep "mock<.*Deps"` over `tests/` returns nothing. Use the rule's reference case (`.claude/rules/typescript-unit-testing.md:60-85`) plus `auth-host.test.ts:159-170`'s `mock`/`when`/`verify` discipline |
| A shared byte-level tree-snapshot module (P115-01, P115-08) | **Does not exist as a shared module** — four file-local `snapshotTree` copies exist. Per S5, do not add a fifth; compose `retryTree` + explicit `readFile` byte pins |

---

## Metadata

**Analog search scope:** `tests/orchestrators/**`, `tests/bridges/**`, `tests/platform/**`,
plus the completed-pair list derived from `git log --grep '^test(11'`.
**Files read this session:** `tests/bridges/skills/index.test.ts`,
`tests/orchestrators/plugin/scope-tree-inventory.ts`,
`tests/orchestrators/plugin/uninstall.test.ts` (header + retry-proof section),
`tests/orchestrators/plugin/plugin-state-classifier.test.ts` (whole file),
`tests/orchestrators/plugin/list.test.ts` (`snapshotTree` + two cases),
`tests/orchestrators/marketplace/add.test.ts` (support block + first cases),
`tests/orchestrators/marketplace/shared.test.ts` (support block + matrix cases),
`tests/orchestrators/reconcile/plan.test.ts` (header + first case),
`tests/orchestrators/auth-host.test.ts` (header + first cases), plus targeted greps over the
seven Phase-115 owner tests for the anti-pattern census.
**Pattern extraction date:** 2026-09-01
