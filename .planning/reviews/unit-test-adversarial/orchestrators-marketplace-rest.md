# Orchestrators — marketplace shared, remove, autoupdate, info, list

**Scope:** `tests/orchestrators/marketplace/{shared,remove,autoupdate,info,list}.test.ts` and
`{remove,autoupdate,list}.messaging.test.ts`, paired with
`extensions/pi-claude-marketplace/orchestrators/marketplace/{shared,remove,autoupdate,info,list}.ts`
and `{remove,autoupdate,list}.messaging.ts` (add/update and their messaging modules are out of
scope — owned by another reviewer).
**Test files reviewed:** 8
**Production modules reviewed:** 8

## Summary

This area is the strongest-engineered slice of the suite I have seen: every production module has
a paired test, coverage of scope precedence (project-vs-user, explicit-vs-implicit) is real and
extensive, hermeticity is disciplined (real `mkdtemp` trees, `HOME`/`PI_CODING_AGENT_DIR` save
-restore, no live git/network boundary reached anywhere), and messaging tests compare whole
hand-written strings rather than substrings or production-derived values. The three themes worth a
fixing pass, in priority order: (1) `remove.test.ts` contains one seriously invasive test
(`Object.prototype` monkey-patching plus an incidental property-read-count assertion) and a helper
(`assertFailedOutcome`) whose `error` comparison is self-referential and therefore vacuous; both
let a wrong implementation pass. (2) Two production modules — `orchestrators/marketplace/list.ts`
and `orchestrators/marketplace/remove.ts` — carry an explicit NFR-5 no-network header claim with
**no** structural test anywhere (neither in their own test file nor in
`tests/architecture/no-orchestrator-network.test.ts`) that would catch a regression introducing a
git/network import; this is a real, silent gap in a hard project constraint. (3) A handful of
tests use generic `instanceof Error` plus a message regex where a specific, already-defined error
class (`PathContainmentError`/`SymlinkRefusedError`) or a structured field (`NodeJS
.ErrnoException.code`) was available for free and would have discriminated far more precisely.
Beyond these, four files use `assert.deepEqual` (loose) throughout instead of the project's
mandated `assert.deepStrictEqual`; low practical risk here (types already match on both sides) but
worth a mechanical cleanup pass.

## Unit test findings

### `tests/orchestrators/marketplace/shared.test.ts`

- **[BLOCKER] Weak `instanceof Error` check where a specific typed class is available** —
  `test('cascadeUnstagePlugin preserves the skill partial when command containment fails')`
  (lines 693–715). `outcome.cause` here is thrown by `bridges/commands/unstage.ts`'s
  `assertPathInside(...)` call, which per `shared/path-safety.ts` always constructs a
  `PathContainmentError` (or its `SymlinkRefusedError` subclass) — never a bare `Error`. The test
  only asserts `assert.ok(outcome.cause instanceof Error)` (true for literally any thrown value)
  plus `assert.match(outcome.cause.message, /command to unstage/)`. A regression that made the
  commands bridge throw a plain `Error` with unrelated cause but a message that still happens to
  contain "command to unstage" would pass. Add `assert.ok(outcome.cause instanceof
  PathContainmentError)` (import it from `shared/path-safety.ts`) alongside the existing message
  check — the regex on the message is fine to keep since the full message embeds the test's
  dynamic tmpdir path and reconstructing it exactly would mean duplicating the production
  formatter.
- **[WARNING] Placeholder variable name `result`** — lines 866 and 889
  (`classifyAutoupdateFlip` data-driven test and the "partitions every marketplace" test). Rename
  to something role-based, e.g. `flip` or `classified`, per the naming rule against bare
  `result`/`data`/`value`.

Everything else in this file is solid: `refreshGitHubClone` tests fully exercise call order and
failure short-circuiting via a hand-rolled `GitOps` fake with a shared call log (the correct
alternative to `strong-mock` when call order across multiple methods is the promise);
`cascadeUnstagePlugin` tests use real hermetic `mkdtemp` trees and assert whole `dropped` shapes
with `deepStrictEqual`; `notificationBoundary` uses `strong-mock` with `exactParams: true` and
definite call counts throughout (no `anyTimes()`, no `It.isAny()`); `createCredentialOpsFake` is a
genuine in-memory fake, so no live git/network/credential boundary is ever reached from this file.

### `tests/orchestrators/marketplace/remove.test.ts`

