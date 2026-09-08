---
phase: 114-degradation-and-documentation
plan: 04
subsystem: docs
tags: [byte-gate, catalog, soft-dep, workflows, closed-set, rename]
status: complete

requires:
  - "shared/notify.ts::REASONS[45] = \"requires pi-dynamic-workflows\""
  - "shared/concerns/soft-dep.ts::Dependency member \"workflows\""
  - "platform/pi-api.ts::SoftDepStatus.workflowEngineLoaded"
provides:
  - "docs/output-catalog.md::success-with-workflow-engine-absent"
  - "docs/output-catalog.md::success-with-agents-and-workflows-soft-dep"
  - "tests/architecture/catalog-uat.test.ts::piWithAllLoaded"
  - "tests/architecture/catalog-uat.test.ts::piWithoutWorkflowEngine"
  - "tests/architecture/catalog-uat.test.ts::the 194 exact-count assertion"
affects:
  - "docs/workflows-compatibility.md (plan 05 cites the marker spelling this plan publishes)"

tech-stack:
  added: []
  patterns:
    - "additive catalog amendment under a bidirectional byte gate"
    - "rendered bytes as the order authority for a closed set with no runtime tuple"

key-files:
  created: []
  modified:
    - docs/output-catalog.md
    - docs/messaging-style-guide.md
    - tests/architecture/catalog-uat.test.ts
    - tests/shared/notify.test.ts
    - tests/architecture/notify-grammar-invariant.test.ts
    - tests/architecture/notify-will-reload-agreement.test.ts

decisions:
  - "`piWithBothLoaded` had FOUR independent definitions, not the two D-114-04 recorded. All four carried the same false name and comment and all four were renamed."
  - "`piWithoutWorkflowEngine` ships in Task 2's commit, not Task 1's: `noUnusedLocals` refuses a helper whose consumer has not landed yet (TS6133 measured, not assumed)."
  - "The ES-5 supersession table was deliberately NOT extended. It records which v1 strings were replaced; no such string ever existed for the host engine, and the section closes by scoping itself to five markers."
  - "The `PluginNotificationMessage` variant enumeration in the style guide is separately stale (16 vs 19, lists a retired `present`, omits both partial-state tokens). Logged to `deferred-items.md`, not fixed -- it is a different defect from the soft-dependency prose sweep."

metrics:
  duration: "~50m"
  completed: 2026-09-08

actuals:
  tokens: 9490
  tasks: 3
  commits: 4

plan_head_before: a367f9a3ff84519cfa3a9d3cd413f44b8e74e9fb
---

# Phase 114 Plan 04: The byte-gated catalog amendment — Summary

The host-engine marker is now a published operator-facing contract rather than
an internal derivation: two rendered states pin it under the byte-equality
gate, the second one pinning its position inside the brace, and the probe
helper that would have quietly reported the engine absent under a name saying
otherwise now names what it actually loads.

## What was built

**The rename (D-114-04, T-114-15).** `piWithBothLoaded` counted to two over a
three-field probe. Renamed `piWithAllLoaded` with
`{ name: "workflow_control" }` added to every body, so the name and the "no
soft-dep marker fires" comment are true again.

**Two byte-pinned catalog states (WDOC-02).** Under the install verb,
immediately after `### Success with soft-dep markers`, appended not
interleaved:

| State | Probe | `dependencies` | Renders |
|---|---|---|---|
| `success-with-workflow-engine-absent` | `piWithoutWorkflowEngine()` | `["workflows"]` | `{requires pi-dynamic-workflows}` |
| `success-with-agents-and-workflows-soft-dep` | `piWithMcpLoaded()` | `["agents", "workflows"]` | `{requires pi-subagents, requires pi-dynamic-workflows}` |

Both stamp `expectedSeverity: "warning"`, so both rendered blocks open with the
`A plugin operation needs attention.` summary line and close with the reload
trailer.

The second state is the one that matters. Main deleted the runtime
`DEPENDENCIES` tuple whose index used to imply the brace order, so those
rendered bytes are what replaces it: two markers, ONE brace, comma-space
separated, host-engine marker SECOND.

