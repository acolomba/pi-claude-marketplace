---
phase: 105-workflow-degradation-and-documentation
reviewed: 2026-08-15T00:00:00Z
depth: standard
files_reviewed: 43
files_reviewed_list:
  - docs/messaging-style-guide.md
  - docs/open-closed-proof.md
  - docs/output-catalog.md
  - docs/workflows-compatibility.md
  - README.md
  - README.es.md
  - extensions/pi-claude-marketplace/platform/pi-api.ts
  - extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts
  - extensions/pi-claude-marketplace/shared/notify-reasons.ts
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/types.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.ts
  - extensions/pi-claude-marketplace/orchestrators/import/execute.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/update.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/uninstall.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update-row.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/update.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/reconcile.messaging.ts
  - tests/architecture/catalog-uat.test.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/no-probe-in-workflows-bridge.test.ts
  - tests/architecture/notify-closed-set-locks.test.ts
  - tests/architecture/notify-stamp-coverage.test.ts
  - tests/live-uat/workflow-storage-canary.mjs
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/plugin/update.test.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/reconcile/notify.test.ts
  - tests/platform/pi-api.test.ts
  - tests/shared/notify-v2.test.ts
  - tests/e2e/import-command.test.ts
  - tests/edge/register.test.ts
findings:
  critical: 1
  warning: 5
  info: 0
  total: 6
status: resolved
---

# Phase 105: Code Review Report

**Reviewed:** 2026-08-15
**Depth:** standard
**Files Reviewed:** 43 (source + tests + docs in the `eb2e53a7..HEAD` range)
**Status:** issues_found

## Summary

The probe, the token spelling, the closed-set locks and the renderer threading are all
correct and well defended. `hasLoadedWorkflowEngine` is exact string identity on
`workflow_control` with no `sourceInfo` arm and a silent bare `catch` (verified against
`tests/platform/pi-api.test.ts`, which includes the load-bearing bare-`workflow` negative and
a no-output assertion). The token is spelled `requires pi-dynamic-workflows` everywhere,
never `requires pi-workflows`. `DEPENDENCIES` gained an order-and-length lock, `REASONS` a
length lock plus the `COMPAT-01` enumeration, and the two new catalog blocks are covered
bidirectionally by `catalog-uat.test.ts`. `npx tsc --noEmit` and `npx eslint` over the
changed tree are both clean. The `@ts-expect-error` vacuity class the phase warned about was
found and replaced with a real type-level `Refuses<T>` conditional.

**The silent-omission class the phase named as its defining hazard did occur, once, and the
gate built to catch it does not reach the producer that regressed.** One of the eight
`Dependency[]`-feeding producers — the reconcile enable projection — never lifts
`stagedWorkflows` off the orchestrated outcome, so a load-time reconcile that re-enables a
workflow-bearing plugin renders a bare `(installed)` row with no host-engine marker while
the standalone `/claude:plugin enable` of the same plugin renders the marker. Every test
covering that surface builds the `PerEntryOutcome` literal by hand and therefore never
executes the production lift.

The documentation is unusually strong. Both READMEs moved together, the divergence table
carries nine rows (a superset of the six-plus-template-literal requirement), the phrase "not
measured" does not appear about the host engine, and the three-way evidence grading of the
`agent()` claim is explicit and honest. The gap is that three of the document's eight
sections make engine-internal claims with no evidence-grade label at all.

## Critical Issues

### CR-01: The reconcile enable projection silently drops `stagedWorkflows`

**File:** `extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:683-693`

**Issue:** `degradationFromEnable` lifts five of the six degradation signals off the
orchestrated enable outcome and drops the sixth:

```ts
function degradationFromEnable(
  result: Extract<EnableDisablePluginOutcome, { status: "enabled" }>,
): EnableDegradationSignals {
  return {
    ...(result.unsupported !== undefined && { unsupported: result.unsupported }),
    ...(result.orphanRewake === true && { orphanRewake: true }),
    ...(result.degradedKinds !== undefined && { degradedKinds: result.degradedKinds }),
    ...(result.stagedAgents === true && { stagedAgents: true }),
    ...(result.stagedMcpServers === true && { stagedMcpServers: true }),
    // stagedWorkflows is never lifted
  };
}
```

The producer side is correct — `enable-disable.ts:325` records
`stagedWorkflows: ledgerCtx.stagedWorkflowNames.length > 0`, and
`freshEnabledProjection` (`enable-disable.ts:980`) spreads it onto the orchestrated
`EnableDisablePluginOutcome`. The consumer side is correct too —
`reconcile/notify.ts:559` calls `enableRowDependencies(outcome)`, which reads
`signals.stagedWorkflows` (`plugin/shared.ts:135`). Only this lift is missing, so the field
arrives `undefined` at the projection and the row's `dependencies` array is
`[]` (or `["agents"]`/`["mcp"]` only).

