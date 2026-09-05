---
phase: 109-kind-inversion
reviewed: 2026-09-05T00:33:53Z
depth: standard
files_reviewed: 24
files_reviewed_list:
  - docs/output-catalog.md
  - extensions/pi-claude-marketplace/domain/components/plugin.ts
  - extensions/pi-claude-marketplace/domain/resolver.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/hooks-foundation.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/bridges/agents/stage.test.ts
  - tests/bridges/commands/discover.test.ts
  - tests/bridges/commands/stage.test.ts
  - tests/bridges/skills/discover.test.ts
  - tests/bridges/skills/stage.test.ts
  - tests/domain/resolver.test.ts
  - tests/integration/workflow-kind-inversion.test.ts
  - tests/orchestrators/plugin/discover-names.test.ts
  - tests/orchestrators/plugin/git-source-probe.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/plugin-state-classifier.test.ts
  - tests/orchestrators/plugin/shared.test.ts
  - tests/shared/notify.test.ts
  - tests/shared/probe-classifiers.test.ts
findings:
  critical: 1
  warning: 6
  info: 5
  total: 12
status: issues_found
---

# Phase 109: Code Review Report

**Reviewed:** 2026-09-05T00:33:53Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

The mechanical half of this change is sound. I independently verified the four
things the phase brief named as the real risk areas and three of them are clean:

- **Closed-set completeness holds.** `_ReasonsCoverageProof` in
  `notify-reasons.ts:264-268` still resolves to `never` on both `Exclude`
  arms — `"workflows"` was removed from `REASONS` *and* from the private
  `UnsupportedReason` group in the same change, so the partition stays total.
  `npm run typecheck` exits 0. A repo-wide grep finds no surviving reference to
  the retired literal in `extensions/`.
- **`componentPaths` was widened as a REQUIRED key everywhere.** Every one of
  the 20 fixture sites and the `discover-names.test.ts:24` parameter type takes
  `workflows: readonly string[]` non-optionally; no site used `?` to silence the
  compiler. `info.ts:652`'s narrower structural parameter type is a pre-existing
  read-side subset, not a widening dodge.
- **Byte-contract coherence holds.** All three `catalog-state` ids exist in both
  homes under the correct H2 section; `catalog-uat` passes 6/6 including the
  inverse orphan walk.

What I did find is a cluster of truthfulness defects the phase's own framing
did not reach: the retirement is correct for *freshly resolved* plugins but
silently degrades the message rendered from **persisted pre-inversion records**,
which are creatable on the already-released v0.18.1. Separately, the
install-level "window pin" — the artifact D-109-07 exists to produce — is
unconditioned on its fixture and would stay green if the workflows kind stopped
being recognized entirely. Its non-vacuity proof lives in a SUMMARY, not in the
repository.

Verified green locally: `npm run typecheck`, ESLint and Prettier on the changed
production files, `tests/integration/workflow-kind-inversion.test.ts`,
`tests/architecture/catalog-uat.test.ts`,
`tests/domain/components/plugin.test.ts`,
`tests/orchestrators/plugin/list.test.ts`.

## Critical Issues

### CR-01: A persisted pre-inversion record now renders a token that names nothing

**File:** `extensions/pi-claude-marketplace/shared/probe-classifiers.ts:203-213`
(reached via `orchestrators/plugin/list.ts:335`,
`orchestrators/plugin/info.ts:1147`,
`orchestrators/plugin/enable-disable.ts:1195`,
`orchestrators/reconcile/notify.ts:574`)

**Issue:** `kindToReason` no longer special-cases `"workflows"`, so it falls
through to `"unsupported component"`. That is correct for *resolver* output —
the resolver can no longer emit the kind — but three surfaces feed
`narrowUnsupportedKinds` from the **persisted** `record.compatibility.unsupported`
array, not from a fresh resolution:

```ts
// list.ts:335
const kinds = narrowUnsupportedKinds(record.compatibility.unsupported);
```

