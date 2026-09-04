---
phase: 117-extension-entry-and-final-gate
reviewed: 2026-09-03T22:45:00Z
depth: standard
files_reviewed: 61
files_reviewed_list:
  - package.json
  - scripts/check-corresponding-tests.mjs
  - scripts/check-corresponding-tests.negative.mjs
  - scripts/test-coverage-direct.mjs
  - scripts/test-coverage-direct.negative.mjs
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/cross-surface-reason-parity.test.ts
  - tests/architecture/import-boundaries.test.ts
  - tests/architecture/integration-materialization-gate.test.ts
  - tests/architecture/manifest-lookup-drift.test.ts
  - tests/architecture/no-lifecycle-default-enabled-read.test.ts
  - tests/architecture/no-orchestrator-network.test.ts
  - tests/architecture/source-scan.test.ts
  - tests/architecture/source-scan.ts
  - tests/architecture/unit-suite-glob-completeness.test.ts
  - tests/bridges/agents/marker.test.ts
  - tests/bridges/agents/unstage.test.ts
  - tests/bridges/mcp/parse.test.ts
  - tests/bridges/mcp/stage.test.ts
  - tests/bridges/mcp/unstage.test.ts
  - tests/domain/github-auth.test.ts
  - tests/edge/handlers/marketplace-seed.ts
  - tests/edge/handlers/marketplace/add.test.ts
  - tests/edge/handlers/marketplace/autoupdate.test.ts
  - tests/edge/handlers/marketplace/info.test.ts
  - tests/edge/handlers/marketplace/list.test.ts
  - tests/edge/handlers/marketplace/remove.test.ts
  - tests/edge/handlers/marketplace/shared.test.ts
  - tests/edge/handlers/marketplace/update.test.ts
  - tests/edge/handlers/plugin/bootstrap.test.ts
  - tests/edge/handlers/plugin/enable-disable.test.ts
  - tests/edge/handlers/plugin/fetch.test.ts
  - tests/edge/handlers/plugin/import.test.ts
  - tests/edge/handlers/plugin/info.test.ts
  - tests/edge/handlers/plugin/install.test.ts
  - tests/edge/handlers/plugin/list.test.ts
  - tests/edge/handlers/plugin/pending.test.ts
  - tests/edge/handlers/plugin/reinstall.test.ts
  - tests/edge/handlers/plugin/shared.test.ts
  - tests/edge/handlers/plugin/uninstall.test.ts
  - tests/edge/handlers/plugin/update.test.ts
  - tests/edge/handlers/shared.test.ts
  - tests/edge/notification-boundary.ts
  - tests/edge/register.test.ts
  - tests/edge/router.test.ts
  - tests/index.test.ts
  - tests/integration/concurrent-install-child.ts
  - tests/integration/ipc-child.ts
  - tests/integration/load-reconcile-race-child.ts
  - tests/orchestrators/import/execute.test.ts
  - tests/orchestrators/import/settings.test.ts
  - tests/orchestrators/marketplace/shared.test.ts
  - tests/orchestrators/plugin/bootstrap.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install.test.ts
  - tests/orchestrators/plugin/list.test.ts
  - tests/orchestrators/plugin/reinstall.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/orchestrators/reconcile/pending.test.ts
  - tests/persistence/config-io.test.ts
  - tests/persistence/state-io.test.ts
findings:
  critical: 2
  warning: 8
  info: 5
  total: 15
status: issues_found
---

# Phase 117: Code Review Report

**Reviewed:** 2026-09-03T22:45:00Z
**Depth:** standard
**Files Reviewed:** 61
**Status:** issues_found

## Summary

No production code changed; the diff is test code, test-support modules, two gate
scripts and `package.json`. The relocation work (`source-scan.ts`,
`notification-boundary.ts`, `marketplace-seed.ts`, `ipc-child.ts`) is clean —
import-specifier rewrites only, and the rename-aware diff confirms no body drift.
The folded evidence is largely intact: the deleted `cascade.test.ts` idempotence
case is genuinely covered by the `removeHookConfig` owner test
(`tests/bridges/hooks/stage.test.ts:670`), and the `device-flow-prompt` fold into
`tests/domain/github-auth.test.ts` carries both of the deleted cases' claims.