Consequence: `applyReconcile` emits a real user-facing cascade
(`apply.ts:1399-1400`, `notifyReconcileAppliedWithContext`). A `/reload` that reconciles a
hand-edited config back to `enabled: true` for a workflow-bearing plugin re-materializes the
envelopes and reports `● acme v1.0.0 (installed)` with no
`{requires pi-dynamic-workflows}` marker, while `/claude:plugin enable acme@mp` on the same
plugin reports `● acme v1.0.0 (installed) {requires pi-dynamic-workflows}`. The two surfaces
that were explicitly designed to render the same row (D-98-01, restated in
`reconcile/notify.ts:530-535`) disagree.

`LedgerDegradationSignals.stagedWorkflows` is `?: boolean`, so omitting the spread produces a
structurally valid `EnableDegradationSignals` and compiles clean — the exact
"no compile error when the third arm is omitted" shape the phase called out. `tsc` and
`eslint` are both green over this file.

**Fix:**
```ts
    ...(result.stagedAgents === true && { stagedAgents: true }),
    ...(result.stagedMcpServers === true && { stagedMcpServers: true }),
    // WDEP-04: LAST, matching the `DEPENDENCIES` tail. The staged-workflow
    // verdict drives the projected row's `{requires pi-dynamic-workflows}`
    // marker exactly as its two siblings drive theirs.
    ...(result.stagedWorkflows === true && { stagedWorkflows: true }),
```

Pair the fix with WR-01's test change, or the same omission can recur undetected.

## Warnings

### WR-01: The stamp-coverage gate's reconcile-enable case bypasses the producer it claims to cover

**File:** `tests/architecture/notify-stamp-coverage.test.ts:404-424`, and
`tests/orchestrators/reconcile/notify.test.ts:1265-1334`

**Issue:** The gate's own preamble (lines 304-324) states its purpose: "growing a
`Dependency[]` derivation is NOT compile-forced ... that set was enumerated by searching ...
which is a search and not a proof, so it is pinned HERE instead." The reconcile-enable case
then constructs the `PerEntryOutcome` literal directly:

```ts
      const msg = buildReconcileAppliedCascade([
        {
          kind: "plugin-enabled",
          scope: "user",
          marketplace: "mp",
          plugin: "acme",
          version: "1.0.0",
          stagedWorkflows: true,      // hand-set, never produced by apply.ts
        },
      ]);
```

The comment above it claims "Driving the projection end to end is what proves that call site
passes the outcome along instead of hand-rolling a narrower list." It drives the *projection*
end to end but not the *producer*: `degradationFromEnable` is the only code that ever
populates `stagedWorkflows` on a `PluginEnabledOutcome` in production, and no test executes
it. All four new cases in `tests/orchestrators/reconcile/notify.test.ts` have the same shape.
The result is that CR-01 ships with a green gate that was written specifically to stop it.

Related: the gate asserts `DEP_BEARING_SURFACES.length >= 8` — a lower bound, not an
exhaustiveness proof — so a ninth derivation added later trips nothing.

**Fix:** Either export `degradationFromEnable` under the existing `__test_*` convention and
drive it with a real `Extract<EnableDisablePluginOutcome, { status: "enabled" }>` carrying
`stagedWorkflows: true`, or extend the existing hermetic enable test in
`tests/orchestrators/plugin/enable-disable.test.ts` to run through `applyReconcile`'s enable
bucket and assert the emitted cascade row carries the marker:

```ts
{
  surface: "reconcile (enable projection)",
  declare: () => {
    // Drive the PRODUCER, not a hand-built outcome.
    const lifted = __test_degradationFromEnable({
      status: "enabled",
      name: "acme",
      stagedWorkflows: true,
    });
    return enableRowDependencies(lifted);
  },
},
```

### WR-02: The workflows-bridge probe gate hardcodes its target list

**File:** `tests/architecture/no-probe-in-workflows-bridge.test.ts:50-56`

**Issue:** `FORBIDDEN_TARGETS` is a literal five-entry array naming today's files under
`bridges/workflows/`. The docblock argues the missing-target escape is deliberately not
passed so "renaming or deleting a bridge file cannot quietly uncover this gate" — but the
symmetric hole is open: a *new* file added under `bridges/workflows/` (an `envelope.ts`, a
`key.ts`) is never scanned, and that is the likelier direction for a bridge to grow. The
gate's own stated threat model ("someone reads 'degrade when the engine is absent' as 'skip
staging'") lands most naturally in new code.

**Fix:** Enumerate the directory and assert non-emptiness, keeping the fail-on-missing
semantics for the read:

```ts
const dir = "extensions/pi-claude-marketplace/bridges/workflows";
const FORBIDDEN_TARGETS = (await readdir(dir))
  .filter((f) => f.endsWith(".ts"))
  .map((f) => `${dir}/${f}`);
assert.ok(FORBIDDEN_TARGETS.length >= 5, "the workflows bridge lost files; the gate is now weaker than it was");
```

### WR-03: Fourteen production doc comments still enumerate exactly two soft-dep markers

**Files:**
`shared/notify.ts:677`, `:760`, `:814`, `:942`, `:1775`, `:2490`, `:3415`;
`orchestrators/plugin/install.ts:216`, `:1985`;
`orchestrators/plugin/update.ts:2272`;
`orchestrators/plugin/list.ts:28`;
`orchestrators/plugin/uninstall.ts:41`, `:710`;
`orchestrators/plugin/update-row.ts:94`;
`orchestrators/plugin/reinstall.ts:919`

