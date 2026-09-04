# Shared — errors, path safety, atomic JSON, fs utils, classifiers — adversarial re-review

**Scope:** every file on the first pass's two `### Clean files` lists (13 test
modules, 13 production modules), plus the paired production module for each, plus
a re-grade of the 9 findings the first pass recorded. `notify.ts` /
`tests/shared/notify.test.ts` and `shared/concerns/**` stay out of scope.
**First-pass file:** `unit-test-findings/shared-core.md`
**Clean files attacked:** 26 (13 test + 13 production)
**Existing findings graded:** 9

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 1 |
| New WARNING (missed by first pass) | 17 |
| Existing CONFIRMED | 6 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 2 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's characterisation of this area as broadly healthy **holds**. Most
of what I attacked survived: whole-value `deepStrictEqual`, byte-level file
assertions, boundary rows on every numeric limit, planted `assertNever`
violations, freeze/defensive-copy proofs, and one exhaustive 2^4 truth table. But
"0 test blockers" was wrong at the one place it mattered most: the NFR-10
containment chokepoint has an unproven precondition, and I have a demonstrated
escape.

## New findings — from the clean lists

### `extensions/pi-claude-marketplace/shared/path-safety.ts` + `tests/shared/path-safety.test.ts`

- **[BLOCKER] `assertPathInside` skips the real path components when `child` is
  not normalized; no case plants a `..` segment** — `path-safety.ts:90`,
  `tests/shared/path-safety.test.ts` (whole file, 12 cases).

  `assertPathInside` computes the walk from `path.relative(parent, child)`, which
  collapses `..` **lexically**. `path.relative("/p", "/p/a/../b")` is `"b"`, so
  the symlink walk lstats only `/p/b` and never looks at `/p/a`. The OS resolves
  the same string **physically**: if `/p/a` is a symlink, the write lands outside
  `/p`. Verified with a real filesystem:

  ```
  parent = <tmp>/p ; <tmp>/p/a -> <tmp>/elsewhere
  path.relative(parent, parent + "/a/../b")  ===  "b"        // check says "inside"
  fs.writeFileSync(parent + "/a/../b", ...)  ->  <tmp>/b     // landed OUTSIDE parent
  ```

  So the suite's strongest claim — D-14 "refuse ALL symlinks", proved by the
  three `refuses a symlink in the {first,intermediate,final} walked segment`
  cases at lines 240-303 — is true only for lexically-normalized `child`
  arguments. That precondition is stated nowhere: not in the function's 20-line
  doc comment (lines 54-75, which documents TOCTOU but not this), not in a
  runtime check, and not in any case.

  **Reachability, stated honestly:** every production caller I traced builds
  `child` with `path.resolve`/`path.join` first — `domain/resolver.ts:989`,
  `domain/resolver.ts:1104`, `shared/fs-utils.ts:247`,
  `persistence/locations.ts:226-275` — so `child` arrives already normalized and
  the hole does not fire **today**. This is a chokepoint whose safety currently
  rests on a convention every one of its ~30 call sites happens to follow, with
  nothing enforcing it. `domain/resolver.ts:998` makes it worse by returning
  `{ ok: true, relative: raw }` — the *unnormalized* author string — after
  validating the normalized one.

  **Fix (two parts, both required):**
  1. In `path-safety.ts`, make the precondition enforced rather than assumed. At
     the top of `assertPathInside`, add
     `const resolvedChild = path.resolve(child);` and use `resolvedChild` for
     both `isPathInside` and the walk; or, if callers must keep passing exact
     strings, throw `PathContainmentError` when
     `path.resolve(child) !== child`. Prefer the first — it keeps every existing
     caller green because they already pass resolved paths.
  2. In `tests/shared/path-safety.test.ts`, add a case
     `test("refuses a symlinked component hidden behind a parent traversal", ...)`
     that builds `<dir>/a -> <externalDir>`, calls
     `assertPathInside(dir, path.join(dir, "a") + "/../b", "traversal target")`
     and asserts a `SymlinkRefusedError` naming `<dir>/a` — mirroring the
     `expectedError` object shape already used at lines 270-277. Today that call
     resolves clean.

- **[WARNING] The equal-boundary case does not pin that the walk is empty** —
  `tests/shared/path-safety.test.ts:82` (`accepts a parent as its own child boundary`).

  Surviving mutation: change `path-safety.ts:91` from
  `const segments = relative === "" ? [] : relative.split(path.sep);` to
  `const segments = relative.split(path.sep);`. When `relative` is `""`,
  `"".split("/")` is `[""]`, `path.join(parent, "")` is `parent`, and the walk
  lstats `parent` itself — contradicting the "the boundary itself is trusted"
  decision at lines 87-89 and breaking any caller whose `parent` sits under a
  symlinked tmpdir. The case only records `assert.strictEqual(actualError, undefined)`,
  so it stays green.

  **Fix:** give this case the same `lstatPaths` recorder the two sibling cases at
  lines 157-173 and 183-203 already use, and assert
  `assert.deepStrictEqual(lstatPaths, [])`.

- **[WARNING] Four cases patch the `node:fs/promises` builtin and call
  `syncBuiltinESMExports()`; the sibling `fs-utils.ts` shape needs neither** —
  `tests/shared/path-safety.test.ts:163, 189, 316, 361`.

  `path-safety.ts:1` uses named imports (`import { lstat, readlink } from "node:fs/promises"`),
  so a test cannot reach those bindings without re-syncing the builtin ESM
  namespace — which is the `t.mock.module()`/loader-trick class the rules forbid,
  and a process-global mutation.

  **The sibling next door already avoids it.** `shared/fs-utils.ts:21` imports
  `fs from "node:fs/promises"` and calls `fs.lstat` / `fs.rm` / `fs.rename`, so
  `tests/shared/fs-utils.test.ts` patches with a bare
  `t.mock.method(fs, "rm", …)` — **eight times, with zero `syncBuiltinESMExports`
  calls** (lines 64, 76, 134, 220, 325, 329, 414, 429, 602, 690).

  **Fix (mechanical):** change `path-safety.ts:1` to
  `import fs from "node:fs/promises";`, call `fs.lstat(current)` at line 110 and
  `fs.readlink(current)` at line 141, then delete the `syncBuiltinESMExports`
  import and all four call sites plus their `t.mock.restoreAll()` wrappers from
  the test. Note this is a repo-wide pattern (13 test files) — see
  "Meta-findings impact".