The problems are concentrated in the two things this phase actually authored: the
new entry-point owner suite and the gate scripts. Two of the twelve cases in
`tests/index.test.ts` are provably inert — I disabled their fault injection
entirely and the file still reported 12/12 pass. And the five gate scripts that
carry this milestone's central invariants are wired into nothing: not
`npm run check`, not CI, not `.pre-commit-config.yaml`. Two of them are not even
prettier-clean, because `format:check`'s glob does not reach `.mjs`.

Weighted per the phase's own standard — "a gate wants a test that plants the
violation" — the headline finding is that the phase named "final gate" ships
gates nobody runs, plus two cases that cannot fail.

## Narrative Findings (AI reviewer)

No `<structural_findings>` block was supplied for this review, so every finding
below is from direct reading and from mutation experiments run against the
working tree (all mutations reverted; `git status` on `tests/` is clean).

## Critical Issues

### CR-01: Two NFR-2 cases in the new entry-point suite pass with their fault injection removed

**File:** `tests/index.test.ts:575-603` (helper at `tests/index.test.ts:347-362`)

**Issue:** `eventRefusingCwdRead(event, nth)` throws on the *nth* read of
`event.cwd`. Two cases use it:

- line 579, `nth = 1` — "still answers when the deferred project-scope hydrate fails"
- line 594, `nth = 3` — "still answers when the plugin PATH recompute fails"

Both cases assert exactly `discovered === EMPTY_DISCOVERY` and
`notifications === []`. That is byte-for-byte the same pair of assertions the
pristine-workspace case at line 515 already makes against an unmodified event.
Nothing in either case ties the observed outcome to the refusal having happened,
and nothing distinguishes case `nth = 1` from case `nth = 3`.

I verified this rather than inferring it. Changing both ordinals to `999` — so
the `Proxy` never throws and the handler runs an ordinary clean discover — leaves
the suite at **12 pass / 0 fail**:

```
✔ still answers when the deferred project-scope hydrate fails (NFR-2) (9.03ms)
✔ still answers when the plugin PATH recompute fails (NFR-2) (8.66ms)
ℹ pass 12  ℹ fail 0
```

So these two cases cannot fail on the loss of the NFR-2 containment they claim to
prove. They also cannot fail on the loss of the *stage* they name: the ordinal `3`
is a raw coupling to how many times the discover handler happens to read
`event.cwd` today. Any refactor that adds or removes one read silently retargets
the injection at a different stage — or past the end of all reads — and the case
stays green while its title becomes false.

**Fix:** Make the refusal observable in the assertion. The handler must swallow the
throw *and* leave a trace the case can pin — otherwise there is nothing to assert.
Two workable shapes:

```ts
// 1. Prove the refusal fired at all: count the reads the Proxy served and
//    assert the injection was actually reached.
function eventRefusingCwdRead(event: ResourcesDiscoverEvent, nth: number) {
  let reads = 0;
  let fired = false;
  const proxy = new Proxy(event, {
    get(target, property, receiver): unknown {
      if (property === "cwd") {
        reads += 1;
        if (reads === nth) {
          fired = true;
          throw new Error(`working directory read ${nth} refused`);
        }
      }
      return Reflect.get(target, property, receiver);
    },
  });
  return { event: proxy, didRefuse: () => fired, readCount: () => reads };
}

// in each case, after the act:
assert.equal(refusal.didRefuse(), true, "the injected refusal never fired");
```

```ts
// 2. Separate the two cases by their *side effects*, not just their return value.
//    The hydrate-refused case and the recompute-refused case must differ in
//    something -- e.g. PI_CLAUDE_MARKETPLACE_PATH is set on one path and not the
//    other -- or the pair is one case written twice.
```

Additionally, replace the bare ordinal with a named constant that states what read
it targets, and assert the total read count so a shifted stage fails loudly:

```ts
const CWD_READ_DEFERRED_HYDRATE = 1;
const CWD_READ_PLUGIN_PATH_RECOMPUTE = 3;
// ...
assert.equal(refusal.readCount(), CWD_READ_PLUGIN_PATH_RECOMPUTE);
```

