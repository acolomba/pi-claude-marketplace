---
phase: 07-gate-integrity
reviewed: 2026-09-10T12:00:00Z
depth: standard
files_reviewed: 65
files_reviewed_list:
  - eslint.config.js
  - extensions/pi-claude-marketplace/domain/components/hook-events.ts
  - extensions/pi-claude-marketplace/domain/manifest.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/fetch.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-flow.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/reinstall-replace.ts
  - extensions/pi-claude-marketplace/orchestrators/reconcile/apply.ts
  - extensions/pi-claude-marketplace/shared/markers.ts
  - scripts/test-coverage-direct.mjs
  - scripts/test-coverage-direct.negative.mjs
  - tests/architecture/closed-set-enrollment.test.ts
  - tests/architecture/compat-01-no-expansion.test.ts
  - tests/architecture/config-state-write-seams.test.ts
  - tests/architecture/disabled-state-classification.test.ts
  - tests/architecture/eslint-effective-config.test.ts
  - tests/architecture/eslint-effective-config.ts
  - tests/architecture/extension-version-sync.test.ts
  - tests/architecture/gate-targets.test.ts
  - tests/architecture/gate-targets.ts
  - tests/architecture/hooks-async-rewake.test.ts
  - tests/architecture/hooks-cap-notify.test.ts
  - tests/architecture/hooks-dispatch.test.ts
  - tests/architecture/hooks-lifecycle.test.ts
  - tests/architecture/import-boundaries.test.ts
  - tests/architecture/integration-materialization-gate.test.ts
  - tests/architecture/manifest-lookup-drift.test.ts
  - tests/architecture/manifest-read-seam.test.ts
  - tests/architecture/markers-snapshot.test.ts
  - tests/architecture/no-credential-leak.test.ts
  - tests/architecture/no-hooks-strict-additional-properties.test.ts
  - tests/architecture/no-lifecycle-default-enabled-read.test.ts
  - tests/architecture/no-orchestrator-network.test.ts
  - tests/architecture/no-shell-out.test.ts
  - tests/architecture/no-split-01-cast-reads.test.ts
  - tests/architecture/no-telemetry-deps.test.ts
  - tests/architecture/no-test-only-production-surface.test.ts
  - tests/architecture/partial-vocabulary-guard.test.ts
  - tests/architecture/peer-floor.test.ts
  - tests/architecture/reconcile-planner-purity.test.ts
  - tests/architecture/scope-fences-63.test.ts
  - tests/architecture/scope-order-drift.test.ts
  - tests/architecture/source-scan.test.ts
  - tests/architecture/source-scan.ts
  - tests/architecture/temp-root-control.ts
  - tests/architecture/unowned-exports-census.test.ts
  - tests/bridges/hooks/dispatch-exec.test.ts
  - tests/bridges/hooks/dispatch.test.ts
  - tests/bridges/hooks/event-router.test.ts
  - tests/domain/components/hook-events.test.ts
  - tests/domain/manifest.test.ts
  - tests/domain/plugin-resolver.test.ts
  - tests/edge/handlers/marketplace-seed.ts
  - tests/fixtures/bad-imports/edge-imports-bridges.ts
  - tests/orchestrators/marketplace/update.test.ts
  - tests/orchestrators/plugin/enable-disable.test.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/orchestrators/plugin/install-flow.test.ts
  - tests/orchestrators/plugin/list-flow.test.ts
  - tests/orchestrators/plugin/reinstall-flow.test.ts
  - tests/orchestrators/plugin/reinstall-record.test.ts
  - tests/orchestrators/plugin/reinstall-replace.test.ts
  - tests/orchestrators/plugin/update-flow.test.ts
  - tests/orchestrators/reconcile/apply.test.ts
  - tests/shared/notification-dispatch.test.ts
findings:
  critical: 2
  warning: 8
  info: 3
  total: 13
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-09-10T12:00:00Z
**Depth:** standard
**Files Reviewed:** 65
**Status:** issues_found

## Summary