### `extensions/pi-claude-marketplace/shared/fs-utils.ts` + `tests/shared/fs-utils.test.ts`

- **[WARNING] `isPlainMarkdownFile`'s symlink `lstat` is unreachable for both
  production callers, and two doc comments claim the opposite** —
  `fs-utils.ts:311-312`, comment at `fs-utils.ts:296-304`, mirrored comment at
  `bridges/commands/discover.ts:257-261`, test at `tests/shared/fs-utils.test.ts:658`.

  Both callers pass the dirent's own directory: `bridges/agents/discover.ts:76`
  passes `agentsDir`, `bridges/commands/discover.ts:264` passes `dir`. Verified
  empirically that `readdir(..., { withFileTypes: true })` reports a symlink as
  `isFile() === false, isSymbolicLink() === true` (for a link to a file **and**
  to a directory). So the `!entry.isFile()` guard at line 307 already refuses
  every symlink, and control never reaches the `lstat` at 311.

  `fs-utils.ts:302-304` states "The agents bridge has no Dirent-level symlink
  check and depends on the `lstat`" — false; `isPlainMarkdownFile`'s own
  `entry.isFile()` **is** that check. `bridges/commands/discover.ts:260-261`
  repeats the same claim.

  The only test that reaches the branch (`rejects a markdown entry whose path is
  a symbolic link`, line 658) does so by reading the dirent from
  `sourceDirectory` and passing `linkedDirectory` as `dir` — a dirent/directory
  mismatch no caller produces. This is the "test propping up unreachable
  defensive code" class META-FINDINGS lists under Decisions #1; this is a new
  instance in a file both passes called clean.

  **Fix:** operator decision, then one of —
  (a) keep the `lstat` as deliberate TOCTOU hardening: rewrite the two comments
  to say *that* (the entry could be replaced between `readdir` and the check),
  and retitle the case to `re-checks the entry with lstat after readdir`;
  (b) delete lines 311-312 and return the first-guard result, delete the case,
  and correct `bridges/commands/discover.ts:257-261`.
  Either way both comments must stop asserting the agents bridge depends on it.

- **[WARNING] `pathExists`'s stated "does NOT follow symlinks" contract has no
  case** — `fs-utils.ts:54-73`, `tests/shared/fs-utils.test.ts:88-142`.

  Four cases cover present/missing/ENOTDIR/EACCES. None covers the property the
  doc comment names as the module's reason for existing (PS-1 parity). The
  discriminating input is a **dangling** symlink: `lstat` succeeds → `true`;
  `stat` would raise ENOENT → `false`.

  **Fix:** add
  `test("reports a dangling symbolic link as present", …)` — `fs.symlink(path.join(directory, "absent"), link)`
  then `assert.strictEqual(await pathExists(link), true)`.

### `extensions/pi-claude-marketplace/shared/errors.ts` + `tests/shared/errors.test.ts`

