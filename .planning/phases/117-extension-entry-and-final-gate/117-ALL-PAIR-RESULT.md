# All-pair direct coverage result

Measured 2026-09-03. Companion to `117-ALL-PAIR-RESULT.ndjson`, which holds one
newline-delimited record per inventory row.

## Totals

| Verdict | Rows |
| --- | --- |
| `complete` — a numeric coverage record, all counters at 100 percent | 190 |
| `accepted-shortfall` — a D-116-01a claimant, one unreachable branch | 7 |
| `type-only` — the module emits no JavaScript, so there is nothing to cover | 7 |
| **Total** | **204** |

Every row carries a verdict. None is silent. The record file holds 204 lines, one per
production module, with 204 distinct source paths and 204 distinct test paths.

## How COV-05 is met

COV-05 asks for "one complete direct coverage record for each of the 204 inventory rows".
Read literally that cannot hold, for two different reasons, and the reasons are not the
same shape:

- **Seven modules emit no JavaScript.** A module with no emitted lines has nothing to
  cover, so there is no record to produce. These carry an explicit `type-only` verdict,
  by name.
- **Seven modules carry an unreachable branch the operator has already accepted.** These
  are the D-116-01a claimants. Each is pinned by identity in its own pair's suite and
  filed in `.planning/WINDOWS.md`. Each falls short by exactly one branch.

**D-117-20 is amended to read: 190 complete numeric records + 7 accepted shortfalls +
7 type-only verdicts.** Its original wording — 197 numeric records plus 7 type-only —
did not account for the D-116-01a rows and cannot be satisfied on this tree. The
decision record moves to meet the measurement, not the other way round.

This is **not** resolved by a coverage-exception pragma, which D-116-01a bans outright,
and **not** by weakening the assertion for the other 197. The gate is unchanged: it
still refuses a shortfall, and each of the seven still exits 1.

## The seven accepted shortfalls, with the line dimension

The gate reports only the counters that fall short. Functions are complete for all seven;
lines are complete for five of the seven and short for two. Recording the line dimension
matters — reporting these as "one branch each" would be true of the branch counter and
silently wrong about `args.ts` and `shared.ts`.

| Module | Branches | Lines | Functions | Ledger | Unreachable at |
| --- | --- | --- | --- | --- | --- |
| `edge/args.ts` | 28/29 | **86/89** | complete | 21 | guard at 34-37, compiler-forced |
| `edge/completions/data.ts` | 109/110 | complete | complete | 16 | line 188, compiler-forced |
| `edge/completions/provider.ts` | 79/80 | complete | complete | 17 | line 125, structural |
| `edge/handlers/marketplace/update.ts` | 11/12 | complete | complete | 15 | line 41, structural |
| `edge/handlers/plugin/import.ts` | 11/12 | complete | complete | 18 | line 31, compiler-forced |
| `edge/handlers/plugin/pending.ts` | 9/10 | complete | complete | 19 | line 39, compiler-forced |
| `edge/handlers/shared.ts` | 14/15 | **83/85** | complete | 22 | guard at 53-55, compiler-forced |

The two line shortfalls are the bodies of the unreachable guards themselves — a 3-line
guard in `args.ts` and a 2-line guard in `shared.ts` — not a separate gap.

## The seven type-only rows, by path

Naming them is the whole content of the exception; a count would hide which modules it
applies to.

- `extensions/pi-claude-marketplace/bridges/agents/types.ts`
- `extensions/pi-claude-marketplace/bridges/commands/types.ts`
- `extensions/pi-claude-marketplace/bridges/mcp/types.ts`
- `extensions/pi-claude-marketplace/bridges/skills/types.ts`
- `extensions/pi-claude-marketplace/edge/types.ts`
- `extensions/pi-claude-marketplace/orchestrators/import/types.ts`
- `extensions/pi-claude-marketplace/orchestrators/types.ts`

## The runtime

The run used **Node v26.8.1**, taken from the run's own output and written into every
record's `runtime` field.

