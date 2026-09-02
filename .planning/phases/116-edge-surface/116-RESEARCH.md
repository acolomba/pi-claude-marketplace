# Phase 116: Edge Surface - Research

**Researched:** 2026-09-02
**Domain:** TypeScript unit-test compliance refactor of the `edge/` command-surface tier (30 source-test pairs)
**Confidence:** HIGH — every finding below was measured in this session against the working tree; nothing is quoted from training memory.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Milestone test contract carried forward

Phases 108 through 115 locked the contract this phase inherits. It is not reopened here.

- **D-116-01:** One owner per source at the mirrored path, passing alone at 100 percent
  direct function, line, and branch coverage, with no coverage exception added. Phase 115
  removed the last `c8 ignore` pragma in the whole `extensions/` tree; none returns.
- **D-116-01a (operator amendment, 2026-09-02):** D-116-01 admits exactly one shortfall class and
  no other: a branch that is unreachable at runtime **solely because a compiler setting forces it
  to exist**. Two settings produce it in this tier. `noUncheckedIndexedAccess`
  (`tsconfig.json:12`) types every index read as `T | undefined`, so a loop whose bounds already
  guarantee the read must still carry a guard the loop can never enter. A `catch (err)` binding is
  typed `unknown`, which cannot be narrowed to `Error` without leaving a residual arm. Removing
  either guard requires a non-null assertion or a type assertion:
  `@typescript-eslint/no-non-null-assertion` is an error throughout `extensions/` under
  `strictTypeChecked` and is relaxed only for `tests/**` (`eslint.config.js:309-312`), and
  `extensions/` carries none today; `as unknown as` and `as any` are separately banned by this
  phase's own anti-pattern grep. The only remaining route is a loop or catch rewrite, which is
  materially more than deletion in a milestone scoped to tests.
  This amendment does **not** license a coverage-exception pragma. D-116-01's ban on `c8 ignore`
  and `node:coverage ignore` stands unchanged and applies to this class too. It admits no other
  kind of miss. A pair claiming it MUST, in its `must_haves`, name the exact line range, state
  that the branch is unreachable at runtime, name the compiler setting that forces it to exist,
  and pin the shortfall by its **identity** — the uncovered line set, and that exactly ONE branch
  is uncovered — so a verifier reads an argued, scoped shortfall rather than a gap.

  **Pin the identity, not the branch numbers (amended 2026-09-02, after 116-02 executed).** A pair
  MUST NOT pin an absolute branch numerator and denominator. V8 emits a branch range only when that
  block's count diverges from its enclosing range, so a guard whose false arm is never taken is
  collapsed and never enters the denominator; strengthening the suite adds previously-collapsed
  ranges and raises numerator and denominator together. A branch-number pin is therefore a property
  of suite strength, not of the source, and cannot be authored before the rewrite it is meant to
  gate — 116-02 was authored at `branches 25/26` and measured `28/29` with nothing regressed and the
  shortfall's identity unmoved. The verify block asserts instead: (1) the gate still prints an
  `Incomplete direct coverage for <source>:` verdict, with branch numbers matched loosely; (2)
  denominator minus numerator equals exactly 1, which is immune to denominator drift and still
  catches a NEW uncovered branch — precisely what a matching number pair can mask; and (3) the
  uncovered line set is exactly the documented one. **Line counts are NOT affected** — a file's
  executable-line total is fixed — so the exact `lines N/M` clause stays pinned wherever it was
  measured. Functions stay pinned at 100 percent. Measured branch numbers are recorded in the
  summary as an observation, never as a gate. A *passing* verdict still fails the link and must be
  reported, never edited away.
  Four pairs claim it: 116-02 (`edge/args.ts:34-37`), 116-26 (`edge/handlers/shared.ts:53-55`),
  116-21 (`edge/handlers/plugin/pending.ts:39`), and 116-17
  (`edge/handlers/plugin/import.ts:31`). No other pair may.
- **D-116-02:** Runtime cases use separate lowercase `// arrange`, `// act`, and `// assert`
  phases. Lowercase `// act & assert` is reserved for one `assert.throws()` or
  `assert.rejects()` expression. Marker counts equal case **bodies**, not runtime cases — a
  row table emits several runtime cases from one marked body.
- **D-116-03:** Expected values are authored independently of production. No expectation is
  computed by calling the code under test, and no matcher is loose enough to accept two
  different outcomes.
- **D-116-04:** Every non-obvious proof is planted: change the thing the proof pins, confirm
  the test goes RED, revert, and record the plant in the summary. A plant that stays green is
  a finding — narrow the claim or add the discriminating case. Never paper one over.

#### Proof depth at the edge tier

- **D-116-05:** Handler owners are **edge-complete and outcome-thin**. Prove exhaustively what
  the edge itself owns — every flag, alias, arity, scope combination, and validation
  rejection — and assert the orchestrator was called with exact arguments rather than
  re-deriving what it returns. Phases 113, 114, and 115 already own every orchestrator
  outcome at 100 percent direct coverage; re-deriving them here is the D-20/D-22 duplication
  the milestone is trying to remove.
- **D-116-06:** Invalid input must be proven to fail **before** any state-changing workflow
  runs. The assertion is that the orchestrator was never called, not merely that an error
  surfaced.

#### Helper module ownership

- **D-116-07:** The three helper modules — `edge/handlers/shared.ts`,
  `edge/handlers/marketplace/shared.ts`, and `edge/handlers/plugin/shared.ts` — each get a
  full independent owner proving their own behavior. Handler owners assert only that they
  delegate to a helper with exact arguments; they do not re-prove what the helper computes.
  These modules hold the only real logic in the edge tier and are imported by nineteen
  handlers, so this is D-116-05 applied one layer down. Two of the three are among the five
  owners this phase must newly write.

#### Correspondence gate closure

The gate (`scripts/check-corresponding-tests.mjs`) reports fourteen violations repo-wide.
Seven belong to this phase; the remaining seven belong to Phase 117.

- **D-116-08:** Write the five missing owners: `tests/edge/flag-catalog.test.ts`,
  `tests/edge/handlers/marketplace/shared.test.ts`,
  `tests/edge/handlers/plugin/shared.test.ts`, `tests/edge/handlers/plugin/import.test.ts`,
  and `tests/edge/types.test.ts`.
- **D-116-09:** `git mv tests/edge/handlers/import.test.ts` to
  `tests/edge/handlers/plugin/import.test.ts` and rewrite it as that pair's owner. Its source
  is `edge/handlers/plugin/import.ts`, so the file currently sits one directory above its
  mirrored path. This mirrors D-115-06.
- **D-116-10:** Leave `tests/edge/index-handler.test.ts` alone. Its paired source is the root
  `extensions/pi-claude-marketplace/index.ts`, which Phase 117 owns; Phase 117 absorbs it when
  it writes `tests/index.test.ts`. Phase 116 therefore closes six of its seven violations, and
  the seventh lands with the phase that owns its source.

#### Type-only module contract

- **D-116-11:** `tests/edge/types.test.ts` matches the six type-only owners that already
  exist (`tests/orchestrators/types.test.ts`, `tests/orchestrators/import/types.test.ts`, and
  `tests/bridges/{agents,commands,mcp,skills}/types.test.ts`). It pins each member's type and
  the required-versus-optional split — `importClaudeSettings` is optional, `gitOps` and
  `pluginUpdate` are required — with module-scope `satisfies` and `@ts-expect-error`
  negatives, and no runtime cases.
- **D-116-12:** It does **not** enumerate `EdgeDeps`'s member set to catch an unused or newly
  added member, and it does not assert the module's export surface. A test observes shape, not
  use; whether a member is read belongs to the call graph. A new required member breaks every
  construction site at compile time, a new optional member that something reads is caught by
  the consumer's own direct coverage, and export-surface pinning duplicates
  `fallow dead-code`'s `unused-export` check. See the deferred item below.
- **D-116-13:** Write each type-level negative on the line its diagnostic actually lands on. A
  multi-line `satisfies` reports on its **closing** line, so an `@ts-expect-error` placed above
  the opening brace attaches to nothing and passes silently. This was one of the six
  proofs-that-cannot-fail caught in Phases 114 and 115.

#### Exhaustiveness enforcement carried from Phase 115

- **D-116-14:** Phase 115 proved with a compiler repro that a **`void`-returning** `switch`
  with a missing arm compiles clean — only a value-returning switch raises TS2366 (and, under
  `noImplicitReturns`, a `default`-less switch raises TS7030 regardless of the return type). Four gates
  in the codebase had been deleted against a guarantee TypeScript never made. Wherever this
  phase claims an exhaustiveness guarantee, prefer a value-returning shape and plant a missing
  arm to prove the gate fires. `router.ts` and the handler dispatch tables are exactly this
  shape. Whether to adopt this as a phase-wide rule is left to research and planning.

### Claude's Discretion

Settled by the planner and researcher with full sight of each module:

- Whether success criteria 3 and 4 (notify discipline, offline read-only paths) are proven per
  owner or left to the existing architecture suite, which already gates `process.stdout` and
  `process.stderr` writes and orchestrator network imports.
- Whether D-116-14 becomes a phase-wide rule or is applied case by case.
- Wave grouping, plan sizing, and per-pair double strategy.

### Deferred Ideas (OUT OF SCOPE)

- **Detect unused code and unused type members.** No gate reports a member of an exported
  interface that nothing reads. Measured 2026-09-02 by planting
  `readonly neverReadAnywhere?: string` on `EdgeDeps`: `npm run typecheck`, `npm run lint`,
  and `npm run fallow` all exit 0 and none mentions it. Recorded in
  `.planning/todos/pending/2026-09-02-detect-unused-code-and-type-members.md` against Phase
  117, which owns the repository-wide gates. Do not attempt to close this with a test in this
  phase — that is precisely what D-116-12 forbids.
