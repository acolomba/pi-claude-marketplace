# Phase 111: Workflows bridge - Context

**Gathered:** 2026-09-05
**Status:** Ready for planning
**Mode:** Auto-generated (port phase — the one message-shape decision is constrained by an existing template, recorded below)

<domain>
## Phase Boundary

The sixth bridge exists as a discover / stage / unstage triplet with the same
shape as its five siblings, and writes its envelopes atomically into a directory
outside every scope root.

The bridge itself is a port. `bridges/workflows/{discover,index,stage,types,unstage}.ts`
and the `persistence/locations.ts` additions come verbatim from
`features/workflow-port-wip`. **The work of this phase is the owner tests**, plus
three things the port does not carry:

1. The stem-fallback `warnings[]` row (criterion 4) — new behavior, decided below.
2. The `EXTENSION_VERSION` bump (criterion 8) — an obligation Phase 109 inverted.
3. The install-window assertion inversion (criterion 9) — an existing test whose
   meaning must be turned, not deleted.

**Out of scope:** the ledger phase and cascade unstage (Phase 112), the
remaining lifecycle verbs and read surfaces (Phase 113), the soft-dependency
marker and `docs/workflows-compatibility.md` (Phase 114).

</domain>

<decisions>
## Implementation Decisions

### The stem-fallback warning shape (criterion 4)

The port already establishes one template for every per-file soft-fail in
`bridges/workflows/discover.ts`:

```
workflow script "<fileName>" in "<workflowsDir>" <outcome>: <reason>
```

`softFailWarning` composes it; `readFailureWarning`, `skippedWarning` and
`refusedWarning` supply the three existing outcome phrases (`could not be read
and was skipped`, `was not installed`, `was refused`). `verdictWarning` returns
`undefined` for both **admitted** arms.

`stem-fallback` is an admitted arm — the envelope IS written. So criterion 4
needs a **fourth outcome phrase for an admitted-but-caveated** arm, not a
soft-fail. Reuse `softFailWarning`; do not compose a second template.

The phrase must carry what the ROADMAP dictates: the command will not run until
the script declares a literal `name` and `description`. Wording is Claude's
discretion within that template and that meaning. Subject-first, per the house
row grammar — the file is the subject; the status never leads.

Do NOT narrow the fallback in `domain/workflow-script.ts` instead. Phase 110
settled that: it would replicate engine structural rules the module deliberately
declines to copy, and it cannot see the `description` half at all.

### Everything else

At Claude's discretion — the remaining work is owner tests against a ported
bridge, plus two mechanical obligations with their own criteria. Use the ROADMAP
success criteria, `110-RESEARCH.md`'s measured findings, and the codebase
conventions.

</decisions>

<code_context>
## Existing Code Insights

### The bridge is a path-scoped checkout, and the trap is the same one Phase 110 had

```bash
git checkout features/workflow-port-wip -- \
  extensions/pi-claude-marketplace/bridges/workflows \
  extensions/pi-claude-marketplace/persistence/locations.ts
```

A tree-wide `git checkout features/workflow-port-wip -- extensions/` **reverts
Phase 109** — the port branch predates the kind inversion and carries pre-109
`domain/resolver.ts`, `domain/components/plugin.ts`, `shared/notify.ts`,
`shared/notify-reasons.ts` and `shared/probe-classifiers.ts`, with no conflict
marker. Phase 110 proved the blast radius with
`git status --porcelain -- <those five files> | wc -l` printing `0` after every
checkout; do the same here.

`shared/errors-bridges.ts` (`WorkflowTargetOccupiedError`) is also owed by this
phase — `bridges/workflows/stage.ts` raises it, and Phase 110 deliberately left
it behind.

### What `persistence/locations.ts` gains

`workflowsHomeDir` (`~/.pi/workflows/`), `workflowsSavedDir` (the only workflows
member that branches on scope: `<home>/saved/` for user,
`<home>/projects/<key>/saved/` for project), `workflowsStagingDir`
(`<home>/.pi-claude-marketplace-staging/`, deliberately NOT under
`extensionRoot`, so the commit `rename()` cannot cross a filesystem boundary —
WPTH-05), and `workflowArtifactPath(generatedName)`, which is the chokepoint the
bridge MUST route through.

