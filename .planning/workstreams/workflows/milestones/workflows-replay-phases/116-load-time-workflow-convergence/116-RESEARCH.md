# Phase 116: Load-time workflow convergence - Research

**Researched:** 2026-09-09
**Domain:** Load-time reconcile / backfill scan widening + closed-set notification amendment (in-repo; no external technology)
**Confidence:** HIGH — every load-bearing claim below was measured on this tree this session by planting an edit and running the gate, then reverting. `git status --porcelain` is clean of source changes.

## Summary

This phase is an in-repo behavior change with zero new dependencies. Everything it needs already exists: the growth test, the version stamp, the outcome shape, the row projection, and the owner test suite. The work is (1) delete one filter, (2) append one closed-set reason token and wire it through both arms of one projection, (3) prove three behaviors with tests that match house style.

The measurements answer the phase's seven open questions decisively, and two of them overturn what the CONTEXT anticipated. First, `hasForceInstalledPlugin` must **not** widen — not because it is dead, but because widening it turns an existing green test red (`WR-01: brings no state.json into existence for a state-file-absent scope with nothing to promote`), and because on the production read-pass path `stateExisted === false` implies `state.marketplaces === {}`, so the narrow guard costs the widened scan nothing. Second, deleting the filter turns **no test in `backfill.test.ts` red at all** — the only two red assertions in the whole 5645-test unit suite live in `tests/index.test.ts`. That is a coverage gap, not a clean bill of health: today nothing pins "an `installable: true` record is skipped", so the phase's WCONV-01 case is genuinely new rather than a flip of an existing red.

The third measurement that shapes the plan: the widened scan can only ever promote **path-source** plugins. `resolveRecordedPluginOffline` calls `resolveStrict` with no `resolveGitPluginRoot` callback, and the resolver answers `unavailable` for every git source, so a github/url/git-subdir record is skipped before `reinstallPlugin` is reached. This bounds the blast radius (no network at load time, ever) and it bounds the requirement (a git-source workflow plugin does not converge through this path). It should be stated in the plan and in the amended comment rather than discovered in review.

**Primary recommendation:** Delete the filter at `backfill.ts:266-269`, leave `hasForceInstalledPlugin` untouched, append one `ContentReason` token to the tail of `REASONS`, stamp it on both arms of `backfilledRowFromOutcome`, and budget for **five** closed-set amendment sites plus **three** catalog-byte sites — the two existing backfill catalog states change bytes because both arms carry the token, and one new state publishes the `installed` arm that has no catalog row today.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-116-01: Scan widening**

- **The filter widens by deletion, not by branching.** Remove the
  `if (record.compatibility.installable) { return false; }` early return in
  `backfillOnePluginIsolated` (`orchestrators/reconcile/backfill.ts:267`)
  outright, leaving `supportedSetGrew` as the sole growth gate. Measured
  justification: `supportedSetGrew` already returns `false` when
  `resolved.length <= recorded.length`, so a record at `installable: true`
  whose set did not move costs one offline re-resolve and no write -- which is
  exactly what success criterion 3 requires. A two-arm shape would state the
  growth policy twice.
- **`hasForceInstalledPlugin` is verified before it is widened, not widened on
  assumption.** The guard at `backfill.ts:167` decides whether a stamp write is
  worth bringing a `state.json` into existence for, and today it answers "only
  if some record is `installable: false`". After the deletion above, any record
  is a candidate, so the guard looks like it must widen too. But
  `applyBackfillForScope` already returns early when `state === undefined`, and
  the guard is only consulted when `!readResult.stateExisted` -- so if a
  non-existent `state.json` always implies zero records, the guard cannot
  matter and must be left alone. Plant the case and measure which it is before
  editing. Widening a guard that cannot fire is dead code; leaving a guard that
  can fire makes the widened scan unreachable.
- **D-68-03 is amended, not left standing.** Its "scan ONLY partially-installed
  plugins" clause is superseded by WCONV-01 and the comment says so. Its other
  two halves -- the strict-superset growth test and stamp-on-gate-open -- are
  still live and stay cited. A comment that argues for a filter the phase just
  deleted is worse than no comment.
- **The set of sites encoding "only `installable: false` is scannable" is
  derived by removal.** Flip the filter first, run the suite, and treat every
  red assertion as a member; then `grep` `installable` across
  `orchestrators/reconcile/` as an independent cross-check. Do not enumerate
  the sites by reading. This milestone's most repeated defect is an enumeration
  shorter than the set it names -- five times, every one found by removing
  something and watching what went red.

**D-116-02: The WCONV-03 signal**

- **A new closed-set reason token, because the gap is measured.** A backfilled
  row with `installable: true` and no degrade signals renders
  `status: "installed"` with no `reasons` brace
  (`orchestrators/reconcile/notify.ts:619-628`) -- byte-identical to a fresh
  install row. No existing token in the closed 45-entry `REASONS` set means
  "this appeared because the supported set grew", so the amendment is
  necessary rather than stylistic.
- **The token rides the existing `plugin-backfilled` outcome.** It already
  carries `installable`, `unsupported`, `orphanRewake` and `degradedKinds`, and
  already routes through `backfilledRowFromOutcome`. A new `PerEntryOutcome`
  member would need its own arm in the union, the projection switch and the
  catalog for no behavioural gain.
- **Both render arms carry it.** The `partially-installed` arm gets the token
  as well as the `installed` one: a user who gets some new commands is as
  surprised as one who gets all of them, and WCONV-03 is about explaining a
  reload the user did not initiate.
- **Silence is asserted, not built.** `maybeBackfillPlugin` returns before
  pushing any outcome when `supportedSetGrew` is false, so a scan that
  materialized nothing produces no row and needs no suppression path. Add a
  case that asserts the silence; do not add a no-op outcome to represent it.
- **The closed-set amendment sites are measured, not listed.** Adding a member
  to a closed set compiles clean at every derivation site -- that exact defect
  shipped three times in one milestone, and the "exact-length tuple" guard
  meant to catch it never guarded. Derive the amendment sites the same way as
  D-116-01: by planting.

**D-116-03: Proving it**

- **Tests live beside what they test.** The scan, growth and one-time behavior
  go in `tests/orchestrators/reconcile/backfill.test.ts`, which already exists.
  The token goes in the three architecture tests success criterion 4 names:
  `tests/architecture/notify-closed-set-locks.test.ts`,
  `tests/architecture/compat-01-no-expansion.test.ts`, and the byte pairing in
  `docs/output-catalog.md` against `tests/architecture/catalog-uat.test.ts`. A
  new integration file only if a real reload path cannot be reached from a unit
  test.
- **"One-time" is proven on bytes AND mtime.** RECON-05's invariant is stated
  in mtime terms, and byte-equality alone would pass an implementation that
  atomically rewrites identical content -- a green run that checked nothing.
  Capture both before and after the second load.
- **Criterion 3's two halves are two cases, not one.** An equal-set record
  (scanned, not materialized) and a disabled record (never scanned) fail
  differently and must be separable. The disabled half is asserted through a
  resolve-counting seam so "never scanned" is a measured zero rather than an
  absence inferred from a missing row.
- **Every new gate gets a negative control, run before it is believed.**
  Reverting the widened filter must turn the WCONV-01 case red; removing the
  new token from the closed set must turn the lock test red. Paste the failing
  transcripts into the SUMMARY, not a summary of them. A guard that is green
  because it checks nothing has shipped three times here.

### Claude's Discretion

Token spelling, the exact wording of the amended D-68-03 comment, test names,
and task/wave decomposition are at the planner's discretion within the
constraints above.

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WCONV-01 | A user who installed a workflow-bearing plugin before the `workflows` kind was admitted gains its workflow commands on the next load, without running `update` or `reinstall`. | Q1 (guard stays narrow), Q2 (the filter deletion is the whole change; measured red set), Q7 (git-source records are structurally out of reach; `alreadyTouched` widening). Proven end-to-end by the planted probe in **Measurement 5**. |
| WCONV-02 | The self-heal stays one-time. Equal supported set is not growth; the extension-version stamp bounds the scan to one pass. | Q5 (`RECON-05` mtime/byte precedents and the existing byte-only case at `backfill.test.ts:443`), the untouched `supportedSetGrew` (`backfill.ts:454`) and stamp gate (`backfill.ts:76`). |
| WCONV-03 | A convergence that materializes artifacts says so on its reconcile row instead of healing silently. | Q3 (five measured closed-set amendment sites; three that stay silently green), Q4 (catalog byte-pairing contract, `195 -> N` count lock, both existing backfill states change bytes). |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Decide which recorded plugins are scan candidates | `orchestrators/reconcile/` (`backfill.ts`) | — | The scan is load-time orchestration; the filter is a policy the orchestrator owns beside its other filters (`backfill.ts:271-289`). |
| Decide whether the supported set grew | `orchestrators/reconcile/` (`supportedSetGrew`, `backfill.ts:454`) | — | Pure predicate, already local; WCONV-02 reuses it unchanged. |
| Re-materialize artifacts | `orchestrators/plugin/reinstall.ts` (`render: "none"`) | `bridges/*` | Reinstall is the partial-capable materialization primitive (`reinstall.ts:1176-1181`); the backfill is one of its two production callers. |
| Own the reason vocabulary | `shared/notify.ts` (`REASONS`, `:93-269`) | `shared/notify-reasons.ts` (topic partition + proof) | `REASONS` is the single catalog-truth tuple; `notify-reasons.ts` is a typed view with a compile-time completeness proof. |
| Project outcome → rendered row | `orchestrators/reconcile/notify.ts` (`backfilledRowFromOutcome`, `:610`) | — | Single projection, both arms already written. |
| Publish the rendered bytes | `docs/output-catalog.md` ↔ `tests/architecture/catalog-uat.test.ts` | — | Byte-pairing gate; the doc is the user contract and the test is its enforcement. |

## Project Constraints (from CLAUDE.md)

