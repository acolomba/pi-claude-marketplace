# Bridges — commands — adversarial re-review

**Scope:** `extensions/pi-claude-marketplace/bridges/commands/` (5 modules) and
`tests/bridges/commands/` (5 test modules), plus cross-checks against the
sibling `bridges/{skills,agents,mcp,hooks}` test modules that already implement
the conventions this area is missing.
**First-pass file:** `unit-test-findings/bridges-commands.md`
**Clean files attacked:** 5 (`tests/bridges/commands/index.test.ts`,
`tests/bridges/commands/types.test.ts`, `bridges/commands/unstage.ts`,
`bridges/commands/types.ts`, `bridges/commands/index.ts`) — plus a full mutation
pass over `stage.ts`/`discover.ts` and their tests, which the first pass declared
"otherwise clean" on every axis except the ones it named.
**Existing findings graded:** 9

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 2 |
| New WARNING (missed by first pass) | 12 |
| Existing CONFIRMED | 7 |
| Existing UNDERSTATED | 2 |
| Existing OVERSTATED | 0 |
| Existing REFUTED | 0 |
| Existing DUPLICATE-OF | 0 |

The first pass's picture held up as far as it went, but it read this area as a
"mature, carefully engineered suite" whose only real problem was three
`String.prototype` mocks. The mutation pass found the opposite emphasis: the
containment layer of the staging path — eight `assertPathInside` /
`assertSafeName` guards — has **zero** cases, while the guards that *are*
tested are the ones that cannot fire.

## New findings — from the clean lists

### `tests/bridges/commands/stage.test.ts`

- **[BLOCKER] Every path-containment and name-safety guard in `stage.ts` is
  unexercised — deleting all eight leaves the suite green** — `stage.ts:195,
  207, 210, 308, 382, 389, 391, 397`
  `tests/bridges/commands/stage.test.ts` never imports `PathContainmentError` or
  `SymlinkRefusedError` and never plants an escaping or symlinked path. Verified
  by grepping the whole `tests/` tree for each guard's label string: `"commands
  staging root"` 0 hits, `"staged command file"` 0, `"target command file"` 0,
  `"previous command file"` 0, `"commands backup root"` 0, `"commands backup
  file"` 0. `"previous command name"` has exactly 1 hit and it is an unrelated
  `@ts-expect-error` comment in `types.test.ts:211`. So the mutation "delete
  every `await assertPathInside(...)` call and the `assertSafeName(name,
  "previous command name")` call from `stage.ts`" survives the entire suite —
  the NFR-10 containment obligation for the commands staging path is asserted
  nowhere.
  Fix: copy the two in-repo reference cases. `tests/bridges/skills/stage.test.ts`
  (case ending at line 688) plants a hostile symlink under the source tree and
  asserts `prepareError instanceof SymlinkRefusedError` plus `.linkPath` /
  `.linkTarget` and an empty staging dir; `tests/bridges/agents/stage.test.ts:1923`
  asserts a `PathContainmentError` by structured fields. This area's own
  `tests/bridges/commands/unstage.test.ts:119-204` already does both correctly
  for `unstage.ts` (exact `{name, message, parent, child}` and
  `{…, linkPath, linkTarget}` comparisons) — propagate that exact shape to at
  least three of the staging guards: the target-file guard (line 210, reachable
  by a `_renamePairs`-independent traversal name), the previous-file guard
  (line 308, reachable through `previousCommandNames: ["../escape"]`), and the
  `replacePreparedCommands` `assertSafeName` (line 389, reachable through
  `previousCommandNames: ["bad"]` — assert the exact message `previous
  command name "bad" must not contain ASCII control characters.`).

- **[WARNING] The degraded-record projection drops `parseError`** — `lines
  854-857`
  `assert.deepStrictEqual(prepared.result.degraded.map(({ generatedName }) =>
  generatedName), [...])` compares only one of the two fields of a three-row
  `CommandDegradeRecord[]`. Mutating `stage.ts:230` to swap `parseError` between
  the lone-CR and repeated rows, or to emit a constant string, leaves this case
  green. The same file's case at line 283 already compares the whole record
  (`{generatedName, parseError}`), so this is drift inside one file. Fix: build
  the three expected `{generatedName, parseError}` literals (the parse errors are
  deterministic `yaml` messages, as line 259-261 already demonstrates) and
  `deepStrictEqual` the whole `prepared.result.degraded`.

- **[WARNING] The test reads and rewrites `_renamePairs`, the field the barrel
  and `types.ts` document as unreachable to consumers** — `lines 659-672` and
  `993-1009`
  Both cases do `prepared._renamePairs.find(...)`, `delete (alphaPair as
  Partial<typeof alphaPair>).from`, then `Object.defineProperty(alphaPair,
  "from", { get() {…} })` with a read counter. That is a fourth and fifth
  instance of the "make an object lie" technique in a file the first pass
  credited with three (see the grading of finding 3 below), and it also
  falsifies the doc comment at `bridges/commands/index.ts:3-7` /
  `types.ts:10-13` ("external consumers … cannot read or mutate them"). Fix
  path: these two cases exist to force a rollback-rename failure. A rollback
  failure is reachable without lying — make the *staging root* unwritable, or
  pre-create a directory at the staged source path after the forward rename
  (the same trick `unstage.test.ts:213` uses with `await mkdir(blockedPromptPath)`
  to force a real `EISDIR`). Re-derive both cases against a real filesystem
  obstruction and delete the property surgery.

