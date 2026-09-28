# Phase 111: Workflows bridge - Research

**Researched:** 2026-09-05
**Domain:** Porting a sixth component bridge into a five-bridge codebase — owner tests, `fallow` zone config, a new writable root outside `<scopeRoot>`, a new warning row, a version bump, and the commit ordering that keeps `npm run check` green
**Confidence:** HIGH (almost every claim below was measured in a throwaway probe worktree this session, not inferred)

## Summary

The port compiles and lints clean against this branch as-is. I built a detached
probe worktree at HEAD, applied exactly the checkout the ROADMAP prescribes plus
`shared/errors-bridges.ts`, and measured the whole gate chain. `tsc --noEmit`
exits 0. `eslint` on the three paths exits 0. `prettier --check` is clean on all
of them. `fallow health` and `fallow dupes` both exit 0 — and, contrary to the
CONTEXT's expectation, the new bridge adds **zero** duplicated lines by fallow's
measure (993 lines / 38 files before and after, byte-identical). `fallow
dead-code` exits 1 for exactly two reasons, both of which are this phase's work:
five files with no matching boundary zone, and sixteen barrel re-exports with no
consumer. `test:corresponding` reports exactly five `missing-test` violations.
I then drove the whole triplet end to end in a hermetic `$HOME` — discover,
prepare, commit, the WR-06 occupancy refusal, and unstage all behave as their
headers claim.

Two of the nine success criteria cannot be satisfied as written, and both
failures are measured rather than argued.

**Criterion 9 is not achievable in this phase's scope.** With the complete bridge
present in the tree, `tests/integration/workflow-kind-inversion.test.ts` still
**passes** — its `assert.rejects(stat(<HOME>/.pi/workflows), {code:"ENOENT"})`
is still true, because nothing wires the bridge into `installPlugin`. That wiring
is Phase 112's criterion 1, and this phase's own CONTEXT puts it out of scope.
Worse, the fixture that test installs ships `export default { name: "greet" }`,
which `admitWorkflowScript` classifies `skipped` / `no-meta` — so **no envelope
would be written even after Phase 112 wires the ledger**, unless the fixture body
is changed too. See §Q7 for the recommended resolution.

**Criterion 8's mechanism is real but its stated effect lands at release, not at
this phase.** `backfill.ts:76` and `:343` are exactly where the criterion says
they are and do exactly what it says. But the re-materialize runs through
`reinstallPlugin`, which has no workflows phase until Phase 112. Bumping here is
still correct — the whole milestone ships as one release, so real users cross the
version gate exactly once, by which time the bridge is wired — but the plan
should say that out loud rather than claim envelopes appear in this phase. See
§Q6.

**Primary recommendation:** land the port in four to five green commits (§Q8),
write ~2,100 lines of owner test modelled directly on
`tests/bridges/commands/*.test.ts`, add the `bridges-workflows` zone to
`.fallowrc.json` in the same commit as the bridge files, emit the criterion-4
row from `discover.ts::verdictWarning` (not from `stage.ts`), and surface the
criterion-9 conflict to the operator before writing the task list rather than
after.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**The stem-fallback warning shape (criterion 4)**

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

### Claude's Discretion

**Everything else.** The remaining work is owner tests against a ported bridge,
plus two mechanical obligations with their own criteria. Use the ROADMAP success
criteria, `110-RESEARCH.md`'s measured findings, and the codebase conventions.

### Deferred Ideas (OUT OF SCOPE)

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

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WBRG-01 | Each discovered script installs as a JSON envelope `{name, description, script}` carrying the Claude source verbatim | Measured envelope bytes in §Q1; `buildEnvelope` pins key order; `description` omitted (never synthesized) when the verdict carries none |
| WBRG-02 | Discovery is flat, non-recursive, refuses symlinks (D-14), dedups first-wins | `discover.ts::isWorkflowScriptFile` + `pathDedupKey`; §Q2 maps every branch to a test; §Pitfall 1 flags the `darwin`/`win32` branch |
| WBRG-03 | An unreadable/unstageable script is reported through `warnings[]` without failing the install | `readFailureWarning` / `verdictWarning`; measured empty `warnings[]` for a well-formed pair in §Q1 |
| WBRG-04 | Installed workflows are found by the engine's own directory scan; no engine API call, no index | Envelope lands at `<workflowsSavedDir>/<plugin>:<name>.json`, measured §Q1; only the commit `rename` touches a scanned directory |
| WPTH-01 | user → `~/.pi/workflows/saved/`; project → `~/.pi/workflows/projects/<key>/saved/` | Measured live: `/tmp/wf-home-XXXX/.pi/workflows/projects/wf-cwd-v4ahg8-6f9949fd1f9d/saved` |
| WPTH-03 | The project key is derived locally and matches the engine byte-for-byte | Landed in Phase 110 (`domain/workflow-project-key.ts`, pinned by 14 literal cases); this phase only consumes it through `locationsFor` |
| WPTH-04 | NFR-10 grows a new writable **root**, not a subdirectory | §Q3b: `assertPathInside` is parameterised on its boundary, so no loosening is needed — the bridge passes `workflowsHomeDir` / `workflowsSavedDir` / `stagingRoot` as boundaries |
| WPTH-05 | Staging sits adjacent to its target; the commit `rename()` never crosses a filesystem | §Q5: measured `path.dirname(workflowsStagingDir) === workflowsHomeDir`; EXDEV reproduced on this machine between `/tmp` (tmpfs) and `$HOME` (XFS) |

## Project Constraints (from CLAUDE.md)

Binding directives extracted from `CLAUDE.md`, `.claude/CLAUDE.md`,
`.planning/codebase/CONVENTIONS.md` and `.claude/rules/*`:

| Directive | Source | Consequence for this phase |
|---|---|---|
| Read a file before editing; trace callers before modifying a function | CLAUDE.md §Guidelines | Read `tests/bridges/commands/*.test.ts` before writing the workflows analogues |
| Never commit to `main`; branch names `features/*` | CLAUDE.md §Git | Work stays on `features/workflow` |
| Conventional Commits; title 5–72 chars; body lines ≤ 80; **no GSD milestone/phase mentions** | CLAUDE.md §Git | Commit subjects like `feat(workflows): add the workflows bridge triplet` |
| Run `pre-commit run --files <paths>` **before** `git commit`; fix, restage, re-run until clean; never `--no-verify`; never `--amend` after a hook failure | CLAUDE.md §Git | Per-commit ritual in §Q8 |
| In a worktree, prefix `SKIP=trufflehog` **only** after a clean filesystem trufflehog scan | CLAUDE.md §Git | This checkout is a worktree (`.git` is a file) |
| Never rebase; update by merging | CLAUDE.md §Git | — |
| Offer a version bump before creating a PR; record changes in `CHANGELOG.md` | CLAUDE.md §Versioning | Criterion 8 makes the bump mandatory, not optional (§Q6) |
| `npm run check` must stay green (typecheck + ESLint + fallow + Prettier + unit + integration) | CLAUDE.md §Constraints (NFR-6) | The ordering in §Q8 exists to satisfy this at every commit boundary |
| All disk mutations atomic (tmp + rename or atomic JSON write) | NFR-1 | `stage.ts` writes into staging then renames; `atomic-json.ts` deliberately unused (its header scopes it to state-guard files) |
| Refuse to write outside the admitted roots | NFR-10 | WPTH-04 admits `<workflowsHomeDir>` as a third root; every leaf still routes through `assertPathInside` |
| All user-visible output through `ctx.ui.notify` via `shared/notify.ts` | IL-2 | The bridge returns `warnings[]` strings; it renders nothing. Criterion 4's row is a string in that array, not a notify call |
| No comment or test title may carry a `Phase NN` / `Plan NN` / `Wave N` / `Pitfall N` token; requirement and decision IDs are the sanctioned anchors | `.claude/rules/typescript-comments.md` | Phase 110's verifier caught exactly this leak at `workflow-script.ts:279`; do not repeat it in the bridge's comments or the new warning's docblock |
| One top-level `describe()` per exported entrypoint; no nesting; `// arrange` / `// act` / `// assert`; `assert.deepStrictEqual` over property-at-a-time; errors asserted by class and fields, never message substring | `.claude/rules/typescript-unit-testing.md` | §Q1 sizes the five test files against this |
| Each source-test pair reaches 100% function, line and branch coverage **run alone**; no coverage-ignore directives | same rule | §Q1 flags the two modules where this is hard |
| Markdown is formatted by `mdformat`, never `prettier` | memory | `CHANGELOG.md` edits go through the pre-commit hooks, not `prettier --write` |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| Enumerate + decide workflow scripts | `bridges/workflows` (discover) | `domain/workflow-script.ts` | The bridge does IO and containment; the domain module holds the pure verdict rule |
| Compose every workflow path | `persistence/locations.ts` | `platform/workflow-home.ts`, `domain/workflow-project-key.ts` | `locations.ts` is the sole sanctioned composer (`workflowArtifactPath`); the other two are its inputs |
| Write / commit / roll back envelopes | `bridges/workflows` (stage) | `shared/fs-utils.ts`, `shared/path-safety.ts` | Bridge owns the stage/commit/unstage triplet; leaf utilities own rm-and-leak and containment |
| Report a per-file soft-fail or caveat | `bridges/workflows` (discover) | — | The bridge owns `warnings[]`; `shared/notify.ts` renders, and is not touched this phase |
| Wire the bridge into an install | **Phase 112** (`orchestrators/plugin/install.ts`) | — | Explicitly out of scope; this is why criteria 8 and 9 do not land as written |
| Declare the boundary zone | `.fallowrc.json` | — | An unzoned file is a hard build failure (measured, §Q3) |

## Standard Stack

No new packages. The phase adds no dependency, so there is no
`## Package Legitimacy Audit` to run — verified by reading every `import` in the
five ported files: `node:crypto`, `node:fs`, `node:fs/promises`, `node:path`
plus in-repo relative specifiers only.

