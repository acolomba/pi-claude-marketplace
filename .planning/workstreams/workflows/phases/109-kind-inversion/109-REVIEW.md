---
phase: 109-kind-inversion
reviewed: 2026-09-05T01:24:57Z
depth: standard
iteration: 2
diff_base: 084bb552
head: b4bb4f42
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
  warning: 2
  info: 7
  total: 10
status: issues_found
---

# Phase 109: Code Review Report (iteration 2)

**Reviewed:** 2026-09-05T01:24:57Z
**Depth:** standard
**Files Reviewed:** 24
**Status:** issues_found

## Summary

Six of the seven iteration-1 fixes hold as claimed. One (WR-04) is half-done and
now carries a citation that is false for the block it was added to. CR-01 is
unchanged in code by design, but its documentary mitigation landed only in
carriers that cannot be relied on, so I am keeping it at Critical rather than
closing it.

**What I verified myself, not by reading the fix report:**

- **WR-01 is genuinely non-vacuous.** I re-ran the fixer's mutation independently:
  copied `tests/integration/workflow-kind-inversion.test.ts` to a scratch sibling,
  renamed the fixture's `workflows/` directory to `NOTworkflows/`, ran it, and got
  `fail 1` with `AssertionError: fixture must resolve workflows supported; got:
  skills`. The scratch copy was removed. The precondition reads
  `record.compatibility.supported`, which `PLUGIN_INSTALL_RECORD_SCHEMA`
  (`state-io.ts:110-115`) fills from the resolver's own `supported[]`, so it
  engages the resolver and the persistence path exactly as claimed.
- **WR-06 holds and no sibling survives.** `withHermeticHome` is now
  `(home: string) => Promise<T>` and hands the temp dir down;
  `grep '?? ""'` over the two most-edited test files returns only the doc comment
  that explains why the fallback was removed. No other silent-fallback of that
  shape exists in the touched files.
- **WR-02 holds.** `resolver.ts:1588` now reads
  `HOOK-01 / WINV-01: iterates SUPPORTED_COMPONENT_PATH_KINDS
  (skills/commands/agents/workflows)`, matching the tuple at line 369, and the
  file header at line 28 names `workflows` too.
- **WR-03 holds and is the strongest of the seven.** The new resolver test drives
  a plugin carrying both `workflows/` and a `themes` declaration and asserts
  `partially-available`, `unsupported` deep-equal `["themes"]`, `supported`
  includes `workflows`, and no note mentions workflows. That is the causal claim
  the catalog block makes, now actually enforced.
- **WR-05's pin is accurate.** The non-path `workflows` declaration does resolve
  `unavailable` with the `component path for "workflows" is not a string` note.
- **Gates:** `npx tsc --noEmit` exit 0. ESLint exit 0 and Prettier clean on the
  changed production and test files. `node --test` green on
  `tests/domain/resolver.test.ts`, `catalog-uat`, `hooks-foundation`,
  `compat-01-no-expansion`, `notify-closed-set-locks`, `probe-classifiers`
  (233 pass / 0 fail) and on the integration window test (1 pass / 0 fail).
- **No stale literal survives.** `grep '"workflows"'` over `tests/` outside the
  legitimate `componentPaths` / resolver / classifier sites returns nothing, and
  `grep -i workflow` over `extensions/` returns only
  `plugin.ts:33` plus two unrelated prose uses. The retirement is complete.
- **No persistence-compat hazard from the widened `componentPaths`.**
  `componentPaths` is resolver-only; `PLUGIN_INSTALL_RECORD_SCHEMA` never stores
  it, so adding a REQUIRED `workflows` member cannot fail validation on a
  v0.18.1 `state.json`. `SUPPORTED_COMPONENT_KINDS` has no production consumer at
  all (only `hooks-foundation.test.ts`), so growing it 4→5 changes no runtime
  behavior outside the resolver's own loops.

**On the two judgment calls the fix report asked about, explicitly:**