---

### CR-02: The five gate scripts are wired into no automated run — `check`, CI and pre-commit all skip them

**File:** `package.json:75-96`

**Issue:** This phase's deliverable is "the final repository gates." The scripts
exist:

```
"test:corresponding":              "node scripts/check-corresponding-tests.mjs",
"test:corresponding:negative":     "node scripts/check-corresponding-tests.negative.mjs",
"test:coverage:direct":            "node scripts/test-coverage-direct.mjs",
"test:coverage:direct:all":        "node scripts/test-coverage-direct.mjs --all",
"test:coverage:direct:negative":   "node scripts/test-coverage-direct.negative.mjs",
```

Nothing invokes any of them. `check` (line 76) is
`typecheck && lint && fallow && format:check && test && test:integration`. A grep
across `.github/workflows/*.yml` and `.pre-commit-config.yaml` for
`test:corresponding`, `test:coverage:direct`, `check-corresponding` and
`test-coverage-direct` returns matches in `package.json` only. The CI workflows
run exactly `npm run check`, `npm run test:integration`, `npm run test:e2e`,
`npm run test:e2e:nightly` and `npm run test:coverage`.

The consequence is concrete. The correspondence gate is the invariant this whole
milestone exists to establish — every production module has an owner test that
imports it. The moment someone adds `extensions/pi-claude-marketplace/foo.ts`
without `tests/foo.test.ts`, or points an owner test at a barrel instead of its
pair (the new `proxy-owned` verdict), nothing in the repository notices. The same
is true of the two negative controls, whose entire job is to prove the gates can
still fail.

This is the identical failure mode CONVENTIONS.md records for
`import-x/no-cycle`: "configured-but-inert … while a test that merely re-read the
rule config stayed green." Here the gate is not even configured into a run.

**Fix:** Put the gates in the chain that CI actually executes.

```json
"check": "npm run typecheck && npm run lint && npm run fallow && npm run format:check && npm run test:corresponding && npm run test:corresponding:negative && npm run test:coverage:direct:negative && npm test && npm run test:integration",
```

The three added scripts are fast (no test spawning; the direct-coverage negative
control forks the gate twice). `test:coverage:direct` in changed-paths mode and
`test:coverage:direct:all` are slow and should stay out of `check` — but they need
their own CI job or a documented manual cadence, or they are decoration too.
Note that `test:coverage:direct` in its default mode is currently broken on this
branch (see WR-01) and must be fixed before it can be wired in.

## Warnings

### WR-01: `npm run test:coverage:direct` (default mode) crashes on this branch

**File:** `scripts/test-coverage-direct.mjs:127-143`

**Issue:** `pairsForChangedPaths()` admits a changed path if it is under the
production root *or* is a `tests/**/*.test.ts` file, then calls `pairForPath` on
it, which throws when either pair member is missing or the path cannot be mapped.
Neither side of the filter is tight enough:

1. The production side has no `.ts` check. Any changed non-TypeScript file under
   `extensions/pi-claude-marketplace/` reaches `sourceToTest` and throws.
2. The test side has no equivalent of the correspondence gate's
   `nonCorrespondingRoots` (`scripts/check-corresponding-tests.mjs:10`), so tests
   under `architecture/`, `integration/` and `e2e/` — which by design have no
   production pair — reach `testToSource` and produce a non-existent path.

Reproduced on this branch:

```
$ node scripts/test-coverage-direct.mjs
Not a production TypeScript path: extensions/pi-claude-marketplace/orchestrators/reconcile/README.md

$ node scripts/test-coverage-direct.mjs tests/architecture/unit-suite-glob-completeness.test.ts
Missing source-test pair member: extensions/pi-claude-marketplace/architecture/unit-suite-glob-completeness.ts
```

The changed-path set on this branch contains 19 `tests/architecture/*.test.ts`
entries and 5 `tests/integration/*.test.ts` entries, every one of which is
unmappable. The failure is loud (exit 1), not silent, but the gate is unusable in
the mode a developer would reach for. `pairsForChangedPaths` predates this phase;
this phase restructured `main()` around it without fixing it.