- **[BLOCKER] Global `Object.prototype` mutation plus an incidental implementation-detail
  assertion** — `test('retains the source clone when a forward-compatible recorded kind is
  unavailable')` (lines 487–544). The test installs a getter on `Object.prototype` itself (lines
  503–521) to make every unowned `.kind` property read across the **entire process** return a
  scripted sequence of values, in order to simulate an unrecognized future `source.kind`. This is
  process-global mutable state during test execution (restored in `t.after`, but live for the
  whole test body, including all internal `loadState`/`saveState` schema validation that also
  reads `.kind` on unrelated objects) — exactly the kind of hermeticity break the review flags, and
  it also runs against the style guide's flat "no prototype manipulation... of built-ins or the
  global object" rule. It is unnecessary: the same behavior (a source kind outside the four known
  literals) is reachable by seeding the marketplace record directly with
  `source: { kind: "some-future-kind", raw: "forward-compatible" }`, no monkey-patching required.
  Compounding this, line 537 asserts `assert.strictEqual(sourceKindReads, 12)` — a raw count of how
  many times the prototype getter fired across the *whole* `removeMarketplace` call (orchestrator
  logic plus every schema-validation pass over `state.json`). This number has no relationship to
  the behavior under test ("clone retained for an unrecognized source kind"); any unrelated change
  to how many times state is round-tripped or validated would break this assertion with zero
  change to user-visible behavior, and conversely it does not discriminate the actual behavior any
  more than the `pathExists(cloneDir)` check two lines later already does. Delete the
  `Object.prototype` patch and the `sourceKindReads` assertion; seed the record with a literal
  unmatched `kind` string instead.
- **[BLOCKER] `assertFailedOutcome`'s `error` field comparison is self-referential and therefore
  vacuous** — lines 191–211 (the helper), used at lines 258, 474, and 754.
  `assert.deepStrictEqual(outcome, { status: "failed", reason: expected.reason, error:
  outcome.error, cause: expected.cause })` compares `outcome.error` to itself
  (`error: outcome.error`), so that field can never fail the comparison regardless of its actual
  value or type. Only one of the three call sites (line 262) separately verifies
  `outcome.error instanceof MarketplaceNotFoundError`; the other two (474, 754) rely solely on this
  vacuous check plus the trailing `assert.strictEqual(outcome.error.message, expected.cause)`. A
  regression that returned `outcome.error` as a plain `{ message: "..." }` object instead of a
  real thrown `Error` would pass all three call sites undetected. Fix the helper to drop `error`
  from the structural comparison (compare only `{ status, reason, cause }`) and add an explicit
  `assert.ok(outcome.error instanceof Error)` (or the specific expected class where known) as its
  own assertion.
- **[BLOCKER] Generic `instanceof Error` + message regex where the concrete type/field was free** —
  lines 828–829 (`assert.ok(thrown instanceof Error); assert.match(thrown.message, /contains
  symlink/i);`) and lines 913–914 (`assert.ok(thrown instanceof Error); assert.match(thrown
  .message, /EISDIR|directory/i);`). The first is thrown by `shared/path-safety.ts`'s
  `assertPathInside` as a `SymlinkRefusedError` (a subclass of `PathContainmentError`) carrying
  structured `linkPath`/`linkTarget` fields; assert `thrown instanceof SymlinkRefusedError` instead
  of (or in addition to) the generic `Error` check. The second is a native `NodeJS.ErrnoException`
  with a `.code` field; assert `(thrown as NodeJS.ErrnoException).code === "EISDIR"` instead of
  matching the message text, which is more precise and does not depend on Node's phrasing.
- **[BLOCKER] No structural test proves `orchestrators/marketplace/remove.ts` stays network-free**
  — file-level. `remove.ts`'s own header states "NFR-5 (no network)" as a design constraint, but
  neither this test file nor `tests/architecture/no-orchestrator-network.test.ts` (whose
  `FORBIDDEN_TARGETS` list was inspected directly) names `orchestrators/marketplace/remove.ts`.
  Unlike `orchestrators/plugin/uninstall.ts`, which the same architectural test's own comments
  document as a deliberate, explained exemption, there is no comment anywhere explaining why
  `marketplace/remove.ts` is left out — this reads as an unintentional gap, not a documented
  design choice. A future edit that added a `platform/git`/`gitOps`/`DEFAULT_GIT_OPS` import to
  `remove.ts` would be caught by nothing except an eventual runtime failure in a network-less CI
  sandbox. Add `"extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts"` to
  `FORBIDDEN_TARGETS` in `tests/architecture/no-orchestrator-network.test.ts`.