- **`REQUIREMENTS.md` per-pair `Status` column drift.** The column stopped being maintained
  after Phase 109; 115 rows across Phases 110 through 114 still read `Open` despite all five
  being verified complete. Phase 115's eight rows were closed during its transition. Awaiting
  an operator decision on whether to sweep the remainder.
- **`tests/edge/index-handler.test.ts`** — absorbed by Phase 117 alongside `tests/index.test.ts`
  (D-116-10).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOD-09 | "All 30 edge-surface pairs complete the pair contract." `[VERIFIED: .planning/REQUIREMENTS.md:128]` — verbatim: `- [ ] **MOD-09**: All 30 edge-surface pairs complete the pair contract.` | The Per-Pair Inventory below enumerates all 30 pairs with measured LOC, export surface, existing-test size, and measured direct coverage. The Seam Analysis names the double strategy per pair group. The Verify Commands section confirms the per-plan gate shape still runs. |
</phase_requirements>

## Summary

Phase 116 is a rewrite of twenty-five non-compliant test files plus five new owners, over
**3,911 lines** of edge-tier source across 30 modules. The existing 27 files under `tests/edge/`
carry **7,863 lines** and **338 `test()` cases**, and **zero** of them carry a single lowercase
`// arrange` marker. Twenty-five of them use `as unknown as`. Every file is a full rewrite, not
a patch. Eight of the twenty-five mirrored pairs already reach 100 percent direct coverage;
seventeen fall short; five have no test at all.

