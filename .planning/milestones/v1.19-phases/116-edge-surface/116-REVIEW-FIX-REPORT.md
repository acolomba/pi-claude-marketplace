---
phase: 116-edge-surface
kind: code-review-gap-closure
date: 2026-09-03
licence: D-116-15
findings_closed: [CR-01, CR-02, WR-04, WR-05, IN-03]
findings_out_of_scope: [WR-01, WR-02, WR-03, WR-06, IN-01, IN-02, IN-04, IN-05]
files_modified:
  - extensions/pi-claude-marketplace/edge/handlers/tools.ts
  - tests/edge/handlers/tools.test.ts
  - .planning/phases/116-edge-surface/116-27-PLAN.md
---

# Code-review gap closure for `edge/handlers/tools.ts`

Five findings, both criticals among them, all in the one pair D-116-15 reopened. Every fix is
planted. Three new findings came out of the work and are recorded below with the rest.

## CR-01 — the tool could never return a `remote` or `partially-available` row

**Confirmed against the module.** `applyFilter` mapped "no filter set" onto `{ i: true, a: true,
u: true }`, and `loadToolPluginPayload` spread that into the orchestrator options, so every call
arrived carrying at least one PL-1 filter. `filtersPassive` (`orchestrators/plugin/list.ts:201`) was
therefore never true on this surface, `shouldShow` always took its union arms, and two of those arms
have no tool-side parameter: `remote` needs `opts.remote`, `partially-available` needs `opts.partial`.
Both `projectRowStatus` arms were dead on the execute path.

### The direction, and why

**Make the arms reachable. Do not remove them.** The module's own three-bucket contract already says
where those two statuses belong: `projectRowStatus` folds `remote` into `available` (RSTA-01 /
D-80-05) and `partially-available` into `unavailable` (USTAT-02 / D-64-01), and `statusKey` /
`applyFilter` are built on the same three buckets. Deleting the arms would have made the tool's
coarse `available` bucket mean something narrower than the fold it declares — an agent asking for
installable plugins would silently not be told about a marketplace it has never fetched from, which
is the case where the answer matters most. It would also have cost the type-level guarantee: the
switch is one of the file's exhaustiveness gates, and shrinking it moves the gap rather than closing
it.

The fix is in two halves:

- `applyFilter` now reports `narrowed`, and `loadToolPluginPayload` forwards **nothing** when the
  caller narrowed nothing. An all-true bag is not the same request as an empty one — that is the
  whole content of `filtersPassive`.
- When the caller did narrow, each coarse tool bucket carries its fine-grained members:
  `available` → `{ available: true, remote: true }`, `unavailable` →
  `{ unavailable: true, partial: true }`. The same folds `projectRowStatus` performs on the way back.

### The lost knowledge, restored

A comment 116-27's rewrite replaced had recorded the unreachability ("on the list surface only the
installed / upgradable / available / unavailable subset is reachable"). It is back, in the form the
fix makes true, on `projectRowStatus`: the nine reachable variants are named, and the comment states
that the two fine-grained ones are reachable **only because** `loadToolPluginPayload` carries their
filter across, and that folding a bucket here without carrying its filter there kills the arm. That
is the causal fact the old comment recorded as a bare symptom.

### Proof through the execute path (licence condition 1)

Every new case drives `registration.execute`, never `projectRowStatus` directly. The projection
table at `tools.test.ts:342,344` is untouched and remains what it was — a unit table that cannot see
this class of defect.

- Two `versionCases` rows on the passive path: a cold git-source candidate
  (`https://127.0.0.1:9/alpha.git`, nothing materialized) and a not-installed candidate declaring an
  unsupported kind.
- `mixedMarketplace` gained one plugin per bucket — `delta` (remote) and `echo`
  (partially-available) — so the whole `filterCases` table is now total over the five fine-grained
  buckets the payload can carry, and each narrowed row pins which of them survives.

The hand-authored row order (manifest declaration order) matched the payload order on first run.

## CR-02 — three row variants lost their `reasons`

**Confirmed against the module.** `pluginReasons` handled `installed` and the five required-`reasons`
variants and returned `undefined` for everything else, dropping the optional-`reasons` slot of
`disabled` (`{not in manifest}`, from `disabledReasonsField`, ENBL-16 / D-100-07), `available` and
`remote` (`{installs disabled}`, from `installsDisabledField`, OUT-02 / OUT-05). The function's own
doc comment claimed the opposite. This is the data-field class the phase measured twice: 100 percent
branch coverage did not notice.

