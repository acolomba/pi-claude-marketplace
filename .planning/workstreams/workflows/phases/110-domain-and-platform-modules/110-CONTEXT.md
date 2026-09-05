# Phase 110: Domain and platform modules - Context

**Gathered:** 2026-09-04
**Status:** Ready for planning
**Mode:** Auto-generated (infrastructure phase — no grey areas to settle)

<domain>
## Phase Boundary

The three leaf modules the workflows bridge needs — script admission
(`domain/workflow-script.ts`), project-key derivation
(`domain/workflow-project-key.ts`) and the engine home directory
(`platform/workflow-home.ts`) — are on this branch with owner tests and no
test-only seams, together with `generatedWorkflowName` in `domain/name.ts` and
the collision error in `shared/errors.ts`.

The modules themselves are a port, not a rewrite. The work of this phase is the
owner tests and the seam removal.

**Out of scope:** `bridges/workflows/*`, `persistence/locations.ts`,
`shared/errors-bridges.ts` (`WorkflowTargetOccupiedError`) and the `"workflows"`
widening of the `phase` union all belong to Phases 111-112 and must NOT be
pulled in here — the port branch carries them in the same commit, so the
checkout must be path-scoped rather than tree-wide.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — pure infrastructure
phase. Use the ROADMAP phase goal, its six success criteria, and the codebase
conventions to guide decisions.

</decisions>

<code_context>
## Existing Code Insights

### The port is a path-scoped checkout, not a tree-wide one

`features/workflow-port-wip` differs from `HEAD` in 17 files, but only five of
them belong to this phase. The ROADMAP names them explicitly:

```bash
git checkout features/workflow-port-wip -- \
  extensions/pi-claude-marketplace/domain/workflow-script.ts \
  extensions/pi-claude-marketplace/domain/workflow-project-key.ts \
  extensions/pi-claude-marketplace/platform/workflow-home.ts \
  extensions/pi-claude-marketplace/domain/name.ts \
  extensions/pi-claude-marketplace/shared/errors.ts
```

A `git checkout features/workflow-port-wip -- extensions/` would silently
**revert Phase 109**: the port branch predates the inversion and still carries
the pre-109 `domain/resolver.ts`, `domain/components/plugin.ts`,
`shared/notify.ts`, `shared/notify-reasons.ts` and
`shared/probe-classifiers.ts`. Phase 109's whole deliverable would be undone
with no conflict marker to warn anyone.

Verified: `domain/name.ts` and `shared/errors.ts` are **purely additive** against
`HEAD` (`git diff HEAD features/workflow-port-wip -- <path>` produces no
deletions for either), so taking those two whole is safe. `port/README.md`
records what is verbatim and what is not.

### The one test-only seam, and why `HOME` replaces it

`platform/workflow-home.ts` ships `setWorkflowHomeDirForTesting(dir)` writing a
module-global `override`. That is exactly the `_setXForTest` shape
`CONVENTIONS.md` §"Dependency injection over test-only seams" forbids, and
criterion 4 requires it go.

`workflowHomeDir()` reads `os.homedir()`, which on POSIX returns `process.env.HOME`
when set. The repo already relocates it that way: every `withHermeticHome`
helper in the test tree sets `process.env.HOME` around the body and restores it
in `finally`. `tests/integration/workflow-kind-inversion.test.ts:50` is the
closest model — it hands the temp home to the callback rather than re-reading
the global, with a comment explaining why the `?? ""` fallback the other shape
needs is a hazard. `tests/helpers/` no longer exists (the v1.19 refactor), so
each test file defines its own copy; that is the established pattern, not a
smell.

### The gate chain is wider than `npm test`

`npm run check` is `typecheck && lint && fallow && format:check &&
test:corresponding && test:corresponding:negative &&
test:coverage:direct:negative && test && test:integration`.