The single most consequential finding is that **D-116-05's "assert the orchestrator was called
with exact arguments" has no mechanism for 16 of the 17 handler modules.** Those handlers reach
their orchestrator by direct `import`, with no injection point, and both available substitutes
are closed: `mock.module()` requires `--experimental-test-module-mocks`, which none of this
repo's test scripts pass, and `.claude/rules/typescript-unit-testing.md` forbids it outright
("Do not replace modules with `t.mock.module()` or a custom loader; inject the dependency
instead"). Only `edge/handlers/plugin/import.ts` carries a real seam. The three helper modules
**do** take injectable collaborators, which is why D-116-07 lands where the proof is actually
available. The planner must resolve this explicitly rather than let each plan improvise.

The second finding is that **D-116-14's stated targets are the wrong ones.** `router.ts` switches
on an open `string` with a `default` arm — it carries no exhaustiveness claim TypeScript could
enforce or lose. The real hole is `pluginVersion()` in `edge/handlers/tools.ts`, whose
`string | undefined` return type means a missing arm compiles clean. **That claim is wrong and was
corrected during planning:** the repro below omitted `noImplicitReturns`, which `tsconfig.json:11`
sets. With it, a deleted arm in a `default`-less switch raises `TS7030: Not all code paths return a
value.` All four `tools.ts` switches are gated — three by TS2366 and this one by TS7030.

**Primary recommendation:** Sequence a wave 0 that (a) extends `tests/helpers/notification-boundary.ts`
with a `cwd` option and a zero-probe mode, and (b) settles the D-116-05 seam question as one
decision, then run the 30 plans in five waves ordered leaf-first: pure parsers, then the three
helpers, then the marketplace handlers, then the plugin handlers, then the four large surfaces
(`data.ts`, `provider.ts`, `tools.ts`, `register.ts`) and `router.ts`/`types.ts`.

## Project Constraints (from CLAUDE.md)

Extracted from `/home/acolomba/pi-claude-marketplace-unit-test-refactor/CLAUDE.md` and
`.claude/CLAUDE.md`. `[VERIFIED: CLAUDE.md]`

| Directive | Effect on this phase |
|-----------|----------------------|
| Read a file before editing it; trace callers before modifying a function | Each plan must read its paired source and the helper it imports before writing the owner |
| Never commit to `main`; branch names `features/*` | Current branch `features/unit-test-refactor` — correct |
| Conventional Commits; title 5–72 chars; body lines ≤ 80; **no GSD milestone/phase mentions** | Commit subjects must not say "Phase 116" |
| Run `pre-commit run --files <changed files>` **before** `git commit`; never `--all-files`; never `--no-verify`; never `--amend` after a hook failure | See **Environment Facts** — two hooks fail structurally here |
| Worktree commits prefix `SKIP=trufflehog` after confirming clean by the filesystem route | This checkout is a linked worktree; the filesystem route is mandatory |
| Never rebase, never rewrite history | Merge only |
| `npm run check` must stay green (typecheck + ESLint + fallow + Prettier + unit + integration) | Cannot be run as one command here — see Environment Facts |
| All user-visible messages through `ctx.ui.notify` (IL-2); no `process.stdout`/`process.stderr` in extension code | Success criterion 3; already gated — see SC-3/SC-4 section |
| CodeGraph: prefer `codegraph_explore` over grep when a `.codegraph/` directory exists | `.codegraph/` exists (untracked) |
| GSD workflow enforcement: start file-changing work through a GSD command | Plans execute under `/gsd-execute-phase` |

Project rules under `.claude/rules/`: `typescript-unit-testing.md` (the pair contract),
`typescript-comments.md` (comments cite decision/requirement IDs, never planning refs),
`changelog.md`. Project skills under `.claude/skills/`: `simple-english`, `humanizer` — both
documentation-facing, not applicable to test code.

## Environment Facts (measured this session)

Every row below was reproduced by running the command in this working tree on 2026-09-02.

| Fact | Evidence |
|------|----------|
| `npm run check` never reaches the tests | `npm run format:check` exits non-zero on 8 pre-existing untracked operator files: `.mcp.json` and seven `.planning/research/.cache/*.json`. `.prettierignore` contains only `.claude/`, `.opencode/`, `.worktrees/`, `tmp/`, and one fixture path — it covers neither. `[VERIFIED: npm run format:check output; .prettierignore]` |
| `git commit` runs no hooks | `git config core.hooksPath` → `/home/acolomba/pi-claude-marketplace/.git/hooks`; that directory contains `pre-commit.sample` but **no** `pre-commit`. `[VERIFIED: git config + ls of the hooks dir]` |
| **`pre-commit run --files <ts>` also fails today** | Ran `pre-commit run --files tests/edge/router.test.ts`. `npm lint` Passed, `npm typecheck` Passed, `npm fallow` Passed, **`npm format check` Failed** (same 8 files), **`trufflehog` Failed** (`failed to read index file: … /.git/index: not a directory`). `[VERIFIED: pre-commit run output]` |
| Linked worktree | `git rev-parse --git-dir` → `/home/acolomba/pi-claude-marketplace/.git/worktrees/pi-claude-marketplace-unit-test-refactor`. `[VERIFIED]` |
| `workflow.use_worktrees = false` | `[VERIFIED: .planning/config.json]` — plans run sequentially on the shared tree |
| Node runtime | `node --version` → **v26.7.0** locally; `package.json` `engines` floor is `>=20.19.0`; CI pins Node 24. `[VERIFIED: node --version; STACK.md]` |
| Gates green at HEAD | `npm run typecheck` 0, `npm run lint` 0, `npm run fallow` 0. `[VERIFIED: exit codes]` |
| Correspondence gate | `node scripts/check-corresponding-tests.mjs` exits 1 with exactly 14 violations. `[VERIFIED]` |
| `rg` available | ripgrep 15.2.0 at `/usr/bin/rg`. `[VERIFIED]` |
| `npm run test:coverage:direct -- <src>` works | Ran against `edge/handlers/marketplace/info.ts` → `Direct coverage passed: … (branches 2/2, functions 1/1, lines 22/22)`, exit 0. `[VERIFIED]` |

### Consequence: the commit recipe needs an amendment

`.continue-here.md` says "Do not extend `SKIP=` to any other hook." That instruction predates
`npm-format-check` failing. The hook runs `npm run format:check`, which is repo-wide and cannot
pass while the operator's untracked files exist, and touching those files is explicitly
forbidden. Two options, both of which the planner must choose between rather than leaving to
the executor:

1. **Recommended.** `SKIP=trufflehog,npm-format-check pre-commit run --files <paths>`, and
   restore the lost coverage with an explicit `npm exec -- prettier --check <changed paths>`
   in the same verify block. On a `.ts`-only change these two are equivalent in effect, since
   the only files the change can have unformatted are the ones it wrote.
2. Add `.planning/` and `.mcp.json` to `.prettierignore`. This edits a shared repo config
   nobody authorized and would land in the phase's diff. **Not recommended.**

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Argument tokenization and `--scope` validation | `edge/args.ts` | — | Pure string→struct; no I/O, no context |
| Positional schema validation | `edge/args-schema.ts` | `edge/args.ts` | Wraps `parseArgs`, routes failure to an injected `onError` callback |
| Per-verb flag vocabulary | `edge/flag-catalog.ts` | — | Passive typed data + four derivation functions |
| Subcommand + alias dispatch | `edge/router.ts` | — | Pure function over an injected `SubcommandHandlers` record |
| Registration glue (command, completions, session hook, LLM tools) | `edge/register.ts` | `orchestrators/edge-deps.ts` | The one sanctioned `process.cwd()` site |
| Tab completion | `edge/completions/{provider,data,normalize}.ts` | `shared/completion-cache.ts` | Reads through an injected `LocationsResolver`; must never reach the network |
| Flag/arity/scope validation per verb | 17 handler modules | 3 `shared.ts` helpers | Handlers hold no business logic; the helpers hold the only real logic |
| Business workflow | `orchestrators/` (Phases 113–115) | — | **Not this phase's to re-prove** (D-116-05) |
| LLM read-only tools | `edge/handlers/tools.ts` | `orchestrators/{marketplace,plugin}` | Registers two tools; projects notification rows onto a 3-value tool status |

## Per-Pair Inventory

Direct coverage measured by running `node scripts/test-coverage-direct.mjs <source>` once per
pair, 2026-09-02. `[VERIFIED: per-pair sweep, 30 invocations]`

| Plan | Source (under `extensions/pi-claude-marketplace/`) | LOC | Exports | Test at mirrored path | Test LOC | Cases | Direct coverage today |
|------|------|----:|----:|---|----:|----:|---|
| 116-01 | `edge/args-schema.ts` | 96 | 3 | yes | 88 | 4 | **PASS** br 17/17, fn 2/2, ln 96/96 |
| 116-02 | `edge/args.ts` | 89 | 2 | yes | 92 | 13 | FAIL br 25/26, ln 86/89 |
| 116-03 | `edge/completions/data.ts` | 610 | 12 | yes | 334 | 13 | FAIL br 54/64, **fn 25/31**, ln 493/610 |
| 116-04 | `edge/completions/normalize.ts` | 47 | 2 | yes | 87 | 10 | FAIL br 6/8, ln 45/47 |
| 116-05 | `edge/completions/provider.ts` | 335 | 1 | yes | 1670 | 67 | FAIL br 71/78, ln 319/335 |
| 116-06 | `edge/flag-catalog.ts` | 186 | 7 | **NO** | — | — | **missing owner** (D-116-08) |
| 116-07 | `edge/handlers/marketplace/add.ts` | 48 | 1 | yes | 243 | 8 | **PASS** br 8/8, fn 2/2, ln 48/48 |
| 116-08 | `edge/handlers/marketplace/autoupdate.ts` | 61 | 1 | yes | 173 | 8 | FAIL br 13/14, fn 3/4, ln 58/61 |
| 116-09 | `edge/handlers/marketplace/info.ts` | 22 | 1 | yes | 150 | 7 | **PASS** br 2/2, fn 1/1, ln 22/22 |
| 116-10 | `edge/handlers/marketplace/list.ts` | 44 | 1 | yes | 95 | 3 | FAIL br 4/5, fn 2/3, ln 41/44 |
| 116-11 | `edge/handlers/marketplace/remove.ts` | 46 | 1 | yes | 147 | 6 | **PASS** br 7/7, fn 2/2, ln 46/46 |
| 116-12 | `edge/handlers/marketplace/shared.ts` | 134 | 3 | **NO** | — | — | **missing owner** (D-116-08) |
| 116-13 | `edge/handlers/marketplace/update.ts` | 72 | 1 | yes | 153 | 4 | FAIL br 7/9, fn 2/3, ln 64/72 |
| 116-14 | `edge/handlers/plugin/bootstrap.ts` | 88 | 1 | yes | 303 | 8 | **PASS** br 11/11, fn 2/2, ln 88/88 |
| 116-15 | `edge/handlers/plugin/enable-disable.ts` | 87 | 1 | yes | 242 | 10 | FAIL br 14/16 |
| 116-16 | `edge/handlers/plugin/fetch.ts` | 132 | 3 | yes | 190 | 12 | **PASS** br 27/27, fn 4/4, ln 132/132 |
| 116-17 | `edge/handlers/plugin/import.ts` | 66 | 2 | **NO** (misplaced one dir up) | 124 | 5 | **missing owner** (D-116-09) |
| 116-18 | `edge/handlers/plugin/info.ts` | 79 | 1 | yes | 211 | 11 | **PASS** br 17/17, fn 2/2, ln 79/79 |
| 116-19 | `edge/handlers/plugin/install.ts` | 101 | 1 | yes | 337 | 16 | FAIL br 16/17, ln 99/101 |
| 116-20 | `edge/handlers/plugin/list.ts` | 82 | 2 | yes | 166 | 9 | FAIL br 15/17, ln 79/82 |
| 116-21 | `edge/handlers/plugin/pending.ts` | 56 | 1 | yes | 171 | 7 | FAIL br 8/9 |
| 116-22 | `edge/handlers/plugin/reinstall.ts` | 100 | 1 | yes | 336 | 11 | FAIL br 24/25, ln 98/100 |
| 116-23 | `edge/handlers/plugin/shared.ts` | 201 | 7 | **NO** | — | — | **missing owner** (D-116-08) |
| 116-24 | `edge/handlers/plugin/uninstall.ts` | 42 | 1 | yes | 179 | 10 | **PASS** br 10/10, fn 2/2, ln 42/42 |
| 116-25 | `edge/handlers/plugin/update.ts` | 90 | 1 | yes | 401 | 18 | FAIL br 20/22, ln 85/90 |
| 116-26 | `edge/handlers/shared.ts` | 85 | 1 | yes | 79 | 6 | FAIL br 12/14, ln 78/85 |
| 116-27 | `edge/handlers/tools.ts` | 518 | 4 | yes | 952 | 28 | FAIL br 86/106, ln 503/518 |
| 116-28 | `edge/register.ts` | 143 | 2 | yes | 414 | 13 | FAIL br 9/10, **fn 7/9** |
| 116-29 | `edge/router.ts` | 221 | 6 | yes | 291 | 25 | FAIL br 34/37, ln 218/221 |
| 116-30 | `edge/types.ts` | 30 | 1 | **NO** | — | — | **missing owner**, type-only (D-116-08/11) |

**Totals:** 3,911 source LOC; 25 in-scope existing test files at 7,504 LOC and 333 cases;
2 out-of-scope files (`handlers/import.test.ts` 124 LOC, `index-handler.test.ts` 235 LOC).

**Compliance snapshot of what exists:** `grep -c '// arrange'` returns **0** for all 27 files.
`grep -c 'as unknown as'` returns 1–7 for 25 of 27 files. Zero files use `describe()`. `[VERIFIED: per-file grep sweep]`

### Sizing guidance from Phase 115

Phase 115's completed owners land at these test-to-source LOC ratios `[VERIFIED: wc -l]`:

| Pair | Source LOC | Test LOC | Ratio |
|------|----:|----:|----:|
| `orchestrators/reconcile/plan` | 448 | 640 | 1.4 |
| `orchestrators/import/execute` | 1207 | 2454 | 2.0 |
| `orchestrators/reconcile/pending` | 268 | 586 | 2.2 |
| `orchestrators/edge-deps` | 242 | 593 | 2.5 |
| `orchestrators/plugin/bootstrap` | 134 | 356 | 2.6 |
| `orchestrators/reconcile/apply` | 918 | 2774 | 3.0 |
| `orchestrators/import/types` (type-only) | 99 | 364 | 3.7 |
| `orchestrators/import/index` (barrel) | 8 | 73 | 9.1 |

Applying 1.4×–3.0× to the 3,881 runtime-bearing source LOC gives **5,400–11,600** lines of new
test code for this phase, median around 8,500. The three largest single plans by expected output
are 116-03 (`data.ts`, 610 LOC → ~1,200–1,800), 116-27 (`tools.ts`, 518 → ~1,000–1,550), and
116-05 (`provider.ts`, 335 → ~700–1,000). Those three plus 116-23 (`plugin/shared.ts`, 201) and
116-29 (`router.ts`, 221) should each be sized as a full plan on its own; the eight sources under
50 LOC can be planned tightly.

## Correspondence Gate: All 14 Violations, Verbatim and Attributed

`node scripts/check-corresponding-tests.mjs`, exit 1. `[VERIFIED: command output]`

```
missing-test: tests/edge/flag-catalog.test.ts
missing-test: tests/edge/handlers/marketplace/shared.test.ts
missing-test: tests/edge/handlers/plugin/import.test.ts
missing-test: tests/edge/handlers/plugin/shared.test.ts
missing-test: tests/edge/types.test.ts
missing-test: tests/index.test.ts
unexpected-test: tests/bridges/integration-materialization-gate.test.ts
unexpected-test: tests/edge/handlers/import.test.ts
unexpected-test: tests/edge/index-handler.test.ts
unexpected-test: tests/helpers/source-scan.test.ts
unexpected-test: tests/orchestrators/marketplace/cascade.test.ts
unexpected-test: tests/orchestrators/plugin/cross-surface-reason-parity.test.ts
unexpected-test: tests/shared/device-flow-prompt.test.ts
unexpected-test: tests/shared/index-smoke.test.ts
Corresponding-test gate failed with 14 violation(s).
```

| # | Violation | Owner | Disposition |
|---|-----------|-------|-------------|
| 1 | `missing-test: tests/edge/flag-catalog.test.ts` | **116** | Plan 116-06 writes it |
| 2 | `missing-test: tests/edge/handlers/marketplace/shared.test.ts` | **116** | Plan 116-12 writes it |
| 3 | `missing-test: tests/edge/handlers/plugin/import.test.ts` | **116** | Plan 116-17, satisfied by the `git mv` in D-116-09 |
| 4 | `missing-test: tests/edge/handlers/plugin/shared.test.ts` | **116** | Plan 116-23 writes it |
| 5 | `missing-test: tests/edge/types.test.ts` | **116** | Plan 116-30 writes it |
| 6 | `unexpected-test: tests/edge/handlers/import.test.ts` | **116** | Cleared by the same `git mv` (D-116-09) — one move closes #3 and #6 together |
| 7 | `unexpected-test: tests/edge/index-handler.test.ts` | **116** (lives under `tests/edge/`) | **Left alone** (D-116-10); its source is the root `index.ts`, which Phase 117 owns |
| 8 | `missing-test: tests/index.test.ts` | 117 | — |
| 9 | `unexpected-test: tests/bridges/integration-materialization-gate.test.ts` | 117 | — |
| 10 | `unexpected-test: tests/helpers/source-scan.test.ts` | 117 | — |
| 11 | `unexpected-test: tests/orchestrators/marketplace/cascade.test.ts` | 117 | — |
| 12 | `unexpected-test: tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` | 117 | — |
| 13 | `unexpected-test: tests/shared/device-flow-prompt.test.ts` | 117 | — |
| 14 | `unexpected-test: tests/shared/index-smoke.test.ts` | 117 | — |

**Phase 116 closes six of its seven, leaving 8 repo-wide violations at phase exit.** This matches
D-116-08/09/10 exactly. The `git mv` must land in the same plan as the rewrite so the pair stays
atomic — the gate rejects a moved file whose source pair does not exist.

Confirmed by reading: `tests/edge/handlers/import.test.ts:4` imports
`../../../extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts` — the file already
targets the right source from the wrong directory. `tests/edge/index-handler.test.ts` is a
`resources_discover` wiring proof against the root `index.ts`. `[VERIFIED: file headers]`

## D-116-05 Seam Analysis — the phase's central open question

**This section is the one the planner must read before sizing anything.**

D-116-05 says handler owners "assert the orchestrator was called with exact arguments." I checked
every handler's factory signature and import list. `[VERIFIED: extensions/pi-claude-marketplace/edge/handlers/**/*.ts]`

### Group A — a real orchestrator seam exists (1 module)

`edge/handlers/plugin/import.ts:45` `[VERIFIED: import.ts:14-51]`:

```ts
export interface ImportHandlerDeps {
  readonly gitOps: GitOps;
  readonly importClaudeSettings?: (
    opts: ImportClaudeSettingsOptions,
  ) => Promise<ClaudeImportExecutionResult>;
}
…
    await (deps.importClaudeSettings ?? importClaudeSettings)({ … });
```

This is the only handler that can honour D-116-05 literally. Its owner (116-17) uses
`mock<NonNullable<ImportHandlerDeps["importClaudeSettings"]>>({ exactParams: true, … })` with a
`when(() => …({ ctx, pi, cwd, selectedScopes: […], gitOps }))` stating the complete options
object, then `verify()`. The `?? importClaudeSettings` fallback branch is a distinct branch that
must also be covered — the only way to cover it is to omit the member and let the real
orchestrator run against a hermetic tree.

### Group B — an injected port exists, but it is not the orchestrator (3 modules)

| Module | Injected through `EdgeDeps` | Orchestrator reached by |
|--------|------------------------------|-------------------------|
| `marketplace/add.ts:25` | `deps.gitOps` | direct import of `addMarketplace` |
| `marketplace/update.ts:26` | `deps.gitOps`, `deps.pluginUpdate` | direct import of `updateMarketplace` / `updateAllMarketplaces` |
| `plugin/bootstrap.ts:35` | `deps.gitOps` | direct import of `bootstrapClaudePlugin` |

For these, the exact-argument proof available is that the handler **forwards the identical port
object** into the orchestrator's options bag. `tests/platform/git-ops-fake.ts` already exports
`createGitOpsFake({ boundary: "memory", … })` with a `calls` recorder, which is the right
collaborator here. `[VERIFIED: tests/platform/git-ops-fake.ts:76]`

### Group C — no injectable collaborator at all (13 modules)

`marketplace/{autoupdate,info,list,remove}.ts` and
`plugin/{enable-disable,fetch,info,install,list,pending,reinstall,uninstall,update}.ts`. Each
factory takes only `pi: ExtensionAPI` (two of them additionally take a `boolean` mode flag), and
each imports its orchestrator directly. Example, `plugin/install.ts:23,45` `[VERIFIED]`:

```ts
import { installPlugin } from "../../../orchestrators/plugin/install.ts";
…
export function makeInstallHandler(pi: ExtensionAPI): (args, ctx) => Promise<void> {
```

### Why module mocking is not available

Two independent blocks, both measured:

1. **Runtime.** `mock.module()` from `node:test` requires `--experimental-test-module-mocks`.
   Without the flag the call is `TypeError: mock.module is not a function`; with it, my probe
   successfully intercepted `uninstallPlugin` and captured
   `{"ctx":…,"pi":…,"cwd":"/tmp","marketplace":"m","plugin":"p"}`. None of `npm test`,
   `npm run test:coverage:unit`, or `scripts/test-coverage-direct.mjs` passes that flag.
   `[VERIFIED: two probe runs, node v26.7.0]`
2. **Contract.** `.claude/rules/typescript-unit-testing.md` § Test doubles → Scope states
   verbatim: *"Do not replace modules with `t.mock.module()` or a custom loader; inject the
   dependency instead."* `[VERIFIED: .claude/rules/typescript-unit-testing.md]`

The rule's remedy list is explicit about what to do instead: *"Make exactly one of these changes
when a module resists testing: … 2. Make an existing hidden dependency an explicit parameter or
dependencies-object member. 3. Inject a side-effecting port through a narrow interface declared
in the consumer module."* Note it also says *"Do not default a parameter to a live boundary"* —
which the existing `deps.importClaudeSettings ?? importClaudeSettings` fallback technically
violates, so copying that shape 13 more times is not a clean answer either.

### The four options, with costs

| Option | What it means | Cost | Risk |
|--------|---------------|------|------|
| **O1. Production injection** | Add an orchestrator parameter to each Group-C factory, wired at the one composition site (`register.ts:79-99`) | 13 handler signatures + `register.ts` + possibly `edge/types.ts`; touches production in a test-refactor milestone; every change is compile-checked at exactly one call site | Medium. Mechanical and type-safe, but it enlarges the phase diff and CONTEXT.md nowhere authorizes production change |
| **O2. Real orchestrator, hermetic tree** | Keep the current shape; run the real orchestrator against `mkdtemp` roots and assert the resulting notification + on-disk tree | Zero production change; matches what all 25 existing files already do | High. This is exactly the D-20/D-22 re-derivation D-116-05 exists to remove, and it makes each handler owner depend on orchestrator behavior Phase 113–115 already owns |
| **O3. Split the promise** | Group A and B get exact-argument mocks; Group C gets *negative* exact proof only — the orchestrator was **not** called (D-116-06) — plus complete edge-side coverage of parse/flag/arity/scope, with the positive delegation observed as a single minimal effect | Zero production change; honours D-116-06 fully and D-116-05 partially | Low-medium. The gap is honest and localizable; needs the planner to write it down as a scoped exception |
| **O4. Enable the flag** | Add `--experimental-test-module-mocks` to `npm test`, `test:coverage:unit`, and `scripts/test-coverage-direct.mjs` | 3 script edits | High. Directly contradicts the project rule; would need the rule amended, which is out of this phase's scope |

**Recommendation: O3, with O1 reserved for a follow-up.** O3 keeps the phase a test refactor,
delivers D-116-06 in full (see the mechanism below), and delivers D-116-05 in full for the four
modules where a seam exists and for all three helper modules — which is where the logic actually
lives. Record the Group-C gap explicitly in each affected plan's `must_haves` so the verifier
does not read it as a miss. If the operator wants O1, it should be its own decision, not
smuggled in per plan.

### The D-116-06 mechanism, verified

`createNotificationBoundary(emissions, toolProbes)` in `tests/helpers/notification-boundary.ts`
builds `mock<ExtensionContext>` + `mock<ExtensionAPI>` + `mock<NotificationUi>` with
`when(() => ctx.ui).thenReturn(ui).times(emissions)`. `[VERIFIED: tests/helpers/notification-boundary.ts:48-77]`

I probed strong-mock 9's overrun behavior: a property access past its `times()` count returns a
function, the **call** throws `Didn't expect ui.notify("x") to be called. No remaining
expectations.`, and `verify()` then fails with `The following calls were unexpected`.
`[VERIFIED: two probe runs in-repo]`

Therefore, for a Group-C handler, `createNotificationBoundary(1, 0)` plus `verifyBoundary()`
proves the orchestrator never ran: the handler's own usage error consumes the single allowed
emission, and any orchestrator notification would be a second one. That is a genuine
"no state-changing workflow ran" proof and it is mechanical across all 13 modules.

### Two required fixes to `tests/helpers/notification-boundary.ts`

Both measured by running the helper against `makeUninstallHandler`:

1. **`toolProbes` must be 0 for usage-error emissions.** `notifyUsageError` does **not** run the
   soft-dependency probe, so the helper's default `toolProbes = emissions * 2` leaves an unmet
   expectation and `verifyBoundary()` fails with
   `when(() => extension API.getAllTools()).thenReturn([]).between(2, 2)`. Callers must pass
   `createNotificationBoundary(1, 0)`. `notify()` (used by `bootstrap.ts` and
   `enable-disable.ts`) does probe, so those owners keep the default. `[VERIFIED: probe run]`
2. **`ctx.cwd` is not stated.** Every edge handler passes `cwd: ctx.cwd` into its orchestrator.
   With `cwd` unstated the mock hands back a function and the orchestrator dies with
   `The "path" argument must be of type string. Received function`. The helper needs an optional
   `cwd` so ~20 owners do not each hand-roll a variant. `[VERIFIED: probe run]`

This helper change is shared by roughly twenty of the thirty plans and must land **first**, in a
wave 0, with its own negative control. It is the single highest-leverage item in the phase.

## The Three Helper Modules (D-116-07)

`[VERIFIED: the three source files, read in full this session]`

### `edge/handlers/shared.ts` — 85 LOC, 1 export, plan 116-26

`extractLocalFlag(args, ctx, usage, passThroughLongFlags = [])` returns
`{ local: boolean; residualArgs: string } | undefined`. Behavior worth an owner:

- consumes `--scope <value>` as a **pair** (`i += 2`) without validating the value
- recognises `SCOPE_TARGET_FLAG` (`--local`, imported from the catalog) and sets `local`
- passes through any long flag in `passThroughLongFlags` verbatim into `residualArgs`
- rejects any other `--` flag via `notifyUsageError` and returns `undefined`
- **removes every `--local` token** from `residualArgs` (the WR-02 regression fix) while
  preserving other pass-through flags
- a `tok === undefined` guard that `break`s — reachable only through the tokenizer's own shape

**Importers:** `marketplace/{autoupdate,shared}.ts`, `plugin/{enable-disable,install,reinstall,uninstall,update}.ts`
— 7 modules. Those handler owners assert only that `extractLocalFlag` was given the right
`(args, ctx, usage, passThrough)` and that its residual reached the next stage; they do not
re-prove flag-position independence.

### `edge/handlers/marketplace/shared.ts` — 134 LOC, 3 exports, plan 116-12 (new)

- `type SingleNameMarketplaceRun` — the `(opts) => Promise<unknown>` delegate shape
- `makeSingleNameMarketplaceHandler(pi, usage, run)` — **`run` is an injected collaborator.**
  This is the one place at the marketplace tier where a `strong-mock` with exact arguments is
  directly available, and it is what makes 116-09 and 116-11 (`info`, `remove`) thin
- `openMarketplaceCommand<N>(args, ctx, { usage, positionalName })` — `extractLocalFlag` first
  (WB-01), then `parseCommandArgs` with the caller's single positional, collapsing the
  duplicate-usage case to `"Missing required argument."`

**Importers:** `marketplace/{add,info,remove}.ts`.

### `edge/handlers/plugin/shared.ts` — 201 LOC, 7 exports, plan 116-23 (new)

The largest helper and the largest new file.

- `splitPluginMarketplaceRef(ref)` — rejects no-`@`, leading-`@` (`atIdx <= 0`), trailing-`@`
- `parsePositionalsWithFlags` (module-private) over `DOWNSTREAM_BOOLEAN_FLAGS`, a `Set` built
  from `passThroughFlagNames("install") ∪ passThroughFlagNames("update")`
- `parseMapModelArgs(args, ctx, usage)` — `parseArgs` with `errorMessage(err)` on throw, then
  the flag scan; carries `scope` through a conditional spread
- `parseRequiredPluginMarketplaceRef(args, ctx, usage)`
- `withParsedArgs(parse, usage, run)` — **`run` is an injected collaborator**, same lever as
  the marketplace helper

**Importers:** `plugin/{enable-disable,fetch,info,install,list,pending,reinstall,uninstall,update}.ts`
— 9 modules.

**Implication for wave order:** 116-26, 116-12, and 116-23 must precede the handler plans that
import them, so the handler plans can state their delegation assertions against a settled helper
contract rather than inventing one.

## D-116-14 — Recommendation: apply case by case, and correct the premise

CONTEXT.md states "`router.ts` and the handler dispatch tables are exactly this shape." **That is
not what the code does.** `[VERIFIED: edge/router.ts:148,197; edge/completions/provider.ts:190]`

`router.ts:148` and `router.ts:197` switch on `head`, which is `string` (peeled from raw user
input), and both have a `default:` arm that emits a usage error. There is no closed union and no
exhaustiveness claim TypeScript could enforce. Same for
`provider.ts:190 pluginRefBranchConfig(positionalHead: string, …)`, which ends `default: return null`.
Planting a "missing arm" in any of these produces a *behavior* change (an unknown subcommand),
not a compiler diagnostic — that is a normal runtime case, not an exhaustiveness gate.

The `SubcommandHandlers` record built at `register.ts:79-99` **is** compile-enforced: a missing
key fails to satisfy the interface. Testing that is forbidden by D-116-12.

### The four switches that do carry a claim, all in `edge/handlers/tools.ts` (plan 116-27)

| Site | Signature | Sound? |
|------|-----------|--------|
| `tools.ts:161` `projectRowStatus` | `(status: PluginNotificationMessage["status"]) => ToolPluginStatus`, no `default` | **Yes** — non-nullable return |
| `tools.ts:210` `statusLabel` | `(status: ToolPluginStatus) => string`, no `default` | **Yes** |
| `tools.ts:253` `statusKey` | `(status: ToolPluginStatus) => "i" \| "a" \| "u"`, no `default` | **Yes** |
| `tools.ts:367` `pluginVersion` | `(p: PluginNotificationMessage) => string \| undefined`, no `default` | **Yes, but via TS7030 rather than TS2366** — corrected during planning; the repro below omitted `noImplicitReturns` |

I confirmed the rule with a compiler repro this session `[VERIFIED: tsc --noEmit --strict on a
3-function file, exit 2 with exactly one diagnostic]`:

```
repro.ts(4,36): error TS2366: Function lacks ending return statement and return type does not include 'undefined'.
```

Only the non-nullable value-returning function raised TS2366. The `string | undefined` variant and
the `void` variant both compiled silently **under that repro's flags**. Re-running with
`noImplicitReturns`, which this repository sets, raises `TS7030` for the `string | undefined`
variant. `pluginVersion` is therefore **gated**, not a hole; only the `void` variant is genuinely
unguarded.

### Recommendation

1. **Do not adopt D-116-14 as a phase-wide rule.** Twenty-six of the thirty pairs have no switch
   at all, and the three that do (`router.ts`, `provider.ts`) switch on open `string` with a
   `default`. A phase-wide rule would manufacture ceremony where no guarantee exists.
2. **Apply it to plan 116-27 specifically.** For `projectRowStatus`, `statusLabel`, and
   `statusKey`, plant one deleted arm and confirm `npm run typecheck` goes RED; record each
   plant. For `pluginVersion`, plant the same way and expect **RED with `TS7030`**, not green — the
   original prediction of a clean compile omitted `noImplicitReturns`.
3. **State in every other plan that the phase makes no exhaustiveness claim for that pair**, so
   a verifier does not go looking for a plant that has no target.

## Success Criteria 3 and 4 — what the existing gates already cover

### SC-3: "never write directly to stdout or stderr"

Already enforced by **two independent gates**, neither of which is a test:

- ESLint `no-restricted-syntax` BLOCK A, scoped to `extensions/pi-claude-marketplace/**/*.ts`,
  at `eslint.config.js:94-140`. Selectors forbid `process.stdout.write` (`:100`),
  `process.stderr.write` (`:106`), `console.log` (`:111`), `console.info` (`:126`), and
  **direct `ctx.ui.notify` outside `shared/notify.ts`** (`:132`). `[VERIFIED: eslint.config.js]`
- `.fallowrc.json` `boundaries.calls.forbidden`, per zone. `[CITED: .planning/codebase/CONVENTIONS.md]`

**Therefore: no per-owner proof of stdout/stderr discipline.** Writing one would be exactly the
"do not test what a gate already enforces" pattern that `.claude/rules/typescript-unit-testing.md`
§ Patterns and D-116-12 forbid. The *positive* half of SC-3 — "report exact public results
through `ctx.ui.notify(message, severity)`" — is proven naturally and completely by every owner's
whole-value notification assertion through `createNotificationBoundary`, which is the only path
by which a message can reach `ui.notify` in a test.

### SC-4: "read-only edge paths remain offline"

**Not covered by any existing gate.** `tests/architecture/no-orchestrator-network.test.ts` names
five specific orchestrator files (`orchestrators/plugin/{install,list,reinstall,info}.ts` and
`orchestrators/marketplace/info.ts`) and greps them for `gitOps`/`platform/git`/`DEFAULT_GIT_OPS`
surface. It says nothing about `edge/`. `[VERIFIED: test file header + assertion]`

So SC-4 **does** need per-owner proof, and Phase 115 already established the shape. From
`tests/orchestrators/edge-deps.test.ts:69-110` `[VERIFIED]`:

```ts
function refuseNetwork(): Promise<Response> {
  throw new Error("the completion resolver must not reach the network");
}
…
const fetchSpy = t.mock.method(globalThis, "fetch", refuseNetwork);
…
fetchCallCount(): number { return fetchSpy.mock.callCount(); }
```

Apply it to the read-only edge surfaces: `completions/{provider,data}.ts` (116-03, 116-05),
`marketplace/{info,list}.ts` (116-09, 116-10), `plugin/{info,list,pending}.ts` (116-18, 116-20,
116-21), and `handlers/tools.ts` (116-27). Assert `fetchCallCount() === 0`.

### The four architecture tests that reach into `edge/`

`grep -l 'edge/' tests/architecture/*.test.ts` returns exactly four. `[VERIFIED]`

| File | What it asserts about `edge/` | Effect on this phase |
|------|-------------------------------|----------------------|
| `flag-catalog-drift.test.ts` (156 LOC) | (a) `getArgumentCompletions("<verb> -")` emitted labels == catalog `complete:true` names, per verb, exact set, for every `CATALOG_VERBS` entry plus the `ls` alias; (b) `BOOLEAN_FLAGS` from `plugin/list.ts` == catalog `list` parse-set minus `--local`, and `info` carries `--fetch`; (c) an exact per-verb parse-set pin table | **116-06 must not re-pin the catalog's per-verb contents.** It owns the four derivation *functions* (`isCatalogVerb`, `CATALOG_VERBS`, `completionFlagEntries` filter/order/optional-description, `parseFlagNames`, `passThroughFlagNames`'s scope-target exclusion), not the data table |
| `scope-fences-63.test.ts` (205 LOC) | SURF-04: no `/claude:plugin hooks` edge handler exists (perma-forbidden); no hook-count column on `list` | Negative surface guard; 116-20 and 116-29 need not restate it |
| `partial-vocabulary-guard.test.ts` (498 LOC) | D-75-01: retired force/partial tokens absent from the whole extension tree, docs, and arch tests; completion descriptions carry no plugin-level `unsupported` | Constrains what strings 116-03/116-05 may assert; do not restate the guard |
| `scope-order-drift.test.ts` (163 LOC) | No `["user","project"]` literal outside the canonical `SCOPES` declaration; no scope-rank ternary outside the canonical comparator | Owners must not hand-roll a scope-order literal |