All four optional-`reasons` variants now share one arm; the doc comment names each one's producer, so
it states a fact that can be checked rather than a promise.

### New finding — the fix stranded a statement, and the statement went rather than a pin

With all nine reachable variants handled, `pluginReasons`'s trailing `return undefined` became
unreachable, and the direct-coverage gate went to `branches 103/104, lines 580/582` with `411-412`
uncovered. It had been covered only because the three dropped variants were falling through it.

Rather than claim a D-116-01a shortfall for a statement that no longer needed to exist,
`pluginReasons` was reshaped into a value-returning switch over the derived `ToolPluginRow` union —
the same shape and the same union `pluginVersion` already uses. The two arm groups are total over
that union, so there is no fall-through to strand. That closed the gate at **103/103, 16/16,
583/583** and produced a fifth exhaustiveness gate (see the D-116-14 section).

## WR-04 — the two switches, and the guard the projection sat outside of

The finding has two halves and they resolve differently.

**The escaping throw is real and is fixed.** `renderPluginPayload` ran at `tools.ts:498`, outside the
`try` that ended at 496, so `projectRowStatus`'s guard throw would have escaped `execute` as an
unhandled rejection rather than reaching the `isError: true` branch its own comment promised. The
projection now runs inside the `try`.

**The comment's justification was wrong, exactly as reported.** The synthetic `(list)` failure row is
built in `listPlugins`'s catch (`list.ts:1539-1546`), not in `loadPluginListPayload`, so it never
enters the tool's payload and the try/catch had nothing to do with it. That claim is gone.

**The two switches do not in fact disagree, and forcing them to "agree" would break the build.**
`ToolPluginRow` is derived from the producer's declared type, and `ListMsg` includes
`PluginFailedMessage`, so `failed` is a member of the union. `pluginVersion` must name it or raise
`TS7030` — dropping the arm is not available. `projectRowStatus` must refuse it, because no payload
this tool loads carries one. Both files now say so in one voice: `projectRowStatus` states that
`failed` is type-permitted and producer-impossible, and `pluginVersion` states that its arm exists
for the gate and that the render loop runs the projection first, so no `failed` row reaches it.

**No test proves the move.** No reachable input makes the projection throw — that is the point of the
guard. Asserting otherwise would need a fabricated payload, which would test the fabrication. The
change is recorded as a defensive relocation with no observable behaviour, not as a proven one.

## WR-05 — a marketplace block the filter empties

Pinned, with a corrected premise.

**Finding: the review's own reproduction does not reach the shape it names.** It proposes driving
`mixedMarketplace` with `{ installed: true }` after removing the `alpha` record. Measured: that
renders `"Marketplace filtered-mp (project)\n  (no plugins)"`, not a bare header — because the
**orchestrator** drops the row first, leaving `mp.plugins` empty, which takes the `(no plugins)`
branch at `tools.ts:411`. The first version of this case was written that way and failed; the failure
is what produced the correction.