**Fix:** Mirror the correspondence gate's exclusions.

```js
const nonCorrespondingRoots = new Set(["architecture", "e2e", "integration"]);

function isPairablePath(projectPath) {
  if (projectPath.startsWith(`${productionRoot}/`)) {
    return projectPath.endsWith(".ts");
  }

  if (!projectPath.startsWith(`${testRoot}/`) || !projectPath.endsWith(".test.ts")) {
    return false;
  }

  const firstSegment = projectPath.slice(`${testRoot}/`.length).split("/", 1)[0];
  return !nonCorrespondingRoots.has(firstSegment);
}

function pairsForChangedPaths() {
  const pairs = new Map();
  for (const projectPath of changedPaths().filter(isPairablePath)) {
    const pair = pairForPath(projectPath);
    pairs.set(pair.sourcePath, pair);
  }
  return [...pairs.values()];
}
```

---

### WR-02: `assertReportComplete` cannot fail at its only production call site

**File:** `scripts/test-coverage-direct.mjs:252-292` (call site at `:334-356`)

**Issue:** The comment at line 252 justifies the check as catching "a run that
quietly skipped one row." No such run is constructible. In `runAllPairs`:

```js
const modulePaths = productionPaths();       // unique, from readdirSync
const pairs = modulePaths.map(pairForPath);  // one pair per module, in order
for (const pair of pairs) {
  records.push(await runPair(pair));         // one record per pair, or throw
}
assertReportComplete(records, modulePaths);
```

`runPair` returns `{ sourcePath, testPath, ... }` destructured straight from its
argument, and any failure throws and aborts the loop rather than skipping. So all
four clauses are unconditionally satisfied:

- **repeated sourcePath** — `productionPaths()` de-duplicates by construction.
- **repeated testPath** — `sourceToTest` is injective.
- **round-trip** — `testToSource` and `sourceToTest` are exact inverses for every
  input, so `testToSource(sourceToTest(x)) === x` always holds.
- **missing / count** — `records.length === pairs.length === modulePaths.length`
  on every path that reaches line 356.

`scripts/test-coverage-direct.negative.mjs:128-205` does plant all five states,
but it plants them against the exported function using synthetic string records.
It proves the function's logic; it does not — and cannot — prove the function
guards anything in `runAllPairs`. The comment's claim about a quietly-skipping run
is not true of the code as written.

**Fix:** Either make the check falsifiable at its call site, or state honestly
that it is a defensive invariant rather than a gate. The falsifiable form is to
derive the record list from the report the run actually wrote, so a lost append or
a truncated file is detectable:

```js
// Read the retained report back and assert against that, not against the
// in-memory array the same loop just built.
const written =
  reportPath === undefined
    ? records
    : readFileSync(reportPath, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

assertReportComplete(written, modulePaths);
```

Failing that, reword the comment at line 252 to say what it is: a structural
invariant on the exported assertion, retained for the `--report` consumer, not a
guard over the run.

---

### WR-03: The gate scripts sit outside every quality gate the repository runs

**File:** `package.json:79-80`; `scripts/test-coverage-direct.mjs:287-291,386-389`; `scripts/test-coverage-direct.negative.mjs:133-137`

**Issue:** `scripts/*.mjs` is invisible to all three static gates:

- `format:check` is `prettier --check "**/*.{js,json,ts}"` — `.mjs` does not match.
- `lint` is `eslint extensions tests eslint.config.js` — `scripts/` is not an argument.
- `tsconfig.json` includes `extensions/**/*.ts` and `tests/**/*.ts` — no `scripts/`.

This is not theoretical. Two files this phase edited are currently unformatted:

```
$ npx prettier --check "scripts/*.mjs"
[warn] scripts/test-coverage-direct.mjs
[warn] scripts/test-coverage-direct.negative.mjs
```

