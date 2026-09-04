# Architecture — import, containment and source-scan gates — adversarial re-review

**Scope:** the 13 `tests/architecture/*.test.ts` gate files named in the first-pass
file plus `tests/architecture/source-scan.ts`, re-read in full; the four production
modules the first pass paired with them (`bridges/mcp/parse.ts`, `bridges/mcp/stage.ts`,
`persistence/locations.ts`, `shared/extension-version.ts`); and the real configuration
each gate reads (`package.json`, `package-lock.json`, `eslint.config.js`,
`sonar-project.properties`).
**First-pass file:** `unit-test-findings/architecture-boundary-gates.md`
**Clean files attacked:** 11 (8 test files + 3 production modules)
**Existing findings graded:** 12

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 10 |
| New WARNING (missed by first pass) | 30 |
| Existing CONFIRMED | 8 |
| Existing UNDERSTATED | 3 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 1 (partial) |
| Existing DUPLICATE-OF | 0 |

Of the 30 new WARNINGs, 28 sit in the "New findings" section and 2 are recorded inline
in the grading section (`no-telemetry-deps.test.ts`'s missing negative control,
`reconcile-planner-purity.test.ts`'s dynamic-import hole).

The first pass's picture of this area does **not** hold up. It graded eight of the
fourteen files clean, and six of those eight carry a mutation that leaves the gate
green over an unenforced rule. Two of the three files it praised most —
`source-scan.test.ts` and `integration-materialization-gate.test.ts` — have named,
surviving mutations. The one BLOCKER it did record is real, and is worse than
recorded in four separate ways.

The dominant shape in this area is a **self-referential gate**: an absence assertion
whose only evidence that it inspected anything is that it did not throw. Six files
here scan real source for a forbidden token and assert the offender list is empty;
only two of them (`source-scan.test.ts`, `no-split-01-cast-reads.test.ts`) carry any
proof that the scan can produce a non-empty list at all, and both of those proofs are
incomplete.

## New findings

Findings marked **(clean list)** attack a file the first pass declared clean.
Findings marked **(open file)** are in a file the first pass already opened but did
not raise these.

### `tests/architecture/no-shell-out.test.ts` (clean list)

- **[BLOCKER] The D-21 child_process gate has no proof it inspects anything or that
  its patterns match anything** — `lines 96–117`, walker at `lines 75–85`, patterns at
  `lines 87–94`
  Two independent surviving mutations, both leaving both cases green:
  1. Change `full.endsWith(".ts")` (`line 81`) to `.endsWith(".mts")`, or delete the
     `yield* walkTsFiles(full)` recursion (`line 80`). The walk yields zero (or six)
     of the tree's **204** `.ts` files; `offenders` stays `[]`; the `deepEqual` at
     `line 112` passes. The gate is then inert against every `child_process` import in
     the extension.
  2. Replace any entry of `FORBIDDEN_PATTERNS` with `/zzz-no-such-token/`. Nothing in
     the file feeds a synthetic offender through those regexes, so all six could be
     broken and the suite stays green.
  Neither failure is observable, because the test's only signal is "the list was
  empty".
  **Fix:** (a) accumulate a `scanned: string[]` in the walk and assert
  `assert.ok(scanned.length > 150, ...)` plus
  `assert.ok(scanned.includes("extensions/pi-claude-marketplace/index.ts"))` — the
  in-repo model for the count guard is `import-boundaries.test.ts:234`
  (`assert.ok(files.length > 0, 'walked … and found no .ts files')`); (b) add a
  sibling case in the shape of `no-split-01-cast-reads.test.ts:131–156` that feeds
  `['import { spawn } from "node:child_process";', 'require("child_process")',
  'await import("node:child_process")']` through `FORBIDDEN_PATTERNS` and asserts each
  matches, plus a benign set (`'import { spawn } from "./spawn-helpers.ts";'`) that
  matches none.
- **[WARNING] Scans un-stripped source, against the shared mechanic's own mandate** —
  `line 104`
  `source-scan.ts:34–40` calls comment stripping "Mandatory for every scanning
  clause". This file reads raw text. Three non-whitelisted extension files already
  name `child_process` in prose — `bridges/hooks/async-rewake/ring-buffer.ts:6`,
  `bridges/hooks/exec-timer.ts:19,44`, `bridges/hooks/spawn-helpers.ts:6` — so a
  future comment that quotes the import form (`// do NOT write: import { spawn } from
  "node:child_process"`) turns this gate red on its own subject's prose.
  **Fix:** `import { stripComments } from "./source-scan.ts";` and match against
  `stripComments(source)`.
- **[WARNING] Whitelist entries are never proven to exist or to still need the
  waiver** — `lines 69–73`, `lines 125–131`
  The "exactly three files" case compares the set against a hardcoded array; it never
  `stat`s the three paths nor confirms each still imports `node:child_process`. All
  three exist and import it today (verified: `git-credential.ts:36`,
  `dispatch-exec.ts:52`, `async-rewake/registry.ts:40`), but a rename leaves a dead
  waiver that silently pre-exempts whatever later occupies that path. This is the
  WR-06 failure mode `source-scan.ts:59–64` was hardened against, arriving through the
  allow-list door.
  **Fix:** in the "exactly three files" case, `await readFile` each whitelisted path
  and assert it matches `/from\s+["']node:child_process["']/`.

### `tests/architecture/no-split-01-cast-reads.test.ts` (clean list)

- **[BLOCKER] The two scanning cases green over a walk that visits almost nothing** —
  `lines 86–105`, `lines 111–126`, walker at `lines 74–84`
  Deleting the `yield* walkTsFiles(full)` recursion at `line 79` drops the walk from
  **57** orchestrator `.ts` files to the **6** that sit directly under
  `orchestrators/` — 89% of the guarded tree, including every file the header names as
  a former cast site (`marketplace/list.ts`, `marketplace/info.ts`, `plugin/list.ts`,
  `plugin/info.ts`) — and both cases stay green. The two cases at `lines 131` and `158`
  do **not** cover this: despite their titles ("SPLIT-01 walker: …") they feed strings
  straight into the regexes and never invoke `walkTsFiles`.
  **Fix:** collect the walked relative paths in both scanning cases and assert
  `assert.ok(walked.includes("extensions/pi-claude-marketplace/orchestrators/plugin/info.ts"))`
  before the offender assertion. Same rule as the `no-shell-out.test.ts` fix above —
  one helper serves both.
- **[WARNING] Scans un-stripped source; the assignment pattern matches prose** —
  `lines 94`, `115`
  `SPLIT_01_AUTOUPDATE_ASSIGNMENT_PATTERN` is `/\.autoupdate\s*=(?!=)/`. Any comment
  in an orchestrator that writes `.autoupdate = false` in explanatory prose fails the
  gate on its own documentation — precisely the case `source-scan.ts:34–40` exists to
  prevent, and precisely the shape this file's *own* header uses at `line 19`.
  **Fix:** strip via the shared `stripComments` before both `.test()` calls.
- **[WARNING] Two case titles name a subject they do not exercise** — `line 131`,
  `line 158`
  Both are titled "walker" and test only the regex. Rename to
  `"SPLIT-01 cast pattern matches a synthetic offender and ignores benign casts"` and
  the WR-05 equivalent, so the missing walker coverage above is visible from the
  titles rather than hidden by them.

### `tests/architecture/import-boundaries.test.ts` (open file)

- **[BLOCKER] A later flat-config block can turn `import-x/no-restricted-paths` off
  and all three zone cases stay green** — `loadZones()` at `lines 34–46`, cases at
  `lines 270`, `283`
  `loadZones()` returns the zones of the **first** config block that carries the rule
  and stops. ESLint flat config applies blocks in order, so appending
  `{ files: ["extensions/pi-claude-marketplace/**/*.ts"], rules: { "import-x/no-restricted-paths": "off" } }`
  to `eslint.config.js` disables D-11 enforcement entirely while `loadZones()` keeps
  returning the still-present zones from block C (`eslint.config.js:175–271`). Both
  zone cases pass; the canary passes (it uses its own synthetic config). The boundary
  is unenforced and nothing goes red.
  **Fix:** replace `loadZones()` with
  `new ESLint({ cwd: REPO_ROOT }).calculateConfigForFile("extensions/pi-claude-marketplace/edge/router.ts")`
  and read `config.rules["import-x/no-restricted-paths"]` off the **resolved**
  configuration. That is one change that also closes the first pass's `files`-glob
  WARNING (see grading below) and the `basePath` gap: assert the resolved entry's
  severity is `"error"` (or `2`), then take its zones from there.
- **[BLOCKER] A duplicated zone masking a dropped zone survives both zone cases** —
  `lines 270–281`, `lines 283–301`
  Case 1 asserts `zones.length === FOLDERS.length` (8). Case 2 iterates the zones
  found and checks each against `EXPECTED_FORBIDDEN`. Neither asserts the zone **set**.
  Duplicating the `edge` zone and deleting the `shared` zone keeps the length at 8,
  keeps every observed target present in the map, and keeps every `from` set matching
  — both cases green — while `shared/` is free to import `edge/`,
  `orchestrators/`, `bridges/`, `domain/`, `transaction/` and `persistence/`, inverting
  the leaf layer.
  **Fix:** in case 2, build `const targets = zones.map(zoneTarget).sort()` and assert
  `assert.deepStrictEqual(targets, Object.keys(EXPECTED_FORBIDDEN).sort())` before the
  per-zone loop. That single assertion subsumes case 1's length check.
- **[WARNING] `zone.except` is modelled and never asserted** — `line 15`, `line 288`
  `RestrictedPathsZone` declares `except?: string[]`, so the author knew the escape
  hatch exists, but no case reads it. Adding `except: ["**"]` to any zone neuters that
  zone with all three cases green. No zone uses `except` today (verified across
  `eslint.config.js:185–270`).
  **Fix:** assert `zone.except === undefined` for every zone, or pin an expected
  `except` map alongside `EXPECTED_FORBIDDEN`.
- **[WARNING] A zone whose `target` is an array is only half-checked** — `line 288`
  `const target = typeof zone.target === "string" ? zone.target : zone.target[0]!`
  silently discards every target after the first. A two-target zone would be validated
  against one of them.
  **Fix:** iterate all targets, or assert `typeof zone.target === "string"` explicitly
  since that is the shape the config actually uses.
- **[WARNING] The plugin-side ledger scan is a hardcoded list while the marketplace
  side walks the directory** — `lines 211`, `251–268`
  `orchestratorFiles("marketplace")` enumerates the directory and guards
  `files.length > 0` (`line 234`); the plugin direction iterates the fixed
  `PLUGIN_LEDGERS` five-tuple. A sixth plugin ledger added later is ungated in the
  plugin→marketplace direction with no signal. (The reverse risk — a *renamed* ledger —
  is correctly fail-loud, since `readFile` throws.)
  **Fix:** derive the plugin ledger set the same way the marketplace side does, or add
  a case asserting `PLUGIN_LEDGERS` covers every `orchestrators/plugin/*.ts` file that
  is not a `*.messaging.ts`, a composer (`bootstrap.ts`), or a named leaf
  (`update-row.ts`, `clone-cache.ts`, `clone-gc.ts`, `shared.ts`,
  `discover-names.ts`, `git-source-probe.ts`, `plugin-state-classifier.ts`).
- **[WARNING] The ledger-import regexes match only the shortest relative form and only
  static `from` clauses** — `lines 216–221`
  `from\s+"\.\./plugin/(…)\.ts"` misses
  `from "../../orchestrators/plugin/install.ts"` and misses
  `await import("../plugin/install.ts")`. Dynamic import is live in this repo's
  orchestrator layer (`orchestrators/plugin/fetch.ts:464`).
  **Fix:** widen both regexes to
  `` /(?:from\s+|import\s*\(\s*)"[^"]*\/plugin\/(?:…)\.ts"/ `` and the marketplace
  mirror.
- **[WARNING] The `9-zone` / `8` / `10th folder` counts disagree across the gate and
  the config it guards** — `eslint.config.js:176` says "9-zone no-restricted-paths
  mapping"; the config holds 8 zones; `import-boundaries.test.ts:49` says "8-zone
  configuration"; the failure message at `line 293` says "did someone add a 10th
  folder". Pick 8 and make all three say it.

### `tests/architecture/no-orchestrator-network.test.ts` (clean list)

- **[BLOCKER] A dynamic import of `platform/git.ts` defeats all four patterns, and the
  form is already in use inside a gated file** — `FORBIDDEN_PATTERNS`, `lines 114–119`
  Every pattern is either a `from "…"` clause or a bare identifier. Planting
  `const { clone } = await import("../../platform/git.ts"); await clone(...)` in
  `orchestrators/plugin/install.ts` or `fetch.ts` names no `gitOps`, no
  `DEFAULT_GIT_OPS`, no `refreshGitHubClone` and no `from` clause — the gate stays
  green while the file performs the network operation NFR-5 forbids. This is not
  hypothetical: `orchestrators/plugin/fetch.ts:464` already writes
  `const { resolveStrict } = await import("../../domain/resolver.ts");`, and `fetch.ts`
  is target #10 of this very gate. The sibling gate in the same directory already
  covers the form — `no-shell-out.test.ts:92–93` lists
  `/import\s*\(\s*["']node:child_process["']\s*\)/`.
  **Fix:** add
  `{ name: "dynamic import of platform/git", pattern: /import\s*\(\s*["'][^"']*platform\/git[^"']*["']\s*\)/ }`
  to `FORBIDDEN_PATTERNS`, and propagate the same clause to
  `reconcile-planner-purity.test.ts`'s `node:fs` / `platform/git` patterns
  (`lines 32–34`), which have the identical hole.
- **[WARNING] The "Skip-path rationale" docstring describes behavior the helper no
  longer has** — `lines 38–41`
  "The test skips ENOENT targets with an informational marker so this gate can land
  before implementation. Once a target file exists, assertions fire." Since WR-06,
  `assertNoForbiddenSurface` **fails** on ENOENT unless the path is in
  `opts.allowMissing` (`source-scan.ts:78–89`), and this call site passes no `opts`.
  A reader auditing coverage would conclude eleven targets are optional when they are
  mandatory.
  **Fix:** delete the paragraph and replace it with one sentence stating that every
  target is mandatory under WR-06 and no waiver is in force.
- **[WARNING] `orchestrators/marketplace/list.ts` and `remove.ts` are not gated, and
  `list.ts` claims in its own header that they are** — `FORBIDDEN_TARGETS`,
  `lines 67–112`
  `marketplace/list.ts:7–9` reads "NO gitOps surface (NFR-5 by construction — list.ts
  does not even import platform/git or DEFAULT_GIT_OPS)". Nothing enforces it.
  `marketplace/remove.ts` names no git surface either and is likewise ungated, while
  the plugin-side counterparts (`plugin/list.ts`, `plugin/info.ts`) are both gated.
  This is the same asymmetry META-FINDINGS records; the `list.ts` header text is the
  new evidence.
  **Fix:** add both files to `FORBIDDEN_TARGETS` with the rationale comment each
  sibling entry carries.