- `test:corresponding` (`scripts/check-corresponding-tests.mjs`) enforces a 1:1
  mirror: `extensions/pi-claude-marketplace/<rel>.ts` ⇄ `tests/<rel>.test.ts`.
  Three new files therefore need `tests/domain/workflow-script.test.ts`,
  `tests/domain/workflow-project-key.test.ts` and
  `tests/platform/workflow-home.test.ts`. `domain/name.ts` and
  `shared/errors.ts` already have owner tests to extend.
- `tests/{architecture,e2e,integration}` are exempt from the mirror rule, so an
  integration test cannot stand in for a missing owner test.
- `fallow dead-code` will flag any exported symbol nothing reaches. The three
  modules have no production consumer until Phase 111 — expect this and plan for
  it rather than discovering it at the gate.

### `acorn` is not yet a dependency

`package.json` has no `acorn` entry. Criterion 2 pins `^8.16.0`, the range the
host engine itself uses. Adding it touches `package-lock.json`; per
`version-bump` practice, commit the normalized lockfile rather than reverting
npm's rewrite.

### The Spike 025 case set is on disk

`.planning/spikes/025-canonical-path-mechanics/keyparity.mjs` holds the 14-case
array (unicode, `---leading-and-trailing---`, the 47-char + `-b` truncation case
that reintroduces a trailing dash, `/`, a relative path, and a `..` spelling
that must normalize onto case 1) plus the normalization-collision check. Its
README records the two orderings that are easy to get wrong: the dash strip runs
**before** the 48-char truncation, and `resolve()` runs before `basename()`.
Criterion 6 wants a mutation-sensitive assertion — the test must fail if the
`.slice(0, 12)` hash width changes, so the expected keys have to be literal
values, not values recomputed by the test.

### WNAM-06's rewording is already discharged

Phase 109's CONTEXT deferred "**`WNAM-06` needs rewording**" to this phase, but
`workflows-REQUIREMENTS.md:55` already carries the amendment dated 2026-09-04:
the shared-`generatedColonName` clause is replaced with "mirrors
`generatedSkillName`'s structure and its owner test pins the `<plugin>:<elided>`
output". No requirements edit is owed here — only the owner test that the
amendment now leans on.

### `shared/errors.ts` gets one class, not two

Criterion 1 says "the two error classes in `shared/errors.ts`". The port adds
`WorkflowNameCollisionError` plus its `WorkflowNameCollision` interface there;
the second class, `WorkflowTargetOccupiedError`, lives in
`shared/errors-bridges.ts` and is raised by `bridges/workflows/stage.ts`. It
belongs to Phase 111, and the ROADMAP's own checkout command does not name
`errors-bridges.ts`. Read criterion 1 as one class + one interface here.

### Integration point

None in production code. Nothing imports these three modules until
`bridges/workflows/` lands in Phase 111. `platform/workflow-home.ts` imports no
Pi package, so it does not engage the `pi-api.ts` peer-import chokepoint despite
living in `platform/`.

</code_context>

<specifics>
## Specific Ideas

The ROADMAP is explicit: **do not rewrite the modules from scratch.** Read
`.planning/workstreams/workflows/port/README.md` before touching them — it
records what is verbatim, what is not, and why the one non-verbatim piece
(`generatedWorkflowName` written standalone rather than over a shared
colon-name helper) is deliberate.

`meta.name` extraction must survive the comment decoy, the string decoy and the
double-quoted key, and report its four non-admission verdicts distinctly
(`no-meta`, `meta-not-object-literal`, `meta-spread` on the skip side, and the
refusal causes on the other). Spike 026 (`meta-name-extraction`) is the
companion evidence.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 111 must invert the no-artifact half** of
  `tests/integration/workflow-kind-inversion.test.ts` — the
  `assert.rejects(stat(<HOME>/.pi/workflows), { code: "ENOENT" })` line becomes
  an assertion that the envelopes ARE written.
- **Phase 111 must bump `EXTENSION_VERSION`** in the same change that lands
  `bridges/workflows/`, to open the `backfill.ts:76` early-return gate.
- Both are Phase 111's, not this phase's, and this phase must not pre-empt
  either. Do **not** bump `EXTENSION_VERSION` here (A-03).

</deferred>