The drift is three needlessly-wrapped `throw`/object literals introduced by this
phase (`test-coverage-direct.mjs:287-291` and `:386-389`,
`test-coverage-direct.negative.mjs:133-137`) — each fits in the 100-column
`printWidth` on one line. Roughly a thousand lines of gate logic is therefore
unformatted, unlinted and untypechecked, in a repository whose stated bar
(CONVENTIONS.md) is two independent complexity gates plus Prettier plus strict
type-aware ESLint.

Adding `scripts/` to `eslint` is not a one-liner — `eslint.config.js` extends
`strictTypeChecked`, and pointing it at `scripts/` today fails with
`You have used a rule which requires type information` — so the lint half needs a
config entry, not just a path argument.

**Fix:** At minimum, widen the format globs so the drift cannot recur:

```json
"format":       "prettier --write \"**/*.{js,mjs,json,ts}\"",
"format:check": "prettier --check \"**/*.{js,mjs,json,ts}\"",
```

Then run `npm run format` and commit the three re-joined statements. For lint, add
a non-type-aware flat-config block scoped to `scripts/**/*.mjs` (plain
`@eslint/js` recommended plus `globals.node`) and add `scripts` to the `lint`
argument list. If `scripts/` is deliberately outside the typed tree, say so in
`eslint.config.js` next to the ignore, the way the `tests/live-uat/` exclusion is
documented.

---

### WR-04: `assertCompleteCoverage` honors its injected project root only halfway

**File:** `scripts/test-coverage-direct.mjs:207-212` (with `:14-23`)

**Issue:** The signature is
`assertCompleteCoverage(sourcePath, lcovText, selectedProjectRoot = projectRoot)`,
but the parameter reaches only `isTypeOnlyModule`. The LCOV filter one line above
resolves record paths through `toProjectPath`, which closes over the *module-level*
`projectRoot`:

```js
const records = parseLcov(lcovText).filter(
  (record) => toProjectPath(record.get("SF")) === sourcePath,   // module-level root
);

if (records.length === 0 && isTypeOnlyModule(sourcePath, selectedProjectRoot)) {  // injected root
```

Two consequences:

1. **The seam is a trap for callers.** `test-coverage-direct.negative.mjs:23-26`
   documents having to work around it — its fixture records must carry absolute
   *in-repo* paths, not fixture-tree paths, or the assertion refuses them. A future
   caller that passes a fixture root and a matching fixture LCOV silently gets the
   `records.length === 0` arm, which is the type-only escape hatch: a wrong answer
   that looks like a pass.
2. **`toProjectPath` throws rather than skips on foreign records.** Any LCOV
   record whose `SF` resolves outside the repository — an out-of-tree peer
   dependency, a symlinked `node_modules`, a globally-resolved
   `pi-subagents` — aborts the whole gate with `Path is outside the project` instead
   of being ignored as irrelevant. The filter's job is to select one record; a
   non-matching record should be a non-match.

**Fix:** Thread the root all the way through, and make the filter total:

```js
function toProjectPathIn(selectedProjectRoot, inputPath) {
  const projectPath = path.relative(selectedProjectRoot, path.resolve(selectedProjectRoot, inputPath));
  if (projectPath.startsWith("..") || path.isAbsolute(projectPath)) {
    return undefined;                       // outside the tree: not a match, not an error
  }
  return projectPath.split(path.sep).join("/");
}

export function assertCompleteCoverage(sourcePath, lcovText, selectedProjectRoot = projectRoot) {
  const records = parseLcov(lcovText).filter(
    (record) => toProjectPathIn(selectedProjectRoot, record.get("SF")) === sourcePath,
  );
  // ...
}
```

Keep the CLI-facing `toProjectPath` (which *should* throw for a user-supplied
argument) separate from the record-filtering helper. Then simplify the negative
control's fixture records to fixture-relative paths and delete the workaround
comment at `:23-26`.

---

### WR-05: `notification-boundary.ts` documents a `toolProbes` rule its newest consumer does not follow

**File:** `tests/edge/notification-boundary.ts:60-66`; consumers at `tests/index.test.ts:555,609,637,658`

**Issue:** The shared helper's doc states the rule flatly:

> `notify()` takes one soft-dependency probe per emission and each probe reads
> `getAllTools()` twice, so a `notify()` case states `emissions * 2`