Such a record is not hypothetical. `git tag` shows **v0.18.1 is released**, and
its CHANGELOG entry (`CHANGELOG.md:5`) documents exactly the behavior that
writes it: "Structurally valid plugins that declare `workflows` … now report
`(partially-available) {workflows}` … `--partial` installs only supported
components." Any user who `--partial`-installed a workflow-bearing plugin on
0.18.1 has `compatibility: { installable: false, unsupported: ["workflows"] }`
on disk.

After this change their `list` / `info` row silently changes from
`◉ helper (partially-installed) {workflows}` to
`◉ helper (partially-installed) {unsupported component}` — a token that names a
component kind Pi now *supports*, offering the user no actionable information
and contradicting the project's truthful-attribution rule for the reason set.
`derivePersistedInstalledStatus` (`info.ts:1164`) keeps deriving
`partially-installed` from the same record, so the row is stale in both halves.

The executor was aware of the legacy-record input axis — the renamed unit test
at `tests/shared/probe-classifiers.test.ts:266` is literally titled "a stray
workflows kind in a legacy record falls through to unsupported component" — but
treated it as a classifier-arm detail. Nothing records it as a user-visible
consequence, no test covers the record-driven surfaces, and no `CHANGELOG`
entry or SUMMARY paragraph carries it forward.

The only convergence path is `orchestrators/reconcile/backfill.ts:343`
(`supportedSetGrew` → `reinstallPlugin`), which is gated shut at
`backfill.ts:76` while `EXTENSION_VERSION` stays `0.18.1`. Amendment A-03 is
correct that this keeps the window safe — I confirmed the gate returns early on
version *equality*. But A-03 only records "do not bump during the window." The
**inverse obligation** — that Phase 111 MUST bump `EXTENSION_VERSION` so the
backfill actually converges these records — is written nowhere. If Phase 111
lands the bridge without a bump, every 0.18.1 `--partial` workflow record stays
`partially-installed {unsupported component}` permanently, with workflows
supported and materialized but the row still claiming a dropped component.

**Fix:** Two parts.

1. Carry the obligation into Phase 111's CONTEXT as an explicit deliverable,
   alongside the already-recorded inversion of the ENOENT assertion:

   > Phase 111 MUST bump `EXTENSION_VERSION` in the same change that lands
   > `bridges/workflows/`. The bump is what opens the `backfill.ts:76` gate so
   > `supportedSetGrew` re-materializes v0.18.1 `--partial` workflow records.
   > Without it those records keep rendering
   > `(partially-installed) {unsupported component}` forever.

2. Add a record-driven regression test so the surface is not left unguarded.
   `tests/orchestrators/plugin/list.test.ts` already seeds
   `compatibility.unsupported`; a case seeding `["workflows"]` pins today's
   token and goes red the moment the convergence changes it:

   ```ts
   // WINV-03: a v0.18.1 --partial record still carries the retired kind string.
   // Until the backfill re-materializes it, the row falls through to the
   // generic component token -- pinned so the convergence is observable.
   test("WINV-03: a legacy workflows record renders the generic component token", ...);
   ```

## Warnings

### WR-01: The install-level window pin is unconditioned on its own fixture

**File:** `tests/integration/workflow-kind-inversion.test.ts:156-160`

**Issue:** The D-109-06 half of the test is

```ts
await assert.rejects(stat(path.join(process.env.HOME ?? "", ".pi", "workflows")), {
  code: "ENOENT",
});
```

`HOME` is a fresh `mkdtemp` and the install is **project**-scoped
(`scope: "project"`, writing under `<cwd>/.pi/`), so nothing in the entire test
can ever create `$HOME/.pi/workflows`. The assertion therefore passes for:

- a plugin with no `workflows/` directory at all,
- a resolver that dropped `workflows` from both tuples,
- a resolver that silently ignores `componentPaths.workflows`.