## Closest Analogs

| Need | Copy from | Why |
|------|-----------|-----|
| Type-only owner (116-30) | `tests/orchestrators/types.test.ts` (578 LOC) | The richest of the six. Demonstrates both `@ts-expect-error` placements D-116-13 cares about: **above** a single-line `satisfies` (`:335`) and on the **last property line** of a multi-line one (`:249, :258, :272`). Also shows the `proveReadonlyContracts(…)` function pattern for readonly negatives (`:559-576`) |
| Type-only owner, shorter | `tests/bridges/skills/types.test.ts` (221 LOC), `tests/bridges/commands/types.test.ts` (221) | Right scale for `edge/types.ts`'s single 3-member interface. **`edge/types.ts` imports `GitOps` and `PluginUpdateFn` from other pairs** — 116-30 must pin only `EdgeDeps`'s own required/optional split; `PluginUpdateFn`'s contract is already owned by `tests/orchestrators/types.test.ts:196-201,464-480` |
| Exact-argument interaction mock | `tests/orchestrators/import/execute.test.ts:384-452` | The one completed `strong-mock` + `when` + `verify` case with a whole options object stated. Also shows the discipline of deriving every double's type from the module's own seam (`:51-70`) so a seam change is a compile error in the suite |
| Hermetic tree + env restore + offline proof | `tests/orchestrators/edge-deps.test.ts:78-110` | `createHermeticScope(t, label)`: two `mkdtemp` roots, `HOME` and `PI_CODING_AGENT_DIR` saved with `Object.hasOwn` and restored in `t.after()` **registered before the act**, plus the `refuseNetwork` fetch replacement |
| Pi notification boundary | `tests/helpers/notification-boundary.ts` | Already shared. Needs the two fixes named above |
| `GitOps` double (Group B) | `tests/platform/git-ops-fake.ts` — `createGitOpsFake({ boundary: "memory", … })` with a typed `calls` recorder | Already exists and is already used by Phase 115 |
| Marketplace state seeding | `tests/helpers/marketplace-seed.ts` — `buildInstalledPluginRecord`, `mergeMarketplaceIntoState`, `seedAutoupdateConfig`, `materializeMarketplaceTree` | For any owner that must present a realistic state tree |

