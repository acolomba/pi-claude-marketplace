# Bridges — commands

**Scope:** `extensions/pi-claude-marketplace/bridges/commands/` (5 files) and
`tests/bridges/commands/` (5 files)
**Test files reviewed:** 5
**Production modules reviewed:** 5

## Summary

This is a mature, carefully engineered suite. Pairing is complete in both
directions, `index.test.ts` correctly asserts same-binding identity for all 8
runtime re-exports via `assert.strictEqual`, `types.test.ts` is a proper
type-only module with zero runtime cases, and the bulk of `discover.test.ts`
and `unstage.test.ts` use full `deepStrictEqual`/structured-field error
assertions with real, per-case `mkdtemp` filesystem isolation and no shared
mutable state. The two themes worth a fixing pass: (1) `stage.test.ts` has a
handful of error assertions that fall back to message-substring regex
matching where the file's own dominant pattern (structured `{name, message,
cause}` comparison) was achievable, and one of those tests never checks the
specific rename pair named in the leak message, so a wrong pair identity
would pass; (2) several tests in `stage.test.ts` and one in `discover.test.ts`
reach for `String.prototype`/`Symbol.hasInstance` monkeypatching to hit
branches that a closer read of the production code shows are provably
unreachable through any real input — worth a joint look at whether the
underlying defensive code should be simplified away rather than propped up by
increasingly elaborate test machinery. A minor third theme: small
inconsistencies (an import-form outlier in `unstage.test.ts`, a
near-duplicated plugin-resolution builder across two files) that a fixing
pass can clean up cheaply.

## Unit test findings

### `tests/bridges/commands/stage.test.ts`

- **[BLOCKER] Message-substring error assertions where structured fields
  were available** — `test('reports a commit rollback leak without
  promoting it to manual recovery')` (assertions at lines 681–683) and
  `test('propagates a non-missing previous-prompt removal failure')`
  (assertions at lines 716–717). Both assert only `error instanceof Error`
  plus a loose `assert.match(error.message, /regex/)`, which is exactly the
  "message-substring error matching instead of instanceof + structured
  fields" pattern the review rules single out. Worse, the first of the two
  never checks *which* rename pair the rollback-leak message names: the test
  builds `actualFrom` and `rollbackBlocker` deterministically but only greps
  for the literal `(additionally: failed to roll back command rename`
  prefix, so an implementation that logs the wrong `from`/`to` pair in the
  leak message would still pass. Fix: build the expected message with the
  known-deterministic parts filled in (`` `(additionally: failed to roll
  back command rename ${actualFrom} -> ${rollbackBlocker}: ` `` as a
  `RegExp`-escaped prefix, or a `startsWith` check) so only the genuinely
  platform-variant OS-error tail is left unchecked, and add
  `assert.strictEqual(error.name, "Error")` alongside the existing
  `assert.notStrictEqual(error.name, "ManualRecoveryError")` (a standalone
  negative — replace it with a positive class check now that the sibling
  positive check exists). For the second test, replace
  `assert.match(error.message, /(EISDIR|EPERM)/)` with a structured check on
  the real `NodeJS.ErrnoException` fields already available and already used
  elsewhere in this same file (e.g. `discover.test.ts`'s "rejects an
  unreadable declared command root"): assert
  `["EISDIR", "EPERM"].includes((error as NodeJS.ErrnoException).code ?? "")`
  and assert `.path === blockedPreviousTarget` and `.syscall === "unlink"`
  exactly (both are platform-independent), leaving only `.code` as a
  closed-set membership check for the genuine cross-platform variance.

- **[WARNING] Error result checked only by `instanceof`, no structured
  field** — `test('rolls back a partial command commit and removes the
  staging tree')`, lines 620–632. `assert.ok(error instanceof Error)` is the
  only check on the thrown error itself; every other assertion in the case
  targets side effects (`alphaExists`, `stagingExists`, `blockerBytes`),
  which do carry most of the discriminating weight for this specific
  rollback behavior, but the file's own dominant pattern elsewhere
  (`deepStrictEqual` of `{name, message, cause}`) is not applied here for no
  stated reason. Add at least `assert.strictEqual(error.name, "Error")` (or
  the exact expected message, which is fully deterministic from the known
  `betaTarget` path) to close the small remaining gap.

- **[WARNING] Coverage-only monkeypatching of shared built-ins to reach
  branches unreachable via real input** — three cases:
  `test('passes through a non-filesystem staging error and cleans staging')`
  (mocks `String.prototype.includes`, lines 766–784),
  `test('cleans staging when a repeated malformed block reaches the
  no-opening safeguard')` (mocks `String.prototype.startsWith`, lines
  871–885), and `test('cleans staging when a repeated malformed block
  reaches the no-close safeguard')` (mocks `String.prototype.indexOf`, lines
  919–943). All three use `t.mock.method` on a pervasive, globally-shared
  `String.prototype` method with a call-counting conditional override to
  force one specific invocation, among many others hitting the *same*
  method during the *same* test, to lie. This is self-restoring (`t.mock`
  auto-restores at test end) so it does not leak across tests, but within
  the test it is a "shared global state" mutation with a large blast radius
  (every other string operation in the call graph — including the `yaml`
  parser dependency's own internals — routes through the same prototype
  method during the mocked window), and none of the three has an inline
  comment recording *which* call site each numbered occurrence targets or
  *why* the branch cannot be reached without lying (the AAA rule's "no other
  comments unless setup is not obvious" exception squarely applies here —
  this setup is not obvious). See the matching production-code finding in
  `stage.ts` below: closer reading shows the branches these three tests
  target are provably unreachable by any real input, which is the real
  reason the tests need this machinery. Recommended fix path: resolve the
  production finding first (either document why the defensive branch stays,
  or remove it), then re-derive whether these three tests are still needed;
  if the defensive code stays, add a short comment above each `t.mock.method`
  call naming the call site and iteration it targets.

- **[WARNING] Near-duplicated plugin-resolution builder across two test
  files** — `resolvedFor` (this file, lines 38–58) and `resolvedPlugin` in
  `discover.test.ts` (lines 16–36) construct the same
  `ResolvedPluginInstallable` shape for the same "commands" concern with
  only cosmetic differences. Per the seed-module convention ("cross-case
  seeds live in the concern's seed module as functions returning fresh
  values"), extract one shared builder (e.g.
  `tests/bridges/commands/resolved-plugin.ts`) and have both test files
  import it, rather than maintaining two near-identical copies.

### `tests/bridges/commands/discover.test.ts`

- **[WARNING] Coverage-only monkeypatching of a class-identity check that is
  unreachable by real input** — `test('propagates a wrapped name error when
  its class identity is unavailable')`, lines 605–616. The test overrides
  `Symbol.hasInstance` on the production `CommandNameError` class so
  `err instanceof CommandNameError` returns `false` inside
  `collectCommandFile`'s catch. In this single-process, single-module-graph
  extension, every `CommandNameError` reaching that catch was constructed
  moments earlier via `new CommandNameError(...)` in the same module
  instance (`nameCommandInDir`), so the `instanceof` check cannot organically
  fail — the only way to exercise the `throw err` branch is to force the
  lie, as this test does. Not a defect in the test (it correctly restores
  the property in `t.after()` and asserts the structured fallback fields),
  but grouped with the `stage.ts` finding below as the same underlying
  pattern: verify whether `discover.ts`'s defensive `!(err instanceof
  CommandNameError)` branch is worth keeping given it can only be tested by
  lying to a well-known operator.

- Otherwise clean: every other case in this file uses full
  `deepStrictEqual`, correctly scoped `mkdtemp`/`t.after()` cleanup, one
  `test()` per row for the three-row boundary loop (lines 310–350), and
  descriptive, role-based naming throughout.

### `tests/bridges/commands/unstage.test.ts`

- **[WARNING] Import-form inconsistency** — line 5:
  `import test, { type TestContext } from "node:test";` uses a default
  import for `test` while every sibling file in this directory
  (`discover.test.ts`, `stage.test.ts`, `index.test.ts`) uses the named
  import `{ test }` (and `stage.test.ts` needs the identical combination of
  `test` + `type TestContext` and does so via
  `import { test, type TestContext } from "node:test";`). Change to
  `import { test, type TestContext } from "node:test";` to match.

- Otherwise clean: strong structured error assertions (class +
  `{name, message, code/parent/child/...}` via `deepStrictEqual`), no
  standalone negative assertions, fresh `mkdtemp` per case.

### Clean files

- `tests/bridges/commands/index.test.ts`
- `tests/bridges/commands/types.test.ts`

## Production code findings

### `extensions/pi-claude-marketplace/bridges/commands/stage.ts`

- **[WARNING] `neutralizeCommandFrontmatter`'s loop-level "no opening" /
  "no close" pre-checks are unreachable past the first iteration** — lines
  102–111. The function is documented as "Called ONLY on the gate-1 throw
  arm, where a closed `---`...`---` block is present by construction," so
  the checks on the *first* iteration are guaranteed true by the caller's
  contract. On any later iteration, `normalized` is only ever set to a
  `stripped` value that just caused `parseFrontmatter(stripped)` to *throw*
  inside the `try`/`catch` (line 116–124) — and the vendored
  `parseFrontmatter` (`@earendil-works/pi-coding-agent`'s
  `dist/utils/frontmatter.js`) can only throw from `parse(yamlString)`,
  which is only reached when its own `extractFrontmatter` already confirmed
  the string starts with `---` **and** has a closing `\n---`. So by the time
  the loop re-checks `normalized.startsWith("---")` / `indexOf("\n---", 3)`
  on iteration ≥ 2, both are mathematically guaranteed to be true — the
  `return normalized` branches on lines 103–105 and 108–111 can never fire
  from real input past the first pass. This is corroborated by the paired
  tests: the only way `stage.test.ts` can exercise these two branches is by
  monkeypatching `String.prototype.startsWith`/`indexOf` to lie about a
  string that visibly does start with `---` / does have a close (see the
  matching test findings above). Either add a comment recording why the
  redundant re-check is kept (e.g. defending against a future change to
  `parseFrontmatter`'s contract) and accept it as intentionally-untestable
  dead code, or remove the two early-return checks and rely on
  `parseFrontmatter`'s existing return-vs-throw contract for correctness —
  which would also let the two fragile monkeypatch tests in
  `stage.test.ts` be deleted.

- **[WARNING] Hidden dependency: inline `randomUUID()`** — lines 193 and
  380. `prepareStageCommands` and `replacePreparedCommands` each call
  `randomUUID()` directly to name a fresh staging/backup directory. Per the
  testability-design guideline, an inline `randomUUID()` call is a hidden
  dependency; the sanctioned fix is to make it an explicit parameter (e.g. a
  `newId: () => string` field defaulted to `randomUUID` at the composition
  root) or a dependencies-object member, the same shape already used
  elsewhere in this codebase for other side-effecting boundaries. No current
  test needs to control the generated id (all assertions treat the staging
  path as opaque), so this is a design observation rather than a live test
  gap — flagging it because the guideline calls out this exact pattern
  regardless of whether today's tests happen to route around it.

### `extensions/pi-claude-marketplace/bridges/commands/discover.ts`

- **[WARNING] Defensive `instanceof` fallback in `collectCommandFile` is
  unreachable by real input** — lines 288–290
  (`if (!(err instanceof CommandNameError)) { throw err; }`). Every error
  reaching this catch was constructed by `nameCommandInDir` in the same
  function, same module instance, same process, so the check can only be
  false if something externally rewrites `CommandNameError[Symbol.hasInstance]`
  — exactly what the paired test in `discover.test.ts` has to do to reach
  this line (see the corresponding unit-test finding above). Not urgent, but
  grouped with the `stage.ts` finding as the same broader pattern: this
  codebase's 100%-branch-coverage requirement is currently satisfied on this
  line by lying to a language-level operator rather than by a realistic
  scenario. Worth a decision on whether the guard is worth keeping.

- Otherwise clean: the file is thoroughly documented, DFS ordering and
  first-wins dedup are both correct and match their tests, no hidden
  dependencies (pure filesystem walker), no bare `any`/`as`/`!`, and
  complexity is well distributed across small named helpers.

### `extensions/pi-claude-marketplace/bridges/commands/unstage.ts`

Clean. Small, single-purpose, no hidden dependencies, ENOENT-tolerant unlink
loop matches its tests exactly.

### `extensions/pi-claude-marketplace/bridges/commands/types.ts`

Clean. Pure type definitions; the underscore-prefixed bridge-internal fields
and the barrel's deliberate non-re-export of them are documented and
verified by both `index.test.ts` and `types.test.ts`.

### `extensions/pi-claude-marketplace/bridges/commands/index.ts`

Clean. Barrel re-exports exactly the 8 runtime bindings and 2 types that
`index.test.ts` verifies; the header comment correctly explains why the
`_previousNames`/`_renamePairs` internal fields are withheld.

### Clean files

- `extensions/pi-claude-marketplace/bridges/commands/unstage.ts`
- `extensions/pi-claude-marketplace/bridges/commands/types.ts`
- `extensions/pi-claude-marketplace/bridges/commands/index.ts`

## Not covered

- I did not execute `node --test`, `npm run test:coverage:direct`, or
  `npm run check` per the diagnostic-review instructions (tree must stay
  untouched); the `stage.ts` dead-branch claim above is derived from static
  reading of this module plus the vendored
  `@earendil-works/pi-coding-agent/dist/utils/frontmatter.js` implementation,
  not from a coverage report — worth confirming with an actual coverage run
  before acting on it.
- `sonar.cpd.exclusions` duplication between `bridges/commands/stage.ts` and
  `bridges/agents/stage.ts` was noted and deliberately not reported, per the
  assignment.