1. **I agree with skipping the `list.test.ts` pin of `{unsupported component}`.**
   A test asserting today's defective rendering would go red at convergence and
   create a second Phase 111 obligation to discover and invert. More decisively,
   the convergence *mechanism* is already covered generically:
   `tests/orchestrators/reconcile/backfill.test.ts` has
   `BFILL-01: promotes a plugin whose supported set grew into a fully installed
   record` and `BFILL-02: stamps the running version when the recorded stamp is
   older`. Nothing workflow-specific is missing from the test tree; the only
   missing input is the version bump, which no test can force.
2. **Pinning WR-05's consequence without its premise is sound, but the
   disclosure overstates the vacuum.** See WR-02 below — the premise does have an
   in-repo lineage the comment does not cite.

## Critical Issues

### CR-01: The Phase 111 `EXTENSION_VERSION` obligation has no durable carrier

**Files:** `.planning/workstreams/workflows/ROADMAP.md:221-242` (the missing
home), `.planning/workstreams/workflows/phases/109-kind-inversion/109-CONTEXT.md:366-380`,
`.planning/workstreams/workflows/STATE.md:65-79`
**Underlying code:** `extensions/pi-claude-marketplace/shared/probe-classifiers.ts:196-213`
reached from `orchestrators/plugin/list.ts:335`, `info.ts:1147`,
`enable-disable.ts:1195`, `orchestrators/reconcile/notify.ts:574`

**Issue:** The code defect is unchanged and correctly so — A-03 forbids the bump
during the window. What was supposed to close the finding is the *recorded
inverse obligation*, and the two places it landed are both places Phase 111 is
not guaranteed to read.

The content is good. Both entries name the mechanism (`backfill.ts:76` returns
early on version equality; `backfill.ts:343` `supportedSetGrew` is what
re-materializes), the record shape v0.18.1 wrote
(`compatibility: { installable: false, unsupported: ["workflows"] }`), the four
surfaces that read the persisted array, and the user-visible symptom
(`◉ helper (partially-installed) {unsupported component}`). I re-traced the
mechanism and it is accurate: `applyBackfillForScope` returns at the version
equality check (`backfill.ts:76`), and `maybeBackfillPlugin` reaches
`reinstallPlugin` only through `supportedSetGrew(record.compatibility.supported,
resolved.supported)` (`backfill.ts:343`), which a
`supported: ["skills"] → ["skills","workflows"]` record satisfies.

The carriers are the problem:

- `109-CONTEXT.md` §Deferred Ideas is a **phase-109 artifact**. Its own text says
  "Carry this into Phase 111's CONTEXT.md" — an instruction to a future agent,
  not a fact in front of that agent. `.planning/workstreams/workflows/phases/111-workflows-bridge/`
  contains one empty `.gitkeep`; there is nothing there to have received it.
- `STATE.md` §Current Position is **volatile**. It is rewritten at every
  `phase.complete` / `plan-phase` transition; Phase 109's own completion and
  Phase 110's planning both rewrite that section before Phase 111 is discussed.
- `ROADMAP.md` §"Phase 111: Workflows bridge" — the artifact `/gsd-discuss-phase 111`
  actually opens — lists six success criteria and mentions **neither** the bump
  **nor** the pre-existing ENOENT-assertion inversion. The fixer matched the
  weak carrier the assertion-inversion deferral already used; matching a weak
  precedent is what leaves both obligations exposed.

If Phase 111 lands `bridges/workflows/` without the bump, every v0.18.1
`--partial` workflow record stays `(partially-installed) {unsupported component}`
permanently — a token naming a dropped component for a kind Pi materializes —
with no self-heal path, because the gate never reopens.

**Fix:** Put both obligations where the phase that owes them will read them.
One line each in `ROADMAP.md` §Phase 111 Success Criteria:

```markdown
7. `EXTENSION_VERSION` is bumped in the same change. The load-time backfill
   returns early while `state.lastReconciledExtensionVersion === EXTENSION_VERSION`
   (`orchestrators/reconcile/backfill.ts:76`), so the bump is the only thing that
   opens the gate and lets `supportedSetGrew` (`backfill.ts:343`) re-materialize
   the `compatibility: { installable: false, unsupported: ["workflows"] }`
   records released v0.18.1 wrote. Without it those rows render
   `(partially-installed) {unsupported component}` forever.
8. The D-109-06 window assertion in
   `tests/integration/workflow-kind-inversion.test.ts` is INVERTED —
   `assert.rejects(stat(<home>/.pi/workflows), { code: "ENOENT" })` becomes an
   assertion that the envelopes ARE written.
```