The phase's five claimed vacuous-pass fixes hold up. `no-credential-leak.test.ts` no
longer has `assert.ok(true, "not yet authored")` arms or `if (!exists) continue;`
loops; `integration-materialization-gate.test.ts` now asserts the fixture really
offered an agent, a command, and a skill before claiming staging skipped them; the
`hooks-async-rewake.test.ts` `return;` statements that survive are stub-method bodies
inside a `ChildProcess` double, not test-path early exits. `overrideConfigFile: true`
appears nowhere — `eslint-effective-config.ts` uses the string form naming the real
`eslint.config.js`, and all three offender configs are checked by
`assertSingleAppendedBlock`, which is called at every use site
(`eslint-effective-config.test.ts:180-182,190`, `import-boundaries.test.ts:470,500`).
`gate-targets.test.ts`'s `T-07-48` clause is a genuine two-instrument comparison
(runtime namespace vs. literal file scan), not a value compared to itself. `npx tsc
--noEmit` is clean, so the two exports made module-private (`MARKETPLACE_VALIDATOR`,
`surfacePostCommitWarnings`) and the `ReinstallTransaction.replaceOperations`
promotion have no orphaned consumers, and `fetch.ts`'s dynamic-to-static
`resolveStrict` import introduces no cycle (`domain/` names no orchestrator module).

Two defects are provable and both were reproduced.

The first is the sixth vacuous pass the brief asked for, and it lives in the security
gate the phase spent the most effort on. `no-credential-leak.test.ts` documents the
`[^)]*` / `[^,}]*` bounded-prefix truncation as a *proven bypass* and closes it with
`fullTemplateLiteralsAfter` for exactly two of its six scans. The other four — the
`new Error(...)` scan on `git-credential.ts`, the Error/notifyFn scan on
`github-auth.ts`, the PROV-05 provider scan, and the marketplace add/update scan —
still carry the bounded form verbatim. A credential interpolated after any literal
`)` in the same message is invisible to all four. Reproduced against the live regexes.