| Library | Version | Purpose | Why standard |
|---|---|---|---|
| `node:test` | Node 24 built-in | Runner + `t.after()` lifecycle | House rule; no other runner permitted [VERIFIED: `.claude/rules/typescript-unit-testing.md`] |
| `node:assert/strict` | built-in | Assertions | same |
| `acorn` | `^8.16.0` | Parses the script in `domain/workflow-script.ts` | Landed in Phase 110; already a runtime dependency [VERIFIED: `package.json`] |

**Version verification:** not applicable — nothing is installed.

## Architecture Patterns

### System Architecture Diagram

```text
      caller (Phase 112's ledger phase; Phase 111's tests)
                │  { locations, pluginName, resolved, previousWorkflowNames? }
                ▼
   ┌──────────────────────────────────────────────────────────────┐
   │ bridges/workflows/stage.ts :: prepareStageWorkflows           │
   │   1. discoverPluginWorkflows ────────────────────────────┐    │
   │   2. assertNoWorkflowNameCollisions (FULL verdict array)  │    │
   │   3. first-wins dedup on generatedName                    │    │
   │   4. admitted==0 && previous==0 ? ─► kind:"noop" ─────────┼──► │ (engine root never created)
   │   5. stagingRoot = <workflowsStagingDir>/<uuid>           │    │
   │      assertPathInside(workflowsHomeDir, stagingRoot)      │    │
   │      mkdir; per-file writeFile(envelope JSON)             │    │
   └───────────────────────────────────────────────────────────┼────┘
                │ kind:"staged" { stagingRoot, _renamePairs,   │
                │                 _previousNames }             │
                ▼                                              │
   ┌──────────────────────────────────────────────────────────┐│
   │ commitPreparedWorkflows                                   ││
   │   mkdir(workflowsSavedDir)                                ││
   │   displacePreviousTargets  → stagingRoot/.previous/       ││
   │   assertTargetsUnoccupied  → WorkflowTargetOccupiedError  ││  ◄── WR-06 refusal,
   │   for pair: rename(from → to)   ◄── the ONLY write the    ││      BEFORE first rename
   │                                     engine can observe    ││
   │   catch: reverse renames, restore displaced,              ││
   │          CR-01 skip cleanup if a restore failed           ││
   │   onPlaced(names) on EVERY path incl. throw               ││
   └───────────────────────────────────────────────────────────┘│
                │                                               │
                ▼                                               ▼
   ~/.pi/workflows/{saved | projects/<key>/saved}/<plugin>:<name>.json
                ▲                                       ▲
                │ read by the host engine's own          │ removed by
                │ createWorkflowStorage directory scan   │ unstagePluginWorkflows
                                                          (by recorded name only)

   ┌── discover.ts ───────────────────────────────────────────────┐
   │ for each componentPaths.workflows entry:                     │
   │   resolve → assertPathInside(pluginRoot, dir)   [loud]       │
   │   readdir (ENOENT/ENOTDIR → [])                              │
   │   sort by name                                               │
   │   per entry: dotfile? dir? bad suffix? → drop silently        │
   │              lstat → symlink? → drop  | throw → warnings[]    │
   │              path dedup (case-folded on darwin/win32)         │
   │              readFile + UTF-8 round trip → warnings[] on fail │
   │              admitWorkflowScript → verdict                    │
   │              verdictWarning → warnings[]  ◄── criterion 4     │
   └──────────────────────────────────────────────────────────────┘
```

### Recommended file layout

```text
extensions/pi-claude-marketplace/bridges/workflows/
├── types.ts       # 13 type exports, zero runtime  (type-only coverage escape)
├── discover.ts    # 1 runtime export
├── stage.ts       # 3 runtime exports
├── unstage.ts     # 1 runtime export
└── index.ts       # barrel: 5 runtime + 11 type re-exports

tests/bridges/workflows/
├── types.test.ts      # mirrors tests/bridges/commands/types.test.ts
├── discover.test.ts   # mirrors .../commands/discover.test.ts
├── stage.test.ts      # mirrors .../commands/stage.test.ts
├── unstage.test.ts    # mirrors .../commands/unstage.test.ts
└── index.test.ts      # mirrors .../commands/index.test.ts
```

### Pattern 1: relocate `$HOME` before constructing the locations bundle

`locationsFor` calls `workflowHomeDir()` **eagerly**, at bundle-construction time,
and freezes the result. `os.homedir()` re-reads `HOME` on every call and caches
nothing. Therefore a test that sets `HOME` *after* `locationsFor` gets a bundle
pointing at the developer's real `~/.pi/workflows/`.

```ts
// Source: extensions/pi-claude-marketplace/persistence/locations.ts
//   (features/workflow-port-wip) — `const workflowsHomeDir = workflowHomeDir();`
//   inside locationsFor, before Object.freeze.
async function hermeticWorkflowHome(t: TestContext, label: string): Promise<string> {
  const home = await mkdtemp(path.join(tmpdir(), `workflows-${label}-`));
  const previousHome = process.env.HOME;

  t.after(async () => {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }

    await rm(home, { recursive: true, force: true });
  });
  process.env.HOME = home;
  return home;              // hand it back; never re-read the global you just wrote
}
```

This is the exact helper Phase 110 wrote for `tests/platform/workflow-home.test.ts`
and the integration test's `withHermeticHome`. Every workflows-bridge owner test
that constructs a `ScopedLocations` MUST call it **before** `locationsFor`.

### Pattern 2: inject a rename failure with a property getter

The house technique for reaching the rollback branches, taken verbatim from
`tests/bridges/commands/stage.test.ts:657-672`: redefine `from` (or `to`) on one
`_renamePairs` element as a getter that returns the real path on its first read
and a blocker path afterwards. `_renamePairs` is `Object.freeze`'d as an *array*;
its elements are plain mutable objects, so `Object.defineProperty` on an element
works.

⚠ The commands variant — "make the target a non-empty directory" — does **not**
transfer. `commitPreparedWorkflows` runs `assertTargetsUnoccupied` before its
first rename, so a directory at a target path produces `WorkflowTargetOccupiedError`,
not a rename failure. Use the getter on `to` (first read by the occupancy check,
second by the rename loop) or on `from`.

### Pattern 3: spread a real `ScopedLocations` to override one composer

The `SCOPED_LOCATIONS_BRAND` is a computed **enumerable own symbol** property, and
object spread copies enumerable own symbol properties. So
`{ ...locationsFor("project", cwd), workflowArtifactPath: custom }` type-checks as
a `ScopedLocations` and is the cleanest lever for driving `displacePreviousTargets`
and the CR-01 restore-failure branch, which otherwise have no reachable seam.

### Anti-patterns to avoid

- **Adding a second warning template.** `softFailWarning` is the one composer;
  criterion 4 adds a fourth *outcome phrase*, not a second shape. (Locked.)
- **Narrowing the stem fallback in `domain/workflow-script.ts`.** Settled in
  Phase 110 (WR-09); the module cannot see the `description` half at all.
- **Adding a `fallow-ignore` marker.** Phase 110 measured that owner tests are
  the sanctioned consumers. The repo's nine markers are reserved for
  compile-time proof types and the two live-UAT drivers.
- **Reaching a module through the barrel in its owner test.** The corresponding-test
  gate has a distinct `proxy-owned` verdict for exactly that, and it is a violation.
- **`git checkout features/workflow-port-wip -- extensions/`** (tree-wide). It
  silently reverts Phase 109 across five files, with no conflict marker.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| Composing a workflow artifact path | `path.join(savedDir, name + ".json")` | `locations.workflowArtifactPath(name)` | It is the sole composer that runs `assertSafeName` + `assertPathInside`; `stage.ts`'s header says so explicitly, and the name originates in an untrusted `meta.name` |
| Removing a staging tree | `fs.rm` + try/catch | `shared/fs-utils.ts::cleanupStaging` | Returns a leak string instead of throwing; T-03-03 bounds it to a single `rm` call |
| Testing existence without following symlinks | `fs.existsSync` / `stat` | `shared/fs-utils.ts::pathExists` | `lstat`-based, consistent with PS-1 "refuse all symlinks" |
| Relocating the workflow home in a test | a `setWorkflowHomeDirForTesting` seam | assign `process.env.HOME` with `t.after()` restore | Phase 110 deliberately **deleted** that seam; re-introducing one contradicts a landed decision |
| Deciding a script's fate | anything in the bridge | `domain/workflow-script.ts::admitWorkflowScript` | The bridge does IO and warnings; the verdict rule is the domain module's and was pinned by 233 tests in Phase 110 |
| A shared colon-name helper for commands + workflows | extracting `generatedColonName` | the standalone `generatedWorkflowName` | WNAM-06's 2026-09-04 amendment explicitly declines the mechanism |

**Key insight:** every "don't" here names a decision that has already been made
and reviewed in this workstream. The cost of re-litigating one is a review
finding, not a design debate.

## Runtime State Inventory

This is a port, not a rename or migration, but it is the first phase that writes
**outside every scope root**, so the inventory is answered explicitly.

| Category | Items found | Action required |
|---|---|---|
| Stored data | **New writes, no re-keying.** `<home>/.pi/workflows/{saved,projects/<key>/saved}/<plugin>:<name>.json` and the transient `<home>/.pi/workflows/.pi-claude-marketplace-staging/<uuid>/`. Nothing pre-existing is re-keyed. Measured live in §Q1. | none (creation only) |
| Live service config | **None.** The host engine is discovered by directory scan (WBRG-04); no API is called and no index is mutated. | none |
| OS-registered state | **None in this phase.** A workflow command registers only when the engine scans, which requires the ledger wiring (Phase 112). | none |
| Secrets / env vars | **One read, no write.** `$HOME` via `os.homedir()` inside `platform/workflow-home.ts`. `PI_CODING_AGENT_DIR` is deliberately **not** honoured for this root. | none |
| Build artifacts / installed packages | **None.** No dependency is added or moved. | none |
| Developer-machine hazard | ⚠ **A workflows owner test that forgets Pattern 1 writes into the developer's real `~/.pi/workflows/saved/`.** No gate catches it: `assertPathInside` succeeds, the file lands, and the test passes. | Every test that constructs a `ScopedLocations` relocates `HOME` first |