**Both blocks came from the renderer, not from a keyboard.** Each fixture was
composed first, the doc block seeded with a `PLACEHOLDER` line, and the gate
run; the bytes below are copied verbatim from its `--- actual ---` report. A
hand-typed ladder is how a byte gate learns to accept a wrong one.

```
[BYTE MISMATCH] section=/claude:plugin install <plugin>@<marketplace> state=success-with-agents-and-workflows-soft-dep
--- expected ---
PLACEHOLDER
--- actual ---
A plugin operation needs attention.

● official [user]
  ● helper v1.0.0 (installed) {requires pi-subagents, requires pi-dynamic-workflows}

/reload to pick up changes
----------------
```

**The exact count moved 192 → 194 in all three of its places** — the
explanatory comment, the `assert.equal` argument and the template-literal
message. `grep -c '192'` prints 0 and `grep -c '194'` prints 3. It stays an
exact count and was not relaxed into a floor (T-114-16).

## The rename, measured (required by the plan's output block)

`piWithBothLoaded` occurrence counts, before → after, per file. The tree held
**four** independent definitions, not the two D-114-04 recorded:

| File | `piWithBothLoaded` before | `piWithAllLoaded` after |
|---|---|---|
| `tests/architecture/catalog-uat.test.ts` | 188 | 188 |
| `tests/shared/notify.test.ts` | 116 | 116 |
| `tests/architecture/notify-grammar-invariant.test.ts` | 19 | 19 |
| `tests/architecture/notify-will-reload-agreement.test.ts` | 9 | 9 |
| **total** | **332** | **332** |

`grep -rn 'piWithBothLoaded' tests/` now returns no match (exit 1).

### No fixture `message` literal changed (T-114-17)

The prohibition is against a text substitution that silently rewrites a string
INSIDE a fixture. Two facts establish it did not happen, and neither is "the
suite passed":

1. **Every occurrence was code or a comment before the change.** Classified by
   grepping each match line and collapsing duplicates: 182 `pi:
   piWithBothLoaded(),` entries, 3 `notify(<ctx> as never, piWithBothLoaded()
   as never, {` calls, 2 prose comment mentions and 1 definition in
   `catalog-uat.test.ts`; 115 `const pi = piWithBothLoaded();` plus 1
   definition in `notify.test.ts`; a definition plus `pi:` entries in the other
   two. **None sits inside a string literal or a fenced expected-bytes block.**

2. **The diff is identical modulo the identifier.** Removed and added lines
   containing the symbol were extracted, the old and new names normalized to
   one placeholder, sorted and `diff`ed:

   ```
   $ diff old.txt new.txt && echo "IDENTICAL modulo the identifier => pure symbol rename"
   IDENTICAL modulo the identifier => pure symbol rename
   ```

   Every remaining changed line in the diff is one of: a rewritten doc
   comment, a body gaining the third tool, or the one probe-snapshot
   expectation below. No `message` literal appears among them.

### The zero-byte property held again

`docs/output-catalog.md` was absent from Task 1's diff
(`git diff HEAD --name-only -- docs/output-catalog.md` empty), and the catalog
gate was `# fail 0` at 6/6 across it. Plan 01 proved the property for the probe
field; this confirms the rename did not disturb it either. No pre-existing
fixture declares `workflows`, including in the two extra files this plan
discovered, so the added tool had nothing to move.

## The one expectation that had to change