## Verify Commands

The Phase 115 per-task shape, reproduced from `115-01-PLAN.md:164`. Every component was
re-checked in this working tree today.

```bash
node --test tests/edge/<pair>.test.ts \
  && npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/<pair>.ts \
  && npm run typecheck \
  && npm exec -- eslint tests/edge/<pair>.test.ts \
  && npm exec -- prettier --check tests/edge/<pair>.test.ts \
  && npm run fallow \
  && ! rg -n '(?:test|t)\.(?:only|skip|todo)\(|node:coverage ignore|c8 ignore|as unknown as|as any|anyTimes\(\)|It\.isAny\(\)|verifyAll\(|//[[:space:]]+(Arrange|Act|Assert)' tests/edge/<pair>.test.ts \
  && rg -c '^\s+// arrange$' tests/edge/<pair>.test.ts \
  && git diff --check -- tests/edge/<pair>.test.ts \
  && git diff --quiet -- extensions/pi-claude-marketplace/edge/<pair>.ts
```

| Component | Status here | Note |
|-----------|-------------|------|
| `node --test <file>` | works | |
| `npm run test:coverage:direct -- <source>` | works, exit 0 on a passing pair | Prints a whole-repo coverage table before the pair verdict; read the last line, not the table |
| `npm run typecheck` | exit 0 at HEAD | |
| `npm exec -- eslint <file>` | exit 0 | |
| `npm exec -- prettier --check <file>` | exit 0 | Per-file form; **use this instead of `npm run format:check`**, which fails on operator files |
| `npm run fallow` | exit 0 at HEAD, ~2 min | Check the exit code — `health` and `dupes` print `✗`-prefixed summary lines on success |
| `rg` greps | ripgrep 15.2.0 present | |
| `git diff --quiet -- <source>` | works | The "production must not change" pin |