## Common Pitfalls

### Pitfall 1: the `pathDedupKey` platform branch is unreachable on Linux and CI

**What goes wrong:** `npm run test:coverage:direct -- extensions/.../discover.ts`
reports a missed branch and the pair fails the 100 % gate.

**Why:** `pathDedupKey` reads
`process.platform === "darwin" || process.platform === "win32"`
(`discover.ts:124`). On the Linux dev box and on the Node 24 CI runner only the
false arm is ever taken.

**How to avoid:** relocate the process global the same way Pattern 1 relocates
`HOME` — `Object.defineProperty(process, "platform", { value: "darwin",
configurable: true })` with the original restored in a `t.after()` registered
**before** the mutation. This is 110-RESEARCH's Pattern 1 applied to a second
global, and it is the only route: `process.platform` is read inline, with no
parameter and (correctly, per Phase 110's precedent) no test seam.

**Warning signs:** `branches N-1/N` on `discover.ts` in the direct-coverage report.

### Pitfall 2: the two `locations.test.ts` bundle cases fail the moment the port lands

**What goes wrong:** `node --test tests/persistence/locations.test.ts` → 11 tests,
9 pass, **2 fail**. Measured.

**Why:** the file pins `assert.deepStrictEqual(Object.keys(locations), LOCATION_KEYS)`
— an exhaustive, **ordered** key list — in both the user-bundle and project-bundle
cases. The port inserts three fields and one method.

**How to avoid:** update `LOCATION_KEYS` to exactly this order (transcribed from
the measured `Object.keys(locations)` output):

```
… 'hooksDir', 'cacheDir', 'marketplaceNamesCacheFile',
'workflowsHomeDir', 'workflowsSavedDir', 'workflowsStagingDir',
'pluginDataDir', 'marketplaceDataDir', 'sourceCloneDir', 'pluginCloneDir',
'sourcesStagingDir', 'pluginCacheFile', 'workflowArtifactPath'
```

Leave `fixedLocationBundle()` alone — it asserts *values*, and the three new
values are `$HOME`-derived, which would make the two existing cases
home-dependent. Add the value assertions in a new, `HOME`-relocated case instead.

**Warning signs:** a `deepStrictEqual` diff listing `workflowsHomeDir` in `actual`
but not `expected`.

### Pitfall 3: omitting the `bridges-workflows` zone fails loudly (it does not pass silently)

**What goes wrong:** `npm run fallow` exits 1 with a `Structure` section.

**Measured, with the port applied and no zone added:**

```text
── Structure ─────────────────────────────────────
● Boundary coverage (5)
  extensions/pi-claude-marketplace/bridges/workflows/discover.ts:1 no matching boundary zone
  extensions/pi-claude-marketplace/bridges/workflows/index.ts:1 no matching boundary zone
  extensions/pi-claude-marketplace/bridges/workflows/stage.ts:1 no matching boundary zone
  extensions/pi-claude-marketplace/bridges/workflows/types.ts:1 no matching boundary zone
  extensions/pi-claude-marketplace/bridges/workflows/unstage.ts:1 no matching boundary zone
```

`boundaries.coverage.requireAllFiles: true` is what makes it loud. Good news for
the plan: this cannot be forgotten silently.

**How to avoid:** §Q3 has the exact JSON, measured to clear the section.

### Pitfall 4: the integration fixture's script produces no envelope

**What goes wrong:** criterion 9's inverted assertion is red — in this phase *and*
in Phase 112.

**Why:** `tests/integration/workflow-kind-inversion.test.ts:94-97` writes
`export default { name: "greet" };`. Driven through the real decision function:

```text
integration fixture greet.js -> {"outcome":"skipped","fileName":"greet.js",
  "reason":"greet.js declares no `meta`, so there is nothing to install","cause":"no-meta"}
```

`export default` is not a `meta` declaration. The plugin resolves `workflows`
supported (the probe is directory-presence based, so line 164's precondition
stays green), but the bridge stages nothing.

**How to avoid:** change the fixture body to
`export const meta = { name: "greet", description: "greets" };` whenever the
assertion is inverted. Measured to yield
`{"outcome":"named","generatedName":"acme:greet","description":"greets"}`.

**Warning signs:** an inverted assertion that fails with ENOENT on a path you
expected to exist, while the record's `compatibility.supported` looks right.

### Pitfall 5: the stem-fallback arm can carry a `description`

**What goes wrong:** the criterion-4 warning says the script "declares neither a
name nor a description" and is a false statement about the file.

**Measured:**

```text
stem fallback (no name prop)     -> {"outcome":"stem-fallback","generatedName":"acme:greet","description":"says hi"}
stem fallback (non-literal name) -> {"outcome":"stem-fallback","generatedName":"acme:greet","description":"d"}
```

`StemFallbackWorkflow.description` is optional and populated whenever the `meta`
object declares one. The missing half on this arm is always the **name**.

**How to avoid:** word the reason around the name, and state the description as
the *other* requirement, not as a second observed absence. §Q4 proposes text.

### Pitfall 6: `pre-commit` does not run the suite that guards the version literal

**What goes wrong:** the bump commit passes `pre-commit` and then `npm run check`
fails on two unit tests.

**Why:** the four local hooks are `npm-lint`, `npm-format-check`, `npm-typecheck`
and `npm-fallow`. None of them runs `npm test`. `tests/shared/extension-version.test.ts`
hard-codes `const expectedVersion = "0.18.1"` and
`tests/architecture/extension-version-sync.test.ts` compares the constant to
`package.json`.

**How to avoid:** re-run `npm test` by hand after the bump. This is a standing
memory item, re-confirmed by reading `.pre-commit-config.yaml:98-121`.

### Pitfall 7: this checkout has no installed pre-commit hook

`git commit` fires nothing. Every gate must be run by hand. Also: the
`prettier` pre-commit hook **rewrites files mid-run and the commit still
succeeds**, so `git status` must be checked after each commit and fixed with a
follow-up commit, never an `--amend`.

## Code Examples

### The measured envelope bytes (WBRG-01)

```json
{
  "name": "acme:greet",
  "description": "says hi",
  "script": "export const meta = { name: \"greet\", description: \"says hi\" };\nexport async function run() {}\n"
}
```

Two-space indent, trailing newline, key order `name` → `description` → `script`.
`stage.ts:191` is `writeFile(stagedFile, ${JSON.stringify(envelope, null, 2)}\n, "utf8")`.
The unit-testing rule says *"when bytes are the contract … compare the complete
bytes"*, so at least one stage case should `assert.strictEqual` the whole file
text rather than `JSON.parse` it.

### The WR-06 refusal, measured

```text
onPlaced on refusal: []
refusal: WorkflowTargetOccupiedError | Cannot replace workflow target with non-previous content
         at /tmp/wf-home-.../.pi/workflows/projects/wf-cwd-.../saved/acme:greet.json
foreign bytes intact: "FOREIGN\n"
```

Reproduced without root: commit once, overwrite one target with foreign bytes,
re-prepare with **no** `previousWorkflowNames`, commit again. Assert by class and
field per the rule:

```ts
await assert.rejects(
  () => commitPreparedWorkflows(prepared),
  (error: unknown) => {
    assert.ok(error instanceof WorkflowTargetOccupiedError);
    assert.strictEqual(error.targetPath, expectedTargetPath);
    return true;
  },
);
```

### The `.fallowrc.json` addition, measured to clear the Structure section

```json
{
  "name": "bridges-workflows",
  "patterns": ["extensions/pi-claude-marketplace/bridges/workflows/**"]
}
```

```json
{ "from": "bridges-workflows", "allow": ["domain", "persistence", "shared", "platform"] }
```

```json
{ "from": "bridges-workflows", "callee": ["process.stdout.*", "process.stderr.*"] }
```

Insert each after its `bridges-skills` sibling so the file's alphabetical-ish
grouping survives. `orchestrators` already allows every `bridges-*` zone by name,
so Phase 112 will need to add `"bridges-workflows"` to that allow-list — **not**
this phase (adding it early is harmless but unverifiable here).

## Research Questions

### Q1 — Every export, its owner test, and how big each test is

`git show features/workflow-port-wip:<path>` read in full for all five files.

| Module | Runtime exports | Type exports | Owner test | Size estimate | Sibling to copy from |
|---|---|---|---|---|---|
| `types.ts` | none | 13: `DiscoveredWorkflow`, `WorkflowDiscoveryTarget`, `DiscoverPluginWorkflowsResult`, `WorkflowEnvelope`, `StageWorkflowsInput`, `StageWorkflowsCommitResult`, `PreparedWorkflowsStaging`, `PreparedWorkflowsNoop`, `PreparedWorkflowsStaged`, `CommitWorkflowsOptions`, `UnstageWorkflowsInput`, `UnstageWorkflowFailure`, `UnstageWorkflowsResult` | `tests/bridges/workflows/types.test.ts` | ~210 lines | `tests/bridges/commands/types.test.ts` (221) |
| `discover.ts` | `discoverPluginWorkflows` | none | `discover.test.ts` | ~500 lines | `.../commands/discover.test.ts` (703), `.../skills/discover.test.ts` (406) |
| `stage.ts` | `prepareStageWorkflows`, `commitPreparedWorkflows`, `abortPreparedWorkflows` | none | `stage.test.ts` | ~1,000 lines | `.../commands/stage.test.ts` (1,091) |
| `unstage.ts` | `unstagePluginWorkflows` | none | `unstage.test.ts` | ~280 lines | `.../commands/unstage.test.ts` (254) |
| `index.ts` | 5 re-exports: `discoverPluginWorkflows`, `abortPreparedWorkflows`, `commitPreparedWorkflows`, `prepareStageWorkflows`, `unstagePluginWorkflows` | 11 re-exports (all of `types.ts` except `PreparedWorkflowsNoop` and `PreparedWorkflowsStaged`) | `index.test.ts` | ~190 lines | `.../commands/index.test.ts` (174) |

**Five test files, roughly 2,180 lines total.**

**What `test:corresponding` demands of a barrel** [VERIFIED:
`scripts/check-corresponding-tests.mjs` read in full this session]:

1. A strict 1:1 mirror. `extensions/pi-claude-marketplace/X.ts` ⇄ `tests/X.test.ts`.
   Nothing is exempt — no barrel exemption, no type-only exemption.
2. The test must import the module by a **relative specifier that resolves to the
   source path**. Reaching it only through another module yields the distinct
   verdict `proxy-owned` (line 157); reaching it not at all yields `wrong-import`.
   Both are violations.
3. `tests/{architecture,e2e,integration}` are exempt **in both directions**, so an
   integration test can never stand in for a missing owner test.
4. An extra `tests/…` file with no mirrored source is `unexpected-test`.

Measured with the port applied and no tests written:

```text
missing-test: tests/bridges/workflows/discover.test.ts
missing-test: tests/bridges/workflows/index.test.ts
missing-test: tests/bridges/workflows/stage.test.ts
missing-test: tests/bridges/workflows/types.test.ts
missing-test: tests/bridges/workflows/unstage.test.ts
Corresponding-test gate failed with 5 violation(s).
```

`persistence/locations.ts` and `shared/errors-bridges.ts` were **not** flagged —
both already have owner tests.

**Coverage classification, measured against `scripts/test-coverage-direct.mjs`:**

```text
extensions/pi-claude-marketplace/bridges/workflows/types.ts -> type-only
extensions/pi-claude-marketplace/bridges/workflows/index.ts -> THROWS: Expected one LCOV record …, found 0
```

`types.ts` takes the `type-only` escape and needs no coverage. `index.ts` does
**not** — it transpiles to real re-export statements and must produce an LCOV
record at 100 %. `tests/bridges/commands/index.test.ts` proves this is
achievable: it imports each symbol twice (once from the barrel, once from the
defining module) and asserts `strictEqual` identity per binding, plus a block of
`satisfies` / `@ts-expect-error` type assertions.

The direct-coverage gate is **not** in `npm run check` and not in CI — only its
negative control is. It is nonetheless mandated by
`.claude/rules/typescript-unit-testing.md` and by the review skill, so the plan
must run `npm run test:coverage:direct -- <path>` for each of the four
non-type-only modules and treat a shortfall as a finding.

**Hardest branches to cover (plan for these explicitly):**

- `discover.ts`: the `darwin`/`win32` arm of `pathDedupKey` (Pitfall 1); the
  non-ENOENT/ENOTDIR rethrow in `readEntriesGracefully`; the `lstat` throw arm of
  `isWorkflowScriptFile`; the invalid-UTF-8 arm of `readScriptSource`
  (`Buffer.from([0xff, 0xfe])` in a `.js` file); the `assertPathInside` refusal
  for a `../` component path.
- `stage.ts`: the write-loop `catch` → `appendLeakToError(cleanupStaging(...))`;
  the non-ENOENT throw inside `displacePreviousTargets`; the mid-sequence rename
  failure with a **successful** reversal; the same with a **failed** reversal
  (`stillPlaced` non-empty); the CR-01 branch where a restore fails and cleanup
  is skipped. Patterns 2 and 3 are the levers. This is the phase's single
  largest test-writing risk.

### Q2 — Divergences from the five sibling bridges, and whether each is justified

`bridges/{skills,commands,mcp,agents,hooks}/` compared against the port.

| Aspect | Siblings | Workflows | Verdict |
|---|---|---|---|
| File set | `discover/stage/types/unstage/index` (commands is exactly this five) | identical five | **Same shape.** Commands is the closest structural twin |
| Naming | `prepareStageCommands` / `commitPreparedCommands` / `abortPreparedCommands` / `unstagePluginCommands` / `discoverPluginCommands` | `prepareStageWorkflows` / `commitPreparedWorkflows` / `abortPreparedWorkflows` / `unstagePluginWorkflows` / `discoverPluginWorkflows` | **Same convention, kind-suffixed.** No drift |
| Prepared handle | `kind: "noop" \| "staged"` discriminated union with underscore-prefixed `_previousNames` / `_renamePairs` kept out of the barrel | identical | **Same.** `index.ts`'s header states the same non-re-export rule as commands' |
| `replace*` / `finalize*` / `rollback*Replacement` | commands and skills and agents carry a second *replacement* family | **absent** | **Justified.** That family serves the update path (Phase 113). Its absence is a scope boundary, not an omission |
| Staging location | `<extensionRoot>/<kind>-staging/` | `<workflowsHomeDir>/.pi-claude-marketplace-staging/<uuid>/` | **Justified — WPTH-05.** Measured EXDEV (§Q5) |
| Target location | inside `<scopeRoot>` | outside every scope root | **Justified — WPTH-01/04.** Forced by the host engine |
| Discovery recursion | commands recurses (`build/deploy.md` → `acme:build:deploy`) | flat, non-recursive | **Justified — WBRG-02.** The engine's saved-name rule is flat |
| Name source | file path | the script's `meta.name` | **Justified.** Forces discovery to read each body; carried on the record so `stage` does not re-read |
| First-wins dedup | on generated name, in discovery | on **source path** in discovery, on generated name in `prepareStage` **after** the collision assert | **Justified and documented** at `discover.ts:191-221`: dropping a duplicate generated name in discovery would make `assertNoWorkflowNameCollisions` unreachable |
| Foreign-content policy at commit | three arms — owned / orphan / foreign | one arm: refuse | **Justified** at `stage.ts:269-286`: displacement runs first, so the owned and orphan arms are provably unreachable |
| Unstage failure reporting | `{removedNames, warnings}` | `{removedNames, warnings, failed: UnstageWorkflowFailure[]}` | **Justified — WLIF-03.** The leftovers are executable code outside every scope root, so per-name reasons are structured rather than prose |
| Cross-bridge imports | forbidden by `fallow` zones | none present (verified by reading every import) | **Compliant** |

**No accidental divergence found.** Every difference is documented in the ported
file's own header and traces to a requirement ID.

**Read these sibling owner tests before writing:** `tests/bridges/commands/`
{`index.test.ts` (174), `types.test.ts` (221), `unstage.test.ts` (254),
`discover.test.ts` (703), `stage.test.ts` (1,091)}. They are the closest analogue
in every dimension. Note that `commands/unstage.test.ts` uses **flat top-level
`test()`** while the current rule wants `describe('<entrypoint>')` for a
multi-entrypoint module — the older files predate the v1.19 rule and should not be
copied structurally, only case-for-case. `unstage.ts` and `discover.ts` are
single-entrypoint modules, so their tests keep cases at the **top level, with no
`describe()`**; only `stage.test.ts` (three entrypoints) and `index.test.ts`
(re-export identity per binding) take `describe()`.

### Q3 — `fallow` zone configuration

**Omitting the zone fails the gate loudly.** Measured — see Pitfall 3. This is the
`boundaries.coverage.requireAllFiles: true` setting, which CHANGELOG 0.16.0
describes as "an unzoned file is now a build failure that names the path".

**The allow edges the new zone needs**, derived by reading every import in the
five files:

| File | Imports | Zone |
|---|---|---|
| `types.ts` | `domain/resolver.ts`, `domain/workflow-script.ts`, `persistence/locations.ts` | `domain`, `persistence` |
| `discover.ts` | `domain/workflow-script.ts`, `shared/errors.ts`, `shared/path-safety.ts`, `./types.ts` | `domain`, `shared` |
| `stage.ts` | `domain/workflow-script.ts`, `shared/errors-bridges.ts`, `shared/errors.ts`, `shared/fs-utils.ts`, `shared/path-safety.ts`, `./discover.ts`, `./types.ts` | `domain`, `shared` |
| `unstage.ts` | `shared/errors.ts`, `./types.ts` | `shared` |
| `index.ts` | `./discover.ts`, `./stage.ts`, `./unstage.ts`, `./types.ts` | (intra-zone) |

Minimum needed: `["domain", "persistence", "shared"]`. **Recommend
`["domain", "persistence", "shared", "platform"]`** to match all five siblings
byte-for-byte; the unused `platform` edge is accepted without complaint
(measured: with that exact allow-list, the Structure section is empty and no
boundary violation is reported).

**Cross-bridge imports stay forbidden by construction** — the zone's allow-list
names no `bridges-*` zone, and `fallow`'s per-zone rule is an allow-list, so
importing `bridges/commands` from `bridges/workflows` would be a violation. This
is the only mechanism that enforces it; ESLint's `no-restricted-paths` treats
`bridges/` as one unit and cannot see it.

**Also add the `calls.forbidden` entry.** Every one of the thirteen existing zones
has one barring `process.stdout.*` / `process.stderr.*`. Omitting it would not
fail anything today, but it would leave the sixth bridge as the one zone with no
output-discipline guard — and the guard is one of two independent enforcements of
IL-2.

**What Phase 112 will need, and this phase should NOT add:** `"bridges-workflows"`
in the `orchestrators` allow-list. Adding it now is unverifiable (no orchestrator
imports it yet) and belongs with the wiring.

### Q3b — `persistence/locations.ts` and NFR-10

**How containment is anchored today.** `assertPathInside(parent, child, label)`
[VERIFIED: `shared/path-safety.ts:77-101`] is **parameterised on its boundary**.
It performs a pure string containment check, then walks each `path.relative(parent,
child)` segment applying it to `parent` in turn and `lstat`s each one, refusing any
symlink (`SymlinkRefusedError extends PathContainmentError`). It has **no global
notion of "the scope root"**. There is no allow-list, no root registry, and no
constant naming `scopeRoot`.

**Therefore WPTH-04 requires no loosening at all.** Admitting a new writable root
means passing a new value as `parent` at the new call sites. Containment for every
existing caller is untouched, because each caller supplies its own boundary. This
is the single most important structural fact for the plan: *"NFR-10 grows a new
writable root"* is a statement about which boundaries the code passes, not about
weakening the checker.

The port's four new call sites, all measured to be present:

| Call site | Boundary passed | Note |
|---|---|---|
| `discover.ts:239` | `resolved.pluginRoot` | READ side; loud by design, a declared `/etc` is a refusal |
| `stage.ts:175` | `locations.workflowsHomeDir` | Anchored one level **above** `workflowsStagingDir` on purpose: `assertPathInside` trusts its own boundary and starts the walk there, so anchoring on the staging dir would skip the `lstat` of the one segment an attacker could have replaced. Runs **before** `mkdir`, because `mkdir({recursive:true})` follows a symlinked parent |
| `stage.ts:184`, `:254` | `stagingRoot`, `displacedRoot` | Defense-in-depth on leaves already validated by the composer |
| `locations.ts::workflowArtifactPath` | `workflowsSavedDir` | The sole sanctioned composer: `assertSafeName` then `path.join` then `assertPathInside` |

**What must change in `locations.ts`:** nothing beyond the verbatim port. Its diff
is purely additive against HEAD — three readonly fields and one method — and its
two new imports (`domain/workflow-project-key.ts`, `platform/workflow-home.ts`)
both landed in Phase 110. `fallow`'s existing `persistence → ["domain", "shared",
"platform"]` rule already permits them.

**Architecture gates that will fail:** exactly one file,
`tests/persistence/locations.test.ts`, and it is an owner test rather than an
architecture gate. Measured: **11 tests, 9 pass, 2 fail** — the user-bundle and
project-bundle cases, on `assert.deepStrictEqual(Object.keys(locations),
LOCATION_KEYS)`. See Pitfall 2 for the fix and the exact key order.

I searched `tests/architecture/` for a containment or writable-root gate:
`NFR-10` appears only in `integration-materialization-gate.test.ts`,
`config-state-consistency.test.ts` and `config-state-write-seams.test.ts`, none of
which enumerates writable roots or asserts anything about `scopeRoot` containment
in a way the workflows paths would break. `scope-fences-63.test.ts`, despite its
name, pins the SURF-03 / SURF-04 / HOOK-04 notify surfaces, not paths. **No
architecture gate fails.** [VERIFIED: probe run of `tsc`, `eslint`, all three
`fallow` sub-gates and `tests/persistence/locations.test.ts` against the applied
port]

### Q4 — The stem-fallback warning (criterion 4)

**The engine rule, verified against an unpacked `@quintinshaw/pi-dynamic-workflows@3.10.1`**
(`npm install --prefix <scratch>`, the house standard for this milestone):

```js
// dist/workflow.js:1126
function validateMeta(meta) {
    if (!meta || typeof meta !== "object")
        throw new Error("meta must be an object");
    const value = meta;
    if (typeof value.name !== "string" || !value.name.trim())
        throw new Error("meta.name must be a non-empty string");
    if (typeof value.description !== "string" || !value.description.trim())
        throw new Error("meta.description must be a non-empty string");
```

And the shape that reaches it (`dist/workflow.js:1032-1074`,
`parseWorkflowScript`): seven gates — determinism blocklist, first statement is an
`ExportNamedDeclaration`, its declaration is a `const` `VariableDeclaration`,
exactly one declarator, the declarator is named `meta`, it has an initializer,
`evaluateLiteral` resolves it (throwing `non-literal node type in meta.name: …`
for anything but a `Literal`, `TemplateLiteral` with no expressions, array,
object, or negative-number unary), then `validateMeta`. **The criterion's claim
holds:** both WNAM-02 stem-fallback arms — no `name` property, and a non-literal
`name` — are refused, the first by `validateMeta`, the second by `evaluateLiteral`.

**Where the row must be emitted: `discover.ts::verdictWarning`.** Reasons:

1. It is the single verdict → warning mapping in the bridge. Adding a fourth arm
   there keeps one mapping and reuses `softFailWarning`, exactly as the locked
   decision requires. Emitting from `stage.ts` would put a second warning-composing
   site in the tree.
2. `prepareStageWorkflows` already returns `warnings: Object.freeze([...discoverWarnings])`
   (`stage.ts:206`), so a row added in `verdictWarning` reaches
   `StageWorkflowsCommitResult.warnings` with **no change to `stage.ts` at all**.
   Measured: the current `warnings[]` for a plugin with one `named` and one
   `stem-fallback` script is `[]`.
3. `types.ts:41-50` states that the read-only `info` surface (Phase 113) consumes
   the same discovery pass rather than enumerating again. A caveat emitted in
   discovery travels to `info` for free; one emitted in staging does not.
4. Phase 115 (WGATE-01..05) will add warnings for the other six engine gates,
   read off the same parse. `verdictWarning` is the seam it will extend.

**What changes:** `verdictWarning`'s early `return undefined` becomes a
`stem-fallback` arm, and its docblock's sentence *"or `undefined` for the two
admitted arms"* becomes *"…for the `named` arm"*. A fourth phrase helper joins
`skippedWarning` / `refusedWarning`.

**Proposed message.** The reason must not claim the description is absent
(Pitfall 5 — the arm can carry one). Subject-first; the file leads, the status
never does:

```
workflow script "greet.js" in "/plugin/workflows" was installed but will not run: the
engine loads a command only from a literal `meta.name` with a non-empty
`meta.description`, and this script declares no readable name
```

Composed as:

```ts
function unrunnableWarning(fileName: string, workflowsDir: string): string {
  return softFailWarning(
    fileName,
    workflowsDir,
    "was installed but will not run",
    "the engine loads a command only from a literal `meta.name` with a non-empty " +
      "`meta.description`, and this script declares no readable name",
  );
}
```

`was installed but will not run` is the fourth outcome phrase: it states the
admitted fact first and the caveat second, which is what distinguishes an
admitted-but-caveated arm from the three soft-fails. Wording inside the template
is Claude's discretion; the two constraints are the template and the meaning.

**A test states it** (criterion 4's own words). At minimum: a `discover.test.ts`
case asserting the exact string for a stem-fallback script, and a `stage.test.ts`
case asserting the same string reaches `prepared.result.warnings` **while the
envelope is still staged** — the row must not be mistaken for a refusal.

**Adjacency to flag, not to fix here:** a `named` verdict with **no**
`description` is equally unloadable by `validateMeta`, and gets no warning. That
is WGATE-01's territory (Phase 115 criterion 1, "a `meta` the engine's literal
validation would reject"). Keeping Phase 111 to the stem-fallback arm is correct;
shaping the row through `softFailWarning` is what lets Phase 115 subsume it
without a message-shape change.

### Q5 — EXDEV and atomicity (WPTH-05, criterion 5)

**The ported staging location does avoid EXDEV.** Measured live:

```text
savedDir  : /tmp/wf-home-YbEoKm/.pi/workflows/projects/wf-cwd-v4ahg8-6f9949fd1f9d/saved
stagingDir: /tmp/wf-home-YbEoKm/.pi/workflows/.pi-claude-marketplace-staging
sameParent: true
```

Both derive from `workflowsHomeDir` and nothing in the bridge derives from
`extensionRoot`. `path.dirname(workflowsStagingDir) === workflowsHomeDir`, and
`workflowsSavedDir` is `workflowsHomeDir` + `saved` or + `projects/<key>/saved`.

**EXDEV is real on this machine**, so the hazard is not hypothetical:

```text
tmpdir  : /tmp            -> type=0x1021994  (tmpfs)
homedir : /home/acolomba  -> type=0x58465342 (XFS)
cross-mount rename: FAILED EXDEV -- EXDEV: cross-device link not permitted
```

`stat().dev` confirms: `39` for `/tmp`, `64512` for `$HOME`.

**What a test can assert that is not a tautology.** Three levels, in increasing
value:

1. *(weak, still worth having, belongs in `tests/persistence/locations.test.ts`)*
   `workflowsStagingDir` and `workflowsSavedDir` share the `workflowsHomeDir`
   prefix. This restates `locations.ts` and only guards against a careless edit.
2. *(strong — the actual property)* **Independence from the extension's own root.**
   Build two bundles under one relocated `HOME` but with different
   `PI_CODING_AGENT_DIR` values and different `cwd`s, and assert that
   `workflowsStagingDir` is **byte-identical** across both and is **not** inside
   either bundle's `scopeRoot` or `extensionRoot`. That is precisely the property
   whose violation reintroduces EXDEV, and it fails on any refactor that reroutes
   staging under `extensionRoot`. This is not a restatement — it is a
   cross-configuration invariant.
3. *(runtime, in `stage.test.ts`)* after a commit, `stat(stagingParent).dev ===
   stat(workflowsSavedDir).dev`. A real filesystem observation, not a constant.
   ⚠ Note its limit: a hermetic `HOME` under `mkdtemp(tmpdir())` puts both on the
   same tmpfs, so this assertion passes *even if* staging were moved under
   `extensionRoot` when `extensionRoot` also lives in `/tmp`. It is a genuine
   observation but a weak discriminator; do not present it as the EXDEV guard.
   Assertion (2) is the guard.

A direct `assert.rejects(rename(...), {code:"EXDEV"})` is **not** portable — Spike
025's own probe records "SUCCEEDED (same filesystem on this machine)" as an
expected outcome. Do not write it.

**`commitPreparedWorkflows` on foreign content at a target path (WR-06).**
`assertTargetsUnoccupied` (`stage.ts:287-295`) runs `pathExists` over the **whole**
`_renamePairs` set *after* the displacement and *before* the first rename, and
throws `WorkflowTargetOccupiedError(pair.to)` on the first hit. The header's
justification is that a per-iteration check would place earlier names and then
have to reverse them, which reaches the same end state only if every reversal
succeeds; checking first removes reversal from the path entirely.

**Testable without root**, measured end to end (see §Code Examples): commit once,
overwrite one target with foreign bytes, re-prepare with **no**
`previousWorkflowNames`, commit again. Observed: `WorkflowTargetOccupiedError`,
`onPlaced` reports `[]`, and the foreign bytes are byte-identical afterwards. The
"placed nothing" half is the load-bearing assertion — WR-01/WR-02 say the caller's
removal payload comes from `onPlaced`, never from the error type.

### Q6 — The `EXTENSION_VERSION` bump (criterion 8)

**The mechanism is real and still present.** [VERIFIED:
`orchestrators/reconcile/backfill.ts` read this session]

- `:76` — `if (state.lastReconciledExtensionVersion === EXTENSION_VERSION) { return; }`
  under the comment *"Gate closed: the extension version has not moved since the
  last reconcile, so the supported-kind boundary cannot have moved either."*
- `:343` (inside `maybeBackfillPlugin`) — `if (!supportedSetGrew(record.compatibility.supported,
  resolved.supported)) { return false; }` then `await reinstallPlugin({… render: "none" })`.

**The full checklist — six files, all measured by `grep -rn "0\.18\.1"`:**

| # | File | Site |
|---|---|---|
| 1 | `package.json` | `:100` `"version": "0.18.1"` |
| 2 | `package-lock.json` | `:3` and `:9` — regenerate with `npm install --package-lock-only`, commit exactly what npm writes |
| 3 | `extensions/pi-claude-marketplace/shared/extension-version.ts` | the `EXTENSION_VERSION` literal |
| 4 | `tests/shared/extension-version.test.ts` | `:8` `const expectedVersion = "0.18.1"` ⚠ **a fourth site the CLAUDE.md checklist does not name** |
| 5 | `sonar-project.properties` | `:7` `sonar.projectVersion=0.18.1` |
| 6 | `CHANGELOG.md` | new heading + bullets |

Plus one planning-doc prose site, `.planning/PROJECT.md:235` ("stays at 0.18.1
until Phase 111 lands the bridge (A-03)"), which is documentation hygiene rather
than a gate.

**Which tests guard it:** `tests/shared/extension-version.test.ts` (hard-coded
literal) and `tests/architecture/extension-version-sync.test.ts` (constant vs
`package.json`). Both run under `npm test`. `tests/orchestrators/reconcile/{backfill,apply}.test.ts`
reference `EXTENSION_VERSION` but **import the constant** rather than hard-coding
it — `grep -n "0\.18\.1"` returns nothing for either. **Pre-commit does not run
`npm test`** (Pitfall 6), so re-run it by hand.

**The next version number: `0.19.0`.** Rationale, from the CHANGELOG's own
conventions:

- Every `0.x.0` heading in the file introduces new user-visible capability
  (0.17.0 `defaultEnabled`, 0.18.0 nested commands); `0.x.y` headings are fixes
  and behavioural corrections. A sixth component kind is capability.
- **One bump for the whole milestone, not one per phase.** Phases 112–114 append
  bullets under the same `## [0.19.0]` heading. A second bump mid-milestone would
  reopen the backfill gate for no benefit.
- The alternative — `0.18.2` — is defensible on the narrow reading ("this phase
  ships nothing user-visible") but forces a second bump later, and the CHANGELOG
  section would then have to be renamed.

**The A-03 tension, resolved.** Bumping here opens the backfill gate while
`reinstallPlugin` still has no workflows phase, which is superficially the same
situation A-03 forbade at Phase 109. It is materially different, and the plan
should say why: `0.19.0` is not **released** until the milestone closes. Real
users cross the version gate exactly once, at the released `0.19.0`, by which time
Phases 112–114 have wired the bridge. During development the only effect is that a
local `/reload` re-resolves stale records and clears the `{unsupported component}`
token — the repair the criterion names — without materializing envelopes yet.

⚠ **Do not write into the plan that this phase makes envelopes appear for
pre-0.19.0 installs.** It does not; Phase 112 does. The bump is the enabling half.

**Also owed here:** IN-06 from the Phase 110 review — *"the `acorn` CHANGELOG
line … is tied to the next version bump by CLAUDE.md"*. The `## [0.19.0]` section
must record `acorn` as a new runtime dependency.

### Q7 — Criterion 9, the assertion inversion

**Read in full:** `tests/integration/workflow-kind-inversion.test.ts`, 188 lines,
one test.

**Structure:**

| Lines | Content | Disposition |
|---|---|---|
| 14-18 | Header comment citing WINV-02 and D-109-06 | **rewrite** — D-109-06's window is what changes |
| 20-65 | `NotifyRecord`, `makeCtx`, `withHermeticHome` | keep |
| 67-132 | `seedWorkflowPlugin`; **`:93-97` writes `workflows/greet.js` as `export default { name: "greet" };`** | ⚠ **the script body must change** — Pitfall 4 |
| 134 | test title, ends "…and writes no workflow artifact" | **rewrite** |
| 143-161 | install + WINV-02 row assertions | keep verbatim |
| 163-177 | the positive precondition (`compatibility.supported` includes `workflows`) | **keep as-is** — this is line 164's tautology guard |
| **179-183** | `await assert.rejects(stat(path.join(home, ".pi", "workflows")), { code: "ENOENT" });` | **the lines that move** |
| 184-187 | `finally` cleanup | keep |

**The blocking finding.** With the complete bridge present in the tree, I ran this
test in the probe worktree:

```text
✔ WINV-02 / D-109-06: a workflow-bearing plugin installs with no partial flag
  and writes no workflow artifact (87.013925ms)
ℹ pass 1  ℹ fail 0
```

It still passes, because `installPlugin` does not call the bridge — `grep -rn
"workflow" extensions/pi-claude-marketplace/orchestrators/` returns two unrelated
prose matches and nothing else. Wiring the ledger is Phase 112 criterion 1, and
this phase's CONTEXT lists it under Deferred Ideas. **Criterion 9 as written
cannot be satisfied by Phase 111's scope.** The planner must resolve this, not
work around it silently.

**Option A (recommended) — invert it as far as this phase truthfully reaches.**
Keep lines 143-177 exactly. Replace 179-183 with a direct bridge drive against the
same fixture, using `resolveStrict` for the `MaterializablePlugin` the way
`install.ts` does:

```ts
// assert -- WBRG-01/WPTH-01: the bridge materializes the envelope the install
// window used to prove absent. The ledger phase that will drive this from
// installPlugin itself is not wired yet (WLIF-01).
const locations = locationsFor("project", cwd);
const prepared = await prepareStageWorkflows({ locations, pluginName: "hello", resolved });
await commitPreparedWorkflows(prepared);
const envelopePath = path.join(locations.workflowsSavedDir, "hello:greet.json");
assert.deepStrictEqual(JSON.parse(await readFile(envelopePath, "utf8")), {
  name: "hello:greet",
  description: "greets",
  script: 'export const meta = { name: "greet", description: "greets" };\n',
});
```

- Satisfies criterion 9's letter ("assert the envelopes ARE written") and its
  intent (no assertion quietly means the opposite).
- Requires the §Pitfall 4 fixture change, which is owed regardless.
- Phase 112 then replaces the explicit two-call drive with the install-driven
  path — a small, obviously-correct edit, and the assertion never inverts again.
- Retitle: `WINV-02 / WBRG-01: a workflow-bearing plugin installs with no partial
  flag and its workflow script materializes as an envelope`.

**Option B — defer criterion 9 to Phase 112 with a durable carrier.** Move it into
`ROADMAP.md` §Phase 112 Success Criteria (per the standing lesson that CONTEXT
Deferred Ideas and STATE Current Position both evaporate before the later phase
reads them), and in this phase rewrite only the comment at 179-180 so it names the
true remaining cause — the ledger is unwired — instead of D-109-06. Cheaper, but
leaves a green assertion pinning the absence of a feature for one more phase.

**Both options require the fixture change.** Whichever is chosen, `seedWorkflowPlugin`
must write a script that admits, or the inverted assertion is red in every phase.

**Keeping line 164's guard meaningful.** The precondition asserts the record's
`compatibility.supported` includes `workflows` and `unsupported` does not — a fact
about the resolver, produced by the directory probe, entirely independent of the
script's body. Changing `export default {…}` to `export const meta = {…}` does not
touch it. Under Option A the guard becomes doubly meaningful: it proves the
resolver admitted the kind, and the envelope assertion proves the bridge acted on
it, so neither can be green for the wrong reason.

### Q8 — Commit ordering

**Measured facts that bind the ordering:**

1. `npm run check` order [VERIFIED: `package.json`]: `typecheck → lint → fallow →
   format:check → test:corresponding → test:corresponding:negative →
   test:coverage:direct:negative → test → test:integration`. **`fallow` is step 3
   and `test:corresponding` step 5**, so a production module without its owner
   test dies at `fallow` first.
2. The four local pre-commit hooks are `pass_filenames: false` and `files:`-scoped
   to `^(…|(extensions|tests)/.*\.ts|…)$` [VERIFIED: `.pre-commit-config.yaml:98-121`].
   They scan the **whole working tree**, not the staged diff. A present-but-uncommitted
   bridge file makes an unrelated commit red. **The checkout must be sliced.**
3. `git checkout <branch> -- <paths>` writes **and stages**.
4. No pre-commit hook is installed in this checkout; every gate is run by hand.
5. With the full port applied and the zone added, `fallow dead-code` reports
   **only** the sixteen `index.ts` barrel re-exports. The defining modules'
   exports are consumed internally, so only the barrel strictly needs a
   test-consumer for `fallow` — but `test:corresponding` needs all five tests.
6. `errors-bridges.ts` and `locations.ts` are **purely additive** against HEAD
   (`git diff HEAD features/workflow-port-wip -- <path>` shows no deletions), so
   taking each whole is safe.

**Recommended shape — six green commits, path-scoped checkouts:**

| # | Checkout / edit | Also written | Green because |
|---|---|---|---|
| 1 | `shared/errors-bridges.ts` (whole) | a `WorkflowTargetOccupiedError` case in `tests/shared/errors-bridges.test.ts` | purely additive; the new export's consumer is its owner test (`production: false` puts `tests/` in the graph) |
| 2 | `persistence/locations.ts` (whole) | `LOCATION_KEYS` + a new `HOME`-relocated case in `tests/persistence/locations.test.ts` | `domain/workflow-project-key.ts` and `platform/workflow-home.ts` already landed in Phase 110; `persistence → domain/platform` edges already allowed |
| 3 | `bridges/workflows/{types,discover,unstage}.ts` + `.fallowrc.json` zone/rule/calls entries | `tests/bridges/workflows/{types,discover,unstage}.test.ts`, including the criterion-4 warning row and its test | every export consumed by its own owner test; zone clears the Boundary-coverage section |
| 4 | `bridges/workflows/{stage,index}.ts` | `tests/bridges/workflows/{stage,index}.test.ts` | `stage.ts`'s exports consumed by `index.ts` and its test; the barrel's sixteen re-exports consumed by `index.test.ts` |
| 5 | version bump: `package.json`, `package-lock.json`, `shared/extension-version.ts`, `tests/shared/extension-version.test.ts`, `sonar-project.properties`, `CHANGELOG.md` | — | both version tests updated in the same commit; **re-run `npm test`** |
| 6 | `tests/integration/workflow-kind-inversion.test.ts` (fixture body + assertion) | — | depends on commit 4 |

Commit 3 must precede 4 (`stage.ts` imports `./discover.ts` and `./types.ts`) and
1 (`stage.ts` imports `WorkflowTargetOccupiedError`). Commits 2, 5 and 6 are
otherwise order-free, except that 6 needs 4.

**Can commits 3 and 4 be merged?** Yes, and a single "land the bridge" commit is
also defensible. The split buys two smaller reviewable units at the cost of one
extra path-scoped checkout. Either is green.

**Can the port land red and the tests follow?** No. `CLAUDE.md` forbids committing
and recovering afterwards ("a failed pre-commit hook means the commit did NOT
happen, so iterating with `--amend` is wrong"), and the un-tested port is red at
`fallow` with 21 issues. There is **no boundary that must knowingly be red** — the
six-commit shape has none.

**Per-commit ritual:**

```bash
git checkout features/workflow-port-wip -- <only this commit's production paths>
git status --porcelain -- \
  extensions/pi-claude-marketplace/domain/resolver.ts \
  extensions/pi-claude-marketplace/domain/components/plugin.ts \
  extensions/pi-claude-marketplace/shared/notify.ts \
  extensions/pi-claude-marketplace/shared/notify-reasons.ts \
  extensions/pi-claude-marketplace/shared/probe-classifiers.ts | wc -l   # MUST print 0
# write/edit the owner test(s)
npm run typecheck && npm run lint && npm run fallow && npm run format:check \
  && npm run test:corresponding && npm test
npm run test:coverage:direct -- <each new source path>
pre-commit run --files <every changed path>          # fix, restage, re-run until clean
TH=$(find "${PRE_COMMIT_HOME:-$HOME/.cache/pre-commit}" -type f -name trufflehog -perm -u+x | head -1)
"$TH" filesystem <changed paths> --results=verified,unknown --fail
SKIP=trufflehog git commit -F <message-file>
git status                                            # the prettier hook rewrites mid-run
```

Run `pre-commit run --all-files` once before opening the PR — CI's Lint job runs
`--all-files` and a scoped run hides pre-existing violations.

## State of the Art

| Old approach | Current approach | When changed | Impact |
|---|---|---|---|
| `bridges/` treated as one zone | thirteen `fallow` zones, one per bridge kind, `requireAllFiles: true` | 0.16.0 | The sixth bridge needs a fourteenth zone or the build fails by name |
| Test-only seams (`_setXForTest`) | dependency injection or a relocated process global with `t.after()` | 0.17.0 (27 seams removed), reaffirmed Phase 110 | No `setWorkflowHomeDirForTesting`; relocate `HOME` instead |
| Flat top-level `test()` in bridge tests | `describe()` per exported entrypoint, `// arrange` / `// act` / `// assert`, `strictEqual` family | v1.19 unit-testing refactor | The sibling bridge tests are case-sources, not structural templates |
| Owner test optional for barrels and type-only modules | strict 1:1 mirror, no exemptions; `types.ts` still needs a test (it takes only the *coverage* escape) | `scripts/check-corresponding-tests.mjs` | Five tests for five files |
| `workflows` an unsupported kind | supported kind, materializing nothing | Phase 109 (D-109-06 window) | This phase closes half the window; Phase 112 closes the rest |

**Deprecated / outdated:**

- `<cwd>/.pi/workflows/saved/` — the engine still reads it, but its own module
  header says new writes go under the user's workflow home (WPTH-02). Never write it.
- `features/workflows-spike:tests/**` — 1,089-line flat test files predating the
  current rule. Read for case coverage; do not copy structure.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | `0.19.0` is the right next version (vs `0.18.2`) | §Q6 | Low, and reversible — the operator owns versioning per CLAUDE.md; a wrong choice costs one edit before the PR |
| A2 | The proposed criterion-4 wording is acceptable | §Q4 | Low — CONTEXT grants wording discretion inside the template and the meaning; only the "no readable name" framing is load-bearing (Pitfall 5) |
| A3 | `node:test` runs top-level `test()` cases in one file sequentially, so mutating `process.env.HOME` per case is safe | Pattern 1 | Would produce flaky cross-test home leakage. Mitigated: `tests/platform/workflow-home.test.ts` already relies on this and passes, and `--test-concurrency` parallelises *files*, each in its own process |
| A4 | Option A for criterion 9 is preferable to Option B | §Q7 | Medium — this is a scope judgement the operator should make. Both are laid out; the plan should not pick silently |
| A5 | The `fallow` `platform` allow-edge on `bridges-workflows` is accepted despite being unused | §Q3 | None measured — the probe run with that exact allow-list reported no boundary issue |
| A6 | SonarCloud CPD will flag the new bridge at PR time even though `fallow dupes` does not | §Open Questions | Low — an exclusion entry with the `port/README.md` rationale is the standing remedy, and it is a `/babysit-pr` item either way |

## Open Questions (RESOLVED)

Q1 and the version number were decided by the orchestrator before planning; Q2
and Q3 are recommendations that need no decision. Resolutions are recorded inline.

1. **Criterion 9's home.**
   - What we know: measured — the assertion still passes with the full bridge
     present, because the ledger wiring is Phase 112. The fixture also produces no
     envelope in any phase as written.
   - What is unclear: whether the operator wants the assertion inverted now
     against an explicit bridge drive (Option A) or deferred to Phase 112 with a
     ROADMAP carrier (Option B).
   - Recommendation: surface both to the operator before the task list is written.
     Option A, plus the fixture fix, is the researcher's recommendation.
   - RESOLVED: **Option A**, plus the fixture fix. Not treated as a genuine
     choice: criterion 9 is a *Phase 111* ROADMAP criterion, so Option B would
     violate the roadmap it is trying to satisfy, and it would leave a green
     assertion pinning the absence of a feature for another phase -- the precise
     hazard Phase 109 recorded when it deferred this obligation forward ("an
     assertion that quietly stays green while meaning the opposite is worse than
     no assertion"). The explicit two-call bridge drive is replaced by the
     install-driven path in Phase 112, and the assertion never inverts again.
   - RESOLVED (version number): **0.19.0**, per the CHANGELOG's own convention --
     a new supported component kind is a minor bump, not a patch. Six sites, not
     the five CLAUDE.md names: `package.json`, `package-lock.json`,
     `shared/extension-version.ts`, `sonar-project.properties` projectVersion,
     `CHANGELOG.md`, and `tests/shared/extension-version.test.ts:8`.

2. **`fallow dupes` sees no new duplication; SonarCloud may.**
   - What we know: measured 993 lines / 38 files duplicated both with and without
     the port — the bridge adds **zero** by fallow's measure. `fallow dupes` exits
     0. `sonar.cpd.exclusions` currently lists seven files, none under
     `bridges/workflows/` and none `domain/name.ts`.
   - What is unclear: whether Sonar's CPD, which uses a different algorithm, flags
     the new bridge or the standing `domain/name.ts` family from Phase 110.
   - Recommendation: expect it at `/babysit-pr` time; remedy is an exclusion entry
     with the `port/README.md` rationale, not a shared-helper refactor (WNAM-06's
     2026-09-04 amendment declines that mechanism). Not a phase blocker.

3. **`WVAL-03` / `WBRG-03` coverage of the `warnings[]` channel.**
   - What we know: the bridge returns warnings; nothing renders them until Phase
     112/113 wires a caller.
   - Recommendation: assert the strings in owner tests; do not attempt a
     rendered-output assertion in this phase.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node | everything | ✓ | v26.8.1 locally; CI pins Node 24 | — |
| `npm` | lockfile regeneration | ✓ | bundled | — |
| `tsc` / `eslint` / `prettier` / `fallow` | the gate chain | ✓ | run successfully in the probe | — |
| Network (npm registry) | unpacking the engine for verification | ✓ | `@quintinshaw/pi-dynamic-workflows@3.10.1` installed to a scratch prefix this session | — |
| `pre-commit` | commit ritual | ✓ (framework present; **no git hook installed**) | — | run `pre-commit run --files …` by hand |
| `trufflehog` git-mode hook | commit ritual | ✗ (structurally broken in a worktree — `.git` is a file) | — | filesystem scan + `SKIP=trufflehog` |

**Missing with no fallback:** none.
**Missing with fallback:** the trufflehog git hook, per the documented CLAUDE.md route.

## Validation Architecture

### Test framework

| Property | Value |
|---|---|
| Framework | `node:test` (Node 24 in CI) + `node:assert/strict` |
| Config file | none — glob-driven via `package.json` scripts |
| Quick run command | `node --test tests/bridges/workflows/<file>.test.ts` |
| Full suite command | `npm run check` |

The `npm test` glob is
`tests/{architecture,bridges,domain,edge,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts`,
so `tests/bridges/workflows/` is picked up with **no script change**. Verified
against `tests/architecture/unit-suite-glob-completeness.test.ts`, which
independently walks `tests/` and compares — a new directory under an existing
alternative satisfies it automatically.

### Phase requirements → test map

| Req | Behavior | Type | Automated command | File exists? |
|---|---|---|---|---|
| WBRG-01 | envelope bytes, key order, `description` omitted when absent | unit | `node --test tests/bridges/workflows/stage.test.ts` | ❌ Wave 0 |
| WBRG-02 | flat, non-recursive, symlink refusal, dotfile/suffix filter, path dedup | unit | `node --test tests/bridges/workflows/discover.test.ts` | ❌ Wave 0 |
| WBRG-03 | unreadable / non-UTF-8 / skipped / refused → `warnings[]`, install unaffected | unit | same | ❌ Wave 0 |
| criterion 4 | stem-fallback → `warnings[]` row **and** the envelope is still staged | unit | `discover.test.ts` + `stage.test.ts` | ❌ Wave 0 |
| WBRG-04 | envelope lands at the engine's scanned path; only the commit `rename` touches it | unit | `stage.test.ts` | ❌ Wave 0 |
| WPTH-01 | user vs project saved directories | unit | `node --test tests/persistence/locations.test.ts` | ✅ (extend) |
| WPTH-04 | `workflowArtifactPath` refuses an unsafe name and an escaping path | unit | same | ✅ (extend) |
| WPTH-05 | staging independent of `extensionRoot` / `PI_CODING_AGENT_DIR`; same-device commit | unit | `locations.test.ts` (invariant) + `stage.test.ts` (`stat().dev`) | ✅/❌ |
| WR-06 | occupancy refusal before the first rename; `onPlaced` empty; foreign bytes intact | unit | `stage.test.ts` | ❌ Wave 0 |
| WLIF-03 | unstage removes by recorded name only; ENOENT idempotent; `failed[]` accumulates | unit | `unstage.test.ts` | ❌ Wave 0 |
| criterion 8 | version constant matches `package.json` | unit | `npm test` (two existing tests) | ✅ (update literal) |
| criterion 9 | the envelope is materialized | integration | `npm run test:integration` | ✅ (invert) |

### Sampling rate

- **Per task commit:** `npm run typecheck && npm run lint && npm run fallow &&
  npm run format:check && npm run test:corresponding && npm test`
- **Per new module:** `npm run test:coverage:direct -- <source path>` (100 %
  branches, functions, lines; `types.ts` returns `type-only`)
- **Per wave / phase gate:** `npm run check` green, then `pre-commit run --all-files`

### Wave 0 gaps

- [ ] `tests/bridges/workflows/types.test.ts`
- [ ] `tests/bridges/workflows/discover.test.ts`
- [ ] `tests/bridges/workflows/stage.test.ts`
- [ ] `tests/bridges/workflows/unstage.test.ts`
- [ ] `tests/bridges/workflows/index.test.ts`
- [ ] `.fallowrc.json` — `bridges-workflows` zone, rule, and forbidden-calls entry
- [ ] `tests/persistence/locations.test.ts` — `LOCATION_KEYS` + a `HOME`-relocated case
- [ ] `tests/shared/errors-bridges.test.ts` — `WorkflowTargetOccupiedError` case
- [ ] `tests/shared/extension-version.test.ts` — the expected literal
- [ ] No framework install needed

## Security Domain

### Applicable ASVS categories

| Category | Applies | Standard control |
|---|---|---|
| V2 Authentication | no | — |
| V3 Session management | no | — |
| V4 Access control | no | — |
| V5 Input validation | **yes** | `assertSafeName` on `meta.name`; `assertPathInside` on every composed path; `admitWorkflowScript`'s AST-only classification (parses, never evaluates); the UTF-8 round-trip check |
| V6 Cryptography | no | `randomUUID` for a staging directory name only — not a security boundary |
| V12 File and resource | **yes** | `lstat` symlink refusal (D-14); flat non-recursive scan; refusal to enumerate the shared saved directory; removal strictly by recorded name |

### Known threat patterns for this bridge

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Plugin-authored `meta.name` reaching `path.join` | Tampering / Elevation | `locations.workflowArtifactPath` is the sole composer: `assertSafeName` then `assertPathInside` |
| A symlink under `workflows/` pointing outside the plugin root | Information disclosure | `isWorkflowScriptFile` `lstat`s before reading; `isSymbolicLink()` short-circuits without touching the body |
| An absolute or `../` `componentPaths.workflows` entry | Information disclosure | `discover.ts:239` re-checks containment against `pluginRoot` and throws loudly — the bridge reads file **bodies** and renders strings from them, so an uncontained directory discloses arbitrary contents, not just names |
| Overwriting a user's hand-saved workflow | Tampering | `WorkflowTargetOccupiedError` refuses before the first rename; the `<plugin>:` prefix namespaces without conferring ownership |
| Silently mutated executable third-party code | Tampering | UTF-8 round-trip refusal in `readScriptSource`; bytes copied verbatim, never re-encoded |
| A partial envelope observed by a concurrent engine scan | Denial of service | Envelope bytes are written only under the staging root; the commit `rename` is the sole operation touching a scanned directory (WBRG-04, NFR-1) |
| Symlinked staging parent, replaced between check and `mkdir` | Elevation | `assertPathInside(workflowsHomeDir, stagingRoot)` runs **before** `mkdir`, anchored one level up so the staging segment itself is `lstat`ed |

**Residual, documented:** the TOCTOU window in `assertPathInside` (its own header,
threat model = "careless or malicious plugin author", not "concurrent in-process
attacker"). Unchanged by this phase.

## Sources

### Primary (HIGH confidence — measured in this session)

- Probe worktree at HEAD + the prescribed checkout: `tsc --noEmit` (exit 0),
  `eslint` (exit 0), `prettier --check` (clean), `fallow dead-code` (exit 1, 21
  issues → 16 after the zone), `fallow health` (exit 0), `fallow dupes` (exit 0,
  993 lines before **and** after), `scripts/check-corresponding-tests.mjs` (5
  `missing-test`), `node --test tests/persistence/locations.test.ts` (9/11),
  `node --test tests/integration/workflow-kind-inversion.test.ts` (1/1 **pass**)
- End-to-end drive of `discoverPluginWorkflows` → `prepareStageWorkflows` →
  `commitPreparedWorkflows` → `unstagePluginWorkflows` in a hermetic `$HOME`
- `admitWorkflowScript` driven against five script shapes including the integration
  fixture's own body
- `scripts/test-coverage-direct.mjs::assertCompleteCoverage` on `types.ts`
  (`type-only`) and `index.ts` (needs a record)
- `.planning/spikes/025-canonical-path-mechanics/exdev.mjs` — EXDEV reproduced;
  `stat().dev` 39 (`/tmp`) vs 64512 (`$HOME`)
- `@quintinshaw/pi-dynamic-workflows@3.10.1` unpacked to a scratch prefix;
  `dist/workflow.js:1032-1143` (`parseWorkflowScript`, `evaluateLiteral`,
  `validateMeta`) read directly
- `git show features/workflow-port-wip:<path>` for all five bridge files;
  `git diff HEAD:<path> features/workflow-port-wip:<path>` for `locations.ts` and
  `errors-bridges.ts`
- Repo files read in full: `shared/path-safety.ts`, `shared/fs-utils.ts`,
  `.fallowrc.json`, `scripts/check-corresponding-tests.mjs`,
  `tests/persistence/locations.test.ts`, `tests/integration/workflow-kind-inversion.test.ts`,
  `tests/platform/workflow-home.test.ts`, `tests/shared/extension-version.test.ts`,
  `tests/architecture/extension-version-sync.test.ts`,
  `orchestrators/reconcile/backfill.ts`, `.pre-commit-config.yaml`,
  `.claude/rules/typescript-unit-testing.md`

### Secondary (MEDIUM confidence)

- `110-RESEARCH.md` §Q4, §Q5, §Q7 and Pitfalls 1-6 — Phase 110's own measurements,
  re-confirmed here where they bear on this phase
- `110-REVIEW.md` / `110-REVIEW-FIX.md` — WR-09's deferral of the stem-fallback
  warning to this phase, and IN-06's tie of the `acorn` CHANGELOG line to the bump
- `110-VERIFICATION.md` — the `Phase 111` comment-token finding; the blast-radius
  check method
- `port/README.md`, `ROADMAP.md` §Phases 111-115, `STATE.md`, `111-CONTEXT.md`

### Tertiary (LOW confidence)

- None relied upon. No WebSearch was performed; every claim traces to a file read
  or a command run in this session.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — no new dependency; every import read
- Architecture / divergence analysis: HIGH — all five ported files and all five
  sibling bridges read
- Gate behaviour (`fallow`, corresponding-test, coverage): HIGH — each run live
- Criterion 4's engine rule: HIGH — read from the unpacked 3.10.1 tarball
- Criterion 8's mechanism: HIGH — `backfill.ts:76`/`:343` read; version sites
  enumerated by grep. The **version number choice** is MEDIUM (A1)
- Criterion 9: HIGH on the finding (the test was run), MEDIUM on the recommended
  resolution (A4 — an operator scope call)
- Test sizing estimates: MEDIUM — extrapolated from sibling line counts

**Research date:** 2026-09-05
**Valid until:** 2026-10-05 (30 days — the tree is stable; the one volatile input
is `features/workflow-port-wip`, which is frozen, and the engine version, which is
pinned at 3.10.1 for this milestone)