The entry-point suite — which the helper's own header at
`tests/edge/notification-boundary.ts:1-9` and `tests/index.test.ts:19-22` names as
its fifth cross-tier consumer — contradicts this at every call:

- `tests/index.test.ts:555` — `loadExtension(2, 2)`; the rule says 4.
- `tests/index.test.ts:658` — `loadExtension(0, 2)` for a case that attempts
  **three** notifications (`expectedAttempts` at `:661-670`).
- `tests/index.test.ts:609,637` — `loadExtension(0, 2)` for two-attempt cases.

I confirmed the count is exactly-checked, not merely a lower bound: changing
`loadExtension(2, 2)` to `loadExtension(2, 4)` turns exactly that one case red
(11 pass / 1 fail), so `2` is the true probe count for two emissions and the doc's
`emissions * 2` is wrong for this path.

The helper's stated reason for making the count an explicit parameter — "a wrong
default fails naming the probe instead of the mistake" — is sound. The problem is
the documented derivation rule, which a future author will apply and then "fix" by
re-fitting the number until the case goes green. At that point the count stops
being a claim about the soft-dependency probe and becomes a fudge factor, and the
IL-2 sizing proof the file exists to protect is gone.

**Fix:** Either correct the rule to cover both paths, or drop the arithmetic and
describe the count as measured:

```
 * `toolProbes` counts `pi.getAllTools()` reads, not emissions. The ratio is NOT
 * fixed: `notify()` probes once per emission and each probe reads
 * `getAllTools()` twice, but an emission routed through a caller-supplied `ui`
 * (see `tests/index.test.ts`'s `contextNotifyingThrough`) bypasses the boundary's
 * own counter while still probing. State the count the case actually observes,
 * and when it changes, find out WHY before changing the number.
```

---

### WR-06: Five EISDIR sites dropped the errno identity along with the runtime-owned wording

**Files:** `tests/persistence/config-io.test.ts:285-301`; `tests/orchestrators/import/settings.test.ts:470-515`; `tests/bridges/agents/unstage.test.ts:297-320`; `tests/orchestrators/plugin/install.test.ts:8918-8967`; `tests/orchestrators/plugin/reinstall.test.ts:5980-6026`

**Issue:** The portability fix is correct in principle — the errno `path` field and
the errno sentence are runtime-owned and were never a contract. But the two
remediation shapes are not equally strong, and the weaker one was used where more
was available.

The six *projection* sites kept `name` + `code` + `syscall` (and `errno` where it
was already pinned) and dropped only the runtime-owned field — for example
`tests/bridges/mcp/unstage.test.ts:203-220`. Those remain strong.

The five *composition* sites replaced the literal with a probe read back from the
same path:

```ts
const readFailure = await readFile(localPath, "utf8").catch(
  (error: unknown) => (error as Error).message,
);
// ...
message: `Unable to read Claude local settings file: ${readFailure}`,
```

What survives is the wrapper prefix. The failure's *identity* — that it is
`EISDIR`, `syscall: "read"` — is no longer asserted anywhere in those five cases.
If the fixture setup drifted so the path were a missing file rather than a
directory, the probe would report `ENOENT`, production would report `ENOENT`, and
all five cases would stay green while testing a different failure entirely. The
probe is not independent evidence; it is the same read, so it moves with any
change to what is on disk.

`tests/persistence/state-io.test.ts:777-795` is the model to copy: it composes the
message from `cause.message` *and* still asserts `cause.code === "EISDIR"`,
`cause.errno === -21`, `cause.syscall === "read"` as a whole value. That pins the
composition and the identity.

**Fix:** Add the identity assertion back beside the composed message. For
`config-io.test.ts`:

```ts
const readFailure = await readFile(filePath, "utf8").catch((error: unknown) => {
  const errno = error as NodeJS.ErrnoException;
  // Pin the identity here; the sentence is runtime-owned and only composed below.
  assert.deepStrictEqual(
    { code: errno.code, syscall: errno.syscall },
    { code: "EISDIR", syscall: "read" },
  );
  return errno.message;
});
```