**Issue:** The third marker was threaded through the code but not through the comments that
describe it. Concretely:

- `notify.ts:760` (`PluginUninstalledMessage`): "the render arms keep **BOTH** soft-dependency
  flags hard-coded `false`" — there are now three flags, and the arm passes three.
- `notify.ts:814` (`PluginDisabledMessage`): "a disabled row cannot emit
  `{requires pi-subagents}` / `{requires pi-mcp}`" — omits the third, which is precisely the
  marker a disabled workflow-bearing record would otherwise leak.
- `notify.ts:942` (`PluginPartiallyInstalledMessage`), `install.ts:1985`,
  `update.ts:2272`, `list.ts:28`, `update-row.ts:94`, `reinstall.ts:919`: all name the marker
  pair as if it were the closed set.

These are not decorative. CONVENTIONS.md makes these blocks the contract-of-record for the
per-variant field discipline, and the phase's own hazard is a reader believing a two-member
set is complete. A comment that says "BOTH" beside code that passes three arguments is the
same failure mode as CR-01, one level up.

**Fix:** Sweep the sites listed. `grep -rn 'requires pi-subagents\` / \`requires pi-mcp\`\|BOTH
soft-dep\|both soft-dependency' extensions/` reproduces the list; append
`/ {requires pi-dynamic-workflows}` and change "BOTH"/"both" to "all three".

### WR-04: `docs/output-catalog.md` disabled-row prose still describes a two-marker closed set

**File:** `docs/output-catalog.md:365`

**Issue:** The `disabled-inventory` narrative reads:

> The soft-dependency markers `{requires pi-subagents}` and `{requires pi-mcp}` cannot appear
> either: the renderer passes both soft-dependency flags as `false` (ENBL-15 / D-100-06).

Line 67 of the same file was updated to the three-marker set; this paragraph was not. The
catalog is the byte-equality user-contract surface and `catalog-uat.test.ts` gates only the
fenced blocks, not the prose, so nothing catches the drift. The behavioural claim is still
true (the disabled arm passes three `false`s), but the enumeration is now wrong, and a reader
checking "can a disabled row leak the host-engine marker?" gets no answer from the document
that is supposed to be authoritative.

**Fix:**
```markdown
The soft-dependency markers `{requires pi-subagents}`, `{requires pi-mcp}` and
`{requires pi-dynamic-workflows}` cannot appear either: the renderer passes all three
soft-dependency flags as `false` (ENBL-15 / D-100-06).
```

### WR-05: Three sections of `docs/workflows-compatibility.md` make engine-internal claims with no evidence grade

**File:** `docs/workflows-compatibility.md:55-76` (Naming), `:78-98` (Storage and discovery),
`:185-195` (Registration and reload)

**Issue:** The document establishes an evidence-grading discipline and applies it rigorously
in four places — line 15 (`measured at runtime`), line 31 (`measured at runtime`), lines
108-110 (per-claim, three different grades), line 118 (`read from the shipped engine source at
3.5.1`). Three sections then make equally load-bearing third-party claims with no label:

- line 72: "the engine's own saved-name rule adds two limits ... at most 128 characters, and
  `name.trim()` must equal `name`" — a source read, unlabelled.
- line 88: the `<key>` derivation, described character-class by character-class — a source
  read, unlabelled (the sentence that follows says only that tests pin *the bridge's* copy).
- line 92: "Its scan walks the canonical project directory, then the deprecated legacy project
  directory, then the user directory, and the first name it sees wins" — a source read,
  unlabelled.
- line 94: "its owner has stopped writing it and keeps only the read" — a source read,
  unlabelled.
- line 187/193: "The engine registers each saved workflow as a command at its own session
  start, by scanning storage" and "Pi exposes no way to unregister a command" — the first is
  runtime-observed by the live canary, the second is an absence claim; neither is graded.

The document's own thesis (line 27) is that these are unexported internals of a 0.x package
that must be re-read on every upgrade. Ungraded claims are exactly the ones a future reader
cannot re-verify efficiently, because they will not know whether the original author ran the
engine or read its `dist/`.

**Fix:** Add a one-line grade under each of the three section headings, matching the existing
form, e.g.

```markdown
## Storage and discovery

**Evidence grade: read from the shipped engine source at 3.5.1**, except the scan-order and
project-key claims, which the live UAT at `tests/live-uat/workflow-storage-canary.mjs` also
measures at runtime.
```

---

_Reviewed: 2026-08-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## Resolution (2026-08-16)

All 6 findings are closed. CR-01 -- the `degradationFromEnable` lift that dropped
`stagedWorkflows` -- was fixed and its fix falsified by mutation during phase verification:
deleting the lift reddens the stamp-coverage gate with a diagnostic naming the surface. WR-01
was the reason CR-01 survived, and the gate now drives the real producer through a `__test_`
seam rather than a hand-built literal.