### Adjustments needed for the edge tier

1. **Add the source path to the `git diff --quiet` pin for every helper the pair imports**, not
   just its own source. A handler plan that quietly "fixes" `handlers/shared.ts` to make its own
   proof easier would otherwise slip through. Suggested per-plan pin: the pair's own source plus
   all three `shared.ts` files plus `edge/flag-catalog.ts`.
2. **Add `tests/helpers/notification-boundary.ts` to the pin** for every plan after wave 0, so
   only the wave-0 plan may change the shared helper.
3. **Add an anti-pattern grep for module mocking**: `mock\.module\(|--experimental-test-module-mocks`.
   The rule forbids it and the seam pressure in Group C makes it the likeliest wrong turn.
4. **Do not include `npm run check`** in any verify block. It short-circuits at `format:check`
   and never runs the tests, so a green result would be meaningless. Run
   `npm run typecheck`, `npm run lint`, `npm run fallow`, `npm test`, and
   `npm run test:integration` separately and check each exit code.
5. **The commit step**, per the Environment Facts section:
   `SKIP=trufflehog,npm-format-check pre-commit run --files <explicit paths>`, preceded by the
   filesystem trufflehog route from CLAUDE.md and a per-file `prettier --check`.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Pi notification capture | A per-suite `makeCtx()` returning `{ notify: (m,s) => notifications.push(...) } as unknown as ExtensionCommandContext` | `createNotificationBoundary(emissions, toolProbes)` from `tests/helpers/notification-boundary.ts` | All 25 existing files hand-roll it with `as unknown as`. WR-08 already consolidated four copies; a sixth drift would weaken the IL-2 sizing proof silently |
| Hermetic `HOME` + agent dir | An ad-hoc `withHermeticHome()` with `finally` cleanup | The `createHermeticScope(t, label)` shape from `tests/orchestrators/edge-deps.test.ts:85` | `getAgentDir()` reads `PI_CODING_AGENT_DIR` **before** `homedir()`, so a hermetic `HOME` alone does not isolate. `finally` also leaks when the case throws before the `try` |
| Git port double | A `{ clone: () => …, fetch: () => … }` literal | `createGitOpsFake({ boundary: "memory", … })` from `tests/platform/git-ops-fake.ts` | Already typed against the production `GitOps`, already records calls |
| Offline assertion | Asserting a network error message | `t.mock.method(globalThis, "fetch", refuseNetwork)` + `callCount() === 0` | An error-message assertion passes for the wrong error |
| Orchestrator interception | `mock.module()` | Nothing — see the Seam Analysis | Forbidden by rule and unavailable at runtime |
| Exhaustiveness alarm | A runtime test enumerating a union's members | A value-returning switch with a non-nullable return type | A test observes shape; only the compiler observes the switch. See D-116-12 |

## Common Pitfalls

### Pitfall 1: `createNotificationBoundary(1)` fails on a usage-error path

**What goes wrong:** `verifyBoundary()` throws `There are unmet expectations: when(() =>
extension API.getAllTools()).thenReturn([]).between(2, 2)`.
**Why:** the default `toolProbes = emissions * 2` assumes `notify()`, which runs a soft-dependency
probe. `notifyUsageError` does not probe.
**Avoid:** `createNotificationBoundary(1, 0)` for every usage-error case. Use the default only
for `bootstrap.ts` and `enable-disable.ts`, the two handlers that call `notify()`.
**Warning sign:** an unmet-expectation failure naming `getAllTools`.

### Pitfall 2: `ctx.cwd` is not stated on the boundary mock

**What goes wrong:** the orchestrator dies with
`The "path" argument must be of type string. Received function`.
**Why:** strong-mock returns a call-throwing function for an unstated property; `path.join` gets
it and fails with a message that names nothing about the mock.
**Avoid:** extend the shared helper with a `cwd` option in wave 0.

### Pitfall 3: a `git mv` split across two commits breaks the correspondence gate

**What goes wrong:** `pairForPath` throws `Missing source-test pair member` for the intermediate
state.
**Why:** `scripts/check-corresponding-tests.mjs:63-67` requires **both** members of every changed
pair to exist on disk. `[VERIFIED: script source]`
**Avoid:** plan 116-17 performs the `git mv` and the rewrite in one atomic commit.

### Pitfall 4: rewriting a pair that already passes and losing coverage

**What goes wrong:** eight pairs are at 100 percent today; deleting a case that happened to be the
only thing exercising a branch drops the pair below the gate.
**Why:** the passing pairs (116-01, -07, -09, -11, -14, -16, -18, -24) got there by running the
real orchestrator, which incidentally covered handler branches. An outcome-thin rewrite removes
that execution.
**Avoid:** re-measure with `npm run test:coverage:direct` after every rewrite, including the eight
that pass now. Phase 115's plan for `edge-deps.ts` called this out explicitly for the same reason.
**Warning sign:** `Incomplete direct coverage for … : branches N-1/N`.

### Pitfall 5: re-pinning the flag catalog in 116-06

**What goes wrong:** `tests/edge/flag-catalog.test.ts` restates the per-verb flag sets that
`tests/architecture/flag-catalog-drift.test.ts` already pins exactly.
**Why:** the natural way to test `completionFlagEntries("install")` is to assert its output, which
names the flags.
**Avoid:** frame the owner's promise as the *transformation* — "returns the `complete: true`
entries in catalog order, carrying `description` only when the entry has one" — and use the
smallest verb that discriminates each branch (`info` has one entry with a description, `fetch` has
zero entries, `uninstall` has one entry without a description).

### Pitfall 6: a plant that has no target

**What goes wrong:** an executor tries to plant a missing switch arm in `router.ts` per D-116-14
and finds the compiler indifferent, then concludes the gate is broken.
**Why:** `router.ts` switches on open `string` with a `default` arm — there is no exhaustiveness
guarantee to lose.
**Avoid:** the plans state per pair whether an exhaustiveness claim exists. Only 116-27 has one.

### Pitfall 7: `test-only export` in `plugin/list.ts`

