# Phase 41: Documentation and Test Closeout - Research

**Researched:** 2026-06-02
**Domain:** Inline ADR-style comments + behavior-asserting regression tests for
two LOW-priority "correctness-OK today" patterns (agents step-1 ENOENT-tolerant
self-heal; D-19-01 probe-failure capture-buffer retirement).
**Confidence:** HIGH

## Summary

Phase 41 is a docs-only + tests-only closeout. Both target sites are already
correct in code (Phase 38 landed TR-01 sequential commit + TR-06 orphan
tolerance with passing tests; Plan 19-03 retired the V1 `PROBE_FAILURES`
capture-buffer + drain entirely). What's missing is: (a) two inline WHY
comments that pin the contract so future "tidy-up" refactors cannot
accidentally revert it, and (b) two behavior-asserting regression tests that
lock the contract from the outside.

The single load-bearing clarification in this research: the CONTEXT.md /
ROADMAP.md phrase "post-state-commit cache-drop swallow in list.ts" is a
**misnomer**. `list.ts` performs **no cache-drop call** (the orchestrator is
strictly read-only -- no `dropMarketplaceCache`, no `invalidate*`, no
`withStateGuard`). The actual D-19-01 swallow site is the `availableRowMessage`
**probe-failure catch** at `list.ts:382-403`, where a thrown
`resolveStrict(...)` is narrowed to a per-row reason and turned into a
`PluginUnavailableMessage` instead of being aggregated into a
module-level `PROBE_FAILURES` buffer + summary `notifyWarning` (the V1 behavior
that D-19-01 retired). The TR-08 test therefore asserts the absence of any
`PROBE_FAILURES`-style module-level state in the post-Phase-19 source.

**Primary recommendation:** Single 1-plan / 3-task phase. Task 1 adds the
inline WHY comment to `commitPreparedAgents` step 1 + appends the TR-07
behavior-asserting test to `tests/bridges/agents/stage.test.ts` (after the
existing TR-01 / TR-06 tests). Task 2 adds the inline WHY comment to the
`availableRowMessage` probe-failure catch in `list.ts` + appends the TR-08
architecture test (source-grep, no module-level `PROBE_FAILURES`-style state)
to the existing source-grep block in `tests/orchestrators/plugin/list.test.ts`
or `tests/architecture/`. Task 3 is the phase-gate verification (`npm run
check` GREEN). No new files; no new dependencies.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Step-1 ENOENT-tolerant pre-removal of OLD agent targets | `bridges/agents/stage.ts::commitPreparedAgents` step 1 (lines 328-348) | -- | The bridge owns the rename atomicity boundary; step 1 (`rm OLD targets`) has no backup source and is intentionally ENOENT-tolerant. Retry-safe by construction: ENOENT on second attempt means "already gone" -- a no-op, not an error. |
| Self-heal contract docs | inline comment at `bridges/agents/stage.ts:328-330` + JSDoc at lines 309-320 | `tests/bridges/agents/stage.test.ts` (TR-07 regression) | Source comment + behavior-asserting test together lock the contract. The test drives commit -> seeded partial-commit state -> re-prepare -> commit and asserts the agent files exist exactly once at the targets (no orphans, no ghost index rows). |
| Probe-failure narrowing at per-row level (no module-level aggregation) | `orchestrators/plugin/list.ts::availableRowMessage` catch (lines 382-403) | `narrowProbeError` helper (lines 305-307) | The catch turns each probe throw into a `PluginUnavailableMessage{reasons:[narrowed]}` row. D-19-01: this REPLACED the V1 `PROBE_FAILURES` module-level capture-buffer + drain summary `notifyWarning`. No module-level state in `list.ts`. |
| Architecture test guarding D-19-01 retirement | `tests/orchestrators/plugin/list.test.ts` (source-grep block at lines 855-895) OR `tests/architecture/` (parallel source-grep) | -- | Source-grep test asserts no top-level identifiers matching `PROBE_FAILURES`-style accumulator patterns. Mirrors the existing `NFR-5 / PL-3: list.ts source has zero imports from platform/git` precedent at `list.test.ts:869`. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

CONTEXT.md states implementation is at Claude's discretion (discuss phase
skipped via `workflow.skip_discuss: true`). The five Specific Ideas in
CONTEXT.md `<specifics>` function as locked success criteria, with one
**clarification** below the table:

1. The `commitPreparedAgents` step-1 `rm` loop carries an inline comment
   explaining ENOENT-tolerant idempotency. Suggested text (matches ROADMAP
   wording): `// pre-rm OLD targets; ENOENT = already gone (retry-safe)`.
2. A behavior-asserting regression test (TR-07) drives
   `prepareStagePluginAgents` + partial-commit-injection + re-prepare + full
   commit and asserts clean final disk state. The test does **NOT** assert
   intermediate function call counts.
3. The post-state-commit cache-drop swallow in `list.ts` carries an inline
   comment referencing D-19-01. **Clarification:** `list.ts` has no cache-drop
   site (read-only orchestrator). The actual D-19-01 swallow is the
   `availableRowMessage` probe-failure catch (lines 382-403); the existing
   line-393 comment already references D-19-01 but does not state the rationale
   ("probe failures during list are diagnostic noise, not actionable errors").
   Phase 41 augments / re-positions the comment to surface this WHY clearly.
4. A regression test (TR-08) asserts no module-level `PROBE_FAILURES`-style
   state accumulation in `list.ts` (source-grep architecture test). The test
   greps `list.ts` for top-level `let|var|const` identifiers matching
   `PROBE_FAILURES`-style accumulator patterns.
5. `npm run check` GREEN; no regression from Phase 40 baseline (1366 tests).

### Claude's Discretion