`tests/shared/notify.test.ts`'s `emitContextCascade composes controlled rows, a
plural tally, and a reload hint` asserts on the composed probe SNAPSHOT passed
to `renderRow`, not on rendered bytes. It read `workflowEngineLoaded: false`,
which was only true because the helper was lying. It now reads `true`.

This is the same class plan 01 recorded for `notify-context.test.ts`: an
assertion ABOUT the snapshot has to match what the fixture actually produces,
and the fixture's whole point is that all three companions are loaded. The
case's claim is unchanged — it was not refitted until green.

## The stale prose, and what was already stale

**`docs/output-catalog.md`'s `REASONS` prose count was wrong BEFORE this
phase.** It read `43-member` against a tuple that had been **44** since `stale
workflow command` landed in the previous phase. Plan 01 appended the 45th
member. So the correction a reviewer sees is `43 → 45`, a two-step move, and
only one of those steps belongs to this phase. It sits outside the byte gate,
which is exactly why nothing caught it — the trail is eight closed-set sites,
not the seven the prior phase recorded (D-114-06).

The file's other two prose counts were re-derived from the tree rather than
assumed: `19-member PLUGIN_STATUSES` and `7-member MARKETPLACE_STATUSES` are
both correct (`PLUGIN_STATUSES.length === 19`,
`MARKETPLACE_STATUSES.length === 7`, read at runtime, not counted by eye).

**`docs/messaging-style-guide.md`** described `Dependency` as derived from a
`DEPENDENCIES` runtime tuple that main deleted. `grep -c 'DEPENDENCIES'` now
prints 0 across three sites (the type comment, the closed-set bullet and the
source-map footer). The bullet is rewritten as a present-tense fact — a
three-member literal union that is its own sole declaration site, with all
three companion mappings and why the marker is `requires pi-dynamic-workflows`
and never `requires pi-workflows`. The list's own preamble claimed every closed
set has a runtime tuple, so it moved with the bullet.

Its dependency-field sentence named `present`, a status retired from
`PLUGIN_STATUSES` (`grep -c 'PluginPresentMessage'` on `notify.ts` prints 0),
and its arithmetic summed to 16 against a 19-member tuple. Reconciled against
the source: four dep-bearing variants (`installed | updated | reinstalled |
partially-installed`), `partially-installed`'s field the OPTIONAL one, 15
remaining. 4 + 15 = 19.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 2 - Missing critical] `piWithBothLoaded` had four definitions, not
two**

- **Found during:** Task 1
- **Issue:** D-114-04, the RESEARCH measurement and the plan all name two
  definitions and 302 call sites.
  `tests/architecture/notify-grammar-invariant.test.ts` and
  `tests/architecture/notify-will-reload-agreement.test.ts` each hold a third
  and fourth independent copy, with the same `no soft-dep markers` doc comment
  that becomes false the moment the probe has three fields. Renaming only the
  two named files would have left the plan's own success criterion
  (`piWithBothLoaded` occurs zero times) unmet and two lying helpers behind.
- **Fix:** Renamed all four and added the third tool to all four bodies. No
  fixture in either extra file declares `workflows`
  (`grep -c 'workflows'` prints 0 in both), so the added tool moves no rendered
  byte there either.
- **Files modified:** `tests/architecture/notify-grammar-invariant.test.ts`,
  `tests/architecture/notify-will-reload-agreement.test.ts`
- **Commit:** 84f0af66

**2. [Rule 3 - Blocking] `piWithoutWorkflowEngine` cannot ship in Task 1's
commit**

- **Found during:** Task 1, at the typecheck verify step
- **Issue:** The plan puts the new helper in Task 1 and its consumers in Task
  2, then requires Task 1's `npm run typecheck` to print 0 errors. It printed
  1: `catalog-uat.test.ts(227,10): error TS6133: 'piWithoutWorkflowEngine' is
  declared but its value is never read.` Measured, not predicted.
- **Fix:** Moved the helper into Task 2's commit, beside the two fixtures that
  call it. This is the mirror of plan 01's own Rule 3 deviation, which pulled
  tests forward for the same class of reason.
- **Files modified:** `tests/architecture/catalog-uat.test.ts`
- **Commit:** d3aaceb2

**3. [Rule 2 - Missing critical] The style guide's warning quoted the token it
warns against**

- **Found during:** Task 3 verification
- **Issue:** The rewritten `Dependency` bullet said the marker is "never
  `requires pi-workflows`". That is the one string a grep gate over `docs/`
  would search for, so a truthful warning would have read as a violation.
  `grep -rn 'requires pi-workflows' docs/ tests/ extensions/` matched exactly
  one line — that sentence.
- **Fix:** Reworded to name `@nicknisi/pi-workflows` directly, which is how
  `shared/concerns/soft-dep.ts:38-40` and `shared/notify.ts:260` already phrase
  the same warning. The hazard is stated without carrying its token. The grep
  now returns no match tree-wide.
- **Files modified:** `docs/messaging-style-guide.md`
- **Commit:** 41b6f1a9

**4. [Rule 1 - Bug] Two sibling probe helpers' doc comments were stale for the
same reason**

- **Found during:** Task 1
- **Issue:** `piWithMcpLoaded`'s comment named only the `agents` marker, and
  `piWithNothingLoaded`'s said "both soft-dep markers fire". With three probe
  fields, the first is incomplete in a way that matters — Task 2's second
  catalog state depends on `piWithMcpLoaded` reading the engine ABSENT, and
  nothing in its comment said so.
- **Fix:** Both comments now name what actually fires under them.
- **Files modified:** `tests/architecture/catalog-uat.test.ts`
- **Commit:** 84f0af66

### Notes on what the plan expected and what the tree held

- **The ES-5 supersession table was deliberately not extended.** The plan's
  action step says "the two remaining enumerations of the probes and the
  markers each grow by one", and RESEARCH points at
  `docs/messaging-style-guide.md:84, 166-167`. Line 84 is the live probe
  enumeration and did grow. Lines 166-167 are two rows of the **ES-5
  supersession table**, a historical record of which v1 strings were replaced.
  No ES-5 string ever existed for the host workflow engine, so a sixth row
  would assert a supersession that never happened, and the section's own
  closing sentence scopes it "strictly to ES-5's five marker strings". The
  marker enumeration that legitimately grew is the intro's at line 9. Two
  enumerations grew; neither is the table.

- **`docs/output-catalog.md`'s marker sentence gained a second claim.** Beyond
  naming the third marker it now states the `agents`, `mcp`, `workflows` brace
  order and that appending leaves existing braces byte-unchanged. That is the
  same guarantee the second catalog state pins in bytes, said once in prose
  where a reader looks for it.

- **The catalog edit is purely additive.** `git diff HEAD --numstat` for
  Task 2 read `30  0`, so no state this phase did not intend to touch could
  have moved. The reinstall soft-dep block is byte-unchanged as a consequence,
  not as a separate check.

- **`fallow dupes` reports a pre-existing clone group in
  `orchestrators/plugin/shared.ts`.** It is informational; `npm run fallow`
  exits 0, and no file this plan touched is in it.

## Non-vacuity: what would still be green if this were broken

Each new assertion was chosen against the question rather than added for
coverage:

| If this broke | What reddens |
|---|---|
| `composeReasons` stops appending the workflows marker | state 1's rendered block mismatches — its brace goes empty |
| the marker order flips to `workflows`, `agents` | state 2's block mismatches; state 1 cannot catch this, which is why there are two |
| the `companionSeverity` third disjunct is dropped | both states lose the `A plugin operation needs attention.` line AND the `expectedSeverity` check fails |
| `loadCatalogExamples` silently parses a fraction of the corpus | the exact-count assertion, which is 194 and not a floor |
| someone deletes a catalog annotation but leaves its fixture | the inverse walk (orphan fixture) — the gate is bidirectional |

## Known Stubs

None. Every `<automated>` command in all three tasks was run and is recorded
below. Nothing was appended to `.planning/WINDOWS.md`.

One out-of-scope discovery is logged in
`.planning/workstreams/workflows/phases/114-degradation-and-documentation/deferred-items.md`:
`docs/messaging-style-guide.md`'s `PluginNotificationMessage` enumeration says
16 variants against a 19-member tuple, lists the retired `PluginPresentMessage`
and omits `partially-installed` / `partially-upgradable`. It is a separate
defect from the soft-dependency prose sweep this plan owns, it predates this
phase, and correcting it properly means re-deriving the whole listing rather
than editing a count.

## Threat Flags

None. Every file changed is a document or a test. No network endpoint, auth
path, file-access pattern or schema change was introduced.

T-114-14 (the published marker spelling) is discharged by the two rendered
blocks: both spell the scoped `pi-dynamic-workflows`, and after deviation 3
`grep -rn 'requires pi-workflows' docs/ tests/ extensions/` returns no match,
so the operator is never pointed at the npm name of the engine this milestone
rejected on trust grounds.

## Verification

| Gate | Result |
|---|---|
| `node --test tests/architecture/catalog-uat.test.ts` | `# fail 0`, 6 tests |
| `node --test tests/shared/notify.test.ts` | `# fail 0`, 255 tests |
| `node --test tests/architecture/notify-grammar-invariant.test.ts` | `# fail 0`, 7 tests |
| `node --test tests/architecture/notify-will-reload-agreement.test.ts` | `# fail 0`, 2 tests |
| `grep -rn 'piWithBothLoaded' tests/` | no match (exit 1) |
| `grep -c 'piWithAllLoaded'` on the four files | 188 / 116 / 19 / 9 |
| `git diff HEAD --name-only -- docs/output-catalog.md` after Task 1 | empty |
| `grep -c 'catalog-state: success-with-workflow-engine-absent' docs/output-catalog.md` | 1 |
| `grep -c 'catalog-state: success-with-agents-and-workflows-soft-dep' docs/output-catalog.md` | 1 |
| `grep -c 'requires pi-subagents, requires pi-dynamic-workflows' docs/output-catalog.md` | 1 |
| `grep -c '192' tests/architecture/catalog-uat.test.ts` | 0 |
| `grep -c '194' tests/architecture/catalog-uat.test.ts` | 3 |
| `git diff HEAD --numstat -- docs/output-catalog.md` (Task 2) | `30  0` — purely additive |
| `grep -c '43-member' docs/output-catalog.md` | 0 |
| `grep -c '45-member' docs/output-catalog.md` | 1 |
| `grep -c 'requires pi-dynamic-workflows' docs/messaging-style-guide.md` | 3 |
| `grep -c 'DEPENDENCIES' docs/messaging-style-guide.md` | 0 |
| `git diff HEAD --name-only -- docs/open-closed-proof.md` | empty |
| `npm run typecheck` | 0 errors |
| `npm run lint` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm run format:check` | exit 0 |
| `npm run check` | exit 0 |
| `pre-commit run --files <changed>` | clean before each commit, modified nothing, except the structural TruffleHog worktree failure |
| TruffleHog filesystem scan of every committed path | `verified_secrets: 0`, `unverified_secrets: 0`, exit 0 |
| `git diff --name-only -- package.json package-lock.json sonar-project.properties CHANGELOG.md` | empty (D-114-07, T-114-SC) |
| `orchestrators/plugin/info.ts` | in no commit's diff |
| `.planning/workstreams/workflows/STATE.md` / `ROADMAP.md` | not modified |
| `.claude/settings.json` / `.codex/config.toml` | not staged, not modified |

**TruffleHog note.** The hook runs in git mode and aborts structurally in this
linked worktree (`failed to read index file: .../.git/index: not a
directory`). All three commits were prefixed `SKIP=trufflehog`, and only after
a clean filesystem scan of the exact paths being committed, per the project's
CLAUDE.md.

**Commit-count basis.** `actuals.commits: 4` is measured as
`git rev-list --count a367f9a3..HEAD` at SUMMARY-write time, the same basis
plans 01-03 used; it counts the three task commits plus the one-line
deviation-3 fix, and not this file's own docs commit. `actuals.tokens` is
`chars / 4` over the realized diff's added and removed content lines (37,964
chars → ~9,490), the instrument `114-02-SUMMARY.md` established — not the
`tokens: 58000` scale the plan's estimate used.

## Self-Check: PASSED

- `docs/output-catalog.md` — FOUND, both annotations present exactly once,
  `45-member` prose count, three-marker sentence
- `docs/messaging-style-guide.md` — FOUND, zero `DEPENDENCIES` identifiers,
  three probe targets, no `present` in the dependency-field sentence
- `tests/architecture/catalog-uat.test.ts` — FOUND, `piWithAllLoaded` and
  `piWithoutWorkflowEngine` both declared, exact count 194 in three places
- `tests/shared/notify.test.ts` — FOUND, renamed definition with three tools
- `tests/architecture/notify-grammar-invariant.test.ts` — FOUND, renamed
- `tests/architecture/notify-will-reload-agreement.test.ts` — FOUND, renamed
- Commit `84f0af66` — FOUND
- Commit `d3aaceb2` — FOUND
- Commit `0dc93239` — FOUND
- Commit `41b6f1a9` — FOUND
- `docs/open-closed-proof.md` — NOT in any commit's diff, as required
- `orchestrators/plugin/info.ts` — NOT in any commit's diff, as required
- `.planning/workstreams/workflows/STATE.md` / `ROADMAP.md` — NOT modified