Directives that bind this phase (`./CLAUDE.md`, `.claude/CLAUDE.md`, `.planning/codebase/{ARCHITECTURE,CONVENTIONS,STACK}.md`):

1. **Read before editing; trace callers before modifying a function.** Research before edit.
2. **Never commit to `main`.** This is a linked worktree on `features/workflow`; `.git` is a file, so trufflehog's git-mode hook fails structurally — prefix commits with `SKIP=trufflehog` only after a clean `trufflehog filesystem` scan of the exact paths being committed.
3. **Run `pre-commit run --all-files` (or `--files <changed>`) BEFORE `git commit`.** Never `--no-verify`. Never rebase. Never `git add -A` — the operator has concurrent uncommitted edits in `.claude/settings.json`, `.codex/config.toml`, `.claude/CLAUDE.md`, `.mcp.json`, `AGENTS.md`, `.codegraph/`, and the workstream's `config.json` / `.verification-ledger.json`.
4. **`npm run check` must stay green** — typecheck + lint + **fallow** + prettier + `test:corresponding` (×2) + `test:coverage:direct:negative` + unit + integration. Fallow is a mandatory member of the chain, not an extra.
5. **All user-visible output through `shared/notify.ts`.** No `ctx.ui.notify` outside that module; no `process.stdout`/`process.stderr` in `extensions/**` (two independent gates: ESLint `no-restricted-syntax` + fallow `boundaries.calls.forbidden`).
6. **Comments cite decision/requirement IDs, never GSD phase/plan/wave numbers** (`.claude/rules/typescript-comments.md`). Also forbidden: narration of code that no longer exists (`the former X`, `X used to`, `byte-identical to the former`). The amended D-68-03 comment must therefore describe the **current** filter set in present tense, not the deleted filter.
7. **Dependency injection over test-only seams.** No `_setXForTest`-style module-global hooks. The house pattern is an optional field on the options object with a documented production default (`ApplyReconcileOptions.gitOps`, `types.ts:265`).
8. **Two independent complexity ceilings**: ESLint `sonarjs/cognitive-complexity: 15` and fallow `health.maxCognitive: 15` / `maxCyclomatic: 20` / `maxUnitSize: 60`, with **zero** approved `thresholdOverrides`. Deleting a branch from `backfillOnePluginIsolated` moves both scores down, so this phase has headroom.
9. **A gate wants a test that plants the violation**, not one that reads the config.
10. **CodeGraph is indexed** (`.codegraph/` exists) — prefer `codegraph explore` over grep/read loops.
11. **Broken Windows entries must be prefixed `[workflows-replay]`** (phase numbers are not unique across milestones).

## Standard Stack

**No new packages. No installs. No `Package Legitimacy Audit` section is required — this phase adds zero external dependencies.**

Everything the phase needs is already declared and already imported by `backfill.ts`:

| Module | Purpose in this phase | Why standard |
|--------|----------------------|--------------|
| `orchestrators/reconcile/backfill.ts` | The scan, the filters, the growth test, the stamp | The seam the phase edits |
| `orchestrators/plugin/reinstall.ts` (`render: "none"`) | Re-materialization | The one partial-capable primitive; already the backfill's caller (`backfill.ts:349-357`) |
| `shared/notify.ts::REASONS` | Closed reason vocabulary | Single catalog-truth tuple (`notify.ts:93-269`) |
| `shared/notify-reasons.ts` | Topic partition + `_ReasonsCoverageProof` | Compile-time completeness proof for the closed set |
| `node:test` + `node:assert/strict` + `strong-mock` | Tests | The only sanctioned tools (`typescript-unit-testing-review` skill) |

**Version verification:** not applicable — no package is being added or upgraded. `package.json` is at `0.19.0`; the `EXTENSION_VERSION` bump and CHANGELOG entry are milestone-close work and are **not** this phase's (STATE.md, "Replay Ground Truth").

---

## Measurements

Every claim in the answers below traces to one of these. Each plant was reverted; the tree was verified clean afterwards.

### Measurement 0 — baseline

```
$ npm test
ℹ tests 5645
ℹ pass 5645
ℹ fail 0
ℹ duration_ms 39504.209088     (EXIT=0)

$ npm run fallow ; echo $?
✗ 1,045 lines (1.4%) duplicated across 40 files (0.17s)
0                                ← the ✗ line is informational; fallow exits 0
```

`npm run test:integration` → `tests 34 / pass 34 / fail 0`. Full unit suite is ~40 s, so plant-and-measure is cheap; use it.

### Measurement 1 — delete the `installable` filter (`backfill.ts:266-269`)

Removed the four lines outright, nothing else. Then: `npm run typecheck` **clean**, `npx eslint <file>` **clean**, `npm run test:integration` **34/34 green**, `npm test`:

```
ℹ tests 5645
ℹ pass 5643
ℹ fail 2                          (EXIT=1)

✖ failing tests:
test at tests/index.test.ts:601:1
✖ appends the recorded plugin's binaries to the process PATH and records them in the ledger (PENV-01)
  Error: The following calls were unexpected:
   - extension API.getAllTools()
   - extension API.getAllTools()
   - extension API.getAllTools()
      at verifyBoundary (tests/edge/notification-boundary.ts:130:7)

test at tests/index.test.ts:722:1
✖ still answers when the plugin PATH recompute fails (NFR-2)
  Error: The following calls were unexpected:
   - extension API.getAllTools()   × 3
```

Three `getAllTools()` calls = exactly one `notify()` emission's soft-dependency probe (`tests/edge/notification-boundary.ts:8-11, 62-84`). Both cases seed one `installable: true` record via `seedEnabledPlugin` (`tests/index.test.ts:479-517`) with `supported: []`, no `lastReconciledExtensionVersion` (gate open) and a `marketplaceRoot` (`<cwd>/mp-src`) that does not exist — so the widened scan reaches `loadMarketplaceManifest`, throws ENOENT, and the per-plugin catch (`backfill.ts:293-302`) pushes one `plugin-install-failed` row, which the cascade emits.

### Measurement 2 — widen `hasForceInstalledPlugin` (with Measurement 1 still planted)

Changed the predicate at `backfill.ts:170` from `if (!record.compatibility.installable)` to accept any record:

```
$ node --test tests/orchestrators/reconcile/backfill.test.ts tests/index.test.ts
ℹ tests 43 / pass 40 / fail 3
✖ failing tests:
✖ appends the recorded plugin's binaries ... (PENV-01)          ← from Measurement 1
✖ still answers when the plugin PATH recompute fails (NFR-2)     ← from Measurement 1
✖ WR-01: brings no state.json into existence for a state-file-absent scope with nothing to promote
```

The third failure is **new and caused by the guard widening alone**. That case (`backfill.test.ts:529-569`) hands a `stateExisted: false` read-result carrying one `installable: true` record whose set does not grow, and asserts `retryTree(scopeRoot) === ["pi-claude-marketplace/"]`. With the guard widened, the scan runs, finds no growth, and the stamp write at `backfill.ts:109-112` **creates state.json** — a WR-05 violation.

### Measurement 3 — append a fabricated member to `REASONS`

Appended `"zzz fabricated probe token"` after `"requires pi-dynamic-workflows"` (`notify.ts:268`), with **no** other change:

```
$ npm run typecheck
extensions/pi-claude-marketplace/shared/notify-reasons.ts(294,51): error TS2344:
  Type '"zzz fabricated probe token"' does not satisfy the constraint 'never'.
tests/shared/notify-reasons.test.ts(48,12): error TS1360:
  Type 'true' does not satisfy the expected type 'false'.
```

Then gave the token a home in `CommandPrivateReason` (`notify-reasons.ts:279`) — typecheck clean — and ran the rest:

```
$ npm test
ℹ tests 5645 / pass 5642 / fail 3     (EXIT=1)
✖ tests/architecture/compat-01-no-expansion.test.ts:127
    COMPAT-01: REASONS holds exactly its inherited members, in order
✖ tests/architecture/notify-closed-set-locks.test.ts:29
    OUT-08: REASONS is the closed 45-entry reason set
✖ tests/shared/notify.test.ts:4938
    closed notification constants preserve exact public values

$ npm run lint          → clean
$ npm run fallow        → EXIT=0 (identical output to baseline)
$ npm run format:check  → "All matched files use Prettier code style!"
```

### Measurement 4 — `resolveStrict` on a git source with no clone resolver

Ran the real `resolveStrict` the way `resolveRecordedPluginOffline` calls it (`backfill.ts:444` — `{ marketplaceRoot }` only, no `resolveGitPluginRoot`):

```
$ node <scratch probe>
{ "state": "unavailable", "installable": false, "name": "hello",
  "notes": ["git source requires a clone-cache resolver"] }        ← source "acolomba/some-plugin"
{ "state": "unavailable", "installable": false, "name": "hello",
  "notes": ["git source requires a clone-cache resolver"] }        ← source "https://example.com/x.git"
```

### Measurement 5 — the WCONV-01 shape, end to end

With the filter deleted (Measurement 1), appended one probe case to `backfill.test.ts` seeding `installable: true, supported: ["skills"], unsupported: []` against a source tree of `{ skill: "clean", workflow: true }`, and called the real `scanForceInstalledBackfills`:

```
PROBE anyFailure: false
PROBE outcomes: [ { "kind": "plugin-backfilled", "scope": "project", "marketplace": "mp",
                    "plugin": "hello", "version": "1.0.0", "dependencies": [],
                    "installable": true, "unsupported": [] } ]
PROBE envelopes: ["hello:greet.json"]
PROBE record: { "version": "1.0.0",
                "compatibility": { "installable": true, "notes": [],
                                   "supported": ["skills","workflows"], "unsupported": [] },
                "resources": { ..., "workflows": ["hello:greet"] },
                "enabled": true,
                "installedAt": "2026-01-01T00:00:00.000Z",
                "updatedAt": "2026-02-03T04:05:06.000Z" }
PROBE clones: []
✔ PROBE-WCONV-01 ... ℹ tests 30 / pass 30 / fail 0
```