Apply the same shape at the other four sites. This keeps the whole-value
expectation and restores the claim the literal used to carry.

---

### WR-07: The `undefined sessionManager` branch lost its test in the entry-point fold

**File:** `tests/index.test.ts:699-721`

**Issue:** The deleted `tests/shared/index-smoke.test.ts` case was titled
"WR-02 session_start swallows a throwing **or undefined** sessionManager" and
asserted both halves:

```ts
assert.doesNotThrow(() => senvHandler({}, { sessionManager: { getSessionId: () => { throw ... } } }));
// An undefined sessionManager (getSessionId deref throws) is likewise swallowed.
assert.doesNotThrow(() => senvHandler({}, {}));
```

The replacement at `tests/index.test.ts:699` keeps only the throwing half —
`contextWithSessionId(ctx, () => { throw new Error("session id refused"); })`.
Production names the dropped half explicitly:

```
extensions/pi-claude-marketplace/index.ts:145-146
  // `ctx.sessionManager.getSessionId()` is evaluated first and could throw (or
  // `ctx.sessionManager` be undefined); wrap so a throw never propagates past
```

Because both inputs land in the same `catch`, line and branch coverage are
identical — so the direct-coverage gate will keep reporting this pair green while
the second documented input goes unexercised. That is precisely the blind spot
COV-04 was written to argue about, arriving through a different door.

**Fix:** Add the missing input as a second case using the same `Proxy` helper:

```ts
function contextWithoutSessionManager(ctx: ExtensionCommandContext): ExtensionCommandContext {
  return new Proxy(ctx, {
    get(target, property, receiver): unknown {
      return property === "sessionManager" ? undefined : Reflect.get(target, property, receiver);
    },
  });
}

test("leaves the session variables alone when there is no session manager (WR-02)", async (t) => {
  await createHermeticScope(t, "session-env-absent");
  const { sessionEnv, ctx, verifyBoundary } = await loadExtension(0, 0);
  for (const key of SESSION_ENV_KEYS) {
    Reflect.deleteProperty(process.env, key);
  }

  sessionEnv({ type: "session_start", reason: "startup" }, contextWithoutSessionManager(ctx));

  assert.deepStrictEqual(SESSION_ENV_KEYS.map((key) => process.env[key]), [
    undefined, undefined, undefined,
  ]);
  verifyBoundary();
});
```

---

### WR-08: The glob-completeness gate treats every quoted substring in a script as a glob pattern

**File:** `tests/architecture/unit-suite-glob-completeness.test.ts:41-55`

**Issue:** `pathsMatchedByScript` derives the pattern list by scraping every
double-quoted substring out of the npm script string:

```ts
const patterns = [...script.matchAll(/"([^"]*)"/g)].map((quoted) => quoted[1] ?? "");
```

The doc comment states the precondition — "Both scripts quote their glob arguments
and nothing else" — but nothing enforces it. `test:coverage:unit` already carries
five non-glob arguments (`--test-reporter=lcov`,
`--test-reporter-destination=coverage/unit.lcov`, …) that happen to be unquoted
today. Quote any one of them, or add a quoted `--test-name-pattern`, and that
string enters the pattern list. `globSync` will then contribute whatever it
matches (or nothing), and the gate fails with a diff that names the test files
rather than the malformed pattern.

A second, smaller gap: the "script side" is `fs.globSync`, but the actual matcher
at runtime is `node --test`'s own glob implementation. The gate asserts that
`fs.globSync` and the directory walk agree — which is strong evidence, but it is
not a direct measurement of what `node --test` will execute.

To be clear, the gate does fire on a real violation. I planted
`tests/unreached/planted.test.ts` and both cases went red, so this is a
robustness warning, not an inert-gate finding.

**Fix:** Reject anything scraped that is not a glob, so a malformed script fails
naming itself:

```ts
const quoted = [...script.matchAll(/"([^"]*)"/g)].map((m) => m[1] ?? "");
const patterns = quoted.filter((candidate) => candidate.startsWith(`${TEST_ROOT}/`));

if (patterns.length !== quoted.length) {
  throw new Error(
    `the "${scriptName}" script quotes an argument that is not a tests/ glob: ` +
      quoted.filter((c) => !c.startsWith(`${TEST_ROOT}/`)).join(", "),
  );
}

if (patterns.length === 0) {
  throw new Error(`the "${scriptName}" script quotes no tests/ glob at all`);
}
```