`109-05-SUMMARY.md:103` says the fixture was proved non-vacuous by driving
`resolveStrict` in a **scratch probe**. That probe is not in the repository, so
the property it established is unprotected: the fixture's
`workflows/greet.js` (line 84-88) can be deleted and the whole file still
passes. The deferred Phase 111 obligation ("invert this assertion to assert the
envelopes ARE written") therefore rests on an assertion that currently means
nothing, which is the exact failure mode `109-CONTEXT.md` §Deferred flags: "an
assertion that quietly stays green while meaning the opposite is worse than no
assertion."

Note the path itself is forward-correct — `features/workflows-spike`'s
`platform/workflow-home.ts` resolves the engine root from `os.homedir()`, which
honors the `HOME` override. The defect is the missing positive precondition,
not the path.

**Fix:** Add the positive half the scratch probe checked, so the negative half
is conditioned on the kind actually being engaged. The install record is already
on disk and carries it:

```ts
// The negative assertion below is only meaningful if the kind resolved
// supported in the first place -- pin that, or the ENOENT is a tautology.
const { loadState } = await import(".../persistence/state-io.ts");
const after = await loadState(locationsFor("project", cwd).extensionRoot);
assert.ok(
  after.marketplaces.mp?.plugins["hello"]?.compatibility.supported.includes("workflows"),
  "fixture must engage the inverted kind, else the ENOENT assert is vacuous",
);
```

### WR-02: `resolver.ts:1587` still documents the pre-inversion loop contents

**File:** `extensions/pi-claude-marketplace/domain/resolver.ts:1587`

**Issue:** The doc comment sitting directly above the loop this phase changed
reads:

```
 * HOOK-01: iterates SUPPORTED_COMPONENT_PATH_KINDS (skills/commands/agents),
 * NOT the full SUPPORTED_COMPONENT_KINDS tuple, because `hooks` carries no
 * per-entry component-path semantics.
```

`SUPPORTED_COMPONENT_PATH_KINDS` is now `["skills", "commands", "agents",
"workflows"]` (line 368), so the parenthetical is false. This is the same class
of stale comment the phase was chartered to correct — it fixed both instances in
`notify.ts` (lines 922, 1770) and the tuple headers at `resolver.ts:344-352`,
then missed the one nearest the behavior change. A reader tracing why
`componentPaths.workflows` is populated lands here and concludes it is not.

The adjacent file header at `resolver.ts:28` (`hooks` is admitted alongside
`skills` / `commands` / `agents` / `mcpServers`) is now incomplete for the same
reason, though it is narrating hooks rather than the loop.

**Fix:**

```ts
 * HOOK-01 / WINV-01: iterates SUPPORTED_COMPONENT_PATH_KINDS
 * (skills/commands/agents/workflows), NOT the full SUPPORTED_COMPONENT_KINDS
 * tuple, because `hooks` carries no per-entry component-path semantics.
```

### WR-03: The repointed rejection state documents a contract nothing enforces

**File:** `docs/output-catalog.md:630` (paired with
`tests/architecture/catalog-uat.test.ts:1313-1338`)

**Issue:** The prose now claims a specific causal story:

> The plugin carries a `workflows/` directory AND a second component kind Pi
> does not support (`themes`). The rejection is driven by that second kind, and
> the brace names it alone — **which is what shows the workflow kind
> contributes no token of its own.**

The paired fixture is a renderer-level `notify()` message with hardcoded
`reasons: ["unsupported component"]`. It contains no plugin, no `workflows/`
directory and no `themes` declaration. `catalog-uat` pairs annotation prose to
rendered bytes only, so nothing in the repository establishes that a plugin
carrying *both* kinds emits exactly one token. The claim happens to be true (I
traced it: `workflows` left `UNSUPPORTED_COMPONENT_KINDS` so it never enters
`partial.unsupported`, and `kindToReason("themes")` → `"unsupported component"`)
— but a documentation block asserting an unverified proof is precisely the
stale-contract defect WINV-05 was written to remove from this same file.

**Fix:** Either soften the prose to describe only what the fixture shows, or
back the claim with a resolver test beside the two WINV-01 cases already added
to `tests/domain/resolver.test.ts`:

```ts
// WINV-01: a plugin carrying BOTH workflows/ and themes/ resolves
// partially-available on `themes` ALONE -- the brace-naming proof the
// `workflow-plus-unsupported-rejection` catalog state describes.
test("WINV-01: workflows/ + themes/ -> partially-available, unsupported === ['themes']", ...);
```

### WR-04: Two catalog states are now workflow-agnostic duplicates

**File:** `docs/output-catalog.md:433-442`, `docs/output-catalog.md:567-576`
(paired with `catalog-uat.test.ts:907`, `:1208`)

**Issue:** `workflow-available-inventory` and `workflow-install-success` render
bytes identical to ordinary `(available)` / `(installed)` states, and their
fixtures carry no workflow signal at all — `status: "available"` and
`status: "installed"` with nothing else. D-109-04 explicitly permits duplicate
bytes, so this is not a `catalog-uat` violation. But the surviving prose still
claims a workflow-specific contract ("A workflow-bearing plugin renders as an
ordinary not-installed inventory row"), and no gate ties either block to
workflows. If a future change reintroduced a workflow reason token, both states
would stay green; only `tests/integration/workflow-kind-inversion.test.ts:154`
(`!summary.includes("{workflows}")`) would catch it — the same test flagged in
WR-01.

**Fix:** Keep the blocks (they are the human contract), but move the enforcing
claim to the one place that can carry it. Reword each block to name its real
guard, e.g. append to line 440:

> The workflow-specific claim is enforced by
> `tests/integration/workflow-kind-inversion.test.ts`, not by this block's
> byte pairing — this fixture is byte-identical to the generic `(available)`
> row by construction (D-109-04).

### WR-05: The "path-bearing" premise silently narrows a failure mode, untested

**File:** `extensions/pi-claude-marketplace/domain/components/plugin.ts:33`,
`extensions/pi-claude-marketplace/domain/resolver.ts:368`

**Issue:** Admitting `workflows` to `SUPPORTED_COMPONENT_PATH_KINDS` routes any
declared `workflows` field through `readPathOrArray` →
`validateComponentPath` (`resolver.ts:937-1005`). A declaration that is not a
string or array of strings — e.g. `"workflows": { "greet": {...} }`, an inline
map in the shape `mcpServers` uses — now produces
`component path for "workflows" is not a string (got object)`, sets the
structural `dirty` flag, and resolves the plugin **`unavailable`**. Before this
change the same declaration produced a `contains workflows` note and
`partially-available`, i.e. a plugin the user could still `--partial` install.

That is a strictly harsher verdict on real manifests, and it rests entirely on
the premise that upstream's `workflows` field is path-bearing. The premise is
inherited from `features/workflows-spike` and asserted in the new
`resolver.ts:349-351` comment; `109-RESEARCH.md:716-718` records the spike's
prose but cites no upstream documentation. No test covers a non-path `workflows`
declaration in either direction — `tests/domain/resolver.test.ts` has no
kind-parameterized loop, so the two new WINV-01 cases are the only `workflows`
coverage and both use a well-formed convention directory.

**Fix:** Confirm the field shape against Claude Code's plugin manifest docs
before Phase 111 reads it, and pin whichever answer holds:

```ts
// WINV-01: `workflows` is path-bearing, so a non-path declaration is a
// STRUCTURAL defect (unavailable), not an unsupported-kind degrade.
test("WINV-01: a non-string workflows declaration resolves unavailable", async () => {
  const resolved = await resolveStrict(pluginEntry({ source: "./local", workflows: {} }), ctx);
  assert.strictEqual(resolved.state, "unavailable");
});
```

### WR-06: `?? ""` turns a broken precondition into a cwd-relative probe

**File:** `tests/integration/workflow-kind-inversion.test.ts:158`

**Issue:** `path.join(process.env.HOME ?? "", ".pi", "workflows")` resolves to
the relative path `.pi/workflows` when `HOME` is unset, silently probing the
process working directory instead of failing. The fallback exists only to
satisfy `strictNullChecks`; it cannot be exercised today because
`withHermeticHome` always sets `HOME`, but it makes a future helper regression
(an early `finally` restore, a helper refactor) produce a green tautology
against the wrong path rather than a crash.

The root cause is that `withHermeticHome` (line 43) does not hand the temp home
to its callback, so the test has to re-read the global it just wrote — the same
coupling `features/workflows-spike`'s `platform/workflow-home.ts` header warns
against ("a test relocates storage by calling the setter rather than by mutating
process-global environment state").

**Fix:** Thread the home through the helper and drop the fallback:

```ts
async function withHermeticHome<T>(fn: (home: string) => Promise<T>): Promise<T> {
  const hermeticHome = await mkdtemp(path.join(tmpdir(), "workflow-inversion-home-"));
  // ... unchanged
  return await fn(hermeticHome);
}

// call site
await withHermeticHome(async (home) => {
  // ...
  await assert.rejects(stat(path.join(home, ".pi", "workflows")), { code: "ENOENT" });
});
```

## Info

### IN-01: The `plugin.ts` field-group move is inert and unobservable

**File:** `extensions/pi-claude-marketplace/domain/components/plugin.ts:29-46`

**Issue:** `SUPPORTED_COMPONENT_PATH_FIELDS` and `UNSUPPORTED_COMPONENT_FIELDS`
are both spread into the same `Type.Object({...})` at lines 73-78 and 100-101,
so moving `workflows` between them changes no schema and no behavior — it is
narrative grouping only. That the grouping is already unreliable is visible one
line down: `hooks` (a *supported* component kind since HOOK-01) still sits in
`UNSUPPORTED_COMPONENT_FIELDS:37`. Both consts are module-private, so no test
can observe the move; the `hooks-foundation.test.ts` mirror the phase added
guards `resolver.ts`'s tuples, not these.

**Fix:** No code change needed. Worth an inline note so a later reader does not
mistake the bags for a live contract, and worth considering whether `hooks`
should move too as a separate cleanup.

### IN-02: The spike's `plugin.ts` shape comment was dropped

**File:** `extensions/pi-claude-marketplace/domain/components/plugin.ts:33`

**Issue:** `109-RESEARCH.md:718` recorded the spike's inline comment
(`// WFLW-01: path-bearing (string | array), same shape as the three above.`)
and recommended retagging it to WINV-01 if kept. The bare field was added with
no comment. Given WR-05, the shape claim is the one thing a reader most needs at
this line.

**Fix:** `// WINV-01: path-bearing (\`string | array\`), same shape as the three above.`

### IN-03: The new fixture seeds a legacy `schemaVersion`

**File:** `tests/integration/workflow-kind-inversion.test.ts:109`

**Issue:** `saveState(..., { schemaVersion: 1, ... })` writes the pre-ENBL-02
shape. `state-io.ts:306` and `:458` show production always writes `2`, and the
sibling seeder at `tests/orchestrators/plugin/install.test.ts:636` uses `2`.
The install under test therefore also traverses the 1→2 migration path — an
unintended second variable in a test whose subject is the resolver's kind set.

**Fix:** `schemaVersion: 2`, matching `install.test.ts:636`.

### IN-04: Dynamic `import()` inside the seeder buys nothing

**File:** `tests/integration/workflow-kind-inversion.test.ts:105-106`

**Issue:** `saveState` / `loadState` are pulled in with `await import(...)`
inside `seedWorkflowPlugin` while every other production module in the file is a
top-level import. ESM module caching makes the deferral inert (nothing about
`state-io.ts` is `HOME`-sensitive at load time), and it sidesteps the
`import-x/order` grouping the project enforces on static imports. The preceding
`const state = await loadState(...)` on line 107 is also dead for a freshly
created `extensionRoot` — it only ever spreads an empty `marketplaces`.

**Fix:** Hoist to a static import beside the `locationsFor` import and drop the
`loadState` round-trip.

### IN-05: A 14th private copy of `withHermeticHome`

**File:** `tests/integration/workflow-kind-inversion.test.ts:43-58`

**Issue:** `grep -rn "function withHermeticHome" tests/` now returns 14 hits.
The copy added here is byte-identical to
`tests/orchestrators/plugin/install.test.ts:306` except for the `mkdtemp`
prefix. `fallow dupes` (threshold 3) tolerates the block today, but the drift
risk compounds — WR-06's fix would have to be applied 14 times.

**Fix:** Out of scope for this phase. Worth capturing as a backlog item to
promote the helper into a shared `tests/helpers/` module (the same directory
`CONVENTIONS.md` already describes for `makeMock*` factories, and which does not
yet exist in this tree).

---

_Reviewed: 2026-09-05T00:33:53Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