The second is a half-threaded root in `scripts/test-coverage-direct.mjs`.
`pairsForChangedPaths(selectedProjectRoot)` honours the injected root in
`changedPaths` and then hands each path to `pairForPath`, which takes no root and
resolves against the module-level `projectRoot`. This is the same trap the file's own
`assertCompleteCoverage` docstring names ("a root that reached only one of the two
would be a trap"). Reproduced with a fixture repository: a fixture pair that exists on
disk is reported as `Missing source-test pair member`. The negative harness never
plants a pairable change under a fixture root, so the seam's happy path ships
unproven.

The remaining findings are weakenings rather than breakages: two gates aim
position-derived allow-lists with `path.basename` where a sibling gate uses the
stronger `path.relative` form, one docstring claims a tripwire the file does not
implement, one dispositions check is a bare substring probe behind a message that
promises much more, and one guard carries an uncounted per-line escape hatch that no
control exercises.

## Critical Issues

### CR-01: The credential-leak gate leaves its own documented "proven bypass" open in four of six scans

**File:** `tests/architecture/no-credential-leak.test.ts:167-175`, `:190-200`,
`:300-303`, `:340-343`

**Issue:** The file introduces `fullTemplateLiteralsAfter` (lines 99-121) specifically
to close a bypass it calls proven: `[^)]*` cannot cross a literal `)`, so a scan
bounded that way stops before any interpolation that follows a nested call, and
`[^,}]*` cannot cross the `}` closing a preceding `${...}`, so it only ever inspects
the first interpolation. The helper is applied to the `reason:` scan and the
`hookDebugLog(` scan. It is *not* applied to:

- `errorWithCred` (git-credential.ts scan) — `/new\s+Error\s*\((?:[^)]*\$\{[^}]*(password|access_token|cred\.[a-z]+)|…)/i`
- `errorOrNotifyWithToken` (github-auth.ts scan) — same bounded shape
- `errorOrNotifyWithToken` (PROV-05 scan over `auth-registry.ts` and `auth-host.ts`)
- `forbidden` (marketplace `add.ts` / `update.ts` scan)

Measured against the live regexes:

```
new Error(`git credential fill failed for ${describeHost(opts)}: ${cred.password}`)
  -> errorWithCred.test(...)          === false   (undetected leak)
new Error(`fill failed: ${cred.password}`)
  -> errorWithCred.test(...)          === true    (detected)
notifyFn(`device flow failed ${errorMessage(err)} ${r.accessToken}`)
  -> errorOrNotifyWithToken.test(...) === false   (undetected leak)
```

Four AUTH-09 / PROV-05 scans therefore report success over a leak class the same file
already knows how to detect. This is not a hypothetical shape: `platform/git.ts`'s
`onAuthFailure` message (quoted in this file's own comment at line ~305) already
contains a literal `)` before its interpolations, which is why the `hookDebugLog`
scan was hardened in the first place.

**Fix:** Route all four through the existing helper, exactly as the `reason:` and
`hookDebugLog` scans do — keep the bounded regex as the concatenation check and add
the whole-literal check beside it:

```ts
const FORBIDDEN_IN_LITERAL = /\b(access_?token|cred\.[a-z]+|r\.accessToken|password|accessToken|githubToken|gitToken)\b/i;

function assertNoCredentialInLiterals(rel: string, stripped: string, callSite: RegExp): void {
  const offenders = fullTemplateLiteralsAfter(stripped, callSite).filter((lit) =>
    FORBIDDEN_IN_LITERAL.test(lit),
  );
  assert.deepEqual(
    offenders,
    [],
    `AUTH-09: a template literal in ${rel} interpolates a credential field past a literal ) or beyond the first interpolation: ${offenders.join(", ")}`,
  );
}

// git-credential.ts
assertNoCredentialInLiterals(GIT_CREDENTIAL_FILE, stripped, /new\s+Error\s*\(\s*(`(?:[^`\\]|\\.)*`)/g);
// github-auth.ts and PROV-05 and marketplace add/update, per call form:
assertNoCredentialInLiterals(rel, stripped, /(?:new\s+Error\s*\(|notifyFn\s*\(|ctx\.ui\.notify\s*\()\s*(`(?:[^`\\]|\\.)*`)/g);
```

Add a planted control per scan (append a real leak line to a temp-root copy via
`plantOffender`) so the closure is proved rather than asserted.

### CR-02: `pairsForChangedPaths` half-threads its injected root and answers wrongly for any fixture pair

**File:** `scripts/test-coverage-direct.mjs:62-90` (`pairForPath`), `:321-341`
(`pairsForChangedPaths`)

**Issue:** `pairsForChangedPaths(selectedProjectRoot)` passes the root to
`changedPaths`, which correctly resolves the change set inside the injected
repository. It then calls `pairForPath(projectPath)` — a function with **no root
parameter** that resolves both `toProjectPath` and its two `existsSync` checks against
the module-level `projectRoot` (line 10, the real repository). Every path the fixture
produced is therefore checked for existence in the wrong tree.

`assertCompleteCoverage`'s docstring (lines 429-436) names this exact failure class:
"`selectedProjectRoot` governs BOTH halves of the answer… A root that reached only one
of the two would be a trap." `pairsForChangedPaths` is that trap.

Reproduced against a fixture repository containing a real
`extensions/pi-claude-marketplace/domain/zzprobe.ts` + `tests/domain/zzprobe.test.ts`
pair, with the source modified on a feature branch:

```
pairsForChangedPaths(fixtureRoot)
  -> THREW: Missing source-test pair member: extensions/pi-claude-marketplace/domain/zzprobe.ts
```

The pair exists in the fixture. `scripts/test-coverage-direct.negative.mjs` only ever
drives the injected root through the **zero-pair** docs-only case (line ~"docs-only"),
so the one branch that would expose this is never planted. Production runs
(`npm run test:coverage:direct`, which calls `runChangedPairs()` with no argument) are
unaffected because the default root and the module-level `projectRoot` coincide — but
the exported seam is incorrect and the harness cannot currently prove otherwise.

**Fix:** Thread the root through `pairForPath` and its two helpers, then plant the
positive case:

```js
export function pairForPath(inputPath, selectedProjectRoot = projectRoot) {
  const projectPath = toProjectPath(inputPath, selectedProjectRoot);
  // ... unchanged branching ...
  for (const pairPath of [sourcePath, testPath]) {
    if (!existsSync(path.join(selectedProjectRoot, pairPath))) {
      throw new Error(`Missing source-test pair member: ${pairPath}`);
    }
  }
  return { sourcePath, testPath };
}

function toProjectPath(inputPath, selectedProjectRoot = projectRoot) {
  const absolutePath = path.resolve(selectedProjectRoot, inputPath);
  const projectPath = path.relative(selectedProjectRoot, absolutePath);
  // ... unchanged ...
}

// pairsForChangedPaths:
const pair = pairForPath(projectPath, selectedProjectRoot);
```

`isStructuralSupplement` (line 258) has the same defect — it hardcodes `projectRoot`
in both `existsSync` calls — so thread it too. Then add a negative-control state that
builds a fixture repository carrying a real source/test pair and asserts
`pairsForChangedPaths(fixtureRoot).pairs` names it; without that the fixed seam is
still unproven.

## Warnings

### WR-01: `closed-set-enrollment.test.ts` claims a `Dependency` tripwire it does not implement

**File:** `tests/architecture/closed-set-enrollment.test.ts:21-27`

**Issue:** The header states: "The `Dependency` half pins `softDepMarkers`, the sole
runtime surface the set drives: a third dependency added to the union without a
`softDepMarkers` branch would leave the flag count and the emitted marker set
unchanged, **which is the drift this pins**." Nothing in the file pins that. The five
`softDepMarkers` cases enumerate the two-boolean cross-product by hand; none asserts
the arity of `softDepMarkers`, the member count of `Dependency`, or the size of the
marker vocabulary. `Dependency` is a bare literal union with no runtime tuple
(`shared/concerns/soft-dep.ts:31`), so adding `"hooks"` to it and leaving
`softDepMarkers` untouched passes every case here. The hook half *does* have a real
exact-length tripwire (`expectedEventCount = 10`); the dependency half has the
docstring for one and not the tripwire.

**Fix:** Either add the missing pin or correct the claim. The cheapest honest pin is a
compile-time one mirroring `_BucketAEventsCoverageProof`, plus a runtime arity check:

```ts
// in tests: fails the moment softDepMarkers grows a third declares-flag
assert.equal(
  softDepMarkers.length,
  3,
  "SCN-F025: softDepMarkers changed arity, so the Dependency set moved without this classification being revisited",
);
```

Better: give `Dependency` a runtime `DEPENDENCIES` tuple with `as const satisfies
readonly Dependency[]` plus the reverse `Exclude<..> extends never` proof the phase
already added for `BUCKET_A_EVENTS`, and count it here.

### WR-02: Two positionally-aimed allow-lists are pinned by basename only, where a sibling gate pins the real subpath

**File:** `tests/architecture/no-credential-leak.test.ts:45-70`,
`tests/architecture/config-state-write-seams.test.ts:84-88,182-193`

**Issue:** Both gates destructure a registry group by position and then "pin" the
result with `path.basename`. `config-state-write-seams.test.ts` compares
`[...ALLOWED_STATE_JSON_WRITERS].map(path.basename)` against `["migrate.ts",
"state-io.ts"]`, and `no-credential-leak.test.ts` compares
`CREDENTIAL_LEAK_TARGETS.map(path.basename)` against a ten-basename list. A basename
carries no directory, so a registry edit that repointed an entry at a *different*
module of the same name would re-aim the regex at the wrong file and both pins would
still be green — the precise failure the pins were written to prevent.

`no-shell-out.test.ts:136-146` gets this right with
`path.relative(EXTENSION_ROOT_REL, rel)`, which keeps the whole subpath while still
avoiding the "compare the group against itself" trap. The three gates should not
disagree about how strong their pin is.

**Fix:** Adopt the `no-shell-out.ts` form in both files:

```ts
// config-state-write-seams.test.ts
assert.deepEqual(
  [...ALLOWED_STATE_JSON_WRITERS].map((rel) => path.relative(EXTENSION_ROOT_REL, rel)).sort(),
  ["persistence/migrate.ts", "persistence/state-io.ts"],
);

// no-credential-leak.test.ts
assert.deepEqual(
  CREDENTIAL_LEAK_TARGETS.map((rel) => path.relative(EXTENSION_ROOT_REL, rel)),
  ["persistence/state-io.ts", "persistence/migrate.ts", "transaction/with-state-guard.ts", /* … */],
);
```

### WR-03: The dispositions gate is a substring probe behind a message promising a status and a command

**File:** `tests/architecture/unowned-exports-census.test.ts:200-215`

**Issue:** The `D-07-17` case asserts `record.includes(finding)` for each of the 16
`ROUTED_FINDINGS` ids. The failure message states the contract as "answered with a
status and a command run this cycle", and the file header calls the record "the other
half of the same obligation… only against evidence measured this cycle". The check
verifies none of that: a dispositions file containing a bare "still open, not yet
investigated: OMR-F01" line satisfies it, as does one that names the id in a heading,
a footnote, or a changelog entry. A gate whose assertion is weaker than its stated
contract is the class this phase exists to remove.

Secondary: `includes` is unanchored, so ids that prefix one another would alias. The
current set happens not to collide, but nothing enforces that (`OPEF-F01` /
`OPEFR-F007` are one character from doing so).

**Fix:** Parse the record's rows and require the shape the message claims:

```ts
const DISPOSITION_ROW = (id: string) =>
  new RegExp(String.raw`^\|\s*${id}\s*\|\s*(closed|open|deferred)\s*\|\s*\S.*\|`, "m");

const unanswered = ROUTED_FINDINGS.filter((finding) => !DISPOSITION_ROW(finding).test(record));
```

Anchoring to a row also removes the prefix-collision hazard.

### WR-04: `registryGroups()` treats every array-valued registry export as a path list, with nothing enforcing it

**File:** `tests/architecture/gate-targets.test.ts:52-60`, `:127-146`

**Issue:** `registryGroups()` collects every `Array.isArray` export of
`gate-targets.ts` and `unresolvedEntries` then `stat`s each element under
`REPO_ROOT`. The invariant "every array-valued export of this module is a list of
paths that must resolve on disk" is stated only in prose, in the
`UNOWNED_EXPORT_CENSUS` header (`gate-targets.ts:561-564`) — which is itself the one
export deliberately shaped as a `Record` to avoid the rule. Nothing in the type
system or in this gate enforces it. A future array-valued export that is a list of
symbol names, rule ids, or event literals would be `stat`ed as a path, and the
GGAT-01 resolution clause would fail with an unrelated message, or (for a name that
happens to collide with a repo path) silently pass. The escape hatch already exists in
one direction — `MUST_NOT_RESOLVE_GROUP` is excluded by name string — so the
convention is already being managed by hand.

**Fix:** Make the invariant checkable rather than conventional. Either give the
registry a nominal path type that the resolution clause requires,

```ts
// gate-targets.ts
export type RepoPath = string & { readonly __repoPath: unique symbol };
export const NETWORK_FREE_TARGETS = [ /* … */ ] as const satisfies readonly string[];
```

or, at minimum, add a shape clause to this gate asserting every array element looks
like a repository-relative path before any `stat` runs:

```ts
const REPO_RELATIVE = /^(?:extensions|tests|scripts|docs)\/|^[\w.-]+\.(?:json|js|mjs|md)$/;
const nonPaths = groups.flatMap(([name, entries]) =>
  entries.filter((rel) => !REPO_RELATIVE.test(rel)).map((rel) => `${name}: ${rel}`),
);
assert.deepEqual(nonPaths, [], "D-07-05: an array-valued registry export that is not a path list is stat'd as one");
```

### WR-05: The `scope-order: justified` escape hatch is uncounted, unpinned, and has no control

**File:** `tests/architecture/scope-order-drift.test.ts:124-127`, `:163-166`

**Issue:** Both scans skip any source line containing the literal string
`scope-order: justified`. That is a per-line waiver with no cap, no census, and no
report — a developer can silently uncover either guard on any line by typing a comment.
`grep -rn "scope-order: justified" extensions/` returns **0** today, so the hatch is
currently unexercised: no case proves it works, and no assertion notices when the
count leaves zero. Compare `SHELL_OUT_EXEMPT_TARGETS` / `ALLOWED_STATE_JSON_WRITERS`,
which are registry-owned and pinned by a sibling "exactly N" assertion in the same
file. The waiver mechanism here has neither property.

**Fix:** Pin the waiver population the same way the other gates pin theirs, and prove
the hatch with a temp-root control:

```ts
const EXPECTED_JUSTIFIED_WAIVERS = 0;

test("260525-cjr B3: the justified-waiver population is pinned", async () => {
  const waived = /* count lines containing the marker across the walk */;
  assert.equal(
    waived,
    EXPECTED_JUSTIFIED_WAIVERS,
    "a scope-order waiver appeared or disappeared; record it here in the same change",
  );
});
```

Then add a `withTempRoot` case that plants `["user", "project"]` with and without the
marker on a copy of a real module, so the hatch's behaviour is measured rather than
assumed.

### WR-06: `fixtureGit` masks the real cause when the git invocation itself fails

**File:** `scripts/test-coverage-direct.negative.mjs:58-66`

**Issue:** `fixtureGit` checks `run.status !== 0` and formats `run.stderr.trim()`.
When `spawnSync` fails to launch (git missing from `PATH`, `ENOENT`, `EACCES`) it sets
`run.error` and leaves `run.status`, `run.stdout`, and `run.stderr` all `null`. The
guard fires — `null !== 0` — and then throws `TypeError: Cannot read properties of
null (reading 'trim')`, hiding the actual cause behind a stack in the harness. The
production script's `gitLines` (`test-coverage-direct.mjs:115-134`) already gets this
right by checking `run.error` first and defensively typing `run.stderr`; the fixture
helper does not.

**Fix:** Mirror `gitLines`:

```js
function fixtureGit(cwd, args) {
  const run = spawnSync("git", args, { cwd, encoding: "utf8" });

  if (run.error !== undefined) {
    throw new Error(`Fixture git ${args.join(" ")} could not run in ${cwd}: ${run.error.message}`);
  }

  if (run.status !== 0) {
    const stderr = typeof run.stderr === "string" ? run.stderr.trim() : "";
    throw new Error(`Fixture git ${args.join(" ")} exited ${run.status} in ${cwd}: ${stderr}`);
  }

  return run.stdout.trim();
}
```

### WR-07: `temp-root-control.ts` asserts a containment property it does not check

**File:** `tests/architecture/temp-root-control.ts:24-27`, `:66-74`, `:78-82`

**Issue:** The header states "Every write path is joined from the caller's `root`,
which is always a `mkdtemp` return value, and disposal removes that value and nothing
composed from it." The disposal half is true — `withTempRoot` does
`rm(root, {force: true, recursive: true})` in a `finally` on the `mkdtemp` return
value, and nothing else removes anything. The write half is a convention, not a
check: `materializeTargets` and `appendToCopy` both do `path.join(root, rel)` with
`rel` supplied by the caller, and `path.join` happily resolves a leading `../` outside
the temp root. Every current caller passes registry-owned repository-relative paths,
so nothing escapes today. But this repository's whole containment posture (NFR-10,
`shared/path-safety.ts::assertPathInside`) is built on not trusting that convention,
and this helper writes arbitrary caller-supplied content.

Secondary: `appendToCopy` writes without creating the parent directory, so a caller
that plants an offender for a target it never materialized gets an ENOENT rather than
a message naming the mistake.

**Fix:** Add the containment check the header already promises, using the same
`path.relative` idiom the production chokepoint uses:

```ts
function insideRoot(root: string, rel: string): string {
  const destination = path.join(root, rel);
  const contained = path.relative(root, destination);

  if (contained.startsWith("..") || path.isAbsolute(contained)) {
    throw new Error(`temp-root-control: ${rel} resolves outside the temporary root`);
  }

  return destination;
}
```

Route `materializeTargets` and `appendToCopy` through it, and have `appendToCopy` call
`mkdir(path.dirname(destination), { recursive: true })` first.

### WR-08: `REPO_ROOT` is re-derived in seven gates the phase left un-migrated

**File:** `tests/architecture/no-credential-leak.test.ts:37`,
`config-state-write-seams.test.ts:9`, `no-shell-out.test.ts:9`,
`unowned-exports-census.test.ts:42`, `partial-vocabulary-guard.test.ts:57`,
`disabled-state-classification.test.ts:23`, `unit-suite-glob-completeness.test.ts:28`

**Issue:** The phase migrated `extension-version-sync.test.ts`,
`manifest-read-seam.test.ts`, `no-telemetry-deps.test.ts`, and `peer-floor.test.ts`
from a local `path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")` to
`import { REPO_ROOT } from "./source-scan.ts"`, and left seven other gates on the
local form — including three it otherwise edited heavily this phase
(`no-credential-leak`, `config-state-write-seams`, `unowned-exports-census`). Two
definitions of the scan base is exactly the drift `source-scan.ts` exports
`REPO_ROOT` to prevent: a file moved one directory deeper silently redefines the root
for its own gate and for nobody else's.

**Fix:** Replace each local constant with `import { REPO_ROOT } from "./source-scan.ts";`
and drop the now-unused `fileURLToPath` import, as the four migrated files already do.

## Info

### IN-01: The bare `--all` arm degrades the completeness check to a tautology

**File:** `scripts/test-coverage-direct.mjs:590-602`, `:649-651`

**Issue:** `runAllPairs` reads the retained report back from disk so
`assertReportComplete` has a witness the loop did not produce — and the comment
correctly says the report-less arm "cannot fail at all". `main()` still exposes that
arm via a bare `--all` (line 649). No npm script uses it
(`test:coverage:direct:all` passes `--report`), so this is reachable only by hand, but
a maintainer running `node scripts/test-coverage-direct.mjs --all` gets a green
completeness assertion that verified nothing.

**Fix:** Make the report mandatory for `--all` (write to a temp file when the caller
names none), or print an explicit "completeness check degraded: no report retained"
line on that path so the weaker guarantee is visible in the output.

### IN-02: `walkTsFiles` carries an unused `repoRoot` parameter

**File:** `tests/architecture/scope-order-drift.test.ts:67`

**Issue:** `async function walkTsFiles(root: string, repoRoot: string)` never reads
`repoRoot`; it only forwards it to its own recursive call. `no-unused-vars` cannot see
this because the parameter *is* referenced. Both call sites pass `repoRoot`
redundantly, and the sibling walkers in `no-shell-out.test.ts` and
`config-state-write-seams.test.ts` take one parameter.

**Fix:** Drop the parameter and update the two call sites.

### IN-03: `presentSeams` proves only that an identifier occurs, not that it is a typed optional port

**File:** `tests/architecture/no-test-only-production-surface.test.ts:245-256`

**Issue:** The D-05-01 classification case tests `new RegExp(String.raw`\b${member}\b`)`
against the comment-stripped source. That confirms the identifier survives; it does not
confirm the shape the classification header describes ("a SINGLE named capability with
its own type and its own doc line"). A seam demoted back into an anonymous bag while
keeping the same word somewhere in the file still passes. The rename control is sound
— `replaceOperations` → `replaceOperationsRenamedAway` does defeat the `\b` boundary —
so the negative direction is proved; only the positive claim is looser than stated.

**Fix:** Tighten the probe to the declaration form the classification is about, e.g.
`new RegExp(String.raw`readonly\s+${member}\??\s*:`)`, so a member that stops being a
declared typed field on the options/transaction interface drops out.

---

_Reviewed: 2026-09-10T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