### `tests/bridges/commands/discover.test.ts`

- **[BLOCKER] `test('propagates a filesystem error whose errno disappears
  between observations')` patches the `node:fs/promises` builtin namespace and
  exists only to reach a coalesce that cannot fire** — `lines 650-702`
  Two separate defects in one case. (a) It obtains a live handle on the builtin
  with `createRequire(import.meta.url)("node:fs/promises")`, replaces `readdir`
  on it, and calls `syncBuiltinESMExports()` to push the replacement into every
  ESM importer in the process. That is the `t.mock.module()`/custom-loader class
  the rules name as a finding outright; the dependency is meant to be injected.
  (b) The branch it targets is unreachable. `discover.ts:178` reads
  `TOLERATED_WALK_ERRNOS.has(err.code ?? "")`, but it is guarded by
  `isErrnoException(err)`, and `shared/errors.ts:15-19` defines that as `err
  instanceof Error && "code" in err && typeof err.code === "string"`. A real
  error that passes the guard cannot then present `code === undefined`, so the
  `?? ""` arm requires the counting getter this case installs on
  `filesystemError.code` (lines 667-674, `codeReads === 1 ? "EACCES" :
  undefined`) — and `assert.strictEqual(codeReads, 2)` is the case admitting
  exactly that. The already-real coverage of `isToleratedWalkError` returning
  false comes from the ELOOP case at line 475.
  Fix: delete `?? ""` from `discover.ts:178` (`isErrnoException` already
  narrows `code` to `string`), then delete this case. If the coalesce is kept,
  the case must still lose the builtin patch — `readWalkEntries` takes no
  injectable seam today, which is the design finding underneath it.

- **[WARNING] Three opaque SHA-256 constants stand in for the byte comparison
  the sibling files write literally** — `lines 72-76`, asserted at `83-92`
  `expectedDigests` hard-codes `1075382f…`, `a5695335…`, `647d5f12…`. I verified
  they are the correct digests of `"# deploy\r\n"`, `"# prod\n"`, `"# status\n"`,
  so the assertion is sound — but nothing in the file says so, and the CRLF
  preservation that is presumably the point is invisible. `unstage.test.ts:54`
  makes the identical proof readable: `assert.strictEqual(await
  readFile(foreignPromptPath, "utf8"), "foreign bytes\n")`. Fix: replace the
  digest array and the `createHash` plumbing with three direct `readFile`
  comparisons against the same literals the arrange block wrote, and drop the
  `node:crypto` import.

- **[WARNING] Two async-hook ordinals couple the cases to `discover.ts`'s exact
  filesystem-call count with no comment** — `line 499`
  (`completedFilesystemRequests === 1`) and `line 560` (`=== 2`)
  Both cases fire a `rename` + `symlink` after the Nth `FSREQPROMISE` completes.
  Adding or removing one `stat`/`lstat`/`readdir` anywhere in the walk shifts
  which operation the race lands on, and the case would then either fail
  opaquely or silently exercise a different path. The AAA rule's
  "setup is not obvious" exception applies. Fix: add one comment above each hook
  naming the operation the ordinal targets (`readdir` of `commands/` for the
  first, the `lstat` behind `isPlainMarkdownFile` for the second), so a future
  reader can re-derive the ordinal instead of bisecting it.

### `tests/bridges/commands/index.test.ts` *(first-pass clean list)*

- **[WARNING] The barrel's export surface is never pinned — adding an export is
  an undetected mutation** — `line 35` (where the sibling puts the pin)
  All eight runtime re-exports are identity-checked, so *dropping* or *swapping*
  one is caught (a drop fails to link, a swap fails `assert.strictEqual`). What
  survives is *growth*: adding `export { … } from "./stage.ts"` or `export * from
  "./types.ts"` to `bridges/commands/index.ts` leaves all eight cases green, even
  though the barrel's own header comment (lines 3-7) states an intent about what
  it does and does not re-export. Two type-surface pins are also missing that
  two siblings carry:
  `Same<keyof CommandsReplacementNoop, "kind" | "prepared">` and the `Replaced`
  equivalent (present at `tests/bridges/skills/index.test.ts:51-52` and
  `tests/bridges/mcp/index.test.ts:45-46`), so adding a field to either
  replacement branch is also undetected.
  Fix: copy `tests/bridges/skills/index.test.ts:40-41` and `53-63` verbatim,
  renamed — declare `type CommandsRuntimeExport = keyof typeof
  import("…/bridges/commands/index.ts");` and assert `true satisfies
  Same<CommandsRuntimeExport, "abortPreparedCommands" | "commitPreparedCommands"
  | "discoverPluginCommands" | "finalizeCommandsReplacement" |
  "prepareStageCommands" | "replacePreparedCommands" |
  "rollbackCommandsReplacement" | "unstagePluginCommands">`, then add the two
  `keyof` pins. `skills/index.test.ts` is the only bridge barrel test with the
  runtime pin; propagating it to `commands`, `agents`, and `mcp` closes the same
  hole three more times.