Everything else here is exemplary: the source-kind/clone-retention matrix, the config-cascade
sweep across both `claude-plugins.json` layers with byte-exact expected JSON, the concurrent
in-lock-disappearance race (using a real `fs.watch` to trigger a real file replacement mid-lock),
and the partial-failure/retry-convergence tests are all built on real hermetic filesystems with
whole-value `deepStrictEqual` assertions and fully verified `strong-mock` notification boundaries.

### `tests/orchestrators/marketplace/autoupdate.test.ts`

- **[WARNING] `assert.deepEqual` used instead of the project's `assert.deepStrictEqual`** — lines
  297, 331, 604 (`assert.deepEqual(await configSnapshot(...), configBefore)`). Practical risk is
  low here since both sides of each comparison are produced by the same `configSnapshot` helper
  with matching primitive types (`string`/`bigint`), but it is a deviation from the stated
  convention. Replace with `assert.deepStrictEqual`.

Otherwise this file is very strong: it uses the real `proper-lockfile` to create genuine lock
contention (not a fake), real `chmod` to force an `EACCES` write failure, and asserts config-file
bytes/inode/mtime to prove idempotent no-op writes. Scope precedence (project-first, explicit vs.
implicit), the config-truth reclassification paths, and the unsynthesizable-source demotion path
are all covered by dedicated cases. `notificationBoundary` uses `strong-mock` correctly
(`exactParams: true`, definite counts, `It.matches()` only for the one message containing an
unpredictable atomic-write tmp-file suffix, which is a legitimate use).

### `tests/orchestrators/marketplace/info.test.ts`

- **[WARNING] `assert.deepEqual` used instead of `assert.deepStrictEqual`** — all 16 occurrences of
  environment-snapshot comparison in the file use the loose form (e.g. line 270; representative of
  all 16). Replace with `assert.deepStrictEqual`.
- **Note (see also the production-code finding on `info.ts` below):** nothing in this file itself
  performs a source-grep for a forbidden git/network surface. `info.ts`'s claim that such a gate
  lives here is inaccurate — it actually lives in `tests/architecture/no-orchestrator-network
  .test.ts`, which I confirmed does list `extensions/pi-claude-marketplace/orchestrators/marketplace
  /info.ts` in its `FORBIDDEN_TARGETS`. So the NFR-5 contract for this file **is** structurally
  proven, just not where the file's own comment says it is.

Coverage here is excellent otherwise: every source kind (github/url/path/unknown-fallback) with
and without optional fields, explicit vs. implicit scope (including project-then-user ordering and
each explicit-scope miss with cross-scope-hint wording), and every manifest failure mode (missing,
malformed JSON, schema-invalid, malformed stored source) is its own case, each proven read-only via
a full before/after filesystem tree snapshot (`snapshotEnvironment`) of both `home` and `cwd`.

### `tests/orchestrators/marketplace/list.test.ts`