The whole of WCONV-01 works off the one-line deletion: the envelope lands in the host engine's saved directory, the record gains `workflows: ["hello:greet"]`, the version and `installedAt` are preserved, and no clone is attempted.

---

## Answers to the seven planning questions

### Q1 — Can `hasForceInstalledPlugin` fire at all after the filter deletion?

**Answer: on the production path, no. Leave it alone. Widening it is not merely dead — it turns a green test red.**

The guard at `backfill.ts:87` is consulted only when `readResult.stateExisted === false` **and** `readResult.state !== undefined`. That combination is produced by exactly one production site, and the chain forces `marketplaces` to be empty:

1. `readPassForScope` probes `stateExists = await pathExists(loc.stateJsonPath)` **before** taking the lock (`apply.ts:107`). If both state and config are absent it returns the pristine arm with no `state` (`apply.ts:114`).
2. The only return that carries `state` is `apply.ts:182`, and it carries `stateExisted: stateExists` verbatim.
3. Inside the lock, `state` is `tx.state`, which is `loadState(locations.extensionRoot)` (`with-state-guard.ts:89`).
4. `loadState` returns `{ schemaVersion: 2, marketplaces: {} }` on ENOENT (`state-io.ts:390-394`). Nothing in `readPassForScope` adds records — `migrateFirstRunConfig` writes the *config* from state, and `planReconcile` is pure (`apply.ts:181`).

So `stateExisted === false` ⇒ zero records ⇒ `hasForceInstalledPlugin` iterates nothing and returns `false` ⇒ the early return at `:88` always fires. The condition reduces to `!readResult.stateExisted`, and the widened scan is never reachable in that arm — **but there is nothing to reach it for.** [VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:107-182, extensions/pi-claude-marketplace/transaction/with-state-guard.ts:88-89, extensions/pi-claude-marketplace/persistence/state-io.ts:386-397]

**The one reachable exception, and why it is benign.** A cross-process TOCTOU window exists between the `pathExists` probe (`apply.ts:107`) and the lock acquisition (`apply.ts:117`): a second Pi process could `saveState` in that window, so `stateExisted === false` while `state` carries records. Even then the narrow guard costs at most one deferred load — the early return at `:88` skips the stamp, so the version gate stays **open** and the next load (where state.json now exists) scans normally. [VERIFIED: extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts:107-117, backfill.ts:87-89 + 109-112]

**And the guard is load-bearing at the module's own interface.** `backfill.test.ts` drives `applyBackfillForScopeIsolated` directly through `readResultFor(state, stateExisted)` (`backfill.test.ts:305-307`), which *can* construct the shape production cannot. Measurement 2 shows the existing case at `backfill.test.ts:529` — `WR-01: brings no state.json into existence for a state-file-absent scope with nothing to promote` — goes red the moment the guard widens, because the stamp write creates an unsolicited `state.json` (WR-05). That case is the standing negative control for this decision; the plan does not need to write a new one.

**Plan action:** do not touch `hasForceInstalledPlugin` (`backfill.ts:161-177`). Its doc comment at `:161-166` does need one correction — it currently says partially-installed records are "the only kind the backfill scan can promote", which stops being true. Restate it as what the guard actually decides (whether a stamp write is worth creating a state.json for) without re-asserting the deleted filter.

### Q2 — Which sites encode "only `installable: false` is scannable"?

**Measured by removal (Measurement 1), then cross-checked by grep. The two methods disagree, and both matter.**

**By removal — the executable set is 2, and neither is in the owner suite:**

| Site | Kind | Why it reddens |
|------|------|----------------|
| `tests/index.test.ts:601` (`PENV-01`) | notification-boundary sizing | Widened scan emits one cascade row over the seeded `installable: true` record → 3 unexpected `getAllTools()` |
| `tests/index.test.ts:722` (`NFR-2` recompute-refused) | notification-boundary sizing | Same |

`npm run typecheck`, `npm run lint`, `npm run test:integration`, `npm run fallow`, `npm run format:check` are all **silent**. **Zero tests in `tests/orchestrators/reconcile/backfill.test.ts` redden.** The suite's only `installable: true` fixture with the gate open — `D-68-03: stamps a gate-open scope that records no partially-installed plugin` (`backfill.test.ts:485-528`) — seeds `supported: ["skills"]` against a source declaring only a skill, so the set does not grow and the widened scan skips it for the *right* reason. That case is already criterion 3's equal-set half; it just needs a title that stops naming the deleted filter.

**Consequence for the plan: the WCONV-01 case is net-new, not a flip.** Nothing today pins "an `installable: true` record is skipped", so there is no red-to-green transition to inherit. D-116-03's negative control (revert the filter, the WCONV-01 case reddens) is therefore the *only* proof that the new case discriminates — run it and paste the transcript.

**Why the two index.test.ts cases redden and what to do about them.** Their seed (`tests/index.test.ts:479-517`) records a plugin whose `marketplaceRoot` (`<cwd>/mp-src`) is never created, so the widened scan's `loadMarketplaceManifest` throws ENOENT and produces a `plugin-install-failed` row. Two honest repairs exist; the plan should pick one deliberately rather than bump the boundary counts:

- **(a) Close the gate in the seed** — add `lastReconciledExtensionVersion: EXTENSION_VERSION` to the seeded state. The backfill returns at `backfill.ts:76-81` before scanning, both cases stay silent, and the seed then describes a steady-state scope (which is what those cases are about: PATH plumbing, not backfill). Cheapest and most truthful.
- **(b) Create the marketplace source** so the re-resolve succeeds and finds no growth. More setup, and it makes two PATH cases carry backfill fixtures they do not care about.

Do **not** raise the `emissions` / `toolProbes` counts to absorb the row: `tests/edge/notification-boundary.ts:76-84` says in terms that refitting the count "turns the count from a claim about the soft-dependency probe into a fudge factor".

**By grep — the prose set is 7, all in `backfill.ts`, none gated:**

```
$ grep -rn "installable" extensions/pi-claude-marketplace/orchestrators/reconcile/
```

Filtering out the `PluginBackfilledOutcome.installable` field and the ENBL-05 orthogonality notes in `README.md` / `types.ts:104` (which are about the *disabled* axis and stay correct), the sites that assert the deleted policy are:

| File:line | Text that stops being true |
|---|---|
| `backfill.ts:3-6` | module header — "A partially-installed record whose manifest entry has since grown…" |
| `backfill.ts:37` | `applyBackfillForScope` doc — cites D-68-03 as the scan's charter |
| `backfill.ts:91-92` | "Scan every partially-installed plugin and re-materialize…" |
| `backfill.ts:163-165` | `hasForceInstalledPlugin` doc — "the only kind the backfill scan can promote" |
| `backfill.ts:180-182` | `scanForceInstalledBackfills` doc — "clean/installed plugins have nothing to backfill" |
| `backfill.ts:237-239` | `backfillOnePluginIsolated` doc — "Applies the D-68-03 partially-installed filter, the ENBL-08 disabled-record filter and the RECON-04 already-touched dedupe (all three benign skips…)" — **the count "all three" becomes two** |
| `backfill.ts:309-310` | `maybeBackfillPlugin` doc — "re-resolve one partially-installed plugin offline" |

Plus two **identifier** sites whose names encode the retired policy: `scanForceInstalledBackfills` (exported; imported by `backfill.test.ts:27` and called at `backfill.ts:93`) and `hasForceInstalledPlugin` (private, `backfill.ts:87` + `:167`), and two doc-comment references to the scan function by name (`backfill.ts:337`, `:428`).

**Renaming is optional but cheap, and there is a trap.** `tests/architecture/partial-vocabulary-guard.test.ts:218-232` forbids `/force[- ]install/i` across `extensions/**/*.ts`, `docs/output-catalog.md`, `docs/messaging-style-guide.md` and `tests/architecture/*.ts`. The camelCase `ForceInstalled` has neither a hyphen nor a space, so it passes today — but **any new comment spelling `force-installed` or "force install" reddens that guard**. If the plan renames, pick a name with no `force` stem at all (e.g. `scanBackfillCandidates`); if it does not rename, do not describe the functions in prose using the hyphenated form.

**Method note for the SUMMARY:** the removal method found 2 sites, the grep found 7 more, and the two sets are disjoint. Neither alone is the answer. That is the milestone's recurring defect in its exact shape — report both counts and how each was obtained.

### Q3 — What does amending the closed `REASONS` set actually cost?

**Measured by planting a fabricated member (Measurement 3). Five sites go red. Three plausible ones stay silently green.**

**Goes red (the measured amendment set = 5):**

| # | Site | Gate | What it says |
|---|------|------|--------------|
| 1 | `extensions/.../shared/notify-reasons.ts:294` | `tsc` TS2344 | `_ReasonsCoverageProof` — the token has no home in the topic partition. Fixed by adding it to one of the four groups or to `CommandPrivateReason` (`:252-279`). |
| 2 | `tests/shared/notify-reasons.test.ts:48` | `tsc` TS1360 | `ReasonsCoverageProofIsExact` — a second, test-side derivation of the same proof. Clears with #1. |
| 3 | `tests/architecture/compat-01-no-expansion.test.ts:127` | `node --test` | `COMPAT-01: REASONS holds exactly its inherited members, in order` — a 45-element `deepStrictEqual`. Append the token at the **tail** of the expected array (`:178-183`). |
| 4 | `tests/architecture/notify-closed-set-locks.test.ts:29` + `:58` | `node --test` | `assert.equal(REASONS.length, 45)` → 46, plus one more `// <REQ-ID>: +1 for …` line in the running comment ledger (`:30-57`). |
| 5 | `tests/shared/notify.test.ts:4938` | `node --test` | `closed notification constants preserve exact public values` — a second full enumeration of the same tuple. |