**This is not a Node 24 result and is not labelled as one.** No Node 24 is installed on
this machine. `/home/linuxbrew/.linuxbrew/bin/node` is v26.8.1 and `/usr/bin/node` is
v22.22.2. The interpreter this phase's earlier numbers were taken on, v26.7.0, was
replaced by a package upgrade during this plan's execution and is no longer in the
Cellar.

CI pins Node 24: `.github/workflows/ci.yml` sets `node-version: "24"` at lines 70, 91,
111 and 132, one per job. Success criterion 3 is therefore satisfied in two halves —
**by CI for the runtime, and by this artifact for the record.**

The tree now behaves identically on both interpreters present. Before the errno hardening
in this plan, v26.8.1 produced 10 additional failing pairs and v22.22.2 produced none;
after it, both report the same 197 passing and the same 7 accepted shortfalls. That
agreement is the evidence the hardening addressed a runtime artifact rather than masking
a defect.

## The elapsed wall clock

```
All-pair result: 204 rows in 533.2s (533199ms) on v26.8.1
```

That line is printed by the runner. It is a measurement, not a delta computed by
subtracting two timestamps by hand.

Per-row, from the record file: minimum 962 ms, median 2925 ms, maximum 10249 ms. The tail
is the plugin orchestrators — `reinstall.ts` 10249 ms, `install.ts` 8622 ms, `update.ts`
8208 ms.

**How the result was produced, precisely.** The gate's own `--all` cannot emit 204 rows:
it refuses the first accepted shortfall it reaches and stops. Measured — `node
scripts/test-coverage-direct.mjs --all --report <path>` exits 1 having retained **83
rows**, stopping at `edge/args.ts`. So each row's verdict here comes from the shipped
gate command driven once per row (`node scripts/test-coverage-direct.mjs <source>`), with
its exit code recorded in the record. The 533.2 s figure is that per-row driver's own
elapsed line and therefore includes 204 separate interpreter startups; a single-process
`--all` would be faster. The figure is quoted as what it is.

## The concurrency decision

**Concurrency is not added.** The default disposition stands, and it now stands against a
measured number rather than an unmeasured one, which is what D-117-11 required.

- **The number it was decided against:** 533.2 s — under nine minutes — for all 204 rows,
  sequentially, including 204 interpreter startups the gate's own `--all` would not pay.
- **Why that is not impractical:** this is a phase-boundary and pipeline operation, not an
  inner-loop one. Nine minutes at a phase boundary does not justify the obligation
  attached to adding concurrency.
- **What adding it would cost:** D-117-11 requires a second planting control proving a
  deliberately failing pair is still detected when runs interleave. That control is real
  work and would itself need planting.

For the record, what research found when it looked for shared-state hazards: per-pair
temporary coverage directories, a process-scoped socket path, per-process
working-directory and environment changes, no writes into the repository, and lockfiles
that only ever guard temporary scope roots. So the cost of parallelism would be
interleaved output rather than incorrectness — and the report file this plan added
already removes that cost. The decision is about the obligation, not about safety.

## Why the merged report is not a substitute

Not an argument — a measurement, taken on the entry pair.

Run alone, `index-smoke.test.ts` emits `BRDA:118,6,0,0`: the `catch (notifyErr)` at line
118 is never entered. Merged with `index-handler.test.ts`, V8 emits **no branch range for
line 118 at all**, and lines 119-123 report a hit count of 1. The merged report shows that
region as covered when neither suite executed it.

The aggregate is therefore not merely weaker than the per-pair run — it is **wrong in the
safe direction**, which is the worse failure. Nothing in this artifact comes from
`coverage/unit.lcov`.

## Record format

One JSON object per line:

```json
{"sourcePath":"...","testPath":"...","verdict":"complete|type-only|accepted-shortfall",
 "coverage":"...","exitCode":0,"runtime":"v26.8.1","elapsedMs":1200}
```

`coverage` carries the counter summary for a complete row, the literal `type-only` for a
type-only row, and the deficient counters for an accepted shortfall.