These are the first writable paths **outside** `<scopeRoot>`. NFR-10 grows a new
writable root, not a subdirectory (WPTH-04) — `assertPathInside` still governs,
against the new root.

### The gate chain and the owner-test rule are unchanged from Phase 110

`npm run check` is `typecheck && lint && fallow && format:check &&
test:corresponding && test:corresponding:negative &&
test:coverage:direct:negative && test && test:integration`. `test:corresponding`
enforces a 1:1 `extensions/…/X.ts` ⇄ `tests/…/X.test.ts` mirror and runs
**before** `npm test`, so five new bridge files need five owner tests in the
same commit that lands them.

Every owner test must import **every** export of its module, including
type-only ones — `fallow` runs `production: false`, so `tests/` is in the graph
and the owner test is the consumer. Phase 110 measured this. No `fallow-ignore`.

`fallow` also enforces `boundaries.zones`: `bridges-workflows` will need a zone
entry, and cross-bridge-kind imports are forbidden — the workflows bridge must
not import from `bridges/commands` or any sibling.

### Committing from this worktree

`.git` is a file, not a directory, so the trufflehog pre-commit hook aborts
structurally. Run `pre-commit run --files <paths>`, confirm with a **filesystem**
trufflehog scan (`--results=verified,unknown --fail`), then commit with
`SKIP=trufflehog` — that hook only. Never `--no-verify`, never `--amend`. The
`prettier` hook rewrites files mid-run and the commit still succeeds; check
`git status` after each commit.

</code_context>

<specifics>
## Specific Ideas

**Criterion 8 — the `EXTENSION_VERSION` bump is load-bearing, not bookkeeping.**
It sits at `0.18.1` in `shared/extension-version.ts`, matching `package.json`.
`orchestrators/reconcile/backfill.ts:76` returns early while
`state.lastReconciledExtensionVersion === EXTENSION_VERSION`, so the bump is the
only thing that opens the gate and lets `supportedSetGrew` (`backfill.ts:343`)
re-materialize records the released v0.18.1 wrote. A user who `--partial`-installed
a workflow-bearing plugin on 0.18.1 carries
`compatibility: { installable: false, unsupported: ["workflows"] }` on disk, and
D-109-01 retired the `workflows` arm of `kindToReason`, so their row renders
`{unsupported component}` — a token naming a kind Pi now supports. Without the
bump those records never converge.

Per the version-bump checklist, a bump touches `package.json`, `package-lock.json`,
`EXTENSION_VERSION` and `sonar-project.properties` `projectVersion`, and records
the change in `CHANGELOG.md`; re-run `npm test` afterward, because pre-commit
does not run the suite that guards the version.

**Criterion 9 — invert the assertion, do not delete it.**
`tests/integration/workflow-kind-inversion.test.ts:181-182` currently asserts
`~/.pi/workflows` does NOT exist. That was true only during the D-109-06 window.
It must become an assertion that the envelopes ARE written. Its positive
precondition (the fixture resolves `workflows` supported, guarded at line 164
against tautology) stays as-is; only the ENOENT half moves. An assertion that
quietly stays green while meaning the opposite is worse than no assertion.

**Two SonarCloud items are standing, not new.** `fallow dupes` reports a clone
family in `domain/name.ts` (fallow exits 0; `sonar-project.properties` does not
list that file in `sonar.cpd.exclusions`). The remedy at PR time is the exclusion
entry with the `port/README.md` rationale, **not** a shared-helper refactor —
WNAM-06's 2026-09-04 amendment explicitly declines that mechanism. Expect the
new bridge, which mirrors its five siblings by design, to add more.

</specifics>

<deferred>
## Deferred Ideas

- The sixth **ledger phase** and cascade unstage are Phase 112 (WLIF-01..03).
  This phase builds the triplet; it does not wire it into `install.ts`.
- Update, enable/disable, reconcile and the `info`/`list` read surfaces are
  Phase 113.
- The host engine as a third **soft dependency**, the
  `requires pi-dynamic-workflows` marker, and `docs/workflows-compatibility.md`
  are Phase 114.
- `NAMEFOLD-01` (`.planning/BACKLOG.md`) — generated-name case-folding exposure
  across the agent and command bridges. Repo-wide policy question, deliberately
  not this phase's.
- `IN-01` — no source-size cap before `acorn.parse`. Recorded as a Phase 115
  candidate.

</deferred>
