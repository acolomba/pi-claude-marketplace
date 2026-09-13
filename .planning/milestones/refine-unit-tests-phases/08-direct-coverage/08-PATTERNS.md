# Phase 8: Direct Coverage - Pattern Map

**Mapped:** 2026-09-10
**Files analyzed:** 31 (4 new, 27 modified)
**Analogs found:** 30 / 31

Every analog path below was checked with `git ls-files` and is tracked source. No
gitignored mirror paths appear in this document.

Scope note: `08-RESEARCH.md` already enumerates **what** changes (file inventory,
call-site counts, exact before/after loop bodies, the exact CI and hook blocks).
This document supplies only the **analog per new artifact** and the **house shape
each modified file must keep**. Where research already quotes a block verbatim
(the CI job, the hook stanza, the three loop rewrites), this document points at it
rather than restating it.

## File Classification

### New files

| New file | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|
| `scripts/test-coverage-direct.pin.json` | config / committed pin data | file-I/O (read-only at gate time) | `tests/architecture/gate-targets.ts` (`UNOWNED_EXPORT_CENSUS`, lines 536-565) | role-match (the pin is JSON, the analog is `.ts` — deliberate, per `D-08-06`) |
| pin loader + comparison layer (`loadCoveragePin` / `assertPinnedReadings`, in `scripts/test-coverage-direct.mjs` or a sibling `.mjs`) | utility + gate assertion | transform (pure) + file-I/O (thin) | `tests/architecture/unowned-exports-census.test.ts` (`keysOf`, `describeCensusDrift`, lines 131-172) and `assertReportComplete` in `scripts/test-coverage-direct.mjs:516` | exact |
| `RemovalOps` interface + `createRemovalOps` factory (in `extensions/pi-claude-marketplace/shared/fs-utils.ts`, per research's recommendation) | service port (interface + production factory) | file-I/O | `CredentialOps` / `createCredentialOps` (`platform/git-credential.ts:59`, `:297`) and `GitOps` / `DEFAULT_GIT_OPS` (`orchestrators/marketplace/shared.ts:113`, `:153`) | exact |
| `createRemovalOpsFake` (reusable test double, beside its consumers under `tests/`) | test support | file-I/O (in-memory) | `tests/platform/credential-ops-fake.ts` (closest — smallest of the three) and `tests/platform/git-ops-fake.ts` | exact |

### Modified files

| Modified file | Role | Data flow | Pattern constraint / analog |
|---|---|---|---|
| `scripts/test-coverage-direct.report.mjs` | build tooling (reporter) | batch | keep `map((x) => f(x))` wrapper form already used at `test-coverage-direct.mjs:589`; `verdictFor` delegates to a new exported `shortfallReadingOf` |
| `scripts/test-coverage-direct.mjs` | build tooling (gate) | batch | comparison goes in the module-private arms `runAllPairs` (588) / `runChangedPairs` (644); `assertCompleteCoverage` (456) stays pure |
| `scripts/test-coverage-direct.negative.mjs` | negative control harness | transform | its own `assertReportComplete` group (lines 221-300) is the case shape |
| `extensions/pi-claude-marketplace/edge/args.ts` | edge arg parser | transform | research §"1-3" quotes before/after verbatim |
| `extensions/pi-claude-marketplace/edge/handlers/shared.ts` | edge helper | transform | same; keep the `skipValue` lookahead |
| `extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts` | edge handler | request-response | same (third guard, `D-08-A03`) |
| `extensions/pi-claude-marketplace/shared/fs-utils.ts` | shared leaf utility | file-I/O | declares the port; `cleanupStaging` (40) and `rollbackReplacementCommon` (186) gain `ops` |
| `bridges/{skills,commands,agents}/stage.ts` | bridge stage/commit | file-I/O | 7 signatures each gain `ops`; parameter-order rule below |
| `orchestrators/plugin/{install-outcome,update-swap,reinstall-replace,clone-cache}.ts`, `orchestrators/marketplace/add.ts` | orchestrator composition roots | file-I/O | construct the real ops; `gitOps` threading precedent, minus the `?? DEFAULT` default |
| `tests/bridges/{skills,commands,agents}/stage.test.ts` | owner tests | file-I/O | 191 mechanical `TS2554` edits; the G1 cases convert to the fake |
| `tests/shared/fs-utils.test.ts` | owner test | file-I/O | `rm`/`rename` mocks (64, 76, 325, 329, 414, 429) convert; `lstat`/`stat`/`readdir` (134, 220, 602, 690) stay |
| `tests/bridges/hooks/event-router.test.ts` | owner test | event-driven | its own case at line 1797 is the in-file precedent |
| `tests/orchestrators/plugin/update-preflight.test.ts` | owner test | request-response | two cases feeding real `PreparedPluginUpdate` values |
| `tests/orchestrators/plugin/install-outcome.test.ts` | owner test | CRUD/ledger | relocate coverage from `install-flow.test.ts` |
| `.github/workflows/ci.yml` | CI config | — | the four existing jobs (58-122) + `fetch-depth: 0` from `lint.yml:43-50` |
| `.pre-commit-config.yaml` | hook config | — | the four `npm-*` hooks (102-125); the dash hook (51-56) |
| `CONTRIBUTING.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `scripts/revalidation.mjs` | docs / requirement record | — | no code analog; `RVAL-04` coordinated rewrite, names modules not counts |

## Pattern Assignments

### `scripts/test-coverage-direct.pin.json` (new — committed pin data)

**Analog:** `tests/architecture/gate-targets.ts:536-565` (`UNOWNED_EXPORT_CENSUS`) and
the header of `tests/architecture/unowned-exports-census.test.ts:1-31`.

JSON cannot carry a comment, so the "what a pin is and is not" paragraph must live
in the header of the **module that reads the pin** (the loader/comparison layer) and
be cross-referenced from the pin's own `"$comment"`-style field if one is used.
This is the text to match (`tests/architecture/gate-targets.ts:536-547`, verbatim):

```ts
/**
 * D-07-19 / GGAT-04: every export the repository publishes that no production
 * consumer reads, keyed by the file that publishes it.
 *
 * THIS IS A MEASUREMENT, NOT AN ALLOW-LIST. Nothing here is approved, accepted,
 * or waived. Each entry is a fact about the tree as it stands, and the gate that
 * reads it (`unowned-exports-census.test.ts`) re-measures the same question and
 * compares for EXACT equality -- so an addition fails, a removal fails, and a
 * one-in-one-out swap fails. An allow-list forgives its named entries silently
 * and forever; a pinned set forces whoever changes the export surface of the
 * tree to change this record in the same commit and say why.
 */
```

And from the gate's own header (`unowned-exports-census.test.ts:6-15`), the
two-part WHAT IT IS / WHAT IT IS NOT structure the new header must reproduce:

```ts
/**
 * WHAT THIS PIN IS. `UNOWNED_EXPORT_CENSUS` (`gate-targets.ts`) is the complete
 * measured set of exports whose only readers are tests. This gate re-measures it
 * with the repository's own analyzer and asserts EXACT equality.
 *
 * WHAT THIS PIN IS NOT. It is not an allow-list, and nothing in it is forgiven.
 * An allow-list names entries it will keep excusing, silently and forever; this
 * set fails on an ADDITION, fails on a REMOVAL, and fails on a SWAP -- so any
 * change to the export surface of the tree has to be written down in the same
 * commit that causes it. [...] Both directions are proved by planting them, not assumed.
 */
```

**Sort-order-is-part-of-the-pin clause to copy** (`gate-targets.ts:556-558`):

```ts
 * Each file's export names are sorted, and that order is part of the pin: the
 * gate sorts what it measures the same way, so a reordering can never be
 * mistaken for a change and a change can never hide inside a reordering.
```

Row shape is fixed by `D-08-07` as amended by `D-08-A05` (`reasons: string[]`);
research §"Row shape" carries the literal JSON.

---

### Pin loader + comparison layer (new)

**Analogs:** `tests/architecture/unowned-exports-census.test.ts:131-172` for the
bidirectional diff and the failure message; `scripts/test-coverage-direct.mjs:516`
(`assertReportComplete`) for the `.mjs` throw-with-a-named-subject style.

**Bidirectional diff pattern** (`unowned-exports-census.test.ts:131-157`):

```ts
/** `path#exportName` for every member, so two censuses can be differenced. */
function keysOf(census: Readonly<Record<string, readonly string[]>>): Set<string> { ... }

/** Name what drifted in each direction, so a failure reads as a diff. */
function describeCensusDrift(measured: Census): string {
  const pinnedKeys = keysOf(UNOWNED_EXPORT_CENSUS);
  const measuredKeys = keysOf(measured);
  const appeared = [...measuredKeys].filter((key) => !pinnedKeys.has(key));
  const vanished = [...pinnedKeys].filter((key) => !measuredKeys.has(key));

  return [
    "D-07-19: the production-unowned-export census no longer matches UNOWNED_EXPORT_CENSUS",
    `  now unowned but not pinned (${appeared.length.toString()}): ${appeared.join(", ") || "none"}`,
    `  pinned but no longer unowned (${vanished.length.toString()}): ${vanished.join(", ") || "none"}`,
    "  Update the census in tests/architecture/gate-targets.ts in this same change",
    "  and record why the tree's export surface moved. The record is a measurement,",
    "  not an allow-list: it forgives nothing, in either direction.",
  ].join("\n");
}
```

Three things to copy exactly: (1) both directions are named in one message,
(2) the message **names the file to update**, (3) the message restates
"not an allow-list" at the point of failure.

**The measured-nothing guard** (`unowned-exports-census.test.ts:163-167`) — the
coverage analogue is "an empty pin with a shortfall present must fail":

```ts
  // A run that produced nothing must not deep-equal an accidentally-empty pin
  // and report success. The tree has unowned exports; measuring none means the
  // instrument, not the tree, changed.
  assert.ok(
    keysOf(measured).size > 0,
    "GGAT-04: the analyzer reported zero unowned exports, so the census measured nothing",
  );
  assert.deepStrictEqual(measured, UNOWNED_EXPORT_CENSUS, describeCensusDrift(measured));
```

**`.mjs` refusal style to match** (`scripts/test-coverage-direct.mjs:516-546`): plain
`throw new Error(...)` naming the offending subject, one message per divergence
class, no `assert`. Examples the negative harness already pins byte-for-byte:
`Missing from the all-pair result: <path>`, `Repeated sourcePath in the all-pair
result: <path>`.

**Root-injection shape to match** (`scripts/test-coverage-direct.mjs:20, 70, 178,
221, 338, 456`): every root-aware exported function takes
`selectedProjectRoot = projectRoot` as its **last** parameter:

```js
function toProjectPath(inputPath, selectedProjectRoot = projectRoot) { ... }
export function pairForPath(inputPath, selectedProjectRoot = projectRoot) { ... }
export function assertCompleteCoverage(sourcePath, lcovText, selectedProjectRoot = projectRoot) { ... }
```

`loadCoveragePin(selectedProjectRoot = projectRoot)` fits this exactly. The pure
half, `assertPinnedReadings(observed, pinRows)`, takes no root at all.

**Purity boundary** (`D-08-19`): `assertCompleteCoverage`
(`scripts/test-coverage-direct.mjs:456-484`) formats the reading in one place and
returns/throws it; it must not learn the pin. The comparison belongs in the two
module-private arms:

```js
async function runAllPairs(reportPath) { ... }      // scripts/test-coverage-direct.mjs:588
async function runChangedPairs() { ... }            // scripts/test-coverage-direct.mjs:644
```

Note the existing `runChangedPairs` comment block (lines 639-643) as the shape for
documenting a new selection rule — it cites `D-07-13`/`D-07-14` inline.

---

### `RemovalOps` + `createRemovalOps` (new — the removal port)

**Primary analog:** `extensions/pi-claude-marketplace/platform/git-credential.ts:59-66, 297-309`
— the only `*Ops` in the tree with a real `create*` factory.

Interface shape (one doc line per verb, citing the requirement it serves):

```ts
export interface CredentialOps {
  /** AUTH-08: Return the stored credential for the host, or null on miss. */
  fill(host: string): Promise<GitCredentials | null>;
  /** AUTH-06: Persist a credential to the OS keychain via the configured helper. */
  approve(host: string, cred: GitCredentials): Promise<void>;
  /** AUTH-07: Evict a credential from the OS keychain. */
  reject(host: string, cred: GitCredentials): Promise<void>;
}
```

Factory shape (returns an object literal of thin bindings, nothing else):

```ts
export function createCredentialOps(options: CreateCredentialOpsOptions = {}): CredentialOps {
  const spawnProcess = options.spawn ?? (spawn as CredentialSpawn);
  const timeoutMs = options.timeoutMs ?? 5_000;
  const runGitCredential: RunGitCredential = (subcommand, input) =>
    gitCredentialIO(subcommand, input, spawnProcess, timeoutMs);

  return {
    fill: (host) => credentialFill(host, runGitCredential),
    approve: (host, cred) => credentialApprove(host, cred, runGitCredential),
    reject: (host, cred) => credentialReject(host, cred, runGitCredential),
  };
}
```

**Secondary analog:** `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts:113-151, 153-164`
— `GitOps` plus the bound-reference constant:

```ts
export const DEFAULT_GIT_OPS: GitOps = {
  clone: defaultGit.clone,
  fetch: defaultGit.fetch,
  forceUpdateRef: defaultGit.forceUpdateRef,
  checkout: defaultGit.checkout,
  resolveRef: defaultGit.resolveRef,
  currentBranch: defaultGit.currentBranch,
  resolveRemoteRef: defaultGit.resolveRemoteRef,
};
```

**The one deliberate deviation, and it must be documented in the port's header.**
Every existing `*Ops` is threaded as `gitOps?: GitOps` with `?? DEFAULT_GIT_OPS` at
each site (`clone-cache.ts:508`, `add.ts:537`). `D-08-12` forbids that default for
this port, so `RemovalOps` will be the only required `*Ops` in the tree. Write the
asymmetry down so a reviewer meets a decision rather than an oversight.

**Verb set** (`D-08-13`, narrowed by `D-08-A08`): `rm` and `rename` only.
`fs-utils.ts`'s existing header (lines 1-19) is a numbered "N helpers" list; extend
that list and add the `removeOrphanIfPresent` exception (`fs-utils.ts:107-122` calls
`fs.rm` twice and stays unported) and the `fs.mkdir` at line 206 staying direct.

**Consumers the parameter threads to** (current signatures, all without `ops`):

```ts
// shared/fs-utils.ts:40
export async function cleanupStaging(dir: string, label: string): Promise<string | undefined>
// shared/fs-utils.ts:186
export async function rollbackReplacementCommon(
  input: RollbackReplacementInput,
): Promise<readonly string[]>
```

`rollbackReplacementCommon` takes one input object already, so `ops` becomes a
required member of `RollbackReplacementInput` — which is also why five
`satisfies RollbackReplacementInput` literals in the tests raise `TS1360`.

**Parameter ordering — the local convention that constrains this.** The bridges'
current entry points are uniformly `(prepared)` or `(input)` single-parameter, with
one exception:

```ts
// extensions/pi-claude-marketplace/bridges/agents/stage.ts:434-437
export async function replacePreparedAgents(
  prepared: PreparedAgentsStaging,
  options?: ReplacePreparedAgentsOptions,
): Promise<AgentsReplacement> {
```

Appending a required `ops` after `options?` is `TS1016`. Two house-consistent exits:
put `ops` **first** on all 21 signatures (uniform, and matches `cleanupStaging`'s
`(ops, dir, label)` reading), or carry it on the options/input object the way
`RollbackReplacementInput` and `AddMarketplaceOptions` already carry collaborators.
Do not mix the two across the 21 signatures.

Contrast with the single-parameter siblings that take `ops` wherever it goes:

```ts
// extensions/pi-claude-marketplace/bridges/skills/stage.ts:162, 317, 392, 462, 478
export async function prepareStageSkills(input: StageSkillsInput): Promise<PreparedSkillsStaging>
export async function commitPreparedSkills(prepared: PreparedSkillsStaging): Promise<string | undefined>
export async function replacePreparedSkills(prepared: PreparedSkillsStaging): Promise<SkillsReplacement>
export async function rollbackSkillsReplacement(replacement: SkillsReplacement): Promise<readonly string[]>
export async function finalizeSkillsReplacement(replacement: SkillsReplacement): Promise<readonly string[]>
```

---

### `createRemovalOpsFake` (new — reusable test double)

**Analog:** `tests/platform/credential-ops-fake.ts:1-22` (closest in size) and
`tests/platform/git-ops-fake.ts:1-98`.

**The `import type`-only discipline** (`tests/platform/credential-ops-fake.ts:1-2`) —
a fake pulls **contracts only**, never production runtime code:

```ts
import type { CredentialOps } from "../../extensions/pi-claude-marketplace/platform/git-credential.ts";
import type { GitCredentials } from "../../extensions/pi-claude-marketplace/platform/git.ts";
```

`tests/platform/git-ops-fake.ts:1-6` does the same, with `node:fs/promises` as the
only value import.

**The four-interface shape** (`credential-ops-fake.ts:4-22`): an options type with an
explicit `boundary` discriminant, a per-verb call log, a state view, and a bundle:

```ts
export interface CredentialOpsFakeOptions {
  readonly boundary: "memory";
  readonly credentials?: ReadonlyArray<readonly [host: string, credential: GitCredentials]>;
  readonly fillError?: Error;
  readonly approveError?: Error;
  readonly rejectError?: Error;
}

export interface CredentialOpsFakeCalls {
  readonly fill: Array<{ readonly host: string }>;
  readonly approve: Array<{ readonly host: string; readonly credential: GitCredentials }>;
  readonly reject: Array<{ readonly host: string; readonly credential: GitCredentials }>;
}

export interface CredentialOpsFake {
  readonly credentialOps: CredentialOps;
  readonly calls: CredentialOpsFakeCalls;
  storedCredential(host: string): GitCredentials | null;
}
```

The `<verb>Error?: Error` members are exactly the G1 fault-injection seam: a
`rmError` keyed by target path is how "one `cleanupStaging` call fails while its
siblings succeed" becomes expressible.

**The explicit boundary refusal** (`tests/platform/git-ops-fake.ts:100-107`):

```ts
export function createGitOpsFake(options: GitOpsFakeOptions): GitOpsFake {
  if (options.boundary !== "memory") {
    throw new Error("createGitOpsFake requires the explicit memory boundary");
  }
```

**Where the fake lives, and what it must NOT get.** Research settles this: the
structural-supplement exemption in `scripts/test-coverage-direct.mjs`
(`isStructuralSupplement`) is scoped to `tests/(domain|platform)/<name>-fake.test.ts`.
A `tests/shared/removal-ops-fake.ts` needs no pair (not a `.test.ts`), but a
`tests/shared/removal-ops-fake.test.ts` would **not** be exempt and would demand a
production module that does not exist. Give the fake no `-fake.test.ts`.
Declaring `RemovalOps` inside `fs-utils.ts` rather than a new `shared/removal-ops.ts`
also avoids creating a new source-test pair that must itself read complete.

---

### The four-to-five new negative-control cases (`scripts/test-coverage-direct.negative.mjs`)

**Analog: the file's own `assertReportComplete` group**, lines 221-300 — one shared
literal, a `doesNotThrow` control first, then one `assert.throws` per divergence
class with the exact message:

```js
  // The all-pair completeness assertion. These records are string pairs only -- the assertion never
  // reads the disk -- so the fixture names deliberately do not exist in the tree.
  const enumeratedModules = [
    "extensions/pi-claude-marketplace/domain/alpha.ts",
    ...
  ];

  // The passing state comes first and is not decoration: without it the three refusals below could
  // all be firing on a malformed record list rather than on the property each one claims.
  assert.doesNotThrow(() => assertReportComplete(completeRecords, enumeratedModules));

  // A run that quietly visited one row fewer. Whole-value comparison: the verdict names the module.
  assert.throws(
    () => assertReportComplete([completeRecords[0], completeRecords[2]], enumeratedModules),
    {
      message: "Missing from the all-pair result: extensions/pi-claude-marketplace/domain/beta.ts",
    },
  );
```

Three conventions to copy: (1) the control comes **first** and its comment says why
it is not decoration; (2) each refusal carries a comment naming the state it plants
and **why no other check could refuse it** ("without this state the count check
would ship unplanted"); (3) `{ message: "..." }` whole-string matching where the
message is fixed, `/regex/` only where a count varies.

**The shared-setup extraction `duplicates.threshold: 3` forces.** The existing group
is six near-identical `assert.throws` blocks over **one** `completeRecords` literal —
that is the pattern: vary the argument, never re-arrange the fixture. Research
supplies the four acts over one `pinnedRow` literal. What to avoid is four
`mkdtemp` + `writeFile` planted-pin trees; the `loadCoveragePin` / `assertPinnedReadings`
split makes them unnecessary, and only the one I/O case reuses the existing
`fixtureRoot` + `writeFile` already in scope.

**Fault-injection / root-injection helpers already in the file, reuse not re-create**
(`test-coverage-direct.negative.mjs:33-54, 57-73` and the module-private
`buildFixtureRepository`, `cloneShallow`, `completeCounts`, `shortfallCounts`):

```js
/** The absolute path a real coverage run would write for an in-repo module. */
function inRepo(relativePath) { return path.join(projectRoot, relativePath); }

function lcovRecord(recordSourcePath, counts) { ... }

// Every fixture git call is checked, because a fixture that failed to build would otherwise plant a
// state nobody asked for and the assertion below it would pass or fail for the wrong reason.
function fixtureGit(cwd, args) { ... }
```

Note `08-CONTEXT.md`'s "already exports the harness shape" is inaccurate — these are
module-private. A new case lives **inside** this file; it does not import from it.

**Command-driven refusals** (lines 199-219) are the pattern for anything no exported
function can reach — `spawnSync(process.execPath, [gatePath, arg])` then
`assert.notEqual(run.status, 0)` + `assert.match(run.stderr, /.../)`.

**Sibling shapes, for the top-of-file scaffold:**
`scripts/check-corresponding-tests.negative.mjs:1-20` (single `mkdtemp` root,
derived path constants, fixture bodies as template literals) and
`scripts/revalidation.negative.mjs`. All three are plain top-level-`await` ESM
scripts of sequential `assert` calls wrapped in one `try { … } finally { await rm(fixtureRoot, …) }`,
**not** `node:test` files.

**The `D-08-A09` reporter case** goes in the same file: it already imports
`verdictFor` from `scripts/test-coverage-direct.report.mjs:41`, so planting
`pairForPath(p, 0)` (the bare-`map`-callback arity bug) and asserting refusal needs
no new import.

---

### The new CI job and pre-commit hook

**CI analog:** the four existing jobs, `.github/workflows/ci.yml:59-122`. The step
order is fixed and uniform — Checkout, Setup Node 24, Install dependencies, run:

```yaml
  integration-tests:
    name: integration tests (Node 24)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout
        uses: actions/checkout@v7

      - name: Setup Node 24
        uses: actions/setup-node@v7
        with:
          node-version: "24"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run integration tests
        run: npm run test:integration
```

**`fetch-depth: 0` precedent** (`.github/workflows/lint.yml:43-50`):

```yaml
  fallow-audit:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - name: Checkout
        uses: actions/checkout@v7
        with:
          fetch-depth: 0
```

House habit worth matching: `ci.yml` carries long inline comments justifying
non-obvious configuration (the `paths-ignore` denylist rationale at lines 13-21, the
D-01 single-Node block at lines 45-56). The `fetch-depth: 0` line should carry the
`D-08-15` reason inline, as research's block already does. Research §"The job block"
has the literal job, including the `tee`/`pipefail` hazard (Pitfall 5).

**Pre-commit analog:** the four `npm-*` local hooks, `.pre-commit-config.yaml:100-125`:

```yaml
  - repo: local
    hooks:
      - id: npm-fallow
        name: npm fallow
        entry: npm run fallow
        language: system
        pass_filenames: false
        files: '^(\.fallowrc\.json|tsconfig\.json|eslint\.config\.js|(extensions|tests)/.*\.(ts|mjs)|scripts/.*\.mjs|package(-lock)?\.json)$'
```

Every one of the four: `id`, `name`, `entry: npm run <script>`, `language: system`,
`pass_filenames: false`, single-quoted anchored `files:` regex. The siblings use the
looser `(extensions|tests)/.*\.ts`; research's narrower regex is closer to what the
gate maps and is equally valid here.

**`D-08-20` dash-hook analog — the comment-above-the-exclusion pattern**
(`.pre-commit-config.yaml:51-56`):

```yaml
      # `scripts/revalidation.mjs` both matches and emits the em-dash that
      # `.planning/` documents carry, and `.planning/` is excluded here, so
      # rewriting its dash literals to `--` breaks the planning-contract
      # parser (its RVAL-04 record scan stops matching every row).
      - id: fix-unicode-dashes
        exclude: ^(\.planning/|scripts/revalidation\.mjs$)
```

The existing comment explains only `scripts/revalidation.mjs`; widening the
exclusion without widening the comment leaves a reader with half the reason.
Research §"the `D-08-20` em-dash fix" has both the widened regex and the widened
comment.

---

### The G1 leak-message tests (`tests/bridges/{skills,commands,agents}/stage.test.ts`)

**Analog: the case these tests will become** — `tests/bridges/skills/stage.test.ts:1017-1088`,
"returns the complete cleanup leak after a successful rename". Its scenario
construction is the shape the new cleanup-failure cases must match; only the fault
seam changes.

Scenario construction (`tests/bridges/skills/stage.test.ts:26-45`) — one helper, one
`mkdtemp` per case, registered for teardown with `t.after`:

```ts
async function allocateCasePaths(t: TestContext, prefix: string): Promise<{...}> {
  const scopeRoot = await mkdtemp(path.join(tmpdir(), prefix));
  t.after(() => rm(scopeRoot, { recursive: true, force: true, maxRetries: 3 }));
  const locations = locationsFor("project", scopeRoot);

  return { scopeRoot, pluginRoot: path.join(scopeRoot, "plugin"), pluginDataDir: path.join(scopeRoot, "plugin-data"), locations };
}
```

Then, per case: a `prefix`-named allocation, a real on-disk skill fixture
(`mkdir` + `writeFile` of `SKILL.md`), a `satisfies ResolvedPluginInstallable`
literal, `prepareStage*`, `assert.strictEqual(prepared.kind, "staged")`, an
`expectedLeak` string built from `prepared.stagingRoot`, then the
`// arrange` / `// act` / `// assert` three-block body. Keep all of that.

**What the port replaces — the builtin surgery, lines 1051-1071 plus the file's
`createRequire` / `syncBuiltinESMExports` scaffold at lines 1-4 and 22-24:**

```ts
const originalRm = filesystemPromises.rm.bind(filesystemPromises);
const cleanupError = Object.assign(new Error("staging cleanup denied"), { code: "EACCES" });
const removal = t.mock.method(
  filesystemPromises,
  "rm",
  async (target, options?) => {
    if (String(target) === prepared.stagingRoot) { throw cleanupError; }
    await originalRm(target, options);
  },
);
t.after(() => { removal.mock.restore(); syncBuiltinESMExports(); });
syncBuiltinESMExports();
```

The `if (String(target) === prepared.stagingRoot) throw` / else-delegate structure is
precisely what `createRemovalOpsFake`'s per-path error option must express; the
assertions below it (`assert.strictEqual(leak, expectedLeak)`, the target-bytes read,
`assert.strictEqual((await stat(prepared.stagingRoot)).isDirectory(), true)`) survive
the conversion unchanged. The *interleaved* ordering and leaked-residue partition G1
wants are new assertions on top of this same scenario, reached by passing the fake
into `commitPreparedSkills` / `prepareStageSkills` rather than by patching a builtin.

`tests/shared/fs-utils.test.ts` mock inventory, for the `D-08-14` split: convert
lines 64, 76 (`rm`), 325, 329 (`rm`+`rename`), 414 (`rm`), 429 (`rename`); leave
lines 134, 690 (`lstat`), 220 (`stat`), 602 (`readdir`).

---

### `bridges/hooks/event-router.ts` coverage (`tests/bridges/hooks/event-router.test.ts`)

**Analog in the same file:** line 1797, "runtime hydration stops before mirroring when
registration advances its generation" — a deferred `loadState` plus a concurrent
`registerHooksBridge` reaching the same generation guard at line 699. Copy that
shape, not research's counted `callIndex` decorator (Pitfall 8: the index couples to
`await` ordering). The injected collaborator is `HooksRuntime`
(`bridges/hooks/runtime.ts:52-54`), entered through `createHooksHydration(runtime, reader)` /
`registerHooksBridge(pi, opts)` — no builtin, no `!`, no `as`.

---

### `orchestrators/plugin/update-preflight.ts` coverage

No new pattern. `isUpdatePreflightOutcome` is exported, pure and synchronous; the
owner test already produces real `PreparedPluginUpdate` values via
`preparePluginUpdate`, so two cases feed both arms with existing fixtures. `as never`
is unavailable and unnecessary.

## Shared Patterns

### "A gate wants a test that plants the violation"

**Source:** `.planning/codebase/CONVENTIONS.md` §"Fallow", and the worked pair
`scripts/test-coverage-direct.negative.mjs` + `tests/architecture/unowned-exports-census.test.ts`.
**Apply to:** the pin comparison, the reporter repair, the CI base assertion.

Corollaries this phase must honour:
- A passing control precedes every refusal, so the refusals cannot all be firing on
  a malformed fixture.
- A refusal's comment says why **no other check** could have produced it.
- The CI job asserts the base it printed (`grep -qx 'Changed-pair base: origin/main'`)
  rather than trusting the checkout — `runChangedPairs` writes that line at
  `scripts/test-coverage-direct.mjs:653`.

### Injected collaborator, never a module-global seam

**Source:** `.planning/codebase/CONVENTIONS.md` §"Dependency injection over test-only
seams"; `platform/git-credential.ts:59,297`; `orchestrators/marketplace/shared.ts:113,153`;
`tests/platform/{git,credential}-ops-fake.ts`.
**Apply to:** the removal port and all 21 signatures + 42 call sites.

- Interface named `<Noun>Ops`, factory `create<Noun>Ops`, reusable double
  `create<Noun>OpsFake` — `CONVENTIONS.md` §"Functions" makes this explicit
  ("Local configurable doubles use production-role factory names… reusable
  concern-owned abstractions retain explicit `create*Fake` names").
- One doc line per interface member, citing the requirement or decision it serves.
- Fakes import **types only** from production.
- `MF-DEC-07` / `D-05-01`: no test-only export, no dead default, no `__deps` bag, no
  ignore pragma.

### Errors and refusal messages

**Source:** `.planning/codebase/CONVENTIONS.md` §"Error Handling"; `shared/errors.ts`.
**Apply to:** any new production error (there should be none — the port returns leak
strings, it does not throw) and to gate refusals.

In `extensions/`: typed class, `this.name` set, readonly structured fields, a doc
comment citing the decision id. In `scripts/*.mjs`: plain `Error` whose message names
the subject and the fix, byte-stable enough for the negative harness to pin.

### Comment policy

**Source:** `.planning/codebase/CONVENTIONS.md` §"Comments"; `.claude/rules/typescript-comments.md`.
**Apply to:** every file this phase touches.

Cite durable ids (`RCOV-01`, `D-08-11`, `BC-019`, `NFR-10`) — never `Phase NN`,
`Plan NN`, `Wave N`, `Pitfall N`. The pin's header, the port's header, the
`fetch-depth: 0` line, and the widened dash exclusion all need a "why" comment; the
analogs quoted above show the density the tree uses.

### Complexity ceilings

Both apply independently to every new helper: ESLint `sonarjs/cognitive-complexity: 15`
and fallow `health.maxCognitive: 15` / `maxCyclomatic: 20` / `maxUnitSize: 60`. Research
measured `fallow health` clean on the fully ported tree (0 above threshold); the
untested surface is the **new** pin loader and comparison layer. Keeping
`loadCoveragePin` (I/O) separate from `assertPinnedReadings` (pure) serves this as
well as it serves `D-08-18`.

### Requirement-record coordination (`RVAL-04`)

`CONTRIBUTING.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` and
`scripts/revalidation.mjs` carry the same claims and are rewritten in one change.
Per `D-08-A02` / Pitfall 9: **name the modules and their readings, never a bare
count.** `scripts/revalidation.mjs` is also the file whose em-dash bytes
`tests/architecture/revalidation.test.ts` pins, so a prose edit there can break the
dash hook and the pinning test together.

## No Analog Found

| File | Role | Data flow | Reason |
|---|---|---|---|
| `scripts/test-coverage-direct.pin.json` (the data file itself) | config data | file-I/O | No committed `.json` pin exists in the tree. `tests/architecture/gate-targets.ts` is the structural sibling but is `.ts`, which is exactly why `D-08-06` chose JSON. Header text and sort-order discipline transfer; file format does not. The nearest format precedents are `.fallowrc.json` and `sonar-project.properties` — configuration, not a measured pin. `.planning/WINDOWS.md` entry 30 records a prior, reverted implementation of this same self-expiry mechanism and is worth reading before rebuilding it. |

## Metadata

**Analog search scope:** `scripts/`, `tests/architecture/`, `tests/platform/`,
`tests/bridges/`, `tests/shared/`, `extensions/pi-claude-marketplace/{shared,platform,bridges,orchestrators,edge}/`,
`.github/workflows/`, `.pre-commit-config.yaml`
**Files read:** 18
**Tracked-source gate:** every analog verified with `git ls-files` (31/31 tracked)
**Pattern extraction date:** 2026-09-10