The bare-header shape needs a row the two filters **disagree** about: one the orchestrator keeps and
the tool-side re-filter drops. A disabled record is exactly that — the orchestrator counts it as
installed inventory (`shouldShow`'s A1 arm), and the tool projects it onto the `unavailable` bucket
that `installed: true` excludes. The case seeds one such record, drives `{ installed: true }`, and
pins the whole rendered value: header, no body, `details.plugins: []`.

The shape itself is left as it is rather than changed. The plant below is what makes it a pinned
decision instead of an accident.

## IN-03 — the redundant conjunct

`if (rows.length === 0 && payload.length === 0)` → `if (payload.length === 0)`. `rows` is pushed only
from inside `renderPluginPayload`'s loop over `payload`, so the first conjunct could never
independently decide the branch. The comment now says so. Behaviour-preserving by construction; the
observable is the branch count, which the coverage gate re-measured.

## WR-01 — untouched, as instructed

Out of scope and reported as a false finding. `tests/edge/handlers/tools.test.ts`'s offline guard and
its header sentence are unchanged.

## D-116-14 re-measured (licence condition 2)

Each switch re-planted against the fixed file, one arm deleted, `npm run typecheck` run, the file
restored from a byte copy.

| # | Switch | Deleted arm | Diagnostic |
|---|---|---|---|
| 1 | `projectRowStatus` | `case "available": return "available";` | `tools.ts(175,80): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.` |
| 2 | `statusLabel` | `case "available": return "[available]";` | `tools.ts(224,49): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.` |
| 3 | `statusKey` | `case "available": return "a";` | `tools.ts(286,47): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.` |
| 4 | `pluginVersion` | `case "failed":` | `tools.ts(441,43): error TS7030: Not all code paths return a value.` |
| 5 | `pluginReasons` **(new)** | `case "upgradable":` | `tools.ts(394,43): error TS7030: Not all code paths return a value.` |

**Confirmed:** all four recorded diagnostics are unchanged in kind and in text. Only the line and
column coordinates moved, because the file grew. No switch changed shape or return type, so
116-27-SUMMARY.md's verbatim record of the original measurement stays accurate as a record of what
was measured then.

**Corrected:** the file now carries **five** gated switches, three raising `TS2366` and two `TS7030`,
because the CR-02 fix turned `pluginReasons` into a value-returning switch. `116-27-PLAN.md` carries
an amendment saying to read every "four switches" in it as five.

## Plants

Every plant reverted from a byte copy; `npm run typecheck` clean and 53/53 green after each revert.

| Plant | Change | Result |
|---|---|---|
| CR-01a | Restore the pre-fix filter spread (all-true bag, no `remote`/`partial`) | **RED**, exactly the two new `versionCases` rows. The other 47 stayed green — the measurement that the pre-existing suite could not catch CR-01. |
| CR-01b | Drop `remote: true` from the narrowed `available` bucket | **RED**, `narrows to the available bucket…` and `unions the available and unavailable buckets…`, and only those |
| CR-01c | Drop `partial: true` from the narrowed `unavailable` bucket | **RED**, `narrows to the unavailable bucket…` and `unions…`, and only those |
| CR-02a | `disabled` returns `undefined` from `pluginReasons` | **RED**, `forwards the absence reason of a disabled record the manifest omits`, alone |
| CR-02b | `available` returns `undefined` | **RED**, `forwards the install-time claim of an available row that declares it`, alone |
| CR-02c | `remote` returns `undefined` | **RED**, `forwards the install-time claim of a cold git-source row that declares it`, alone |
| WR-05 | Give an emptied block the `(no plugins)` body — the other candidate shape | **RED**, `renders the header alone for a marketplace whose rows the filter empties`, alone |
| D-116-14 ×5 | See the table above | **RED** ×5, three `TS2366` and two `TS7030` |

The three CR-02 plants were first run against the `if`-chain form and re-run against the final switch
form after the reshape; both runs reddened the same single case each time. The first attempt at
CR-02c against the `if`-chain removed the last disjunct and left a dangling `||`, so the file did not
parse — re-run well-formed, recorded here as the well-formed result.

**Two changes carry no plant, and neither is claimed as proven.** IN-03 is behaviour-preserving by
construction. WR-04's relocation of the projection into the `try` has no reachable input that can
exercise it, because the guard it protects is unreachable by design.

## Gates

Run separately, each exit code checked. `npm run check` was not used: `format:check` fails on the
operator's pre-existing untracked files and short-circuits before `test`.

| Gate | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run fallow` | exit 0 |
| `npm test` | exit 0 — **`ℹ tests 5140`, `ℹ suites 295`, `ℹ pass 5140`, `ℹ fail 0`** (baseline 5134/5134 across 295; the six new cases are the two `versionCases` rows, the disabled-absence case, the two install-disabled rows and the WR-05 case) |
| `npm run test:integration` | exit 0 — 31/31 |
| `npm run test:coverage:direct` for the pair | **passed: branches 103/103, functions 16/16, lines 583/583** (was 101/101, 16/16, 513/513) |
| `prettier --check` on both files | clean |
| anti-pattern scan (`as any`, `as unknown as`, coverage pragmas, `.skip`/`.only`, planning refs) | no match |

Every count above is read from the runner's own `ℹ tests` line, never computed from a delta.

## Observations for whoever comes next

- **The coverage numbers moved and the movement is the honest one.** Branches 101 → 103 and lines
  513 → 583 come from the `narrowed` gate, the widened `pluginReasons` arms and the extra fixtures.
  No absolute branch pair is pinned anywhere; the phase's rule against that is untouched.
- **The tool's parameter descriptions were left alone.** `available` reads "not installed but are
  installable" and `unavailable` reads "not installable on this system", and both now admit a
  fine-grained bucket the wording does not mention (an unfetched git source; a partially available
  plugin). Changing them would change the LLM-facing contract and the registration case's pinned
  schema, which is beyond this licence. Recorded as a wording gap, not fixed.
- **`pluginScopeOrFallback` still takes the wide `PluginNotificationMessage`**, as 116-27 left it.
  `pluginReasons` moved to the narrow row union; the two are now inconsistent in parameter type but
  not in behaviour, and narrowing the third was not needed by any finding.