- **[WARNING] A `@ts-expect-error` comment claims a containment the same file
  disproves 31 lines earlier** — `line 67`
  `// @ts-expect-error the barrel keeps the staged implementation type private`
  guards `Same<CommandsBarrel.PreparedCommandsStaged, never>`. What that proves
  is only that the *name* is not exported: line 37 of this same file
  reconstitutes the identical type from the barrel's own public export with
  `Extract<BarrelPreparedCommandsStaging, { kind: "staged" }>`, and line 48 then
  uses it. The underscore-prefixed internals are fully typed and reachable
  through the public union. Fix: reword to what it proves — "the barrel does not
  export the staged branch under its own name" — and, if the withholding is
  meant to be real, say so in `bridges/commands/index.ts:3-7`, which currently
  overclaims in the same direction ("external consumers should never read or
  mutate them", while `stage.test.ts:659` and `993` do exactly that).
  `skills/index.test.ts:82` carries the identical wording and the identical
  contradiction at its own line 37, so fix both.

### `tests/bridges/commands/types.test.ts` *(first-pass clean list)*

- **[WARNING] No field-level `readonly` negative anywhere — dropping `readonly`
  from any of the ~30 fields in `types.ts` is undetected** — `lines 171-192`
  The file's only mutability negatives are `IsMutableArray<…>` checks, which pin
  the *element arrays* as `readonly T[]` but say nothing about the fields
  themselves. Mutating `types.ts:30` to `sourceName: string` (or `types.ts:103`
  to `kind: "staged"` without `readonly`, or any of the rest) leaves this module
  and the whole suite green. Two siblings already carry the missing block:
  `tests/bridges/agents/types.test.ts:219-241` (11 assignment negatives, e.g.
  `// @ts-expect-error discovered agent identities are readonly` /
  `discoveredAgent.sourceName = "changed";`) and
  `tests/bridges/mcp/types.test.ts:229-245`. Fix: add one assignment negative per
  already-constructed literal in this file — `discoveredCommand.sourceName`,
  `stageCommandsInput.cwd`, `stagedCommandRecord.targetPath`,
  `commandDegradeRecord.parseError`, `stageCommandsCommitResult.degraded`,
  `preparedCommandsNoop.kind`, `preparedCommandsStaged.stagingRoot`,
  `commandsReplacementReplaced.kind`, `unstageCommandsInput.locations`,
  `unstageCommandsResult.removedNames` — using the agents file's exact form.
  (`tests/bridges/skills/types.test.ts` has the same gap; fix both.)

- **[WARNING] The sample `warnings` value states a message
  `unstagePluginCommands` cannot produce** — `line 167`
  `warnings: ["preserved foreign command acme:foreign"]`. `unstage.ts:40` returns
  `Object.freeze<string[]>([])` unconditionally and no caller populates it
  (`install.ts:1000` discards the whole result; `marketplace/shared.ts:322-326`
  reads only `removedNames`). The agents sibling's equivalent sample is truthful
  — `agents/unstage.ts:62,120` really does emit `warnings` from
  `loaded.corruptions`. Fix: change the literal to `[]` and, if the empty channel
  is deliberate bridge-shape symmetry (it is — `skills/unstage.ts:55` and
  `mcp/unstage.ts:33,103` are also permanently empty), record that one fact in
  `types.ts:135` rather than implying a warning the module never emits.

### `tests/bridges/commands/unstage.test.ts`

- **[WARNING] An order-dependent `readdir` assertion on two entries** — `lines
  249-252`
  `assert.deepStrictEqual(await readdir(locations.promptsTargetDir),
  ["acme:blocked.md", "acme:retained.md"])`. `fs.readdir` guarantees no order;
  on ext4 it returns hash order, so this is a latent flake, not a contract. Every
  other `readdir` assertion in the file compares zero or one entry and is safe.
  `stage.test.ts:100` handles the same situation correctly with
  `(await readdir(...)).sort()`. Fix: sort before comparing.

### `extensions/pi-claude-marketplace/bridges/commands/discover.ts`

- **[WARNING] `isToleratedWalkError`'s `?? ""` is a coalesce that cannot fire** —
  `line 178`
  `isErrnoException(err) && TOLERATED_WALK_ERRNOS.has(err.code ?? "")`. The
  left conjunct already establishes `typeof err.code === "string"`
  (`shared/errors.ts:15-19`), so the `""` arm is reachable only by an object that
  answers `code` differently on two consecutive reads — which is precisely what
  `discover.test.ts:667-674` builds. This is category (b) production dead code,
  not the compiler-forced category: `err.code` is already `string | undefined`
  narrowed to `string`, and `has(err.code)` type-checks unchanged. Fix: drop
  `?? ""`, then drop the paired case (see the BLOCKER above).

### `extensions/pi-claude-marketplace/bridges/commands/stage.ts`

- **[WARNING] `assertSafeName(command.generatedName, "generated command name")`
  re-validates a string that was validated moments earlier** — `line 204`
  Every `command.generatedName` reaching this line came from
  `discoverPluginCommands` → `nameCommandInDir` → `generatedCommandName`, and
  `domain/name.ts:129` ends with `assertSafeName(generated)` on the identical
  string. The guard therefore cannot fire on real input, which is why
  `stage.test.ts:766-784` has to make `String.prototype.includes` lie about
  `"acme:current".includes("/")` on its second call to reach it. Group this with
  the first pass's `neutralizeCommandFrontmatter` finding: it is the same
  decision (keep a defensive re-check and accept an untestable line, or drop it),
  and the first pass named only one of the two production sites.

- **[WARNING] `commitPreparedCommands` omits the previous-name validation its own
  `replacePreparedCommands` and the skills sibling both perform** — `line 306`
  vs. `line 389` and `bridges/skills/stage.ts:326`
  `skills/stage.ts` calls `assertSafeName(name, "previous skill name")` as the
  first statement of `commitPreparedSkills`'s previous-name loop;
  `commands/stage.ts`'s `replacePreparedCommands` calls the commands equivalent
  at line 389; `commitPreparedCommands`'s loop at 306-317 calls neither and
  relies on `assertPathInside` alone. Containment still holds (a `"../evil"`
  name is caught by line 308), so this is defense-in-depth asymmetry rather than
  a hole — but it is the odd one out of four structurally identical loops, and
  the "previous names" it trusts come from `state.json`. Fix: add
  `assertSafeName(name, "previous command name");` at the top of the loop, and
  cover it with the case the BLOCKER above prescribes.

## Export ownership census

| Module | Export | Owning case | Status |
| --- | --- | --- | --- |
| `index.ts` | `discoverPluginCommands` | `index.test.ts:99` | owned |
| `index.ts` | `abortPreparedCommands` | `index.test.ts:73` | owned |
| `index.ts` | `commitPreparedCommands` | `index.test.ts:86` | owned |
| `index.ts` | `finalizeCommandsReplacement` | `index.test.ts:112` | owned |
| `index.ts` | `prepareStageCommands` | `index.test.ts:125` | owned |
| `index.ts` | `replacePreparedCommands` | `index.test.ts:138` | owned |
| `index.ts` | `rollbackCommandsReplacement` | `index.test.ts:151` | owned |
| `index.ts` | `unstagePluginCommands` | `index.test.ts:164` | owned |
| `index.ts` | `type CommandsReplacement` | `index.test.ts:41` | owned |
| `index.ts` | `type PreparedCommandsStaging` | `index.test.ts:42` | owned |
| `index.ts` | *export surface as a whole* | — | **NO CASE** (see new WARNING; `skills/index.test.ts:40,53-63` is the form) |
| `unstage.ts` | `unstagePluginCommands` | `unstage.test.ts:29,57,75,97,119,158,206` | owned, 7 cases, all branches |
| `types.ts` | `DiscoveredCommand` | `types.test.ts:17,89` | owned (no field-`readonly` negative) |
| `types.ts` | `StageCommandsInput` | `types.test.ts:24,96` | owned; `previousCommandNames?` optionality pinned only **incidentally** by `stage.test.ts:90` omitting it |
| `types.ts` | `StagedCommandRecord` | `types.test.ts:36,107` | owned (no field-`readonly` negative) |
| `types.ts` | `CommandDegradeRecord` | `types.test.ts:43,114` | owned (no field-`readonly` negative) |
| `types.ts` | `StageCommandsCommitResult` | `types.test.ts:49,120` | owned (no field-`readonly` negative) |
| `types.ts` | `PreparedCommandsStaging` | `types.test.ts:83,138` | owned |
| `types.ts` | `PreparedCommandsNoop` | `types.test.ts:57,195` | owned |
| `types.ts` | `PreparedCommandsStaged` | `types.test.ts:68,128,197` | owned |
| `types.ts` | `CommandsReplacement` | `types.test.ts:152,203,207` | owned |
| `types.ts` | `CommandsReplacementNoop` | `types.test.ts:140,205` | owned |
| `types.ts` | `CommandsReplacementReplaced` | `types.test.ts:146,203` | owned |
| `types.ts` | `UnstageCommandsInput` | `types.test.ts:159,212` | owned |
| `types.ts` | `UnstageCommandsResult` | `types.test.ts:165,218` | owned; `warnings` sample is fictional (see WARNING) |
| `discover.ts` | `discoverPluginCommands` | `discover.test.ts` (16 cases) | owned |
| `discover.ts` | `type DiscoverPluginCommandsResult` | — | **incidental only** — exercised structurally through `deepStrictEqual` at `discover.test.ts:82`; no `satisfies` / `Same<>` pin and no `@ts-expect-error` negative, so dropping `readonly` from either field is undetected. It is the one exported type in this bridge that lives outside `types.ts` and therefore has no paired type test. |
| `stage.ts` | `prepareStageCommands` | `stage.test.ts:67,145,250,290,326,369,722,760,816,863,911` | owned |
| `stage.ts` | `commitPreparedCommands` | `stage.test.ts:67,145,214,596,635,686` | owned |
| `stage.ts` | `abortPreparedCommands` | `stage.test.ts:145,182,369,686` | owned |
| `stage.ts` | `replacePreparedCommands` | `stage.test.ts:145,400,480,513,563,969,1043` | owned |
| `stage.ts` | `rollbackCommandsReplacement` | `stage.test.ts:145,400,480,1043` | owned |
| `stage.ts` | `finalizeCommandsReplacement` | `stage.test.ts:145,443,563,1043` | owned |

No export is unowned. The gaps are all *inside* owned exports: the containment
arms of `prepareStageCommands`/`commitPreparedCommands`/`replacePreparedCommands`,
and the type-surface pins.

## Branch census

**`unstage.ts` — complete.** Every branch has a case: non-empty loop
(`unstage.test.ts:29`), empty loop (`:57`), `assertPathInside` traversal throw
(`:119`), `assertPathInside` symlink throw (`:158`), unlink success (`:29`),
unlink `ENOENT` skip (`:75`, `:97`), unlink non-`ENOENT` rethrow (`:206`). The
only untested input class is a duplicated name inside `previousCommandNames`
(second unlink would `ENOENT` and drop out of `removedNames`) — reachable but
only from a corrupt `state.json`, and no production caller can produce it, so I
record it and do not raise it.

**`stage.ts` — reachable and untested (findings above):**
- `assertPathInside` throw arms at 195, 207, 210, 308, 382, 391, 397 — reachable
  (a traversal or symlinked `previousCommandNames` entry, or a `promptsTargetDir`
  containing a symlinked component, produce them), untested.
- `assertSafeName` throw arm at 389 — reachable via
  `previousCommandNames: ["bad"]`, untested.

**`stage.ts` — unreachable by real input (production dead code):**
- `neutralizeCommandFrontmatter` lines 102-105 and 107-111. Independently
  re-verified against the vendored source: `node_modules/@earendil-works/
  pi-coding-agent/dist/utils/frontmatter.js` reaches `parse(yamlString)` — its
  only throw site — only after `normalized.startsWith("---")` and
  `normalized.indexOf("\n---", 3) !== -1` both hold, and both functions apply the
  identical two-step newline normalization. So on iteration 1 the caller's
  contract guarantees the checks, and on iteration ≥2 the vendor's own precondition
  does. The first pass's conclusion is correct.
- `assertSafeName(command.generatedName, …)` at line 204 — `domain/name.ts:129`
  already ran `assertSafeName` on the identical string.

**`discover.ts` — compiler-forced, NOT removable (D-116-01a category c):**
- `if (!(err instanceof CommandNameError)) { throw err; }` at lines 288-290. The
  first pass grouped this with the `stage.ts` dead branches and asked whether the
  guard is "worth keeping". It is not optional: `catch (err)` types `err` as
  `unknown`, and the next statement calls `badNameWarning(err)` whose parameter is
  `CommandNameError` (`discover.ts:101`). Delete the check and the file stops
  compiling. Only the `throw err` *arm* is unreachable, and the only alternative
  narrowing is an `as` cast. This distinction matters for the operator decision
  recorded in META-FINDINGS.

**`discover.ts` — unreachable by real input:**
- the `?? ""` arm of line 178 (new finding above).

**`discover.ts` — reachable and covered, for the record:** the `catch` in
`symlinkPointsAtDirectory` (line 153, covered by the dangling symlink at
`discover.test.ts:200`), `readWalkEntries`'s base-vs-subdirectory split (197,
covered at `:437` and `:378`), the tolerated/non-tolerated split (204, covered at
`:378` and `:475`), `isPlainMarkdownFile`'s throw (265, covered at `:407`), the
`!plain` return (274, covered by `README.txt` at `:50`), and both dedup arms
(382, 395, covered at `:219` and `:280`).