Note that #1/#2 and #3/#5 are each *pairs* of independent derivations of the same fact. The planner should expect to edit both halves of both pairs; editing one and assuming the other follows is exactly the "enumeration shorter than the set it names" defect.

**Stays silently green (the trap set = 3):**

| Site | Why it stays green | Cost if missed |
|------|--------------------|----------------|
| `tests/architecture/notify-closed-set-locks.test.ts:29` **test title** ("the closed **45-entry** reason set") | Only `REASONS.length` is asserted; the title string is not read by anything | A test whose name lies about what it locks |
| `shared/notify.ts:83` and `shared/notify-reasons.ts:7, :14` prose ("the **45-entry** membership AND order") | No gate reads a comment | `notify-reasons.ts:21-24` claims these sentences "cannot drift from the tuple again without a red test" — that claim is about the tuple's length/enumeration, **not** about the prose. The prose drifts silently. |
| `docs/output-catalog.md` ↔ `tests/architecture/catalog-uat.test.ts` | The catalog gate only fires on states that **render**. A token added to `REASONS` and never emitted changes no bytes. | The token ships with no published contract — and success criterion 4 requires exactly that byte pairing. See Q4. |

`npm run lint`, `npm run fallow` and `npm run format:check` are all silent on a closed-set amendment.

**Not required:** no `shared/probe-classifiers.ts` arm (that module narrows *notes* into reasons; this token is caller-placed), and no `docs/messaging-style-guide.md` count (grep found none).

**Ordering constraint:** `composeReasons` (`notify.ts:2284-2299`) joins the caller's `reasons` in order and appends soft-dep markers last. So a converged workflow plugin in a session with no host engine renders `{<new token>, requires pi-dynamic-workflows}` — worth publishing as its own catalog state, since it is the literal WCONV-01 population's most likely first render.

### Q4 — The `docs/output-catalog.md` ↔ `catalog-uat.test.ts` byte-pairing contract

**The contract has four independent halves.** `tests/architecture/catalog-uat.test.ts` reads the doc at test time and:

1. **Parses** every `<!-- catalog-state: STATE -->` comment paired with the next fenced block, inside a recognised H2 (`## \`/claude:plugin …\``, `## Manual recovery anchors`, or `## reconcile-applied-cascade`) — `loadCatalogExamples`, `:186-187` + the section regex at `:96-97`.
2. **Locks the corpus size**: `assert.equal(examples.length, 195, …)` at `:5602-5610`. This assertion runs **before** any byte comparison, so a new state fails here first with `Expected exactly 195 annotated catalog examples; found 196`.
3. **Forward walk** (`:5598`): for each `(section, state)` there must be a `FIXTURES[section][state]` entry (else `[MISSING FIXTURE]`); `notify(ctx, pi, fixture.message)` must call `ctx.ui.notify` exactly once; the emitted string must be **byte-equal** to the fenced block; the severity argument must match `fixture.expectedSeverity`.
4. **Inverse walk** (`:5744`): every `FIXTURES` key must have a matching catalog annotation — no orphan or stale fixture.

**Cost of adding a catalog state — the worked example is Phase 115 plan 04** (`.planning/workstreams/workflows/phases/115-load-time-workflow-convergence/../115-04-SUMMARY.md`), which added `installed-with-workflow-gate-note` and moved the lock from 194 to 195. Its own findings, verbatim in substance:

- Three files move together: the doc H3 + prose + annotation + fenced block; the `FIXTURES` entry under the right section key; and **the exact-count lock (comment, literal and failure message all three)**.
- The count lock was *not* in that plan's `read_first` and was discovered by failing on it. Put `catalog-uat.test.ts:5602-5610` in this phase's `read_first`.
- The state was proven in **three** directions, not the two the plan mandated: annotation removed → red, fixture removed → red, one byte changed → red. Do the same here.

**What is specific and expensive about *this* phase's catalog work.** The `## reconcile-applied-cascade` section (`docs/output-catalog.md:2336`) currently publishes **eight** states, of which exactly two are backfill states, and **both are `partially-installed`**:

| catalog-state | Line | Arm |
|---|---|---|
| `backfill-partially-installed` | `docs/output-catalog.md:2430` | `partially-installed`, `{lsp}` brace |
| `backfill-partially-installed-no-reasons` | `docs/output-catalog.md:2443` | `partially-installed`, brace-less |

There is **no published state for the `installable: true` backfill arm at all.** Combined with D-116-02's "both render arms carry it", the byte cost is:

