# Phase 116: Edge Surface - Context

**Gathered:** 2026-09-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 116 gives every module under `extensions/pi-claude-marketplace/edge/` one mirrored
owner test at the paired path, each passing alone at 100 percent direct function, line, and
branch coverage. Thirty pairs: argument parsing and its schema, the flag catalog, the
subcommand router, registration, the tab-completion provider and its data and normalizer,
nineteen handlers across the marketplace and plugin verbs, three handler helper modules, the
LLM tool surface, and the `EdgeDeps` type module.

The edge tier parses `/claude:plugin ...` arguments, resolves scope flags, and dispatches to
exactly one orchestrator call. It holds no business logic. The phase preserves the accepted
command grammar, scope rules, completion behavior, and notification contract while replacing
the twenty-five pre-contract test files that already exist at mirrored paths and adding the
five that are missing.

This is a compliance refactor, not greenfield. Twenty-five of the thirty sources already have
a test at the right path, and none of them was written against the current pair contract.

</domain>

<decisions>
## Implementation Decisions

### Milestone test contract carried forward

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
  and state the exact coverage numbers it therefore lands on — so a verifier reads an argued,
  scoped shortfall rather than a gap.
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

### Proof depth at the edge tier

- **D-116-05:** Handler owners are **edge-complete and outcome-thin**. Prove exhaustively what
  the edge itself owns — every flag, alias, arity, scope combination, and validation
  rejection — and assert the orchestrator was called with exact arguments rather than
  re-deriving what it returns. Phases 113, 114, and 115 already own every orchestrator
  outcome at 100 percent direct coverage; re-deriving them here is the D-20/D-22 duplication
  the milestone is trying to remove.
- **D-116-06:** Invalid input must be proven to fail **before** any state-changing workflow
  runs. The assertion is that the orchestrator was never called, not merely that an error
  surfaced.

### Helper module ownership

- **D-116-07:** The three helper modules — `edge/handlers/shared.ts`,
  `edge/handlers/marketplace/shared.ts`, and `edge/handlers/plugin/shared.ts` — each get a
  full independent owner proving their own behavior. Handler owners assert only that they
  delegate to a helper with exact arguments; they do not re-prove what the helper computes.
  These modules hold the only real logic in the edge tier and are imported by nineteen
  handlers, so this is D-116-05 applied one layer down. Two of the three are among the five
  owners this phase must newly write.

### Correspondence gate closure

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

### Type-only module contract

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

### Exhaustiveness enforcement carried from Phase 115

- **D-116-14:** Phase 115 proved with a compiler repro that a **`void`-returning** `switch`
  with a missing arm compiles clean — only a value-returning switch raises TS2366. Four gates
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone scope and acceptance

- `.planning/ROADMAP.md` — Phase 116 boundary, all thirty source-test pairs, dependencies,
  success criteria, and plan inventory.
- `.planning/REQUIREMENTS.md` — `MOD-09`, and the case structure, assertion, double, direct
  coverage, pair-atomic delivery, and suite-quality rules.
- `.planning/PROJECT.md` — v1.19 intent and locked decisions for lowercase phases,
  alphabetical presentation, public-surface compatibility, passive typed data, and exact
  interaction verification.
- `.planning/phases/115-composition-orchestrators/115-CONTEXT.md` — D-115-01 through
  D-115-10, carried forward here rather than restated.
- `.planning/phases/115-composition-orchestrators/115-REVIEW.md` and `115-REVIEW-FIX.md` —
  the void-switch and overload-soundness findings behind D-116-14, with the compiler repros.

### Unit-testing contract

- `.claude/rules/typescript-unit-testing.md` — executable lowercase AAA, independent
  expectation, role-correct double, direct coverage, and hermetic filesystem rules. Its
  `## Patterns` section now also forbids cases that restate what a gate already enforces
  (D-116-12).
- `docs/guidelines/typescript-unit-testing-guidelines.md` — normative rationale and full
  TypeScript examples for the same contract, including `### Facts a gate already enforces`.
- `.claude/rules/typescript-comments.md` — comments cite decision and requirement IDs;
  planning-process references are forbidden.

### Gates this phase must satisfy

- `scripts/check-corresponding-tests.mjs` — the correspondence gate, at fourteen violations.
  Phase 116 owns seven and closes six of them (D-116-08, D-116-09, D-116-10).
- `scripts/test-coverage-direct.mjs` — the direct per-pair coverage gate. Line 213 returns
  `"type-only"` for a source with no LCOV records, which is why `edge/types.ts` has no
  coverage signal.
- `.fallowrc.json` — `production: false`, `includeEntryExports: true`, entry
  `extensions/pi-claude-marketplace/index.ts`, and the 13-zone boundary allow-list.
- `tests/architecture/` — the notify-discipline, scope-fence, flag-catalog-drift, and
  partial-vocabulary guards that already cover parts of success criteria 3 and 4.

### Product and output contracts

- `.planning/inputs/unit-test-refactor-handoff/BEHAVIOR-CONTRACTS.yaml` — atomic write,
  retry, network, containment, and scope behavior authority.
- `.planning/inputs/unit-test-refactor-handoff/PUBLIC-SURFACE.yaml` — command, error,
  notification, reason, and typed-port authority.
- `docs/messaging-style-guide.md` — exact notification grammar, reason taxonomy, severity,
  scope, tally, trailer, and ordering rules.
- `docs/output-catalog.md` — accepted user-visible output and reload behavior.

</canonical_refs>

<code_context>
## Existing Code Insights

### Current state of the pair set

Thirty sources under `extensions/pi-claude-marketplace/edge/`. Twenty-seven test files exist
under `tests/edge/`. Of those, twenty-five sit at the correct mirrored path and were written
before the current pair contract, so each is a rewrite rather than a new file. One
(`handlers/import.test.ts`) is misplaced, and one (`index-handler.test.ts`) pairs with a
source Phase 117 owns.

### Reusable assets

- Six existing type-only owners establish the exact form D-116-11 requires.
- `tests/architecture/flag-catalog-drift.test.ts`, `scope-fences-63.test.ts`, and
  `partial-vocabulary-guard.test.ts` already reach into `edge/` and constrain what the new
  owners need to re-prove.
- Phase 115's owners are the closest analogs for composition-style proof at this tier.

### Established patterns

- Injected collaborators through the public interface; no test-only seam, export, or
  `_setXForTest` hole in production.
- Test-boundary helpers declared as arrow properties, never methods — a method fires
  `@typescript-eslint/unbound-method` at every destructuring site.
- Case-owned temporary trees via `mkdtemp`, removed in `t.after()`; no shared fixture and no
  process-wide mock tracker.

### Integration points

Handlers call exactly one orchestrator each. `register.ts` builds `SubcommandHandlers` from
`EdgeDeps`. `router.ts` owns subcommand and alias dispatch. The completion provider reads
`shared/completion-cache.ts`, the one sanctioned process-lifetime cache.

</code_context>

<specifics>
## Specific Ideas

The operator chose exhaustive matrices in Phase 115 and accepted a partial-completion report
as the correct response to a plan running long. That preference carries: if a plan runs out of
room, stop and report exactly which cases are done and which remain. Do not sample, and do not
shrink a matrix to fit.

</specifics>

<deferred>
## Deferred Ideas

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

</deferred>