## Grading of first-pass findings

### `tests/bridges/commands/stage.test.ts`

- **UNDERSTATED** — *Message-substring error assertions where structured fields
  were available* (recorded BLOCKER, 2 sites). Three things make it worse than
  recorded. (1) There is a **third** site the first pass missed:
  `line 756`, `assert.match(error.cause.message, /ENAMETOOLONG/)` in
  `test('names the plugin and generated command when an overlong target cannot be
  staged')` — same class, same fix. (2) The prescribed expected prefix is
  **wrong**: `stage.ts:340` emits `failed to roll back command rename ${pair.to}
  -> ${pair.from}`, and in that case `pair.to` is the *target* path
  (`promptsTargetDir/acme:alpha.md`), not the `actualFrom` staging path the
  finding names — following the instruction as written produces a failing test.
  (3) The "leave the platform-variant tail unchecked" concession is unnecessary:
  the sibling `unstage.test.ts:215-222` already pins a full errno error
  structurally, `errno: -21` included, and `appendLeakToError`
  (`shared/errors.ts:151-157`) makes the composed message
  `${base} (additionally: ${leak})` fully deterministic with `name === "Error"`.
  The whole message and the whole `cause` chain are hand-writable.

- **CONFIRMED** — *Error result checked only by `instanceof`, no structured
  field* (`lines 620-632`). `assert.ok(error instanceof Error)` is the only check
  on the throw; the surrounding side-effect assertions do carry the case, and
  `error.name === "Error"` plus the deterministic EISDIR message close it.