- **[WARNING] `orchestrators/marketplace/info.ts` misattributes its own gate** —
  `info.ts:5–6`
  The header says "The grep-gate test in `tests/orchestrators/marketplace/info.test.ts`
  enforces this". That file contains no grep gate (verified: its only `readFile` calls
  are at `lines 2` and `157`, both reading fixture output). The gate is
  `tests/architecture/no-orchestrator-network.test.ts:87`.
  **Fix:** correct the header to name this file. This misattribution is how the
  `list.ts` / `remove.ts` omission above stayed invisible.

### `tests/architecture/source-scan.ts` + `source-scan.test.ts` (clean list)

- **[BLOCKER] The comment-stripping step inside `assertNoForbiddenSurface` is never
  proven** — `source-scan.ts:91`, cases at `source-scan.test.ts:17–61`
  Delete `const stripped = stripComments(src);` and match `pattern.test(src)` instead:
  all four cases stay green. Case 3 (`line 51`) scans `source-scan.ts` for
  `/assertNoForbiddenSurface/`, a token that appears in both the comments and the code,
  so it cannot tell stripped from unstripped. The `stripComments` case at `line 63`
  proves the function in isolation but never that the caller uses it. Stripping is
  load-bearing for every consumer — `orchestrators/plugin/install.ts:59,712` mention
  `gitOps` only in comments, and `domain/resolver.ts:302` mentions `platform/git` only
  in a comment — so this is the one line whose removal turns three green gates red for
  the wrong reason.
  **Fix:** add
  `test("comment-only occurrences are stripped before matching", async () => { await assertNoForbiddenSurface(["extensions/pi-claude-marketplace/orchestrators/plugin/install.ts"], [{ name: "gitOps", pattern: /\bgitOps\b/ }], () => "should not fire"); });`
  — install.ts's only two `gitOps` occurrences are the comments at `lines 59` and
  `712`, so the case passes today and fails the moment stripping is removed.