Leave the `109-CONTEXT.md` and `STATE.md` copies in place; they are the
rationale, the ROADMAP line is the trigger.

## Warnings

### WR-01: The `workflow-available-inventory` block now cites a guard that does not cover it

**File:** `docs/output-catalog.md:444` (paired with
`tests/architecture/catalog-uat.test.ts:904-930`)

**Issue:** WR-04's fix appended the same sentence to both workflow-agnostic
blocks:

> The workflow-specific half of that claim is enforced by
> `tests/integration/workflow-kind-inversion.test.ts`, not by this block's byte
> pairing.

For `workflow-install-success` (line 580) that is true — the integration test
drives a real `installPlugin` and asserts the `(installed)` row with no brace
and no `--partial`. For `workflow-available-inventory` it is **false**. That
block's claim is about the *not-installed inventory* row (`○`, `(available)`,
no brace); the integration test never calls `list`, never renders an inventory
row, and asserts nothing before the install. No test in the tree exercises the
`(available)` surface for a workflow-bearing plugin — the nearest coverage is
`tests/domain/resolver.test.ts`'s "WINV-01 strict: implicit-by-convention
workflows/ dir -> installable", from which the status deriver *would* yield
`(available)`, but that composition is not asserted anywhere.

This is the same defect class WR-03 was raised for and this fix was meant to
remove: a documentation block asserting an enforcement that does not exist. It
is arguably worse than the unguarded prose it replaced, because the citation
tells a reader to stop looking.

**Fix:** Cite the guard that exists, and say plainly that the surface itself is
unguarded:

```markdown
The resolver half of that claim is enforced by `tests/domain/resolver.test.ts`
("WINV-01 strict: implicit-by-convention workflows/ dir -> installable with
componentPaths.workflows populated"); the inventory rendering itself has no
workflow-specific guard. These bytes are identical to the generic `(available)`
row by construction (D-109-04), and the paired fixture carries no workflow
signal, so `catalog-uat` would stay green if a workflow reason token came back.
```

### WR-02: The path-bearing premise has an in-repo lineage the pin does not cite, and no carrier for the open question

**File:** `tests/domain/resolver.test.ts:1798-1806` (the comment above the
`non-string workflows declaration` test)

**Issue:** Two halves, both about disclosure rather than behavior.