- **2 existing states change bytes** — both currently render brace-less or `{lsp}`; both gain the token. Their prose paragraphs (`:2428`, `:2441`) also make claims that stop being true (`"byte-identical to the pre-SEV-05 form"`, `"rows WITHOUT reasons do not gain a brace"`), so both paragraphs must be rewritten, and their `FIXTURES` entries updated.
- **≥1 new state** — the `installed` arm the phase exists to make visible. A second new state carrying `{<token>, requires pi-dynamic-workflows}` is strongly recommended (it is the real population's likely first render, and it pins the `composeReasons` marker ordering).
- **The count lock moves 195 → 196 or 197**, in the same change.

Beware the doc's own H3 title `### Load-time backfill -- no dropped kinds renders brace-less (byte-identical to today)` — after this phase the row is not brace-less. Titles are not gated; rewrite it.

### Q5 — How "wrote nothing / left state.json untouched" is asserted today

**Three precedents exist on this tree; the strongest is the `{bytes, inode, mtimeNs}` triple, and the backfill suite's current form is the weakest of the three.**

| Precedent | Shape | Where |
|---|---|---|
| **Bytes only** | `readFile(statePath,"utf8")` before/after, `assert.strictEqual` | `tests/orchestrators/reconcile/backfill.test.ts:443-482` (`RECON-05: leaves state.json byte-identical when the recorded stamp already matches`) — this is the case the phase must strengthen, because D-116-03 says byte-equality alone would pass an atomic rewrite of identical content |
| **Backdate + mtimeMs** | `utimes(target, BACKDATED, BACKDATED)` then `assert.strictEqual(await mtimeMsOf(target), BACKDATED.getTime())` | `tests/integration/workflow-kind-inversion.test.ts:231-241` (helpers), `:242-288` (`RECON-05: two consecutive reconciles leave a workflow envelope untouched`), `:290-361` (its negative control, `a forced-open gate over a grown set DOES rewrite it`) |
| **Triple snapshot** | `{ bytes, inode, mtimeNs }` from `readFile` + `stat(path,{bigint:true})`, compared with one `deepStrictEqual` | `tests/orchestrators/marketplace/autoupdate.test.ts:122-132`; same shape at `tests/persistence/migrate-config.test.ts:311-318` and `tests/bridges/mcp/unstage.test.ts:301-307` |

**Recommendation:** use the **triple snapshot** for the WCONV-02 second-load case. It satisfies D-116-03's "bytes AND mtime" in one `deepStrictEqual` (the house assertion style), adds `inode` for free (which catches a `write-file-atomic` rename that produced identical bytes at the same mtime), and is already the established form in three suites. The backdate helper's value is that it removes dependence on millisecond timer resolution between two operations in the same tick — worth borrowing if the two loads run back to back in one test. `tests/integration/workflow-kind-inversion.test.ts:227-232` explains precisely why the backdating exists and why its negative control is what makes the "unchanged" assertion meaningful.

The `tests/integration/workflow-kind-inversion.test.ts` RECON-05 pair is also the closest existing analogue of WCONV-01 itself: its negative control seeds a stale stamp and hand-edits the record to `installable: false, supported: ["skills"], unsupported: ["workflows"]`. The WCONV-01 integration case is that test with **`installable: true, supported: ["skills"], unsupported: []`** — the population whose kind was invisible rather than unsupported. If a real-reload proof is wanted (D-116-03 permits an integration file only when a unit test cannot reach the reload path), that file is where it belongs, and it already has the harness.

### Q6 — Is there a resolve-counting seam for "a disabled record was never scanned"?

**No seam exists today. Two honest options; both match house style. Recommend (A), with (B) as the fallback if the planner wants a literal counter.**

The disabled filter (`isRecordedButDisabled(record)`, `backfill.ts:281-283`) returns **before** the try block at `:291`, therefore before `maybeBackfillPlugin` → `resolveRecordedPluginOffline` → `loadMarketplaceManifest` (`backfill.ts:438`). Anything observable downstream of that first I/O is a valid discriminator.

**Option A — the manifest-absence probe (zero production change).** Seed the disabled record with a grown-set source, then **delete or corrupt the cached `marketplace.json`**. If the record were scanned, `loadMarketplaceManifest` throws, the per-plugin catch (`backfill.ts:293-302`) pushes a `plugin-install-failed` row and returns `true`, so `anyFailure` keeps the gate open and the stamp is **not** written. If it is never scanned, `outcomes` is empty **and** the stamp lands. The observation is therefore two-sided — a positive fact about the not-scanning, not an absence.

- The manifest cache cannot mask it: `createManifestCache` treats a `stat` failure as a **pure miss**, the Map is untouched, and the loader's error propagates verbatim (`domain/manifest-cache.ts:11-14`).
- Its negative control already exists in the same suite: `SF-02: surfaces a plugin-scoped failure row when the cached manifest cannot be parsed` (`backfill.test.ts:1773`) proves the poison is visible when the record *is* scanned. Pair the new case with an enabled twin (the suite already has `ENBL-08: promotes the same grown fixture when the record is enabled`, `backfill.test.ts:1486`) and the discriminator is complete.
- Caveat to state honestly in the SUMMARY: this measures "the marketplace manifest was never read", which on this code path is the first statement of the resolve. It is one step downstream of "resolveStrict was never called".

**Option B — an injected resolve seam (the `gitOps` pattern).** `ApplyReconcileOptions` already carries exactly this shape: `readonly gitOps?: GitOps` with a documented production default and a documented narrow purpose (`orchestrators/reconcile/types.ts:256-265`), and `backfill.test.ts` already injects a *counting* fake through it and asserts a measured empty list (`createOfflineGitOps` → `assert.deepStrictEqual(clonedUrls(), [])`, e.g. `backfill.test.ts:846`). Adding `readonly resolveRecorded?: typeof resolveRecordedPluginOffline` (or the narrower `readonly loadManifest?: typeof loadMarketplaceManifest`) is a strict parallel:

- **Threading cost is zero** — `opts` is already the first parameter of all five backfill functions (`backfill.ts:65, 127, 208, 254, 323`).
- It is dependency injection on the public interface, not a `_setXForTest` module-global — CONVENTIONS.md's stated house pattern.
- Cost: one new optional field on a shared options interface, one production-default line, and a `satisfies ApplyReconcileOptions` fixture update in `tests/orchestrators/reconcile/types.test.ts:120, 127, 280`. No `COMPAT-01` key-set lock covers `ApplyReconcileOptions` (grep of `ApplyReconcileOptions` finds only the type, the five `backfill.ts` signatures, the eight `apply.ts` signatures, and those three test fixtures).

**Do not** reach for `t.mock.method` on the module or a module-global counter — both are the forbidden shape.

### Q7 — Pitfalls specific to widening this scan

**P1 — Git-source records never converge, and that is load-bearing in both directions.** `resolveRecordedPluginOffline` calls `resolveStrict(entry, { marketplaceRoot: mp.marketplaceRoot })` with **no** `resolveGitPluginRoot` (`backfill.ts:444`). `ResolveContext.resolveGitPluginRoot` is optional (`domain/resolver.ts:306`), and its absence makes every `url` / `git-subdir` / `github` source resolve `unavailable` with the note `git source requires a clone-cache resolver` (`domain/resolver.ts:812-819`), which `maybeBackfillPlugin` treats as a benign skip (`backfill.ts:332-341`). Measurement 4 confirms this against the real resolver.

*Good news:* `reinstallPlugin` is therefore **never reached** for a git-source record, so the widened scan cannot attempt the cold-clone network touch that `reinstall.ts:1120-1128` documents ("a truly cold source attempts the recorded-sha re-clone… and fails clean if unreachable"). NFR-5 at load time is structurally safe.

*Bad news:* WCONV-01 is satisfied **only for path-source plugins**. In practice that is the common shape — a marketplace added from a github repo declares its plugins as `source: "./plugins/<name>"` relative to the local clone root, which is a `path` source — but a plugin whose entry names a separate repo will not converge. State this boundary in the plan and in the amended comment; do not let review discover it. Consider a case that pins it (a github-source record with a grown set is skipped, no clone attempted, `clonedUrls() === []`), because there is **no test covering a git-source record in the backfill scan today** (grep of `backfill.test.ts` for `github`/`git-subdir` finds nothing).

**P2 — `alreadyTouched` becomes load-bearing rather than incidental.** `scanForceInstalledBackfills` builds the set from every accumulated outcome carrying a `plugin` key in the same scope (`backfill.ts:213-218`), and `backfillOnePluginIsolated` skips on it (`backfill.ts:285-289`). With the narrow filter this only fired for the tiny partially-installed population. After the widening the overlaps become the common case, and two of them are dangerous:

- **`pluginsToUninstall`** — `applyPlan` uninstalls a record the config no longer declares and pushes `plugin-uninstalled`. The backfill's snapshot **predates** `applyPlan` (`apply.ts:181-182`, `:783-793`), so it still holds that record. Without `alreadyTouched` the scan would re-materialize a plugin the user just removed.
- **`pluginsToDisable`** — `applyPlan` disables a record; the snapshot still says `enabled: true`, so the ENBL-08 filter does not catch it. Without `alreadyTouched` the scan would re-install it, and `reinstall.ts:1564` writes `enabled: true` unconditionally, reversing an explicit user decision.

Both deserve a case. The suite has one (`RECON-04: skips a plugin already represented in this scope's accumulated outcomes`, `backfill.test.ts:1334`) but it is generic; a disable-shaped one is the sharper claim.

**P3 — `updatedAt` moves on every promotion.** `reinstall.ts:1538-1568` preserves `version` (D-68-02), `installedAt` and `resolvedSha`, but writes `updatedAt: new Date().toISOString()` and `enabled: true`. Measurement 5 confirms it. So "one-time" is a claim about the **second** load only; the first load legitimately rewrites state.json. Write the WCONV-02 case as *two* loads with the snapshot taken after the first, exactly as `tests/integration/workflow-kind-inversion.test.ts:265-268` does.

**P4 — The WGATE-01 gate warnings are dropped at load time.** `reinstall.ts:1074` folds `handles.workflows.result.warnings` (Phase 115's per-script admission-gate warnings) into `discoveryWarnings`, and `reinstall.ts:42-49` states that the backfill caller renders **neither** half. `surfacePostCommitWarnings` only handles `plugin-installed` and `plugin-disabled` outcomes (`apply.ts:880-892`), and `PluginBackfilledOutcome` carries no warnings field (`apply-outcomes.ts:135-150`). The widened scan makes this gap land on exactly the population it targets: a workflow-bearing plugin converging at load time produces gate warnings nobody sees. This is pre-existing and tracked as BACKLOG `UPCASC-01` (`reinstall.ts:49`). **Recommend: out of scope, named explicitly in the plan and the SUMMARY** rather than silently inherited — the WCONV-03 token partly compensates (the row is no longer silent) but the per-script detail is still dropped.

**P5 — Scan cost is now O(all recorded plugins), once per version bump.** Previously the scan re-resolved only `installable: false` records. Now every recorded plugin in **both** scopes is re-resolved on the first load after each `EXTENSION_VERSION` change. Each re-resolve is a cached manifest read plus a `resolveStrict` disk walk of the plugin root (`domain/resolver.ts:1605` iterates `SUPPORTED_COMPONENT_PATH_KINDS` and probes conventions). Bounded and offline, but it is real load-time I/O on one load per release. Nothing in the phase needs to fix it; the plan should not be surprised by it.

**P6 — Growth is not workflows-specific.** `supportedSetGrew` compares whatever the resolver now reports against whatever was recorded. After the widening, **any** `installable: true` record whose on-disk source has since gained a component directory (a `skills/`, `commands/`, `agents/` or `workflows/` dir added by the user to a path-source plugin) re-materializes on the next version bump. The supported set derives purely from disk + manifest and does **not** depend on soft-dep load state (`domain/resolver.ts:1595-1621`; `companionSeverity` reads the probe only for severity, `notify-reasons.ts:91-104`), so there is no session-to-session flapping — but the population is wider than "workflow plugins". Say so; do not claim the token means "workflows arrived".

**P7 — A `failed` promotion keeps the gate open forever.** `maybeBackfillPlugin` returns `true` on a `failed` reinstall partition (`backfill.ts:370-390`), which makes `applyBackfillForScope` skip the stamp (`backfill.ts:101-103`), so the whole scope re-scans on **every** load until it succeeds. With the widened population, one permanently broken path-source record (deleted source directory, EACCES) now pins the gate open for every record in that scope indefinitely. Pre-existing mechanism, newly likely. Worth a sentence in the plan's risk list; a fix is out of scope.

**P8 — The `partially-installed` arm's severity is unaffected by the token.** `backfilledRowFromOutcome` computes `severity = malformed.length > 0 ? "warning" : "info"` (`orchestrators/reconcile/notify.ts:618`), reading only `degradedKinds`. Adding a reason does not move severity — which is correct (SEV-03: a backfill is a benign promotion) and means the tally lines in the two existing catalog states stay `Reconcile: 1 success`.

## Architecture Patterns

### System architecture — the load-time convergence path

```text
Pi `resources_discover`
        │
        ▼
index.ts handler ──► applyReconcile(opts)                      apply.ts:732
        │
        ├─► per scope: readPassForScope(scope, cwd)             apply.ts:105
        │      │   pathExists(stateJsonPath) ──► stateExisted
        │      │   withLockedStateTransaction ──► tx.state (loadState; {} on ENOENT)
        │      │   planReconcile(merged, state, scope)  [pure]
        │      └─► { plan, state, stateExisted }
        │
        ├─► applyPlan(opts, plan, outcomes)                      apply.ts:783
        │       pushes plugin-installed / -uninstalled / -enabled / -disabled rows
        │
        ├─► applyBackfillForScopeIsolated(...)                   apply.ts:793   ◄── THIS PHASE
        │      │
        │      ├─ state === undefined? ───────────────► return   backfill.ts:71   (WR-05)
        │      ├─ stamp === EXTENSION_VERSION? ───────► return   backfill.ts:76   (WCONV-02 bound)
        │      ├─ !stateExisted && !hasForceInstalled? ► return   backfill.ts:87   (LEAVE ALONE — Q1)
        │      │
        │      └─ scanForceInstalledBackfills            backfill.ts:207
        │            alreadyTouched := outcomes with `plugin` in this scope
        │            for each (marketplace, plugin, record):
        │              backfillOnePluginIsolated         backfill.ts:253
        │                ├─ ✂ installable? skip   ◄──── DELETE (D-116-01)   :266-269
        │                ├─ isRecordedButDisabled? skip  (ENBL-08)           :281
        │                ├─ alreadyTouched? skip         (RECON-04)          :287
        │                └─ try maybeBackfillPlugin      backfill.ts:322
        │                     resolveRecordedPluginOffline           :434
        │                       loadMarketplaceManifest (cached)     :438
        │                       resolveStrict({marketplaceRoot})     :444
        │                         └─ git source ⇒ unavailable  ◄── P1
        │                     unavailable/undefined? ──► false (benign)      :332
        │                     !supportedSetGrew? ─────► false (benign)       :343  (WCONV-02)
        │                     reinstallPlugin({render:"none"})               :349
        │                       skipped? ► false   failed? ► push+true       :359/:370
        │                     push { kind: "plugin-backfilled", installable, … } :392
        │
        ├─ anyFailure? ──► return without stamping  (gate stays OPEN)  backfill.ts:101
        └─ withStateGuard ► lastReconciledExtensionVersion = EXTENSION_VERSION  :110

outcomes ──► buildReconcileAppliedCascade ──► backfilledRowFromOutcome   reconcile/notify.ts:610
                  ├─ installable:true  ► PluginInstalledMessage          :619-628  ◄── token here
                  └─ installable:false ► PluginPartiallyInstalledMessage :630-645  ◄── and here
             ──► notifyReconcileAppliedWithContext ──► ONE ctx.ui.notify   apply.ts:825
```

### Pattern 1 — widen a filter by deletion, keep the growth policy stated once

**What:** remove `backfill.ts:266-269` entirely. `supportedSetGrew` (`:454`) already returns `false` for `resolved.length <= recorded.length`, so an unchanged record costs one cached-manifest read and one offline resolve and produces no write and no row.

**Why not a branch:** a second arm would state "growth is what promotes" twice, and the two statements would drift.

**Cost check:** deleting the branch lowers both cognitive-complexity scores on `backfillOnePluginIsolated`; there is no fallow/ESLint headroom risk.

### Pattern 2 — a new reason token rides an existing outcome

```ts
// orchestrators/reconcile/notify.ts:616-645 — both arms, one shared prelude.
function backfilledRowFromOutcome(
  outcome: PluginBackfilledOutcome,
): PluginInstalledMessage | PluginPartiallyInstalledMessage {
  const malformed = malformedReasonsForKinds(outcome.degradedKinds);
  const reasons: ContentReason[] = [
    // WCONV-03: the convergence marker. Placed in the shared prelude so BOTH
    // arms carry it; the emit order is <token>, orphan rewake, malformed*,
    // then (partial arm only) the dropped kinds, then the soft-dep markers
    // composeReasons appends (notify.ts:2292).
    ...(outcome.orphanRewake === true ? (["orphan rewake"] as const) : []),
    ...malformed,
  ];
  const severity = malformed.length > 0 ? "warning" : "info";
  ...
}
```

The token must be a `ContentReason` (`notify.ts:289-296` — i.e. **not** one of the three structural `marketplace not added*` markers), because it rides a plugin row and joins that row's other reasons rather than replacing them. Give it a home in `notify-reasons.ts`; `CommandPrivateReason` (`:252-279`) is the right group — it is owned by the reconcile projection, not shared across topic groups, exactly as `orphan rewake` and `stale workflow command` are.

### Pattern 3 — the negative-control discipline this milestone requires

Every gate this phase adds gets a control run **before** it is believed, with the transcript pasted into the SUMMARY:

| Gate | Control | Expected |
|---|---|---|
| WCONV-01 case | restore `if (record.compatibility.installable) return false;` | case reddens |
| Closed-set lock | delete the token from `REASONS` | `notify-closed-set-locks` + `compat-01` + `notify.test.ts:4938` redden, `tsc` errors twice |
| Catalog state | (a) remove the annotation, (b) remove the fixture, (c) change one byte | (a) count lock + inverse walk, (b) `[MISSING FIXTURE]`, (c) `[BYTE MISMATCH]` |
| "never scanned" case | flip the record to `enabled: true` | the twin promotes / the poison surfaces a `(failed)` row |
| "one-time" case | force the stamp stale before the second load | snapshot differs |

### Anti-patterns to avoid

- **Refitting `createNotificationBoundary` counts to absorb a new emission.** `tests/edge/notification-boundary.ts:76-84` explicitly forbids it; find out *why* the count moved first.
- **A `times(0)` expectation.** `strong-mock` treats it as "no limit" — a zero written that way proves nothing (`notification-boundary.ts:19-23`). State zero by omitting the member.
- **A new test file under `tests/orchestrators/`.** `scripts/check-corresponding-tests.mjs:10` exempts only `architecture`, `e2e` and `integration`; every other `tests/**/x.test.ts` must pair 1:1 with `extensions/pi-claude-marketplace/**/x.ts`. New unit cases go into the existing `backfill.test.ts`.
- **Writing "force-installed" or "force install" in any new comment.** `tests/architecture/partial-vocabulary-guard.test.ts:218-232` reddens on `/force[- ]install/i` across `extensions/**/*.ts`, `docs/output-catalog.md`, `docs/messaging-style-guide.md` and `tests/architecture/*.ts`.
- **A no-op outcome to represent silence.** D-116-02 forbids it; `maybeBackfillPlugin` already returns before pushing (`backfill.ts:343-345`).
- **Byte-equality alone as the "wrote nothing" proof.** See Q5.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---|---|---|---|
| "The supported set grew" | A new comparison | `supportedSetGrew` (`backfill.ts:454`) | WCONV-02 names it; strict-superset semantics already correct and tested |
| "Only once per version" | A new marker or timestamp | `lastReconciledExtensionVersion` gate (`backfill.ts:76-81`) | WCONV-02 names it; RECON-05 already asserts its mtime invariant |
| Re-materialize a plugin in place | A bespoke stage/commit loop | `reinstallPlugin({ render: "none" })` (`backfill.ts:349`) | Partial-capable, self-locking, preserves version/installedAt/resolvedSha (`reinstall.ts:1538-1548`) |
| Model "this converged" | A new `PerEntryOutcome` member | `PluginBackfilledOutcome` (`apply-outcomes.ts:135`) | D-116-02; a new member costs a union arm, a projection arm and a catalog section for no behavioural gain |
| "Never scanned" as a zero | A module-global counter or `_setXForTest` | Manifest-absence probe, or an optional dep on `ApplyReconcileOptions` mirroring `gitOps` (`types.ts:256-265`) | CONVENTIONS.md forbids test-only module seams; DI is the house pattern |
| "state.json untouched" | A fresh mtime helper | `{ bytes, inode, mtimeNs }` triple (`autoupdate.test.ts:122-132`) or the `backdate`/`mtimeMsOf` pair (`workflow-kind-inversion.test.ts:231-241`) | Two established forms; a third would drift |
| A hermetic project scope with a HOME | New scaffolding | `createHermeticProjectScope` (`backfill.test.ts:96-127`) + `writeMarketplaceSource` / `writePluginTree` (`:141-234`), whose `PluginTree` already has `workflow?: boolean` (`:137-138`) | The workflow fixture already exists |

**Key insight:** this phase's whole implementation is a four-line deletion plus one tuple entry plus one line in a shared prelude. Everything else is proof. Any design that grows the production surface beyond that is re-stating a policy the code already owns.

## Runtime State Inventory

The widened scan reads and rewrites persisted records written by earlier extension versions, so the runtime-state question is live even though this is not a rename.

| Category | Items found | Action required |
|---|---|---|
| **Stored data** | `<scopeRoot>/pi-claude-marketplace/state.json`, per scope. Two legacy record populations exist: **(a)** installed before `workflows` was a known kind → `installable: true`, `supported` lacks `"workflows"`, `unsupported: []` (the WCONV-01 target, unreachable today); **(b)** installed under the released 0.18.1 with `#154` → `installable: false`, `unsupported: ["workflows"]` (already served by the existing arm). Also `lastReconciledExtensionVersion` — absent on records written before D-68-01, which counts as gate-open. | Code change only. The re-materialization rewrites `compatibility`, `resources`, `updatedAt` for promoted records; `version`, `installedAt` and `resolvedSha` are preserved (`reinstall.ts:1538-1548`). No separate migration. |
| **Live service config** | Host workflow engine saved directory `~/.pi/workflows/` (`locations.workflowsSavedDir`) — envelopes are written there, outside every scope root. The engine holds no registry this extension can read. | None. The backfill writes envelopes through the workflows bridge; a reload is what registers the commands (WLIF-06 semantics unchanged). |
| **OS-registered state** | None — verified: this extension registers nothing with the OS; the only process-lifetime state is `bridges/hooks/routing-state.ts` (rebuilt every load by `rebuildScopeRoutingTableIsolated`, `apply.ts:797`) and `shared/completion-cache.ts`. | None. |
| **Secrets / env vars** | None touched. `PI_CODING_AGENT_DIR` and `HOME` are read for path derivation only. | None. |
| **Build artifacts** | None — no build step (`tsc --noEmit`; Node runs `.ts` natively, STACK.md). | None. |

**Not a migration.** The scan converges by re-resolving and re-materializing, so there is nothing to rewrite in place ahead of time. The two populations differ only in which side of the `installable` filter they land on, and after the deletion both take the same path.

## Common Pitfalls

See **Q7 (P1–P8)** for the eight measured, phase-specific hazards. The three that most often become review findings on this tree:

### Pitfall A: the enumeration is shorter than the set

**What goes wrong:** a list of "the sites that must change" omits one, and the type system absorbs the omission.
**Why it happens:** additive changes to closed sets compile clean at every derivation site (`notify-closed-set-locks.test.ts:8-11` says so in terms).
**How to avoid:** plant, run, record. This session measured 5 red + 3 silently-green for the token (Q3) and 2 red + 7 prose for the filter (Q2) — and the removal method and the grep found **disjoint** sets.
**Warning sign:** a plan that names amendment sites without a transcript.

### Pitfall B: the guard that is green because it checks nothing

**What goes wrong:** a new case passes over an implementation that does nothing.
**Why it happens:** an assertion that reads configuration instead of planting a violation; `times(0)`; an unawaited `assert.rejects`; byte-equality that an atomic identical rewrite also satisfies.
**How to avoid:** every gate gets a control run before it is believed (Pattern 3), with the failing transcript in the SUMMARY.
**Warning sign:** a "one-time" claim proved on bytes alone.

### Pitfall C: the comment that argues for deleted code

**What goes wrong:** seven prose sites in `backfill.ts` (Q2) keep asserting "scan ONLY partially-installed plugins" after the filter is gone; `backfillOnePluginIsolated`'s doc says "all three benign skips" when there are two.
**Why it happens:** the filter is four lines; the prose describing it is seven paragraphs.
**How to avoid:** grep `installable` across `orchestrators/reconcile/` as the cross-check D-116-01 mandates, and write the replacement in present tense describing the current filter set — `.claude/rules/typescript-comments.md` forbids narrating the removed shape.
**Warning sign:** a diff that touches `backfill.ts:266-269` and nothing else in that file.

## Code Examples

### The deletion (`backfill.ts:265-290`, after)

```ts
  const { scope, marketplace, mp, plugin, record } = target;
  // ENBL-08: never scan a record the user disabled. Promoting a disabled record
  // would restore that plugin's hooks, MCP servers and PATH entries at load time
  // with no command and no prompt. Reinstall also refuses a disabled record, so
  // this is not the only thing standing between the scan and that reversal --
  // it stays as the caller-side guard, so the scan does no pointless work and
  // the promotion policy stays visible beside the scan's other filters.
  // Availability and disabled-ness are orthogonal axes (ENBL-05).
  if (isRecordedButDisabled(record)) {
    return false;
  }

  // RECON-04: applyPlan already touched this plugin this load -- don't double-emit /
  // re-materialize over it.
  if (alreadyTouched.has(`${marketplace} ${plugin}`)) {
    return false;
  }
```

The amended D-68-03 note belongs on `maybeBackfillPlugin` / the module header, and should state (present tense) that the growth test is the sole promotion gate, that D-68-03's strict-superset and stamp-on-gate-open halves are still live, and that a git source resolves `unavailable` here so only path-source records converge.

### The catalog state to add (`docs/output-catalog.md`, `## reconcile-applied-cascade`)

```text
### Load-time backfill -- a fully promoted record says why it appeared (WCONV-03)

<!-- catalog-state: backfill-installed-converged -->

```text
● local-mp [user]
  ● hello v1.0.0 (installed) {<token>}

Reconcile: 1 success
```
```

Pair it with a `FIXTURES["reconcile-applied-cascade"]["backfill-installed-converged"]` entry in `tests/architecture/catalog-uat.test.ts` and raise the count lock at `:5602-5610`. Existing precedent for the section key and the `piWith*Loaded` probe factories: `catalog-uat.test.ts:210-245`.

### The WCONV-02 second-load snapshot (house form)

```ts
// tests/orchestrators/marketplace/autoupdate.test.ts:122-132 is the source form.
async function stateSnapshot(filePath: string): Promise<{
  readonly bytes: string;
  readonly inode: bigint;
  readonly mtimeNs: bigint;
}> {
  const [bytes, metadata] = await Promise.all([
    readFile(filePath, "utf8"),
    stat(filePath, { bigint: true }),
  ]);
  return { bytes, inode: metadata.ino, mtimeNs: metadata.mtimeNs };
}
```

## State of the Art

| Old | Current | When it changed | Impact on this phase |
|---|---|---|---|
| `workflows` sits in neither supported nor unsupported tuple (invisible) | `workflows` in `SUPPORTED_COMPONENT_KINDS` **and** `SUPPORTED_COMPONENT_PATH_KINDS` (`resolver.ts:354-369`) | WINV-01, Phase 109 (this branch) | Creates the growth this phase converges on; the released 0.18.1 still behaves the `#154` way |
| `workflows` in `UNSUPPORTED_COMPONENT_KINDS` → `partially-available` | Reversed by WINV-01 | `#154` shipped, then Phase 109 reversed it | Two legacy record populations exist (Runtime State Inventory) |
| `REASONS` at 44 | `REASONS` at 45 (`requires pi-dynamic-workflows` appended by WDEP-04) | Phase 114 | The count this phase moves to 46 |
| Catalog corpus at 194 | 195 (`installed-with-workflow-gate-note`, plan 115-04) | Phase 115 | The count this phase moves again; that SUMMARY is the worked example |
| `import-x/no-cycle` as the cycle gate | Removed; `fallow dead-code` is the gate | ARCHITECTURE.md | Not phase-relevant, but do not add an ESLint cycle rule |

**Deprecated / do not reach for:** `_setXForTest`-style module seams (CONVENTIONS.md), `times(0)` (`notification-boundary.ts:19-23`), a new `tests/orchestrators/**` file without a paired source module (`check-corresponding-tests.mjs:10`).

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | The two Anthropic-authored workflow plugins (`claude-security`, `code-modernization`) reach users as **path**-source entries under a github-source marketplace, so P1's git-source limitation does not exclude them. Inherited from CONTEXT's "both land on that side"; not re-measured against a live marketplace this session. | Q7 / P1 | WCONV-01's named population would not converge. Cheap check: read the `source` field of any real `marketplace.json` entry. |
| A2 | The token spelling is the planner's discretion (D-116-02 says so) and no upstream Claude Code vocabulary constrains it. Not researched against upstream. | Q3 | A spelling that reads as an error rather than an explanation. Mitigated by the `simple-english` / row-grammar review at plan time. |
| A3 | Adding one `ContentReason` does not push `backfilledRowFromOutcome` or `backfillOnePluginIsolated` over either complexity ceiling. Reasoned, not measured (the deletion lowers one score and the token adds one spread element). | Pattern 1 / 2 | A fallow `health` failure at commit time; caught by `npm run check`. |
| A4 | `npm run check`'s remaining members (`test:corresponding:negative`, `test:coverage:direct:negative`) are unaffected by a same-file edit. Not run this session (they are meta-gates over the pairing scripts). | Project Constraints | A late red in the full gate; run `npm run check` once before the phase closes. |

## Open Questions (RESOLVED)

All four were settled by the post-research decisions in `116-CONTEXT.md` before
planning began. The questions are kept as written -- they record what was
genuinely open when the research finished -- and each carries its resolution
inline rather than being edited to look already-decided.

1. **RESOLVED -- no rename** (`116-CONTEXT.md`, "Names are left alone"). The
   spellings stay; the plan instead bans the hyphenated `force-install` form in
   NEW prose, which is what would redden `partial-vocabulary-guard.test.ts`.
   Renaming is churn beyond what WCONV-01..03 ask for.

   **Does the plan rename `scanForceInstalledBackfills` / `hasForceInstalledPlugin`?**
   - Known: the names encode the retired policy; the vocabulary guard's `/force[- ]install/i` does **not** match the camelCase form, so keeping them is legal.
   - Unclear: whether renaming is worth touching the export, its one call site, its two doc references and one test import.
   - Recommendation: rename to a `force`-free name in the same change as the deletion (it is 5 sites and the guard makes the alternative — describing them in prose — a trap), or explicitly decide not to and say why in the SUMMARY.

2. **RESOLVED -- extend, do not create** (D-116-07). The recommendation below
   was taken: `tests/integration/workflow-kind-inversion.test.ts` is extended
   with the `installable: true` twin.

   **Is a `tests/integration/` case needed, or is the unit suite enough?**
   - Known: `tests/integration/workflow-kind-inversion.test.ts:242-361` already drives the real `applyReconcile` twice with an mtime harness and a negative control; adapting it to `installable: true` is small. D-116-03 permits a new integration file "only if a real reload path cannot be reached from a unit test", and Measurement 5 shows the unit seam reaches the whole behavior.
   - Recommendation: put the WCONV-01/02 proofs in `backfill.test.ts` (unit) and **extend** the existing integration file with the `installable: true` twin rather than creating a new one. The integration dir is exempt from the pairing gate, so an extension is free.

3. **RESOLVED -- two new states, lock 195 -> 197** (D-116-06). The
   recommendation below was taken in full.

   **How many catalog states end up added?**
   - Known: ≥1 (the `installed` arm), 2 existing states change bytes.
   - Recommendation: 2 new (`installed` clean, and `installed` + `{requires pi-dynamic-workflows}`), so the count lock moves 195 → 197. Decide before writing the plan so the lock literal, its comment and its failure message move once.

4. **RESOLVED -- repair (a), at the fixture seed** (D-116-05). The
   notification-boundary counts are deliberately NOT raised: those literals
   exist to catch an unintended extra emission, and raising them to accommodate
   one is the "green because it checks nothing" failure this milestone has
   already shipped three times.

   **Do the two `tests/index.test.ts` cases get repair (a) or (b)?** See Q2. Recommendation: (a), closing the gate in `seedEnabledPlugin`.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|---|---|---|---|---|
| Node | everything | ✓ | ≥20.19.0 declared; suite ran clean this session | — |
| npm + `node_modules` | `npm test`, `npm run check` | ✓ | Full unit suite ran: 5645 pass in ~40 s | — |
| `fallow` | `npm run fallow` | ✓ | exits 0 on the clean tree | — |
| `prettier`, `eslint`, `tsc` | gate | ✓ | all clean this session | — |
| `pre-commit` | commit-time | ✓ (assumed installed) | — | Per CLAUDE.md, `trufflehog`'s git-mode hook fails structurally in this worktree; use `SKIP=trufflehog` **after** a clean `trufflehog filesystem <paths> --results=verified,unknown --fail` |
| Host workflow engine (`@quintinshaw/pi-dynamic-workflows`) | runtime execution of converged workflows | ✗ (deliberately not a declared dependency) | — | Envelopes are written regardless; the `requires pi-dynamic-workflows` marker reports the engine's absence. No automated gate; WEVID-01 (Phase 117) owns the live evidence |
| Network | nothing in this phase | n/a | — | P1 proves the widened scan cannot reach a network clone |

**Missing with no fallback:** none.

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`.

### Test framework

| Property | Value |
|---|---|
| Framework | `node:test` (Node built-in) + `node:assert/strict` + `strong-mock` `^9.2.2` |
| Config file | none — driven by `package.json` scripts |
| Quick run | `node --test tests/orchestrators/reconcile/backfill.test.ts` (~4 s) |
| Architecture subset | `node --test "tests/architecture/*.test.ts"` |
| Full unit suite | `npm test` (~40 s, 5645 tests) |
| Integration | `npm run test:integration` (34 tests) |
| Per-pair coverage | `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts` |
| Phase gate | `npm run check` |

### Phase requirements → test map

| Req | Behavior | Type | Automated command | File exists? |
|---|---|---|---|---|
| WCONV-01 | An `installable: true` record whose set grew is promoted; envelope placed; record gains `workflows` | unit | `node --test tests/orchestrators/reconcile/backfill.test.ts` | ✅ (add case) |
| WCONV-01 | Negative control: restoring the filter reddens the case | unit | same, with the filter restored | ✅ manual control |
| WCONV-01 | A git-source record with a grown set is skipped, no clone | unit | same file | ✅ (add case — none today) |
| WCONV-02 | Second load re-materializes nothing; `{bytes, inode, mtimeNs}` unchanged | unit or integration | `node --test tests/orchestrators/reconcile/backfill.test.ts` / `tests/integration/workflow-kind-inversion.test.ts` | ✅ (extend) |
| WCONV-02 | Equal set is scanned but not materialized | unit | `backfill.test.ts:485` (retitle) and `:1170` | ✅ exists |
| WCONV-03 | Disabled record is never scanned, as a measured zero | unit | `backfill.test.ts` (manifest-poison or injected seam) | ✅ (add case; `:1382`, `:1425`, `:1486` are the adjacent existing cases) |
| WCONV-03 | Token is a member of the closed set, at the tail, at the new length | architecture | `node --test tests/architecture/notify-closed-set-locks.test.ts tests/architecture/compat-01-no-expansion.test.ts` | ✅ (bump) |
| WCONV-03 | Token renders byte-exactly on both arms | architecture | `node --test tests/architecture/catalog-uat.test.ts` | ✅ (add states + fixtures + count) |
| WCONV-03 | Projection stamps the token on both arms | unit | `node --test tests/orchestrators/reconcile/notify.test.ts` (4 backfill cases at `:1106, :1147, :1186, :1226`) | ✅ exists — all four change |
| WCONV-03 | Silence: no growth ⇒ no row | unit | `backfill.test.ts:1128`, `:1170`, `:1220` | ✅ exists |

### Sampling rate

- **Per task commit:** `node --test` on the touched files + `npm run typecheck`.
- **Per wave merge:** `npm test` (40 s) + `npm run test:integration`.
- **Phase gate:** `npm run check` green, plus `npm run test:coverage:direct -- extensions/pi-claude-marketplace/orchestrators/reconcile/backfill.ts` at 100% function/line/branch run alone (the pairing rule from the `typescript-unit-testing-review` skill).

### Wave 0 gaps

None. `tests/orchestrators/reconcile/backfill.test.ts` exists with a full hermetic harness (`createHermeticProjectScope`, `writeMarketplaceSource`, `pluginRecord`, `createOfflineGitOps`, `createSilentBoundary`, `savedWorkflowEntries`, `retryTree`), and `PluginTree.workflow` is already a supported fixture knob (`:137-138`). All four architecture tests exist. No framework install, no new config, no new file needed — and **no new unit test file may be created** under `tests/orchestrators/` anyway (`check-corresponding-tests.mjs:10`).

## Security Domain

`security_enforcement` is absent from `.planning/config.json` → enabled.

### Applicable ASVS categories

| Category | Applies | Standard control on this path |
|---|---|---|
| V2 Authentication | no | The widened scan cannot reach a git clone (P1), so no credential path is entered |
| V3 Session management | no | No sessions |
| V4 Access control | **yes** | ENBL-08 (`backfill.ts:281`) is the access-control boundary: a record the user disabled must never be re-materialized, because `reinstall.ts:1564` writes `enabled: true` unconditionally. WCONV-03's measured-zero case is this control's test. |
| V5 Input validation | **yes** | `PLUGIN_ENTRY_VALIDATOR.Check(entry)` before resolve (`backfill.ts:440`); `resolveStrict` re-validates the whole entry; `assertPathInside` guards every derived path (`shared/path-safety.ts`, NFR-10) |
| V6 Cryptography | no | None used |
| V12 File handling | **yes** | All writes go through the atomic primitives (`write-file-atomic`, `saveState`); envelopes are written into `locations.workflowsSavedDir` under the bridge's containment checks |
| V14 Configuration | **yes** | WR-05: the reconcile must not create unsolicited files in an arbitrary repo. This is exactly what Q1 protects — Measurement 2 shows widening `hasForceInstalledPlugin` breaks it. |

### Threat patterns for this change

| Pattern | STRIDE | Mitigation on this tree |
|---|---|---|
| Load-time re-enable of a user-disabled plugin restores its hooks / MCP servers / PATH with no prompt | Elevation of privilege | `isRecordedButDisabled` filter at `backfill.ts:281` **plus** reinstall's own refusal (`reinstall.ts:927`) — two independent layers; the phase must not weaken either |
| Widened scan creates state files in a repo the user only opened | Tampering (WR-05) | The `hasForceInstalledPlugin` guard stays narrow (Q1); pinned by `backfill.test.ts:529` |
| Load-time network egress from a reload the user did not initiate | Information disclosure / NFR-5 | Structurally impossible on this path: git sources resolve `unavailable` before `reinstallPlugin` (P1, Measurement 4). A case asserting `clonedUrls() === []` on a git-source record makes it a gate rather than an accident |
| A corrupt cached manifest aborts the whole scope's convergence | Denial of service | Per-plugin fault isolation (`backfill.ts:291-302`) keeps healthy siblings scanning; already covered by `backfill.test.ts:1824` |
| Executable code (workflow envelopes) rewritten on a reload the user did not ask for | Tampering | The strict-superset gate (`backfill.ts:343`) and the version stamp (`:76`) bound it; `backfill.test.ts:1170` and `workflow-kind-inversion.test.ts:242` are the two standing proofs |
| A raw error message leaks an absolute path into a notification | Information disclosure | `redactAbsolutePaths` at the isolation boundary (`backfill.ts:156`); the failure arm carries only the closed-set reason, never the notes text (`backfill.ts:381-388`) |

**One new consideration this phase introduces:** the widened scan re-materializes a much larger population, and P7 means one permanently failing record keeps the version gate open for its whole scope on every load. That is availability-shaped, not security-shaped, and it is pre-existing behavior — but it should be named in the plan's risk list rather than discovered.

## Sources

### Primary (HIGH confidence — measured on this tree this session)

- `npm test` baseline and three planted variants; `npm run typecheck`, `npm run lint`, `npm run fallow`, `npm run format:check`, `npm run test:integration` — Measurements 0–3, 5
- Direct execution of `resolveStrict` against github and url sources — Measurement 4
- Source reads with `Read`/`sed` of: `orchestrators/reconcile/{backfill,apply,notify,types,apply-outcomes}.ts`, `orchestrators/plugin/reinstall.ts`, `domain/{resolver,manifest,manifest-cache}.ts`, `persistence/state-io.ts`, `transaction/with-state-guard.ts`, `shared/{notify,notify-reasons}.ts`
- Test reads: `tests/orchestrators/reconcile/backfill.test.ts`, `tests/index.test.ts`, `tests/edge/notification-boundary.ts`, `tests/architecture/{notify-closed-set-locks,compat-01-no-expansion,catalog-uat,partial-vocabulary-guard}.test.ts`, `tests/integration/workflow-kind-inversion.test.ts`, `tests/orchestrators/marketplace/autoupdate.test.ts`, `tests/shared/notify-reasons.test.ts`
- `docs/output-catalog.md` `## reconcile-applied-cascade` section (`:2336-2470`)
- `scripts/check-corresponding-tests.mjs`, `package.json` scripts

### Secondary (MEDIUM confidence — project records read, not independently re-measured)

- `.planning/workstreams/workflows/phases/115-.../115-04-SUMMARY.md` — the catalog-state worked example and the 194→195 lock discovery
- `.planning/workstreams/workflows/STATE.md` — accumulated decisions ("Equality is not growth", "Never scan a disabled record", the five-times enumeration pattern)
- `.planning/workstreams/workflows/{REQUIREMENTS,ROADMAP}.md`
- `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/rules/typescript-comments.md`, `.planning/codebase/{ARCHITECTURE,CONVENTIONS,STACK}.md`, `.agents/skills/typescript-unit-testing-review/SKILL.md`

### Tertiary (LOW confidence)

- None. No web search was performed and none was needed — this phase has no external technology surface.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — no new dependencies; every module named is already imported by the seam.
- Architecture / seam behavior: **HIGH** — every step of the call chain was read at file:line and the end-to-end behavior was executed (Measurement 5).
- Amendment-site enumeration: **HIGH** — obtained by planting and running the gate, twice, by two independent methods (removal + grep), with the disjointness reported.
- Pitfalls: **HIGH** for P1 (executed), P2/P3/P4/P8 (read at file:line); **MEDIUM** for P5/P6/P7 (reasoned from read code, consequences not executed at scale).
- Population claim (A1): **MEDIUM** — inherited from CONTEXT, not re-measured against a live marketplace.

**Research date:** 2026-09-09
**Valid until:** 2026-10-09 for the in-repo measurements (they are pinned to this tree's HEAD, `ec9ac05e`-era; any merge into `features/workflow` that touches `backfill.ts`, `notify.ts` or the four architecture tests invalidates the counts — re-run the plants, they cost ~40 s each).

**Tree state on completion:** all plants reverted. `git status --porcelain` shows only the operator's own pre-existing edits (`.claude/settings.json`, `.codex/config.toml`, `.claude/CLAUDE.md`, `.mcp.json`, `AGENTS.md`, `.codegraph/`, `.planning/workstreams/workflows/{config.json,.verification-ledger.json}`). No commit was made.