- **UNDERSTATED** — *Coverage-only monkeypatching of shared built-ins* (recorded
  WARNING, 3 cases). The class is undercounted in this file: alongside the three
  `String.prototype` mocks (766, 871, 919) the same file installs two counting
  getters over production-owned objects at `665-672` and `1002-1009`, and
  `discover.test.ts` adds a third at `667-674` on top of the `Symbol.hasInstance`
  override the first pass did log. That is **six** "force an object to lie"
  sites in this area, not three, and one of them (the `_renamePairs` surgery) is
  additionally reaching into a documented-internal field. Severity as a WARNING
  is defensible; the count and the blast-radius statement are not.

- **CONFIRMED** — *Near-duplicated plugin-resolution builder across two test
  files*. `resolvedFor` (`stage.test.ts:38-58`) and `resolvedPlugin`
  (`discover.test.ts:16-36`) are the same shape. Scope correction for the fixing
  pass: the identical `ResolvedPluginInstallable` literal is hand-built in **11**
  test files (`grep -rl 'state: "installable"' tests/`), so a
  `tests/bridges/commands/`-local seed module fixes 2 of 11. This belongs in the
  cross-cutting list, not as an area-local edit.

### `tests/bridges/commands/discover.test.ts`

- **CONFIRMED** — *Coverage-only monkeypatching of a class-identity check*
  (`lines 605-616`). The unreachability claim is right: `nameCommandInDir`
  (`discover.ts:222-228`) catches everything from `generatedCommandName` and
  rethrows only `CommandNameError`, so the `instanceof` can only fail if
  `Symbol.hasInstance` is rewritten. **Correction to the recommended action:** the
  finding closes with "verify whether `discover.ts`'s defensive `!(err instanceof
  CommandNameError)` branch is worth keeping." It cannot be dropped — see the
  branch census; the narrowing is compiler-forced, and only the `throw err` arm
  is dead. The live question is whether the *case* should exist, not the guard.

### `tests/bridges/commands/unstage.test.ts`

- **CONFIRMED** — *Import-form inconsistency* (`line 5`). Factually correct: all
  four siblings in this directory use the named import. Qualification for the
  fixing pass — repo-wide the split is 119 files using `import test from
  "node:test"` against 143 using the named form, so this is a local-consistency
  edit, not evidence of a repo convention being violated. Fix the one file; do
  not spend a pass normalizing 119.

### `extensions/pi-claude-marketplace/bridges/commands/stage.ts`

- **CONFIRMED** — *`neutralizeCommandFrontmatter`'s loop-level pre-checks are
  unreachable*. Independently verified against the vendored
  `parseFrontmatter` source (see branch census). Both early returns are dead on
  every iteration, not only past the first.

- **CONFIRMED** — *Hidden dependency: inline `randomUUID()`* (lines 193, 380).
  The rule names this pattern explicitly, and the finding is honest that no
  current case needs to control the id. Note for sequencing: making `newId` an
  input-bundle member also lets the containment cases prescribed above pin an
  exact `stagingRoot`, so do this change before writing them.

### `extensions/pi-claude-marketplace/bridges/commands/discover.ts`

- **CONFIRMED** — *Defensive `instanceof` fallback in `collectCommandFile` is
  unreachable by real input* (lines 288-290). Same correction as its test-side
  twin: unreachable arm, but the check itself is compiler-forced and cannot be
  removed without an `as` cast or a restructure.

## Still clean after attack

- **`extensions/pi-claude-marketplace/bridges/commands/unstage.ts`** — genuinely
  strong, and the best-tested module in this area. Mutations the cases **do**
  catch: changing `name + ".md"` to any other extension (`unstage.test.ts:50`
  expects both names in `removedNames`); pushing `target` instead of `name`
  (`:50`); pushing on the `ENOENT` path (`:93`, `:112`); reversing or sorting
  `removedNames` (`:39` fixes input order, `:113` interleaves a miss); dropping
  either `Object.freeze` (`:51-52`); returning a non-empty `warnings`
  (whole-object `deepStrictEqual` everywhere); swallowing a non-`ENOENT` error
  instead of rethrowing (`:236-253` pins the errno error *and* proves the loop
  stopped, via `acme:retained.md` surviving); changing the `assertPathInside`
  label (`:126` compares the whole message); moving `assertPathInside` after the
  `unlink` (`:154` reads the escaped file back); dropping the `await` on
  `assertPathInside` (`:143` would see `undefined`); and swapping the parent
  argument (`:143`/`:189`).
- **`extensions/pi-claude-marketplace/bridges/commands/index.ts`** — the *type*
  surface is exactly right and I could not fault it: every one of the eight
  production consumers (`orchestrators/{marketplace/shared,plugin/discover-names,
  plugin/install,plugin/update,plugin/reinstall}.ts`) imports through the barrel
  and needs only the two re-exported types. Identity-swap and identity-drop
  mutations on the runtime exports are both caught. Only surface *growth* is
  unguarded.
- **`extensions/pi-claude-marketplace/bridges/commands/types.ts`** — the
  discriminated union is well pinned at the *shape* level: the noop branch cannot
  carry `stagingRoot`, the staged branch cannot carry `prepared`, `{kind:
  "prepared"}` and `{kind: "staged", prepared: staged}` are both rejected, and
  every array is proven `readonly`. Only per-field `readonly` is unpinned.
- **`tests/bridges/commands/discover.test.ts`**, apart from the case at 650. It
  survives every value mutation I could construct against `discoverPluginCommands`:
  reordering `discovered` (DFS order is pinned at `:52-71`), dropping any of the
  three record fields (whole-object `deepStrictEqual` in all 16 cases), losing a
  warning or garbling one (`:207-209`, `:239`, `:269`, `:299`, `:367`, `:396`,
  `:426` are all whole hand-written strings), flipping first-wins to last-wins
  (`:219`, `:250`), dropping `Object.freeze` (`:93-94`, `:164-165`), following a
  symlinked directory (`:184`), and swapping tolerated for non-tolerated errnos
  (`:378` vs `:475`). This is the strongest file in the area.
- **Duplicated `Same<>` / `IsMutableArray<>` type helpers** across the four bridge
  `index.test.ts`/`types.test.ts` pairs: I checked and am **not** raising it. They
  are 1-2 line type aliases, and the rules forbid a generic shared test-support
  dumping ground; local copies are the correct trade. Do not spend a pass on it.
- **`undefined!` for `locations`/`resolved` in `types.test.ts`** (lines 25, 30,
  58, 70, 160, 213): not raised. All three siblings do the same
  (`skills/types.test.ts:25`, `agents:57`, `mcp:53`); it is the established form
  for standing in for a branded type in a type-only module.

## Not covered

- Per the diagnostic instruction I ran no test, no coverage report, and no
  `npm run check`. Every reachability and mutation claim above is from reading
  source — including the vendored `@earendil-works/pi-coding-agent`
  `frontmatter.js`, which I read directly rather than trusting the first pass.
  The two claims most worth confirming with an actual
  `npm run test:coverage:direct` run are the `discover.ts:178` `?? ""` arm and
  the eight unexercised `stage.ts` guards; both are grep-verifiable and I state
  the greps I ran.
- I did not audit `orchestrators/plugin/install.ts`, `update.ts`, or
  `reinstall.ts` for whether *they* plant containment violations through the
  commands bridge. My claim is scoped to the label grep over all of `tests/`,
  which returns zero for six of the eight guards — that is sufficient for the
  finding, but the orchestrator tests may exercise the guards indirectly under
  labels I did not search for.
- `sonar.cpd.exclusions` duplication between `bridges/commands/stage.ts` and
  `bridges/agents/stage.ts` remains deliberately unreported, per the first-pass
  assignment.

## Meta-findings impact

### New cross-cutting evidence

**1. A defect class META-FINDINGS does not name at all: builtin-module
namespace patching.** `tests/bridges/commands/discover.test.ts:657,688,690` uses
`createRequire(import.meta.url)("node:fs/promises")` + `t.mock.method` +
`syncBuiltinESMExports()` to replace `readdir` for every ESM importer in the
process. The rules call `t.mock.module()` or a custom loader a finding outright,
and this is that in a different spelling. It is **not** local:
`grep -rl syncBuiltinESMExports tests/` returns **13 files** —
`bridges/commands/discover.test.ts`, `bridges/hooks/{event-router,stage}.test.ts`,
`bridges/skills/{stage,unstage}.test.ts`,
`orchestrators/plugin/{enable-disable,fetch,info,install,reinstall,uninstall}.test.ts`,
`orchestrators/reconcile/apply.test.ts`, `shared/path-safety.test.ts`. Those
areas should each be checked for (a) whether the patched builtin was a
substitute for an injection seam the production module should expose, and (b)
whether the branch reached is reachable at all. In my area the answer to both was
no and no.

**2. The "force an object to lie" technique is broader than the four files
Decision 1 names, and splits into three sub-shapes that need different answers.**
Repo-wide: `String.prototype`/`RegExp.prototype` patching in **6** files
(`bridges/commands/stage.test.ts` ×3, `bridges/hooks/if-field/index.test.ts` ×2,
`bridges/skills/frontmatter-degrade.test.ts` ×4,
`bridges/skills/rewrite-frontmatter.test.ts`, `shared/notify.test.ts:6250`);
`Object.defineProperty` counting getters in **16** files. The three sub-shapes,
which want different verdicts:
  - *(a) genuinely dead defensive code* — delete the production line and the
    case (`discover.ts:178`'s `?? ""`, `stage.ts:204`'s re-`assertSafeName`,
    `stage.ts:102-111`);
  - *(b) compiler-forced narrowing* — the production line **cannot** be deleted;
    only the case is in question (`discover.ts:288-290`, D-116-01a);
  - *(c) a real failure reachable without lying* — the case is simply written the
    hard way (`stage.test.ts:659-672`, `993-1009`, both of which can be driven by
    a real filesystem obstruction the way `unstage.test.ts:213` does).
  Lumping these produces a decision the fixing pass cannot execute. Every area
  holding one of these should classify it into (a)/(b)/(c) before the operator
  decides.

**3. The hand-built `ResolvedPluginInstallable` literal is an 11-file
duplication, not a 2-file one.** `grep -rl 'state: "installable"' tests/`:
`bridges/{agents/stage,commands/discover,commands/stage,skills/discover,skills/stage}.test.ts`,
`domain/resolver.test.ts`,
`orchestrators/plugin/{discover-names,git-source-probe,install,plugin-state-classifier,shared}.test.ts`.
It is the resolver's public output shape and every bridge and orchestrator test
needs it, so this wants one seed function, and `domain/resolver.ts` is the
concern it belongs to. Several area files logged it locally as a 2-file nit.

**4. Barrel export-surface pinning exists in exactly one of four bridge barrel
tests.** `tests/bridges/skills/index.test.ts:40-41,53-63` declares
`keyof typeof import(...)` and pins the full runtime export union;
`commands`, `agents`, and `mcp` do not, so "the barrel grew an export" is an
undetected mutation in three of four. `tests/bridges/hooks/index.test.ts:29-32`
solves the same problem from the other direction with a
`Public<Name extends keyof typeof HooksBarrel>` helper and one negative per
internal. Either form works; the point is that 3 of 5 bridge barrels have
neither. This should be checked for every `index.ts` in the tree, not only under
`bridges/`.

**5. Field-level `readonly` negatives are present in 2 of 4 bridge type tests.**
`agents/types.test.ts:219-241` and `mcp/types.test.ts:229-245` have them;
`commands/types.test.ts` and `skills/types.test.ts` have only array-mutability
checks. Dropping `readonly` from a field is undetected in the latter two. Worth
sweeping every `types.test.ts` in the repo for the same split.

### Corrections to META-FINDINGS.md

- **"Decisions the fixing pass cannot make", item 1** names
  "`bridges/hooks/if-field/{bash,glob}.test.ts`" as prototype-patching files.
  `grep -rn "prototype\|defineProperty\|hasInstance" tests/bridges/hooks/if-field/`
  returns hits in **`index.test.ts` only** — `String.prototype.endsWith` at lines
  376-382 and `RegExp.prototype.exec` at 424-431. `bash.test.ts` and
  `glob.test.ts` contain none. Correct the file list, and extend it: the same
  item's set of four files should be at least
  `bridges/commands/{stage,discover}.test.ts`,
  `bridges/hooks/if-field/index.test.ts`,
  `bridges/skills/{frontmatter-degrade,rewrite-frontmatter}.test.ts`,
  `shared/notify.test.ts`, `orchestrators/marketplace/remove.test.ts`.
- **Same item, the framing "the branches are dead defensive code to delete, or
  they are deliberate and the propping-up tests are the problem."** For
  `discover.ts:288-290` neither option is available: the `instanceof` is
  compiler-forced narrowing for `badNameWarning(err: CommandNameError)`
  (`discover.ts:101`), so deleting it breaks the build. The item cites D-116-01a
  as a "relation"; for at least this instance D-116-01a **is** the answer, not a
  neighbouring concern. The decision needs the (a)/(b)/(c) split above.
- **"Patterns to propagate" table** should gain two rows this area supplies:
  *barrel runtime-export-surface pin* → `tests/bridges/skills/index.test.ts:40,53-63`;
  *field-level `readonly` negatives for a type-only module* →
  `tests/bridges/agents/types.test.ts:219-241`.

### Confirmations

- **"The dominant shape: sibling drift"** — confirmed from a second angle and in
  a new direction. Every one of my highest-value findings has a named in-repo
  target: containment cases exist in `skills/stage.test.ts:688`,
  `agents/stage.test.ts:1923`, and this bridge's own `unstage.test.ts:119-204`
  but not in `commands/stage.test.ts`; readonly negatives exist in agents and mcp
  but not commands and skills; the export-surface pin exists in skills only; the
  `assertSafeName` on previous names exists in `skills/stage.ts:326` and
  `commands/stage.ts:389` but not `commands/stage.ts:306`. The fix really is
  propagation, not invention.
- **"Clean verdicts are not reliable"** — confirmed hard. Both files on this
  area's test clean list yielded findings (a missing export-surface pin, missing
  readonly negatives, a `@ts-expect-error` comment contradicted 31 lines above in
  its own file), and the area's single largest defect (eight unexercised
  containment guards) sat in a file the first pass had already reviewed and
  characterised as strong.
- **"Direct per-pair coverage was never measured"** — confirmed as consequential
  here. The eight unexercised `stage.ts` guards are exactly what a
  `npm run test:coverage:direct` on the `stage.ts` ↔ `stage.test.ts` pair would
  have surfaced in one command, and reading found them only because I grepped for
  the label strings.
- **"Reviewing production alongside tests was worth it"** — confirmed: two of my
  three most actionable items (`discover.ts:178`'s dead coalesce,
  `commands/stage.ts:306`'s missing name check) are production findings that only
  appear when the test's contortions are traced back to the line that forced them.