- **[WARNING] The "reports every offending file at once" promise is untested** —
  `source-scan.ts:50–52`, `source-scan.test.ts:51–61`
  Every rejecting case passes exactly one target and one pattern. Mutating the loop to
  `break` after the first `offenders.push`, or passing a literal `[]` to
  `describeViolation` instead of `offenders`, leaves all cases green:
  `assert.rejects(…, /expected-failure/)` matches the message prefix, never the
  offender list.
  **Fix:** add a case with two offending targets and one pattern that asserts the
  rejection message contains both relative paths, using
  `assert.rejects(fn, (err) => { assert.match(err.message, /source-scan\.ts/); assert.match(err.message, /no-shell-out\.test\.ts/); return true; })`.
- **[WARNING] The non-ENOENT rethrow branch has no case** — `source-scan.ts:88`
  Reachable by real input: passing a directory yields `EISDIR`, an unreadable file
  yields `EACCES`. Untested; classified reachable-untested, not dead code.
  **Fix:** add
  `await assert.rejects(() => assertNoForbiddenSurface(["tests/architecture"], NEVER_MATCHES, () => "unused"), (err) => err.code === "EISDIR")`
  and assert the message does **not** contain "does not exist" — the point is that a
  non-ENOENT failure is not silently converted into a WR-06 waiver decision.
- **[WARNING] One case holds two acts** — `source-scan.test.ts:30–49`
  The "not-yet-written target" case performs a resolving call and then a rejecting
  call. These are two behaviors ("a waived path passes" and "a waiver is per-path");
  the second stops running when the first fails.
  **Fix:** split into two sibling `test()` cases.
- **[WARNING] `REPO_ROOT` has no owning case** — `source-scan.ts:29`
  Exported and consumed by `compat-01-no-expansion.test.ts:95` and
  `manifest-lookup-drift.test.ts:32`; no case asserts what it resolves to. A
  wrong `"../.."` would relocate every consumer's scan root, and only the
  ENOENT failures downstream would show it.
  **Fix:** assert
  `assert.strictEqual(path.basename(REPO_ROOT), "pi-claude-marketplace")` is too
  brittle across worktree names — instead assert
  `existsSync(path.join(REPO_ROOT, "package.json"))` and that its `name` field is
  `"pi-claude-marketplace"`.

### `tests/architecture/no-credential-leak.test.ts` (open file)

The first pass recorded one BLOCKER here. Four further defects sit in the same file;
each is independently sufficient to let a credential leak ship.