**Observation, not a required action.** `edge/handlers/plugin/list.ts:82` carries
`export { BOOLEAN_FLAGS };`. `grep` shows the only consumer outside the file is
`tests/architecture/flag-catalog-drift.test.ts:48`. `[VERIFIED: repo-wide grep]` The pair rule
says "Do not export a symbol for a test", but removing it would break a passing architecture
gate, and this phase is not authorized to change production. **Flag it to the operator; do not
act on it in 116-20.**

## Recommended Wave Structure

Sequential execution (`use_worktrees=false`), so waves are ordering constraints, not parallelism.

| Wave | Plans | Rationale |
|------|-------|-----------|
| **0** | Shared-helper change: `tests/helpers/notification-boundary.ts` gains a `cwd` option and callers pass explicit `toolProbes`. Plus the D-116-05 seam decision, recorded. | ~20 downstream plans depend on it. Needs its own negative control and a re-run of every suite that already imports it |
| **1** | 116-01 `args-schema`, 116-02 `args`, 116-04 `normalize`, 116-06 `flag-catalog`, 116-30 `types` | Pure functions and one type-only module. No context, no orchestrator, no seam question. The cheapest place to prove the recipe |
| **2** | 116-26 `handlers/shared`, 116-12 `marketplace/shared`, 116-23 `plugin/shared` | D-116-07. Must precede every handler that imports them. `plugin/shared` (201 LOC, 7 exports, 9 importers) is the phase's largest helper |
| **3** | 116-07..116-13 marketplace handlers (add, autoupdate, info, list, remove, update) | Smallest handler group (22–72 LOC each); four of six already pass coverage |
| **4** | 116-14..116-25 plugin handlers (bootstrap, enable-disable, fetch, import, info, install, list, pending, reinstall, uninstall, update) | 11 plans, 42–132 LOC each. 116-17 carries the `git mv` |
| **5** | 116-03 `completions/data` (610), 116-05 `completions/provider` (335), 116-27 `handlers/tools` (518), 116-28 `register` (143), 116-29 `router` (221) | The four large surfaces plus the router. 116-27 carries the whole D-116-14 obligation; 116-28 depends on every handler factory being settled |

Per the operator preference recorded in CONTEXT.md § Specific Ideas: if a plan runs out of room,
**stop and report exactly which cases are done and which remain**. Do not sample and do not shrink
a matrix to fit. 116-03, 116-05, and 116-27 are the three most likely to need a partial-completion
report.

## Runtime State Inventory

Phase 116 is a test-file refactor with one `git mv`. Runtime-state categories, answered explicitly:

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data | None — no database, no service, no persisted key carries an edge test path | none |
| Live service config | None — no external service references `tests/edge/**` | none |
| OS-registered state | None | none |
| Secrets/env vars | None. The tests read and restore `HOME` and `PI_CODING_AGENT_DIR` per case; nothing persists | none |
| Build artifacts | None — `noEmit: true`, no build step; Node runs `.ts` natively. `coverage/` is regenerated per run and gitignored | none |
| **Path-sensitive gates** | `scripts/check-corresponding-tests.mjs` derives the test path from the source path mechanically; the `git mv` in 116-17 changes what it reports | The move and the rewrite must be one commit (Pitfall 3) |
| **Source-walk gates** | `tests/architecture/flag-catalog-drift.test.ts:48` imports `BOOLEAN_FLAGS` from `edge/handlers/plugin/list.ts`; three other architecture tests grep `edge/` paths | No production file moves in this phase, so these stay intact. Re-run `npm test` at each wave boundary to confirm |

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | test runner, TS strip | ✓ | v26.7.0 (floor `>=20.19.0`, CI Node 24) | — |
| `node --test` + `--experimental-test-coverage` | every plan | ✓ | built in | — |
| `strong-mock` | interaction mocks | ✓ | `^9.2.2` in devDependencies | — |
| `typescript` (`tsc --noEmit`) | typecheck + `@ts-expect-error` negatives | ✓ | `^6.0.3` | — |
| `eslint` | per-file lint | ✓ | `^10.4.0` | — |
| `prettier` | per-file format check | ✓ | `^3.8.3` | — |
| `fallow` | dead-code / health / dupes | ✓ | `^3.17.0` | — |
| `rg` (ripgrep) | anti-pattern greps in verify blocks | ✓ | 15.2.0 | `grep -E` |
| `pre-commit` | commit gate | ✓ but **2 hooks fail structurally** | — | `SKIP=trufflehog,npm-format-check` + per-file `prettier --check` |
| `--experimental-test-module-mocks` | would enable `mock.module()` | ✗ (flag not passed by any script) | — | **None — forbidden by project rule. See Seam Analysis** |
| Network | nothing in this phase | not needed | — | Owners assert `fetch` was never called |

**Missing with no fallback:** module mocking. This is the constraint behind the D-116-05 open
question, not an environment defect to fix.

## Validation Architecture

### Test framework