- Exact inline comment wording (must include "ENOENT = already gone
  (retry-safe)" for SC#1 and reference D-19-01 + a "diagnostic noise" rationale
  for SC#3).
- Test file placement: append to `tests/bridges/agents/stage.test.ts` (TR-07)
  and `tests/orchestrators/plugin/list.test.ts` (TR-08) -- both files already
  carry analogous regression tests, so locality wins over a new test-dir.
  Alternatively, the TR-08 source-grep test may live in `tests/architecture/`
  alongside `no-orchestrator-network.test.ts`.
- TR-07 test naming, fixture choice, and exact partial-commit injection
  mechanism (see Pattern 1 below).

### Deferred Ideas (OUT OF SCOPE)

None per CONTEXT.md. The phase is intentionally narrow.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TR-07 | `commitPreparedAgents` step-1 parallel `rm` loop in `bridges/agents/stage.ts` carries an inline comment explaining the ENOENT-tolerant idempotency contract; one behavior-asserting regression test (not implementation-asserting) drives prepare -> partial-commit-injection -> re-prepare -> commit and asserts clean final disk state. | Step-1 site confirmed at `bridges/agents/stage.ts:328-348`. The current JSDoc at lines 309-320 documents the self-heal property but the inline annotation at step 1 (line 328) only says "rm ONLY safe-to-overwrite previous target files" -- it does NOT explain the ENOENT-tolerance contract or the retry-safe rationale. Test mechanism: append after existing TR-01 / TR-06 tests at `tests/bridges/agents/stage.test.ts:1160-1395`. |
| TR-08 | The post-state-commit cache-drop swallow in `list.ts` carries an inline comment referencing the D-19-01 decision (probe-buffer retirement); one regression test asserts no module-level `PROBE_FAILURES`-style state accumulation in `list.ts`. | Actual swallow site: `availableRowMessage` catch at `list.ts:382-403`. Existing comment at lines 386-396 mentions D-19-01 but threads it into a "compared-to-`narrowResolverNotes`" explanation rather than surfacing the WHY (diagnostic-noise rationale). Architecture test precedent: source-grep tests at `tests/orchestrators/plugin/list.test.ts:855-895`. |

## Project Constraints (from CLAUDE.md)

| Directive | Source | How it constrains this phase |
|-----------|--------|------------------------------|
| Conventional Commits, titles >=5 and <=72 chars, body lines <=80 chars | CLAUDE.md "Git" | Commits land as `docs(bridges):` and `test(orchestrators):` (or similar) -- never `chore:`. The phase splits naturally into 2-3 sub-commits per task: comment + test for each TR-XX. |
| `pre-commit run --all-files` before commit; fix failures, restage, re-run | CLAUDE.md "Git" | Implementation tasks MUST verify hooks pass before commit. Prettier/ESLint apply to new comment text + new test files. |
| `SKIP=trufflehog` prefix only when committing from a worktree | CLAUDE.md "Git" | Not applicable -- branch `features/transaction-resilience-hardening` is a regular checkout. |
| Atomic file ops (NFR-1) | CLAUDE.md "Constraints" | Not directly touched -- this phase changes NO control flow, only adds comments + tests. The existing atomicity guarantees of step 1 (ENOENT-tolerant) and step 2 (TR-01 sequential + rollback, landed Phase 38) are documented, not modified. |
| Output via `ctx.ui.notify` only (IL-2) | CLAUDE.md "Constraints" | Not touched -- tests use `node --test` assertions directly. |
| Containment refusal (NFR-10) | CLAUDE.md "Constraints" | Test fixtures stay under `tests/` tmp directories (existing `withTmpScope` helper). |
| `npm run check` must stay GREEN (NFR-6) | CLAUDE.md "Constraints" | Phase-gate validation; SC#5 enforces this. |
| GSD workflow enforcement | CLAUDE.md "GSD Workflow Enforcement" | Implementation MUST proceed via `/gsd-execute-phase`, not direct edits. |
| `notify()` is the only sanctioned output channel | CLAUDE.md "Constraints" (IL-2) | The TR-08 test cannot assert via stdout/stderr capture; it greps source text via `readFile` (existing precedent at `list.test.ts:870`). |

## Standard Stack

### Core (carry forward unchanged)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:test` | bundled with Node >=20.19.0 | Test framework for TR-07 + TR-08 regression tests | `[VERIFIED: existing tests/bridges/agents/stage.test.ts + tests/orchestrators/plugin/list.test.ts already use it]`. |
| `node:assert/strict` | bundled with Node >=20.19.0 | `assert.equal`, `assert.match`, `assert.rejects` | `[VERIFIED: existing test files use this convention]`. |
| `node:fs/promises` | bundled with Node >=20.19.0 | `readFile` for source-grep tests; `stat`, `writeFile`, `mkdir` for TR-07 fixture setup | `[VERIFIED: existing test imports]`. |

### No new dependencies

The v1.7 milestone-wide verdict in `.planning/research/SUMMARY.md`
("No new dependencies") applies trivially: Phase 41 adds NO control-flow
changes, NO new imports, NO new helpers. Comments + tests only.

## Package Legitimacy Audit

Not applicable -- Phase 41 installs no new packages. All work uses
already-installed Node built-ins (`fs/promises`, `path`, `test`,
`assert/strict`) and existing project modules.

## Architecture Patterns

### System Architecture Diagram

```
                        Phase 41: Docs + Tests Closeout

                  ┌──────────────────────────────────────────────┐
                  │  TR-07: agents step-1 self-heal              │
                  │                                              │
                  │  bridges/agents/stage.ts                     │
                  │    commitPreparedAgents (line 321)           │
                  │      step 1 (line 328-348):                  │
                  │        await Promise.all(_previousEntries    │
                  │          .map(rm + ENOENT swallow))          │
                  │        ──────                                │
                  │        ADD: // pre-rm OLD targets;           │
                  │             // ENOENT = already gone         │
                  │             // (retry-safe)                  │
                  │                                              │
                  │  tests/bridges/agents/stage.test.ts          │
                  │    (append after line 1395)                  │
                  │    TR-07 test: drive                         │
                  │      prepare -> commit -> inject partial     │
                  │      -> re-prepare -> commit                 │
                  │      assert: final disk has all agents at    │
                  │      their final targets exactly once,       │
                  │      no orphan files, index reflects truth   │
                  └──────────────────────────────────────────────┘

                  ┌──────────────────────────────────────────────┐
                  │  TR-08: list.ts probe-failure swallow        │
                  │                                              │
                  │  orchestrators/plugin/list.ts                │
                  │    availableRowMessage catch (line 382-403): │
                  │      try { resolveStrict(...) }              │
                  │      catch (probeErr) {                      │
                  │        return PluginUnavailableMessage       │
                  │          { reasons:[narrowProbeError(err)] } │
                  │      }                                       │
                  │        ──────                                │
                  │        AUGMENT: // best-effort per-row probe │
                  │                 // narrowing; per D-19-01,   │
                  │                 // probe failures during     │
                  │                 // list are diagnostic noise,│
                  │                 // not actionable errors --  │
                  │                 // V1 PROBE_FAILURES capture │
                  │                 // buffer + drain warning    │
                  │                 // retired Plan 19-03.       │
                  │                                              │
                  │  tests/orchestrators/plugin/list.test.ts     │
                  │    (append in source-grep block at line 855) │
                  │    TR-08 architecture test:                  │
                  │      readFile(list.ts) -> stripComments      │
                  │      assert NO module-level identifier       │
                  │      matching PROBE_FAILURES-style           │
                  │      accumulator pattern                     │
                  └──────────────────────────────────────────────┘
```

Key contract preservations:

- **TR-07 inline comment** lives at the step-1 try-block opener (line 328),
  NOT in the function JSDoc (the JSDoc at lines 309-320 already documents
  self-heal at the wrong layer of abstraction -- it explains what happens
  if commit fails mid-flight, not WHY step 1 is ENOENT-tolerant). The new
  comment is co-located with the ENOENT-swallow code so a future reader
  sees the rationale at the same scroll position as the code.

- **TR-08 inline comment** augments / replaces the current lines 386-396
  block at the `catch (probeErr)` site. The current comment threads D-19-01
  into a "compared to the previous narrowResolverNotes shape" explanation;
  the new comment leads with the RATIONALE ("probe failures during list
  are diagnostic noise"), then the D-19-01 reference, then the historical
  comparison. Reader-first ordering.

- **TR-07 test** uses behavior-level assertions only (file existence at
  expected paths, file content matches expected agent bytes, index reflects
  truth). It does NOT assert how many times `rm` was called, NOR does it
  spy on intermediate function calls -- Pitfall 13 in PITFALLS.md (line
  673-691) is the explicit anti-pattern: implementation-asserting tests
  break every refactor.

- **TR-08 test** is a source-grep test (read `list.ts` text, strip comments,
  assert no `PROBE_FAILURES`-style top-level identifier). The existing
  `NFR-5 / PL-3: list.ts source has zero imports from platform/git` test
  at `list.test.ts:869-876` is the verified template.

### Recommended Project Structure

No new files. The phase touches **4 existing files** total:

```
extensions/pi-claude-marketplace/
├── bridges/
│   └── agents/
│       └── stage.ts                  # MODIFIED: inline WHY comment at step-1 (line 328)
└── orchestrators/
    └── plugin/
        └── list.ts                   # MODIFIED: inline WHY comment at probe-catch (line 386)

tests/
├── bridges/
│   └── agents/
│       └── stage.test.ts             # MODIFIED: append TR-07 behavior-asserting test
└── orchestrators/
    └── plugin/
        └── list.test.ts              # MODIFIED: append TR-08 source-grep architecture test
```

### Pattern 1: TR-07 partial-commit injection (test mechanism)

**What:** A behavior-asserting test that drives `prepareStagePluginAgents`,
calls `commitPreparedAgents`, simulates a partial-commit state (delete the
target file but keep the index pointing at the old targetPath), runs a
second prepare + commit cycle, and asserts the final disk state is clean.
This exercises the step-1 ENOENT-tolerance self-heal: the second commit's
step 1 attempts to `rm` the (already-deleted) old target, swallows ENOENT,
and proceeds to step 2 (rename staged -> target). The final state has the
agent file at its target exactly once, the index reflects truth, and no
orphans remain.

**When to use:** Required for TR-07 SC#2.

**The "partial-commit injection"** in CONTEXT.md SC#2 is NOT an existing
test seam -- it's a description of test mechanics. Implementation choices:

| Option | Mechanism | Pros / Cons |
|--------|-----------|-------------|
| A | `prepare + commit; then manually `rm` the target file (leaving the index pointing at it); then re-prepare + commit` | Cleanest. Mimics real partial-commit drift (commit landed file then crashed before index save -- but here we test the opposite drift, which still exercises step-1 ENOENT). |
| B | `prepare + commit; then directly mutate `agents-index.json` to add a ghost row whose `targetPath` does not exist on disk; then re-prepare + commit` | More involved -- requires loading/saving the index manually. Tests the "index lies; disk is truth" direction. |
| C | Pre-seed the agentsDir + agents-index.json with crafted contents (no first commit), then prepare + commit | Skip-the-first-commit shortcut. Loses the "complete cycle" assertion. |

**Recommendation:** Option A. It mirrors the exact retry scenario described
in the function JSDoc at lines 309-320 ("if commit fails after writing
files but before persisting the index, the next unstage's ENOENT tolerance
plus the index pointing at the OLD targetPaths self-heals on retry") --
the test runs the inverse drift (file gone + index points at it) which
likewise exercises step-1's ENOENT swallow.

**Example test shape (sketch, ready for the planner to expand):**

```typescript
// Source: tests/bridges/agents/stage.test.ts, append after line 1395.
test("TR-07 commitPreparedAgents step-1 ENOENT-tolerance enables retry-safe self-heal", async () => {
  await withTmpScope(async ({ locations }) => {
    const pluginRoot = path.join(FIXTURES, "test-plugin");
    const resolved = makeResolved("acme", pluginRoot);

    // Cycle 1: full prepare + commit.
    const prepared1 = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    assert.equal(prepared1.kind, "staged");
    await commitPreparedAgents(prepared1);

    // Simulate a partial-commit drift: the target file is gone, but the
    // index still references its targetPath (e.g., a previous run crashed
    // between file delete and index save). This is the scenario step-1
    // ENOENT-tolerance is designed to self-heal.
    const targetPath = path.join(
      locations.agentsDir,
      "pi-claude-marketplace-acme-bot.md",
    );
    assert.ok(await pathExists(targetPath), "expected commit 1 to land bot.md");
    await rm(targetPath);  // simulate the partial-commit drift

    // Cycle 2: re-prepare + commit. Step 1 will attempt `rm` on the
    // already-gone target; ENOENT swallow lets step 2 proceed.
    const prepared2 = await prepareStagePluginAgents({
      locations,
      marketplaceName: "mp1",
      pluginName: "acme",
      pluginRoot,
      pluginDataDir: path.join(locations.dataRoot, "mp1", "acme"),
      resolved,
      agentsSourceDir: path.join(pluginRoot, "agents"),
    });
    assert.equal(prepared2.kind, "staged");
    await commitPreparedAgents(prepared2);

    // Behavior assertion: final disk state is clean. The agent file is at
    // its target exactly once; no staging leftover; index reflects truth.
    assert.ok(await pathExists(targetPath), "bot.md must exist at target after retry");
    const indexJson = JSON.parse(
      await readFile(locations.agentsIndexPath, "utf8"),
    );
    assert.equal(
      indexJson.agents.filter((a: { generatedName: string }) =>
        a.generatedName === "pi-claude-marketplace-acme-bot",
      ).length,
      1,
      "index has exactly one row for the bot agent",
    );
    assert.equal(
      await pathExists(prepared2.stagingDir),
      false,
      "staging dir cleaned up after retry",
    );
  });
});
```

**Why this is behavior-asserting, not implementation-asserting:**
- Asserts final disk state (`pathExists(targetPath)`).
- Asserts index content (count of rows for the bot agent).
- Asserts staging cleanup.
- Does **NOT** spy on `rm` calls, does **NOT** count function invocations,
  does **NOT** stub any internal function. A future refactor that replaces
  the `Promise.all + ENOENT-swallow` pattern with a different retry-safe
  shape (e.g., sequential ENOENT-tolerant + leak surfacing) leaves this
  test GREEN.

### Pattern 2: TR-08 source-grep architecture test

**What:** A `node:test` test that reads `list.ts` as text, strips comments,
and asserts the absence of a `PROBE_FAILURES`-style module-level accumulator.
Mirrors the existing source-grep tests at `tests/orchestrators/plugin/list.test.ts:869`
(`zero imports from platform/git`) and `:888` (`does not use withStateGuard`).

**When to use:** Required for TR-08 SC#4. The test is "architecture-style"
because it asserts a source-level invariant (no module-level state), not a
runtime behavior.

**Example test shape (sketch, ready for the planner to expand):**

```typescript
// Source: tests/orchestrators/plugin/list.test.ts, append in the source-grep
// block (after line 895, before line 897 "Uncovered-path gap tests").

test("TR-08 / D-19-01: list.ts has no module-level PROBE_FAILURES-style accumulator", async () => {
  const src = await readFile(
    "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts",
    "utf8",
  );
  const code = stripComments(src);

  // D-19-01 retired the V1 PROBE_FAILURES module-level capture-buffer + drain
  // notifyWarning. Probe failures now manifest at row granularity via the
  // per-row `(unavailable) {<narrowed-reason>}` discriminator. This test
  // locks the retirement: no module-level identifier matching the V1
  // accumulator pattern may reappear.

  // Direct identifier match.
  assert.equal(
    code.includes("PROBE_FAILURES"),
    false,
    "list.ts must not contain a PROBE_FAILURES identifier",
  );

  // Generalized accumulator-pattern match: top-level `let|var` declarations
  // (NOT inside a function body). A heuristic: top-level `let foo` or
  // `var foo` outside any indent. const arrays are allowed for
  // SYNTHETIC_LIST_FAILURE_* constants (deliberate module-level constants).
  const topLevelLetVar = code.match(/^(let|var)\s+\w+/gm) ?? [];
  assert.equal(
    topLevelLetVar.length,
    0,
    `list.ts must not have top-level let/var module state, found: ${topLevelLetVar.join(", ")}`,
  );
});
```

**Note on the heuristic:** The test must distinguish (a) the legitimate
module-level `const SYNTHETIC_LIST_FAILURE_MARKETPLACE_NAME = "(list)"` at
line 915 (a deliberate constant, not state accumulation) from (b) a
mutable accumulator pattern. The `let|var` regex captures only mutable
top-level declarations -- consts are allowed. This is a minimal viable
heuristic; if a future contributor adds `const arr = []; arr.push(...)`
the test must catch it. Refine the heuristic only if a false-positive
surfaces in CI.

### Anti-Patterns to Avoid

- **Asserting `rm` call count or sequence in the TR-07 test** -- the test
  goal is the self-heal BEHAVIOR (final disk state is clean after retry),
  not the rm-loop shape. Implementation-asserting tests break every
  refactor (Pitfall 13 in PITFALLS.md).

- **Adding a third "ENOENT swallow rationale" comment elsewhere in
  `commitPreparedAgents`** -- the comment at step 1 (line 328) is the only
  one that needs the inline WHY. The function JSDoc at lines 309-320
  describes the self-heal at the function level; the inline at step 1
  describes the ENOENT-tolerance at the rm-loop level. Two layers, two
  comments. Adding a third dilutes the signal.

- **Renaming or moving `availableRowMessage` to "fix" the swallow** -- the
  swallow is intentional (D-19-01 retirement of the V1 buffer). The Phase
  41 deliverable is comment + test; the code stays. A "while we're in
  there, let me tidy the catch" change is out of scope.

- **Asserting the V1 `notifyWarning` summary path is GONE via runtime
  observation** -- the V1 path was removed in Plan 19-03 (commit history,
  not active code). A runtime test would need to drive the orchestrator
  and assert no `notifyWarning` is emitted, which is fragile (V2 `notify`
  may legitimately emit warnings for other reasons in the same call).
  Source-grep is the correct shape.

- **Replacing the existing comment at `list.ts:386-396` wholesale** --
  the current comment threads D-19-01 into a comparison with the prior
  `narrowResolverNotes`-only behavior. That comparison is useful context.
  The Phase 41 edit AUGMENTS the comment with the RATIONALE
  ("diagnostic noise, not actionable errors") at the top of the block;
  the historical comparison stays.

- **Using a test-only export to expose internal state for TR-08** -- the
  source-grep test asserts the ABSENCE of state. If a future refactor
  legitimately introduces a `const` map at module scope, the test must
  pass; if it introduces a `let` accumulator, the test must fail. No
  test-only export needed; the grep is sufficient.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Source-grep test framework | New `tests/architecture/source-grep.ts` helper | `readFile` + `stripComments` + `String.includes` / regex inline | The existing precedent at `list.test.ts:863-895` is 30 lines, fully self-contained, and reads naturally. Extracting a helper for one new test (TR-08) is premature abstraction. |
| Partial-commit-injection fixture helper | New `tests/_fixtures/partial-commit-injector.ts` | Inline `rm(targetPath)` between two `prepare/commit` cycles in the TR-07 test | The injection IS one line. A helper would hide the test intent. |
| Spy / mock framework | `sinon`, `vitest-mock`, custom test seam | None -- behavior-asserting tests only | TR-07 SC explicitly forbids intermediate function-call assertions (Pitfall 13). Spies/mocks are the wrong tool. |
| Architecture-test runner with metadata | YAML / JSON registry of "what must NOT be in this file" | One `test()` call per architectural invariant | Existing pattern at `list.test.ts:855-895` has one test per invariant. Pattern stays. |

**Key insight:** This phase has zero load-bearing decisions about tooling.
The only choices are (a) test fixture mechanics (Option A in Pattern 1),
(b) comment placement (inline at the swallow site, not in function JSDoc),
and (c) regex shape for the TR-08 grep heuristic. All other surfaces use
existing patterns verbatim.

## Runtime State Inventory

Not applicable. Phase 41 modifies **two comment blocks and adds two test
functions**. No data migration, no identifier rename, no service config
change, no OS-level state change.

- **Stored data:** None affected -- no state.json schema change, no resource
  rename.
- **Live service config:** None.
- **OS-registered state:** None.
- **Secrets/env vars:** None.
- **Build artifacts:** None.

## Common Pitfalls

### Pitfall 1: Implementation-asserting TR-07 test (the documented hazard)

**What goes wrong:** The natural way to "prove" the self-heal works is to
spy on the `rm` calls and assert that step 1 was reached twice (once per
commit cycle) and that ENOENT was thrown on the second call. This is the
exact anti-pattern PITFALLS.md Pitfall 13 (lines 673-691) warns against:
the test breaks every refactor. If a future change replaces `Promise.all`
with `Promise.allSettled` (still ENOENT-tolerant; semantically equivalent),
the call-count assertion fails even though the behavior is unchanged.

**Why it happens:** The "test the self-heal" intuition naturally reaches
for "did the ENOENT path fire?" -- which is implementation, not behavior.

**How to avoid:** Drive the BEHAVIOR (final disk state, final index content,
no orphans). The internal rm-loop shape is irrelevant. Pattern 1 above
shows the correct shape.

**Warning signs:** A test that imports `vi.spyOn`, `mock.method`, or any
function-tracking library. A test that asserts
`assert.equal(rmCalls.length, 2)` or similar. A test that re-implements the
step-1 control flow inline to "verify" it.

### Pitfall 2: TR-08 regex matches legitimate const declarations

**What goes wrong:** A naive grep like `/^(let|var|const)\s+\w+\s*=/` would
flag the legitimate `const SYNTHETIC_LIST_FAILURE_MARKETPLACE_NAME = "(list)"`
at `list.ts:915` as "module-level state" -- a false positive.

**Why it happens:** Top-level `const` is allowed (it's deliberate, immutable,
non-accumulating); only top-level `let` / `var` are the anti-pattern.

**How to avoid:** Grep specifically for `^(let|var)\s+\w+` -- `const` is
omitted. If a contributor introduces `const arr = []` and later mutates
it with `.push`, the test will not catch it (false negative). The
mitigation is the **direct `PROBE_FAILURES` identifier match** -- if anyone
re-introduces the V1 pattern by name, the test catches it.

**Warning signs:** A test failure on a routine cleanup PR that adds a
top-level type alias or import. Inspect the regex -- it likely matched
something legitimate. Tighten to `let|var` only.

### Pitfall 3: Inline comment drifts from the code (stale-comment rot)

**What goes wrong:** The TR-07 comment says "pre-rm OLD targets; ENOENT
= already gone (retry-safe)". If a future refactor changes step 1 to
also remove FOREIGN-content entries (which it currently does NOT --
`_foreignPreservedEntries` is excluded by design per the existing comment
at lines 328-330), the comment becomes a lie. The phase-22 / G-MIL-04
review specifically flagged comment-rot as a recurring failure mode
(see WR-02 mentions in STATE.md history).

**Why it happens:** Comments are not type-checked. Drift accumulates
silently.

**How to avoid:** Two mitigations:
1. Co-locate the comment with the code it describes (inline at line 328,
   NOT at the function JSDoc -- which already exists at lines 309-320 and
   describes a different layer of abstraction).
2. The TR-07 test exercises the BEHAVIOR the comment describes. If the
   behavior changes (e.g., step 1 starts removing foreign entries too),
   the test fails -- forcing the contributor to either revert the
   behavior change or update the comment. The test is the comment's
   honesty guarantor.

**Warning signs:** A PR that changes step-1 behavior (e.g., expands the
target set, changes ENOENT handling) without updating the inline comment.
PR review must flag.

### Pitfall 4: TR-08 false negative on a future refactor that adds module-level state under a non-PROBE_FAILURES name

**What goes wrong:** A contributor adds a new module-level accumulator
under a different name (e.g., `let listFailures: string[] = []`). The
direct `PROBE_FAILURES` match misses it. The regex `let|var` heuristic
catches it -- IF the regex is robust. If the regex is `^(let|var)\s+\w+`
(start-of-line anchored), an indented declaration inside an IIFE is
missed.

**Why it happens:** Source-grep is a heuristic, not a proof. The cost of
a tight regex is false positives; the cost of a loose regex is false
negatives.

**How to avoid:** Use BOTH checks (direct identifier match AND generic
let/var heuristic). Document the heuristic's limitations in a comment
above the test. Accept that this is a defense-in-depth signal, not a
proof.

**Warning signs:** A reviewer asking "what if someone adds `let foo` inside
a function?" -- the answer is "function-scoped state is fine; the test
specifically targets module-level state, which is the anti-pattern". If
the reviewer's example breaks the heuristic, tighten the regex.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (Node >= 20.19.0) + `node:assert/strict` |
| Config file | none -- `npm test` script in `package.json` runs `node --test "tests/**/*.test.ts"` directly via type-stripping |
| Quick run command | `node --test tests/bridges/agents/stage.test.ts tests/orchestrators/plugin/list.test.ts` |
| Full suite command | `npm run check` (typecheck + ESLint + Prettier + tests) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| TR-07 | After prepare-commit-injection-prepare-commit, final disk has agents at targets, index reflects truth, no orphans | regression (behavior) | `node --test tests/bridges/agents/stage.test.ts` | New test appended to existing file |
| TR-08 | `list.ts` source has no `PROBE_FAILURES`-style module-level accumulator | architecture (source-grep) | `node --test tests/orchestrators/plugin/list.test.ts` | New test appended to existing file |
| Phase gate | All existing tests still pass (no regression from Phase 40 baseline 1366 tests) | full suite | `npm run check` | n/a |

### Sampling Rate

- **Per task commit:** `node --test tests/bridges/agents/stage.test.ts` (for TR-07 task) or `node --test tests/orchestrators/plugin/list.test.ts` (for TR-08 task).
- **Per wave merge:** N/A -- single-plan phase; no internal wave structure.
- **Phase gate:** `npm run check` GREEN before `/gsd-verify-work`.

### Wave 0 Gaps

None -- existing test infrastructure covers all phase requirements. Both
target test files exist (`tests/bridges/agents/stage.test.ts` has 1395+
lines with established TR-01 / TR-06 test patterns; `tests/orchestrators/plugin/list.test.ts`
has the source-grep block at lines 855-895 ready for TR-08 to append).

## Security Domain

> `security_enforcement` setting is absent from `.planning/config.json` --
> treating as enabled per default. This phase has **no security surface
> changes**.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a -- no auth code touched |
| V3 Session Management | no | n/a |
| V4 Access Control | no | n/a -- no permission changes |
| V5 Input Validation | no | n/a -- no user input parsed |
| V6 Cryptography | no | n/a |
| V12 Files & Resources | no (defensive only) | The TR-07 test creates temp files under `withTmpScope` (existing safety helper); the TR-08 test reads source via `readFile`. No new path-construction; existing NFR-10 containment unchanged. |

### Known Threat Patterns for Phase 41

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Comment rot misleading future maintainers | Tampering (information integrity) | TR-07 test exercises the behavior the comment describes -- the test catches comment-divergence by failing if behavior changes (Pitfall 3 above). |

No additional security surface -- comments + tests only.

## Code Examples

### Verified pattern: existing source-grep test (the template for TR-08)

```typescript
// Source: tests/orchestrators/plugin/list.test.ts:863-876
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/^\s*\/\/.*$/gm, ""); // line comments
}

test("NFR-5 / PL-3: list.ts source has zero imports from platform/git", async () => {
  const src = await readFile(
    "extensions/pi-claude-marketplace/orchestrators/plugin/list.ts",
    "utf8",
  );
  const code = stripComments(src);
  assert.equal(code.includes("platform/git"), false);
});
```

### Verified pattern: existing TR-06 orphan-tolerance test (the template for TR-07)

```typescript
// Source: tests/bridges/agents/stage.test.ts:1330-1395
// Demonstrates the prepare -> seed-state -> re-prepare -> commit shape
// that TR-07's test mirrors (for a different invariant -- self-heal
// vs. orphan-tolerance).
test("TR-06 replacePreparedAgents tolerates owned orphan file from prior partial install", async () => {
  // A previous partial install left an orphan agent file at the target.
  // Verify the 3-arm policy pre-removes the orphan via removeOrphanIfPresent
  // and the rename then lands; orphan bytes are gone after the replace.
  // ...
});
```

### Required new comment: TR-07 inline at step 1

```typescript
// Source: extensions/pi-claude-marketplace/bridges/agents/stage.ts, line 328 (replaces current 1-liner).
//
// TR-07 / Phase 41: Step 1 is retry-safe by construction. The Promise.all
// rm loop pre-removes OLD plugin-owned targets; ENOENT means "already gone"
// -- the only way ENOENT can fire is if a prior partial commit already
// removed the target before crashing, in which case the second pass is a
// no-op and step 2 proceeds with the new rename. This is the self-heal
// property documented at the function JSDoc (lines 309-320). The loop
// stays parallel here because step 1 has no source to roll back to (those
// files were never backed up -- commitPreparedAgents is the commit path,
// not the replacePreparedAgents backup path); rollback would have nothing
// to restore. _foreignPreservedEntries is INTENTIONALLY excluded -- those
// targets stay untouched on disk and their rows stay in the index.
try {
  await Promise.all(
    prepared._previousEntries.map(async (entry) => {
      // ...
```

### Required new comment: TR-08 augmented inline at probe-failure catch

```typescript
// Source: extensions/pi-claude-marketplace/orchestrators/plugin/list.ts, line 386 (augments current comment).
//
// TR-08 / D-19-01: per-row probe-failure narrowing. Probe failures during
// list are diagnostic noise, NOT actionable user errors -- the user sees
// the cause class on the (unavailable) row's `reasons[]` and decides
// whether to act. The V1 PROBE_FAILURES module-level capture-buffer +
// summary `notifyWarning` was retired by Plan 19-03 (the buffer had no
// other consumer; the summary was redundant with per-row signal).
//
// Historical: the previous implementation routed EVERY throw through
// `narrowResolverNotes`, which only recognises `hooks` and `lspServers`
// and silently degraded everything else to `{unsupported source}`. That
// hid EACCES, JSON parse failures, and programming bugs behind a
// misleading reason. The current shape: route resolver notes through
// `narrowResolverNotes` (the path that produces them is `resolveStrict`
// returning NotInstallable with structured notes -- already handled
// above on the `installable === false` branch), and route thrown probe
// failures through `narrowProbeError` so the row reports the actual
// cause class.
//
// TR-08 architecture test at tests/orchestrators/plugin/list.test.ts
// asserts no module-level `PROBE_FAILURES`-style state may reappear.
const reason = narrowProbeError(probeErr);
return {
  status: "unavailable",
  // ...
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| V1 `PROBE_FAILURES` module-level capture-buffer + drain `notifyWarning` summary | Per-row `PluginUnavailableMessage{reasons:[narrowed]}` carrying the cause class at row granularity | Plan 19-03 (D-19-01 / 2026-05-27) | The redundant summary notification is gone; the user reads the cause class directly on the `(unavailable) {<reason>}` row. Phase 41 locks the retirement via source-grep test. |
| V1 implementation-asserting tests (call counts, spy assertions) | Behavior-asserting tests (final state, no orphans, index reflects truth) | Phase 19 (Plan 19-03) onwards; established pattern in Phase 38 TR-01 / TR-06 tests | Refactor-resilient tests; tests survive idiomatic shape changes. |

**Deprecated/outdated:** None applicable -- this phase is purely additive
(comments + tests).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| -- | (no assumed claims) | -- | -- |

All claims in this research are verified against:
- Project source (`extensions/pi-claude-marketplace/bridges/agents/stage.ts`,
  `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`).
- Test source (`tests/bridges/agents/stage.test.ts`,
  `tests/orchestrators/plugin/list.test.ts`).
- Planning history (`.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`,
  `.planning/research/SUMMARY.md`, `.planning/research/PITFALLS.md`,
  `.planning/phases/38-sequential-commit-loops-orphan-tolerance/38-RESEARCH.md`,
  `.planning/milestones/v1.4-phases/19-migration-wave-2-plugin-orchestrator-family/19-03-SUMMARY.md`).

**If this table is empty:** All claims in this research were verified or
cited -- no user confirmation needed.

## Open Questions

1. **Q1: Should the TR-08 source-grep test live in
   `tests/orchestrators/plugin/list.test.ts` or `tests/architecture/`?**
   - What we know: Both directories carry source-grep tests. The
     `list.test.ts` source-grep block at lines 855-895 is the obvious
     locality choice (a future contributor of list logic reads the
     constraint in the same file). The `tests/architecture/` directory
     hosts cross-cutting architectural tests
     (`no-orchestrator-network.test.ts`, `import-boundaries.test.ts`).
   - What's unclear: Whether the TR-08 invariant is list-specific (locality
     wins) or part of a broader "no module-level state in orchestrators"
     pattern (architecture-dir wins).
   - Recommendation: Place in `tests/orchestrators/plugin/list.test.ts`
     in the existing source-grep block. The invariant is list-specific
     (the V1 buffer lived only in `list.ts`); other orchestrators have
     their own state patterns. Locality > centralization for a single
     test.

2. **Q2: Should the TR-07 test name reference TR-07, Phase 41, or the
   behavior?**
   - What we know: Existing tests use mixed conventions ("TR-01 commitPreparedAgents
     sequential commit rolls back...", "AG-1 commitPreparedAgents lands files...",
     "Phase 8 / PRL-10 readOptionalText..."). The phase+requirement+behavior
     triple-tag is the precedent at `stage.test.ts:923`.
   - What's unclear: Whether to call this "TR-07" or "TR-07 / Phase 41"
     or "TR-07 step-1 self-heal".
   - Recommendation: Use `"TR-07 commitPreparedAgents step-1 ENOENT-tolerance
     enables retry-safe self-heal"` -- requirement ID + function + behavior.
     Mirrors the TR-01 / TR-06 test names in the same file.

3. **Q3: Should the existing comment at `list.ts:386-396` be augmented
   in place or replaced?**
   - What we know: The current comment threads D-19-01 into a comparison
     with the previous `narrowResolverNotes`-only behavior. That historical
     context is useful.
   - What's unclear: Whether augmenting (prepend the rationale, keep the
     comparison) or replacing (the rationale is the load-bearing piece;
     the comparison is review-history noise) is the better shape.
   - Recommendation: Augment. Lead with the rationale ("probe failures
     during list are diagnostic noise, not actionable errors") for
     reader-first ordering; keep the historical comparison for
     completeness. See the "Required new comment: TR-08" example above.

## Open Questions (RESOLVED)

1. **Q1: Should the TR-08 source-grep test live in
   `tests/orchestrators/plugin/list.test.ts` or `tests/architecture/`?**
   RESOLVED: ADOPTED -- place in `tests/orchestrators/plugin/list.test.ts`
   in the existing source-grep block (lines 855-895). Rationale: the
   invariant is list-specific (the V1 buffer lived only in `list.ts`;
   other orchestrators have their own state patterns); locality lets a
   future list.ts contributor see the constraint at the same file they
   are editing. The existing `NFR-5 / PL-3` and `D-04 corollary` tests
   in that block are the established precedent.

2. **Q2: TR-07 test naming convention.**
   RESOLVED: ADOPTED -- `"TR-07 commitPreparedAgents step-1
   ENOENT-tolerance enables retry-safe self-heal"`. Rationale: matches
   the TR-01 / TR-06 test-name shape in the same file (`TR-01
   commitPreparedAgents sequential commit rolls back...`, `TR-06
   replacePreparedAgents tolerates owned orphan...`). Requirement ID
   + function + behavior -- discoverable via grep on the requirement ID.

3. **Q3: Augment-in-place vs. replace at `list.ts:386-396`.**
   RESOLVED: ADOPTED augment-in-place. Rationale: the historical
   comparison ("previous implementation routed EVERY throw through
   `narrowResolverNotes`...") is useful context for future maintainers
   who encounter the catch block and ask "why this shape?". The Phase 41
   delta is to PREPEND the rationale ("probe failures during list are
   diagnostic noise, not actionable errors") so reader-first ordering
   leads with the WHY, then the historical comparison. The comment grows
   by ~3-4 lines; no information lost.

## Sources

### Primary (HIGH confidence)

- Project source: `extensions/pi-claude-marketplace/bridges/agents/stage.ts`
  (read lines 1-60 + 300-499; identified TR-07 fix site at lines 328-348
  step-1 rm loop; current JSDoc at lines 309-320 documents self-heal at
  function level).
- Project source: `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`
  (read full file; identified TR-08 fix site at `availableRowMessage` catch
  lines 382-403; confirmed NO cache-drop call anywhere in the orchestrator
  -- `list.ts` is read-only by NFR-5 / PL-3 design).
- Test source: `tests/bridges/agents/stage.test.ts` (grepped for TR-01 /
  TR-06 / partial-commit patterns; identified the established
  prepare-commit-seed-state-re-prepare-commit shape at lines 1160-1395 as
  the template for TR-07).
- Test source: `tests/orchestrators/plugin/list.test.ts` (read source-grep
  block at lines 855-895; confirmed the
  `readFile + stripComments + assert.equal(includes(...), false)` pattern
  as the TR-08 template).
- Planning source: `.planning/REQUIREMENTS.md` (TR-07 / TR-08 verbatim).
- Planning source: `.planning/ROADMAP.md` (Phase 41 SC #1-#5 verbatim).
- Planning source: `.planning/research/PITFALLS.md` (Pitfall 13 / Pitfall 14
  enumerate the implementation-vs-behavior testing anti-pattern + the
  WHY-in-source rationale anti-pattern).
- Planning source: `.planning/research/SUMMARY.md` (lines 207-216 confirm
  this phase is docs+tests only, no research needed).
- Planning source:
  `.planning/milestones/v1.4-phases/19-migration-wave-2-plugin-orchestrator-family/19-03-SUMMARY.md`
  (verified D-19-01's exact retirement scope: `PROBE_FAILURES` module-level
  capture-buffer + every push site + drain block REMOVED in Plan 19-03).
- Planning source:
  `.planning/phases/38-sequential-commit-loops-orphan-tolerance/38-RESEARCH.md`
  (TR-01 / TR-06 context for Phase 38; confirmed step-1 stays
  ENOENT-tolerant parallel even after TR-01 made step-2 sequential).

### Secondary (MEDIUM confidence)

- CLAUDE.md project instructions (Conventional Commits, pre-commit hooks,
  GSD workflow enforcement).
- `.planning/STATE.md` (Phase 40 complete; Phase 41 next; baseline test
  count ~1366 tests).
- `.planning/config.json` (`workflow.skip_discuss: true` -- explains why
  CONTEXT.md is auto-generated; `nyquist_validation: true` -- explains why
  the Validation Architecture section is required).

### Tertiary (LOW confidence)

None -- all claims in this research are anchored to the primary sources
above. No web searches or external library docs were needed for this
docs+tests phase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools already in use; node:test + assert
  already in the existing TR-01 / TR-06 tests in the target test files.
- Architecture: HIGH -- the TR-07 test pattern mirrors TR-01 / TR-06 in
  the same file; the TR-08 test pattern mirrors the source-grep block
  at lines 855-895 in the same file.
- Pitfalls: HIGH -- PITFALLS.md Pitfall 13 / Pitfall 14 explicitly target
  this phase; no new pitfalls discovered.
- Comment placement: HIGH -- existing comment landmarks (line 328 inline
  step-1 marker, lines 386-396 catch-block block-comment) tell the editor
  exactly where to add / augment.

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 (30 days for stable, docs+tests-only phase)

## RESEARCH COMPLETE

**Phase:** 41 - Documentation and Test Closeout
**Confidence:** HIGH

### Key Findings

- The "post-state-commit cache-drop swallow in `list.ts`" phrase in CONTEXT.md
  / ROADMAP.md is a **misnomer**. `list.ts` has no cache-drop call (read-only
  orchestrator by NFR-5 / PL-3 design). The actual D-19-01 swallow is the
  probe-failure catch in `availableRowMessage` at lines 382-403. Planner
  must surface this clarification so the comment lands at the correct site.
- Phase 41 touches **4 existing files** with **2 inline comments + 2 test
  functions**. No new files, no new dependencies, no control-flow changes.
- TR-07 test mechanics: Option A (`prepare + commit; rm target file; re-prepare
  + commit; assert clean final state`). Mirrors the existing TR-06 test shape
  at `stage.test.ts:1330-1395`.
- TR-08 test mechanics: source-grep on `list.ts` text for direct
  `PROBE_FAILURES` identifier + heuristic `^(let|var)\s+\w+` for top-level
  mutable state. Mirrors the existing source-grep block at `list.test.ts:855-895`.
- Both target comments augment existing inline comments rather than
  replacing them -- the TR-07 step-1 1-liner gets a multi-line rationale;
  the TR-08 catch-block block-comment gets a rationale prepended.

### File Created

`.planning/phases/41-documentation-and-test-closeout/41-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | No new tooling; existing node:test + assert/strict patterns in the same files. |
| Architecture | HIGH | Both test patterns have established precedents in the same target test files (TR-01/TR-06 for TR-07; lines 855-895 for TR-08). |
| Pitfalls | HIGH | PITFALLS.md Pitfall 13 / Pitfall 14 are this phase's explicit pitfall list. |

### Open Questions

None outstanding. All three open questions resolved in the
`## Open Questions (RESOLVED)` section above (Q1 -> list.test.ts locality,
Q2 -> TR-XX requirement-ID test naming, Q3 -> augment-in-place at
`list.ts:386-396`).

### Ready for Planning

Research complete. Planner can now create a single PLAN.md
(`41-01-PLAN.md`) with the following expected shape:

- **Task 1 (TR-07):** Add inline WHY comment at
  `bridges/agents/stage.ts:328` + append behavior-asserting regression
  test at `tests/bridges/agents/stage.test.ts` (after the existing TR-06
  test at line 1395).
- **Task 2 (TR-08):** Augment inline comment at
  `orchestrators/plugin/list.ts:386-396` to lead with the rationale +
  append architecture source-grep test at
  `tests/orchestrators/plugin/list.test.ts` (in the existing source-grep
  block at lines 855-895).
- **Task 3 (phase gate):** Run `npm run check` and confirm GREEN with no
  regression from Phase 40 baseline.