- **[BLOCKER] Four scans green themselves on a missing target — the WR-06 failure mode,
  including two literal `assert.ok(true)`** — `lines 116–124`, `lines 145–154`,
  `lines 297–301`, `lines 336–340`
  All four guarded files exist today, so all four skip paths are dormant *and*
  unexercised — but a rename or move of `platform/git-credential.ts`,
  `domain/github-auth.ts`, `domain/auth-registry.ts`, `orchestrators/auth-host.ts`,
  `orchestrators/marketplace/add.ts` or `update.ts` silently converts the corresponding
  AUTH-09 gate into a no-op that still reports green. `source-scan.ts:59–64` documents
  exactly why this is forbidden ("Skipping it silently meant that renaming, moving, or
  deleting a guarded file turned the gate green over zero inspected files"), and
  `source-scan.test.ts:17` pins it — but this file predates and bypasses the shared
  mechanic. `assert.ok(true, "…")` is additionally a vacuous assertion under the
  guidelines: it passes for every implementation.
  **Fix:** delete all four `exists` probes and the `access` import; read
  unconditionally so ENOENT throws, or route the scans through
  `assertNoForbiddenSurface` with no `allowMissing`, which is what the two sibling
  gates in this directory already do.
- **[BLOCKER] The state-write gate misses the camelCase field name the codebase
  actually uses** — `FORBIDDEN_STATE_FIELDS`, `line 43`
  `/\b(password|access_token|githubToken|gitToken)\b/i` does not match `accessToken`.
  Verified by execution: `record.accessToken = t;` → not caught;
  `record.access_token = t;` → caught. `accessToken` is the live property name — the
  `PollResult` success arm declares it at `domain/github-auth.ts:77` and it is assigned
  at `line 270`. Every other scan in this same file uses `access_?token` to cover both
  spellings, so this is sibling drift inside one file. Serializing the OAuth token into
  `state.json` as `accessToken` — the single failure the header calls out first
  ("Tokens must remain in-memory only; no path may serialize them to state.json") —
  passes this gate.
  **Fix:** change the pattern to
  `/\b(password|access_?token|githubToken|gitToken|refresh_?token|clientSecret)\b/i`.
- **[BLOCKER] Every message scan anchors on `new Error(`, and the guarded file already
  throws a subclass** — `lines 131`, `163–164`, `288–289`, `327–328`
  Verified by execution against the `line 131` regex:
  `throw new TypeError(\`bad ${cred.password}\`)` → **not caught**;
  `const msg = \`bad ${cred.password}\`; throw new Error(msg);` → **not caught**.
  `domain/github-auth.ts:213` already writes `throw new TypeError(...)`, so the
  bypassing construct is in live use inside a guarded file, and this repo's own
  convention (`shared/errors.ts`, CONVENTIONS.md "typed error classes, one per failure
  mode") means the natural way to add an error here is a subclass the gate cannot see.
  **Fix:** change the four anchors from `new\s+Error\s*\(` to
  `new\s+[A-Z]\w*Error\s*\(` so every `Error` subclass and `TypeError` is covered. The
  variable-indirection bypass is a structural limit of a lexical scan — record it in
  the header as a known limit rather than leaving it implied.
- **[BLOCKER] Not one of the seven regexes has a negative control** — whole file
  Every case is an absence assertion over real source. Replacing any of the seven
  patterns with `/zzz-no-such-token/` leaves the whole file green. The file's own
  docstrings assert that specific bypasses were "proven" (`lines 77–79`, `246–256`),
  which means someone once ran the probe by hand — but nothing in the suite holds that
  knowledge. Two in-repo models exist for the fix:
  `no-split-01-cast-reads.test.ts:131–185` (synthetic offender + benign rows against
  the same regex constants) and `source-scan.test.ts:51` (plant a real offender).
  **Fix:** lift the seven regexes to module constants (four already are), then add one
  sibling `test()` per regex feeding a typed row list — offenders
  (`` new Error(`x ${cred.password}`) ``, `` new TypeError(`x ${r.accessToken}`) ``,
  `` new Error(`fill() failed: ${cred.password}`) ``) and benign rows
  (`` new Error(`git credential ${subcommand} timed out after ${timeoutMs}ms`) `` —
  the real text at `git-credential.ts:131`). This is the finding that would have
  caught the first pass's BLOCKER automatically.
- **[WARNING] `PHASE_35_ORCHESTRATOR_FILES` is a planning-artifact identifier** —
  `line 58`, used at `line 330`
  `.claude/rules/typescript-comments.md` forbids `Phase NN` references and "any other
  phrasing whose only purpose is to record which planning artifact authored the line".
  It is the only such token in this file set.
  **Fix:** rename to `DEVICE_FLOW_ORCHESTRATOR_FILES`.
- **[WARNING] Hand-rolled `stripComments`, the third of five copies** — `lines 63–65`
  Byte-identical in behavior to `source-scan.ts:42–46`. See the grading of the first
  pass's `reconcile-planner-purity.test.ts` finding below — this file is a second
  instance the first pass did not name.
- **[WARNING] The PROV-05 case title claims "every provider file" over a hardcoded
  two-entry list** — `line 283`, list at `lines 51–56`
  `PROVIDER_FILES` names `domain/auth-registry.ts` and `orchestrators/auth-host.ts`. The
  provider set is complete today (`credentialFrom` appears only in `auth-registry.ts`
  and the separately-gated `github-auth.ts`), but a `domain/gitlab-auth.ts` registered
  into `auth-registry.ts` would be ungated while the title still claims coverage.
  **Fix:** derive the set — scan every `domain/*auth*.ts` — or retitle to name the two
  files, so the gap is visible.

### `tests/architecture/integration-materialization-gate.test.ts` (clean list)

The first pass recorded "no findings at all" and called the sibling-target check
"genuinely comprehensive". It is not.

- **[WARNING] The sibling sweep omits the hooks bridge target and all three staging
  directories** — `lines 101–106`, `lines 123–128`
  The extension has five bridges (skills, commands, agents, mcp, hooks — ARCHITECTURE.md
  "Bridges"). `siblingTargets` checks four paths and never
  `locations.hooksDir` (declared at `persistence/locations.ts:89`), nor
  `agentsStagingDir` (`:52`), `skillsStagingDir` (`:62`), `commandsStagingDir` (`:64`),
  `sourcesDir` (`:72`) or `configJsonPath` (`:58`). A mutation in which
  `prepareStageMcpServers` or `commitPreparedMcp` creates `locations.hooksDir` survives
  the case untouched, and the hooks bridge is exactly the one whose staging semantics
  are least obvious (see the repo's own note that hooks are served from a staged copy).
  **Fix:** add `hooks: await pathExists(locations.hooksDir)`,
  `agentsStaging: …`, `skillsStaging: …`, `commandsStaging: …` to both the actual and
  expected objects, all `false`.
- **[WARNING] `prepared` is asserted one property at a time while the whole value is
  the promise** — `line 110`
  `assert.strictEqual(prepared.kind, "staged")` is the only check on the prepared
  handle; a wrong staging path, a wrong server set, or a dropped field is invisible.
  **Fix:** destructure the nondeterministic temp path out and
  `assert.deepStrictEqual(rest, { … })` against a hand-written literal, or assert the
  staged path with `assert.ok(prepared.stagedPath.startsWith(scopeRoot))` alongside the
  kind.
- **[WARNING] The case asserts three contracts its title promises none of** —
  `test("MCP-only staging materializes no agent, command, or skill target")`
  Besides the isolation claim, it pins `resolvePluginMcpServers`'s whole return shape
  (`line 109`) and `commitPreparedMcp`'s exact 300-byte output (`line 122`) — behavior
  owned by `tests/bridges/mcp/parse.test.ts` and `tests/bridges/mcp/stage.test.ts`.
  This is a judgment call, not a defect: the byte assertion is what makes "MCP *did*
  materialize, and only MCP" meaningful. Record the intent in the title
  (`"MCP-only staging writes mcp.json and materializes no other bridge target"`) rather
  than deleting the assertions.

### `tests/architecture/no-lifecycle-default-enabled-read.test.ts` (clean list)

- **[WARNING] The docstring's justification for keeping both patterns rests on a false
  premise** — `lines 39–43`
  "The short identifier is a strict suffix of the long one, and both characters at the
  join are word characters, so there is no word boundary between them." It is not a
  suffix: `applyDefaultEnabled` ends in `DefaultEnabled` (capital D), and the regexes
  carry no `i` flag. The conclusion ("removing either pattern leaves a real hole") is
  correct, but for the simpler reason that the two identifiers differ in case.
  **Fix:** replace the paragraph with "the two identifiers differ in case
  (`defaultEnabled` vs `applyDefaultEnabled`), and both patterns are case-sensitive, so
  neither matches inside the other; removing either leaves a real hole."
  Otherwise this file survived every mutation I tried — see "Still clean after attack".

### `tests/architecture/peer-floor.test.ts` (clean list)

- **[WARNING] The file already reads both manifests and does not check the one field
  that has historically drifted** — `lines 29–32`
  `package.json` `version` (`0.18.1`), `package-lock.json` `version` and
  `packages[""].version` are all in sync today, and nothing in the suite holds them
  there. The repo has a recorded history of `npm install` rewriting the lock, and the
  version-bump checklist treats package.json + lock + `EXTENSION_VERSION` as one
  atomic edit — only two thirds of which is gated
  (`extension-version-sync.test.ts` covers package.json ↔ `EXTENSION_VERSION`).
  **Fix:** add a third case in this file:
  `assert.strictEqual(lock.version, pkg.version)` and
  `assert.strictEqual(lock.packages[""].version, pkg.version)`.
- **[WARNING] Only one of the two floor-pinned peers is gated** — `line 17`
  `package.json` also declares `pi-subagents: ">=0.35.0"` (optional peer). FLOOR-01 pins
  `@earendil-works/pi-coding-agent` only. `@earendil-works/pi-tui` and `typebox` are
  `"*"` and correctly out of scope.
  **Fix:** convert both cases to data-driven form — one sibling `test()` per row over
  `[["@earendil-works/pi-coding-agent", ">=0.80.5"], ["pi-subagents", ">=0.35.0"]]`,
  title interpolating the row, per the data-driven-cases rule.
- **[WARNING] Cross-case dependency** — `line 36`
  The second case reads `pkgRange` without asserting it exists; its presence is only
  established by the first case. If the first is removed or skipped, the second
  compares `undefined` to `undefined` and passes vacuously when both files lose the
  entry.
  **Fix:** `assert.ok(pkgRange, …)` before the comparison, or fold both checks into the
  data-driven rows above.

### `tests/architecture/extension-version-sync.test.ts` (clean list)

- **[WARNING] The first case asserts nothing a wrong implementation can fail** —
  `lines 19–22`
  `typeof EXTENSION_VERSION === "string"` is compiler-guaranteed (the module exports a
  string literal, `shared/extension-version.ts:16`). `assert.match(/^\d+\.\d+\.\d+/)`
  is unanchored at the end and is subsumed by the second case once the value equals
  `pkg.version`. The value that can actually be malformed is `pkg.version`, which is
  never shape-checked.
  **Fix:** delete the first case and move the shape assertion into the second, applied
  to `pkg.version`:
  `assert.match(pkg.version, /^\d+\.\d+\.\d+(?:-[\w.]+)?$/)` then
  `assert.strictEqual(EXTENSION_VERSION, pkg.version)`.
- **[WARNING] The version literal is pinned in two files and both must be edited on
  every bump** — this file `line 27` and `tests/shared/extension-version.test.ts:8`
  (`const expectedVersion = "0.18.1";`). The pairing test re-pins the literal, adding
  nothing the drift guard does not already give, and doubling the bump edit surface.
  **Fix:** leave the drift guard here as the owner; reduce
  `tests/shared/extension-version.test.ts` to asserting the invariant
  (`EXTENSION_VERSION` equals the `version` field of `package.json`) or delete the
  duplicate literal from it. Cross-area — the change lands in `tests/shared/`.

## Export ownership census

Modules this area owns. `parse.ts`, `stage.ts` and `locations.ts` are reached only
incidentally here; their pairing owners are named so this census does not usurp them.

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `tests/architecture/source-scan.ts` | `REPO_ROOT` | — | **NO CASE** — consumed by `compat-01-no-expansion.test.ts:95`, `manifest-lookup-drift.test.ts:32`; value never asserted |
| `tests/architecture/source-scan.ts` | `stripComments` | `source-scan.test.ts:63` | owned (isolation only — its use *inside* `assertNoForbiddenSurface` is unproven, see BLOCKER above) |
| `tests/architecture/source-scan.ts` | `assertNoForbiddenSurface` | `source-scan.test.ts:17,30,51` | owned, partial — multi-offender accumulation, `describeViolation` payload and the non-ENOENT rethrow are all uncovered |
| `shared/extension-version.ts` | `EXTENSION_VERSION` | `tests/shared/extension-version.test.ts:6` (pairing owner) + `tests/architecture/extension-version-sync.test.ts:24` (drift gate) | owned twice — duplicate literal, see WARNING above |
| `bridges/mcp/parse.ts` | `parseMcpServers` | `tests/bridges/mcp/parse.test.ts` | owned elsewhere; this area never calls it directly |
| `bridges/mcp/parse.ts` | `resolvePluginMcpServers` | `tests/bridges/mcp/parse.test.ts`; incidentally `integration-materialization-gate.test.ts:84` | owned elsewhere — this area exercises only the `standalone`/wrapped arm |
| `bridges/mcp/stage.ts` | `prepareStageMcpServers` | `tests/bridges/mcp/stage.test.ts`; incidentally `integration-materialization-gate.test.ts:89` | owned elsewhere |
| `bridges/mcp/stage.ts` | `commitPreparedMcp` | `tests/bridges/mcp/stage.test.ts`; incidentally `integration-materialization-gate.test.ts:99` | owned elsewhere |
| `bridges/mcp/stage.ts` | `replacePreparedMcp` / `rollbackMcpReplacement` / `finalizeMcpReplacement` | `tests/bridges/mcp/stage.test.ts` | owned elsewhere — the module-scope `WeakMap` companion store is graded below |
| `persistence/locations.ts` | `locationsFor` | `tests/persistence/locations.test.ts` | owned elsewhere; used at `integration-materialization-gate.test.ts:31` |

Every gate file in this area is a leaf `*.test.ts` with no exports of its own, so the
census above is complete for the area.

## Branch census

Classified reachable-untested / unreachable / compiler-forced, per the brief.

**`tests/architecture/source-scan.ts`**

| Branch | Line | Class |
| --- | --- | --- |
| read succeeds → strip → match | 91–96 | covered (`source-scan.test.ts:51`); the *strip* step itself is not — see BLOCKER |
| ENOENT + path in `allowMissing` → `continue` | 80–85 | covered (`source-scan.test.ts:31`) |
| ENOENT + path absent from `allowMissing` → assertion fails | 81–84 | covered (`source-scan.test.ts:17`, `:39`) |
| non-ENOENT error → `throw err` | 88 | **reachable-untested** — `EISDIR` via a directory target, `EACCES` via permissions |
| `opts` defaults to `{}` | 70 | covered incidentally (two cases omit `opts`); never asserted as a default |
| `patterns` loop with ≥2 patterns | 92–96 | **reachable-untested** — every case passes a one-element array |
| ≥2 offenders accumulate before the assertion | 94 | **reachable-untested** — the "reports every offending file at once" promise |

**`tests/architecture/unit-suite-glob-completeness.test.ts`** (helper branches)

| Branch | Line | Class |
| --- | --- | --- |
| script name absent → `throw` | 57–59 | **reachable-untested** |
| a quoted non-`tests/` argument → `throw` | 65–70 | **reachable-untested**; the docstring at `lines 44–49` explains *why* the guard exists and still does not exercise it |
| zero `tests/` globs quoted → `throw` | 72–74 | **reachable-untested** |
| `match[1] ?? ""` fallback | 61 | **compiler-forced** — group 1 of `/"([^"]*)"/g` always participates; the `??` exists only for `string \| undefined` under `noUncheckedIndexedAccess`. Not removable; do not file as dead code (D-116-01a). |
| `entry.parentPath` / `split("/")[1] ?? ""` | 90–91 | **compiler-forced**, same reason |

Root cause for the three reachable-untested throws: `pathsMatchedByScript` reads
`package.json` itself (`line 52`) — a hidden dependency inside logic. The sanctioned
fix is to make it an explicit parameter (`pathsMatchedByScript(scriptText: string)`),
after which all three guards get a one-line case each with a synthetic script string.

**`tests/architecture/no-credential-leak.test.ts`** — four `if (!exists)` arms
(`116`, `145`, `297`, `336`) are reachable-untested *and* are themselves the defect;
see the BLOCKER above. `fullTemplateLiteralsAfter`'s `match[1] !== undefined` guard
(`line 85`) is **compiler-forced**.

**`bridges/mcp/parse.ts`** — branch census belongs to `tests/bridges/mcp/parse.test.ts`;
not re-derived here. I did verify one thing relevant to this area: the
`ENOENT`/`ENOTDIR` tolerance at `line 99` and the non-tolerated rethrow at `line 103`
are both reachable, and `integration-materialization-gate.test.ts` exercises neither
(it always writes a real `.mcp.json`).

## Grading of first-pass findings

### `tests/architecture/no-credential-leak.test.ts`

- **UNDERSTATED** — *"Four of seven AUTH-09 scans use the bounded-prefix regex this
  same file already proved bypassable"* — The finding is real and I reproduced it by
  execution: against the `line 131` regex,
  `` throw new Error(`fill() failed: ${cred.password}`) `` is **not** matched while
  `` throw new Error(`bad ${cred.password}`) `` is. But the recorded version treats it
  as one propagation gap. Four further holes in the same file are each independently
  sufficient (all filed as new BLOCKERs above): the four vacuous ENOENT skip paths, the
  missing camelCase `accessToken` in `FORBIDDEN_STATE_FIELDS`, the `new Error(`-only
  anchor against a file that already throws `new TypeError` at
  `github-auth.ts:213`, and the total absence of any negative control on all seven
  regexes. **The file should be treated as one security-gate rewrite, not one regex
  patch.** Adding the negative-control cases first would have surfaced all five holes
  mechanically.

### `tests/architecture/import-boundaries.test.ts`

- **CONFIRMED** — *"'npm run fallow runs dead-code unfiltered' is a static
  config-string check, not a planted-cycle test"* — Accurate, and the recorded WARNING
  severity is right. Worth noting in the fixing pass that this case is stronger than
  the summary implies: the `ALLOWED_DEAD_CODE_TOKENS` allow-list (`lines 172–186`) is
  the correct construction for the failure mode it names, and the live script
  (`fallow dead-code --fail-on-issues --format human && …`) tokenizes to exactly the
  six allowed tokens. The residual gap it cannot see (a `.fallowrc.json` change, a
  fallow version bump) is real but genuinely out of a `node --test` process's reach.
- **UNDERSTATED** — *"The zone-shape checks plus the canary do not verify the real
  project's `files` glob"* — Correct, and should rise to **BLOCKER**. The recorded
  version rates the risk "low today (the glob is simple)". The same root cause —
  `loadZones()` reading a raw config block instead of the resolved configuration —
  admits a strictly worse mutation the finding does not mention: a later flat-config
  block setting the rule to `"off"` leaves all three cases green with D-11 wholly
  unenforced. The recommended assertion ("a known real path matches the compiled
  `files` pattern") is also the wrong shape; the correct fix is
  `ESLint#calculateConfigForFile`, which closes the glob gap, the override gap and the
  unasserted `basePath` in one change.

### `tests/architecture/no-telemetry-deps.test.ts`

- **CONFIRMED** — *"`FORBIDDEN_DEP_PATTERNS` misses the real npm package name for
  Datadog's Node tracer"* — `dd-trace` contains no `datadog` substring; `analytics-node`
  contains no `segment` substring. Both fixes are correct as written. Add `@vercel/otel`
  and `elastic-apm-node` while the list is open.
- **New WARNING in the same file, not recorded:** the matcher has no negative control.
  Mutating `name.includes(banned)` (`line 51`) to `name === banned` leaves the case
  green while every scoped pattern (`@sentry/`, `@opentelemetry/`) stops matching
  forever. **Fix:** extract the loop into
  `function forbiddenDeps(names: readonly string[]): string[]` and add a sibling case
  asserting `forbiddenDeps(["@sentry/node", "dd-trace", "posthog-node"])` returns all
  three and `forbiddenDeps(["typebox", "isomorphic-git", "proper-lockfile"])` returns
  `[]`.

### `tests/architecture/reconcile-planner-purity.test.ts`

- **UNDERSTATED** — *"Hand-rolled `stripComments` duplicates the shared helper"* — Real,
  but there are **five** hand-rolled copies in `tests/architecture/`, not one:
  `manifest-read-seam.test.ts:27`, `reconcile-planner-purity.test.ts:47`,
  `no-credential-leak.test.ts:63`, `no-hooks-strict-additional-properties.test.ts:37`,
  `disabled-state-classification.test.ts:99` — against the six files that correctly
  import the shared one. Two of the five are in this area. Filed per-file, the fixing
  pass will do it five times and probably miss two; filed once, it is a single sweep.
  **Fix rule:** delete every local `stripComments` in `tests/architecture/` and import
  it from `./source-scan.ts`; where the surrounding loop is also a read/strip/match
  over a target list, replace it with `assertNoForbiddenSurface`.
- **New WARNING, not recorded:** `reconcile-planner-purity.test.ts`'s
  `platform/git` and `node:fs` patterns (`lines 32–34`) share the dynamic-import hole
  filed against `no-orchestrator-network.test.ts` above —
  `await import("node:fs/promises")` inside `plan.ts` defeats the DIFF-01 purity gate.
  Same one-line fix.

### Cross-cutting

- **CONFIRMED** — *"Non-strict `assert.equal`/`assert.deepEqual`"* — 29 sites across the
  ten files I re-counted. WARNING is the right severity: every compared value in this
  area is a string, string array, or boolean, so no realistic wrong implementation
  slips through `==`. Mechanical.
- **CONFIRMED** — *"Most files lack `// arrange` / `// act` / `// assert` phase
  comments"* — Holds. `unit-suite-glob-completeness.test.ts:96–107` and
  `integration-materialization-gate.test.ts:28–108` are the correct in-tree models.
  WARNING.
- **CONFIRMED** — *"`source-scan.ts` JSDoc verb phrases are not third-person"* —
  `line 35` "Strip …" → "Strips …", `line 49` "Read …" → "Reads …". Mechanical.

### `tests/architecture/unit-suite-glob-completeness.test.ts`

- **CONFIRMED** — the first pass's explicit assessment holds under re-verification. I
  independently re-derived both sides: `package.json`'s `test` and
  `test:coverage:unit` quote exactly the two globs the assessment names and nothing
  else (the five `--test-reporter*` arguments and the
  `${TEST_CONCURRENCY:+…}` expansion are unquoted, so the `foreign` guard does not
  trip), and `find tests -name "*.test.ts"` outside the nine roots plus
  `tests/index.test.ts` and the two separately-scripted roots returns nothing. Both
  cases are genuinely green over genuinely independent derivations. The caveat about
  reachability-not-execution is correctly stated. **Added:** the three throw branches
  in `pathsMatchedByScript` are untested and the package.json read is a hidden
  dependency — see the branch census.

### `extensions/pi-claude-marketplace/bridges/mcp/stage.ts`

- **CONFIRMED** — *"Module-level `WeakMap` used as a private companion store"* —
  `lines 44–51`. WARNING is right: it is a design note, not a defect, and the finding's
  own reasoning (fresh literal keys cannot collide across cases) is correct.
- **However the first pass listed the wrong defect as this file's headline.**
  `getMcpServers` (`stage.ts:93–100`) guards `undefined` and `Array.isArray` and does
  **not** guard `null` or a string. Reproduced by execution:
  `Object.entries(getMcpServers({ mcpServers: null }))` throws
  `TypeError: Cannot convert undefined or null to object`, and
  `getMcpServers({ mcpServers: "ab" })` yields `[["0","a"],["1","b"]]` — a scoped
  `mcp.json` whose `mcpServers` is a JSON string is silently rebuilt as a
  per-character server map at `line 215`. META-FINDINGS already owns this as a shipping
  bug; this is an independent second-angle confirmation from a different reviewer path.

### Production clean list

- **REFUTED (partially)** — *"`extensions/pi-claude-marketplace/persistence/locations.ts`
  — clean"* — I am not overturning the style verdict, but the file's central
  guarantee has no negative case anywhere in the repo: `SCOPED_LOCATIONS_BRAND`
  (`locations.ts:25`) exists so a hand-built object literal cannot type-check as
  `ScopedLocations`, and no `@ts-expect-error` proves that rejection.
  `tests/persistence/locations.test.ts:112–119,155–162` asserts the brand symbol is
  *present at runtime* — which is not the guarantee the brand is for. The gap is real;
  ownership belongs to `tests/persistence/locations.test.ts`, not to this area.
- **CONFIRMED** — `bridges/mcp/parse.ts` and `shared/extension-version.ts` carry no
  style defect I could find. Both are owned by their own pairing tests; I did not
  re-derive their branch censuses.

## Still clean after attack

- **`tests/architecture/no-lifecycle-default-enabled-read.test.ts`** — survives every
  mutation I tried, and is the best-constructed gate in the set. Both targets exist, so
  the WR-06 ENOENT failure is live (renaming `update.ts` fails the gate loudly, unlike
  the four skip paths in `no-credential-leak.test.ts`). Both patterns are `\b`-anchored
  identifiers with no bounded-prefix window, so the "literal `)` before the
  interpolation" bypass does not apply. Deleting either pattern leaves a real hole (the
  docstring's *reason* is wrong; its conclusion is right). Delegating to
  `assertNoForbiddenSurface` means comment stripping, the missing-target failure and
  the multi-offender message all come from one tested place. Only the docstring
  correction above applies.
- **`tests/architecture/unit-suite-glob-completeness.test.ts`** — catches the mutations
  that matter. Adding a `.test.ts` file outside the nine roots fails (the tree side
  finds it, the glob side does not). Narrowing a brace alternative fails. Quoting a
  non-glob argument into either script fails with a message naming the argument rather
  than a confusing file diff. Silently swapping `test:coverage:unit`'s glob for a
  different one fails, because both scripts are compared against the same
  independently-walked tree. Its two sides are genuinely non-derivative — this is the
  strongest file in the area.
- **`tests/architecture/source-scan.test.ts`'s WR-06 coverage** — the three missing-target
  mutations are all caught: a renamed target rejects, a per-path waiver does not become
  a blanket waiver, and a real offender inside a real file rejects. Over-stripping is
  also caught: making `stripComments` return `""` fails both the `line 51` case (the
  pattern stops matching) and the `line 63` case (`assert.match(stripped, /const ok = 1;/)`).
  Only *under*-stripping and multi-offender accumulation survive.
- **`tests/architecture/no-split-01-cast-reads.test.ts`'s regex proofs** —
  `lines 131–185` genuinely catch every pattern mutation I tried: loosening the cast
  regex to match a bare `Record<string, unknown>` cast fails on the benign rows;
  dropping the `(?!=)` negative lookahead from the assignment pattern fails on
  `if (mut.autoupdate == enable)`; tightening `\s*` fails on the no-space offender
  row. This is the correct construction and the model the other five gates should copy.
- **`tests/architecture/import-boundaries.test.ts`'s ledger scans** — the D-11
  ledger-import cases catch the direct mutations. Adding
  `import { addMarketplace } from "../marketplace/add.ts"` to `plugin/install.ts` fails;
  adding `import type { … } from "../plugin/update.ts"` to `marketplace/update.ts` fails
  (type-only imports carry `from`, so the stated "type-only imports are forbidden too"
  contract really holds); renaming a plugin ledger fails loudly via `readFile`; and the
  `assert.ok(files.length > 0)` guard at `line 234` means an empty marketplace walk
  cannot green the gate. Only the long-relative-path and dynamic-import forms escape.
- **`tests/architecture/no-shell-out.test.ts`'s whitelist assertion** — the sibling
  "exactly three files" case genuinely catches silent widening: adding a fourth entry
  to `ALLOWED_CHILD_PROCESS_FILES` without editing the expected array fails. That half
  of the file works.

## Not covered

- I did not run any command that executes the suite (`node --test`, `npm test`,
  `npm run check`), per the diagnostic constraint. Every "this mutation survives"
  verdict is a static trace of the scanning logic, **except** the credential-leak
  regexes and `getMcpServers`, which I verified by executing the extracted regex /
  function against synthetic strings in a throwaway `node -e` snippet that touched no
  repository file.
- Direct per-pair coverage (`npm run test:coverage:direct`) was not measured for any
  module in this area; the branch census above is from reading.
- I did not re-review the *targets* of the grep gates (`platform/git-credential.ts`,
  `domain/github-auth.ts`, `orchestrators/plugin/*.ts`, `orchestrators/reconcile/plan.ts`,
  `domain/resolver.ts`) under the style skill — each has its own pairing reviewer, and
  the first pass drew the same line. I read only the specific lines cited above.
- `tests/architecture/` holds 41 files; only the 14 named in this assignment were
  attacked. The `stripComments` duplication finding names three files outside this
  area (`manifest-read-seam`, `no-hooks-strict-additional-properties`,
  `disabled-state-classification`) that I located by grep but did not review.
- I did not attempt to determine whether `fallow dead-code` still reports cycles under
  the current `.fallowrc.json` — that requires running the tool.

## Meta-findings impact

### New cross-cutting evidence

**1. "Gates that do not gate" is larger than five instances, and the missing ingredient
is always the same one.** META-FINDINGS lists five. This area alone adds six more, and
they share a single root cause: **an absence assertion with no proof that the scan can
ever produce a non-empty result.** The instances here:

| Gate | What survives |
| --- | --- |
| `no-shell-out.test.ts` | walker mutated to yield nothing (204 files → 0); any of six regexes replaced with a non-matching one |
| `no-split-01-cast-reads.test.ts` | recursion removed (57 orchestrator files → 6) |
| `no-credential-leak.test.ts` | any of seven regexes replaced with a non-matching one; four targets silently skipped on ENOENT |
| `no-orchestrator-network.test.ts` | dynamic `import("…platform/git.ts")` — the form is already live at `orchestrators/plugin/fetch.ts:464` |
| `reconcile-planner-purity.test.ts` | same dynamic-import hole |
| `import-boundaries.test.ts` | a later flat-config block setting the rule `"off"`; a duplicated zone masking a deleted one |

The repo's own doctrine ("a gate wants a test that plants the violation, not one that
reads the config", CONVENTIONS.md) is stated for *config-reading* gates. The evidence
here is that it must be extended to **source-scanning** gates too: a scan that reads
zero bytes reports identically to a scan that reads everything. **Recommend
META-FINDINGS' "audit every architectural gate" workstream carry a concrete
acceptance criterion: every scanning gate must (a) assert it visited a named real file
or a plausible file count, and (b) carry synthetic offender/benign rows against its own
pattern constants.** Two in-repo reference implementations already exist —
`no-split-01-cast-reads.test.ts:131–185` for (b) and `import-boundaries.test.ts:234`
for (a).

Other areas to check for the same shape: every `tests/architecture/*.test.ts` file
outside this assignment that reads source and asserts an empty offender list. From the
grep of `stripComments` copies, at minimum `manifest-read-seam.test.ts`,
`no-hooks-strict-additional-properties.test.ts`, `disabled-state-classification.test.ts`,
`compat-01-no-expansion.test.ts`, `manifest-lookup-drift.test.ts`,
`config-state-write-seams.test.ts`, `scope-fences-63.test.ts` and
`partial-vocabulary-guard.test.ts`.

**2. Static gates that anchor on `new Error(` are systematically blind to this repo's
own error convention.** `no-credential-leak.test.ts` anchors four of its seven scans on
`new\s+Error\s*\(`. CONVENTIONS.md's "Error Handling" section makes typed `Error`
subclasses the house style, `shared/errors.ts` defines a dozen of them, and
`domain/github-auth.ts:213` already throws `new TypeError(...)`. **Any other area whose
gate or test greps for `new Error(` has the same blindness** — check
`notify-grammar-invariant.test.ts`, `partial-vocabulary-guard.test.ts` and any
`*.messaging.test.ts` that asserts error text by construction form rather than by
class. The fix rule is one substitution: `new\s+[A-Z]\w*Error\s*\(`.

**3. Doc comments in this repo drift in a third direction META-FINDINGS does not
record: they describe a mechanic that a *later decision* replaced.** META-FINDINGS
names two directions (a comment falsely claiming production use, and one honestly
admitting test-only status). This area found a third:
`no-orchestrator-network.test.ts:38–41` documents an ENOENT skip path that WR-06
deleted from the shared helper it now delegates to, and
`no-credential-leak.test.ts:23–27` documents the same retired design as current. Both
read as "coverage is optional here" when it is mandatory. **Any file that adopted a
shared helper after being written against a local one is a candidate** — the six files
importing `./source-scan.ts` are the population to check.

### Corrections to META-FINDINGS.md

- **"The `ScopedLocations` brand is never proven. … no `@ts-expect-error` negative
  exercises that rejection. A compile-time guarantee nothing verifies."** — Half right,
  and the half that is wrong matters for scoping the fix.
  `tests/persistence/locations.test.ts:112–119` and `:155–162` **do** assert the brand:
  `Object.getOwnPropertySymbols(locations)` has length 1 and
  `Reflect.get(locations, brandKeys[0]!) === true`. What is missing is only the
  *compile-time* negative (`@ts-expect-error` on a hand-built literal). Correction:
  the finding is "the brand's runtime presence is proven; its type-level rejection is
  not", which is a one-case addition, not an unverified guarantee.
- **"`tests/architecture/source-scan.ts` — 5 architecture files hand-roll their own
  `.ts` walker instead of using it."** — Two errors. First, `source-scan.ts` exports
  no walker at all (`REPO_ROOT`, `stripComments`, `assertNoForbiddenSurface` — nothing
  else), so there is nothing for those files to use; the recommendation as written
  cannot be executed. Second, the count of five belongs to a *different* duplication:
  five files hand-roll **`stripComments`** (`manifest-read-seam.test.ts:27`,
  `reconcile-planner-purity.test.ts:47`, `no-credential-leak.test.ts:63`,
  `no-hooks-strict-additional-properties.test.ts:37`,
  `disabled-state-classification.test.ts:99`). Correction: the propagation ticket is
  "delete five `stripComments` copies", and a *new* helper — a shared recursive `.ts`
  walker with a visited-count guard — has to be **written**, not adopted, before the
  three files that recursively walk a tree (`no-shell-out.test.ts`,
  `no-split-01-cast-reads.test.ts`, `config-state-write-seams.test.ts`) can share one.
- **`_AUDIT.md` counts for this area are low.** The first pass recorded 1 BLOCKER + 7
  WARNING here. This pass adds 10 BLOCKER + 30 WARNING and raises one existing WARNING
  to BLOCKER. If the ratio holds across other inert-gate areas, the "76 BLOCKER"
  working total is a floor, not an estimate — and the shortfall is concentrated
  precisely where clean verdicts were most confident.

### Confirmations

- **"Gates that do not gate" item 3 — `orchestrators/marketplace/list.ts` and
  `remove.ts` are not covered by the NFR-5 no-network gate, and `info.ts`'s header
  misattributes where its gate lives.** Confirmed from source, both halves.
  `no-orchestrator-network.test.ts`'s `FORBIDDEN_TARGETS` (`lines 67–112`) gates
  `marketplace/info.ts` and neither sibling; `marketplace/info.ts:5–6` names
  `tests/orchestrators/marketplace/info.test.ts` as its gate, and that file contains no
  grep gate (its only `readFile` calls, at `lines 2` and `157`, read fixture output).
  New evidence: `marketplace/list.ts:7–9` asserts in its own header that it has "NO
  gitOps surface (NFR-5 by construction)" — an unenforced claim, which is the strongest
  argument for adding both files to the target list.
- **"Real defects found outside the test layer" — `bridges/mcp/stage.ts`
  `getMcpServers` has no guard for `mcpServers: null` or a bare string.** Confirmed
  independently by execution against the extracted function:
  `Object.entries(getMcpServers({ mcpServers: null }))` throws
  `TypeError: Cannot convert undefined or null to object`;
  `getMcpServers({ mcpServers: "ab" })` returns the string, which
  `partitionExistingServers` (`stage.ts:109`) then enumerates as
  `[["0","a"],["1","b"]]`. The guard at `stage.ts:95` covers `undefined` and
  `Array.isArray` only. Reached from `prepareStageMcpServers` at `stage.ts:215`.
  Shipping bug; the sequencing recommendation (fix it first) is right.
- **"Gates that do not gate" item 4 — `import-boundaries.test.ts`: a static
  config-string check stands in for a real planted-cycle test.** Confirmed, with the
  qualification that the `ALLOWED_DEAD_CODE_TOKENS` allow-list is a sound design for
  the failure mode it names, and the live `fallow` script tokenizes to exactly the six
  allowed tokens. The un-gated residue (a `.fallowrc.json` edit, a fallow version bump)
  is genuinely outside a `node --test` process's reach; the accepted-gap framing in the
  first-pass file is fair.
- **"The dominant shape: sibling drift."** Confirmed as the dominant shape here too,
  and with an unusually clean instance: within one file,
  `no-credential-leak.test.ts:43` uses `access_token` while the same file's other six
  scans use `access_?token` — sibling drift across sibling *lines*, not just sibling
  files. Every finding in this area names an in-repo target for its fix, which supports
  META-FINDINGS' cost conclusion that the work is propagation rather than invention.