## Info

### IN-01: The glob-completeness failure dumps ~300 paths instead of naming the offending one

**File:** `tests/architecture/unit-suite-glob-completeness.test.ts:79-83,93-98`

**Issue:** With a planted unreachable test file, the failure output is a full
`deepStrictEqual` array diff ending in `... 148 more items`. The one path that
differs is not visible in the terminal.

**Fix:** Diff the two sets first and assert on the difference, so the message names
the file:

```ts
const unreached = expectedPaths.filter((p) => !matchedPaths.includes(p));
const phantom = matchedPaths.filter((p) => !expectedPaths.includes(p));
assert.deepStrictEqual(
  { unreached, phantom },
  { unreached: [], phantom: [] },
  `the "${scriptName}" script no longer matches exactly the unit test files under tests/`,
);
```

---

### IN-02: `marketplace-seed.ts` swallows every read and parse error, not just a missing file

**File:** `tests/edge/handlers/marketplace-seed.ts:82-88,105-110`

**Issue:** Both seed helpers use a bare `catch { /* first marketplace in scope */ }`
around a `readFile` + `JSON.parse` pair. A malformed `state.json` or
`claude-plugins.json` written by an earlier seed call is indistinguishable from an
absent one, and the subsequent `saveState` silently discards it — which would
present as a fixture that mysteriously lost a marketplace. Relocated code, not
authored here.

**Fix:** Narrow to `ENOENT` and let anything else surface:

```ts
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
  /* first marketplace in scope */
}
```

---

### IN-03: The relocated support modules have no owner test and are invisible to the correspondence gate

**Files:** `tests/edge/notification-boundary.ts`, `tests/edge/handlers/marketplace-seed.ts`, `tests/integration/ipc-child.ts`

**Issue:** `checkCorrespondingTests` inspects production `.ts` files and test
`.test.ts` files. A non-test `.ts` module under an owned tier matches neither
scan, so these three now sit inside `tests/edge/` and `tests/integration/` with no
owner and no gate that would notice. `tests/architecture/source-scan.ts` is the
counterexample — it got `source-scan.test.ts` in this same phase — which shows the
authors knew the shape; the other three did not get the same treatment.

**Fix:** Either give each one an owner suite the way `source-scan.ts` got one, or
record in the gate script why non-test support modules are deliberately exempt so
the exemption is a decision rather than an oversight.

---

### IN-04: The entry-point network trap covers only `https.request`

**File:** `tests/index.test.ts:146-150`

**Issue:** `installNetworkTrap` replaces `https.request` alone. `http.request`,
global `fetch`/`undici`, and raw `net.connect` remain open. The file header is
honest that this is "a hermeticity device" and not a measured claim, so this is a
completeness note rather than a false assertion — but a dial-out over plain HTTP
or `fetch` from any of these twelve cases would go unnoticed.

**Fix:** Trap the other doors in the same helper:

```ts
t.mock.method(http, "request", (): never => { throw new Error("..."); });
t.mock.method(globalThis, "fetch", (): never => { throw new Error("..."); });
```

---

### IN-05: `stripComments` is a naive regex stripper

**File:** `tests/architecture/source-scan.ts:42-46`

**Issue:** The block-comment pass `/\/\*[\s\S]*?\*\//g` does not respect string or
regex literals. A source line containing `"/*"` inside a string would begin a
false comment region and delete real code up to the next `*/`, silently shrinking
what the gate inspects. The line-comment pass is anchored to `^\s*//`, so
mid-line URLs are safe. Relocated code, unchanged in substance by this phase, and
the currently-guarded files do not trip it.

**Fix:** No change needed today. If the target list grows to files that build
regex or string literals containing comment delimiters, replace the regex pass
with a `ts.createSourceFile` walk that drops trivia — the gate scripts already
depend on `typescript`.

---

_Reviewed: 2026-09-03T22:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
