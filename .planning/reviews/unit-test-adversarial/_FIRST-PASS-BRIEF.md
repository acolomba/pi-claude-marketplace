# Diagnostic review brief — read this first

You are one of many parallel reviewers sweeping the `pi-claude-marketplace` repo.
Repo root: `/home/acolomba/pi-claude-marketplace-unit-test-refactor`

**This is a DIAGNOSTIC review. Do NOT fix, edit, or reformat anything.** The only
file you may write is your own findings file under `unit-test-findings/`. Do not
run `npm run check`, `npm test`, or any build/lint command — other reviewers are
running concurrently and the tree must stay untouched. Review by reading.

## Step 1 — load the two rule sets

Read both of these in full before reviewing anything:

1. `.agents/skills/typescript-unit-testing-review/SKILL.md` — the unit-test rules.
2. `.agents/skills/typescript-google-style-review/SKILL.md` — the TypeScript style rules.

Longer-form source of the unit-test rules, consult when a check is ambiguous:
`/home/acolomba/typescript-unit-testing-guidelines.md`

Project conventions you must respect while reviewing (they override the skills'
generic examples where they differ):

- Production code lives under `extensions/pi-claude-marketplace/`, **not** `src/`.
  Tests live under `tests/`, **not** `test/`.
- Pairing rule for this repo: `extensions/pi-claude-marketplace/<path>.ts`
  pairs with `tests/<path>.test.ts`. Example:
  `extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
  ↔ `tests/orchestrators/plugin/install.test.ts`.
- Imports carry explicit `.ts` extensions (no build step; Node strips types).
- `strong-mock` ^9.2.2 is a devDependency and is the sanctioned interaction-mock library.
- The unit suite glob is
  `tests/{architecture,bridges,domain,edge,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts`
  plus `tests/index.test.ts`. `tests/integration`, `tests/e2e`, and `tests/live-uat`
  are out of scope for this sweep.
- Comments and test titles may cite durable spec IDs (`D-NN`, `NFR-N`, `MA-N`,
  `PRL-NN`, `ATTR-NN`, `PI-NN`, `CMP-N`, …). Those are legitimate. Plan/phase/
  wave/milestone/ticket references in titles or comments are findings.
- The extension entry point `extensions/pi-claude-marketplace/index.ts` is the one
  sanctioned default export. `console.warn` for the load-time legacy-migration save
  failure is sanctioned (IL-3). All user-visible output goes through
  `shared/notify.ts` (IL-2).
- `process.stdout`/`process.stderr` writes are forbidden inside
  `extensions/pi-claude-marketplace/**`.

## Step 2 — review your assigned test files

Your assignment names a set of test/test-support files. Read **every one of them
in full** (use `Read` with offsets for large files; do not skim by grepping only).

For each file, work the `typescript-unit-testing-review` checklist section by
section. The highest-value question for every case is:

> **Would a plausible wrong implementation still pass this case?**

Findings you must actively hunt for (not an exhaustive list — the skill is):

- Weak or vacuous assertions: `assert.ok(x)`, `assert.notStrictEqual`, length-only
  or single-property checks where the whole value is the promise, unawaited
  `assert.rejects()`, message-substring error matching instead of `instanceof` +
  structured fields.
- Expected values computed by production code, by the harness, or by re-running
  the module's own serializer/formatter on both sides of an assertion.
- Doubles used in the wrong role: a stub whose call count is asserted, a mock
  created without `exactParams: true`, `It.isAny()`, `anyTimes()`, a missing
  `verify(mock)`, `verify()` hidden in a hook, `verifyAll()`/`resetAll()`/`setDefaults()`.
- Hand-rolled mock objects (`{ notify: (...) => calls.push(...) }`) where the
  interaction is public behavior and `strong-mock` is the required tool. Report
  each such collaborator and say what it should become (fake / stub / spy / mock).
- Process-wide `mock` imported from `node:test` instead of the context's `t.mock`;
  `t.mock.module()` or loader tricks.
- Shared mutable state at module scope, `before()` hooks, fixtures reused across
  cases, temp directories shared across cases, missing cleanup.
- Missing `// arrange` / `// act` / `// assert` phase comments, wrong order, or
  extra narration comments.
- Nested `describe()`, `describe()` naming a private helper, `describe()` holding
  mutable setup, `it()` instead of `test()`, committed `only`/`skip`/`todo`.
- Placeholder names: `result`, `data`, `value`, `instance`, `subject`, `sut`, bare
  `actual`; doubles named `mockFoo`/`fakeFoo`/`stubFoo`.
- Rows looped inside one case instead of one sibling `test()` per row; conditionals
  inside a data loop.
- Hermeticity breaks: real network, real HOME, developer credentials, writes into
  the repo or a fixed path, real sleeps/polling, faked `Date` where an injected
  clock would do.
- Test-support placed in a generic dumping ground rather than beside its concern.
- Pairing gaps: a production module in your area with no paired test module, or a
  test module that primarily exercises a *different* source module than the one it
  is named for.
- `any`, double assertions, broad `Partial<T>` casts hiding an invalid double.

## Step 3 — review the paired production code

For every production module paired with a test file in your assignment, read the
production module and review it with the `typescript-google-style-review` skill.
Skip the checks the toolchain already gates (formatting, quotes, semicolons,
`===`, unused vars, bare `any` where ESLint would catch it) — review what a linter
cannot judge. Prioritise:

- **Testability design findings** (these matter most for the follow-up pass):
  hidden dependencies — an imported singleton, inline `new Date()` / `Date.now()` /
  `randomUUID()`, a `process.env` read buried in logic, module-level mutable state,
  a parameter defaulting to a live boundary, work done in a constructor. For each,
  say which of the four sanctioned fixes applies (extract a coherent module; make
  the dependency an explicit parameter or dependencies-object member; inject a
  narrow consumer-declared port; replace module-level state with factory-owned state).
- Anything exported, or any hook/reset/state-reader, that exists only to serve a
  test.
- `as` / `!` assertions without an obvious or commented reason; `<Type>value` form.
- Error handling: non-`Error` throws, empty catch without a comment, over-broad
  `try` blocks, `catch (error: unknown)` discipline.
- Types: `| null`/`| undefined` inside a type alias, `type` alias of an object
  literal where `interface` belongs, unlabeled index signatures, `{}` as a type,
  return types that are not obvious and not annotated.
- Naming, export surface (`export let`, unused exports, default exports outside
  the entry point), import form (`import type` discipline, long `../` chains).
- Documentation: undocumented top-level exports, method descriptions not starting
  with a third-person verb phrase, `@param`/`@return` that add nothing.

If a production module in your area has **no** paired test module, that is a
BLOCKER — record it under the unit-test section.

## Step 4 — write your findings file

Write exactly one file: `unit-test-findings/<SLUG>.md` (your assignment gives the
slug). Use this structure verbatim:

```markdown
# <Area title>

**Scope:** <the directory / file set you reviewed>
**Test files reviewed:** <count>
**Production modules reviewed:** <count>

## Summary

<3–8 sentences. What is broadly healthy, what is broadly broken, and the two or
three themes a fixing pass should attack first in this area.>

## Unit test findings

### `<relative/path/to/file.test.ts>`

- **[BLOCKER] <short title>** — `line NNN` (or `lines NNN–MMM`, or `test('…')`)
  <What is wrong, citing the rule. Then: what to do instead, concretely enough
  that another agent can execute it without re-deriving the analysis.>
- **[WARNING] <short title>** — `line NNN`
  <same shape>

<Repeat one `###` block per test file that has findings. Files with no findings
get listed at the end under "### Clean files" as a bullet list.>

## Production code findings

### `<relative/path/to/module.ts>`

- **[BLOCKER] <short title>** — `line NNN`
  <same shape>

### Clean files

- `<path>`
```

Rules for the findings themselves:

- Every finding names a **file path** and a **line number or a `test('…')` title**.
  A finding without a location is useless to the fixing pass.
- Every finding says **what to do**, not only what is wrong. Write it as an
  instruction. Where the fix is mechanical (rename, add `exactParams: true`, add a
  `verify()`), say exactly what to write.
- Classify with the skills' own rules: **BLOCKER** when the suite lies or breaks,
  or when the style violation can produce incorrect behavior; **WARNING** for
  structure, naming, and readability.
- Group repeated instances: if the same defect appears 40 times in one file, write
  one finding, state the count, list a handful of representative line numbers, and
  give one rule for fixing all of them. Do not emit 40 near-identical bullets.
- Be concrete and honest. If a file is genuinely clean, say so — do not invent
  findings to fill space. If you could not fully review something (file too large,
  ran out of budget), say exactly what you did not cover under a
  `## Not covered` heading at the end.
- Do not restate the rules at length. The reader has the skills.

Your final reply to the orchestrator: the path you wrote, the count of BLOCKER and
WARNING findings in each section, and a two-sentence characterisation of the area.