- **[WARNING] Three error classes hand out the caller's array; three siblings
  freeze a defensive copy — and the tests pin the aliasing as the contract** —
  `errors.ts:284` (`CrossPluginConflictError`), `errors.ts:370`
  (`PluginUpdatePhase3Error`), `errors.ts:399` (`ManualRecoveryError`); pinned by
  `tests/shared/errors.test.ts:700, 716, 857, 882, 907, 937, 952`.

  The siblings that copy: `errors.ts:613`
  (`AggregateResourcesDiscoverError`, `Object.freeze([...failures])`),
  `errors.ts:421` (`errorWithManualRecovery`'s merge path),
  `errors-bridges.ts:68-69` (`AgentOwnershipConflictError`). Those three are
  proved with `Object.isFrozen` + `notStrictEqual` (errors.test.ts:1465-1466,
  1491-1492, 1520-1521; errors-bridges.test.ts:235-293).

  The mutation catalogue's "return a shared reference where a clone is promised"
  fires here and the suite *blesses* it: `assert.strictEqual(error.conflicts, conflicts)`
  is an explicit assertion that no copy is made. It matters for
  `ManualRecoveryError.leaks`, which `shared/notify.ts` reads to name the leaked
  paths on the user-visible AS-7 row — a caller that mutates its array after
  throwing changes what the user is told.

  **Fix:** make the three aliasing constructors mirror `errors.ts:613`
  (`this.conflicts = Object.freeze([...conflicts]);` etc.), then flip the seven
  `assert.strictEqual(error.X, input)` lines above to the
  `Object.isFrozen(...) === true` + `assert.notStrictEqual(error.X, input)` pair
  already used at errors.test.ts:1465-1466, and add one push-after-construct case
  per class copied from `freezes a defensive copy while preserving all
  discriminator arms and duplicates` (line 1495).

- **[WARNING] `linkMessage`'s non-Error, non-string branch is only exercised with
  a plain object, so a hard-coded `"[object Object]"` survives** —
  `errors.ts:122`, `tests/shared/errors.test.ts:217-227`.

  The only input is `{ detail: "inner" }`. Replacing
  `Object.prototype.toString.call(c)` with the literal `"[object Object]"` leaves
  every case green, while a `null`, numeric, or array cause would then render
  wrongly.

  **Fix:** turn the case at line 217 into a typed row loop and add rows for
  `cause: null` → `"cause: outer -> [object Null]"`, `cause: 42` →
  `"cause: outer -> [object Number]"`, and `cause: ["a"]` →
  `"cause: outer -> [object Array]"`.

- **[WARNING] The `causeChainTrailer` doc comment's non-Error clause says
  nothing** — `errors.ts:77-80`.

  It reads "renders as `[object Object]`, never `[object Object]` with `String()`
  coercion" — the same string on both sides of a contrast. The real point is that
  `@typescript-eslint/no-base-to-string` forbids `String()` on an `unknown` that
  may carry a custom `toString`.

  **Fix:** replace with one sentence naming the rule and the reason, e.g.
  "renders via `Object.prototype.toString.call(c)`; `String(c)` on an `unknown`
  is forbidden by `@typescript-eslint/no-base-to-string` and would run a
  caller-supplied `toString`."

### `extensions/pi-claude-marketplace/shared/errors-bridges.ts` + `tests/shared/errors-bridges.test.ts`

- **[WARNING] `AgentOwnershipConflictError` freezes only the top level; the
  nested `owner` objects stay caller-mutable and untested** —
  `errors-bridges.ts:68`, `tests/shared/errors-bridges.test.ts:235`
  (`copies mutable top-level constructor inputs`).

  `Object.freeze([...conflicts])` copies the array but shares every element.
  The case honestly says "top-level" and only mutates `stagingFor` fields and
  pushes to the array; mutating `conflicts[0].owner.plugin` after construction
  changes `error.conflicts[0].owner.plugin`. `.message` is composed in the
  constructor so it is safe — only the structured payload aliases.

  **Fix:** add to the existing case, after line 249,
  `conflicts[0].owner.marketplace = "changed";` and keep the current expected
  object. If it then fails, change `errors-bridges.ts:68` to
  `Object.freeze(conflicts.map((c) => Object.freeze({ ...c, owner: Object.freeze({ ...c.owner }) })))`.

- **[WARNING] The `path.dirname` rationale comment is false on the platform the
  suite runs on, and nothing tests it** — `errors-bridges.ts:29-30`.

  "Use `path.dirname` rather than `lastIndexOf` so cross-platform separators
  (Windows backslashes) parse correctly" — `path.dirname` is platform-*specific*.
  Verified on this Linux host: `path.dirname("C:\\scope\\agents\\foreign.md")`
  returns `"."`, not `"C:\\scope\\agents"`. Only `path.win32.dirname` does what
  the comment claims. Both test cases (lines 23, 57) use POSIX paths.

  **Fix:** reword to the true rationale — "`path.dirname` applies the host
  platform's separator rules; `lastIndexOf('/')` would not" — and drop the
  cross-platform claim, or make it true with `path.win32`/`path.posix` handling
  plus a case.

### `tests/shared/atomic-json.test.ts`

- **[WARNING] No non-ASCII payload, so the `encoding: "utf8"` option is
  unpinned** — `atomic-json.ts:27`, `tests/shared/atomic-json.test.ts` (all 8 cases).

  Every case writes ASCII. Changing `encoding: "utf8"` to `"latin1"` leaves all
  eight green, while `"café"` would go to disk as `0xE9` instead of `0xC3 0xA9`.
  The rule "when bytes are the contract, the complete bytes are compared" is
  followed in form but the encoding axis is never varied.

  **Fix:** add
  `test("writes non-ASCII values as UTF-8 bytes", …)` writing
  `{ label: "café — 日本" }`, reading with
  `readFile(filePath)` (no encoding argument) and comparing to
  `Buffer.from('{\n  "label": "café — 日本"\n}\n', "utf8")` with
  `assert.deepStrictEqual`.

- **[WARNING] The concurrency case's title promises atomicity it does not
  discriminate** — `tests/shared/atomic-json.test.ts:39`
  (`keeps every concurrent same-path observation as one complete document`).

  Replacing `writeFileAtomic` with plain `fs.writeFile` leaves this case green:
  the payloads are ~60 bytes, one `write()` each, so no interleaving is possible
  regardless of the library. The case proves "the file holds one of the three
  documents", not NFR-1.

  **Fix:** either make each `content` large enough to tear a non-atomic write
  (e.g. `{ writer: "first", filler: "x".repeat(1_048_576) }`, expectations built
  with the same literal), or rename the case to
  `leaves one complete document after concurrent same-path writes` so the title
  matches what it checks.

### `extensions/pi-claude-marketplace/shared/notify-context.ts` + `tests/shared/notify-context.test.ts`

- **[WARNING] `notifyUpdateWithContext` is never called with
  `cardinality: "single"`** — `notify-context.ts:201`,
  `tests/shared/notify-context.test.ts:276`.

  The three tally rows all pass `"plural"`. Hard-coding
  `cardinality: "plural"` inside `notifyUpdateWithContext` (line 210) survives
  every case, so nothing proves the parameter is threaded rather than assumed.

  **Fix:** add a fourth row to the loop at line 251 carrying
  `cardinality: "single"` and the expected message with **no** trailing
  `Plugin update: N updated` line, and pass the row's cardinality at line 276.

- **[WARNING] `dispatchRow` mutates the caller's row object as a side effect of
  rendering** — `notify-context.ts:327`.

  `(p as { severity?: "error" }).severity = "error";` writes through a cast to a
  field the type declares `readonly`, on data owned by the caller, from inside a
  function whose job is to produce a string. It is documented (lines 320-332) and
  the contract is asserted (`tests/shared/notify-context.test.ts:373`), so this is
  a design note rather than a latent bug — but it is the one place in this area
  where a cast defeats a `readonly` declaration.

  **Fix (if the operator wants it):** change `dispatchRow` to return
  `{ line: string; severityFloor?: "error" }` and have `emitContextCascade`'s
  reducer apply the floor, removing the write and the `try`/`catch` around it;
  then the frozen-row case at line 392 becomes a plain input rather than an
  exception path. Leave as-is otherwise — do not "fix" it by widening the type.

### `tests/shared/probe-classifiers.test.ts` and `tests/shared/git-failure-classifiers.test.ts` (grouped)

- **[WARNING] Two classifier type-guards have no negative row, so removing the
  guard survives** — `probe-classifiers.ts:54`, `git-failure-classifiers.ts:79`.

  1. `narrowProbeError` — no input is a **non-Error carrying `.code`**. Deleting
     the `err instanceof Error` guard at line 54 leaves all 15 cases green (the
     string/number/undefined rows have no `.code`), while
     `narrowProbeError({ code: "ENOENT" })` would flip from `"unreadable"` to
     `"source missing"`.
  2. `classifyGitTransportFailure` — no input carries `data.statusCode` **without**
     `code === "HttpError"`. Dropping the `code === "HttpError"` conjunct at line 79
     leaves all 24 cases green.

  **Fix:** add one row each. To the loop at `probe-classifiers.test.ts:468`, add
  `{ thrown: { code: "ENOENT" }, label: "a plain errno-shaped object" }`. To the
  loop at `git-failure-classifiers.test.ts:203`, add
  `{ title: "leaves a non-HTTP error carrying a status unclassified", createFailure: () => Object.assign(new Error("x"), { code: "OtherError", data: { statusCode: 401 } }) }`.

### `tests/shared/markers.test.ts` and `tests/shared/extension-version.test.ts` (grouped)

- **[WARNING] Both pair tests duplicate an architecture drift guard byte-for-byte** —
  `tests/shared/markers.test.ts:11, 24` vs `tests/architecture/markers-snapshot.test.ts:56, 60+`;
  `tests/shared/extension-version.test.ts:8` vs `tests/architecture/extension-version-sync.test.ts:19-27`.

  `markers-snapshot.test.ts:56` already asserts
  `markers.RECOVERY_PLUGIN_REINSTALL_PREFIX === "plugin-uninstall + plugin-install for"`
  — the identical literal the pair test asserts. `extension-version.test.ts`
  hard-codes `"0.18.1"`, adding a fourth site to the release bump checklist
  (`package.json`, `sonar-project.properties`, `EXTENSION_VERSION`, this test)
  while `extension-version-sync.test.ts` already proves lockstep with
  `package.json`.

  **Fix, without weakening anything:** move ownership to the pair tests (the
  pairing rule says the pair test owns the module's exported behavior). Have
  `tests/shared/extension-version.test.ts` read `package.json` and compare —
  taking over `extension-version-sync.test.ts`'s job, which then deletes,
  dropping the bump sites from four to three. Have
  `markers-snapshot.test.ts` keep only the three `bridges/agents/marker.ts`
  constants it uniquely covers and drop its two `shared/markers.ts` re-pins.
  Also note `markers-snapshot.test.ts` uses loose `assert.equal` throughout —
  owned by the architecture area, flagged here only because it duplicates my
  area's assertions.

### `tests/shared/completion-cache.test.ts` (not on the clean list; new findings)

- **[WARNING] Two exports exist only for the test, and the cases that use them
  snapshot a third-party library's output** —
  `completion-cache.ts:65` and `:87`, `tests/shared/completion-cache.test.ts:24-86`.

  `MARKETPLACE_NAMES_CACHE_SCHEMA` and `PLUGIN_INDEX_CACHE_SCHEMA` are consumed
  nowhere outside their own module except by the test (grep-verified across
  `extensions/` and `tests/`) — the same "export added for a test" shape as
  `resetCompletionCache`, and the style rule "every export is used outside its
  module". The two cases assert typebox's compiled **JSON Schema serialization**
  via `JSON.parse(JSON.stringify(SCHEMA))`, which is a snapshot in disguise: a
  typebox upgrade that changes `anyOf` to `enum` reddens them with no behavior
  change.

  They are not deletable as-is, though: they are the **only** coverage of three
  of the nine status literals — `partially-installed-upgradable`,
  `partially-upgradable`, and `unavailable` never appear in a behavioral case.

  **Fix:** replace both cases with one data-driven loop over the nine status
  literals — each row writes a disk cache
  `{"schemaVersion":6,"lastRefreshedAt":"2026-08-29T12:00:00.000Z","plugins":[{"name":"row","status":"<literal>"}]}`
  and asserts `getPluginIndex` returns `[{ name: "row", status: "<literal>" }]`
  with an injected clock, mirroring the existing `accepts a <name> plugin cache`
  loop at line 542. Add one negative row for a bogus status (already covered at
  line 505). Then unexport both constants.

- **[WARNING] Two production guards are behaviorally no-ops, and their comments
  justify code that does nothing** — `completion-cache.ts:232` and `:362-366`.

  1. `Number.isFinite(loadedAt) && now() - loadedAt <= TTL` — when `Date.parse`
     yields `NaN`, `NaN <= TTL` is already `false`. Removing `Number.isFinite`
     changes no result.
  2. The `r.version === undefined` strip, commented "so the on-disk shape matches
     the schema's `Type.Optional` convention (omit, not null)" — `JSON.stringify`
     (which `atomicWriteJson` uses) already omits `undefined`-valued keys, so
     both branches produce identical bytes.

  **Fix:** collapse `pluginIndexFileIsFresh` to
  `return now() - Date.parse(result.lastRefreshedAt) <= PLUGIN_INDEX_TTL_MS;`
  and `plugins: rows.map((r) => ({ name: r.name, status: r.status, version: r.version }))`,
  deleting both comments. The existing `rebuilds a cold plugin index` case
  (line 288) already pins the resulting bytes for both a with-version and a
  without-version row, so it guards the simplification.

## Export ownership census

Every export of every paired production module in scope, mapped to its owning
case. **No unowned export found**; two exports are owned only by the test.

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `path-safety.ts` | `PathContainmentError` | `path-safety.test.ts:16` | owned |
| `path-safety.ts` | `SymlinkRefusedError` | `path-safety.test.ts:45, 240-303` | owned |
| `path-safety.ts` | `assertPathInside` | `path-safety.test.ts:82-374` | owned |
| `atomic-json.ts` | `atomicWriteJson` | `atomic-json.test.ts:9-139` | owned |
| `errors.ts` | `errorMessage` | `errors.test.ts:112, 123` | owned |
| `errors.ts` | `isErrnoException` | `errors.test.ts:136-178` | owned |
| `errors.ts` | `assertNever` | `errors.test.ts:182`; planted at `1420` | owned |
| `errors.ts` | `causeChainTrailer` | `errors.test.ts:194-292` | owned |
| `errors.ts` | `composeErrorWithCauseChain` | `errors.test.ts:295, 306` | owned |
| `errors.ts` | `appendLeakToError` | `errors.test.ts:319-355` | owned |
| `errors.ts` | `appendLeaks` | `errors.test.ts:359-405` | owned |
| `errors.ts` | `errorWithManualRecovery` | `errors.test.ts:957-1078` | owned |
| `errors.ts` | `findManualRecoveryError` | `errors.test.ts:1082-1149` | owned |
| `errors.ts` | `manualRecoveryLeaks` | `errors.test.ts:1153-1212` | owned |
| `errors.ts` | 14 error classes | `errors.test.ts:408-1523` | owned (class + every field) |
| `errors.ts` | `Phase3Failure`, `PluginShapeErrorShape`, `PluginShapeErrorKind`, `ResourcesDiscoverFailure` | `errors.test.ts:38-109` | owned (`satisfies` + `@ts-expect-error`) |
| `errors-bridges.ts` | 5 classes + `AgentOwnershipConflict` | `errors-bridges.test.ts:15-487` | owned |
| `fs-utils.ts` | `cleanupStaging` | `fs-utils.test.ts:30-86` | owned |
| `fs-utils.ts` | `pathExists` | `fs-utils.test.ts:88-142` | owned |
| `fs-utils.ts` | `removeOrphanIfPresent` | `fs-utils.test.ts:144-228` | owned |
| `fs-utils.ts` | `rollbackReplacementCommon` | `fs-utils.test.ts:230-454` | owned |
| `fs-utils.ts` | `resolveGitSubdirRoot` | `fs-utils.test.ts:456-535` | owned |
| `fs-utils.ts` | `readDirEntriesTolerant` | `fs-utils.test.ts:537-610` | owned |
| `fs-utils.ts` | `isPlainMarkdownFile` | `fs-utils.test.ts:612-698` | owned (symlink arm artificial — see finding) |
| `fs-utils.ts` | `RollbackReplacementInput` / `…Labels` | `fs-utils.test.ts:23, 246` (`satisfies`) | owned |
| `probe-classifiers.ts` | `narrowProbeError`, `narrowResolverNotes`, `narrowUnsupportedKinds`, `UnsupportedReason`, `ResolverNoteReason` | `probe-classifiers.test.ts` | owned |
| `git-failure-classifiers.ts` | `classifyGitTransportFailure`, `classifyGitSourceAccessFailure` | `git-failure-classifiers.test.ts` | owned |
| `notify-reasons.ts` | `skipSeverity`, `companionSeverity`, `malformedReasonsForKinds`, `FailureReason`, `DegradeKind`, `_ReasonsCoverageProof` | `notify-reasons.test.ts:13-324` | owned |
| `notify-context.ts` | `notifyWithContext`, `notifyUpdateWithContext`, `notifyUpdateNoOpWithContext`, `notifyReconcileAppliedWithContext` | `notify-context.test.ts:156-463` | owned |
| `notify-context.ts` | `RenderFn`, `CommandContext`, `Single`, `Plural`, `WithPlugins`, `MarketplaceRows` | `notify-context.test.ts:40-85` | owned (`satisfies` + 4 `@ts-expect-error`) |
| `session-env.ts` | `claudeSessionEnvFor`, `applySessionEnv`, `PATH_LEDGER_ENV`, `applyPathLedger` | `session-env.test.ts:12-283` | owned |
| `vars.ts` | `substituteClaudeVars`, `ClaudePluginVars` | `vars.test.ts:9-169` | owned |
| `markers.ts` | `RECOVERY_PLUGIN_REINSTALL_PREFIX`, `STATE_LOCK_HELD_PREFIX` | `markers.test.ts:9, 22` | owned (duplicated by architecture guard) |
| `types.ts` | `Scope`, `SCOPES` | `types.test.ts:6-22` | owned |
| `extension-version.ts` | `EXTENSION_VERSION` | `extension-version.test.ts:6` | owned (duplicated by architecture guard) |
| `debug-log.ts` | `hookDebugLog` | `debug-log.test.ts:6-115` | owned |
| `completion-cache.ts` | `MARKETPLACE_NAMES_CACHE_SCHEMA` | `completion-cache.test.ts:25` | **TEST-ONLY export** |
| `completion-cache.ts` | `PLUGIN_INDEX_CACHE_SCHEMA` | `completion-cache.test.ts:43` | **TEST-ONLY export** |
| `completion-cache.ts` | `resetCompletionCache` | `completion-cache.test.ts:883` + 7 other test files | **TEST-ONLY export** |
| `completion-cache.ts` | all other exports | `completion-cache.test.ts` | owned |

Pairing is complete: all 17 modules under `shared/` have a `tests/shared/*.test.ts`
counterpart at the mirrored path. No pairing gap in this area.

## Branch census

Classified per the brief's three categories.

**Reachable and untested — findings above:**
- `path-safety.ts:90-91` — walk over an unnormalized `child` (BLOCKER).
- `fs-utils.ts:63` — `pathExists` on a dangling symlink.
- `probe-classifiers.ts:54` — non-Error carrying `.code`.
- `git-failure-classifiers.ts:79` — `data.statusCode` without `code === "HttpError"`.
- `errors.ts:122` — non-Error, non-string, non-plain-object causes.
- `completion-cache.ts:321` — `isPoisoned` with a **non-empty** `plugins` array
  (production discards the rows and returns `[]`; no case).
- `notify-context.ts:201` — `cardinality: "single"` on the update wrapper.

**Unreachable by real input:**
- `path-safety.ts:50` — `!path.isAbsolute(relative)`. `path.relative` never
  returns an absolute path on POSIX; only a Windows cross-drive pair does. Not
  testable on the CI target; leave it, do not add a prototype-patching test.
- `fs-utils.ts:311-312` — the symlink `lstat` (see finding: both callers'
  dirents are pre-filtered by `entry.isFile()`).
- `vars.ts:46` — the regex-metacharacter escaper. No current `TOKEN_TO_FIELD` key
  contains a metacharacter, and a test cannot add one to a production `as const`.
  Defensive-by-design; the comment at lines 33-36 claims a property the public
  API cannot demonstrate. Leave both in place.

**Behaviorally redundant (removal is unobservable — not dead, but not load-bearing):**
- `path-safety.ts:126-128` — `if (err instanceof PathContainmentError) throw err;`.
  Deleting it changes nothing: a `SymlinkRefusedError` has no `.code`, so it
  falls through to the `throw err` at line 135 anyway. Keep as documentation.
- `completion-cache.ts:232` — `Number.isFinite(loadedAt)` (see finding).
- `completion-cache.ts:362-366` — the `undefined` version strip (see finding).
- `errors.ts:17` — `"code" in err` alongside `typeof … === "string"`.

**Compiler-forced (D-116-01a category), correctly handled:**
- `errors.ts:185-187` — `if (mpName !== undefined) { this.mpName = mpName; }`
  exists because `exactOptionalPropertyTypes` rejects the direct assignment. It
  does **not** make the property absent, and
  `tests/shared/errors.test.ts:451` documents exactly that with
  `Object.hasOwn(error, "mpName") === true`. This is the right way to handle a
  compiler-forced branch: assert what actually happens, not what the guard looks
  like it does. Worth citing as the in-repo model.

**Fully covered, no gap:** `session-env.ts` (`applyPathLedger`'s eight branches
all have a row, including both TTL-free edge cases and the relative-ledger
re-enforcement), `notify-reasons.ts` (`companionSeverity` has an exhaustive 2^4
truth table; `skipSeverity` has every idempotent literal plus three
non-idempotent classes plus both mixed orders), `git-failure-classifiers.ts`
HTTP-status ladder (418/500/599/600 boundaries all present),
`completion-cache.ts` TTL ladder (599_999 / 600_000 / 600_001 for memory, and
600_000 / 600_001 for the file), `atomic-json.ts` (branchless).

## Grading of first-pass findings

### `tests/shared/completion-cache.test.ts`

- **CONFIRMED** — *Loose regex assertion on `lastRefreshedAt`* — real; the regex
  at line 324 passes for any validly-formatted instant, and the stated cause
  (`completion-cache.ts:343, 358` bypassing the injected `now`) is correct. Add
  that the **poison** case at line 399 has the same blind spot and gains the same
  fix.
- **CONFIRMED, with a corrected fix instruction** — *Negative-only unlink-error
  assertions* — the defect is real (lines 838, 877 assert only
  `code !== "ENOENT"`). But the recommended
  `assert.strictEqual(code, "EISDIR")` is Linux-only: `unlink()` on a directory
  yields `EISDIR` on Linux and `EPERM` on macOS, so that fix reddens on a
  developer machine. Use the identity-assertion form this same file already uses
  twice (lines 189, 452): patch `unlink` with
  `t.mock.method(fs, "unlink", () => Promise.reject(Object.assign(new Error("permission denied"), { code: "EACCES" })))`
  and assert `error === unlinkError`.
- **CONFIRMED** — *Note: rewrite the reset case to construct two cache instances* —
  correct, and it is the right instinct not to delete the coverage.

### `tests/shared/markers.test.ts`

- **CONFIRMED** — *Redundant negative assertions after an exact match* — lines
  18-19 and 31-38 add nothing after `strictEqual`. WARNING is the right severity.
  Fold this into the larger duplication finding above: the whole file duplicates
  `tests/architecture/markers-snapshot.test.ts:56` and following.

### `tests/shared/notify-context.test.ts`

- **CONFIRMED, with stronger evidence** — *No `describe()` grouping for a
  4-entrypoint module* — recorded as "cosmetic only", which undersells the
  reason: this is **sibling drift inside one directory**. `errors.test.ts`,
  `errors-bridges.test.ts`, `fs-utils.test.ts`, `probe-classifiers.test.ts`,
  `session-env.test.ts`, and `completion-cache.test.ts` all group by entrypoint;
  `notify-context.test.ts` is the outlier. Severity stays WARNING but the fix is
  propagation from six named siblings, not a judgment call.

### `extensions/pi-claude-marketplace/shared/completion-cache.ts`

- **UNDERSTATED** — *Test-only reset hook over module-scope mutable state* — the
  BLOCKER classification is right (severity is already at ceiling) but the
  recorded blast radius is 9× too small. `resetCompletionCache` is called from
  **8 test files at 17 sites**, not just its own pair:
  `tests/architecture/flag-catalog-drift.test.ts:87`,
  `tests/edge/completions/data.test.ts:136,139`,
  `tests/edge/completions/provider.test.ts:179,182`,
  `tests/orchestrators/marketplace/add.test.ts:862`,
  `tests/orchestrators/marketplace/update.test.ts:1939`,
  `tests/orchestrators/plugin/uninstall.test.ts:907,955,3728,3730`,
  `tests/orchestrators/plugin/reinstall.test.ts:89,93`,
  `tests/orchestrators/plugin/install.test.ts:3663,3665,3948`,
  `tests/shared/completion-cache.test.ts:903`.

  Second amplifier the first pass missed: `getMarketplaceNames` is keyed by
  **`scope` alone**, so its ten cases in `completion-cache.test.ts` share only
  two possible memory keys (`"user"`, `"project"`). Isolation is achieved purely
  by every case remembering to call `invalidateMarketplaceNames` in its
  `t.after`, plus node:test running them sequentially. That is the concrete harm
  the module-global creates, and it is the strongest argument for the recorded
  fix. The `createCompletionCache()` factory is the right shape; the ticket must
  budget for the 8 downstream test files, which puts it on par with the
  `async-rewake/registry.ts` row in META-FINDINGS' reset-hook table.

- **CONFIRMED** — *`getPluginIndex` ignores its own injected clock for the value
  it persists* — lines 343 and 358 both call the real wall clock while line 303
  computes `now`. The proposed `new Date(now()).toISOString()` is exactly right
  and unblocks the regex finding above.

### `extensions/pi-claude-marketplace/shared/session-env.ts`

- **OVERSTATED** — *`applySessionEnv` mutates `process.env` with no injection
  seam* — the observation is true but the recorded fix
  (`env: NodeJS.ProcessEnv = process.env`) violates the same rule set it cites:
  "No parameter defaults to a live boundary." The pure core the rule asks for
  **already exists and is already separately tested**: `claudeSessionEnvFor`
  (`session-env.ts:37`, cases at `session-env.test.ts:13, 28`) is the pure
  producer, and `applySessionEnv` is the 2-line impure shim over it — which the
  module header at lines 16-19 justifies as deliberate (the ledger must live on
  `process.env` to survive `/reload`). The paired test handles the global
  correctly under the sanctioned Environment pattern: save, `t.after` restore
  before acting, and a full before/after key diff at
  `session-env.test.ts:87-96` that catches a fourth key being set. Downgrade to a
  note; do not add the defaulted parameter.

### `extensions/pi-claude-marketplace/shared/debug-log.ts`

- **OVERSTATED** — *`hookDebugLog` reads `process.env` inside its body* — same
  reasoning. The proposed `env: NodeJS.ProcessEnv = process.env` default is
  itself a rule violation, and the module is the single sanctioned IL-2/IL-3
  output seam with a per-file ESLint authorization (header lines 12-17). The
  paired test covers the gate exhaustively — `"1"`, `undefined`, and the four
  near-misses `""`, `"0"`, `"true"`, `" 1 "` — with correct save/restore and
  exact `console.error` argument arrays. If the operator does want a seam, the
  sanctioned shape is a factory (`createDebugLog({ enabled, sink })`) wired once
  at the composition root, not a defaulted parameter. Downgrade to a note.

## Still clean after attack

Named mutations these files genuinely catch. Do not spend fixing-pass time here.

- **`tests/shared/session-env.test.ts`** — catches: prepending instead of
  appending ledger dirs (T-90-01 shadowing, line 175); dropping the
  `path.isAbsolute` re-enforcement on a corrupted ledger (line 225); filtering
  empty PATH segments (line 232); treating an empty PATH as one empty segment
  (line 208); recording all fresh dirs in the ledger rather than only the
  appended ones (line 215); and — via a full before/after `process.env` key diff
  at lines 87-96 — `applySessionEnv` setting any fourth key.
- **`tests/shared/vars.test.ts`** — catches: any token→field remap; dropping the
  regex `g` flag; `value ?? ""` instead of `value ?? matched`; re-expanding an
  injected token (both the cross-token and self-token forms, lines 138 and 147);
  and four distinct near-miss token spellings (line 123).
- **`tests/shared/probe-classifiers.test.ts`** — catches: reordering the
  `malformed mcp reference` arm behind the `lspServers` arm (lines 208, 197);
  loosening any `startsWith` to `includes` (line 59); one-character prefix
  near-misses in both directions (lines 175, 186, 322); dropping the first-wins
  dedup; and first-seen ordering across four buckets (line 219).
- **`tests/shared/git-failure-classifiers.test.ts`** — catches: any 5xx boundary
  shift (rows 500/599/600); a non-integer status (401.5); auth-vs-cancel arm
  reordering (lines 129, 143); every one of the six errno codes individually; and
  the deliberate non-unwrapping of a `.cause`-nested code (line 171).
- **`tests/shared/notify-reasons.test.ts`** — catches: any single cell of
  `companionSeverity`'s 2^4 truth table; any idempotent literal moved out of the
  set; `undefined`/empty reasons being treated as benign; canonical
  skill-before-command emit order under reversed and duplicated input. Its
  `ReasonsCoverageProofIsExact` bidirectional-`extends` check (lines 43-48) is a
  technique worth propagating — it proves the type-level proof is *exactly*
  `[never, never]` rather than merely assignable to it.
- **`tests/shared/errors.test.ts`** — catches: any `CAUSE_CHAIN_MAX_DEPTH`
  change (5-link and 6-link cases); the truncation marker's placement; the
  self-reference cycle guard and a two-node cycle; the depth bound applied
  independently in all three walkers (`causeChainTrailer`,
  `findManualRecoveryError`, `manualRecoveryLeaks` each have exact-fifth-link and
  beyond-fifth-link cases); `errorWithManualRecovery`'s Set-dedup order and its
  frozen defensive copy; and — at line 1420 — the `assertNever` default arm,
  **planted with a real out-of-band discriminator** rather than assumed. That
  planted-violation case is the in-repo model META-FINDINGS item 5 is asking for.
- **`tests/shared/errors-bridges.test.ts`** — catches: dropping
  `AgentForeignContentError`'s post-`super()` message override; a wrong
  `name`; the `Object.freeze` on either exposed collection; and top-level
  input aliasing (the push-after-construct case at line 235).
- **`tests/shared/fs-utils.test.ts`** — catches: reversing either rollback
  direction, swapping the `removeMode` rm-options ternary, and reordering
  staging-vs-backup cleanup — all via one shared `operations` log compared whole
  (lines 324-361), the sanctioned order-proof pattern; the exact leak-message
  text for all five leak sources in execution order (line 430); and each
  tolerated-vs-rethrown errno on `cleanupStaging` / `pathExists` /
  `removeOrphanIfPresent` / `readDirEntriesTolerant` by error identity.
- **`tests/shared/notify-context.test.ts`** — catches: dropping the reconcile
  wrapper's `label` or `cardinality` stamp; any per-row dispatch order or
  argument change (whole call log compared); the missing-render-arm fallback row
  bytes; the `severity: "error"` floor stamp; **and** the frozen-row degrade path
  (line 392) proving the swallowed `TypeError` leaves severity unset — the
  notification still emits with a single argument. Its `createHarness` builds
  full `ExtensionContext` / `ExtensionAPI` / `ui` mocks with `strong-mock` and
  **zero casts** (lines 111-113).
- **`tests/shared/types.test.ts`** — catches reordering or extending `SCOPES`,
  with `@ts-expect-error` negatives pinning `local` and `workspace` out of the
  union.
- **`tests/shared/debug-log.test.ts`** — catches any change to the `[tag] detail`
  format, the default tag, and the exact-equality gate (four near-miss values).

## Not covered

- `tests/shared/notify.test.ts` and `shared/notify.ts` — out of scope, owned by
  another area.
- `tests/shared/concerns/**` and `shared/concerns/*.ts` — out of scope.
- No toolchain command was run (no `npm run check`, `node --test`, or coverage),
  per the diagnostic constraint. Every claim above comes from reading the full
  text of all 26 files plus five throwaway `node -e` probes run entirely inside
  the scratchpad directory (path.relative normalization, the `..`+symlink write
  escape, `path.dirname` on a Windows path under POSIX, and `readdir` dirent
  flags for symlinks). The `resetCompletionCache` / schema-export call-site
  counts come from `grep` over `extensions/` and `tests/`.
- Coverage percentages are still unmeasured; I did the branch census by reading,
  which finds untested branches but cannot confirm the 100%-per-pair requirement.

## Meta-findings impact

### New cross-cutting evidence

1. **The repo's standard technique for faking `node:fs` is global builtin-module
   patching, which is the class the rules forbid — and it is often avoidable by
   changing one import line.** `syncBuiltinESMExports()` appears in **13 test
   files**: `tests/shared/path-safety.test.ts`,
   `tests/bridges/commands/discover.test.ts`,
   `tests/bridges/hooks/{event-router,stage}.test.ts`,
   `tests/bridges/skills/{stage,unstage}.test.ts`,
   `tests/orchestrators/plugin/{fetch,enable-disable,info,install,reinstall,uninstall}.test.ts`,
   `tests/orchestrators/reconcile/apply.test.ts`. The root cause is a
   **production import style**, not a test choice: a module that does
   `import { lstat } from "node:fs/promises"` forces the ESM-namespace re-sync,
   while a module that does `import fs from "node:fs/promises"` and calls
   `fs.lstat` is patchable with a plain `t.mock.method`. `shared/fs-utils.ts` is
   the in-repo proof — its 698-line test patches `fs` eight times with zero
   re-syncs. **Recommend: audit all 13 files' production counterparts for the
   named-import shape and flip them; the residue is the set that genuinely needs
   a DI port.** This is cheap, mechanical, and reduces the loader-trick surface
   before any DI work starts. Areas to check: `bridges/skills`,
   `bridges/commands`, `bridges/hooks`, `orchestrators/plugin`,
   `orchestrators/reconcile`.

2. **`fallow dead-code` structurally cannot see a test-only export, so the "no
   export added for a test" rule has no automated gate anywhere in the repo.**
   `.fallowrc.json` sets `production: false` (deliberate, per the repo's own
   note), which means a test import counts as a use. `completion-cache.ts`
   carries **three** such exports — `resetCompletionCache`,
   `MARKETPLACE_NAMES_CACHE_SCHEMA`, `PLUGIN_INDEX_CACHE_SCHEMA` — and the gate
   is green on all three. The reset-hook cluster in META item 2 was found by
   reading; the schema-constant variant was not found at all. **Recommend: a
   one-off `fallow dead-code --production` probe (or a grep of every `export`
   whose only non-self importer is under `tests/`) run across the whole tree.**
   Every area could hold instances; this area held three in one file.

3. **An architecture drift-guard and a pair test can pin the same literal, and
   nothing detects the duplication.** `tests/shared/markers.test.ts` and
   `tests/architecture/markers-snapshot.test.ts` assert the same two strings;
   `tests/shared/extension-version.test.ts` and
   `tests/architecture/extension-version-sync.test.ts` overlap the same way. This
   is the inverse of the "gates that do not gate" workstream — gates that gate
   *twice*, adding release-checklist sites without adding coverage. **Recommend:
   the same architectural-gate audit should also ask, per gate, which pair test
   already owns the assertion.**

4. **A reusable technique this area proves and others should copy:** the
   bidirectional-`extends` exactness check at
   `tests/shared/notify-reasons.test.ts:43-48`. A type-only proof pinned only by
   `satisfies` shows nothing when the proof degenerates; the `A extends B ? B
   extends A ? true : false : false` form pins it to *exactly* `[never, never]`.
   Applicable to every `_AssertNever`-style compile-time proof in the tree.

### Corrections to META-FINDINGS.md

1. **"Ranked by leverage" item 1 overstates the cause.** The claim is: *"Because
   no test can construct a full SDK object, every caller fakes one and forces it
   past the compiler."* `tests/shared/notify-context.test.ts:111-113` falsifies
   the universal:

   ```ts
   const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
   const pi = mock<ExtensionAPI>({ exactParams: true, name: "extension API" });
   const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
   ```

   Eleven cases drive `notifyWithContext(ctx, pi, …)` — the same over-wide
   `ExtensionContext` / `ExtensionAPI` parameters — with **zero** `as never` or
   `as unknown as` casts. `strong-mock` constructs the full SDK object. So the
   178 casts in `notify.test.ts` are not forced by the wide parameter; they are a
   *tooling* choice (hand-rolled literals) that narrowing would also happen to
   fix. **Correction:** keep the narrowing ticket — it is still right — but the
   cheaper, independently-available fix for the cast cluster is "adopt
   `notify-context.test.ts`'s `strong-mock` harness", and that does not have to
   wait on a production change. Add `tests/shared/notify-context.test.ts` to the
   "Patterns to propagate" table under strict interaction mocking.

2. **Item 2's reset-hook table understates `completion-cache.ts`.** The evidence
   column reads only *"its own doc comment admits zero production callers"*,
   which puts it below `async-rewake/registry.ts` ("62 manual reset calls") in
   apparent cost. In fact `resetCompletionCache` is called from **8 test files at
   17 sites** (enumerated in the grading section above), and its
   `getMarketplaceNames` half keys the process-global on `scope` alone — two
   possible keys shared by ten cases, isolated only by per-case `t.after`
   discipline. **Correction:** raise its row's stated cost; sequence it with
   `settle.ts`, not after it as an afterthought.

3. **"Notes on the method" lists NFR-10 path containment among the falsified
   hypotheses:** *"NFR-10 path containment is thoroughly tested against real
   filesystems including symlink escapes."* That is true as far as it goes and I
   confirm the symlink coverage is genuinely strong — but the sentence should not
   be read as closing the question. `assertPathInside` has an undocumented,
   unenforced, untested precondition (a normalized `child`), and I have a
   working escape past the symlink walk when it is violated. **Correction:**
   move this from "falsified hypothesis" to "confirmed except for the
   normalization precondition — see the shared-core BLOCKER."

### Confirmations

- **Item 2 (reset hooks over module-global state) — confirmed independently.**
  Grep across `extensions/` and `tests/` returns zero production callers of
  `resetCompletionCache`; the doc comment at `completion-cache.ts:429-435`
  admits it in writing ("Its only caller today is test setup isolating cases
  from each other"). This is the honest-comment half of META's "doc comments cut
  both ways" observation; I also found the dishonest half in this area, at
  `fs-utils.ts:302-304` and `bridges/commands/discover.ts:260-261` (both assert
  the agents bridge depends on an `lstat` that its own `entry.isFile()` guard
  makes unreachable).
- **Item 5 (restore exhaustiveness on closed-union switches) — the enforcement
  test already exists in this area and should be the template.**
  `errors.ts:580-581` has the `default: return assertNever(shape)` arm, and
  `tests/shared/errors.test.ts:1420` **plants** an out-of-band discriminator
  (`{ kind: "future" } as never`) and asserts the exact thrown message. When the
  four named modules gain their `assertNever` defaults, give each one a copy of
  that case — the arm is otherwise unreachable and would sit at 0% branch
  coverage.
- **"Decisions" item 1 (unreachable branches propped up by tests) — a fifth
  instance, without prototype surgery.** `fs-utils.ts:311-312` reached only by
  `tests/shared/fs-utils.test.ts:658` passing a dirent from a different
  directory than `dir`. It needs the same operator decision as the four
  prototype-patching cases, and it shows the class is broader than "tests that
  monkeypatch globals" — an artificial *argument* combination produces the same
  shape.
- **"Patterns to propagate" — cross-collaborator order proof via one shared log:
  confirmed with a second reference implementation.**
  `tests/shared/fs-utils.test.ts:324-361` records `rm` and `rename` into one
  `operations` array and compares the whole six-entry log, proving reverse-order
  removal, reverse-order restore, and staging-before-backup cleanup in one
  assertion. Add it beside `tests/transaction/phase-ledger.test.ts` in that table.
- **"The dominant shape: sibling drift" — confirmed three more times inside one
  directory:** `notify-context.test.ts` is the only `tests/shared` module without
  entrypoint `describe()` grouping (six siblings have it);
  `path-safety.ts` is the only `shared/` fs-touching module using named
  `node:fs/promises` imports (`fs-utils.ts` uses the namespace and needs no
  loader trick); and `errors.ts` disagrees with **itself** — three error classes
  freeze a defensive copy, three alias the caller's array.