- **[BLOCKER] No structural test proves `orchestrators/marketplace/list.ts` stays network-free** —
  file-level. `list.ts`'s header asserts "NO gitOps surface (NFR-5 by construction...)" but this is
  backed by nothing executable. `tests/architecture/no-orchestrator-network.test.ts`'s
  `FORBIDDEN_TARGETS` list contains `extensions/pi-claude-marketplace/orchestrators/plugin/list.ts`
  (the **plugin** list orchestrator) but not `extensions/pi-claude-marketplace/orchestrators
  /marketplace/list.ts` (this file's subject) — these are two different files. No comment anywhere
  documents this as an intentional exemption. Add
  `"extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts"` to `FORBIDDEN_TARGETS`.

Apart from that gap, this file is clean: consistent `assert.deepStrictEqual`, real hermetic
`HOME`/`cwd` trees with before/after snapshots proving no mutation, project/user precedence and
insertion-order coverage across all four source kinds, local-config-override and
invalid-local-config-is-ignored paths, and a structured (not substring) rejection check
(`{cause, message, name}` via `deepStrictEqual`) for the unsupported-schema-version case.

### `tests/orchestrators/marketplace/remove.messaging.test.ts`

Clean. Both render arms (`uninstalled`, `failed`) are exercised with and without optional fields
(version, scope, cause), every expected string is a hand-written literal compared with
`assert.strictEqual`, and the compile-time `@ts-expect-error` negatives correctly pin the
`RemovePrivateReason`/`RemoveRowMsg` structural constraints.

### `tests/orchestrators/marketplace/autoupdate.messaging.test.ts`

- **[WARNING] `assert.deepEqual` used instead of `assert.deepStrictEqual`** — lines 22–27.
- **[WARNING] No check that `AUTOUPDATE_CONTEXT.render.failed` and `NOAUTOUPDATE_CONTEXT.render
  .failed` stay the same function** — the production module's own comment states the two render
  maps must stay "byte-identical" via a single shared `renderFailedRow` reference, but the two
  render-behavior tests each exercise a *different* field combination through a *different*
  context object (test 2 via `AUTOUPDATE_CONTEXT` with scope+version+multiple reasons; test 3 via
  `NOAUTOUPDATE_CONTEXT` with none of those). Today this is safe because both contexts reference
  the literal same function, but nothing proves that, and if the two ever diverged for one specific
  field combination, this suite would not catch it for whichever combination it was never run
  against under the other context. Add `assert.strictEqual(AUTOUPDATE_CONTEXT.render.failed,
  NOAUTOUPDATE_CONTEXT.render.failed)` to lock the invariant.

Given the module's real surface is a single shared render function referenced by two label
wrappers, this 72-line file is proportionate, not a stub: it verifies both context identities are
distinct objects (`assert.notStrictEqual`), both expose the correct `Messaging.label`, and the one
render arm is exercised across the full field-combination matrix (with/without scope, version, and
multiple reasons) — this is not a case of "effectively untested."

### `tests/orchestrators/marketplace/list.messaging.test.ts`

- **[WARNING] `assert.deepEqual` used instead of `assert.deepStrictEqual`** — lines 17–20.

At 21 lines this is the smallest file in the sweep, but it is proportionate rather than a stub:
`list.messaging.ts`'s entire runtime surface is one static object literal with an **empty** render
map (list emits no plugin child rows by design), and the single test asserts every key of that
object (`Messaging`, `render`, `Messaging.label`, and the empty `render` key set) — there is no
behavior left uncovered.

### Clean files

- `tests/orchestrators/marketplace/remove.messaging.test.ts`

## Production code findings

### `extensions/pi-claude-marketplace/orchestrators/marketplace/info.ts`

- **[WARNING] Header comment names the wrong enforcing test file** — lines 4–6: "The grep-gate test
  in `tests/orchestrators/marketplace/info.test.ts` enforces this structurally." I confirmed
  `tests/orchestrators/marketplace/info.test.ts` contains no such grep/source-scan test; the real
  gate is `tests/architecture/no-orchestrator-network.test.ts`, which does list this exact file in
  its `FORBIDDEN_TARGETS`. Fix the comment to name the correct file, so a future reader does not
  weaken or remove the real gate under the mistaken belief this test file already covers it.

### `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts`

- **[WARNING] Two `as` casts without an adjacent rationale comment** — line 457
  (`tx.state as { marketplaces: Record<string, ExtensionMarketplaceRow> }`) and line 467
  (`record.source as { kind?: unknown }`), inside `runRemoveLockBody`. The narrowing rationale
  exists elsewhere in the file (the `ExtensionMarketplaceRow` doc comment a few lines below), but
  not at the cast sites themselves, unlike the comparable D-04 casts in `shared.ts` (lines 438,
  449) which do carry an inline reason. Add a one-line comment at each site pointing to why the
  narrower/looser type is needed there.

### `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts`

- **[WARNING] Five per-field `as string[]` casts instead of one object-level type annotation** —
  lines 307–313 (`const dropped = { skills: [] as string[], commands: [] as string[], ... }`
  inside `cascadeUnstagePlugin`). The style guide's preference is an annotation on the whole object
  literal over an `as` cast; here five individual casts stand in for what a single explicit type
  annotation on `dropped` would express once. Low priority — functionally harmless and needed only
  to avoid TypeScript inferring `never[]` for the empty array literals.

### Clean files

- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/list.ts`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/remove.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.messaging.ts`
- `extensions/pi-claude-marketplace/orchestrators/marketplace/list.messaging.ts`

## Not covered

- I did not execute `node --test`, `npm run check`, or any coverage tooling, per the diagnostic
  review's instructions to review by reading only.
- I did not trace every transitive bridge module (`bridges/agents`, `bridges/commands`,
  `bridges/mcp`, `bridges/skills`, `bridges/hooks`) that `shared.ts`'s `cascadeUnstagePlugin` tests
  exercise through real hermetic filesystems; I verified their invocation shape and the assertions
  made against their results, not their own internal test suites (those belong to other
  reviewers' assignments).
- I did not independently verify every `NodeJS.ErrnoException`/error-class claim against every
  bridge's source beyond the specific ones cited above (`PathContainmentError`,
  `SymlinkRefusedError`); I confirmed those two directly in `shared/path-safety.ts`.