First, the comment tells the reader the premise is bare ("rests entirely on the
premise that upstream's `workflows` field is path-bearing") and names no source,
so the next reader repeats the search I just did. There is a lineage:
`.planning/workstreams/workflows/milestones/workflows-REQUIREMENTS.md:26`
(WFLW-02) states the field as `string | array` with the quoted semantics
"Custom workflow script files or directories, replaces default `workflows/`",
and `101-RESEARCH.md:880` records it as assumption A1 sourced from Spike 021 and
risk-graded **Low**, with the exact consequence this test pins spelled out
("any other shape produces the standard 'not a string' note"). So the harsher
verdict was assumed and risk-assessed before this phase, not invented by it —
which makes the pin *more* defensible than the comment admits. What is still
absent is any upstream citation; both in-repo homes quote a description without
naming where it came from.

Second, the fix report says "Confirming the field shape against Claude Code's
docs remains open for Phase 111" — but unlike CR-01's obligation, that one was
recorded nowhere. `grep 'path-bearing'` over `.planning/workstreams/workflows/`
outside the archived 101 milestone returns nothing; `109-CONTEXT.md` §Deferred
Ideas and `STATE.md` do not mention it. The behavior consequence is real: a
plugin whose `plugin.json` carries an object-shaped `workflows` key went from
`partially-available` (user can `--partial` past it, keeping skills and
commands) to `unavailable` (the whole plugin is refused). That regression is now
locked by a passing test with no open-question carrier.

**Fix:** Cite the lineage in the test comment and give the open question a home.

```ts
// ... the harsher verdict rests on the premise that upstream's `workflows`
// field is path-bearing (`string | array`), inherited from WFLW-02 and
// risk-graded Low as assumption A1 of the archived 101 research. The premise
// has no upstream citation; if it is ever falsified this test moves first.
```

and one bullet in `109-CONTEXT.md` §Deferred Ideas:

> **Phase 111 must confirm the `workflows` manifest field shape against Claude
> Code's plugin documentation** before it reads the field. If the field is not
> `string | array`, the `WINV-01 strict: a non-string workflows declaration
> resolves unavailable` pin in `tests/domain/resolver.test.ts` is the first
> thing to move, and `workflows` has to leave `SUPPORTED_COMPONENT_PATH_KINDS`.

## Info

### IN-01: `plugin.ts` field-group move is still inert and unobservable

**File:** `extensions/pi-claude-marketplace/domain/components/plugin.ts:29-46`

Unchanged from iteration 1 and out of fix scope by design. Both bags spread into
the same `Type.Object({...})`, so the move changes no schema; `hooks` (a
supported kind) still sits in `UNSUPPORTED_COMPONENT_FIELDS:37`, which is the
visible evidence the grouping is narrative only. No code change needed.

### IN-02: The `workflows` schema field still carries no shape comment

**File:** `extensions/pi-claude-marketplace/domain/components/plugin.ts:33`

Unchanged. Given WR-02 above, the shape claim is the one thing a reader most
needs at this line: `// WINV-01: path-bearing (\`string | array\`), same shape
as the three above.`

### IN-03: The integration fixture still seeds `schemaVersion: 1`

**File:** `tests/integration/workflow-kind-inversion.test.ts:116`

Unchanged. Production always writes `2` (`state-io.ts:306`, `:458`) and the
sibling seeder at `tests/orchestrators/plugin/install.test.ts:636` uses `2`, so
the install under test also traverses the 1→2 migration — a second variable in a
test whose subject is the resolver's kind set.

### IN-04: The seeder now mixes static and dynamic imports of the same module

**File:** `tests/integration/workflow-kind-inversion.test.ts:112-114`

Half-fixed as a side effect of WR-01: `loadState` was hoisted to a static import
(line 10), but `saveState` is still pulled in with `await import(...)` from the
same module inside `seedWorkflowPlugin`, and the dead `const state = await
loadState(...)` round-trip on a freshly created `extensionRoot` (it can only
ever spread an empty `marketplaces`) survives. The result is less coherent than
before the fix, not more. Hoist `saveState` beside `loadState` and drop the
round-trip.

### IN-05: The 14th `withHermeticHome` copy has now diverged in signature

**File:** `tests/integration/workflow-kind-inversion.test.ts:50-65`

WR-06 changed this copy to `(home: string) => Promise<T>` while the other 13
copies keep the no-argument form. The drift IN-05 warned about is now realized:
a reader copying either shape gets a different contract, and the hazard WR-06
removed still lives in 13 other files. Still out of scope for this phase; worth
a backlog item to promote the helper into `tests/helpers/`.

### IN-06: The loose-mode test comment claims more than the test asserts

**File:** `tests/domain/resolver.test.ts:3204-3207`

The comment says a `workflows/` directory "yields `installable` with nothing
collected", but the test asserts only the state and the absence of the
`contains workflows` note. The "nothing collected" half — `componentPaths.workflows`
being empty in loose mode — is not asserted. One line closes the gap:
`assert.deepStrictEqual(resolvedPlugin.componentPaths.workflows, [])` inside the
`installable` narrow.

### IN-07: The catalog block cites a test by its exact title string

**File:** `docs/output-catalog.md:636`

`That causal claim is enforced by tests/domain/resolver.test.ts ("WINV-01
strict: workflows/ plus themes -> ...")` pins a doc to a test *title*, which
nothing checks. A rename leaves the doc pointing at a test that no longer
exists, silently — the same "source-walk gates follow code" hazard this repo has
hit before. Citing the file and the `WINV-01` anchor without the full title is
enough.

---

_Reviewed: 2026-09-05T01:24:57Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Iteration: 2 (re-review of `084bb552..b4bb4f42`)_