| Property | Value |
|----------|-------|
| Framework | `node:test` (built in, Node 26.7 local / 24 CI) + `node:assert/strict` + `strong-mock ^9.2.2` |
| Config file | none — suites are selected by glob in `package.json` scripts |
| Quick run command | `node --test tests/edge/<pair>.test.ts` |
| Pair coverage command | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/edge/<pair>.ts` |
| Full unit suite | `npm test` (4,832 tests across 274 suites at last measurement) |
| Full integration suite | `npm run test:integration` (31 tests) |

### Phase requirement → test map

| Req ID | Behavior | Test type | Automated command | File exists? |
|--------|----------|-----------|-------------------|--------------|
| MOD-09 | Each of the 30 pairs passes alone at 100 % direct function/line/branch | unit + coverage gate | `npm run test:coverage:direct -- <source>` per pair | 25 ✅ (rewrite), 5 ❌ new |
| SC-2 | Grammar, scope, aliases, flags, completion preserved | unit | `node --test tests/edge/{args,args-schema,router,flag-catalog,completions/*}.test.ts` | ✅ / ❌ 116-06 |
| SC-3 (positive) | Exact results through `ctx.ui.notify` | unit | per-owner whole-value notification assertion via `createNotificationBoundary` | ✅ helper exists |
| SC-3 (negative) | No direct stdout/stderr | **gate, not test** | `npm run lint` + `npm run fallow` | ✅ — do not duplicate (D-116-12) |
| SC-4 (offline) | Read-only edge paths never reach the network | unit | `t.mock.method(globalThis, "fetch", refuseNetwork)` + `callCount() === 0` in 8 read-only owners | ❌ pattern exists at `tests/orchestrators/edge-deps.test.ts:69` |
| SC-4 (fail-first) | Invalid input rejected before the workflow runs | unit | `createNotificationBoundary(1, 0)` + `verifyBoundary()` in every handler owner | ❌ needs the wave-0 helper fix |
| — | Correspondence gate closes 6 of 7 | gate | `node scripts/check-corresponding-tests.mjs` (expect 8 remaining, all Phase 117's) | ✅ script exists |

### Sampling rate

- **Per task commit:** `node --test <file>` then `npm run test:coverage:direct -- <source>`
- **Per wave boundary:** `npm test` and `npm run test:integration`, each checked by exit code
- **Phase gate:** `npm run typecheck`, `npm run lint`, `npm run fallow`, `npm test`,
  `npm run test:integration`, and `node scripts/check-corresponding-tests.mjs` — run separately,
  never through `npm run check`

### Wave 0 gaps

- [ ] `tests/helpers/notification-boundary.ts` — add a `cwd` option; make `toolProbes` explicit at
      every call site. Covers SC-3/SC-4 for ~20 pairs
- [ ] Re-run every suite that already imports the helper after changing it
      (`grep -rl createNotificationBoundary tests/`)
- [ ] Record the D-116-05 seam decision (O3 recommended) in the phase's plans so each handler plan
      states the same promise

## Security Domain

Phase 116 adds no runtime code, no dependency, and no network surface. It writes only files under
`tests/`. The relevant ASVS categories map as follows:

| ASVS Category | Applies | Standard control |
|---------------|---------|------------------|
| V2 Authentication | no | Credential handling lives in `platform/git-credential.ts`, owned by Phase 108 |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | **yes** — this is what the edge tier *is* | The phase's proof obligation: every arity, flag, and `--scope` rejection is exercised, and D-116-06 requires proving rejection happens **before** any state change |
| V6 Cryptography | no | — |
| V12 File Operations | **indirectly** | Path containment (NFR-10, `shared/path-safety.ts`) is owned by Phase 109; edge owners must not restate it |

**No new packages are installed by this phase**, so the Package Legitimacy Audit does not apply.
Every tool used (`node:test`, `node:assert/strict`, `strong-mock`, `typescript`, `eslint`,
`prettier`, `fallow`) is already in `package.json` `devDependencies` at HEAD.
`[VERIFIED: package.json]`

One live security-relevant environment fact: the `trufflehog` pre-commit hook **cannot run** in a
linked worktree (`failed to read index file: … /.git/index: not a directory`). The CLAUDE.md
filesystem route is mandatory before every commit:

```bash
TH=$(find "${PRE_COMMIT_HOME:-$HOME/.cache/pre-commit}" -type f -name trufflehog -perm -u+x | head -1)
"$TH" filesystem <changed paths> --results=verified,unknown --fail
```

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | O3 (split the D-116-05 promise) is the right resolution rather than O1 (production injection) | Seam Analysis | The phase ships 13 handler owners with a weaker delegation proof than D-116-05's literal wording. Mitigated by making the gap explicit per plan. **Needs operator confirmation** |
| A2 | `SKIP=trufflehog,npm-format-check` is acceptable, given `.continue-here.md` says not to extend `SKIP=` beyond trufflehog | Environment Facts | Commits fail the gate, or an operator-owned config gets edited. **Needs operator confirmation** — the alternative (editing `.prettierignore`) touches shared config |
| A3 | The recommended 6-wave structure is the right decomposition | Wave Structure | Wrong ordering means a handler plan writes delegation assertions against an unsettled helper contract and has to be redone. Low risk; the dependency direction is mechanically verifiable from the import graph |
| A4 | Phase 115's 1.4×–3.0× test-to-source LOC ratio transfers to the edge tier | Sizing guidance | Plan token estimates run low, producing partial-completion reports. The operator has already accepted partial reports as the correct response (CONTEXT.md § Specific Ideas), so the cost is schedule, not quality |
| A5 | Branch/function totals for the 5 sources with no test could not be measured accurately | Per-Pair Inventory | V8 coverage only reports branches inside functions that executed, so an import-only probe undercounts. Only source LOC is reliable for 116-06, 116-12, 116-17, 116-23, 116-30. Plan sizing for those five leans on LOC and export count instead |

## Operator Decisions (resolved 2026-09-02, before planning)

The four questions below were put to the operator after research completed. All are now
closed. The planner MUST treat these as locked and MUST NOT reopen them.

- **D-116-05 mechanism: O3 accepted.** Groups A and B (`plugin/import.ts`, `marketplace/add.ts`,
  `marketplace/update.ts`, `plugin/bootstrap.ts`) and all three `shared.ts` helpers get
  exact-argument mocks at their real seam. The thirteen Group-C handlers get complete edge-side
  proof — every flag, alias, arity, scope combination, and validation rejection — plus the
  D-116-06 negative proof that the orchestrator never ran, through
  `createNotificationBoundary(1, 0)` and `verifyBoundary()`. No production signature changes.
  Each Group-C plan MUST state the exact-argument gap in its `must_haves` so the verifier reads
  it as scoped rather than missed. O1 (production injection) is deferred to a follow-up and is
  explicitly NOT authorized here.
- **Commit recipe: skip both hooks, restore prettier per file.** Commit with
  `SKIP=trufflehog,npm-format-check pre-commit run --files <paths>`, and put an explicit
  `npm exec -- prettier --check <changed paths>` in the same verify block so formatting is still
  gated on exactly the files the change wrote. This supersedes `.continue-here.md`'s "do not
  extend `SKIP=` to any other hook", which predates `npm-format-check` failing. Do NOT edit
  `.prettierignore`, and do NOT touch the untracked operator files. `SKIP=` is widened to these
  two hooks only; never `--no-verify`.
- **`BOOLEAN_FLAGS` test-only export: leave it.** `edge/handlers/plugin/list.ts:82` keeps
  `export { BOOLEAN_FLAGS };`. Removing it would break the passing
  `tests/architecture/flag-catalog-drift.test.ts` gate. Plan 116-20 records it as an observation
  for Phase 117, which owns the repository-wide gates, and takes no action.
- **Coverage shortfall class (D-116-01a, decided 2026-09-02 during planning).** Direct coverage was
  re-measured per pair during planning and five pairs were found unable to reach 100 percent branch
  coverage. Four of the five are compiler artifacts, not dead code: `edge/args.ts:34-37`,
  `edge/handlers/shared.ts:53-55`, and `edge/handlers/plugin/pending.ts:39` exist only because
  `noUncheckedIndexedAccess` (`tsconfig.json:12`) types every index read as `T | undefined`, and
  `edge/handlers/plugin/import.ts:31` is the residual arm of a `catch (err)` binding typed
  `unknown`. Removing any of them needs a non-null assertion or a type assertion, both barred in
  `extensions/`. D-116-01 is therefore amended by **D-116-01a**, which admits that one shortfall
  class and no other, still bans every coverage-exception pragma, and requires each claiming pair
  to name the line range, the compiler setting, and its exact resulting numbers in `must_haves`.
  **No production file changes in any of the four.**
- **`edge/handlers/tools.ts` is restructured to reach 100 percent (ratified 2026-09-02).** A fifth
  coverage shortfall was proposed for `pluginVersion`'s unreachable arms and **rejected**. Plain
  deletion is unavailable: a compiler repro run during planning shows that deleting an arm from a
  `default`-less switch raises `TS7030: Not all code paths return a value.` under `noImplicitReturns`
  (`tsconfig.json:11`), and the two shapes that do compile — a trailing `return`, or a `default` arm
  — each trade the uncovered branch for an uncovered line, with the `default` shape additionally
  silencing the missing-arm gate. The ratified answer is to change the **type** rather than delete
  the arms: narrow `pluginVersion`'s parameter to the list-surface row type the payload already
  carries, so the four pending arms have nothing left to match and come out on their own. Plan
  116-27 carries that edit and is the **only** plan in the phase permitted to touch `extensions/`.
  D-116-01a is unaffected and stays at exactly four pairs.
- **D-116-14 scope: plan 116-27 only.** Only the four `edge/handlers/tools.ts` switches turn on a
  closed union and carry an exhaustiveness claim. `router.ts` switches on open `string` with a
  `default` arm, so no guarantee exists there to prove or lose. Every other plan states the
  absence explicitly rather than attempting a plant with no target.

## Open Questions

1. **Does the operator accept O3 for D-116-05?**
   - What we know: 16 of 17 handlers have no orchestrator seam; module mocking is both
     runtime-unavailable and rule-forbidden; the three helpers and one handler *do* have seams.
   - What is unclear: whether the operator prefers a production-injection refactor (O1) inside a
     milestone whose stated scope is tests only.
   - Recommendation: proceed on O3, record the Group-C gap in each plan's `must_haves`, and raise
     O1 as a separate follow-up.

2. **Does the operator accept `SKIP=npm-format-check`?**
   - What we know: the hook runs a repo-wide `prettier --check` that fails on 8 untracked
     operator-owned files that this phase is forbidden to touch.
   - Recommendation: skip it and replace it with a per-file `prettier --check` in the same verify
     block. Ask before the first commit.

3. **`BOOLEAN_FLAGS` is exported from `plugin/list.ts` for a test only.**
   - What we know: the only consumer outside the file is `tests/architecture/flag-catalog-drift.test.ts:48`.
   - What is unclear: whether to leave it (violates the pair rule's "do not export a symbol for a
     test") or restructure the drift gate.
   - Recommendation: leave it in Phase 116 and record it as an observation for Phase 117, which
     owns the repository-wide gates.

4. **Are the four `tools.ts` switches the complete D-116-14 surface for the whole phase?**
   - What we know: `grep -rn 'switch ('` over `edge/` returns seven sites — four in `tools.ts`,
     two in `router.ts`, one in `provider.ts`. Only the `tools.ts` four switch on a closed union.
   - Recommendation: yes. Scope D-116-14 to plan 116-27 and state its absence explicitly elsewhere.

## Sources

### Primary (HIGH confidence — measured in this session)

- `node scripts/check-corresponding-tests.mjs` — 14 violations, verbatim, exit 1
- `node scripts/test-coverage-direct.mjs <source>` × 30 — per-pair direct coverage
- `npm run typecheck` / `npm run lint` / `npm run fallow` / `npm run format:check` — exit codes
- `pre-commit run --files tests/edge/router.test.ts` — per-hook pass/fail
- `tsc --noEmit --strict` on a 3-function switch repro — TS2366 fires only for a non-nullable
  value-returning switch
- `node --test` probes of `mock.module()` with and without `--experimental-test-module-mocks`
- `node --test` probes of `createNotificationBoundary` against `makeUninstallHandler`, and of
  strong-mock property-access overrun semantics
- `git config core.hooksPath`, `git rev-parse --git-dir`, `git status --short`, `node --version`
- Full reads of: `edge/{types,router,register,flag-catalog,args,args-schema}.ts`,
  `edge/completions/normalize.ts`, `edge/handlers/{shared,marketplace/shared,plugin/shared}.ts`,
  `edge/handlers/{marketplace/{add,info,remove,update},plugin/{bootstrap,import,install,uninstall}}.ts`,
  `edge/handlers/tools.ts` (switch regions), `edge/completions/provider.ts` (switch region)
- Full reads of: `.claude/rules/typescript-unit-testing.md`,
  `tests/helpers/notification-boundary.ts`, `tests/orchestrators/types.test.ts`,
  `tests/orchestrators/edge-deps.test.ts` (harness region),
  `tests/orchestrators/import/execute.test.ts` (mock region),
  `tests/architecture/flag-catalog-drift.test.ts`, `eslint.config.js` (BLOCK A region),
  `scripts/test-coverage-direct.mjs`, `package.json` scripts, `.prettierignore`,
  `.pre-commit-config.yaml`, `.planning/config.json`

### Secondary (MEDIUM confidence)

- `.planning/codebase/{STACK,CONVENTIONS,ARCHITECTURE}.md` — repo conventions, read but not
  independently re-measured
- `.planning/phases/115-composition-orchestrators/115-PATTERNS.md` — Phase 115's analog map
- `.planning/ROADMAP.md` Phase 116 section, `.planning/REQUIREMENTS.md` MOD-09

### Tertiary (LOW confidence)

- None. No web search was used; every claim in this document is grounded in a file in this
  repository or a command run against it.

## Metadata

**Confidence breakdown:**

- Per-pair inventory: **HIGH** — 30 direct-coverage invocations plus `wc -l` and `grep` sweeps
- Correspondence gate attribution: **HIGH** — gate output plus the two file headers that decide
  the attribution
- Seam analysis: **HIGH** for the facts (signatures, imports, flag behavior, rule text);
  **MEDIUM** for the O3 recommendation, which is a judgement the operator may overrule
- D-116-14: **HIGH** — compiler repro plus a read of all seven switch sites
- SC-3/SC-4 gate coverage: **HIGH** — ESLint config and architecture-test inventory read directly
- Environment facts: **HIGH** — every one reproduced by command
- Wave structure and sizing: **MEDIUM** — derived from the measured import graph and Phase 115
  ratios, not from executing a plan

**Research date:** 2026-09-02
**Valid until:** 2026-10-02 for the stack facts. The per-pair coverage table is valid only until
the first plan lands — re-measure after each wave.
